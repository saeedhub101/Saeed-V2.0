import { AnimationController } from "./AnimationController.js";
import { CharacterRetargeter } from "./CharacterRetargeter.js";
import { registerCoreMotions } from "./motions.js";
import { autoMapBones,requiredRigSlots,optionalRigSlots } from "./AutoRigMapper.js";
import { FaceController } from "./FaceController.js";
import { FingerController } from "./FingerController.js";
import { MotionEditor } from "./MotionEditor.js";
import { CharacterProfileStore } from "./CharacterProfileStore.js";

export class CharacterController{
 constructor(avatar){
  this.avatar=avatar;this.animation=new AnimationController(avatar);this.retargeter=new CharacterRetargeter();this.face=new FaceController(avatar);this.fingers=new FingerController(avatar);this.editor=new MotionEditor(this.animation.registry);this.profiles=new CharacterProfileStore();this.characterId=null;this.mood="cheerful";this.visible=true;this.behavior={idle:true,events:true,random:true,blinking:true,expressions:true,speechFace:true,walking:true,dancing:true,greeting:true};this.idleTimer=null;this.frame=null;this.recentIdle=[];this.idleBusy=false;this.lastInteraction=performance.now();
  registerCoreMotions(this.animation);
  this.idlePool=[{id:"nod",weight:5},{id:"think",weight:4},{id:"stretch",weight:3},{id:"lookCloser",weight:2},{id:"yawn",weight:1},{id:"crackBack",weight:2},{id:"crackFingers",weight:2},{id:"wave",weight:2}];
 }
 bindCurrentCharacter(){
  const bones=this.avatar?.getBoneMap?.()||this.avatar?.getBones?.()||{};
  const names=this.avatar?.getAvailableBoneNames?.()||[];
  if(!names.length){
   const fallback=Object.values(bones).map(b=>b?.name).filter(Boolean);
   if(fallback.length)names.push(...fallback);
  }
  if(!names.length)return{rig:this.animation.rig.snapshot(),autoMapping:{mapping:{},scores:{},confidence:{}},profileId:null};
  const auto=autoMapBones(names),profileId=this.profiles.idFor(names,this.avatar?.getCharacterProfileKey?.()||"saeed"),profile=this.profiles.load(profileId);
  const available=new Set(names.map(n=>String(n).toLowerCase()));
  const mapping={...auto.mapping};
  for(const [slot,name] of Object.entries(profile?.mapping||{}))if(name&&available.has(String(name).toLowerCase()))mapping[slot]=name;
  if(Object.keys(mapping).length)this.avatar?.bindRig?.(mapping);
  const mapped=this.avatar?.getBoneMap?.()||bones;this.retargeter.bind(mapped);this.fingers.bind(names);this.animation.bindRig(mapped,this.retargeter);this.characterId=profileId;
  const validation=this.avatar?.getRigValidation?.()||{ok:true,missing:[],criticalMissing:[]},rest=this.avatar?.getRestPoseNormalization?.()||{normalized:true};
  if(validation.criticalMissing?.length||rest.normalized===false){
   const parts=[];if(validation.criticalMissing?.length)parts.push("Required rig missing: "+validation.criticalMissing.join(", "));if(rest.normalized===false)parts.push("Rest pose: "+String(rest.detected||"not normalized"));
   window.saeed?.reportDiagnostic?.("ERROR","RIG VALIDATION",parts.join(" • ")||"Rig validation failed",{missing:validation.missing||[],criticalMissing:validation.criticalMissing||[],rest});
  }
  if(profile){if(profile.idlePose)this.animation.setIdlePose(profile.idlePose);if(Array.isArray(profile.customMotions))for(const motion of profile.customMotions){try{this.editor.define(motion)}catch{}}}
  else this.profiles.save(this.characterId,{mapping:auto.mapping,autoConfidence:auto.confidence,restPose:this.retargeter.status(),idlePose:this.animation.idlePose});
  return{rig:this.animation.rig.snapshot(),autoMapping:auto,profileId:this.characterId};
 }
 play(id,options={}){
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
 finishMotion(){this.idleBusy=false;this.startIdleScheduler()}
 setPose(pose={}){const out=this.animation.setPose(pose);this.startFrameLoop();return out}
 setIdlePose(pose={}){const out=this.animation.setIdlePose(pose);if(this.characterId)this.profiles.save(this.characterId,{idlePose:out});return out}
 remap(mapping={}){const ok=this.avatar?.bindRig?.(mapping);if(!ok)return false;const names=this.avatar?.getAvailableBoneNames?.()||[];const mapped=this.avatar?.getBoneMap?.()||{};this.retargeter.bind(mapped);this.fingers.bind(names);this.animation.bindRig(mapped,this.retargeter);this.characterId=this.profiles.idFor(names,this.avatar?.getCharacterProfileKey?.()||"saeed");if(this.characterId)this.profiles.save(this.characterId,{mapping,autoConfidence:{},restPose:this.retargeter.status(),idlePose:this.animation.idlePose,customMotions:this.editor.list()});return true}
 autoMap(){const names=this.avatar?.getAvailableBoneNames?.()||[],auto=autoMapBones(names);if(!Object.keys(auto.mapping).length)return{ok:false,error:"No compatible bones were found",mapping:{},confidence:auto.confidence};const ok=this.avatar?.bindRig?.(auto.mapping);if(ok){const mapped=this.avatar?.getBoneMap?.()||{};this.retargeter.bind(mapped);this.fingers.bind(names);this.animation.bindRig(mapped,this.retargeter);this.characterId=this.profiles.idFor(names,this.avatar?.getCharacterProfileKey?.()||"saeed");if(this.characterId)this.profiles.save(this.characterId,{mapping:auto.mapping,autoConfidence:auto.confidence,restPose:this.retargeter.status(),idlePose:this.animation.idlePose})}return{ok:Boolean(ok),mapping:auto.mapping,confidence:auto.confidence}}
 resetPose(){this.avatar?.resetCharacterPose?.();this.animation.pose.clear();this.avatar?.wakeRender?.(250);return true}
 setLimit(slot,limit){return this.animation.setLimit(slot,limit)}
 defineMotion(def){const out=this.editor.define(def);if(this.characterId)this.profiles.save(this.characterId,{customMotions:this.editor.list()});return out}
 deleteMotion(id){const ok=this.editor.remove(id);if(ok&&this.characterId)this.profiles.save(this.characterId,{customMotions:this.editor.list()});return ok}
 listMotions(){return this.editor.list()}
 setMood(value){const valid=["cheerful","curious","thoughtful","mischievous","pleased","sleepy","puzzled","sad"],v=String(value||"cheerful").toLowerCase();this.mood=valid.includes(v)?v:"cheerful";return this.mood}
 getMood(){return this.mood}
 moodPalette(){const pools={sleepy:["yawn","stretch","nod"],thoughtful:["think","nod","lookCloser"],curious:["lookCloser","think","nod"],mischievous:["wave","crackFingers","lookCloser"],pleased:["nod","wave","stretch"],puzzled:["think","shake","lookCloser"],sad:["yawn","nod"],cheerful:["nod","wave","stretch","lookCloser"]};return pools[this.mood]||pools.cheerful}
 setVisible(value){
  const next=value!==false&&String(value)!=="hidden";this.visible=next;
  if(!next){this.clearIdleTimer();this.stopAll();return true}
  this.startIdleScheduler(1800);return true;
 }
 touch(){this.lastInteraction=performance.now();this.clearIdleTimer();if(this.visible)this.startIdleScheduler(4500);return true}
 handleEvent(event){
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
 runIdle(){if(!this.behavior.idle||!this.visible||this.idleBusy||this.animation.active.length)return;const id=this.chooseIdle();if(!id)return;this.recentIdle=[...this.recentIdle.filter(x=>x!==id),id].slice(-4);this.idleBusy=true;this.play(id,{priority:10})}
 clearIdleTimer(){if(this.idleTimer){clearTimeout(this.idleTimer);this.idleTimer=null}}
 startIdleScheduler(delay){this.clearIdleTimer();if(!this.visible)return;this.idleTimer=setTimeout(()=>{this.idleTimer=null;this.runIdle()},Math.max(1000,Number(delay)||7000))}
 startFrameLoop(){
  if(this.frame||!this.visible)return;
  const tick=()=>{
   this.frame=null;
   if(!this.visible)return;
   if(this.animation.active.length){this.animation.update(1/60);this.avatar?.wakeRender?.(120);this.frame=requestAnimationFrame(tick)}
   else if(this.idleBusy)this.finishMotion();
  };
  this.frame=requestAnimationFrame(tick);
 }
 onCharacterLoaded(){
  const poseStatus=this.avatar?.getCharacterPoseStatus?.();
  if(!poseStatus?.loaded)return {loaded:false,reason:"Character GLB is not loaded yet"};
  const x=this.bindCurrentCharacter();
  this.animation.stopAll();
  this.animation.setIdlePose(this.animation.idlePose||{});
  this.characterId=x.profileId;
  this.idleBusy=false;
  this.startIdleScheduler(7000);
  return {loaded:true,...x};
 }
 update(dt){if(this.visible&&this.animation.active.length)this.animation.update(dt)}
 status(){const a=this.avatar?.getCharacterPoseStatus?.()||{};return{...this.animation.status(),profileId:this.characterId,face:this.face.status(),fingers:this.fingers.status(),customMotions:this.editor.list(),autoRig:this.avatar?.getCharacterRigAutoMap?.(),actualBones:a.bones||{},tPose:a.tPose||{isTPose:false,detected:"unknown"},characterLoaded:Boolean(a.loaded),mood:this.mood,recentIdle:[...this.recentIdle],visible:this.visible,behavior:{...this.behavior},requiredRig:requiredRigSlots(),optionalRig:optionalRigSlots(),skeletonCount:Number(a.skeletonCount)||0,duplicateBoneGroups:a.duplicateBoneGroups||[]}}
 semantic(intent,options={}){
  const key=String(intent||"").toLowerCase().replace(/[^a-z]/g,"");
  const map={greet:"wave",wave:"wave",agree:"nod",nod:"nod",deny:"shake",think:"think",thinking:"think",talk:"talkGesture",speak:"talkGesture",celebrate:"dance",dance:"dance",jump:"jump",clap:"clap",lookcloser:"lookCloser",closer:"lookCloser",sit:"sitKnee",sitknee:"sitKnee",stand:"standUp",standup:"standUp",stretch:"stretch",yawn:"yawn",sleep:"sleep",wake:"wake",wakeup:"wake",crackback:"crackBack",crackfingers:"crackFingers",walk:"walk",turn:"turnBody",turnbody:"turnBody",adhan:"adhanOpening"};
  if(key==="idle"){this.stopAll();return{intent:key,motion:"idle",played:true}}
  const motion=map[key]||"idle";return{intent:key,motion,played:motion==="idle"?false:this.play(motion,options)};
 }
}
window.saeedCharacterController=null;
function installCharacterController(){
 const avatar=window.saeedAvatar;
 if(!avatar||typeof avatar.getCharacterPoseStatus!=="function")return false;
 if(window.saeedCharacterController?.avatar===avatar)return true;
 const controller=new CharacterController(avatar);
 window.saeedCharacterController=controller;
 controller.api={
  play:(id,o)=>controller.play(id,o),stop:id=>controller.stop(id),stopAll:()=>controller.stopAll(),
  setPose:p=>controller.setPose(p),setIdlePose:p=>controller.setIdlePose(p),resetPose:()=>controller.resetPose(),
  remap:m=>controller.remap(m),autoMap:()=>controller.autoMap(),setLimit:(s,l)=>controller.setLimit(s,l),
  semantic:(i,o)=>controller.semantic(i,o),defineMotion:d=>controller.defineMotion(d),deleteMotion:id=>controller.deleteMotion(id),
  listMotions:()=>controller.listMotions(),status:()=>controller.status(),register:def=>controller.animation.register(def),
  setMood:v=>controller.setMood(v),setBehavior:(v={})=>{controller.behavior={...controller.behavior,...v};if(v.idle===false)controller.clearIdleTimer();else controller.startIdleScheduler(1200);return {...controller.behavior}},getMood:()=>controller.getMood(),moodPalette:()=>controller.moodPalette(),
  setVisible:v=>controller.setVisible(v),handleEvent:e=>controller.handleEvent(e),touch:()=>controller.touch()
 };
 controller.setVisible(!document.hidden);
 return true;
}
installCharacterController();
window.addEventListener("saeed-avatar-ready",installCharacterController);
window.addEventListener("saeed-character-loaded",()=>window.saeedCharacterController?.onCharacterLoaded?.());
document.addEventListener("visibilitychange",()=>window.saeedCharacterController?.setVisible(!document.hidden));
