const clean=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
const aliases={
 hips:["hips","pelvis","pelvisbone","root","rootbone","mixamorig:hips"],
 spine:["spine","spine1","spine2","spine03","torso","mixamorigspine"],
 chest:["chest","upperchest","spine2","spine03","mixamorigspine2"],
 neck:["neck","mixamorigneck"],head:["head","headbone","mixamorighead"],jaw:["jaw","jawbone"],
 leftShoulder:["LeftShoulder","Shoulder.L","ShoulderL","leftshoulder","shoulderl"],rightShoulder:["RightShoulder","Shoulder.R","ShoulderR","rightshoulder","shoulderr"],
 leftUpperArm:["LeftUpperArm","LeftArm","LeftShoulder","UpperArm.L","UpperArmL","upperarml","leftupperarm","leftarm","leftshoulder","mixamorigleftarm"],
 rightUpperArm:["RightUpperArm","RightArm","RightShoulder","UpperArm.R","UpperArmR","upperarmr","rightupperarm","rightarm","rightshoulder","mixamorigrightarm"],
 leftForeArm:["LeftForeArm","LeftLowerArm","LeftElbow","LowerArm.L","LowerArmL","lowerarml","leftforearm","leftlowerarm","leftelbow","mixamorigleftforearm"],
 rightForeArm:["RightForeArm","RightLowerArm","RightElbow","LowerArm.R","LowerArmR","lowerarmr","rightforearm","rightlowerarm","rightelbow","mixamorigrightforearm"],
 leftHand:["lefthand","Wrist.L","wristl","mixamoriglefthand"],rightHand:["righthand","Wrist.R","wristr","mixamorigrighthand"],
 leftThigh:["LeftThigh","LeftUpLeg","LeftUpperLeg","UpperLeg.L","UpperLegL","upperlegl","leftthigh","leftupleg","leftupperleg","mixamorigleftupleg"],
 rightThigh:["RightThigh","RightUpLeg","RightUpperLeg","UpperLeg.R","UpperLegR","upperlegr","rightthigh","rightupleg","rightupperleg","mixamorigrightupleg"],
 leftShin:["leftshin","leftcalf","leftlowerleg","LowerLeg.L","LowerLegL","lowerlegl","leftleg","mixamorigleftleg"],
 rightShin:["rightshin","rightcalf","rightlowerleg","LowerLeg.R","LowerLegR","lowerlegr","rightleg","mixamorigrightleg"],
 leftFoot:["leftfoot","leftankle","Foot.L","FootL","footl","mixamorigleftfoot"],rightFoot:["rightfoot","rightankle","Foot.R","FootR","footr","mixamorigrighfoot","mixamorigrightfoot"],
 leftEye:["lefteye","eyel"],rightEye:["righteye","eyer"],
 ...Object.fromEntries(["left","right"].flatMap(side=>["Thumb","Index","Middle","Ring","Pinky"].flatMap(finger=>[1,2,3,4].map(segment=>{const prefix=side==="left"?"Left":"Right",sideSuffix=side==="left"?"L":"R";return[side+"Hand"+finger+segment,[prefix+"Hand"+finger+segment,prefix+finger+segment,finger+"."+sideSuffix+"."+segment]]}))))
};
// No single logical joint is mandatory: partial rigs must remain usable.
const REQUIRED_RIG=[];
const OPTIONAL_RIG=Object.keys(aliases);
const fingerAliases=Object.fromEntries(["Left","Right"].flatMap(side=>["Thumb","Index","Middle","Ring","Pinky"].flatMap(f=>[1,2,3,4].map(n=>[side+f+n,side+"Hand"+f+n]))));
const side=name=>{const raw=String(name||"").toLowerCase(),n=clean(name);return raw.includes(".l")||raw.endsWith("_l")||n.endsWith("l")&&!n.includes("lower")&&!n.includes("left")?"left":raw.includes(".r")||raw.endsWith("_r")||n.endsWith("r")&&!n.includes("right")?"right":n.includes("left")?"left":n.includes("right")?"right":"unknown"};
function sideOk(name,slot){const expected=slot.startsWith("left")?"left":slot.startsWith("right")?"right":"unknown";const actual=side(name);return expected==="unknown"||actual==="unknown"||actual===expected}
export function autoMapBones(bones=[]){
 const list=(bones||[]).map((b,i)=>({name:typeof b==="string"?b:b?.name||"",clean:clean(typeof b==="string"?b:b?.name),index:i})).filter(x=>x.name);
 const mapping={},scores={},used=new Set();
 for(const [slot,alts] of Object.entries(aliases)){
  let best=null;
  for(const item of list){
   if(used.has(item.name)||!sideOk(item.name,slot))continue;
   let score=0;
   for(let i=0;i<alts.length;i++){const a=clean(alts[i]);if(item.clean===a)score=Math.max(score,120-i*4);else if(item.clean.endsWith(a)||item.clean.includes(a))score=Math.max(score,80-i*4)}
   const expected=slot.startsWith("left")?"left":slot.startsWith("right")?"right":"unknown";
   if(expected!=="unknown"&&side(item.name)===expected)score+=18;
   if(slot.includes("UpperArm")&&!/(arm|shoulder)/i.test(item.name))score=0;
   if(slot.includes("ForeArm")&&!/(fore|lower|elbow)/i.test(item.name))score=0;
   if(slot.includes("Thigh")&&!/(thigh|upperleg|upleg)/i.test(item.name))score=0;
   if(slot.includes("Shin")&&!/(shin|calf|lowerleg|leg)/i.test(item.name))score=0;
   if(slot.endsWith("Hand")&&!/hand/i.test(item.name))score=0;
   if(score>0&&(!best||score>best.score))best={...item,score};
  }
  if(best&&best.score>=55){mapping[slot]=best.name;scores[slot]=best.score;used.add(best.name)}
 }
 // Never invent a logical "generic" bone. A rig is valid only when a real
 // logical slot was mapped from the actual skeleton supplied by CharacterEngine.
 return {mapping,scores,confidence:Object.fromEntries(Object.entries(scores).map(([k,v])=>[k,Math.round(Math.min(100,v/1.2))]))};
}
export function requiredRigSlots(){return [...REQUIRED_RIG]}
export function optionalRigSlots(){return [...OPTIONAL_RIG]}
export function logicalSlots(){return [...Object.keys(aliases)]}
export function getFingerAliases(){return {...fingerAliases}}
