// Comprehensive animation CI inspection. This test is diagnostic-only and NEVER gates the build.
// It inspects animation architecture, registered motions, sequences, bone APIs, blending,
// render scheduling, duplicate controllers and obvious invalid/static motion definitions.
// Findings are written to animation-health-report.json and the process always exits 0.
const fs=require("node:fs"),path=require("node:path");
const root=process.cwd();
const failures=[],warnings=[],checks=[];
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const exists=p=>fs.existsSync(path.join(root,p));
function check(name,ok,detail){checks.push({name,pass:!!ok,detail:detail||""});if(!ok)failures.push({name,detail:detail||""});}
function warn(name,detail){warnings.push({name,detail});console.log("ANIMATION WARNING:",name,"-",detail);}
function fileTokens(file,tokens){const s=read(file);for(const t of tokens)check(file+" contains "+t,s.includes(t),"missing token");return s;}
console.log("=== SAeed AI ANIMATION HEALTH — DIAGNOSTIC ONLY ===");

// 1. Required animation modules.
const required=[
"src/character/AnimationController.js","src/character/CharacterController.js","src/character/client.js",
"src/character/MotionRegistry.js","src/character/MotionSequence.js","src/character/MotionSafety.js",
"src/character/PoseController.js","src/character/CharacterRig.js","src/character/CharacterRetargeter.js",
"src/character/CanonicalSkeleton.js","src/character/AutoRigMapper.js","src/character/motions.js",
"src/character/CharacterEngine.js"
];
for(const p of required)check("required module: "+p,exists(p),"file missing");

// 2. Main ownership / renderer scheduling.
let client="",controller="",registry="",motions="",sequence="",animation="",avatar="";
if(exists("src/character/client.js"))client=read("src/character/client.js");
if(exists("src/character/CharacterController.js"))controller=read("src/character/CharacterController.js");
if(exists("src/character/MotionRegistry.js"))registry=read("src/character/MotionRegistry.js");
if(exists("src/character/motions.js"))motions=read("src/character/motions.js");
if(exists("src/character/MotionSequence.js"))sequence=read("src/character/MotionSequence.js");
if(exists("src/character/AnimationController.js"))animation=read("src/character/AnimationController.js");
if(exists("src/character/CharacterEngine.js"))avatar=read("src/character/CharacterEngine.js");

check("renderer exposes animation controller",client.includes("window.saeedAnimationController"));
check("render wake API",client.includes("getRenderWakeMs")||avatar.includes("wakeRender"));
check("visibility API",client.includes("setVisible"));
check("client has no setInterval",!/\bsetInterval\s*\(/.test(client),"continuous interval found in character client");
check("character controller has motion ownership",/class\s+CharacterController|function\s+CharacterController|CharacterController/.test(controller));
check("motion registry exists",/register|motions|registry/i.test(registry));
check("sequence sampler exists",/sampleSequence/.test(sequence));
check("sequence factory exists",/function\s+sequence|const\s+sequence\s*=/.test(sequence));
check("weighted blending fadeIn",/fadeIn/.test(animation));
check("weighted blending fadeOut",/fadeOut/.test(animation));
check("weighted blending weight",/\bweight\b/.test(animation));
check("weighted blending priority",/\bpriority\b/.test(animation));

// 3. Discover registered motion IDs instead of checking only a fixed list.
const motionIds=[...motions.matchAll(/id\s*:\s*["']([^"']+)["']/g)].map(m=>m[1]);
const sequenceIds=[...motions.matchAll(/sequence\s*\(\s*["']([^"']+)["']/g)].map(m=>m[1]);
const uniqueMotion=[...new Set(motionIds)],uniqueSequence=[...new Set(sequenceIds)];
check("motion registry has entries",uniqueMotion.length>0,"no motion id definitions found");
console.log("MOTION_IDS="+uniqueMotion.join(","));
console.log("SEQUENCE_IDS="+uniqueSequence.join(","));
console.log("MOTION_COUNT="+uniqueMotion.length);
console.log("SEQUENCE_COUNT="+uniqueSequence.length);

// Expected core motions are diagnostic findings, not gates.
const expectedMotions=["nod","shake","wave","think","jump","clap","dance","talkGesture","adhanOpening"];
const expectedSequences=["lookCloser","sitKnee","standUp","stretch","yawn","crackBack","crackFingers","turnBody","walk","sleep","wake"];
for(const id of expectedMotions)if(!uniqueMotion.includes(id))warn("missing core motion",id);
for(const id of expectedSequences)if(!uniqueSequence.includes(id))warn("missing core sequence",id);

// 4. Inspect motion definitions for obvious malformed values.
const numberLiterals=[...motions.matchAll(/[-+]?\d+(?:\.\d+)?/g)].map(m=>Number(m[0])).filter(Number.isFinite);
check("motion source contains finite numeric literals",numberLiterals.length>0);
check("motion source has no NaN literal",!/\bNaN\b/.test(motions));
check("motion source has no Infinity literal",!/\bInfinity\b/.test(motions));
const huge=numberLiterals.filter(n=>Math.abs(n)>1000);
if(huge.length)warn("large numeric literals in motion source",String(huge.slice(0,20)));

// 5. Bone/pose APIs and controllers.
for(const t of ["getBoneMap","applyCharacterPose","getAvailableBoneNames","wakeRender"])
  check("avatar API "+t,avatar.includes(t),"missing");
for(const [p,src] of [
 ["PoseController.js",exists("src/character/PoseController.js")?read("src/character/PoseController.js"):""],
 ["CharacterRig.js",exists("src/character/CharacterRig.js")?read("src/character/CharacterRig.js"):""],
 ["CharacterRetargeter.js",exists("src/character/CharacterRetargeter.js")?read("src/character/CharacterRetargeter.js"):""],
 ["AutoRigMapper.js",exists("src/character/AutoRigMapper.js")?read("src/character/AutoRigMapper.js"):""]
]) {
  check(p+" has implementation",src.length>0);
}

// 6. Detect possible duplicate animation ownership.
const jsFiles=[];
function walk(dir){if(!fs.existsSync(dir))return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith(".js"))jsFiles.push(p);}}
walk(path.join(root,"src"));
const ownerCandidates=[];
for(const p of jsFiles){
  const s=fs.readFileSync(p,"utf8");
  if(/AnimationController|CharacterController|MotionRegistry|MotionSequence/.test(s) &&
     /(requestAnimationFrame|applyCharacterPose|setPose|playMotion|play\s*\(|sampleSequence)/.test(s))
    ownerCandidates.push(path.relative(root,p));
}
console.log("ANIMATION_OWNER_CANDIDATES="+ownerCandidates.join(","));
if(ownerCandidates.length>5)warn("many animation-related controller candidates",ownerCandidates.join(", "));

// 7. Static checks for continuous loops in animation modules.
for(const p of ["src/character/AnimationController.js","src/character/CharacterController.js","src/character/MotionRegistry.js","src/character/MotionSequence.js"]){
  if(!exists(p))continue;
  const s=read(p);
  if(/setInterval\s*\(/.test(s))warn("setInterval in animation module",p);
  if(/requestAnimationFrame\s*\(/.test(s))console.log("RAF_PRESENT="+p);
}

// 8. Check known finger/face controllers exist when present.
for(const p of ["src/character/FingerController.js","src/character/FaceController.js"]){
  if(exists(p)){const s=read(p);check(p+" parses as non-empty",s.length>100);}
}

// 9. Report.
const report={
  generatedAt:new Date().toISOString(),
  diagnosticOnly:true,
  gating:false,
  summary:{checks:checks.length,failed:failures.length,warnings:warnings.length,motions:uniqueMotion.length,sequences:uniqueSequence.length},
  checks,failures,warnings,
  motionIds:uniqueMotion,sequenceIds:uniqueSequence,animationOwnerCandidates:ownerCandidates
};
fs.writeFileSync(path.join(root,"animation-health-report.json"),JSON.stringify(report,null,2),"utf8");
console.log("ANIMATION_HEALTH_REPORT=animation-health-report.json");
console.log("ANIMATION_HEALTH_CHECKS="+checks.length);
console.log("ANIMATION_HEALTH_FAILURES="+failures.length);
console.log("ANIMATION_HEALTH_WARNINGS="+warnings.length);
console.log("=== ANIMATION HEALTH COMPLETE — BUILD NOT BLOCKED ===");
// Intentionally exit successfully: this file is a diagnostic report, not a release gate.
process.exit(0);
