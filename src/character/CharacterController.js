import { AnimationController } from "./AnimationController.js";
import { registerCoreMotions } from "./motions.js";

export class CharacterController {
  constructor(avatar) {
    this.avatar=avatar; this.animation=new AnimationController(avatar); this.last=performance.now();
    this.started=false; registerCoreMotions(this.animation);
  }
  bindCurrentCharacter() {
    const bones=this.avatar?.getBoneMap?.() || this.avatar?.getBones?.() || {};
    return this.animation.bindRig(bones);
  }
  play(id,options={}) { if(!this.animation.rig.has("head") && !this.animation.rig.has("spine")) this.bindCurrentCharacter(); return this.animation.play(id,options); }
  stop(id) { return this.animation.stop(id); }
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
      status:()=>window.saeedCharacterController.status(),
      register:def=>window.saeedCharacterController.animation.register(def)
    };
  }
});