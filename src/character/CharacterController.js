import { AnimationController } from "./AnimationController.js";
import { CharacterRetargeter } from "./CharacterRetargeter.js";
import { registerCoreMotions } from "./motions.js";
import { autoMapBones } from "./AutoRigMapper.js";
import { FaceController } from "./FaceController.js";
import { FingerController } from "./FingerController.js";
import { MotionEditor } from "./MotionEditor.js";
import { CharacterProfileStore } from "./CharacterProfileStore.js";
export class CharacterController{
 constructor(avatar){
  this.avatar=avatar;this.animation=new AnimationController(avatar);this.retargeter=new CharacterRetargeter();this.face=new FaceController(avatar);this.fingers=new FingerController(avatar);this.editor=new MotionEditor(this.animation.registry);this.profiles=new CharacterProfileStore();this.last=performance.now();this.characterId=null;this.mood="cheerful";registerCoreMotions(this.animation);
 }
 bindCurrentCharacter(){
  const bones=this.avatar?.getBoneMap?.()||this.avatar?.getBones?.()||{};const names=this.avatar?.getAvailableBoneNames?.()||Object.values(bones).map(b=>b?.name).filter(Boolean);
  const auto=autoMapBones(names);if(Object.keys(auto.mapping).length)this.avatar?.bindRig?.(auto.mapping);
  const mapped=this.avatar?.getBoneMap?.()||bones;this.retargeter.bind(mapped);this.fingers.bind(names);this.animation.bindRig(mapped,this.retargeter);
  this.characterId=this.profiles.idFor(names,this.avatar?.getCharacterProfileKey?.()||"saeed");
  const profile=this.profiles.load(this.characterId);if(profile){if(profile.mapping)this.avatar?.bindRig?.(profile.mapping);if(profile.idlePose)this.animation.setIdlePose(profile.idlePose);if(Array.isArray(profile.customMotions))for(const motion of profile.customMotions){try{this.editor.define(motion)}catch{}}}
  else this.profiles.save(this.characterId,{mapping:auto.mapping,autoConfidence:auto.confidence,restPose:this.retargeter.status(),idlePose:this.animation.idlePose});
  return {rig:this.animation.rig.snapshot(),autoMapping:auto,profileId:this.characterId};
 }
 play(id,options={}){if(!this.characterId)this.bindCurrentCharacter();return this.animation.play(id,options);}
 stop(id){return this.animation.stop(id);}stopAll(){return this.animation.stopAll();}
 setPose(pose={}){return this.animation.setPose(pose);}
 setIdlePose(pose={}){const out=this.animation.setIdlePose(pose);if(this.characterId)this.profiles.save(this.characterId,{idlePose:out});return out;}
 remap(mapping={}){const ok=this.avatar?.bindRig?.(mapping);if(ok){this.bindCurrentCharacter();if(this.characterId)this.profiles.save(this.characterId,{mapping});}return Boolean(ok);}
 resetPose(){this.avatar?.resetCharacterPose?.();this.animation.pose.clear();this.avatar?.wakeRender?.(250);return true;}
 setLimit(slot,limit){return this.animation.setLimit(slot,limit);}
 defineMotion(def){const out=this.editor.define(def);if(this.characterId)this.profiles.save(this.characterId,{customMotions:this.editor.list()});return out;}
 deleteMotion(id){return this.editor.remove(id);}
 listMotions(){return this.editor.list();}
 semantic(intent,options={}){const map={greet:"wave",wave:"wave",agree:"nod",nod:"nod",deny:"shake",think:"think",thinking:"think",talk:"talkGesture",speak:"talkGesture",celebrate:"dance",dance:"dance",jump:"jump",clap:"clap",lookcloser:"lookCloser",closer:"lookCloser",sit:"sitKnee",sitknee:"sitKnee",stand:"standUp",standup:"standUp",stretch:"stretch",yawn:"yawn",sleep:"sleep",wake:"wake",wakeup:"wake",crackback:"crackBack",crackfingers:"crackFingers",walk:"walk",turn:"turnBody",turnbody:"turnBody",adhan:"adhanOpening"};const key=String(intent||"").toLowerCase().replace(/[^a-z]/g,"");const motion=map[key]||"idle";return{intent:key,motion,played:this.play(motion,options)};}
 status(){return{...this.animation.status(),profileId:this.characterId,face:this.face.status(),fingers:this.fingers.status(),customMotions:this.editor.list(),autoRig:this.avatar?.getCharacterRigAutoMap?.()||null};}
 onCharacterLoaded(){const x=this.bindCurrentCharacter();this.animation.stopAll();this.animation.setIdlePose(this.animation.idlePose||{});this.characterId=x.profileId;}
 update(dt){this.animation.update(dt);}
}
window.saeedCharacterController=null;
window.addEventListener("load",()=>{if(window.saeedAvatar){window.saeedCharacterController=new CharacterController(window.saeedAvatar);window.saeedCharacterController.bindCurrentCharacter();window.saeedCharacterController.onCharacterLoaded();window.saeedCharacterController.api={play:(id,o)=>window.saeedCharacterController.play(id,o),stop:id=>window.saeedCharacterController.stop(id),stopAll:()=>window.saeedCharacterController.stopAll(),setPose:p=>window.saeedCharacterController.setPose(p),setIdlePose:p=>window.saeedCharacterController.setIdlePose(p),resetPose:()=>window.saeedCharacterController.resetPose(),remap:m=>window.saeedCharacterController.remap(m),setLimit:(s,l)=>window.saeedCharacterController.setLimit(s,l),semantic:(i,o)=>window.saeedCharacterController.semantic(i,o),defineMotion:d=>window.saeedCharacterController.defineMotion(d),deleteMotion:id=>window.saeedCharacterController.deleteMotion(id),listMotions:()=>window.saeedCharacterController.listMotions(),status:()=>window.saeedCharacterController.status(),register:def=>window.saeedCharacterController.animation.register(def)};}});
