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
      jaw:b("jaw"),blink:Boolean(b("leftEye")&&b("rightEye")),face:Boolean(b("jaw")||b("leftEye")||b("rightEye")),fingers:Boolean(Object.keys(this.bones).some(k=>/thumb|index|middle|ring|pinky/i.test(k))),generic:b("generic")
    };
    return this.capabilities;
  }
  has(slot) { return Boolean(this.bones[slot]); }
  resolveSlot(slot) { const key=String(slot||""); return this.bones[key]?key:null; }
  canApply(slot) { return Boolean(this.resolveSlot(slot)); }
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
  snapshot() { return { bones:{...this.bones}, capabilities:{...this.capabilities}, unavailable:Object.keys(this.bones).filter(k=>!this.bones[k]), retargeting:this.retargeter?.status?.()||null }; }
}
