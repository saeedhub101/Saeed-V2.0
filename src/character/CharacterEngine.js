import * as THREE from "../../node_modules/three/build/three.module.js";
import {GLTFLoader} from "../three/GLTFLoader.js";
import "./CharacterController.js";
import {autoMapBones} from "./AutoRigMapper.js";
import {normalizeGlbArrayBuffer} from "./glb-bytes.js";

const canvas=document.getElementById("avatar");
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(30,1,.01,100);

const renderer=new THREE.WebGLRenderer({
 canvas,alpha:true,antialias:true,powerPreference:"high-performance"
});
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.12;
renderer.setPixelRatio(Math.min(Math.max(1,devicePixelRatio||1),1.5));

scene.add(new THREE.HemisphereLight(0xffffff,0x26313d,1.8));
const key=new THREE.DirectionalLight(0xffffff,2.8);
key.position.set(2.5,4.5,4);
scene.add(key);
const fill=new THREE.DirectionalLight(0xffffff,1.15);
fill.position.set(-3,2,2);
scene.add(fill);
const rim=new THREE.DirectionalLight(0xffffff,.9);
rim.position.set(0,3,-4);
scene.add(rim);

const root=new THREE.Group();
scene.add(root);
const loader=new GLTFLoader();
const viewSettings={
 characterScale:1,characterPositionX:0,characterPositionY:0,characterPositionZ:0,
 characterRotationY:0,canvasPadding:0
};

let model=null,rig=new Map(),base=new Map(),boneGroups=new Map(),boneRest=new Map(),morphs=new Map();
let loadGeneration=0,activeLoad=false,pendingLoad=null,renderQueued=false,animationTick=null,animationFrame=null,loadError=null,renderCount=0,lastRenderAt=0,renderFps=0,lastFrameAt=0,renderHoldUntil=0;
const glbTrace=window.saeedCharacterRuntime.glbTrace=window.saeedCharacterRuntime.glbTrace||[];
function traceGlb(stage,detail={}){const entry={at:new Date().toISOString(),stage,...detail};glbTrace.push(entry);if(glbTrace.length>200)glbTrace.splice(0,glbTrace.length-200);if(String(stage).toLowerCase().includes("error")||String(stage).toLowerCase().includes("fail")){try{window.saeed?.system?.reportDiagnostic?.("ERROR","3D ENGINE TRACE",detail?.error||stage,{domain:"3D",traceStage:stage,trace:entry})}catch{}}}
let lastRestPose={detected:"unknown",normalized:false};

function getSceneBoneGroups(target=model){
 const groups=new Map();
 const add=(b)=>{
  if(!b?.name)return;
  const key=String(b.name),list=groups.get(key)||[];
  if(!list.includes(b))list.push(b);
  groups.set(key,list);
 };
 target?.traverse(o=>{if(o?.isBone)add(o)});
 target?.traverse(o=>{if(!o?.isSkinnedMesh||!o.skeleton?.bones)return;for(const b of o.skeleton.bones)add(b)});
 return groups;
}
function getSceneBones(){
 boneGroups=getSceneBoneGroups();
 return [...boneGroups.values()].map(list=>list[0]).filter(Boolean);
}
function getBoneMap(){return Object.fromEntries(rig)}
function getAvailableBoneNames(){return getSceneBones().map(b=>b.name)}
function directHumanoidMapping(bones=[]){
 const list=bones.filter(Boolean),by=new Map(list.map(b=>[String(b.name||"").toLowerCase().replace(/[^a-z0-9]/g,""),b]));
 const pick=(keys)=>{for(const key of keys){const b=by.get(String(key).toLowerCase().replace(/[^a-z0-9]/g,""));if(b)return b}return null};
 const mapping={};
 const exact={
  hips:["hips","pelvis","root"],spine:["spine","spine1","torso"],chest:["chest","upperchest","spine2"],neck:["neck"],head:["head"],
  leftShoulder:["shoulderl","leftshoulder"],rightShoulder:["shoulderr","rightshoulder"],
  leftUpperArm:["upperarml","leftupperarm","leftarm"],rightUpperArm:["upperarmr","rightupperarm","rightarm"],
  leftForeArm:["lowerarml","leftforearm","leftlowerarm"],rightForeArm:["lowerarmr","rightforearm","rightlowerarm"],
  leftHand:["lefthand"],rightHand:["righthand"],leftThigh:["upperlegl","leftthigh","leftupperleg"],rightThigh:["upperlegr","rightthigh","rightupperleg"],
  leftShin:["lowerlegl","leftshin","leftcalf"],rightShin:["lowerlegr","rightshin","rightcalf"],
  leftFoot:["footl","leftfoot"],rightFoot:["footr","rightfoot"]
 };
 const used=new Set();
 for(const [slot,keys] of Object.entries(exact)){const b=pick(keys);if(b&&!used.has(b.name)){mapping[slot]=b.name;used.add(b.name)}}
 return mapping;
}
function autoMapRig(savedRestPose=null){
 if(!model)return{ok:false,error:"Character GLB is not loaded",mapping:{},confidence:{},mappedBoneCount:0,sceneBoneCount:0};
 const bones=getSceneBones(),names=bones.map(b=>b.name).filter(Boolean);
 if(!names.length)return{ok:false,error:"Character skeleton has no bones",mapping:{},confidence:{},mappedBoneCount:0,sceneBoneCount:0};
 const auto=autoMapBones(bones);
 let mapping=auto?.mapping||{};
 let confidence=auto?.confidence||{};
 if(!Object.keys(mapping).length){
  mapping=directHumanoidMapping(bones);
  confidence=Object.fromEntries(Object.keys(mapping).map(slot=>[slot,100]));
 }
 if(!Object.keys(mapping).length)return{ok:false,error:"No compatible logical bones were mapped",mapping:{},confidence, mappedBoneCount:0,sceneBoneCount:names.length};
 const bound=bindRig(mapping,savedRestPose);
 const mapped=getBoneMap();
 const mappedBoneCount=Object.keys(mapped).length;
 const valid=mappedBoneCount>0&&Object.values(mapped).every(b=>b&&bones.includes(b));
 traceGlb("engine-auto-map",{sceneBoneCount:names.length,mappedBoneCount,mapping:Object.fromEntries(Object.entries(mapped).map(([slot,b])=>[slot,b?.name||null])),confidence});
 return{ok:Boolean(bound&&valid),mapping:Object.fromEntries(Object.entries(mapped).map(([slot,b])=>[slot,b?.name||null])),confidence,mappedBoneCount,sceneBoneCount:names.length,error:bound&&valid?null:"Engine failed to bind mapped scene bones"};
}
function bindRig(mapping={},savedRestPose=null){
 if(!model)return false;
 const groups=getSceneBoneGroups(),by={};boneGroups=groups;
 for(const [name,list] of groups)by[String(name).toLowerCase()]=list[0];
 rig.clear();base.clear();
 for(const [slot,name] of Object.entries(mapping)){
  const b=by[String(name||"").toLowerCase()];
  if(b)rig.set(slot,b);
 }
 if(savedRestPose?.bones){
  for(const [name,r] of Object.entries(savedRestPose.bones)){
   const list=boneGroups.get(String(name))||[];
   const qx=Number(r?.qx),qy=Number(r?.qy),qz=Number(r?.qz),qw=Number(r?.qw);
   const hasQuaternion=[qx,qy,qz,qw].every(Number.isFinite);
   const x=Number(r?.x),y=Number(r?.y),z=Number(r?.z);
   if(!list.length||(!hasQuaternion&&(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z))))continue;
   for(const target of list){if(hasQuaternion)target.quaternion.set(qx,qy,qz,qw);else target.rotation.set(x,y,z);}
  }
  lastRestPose=savedRestPose.normalization||{detected:"saved",normalized:true,corrected:false,stillTPose:false};
 }else lastRestPose=normalizeHumanoidRestPose();
 // AUTHORITATIVE_REST_REBUILD_V2
 captureAuthoritativeRestPose(lastRestPose);
 for(const [slot,b] of rig){
  const list=boneGroups.get(String(b.name))||[b];
  for(const target of list)target.quaternion.copy(b.quaternion);
  base.set(slot,{x:b.rotation.x,y:b.rotation.y,z:b.rotation.z});
 }
 resetCharacterPose();
 render();
 return rig.size>0;
}
function aimBoneChild(bone,desiredWorld){
 if(!bone)return false;
 bone.updateWorldMatrix?.(true,false);
 const child=bone.children?.find(x=>x.isBone);
 if(!child)return false;
 const p=bone.getWorldPosition(new THREE.Vector3());
 const q=child.getWorldPosition(new THREE.Vector3());
 const currentWorld=q.sub(p).normalize();
 const desired=desiredWorld.clone().normalize();
 const deltaWorld=new THREE.Quaternion().setFromUnitVectors(currentWorld,desired);
 const worldQ=bone.getWorldQuaternion(new THREE.Quaternion());
 const desiredWorldQ=deltaWorld.multiply(worldQ);
 const parentQ=bone.parent?.getWorldQuaternion(new THREE.Quaternion())||new THREE.Quaternion();
 bone.quaternion.copy(parentQ.invert().multiply(desiredWorldQ));
 return true;
}
function findBoneByAliases(aliases=[]){
 const list=aliases.map(x=>String(x).toLowerCase().replace(/[^a-z0-9]/g,""));
 let found=null;
 model?.traverse(o=>{
  if(found||!o?.isBone)return;
  const n=String(o.name||"").toLowerCase().replace(/[^a-z0-9]/g,"");
  if(list.some(x=>n===x||n.includes(x)))found=o;
 });
 return found;
}
function findNamedBone(sideName,part){
 const aliases={
  left:{upper:["leftupperarm","leftarm","leftshoulder","mixamorigleftarm"],fore:["leftforearm","leftlowerarm","leftelbow","mixamorigleftforearm"]},
  right:{upper:["rightupperarm","rightarm","rightshoulder","mixamorigrightarm"],fore:["rightforearm","rightlowerarm","rightelbow","mixamorigrightforearm"]}
 };
 let found=null;
 const list=(aliases[sideName]?.[part]||[]).map(x=>String(x).toLowerCase().replace(/[^a-z0-9]/g,""));
 model?.traverse(o=>{
  if(found||!o.isBone)return;
  const n=String(o.name||"").toLowerCase().replace(/[^a-z0-9]/g,"");
  if(list.some(x=>n===x||n.includes(x)))found=o;
 });
 return found;
}
function normalizeHumanoidRestPose(){
 const hips=rig.get("hips")||findBoneByAliases(["hips","hip","pelvis","mixamorighips"]);
 const head=rig.get("head")||findBoneByAliases(["head","mixamorighead"]);
 if(!hips||!head)return{detected:"custom",normalized:true,corrected:false,stillTPose:false,reason:"No humanoid hips/head pair; preserving the GLB rest pose"};
 model.updateWorldMatrix(true,true);
 const hp=hips.getWorldPosition(new THREE.Vector3()),hd=head.getWorldPosition(new THREE.Vector3()),up=hd.clone().sub(hp),height=up.length(),vertical=Math.abs(up.y)/Math.max(height,.001);
 if(vertical<.45)return{detected:"laydown",normalized:false,corrected:false,reason:"Character is not upright; GLB rest pose preserved"};
 return{detected:"glb-rest-pose",normalized:true,corrected:false,stillTPose:false,reason:"GLB rest pose preserved; no automatic arm or hand rotation applied"};
}
function validateRig(mapping={}){
 const required=["hips","head","leftUpperArm","rightUpperArm","leftThigh","rightThigh"];
 const optional=["spine","chest","neck","leftForeArm","rightForeArm","leftHand","rightHand","leftShin","rightShin","leftFoot","rightFoot","jaw","leftEye","rightEye"];
 const mapped=Object.keys(mapping).filter(k=>rig.get(k));
 const criticalMissing=required.filter(k=>!mapping[k]&&!rig.get(k));
 const missing=optional.filter(k=>!mapping[k]&&!rig.get(k));
 const capabilities={body:Boolean(rig.get("hips")),arms:Boolean(rig.get("leftUpperArm")&&rig.get("rightUpperArm")),legs:Boolean(rig.get("leftThigh")&&rig.get("rightThigh")),neck:Boolean(rig.get("neck")),eyes:Boolean(rig.get("leftEye")&&rig.get("rightEye")),blink:Boolean(rig.get("leftEye")&&rig.get("rightEye")),face:Boolean(rig.get("jaw")),fingers:Boolean(rig.get("leftHand")&&rig.get("rightHand"))};
 return{ok:mapped.length>0,missing,criticalMissing,optionalMissing:missing,mapped:mapped.length,required,optional,capabilities};
}
function resetCharacterPose(){getSceneBones();for(const [name,list] of boneGroups){const p=boneRest.get(name);if(p)for(const target of list){if([p.rotation?.qx,p.rotation?.qy,p.rotation?.qz,p.rotation?.qw].every(Number.isFinite))target.quaternion.set(p.rotation.qx,p.rotation.qy,p.rotation.qz,p.rotation.qw);else target.rotation.set(p.rotation.x,p.rotation.y,p.rotation.z);target.position.set(p.position.x,p.position.y,p.position.z)}}render();}
function captureAuthoritativeRestPose(normalization=lastRestPose){getSceneBones();boneRest=new Map();for(const [name,list] of boneGroups){const b=list[0];if(b)boneRest.set(name,{rotation:{x:b.rotation.x,y:b.rotation.y,z:b.rotation.z,qx:b.quaternion.x,qy:b.quaternion.y,qz:b.quaternion.z,qw:b.quaternion.w},position:{x:b.position.x,y:b.position.y,z:b.position.z}})}lastRestPose={...(normalization||{}),saved:true};for(const [slot,b] of rig){const p=boneRest.get(String(b.name));if(p)base.set(slot,{x:p.rotation.x,y:p.rotation.y,z:p.rotation.z})}return snapshotBoneRotations();}
function applyCharacterPose(pose={},retargeter=null){
 for(const [slot,r] of Object.entries(pose)){
  const b=rig.get(slot);if(!b)continue;
  const applied=Boolean(retargeter?.apply?.(slot,r));
  if(!applied){
   const p=base.get(slot);if(p)b.rotation.set(p.x+(Number(r?.x)||0),p.y+(Number(r?.y)||0),p.z+(Number(r?.z)||0));
  }
  const list=boneGroups.get(String(b.name))||[b];
  for(const target of list)if(target!==b)target.quaternion.copy(b.quaternion);
 }
 for(const [boneName,transform] of Object.entries(pose))if(!rig.has(boneName))setBoneRotation(boneName,transform);
 render();
 return true;
}
function applyRawBonePose(pose={}){
 getSceneBones();let changed=false;
 for(const [name,r] of Object.entries(pose)){
  const list=boneGroups.get(String(name))||[];
  if(!list.length)continue;
  for(const b of list){
   b.rotation.x+=Number(r?.x)||0;b.rotation.y+=Number(r?.y)||0;b.rotation.z+=Number(r?.z)||0;
  }
  changed=true;
 }
 if(changed)render();
 return changed;
}
function collectMorphs(){
 morphs=new Map();
 model?.traverse(o=>{
  if(!o.isMesh||!o.morphTargetDictionary||!o.morphTargetInfluences)return;
  for(const [name,i] of Object.entries(o.morphTargetDictionary)){
   const k=String(name).toLowerCase();
   if(!morphs.has(k))morphs.set(k,[]);
   morphs.get(k).push([o,i]);
  }
 });
}
function setMorph(name,value=0){
 const list=morphs.get(String(name||"").toLowerCase());
 if(!list)return false;
 const v=Math.max(0,Math.min(1,Number(value)||0));
 for(const [m,i] of list)m.morphTargetInfluences[i]=v;
 render();
 return true;
}
function blink(){
 for(const n of ["blink","eyeclose"])if(setMorph(n,1)){
  setTimeout(()=>setMorph(n,0),140);
  return true;
 }
 return false;
}
function lookAt(x=0,y=1.5,z=1){
 const h=rig.get("head");
 if(!h)return false;
 const p=h.getWorldPosition(new THREE.Vector3());
 const d=new THREE.Vector3(Number(x)||0,Number(y)||0,Number(z)||0).sub(p).normalize();
 const b=base.get("head");
 if(b)h.rotation.set(b.x-Math.asin(Math.max(-1,Math.min(1,d.y)))*.45,b.y+Math.atan2(d.x,d.z)*.45,b.z);
 render();
 return true;
}
function dispose(o){
 o?.traverse?.(x=>{
  x.geometry?.dispose?.();
  const ms=Array.isArray(x.material)?x.material:[x.material];
  for(const m of ms){
   if(!m)continue;
   for(const k of ["map","normalMap","roughnessMap","metalnessMap","emissiveMap","aoMap","alphaMap"])m[k]?.dispose?.();
   m.dispose?.();
  }
 });
}
function fit(){
 if(!model)return false;
 model.updateWorldMatrix(true,true);
 const raw=new THREE.Box3().setFromObject(model,true);
 const rawSize=raw.getSize(new THREE.Vector3());
 if(!Number.isFinite(rawSize.x)||!Number.isFinite(rawSize.y)||!Number.isFinite(rawSize.z)||rawSize.lengthSq()<1e-10){traceGlb("fit-invalid-bounds",{size:{x:rawSize.x,y:rawSize.y,z:rawSize.z}});return false;}
 const scale=3.75/Math.max(rawSize.y,.001)*Math.max(.001,Number(viewSettings.characterScale)||1);
 model.scale.setScalar(scale);
 model.position.set(Number(viewSettings.characterPositionX)||0,Number(viewSettings.characterPositionY)||0,Number(viewSettings.characterPositionZ)||0);
 model.rotation.y=Number(viewSettings.characterRotationY)||0;
 model.updateWorldMatrix(true,true);

 const box=new THREE.Box3().setFromObject(model,true);
 const size=box.getSize(new THREE.Vector3());
 const center=box.getCenter(new THREE.Vector3());
 const aspect=Math.max(.1,(canvas.clientWidth||430)/(canvas.clientHeight||520));
 const vf=THREE.MathUtils.degToRad(camera.fov*.5);
 const hf=2*Math.atan(Math.tan(vf)*aspect);
 const verticalDistance=size.y*.5/Math.tan(vf);
 const horizontalDistance=size.x*.5/Math.tan(hf*.5);
 const dist=Math.max(verticalDistance,horizontalDistance);
 if(!Number.isFinite(dist)||dist<=0){traceGlb("fit-invalid-camera",{dist});return false;}
 camera.position.set(center.x,center.y,center.z+Math.max(.01,dist));
 camera.near=Math.max(.001,Math.min(.1,size.length()/1000));
 camera.far=Math.max(50,size.length()*20);
 camera.lookAt(center);
 camera.updateProjectionMatrix();
 return true;
}
function render(){
 if(renderQueued)return;
 renderQueued=true;
 animationFrame=requestAnimationFrame((now)=>{
  animationFrame=null;
  renderQueued=false;
  if(lastFrameAt){const dt=Number(now)-Number(lastFrameAt);if(dt>0)renderFps=1000/dt}
  lastFrameAt=Number(now)||lastFrameAt;
  let keepAnimating=Date.now()<renderHoldUntil;
  if(animationTick){try{keepAnimating=animationTick(now)||keepAnimating}catch(error){animationTick=null;window.saeed.system.reportDiagnostic?.("ERROR","CHARACTER ANIMATION TICK",error?.message||String(error))}}
  try{renderer.render(scene,camera);renderCount++;lastRenderAt=Date.now()}catch(error){loadError=String(error?.stack||error?.message||error);traceGlb("render-error",{error:loadError});window.saeed3DBootstrap&&(window.saeed3DBootstrap.error=loadError);window.saeed.system.reportDiagnostic?.("ERROR","3D RENDER",loadError)}
  if(keepAnimating)render();
 });
}
function renderImmediate(){
 if(renderQueued&&animationFrame){cancelAnimationFrame(animationFrame);animationFrame=null;renderQueued=false}
 try{renderer.render(scene,camera);renderCount++;lastRenderAt=Date.now();return true}catch(error){loadError=String(error?.stack||error?.message||error);traceGlb("render-immediate-error",{error:loadError});window.saeed3DBootstrap&&(window.saeed3DBootstrap.error=loadError);window.saeed.system.reportDiagnostic?.("ERROR","3D RENDER",loadError);return false}
}
function setAnimationTick(callback){animationTick=typeof callback==="function"?callback:null;if(animationTick)renderHoldUntil=Date.now()+8000;return true}
function wakeRender(ms=8000){renderHoldUntil=Math.max(renderHoldUntil,Date.now()+Math.max(1000,Number(ms)||8000));renderImmediate();render();return true}

function resize(){
 const r=canvas.getBoundingClientRect();
 const w=Math.max(1,Math.round(r.width||canvas.clientWidth||430)),h=Math.max(1,Math.round(r.height||canvas.clientHeight||520));
 renderer.setSize(w,h,false);
 camera.aspect=w/h;
 camera.updateProjectionMatrix();
 const fitted=fit();
 traceGlb("resize",{width:w,height:h,fitted,hidden:document.hidden});
 renderImmediate();render();
}
new ResizeObserver(resize).observe(canvas);
window.addEventListener("visibilitychange",()=>{traceGlb("visibility-change",{hidden:document.hidden});if(!document.hidden){resize();window.saeedCharacterRuntime?.engine?.wakeRender?.()}});
window.addEventListener("pageshow",()=>{resize();window.saeedCharacterRuntime?.engine?.wakeRender?.()});

function display(parsed){
 traceGlb("display-start",{hasScene:Boolean(parsed?.scene),sceneName:parsed?.scene?.name||"",generation:loadGeneration});
 if(!parsed?.scene)throw new Error("Selected GLB contains no scene");
 const previous=model;
 const previousRig=rig,previousBase=base,previousGroups=boneGroups,previousRest=boneRest,previousMorphs=morphs;
 const next=parsed.scene;
 const nextGroups=getSceneBoneGroupsForModel(next);
 const nextRest=new Map();
 for(const [name,list] of nextGroups){
  const b=list[0];
  if(!b)continue;
  nextRest.set(name,{rotation:{x:b.rotation.x,y:b.rotation.y,z:b.rotation.z,qx:b.quaternion.x,qy:b.quaternion.y,qz:b.quaternion.z,qw:b.quaternion.w},position:{x:b.position.x,y:b.position.y,z:b.position.z}});
 }
 try{
  root.add(next);
  model=next;
  rig=new Map();base=new Map();boneGroups=nextGroups;boneRest=nextRest;morphs=new Map();
  collectMorphs();
  const normalization=normalizeHumanoidRestPose();
  traceGlb("rest-pose-normalized-before-render",{generation:loadGeneration,...normalization});
  fit();
  render();
 }catch(error){
  traceGlb("display-error",{error:error?.stack||error?.message||String(error)});
  try{root.remove(next)}catch{}
  model=previous;rig=previousRig;base=previousBase;boneGroups=previousGroups;boneRest=previousRest;morphs=previousMorphs;
  throw error;
 }
 if(previous){
  try{root.remove(previous)}catch{}
  dispose(previous);
 }
 traceGlb("display-success",{generation:loadGeneration,boneCount:boneGroups.size,meshCount:countSceneMeshes(next),skinnedMeshCount:countSceneSkinnedMeshes(next)});
 ensureControllerBinding();
}
function countSceneMeshes(target){let n=0;target?.traverse?.(o=>{if(o?.isMesh||o?.isSkinnedMesh)n++});return n;}
function countSceneSkinnedMeshes(target){let n=0;target?.traverse?.(o=>{if(o?.isSkinnedMesh)n++});return n;}
function ensureControllerBinding(attempt=0){
 const controller=window.saeedCharacterRuntime?.controller;
 if(!model||!controller){if(attempt<40)setTimeout(()=>ensureControllerBinding(attempt+1),125);return false;}
 const names=getSceneBones().map(b=>b.name).filter(Boolean);
 if(!names.length){if(attempt<40)setTimeout(()=>ensureControllerBinding(attempt+1),125);return false;}
 try{
  const status=controller.status?.();
  if(status?.characterLoaded&&Object.keys(status?.autoRig||{}).length){
   window.dispatchEvent(new CustomEvent("saeed-character-loaded",{detail:{generation:loadGeneration,boneCount:names.length,mapped:Object.keys(status.autoRig||{}).length}}));
   return true;
  }
  const result=controller.onCharacterLoaded?.();
  const mapped=Object.keys(result?.mapping||result?.rig?.bones||{}).length;
  traceGlb("controller-bind",{attempt,boneCount:names.length,mapped,loaded:Boolean(result?.loaded),reason:result?.reason||null});
  if(result?.loaded){
   window.dispatchEvent(new CustomEvent("saeed-character-loaded",{detail:{generation:loadGeneration,boneCount:names.length,mapped}}));
   return true;
  }
 }catch(error){traceGlb("controller-bind-error",{attempt,error:error?.stack||error?.message||String(error)});}
 if(attempt<40)setTimeout(()=>ensureControllerBinding(attempt+1),125);
 return false;
}
function getSceneBoneGroupsForModel(target){
 const groups=new Map();
 const add=b=>{if(!b?.name)return;const key=String(b.name),list=groups.get(key)||[];if(!list.includes(b))list.push(b);groups.set(key,list)};
 target?.traverse(o=>{if(o?.isBone)add(o)});
 target?.traverse(o=>{if(!o?.isSkinnedMesh||!o.skeleton?.bones)return;for(const b of o.skeleton.bones)add(b)});
 return groups;
}

async function load(data,generation){
 const previousLoadError=loadError;
 activeLoad=true;loadError=null;
 traceGlb("load-start",{generation,dataType:data?.constructor?.name||typeof data,byteLength:data?.byteLength??data?.length??null});
 try{
  const bytes=normalizeGlbArrayBuffer(data);
  traceGlb("bytes-ready",{generation,byteLength:bytes.byteLength});
  traceGlb("parse-start",{generation,byteLength:bytes.byteLength});
  const parsed=await loader.parseAsync(bytes,"");
  traceGlb("parse-success",{generation,hasScene:Boolean(parsed?.scene),sceneName:parsed?.scene?.name||""});
  if(!parsed?.scene)throw new Error("GLB parsed without a renderable scene");
  const candidateBoneCount=getSceneBoneGroups(parsed.scene).size;
  const candidateMeshCount=countSceneMeshes(parsed.scene);
  if(candidateBoneCount<1)throw new Error("GLB candidate has no actual THREE.Bone skeleton; current character preserved");
  if(candidateMeshCount<1)throw new Error("GLB candidate has no renderable mesh in its active scene; current character preserved");
  if(generation===loadGeneration){traceGlb("generation-accepted",{generation,boneCount:candidateBoneCount,meshCount:candidateMeshCount});display(parsed);return{ok:true,generation,boneCount:candidateBoneCount,meshCount:candidateMeshCount}}
  traceGlb("generation-rejected",{generation,currentGeneration:loadGeneration});
  return{ok:false,stale:true,generation,error:"GLB load was superseded by a newer character generation"};
 }catch(error){
  traceGlb("load-error",{generation,error:error?.stack||error?.message||String(error)});
  const errorText=String(error?.stack||error?.message||error);
  if(!model){loadError=errorText;window.saeed3DBootstrap&&(window.saeed3DBootstrap.error=loadError,window.saeed3DBootstrap.rejection=loadError)}else{loadError=previousLoadError;traceGlb("candidate-rejected-preserved-current",{generation,error:errorText,currentModelPreserved:true})}
  window.saeed.system.reportDiagnostic?.("ERROR","GLB LOAD",errorText);
  throw error;
 }finally{
  activeLoad=false;
  if(pendingLoad){
   const p=pendingLoad;
   pendingLoad=null;
   void load(p.data,p.generation).then(value=>p.resolve?.(value),error=>p.reject?.(error));
  }
 }
}
window.saeedCharacterRuntime.load=async(data,generation)=>{
 const g=Number(generation)||++loadGeneration;
 loadGeneration=Math.max(loadGeneration,g);
 if(activeLoad){return new Promise((resolve,reject)=>{if(pendingLoad?.resolve)pendingLoad.resolve({ok:false,superseded:true,generation:pendingLoad.generation,error:"GLB load superseded by a newer request"});pendingLoad={data,generation:g,resolve,reject}})}
 return load(data,g);
};
if(window.saeedCharacterRuntime.pendingLoad){
 const p=window.saeedCharacterRuntime.pendingLoad;
 window.saeedCharacterRuntime.pendingLoad=null;
 void window.saeedCharacterRuntime.load(p.data,p.generation).then(result=>p.resolve?.(result),error=>p.reject?.(error));
}

function apply3DSettings(settings={}){
 const character=settings.character||settings;
 Object.assign(viewSettings,{
  characterScale:Number.isFinite(Number(character.scale??character.characterScale))?Number(character.scale??character.characterScale):viewSettings.characterScale,
  characterPositionX:Number.isFinite(Number(character.positionX??character.characterPositionX))?Number(character.positionX??character.characterPositionX):viewSettings.characterPositionX,
  characterPositionY:Number.isFinite(Number(character.positionY??character.characterPositionY))?Number(character.positionY??character.characterPositionY):viewSettings.characterPositionY,
  characterPositionZ:Number.isFinite(Number(character.positionZ??character.characterPositionZ))?Number(character.positionZ??character.characterPositionZ):viewSettings.characterPositionZ,
  characterRotationY:Number.isFinite(Number(character.rotationY??character.characterRotationY))?Number(character.rotationY??character.characterRotationY):viewSettings.characterRotationY,
  canvasPadding:0
 });
 if(Number.isFinite(Number(settings.camera?.fov)))camera.fov=Number(settings.camera.fov);
 fit();
 render();
 return {...viewSettings};
}
window.saeedCharacterRuntime.engineApply3DSettings=apply3DSettings;
window.saeedCharacterRuntime.engineGet3DSettings=()=>({...viewSettings});
window.saeedCharacterRuntime.engineSetRuntimeActive=()=>true;
window.saeed.character.onCharacter3DSettings?.(apply3DSettings);

function setEditorRotation(x=0,y=0,z=0){
 if(!model)return false;
 model.rotation.set(Number(x)||0,Number(y)||0,Number(z)||0);
 render();
 return true;
}
function getEditorRotation(){
 if(!model)return{x:0,y:0,z:0};
 return{x:model.rotation.x,y:model.rotation.y,z:model.rotation.z};
}
function getCharacterPoseStatus(){
 getSceneBones();
 const required=[];
 const bones={};
 for(const [name,list] of boneGroups){const b=list[0];if(!b)continue;bones[name]={name,parent:b.parent?.name||"",rotation:{x:b.rotation.x,y:b.rotation.y,z:b.rotation.z},position:{x:b.position.x,y:b.position.y,z:b.position.z},restPose:boneRest.get(name)||null};}
 const hips=rig.get("hips"),head=rig.get("head"),left=rig.get("leftUpperArm")||findNamedBone("left","upper"),right=rig.get("rightUpperArm")||findNamedBone("right","upper");
 let isTPose=false,detected="unknown";
 if(hips&&head){const hp=hips.getWorldPosition(new THREE.Vector3()),hd=head.getWorldPosition(new THREE.Vector3()),up=hd.clone().sub(hp),height=up.length(),vertical=Math.abs(up.y)/Math.max(height,.001);if(vertical>=.45){const direction=b=>{const child=b?.children?.find(x=>x.isBone);if(!child)return null;const p=b.getWorldPosition(new THREE.Vector3()),q=child.getWorldPosition(new THREE.Vector3());return q.sub(p).normalize()};const ld=direction(left),rd=direction(right);isTPose=Boolean(ld&&rd&&Math.abs(ld.y)<.5&&Math.abs(rd.y)<.5&&Math.abs(ld.x)>Math.abs(ld.z)*.65&&Math.abs(rd.x)>Math.abs(rd.z)*.65);detected=isTPose?"t-pose":"not-t-pose";}else detected="not-upright";}
 const rigValidation=validateRig(Object.fromEntries([...rig].map(([k,b])=>[k,b.name])));return {loaded:Boolean(model),requiredRig:rigValidation,capabilities:{...rigValidation.capabilities,blink:Boolean(morphs.has("blink")||morphs.has("eyeclose")||rigValidation.capabilities.blink),visemes:morphs.size>0,expressions:morphs.size>0},controllable:Boolean(rig.size),controllableBoneCount:rig.size,boneCount:rig.size,bones,skeletonCount:boneGroups.size,duplicateBoneGroups:[...boneGroups.entries()].filter(([,list])=>list.length>1).map(([name,list])=>({name,count:list.length})),tPose:{isTPose,detected},restPose:{...lastRestPose}};
}
function getBoneRotation(name){getSceneBones();const b=(boneGroups.get(String(name||""))||[])[0];return b?{x:b.rotation.x,y:b.rotation.y,z:b.rotation.z}:null}
function restLocalQuaternion(object){const rest=object?.isBone?boneRest.get(String(object.name||"")):null;if(rest&&[rest.rotation?.qx,rest.rotation?.qy,rest.rotation?.qz,rest.rotation?.qw].every(Number.isFinite))return new THREE.Quaternion(rest.rotation.qx,rest.rotation.qy,rest.rotation.qz,rest.rotation.qw);return object?.quaternion?.clone?.()||new THREE.Quaternion()}
function getRestWorldQuaternion(bone){const chain=[];for(let node=bone;node;node=node.parent)chain.unshift(node);const world=new THREE.Quaternion();for(const node of chain)world.multiply(restLocalQuaternion(node));return world}
function getBoneEditorRotation(name){getSceneBones();const key=String(name||""),b=(boneGroups.get(key)||[])[0];if(!b||!boneRest.has(key))return null;const baseWorld=getRestWorldQuaternion(b),currentWorld=b.getWorldQuaternion(new THREE.Quaternion()),delta=currentWorld.multiply(baseWorld.invert()),e=new THREE.Euler().setFromQuaternion(delta,"XYZ");return{x:e.x,y:e.y,z:e.z}}
function setBoneRotation(name,rotation={}){getSceneBones();const list=boneGroups.get(String(name||""))||[];if(!list.length)return false;const s=rotation?.rotation&&typeof rotation.rotation==="object"?rotation.rotation:rotation,x=Number(s.x),y=Number(s.y),z=Number(s.z);if(![x,y,z].every(Number.isFinite))return false;for(const b of list)b.rotation.set(x,y,z);render();return true}
function setBoneEditorRotation(name,rotation={}){
 getSceneBones();
 const key=String(name||"");
 const list=boneGroups.get(key)||[];
 if(!list.length||!boneRest.has(key))return false;
 const source=rotation?.rotation&&typeof rotation.rotation==="object"?rotation.rotation:rotation;
 const x=Number(source.x),y=Number(source.y),z=Number(source.z);
 if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z))return false;
 const deltaQ=new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z,"XYZ"));
 const parentQ=new THREE.Quaternion();
 const inverseParentQ=new THREE.Quaternion();
 for(const b of list){
  parentQ.identity();
  b.parent?.getWorldQuaternion?.(parentQ);
  inverseParentQ.copy(parentQ).invert();
  // Compose against the immutable Rest Pose world orientation. This keeps the
  // editor's axes stable even after an ancestor bone has been edited.
  const worldBase=getRestWorldQuaternion(b);
  const worldDelta=deltaQ.clone().multiply(worldBase);
  b.quaternion.copy(inverseParentQ.multiply(worldDelta));
 }
 render();
 return true;
}
function getRestBoneRotation(name){
 const key=String(name||"");
 const rest=boneRest.get(key);
 if(!rest)return null;
 return{x:rest.rotation.x,y:rest.rotation.y,z:rest.rotation.z};
}
function resetBoneToRest(name){
 getSceneBones();
 const key=String(name||"");
 const list=boneGroups.get(key)||[];
 const rest=boneRest.get(key);
 if(!list.length||!rest)return false;
 for(const b of list){
  if([rest.rotation?.qx,rest.rotation?.qy,rest.rotation?.qz,rest.rotation?.qw].every(Number.isFinite))b.quaternion.set(rest.rotation.qx,rest.rotation.qy,rest.rotation.qz,rest.rotation.qw);else b.rotation.set(rest.rotation.x,rest.rotation.y,rest.rotation.z);
  b.position.set(rest.position.x,rest.position.y,rest.position.z);
 }
 render();
 return true;
}
function setBoneTransform(name,transform={}){getSceneBones();const list=boneGroups.get(String(name||""))||[];if(!list.length)return false;const rest=boneRest.get(String(name||""));if(!rest)return false;const rr=transform?.rotation||transform||{},pp=transform?.position||{};const rx=Number(rr.x),ry=Number(rr.y),rz=Number(rr.z),px=Number(pp.x),py=Number(pp.y),pz=Number(pp.z);if(!Number.isFinite(rx)||!Number.isFinite(ry)||!Number.isFinite(rz))return false;for(const b of list){b.rotation.set(rest.rotation.x+rx,rest.rotation.y+ry,rest.rotation.z+rz);if(Number.isFinite(px))b.position.x=rest.position.x+px;if(Number.isFinite(py))b.position.y=rest.position.y+py;if(Number.isFinite(pz))b.position.z=rest.position.z+pz}render();return true}
function setRestRelativeBoneRotation(name,delta={}){getSceneBones();const list=boneGroups.get(String(name||""))||[];const rest=boneRest.get(String(name||""));if(!list.length||!rest)return false;const x=rest.rotation.x+(Number(delta.x)||0),y=rest.rotation.y+(Number(delta.y)||0),z=rest.rotation.z+(Number(delta.z)||0);for(const b of list)b.rotation.set(x,y,z);render();return true}
function createVirtualControlBone(name,parentName,position={x:0,y:0,z:0}){const parent=boneGroups.get(String(parentName||""))?.[0];if(!parent||!name||boneGroups.has(String(name)))return false;const b=new THREE.Bone();b.name=String(name);b.position.set(Number(position.x)||0,Number(position.y)||0,Number(position.z)||0);parent.add(b);boneGroups.set(b.name,[b]);captureAuthoritativeRestPose(lastRestPose);render();return true}
function applyRestPoseSnapshot(snapshot={},normalization=null){
 getSceneBones();
 for(const [name,r] of Object.entries(snapshot||{})){
  const list=boneGroups.get(String(name))||[];
  const qx=Number(r?.qx),qy=Number(r?.qy),qz=Number(r?.qz),qw=Number(r?.qw);
  const hasQuaternion=[qx,qy,qz,qw].every(Number.isFinite);
  const x=Number(r?.x),y=Number(r?.y),z=Number(r?.z);
  if(!list.length||(!hasQuaternion&&(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z))))continue;
  for(const b of list){if(hasQuaternion)b.quaternion.set(qx,qy,qz,qw);else b.rotation.set(x,y,z);}
 }
 for(const [slot,b] of rig){
  const list=boneGroups.get(String(b.name))||[b];
  for(const target of list)base.set(slot,{x:b.rotation.x,y:b.rotation.y,z:b.rotation.z}),target.quaternion.copy(b.quaternion);
 }
 if(normalization)lastRestPose={...normalization};
 captureAuthoritativeRestPose(lastRestPose);
 resetCharacterPose();
 render();
 return true;
}
function snapshotLogicalPose(){
 getSceneBones();
 const out={};
 for(const [slot,b] of rig){
  const baseRotation=base.get(slot)||{x:0,y:0,z:0};
  out[slot]={
   x:b.rotation.x-baseRotation.x,
   y:b.rotation.y-baseRotation.y,
   z:b.rotation.z-baseRotation.z
  };
 }
 return out;
}
function snapshotBoneRotations(){
 getSceneBones();
 const out={};
 for(const b of getSceneBones())out[b.name]={x:b.rotation.x,y:b.rotation.y,z:b.rotation.z,qx:b.quaternion.x,qy:b.quaternion.y,qz:b.quaternion.z,qw:b.quaternion.w};
 return out;
}
function destroyEngine(){loadGeneration++;activeLoad=false;if(pendingLoad?.resolve)pendingLoad.resolve({ok:false,generation:pendingLoad.generation,error:"Character engine destroyed before GLB load completed"});if(pendingLoad?.reject)pendingLoad.reject(new Error("Character engine destroyed before GLB load completed"));pendingLoad=null;animationTick=null;if(animationFrame){cancelAnimationFrame(animationFrame);animationFrame=null;}model=null;rig.clear();base.clear();boneGroups.clear();boneRest.clear();morphs.clear();try{root.clear()}catch{}try{renderer.dispose()}catch{}renderQueued=false;return true}
window.saeedCharacterRuntime=window.saeedCharacterRuntime||{};
window.saeedCharacterRuntime.engine={
 get3DStatus:()=>{
  const pose=getCharacterPoseStatus();
  const names=getAvailableBoneNames();
  const map=getBoneMap();
  const glbState=loadError?"error":(model?"ready":"waiting");
  const sceneState=renderer&&scene?"ready":"error";
  const renderState=lastRenderAt?"rendered":"waiting";
  return{
   timestamp:new Date().toISOString(),
   overall:{state:loadError?"error":(model&&names.length?"ready":"starting"),detail:loadError?String(loadError):(model?"GLB loaded; renderer active; skeleton "+names.length+" bones":"Waiting for authoritative GLB")},
   components:{
    moduleBootstrap:{state:window.saeed3DBootstrap?.error?"error":"ready",detail:window.saeed3DBootstrap?.error||"CharacterEngine module loaded"},
    threeJs:{state:THREE?"ready":"error",detail:THREE?"Three.js available":"Three.js unavailable"},
    gltfLoader:{state:GLTFLoader?"ready":"error",detail:GLTFLoader?"GLTFLoader available":"GLTFLoader unavailable"},
    webgl:{state:renderer?"ready":"error",detail:renderer?"WebGL renderer created":"WebGL renderer unavailable"},
    renderer:{state:sceneState,detail:renderer?"WebGL renderer active":"Renderer unavailable"},
    scene:{state:sceneState,detail:scene?"THREE.Scene active":"Scene unavailable"},
    camera:{state:camera?"ready":"error",detail:camera?"Camera active":"Camera unavailable"},
    lights:{state:scene?"ready":"waiting",detail:scene?"Lighting initialized":"Scene unavailable"},
    canvas:{state:canvas?"ready":"error",detail:canvas?(canvas.clientWidth+"×"+canvas.clientHeight):"Canvas unavailable"},
    renderLoop:{state:renderState,detail:lastRenderAt?("Last render "+lastRenderAt):"No completed render recorded",frames:renderCount,fps:renderFps,lastRenderAt},
    sceneContent:{state:model?"rendered":(loadError?"error":"waiting"),detail:model?("Character scene loaded; "+(pose.skeletonCount||names.length)+" skeleton bones"):(loadError?String(loadError):"Waiting for GLB")},
    selectedGlb:{state:glbState,detail:loadError||"Authoritative Saeed GLB",name:"Saeed_AI-3D.glb"},
    skeleton:{state:names.length?"ready":(model?"error":"waiting"),detail:names.length?(names.length+" actual THREE.Bone objects exposed"):"No actual skeleton bone names exposed",boneCount:names.length,bones:names},
    characterController:{state:window.saeedCharacterRuntime?.controller?"ready":"waiting",detail:window.saeedCharacterRuntime?.controller?"CharacterController connected":"CharacterController unavailable"},
    rigMapping:{state:Object.keys(map).length?"ready":(names.length?"warn":"waiting"),detail:(Object.keys(map).length+" logical slots mapped from "+names.length+" skeleton bones"),mappedSlots:Object.keys(map).length},
    restPose:{state:pose.restPose?.normalized===false?"warn":(pose.loaded?"ready":"waiting"),detail:String(pose.restPose?.detected||"unknown")},
    tPose:{state:pose.tPose?.isTPose===true?"warn":(pose.tPose?.detected?"ready":"waiting"),detail:String(pose.tPose?.detected||"unknown")},
    motion:{state:pose.loaded&&Object.keys(map).length?"ready":"waiting",detail:pose.loaded&&Object.keys(map).length?"Character motion path available":"Motion requires loaded character + mapped rig"}
   },
   character:{loaded:Boolean(pose.loaded),boneCount:names.length,skeletonCount:pose.skeletonCount||names.length,rigMapped:Object.keys(map).length,restPose:pose.restPose,tPose:pose.tPose},
   metrics:{drawCalls:renderer?.info?.render?.calls??0,triangles:renderer?.info?.render?.triangles??0,geometries:renderer?.info?.memory?.geometries??0,textures:renderer?.info?.memory?.textures??0,renderCount, lastRenderAt, fps:renderFps,canvasWidth:canvas?.width??0,canvasHeight:canvas?.height??0,clientWidth:canvas?.clientWidth??0,clientHeight:canvas?.clientHeight??0,hidden:document.hidden},
   version:THREE?.REV||"",
   lastError:loadError||null
  };
 },
 getBoneMap,getBones:getBoneMap,getAvailableBoneNames,autoMapRig,getScene:()=>scene,getCharacterModel:()=>model,getSceneBoneGroups:()=>getSceneBoneGroups(),bindRig,applyCharacterPose,resetCharacterPose,
 getBoneRotation,getBoneEditorRotation,setBoneRotation,setBoneEditorRotation,getRestBoneRotation,resetBoneToRest,setBoneTransform,snapshotBoneRotations,applyRestPoseSnapshot,normalizeHumanoidRestPose,captureAuthoritativeRestPose,createVirtualControlBone,setRestRelativeBoneRotation,
 getCharacterProfileKey:()=>String(window.saeedCharacterRuntime.characterName||"Saeed").trim(),
 getCharacterRigAutoMap:()=>Object.fromEntries([...rig].map(([k,b])=>[k,b.name])),getCharacterPoseStatus,wakeRender,
 getRigValidation:()=>validateRig(Object.fromEntries([...rig].map(([k,b])=>[k,b.name]))),setEditorRotation,getEditorRotation,
 getRestPoseNormalization:()=>({...lastRestPose}),
 getLoadError:()=>loadError,getGlbTrace:()=>glbTrace.slice(),
 applyRawBonePose,setCharacterExpression:setMorph,blinkCharacter:blink,setCharacterViseme:setMorph,
 lookCharacterAt:lookAt,wakeRender:render,setAnimationTick,destroy:destroyEngine
};
window.dispatchEvent(new CustomEvent("saeed-character-engine-ready"));

window.saeed.character.on3DQuery?.(requestId=>{
 const status=window.saeedCharacterRuntime.engine.get3DStatus();
 const pose=getCharacterPoseStatus();
 const boneDetail=pose.loaded?`${pose.controllableBoneCount} controllable bones; rest pose ${pose.restPose?.normalized===false?"needs adjustment":"available"}`:"No character GLB is loaded";
 const report={...status,overall:{...status.overall,detail:status.overall.detail+" • "+boneDetail},components:{...status.components,characterRig:{state:pose.loaded?"ready":"waiting",detail:boneDetail},restPose:{state:pose.restPose?.normalized===false?"warn":"ready",detail:String(pose.restPose?.detected||"unknown")},tPose:{state:pose.tPose?.isTPose?"warn":"ready",detail:String(pose.tPose?.detected||"unknown")}},character:{loaded:pose.loaded,boneCount:getAvailableBoneNames().length,skeletonCount:pose.skeletonCount||getAvailableBoneNames().length,controllableBoneCount:pose.controllableBoneCount,restPose:pose.restPose,tPose:pose.tPose}};
 window.saeed.character.report3DStatus?.(requestId,report);
});
resize();




try{if(window.saeed3DBootstrap){window.saeed3DBootstrap.moduleLoaded=true;window.saeed3DBootstrap.error=null;window.saeed3DBootstrap.rejection=null;}window.saeed.character.characterRendererReady?.()}catch{}
