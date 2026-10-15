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
 
 getVisemeMap(){const names=this.engine?.getAvailableBoneNames?.()||[];if(!this.characterId&&names.length)this.characterId=this.profiles.idFor(names,this.engine?.getCharacterProfileKey?.()||"saeed");const profile=this.characterId?(this.profiles.load(this.characterId)||{}):{};const mapping=profile.visemeMap&&typeof profile.visemeMap==="object"?profile.visemeMap:{};this.face?.setVisemeMap?.(mapping);return mapping;}
 setVisemeMap(mapping={}){const names=this.engine?.getAvailableBoneNames?.()||[];if(!this.characterId&&names.length)this.characterId=this.profiles.idFor(names,this.engine?.getCharacterProfileKey?.()||"saeed");const clean={};for(const [key,value] of Object.entries(mapping||{})){const k=String(key).trim().toLowerCase(),v=String(value||"").trim();if(k&&v)clean[k]=v}this.face?.setVisemeMap?.(clean);if(this.characterId)this.profiles.save(this.characterId,{visemeMap:clean});return{ok:true,visemeMap:clean};}
 getMotionAxisFixes(){const names=this.engine?.getAvailableBoneNames?.()||[];if(!this.characterId&&names.length)this.characterId=this.profiles.idFor(names,this.engine?.getCharacterProfileKey?.()||"saeed");const profile=this.characterId?(this.profiles.load(this.characterId)||{}):{};const fixes=profile.motionAxisFixes&&typeof profile.motionAxisFixes==="object"?profile.motionAxisFixes:{};this.animation.setMotionAxisFixes?.(fixes);return fixes;}
 setMotionAxisFix(motionId,slot,fix){const id=String(motionId||"").trim(),joint=String(slot||"").trim();if(!id||!joint||!this.animation.registry.get(id))return{ok:false,error:"A valid motion and logical joint are required"};const current=JSON.parse(JSON.stringify(this.getMotionAxisFixes()||{}));if(!current[id]||typeof current[id]!=="object")current[id]={};if(!fix){delete current[id][joint];if(!Object.keys(current[id]).length)delete current[id]}else{const swz=Array.isArray(fix.swz)?fix.swz.map(Number):[0,1,2],sign=Array.isArray(fix.sign)?fix.sign.map(v=>Number(v)<0?-1:1):[1,1,1],scale=Math.max(0,Math.min(4,Number(fix.scale??1)||0)),offset=Array.isArray(fix.offset)?fix.offset.slice(0,3).map(v=>Number(v)||0):[0,0,0];if(swz.length!==3||new Set(swz).size!==3||swz.some(v=>![0,1,2].includes(v)))return{ok:false,error:"Axis mapping must use X, Y and Z exactly once"};current[id][joint]={swz,sign:sign.slice(0,3),scale,offset}}this.animation.setMotionAxisFixes?.(current);const names=this.engine?.getAvailableBoneNames?.()||[];if(!this.characterId&&names.length)this.characterId=this.profiles.idFor(names,this.engine?.getCharacterProfileKey?.()||"saeed");if(this.characterId)this.profiles.save(this.characterId,{motionAxisFixes:current});return{ok:true,motionAxisFixes:current,motionId:id,slot:joint};}
 clearMotionAxisFixes(motionId){const id=String(motionId||"").trim();if(!id)return{ok:false,error:"Motion ID is required"};const current=JSON.parse(JSON.stringify(this.getMotionAxisFixes()||{}));delete current[id];this.animation.setMotionAxisFixes?.(current);if(this.characterId)this.profiles.save(this.characterId,{motionAxisFixes:current});return{ok:true,motionAxisFixes:current,motionId:id};}
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
  this.getMotionAxisFixes();
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
 
 async setAccessory(definition,enabled=true,state={}){
  const def=definition&&typeof definition==="object"?definition:{},id=String(def.id||"").trim();if(!id)return{ok:false,error:"Accessory id is required"};
  const names=this.engine?.getAvailableBoneNames?.()||[];
  if(!this.characterId)this.characterId=this.profiles.idFor(names,this.engine?.getCharacterProfileKey?.()||"saeed");
  const profile=this.characterId?(this.profiles.load(this.characterId)||{}):{},previous=profile.accessories&&typeof profile.accessories==="object"?profile.accessories:{};
  const prior=previous[id]||{},nextState=enabled!==false?{...prior,...state,definition:def,on:true,bone:String(state.bone||prior.bone||def.bone||"head"),scale:Math.max(.05,Math.min(10,Number(state.scale??prior.scale??def.scale??1)||1))}:{...prior,on:false};
  const loadFile=async item=>{const api=window.saeed?.addons;if(!api?.addonFile)throw new Error("Add-on accessory file service is unavailable");return api.addonFile(item.addon,item.file)};
  const result=await this.engine?.setAccessory?.({...def,bone:nextState.bone||def.bone},enabled!==false,loadFile,nextState);
  if(!result?.ok)return result||{ok:false,error:"Character engine rejected the accessory"};
  try{this.profiles.save(this.characterId,{accessories:{...previous,[id]:nextState}})}
  catch(error){if(enabled!==false)await this.engine?.setAccessory?.(def,false,loadFile,nextState);return{ok:false,error:"Accessory state could not be persisted: "+(error?.message||String(error))}}
  return result;
 }
 getAccessoryState(){const profile=this.characterId?(this.profiles.load(this.characterId)||{}):{};return profile.accessories&&typeof profile.accessories==="object"?profile.accessories:{}}
 async restoreAccessories(){
  const profileId=this.characterId;if(!profileId)return false;
  const profile=this.profiles.load(profileId)||{},states=profile.accessories&&typeof profile.accessories==="object"?profile.accessories:{};
  if(!Object.values(states).some(state=>state?.on)){this.accessoryRestoreProfileId=profileId;return true}
  const api=window.saeed?.addons;
  if(this.accessoryRestorePromise)return this.accessoryRestorePromise;
  this.accessoryRestorePromise=(async()=>{const defs=api?.accessoriesList?await api.accessoriesList():[],loadFile=async item=>{if(!api?.addonFile)throw new Error("Accessory asset provider is unavailable");return api.addonFile(item.addon,item.file)};let failures=0;
   const definitions=new Map(defs.map(def=>[String(def.id),def]));for(const [id,state] of Object.entries(states)){if(!state?.on)continue;const def=state.definition||definitions.get(id);if(!def)continue;const result=await this.engine?.setAccessory?.({...def,bone:state.bone||def.bone},true,loadFile,state);if(!result?.ok){failures++;try{window.saeed?.system?.reportDiagnostic?.("WARN","ACCESSORY RESTORE",result?.error||("Could not restore "+id),{id,profileId})}catch{}}}
   this.accessoryRestoreProfileId=profileId;return failures===0
  })();
  try{return await this.accessoryRestorePromise}catch(error){try{window.saeed?.system?.reportDiagnostic?.("ERROR","ACCESSORY RESTORE",error?.stack||error?.message||String(error),{profileId})}catch{}return false}finally{this.accessoryRestorePromise=null}
 }
 setLimit(slot,limit){return this.animation.setLimit(slot,limit)}
 setMotionEnabled(id,enabled=true){const ok=this.animation.setMotionEnabled(id,enabled);if(ok&&this.characterId)this.profiles.save(this.characterId,{customMotions:this.editor.list()});return ok}
 defineMotion(def){const out=this.editor.define(def);if(this.characterId)this.profiles.save(this.characterId,{customMotions:this.editor.list()});return out}
 deleteMotion(id){const ok=this.editor.remove(id);if(ok&&this.characterId)this.profiles.save(this.characterId,{customMotions:this.editor.list()});return ok}
 listMotions(){return this.editor.list()}
}
