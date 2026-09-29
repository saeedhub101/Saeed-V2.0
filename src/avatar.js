import * as THREE from "../node_modules/three/build/three.module.js";
if(window.saeed3DBootstrap){window.saeed3DBootstrap.moduleLoaded=true;window.saeed3DBootstrap.error=null;window.saeed3DBootstrap.rejection=null;}

const canvas=document.getElementById("avatar");
const report=(level,stage,message,meta)=>window.saeed?.reportDiagnostic?.(level,stage,message,meta);
const runtime3D={version:THREE.REVISION,overall:{state:"starting",detail:"Initializing 3D renderer"},components:{moduleBootstrap:{state:"ready",detail:"avatar.js module executed successfully"},threeJs:{state:"ready",detail:`Three.js r${THREE.REVISION}`},webgl:{state:"unknown",detail:""},renderer:{state:"unknown",detail:""},scene:{state:"unknown",detail:""},camera:{state:"unknown",detail:""},lights:{state:"unknown",detail:""},canvas:{state:"unknown",detail:""},renderLoop:{state:"unknown",detail:"",frames:0,fps:0,lastRenderAt:null},gltfLoader:{state:"ready",detail:"GLTFLoader module loaded"},testObject:{state:"unknown",detail:""},selectedGlb:{state:"not-tested",detail:"No external GLB selected",name:"",size:0,displayed:false}},metrics:{drawCalls:0,triangles:0,points:0,lines:0,geometries:0,textures:0},viewport:{width:0,height:0,pixelRatio:Math.min(devicePixelRatio||1,2)},lastError:"",lastUpdated:null};
function refreshOverall(){const required=["threeJs","webgl","renderer","scene","camera","lights","canvas","renderLoop","testObject"];const hasError=required.some(k=>runtime3D.components[k]?.state==="error")||Boolean(runtime3D.lastError);const ready=required.every(k=>["ready","rendered","active"].includes(runtime3D.components[k]?.state));runtime3D.overall=hasError?{state:"error",detail:runtime3D.lastError||"One or more 3D components failed"}:ready&&runtime3D.components.testObject.state==="rendered"?{state:"ready",detail:"Three.js + WebGL + diagnostic 3D object are rendering"}:{state:"starting",detail:"3D renderer is initializing"};runtime3D.lastUpdated=new Date().toISOString()}
function set3DState(key,state,detail,extra={}){if(runtime3D.components[key])runtime3D.components[key]={...runtime3D.components[key],state,detail,...extra};refreshOverall()}
report("INFO","THREE MODULE","Three.js module loaded",{revision:THREE.REVISION});set3DState("gltfLoader","not-tested","GLTFLoader is loaded only when needed for an external GLB probe");let scene;try{scene=new THREE.Scene();set3DState("scene","ready","THREE.Scene created");report("INFO","THREE.SCENE","THREE.Scene created")}catch(e){set3DState("scene","error",e.message);runtime3D.lastError=e.message;report("ERROR","THREE.SCENE",e.message);throw e}
let camera;try{camera=new THREE.PerspectiveCamera(32,1,.1,100);camera.position.set(0,0,5);camera.lookAt(0,0,0);set3DState("camera","ready","Fixed PerspectiveCamera created");report("INFO","PERSPECTIVECAMERA","PerspectiveCamera created");report("INFO","PERSPECTIVECAMERA POSITION","Fixed camera position set")}catch(e){set3DState("camera","error",e.message);runtime3D.lastError=e.message;report("ERROR","PERSPECTIVECAMERA",e.message);throw e}
let renderer;try{const gl2=canvas.getContext("webgl2");const gl=gl2||canvas.getContext("webgl");if(!gl)throw new Error("WebGL/WebGL2 context unavailable");set3DState("webgl","ready",gl2?"WebGL2 context available":"WebGL context available",{version:gl2?"WebGL2":"WebGL"});report("INFO","WEBGL CONTEXT",gl2?"WebGL2 context available":"WebGL context available");renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});set3DState("renderer","ready","THREE.WebGLRenderer created",{antialias:true,alpha:true});report("INFO","WEBGLRENDERER","WebGLRenderer created")}catch(e){set3DState("webgl","error",e.message);set3DState("renderer","error",e.message);runtime3D.lastError=e.message;report("ERROR","WEBGL CONTEXT",e.message);throw e}
const renderScale=4;renderer.setPixelRatio(Math.min(Math.max(1,devicePixelRatio||1)*renderScale,4));renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
try{scene.add(new THREE.HemisphereLight(0xffffff,0x334455,2.2));const key=new THREE.DirectionalLight(0xffffff,2.5);key.position.set(2,4,3);scene.add(key);set3DState("lights","ready","Hemisphere + directional lights added");report("INFO","HEMISPHERELIGHT","HemisphereLight added");report("INFO","DIRECTIONALLIGHT","DirectionalLight added")}catch(e){set3DState("lights","error",e.message);runtime3D.lastError=e.message;report("ERROR","LIGHTS",e.message);throw e}

const root=new THREE.Group();scene.add(root);


let mixer=null,clips=[],actions=new Map(),activeAction=null,clock=new THREE.Clock();
let avatarState="idle",moveTimer=null,moveEnd=0,moveDirection=1,bodyYaw=0,bodyYawTarget=0,gestureTimer=null;
let facialTime=0,blinkUntil=0,nextBlink=2+Math.random()*4,expression={smile:0,jawopen:0};
let visemeValues={aa:0,ee:0,oo:0,oh:0,fv:0,mbp:0},visemeTargets={aa:0,ee:0,oo:0,oh:0,fv:0,mbp:0},visemeTimer=null;
let model=null,bones=new Map(),boneBase=new Map(),loader=null,diagnosticObject=null,renderedReportSent=false,frameWindowStart=performance.now(),frameWindowCount=0;
let gltfLoaderPromise=null;
async function ensureGLTFLoader(){if(loader)return loader;if(gltfLoaderPromise)return gltfLoaderPromise;runtime3D.components.gltfLoader.state="loading";runtime3D.components.gltfLoader.detail="Loading vendored GLTFLoader module";gltfLoaderPromise=import("./three/GLTFLoader.js").then(mod=>{loader=new mod.GLTFLoader();set3DState("gltfLoader","ready","GLTFLoader module loaded on demand");report("INFO","GLTFLOADER READY","GLTFLoader initialized successfully");return loader}).catch(e=>{set3DState("gltfLoader","error","GLTFLoader module failed: "+e.message);report("ERROR","GLTFLOADER","GLTFLoader module failed: "+e.message);return null});return gltfLoaderPromise}
const lookTarget=new THREE.Vector3(0,1.5,1);

const aliases={
 idle:["idle","stand","breathing"],walk:["walk","walking","locomotion"],talk:["talk","talking","speak"],
 think:["think","thinking"],happy:["happy","wave"],sad:["sad"],alert:["alert","surprised"]
};
function findClip(name){
 const q=String(name||"").toLowerCase(),names=aliases[q]||[q];
 return clips.find(x=>names.some(n=>x.name.toLowerCase().includes(n)));
}
function playAnimation(name,{loop=true,crossFade=.18}={}){
 if(!mixer)return false;
 const clip=findClip(name);if(!clip)return false;
 let action=actions.get(clip.uuid);
 if(!action){action=mixer.clipAction(clip);actions.set(clip.uuid,action)}
 if(activeAction&&activeAction!==action)activeAction.fadeOut(crossFade);
 action.reset().fadeIn(crossFade);action.setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce,loop?Infinity:1);
 if(!loop)action.clampWhenFinished=true;action.play();activeAction=action;return true;
}

let facialMeshes=[];
const visemeAliases={
 aa:["viseme_aa","aa","jawopen","mouthopen"],ee:["viseme_ee","ee"],oo:["viseme_oo","oo","ou"],
 oh:["viseme_oh","oh"],fv:["viseme_fv","fv"],mbp:["viseme_mbp","mbp","closed"],
 smile:["smile"],blink:["blink","eyeclose"]
};
function mapHumanoidBones(model){
 bones.clear();boneBase.clear();
 const aliases={
  hips:["hips","pelvis","root"],spine:["spine","spine1","spine2","chest"],chest:["chest","upperchest"],
  neck:["neck"],head:["head"],jaw:["jaw","jawbone"],
  leftUpperArm:["leftarm","leftupperarm","upperarm_l","lupperarm"],rightUpperArm:["rightarm","rightupperarm","upperarm_r","rupperarm"],
  leftForeArm:["leftforearm","leftlowerarm","forearm_l","lowerarm_l"],rightForeArm:["rightforearm","rightlowerarm","forearm_r","lowerarm_r"],
  leftHand:["lefthand","hand_l"],rightHand:["righthand","hand_r"],
  leftThigh:["leftupleg","leftthigh","thigh_l","upperleg_l"],rightThigh:["rightupleg","rightthigh","thigh_r","upperleg_r"],
  leftShin:["leftleg","leftlowerleg","calf_l","shin_l"],rightShin:["rightleg","rightlowerleg","calf_r","shin_r"],
  leftFoot:["leftfoot","foot_l"],rightFoot:["rightfoot","foot_r"]
 };
 const all=[];model.traverse(o=>{if(o.isBone)all.push([o.name.toLowerCase().replace(/[^a-z0-9]/g,""),o])});
 for(const [slot,names] of Object.entries(aliases)){
  const hit=all.find(([n])=>names.some(a=>n.includes(a.replace(/[^a-z0-9]/g,""))));
  if(hit){bones.set(slot,hit[1]);boneBase.set(slot,{x:hit[1].rotation.x,y:hit[1].rotation.y,z:hit[1].rotation.z})}
 }
 return Object.fromEntries([...bones].map(([k,b])=>[k,b.name]));
}
function restoreBone(slot){
 const b=bones.get(slot),base=boneBase.get(slot);if(b&&base)b.rotation.set(base.x,base.y,base.z);
}
function addBoneRotation(slot,x=0,y=0,z=0){
 const b=bones.get(slot),base=boneBase.get(slot);if(!b||!base)return;
 b.rotation.x=base.x+x;b.rotation.y=base.y+y;b.rotation.z=base.z+z;
}
function proceduralBody(t){
 if(!bones.size)return;
 const moving=Boolean(moveTimer&&performance.now()<moveEnd),talking=avatarState==="talk",w=moving?Math.sin(t*10.5):0,sway=Math.sin(t*1.7);
 ["leftUpperArm","rightUpperArm","leftForeArm","rightForeArm","leftThigh","rightThigh","leftShin","rightShin","leftFoot","rightFoot","spine","chest"].forEach(restoreBone);
 if(moving){
  addBoneRotation("leftThigh",w*.65);addBoneRotation("rightThigh",-w*.65);
  addBoneRotation("leftShin",-Math.max(0,-w)*.8);addBoneRotation("rightShin",Math.max(0,w)*.8);
  addBoneRotation("leftFoot",Math.max(0,-w)*.45);addBoneRotation("rightFoot",Math.max(0,w)*.45);
  addBoneRotation("leftUpperArm",-w*.28);addBoneRotation("rightUpperArm",w*.28);
 }
 addBoneRotation("spine",0,0,sway*.018);addBoneRotation("chest",0,0,sway*.025);
 if(talking){
  const p=Math.sin(t*7.5),q=Math.sin(t*5.1+.8);
  addBoneRotation("leftUpperArm",-.12,0,p*.08);addBoneRotation("rightUpperArm",-.12,0,-p*.08);
  addBoneRotation("leftForeArm",q*.12);addBoneRotation("rightForeArm",-q*.12);
 }
}
function collectFacialMeshes(model){
 facialMeshes=[];model.traverse(o=>{if(o.isMesh&&o.morphTargetDictionary&&o.morphTargetInfluences)facialMeshes.push(o)});
}
function setMorph(name,value){
 const keys=visemeAliases[name]||[name],v=Math.max(0,Math.min(1,Number(value)||0));
 for(const mesh of facialMeshes)for(const key of keys){const i=mesh.morphTargetDictionary[key];if(i!==undefined)mesh.morphTargetInfluences[i]=v}
}
function setViseme(name,value){const k=String(name||"").toLowerCase();if(visemeTargets[k]!==undefined)visemeTargets[k]=Math.max(0,Math.min(1,Number(value)||0));else setMorph(k,value)}
function playVisemeTimeline(timeline){
 if(!Array.isArray(timeline)||!timeline.length)return false;
 if(visemeTimer)clearTimeout(visemeTimer);
 resetVisemes();
 const started=performance.now();
 const items=timeline.map(x=>({timeMs:Math.max(0,Number(x.timeMs)||0),durationMs:Math.max(30,Number(x.durationMs)||80),viseme:String(x.viseme||"aa").toLowerCase(),value:Math.max(0,Math.min(1,Number(x.value)==null?0.8:Number(x.value)))})).sort((a,b)=>a.timeMs-b.timeMs);
 let i=0;
 const tick=()=>{
  const elapsed=performance.now()-started;
  while(i<items.length&&items[i].timeMs<=elapsed){
   const item=items[i++];
   setViseme(item.viseme,item.value);
   setTimeout(()=>setViseme(item.viseme,0),item.durationMs);
  }
  if(i<items.length)visemeTimer=setTimeout(tick,Math.max(12,Math.min(40,items[i].timeMs-elapsed)));
  else visemeTimer=null;
 };
 tick();return true;
}
function setExpression(name,value){expression[String(name).toLowerCase()]=Math.max(0,Math.min(1,Number(value)||0));setMorph(name,value);return true}
function blink(){setMorph("blink",1);blinkUntil=facialTime+.14;return true}
function resetVisemes(){["aa","ee","oo","oh","fv","mbp"].forEach(v=>{visemeTargets[v]=0;visemeValues[v]=0;setMorph(v,0)});return true}

function installDiagnosticObject(){runtime3D.components.testObject={state:"loading",detail:"Waiting for the bundled Saeed GLB to become the default 3D object"};set3DState("scene","loading","Waiting for the selected/bundled Saeed GLB");report("INFO","3D DEFAULT","No generated diagnostic cube is shown; Saeed GLB is the default character");refreshOverall()}
function fitLoadedModel(){if(!model)return;model.updateWorldMatrix(true,true);const box=new THREE.Box3().setFromObject(model,true);const rawSize=box.getSize(new THREE.Vector3());const targetHeight=3.75;const scale=targetHeight/Math.max(rawSize.y,0.001);model.scale.setScalar(scale);model.updateWorldMatrix(true,true);const fitted=new THREE.Box3().setFromObject(model,true);const size=fitted.getSize(new THREE.Vector3());const center=fitted.getCenter(new THREE.Vector3());model.position.x-=center.x;model.position.z-=center.z;model.position.y-=fitted.min.y;model.updateWorldMatrix(true,true);const box3=new THREE.Box3().setFromObject(model,true);const finalSize=box3.getSize(new THREE.Vector3());const finalCenter=box3.getCenter(new THREE.Vector3());const aspect=Math.max(.1,(canvas.clientWidth||430)/(canvas.clientHeight||520));camera.fov=30;const halfVertical=finalSize.y*.5;const halfHorizontal=finalSize.x*.5/Math.max(aspect,.01);const halfFit=Math.max(halfVertical,halfHorizontal)*1.018;const distance=halfFit/Math.tan(THREE.MathUtils.degToRad(camera.fov*.5));const depthPadding=finalSize.z*.12;camera.position.set(0,finalCenter.y,distance+depthPadding);camera.near=Math.max(.01,finalSize.length()/1000);camera.far=Math.max(100,finalSize.length()*12);camera.lookAt(finalCenter.x,finalCenter.y,finalCenter.z);camera.updateProjectionMatrix();let textureCount=0;const maxAniso=renderer.capabilities.getMaxAnisotropy();model.traverse(o=>{if(!o.isMesh)return;const materials=Array.isArray(o.material)?o.material:[o.material];for(const m of materials){if(!m)continue;for(const key of ["map","normalMap","roughnessMap","metalnessMap","emissiveMap","aoMap"]){const tex=m[key];if(tex&&tex.isTexture){tex.anisotropy=maxAniso;tex.needsUpdate=true;textureCount++}}m.needsUpdate=true}});report("INFO","GLB FIT","Selected GLB framed from measured bounds with high-resolution rendering",{scale,rawDimensions:{x:rawSize.x,y:rawSize.y,z:rawSize.z},dimensions:{x:finalSize.x,y:finalSize.y,z:finalSize.z},cameraDistance:distance+depthPadding,fov:camera.fov,pixelRatio:renderer.getPixelRatio(),anisotropy:maxAniso,textureBindings:textureCount})}
async function displaySelectedGlb(parsed,name,size){if(!parsed?.scene)throw new Error("Selected GLB contains no scene");root.clear();diagnosticObject=null;model=parsed.scene;root.add(model);set3DState("scene","ready","Saeed GLB loaded into the Three.js scene");clips=Array.isArray(parsed.animations)?parsed.animations:[];mixer=clips.length?new THREE.AnimationMixer(model):null;actions.clear();activeAction=null;collectFacialMeshes(model);mapHumanoidBones(model);fitLoadedModel();const idle=playAnimation("idle")||playAnimation("stand")||playAnimation("breathing");runtime3D.components.testObject={state:"rendered",detail:"Saeed GLB is the displayed 3D object"};runtime3D.components.selectedGlb={...runtime3D.components.selectedGlb,state:"ready",detail:"Saeed GLB parsed and displayed in the character window",size,name,parsed:true,displayed:true,animations:clips.map(x=>x.name),bones:Object.keys(mapHumanoidBones(model))};report("INFO","GLB DISPLAY","Saeed GLB is now displayed",{name,size,animations:clips.length,bones:bones.size,morphTargets:facialMeshes.length,idleAnimation:Boolean(idle)});refreshOverall()}
async function loadDiagnosticObject(){try{installDiagnosticObject()}catch(e){
  console.error("Diagnostic 3D object failed:",e);const message=document.getElementById("status");if(message)message.textContent="3D diagnostic object failed";runtime3D.lastError=e.message;runtime3D.components.testObject.state="error";runtime3D.components.testObject.detail="Diagnostic 3D object failed: "+e.message;refreshOverall();report("ERROR","3D TEST OBJECT",e.message);
 }
}
window.saeedAvatarLoadData=async data=>{try{const gltf=await ensureGLTFLoader();if(!gltf)throw new Error("GLTFLoader unavailable; see 3D Status");
 let bytes=data;
 if(data instanceof Uint8Array){bytes=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)}
 else if(data instanceof ArrayBuffer){bytes=data}
 else if(data?.buffer instanceof ArrayBuffer){const view=new Uint8Array(data.buffer,data.byteOffset||0,data.byteLength||data.buffer.byteLength);bytes=view.buffer.slice(view.byteOffset,view.byteOffset+view.byteLength)}
 else throw new Error("Selected GLB data is not an ArrayBuffer/Uint8Array");
 const size=bytes.byteLength;runtime3D.components.selectedGlb={...runtime3D.components.selectedGlb,state:"loading",detail:"Selected GLB is being parsed and prepared for display",size};report("INFO","GLB SELECTED PROBE","Selected GLB normalized to ArrayBuffer and will be parsed",{size,inputType:data?.constructor?.name||typeof data});const parsed=await gltf.parseAsync(bytes,"");await displaySelectedGlb(parsed,"Selected Character",size);}catch(e){runtime3D.components.selectedGlb={...runtime3D.components.selectedGlb,state:"error",detail:"Selected GLB parse failed: "+e.message,displayed:false};report("ERROR","GLB SELECTED PROBE",e.message)}refreshOverall()};
window.saeedAvatar={get3DStatus:()=>{refreshOverall();return JSON.parse(JSON.stringify(runtime3D))},reloadDiagnostic:()=>{renderedReportSent=false;runtime3D.lastError="";runtime3D.components.testObject={...runtime3D.components.testObject,state:"loading",detail:"Reloading diagnostic 3D object"};installDiagnosticObject();return true}};
loadDiagnosticObject();
ensureGLTFLoader();

function smoothTurnTo(yaw){
 bodyYawTarget=Number(yaw)||0;
}
function setState(state){
 const next=String(state||"idle").toLowerCase();avatarState=next;
 if(next==="stop"){avatarState="idle";return playAnimation("idle")}
 return playAnimation(next)||playAnimation("idle");
}
function move(direction="forward",duration=1200){
 const d=String(direction).toLowerCase();
 moveDirection=(d==="left"||d==="backward"||d==="back")?-1:1;
 smoothTurnTo(d==="left"?-Math.PI/2:d==="right"?Math.PI/2:d==="backward"||d==="back"?Math.PI:bodyYawTarget);
 playAnimation("walk");
 const ms=Math.max(150,Number(duration)||1200);moveEnd=performance.now()+ms;
 if(moveTimer)clearTimeout(moveTimer);
 moveTimer=setTimeout(()=>{moveTimer=null;avatarState="idle";playAnimation("idle")},ms);
 return true;
}
function gesture(name="happy"){
 if(gestureTimer)clearTimeout(gestureTimer);
 const ok=playAnimation(name,{loop:false,crossFade:.15});
 gestureTimer=setTimeout(()=>playAnimation(avatarState==="talk"?"talk":"idle"),1200);return ok;
}
function lookAt(x=0,y=1.5,z=1){
 lookTarget.set(Number(x)||0,Number(y)||1.5,Number(z)||1);
 const dx=lookTarget.x-root.position.x,dz=lookTarget.z-root.position.z;
 if(Math.abs(dx)+Math.abs(dz)>.05)smoothTurnTo(Math.atan2(dx,dz));
 return true;
}
function turn(direction){
 const d=String(direction).toLowerCase();
 const yaw=d==="left"?bodyYaw-Math.PI/2:d==="right"?bodyYaw+Math.PI/2:d==="back"||d==="backward"?bodyYaw+Math.PI:Number(direction)||0;
 smoothTurnTo(yaw);return true;
}
function nod(){
 const head=bones.get("head"),baseBone=boneBase.get("head");
 if(head&&baseBone){head.rotation.x=baseBone.x+.12;setTimeout(()=>head.rotation.set(baseBone.x,baseBone.y,baseBone.z),180);return true;}
 const baseRoot=root.rotation.x;root.rotation.x=baseRoot+.12;setTimeout(()=>root.rotation.x=baseRoot,180);return true;
}
window.saeedAvatar={
 setState,move,turn,gesture,lookAt,nod,
 get3DStatus:()=>{refreshOverall();return JSON.parse(JSON.stringify(runtime3D))},
 reloadDiagnostic:()=>{renderedReportSent=false;runtime3D.lastError="";runtime3D.components.testObject={...runtime3D.components.testObject,state:"loading",detail:"Reloading diagnostic 3D object"};installDiagnosticObject();return true},
 stop(){if(moveTimer){clearTimeout(moveTimer);moveTimer=null}avatarState="idle";return playAnimation("idle")},
  setMood(mood){root.rotation.z=0;root.scale.setScalar(mood==="excited"?1.04:mood==="sad"?.97:1);if(mood==="alert")root.rotation.z=.02},
 play(name,options){return playAnimation(name,options)},
 hasAnimation(name){return Boolean(findClip(name))},
 getAnimations(){return clips.map(c=>c.name)},
 getBones(){return Object.fromEntries([...bones].map(([k,b])=>[k,b.name]))},
 walk(){return playAnimation("walk")},idle(){return playAnimation("idle")},talk(){return playAnimation("talk")},think(){return playAnimation("think")},
 setViseme,playVisemeTimeline,resetVisemes,setExpression,blink,setMorph,
 getFacialTargets(){return facialMeshes.flatMap(m=>Object.keys(m.morphTargetDictionary||{}))}
};

function resize(){try{const r=canvas.getBoundingClientRect(),w=Math.max(1,r.width),h=Math.max(1,r.height);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();runtime3D.viewport={width:Math.round(w),height:Math.round(h),pixelRatio:renderer.getPixelRatio()};set3DState("canvas","ready",`Canvas ${Math.round(w)}×${Math.round(h)}`);report("INFO","CANVAS","Canvas resized")}catch(e){runtime3D.lastError=e.message;set3DState("canvas","error",e.message);report("ERROR","CANVAS",e.message)}}try{new ResizeObserver(resize).observe(canvas);resize();report("INFO","CANVAS READY","Canvas initialized")}catch(e){runtime3D.lastError=e.message;set3DState("canvas","error",e.message);report("ERROR","CANVAS",e.message)}

let renderLoopStarted=false;function frame(){
 requestAnimationFrame(frame);if(!renderLoopStarted){renderLoopStarted=true;set3DState("renderLoop","active","requestAnimationFrame loop is running");report("INFO","RENDER LOOP","Render loop started");}
 const dt=clock.getDelta();facialTime+=dt;runtime3D.components.renderLoop.frames++;runtime3D.components.renderLoop.lastRenderAt=new Date().toISOString();frameWindowCount++;const now=performance.now();if(now-frameWindowStart>=1000){runtime3D.components.renderLoop.fps=frameWindowCount*1000/(now-frameWindowStart);frameWindowCount=0;frameWindowStart=now;}
 proceduralBody(facialTime);
 Object.keys(visemeTargets).forEach(k=>{visemeValues[k]+=(visemeTargets[k]-visemeValues[k])*Math.min(1,dt*18);setMorph(k,visemeValues[k])});
 if(mixer)mixer.update(dt);
 
 if(moveTimer&&performance.now()<moveEnd){
  root.position.x+=dt*.22*moveDirection;
  if(root.position.x>.7)root.position.x=-.7;
  if(root.position.x<-.7)root.position.x=.7;
 }
 bodyYaw+=(bodyYawTarget-bodyYaw)*Math.min(1,dt*4);
 root.rotation.y=bodyYaw;
 if(facialTime>=nextBlink){blink();nextBlink=facialTime+2.5+Math.random()*5}
 if(blinkUntil&&facialTime>=blinkUntil){setMorph("blink",0);blinkUntil=0}
 if(avatarState!=="talk"&&avatarState!=="think"){
  const breathe=(Math.sin(facialTime*1.8)+1)*.5;
  root.position.y+=(breathe*.018-root.position.y)*Math.min(1,dt*2);
 }
 try{
  if(diagnosticObject)diagnosticObject.rotation.y+=dt*.55;
  renderer.render(scene,camera);
  runtime3D.metrics={drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,points:renderer.info.render.points,lines:renderer.info.render.lines,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures};
  if(runtime3D.components.testObject.state==="ready"&&renderer.info.render.calls>0){runtime3D.components.testObject.state="rendered";runtime3D.components.testObject.detail="Diagnostic 3D object produced WebGL draw calls";if(!renderedReportSent){renderedReportSent=true;report("INFO","3D TEST OBJECT RENDERED","Standalone 3D object is rendered by WebGL",runtime3D.metrics)}refreshOverall()}
 }catch(e){
  console.error("Saeed 3D renderer.render failed:",e);
  runtime3D.lastError=e.message;set3DState("renderLoop","error",e.message);
  const message=document.getElementById("status");
  if(message)message.textContent="Saeed 3D renderer failed";
  report("ERROR","3D RENDER","renderer.render failed: "+e.message);
 }
}
frame();