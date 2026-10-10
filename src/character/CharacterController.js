import { AnimationController } from "./AnimationController.js";
import { CharacterRetargeter } from "./CharacterRetargeter.js";
import { registerCoreMotions } from "./motions.js";
import { autoMapBones,requiredRigSlots,optionalRigSlots } from "./AutoRigMapper.js";
const missingRequiredSlots=mapping=>requiredRigSlots().filter(slot=>!mapping?.[slot]);
import { FaceController } from "./FaceController.js";
import { FingerController } from "./FingerController.js";
import { MotionEditor } from "./MotionEditor.js";
import { CharacterProfileStore } from "./CharacterProfileStore.js";
import { AutonomousBehaviorController } from "./AutonomousBehaviorController.js";
import { verifyRestPoseSnapshot } from "./rest-pose-validation.mjs";

export class CharacterController{
 constructor(engine){
  this.engine=engine;this.rigReady=false;this.binding=false;this.lastBindingResult=null;this.animation=new AnimationController(engine);this.autonomous=new AutonomousBehaviorController(this);this.lastTickAt=0;this.engine?.setAnimationTick?.((now)=>{const t=Number(now)||performance.now();const dt=this.lastTickAt?Math.min(.25,Math.max(0,(t-this.lastTickAt)/1000)):.0166667;this.lastTickAt=t;this.update(dt);return Boolean(this.visible&&!this.animationPaused&&this.animationEnabled&&this.animation.active.length)});this.retargeter=new CharacterRetargeter();this.behavior={idle:true,breathing:false,blinking:true,expressions:true,speechFace:true,eyeTracking:true,autonomousMovement:true,frequencyMs:7000,eventCooldownMs:2500,sleepAfterMs:60*60*1000};this.face=new FaceController(engine);this.fingers=new FingerController(engine);this.editor=new MotionEditor(this.animation.registry);this.profiles=new CharacterProfileStore();this.characterId=null;this.mood="cheerful";this.authoring=false;this.visible=true;this.animationEnabled=this.readAnimationEnabled();this.animationPaused=false;this.idleTimer=null;this.frame=null;this.recentIdle=[];this.idleBusy=false;this.lastInteraction=performance.now();
  this.autonomous.configure(this.behavior);registerCoreMotions(this.animation);
  this.idlePool=[{id:"nod",weight:5},{id:"think",weight:4},{id:"stretch",weight:3},{id:"lookCloser",weight:2},{id:"yawn",weight:1},{id:"crackBack",weight:2},{id:"crackFingers",weight:2},{id:"wave",weight:2}];
 }
 readAnimationEnabled(){try{return localStorage.getItem("saeed.character.animations.enabled")!=="0"}catch{return true}}
 writeAnimationEnabled(value){try{localStorage.setItem("saeed.character.animations.enabled",value?"1":"0")}catch{}}
 setAnimationEnabled(value){
  const enabled=value!==false;this.animationEnabled=enabled;this.writeAnimationEnabled(enabled);
  if(!enabled){this.animationPaused=false;this.clearIdleTimer();this.stopAll();return enabled}
  if(this.visible&&!this.animationPaused)this.startIdleScheduler(1200);return enabled;
 }
 setAnimationPaused(value){
  const paused=Boolean(value);this.animationPaused=paused;
  if(paused){this.clearIdleTimer();this.animation.stopAll();this.idleBusy=false;this.engine?.wakeRender?.();return true}
  if(this.animationEnabled&&this.visible)this.startIdleScheduler(1200);return this.animationPaused;
 }
 ensureRigBound({authoring=false}={}){
  const pose=this.engine?.getCharacterPoseStatus?.()||{};
  if(!pose.loaded)return{ok:false,error:"Character GLB is not loaded"};
  const names=this.engine?.getAvailableBoneNames?.()||[];
  if(!names.length)return{ok:false,error:"Character skeleton has no bones"};
  const available=new Set(names.map(String));
  const validMap=map=>{
   const entries=Object.values(map||{});
   return entries.length>0&&entries.every(b=>available.has(String(b?.name||b)));
  };
  let mapped=this.engine?.getBoneMap?.()||{};
  if(!validMap(mapped)){
   let result=null;
   try{result=this.onCharacterLoaded?.()}catch(error){result={ok:false,reason:error?.message||String(error)}}
   mapped=this.engine?.getBoneMap?.()||{};
   if(!validMap(mapped)){
    try{const fallback=this.autoMap?.();if(fallback?.ok)result=fallback}catch(error){result={ok:false,reason:error?.message||String(error)}}
    mapped=this.engine?.getBoneMap?.()||{};
   }
   if(!validMap(mapped)){
    if(authoring){
     this.beginAuthoring();
     return{ok:true,mapping:{},boneCount:0,sceneBoneCount:names.length,rawBoneControl:true};
    }
    return{ok:false,error:result?.reason||"Character rig could not be bound to the current skeleton",result};
   }
  }
  const boneCount=Object.keys(mapped).length;
  const missingRequired=missingRequiredSlots(mapped);
  this.rigReady=Object.keys(mapped).length>0;
  if(!boneCount&&!authoring)return{ok:false,error:"No controllable bones are available; the character remains visible as a static mesh",missingRequired,boneCount,sceneBoneCount:names.length};
  if(authoring)this.beginAuthoring();
  return{ok:true,mapping:this.engine?.getCharacterRigAutoMap?.()||{},boneCount,sceneBoneCount:names.length,missingRequired,rawBoneControl:missingRequired.length>0};
 }
 bindCurrentCharacter(){
  if(this.binding)return this.lastBindingResult||{loaded:false,reason:"Character rig binding already in progress"};
  this.binding=true;
  try{
   const names=this.engine?.getAvailableBoneNames?.()||[];
   if(!names.length){this.rigReady=false;this.lastBindingResult={loaded:false,reason:"No skeleton bones are available",mappedBoneCount:0,sceneBoneCount:0};return this.lastBindingResult;}
   const profileId=this.profiles.idFor(names,this.engine?.getCharacterProfileKey?.()||"saeed");
   const profile=this.profiles.load(profileId)||{};
   const savedRestPose=profile.normalizehumanoidrestpose||profile.restPose||null;
   const engineMap=this.engine?.getCharacterRigAutoMap?.()||{};
   let mapping=Object.keys(engineMap).length?{...engineMap}:null;
   let autoResult=null;
   if(!mapping){
    autoResult=this.engine?.autoMapRig?.(savedRestPose)||{ok:false};
    mapping=autoResult?.mapping||{};
   }
   if(profile.mapping&&Object.keys(profile.mapping).length){
    const available=new Set(names.map(String));
    const profileMapping={};
    for(const [slot,name] of Object.entries(profile.mapping))if(name&&available.has(String(name)))profileMapping[slot]=String(name);
    if(Object.keys(profileMapping).length)mapping={...mapping,...profileMapping};
   }
   if(!Object.keys(mapping).length){this.rigReady=false;this.lastBindingResult={loaded:false,reason:autoResult?.error||"Engine could not map any logical bones",mappedBoneCount:0,sceneBoneCount:names.length};return this.lastBindingResult;}
   const bound=this.engine?.bindRig?.(mapping,savedRestPose);
   const mapped=this.engine?.getBoneMap?.()||{};
   const mappedBoneCount=Object.keys(mapped).length;
   const available=new Set(names.map(String));
   const valid=mappedBoneCount>0&&Object.values(mapped).every(b=>available.has(String(b?.name||b)));
   if(!bound||!valid){this.rigReady=false;this.lastBindingResult={loaded:false,reason:"Engine rig binding did not resolve mapped bones to the current skeleton",mappedBoneCount,sceneBoneCount:names.length,mapping};return this.lastBindingResult;}
   this.retargeter.bind(mapped,this.retargeter.status().calibration);
   this.fingers.bind(names);
   this.animation.bindRig(mapped,this.retargeter);
   this.animation.stopAll();
   this.characterId=profileId;
   const missingRequired=missingRequiredSlots(mapped);
   this.rigReady=Object.keys(mapped).length>0;
   const restPose=savedRestPose||{normalization:this.engine?.getRestPoseNormalization?.()||null,bones:this.engine?.snapshotBoneRotations?.()||{}};
   this.profiles.save(profileId,{mapping:Object.fromEntries(Object.entries(mapped).map(([slot,b])=>[slot,b?.name||b])),autoConfidence:autoResult?.confidence||profile.autoConfidence||{},calibration:this.retargeter.status().calibration,restPose,normalizehumanoidrestpose:restPose,idlePose:this.animation.idlePose,customMotions:this.editor.list()});
   this.lastBindingResult={loaded:mappedBoneCount>0,mappedBoneCount,sceneBoneCount:names.length,bound:true,profileId,missingRequired,partial:missingRequired.length>0,reason:missingRequired.length?"Partial rig: missing "+missingRequired.join(", "):undefined,mapping:Object.fromEntries(Object.entries(mapped).map(([slot,b])=>[slot,b?.name||b]))};
   return this.lastBindingResult;
  }finally{this.binding=false;}
 }
 autoMap(){
  this.beginAuthoring();
  const names=this.engine?.getAvailableBoneNames?.()||[];
  if(!names.length){this.rigReady=false;return{ok:false,error:"Character skeleton has no bones",mapping:{},confidence:{},mappedBoneCount:0};}
  const profileId=this.profiles.idFor(names,this.engine?.getCharacterProfileKey?.()||"saeed");
  const profile=this.profiles.load(profileId)||{};
  const savedRestPose=profile.normalizehumanoidrestpose||profile.restPose||null;
  const result=this.engine?.autoMapRig?.(savedRestPose)||{ok:false,error:"CharacterEngine autoMapRig is unavailable",mapping:{},confidence:{},mappedBoneCount:0};
  if(!result.ok){this.rigReady=false;this.lastBindingResult={loaded:false,mappedBoneCount:result.mappedBoneCount||0,sceneBoneCount:names.length,bound:false,reason:result.error};return result;}
  const bound=this.bindCurrentCharacter();
  if(!bound?.loaded){this.rigReady=false;return{...result,ok:false,error:bound?.reason||"Controller could not consume the Engine rig",mappedBoneCount:bound?.mappedBoneCount||0};}
  this.rigReady=true;
  return{...result,ok:true,mapping:bound.mapping||result.mapping, mappedBoneCount:bound.mappedBoneCount,sceneBoneCount:names.length};
 }
 saveRestPose(){
  const pose=this.engine?.getCharacterPoseStatus?.()||{};
  const names=this.engine?.getAvailableBoneNames?.()||[];
  if(!pose.loaded||!names.length)return null;
  // Capture the current authoritative transforms directly. Rebinding here can restore
  // an older persisted pose before the new pose is captured.
  this.beginAuthoring();
  if(!this.characterId)this.characterId=this.profiles.idFor(names,this.engine?.getCharacterProfileKey?.()||"saeed");
  const normalization=this.engine?.getRestPoseNormalization?.()||null;
  this.engine?.captureAuthoritativeRestPose?.(normalization);
  const bones=this.engine?.snapshotBoneRotations?.()||{};
  const authoritativeNormalization=this.engine?.getRestPoseNormalization?.()||normalization;
  const restPose={normalization:authoritativeNormalization,bones};
  let persisted=false;
  let persistedProfile=null;
  if(this.characterId){
   persistedProfile=this.profiles.save(this.characterId,{restPose,normalizehumanoidrestpose:restPose});
   const verify=(stored={})=>verifyRestPoseSnapshot(bones,stored);
   persisted=verify(this.profiles.load(this.characterId)||{});
   if(!persisted){
    persistedProfile=this.profiles.save(this.characterId,{restPose,normalizehumanoidrestpose:restPose});
    persisted=verify(this.profiles.load(this.characterId)||{});
   }
  }
  return {...restPose,persisted,profileId:this.characterId,storageKey:"saeed.character.profiles.v1",persistedProfile: persistedProfile ? {updatedAt:persistedProfile.updatedAt||null} : null};
 }
 normalizeRestPose(){
  const ready=this.ensureRigBound({authoring:true});
  if(!ready.ok)return null;
  const normalization=this.engine?.normalizeHumanoidRestPose?.()||null;
  if(normalization?.normalized){
   this.engine?.captureAuthoritativeRestPose?.(normalization);
   if(!this.characterId){
    const names=this.engine?.getAvailableBoneNames?.()||[];
    if(names.length)this.characterId=this.profiles.idFor(names,this.engine?.getCharacterProfileKey?.()||"saeed");
   }
   if(this.characterId){
    const restPose={normalization:this.engine?.getRestPoseNormalization?.()||normalization,bones:this.engine?.snapshotBoneRotations?.()||{}};
    this.profiles.save(this.characterId,{restPose,normalizehumanoidrestpose:restPose});
   }
  }
  return normalization;
}
 resetPose(){
  const ready=this.ensureRigBound({authoring:true});
  if(!ready.ok)return false;
  this.animation.stopAll({reset:false});
  this.animation.pose.clear();
  this.idleBusy=false;
  const profile=this.characterId?(this.profiles.load(this.characterId)||{}):{};
  const savedRest=profile.normalizehumanoidrestpose||profile.restPose||null;
  if(savedRest?.bones&&Object.keys(savedRest.bones).length){
   this.engine?.applyRestPoseSnapshot?.(savedRest.bones,savedRest.normalization||null);
  }else{
   this.engine?.resetCharacterPose?.();
  }
  this.engine?.wakeRender?.(250);
  return true;
}
 setBoneRotation(name,rotation={}){const bone=String(name||"");if(!bone)return false;this.beginAuthoring();const ok=this.engine?.setBoneRotation?.(bone,rotation);if(ok)this.engine?.wakeRender?.(120);return Boolean(ok)}
 setLogicalJointRotation(slot,rotation={}){const key=String(slot||"").trim();if(!key)return false;this.beginAuthoring();const mapped=this.engine?.getBoneMap?.()||{};const bone=mapped[key];const name=String(bone?.name||bone||"");if(!name)return false;const ok=this.engine?.setBoneRotation?.(name,rotation);if(ok){this.animation.pose.set(key,{x:Number(rotation?.x)||0,y:Number(rotation?.y)||0,z:Number(rotation?.z)||0});this.engine?.wakeRender?.(8000)}return Boolean(ok)}
 resetBoneToRest(name){const bone=String(name||"");if(!bone)return null;const ok=this.engine?.resetBoneToRest?.(bone);if(!ok)return null;this.engine?.wakeRender?.(120);return this.engine?.getBoneRotation?.(bone)||null}
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
  if(this.authoring)this.endAuthoring();
  if(!this.animationEnabled||this.animationPaused)return false;
  if(!this.characterId)this.bindCurrentCharacter();
  const key=String(id||"idle");
  if(key==="idle"){
   this.animation.stopAll();
   this.idleBusy=false;
   this.animation.setIdlePose(this.animation.idlePose||{});
   this.startIdleScheduler(7000);
   return true;
  }
  const ok=this.animation.play(key,options);
  if(ok)this.startFrameLoop();
  return ok;
 }
 stop(id){const out=this.animation.stop(id);if(!this.animation.active.length)this.finishMotion();return out}
 stopAll(){const out=this.animation.stopAll();this.finishMotion();return out}
 finishMotion(){this.idleBusy=false;this.autonomous?.schedule?.()}
 setPose(pose={}){if(this.authoring)this.beginAuthoring();if(!this.animationEnabled||this.animationPaused)return false;if(pose?.__captureRest){const rest=this.saveRestPose();this.startFrameLoop();return rest}const bones=pose?.__bones;if(bones){for(const [name,transform] of Object.entries(bones)){if(transform?.rotation||transform?.position)this.engine?.setBoneTransform?.(name,transform);else this.engine?.setBoneRotation?.(name,transform)}this.startFrameLoop();return bones}const out=this.animation.setPose(pose);this.startFrameLoop();return out}
  
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
 setMotionEnabled(id,enabled=true){return this.animation.setMotionEnabled(id,enabled)}
 defineMotion(def){const out=this.editor.define(def);if(this.characterId)this.profiles.save(this.characterId,{customMotions:this.editor.list()});return out}
 deleteMotion(id){const ok=this.editor.remove(id);if(ok&&this.characterId)this.profiles.save(this.characterId,{customMotions:this.editor.list()});return ok}
 listMotions(){return this.editor.list()}
 setBehavior(value={}){this.behavior={...this.behavior,...value};this.autonomous?.configure?.(this.behavior);if(this.behavior.idle===false)this.clearIdleTimer();else this.startIdleScheduler(this.behavior.frequencyMs);return {...this.behavior}}
 setMood(value){const valid=["cheerful","curious","thoughtful","mischievous","pleased","sleepy","puzzled","sad"],v=String(value||"cheerful").toLowerCase();this.mood=valid.includes(v)?v:"cheerful";this.autonomous?.onMoodChanged?.(this.mood);const faceMap={cheerful:"happy",curious:"surprised",thoughtful:"thinking",mischievous:"happy",pleased:"happy",sleepy:"sleepy",puzzled:"confused",sad:"sad"};this.face?.expression?.(faceMap[this.mood]||"neutral",.65);return this.mood}
 getMood(){return this.mood}
 moodPalette(){const pools={sleepy:["yawn","stretch","nod"],thoughtful:["think","nod","lookCloser"],curious:["lookCloser","think","nod"],mischievous:["wave","crackFingers","lookCloser"],pleased:["nod","wave","stretch"],puzzled:["think","shake","lookCloser"],sad:["yawn","nod"],cheerful:["nod","wave","stretch","lookCloser"]};return pools[this.mood]||pools.cheerful}
 setVisible(value){
  const next=value!==false&&String(value)!=="hidden";this.visible=next;
  this.autonomous?.setVisible?.(next);
  if(!next){this.stopAll();return true}
  return true;
 }
 touch(){this.autonomous?.touch?.();this.lastInteraction=performance.now();this.clearIdleTimer();if(this.animationEnabled&&!this.animationPaused&&this.visible)this.startIdleScheduler(4500);return true}
 handleEvent(event){
  if(this.autonomous)return this.autonomous.handleEvent(event);
  if(!this.animationEnabled||this.animationPaused)return false;
  const type=typeof event==="string"?event:String(event?.type||"");
  if(!this.behavior.events)return false;
  if(type==="speech-start"||type==="thinking"){this.clearIdleTimer();this.idleBusy=true;if(type==="thinking")this.play("think",{duration:2.2,priority:35});else this.play("talkGesture",{duration:.9,priority:25});return true}
  if(type==="speech-end"){this.stop("talkGesture");this.idleBusy=false;this.startIdleScheduler(3500);return true}
  if(type==="user-input"){this.clearIdleTimer();this.play("think",{duration:1.8,priority:35});return true}
  if(type==="tool"){this.clearIdleTimer();this.play("think",{duration:1.4,priority:30});return true}
  if(type==="tool_result"){this.clearIdleTimer();this.play("nod",{duration:.65,priority:40});return true}
  if(type==="tool_error"){this.clearIdleTimer();this.play("shake",{duration:.7,priority:40});return true}
  if(type==="double-click"||type==="right-click"){this.touch();this.play("wave",{duration:1.8,priority:45});return true}
  if(type==="zoom"){this.touch();this.play("lookCloser",{duration:2.2,priority:35});return true}
  if(type==="drag-start"||type==="drag"){this.touch();return true}
  if(type==="drag-end"){this.play("nod",{duration:.65,priority:30});return true}
  return false;
 }
 chooseIdle(){
  const pool=this.moodPalette().filter(id=>this.animation.registry.get(id)),candidates=pool.filter(id=>!this.recentIdle.includes(id)),list=candidates.length?candidates:pool;
  if(!list.length)return null;
  const weighted=list.map(id=>{const item=this.idlePool.find(x=>x.id===id);return{id,weight:item?.weight||1}}),total=weighted.reduce((n,x)=>n+x.weight,0);let roll=Math.random()*total;
  for(const x of weighted){roll-=x.weight;if(roll<=0)return x.id}
  return weighted[weighted.length-1].id;
 }
 runIdle(){if(this.autonomous)return this.autonomous.evaluateNow();if(!this.animationEnabled||this.animationPaused||!this.behavior.idle||!this.visible||this.idleBusy||this.animation.active.length)return;const id=this.chooseIdle();if(!id)return;this.recentIdle=[...this.recentIdle.filter(x=>x!==id),id].slice(-4);this.idleBusy=true;this.play(id,{priority:10})}
 clearIdleTimer(){this.autonomous?.clearTimer?.();this.idleTimer=null}
 startIdleScheduler(delay){this.autonomous?.schedule?.(delay);}
 startFrameLoop(){this.lastTickAt=0;this.engine?.wakeRender?.();return true}
 onCharacterLoaded(){
  const poseStatus=this.engine?.getCharacterPoseStatus?.();
  if(!poseStatus?.loaded){this.rigReady=false;return {loaded:false,reason:"Character GLB is not loaded yet"}}
  const sceneNames=this.engine?.getAvailableBoneNames?.()||[];
  if(!sceneNames.length){this.rigReady=false;this.lastBindingResult={loaded:true,rigAvailable:false,staticMesh:true,mappedBoneCount:0,sceneBoneCount:0,reason:"Character is visible as a static mesh; this GLB contains no bones to animate"};return this.lastBindingResult}
  const x=this.bindCurrentCharacter();
  if(!x?.mappedBoneCount){this.rigReady=false;return{loaded:false,reason:x?.reason||"Character rig binding produced no controllable bones",boneCount:sceneNames.length,auto:x?.autoMapping||null}}
  const finalMap=this.engine?.getBoneMap?.()||{};
  const available=new Set(sceneNames.map(String));
  const valid=Object.values(finalMap).length>0&&Object.values(finalMap).every(b=>available.has(String(b?.name||b)));
  if(!valid){this.rigReady=false;return{loaded:false,reason:"Character rig contains a bone outside the current skeleton",boneCount:sceneNames.length}}
  const missingRequired=missingRequiredSlots(finalMap);
  if(!Object.keys(finalMap).length){this.rigReady=false;this.lastBindingResult={...x,loaded:false,missingRequired,reason:"No logical joints could be mapped; character remains visible but skeletal animation is unavailable"};return{loaded:false,...this.lastBindingResult,boneCount:sceneNames.length}}
  this.retargeter.bind(finalMap,this.retargeter.status().calibration);
  this.animation.bindRig(finalMap,this.retargeter);
  this.animation.stopAll();
  this.animation.setIdlePose(this.animation.idlePose||{});
  this.characterId=x.profileId;
  this.rigReady=true;
  this.autonomous?.start?.();
  this.idleBusy=false;
  if(this.animationEnabled&&!this.animationPaused)this.startIdleScheduler(7000);
  return {loaded:true,...x,mappedBoneCount:Object.keys(finalMap).length,rigReady:true};
 }
 update(dt){if(this.animationEnabled&&!this.animationPaused&&this.visible&&this.animation.active.length)this.animation.update(dt);this.autonomous?.update?.(dt)}
 destroy(){this.rigReady=false;this.binding=false;this.lastBindingResult=null;this.clearIdleTimer();this.autonomous?.destroy?.();this.animation?.stopAll?.();this.engine?.setAnimationTick?.(null);if(this.frame){cancelAnimationFrame(this.frame);this.frame=null}this.visible=false;this.engine=null;return true}
 status(){
  let a=this.engine?.getCharacterPoseStatus?.()||{},mapped=this.engine?.getBoneMap?.()||{};
  if(a.loaded&&!Object.keys(mapped).length){
   try{this.onCharacterLoaded?.()}catch{}
   a=this.engine?.getCharacterPoseStatus?.()||a;
   mapped=this.engine?.getBoneMap?.()||mapped;
  }
  return{...this.animation.status(),profileId:this.characterId,face:this.face.status(),fingers:this.fingers.status(),customMotions:this.editor.list(),autoRig:this.engine?.getCharacterRigAutoMap?.()||Object.fromEntries(Object.entries(mapped).map(([slot,bone])=>[slot,bone?.name||bone])),actualBones:a.bones||{},tPose:a.tPose||{isTPose:false,detected:"unknown"},characterLoaded:Boolean(a.loaded),rigReady:Boolean(a.loaded&&this.rigReady&&Object.keys(mapped).length),mappedBoneCount:Object.keys(mapped).length,mood:this.mood,recentIdle:[...this.recentIdle],visible:this.visible,animationEnabled:this.animationEnabled,animationPaused:this.animationPaused,behavior:{...this.behavior,autonomous:this.autonomous?.getStatus?.()},requiredRig:requiredRigSlots(),optionalRig:optionalRigSlots(),skeletonCount:Number(a.skeletonCount)||0,duplicateBoneGroups:a.duplicateBoneGroups||[]}}
 semantic(intent,options={}){
  const key=String(intent||"").toLowerCase().replace(/[^a-z]/g,"");
  const map={greet:"wave",wave:"wave",agree:"nod",nod:"nod",deny:"shake",think:"think",thinking:"think",talk:"talkGesture",speak:"talkGesture",celebrate:"dance",dance:"dance",jump:"jump",clap:"clap",lookcloser:"lookCloser",closer:"lookCloser",lookleft:"lookLeft",eyesleft:"lookLeft",lookright:"lookRight",eyesright:"lookRight",sit:"sitKnee",sitknee:"sitKnee",stand:"standUp",standup:"standUp",stretch:"stretch",yawn:"yawn",sleep:"sleep",wake:"wake",wakeup:"wake",crackback:"crackBack",crackfingers:"crackFingers",walk:"walk",turn:"turnBody",turnbody:"turnBody",adhan:"adhanOpening"};
  if(key==="idle"){this.stopAll();return{intent:key,motion:"idle",played:true}}
  const motion=map[key]||"idle";return{intent:key,motion,played:motion==="idle"?false:this.play(motion,options)};
 }
}
window.saeedCharacterRuntime=window.saeedCharacterRuntime||{};
function installCharacterController(){
 const engine=window.saeedCharacterRuntime?.engine;
 if(!engine||typeof engine.getCharacterPoseStatus!=="function")return false;
 if(window.saeedCharacterRuntime?.controller?.engine===engine){
  const ready=engine.getCharacterPoseStatus?.();
  if(ready?.loaded&&(!window.saeedCharacterRuntime?.controller.characterId||!Object.keys(engine.getBoneMap?.()||{}).length))window.saeedCharacterRuntime?.controller.onCharacterLoaded?.();
  return true;
 }
 const controller=new CharacterController(engine);
 window.saeedCharacterRuntime.controller=controller;
 controller.api={
  setAnimationEnabled:v=>controller.setAnimationEnabled(v),setAnimationPaused:v=>controller.setAnimationPaused(v),beginAuthoring:()=>controller.beginAuthoring(),endAuthoring:()=>controller.endAuthoring(),play:(id,o)=>controller.play(id,o),stop:id=>controller.stop(id),stopAll:()=>controller.stopAll(),
  setPose:p=>controller.setPose(p),setLogicalJointRotation:(s,r)=>controller.setLogicalJointRotation(s,r),setIdlePose:p=>controller.setIdlePose(p),resetPose:()=>controller.resetPose(),resetBoneToRest:n=>controller.resetBoneToRest(n),
  remap:m=>controller.remap(m),autoMap:()=>controller.autoMap(),saveRestPose:()=>controller.saveRestPose(),normalizeRestPose:()=>controller.normalizeRestPose(),setLimit:(s,l)=>controller.setLimit(s,l),setMotionEnabled:(id,v)=>controller.setMotionEnabled(id,v),
  semantic:(i,o)=>controller.semantic(i,o),defineMotion:d=>controller.defineMotion(d),deleteMotion:id=>controller.deleteMotion(id),
  listMotions:()=>controller.listMotions(),getRig:()=>({bones:engine.getAvailableBoneNames?.()||[],mapping:engine.getBoneMap?.()||{},status:controller.status()}),status:()=>{const ready=engine.getCharacterPoseStatus?.();const mapped=engine.getBoneMap?.()||{};if(ready?.loaded&&!Object.keys(mapped).length)controller.onCharacterLoaded?.();return controller.status()},register:def=>controller.animation.register(def),
  setMood:v=>controller.setMood(v),setBehavior:(v={})=>{controller.behavior={...controller.behavior,...v};controller.autonomous?.configure?.(controller.behavior);if(v.idle===false)controller.clearIdleTimer();else controller.startIdleScheduler(controller.behavior.frequencyMs);return {...controller.behavior}},setBoneRotation:(n,r)=>controller.setBoneRotation(n,r),bindSlot:(s,n)=>controller.bindSlot(s,n),calibrateJoint:(s,r)=>controller.calibrateJoint(s,r),getMood:()=>controller.getMood(),moodPalette:()=>controller.moodPalette(),
  setVisible:v=>controller.setVisible(v),handleEvent:e=>controller.handleEvent(e),touch:()=>controller.touch()
 };
 controller.setVisible(!document.hidden);
 const ready=engine.getCharacterPoseStatus?.();
 if(ready?.loaded)controller.onCharacterLoaded?.();
 return true;
}
installCharacterController();
window.addEventListener("saeed-character-engine-ready",installCharacterController);
window.addEventListener("DOMContentLoaded",()=>installCharacterController());
window.addEventListener("saeed-character-loaded",()=>window.saeedCharacterRuntime?.controller?.onCharacterLoaded?.());
document.addEventListener("visibilitychange",()=>window.saeedCharacterRuntime?.controller?.setVisible(!document.hidden));
window.addEventListener("beforeunload",()=>{try{window.saeedCharacterRuntime?.controller?.destroy?.()}catch{}});
