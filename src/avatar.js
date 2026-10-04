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

let model=null,rig=new Map(),base=new Map(),morphs=new Map();
let loadGeneration=0,activeLoad=false,pendingLoad=null,renderQueued=false;
let lastRestPose={detected:"unknown",normalized:false};

function getBoneMap(){return Object.fromEntries(rig)}
function getAvailableBoneNames(){
 const a=[];model?.traverse(o=>{if(o.isBone)a.push(o.name)});return a;
}
function bindRig(mapping={}){
 if(!model)return false;
 const by={};
 model.traverse(o=>{if(o.isBone)by[String(o.name).toLowerCase()]=o});
 rig.clear();base.clear();
 for(const [slot,name] of Object.entries(mapping)){
  const b=by[String(name||"").toLowerCase()];
  if(b)rig.set(slot,b);
 }
 lastRestPose=normalizeHumanoidRestPose();
 for(const [slot,b] of rig)base.set(slot,{x:b.rotation.x,y:b.rotation.y,z:b.rotation.z});
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
 const left=rig.get("leftUpperArm")||findNamedBone("left","upper");
 const right=rig.get("rightUpperArm")||findNamedBone("right","upper");
 if(!left||!right)return{detected:"unknown",normalized:false,reason:"Upper arm bones could not be identified"};
 model.updateWorldMatrix(true,true);
 const direction=b=>{
  const child=b?.children?.find(x=>x.isBone);
  if(!child)return new THREE.Vector3();
  const p=b.getWorldPosition(new THREE.Vector3()),q=child.getWorldPosition(new THREE.Vector3());
  return q.sub(p).normalize();
 };
 const ld=direction(left),rd=direction(right);
 const horizontal=Math.abs(ld.y)<.5&&Math.abs(rd.y)<.5;
 const spread=Math.abs(ld.x)>Math.abs(ld.z)*.65&&Math.abs(rd.x)>Math.abs(rd.z)*.65;
 if(!(horizontal&&spread))return{detected:"standing-or-a-pose",normalized:false};
 aimBoneChild(left,new THREE.Vector3(-.08,-.995,0));
 aimBoneChild(right,new THREE.Vector3(.08,-.995,0));
 model.updateWorldMatrix(true,true);
 const lf=rig.get("leftForeArm")||findNamedBone("left","fore");
 const rf=rig.get("rightForeArm")||findNamedBone("right","fore");
 if(lf)aimBoneChild(lf,new THREE.Vector3(-.04,-.999,.02));
 if(rf)aimBoneChild(rf,new THREE.Vector3(.04,-.999,.02));
 model.updateWorldMatrix(true,true);
 return{detected:"t-pose",normalized:true};
}
function validateRig(mapping={}){
 const required=["hips","spine","neck","head","leftUpperArm","rightUpperArm","leftForeArm","rightForeArm","leftHand","rightHand","leftThigh","rightThigh","leftShin","rightShin","leftFoot","rightFoot"];
 const missing=required.filter(k=>!mapping[k]&&!rig.get(k));
 const critical=["head","leftUpperArm","rightUpperArm","leftThigh","rightThigh"];
 return{ok:missing.length===0,missing,criticalMissing:critical.filter(k=>missing.includes(k)),mapped:Object.keys(mapping).length};
}
function resetCharacterPose(){
 for(const [slot,b] of rig){
  const p=base.get(slot);
  if(p)b.rotation.set(p.x,p.y,p.z);
 }
}
function applyCharacterPose(pose={},retargeter=null){
 for(const [slot,r] of Object.entries(pose)){
  if(retargeter?.apply?.(slot,r))continue;
  const b=rig.get(slot),p=base.get(slot);
  if(b&&p)b.rotation.set(p.x+(Number(r?.x)||0),p.y+(Number(r?.y)||0),p.z+(Number(r?.z)||0));
 }
 render();
 return true;
}
function applyRawBonePose(pose={}){
 for(const [name,r] of Object.entries(pose)){
  let b=null;
  model?.traverse(o=>{if(!b&&o.isBone&&String(o.name)===String(name))b=o});
  if(b){
   b.rotation.x+=Number(r?.x)||0;
   b.rotation.y+=Number(r?.y)||0;
   b.rotation.z+=Number(r?.z)||0;
  }
 }
 render();
 return true;
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
 fit();
 render();
 window.saeedCharacterController?.onCharacterLoaded?.();
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
 Object.assign(viewSettings,{
  characterScale:Number.isFinite(Number(settings.characterScale))?Number(settings.characterScale):viewSettings.characterScale,
  characterPositionX:Number.isFinite(Number(settings.characterPositionX))?Number(settings.characterPositionX):viewSettings.characterPositionX,
  characterPositionY:Number.isFinite(Number(settings.characterPositionY))?Number(settings.characterPositionY):viewSettings.characterPositionY,
  characterPositionZ:Number.isFinite(Number(settings.characterPositionZ))?Number(settings.characterPositionZ):viewSettings.characterPositionZ,
  characterRotationY:Number.isFinite(Number(settings.characterRotationY))?Number(settings.characterRotationY):viewSettings.characterRotationY,
  canvasPadding:0
 });
 fit();
 render();
 return {...viewSettings};
}
window.saeedAvatarApply3DSettings=apply3DSettings;
window.saeedAvatarGet3DSettings=()=>({...viewSettings});
window.saeedAvatarSetRuntimeActive=()=>true;
window.saeed?.onCharacter3DSettings?.(apply3DSettings);

window.saeedAvatar={
 get3DStatus:()=>({
  overall:{state:model?"ready":"starting",detail:model?"3D character rendered":"Waiting for GLB"},
  components:{renderer:{state:"ready"},scene:{state:"ready"},camera:{state:"ready"},canvas:{state:"ready"},sceneContent:{state:model?"rendered":"waiting"}},
  metrics:{drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures}
 }),
 getBoneMap,getBones:getBoneMap,getAvailableBoneNames,bindRig,applyCharacterPose,resetCharacterPose,
 getCharacterProfileKey:()=>String(window.saeedAvatarCurrentName||"Saeed").trim(),
 getCharacterRigAutoMap:()=>Object.fromEntries([...rig].map(([k,b])=>[k,b.name])),
 getRigValidation:()=>validateRig(Object.fromEntries([...rig].map(([k,b])=>[k,b.name]))),
 getRestPoseNormalization:()=>({...lastRestPose}),
 applyRawBonePose,setCharacterExpression:setMorph,blinkCharacter:blink,setCharacterViseme:setMorph,
 lookCharacterAt:lookAt,wakeRender:render
};
resize();
