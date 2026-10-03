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
      jaw:b("jaw")
    };
    return this.capabilities;
  }
  has(slot) { return Boolean(this.bones[slot]); }
  snapshot() { return { bones:{...this.bones}, capabilities:{...this.capabilities}, retargeting:this.retargeter?.status?.()||null }; }
}
