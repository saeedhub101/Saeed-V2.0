import * as THREE from "../node_modules/three/build/three.module.js";
import {GLTFLoader} from "./three/GLTFLoader.js";

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

let model=null,rig=new Map(),base=new Map(),boneGroups=new Map(),morphs=new Map();
let loadGeneration=0,activeLoad=false,pendingLoad=null,renderQueued=false;
let lastRestPose={detected:"unknown",normalized:false};

function getSceneBoneGroups(){
 const groups=new Map();
 const add=(b)=>{
  if(!b?.name)return;
  const key=String(b.name),list=groups.get(key)||[];
  if(!list.includes(b))list.push(b);
  groups.set(key,list);
 };
 model?.traverse(o=>{if(o?.isBone)add(o)});
 model?.traverse(o=>{if(!o?.isSkinnedMesh||!o.skeleton?.bones)return;for(const b of o.skeleton.bones)add(b)});
 return groups;
}
function getSceneBones(){
 boneGroups=getSceneBoneGroups();
 return [...boneGroups.values()].map(list=>list[0]).filter(Boolean);
}
function getBoneMap(){return Object.fromEntries(rig)}
function getAvailableBoneNames(){return getSceneBones().map(b=>b.name)}
function bindRig(mapping={}){
 if(!model)return false;
 const groups=getSceneBoneGroups(),by={};
 for(const [name,list] of groups)by[String(name).toLowerCase()]=list[0];
 rig.clear();base.clear();
 for(const [slot,name] of Object.entries(mapping)){
  const b=by[String(name||"").toLowerCase()];
  if(b)rig.set(slot,b);
 }
 lastRestPose=normalizeHumanoidRestPose();
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
 const hips=rig.get("hips"),head=rig.get("head");
 const left=rig.get("leftUpperArm")||findNamedBone("left","upper");
 const right=rig.get("rightUpperArm")||findNamedBone("right","upper");
 if(!hips||!head)return{detected:"custom",normalized:true,corrected:false,stillTPose:false,reason:"No humanoid hips/head pair; preserving the GLB rest pose"};
 model.updateWorldMatrix(true,true);
 const hp=hips.getWorldPosition(new THREE.Vector3()),hd=head.getWorldPosition(new THREE.Vector3()),up=hd.clone().sub(hp),height=up.length(),vertical=Math.abs(up.y)/Math.max(height,.001);
 if(vertical<.45)return{detected:"laydown",normalized:false,reason:"Character is not upright"};
 const direction=b=>{const child=b?.children?.find(x=>x.isBone);if(!child)return null;const p=b.getWorldPosition(new THREE.Vector3()),q=child.getWorldPosition(new THREE.Vector3());return q.sub(p).normalize()};
 const armState=()=>{
  const ld=direction(left),rd=direction(right);
  if(!ld||!rd)return null;
    const spread=Math.abs(ld.x)>Math.abs(ld.z)*.65&&Math.abs(rd.x)>Math.abs(rd.z)*.65;
    const horizontal=Math.abs(ld.y)<.5&&Math.abs(rd.y)<.5;
    const relaxed=Math.abs(ld.x)+Math.abs(rd.x)>1.2;
    return{ld,rd,horizontal,spread,relaxed};
 };
 const before=armState();
 if(!before)return{detected:"upright-unknown-arms",normalized:true,corrected:false,stillTPose:false};
 if(before.horizontal&&before.spread&&before.relaxed){
  const leftFore=rig.get("leftForeArm")||findNamedBone("left","fore"),rightFore=rig.get("rightForeArm")||findNamedBone("right","fore");
    const neutralLeft=new THREE.Vector3(-.62,-.82,0),neutralRight=new THREE.Vector3(.62,-.82,0);
    const neutralLeftFore=new THREE.Vector3(-.24,-.94,0),neutralRightFore=new THREE.Vector3(.24,-.94,0);
    aimBoneChild(left,neutralLeft);
    aimBoneChild(right,neutralRight);
    if(leftFore)aimBoneChild(leftFore,neutralLeftFore);
    if(rightFore)aimBoneChild(rightFore,neutralRightFore);
  model.updateWorldMatrix(true,true);
  const after=armState();
    const stillTPose=Boolean(after?.horizontal&&after?.spread&&after?.relaxed);
  return{detected:"t-pose",normalized:!stillTPose,corrected:true,stillTPose};
 }
 return{detected:"upright",normalized:true,corrected:false,stillTPose:false};
}
function validateRig(mapping={}){
 const optional=["hips","head","leftUpperArm","rightUpperArm","leftThigh","rightThigh","spine","chest","neck","leftForeArm","rightForeArm","leftHand","rightHand","leftShin","rightShin","leftFoot","rightFoot","jaw","leftEye","rightEye"];
 const mapped=Object.keys(mapping).filter(k=>rig.get(k));
 const missing=optional.filter(k=>!mapping[k]&&!rig.get(k));
 return{ok:mapped.length>0,missing,criticalMissing:[],optionalMissing:missing,mapped:mapped.length,required:[],optional};
}
function resetCharacterPose(){
 for(const [slot,b] of rig){
  const p=base.get(slot);if(!p)continue;
  const list=boneGroups.get(String(b.name))||[b];
  for(const target of list)target.rotation.set(p.x,p.y,p.z);
 }
}
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
 if(!model)return;
 model.updateWorldMatrix(true,true);
 const raw=new THREE.Box3().setFromObject(model,true);
 const rawSize=raw.getSize(new THREE.Vector3());
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

 camera.position.set(center.x,center.y,center.z+Math.max(.01,dist));
 camera.near=Math.max(.001,Math.min(.1,size.length()/1000));
 camera.far=Math.max(50,size.length()*20);
 camera.lookAt(center);
 camera.updateProjectionMatrix();
}
function render(){
 if(renderQueued||document.hidden)return;
 renderQueued=true;
 requestAnimationFrame(()=>{
  renderQueued=false;
  renderer.render(scene,camera);
 });
}
function resize(){
 const r=canvas.getBoundingClientRect();
 const w=Math.max(1,r.width),h=Math.max(1,r.height);
 renderer.setSize(w,h,false);
 camera.aspect=w/h;
 camera.updateProjectionMatrix();
 fit();
 render();
}
new ResizeObserver(resize).observe(canvas);

function display(parsed){
 if(!parsed?.scene)throw new Error("Selected GLB contains no scene");
 if(model)dispose(model);
 root.clear();
 model=parsed.scene;
 root.add(model);
 rig.clear();base.clear();
 collectMorphs();
 // The GLB scene is authoritative before controller binding.
  window.dispatchEvent(new CustomEvent("saeed-character-loaded"));
  queueMicrotask(()=>window.saeedCharacterController?.onCharacterLoaded?.());
 fit();
 render();
}
async function load(data,generation){
 activeLoad=true;
 try{
  const bytes=data instanceof ArrayBuffer?data:data instanceof Uint8Array?data.buffer:data?.buffer;
  if(!bytes)throw new Error("Selected GLB data is invalid");
  const parsed=await loader.parseAsync(bytes,"");
  if(generation===loadGeneration)display(parsed);
 }finally{
  activeLoad=false;
  if(pendingLoad){
   const p=pendingLoad;
   pendingLoad=null;
   void load(p.data,p.generation);
  }
 }
}
window.saeedAvatarLoadData=async(data,generation)=>{
 const g=Number(generation)||++loadGeneration;
 loadGeneration=Math.max(loadGeneration,g);
 if(activeLoad){pendingLoad={data,generation:g};return}
 return load(data,g);
};
if(window.__saeedPendingCharacterData){
 const p=window.__saeedPendingCharacterData;
 window.__saeedPendingCharacterData=null;
 void window.saeedAvatarLoadData(p.data,p.generation);
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
window.saeedAvatarApply3DSettings=apply3DSettings;
window.saeedAvatarGet3DSettings=()=>({...viewSettings});
window.saeedAvatarSetRuntimeActive=()=>true;
window.saeed?.onCharacter3DSettings?.(apply3DSettings);

function getCharacterPoseStatus(){
 const required=[];
 const bones={};
 for(const [slot,b] of rig){if(!b)continue;bones[slot]={name:b.name,rotation:{x:b.rotation.x,y:b.rotation.y,z:b.rotation.z}};}
 const hips=rig.get("hips"),head=rig.get("head"),left=rig.get("leftUpperArm")||findNamedBone("left","upper"),right=rig.get("rightUpperArm")||findNamedBone("right","upper");
 let isTPose=false,detected="unknown";
 if(hips&&head){const hp=hips.getWorldPosition(new THREE.Vector3()),hd=head.getWorldPosition(new THREE.Vector3()),up=hd.clone().sub(hp),height=up.length(),vertical=Math.abs(up.y)/Math.max(height,.001);if(vertical>=.45){const direction=b=>{const child=b?.children?.find(x=>x.isBone);if(!child)return null;const p=b.getWorldPosition(new THREE.Vector3()),q=child.getWorldPosition(new THREE.Vector3());return q.sub(p).normalize()};const ld=direction(left),rd=direction(right);isTPose=Boolean(ld&&rd&&Math.abs(ld.y)<.5&&Math.abs(rd.y)<.5&&Math.abs(ld.x)>Math.abs(ld.z)*.65&&Math.abs(rd.x)>Math.abs(rd.z)*.65);detected=isTPose?"t-pose":"not-t-pose";}else detected="not-upright";}
 return {loaded:Boolean(model),requiredRig:{},controllable:Boolean(rig.size),controllableBoneCount:rig.size,boneCount:rig.size,bones,skeletonCount:boneGroups.size,duplicateBoneGroups:[...boneGroups.entries()].filter(([,list])=>list.length>1).map(([name,list])=>({name,count:list.length})),tPose:{isTPose,detected},restPose:{...lastRestPose}};
}
function getBoneRotation(name){
 const list=boneGroups.get(String(name||""))||[];
 const b=list[0];
 if(!b)return null;
 return{x:b.rotation.x,y:b.rotation.y,z:b.rotation.z};
}
function setBoneRotation(name,rotation={}){
 const list=boneGroups.get(String(name||""))||[];
 if(!list.length)return false;
 const x=Number(rotation.x),y=Number(rotation.y),z=Number(rotation.z);
 if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z))return false;
 for(const b of list)b.rotation.set(x,y,z);
 render();
 return true;
}
function snapshotBoneRotations(){
 getSceneBones();
 const out={};
 for(const b of getSceneBones())out[b.name]={x:b.rotation.x,y:b.rotation.y,z:b.rotation.z};
 return out;
}
window.saeedAvatar={
 get3DStatus:()=>({
  overall:{state:model?"ready":"starting",detail:model?"3D character rendered":"Waiting for GLB"},
  components:{renderer:{state:"ready"},scene:{state:"ready"},camera:{state:"ready"},canvas:{state:"ready"},sceneContent:{state:model?"rendered":"waiting"}},
  metrics:{drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures}
 }),
 getBoneMap,getBones:getBoneMap,getAvailableBoneNames,bindRig,applyCharacterPose,resetCharacterPose,
 getBoneRotation,setBoneRotation,snapshotBoneRotations,normalizeHumanoidRestPose,
 getCharacterProfileKey:()=>String(window.saeedAvatarCurrentName||"Saeed").trim(),
 getCharacterRigAutoMap:()=>Object.fromEntries([...rig].map(([k,b])=>[k,b.name])),getCharacterPoseStatus,
 getRigValidation:()=>validateRig(Object.fromEntries([...rig].map(([k,b])=>[k,b.name]))),
 getRestPoseNormalization:()=>({...lastRestPose}),
 applyRawBonePose,setCharacterExpression:setMorph,blinkCharacter:blink,setCharacterViseme:setMorph,
 lookCharacterAt:lookAt,wakeRender:render
};
resize();

async function ensureCharacterController(){
 try{
  const mod=await import("./character/CharacterController.js");
  const Existing=window.saeedCharacterController;
  if(Existing?.avatar===window.saeedAvatar){
   const ready=window.saeedAvatar.getCharacterPoseStatus?.();
   if(ready?.loaded&&!Existing.characterId)Existing.onCharacterLoaded?.();
   return Existing;
  }
  const controller=new mod.CharacterController(window.saeedAvatar);
  window.saeedCharacterController=controller;
  controller.api={
   play:(id,o)=>controller.play(id,o),stop:id=>controller.stop(id),stopAll:()=>controller.stopAll(),
   setPose:p=>controller.setPose(p),setIdlePose:p=>controller.setIdlePose(p),resetPose:()=>controller.resetPose(),
   remap:m=>controller.remap(m),autoMap:()=>controller.autoMap(),setLimit:(s,l)=>controller.setLimit(s,l),
   semantic:(i,o)=>controller.semantic(i,o),defineMotion:d=>controller.defineMotion(d),deleteMotion:id=>controller.deleteMotion(id),
   listMotions:()=>controller.listMotions(),status:()=>controller.status(),register:def=>controller.animation.register(def),
   setMood:v=>controller.setMood(v),setBehavior:(v={})=>{controller.behavior={...controller.behavior,...v};return {...controller.behavior}},
   getMood:()=>controller.getMood(),moodPalette:()=>controller.moodPalette(),setVisible:v=>controller.setVisible(v),
   handleEvent:e=>controller.handleEvent(e),touch:()=>controller.touch()
  };
  controller.setVisible(!document.hidden);
  const ready=window.saeedAvatar.getCharacterPoseStatus?.();
  if(ready?.loaded)controller.onCharacterLoaded?.();
  window.dispatchEvent(new CustomEvent("saeed-character-controller-ready"));
  return controller;
 }catch(error){
  window.saeed3DBootstrap&&(window.saeed3DBootstrap.error=error?.stack||String(error));
  window.saeed?.reportDiagnostic?.("ERROR","CHARACTER CONTROLLER LOAD",error?.stack||String(error));
  return null;
 }
}
void ensureCharacterController();
window.saeedEnsureCharacterController=ensureCharacterController;
window.dispatchEvent(new CustomEvent("saeed-avatar-ready"));
