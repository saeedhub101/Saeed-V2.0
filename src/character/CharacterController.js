import { AnimationController } from "./AnimationController.js";
import { CharacterRetargeter } from "./CharacterRetargeter.js";
import { registerCoreMotions } from "./motions.js";
import { autoMapBones,requiredRigSlots,optionalRigSlots } from "./AutoRigMapper.js";
import { FaceController } from "./FaceController.js";
import { FingerController } from "./FingerController.js";
import { MotionEditor } from "./MotionEditor.js";
import { CharacterProfileStore } from "./CharacterProfileStore.js";
import { AutonomousBehaviorController } from "./AutonomousBehaviorController.js";

export class CharacterController{
 constructor(engine){
  this.engine=engine;this.animation=new AnimationController(engine);this.autonomous=new AutonomousBehaviorController(this);this.lastTickAt=0;this.engine?.setAnimationTick?.((now)=>{const t=Number(now)||performance.now();const dt=this.lastTickAt?Math.min(.25,Math.max(0,(t-this.lastTickAt)/1000)):.0166667;this.lastTickAt=t;this.update(dt);return Boolean(this.visible&&!this.animationPaused&&this.animationEnabled&&this.animation.active.length)});this.retargeter=new CharacterRetargeter();this.behavior={idle:true,breathing:false,blinking:true,expressions:true,speechFace:true,eyeTracking:true,autonomousMovement:true,frequencyMs:7000,eventCooldownMs:2500,sleepAfterMs:20*60*1000};this.face=new FaceController(engine);this.fingers=new FingerController(engine);this.editor=new MotionEditor(this.animation.registry);this.profiles=new CharacterProfileStore();this.characterId=null;this.mood="cheerful";this.visible=true;this.animationEnabled=this.readAnimationEnabled();this.animationPaused=false;this.idleTimer=null;this.frame=null;this.recentIdle=[];this.idleBusy=false;this.lastInteraction=performance.now();
  registerCoreMotions(this.animation);
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
 bindCurrentCharacter(){
  const bones=this.engine?.getBoneMap?.()||this.engine?.getBones?.()||{};
  const names=this.engine?.getAvailableBoneNames?.()||[];
  if(!names.length){
   const fallback=Object.values(bones).map(b=>b?.name).filter(Boolean);
   if(fallback.length)names.push(...fallback);
  }
  if(!names.length)return{rig:this.animation.rig.snapshot(),autoMapping:{mapping:{},scores:{},confidence:{}},profileId:null};
  const auto=autoMapBones(names),profileId=this.profiles.idFor(names,this.engine?.getCharacterProfileKey?.()||"saeed"),profile=this.profiles.load(profileId);
  const available=new Set(names.map(n=>String(n).toLowerCase()));
  const mapping={...auto.mapping};
  for(const [slot,name] of Object.entries(profile?.mapping||{}))if(name&&available.has(String(name).toLowerCase()))mapping[slot]=name;
  if(Object.keys(mapping).length)this.engine?.bindRig?.(mapping);
    const savedRestPose=profile?.normalizehumanoidrestpose||profile?.restPose;
    if(savedRestPose?.bones)this.engine?.applyRestPoseSnapshot?.(savedRestPose.bones,savedRestPose.normalization);
  const mapped=this.engine?.getBoneMap?.()||bones;this.retargeter.bind(mapped,profile?.calibration||{});this.fingers.bind(names);this.animation.bindRig(mapped,this.retargeter);this.characterId=profileId;
  const validation=this.engine?.getRigValidation?.()||{ok:true,missing:[],criticalMissing:[]},rest=this.engine?.getRestPoseNormalization?.()||{normalized:true};
  if(validation.criticalMissing?.length||rest.normalized===false){
   const parts=[];if(validation.criticalMissing?.length)parts.push("Required rig missing: "+validation.criticalMissing.join(", "));if(rest.normalized===false)parts.push("Rest pose: "+String(rest.detected||"not normalized"));
   window.saeed?.reportDiagnostic?.("ERROR","RIG VALIDATION",parts.join(" • ")||"Rig validation failed",{missing:validation.missing||[],criticalMissing:validation.criticalMissing||[],rest});
  }
  if(profile){if(profile.idlePose)this.animation.setIdlePose(profile.idlePose);if(Array.isArray(profile.customMotions))for(const motion of profile.customMotions){try{this.editor.define(motion)}catch{}}}
  else this.profiles.save(this.characterId,{mapping:auto.mapping,autoConfidence:auto.confidence,restPose:{normalization:this.engine?.getRestPoseNormalization?.()||null,bones:this.engine?.snapshotBoneRotations?.()||{}} ,idlePose:this.animation.idlePose});
  return{rig:this.animation.rig.snapshot(),autoMapping:auto,profileId:this.characterId};
 }
 play(id,options={}){
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
 setPose(pose={}){if(!this.animationEnabled||this.animationPaused)return false;const bones=pose?.__bones;if(bones){for(const [name,rotation] of Object.entries(bones))this.engine?.setBoneRotation?.(name,rotation);this.startFrameLoop();return bones}const out=this.animation.setPose(pose);this.startFrameLoop();return out}
 setBoneRotation(name,rotation={}){const ok=this.engine?.setBoneRotation?.(name,rotation);if(ok)this.engine?.wakeRender?.();return ok}
 calibrateJoint(slot,rotation={}){const ok=this.retargeter.setCalibration(slot,rotation);if(ok&&this.characterId)this.profiles.save(this.characterId,{calibration:this.retargeter.status().calibration});return ok}
 setIdlePose(pose={}){if(!this.animationEnabled||this.animationPaused)return false;const out=this.animation.setIdlePose(pose);if(this.characterId)this.profiles.save(this.characterId,{idlePose:out});return out}
 remap(mapping={}){const ok=this.engine?.bindRig?.(mapping);if(!ok)return false;const names=this.engine?.getAvailableBoneNames?.()||[];const mapped=this.engine?.getBoneMap?.()||{};this.retargeter.bind(mapped);this.fingers.bind(names);this.animation.bindRig(mapped,this.retargeter);this.characterId=this.profiles.idFor(names,this.engine?.getCharacterProfileKey?.()||"saeed");if(this.characterId)this.profiles.save(this.characterId,{mapping,autoConfidence:{},calibration:this.retargeter.status().calibration,restPose:this.engine?.getRestPoseNormalization?.(),idlePose:this.animation.idlePose,customMotions:this.editor.list()});return true}
 autoMap(){const names=this.engine?.getAvailableBoneNames?.()||[],auto=autoMapBones(names);if(!Object.keys(auto.mapping).length)return{ok:false,error:"No compatible bones were found",mapping:{},confidence:auto.confidence};const ok=this.engine?.bindRig?.(auto.mapping);if(ok){const mapped=this.engine?.getBoneMap?.()||{};this.retargeter.bind(mapped);this.fingers.bind(names);this.animation.bindRig(mapped,this.retargeter);this.characterId=this.profiles.idFor(names,this.engine?.getCharacterProfileKey?.()||"saeed");if(this.characterId)this.profiles.save(this.characterId,{mapping:auto.mapping,autoConfidence:auto.confidence,calibration:this.retargeter.status().calibration,restPose:this.engine?.getRestPoseNormalization?.(),idlePose:this.animation.idlePose})}return{ok:Boolean(ok),mapping:auto.mapping,confidence:auto.confidence}}
 saveRestPose(){
  if(!this.characterId)this.bindCurrentCharacter();
  const normalization=this.engine?.getRestPoseNormalization?.()||null;
  const bones=this.engine?.snapshotBoneRotations?.()||{};
    const restPose={normalization,bones};
    if(this.characterId)this.profiles.save(this.characterId,{restPose,normalizehumanoidrestpose:restPose});
  return restPose;
 }
 normalizeRestPose(){const normalization=this.engine?.normalizeHumanoidRestPose?.()||null;if(normalization?.normalized)this.engine?.captureAuthoritativeRestPose?.(normalization);return normalization;}
 resetPose(){this.engine?.resetCharacterPose?.();this.animation.pose.clear();this.engine?.wakeRender?.(250);return true}
 setLimit(slot,limit){return this.animation.setLimit(slot,limit)}
 defineMotion(def){const out=this.editor.define(def);if(this.characterId)this.profiles.save(this.characterId,{customMotions:this.editor.list()});return out}
 deleteMotion(id){const ok=this.editor.remove(id);if(ok&&this.characterId)this.profiles.save(this.characterId,{customMotions:this.editor.list()});return ok}
 listMotions(){return this.editor.list()}
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
  if(!poseStatus?.loaded)return {loaded:false,reason:"Character GLB is not loaded yet"};
  const x=this.bindCurrentCharacter();
  this.animation.stopAll();
  this.animation.setIdlePose(this.animation.idlePose||{});
  this.characterId=x.profileId;
  this.autonomous?.start?.();
  this.idleBusy=false;
  if(this.animationEnabled&&!this.animationPaused)this.startIdleScheduler(7000);
  return {loaded:true,...x};
 }
 update(dt){if(this.animationEnabled&&!this.animationPaused&&this.visible&&this.animation.active.length)this.animation.update(dt)}
 destroy(){this.clearIdleTimer();this.autonomous?.destroy?.();this.animation?.stopAll?.();this.engine?.setAnimationTick?.(null);if(this.frame){cancelAnimationFrame(this.frame);this.frame=null}this.visible=false;this.engine=null;return true}
 status(){const a=this.engine?.getCharacterPoseStatus?.()||{};return{...this.animation.status(),profileId:this.characterId,face:this.face.status(),fingers:this.fingers.status(),customMotions:this.editor.list(),autoRig:this.engine?.getCharacterRigAutoMap?.(),actualBones:a.bones||{},tPose:a.tPose||{isTPose:false,detected:"unknown"},characterLoaded:Boolean(a.loaded),mood:this.mood,recentIdle:[...this.recentIdle],visible:this.visible,animationEnabled:this.animationEnabled,animationPaused:this.animationPaused,behavior:{...this.behavior},requiredRig:requiredRigSlots(),optionalRig:optionalRigSlots(),skeletonCount:Number(a.skeletonCount)||0,duplicateBoneGroups:a.duplicateBoneGroups||[]}}
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
  if(ready?.loaded&&!window.saeedCharacterRuntime?.controller.characterId)window.saeedCharacterRuntime?.controller.onCharacterLoaded?.();
  return true;
 }
 const controller=new CharacterController(engine);
 window.saeedCharacterRuntime.controller=controller;
 controller.api={
  setAnimationEnabled:v=>controller.setAnimationEnabled(v),setAnimationPaused:v=>controller.setAnimationPaused(v),play:(id,o)=>controller.play(id,o),stop:id=>controller.stop(id),stopAll:()=>controller.stopAll(),
  setPose:p=>controller.setPose(p),setIdlePose:p=>controller.setIdlePose(p),resetPose:()=>controller.resetPose(),
  remap:m=>controller.remap(m),autoMap:()=>controller.autoMap(),saveRestPose:()=>controller.saveRestPose(),normalizeRestPose:()=>controller.normalizeRestPose(),setLimit:(s,l)=>controller.setLimit(s,l),
  semantic:(i,o)=>controller.semantic(i,o),defineMotion:d=>controller.defineMotion(d),deleteMotion:id=>controller.deleteMotion(id),
  listMotions:()=>controller.listMotions(),status:()=>controller.status(),register:def=>controller.animation.register(def),
  setMood:v=>controller.setMood(v),setBehavior:(v={})=>{controller.behavior={...controller.behavior,...v};controller.autonomous?.configure?.(controller.behavior);if(v.idle===false)controller.clearIdleTimer();else controller.startIdleScheduler(controller.behavior.frequencyMs);return {...controller.behavior}},setBoneRotation:(n,r)=>controller.setBoneRotation(n,r),calibrateJoint:(s,r)=>controller.calibrateJoint(s,r),getMood:()=>controller.getMood(),moodPalette:()=>controller.moodPalette(),
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
