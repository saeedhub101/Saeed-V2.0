// Motion playback, authoring, rig-slot editing, and custom-motion operations.
import { requiredRigSlots } from "./AutoRigMapper.js";
const missingRequiredSlots = mapping => requiredRigSlots().filter(slot => !mapping?.[slot]);

export class CharacterMotionOperations {
 beginAuthoring(){
  this.authoring=true;
  this.autonomous?.stop?.();
  this.animation.stopAll({reset:false});
  this.clearIdleTimer();
  this.idleBusy=false;
  this.engine?.wakeRender?.();
  return true;
 }
 endAuthoring(){
  this.authoring=false;
  if(this.animationEnabled&&!this.animationPaused&&this.visible)this.autonomous?.start?.();
  return true;
 }
 
 play(id,options={}){
  const wasAuthoring=this.authoring;
  this.authoring=false;
  // Keep the autonomous scheduler alive during explicit motion. Its evaluator
  // observes active animation layers and defers idle motion instead of losing its
  // timer permanently after the first user/Brain gesture.
  if(!this.animationEnabled||this.animationPaused){this.authoring=wasAuthoring;return false;}
  if(!this.characterId)this.bindCurrentCharacter();
  // Binding can enter authoring mode while recovering an incomplete rig. Playback is
  // an explicit transition out of authoring; resume autonomous behavior after it ends.
  this.authoring=false;
  const key=String(id||"idle");
  if(key==="idle"){
   this.animation.stopAll({reset:false});
   this.idleBusy=false;
   this.animation.setIdlePose(this.animation.idlePose||{});
   this.startIdleScheduler(7000);
   return true;
  }
  const ok=this.animation.play(key,options);
  if(ok)this.startFrameLoop();
  else if(wasAuthoring){this.authoring=true;}
  else if(this.visible&&this.animationEnabled&&!this.animationPaused)this.autonomous?.start?.();
  return ok;
 }
 stop(id){const out=this.animation.stop(id);if(!this.animation.active.length)this.finishMotion();return out}
 stopAll(){const out=this.animation.stopAll();this.finishMotion();return out}
 finishMotion(){this.idleBusy=false;if(this.authoring||!this.visible||!this.animationEnabled||this.animationPaused)return false;this.autonomous?.start?.();return true}
 setPose(pose={}){if(pose?.__captureRest){const rest=this.saveRestPose();this.startFrameLoop();return rest}if(this.authoring)this.beginAuthoring();const bones=pose?.__bones;if(bones){const applied={};for(const [name,transform] of Object.entries(bones)){const ok=transform?.rotation||transform?.position?this.engine?.setBoneTransform?.(name,transform):this.engine?.setBoneRotation?.(name,transform);if(ok)applied[name]=transform}if(Object.keys(applied).length)this.startFrameLoop();return Object.keys(applied).length?applied:false}if(!this.animationEnabled||this.animationPaused)return false;const out=this.animation.setPose(pose);this.startFrameLoop();return out}
  
 bindSlot(slot,name){
   this.beginAuthoring();
   const s=String(slot||"").trim(),n=String(name||"").trim();
   if(!s||!n)return false;
   const names=this.engine?.getAvailableBoneNames?.()||[];
   if(!names.some(x=>String(x)===n))return false;
   const current={...(this.engine?.getCharacterRigAutoMap?.()||{})};
   current[s]=n;
   const profileId=this.profiles.idFor(names,this.engine?.getCharacterProfileKey?.()||"saeed");
   const existing=this.profiles.load(profileId)||{};
   const savedRestPose=existing.normalizehumanoidrestpose||existing.restPose||null;
   const ok=this.engine?.bindRig?.(current,savedRestPose);
   if(!ok){this.rigReady=false;return false;}
   const mapped=this.engine?.getBoneMap?.()||{};
   if(!mapped[s]||String(mapped[s]?.name||"")!==n){this.rigReady=false;return false;}
   this.retargeter.bind(mapped,this.retargeter.status().calibration);
   this.fingers.bind(names);
   this.animation.bindRig(mapped,this.retargeter);
   this.characterId=profileId;
   const missingRequired=missingRequiredSlots(mapped);
   this.rigReady=Object.keys(mapped).length>0;
   this.lastBindingResult={loaded:this.rigReady,reason:this.rigReady?(missingRequired.length?"Partial rig: missing "+missingRequired.join(", "):undefined):"No logical joints could be mapped",missingRequired,partial:missingRequired.length>0,mappedBoneCount:Object.keys(mapped).length,sceneBoneCount:names.length};
   if(this.characterId){
    const restPose=savedRestPose||{
     normalization:this.engine?.getRestPoseNormalization?.()||null,
     bones:this.engine?.snapshotBoneRotations?.()||{}
    };
    this.profiles.save(this.characterId,{mapping:current,autoConfidence:existing.autoConfidence||{},calibration:this.retargeter.status().calibration,restPose,normalizehumanoidrestpose:restPose,idlePose:this.animation.idlePose});
   }
   return true;
  }
  
 calibrateJoint(slot,rotation={}){const ok=this.retargeter.setCalibration(slot,rotation);if(ok&&this.characterId)this.profiles.save(this.characterId,{calibration:this.retargeter.status().calibration});return ok}
 
 setIdlePose(pose={}){
  if(!this.animationEnabled||this.animationPaused)return false;
  const requested=pose&&Object.keys(pose).length?pose:null;
  const current=requested||this.engine?.snapshotLogicalPose?.()||this.animation.pose.snapshot()||{};
  this.beginAuthoring();
  const out=this.animation.setIdlePose(current);
  if(!this.characterId){
   const names=this.engine?.getAvailableBoneNames?.()||[];
   if(names.length)this.characterId=this.profiles.idFor(names,this.engine?.getCharacterProfileKey?.()||"saeed");
  }
  if(this.characterId)this.profiles.save(this.characterId,{idlePose:out});
  return out;
 }
 remap(mapping={}){
  this.beginAuthoring();
  const names=this.engine?.getAvailableBoneNames?.()||[];
  const available=new Set(names.map(String));
  const requested=Object.values(mapping||{}).filter(Boolean).map(String);
  if(!requested.length||requested.some(name=>!available.has(name))){this.rigReady=false;return false;}
  this.characterId=this.profiles.idFor(names,this.engine?.getCharacterProfileKey?.()||"saeed");
  const existing=this.characterId?(this.profiles.load(this.characterId)||{}):{};
  const savedRestPose=existing.normalizehumanoidrestpose||existing.restPose||null;
  const ok=this.engine?.bindRig?.(mapping,savedRestPose);
  if(!ok){this.rigReady=false;return false;}
  const mapped=this.engine?.getBoneMap?.()||{};
  if(!Object.keys(mapped).length){this.rigReady=false;return false;}
  this.retargeter.bind(mapped,this.retargeter.status().calibration);
  this.fingers.bind(names);
  this.animation.bindRig(mapped,this.retargeter);
  this.characterId=this.profiles.idFor(names,this.engine?.getCharacterProfileKey?.()||"saeed");
  if(this.characterId){
   const existing=this.profiles.load(this.characterId)||{};
   const restPose=existing.normalizehumanoidrestpose||existing.restPose||{
    normalization:this.engine?.getRestPoseNormalization?.()||null,
    bones:this.engine?.snapshotBoneRotations?.()||{}
   };
   this.profiles.save(this.characterId,{mapping,autoConfidence:{},calibration:this.retargeter.status().calibration,restPose,normalizehumanoidrestpose:restPose,idlePose:this.animation.idlePose,customMotions:this.editor.list()});
  }
  const missingRequired=missingRequiredSlots(mapped);
  this.rigReady=Object.keys(mapped).length>0;
  this.lastBindingResult={loaded:this.rigReady,missingRequired,partial:missingRequired.length>0,reason:this.rigReady?(missingRequired.length?"Partial rig: missing "+missingRequired.join(", "):undefined):"No logical joints could be mapped",mappedBoneCount:Object.keys(mapped).length,sceneBoneCount:names.length,bound:true};
  return this.rigReady;
}
 
 setLimit(slot,limit){return this.animation.setLimit(slot,limit)}
 setMotionEnabled(id,enabled=true){const ok=this.animation.setMotionEnabled(id,enabled);if(ok&&this.characterId)this.profiles.save(this.characterId,{customMotions:this.editor.list()});return ok}
 defineMotion(def){const out=this.editor.define(def);if(this.characterId)this.profiles.save(this.characterId,{customMotions:this.editor.list()});return out}
 deleteMotion(id){const ok=this.editor.remove(id);if(ok&&this.characterId)this.profiles.save(this.characterId,{customMotions:this.editor.list()});return ok}
 listMotions(){return this.editor.list()}
}
