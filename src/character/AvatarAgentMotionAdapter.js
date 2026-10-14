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
