import * as THREE from "../../node_modules/three/build/three.module.js";

export class CharacterRetargeter {
  constructor() {
    this.bones = {};
    this.rest = new Map();
    this.profile = {root:"hips",sourceUp:"y",restPose:"unknown"};
    this.enabled = true;
  }
  bind(bones = {}) {
    this.bones = {...bones};
    this.rest.clear();
    for (const [slot,bone] of Object.entries(this.bones)) {
      if (!bone) continue;
      this.rest.set(slot, {
        quaternion: bone.quaternion.clone(),
        position: bone.position.clone(),
        parent: bone.parent?.name || null
      });
    }
    this.profile.restPose = this.detectRestPose();
    return this.status();
  }
  detectRestPose() {
    const l=this.bones.leftUpperArm, r=this.bones.rightUpperArm, h=this.bones.hips;
    if (!l || !r || !h) return "unknown";
    const a=Math.abs(l.rotation.z), b=Math.abs(r.rotation.z);
    if (a < .18 && b < .18) return "t-like";
    if (a > .35 || b > .35) return "a-like";
    return "custom";
  }
  apply(slot, delta={}) {
    const bone=this.bones[slot], rest=this.rest.get(slot);
    if (!bone || !rest) return false;
    const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(
      Number(delta.x)||0, Number(delta.y)||0, Number(delta.z)||0, "XYZ"
    ));
    bone.quaternion.copy(rest.quaternion).multiply(q);
    return true;
  }
  reset(slot) {
    const bone=this.bones[slot], rest=this.rest.get(slot);
    if (bone && rest) bone.quaternion.copy(rest.quaternion);
  }
  resetAll() { for (const slot of this.rest.keys()) this.reset(slot); }
  status() {
    return {
      enabled:this.enabled,
      restPose:this.profile.restPose,
      boneCount:this.rest.size,
      root:this.profile.root,
      bones:Object.fromEntries(Object.entries(this.bones).map(([k,v])=>[k,v?.name||""]))
    };
  }
  snapshotRest() {
    const out={};
    for (const [slot,r] of this.rest) out[slot]={
      x:r.quaternion.x,y:r.quaternion.y,z:r.quaternion.z,w:r.quaternion.w
    };
    return out;
  }
}
