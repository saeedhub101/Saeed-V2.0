// Converts Avatar-Agent's procedural clip JSON to Saeed's persistent logical-joint keyframes.
// Avatar-Agent stores Euler rotations in degrees; Saeed's MotionEditor consumes radians.
const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const aliases = {
  hips:["hips","hip","pelvis","root"],
  spine:["spine","spine1","lowerback"],
  chest:["chest","upperchest","spine2","torso"],
  neck:["neck"], head:["head"], jaw:["jaw","mandible"],
  leftShoulder:["leftshoulder","shoulderl","shoulder_l","lshoulder"],
  rightShoulder:["rightshoulder","shoulderr","shoulder_r","rshoulder"],
  leftUpperArm:["leftupperarm","upperarml","leftarm","mixamoringleftarm","leftarmature"],
  rightUpperArm:["rightupperarm","upperarmr","rightarm","mixamorigrightarm","rightarmature"],
  leftForeArm:["leftforearm","leftlowerarm","lowerarml","mixamoringleftforearm","leftelbow","leftlowerarmature"],
  leftLowerArm:["leftlowerarm","leftforearm","lowerarml","mixamoringleftforearm"],
  rightForeArm:["rightforearm","rightlowerarm","lowerarmr","mixamorigrightforearm","rightelbow"],
  leftHand:["lefthand","handl","mixamoringlefthand"],
  rightHand:["righthand","handr","mixamorigrighthand"],
  leftThigh:["leftthigh","leftupperleg","upperlegl","mixamoringleftupleg","leftupperleg"],
  leftUpperLeg:["leftupperleg","leftthigh","upperlegl","mixamoringleftupleg"],
  rightThigh:["rightthigh","rightupperleg","upperlegr","mixamorigrightupleg","rightupperleg"],
  rightUpperLeg:["rightupperleg","rightthigh","upperlegr","mixamorigrightupleg"],
  leftShin:["leftshin","leftcalf","leftlowerleg","lowerlegl","mixamoringleftleg","leftlowerleg"],
  leftLowerLeg:["leftlowerleg","leftshin","leftcalf","lowerlegl","mixamoringleftleg"],
  rightShin:["rightshin","rightcalf","rightlowerleg","lowerlegr","mixamorigrightleg","rightlowerleg"],
  rightLowerLeg:["rightlowerleg","rightshin","rightcalf","lowerlegr","mixamorigrightleg"],
  leftFoot:["leftfoot","footl","mixamoringleftfoot"],
  rightFoot:["rightfoot","footr","mixamorigrightfoot"],
  leftEye:["lefteye","eyel"], rightEye:["righteye","eyer"]
};
const normalize = value => String(value || "").toLowerCase().replace(/[^a-z0-9]/g,"");
const slotByBone = new Map();
for (const [slot,names] of Object.entries(aliases)) for (const name of names) slotByBone.set(normalize(name),slot);
function resolveSlot(name) {
  const n=normalize(name);
  if(slotByBone.has(n)) return slotByBone.get(n);
  // Accept common prefixes/suffixes only when they uniquely identify a known alias.
  const matches=[...slotByBone.entries()].filter(([alias])=>n.endsWith(alias)||n.startsWith(alias));
  const unique=[...new Set(matches.map(([,slot])=>slot))];
  return unique.length===1?unique[0]:null;
}
function safeId(value) {
  const id=String(value||"avatarAgentMotion").replace(/[^A-Za-z0-9._-]/g,"_").replace(/^[^A-Za-z0-9]+/,"").slice(0,64);
  return id || "avatarAgentMotion";
}
export function importAvatarAgentClip(clip) {
  if(!clip || typeof clip!=="object" || Array.isArray(clip)) throw new Error("Clip must be a JSON object.");
  const tracks=Array.isArray(clip.tracks)?clip.tracks:[];
  if(!tracks.length) throw new Error("Clip has no tracks array.");
  const warnings=[], frames=new Map();
  let accepted=0;
  for(const track of tracks) {
    const slot=resolveSlot(track?.bone);
    if(!slot) { warnings.push("ignored unsupported bone "+String(track?.bone||"(unnamed)")); continue; }
    const keys=Array.isArray(track.keys)?track.keys:[];
    for(const key of keys) {
      const time=Number(key?.t);
      if(!Number.isFinite(time)||time<0||time>600) throw new Error("Invalid key time in bone "+track.bone+".");
      const rotation=Array.isArray(key.r)?key.r:null;
      if(!rotation || rotation.length<3 || !rotation.slice(0,3).every(v=>Number.isFinite(Number(v)))) throw new Error("Invalid degree rotation in bone "+track.bone+".");
      const frame=frames.get(time)||{};
      frame[slot]={x:Number(rotation[0])*DEG,y:Number(rotation[1])*DEG,z:Number(rotation[2])*DEG};
      frames.set(time,frame); accepted++;
    }
  }
  if(!accepted) throw new Error("No supported bone rotations found. Check Avatar-Agent bone names.");
  const keyframes=[...frames.entries()].sort((a,b)=>a[0]-b[0]).map(([time,pose])=>({time,pose}));
  const lastTime=keyframes[keyframes.length-1]?.time||0;
  const duration=Math.max(0.01,Number(clip.duration)||lastTime||1);
  const motion={
    id:safeId(clip.id||clip.name||"avatarAgentMotion"),
    duration:Math.min(600,Math.max(duration,lastTime)),
    loop:Boolean(clip.loop),
    layer:["base","body","arms","legs","head","face","hands","special"].includes(clip.layer)?clip.layer:"body",
    keyframes
  };
  return {motion,warnings:[...new Set(warnings)]};
}
export function exportAvatarAgentClip(motion) {
  if(!motion||typeof motion!=="object") throw new Error("Motion must be an object.");
  const tracksBySlot=new Map();
  for(const frame of Array.isArray(motion.keyframes)?motion.keyframes:[]) {
    const time=Math.max(0,Number(frame?.time)||0);
    for(const [slot,rotation] of Object.entries(frame?.pose||{})) {
      const names=aliases[slot];
      if(!names) continue;
      const track=tracksBySlot.get(slot)||{bone:names[0],keys:[]};
      track.keys.push({t:time,r:[Number(rotation?.x||0)*RAD,Number(rotation?.y||0)*RAD,Number(rotation?.z||0)*RAD]});
      tracksBySlot.set(slot,track);
    }
  }
  if(!tracksBySlot.size) throw new Error("Selected motion has no exportable logical-joint keyframes.");
  for(const track of tracksBySlot.values()) track.keys.sort((a,b)=>a.t-b.t);
  return {name:String(motion.id||"SaeedMotion"),id:safeId(motion.id),duration:Math.max(0.01,Number(motion.duration)||1),loop:Boolean(motion.loop),tracks:[...tracksBySlot.values()]};
}


export function avatarAgentBuiltinMotionPack() {
 const C=(id,duration,loop,tracks)=>({id,name:id,duration,loop,layer:"body",tracks:Object.entries(tracks).map(([bone,keys])=>({bone,keys:keys.map(([t,x=0,y=0,z=0])=>({t,r:[x,y,z]}))}))});
 return [
  C("avatarAgent_wave",2.6,false,{
   rightUpperArm:[[0,0,0,0],[.45,0,0,-125],[2.1,0,0,-125],[2.6,0,0,0]],
   rightForeArm:[[0,0,0,0],[.45,0,0,-45],[.75,0,0,-20],[1.05,0,0,-70],[1.35,0,0,-20],[1.65,0,0,-70],[1.95,0,0,-25],[2.1,0,0,-45],[2.6,0,0,0]],
   head:[[0,0,0,0],[.5,0,6,3],[2.1,0,6,3],[2.6,0,0,0]],chest:[[0,0,0,0],[.5,0,3,2],[2.1,0,3,2],[2.6,0,0,0]]
  }),
  C("avatarAgent_bow",2.4,false,{spine:[[0,0,0,0],[.8,20,0,0],[1.5,20,0,0],[2.4,0,0,0]],chest:[[0,0,0,0],[.8,15,0,0],[1.5,15,0,0],[2.4,0,0,0]],head:[[0,0,0,0],[.8,10,0,0],[1.5,10,0,0],[2.4,0,0,0]]}),
  C("avatarAgent_nod",1.2,false,{head:[[0,0,0,0],[.2,16,0,0],[.45,2,0,0],[.7,14,0,0],[1,0,0,0],[1.2,0,0,0]]}),
  C("avatarAgent_shake",1.2,false,{head:[[0,0,0,0],[.2,0,22,0],[.5,0,-22,0],[.8,0,18,0],[1,0,-12,0],[1.2,0,0,0]]}),
  C("avatarAgent_cheer",2.2,false,{
   leftUpperArm:[[0,0,0,0],[.4,0,0,160],[.7,0,0,150],[1,0,0,165],[1.3,0,0,150],[1.6,0,0,160],[2.2,0,0,0]],
   rightUpperArm:[[0,0,0,0],[.4,0,0,-160],[.7,0,0,-150],[1,0,0,-165],[1.3,0,0,-150],[1.6,0,0,-160],[2.2,0,0,0]],
   leftForeArm:[[0,0,0,0],[.4,-10,0,0],[1.6,-10,0,0],[2.2,0,0,0]],rightForeArm:[[0,0,0,0],[.4,-10,0,0],[1.6,-10,0,0],[2.2,0,0,0]],
   chest:[[0,0,0,0],[.4,-6,0,0],[1.6,-6,0,0],[2.2,0,0,0]],head:[[0,0,0,0],[.4,-10,0,0],[1.6,-10,0,0],[2.2,0,0,0]]
  }),
  C("avatarAgent_think",3.2,false,{rightUpperArm:[[0,0,0,0],[.6,-50,0,-8],[2.6,-50,0,-8],[3.2,0,0,0]],rightForeArm:[[0,0,0,0],[.6,-105,0,0],[2.6,-105,0,0],[3.2,0,0,0]],head:[[0,0,0,0],[.6,5,12,-6],[1.6,3,18,-6],[2.6,5,12,-6],[3.2,0,0,0]]}),
  C("avatarAgent_sad",3.6,false,{head:[[0,0,0,0],[.8,18,0,0],[2.8,18,0,0],[3.6,0,0,0]],spine:[[0,0,0,0],[.8,10,0,0],[2.8,10,0,0],[3.6,0,0,0]],chest:[[0,0,0,0],[.8,8,0,0],[2.8,8,0,0],[3.6,0,0,0]]}),
  C("avatarAgent_listen",3,true,{head:[[0,0,0,0],[1.5,3,0,-5],[3,0,0,0]],spine:[[0,0,0,0],[1.5,2,0,0],[3,0,0,0]]}),
  C("avatarAgent_idleLook",3.4,false,{head:[[0,0,0,0],[.7,0,32,0],[1.4,0,32,0],[2.3,0,-28,0],[2.9,0,-28,0],[3.4,0,0,0]],spine:[[0,0,0,0],[.7,0,8,0],[1.4,0,8,0],[2.3,0,-7,0],[2.9,0,-7,0],[3.4,0,0,0]]})
 ];
}
