const SIDE_PATTERNS={left:[/(^|[^a-z])left([^a-z]|$)/i,/(^|[^a-z])l([^a-z]|$)/i,/_l$/.test.bind(/x/)],right:[/(^|[^a-z])right([^a-z]|$)/i,/(^|[^a-z])r([^a-z]|$)/i,/_r$/.test.bind(/x/)]};
const clean=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
const aliases={
 hips:["hips","pelvis","pelvisbone","root","rootbone"],spine:["spine","spine1","spine2","spine03","torso"],chest:["chest","upperchest","spine2","spine03"],
 neck:["neck"],head:["head","headbone"],jaw:["jaw","jawbone"],
 leftUpperArm:["leftupperarm","leftarm","upperarm","arm"],rightUpperArm:["rightupperarm","rightarm","upperarm","arm"],
 leftForeArm:["leftforearm","leftlowerarm","forearm","lowerarm"],rightForeArm:["rightforearm","rightlowerarm","forearm","lowerarm"],
 leftHand:["lefthand","hand"],rightHand:["righthand","hand"],
 leftThigh:["leftthigh","leftupleg","leftupperleg","thigh","upperleg"],rightThigh:["rightthigh","rightupleg","rightupperleg","thigh","upperleg"],
 leftShin:["leftshin","leftcalf","leftlowerleg","leftleg","shin","calf"],rightShin:["rightshin","rightcalf","rightlowerleg","rightleg","shin","calf"],
 leftFoot:["leftfoot","foot"],rightFoot:["rightfoot","foot"],leftEye:["lefteye","eyel"],rightEye:["righteye","eyer"],
};
function sideOk(name,slot){
 const n=clean(name), left=slot.startsWith("left"), right=slot.startsWith("right");
 if(!left&&!right)return true;
 const opposite=left?/(^|[^a-z])right([^a-z]|$)|righth|_r|\.r/i:/(^|[^a-z])left([^a-z]|$)|lefth|_l|\.l/i;
 return !opposite.test(String(name||""));
}
export function autoMapBones(bones=[]){
 const list=(bones||[]).map((b,i)=>({name:typeof b==="string"?b:b?.name||"",clean:clean(typeof b==="string"?b:b?.name),index:i})).filter(x=>x.name);
 const mapping={},scores={},used=new Set();
 for(const [slot,alts] of Object.entries(aliases)){
  let best=null;
  for(const item of list){
   if(used.has(item.name)||!sideOk(item.name,slot))continue;
   const n=item.clean;
   let score=0;
   for(let i=0;i<alts.length;i++){const a=clean(alts[i]);if(n===a)score=Math.max(score,100-i*3);else if(n.includes(a))score=Math.max(score,70-i*3);else if(a.includes(n)&&n.length>3)score=Math.max(score,45-i*2)}
   if(slot.includes("UpperArm")&&!/(arm|shoulder)/i.test(item.name))score=0;
   if(slot.includes("ForeArm")&&!/(fore|lower|elbow)/i.test(item.name))score=0;
   if(slot.includes("Thigh")&&!/(thigh|upperleg|upleg)/i.test(item.name))score=0;
   if(slot.includes("Shin")&&!/(shin|calf|lowerleg)/i.test(item.name))score=0;
   if(slot.endsWith("Hand")&&!/hand/i.test(item.name))score=0;
   if(score>0&&(!best||score>best.score))best={...item,score};
  }
  if(best){mapping[slot]=best.name;scores[slot]=best.score;used.add(best.name)}
 }
 return {mapping,scores,confidence:Object.fromEntries(Object.entries(scores).map(([k,v])=>[k,Math.round(v)]))};
}
export function logicalSlots(){return Object.keys(aliases);}
