const clean=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
const fingers=["Thumb","Index","Middle","Ring","Pinky"];
export class FingerController{
 constructor(avatar){this.avatar=avatar;this.map={};}
 bind(names=[]){
  this.map={};for(const name of names){const n=clean(name);for(const f of fingers){const side=n.includes("left")?"left":n.includes("right")?"right":n.endsWith("l")?"left":n.endsWith("r")?"right":null;if(!side||!n.includes(f.toLowerCase()))continue;const m=n.match(new RegExp(f.toLowerCase()+"(?:[0-9]+)?$"));if(!m)continue;const index=(n.match(/[0-9]+$/)||["1"])[0];this.map[side+f+index]=name;}}
  return this.map;
 }
 pose(hand,amount=.35){const side=String(hand).toLowerCase();const out={};for(const [k,name] of Object.entries(this.map)){if(k.startsWith(side))out[name]={x:Number(amount)||0,y:0,z:0}}return this.avatar?.applyRawBonePose?.(out)||false;}
 curl(hand,amount=.45){return this.pose(hand,amount);}
 status(){return {count:Object.keys(this.map).length,bones:{...this.map}};}
}
