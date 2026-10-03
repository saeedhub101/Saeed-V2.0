import { AnimationController } from "./AnimationController.js";
import { CharacterRetargeter } from "./CharacterRetargeter.js";
import { registerCoreMotions } from "./motions.js";

export class CharacterController {
  constructor(avatar) {
    this.avatar=avatar; this.animation=new AnimationController(avatar); this.retargeter=new CharacterRetargeter();
    this.last=performance.now(); this.started=false; registerCoreMotions(this.animation);
  }
  bindCurrentCharacter() {
    const bones=this.avatar?.getBoneMap?.() || this.avatar?.getBones?.() || {};
    this.retargeter.bind(bones);
    return this.animation.bindRig(bones,this.retargeter);
  }
  play(id,options={}) {
    if(!this.animation.rig.has("head") && !this.animation.rig.has("spine")) this.bindCurrentCharacter();
    return this.animation.play(id,options);
  }
  stop(id) { return this.animation.stop(id); }
  stopAll() { return this.animation.stopAll(); }
  setPose(pose={}) { return this.animation.setPose(pose); }
  setIdlePose(pose={}) { return this.animation.setIdlePose(pose); }
  remap(mapping={}) { const ok=this.avatar?.setCharacterRigMap?.(mapping); if(ok)this.bindCurrentCharacter(); return Boolean(ok); }
  resetPose() { this.avatar?.resetCharacterPose?.(); this.animation.pose.clear(); this.avatar?.wakeRender?.(250); return true; }
  update(dt) { this.animation.update(dt); }
  status() { return this.animation.status(); }
  onCharacterLoaded() { this.bindCurrentCharacter(); this.animation.stopAll(); this.play("idle",{loop:true}); }
}
window.saeedCharacterController=null;
window.addEventListener("load",()=>{ 
  if(window.saeedAvatar){
    window.saeedCharacterController=new CharacterController(window.saeedAvatar);
    window.saeedCharacterController.bindCurrentCharacter();
    window.saeedCharacterController.play("idle",{loop:true});
    window.saeedCharacterController.api={
      play:(id,o)=>window.saeedCharacterController.play(id,o),
      stop:id=>window.saeedCharacterController.stop(id),
      stopAll:()=>window.saeedCharacterController.stopAll(),
      setPose:p=>window.saeedCharacterController.setPose(p),
      setIdlePose:p=>window.saeedCharacterController.setIdlePose(p),
      resetPose:()=>window.saeedCharacterController.resetPose(),
      remap:m=>window.saeedCharacterController.remap(m),
      status:()=>window.saeedCharacterController.status(),
      register:def=>window.saeedCharacterController.animation.register(def)
    };
  }
});
