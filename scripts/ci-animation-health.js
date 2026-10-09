// Comprehensive animation CI inspection. Diagnostics remain advisory, but critical runtime/authoring contracts gate npm test.
// It inspects animation architecture, registered motions, sequences, bone APIs, blending,
// render scheduling, duplicate controllers and obvious invalid/static motion definitions.
// Findings are written to animation-health-report.json; critical missing contracts fail the test.
const fs=require("node:fs"),path=require("node:path");
const root=process.cwd();
const failures=[],warnings=[],checks=[];
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const exists=p=>fs.existsSync(path.join(root,p));
function check(name,ok,detail){checks.push({name,pass:!!ok,detail:detail||""});if(!ok)failures.push({name,detail:detail||""});}
function warn(name,detail){warnings.push({name,detail});console.log("ANIMATION WARNING:",name,"-",detail);}
function fileTokens(file,tokens){const s=read(file);for(const t of tokens)check(file+" contains "+t,s.includes(t),"missing token");return s;}
console.log("=== SAEED AI CHARACTER / GLB HEALTH ===");

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
let client="",controller="",registry="",motions="",sequence="",animation="",engine="";
if(exists("src/character/client.js"))client=read("src/character/client.js");
if(exists("src/character/CharacterController.js"))controller=read("src/character/CharacterController.js");
if(exists("src/character/MotionRegistry.js"))registry=read("src/character/MotionRegistry.js");
if(exists("src/character/motions.js"))motions=read("src/character/motions.js");
if(exists("src/character/MotionSequence.js"))sequence=read("src/character/MotionSequence.js");
if(exists("src/character/AnimationController.js"))animation=read("src/character/AnimationController.js");
if(exists("src/character/CharacterEngine.js"))engine=read("src/character/CharacterEngine.js");

check("renderer exposes canonical character runtime",client.includes("window.saeedCharacterRuntime"));
check("render wake API",client.includes("getRenderWakeMs")||engine.includes("wakeRender"));
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
  check("avatar API "+t,engine.includes(t),"missing");
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

// 9. Hard acceptance contracts for the current GLB / character-authoring workflow.
// Keep broad quality warnings diagnostic, but fail when a required execution path disappears.
const gateFailures=[];
function gate(name,ok,detail){if(!ok)gateFailures.push({name,detail:detail||"required contract missing"});checks.push({name:"GATE: "+name,pass:!!ok,detail:detail||""});}
const studio=exists("src/character-studio.html")?read("src/character-studio.html"):"";
const host=exists("src/main/character/character-host.js")?read("src/main/character/character-host.js"):"";
const mapper=exists("src/character/AutoRigMapper.js")?read("src/character/AutoRigMapper.js"):"";
const rig=exists("src/character/CharacterRig.js")?read("src/character/CharacterRig.js"):"";
const editor=exists("src/character/MotionEditor.js")?read("src/character/MotionEditor.js"):"";
// Inspect the actual bundled GLB binary, not just source-code names.
let glbInspection={ok:false,error:"Authoritative GLB missing"};
try{
 const glbPath=path.join(root,"assets","Saeed_AI-3D.glb");
 if(!fs.existsSync(glbPath))throw new Error("assets/Saeed_AI-3D.glb does not exist");
 const bytes=fs.readFileSync(glbPath);
 if(bytes.length<20)throw new Error("GLB is shorter than its minimum header and JSON chunk");
 if(bytes.toString("ascii",0,4)!=="glTF")throw new Error("GLB magic header is invalid");
 const version=bytes.readUInt32LE(4),declaredLength=bytes.readUInt32LE(8);
 if(version!==2)throw new Error("Expected GLB version 2, got "+version);
 if(declaredLength!==bytes.length)throw new Error("GLB declared length "+declaredLength+" differs from actual "+bytes.length);
 const jsonLength=bytes.readUInt32LE(12),jsonType=bytes.readUInt32LE(16);
 if(jsonType!==0x4E4F534A)throw new Error("First GLB chunk is not JSON");
 if(jsonLength<2||20+jsonLength>bytes.length)throw new Error("GLB JSON chunk bounds are invalid");
 const gltf=JSON.parse(bytes.toString("utf8",20,20+jsonLength).replace(/[\u0000 ]+$/g,"").trim());
 const nodes=Array.isArray(gltf.nodes)?gltf.nodes:[];
 const skins=Array.isArray(gltf.skins)?gltf.skins:[];
 const badJoints=skins.flatMap((skin,skinIndex)=>(skin.joints||[]).filter(j=>!Number.isInteger(j)||j<0||j>=nodes.length).map(j=>({skinIndex,joint:j})));
 if(!nodes.length)throw new Error("GLB JSON contains no nodes");
 if(!skins.length)throw new Error("GLB JSON contains no skinned rig");
 if(!skins.some(s=>Array.isArray(s.joints)&&s.joints.length>0))throw new Error("GLB skins have no joints");
 if(badJoints.length)throw new Error("GLB contains invalid skin joint references: "+JSON.stringify(badJoints.slice(0,8)));
 glbInspection={ok:true,path:"assets/Saeed_AI-3D.glb",bytes:bytes.length,version,nodes:nodes.length,skins:skins.length,joints:skins.reduce((n,s)=>n+(s.joints?.length||0),0),animations:(gltf.animations||[]).length,sceneRoots:(gltf.scenes||[]).reduce((n,s)=>n+(s.nodes?.length||0),0)};
}catch(error){glbInspection={ok:false,error:String(error?.message||error)}}
checks.push({name:"authoritative GLB binary inspection",pass:glbInspection.ok,detail:glbInspection});
if(!glbInspection.ok)failures.push({name:"authoritative GLB binary inspection",detail:glbInspection.error});
gate("GLB loader is present",exists("src/three/GLTFLoader.js")&&engine.includes("GLTFLoader"));
gate("authoritative GLB has valid binary structure and skinned joints",glbInspection.ok,glbInspection.error||JSON.stringify(glbInspection));
gate("GLB load path exposes character pose status",engine.includes("getCharacterPoseStatus")&&engine.includes("getAvailableBoneNames"));
gate("rig mapper and rig binder are present",exists("src/character/AutoRigMapper.js")&&exists("src/character/CharacterRig.js")&&mapper.length>100&&rig.length>100);
gate("partial humanoid rigs remain valid",mapper.includes("const REQUIRED_RIG=[]")&&mapper.includes("const OPTIONAL_RIG=Object.keys(aliases)")&&controller.includes("Partial rig: missing")&&controller.includes("Object.keys(mapped).length>0"));
 gate("mesh-only GLB is accepted as a static character",engine.includes("candidateMeshCount<1")&&!engine.includes("candidateBoneCount<1")&&controller.includes("visible as a static mesh"));
gate("rest-pose save and reset paths exist",controller.includes("saveRestPose")&&controller.includes("resetBoneToRest")&&engine.includes("setBoneEditorRotation"));
gate("world-axis editor rotation is exposed end-to-end",studio.includes("setBoneEditorRotation")&&host.includes('"setBoneEditorRotation"')&&client.includes("setBoneEditorRotation"));
gate("animation editing and playback are connected",studio.includes("defineMotion")&&studio.includes("loadMotion")&&controller.includes("defineMotion")&&controller.includes("play(")&&editor.length>100);
gate("Studio reports real skeleton and mapping status",studio.includes("Mapped slots:")&&studio.includes("boneList")&&studio.includes("status"));
gate("add-ons and learning pages exist",exists("src/addons/window.html")&&exists("src/learning/window.html"));
gate("E2E includes world-axis and nested-axis regressions",exists("src/main/ci-e2e.js")&&read("src/main/ci-e2e.js").includes("character.studio-editor-world-axis-rotation")&&read("src/main/ci-e2e.js").includes("character.studio-nested-axis-stability"));

// 9. Report.
const report={
  generatedAt:new Date().toISOString(),
  diagnosticOnly:false,
  gating:true,
  summary:{checks:checks.length,failed:failures.length,gateFailures:gateFailures.length,warnings:warnings.length,motions:uniqueMotion.length,sequences:uniqueSequence.length},
  checks,failures,gateFailures,warnings,
  motionIds:uniqueMotion,sequenceIds:uniqueSequence,animationOwnerCandidates:ownerCandidates
};
fs.writeFileSync(path.join(root,"animation-health-report.json"),JSON.stringify(report,null,2),"utf8");
console.log("ANIMATION_HEALTH_REPORT=animation-health-report.json");
console.log("ANIMATION_HEALTH_CHECKS="+checks.length);
console.log("ANIMATION_HEALTH_FAILURES="+failures.length);
console.log("ANIMATION_HEALTH_WARNINGS="+warnings.length);
console.log("ANIMATION_HEALTH_GATE_FAILURES="+gateFailures.length);
if(gateFailures.length){for(const f of gateFailures)console.error("ANIMATION GATE FAILED:",f.name,"-",f.detail);console.error("=== ANIMATION HEALTH FAILED — REQUIRED CHARACTER CONTRACT MISSING ===");process.exit(1);}
console.log("=== ANIMATION HEALTH COMPLETE — REQUIRED CONTRACTS PASSED ===");
