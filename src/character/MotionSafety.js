const DEFAULT_LIMITS={
 head:{x:.45,y:.7,z:.45},neck:{x:.35,y:.6,z:.35},spine:{x:.35,y:.4,z:.35},chest:{x:.3,y:.35,z:.3},
 leftUpperArm:{x:2.2,y:2.2,z:2.2},rightUpperArm:{x:2.2,y:2.2,z:2.2},leftForeArm:{x:2.5,y:2.5,z:2.5},rightForeArm:{x:2.5,y:2.5,z:2.5},
 leftHand:{x:1.2,y:1.2,z:1.2},rightHand:{x:1.2,y:1.2,z:1.2},
 leftThigh:{x:1.6,y:1.3,z:1.3},rightThigh:{x:1.6,y:1.3,z:1.3},leftShin:{x:2.4,y:1.2,z:1.2},rightShin:{x:2.4,y:1.2,z:1.2},
 leftFoot:{x:1.0,y:.8,z:.8},rightFoot:{x:1.0,y:.8,z:.8},jaw:{x:.45,y:.35,z:.35}
};
export class MotionSafety{
 constructor(limits={}){this.limits={...DEFAULT_LIMITS,...limits};}
 clamp(slot,r={},intensity=1){const l=this.limits[slot];if(!l)return{x:Number(r.x)||0,y:Number(r.y)||0,z:Number(r.z)||0};
  const k=Math.max(0,Math.min(2,Number(intensity)||1));
  return {x:Math.max(-l.x*k,Math.min(l.x*k,Number(r.x)||0)),y:Math.max(-l.y*k,Math.min(l.y*k,Number(r.y)||0)),z:Math.max(-l.z*k,Math.min(l.z*k,Number(r.z)||0))};
 }
 clampPose(pose={},intensity=1){const out={};for(const [s,r] of Object.entries(pose))out[s]=this.clamp(s,r,intensity);return out;}
 setLimit(slot,limit){if(!slot||!limit)return false;this.limits[slot]={x:Math.abs(Number(limit.x)||0),y:Math.abs(Number(limit.y)||0),z:Math.abs(Number(limit.z)||0)};return true;}
 status(){return JSON.parse(JSON.stringify(this.limits));}
}
