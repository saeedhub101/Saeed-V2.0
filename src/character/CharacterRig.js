export class CharacterRig {
  constructor() { this.bones = {}; this.capabilities = {}; this.retargeter = null; }
  bind(bones = {}, retargeter = null) {
    this.bones = { ...bones };
    this.retargeter = retargeter || null;
    const b = n => Boolean(this.bones[n]);
    this.capabilities = {
      head:b("head"), neck:b("neck"), spine:b("spine"), chest:b("chest"),
      arms:b("leftUpperArm")&&b("rightUpperArm"),
      forearms:b("leftForeArm")&&b("rightForeArm"),
      hands:b("leftHand")&&b("rightHand"),
      legs:b("leftThigh")&&b("rightThigh"),
      feet:b("leftFoot")&&b("rightFoot"),
      eyes:b("leftEye")&&b("rightEye"),
      jaw:b("jaw"),
      generic:b("generic")
    };
    return this.capabilities;
  }
  has(slot) { return Boolean(this.bones[slot]); }
  resolveSlot(slot) {
    const key=String(slot||"");
    if(this.bones[key])return key;
    if(this.bones.generic)return "generic";
    return Object.keys(this.bones)[0]||null;
  }
  remapPose(pose={}) {
    const out={};
    for(const [slot,rotation] of Object.entries(pose||{})){
      const target=this.resolveSlot(slot);
      if(!target)continue;
      const current=out[target]||{x:0,y:0,z:0};
      out[target]={x:current.x+(Number(rotation?.x)||0),y:current.y+(Number(rotation?.y)||0),z:current.z+(Number(rotation?.z)||0)};
    }
    return out;
  }
  snapshot() { return { bones:{...this.bones}, capabilities:{...this.capabilities}, retargeting:this.retargeter?.status?.()||null }; }
}
