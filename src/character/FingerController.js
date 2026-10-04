const clean=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
const fingers=["Thumb","Index","Middle","Ring","Pinky"];
const knownFingerNames=new Set(["LeftHandMiddle2","RightHandMiddle2","LeftHandMiddle3","RightHandMiddle3","LeftHandIndex1","RightHandIndex1","LeftHandIndex2","RightHandIndex2","LeftHandIndex3","RightHandIndex3","LeftHandRing1","RightHandRing1","LeftHandRing2","RightHandRing2","LeftHandRing3","RightHandRing3","LeftHandPinky1","RightHandPinky1","LeftHandPinky2","RightHandPinky2","LeftHandPinky3","RightHandPinky3","LeftHandThumb1","RightHandThumb1","LeftHandThumb2","RightHandThumb2","LeftHandThumb3","RightHandThumb3"]);
export class FingerController{
 constructor(avatar){this.avatar=avatar;this.map={};}
 bind(names=[]){
  this.map={};for(const name of names){const n=clean(name);for(const f of fingers){const side=n.includes("left")?"left":n.includes("right")?"right":n.endsWith("l")?"left":n.endsWith("r")?"right":null;if(!side||!n.includes(f.toLowerCase()))continue;const m=n.match(new RegExp(f.toLowerCase()+"(?:[0-9]+)?$"));if(!m&&!knownFingerNames.has(name))continue;const index=(n.match(/[0-9]+$/)||["1"])[0];this.map[side+f+index]=name;}}
  return this.map;
 }
 pose(hand,amount=.35){const side=String(hand).toLowerCase();const out={};for(const [k,name] of Object.entries(this.map)){if(k.startsWith(side))out[name]={x:Number(amount)||0,y:0,z:0}}return this.avatar?.applyRawBonePose?.(out)||false;}
 curl(hand,amount=.45){return this.pose(hand,amount);}
 status(){return {count:Object.keys(this.map).length,bones:{...this.map}};}
}
