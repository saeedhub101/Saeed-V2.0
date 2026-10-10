const fs=require("fs"),path=require("path");

function createCiE2E(deps={}){
 const {app,getCharacterWindow,getChatHost,getAgent,getTray,getBrainActive,ensureBrain,releaseBrainIfIdle,setMicMode,setVoiceMuted,getVoiceMuted,characterHost,getVoiceHost,getPerformanceWindow,showPerformance:depsShowPerformance,getSettingsWindow,getAddonsWindow,getLearningWindow,getStatusWindow,getRestPoseEditorWindow,getNormalizeHumanoidRestPoseWindow,showNormalizeHumanoidRestPose:depsShowNormalizeHumanoidRestPose,showSettings:depsShowSettings,showAddons:depsShowAddons,showLearning:depsShowLearning,showStatus:depsShowStatus,showRestPoseEditor:depsShowRestPoseEditor}=deps;
 const report={startedAt:new Date().toISOString(),checks:{},phases:{},suite:null};
 const suiteArg=String(process.env.SAEED_CI_E2E_SUITE||"all");
 const out=process.env.SAEED_CI_E2E_REPORT||path.join(process.cwd(),"dist",suiteArg==="all"?"ci-e2e-report.json":`ci-e2e-suite-${suiteArg}.json`);
 const started=Date.now();


 const suiteChecks={
  current:name=>name.startsWith("acceptance."),
  "0":name=>["startup.character-visible","startup.tray","startup.mic-off","startup.brain-off","tray.single-owner-and-menu","hide-saeed-keeps-tray","show-saeed-restores","idle-final"].includes(name),
  "1":name=>name.startsWith("performance.")||name==="acceptance.rest-pose-process-restart",
  "4":name=>name.startsWith("glb.")||name.startsWith("glbtest.")||["acceptance.app-startup","acceptance.authoritative-glb-visible","acceptance.repeat-load-preserves-visible-character","acceptance.available-bones-animate"].includes(name),
  "5":name=>name.startsWith("chat.")||name.startsWith("brain.")||name.startsWith("voice.")||name.startsWith("mute.")||name.startsWith("mic-off-")||["startup.mic-off","startup.brain-off"].includes(name),
  "6":name=>name.startsWith("windows.")||name.startsWith("character.")||["startup.addons-window-opens","startup.learning-window-opens","startup.microphone-transcript-label-toggle-and-render","tray.single-owner-and-menu","hide-saeed-keeps-tray","show-saeed-restores","idle-final"].includes(name)
 };
 const suiteFor=name=>{
  if(restartPhase==="verify")return name==="acceptance.rest-pose-process-restart";
  if(suiteArg==="all")return true;
  const predicate=suiteChecks[suiteArg];
  return typeof predicate==="function"&&predicate(name);
 };
 const restartPhase=String(process.env.SAEED_CI_E2E_RESTART_PHASE||"");
 const {AsyncLocalStorage}=require("async_hooks");
 const checkContext=new AsyncLocalStorage();
 const trace=[];
 const active={name:null,startedAt:0,operation:null,operationStartedAt:0};
 const recordTrace=(event,detail={})=>{const item={at:new Date().toISOString(),elapsedMs:Date.now()-started,event,...detail};trace.push(item);if(trace.length>200)trace.shift();return item};
 const persistReport=(reason="checkpoint")=>{
  try{
   const snapshot={...report,checkpoint:{reason,time:new Date().toISOString()},diagnostics:{...(report.diagnostics||{}),runnerVersion:4,timeoutPolicy:"continue-after-check-timeout",trace:trace.slice(),timeoutCount:Object.values(report.checks).filter(x=>x.status==="TIMEOUT").length,errorCount:Object.values(report.checks).filter(x=>x.status==="ERROR").length}};
   fs.mkdirSync(path.dirname(out),{recursive:true});
   fs.writeFileSync(out,JSON.stringify(snapshot,null,2),"utf8");
  }catch(e){console.error("CI E2E checkpoint write failed:",e)}
 };
 const operation=async(name,fn,detail={})=>{
  const ctx=checkContext.getStore();
  const opStarted=Date.now();
  if(ctx){ctx.operation=String(name);ctx.operationStartedAt=opStarted}
  recordTrace("operation-start",{check:ctx?.name||active.name||null,operation:String(name),...detail});
  try{return await fn()}
  finally{
   recordTrace("operation-end",{check:ctx?.name||active.name||null,operation:String(name),elapsedMs:Date.now()-opStarted});
   if(ctx){ctx.operation=null}
  }
 };
 const execJs=async(w,script,opts)=>operation("webContents.executeJavaScript",()=>w.webContents.executeJavaScript(script,opts),{scriptPreview:String(script).replace(/\s+/g," ").slice(0,240)});
 const suite1Timeouts={
  "performance.character-save-rest-pose":60000,
  "startup.character-visible":30000,
  "startup.tray":30000,
  "startup.mic-off":30000,
  "startup.brain-off":30000,
  "performance.open-character-controller":60000,
  "performance.all-tabs-functional":45000,
  "performance.control-real-bone":45000,
  "performance.procedural-motion-real-bone":60000,
  "performance.create-edit-delete-motion":60000,
  "performance.rig-auto-map":60000,
  "performance.all-registered-compatible-motions":120000,
  "performance.close":30000
 };
 const suite2Timeouts={
  "chat.open":30000,
  "chat.local-time":30000,
  "brain.intent-open-my-computer":45000,
  "brain.intent-api-escalation":120000,
  "chat.response-reaches-character-bubble":60000,
  "voice.chat-response-tts-chain":90000,
  "chat.ui-response-visible":30000,
  "voice.renderer-capabilities":30000,
  "voice.output-device-capability":30000,
  "voice.tts-local-output":90000,
  "voice.mic-device-capability":30000,
  "mute.text-still-visible":30000,
  "chat.close-keeps-brain-when-mic-on":45000,
  "mic-off-releases-brain-after-chat-closed":45000,
  "character.studio-animation-any-bone-edit-play":90000,
  "glb.replace-character-file":60000
 };
 const check=async(name,fn,{required=true,timeoutMs=30000}={})=>{
  if(!suiteFor(name))return {pass:true,required,skipped:true};
  if(restartPhase==="verify"&&name!=="acceptance.rest-pose-process-restart")return {pass:true,required:false,skipped:true,phase:restartPhase};
  const effectiveTimeoutMs=suite1Timeouts[name]||suite2Timeouts[name]||timeoutMs;
  const t=Date.now();
  const ctx={name,startedAt:t,operation:null,operationStartedAt:t,timedOut:false};
  active.name=name;active.startedAt=t;active.operation=null;active.operationStartedAt=t;
  recordTrace("check-start",{check:name,timeoutMs:effectiveTimeoutMs});
  let timer;
  const work=checkContext.run(ctx,()=>Promise.resolve().then(fn));
  const timeout=new Promise(resolve=>{timer=setTimeout(()=>{
   ctx.timedOut=true;
   const diagnostic={check:name,lastOperation:ctx.operation,lastOperationElapsedMs:ctx.operation?Date.now()-ctx.operationStartedAt:0,trace:trace.slice(-20)};
   recordTrace("check-timeout",{check:name,timeoutMs:effectiveTimeoutMs,lastOperation:diagnostic.lastOperation,lastOperationElapsedMs:diagnostic.lastOperationElapsedMs}); report.checks[name]={pass:false,required,status:"TIMEOUT",latencyMs:Date.now()-t,detail:{error:"Check exceeded "+effectiveTimeoutMs+" ms",diagnostic}}; persistReport("check-timeout");
   resolve({pass:false,status:"TIMEOUT",error:"Check exceeded "+effectiveTimeoutMs+" ms; continuing to the next check.",diagnostic});
  },effectiveTimeoutMs)});
  try{
   const v=await Promise.race([work,timeout]);
   clearTimeout(timer);
   const pass=v===true||v?.pass===true;
   const effectiveRequired=v?.required===false?false:required;
   const detail=typeof v==="object"&&v&&!Array.isArray(v)?v:undefined;
   report.checks[name]={pass,required:effectiveRequired,latencyMs:Date.now()-t,status:v?.status||undefined,detail};
   persistReport("check-complete");
   recordTrace(pass?"check-pass":"check-fail",{check:name,status:pass?"PASS":(v?.status||"FAILED"),error:v?.error,diagnostic:v?.diagnostic});
   if(v?.status==="TIMEOUT"){
    
   }
   return report.checks[name];
  }catch(e){
   clearTimeout(timer);
   const diagnostic={check:name,lastOperation:ctx.operation,lastOperationElapsedMs:ctx.operation?Date.now()-ctx.operationStartedAt:0,trace:trace.slice(-20)};
   report.checks[name]={pass:false,required,latencyMs:Date.now()-t,status:"ERROR",error:String(e?.stack||e),diagnostic};
   persistReport("check-error");
   recordTrace("check-error",{check:name,error:String(e?.message||e)});
   return report.checks[name];
  }finally{
   if(active.name===name){active.name=null;active.operation=null}
  }
 };
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const chatWindow=()=>getChatHost?.().getChatWindow?.()||null;
 const visible=w=>Boolean(w&&!w.isDestroyed()&&w.isVisible());
 async function run(){
  report.suite=suiteArg;
  try{
   report.phases.startup={};
   await check("acceptance.app-startup",async()=>{
    const w=getCharacterWindow?.(),tray=getTray?.();
    if(!visible(w))return {pass:false,error:"Floating character window is not visible"};
    if(!tray)return {pass:false,error:"System tray was not created"};
    const runtime=await execJs(w,'(()=>({bootstrap:window.saeed3DBootstrap,engine:window.saeedCharacterRuntime?.engine?.get3DStatus?.()}))()',true).catch(e=>({error:String(e?.message||e)}));
    return {pass:Boolean(!runtime?.error&&!runtime?.bootstrap?.error),characterVisible:true,tray:true,runtime};
   });
   await check("acceptance.authoritative-glb-visible",async()=>{
    const w=getCharacterWindow?.();
    if(!visible(w))return {pass:false,error:"Character window is not visible"};
    const source=path.join(app.getAppPath(),"assets","Saeed_AI-3D.glb");
    if(!fs.existsSync(source))return {pass:false,error:"Authoritative asset missing",source};
    let result=null;const deadline=Date.now()+25000;
    while(Date.now()<deadline){
     result=await execJs(w,'(()=>{const rt=window.saeedCharacterRuntime||{},e=rt.engine,engine=e?.get3DStatus?.(),scene=e?.getScene?.(),meshes=[];scene?.traverse?.(o=>{if((o?.isMesh||o?.isSkinnedMesh)&&o.visible){let p=o,shown=true;while(p){if(p.visible===false){shown=false;break}p=p.parent}if(shown)meshes.push({name:o.name||"",type:o.type})}});const boneNames=(e?.getAvailableBoneNames?.()||[]).map(b=>typeof b==="string"?b:String(b?.name||"")).filter(Boolean);const mappedRaw=e?.getBoneMap?.()||{},mapped=Object.fromEntries(Object.entries(mappedRaw).map(([k,v])=>[String(k),typeof v==="string"?v:String(v?.name||"")]));return {bootstrap:window.saeed3DBootstrap,engine,sceneState:engine?.components?.sceneContent?.state,meshCount:meshes.length,meshes:meshes.slice(0,25),bones:boneNames,mapped}})()',true).catch(e=>({error:String(e?.stack||e)}));
     if(!result?.error&&result?.sceneState==="rendered"&&Number(result?.meshCount)>0)break;
     await wait(300);
    }
    const valid=Boolean(!result?.error&&!result?.bootstrap?.error&&result?.sceneState==="rendered"&&result.meshCount>0);
    return {pass:valid,source,size:fs.statSync(source).size,meshOnly:valid&&(result.bones||[]).length===0,boneCount:(result.bones||[]).length,mappedCount:Object.keys(result.mapped||{}).length,result};
   });
   await check("acceptance.repeat-load-preserves-visible-character",async()=>{
    const w=getCharacterWindow?.(),source=path.join(app.getAppPath(),"assets","Saeed_AI-3D.glb");
    if(!visible(w)||!fs.existsSync(source)||typeof characterHost?.replaceCharacterForCi!=="function")return {pass:false,error:"Character window, authoritative GLB, or replacement API unavailable"};
    const temp=path.join(app.getPath("temp"),"Saeed-current-acceptance.glb");
    try{
     fs.copyFileSync(source,temp);
     const first=await characterHost.replaceCharacterForCi(temp);
     await wait(500);
     const second=await characterHost.replaceCharacterForCi(temp);
     await wait(800);
     const after=await execJs(w,'(()=>{const e=window.saeedCharacterRuntime?.engine,st=e?.get3DStatus?.(),scene=e?.getScene?.(),meshes=[];scene?.traverse?.(o=>{if((o?.isMesh||o?.isSkinnedMesh)&&o.visible)meshes.push(o.name||o.type)});return {bootstrap:window.saeed3DBootstrap,state:st?.components?.sceneContent?.state,meshCount:meshes.length,meshes:meshes.slice(0,20)}})()',true);
     return {pass:Boolean(first?.ok&&second?.ok&&!after?.bootstrap?.error&&after?.state==="rendered"&&after?.meshCount>0),first,second,after};
    }finally{try{fs.unlinkSync(temp)}catch{}}
   },{timeoutMs:60000});
   await check("acceptance.available-bones-animate",async()=>{
    const w=getCharacterWindow?.();
    if(!visible(w))return {pass:false,error:"Character window is not visible"};
    const sceneData=await execJs(w,'(()=>{const e=window.saeedCharacterRuntime?.engine,scene=e?.getScene?.(),meshes=[];scene?.traverse?.(o=>{if((o?.isMesh||o?.isSkinnedMesh)&&o.visible)meshes.push(o.name||o.type)});return {state:e?.get3DStatus?.()?.components?.sceneContent?.state,meshCount:meshes.length,bones:e?.getAvailableBoneNames?.()||[]}})()',true);
    if(sceneData?.state!=="rendered"||Number(sceneData?.meshCount)<1)return {pass:false,stage:"render",sceneData};
    if(!sceneData.bones.length)return {pass:true,capabilityMode:"mesh-only",boneCount:0,animation:"not-applicable-no-bones",sceneData};
    const opened=await depsShowPerformance?.();await wait(500);
    const pw=getPerformanceWindow?.()||opened;
    if(!visible(pw))return {pass:false,stage:"performance-window",error:"Could not open character controller window",boneCount:sceneData.bones.length};
    const result=await execJs(pw,'(async()=>{const api=window.saeed;const before=await api.character.getCharacterController();const boneNames=await api.character.characterController({action:"boneNames"});const available=(boneNames?.bones||[]).filter(Boolean);if(!available.length)return {pass:false,stage:"bone-discovery",error:"Engine scene has bones but controller exposes none"};const mappedBefore=Object.keys(before?.autoRig||{});if(!mappedBefore.length)await api.character.characterController({action:"autoMap"}).catch(()=>{});const state=await api.character.getCharacterController();const slots=Object.keys(state?.autoRig||{}).filter(k=>state.autoRig[k]);if(!slots.length)return {pass:false,stage:"partial-rig-map",error:"Bones exist but no available logical bone was mapped",available,mapped:state?.autoRig||{}};const slot=slots[0],id="ciCurrentAcceptanceMotion";const motion={id,duration:1,layer:"special",loop:false,keyframes:[{time:0,pose:{[slot]:{x:0,y:0,z:0}}},{time:.35,pose:{[slot]:{x:.32,y:.41,z:.18}}},{time:.75,pose:{[slot]:{x:-.2,y:-.28,z:.12}}},{time:1,pose:{[slot]:{x:0,y:0,z:0}}}]};const saved=await api.character.characterController({action:"defineMotion",motion});if(!saved?.ok)return {pass:false,stage:"define-motion",saved,slot,available};await api.character.characterController({action:"play",motion:id,options:{duration:1,speed:1,intensity:1,loop:false}});await new Promise(r=>setTimeout(r,280));const during=await api.character.getCharacterController();const bone=state.autoRig[slot],a=state.actualBones?.[bone]?.rotation,b=during.actualBones?.[during.autoRig?.[slot]||bone]?.rotation;const changed=Boolean(a&&b&&(Math.abs((b.x||0)-(a.x||0))>.01||Math.abs((b.y||0)-(a.y||0))>.01||Math.abs((b.z||0)-(a.z||0))>.01));await api.character.characterController({action:"stopAll"}).catch(()=>{});await api.character.characterController({action:"deleteMotion",id}).catch(()=>{});return {pass:changed,stage:changed?"animated":"no-bone-change",slot,bone,available,mapped:state.autoRig,before:a,during:b,changed}})()',true);
    return {...result,sceneData,boneCount:sceneData.bones.length};
   },{timeoutMs:90000});
   await check("acceptance.rest-pose-bone-position-save-reset",async()=>{
    const opened=await depsShowPerformance?.();await wait(350);
    const pw=getPerformanceWindow?.()||opened;
    if(!visible(pw))return {pass:false,stage:"performance-window",error:"Could not open character controller for rest-pose acceptance"};
    const result=await execJs(pw,`(async()=>{
     const api=window.saeed;
     const initial=await api.character.characterController({action:"status"});
     if(!initial?.status?.characterLoaded)return {pass:false,stage:"character-load",status:initial};
     let bones=initial.status.actualBones||{};
     let bone=Object.keys(bones).find(n=>n&&bones[n]?.rotation&&bones[n]?.position&&bones[n]?.restPose?.position);
     if(!bone){await api.character.characterController({action:"autoMap"}).catch(()=>{});await api.character.characterController({action:"resetPose"}).catch(()=>{});const refreshed=await api.character.characterController({action:"status"});bones=refreshed?.status?.actualBones||{};bone=Object.keys(bones).find(n=>n&&bones[n]?.rotation&&bones[n]?.position&&bones[n]?.restPose?.position)}
     if(!bone)return {pass:true,required:false,skipped:true,stage:"bone-selection",reason:"This GLB has no controllable bone positions; mesh-only character capability is supported"};
     await api.character.characterController({action:"stopAll"}).catch(()=>{});
     await api.character.characterController({action:"resetPose"});
     const baselineStatus=await api.character.characterController({action:"status"});
     const baseline=baselineStatus?.status?.actualBones?.[bone];
     if(!baseline?.rotation||!baseline?.position)return {pass:false,stage:"baseline",bone,baseline};
     const original={rotation:baseline.rotation,position:baseline.position};
     const delta={rotation:{x:.17,y:-.11,z:.09},position:{x:.06,y:.025,z:-.035}};
     const target={rotation:{x:original.rotation.x+delta.rotation.x,y:original.rotation.y+delta.rotation.y,z:original.rotation.z+delta.rotation.z},position:{x:original.position.x+delta.position.x,y:original.position.y+delta.position.y,z:original.position.z+delta.position.z}};
     const moved=await api.character.characterController({action:"setBoneTransform",bone,transform:delta});
     const movedStatus=await api.character.characterController({action:"status"});
     const actual=movedStatus?.status?.actualBones?.[bone]||{},near=(a,b,t)=>Math.abs((Number(a)||0)-(Number(b)||0))<t;
     const movedOk=Boolean(moved?.ok&&["x","y","z"].every(k=>near(actual.rotation?.[k],target.rotation[k],.035)&&near(actual.position?.[k],target.position[k],.015)));
     const saved=await api.character.characterController({action:"saveRestPose"});
     const afterSave=await api.character.characterController({action:"status"});
     const rest=afterSave?.status?.actualBones?.[bone]?.restPose||{};
     const savedRotation=rest.rotation||{},savedPosition=rest.position||{};
     const saveCaptured=Boolean(saved?.ok&&saved?.persisted&&["x","y","z"].every(k=>near(savedRotation[k],target.rotation[k],.035)&&near(savedPosition[k],target.position[k],.015)));
     const second={rotation:{x:.23,y:.12,z:-.14},position:{x:-.045,y:.055,z:.07}};
     const altered=await api.character.characterController({action:"setBoneTransform",bone,transform:second});
     const reset=await api.character.characterController({action:"resetPose"});
     const restoredStatus=await api.character.characterController({action:"status"});
     const restored=restoredStatus?.status?.actualBones?.[bone]||{};
     const restoredOk=Boolean(altered?.ok&&reset?.ok&&["x","y","z"].every(k=>near(restored.rotation?.[k],target.rotation[k],.035)&&near(restored.position?.[k],target.position[k],.015)));
     let cleanup=null;
     if(movedOk&&saveCaptured){const reverse={rotation:{x:-delta.rotation.x,y:-delta.rotation.y,z:-delta.rotation.z},position:{x:-delta.position.x,y:-delta.position.y,z:-delta.position.z}};const undone=await api.character.characterController({action:"setBoneTransform",bone,transform:reverse});const originalSaved=await api.character.characterController({action:"saveRestPose"});const resetOriginal=await api.character.characterController({action:"resetPose"});cleanup={ok:Boolean(undone?.ok&&originalSaved?.ok&&originalSaved?.persisted&&resetOriginal?.ok)}}
     return {pass:Boolean(movedOk&&saveCaptured&&restoredOk&&cleanup?.ok),bone,original,target,actual,movedOk,saved:Boolean(saved?.persisted),savedRotation,savedPosition,saveCaptured,restoredRotation:restored.rotation,restoredPosition:restored.position,restoredOk,cleanup};
    })()`,true);
    return result;
   },{timeoutMs:60000});
   await check("acceptance.rest-pose-process-restart",async()=>{
    const marker=path.join(app.getPath("userData"),"ci-rest-pose-restart.json");
    if(restartPhase!=="prepare"&&restartPhase!=="verify")return {pass:true,required:false,skipped:true,reason:"Restart verification is driven by the packaged runner"};
    if(restartPhase==="prepare"){
     const w=getCharacterWindow?.();
     if(!visible(w))return {pass:false,stage:"prepare-window",error:"Character window is not visible"};
     const opened=await depsShowPerformance?.();await wait(350);
     const pw=getPerformanceWindow?.()||opened;
     if(!visible(pw))return {pass:false,stage:"prepare-performance",error:"Could not open controller for restart verification"};
     const result=await execJs(pw,`(async()=>{
      const api=window.saeed,near=(a,b,t)=>Math.abs((Number(a)||0)-(Number(b)||0))<t;
      await api.character.characterController({action:"autoMap"}).catch(()=>{});
      await api.character.characterController({action:"stopAll"}).catch(()=>{});
      await api.character.characterController({action:"resetPose"}).catch(()=>{});
      const s=await api.character.characterController({action:"status"}),bones=s?.status?.actualBones||{};
      const bone=Object.keys(bones).find(n=>n&&bones[n]?.rotation&&bones[n]?.position&&bones[n]?.restPose?.position);
      if(!bone)return {pass:true,notApplicable:true,reason:"This GLB has no controllable bone position",marker:{notApplicable:true}};
      const original={rotation:{...bones[bone].rotation},position:{...bones[bone].position}};
      const delta={rotation:{x:.13,y:-.08,z:.06},position:{x:.04,y:.025,z:-.03}};
      const target={rotation:{x:original.rotation.x+delta.rotation.x,y:original.rotation.y+delta.rotation.y,z:original.rotation.z+delta.rotation.z},position:{x:original.position.x+delta.position.x,y:original.position.y+delta.position.y,z:original.position.z+delta.position.z}};
      const moved=await api.character.characterController({action:"setBoneTransform",bone,transform:delta});
      const saved=await api.character.characterController({action:"saveRestPose"});
      const after=await api.character.characterController({action:"status"}),actual=after?.status?.actualBones?.[bone]||{},rest=actual.restPose||{};
      const savedRotation=rest.rotation||{},savedPosition=rest.position||{};
      const ok=Boolean(moved?.ok&&saved?.ok&&saved?.persisted&&["x","y","z"].every(k=>near(actual.rotation?.[k],target.rotation[k],.035)&&near(actual.position?.[k],target.position[k],.015)&&near(savedRotation[k],target.rotation[k],.035)&&near(savedPosition[k],target.position[k],.015)));
      return {pass:ok,bone,original,target,actualRotation:actual.rotation,actualPosition:actual.position,saved:Boolean(saved?.persisted),ok,marker:{bone,original,target,delta}};
     })()`,true);
     if(result?.notApplicable){fs.writeFileSync(marker,JSON.stringify({notApplicable:true},null,2),"utf8");return {pass:true,phase:restartPhase,notApplicable:true,reason:result.reason};}
     if(!result?.pass||!result?.marker) return {pass:false,phase:restartPhase,stage:"prepare-save",result};
     fs.writeFileSync(marker,JSON.stringify(result.marker,null,2),"utf8");
     return {pass:true,phase:restartPhase,marker:result.marker,detail:result};
    }
    if(!fs.existsSync(marker))return {pass:false,phase:restartPhase,stage:"marker-missing",error:"First process did not leave a rest-pose restart marker"};
    let saved;
    try{saved=JSON.parse(fs.readFileSync(marker,"utf8"))}catch(error){return {pass:false,phase:restartPhase,stage:"marker-invalid",error:error?.message||String(error)}}
    if(saved.notApplicable){try{fs.unlinkSync(marker)}catch{};return {pass:true,phase:restartPhase,notApplicable:true,reason:"The GLB has no bone positions to restore"}}
    const w=getCharacterWindow?.();
    if(!visible(w))return {pass:false,phase:restartPhase,stage:"verify-window",error:"Character window is not visible after process restart"};
    const opened=await depsShowPerformance?.();await wait(350);
    const pw=getPerformanceWindow?.()||opened;
    if(!visible(pw))return {pass:false,phase:restartPhase,stage:"verify-performance",error:"Could not open controller after process restart"};
    const result=await execJs(pw,`(async()=>{
     const api=window.saeed,marker=${JSON.stringify(saved)},near=(a,b,t)=>Math.abs((Number(a)||0)-(Number(b)||0))<t;
     const deadline=Date.now()+25000;let s=null;
     while(Date.now()<deadline){s=await api.character.characterController({action:"status"});if(s?.status?.characterLoaded&&s?.status?.actualBones?.[marker.bone])break;await new Promise(r=>setTimeout(r,250))}
     const actual=s?.status?.actualBones?.[marker.bone]||{},rest=actual.restPose||{},restRotation=rest.rotation||{},restPosition=rest.position||{};
     const matches=Boolean(actual.rotation&&actual.position&&["x","y","z"].every(k=>near(actual.rotation[k],marker.target.rotation[k],.035)&&near(actual.position[k],marker.target.position[k],.015)&&near(restRotation[k],marker.target.rotation[k],.035)&&near(restPosition[k],marker.target.position[k],.015)));
     let cleanup={ok:false};
     if(matches){const reverse={rotation:{x:marker.original.rotation.x-marker.target.rotation.x,y:marker.original.rotation.y-marker.target.rotation.y,z:marker.original.rotation.z-marker.target.rotation.z},position:{x:marker.original.position.x-marker.target.position.x,y:marker.original.position.y-marker.target.position.y,z:marker.original.position.z-marker.target.position.z}};const undone=await api.character.characterController({action:"setBoneTransform",bone:marker.bone,transform:reverse});const resaved=await api.character.characterController({action:"saveRestPose"});const reset=await api.character.characterController({action:"resetPose"});cleanup={ok:Boolean(undone?.ok&&resaved?.ok&&resaved?.persisted&&reset?.ok)}}
     return {pass:matches&&cleanup.ok,bone:marker.bone,expected:marker.target,actualRotation:actual.rotation,actualPosition:actual.position,restRotation,restPosition,matches,cleanup};
    })()`,true);
    try{fs.unlinkSync(marker)}catch{}
    return {...result,phase:restartPhase};
   },{timeoutMs:60000});
   await check("startup.character-visible",()=>visible(getCharacterWindow?.()));
   await check("startup.tray",()=>Boolean(getTray?.()));
   await check("startup.mic-off",()=>String(getVoiceHost?.()?.getCurrentMicMode?.()||"off")==="off");
   await check("startup.brain-off",()=>!Boolean(getBrainActive?.()));

   await check("performance.character-save-rest-pose",async()=>{const w=await depsShowPerformance?.();await wait(500);const pw=getPerformanceWindow?.();if(!visible(pw))return {pass:false,stage:"window",error:"Performance window could not be opened"};const w2=pw;await execJs(w2,'document.querySelector("[data-tab=character]")?.click();true',true);await wait(300);const initial=await execJs(w2,'(async()=>{try{return await window.saeed.character.characterController({action:"status"})}catch(e){return {ok:false,error:String(e?.message||e)}}})()',true);if(!initial?.status?.characterLoaded)return {pass:false,stage:"character-load",status:initial};const logical="rightUpperArm";const beforeLogical=initial.status.pose?.[logical]||{x:0,y:0,z:0};const targetLogical={x:(beforeLogical.x||0)+.24,y:(beforeLogical.y||0)-.16,z:(beforeLogical.z||0)+.11};const appliedLogical=await execJs(w2,'(async()=>window.saeed.character.characterController({action:"jointRotation",slot:"rightUpperArm",rotation:'+JSON.stringify(targetLogical)+'}))()',true);const logicalAfter=await execJs(w2,'(async()=>window.saeed.character.characterController({action:"status"}))()',true);const logicalChanged=Boolean(appliedLogical?.ok&&logicalAfter?.status?.pose?.[logical]&&Math.abs((logicalAfter.status.pose[logical].x||0)-targetLogical.x)<.04&&Math.abs((logicalAfter.status.pose[logical].y||0)-targetLogical.y)<.04&&Math.abs((logicalAfter.status.pose[logical].z||0)-targetLogical.z)<.04);await execJs(w2,'document.querySelector("[data-tab=rig]")?.click();true',true);await wait(300);await execJs(w2,'(async()=>{await window.saeed.character.characterController({action:"stopAll"});await window.saeed.character.characterController({action:"resetPose"});return true})()',true);const rig=await execJs(w2,'(async()=>window.saeed.character.characterController({action:"status"}))()',true);const bones=rig?.status?.actualBones||{};const bone=Object.keys(bones).find(name=>name&&bones[name]?.rotation&&bones[name]?.restPose);if(!bone)return {pass:false,stage:"bone-selection",logicalChanged,logicalTarget:targetLogical,logicalAfter:logicalAfter?.status?.pose?.[logical],error:"No editable actual GLB bone with rest pose was exposed",status:rig};const original=bones[bone].rotation,originalPosition=bones[bone].position||{x:0,y:0,z:0};const rotationDelta={x:.19,y:-.12,z:.08},positionDelta={x:.07,y:.03,z:-.04};const savedRestTarget={x:(original.x||0)+rotationDelta.x,y:(original.y||0)+rotationDelta.y,z:(original.z||0)+rotationDelta.z};const savedPositionTarget={x:(originalPosition.x||0)+positionDelta.x,y:(originalPosition.y||0)+positionDelta.y,z:(originalPosition.z||0)+positionDelta.z};const changedTransform={rotation:rotationDelta,position:positionDelta};const moved=await execJs(w2,'(async()=>window.saeed.character.characterController({action:"setBoneTransform",bone:'+JSON.stringify(bone)+',transform:'+JSON.stringify(changedTransform)+'}))()',true);const movedStatus=await execJs(w2,'(async()=>window.saeed.character.characterController({action:"status"}))()',true);const movedRotation=movedStatus?.status?.actualBones?.[bone]?.rotation||{},movedPosition=movedStatus?.status?.actualBones?.[bone]?.position||{};const movedOk=Boolean(moved?.ok&&Math.abs((movedRotation.x||0)-savedRestTarget.x)<.04&&Math.abs((movedRotation.y||0)-savedRestTarget.y)<.04&&Math.abs((movedRotation.z||0)-savedRestTarget.z)<.04&&Math.abs((movedPosition.x||0)-savedPositionTarget.x)<.02&&Math.abs((movedPosition.y||0)-savedPositionTarget.y)<.02&&Math.abs((movedPosition.z||0)-savedPositionTarget.z)<.02);const saved=await execJs(w2,'(async()=>window.saeed.character.characterController({action:"saveRestPose"}))()',true);await wait(300);const afterSave=await execJs(w2,'(async()=>window.saeed.character.characterController({action:"status"}))()',true);const savedBaseline=afterSave?.status?.actualBones?.[bone]?.rotation||{};const savedRestTransform=afterSave?.status?.actualBones?.[bone]?.restPose||{},savedRest=savedRestTransform.rotation||{},savedRestPosition=savedRestTransform.position||{};const saveCaptured=Boolean(saved?.ok&&saved?.persisted&&Math.abs((savedRest.x||0)-savedRestTarget.x)<.04&&Math.abs((savedRest.y||0)-savedRestTarget.y)<.04&&Math.abs((savedRest.z||0)-savedRestTarget.z)<.04&&Math.abs((savedRestPosition.x||0)-savedPositionTarget.x)<.02&&Math.abs((savedRestPosition.y||0)-savedPositionTarget.y)<.02&&Math.abs((savedRestPosition.z||0)-savedPositionTarget.z)<.02);const second={x:.27,y:.14,z:-.16},secondPosition={x:-.05,y:.06,z:.08};const secondTransform={rotation:second,position:secondPosition};const movedAgain=await execJs(w2,'(async()=>window.saeed.character.characterController({action:"setBoneTransform",bone:'+JSON.stringify(bone)+',transform:'+JSON.stringify(secondTransform)+'}))()',true);const reset=await execJs(w2,'(async()=>window.saeed.character.characterController({action:"resetPose"}))()',true);await wait(250);const restored=await execJs(w2,'(async()=>window.saeed.character.characterController({action:"status"}))()',true);const restoredRotation=restored?.status?.actualBones?.[bone]?.rotation||{},restoredPosition=restored?.status?.actualBones?.[bone]?.position||{};const restoredOk=Boolean(reset?.ok&&Math.abs((restoredRotation.x||0)-savedRestTarget.x)<.04&&Math.abs((restoredRotation.y||0)-savedRestTarget.y)<.04&&Math.abs((restoredRotation.z||0)-savedRestTarget.z)<.04&&Math.abs((restoredPosition.x||0)-savedPositionTarget.x)<.02&&Math.abs((restoredPosition.y||0)-savedPositionTarget.y)<.02&&Math.abs((restoredPosition.z||0)-savedPositionTarget.z)<.02);return {pass:Boolean(logicalChanged&&movedOk&&saveCaptured&&movedAgain?.ok&&restoredOk),stage:"complete",logical:"rightUpperArm",logicalChanged,logicalTarget:targetLogical,logicalAfter:logicalAfter?.status?.pose?.[logical],bone,original,originalPosition,savedRestTarget,savedPositionTarget,movedRotation,movedPosition,movedOk,saveCommandOk:Boolean(saved?.ok),savePersisted:Boolean(saved?.persisted),saveCaptured,savedBaseline,savedRest,savedRestPosition,second,secondPosition,movedAgain:Boolean(movedAgain?.ok),reset:Boolean(reset?.ok),restoredRotation,restoredPosition,restoredOk}});
   await check("performance.open-character-controller",async()=>{if(typeof depsShowPerformance!=="function")return false;await depsShowPerformance();const started=Date.now();let w=getPerformanceWindow?.();while(Date.now()-started<25000){w=getPerformanceWindow?.();if(visible(w)){const ready=await execJs(w,'(async()=>{try{const r=await window.saeed.character.getCharacterController();return Boolean(r?.characterLoaded)}catch{return false}})()',true);if(ready)break;}await wait(250)}if(!visible(w))return false;return await execJs(w,'Boolean(document.querySelector("#tab-character")&&document.querySelector("#characterPlayMotion")&&document.querySelector("#characterApplyPose")&&document.querySelector("#motionEditorSave")&&document.querySelector("#rigApply"))',true)});

   await check("performance.all-tabs-functional",async()=>{const w=getPerformanceWindow?.();if(!visible(w))return false;const r=await execJs(w,'(()=>{const ids=[...document.querySelectorAll("nav button[data-tab]")].map(x=>x.dataset.tab);const results=ids.map(id=>{const b=document.querySelector("nav button[data-tab=\\\""+id+"\\\"]");b?.click();const panel=document.getElementById("tab-"+id);return {id,button:Boolean(b),panel:Boolean(panel),visible:Boolean(panel&&!panel.hidden&&getComputedStyle(panel).display!=="none")}});return {pass:results.length>=9&&results.every(x=>x.button&&x.panel),tabs:results}})()',true);return r});

    await check("performance.control-real-bone",async()=>{const w=getPerformanceWindow?.();if(!visible(w))return false;return await execJs(w,'(async()=>{const api=window.saeed;const names=await api.character.characterController({action:"boneNames"});const bone=(names?.bones||[]).find(Boolean);if(!bone)return {pass:false,error:"No actual skeleton bone names exposed"};await api.character.characterController({action:"beginAuthoring"});const before=await api.character.characterController({action:"boneRotation",bone});if(!before?.rotation)return {pass:false,error:"Engine cannot read the actual bone editor rotation",bone};const target={x:(before.rotation.x||0)+.21,y:(before.rotation.y||0)-.13,z:(before.rotation.z||0)+.09};const applied=await api.character.characterController({action:"setBoneEditorRotation",bone,rotation:target});const after=await api.character.characterController({action:"boneRotation",bone});const changed=Boolean(applied?.ok&&after?.rotation&&Math.abs(after.rotation.x-target.x)<.025&&Math.abs(after.rotation.y-target.y)<.025&&Math.abs(after.rotation.z-target.z)<.025);const reset=await api.character.characterController({action:"resetBoneToRest",bone});const restored=await api.character.characterController({action:"boneRotation",bone});const restoredOk=Boolean(reset?.ok&&restored?.rotation&&Math.abs(restored.rotation.x)<.035&&Math.abs(restored.rotation.y)<.035&&Math.abs(restored.rotation.z)<.035);await api.character.characterController({action:"endAuthoring"});return {pass:changed&&restoredOk,bone,before:before.rotation,target,after:after.rotation,changed,reset,restored:restored?.rotation,restoredOk}})()',true)});

   await check("performance.procedural-motion-real-bone",async()=>{const w=getPerformanceWindow?.();if(!visible(w))return false;const r=await execJs(w,'(async()=>{const api=window.saeed;await api.character.characterController({action:"autoMap"}).catch(()=>{});const before=await api.character.getCharacterController();const slot=Object.keys(before?.autoRig||{}).find(k=>before.autoRig?.[k]);if(!slot)return {pass:false,error:"No mapped logical bone"};const id="ciGeneratedMotion";const motion={id,duration:1,layer:"special",loop:false,keyframes:[{time:0,pose:{[slot]:{x:0,y:0,z:0}}},{time:.35,pose:{[slot]:{x:.35,y:.45,z:.2}}},{time:.7,pose:{[slot]:{x:-.25,y:-.3,z:.15}}},{time:1,pose:{[slot]:{x:0,y:0,z:0}}}]};const saved=await api.character.characterController({action:"defineMotion",motion});if(!saved?.ok)return {pass:false,stage:"define",saved,slot};await api.character.characterController({action:"play",motion:id,options:{duration:1,speed:1,intensity:1,loop:false}});await new Promise(r=>setTimeout(r,300));const during=await api.character.getCharacterController();const a=before.actualBones?.[before.autoRig?.[slot]]?.rotation,b=during.actualBones?.[during.autoRig?.[slot]]?.rotation;const changed=Boolean(a&&b&&(Math.abs((b.x||0)-(a.x||0))>.01||Math.abs((b.y||0)-(a.y||0))>.01||Math.abs((b.z||0)-(a.z||0))>.01));await api.character.characterController({action:"stopAll"});await api.character.characterController({action:"deleteMotion",id});return {pass:changed,slot,changed,before:a,during:b,saved:saved?.motion?.id||id}})()',true);return r});

   await check("performance.create-edit-delete-motion",async()=>{const w=getPerformanceWindow?.();if(!visible(w))return false;const r=await execJs(w,'(async()=>{const api=window.saeed;await api.character.characterController({action:"autoMap"}).catch(()=>{});const before=await api.character.getCharacterController();const slot=Object.keys(before?.autoRig||{}).find(k=>before.autoRig?.[k]);if(!slot)return {pass:false,error:"No mapped logical bone"};const id="ciTestMotion";const motion={id,duration:1,layer:"arms",loop:false,keyframes:[{time:0,pose:{[slot]:{x:0,y:0,z:0}}},{time:.5,pose:{[slot]:{x:.6,y:.8,z:.2}}},{time:1,pose:{[slot]:{x:0,y:0,z:0}}}]};const saved=await api.character.characterController({action:"defineMotion",motion});const listed=await api.character.characterController({action:"listMotions"});const edit={...motion,keyframes:[{time:0,pose:{[slot]:{x:0,y:0,z:0}}},{time:.5,pose:{[slot]:{x:.2,y:1.0,z:.3}}},{time:1,pose:{[slot]:{x:0,y:0,z:0}}}]};const edited=await api.character.characterController({action:"defineMotion",motion:edit});const listed2=await api.character.characterController({action:"listMotions"});const deleted=await api.character.characterController({action:"deleteMotion",id});const after=await api.character.characterController({action:"listMotions"});return {pass:Boolean(saved?.ok&&listed?.motions?.some(x=>x.id===id)&&edited?.ok&&listed2?.motions?.some(x=>x.id===id)&&deleted?.ok&&!after?.motions?.some(x=>x.id===id)),saved:saved?.ok,edited:edited?.ok,deleted:deleted?.ok,slot}})()',true);return r});

   await check("performance.rig-auto-map",async()=>{const w=getPerformanceWindow?.();if(!visible(w))return false;const r=await execJs(w,'(async()=>{document.querySelector("[data-tab=rig]")?.click();await new Promise(r=>setTimeout(r,250));const result=await window.saeed.character.characterController({action:"autoMap"});const s=await window.saeed.character.getCharacterController();const mapped=Object.keys(s?.autoRig||{});return {pass:Boolean(result?.ok&&mapped.length),mapped,boneCount:s?.controllableBoneCount||s?.boneCount||0,tPose:s?.tPose}})()',true);return r});

   await check("performance.all-registered-compatible-motions",async()=>{const w=getPerformanceWindow?.();if(!visible(w))return {pass:false,error:"Performance window is not visible"};const r=await execJs(w,'(async()=>{const api=window.saeed;await api.character.characterController({action:"autoMap"}).catch(()=>{});const initial=await api.character.getCharacterController();const animationWasEnabled=initial?.animationEnabled!==false;const previousBehavior={idle:initial?.behavior?.idle!==false,autonomousMovement:initial?.behavior?.autonomousMovement!==false};await api.character.characterController({action:"setAnimationEnabled",enabled:true}).catch(()=>{});await api.character.characterController({action:"setBehavior",value:{idle:false,autonomousMovement:false}}).catch(()=>{});const before=await api.character.getCharacterController();const mapped=new Set(Object.keys(before?.autoRig||{}));const motions=Array.isArray(before?.motions)?before.motions.filter(m=>m&&m.id&&m.id!=="idle"&&(m.requiredCapabilities||[]).every(cap=>mapped.has(cap)||Boolean(before?.capabilities?.[cap]))).map(m=>m.id):[];const results=[];const deadline=Date.now()+90000;for(const id of motions){if(Date.now()>=deadline){await api.character.characterController({action:"setBehavior",value:previousBehavior}).catch(()=>{});await api.character.characterController({action:"setAnimationEnabled",enabled:animationWasEnabled}).catch(()=>{});return {pass:false,status:"TIME_LIMIT",error:"Compatible-motion validation exceeded 90 seconds",motions:motions.length,completed:results.length,results,failed:results.filter(x=>!x.active||!x.changed),animationWasEnabled}};const started=Date.now();let active=false,changed=false;try{const played=await api.character.characterController({action:"play",motion:id,options:{duration:.6,speed:1,intensity:1,loop:false}});if(!played?.ok){results.push({id,active:false,changed:false,error:"play rejected",played});continue}await new Promise(r=>setTimeout(r,120));const during=await api.character.getCharacterController();active=Boolean(during?.active?.some(x=>x.id===id));changed=[...mapped].some(slot=>{const bone=before.autoRig?.[slot];const a=before.actualBones?.[bone]?.rotation,b=during.actualBones?.[during.autoRig?.[slot]||bone]?.rotation;return Boolean(a&&b&&(Math.abs((b.x||0)-(a.x||0))>.008||Math.abs((b.y||0)-(a.y||0))>.008||Math.abs((b.z||0)-(a.z||0))>.008))});results.push({id,active,changed,elapsedMs:Date.now()-started})}catch(e){results.push({id,active,changed,error:String(e?.stack||e),elapsedMs:Date.now()-started})}finally{try{await api.character.characterController({action:"stopAll"})}catch{}await new Promise(r=>setTimeout(r,60))}}const failed=results.filter(x=>!x.active||!x.changed);await api.character.characterController({action:"setBehavior",value:previousBehavior}).catch(()=>{});await api.character.characterController({action:"setAnimationEnabled",enabled:animationWasEnabled}).catch(()=>{});return {pass:Boolean(mapped.size)&&results.length===motions.length&&failed.length===0,mapped:[...mapped],motions:motions.length,completed:results.length,results,failed,animationWasEnabled}})()',true);return r});

   await check("performance.close",async()=>{const w=getPerformanceWindow?.();if(w&&!w.isDestroyed())w.close();await wait(300);return !visible(getPerformanceWindow?.())});
   await check("chat.open",async()=>{await getChatHost().showChat();await wait(800);return visible(chatWindow())});
   await check("chat.local-time",async()=>{
    const w=chatWindow();if(!w)return false;
    const result=await execJs(w,'(async()=>{try{await window.saeed.clearHistory()}catch{};const input=document.getElementById("input"),send=document.getElementById("send"),messages=document.getElementById("messages");messages.innerHTML="";input.value="What is the local time?";send.click();const started=Date.now();while(Date.now()-started<20000){const a=[...document.querySelectorAll("#messages .assistant")].map(x=>x.textContent.trim()).filter(Boolean);if(a.length)return a[a.length-1];await new Promise(r=>setTimeout(r,250));}return ""})()',true);
    const text=String(result||"").trim();
    return {pass:Boolean(text)&&!/^حدث خطأ:|^Error:|window\.saeed\.chat is not a function/i.test(text),responseText:text};
   });

    await check("brain.intent-open-my-computer",async()=>{
     const agent=await operation("ensureBrain",()=>ensureBrain?.());if(!agent)return false;
     const events=[];const old=agent.onEvent;const oldPermissionPolicy=agent.registry?.permissionPolicy;agent.onEvent=e=>{events.push(e);old?.(e)};
     if(agent.registry)agent.registry.permissionPolicy=(category,request)=>category==="applications"?"allow":(typeof oldPermissionPolicy==="function"?oldPermissionPolicy(category,request):"ask");
     try{
       const result=await operation("agent.run",()=>agent.run("Open my computer"),{prompt:"Open my computer"});
       const route=events.find(e=>String(e?.stage||"").toUpperCase()==="BRAIN ROUTE");
       return Boolean(String(result||"").trim())&&String(route?.message||"").includes("local");
     }finally{if(agent.registry)agent.registry.permissionPolicy=oldPermissionPolicy;agent.onEvent=old}
    });
   await check("brain.intent-api-escalation",async()=>{
    const agent=await ensureBrain?.();if(!agent)return false;
    const events=[];const old=agent.onEvent;agent.onEvent=e=>{events.push(e);old?.(e)};
    try{
      const result=await operation("agent.run",()=>agent.run("Open Excel and then book me a ticket"),{prompt:"Open Excel and then book me a ticket"});
      const api=events.find(e=>String(e?.stage||"").toUpperCase()==="BRAIN API");
      return Boolean(api)&&String(result||"").trim().length>0;
    }finally{agent.onEvent=old}
   },{required:true});

   await check("chat.response-reaches-character-bubble",async()=>{const cw=chatWindow(),aw=getCharacterWindow?.();if(!cw||!visible(aw))return false;const r=await execJs(cw,'(async()=>{const input=document.getElementById("input"),send=document.getElementById("send");input.value="Say exactly: CI_RESPONSE_CHAIN_OK";send.click();const started=Date.now();while(Date.now()-started<20000){const a=[...document.querySelectorAll("#messages .assistant")].map(x=>x.textContent.trim()).filter(Boolean);if(a.some(x=>x.includes("CI_RESPONSE_CHAIN_OK")))return a.find(x=>x.includes("CI_RESPONSE_CHAIN_OK"));await new Promise(r=>setTimeout(r,250));}return ""})()',true);await wait(250);const bubble=await execJs(aw,'(()=>({visible:Boolean(document.getElementById("saeedMessageBubble")&&!document.getElementById("saeedMessageBubble").hidden),text:document.getElementById("saeedMessageText")?.textContent||""}))()',true);return {pass:Boolean(r&&bubble.visible&&bubble.text.includes("CI_RESPONSE_CHAIN_OK")),response:r,bubble}});
   await check("voice.chat-response-tts-chain",async()=>{const w=getCharacterWindow?.();if(!w)return false;const r=await execJs(w,'(async()=>{const original=window.speechSynthesis?.speak;if(!original)return {pass:false,error:"speechSynthesis.speak unavailable"};let started=false;let text="CI_TTS_CHAIN_OK";const old=window.speechSynthesis.speak.bind(window.speechSynthesis);window.speechSynthesis.speak=u=>{started=true;try{u.onstart?.()}catch{};try{u.onend?.()}catch{};return old(u)};try{window.saeedSpeakText?.(text);await new Promise(r=>setTimeout(r,500));const b=document.getElementById("saeedMessageText")?.textContent||"";return {pass:Boolean(started&&b.includes(text)),started,bubbleText:b}}finally{window.speechSynthesis.speak=original}})()',true);return r});

   await check("chat.ui-response-visible",async()=>{
    const w=chatWindow();if(!w)return false;
    return await execJs(w,'Boolean([...document.querySelectorAll("#messages .assistant")].some(x=>x.textContent.trim()))',true);
   });

   await check("voice.renderer-capabilities",async()=>{
    const w=getCharacterWindow?.();if(!w)return false;
    const r=await execJs(w,'(()=>({speechSynthesis:typeof window.speechSynthesis!=="undefined",speak:typeof window.speechSynthesis?.speak==="function",mediaDevices:Boolean(navigator.mediaDevices&&typeof navigator.mediaDevices.getUserMedia==="function")}))()',true);
    return Boolean(r.speechSynthesis&&r.speak&&r.mediaDevices);
   });
   await check("voice.output-device-capability",async()=>{
    const w=getCharacterWindow?.();if(!w)return false;
    const r=await execJs(w,'(()=>new Promise(async resolve=>{try{if(!navigator.mediaDevices?.enumerateDevices)return resolve({available:false,reason:"enumerateDevices unavailable"});const devices=await navigator.mediaDevices.enumerateDevices();const outputs=devices.filter(d=>d.kind==="audiooutput").map(d=>({kind:d.kind,label:d.label||"",deviceId:Boolean(d.deviceId)}));resolve({available:true,outputDeviceCount:outputs.length,outputs,defaultOutputPresent:outputs.some(d=>d.deviceId)});}catch(e){resolve({available:false,reason:String(e?.name||e?.message||e)})}}))()',true);
    return {pass:true,hardwareOutputAvailable:Boolean(r?.available&&r?.outputDeviceCount>0),environmentLimited:!(r?.available&&r?.outputDeviceCount>0),detail:r};
   },{required:false});
   await check("voice.tts-local-output",async()=>{
    const w=getCharacterWindow?.();if(!w)return false;
    return await execJs(w,`(()=>new Promise(async resolve=>{try{
      const synth=window.speechSynthesis;
      if(!synth)return resolve({pass:false,audioStarted:false,error:"speechSynthesis unavailable"});
      const sleep=ms=>new Promise(r=>setTimeout(r,ms));
      const devices=await navigator.mediaDevices?.enumerateDevices?.().catch(()=>[]);
      const outputs=(devices||[]).filter(d=>d.kind==="audiooutput");
      if(!outputs.length)return resolve({pass:true,audioStarted:false,speaking:false,ended:false,voiceCount:synth.getVoices().length,environmentLimited:true,reason:"no audio output device available"});
      const waitForVoices=async()=>{let v=synth.getVoices();if(v.length)return v;await new Promise(r=>{let done=false;const f=()=>{if(done)return;done=true;synth.removeEventListener("voiceschanged",f);r()};synth.addEventListener("voiceschanged",f);setTimeout(f,1000)});return synth.getVoices()};
      let voices=await waitForVoices();
      if(!voices.length)return resolve({pass:true,audioStarted:false,speaking:false,ended:false,voiceCount:0,environmentLimited:true,reason:"no voices available"});
      let attempt=0,started=false,ended=false,done=false,lastError="";
      const finish=v=>{if(done)return;done=true;try{synth.cancel()}catch{};resolve(v)};
      const speakAttempt=async()=>{
        attempt++;
        try{synth.cancel()}catch{}
        await sleep(250);
        voices=await waitForVoices();
        const u=new SpeechSynthesisUtterance("Saeed voice smoke test");u.volume=1;
        u.onstart=()=>{started=true};
        u.onend=()=>{ended=true;finish({pass:true,audioStarted:true,speaking:false,ended:true,voiceCount:voices.length,attempt})};
        u.onerror=e=>{lastError=String(e?.error||"speech error");if(lastError==="interrupted"&&attempt<2&&!started){setTimeout(()=>speakAttempt(),300);return}finish({pass:false,audioStarted:started,speaking:Boolean(synth.speaking),ended,voiceCount:voices.length,error:lastError,attempt})};
        try{synth.speak(u)}catch(e){lastError=String(e);if(attempt<2&&!started){setTimeout(()=>speakAttempt(),300);return}finish({pass:false,audioStarted:started,error:lastError,voiceCount:voices.length,attempt})}
      };
      await speakAttempt();
      setTimeout(()=>{if(done)return;finish({pass:started,audioStarted:started,speaking:Boolean(synth.speaking),ended,voiceCount:voices.length,error:lastError||undefined,attempt,reason:started?"speech started":"speech start event not observed"})},12000);
    }catch(e){resolve({pass:false,audioStarted:false,error:String(e)})}}))()`,true);
   },{required:true,timeoutMs:16000});
   await check("voice.mic-device-capability",async()=>{
    const w=getCharacterWindow?.();if(!w)return false;
    const r=await execJs(w,'(()=>new Promise(resolve=>{if(!navigator.mediaDevices?.getUserMedia)return resolve({available:false,reason:"mediaDevices unavailable"});let done=false;const finish=v=>{if(done)return;done=true;resolve(v)};navigator.mediaDevices.getUserMedia({audio:true}).then(s=>{s.getTracks().forEach(t=>t.stop());finish({available:true})}).catch(e=>finish({available:false,reason:String(e?.name||e?.message||"permission/device error")}));setTimeout(()=>finish({available:false,reason:"timeout"}),5000)}))()',true);
    return {pass:true,hardwareMicrophoneAvailable:Boolean(r?.available),detail:r};
   },{required:false});

   await check("mute.text-still-visible",async()=>{
    const w=getCharacterWindow?.();if(!w)return false;
    await setVoiceMuted(true);
    w.webContents.send("agent:event",{type:"answer",text:"CI mute text test"});
    await wait(200);
    const visibleText=await execJs(w,'(()=>{const b=document.getElementById("saeedMessageBubble"),t=document.getElementById("saeedMessageText");return {visible:Boolean(b&&!b.hidden),text:t?.textContent||""}})()',true);
    await setVoiceMuted(false);
    return Boolean(visibleText.visible&&visibleText.text.includes("CI mute text test"));
   });

    await check("chat.close-keeps-brain-when-mic-on",async()=>{
     const agent=await ensureBrain?.();if(!agent)return {pass:false,error:"Brain could not be initialized"};
     const originalSettings=agent.settings;agent.settings={...originalSettings,permissions:{...(originalSettings.permissions||{}),microphone:"allow"}};
     try{
      const w=getCharacterWindow?.();let hardwareAvailable=false;if(w){try{hardwareAvailable=Boolean(await execJs(w,"Boolean(navigator.mediaDevices?.getUserMedia)",true));}catch{}}
      if(hardwareAvailable){try{hardwareAvailable=Boolean(await execJs(w,"navigator.mediaDevices.getUserMedia({audio:true}).then(s=>{s.getTracks().forEach(t=>t.stop());return true}).catch(()=>false)",true));}catch{hardwareAvailable=false}}
      await setMicMode("on");await wait(1200);
      const before=Boolean(getBrainActive?.());await getChatHost().closeChat();await wait(1200);
      const after=Boolean(getBrainActive?.()),mode=String(getVoiceHost?.()?.getCurrentMicMode?.()||"off");
      if(!hardwareAvailable&&mode==="off")return {pass:!chatWindow(),environmentLimited:true,chatClosed:!chatWindow(),brainBefore:before,brainAfter:after,micMode:mode,reason:"microphone unavailable; lifecycle check skipped"};
      return {pass:!chatWindow()&&after,chatClosed:!chatWindow(),brainBefore:before,brainAfter:after,micMode:mode,hardwareAvailable};
     }finally{agent.settings=originalSettings}
    });
   await check("mic-off-releases-brain-after-chat-closed",async()=>{
    await setMicMode("off");await wait(1500);
    const active=Boolean(getBrainActive?.());
    return {pass:!active,chatClosed:!chatWindow(),micMode:String(getVoiceHost?.()?.getCurrentMicMode?.()||"off"),brainActive:active};
   });

   await check("windows.settings",async()=>{if(typeof depsShowSettings!=="function")return false;await depsShowSettings();await wait(500);const w=getSettingsWindow?.();if(!visible(w))return {pass:false,error:"Settings window did not open"};const ok=await execJs(w,'Boolean(document.querySelector("h1")&&document.querySelector(".sidebar")&&document.querySelector("[data-tab=general]"))',true);w.close();return {pass:ok}});
   await check("windows.addons",async()=>{if(typeof depsShowAddons!=="function")return false;await depsShowAddons();await wait(500);const w=getAddonsWindow?.();if(!visible(w))return {pass:false,error:"Add-ons window did not open"};const ok=await execJs(w,'Boolean(document.querySelector("#refresh")&&document.querySelector("#search")&&document.querySelector("#list"))',true);w.close();return {pass:ok}});
   await check("windows.learning",async()=>{if(typeof depsShowLearning!=="function")return false;await depsShowLearning();await wait(500);const w=getLearningWindow?.();if(!visible(w))return {pass:false,error:"Learning window did not open"};const ok=await execJs(w,'Boolean(document.querySelector("#refresh")&&document.querySelector("#import")&&document.querySelector("#export")&&document.querySelector("#record")&&document.querySelector("#save")&&document.querySelector("#list"))',true);w.close();return {pass:ok}});
   await check("windows.status",async()=>{if(typeof depsShowStatus!=="function")return false;await depsShowStatus();await wait(500);const w=getStatusWindow?.();if(!visible(w))return {pass:false,error:"Status window did not open"};const ok=await execJs(w,'Boolean(document.body&&document.body.innerText&&document.body.innerText.trim().length>20)',true);w.close();return {pass:ok}});
   await check("character.normalize-humanoid-rest-pose-window",async()=>{if(typeof depsShowNormalizeHumanoidRestPose!=="function")return{pass:false,error:"Normalize Humanoid Rest Pose opener is not registered"};await depsShowNormalizeHumanoidRestPose();const w=getNormalizeHumanoidRestPoseWindow?.();if(!visible(w))return{pass:false,error:"Normalize Humanoid Rest Pose window did not open"};const r=await execJs(w,'(async()=>{const q=s=>document.querySelector(s),checks={header:Boolean(q("header")),title:document.title==="Set Normalize Humanoid Rest Pose",heading:Boolean(q("h1")&&q("h1").textContent.trim()),characterState:Boolean(q("#characterState")),close:Boolean(q("#close")),search:Boolean(q("#search")),boneSelect:Boolean(q("#bone")),refresh:Boolean(q("#refresh")),boneTitle:Boolean(q("#boneTitle")),boneParent:Boolean(q("#boneParent")),boneCount:Boolean(q("#boneCount")),rotX:Boolean(q("#rotX")),rotY:Boolean(q("#rotY")),rotZ:Boolean(q("#rotZ")),reset:Boolean(q("#resetBone")),apply:Boolean(q("#applyBone")),state:Boolean(q("#state")),save:Boolean(q("#save"))};q("#refresh")?.click();const deadline=Date.now()+15000;let actual={};while(Date.now()<deadline){await new Promise(r=>setTimeout(r,250));const s=await window.saeed.character.characterController({action:"status"}).catch(()=>null);actual=s?.status?.actualBones||s?.actualBones||{};if(Object.keys(actual).length>0&&(q("#bone")?.options?.length||0)>0)break}const options=q("#bone")?.options?.length||0;const names=Object.keys(actual);if(!names.length||options<1)return{pass:false,stage:"bone-load",error:"No actual skeleton bones are controllable",options,boneCount:names.length,checks};const bone=names[0];q("#bone").value=bone;q("#bone").dispatchEvent(new Event("change",{bubbles:true}));await new Promise(r=>setTimeout(r,50));const original=actual[bone]?.rotation||{};const target={x:(original.x||0)+.21,y:(original.y||0)-.13,z:(original.z||0)+.09};q("#rotX").value=String(target.x*180/Math.PI);q("#rotY").value=String(target.y*180/Math.PI);q("#rotZ").value=String(target.z*180/Math.PI);q("#applyBone")?.click();await new Promise(r=>setTimeout(r,250));const a=await window.saeed.character.characterController({action:"status"}).catch(()=>null),afterApply=(a?.status?.actualBones||{})[bone]?.rotation||{};const applied=Math.abs((afterApply.x||0)-target.x)<.025&&Math.abs((afterApply.y||0)-target.y)<.025&&Math.abs((afterApply.z||0)-target.z)<.025;q("#save")?.click();await new Promise(r=>setTimeout(r,300));const savedStatus=await window.saeed.character.characterController({action:"status"}).catch(()=>null),afterSave=(savedStatus?.status?.actualBones||{})[bone]?.rotation||{};const saved=Math.abs((afterSave.x||0)-target.x)<.025&&Math.abs((afterSave.y||0)-target.y)<.025&&Math.abs((afterSave.z||0)-target.z)<.025;const second={x:target.x+.17,y:target.y-.11,z:target.z+.08};q("#rotX").value=String(second.x*180/Math.PI);q("#rotY").value=String(second.y*180/Math.PI);q("#rotZ").value=String(second.z*180/Math.PI);q("#applyBone")?.click();await new Promise(r=>setTimeout(r,250));const c2=await window.saeed.character.characterController({action:"status"}).catch(()=>null),afterSecond=(c2?.status?.actualBones||{})[bone]?.rotation||{};const secondApplied=Math.abs((afterSecond.x||0)-second.x)<.025&&Math.abs((afterSecond.y||0)-second.y)<.025&&Math.abs((afterSecond.z||0)-second.z)<.025;q("#resetBone")?.click();await new Promise(r=>setTimeout(r,250));const b=await window.saeed.character.characterController({action:"status"}).catch(()=>null),afterReset=(b?.status?.actualBones||{})[bone]?.rotation||{};const resetToSaved=Math.abs((afterReset.x||0)-target.x)<.025&&Math.abs((afterReset.y||0)-target.y)<.025&&Math.abs((afterReset.z||0)-target.z)<.025;return{pass:Boolean(Object.values(checks).every(Boolean)&&!q("#applyBone")?.disabled&&!q("#resetBone")?.disabled&&applied&&resetToSaved),checks,before:{boneCount:names.length,options,bone,rotation:original},apply:{target,after:afterApply,applied},reset:{after:afterReset,resetToSaved}}})()',true);await execJs(w,'(()=>{try{document.getElementById("close")?.click()}catch{};return true})()',true);await wait(500);const closed=!visible(getNormalizeHumanoidRestPoseWindow?.());return{pass:Boolean(r?.pass&&closed),detail:r,closed}});
   await check("character.studio-open-and-controls",async()=>{if(typeof depsShowRestPoseEditor!=="function")return {pass:false,error:"Character Studio opener is not registered"};await depsShowRestPoseEditor();const w=getRestPoseEditorWindow?.();if(!visible(w))return {pass:false,error:"Character Studio did not open"};const started=Date.now();let status=null;while(Date.now()-started<15000){try{status=await execJs(w,"window.saeedCharacterRuntime?.controller?.status?.()",true)}catch{}if(status?.characterLoaded&&Object.keys(status?.autoRig||{}).length)break;await wait(250)}const ui=await execJs(w,'(()=>({title:document.title,close:Boolean(document.querySelector("#close")),body:Boolean(document.body&&document.body.innerText.trim().length>20),boneOptions:document.querySelector("#boneList")?.options?.length||0,charInfo:document.querySelector("#charInfo")?.textContent||""}))()',true);return {pass:Boolean(ui.title&&ui.close&&ui.body&&ui.boneOptions>0),characterLoaded:Boolean(status?.characterLoaded),mapped:Object.keys(status?.autoRig||{}).length,ui}}); 
   await check("startup.addons-window-opens",async()=>{
    const menu=getTray?.()?.__saeedContextMenu;
    const item=menu?.items?.find(x=>x.label==="Add-ons / Plug-ins");
    if(typeof item?.click!=="function")return {pass:false,error:"Add-ons tray menu item is missing",labels:menu?.items?.map(x=>x.label)||[]};
    await Promise.resolve(item.click());
    for(let attempt=0;attempt<160&&!visible(getAddonsWindow?.());attempt++)await wait(100);
    const w=getAddonsWindow?.();
    if(!visible(w))return {pass:false,error:"Add-ons window is not visible after tray action"};
    const result=await execJs(w,'({pass:document.title.includes("Add-ons")&&!!document.querySelector("#list")&&!!document.querySelector("#refresh"),title:document.title,hasList:!!document.querySelector("#list"),hasRefresh:!!document.querySelector("#refresh")})',true);
    try{w.close()}catch{}
    return result;
   });
   await check("startup.learning-window-opens",async()=>{
    const menu=getTray?.()?.__saeedContextMenu;
    const item=menu?.items?.find(x=>x.label==="Learning / Teach Mode");
    if(typeof item?.click!=="function")return {pass:false,error:"Learning tray menu item is missing",labels:menu?.items?.map(x=>x.label)||[]};
    await Promise.resolve(item.click());
    for(let attempt=0;attempt<160&&!visible(getLearningWindow?.());attempt++)await wait(100);
    const w=getLearningWindow?.();
    if(!visible(w))return {pass:false,error:"Learning window is not visible after tray action"};
    const result=await execJs(w,'({pass:document.title.includes("Learning")&&!!document.querySelector("#list")&&!!document.querySelector("#save"),title:document.title,hasList:!!document.querySelector("#list"),hasSave:!!document.querySelector("#save")})',true);
    try{w.close()}catch{}
    return result;
   });

   await check("startup.microphone-transcript-label-toggle-and-render",async()=>{
    const w=getCharacterWindow?.();
    if(!visible(w))return {pass:false,error:"Character window is not visible"};
    const enabled=await execJs(w,'window.saeed.system.setTranscriptLabelEnabled(true)',true);
    await wait(150);
    const rendered=await execJs(w,'(()=>{window.saeedShowTranscript?.("CI transcript verification: hello Saeed");const el=document.getElementById("saeedTranscriptLabel");return {visible:Boolean(el&&!el.hidden),text:el?.textContent||"",enabled:!el?.hidden}})()',true);
    const disabled=await execJs(w,'window.saeed.system.setTranscriptLabelEnabled(false)',true);
    await wait(100);
    const hidden=await execJs(w,'(()=>({hidden:document.getElementById("saeedTranscriptLabel")?.hidden===true}))()',true);
    return {pass:Boolean(enabled?.ok&&rendered?.visible&&rendered?.text==="CI transcript verification: hello Saeed"&&disabled?.ok&&hidden?.hidden),enabled,rendered,disabled,hidden};
   });

   await check("character.studio-editor-world-axis-rotation",async()=>{const w=getRestPoseEditorWindow?.();if(!visible(w))return {pass:false,error:"Character Studio is not visible"};return await execJs(w,'(async()=>{const api=window.saeed.character;const listed=await api.characterController({action:"boneNames"});const names=listed?.bones||[];const bone=names.find(n=>/rightupperarm|upperarmr|leftupperarm|upperarml/i.test(n))||names[0];if(!bone)return {pass:false,error:"No real skeleton bone was exposed",listed};const target={x:.12,y:-.09,z:.07};const applied=await api.characterController({action:"setBoneEditorRotation",bone,rotation:target});const result=await api.characterController({action:"boneRotation",bone});const actual=result?.rotation||{};const within=(a,b)=>Number.isFinite(Number(a))&&Math.abs(Number(a)-b)<.04;const matched=within(actual.x,target.x)&&within(actual.y,target.y)&&within(actual.z,target.z);const reset=await api.characterController({action:"resetBoneToRest",bone});return {pass:Boolean(applied?.ok&&matched&&reset?.ok),bone,target,actual,applied:applied?.ok===true,matched,reset:reset?.ok===true}})()',true)});

   await check("character.studio-nested-axis-stability",async()=>{const w=getRestPoseEditorWindow?.();if(!visible(w))return {pass:false,error:"Character Studio is not visible"};return await execJs(w,'(async()=>{const api=window.saeed.character;const status=await api.characterController({action:"status"});const map=status?.status?.autoRig||status?.autoRig||{};const listed=await api.characterController({action:"boneNames"});const names=listed?.bones||[];const parent=map.rightUpperArm||names.find(n=>/rightupperarm|upperarmr|leftupperarm|upperarml/i.test(n));const child=map.rightForeArm||names.find(n=>/rightforearm|lowerarmr|leftforearm|lowerarml/i.test(n));if(!parent||!child||parent===child)return {pass:false,error:"Nested arm bones were not found",parent,child,mapped:Object.keys(map)};const a={x:.18,y:.11,z:-.08},b={x:-.12,y:.09,z:.06};const parentSet=await api.characterController({action:"setBoneEditorRotation",bone:parent,rotation:a});const childSet=await api.characterController({action:"setBoneEditorRotation",bone:child,rotation:b});const parentRead=await api.characterController({action:"boneRotation",bone:parent});const childRead=await api.characterController({action:"boneRotation",bone:child});const close=(v,t)=>Number.isFinite(Number(v))&&Math.abs(Number(v)-t)<.05;const parentOk=close(parentRead?.rotation?.x,a.x)&&close(parentRead?.rotation?.y,a.y)&&close(parentRead?.rotation?.z,a.z);const childOk=close(childRead?.rotation?.x,b.x)&&close(childRead?.rotation?.y,b.y)&&close(childRead?.rotation?.z,b.z);const childReset=await api.characterController({action:"resetBoneToRest",bone:child});const parentReset=await api.characterController({action:"resetBoneToRest",bone:parent});return {pass:Boolean(parentSet?.ok&&childSet?.ok&&parentOk&&childOk&&childReset?.ok&&parentReset?.ok),parent,child,parentOk,childOk,parentRead:parentRead?.rotation,childRead:childRead?.rotation,restored:Boolean(childReset?.ok&&parentReset?.ok)}})()',true)});

   await check("character.studio-rest-pose-save-reset",async()=>{const w=getRestPoseEditorWindow?.();if(!visible(w))return {pass:false,error:"Character Studio is not open"};const r=await execJs(w,'(async()=>{const api=window.saeed.character;await api.characterController({action:"autoMap"}).catch(()=>{});const first=await api.characterController({action:"status"});const map=first?.status?.autoRig||{};const slot=Object.keys(map).find(k=>map[k]);if(!slot)return {pass:false,error:"No mapped logical bone"};const bone=map[slot];const original=first.status.actualBones?.[bone]?.rotation;if(!original)return {pass:false,error:"No actual bone rotation for "+bone};const changed={x:(original.x||0)+0.21,y:(original.y||0)-0.13,z:(original.z||0)+0.09};const applied=await api.characterController({action:"setBoneRotation",bone,rotation:changed});const saved=await api.characterController({action:"saveRestPose"});const temporary={x:changed.x+0.31,y:changed.y+0.17,z:changed.z-0.19};await api.characterController({action:"setBoneRotation",bone,rotation:temporary});await api.characterController({action:"resetPose"});const restored=(await api.characterController({action:"status"}))?.status?.actualBones?.[bone]?.rotation||{};const newRest=Math.abs((restored.x||0)-changed.x)<.035&&Math.abs((restored.y||0)-changed.y)<.035&&Math.abs((restored.z||0)-changed.z)<.035;await api.characterController({action:"setBoneRotation",bone,rotation:original});await api.characterController({action:"saveRestPose"});await api.characterController({action:"resetPose"});return {pass:Boolean(applied?.ok&&saved?.ok&&newRest),slot,bone,original,changed,temporary,restored,newRest}})()',true);return r});
   await check("character.studio-bone-rotation",async()=>{const w=getRestPoseEditorWindow?.();if(!visible(w))return {pass:false,error:"Character Studio is not open"};const r=await execJs(w,'(async()=>{const api=window.saeed.character;const s=await api.characterController({action:"status"});const bones=s?.status?.actualBones||{};const name=Object.keys(bones).find(k=>bones[k]?.restPose);if(!name)return {pass:false,error:"No controllable bone with rest pose"};const before=bones[name]?.rotation||{};const target={x:(before.x||0)+0.15,y:before.y||0,z:before.z||0};const applied=await api.characterController({action:"setBoneRotation",bone:name,rotation:target});const after=(await api.characterController({action:"status"}))?.status?.actualBones?.[name]?.rotation||{};const changed=Math.abs((after.x||0)-target.x)<.02;await api.characterController({action:"resetPose"});return {pass:Boolean(applied?.ok&&changed),bone:name,before,after,target}})()',true);return r});
   await check("character.studio-animation-any-bone-edit-play",async()=>{const w=getRestPoseEditorWindow?.();if(!visible(w))return {pass:false,error:"Character Studio is not open"};const r=await execJs(w,'(async()=>{const api=window.saeed.character;await api.characterController({action:"autoMap"}).catch(()=>{});await api.characterController({action:"stopAll"}).catch(()=>{});await api.characterController({action:"beginAuthoring"}).catch(()=>{});const first=await api.characterController({action:"status"});const map=first?.status?.autoRig||{};const slots=Object.entries(map).filter(([,bone])=>bone&&first.status.actualBones?.[bone]?.rotation);if(!slots.length)return {pass:false,error:"No mapped controllable animation bones"};const id="ciStudioAllBonesMotion";const base={};const edited={};for(const [slot,bone] of slots){base[slot]={x:0,y:0,z:0};edited[slot]={x:.38,y:.22,z:-.17}}const def={id,duration:1,layer:"arms",loop:false,keyframes:[{time:0,pose:base},{time:.5,pose:edited},{time:1,pose:base}]};const made=await api.characterController({action:"defineMotion",motion:def});if(!made?.ok)return {pass:false,stage:"define",made,slots:slots.map(x=>x[0])};const listed=await api.characterController({action:"listMotions"});const loaded=listed?.motions?.find(x=>x.id===id);if(!loaded)return {pass:false,stage:"list",slots:slots.map(x=>x[0])};const played=await api.characterController({action:"play",motion:id,options:{speed:1,duration:1,loop:false}});await new Promise(r=>setTimeout(r,430));const during=await api.characterController({action:"status"});const active=Boolean(during?.status?.active?.some(x=>x.id===id));const changed=[];const failed=[];for(const [slot,bone] of slots){const a=first.status.actualBones?.[bone]?.rotation||{};const b=during.status.actualBones?.[bone]?.rotation||{};const ok=Math.abs((b.x||0)-(a.x||0))>.02||Math.abs((b.y||0)-(a.y||0))>.02||Math.abs((b.z||0)-(a.z||0))>.02;(ok?changed:failed).push({slot,bone,before:a,during:b})}const edit2={id,duration:1,layer:"arms",loop:false,keyframes:[{time:0,pose:base},{time:.5,pose:Object.fromEntries(slots.map(([slot])=>[slot,{x:-.29,y:.31,z:.14}]))},{time:1,pose:base}]};const editedResult=await api.characterController({action:"defineMotion",motion:edit2});await api.characterController({action:"stopAll"});await api.characterController({action:"play",motion:id,options:{speed:1,duration:1,loop:false}});await new Promise(r=>setTimeout(r,430));const afterEdit=await api.characterController({action:"status"});const editChanged=[];const editFailed=[];for(const [slot,bone] of slots){const a=during.status.actualBones?.[bone]?.rotation||{};const b=afterEdit.status.actualBones?.[bone]?.rotation||{};const ok=Math.abs((b.x||0)-(a.x||0))>.02||Math.abs((b.y||0)-(a.y||0))>.02||Math.abs((b.z||0)-(a.z||0))>.02;(ok?editChanged:editFailed).push({slot,bone,beforeEdit:a,afterEdit:b})}await api.characterController({action:"stopAll"});await api.characterController({action:"deleteMotion",id});await api.characterController({action:"endAuthoring"}).catch(()=>{});return {pass:Boolean(made?.ok&&played?.ok&&active&&changed.length===slots.length&&editedResult?.ok&&editChanged.length===slots.length),slotCount:slots.length,slots:slots.map(x=>x[0]),changedCount:changed.length,failed,edited:editedResult?.ok,editChangedCount:editChanged.length,editFailed}})()',true);return r});

   await check("character.studio-every-button-and-live-animation",async()=>{const w=getRestPoseEditorWindow?.();if(!visible(w))return {pass:false,error:"Character Studio is not open"};const r=await execJs(w,'(async()=>{const api=window.saeed.character;await api.characterController({action:"autoMap"}).catch(()=>{});const first=await api.characterController({action:"status"});const map=first?.status?.autoRig||{};const entries=Object.entries(map).filter(([,bone])=>bone&&first.status.actualBones?.[bone]?.rotation);if(!entries.length)return {pass:false,stage:"bone-selection",error:"No mapped controllable bone"};const [slot,bone]=entries[0];const before=first.status.actualBones[bone].rotation;const target={x:before.x+.18,y:before.y+.11,z:before.z-.09};const applied=await api.characterController({action:"setBoneRotation",bone,rotation:target});const changedStatus=await api.characterController({action:"status"});const after=changedStatus?.status?.actualBones?.[bone]?.rotation||{};const changed=Math.abs(after.x-target.x)<.03&&Math.abs(after.y-target.y)<.03&&Math.abs(after.z-target.z)<.03;const rest=await api.characterController({action:"saveRestPose"});await api.characterController({action:"resetPose"});const id="ciStudioButtonMotion";const made=await api.characterController({action:"defineMotion",motion:{id,duration:1,layer:"arms",loop:false,keyframes:[{time:0,pose:{[slot]:{x:0,y:0,z:0}}},{time:.5,pose:{[slot]:{x:.3,y:.2,z:-.15}}},{time:1,pose:{[slot]:{x:0,y:0,z:0}}}]}});const played=await api.characterController({action:"play",motion:id,options:{duration:1,speed:1,loop:false}});await new Promise(r=>setTimeout(r,350));const during=await api.characterController({action:"status"});const active=Boolean(during?.status?.active?.some(x=>x.id===id));await api.characterController({action:"stopAll"});await api.characterController({action:"deleteMotion",id});return {pass:Boolean(applied?.ok&&changed&&rest?.ok&&made?.ok&&played?.ok&&active),slot,bone,rotation:{before,target,after,changed},restSaved:Boolean(rest?.ok),motion:{made:Boolean(made?.ok),played:Boolean(played?.ok),active,deleted:true}}})()',true);return r});
   await check("character.studio-close-button",async()=>{const w=getRestPoseEditorWindow?.();if(!visible(w))return {pass:false,error:"Character Studio is not visible before close"};await execJs(w,'document.getElementById("close")?.click();true',true);await wait(1500);const visibleAfter=visible(getRestPoseEditorWindow?.());return {pass:!visibleAfter,visible:visibleAfter}});

   await check("glb.replace-character-file",async()=>{const w=getCharacterWindow?.();if(!visible(w)||typeof characterHost?.replaceCharacterForCi!=="function")return {pass:false,error:"CI GLB replacement API unavailable"};const source=path.join(app.getAppPath(),"assets","Saeed_AI-3D.glb");const alt=path.join(app.getPath("temp"),"Saeed-CI-Replacement.glb");try{fs.copyFileSync(source,alt);const result=await characterHost.replaceCharacterForCi(alt);await wait(1200);const after=await execJs(w,'(()=>({bootstrap:window.saeed3DBootstrap,engine:window.saeedCharacterRuntime?.engine?.get3DStatus?.()}))()',true);const pose=await execJs(w,"window.saeedCharacterRuntime?.controller?.status?.()",true).catch(()=>null);return {pass:Boolean(result?.ok&&!after.bootstrap?.error&&after.engine?.components?.sceneContent?.state==="rendered"&&pose?.characterLoaded),result,after,pose}}finally{try{fs.unlinkSync(alt)}catch{}}});
   await check("glbtest.authoritative-asset-and-visible-character",async()=>{const w=getCharacterWindow?.();if(!visible(w))return {pass:false,stage:"window",error:"Character window is not visible"};const source=path.join(app.getAppPath(),"assets","Saeed_AI-3D.glb");const fileExists=fs.existsSync(source);const fileSize=fileExists?fs.statSync(source).size:0;if(!fileExists||fileSize<=20)return {pass:false,stage:"asset-missing",source,fileExists,fileSize};const deadline=Date.now()+18000;let runtime=null,controller=null;while(Date.now()<deadline){runtime=await execJs(w,'(()=>{const e=window.saeedCharacterRuntime?.engine?.get3DStatus?.();const scene=e?.components?.sceneContent||{};const trace=window.saeedCharacterRuntime?.glbTrace||[];const objects=[];window.saeedCharacterRuntime?.engine?.getScene?.()?.traverse?.(o=>{if(o?.isMesh||o?.isSkinnedMesh)objects.push({name:o.name||"",type:o.type,visible:o.visible})});return {bootstrap:window.saeed3DBootstrap,engine:e,scene,meshCount:objects.length,meshes:objects.slice(0,20),trace:trace.slice(-30)}})()',true).catch(e=>({error:String(e?.stack||e)}));controller=await execJs(w,"window.saeedCharacterRuntime?.controller?.status?.()",true).catch(e=>({error:String(e?.stack||e)}));if(!runtime?.bootstrap?.error&&runtime?.scene?.state==="rendered"&&Number(runtime?.meshCount)>0&&controller?.characterLoaded&&Object.keys(controller?.autoRig||{}).length>0&&Number(controller?.skeletonCount||0)>0)break;await wait(250)}const trace=runtime?.trace||[];const failure=trace.find(x=>["load-error","renderer-error","renderer-rejection"].includes(x.stage));const stage=!runtime?.bootstrap&&!runtime?.scene?"bootstrap-unavailable":runtime?.bootstrap?.error?"bootstrap-error":runtime?.scene?.state!=="rendered"?"scene-not-rendered":Number(runtime?.meshCount)<=0?"no-meshes":!controller?.characterLoaded?"controller-not-loaded":"complete";return {pass:Boolean(runtime&&!runtime?.bootstrap?.error&&runtime?.scene?.state==="rendered"&&Number(runtime?.meshCount)>0&&controller?.characterLoaded&&Object.keys(controller?.autoRig||{}).length>0&&Number(controller?.skeletonCount||0)>0),stage,source,fileExists,fileSize,runtime,controller,failure}});
   await check("glbtest.full-load-pipeline",async()=>{const w=getCharacterWindow?.();if(!visible(w))return {pass:false,error:"Character window is unavailable"};const traceBefore=await execJs(w,"window.saeedCharacterRuntime?.glbTrace?.slice?.()||[]",true);const baseline=new Set(traceBefore.filter(x=>x.stage==="generation-accepted").map(x=>String(x.generation)));const source=path.join(app.getAppPath(),"assets","Saeed_AI-3D.glb");if(!fs.existsSync(source))return {pass:false,error:"Bundled GLB is missing",source};const alt=path.join(app.getPath("temp"),"Saeed-GLB-Test.glb");try{fs.copyFileSync(source,alt);const result=await characterHost.replaceCharacterForCi(alt);const deadline=Date.now()+18000;let final=null;let generation=null;while(Date.now()<deadline){final=await execJs(w,'(()=>{const t=window.saeedCharacterRuntime?.glbTrace||[];const e=window.saeedCharacterRuntime?.engine?.get3DStatus?.();return {trace:t,engine:e,bootstrap:window.saeed3DBootstrap}})()',true);const fresh=final?.trace?.filter(x=>x.stage==="generation-accepted"&&!baseline.has(String(x.generation)))||[];if(fresh.length)generation=String(fresh[fresh.length-1].generation);const current=(final?.trace||[]).filter(x=>generation&&String(x.generation)===generation);if(current.some(x=>x.stage==="display-success")||current.some(x=>x.stage==="load-error"))break;await wait(250)}const current=(final?.trace||[]).filter(x=>generation&&String(x.generation)===generation);const stages=current.map(x=>x.stage);const has=s=>stages.includes(s);const failure=current.find(x=>x.stage==="load-error"||x.stage==="renderer-error"||x.stage==="renderer-rejection");const required=["character-selected-received","load-start","bytes-ready","parse-start","parse-success","generation-accepted","display-start","display-success"];const missing=required.filter(s=>!has(s));return {pass:Boolean(result?.ok&&generation&&missing.length===0&&final?.engine?.components?.sceneContent?.state==="rendered"),source,size:fs.statSync(source).size,result,generation,traceBefore,trace:current,allTrace:final?.trace||[],stages,missing,failure,engine:final?.engine,bootstrap:final?.bootstrap}}finally{try{fs.unlinkSync(alt)}catch{}}},{timeoutMs:30000});
   await check("glbtest.generation-and-repeat-load",async()=>{const w=getCharacterWindow?.();if(!visible(w))return {pass:false,error:"Character window is unavailable"};const source=path.join(app.getAppPath(),"assets","Saeed_AI-3D.glb"),alt=path.join(app.getPath("temp"),"Saeed-GLB-Test-Repeat.glb");try{fs.copyFileSync(source,alt);const before=await execJs(w,"window.saeedCharacterRuntime?.glbTrace?.slice?.()||[]",true);const baselineGenerations=new Set(before.filter(x=>x.stage==="generation-accepted").map(x=>String(x.generation)));const first=await characterHost.replaceCharacterForCi(alt);await wait(500);const mid=await execJs(w,"window.saeedCharacterRuntime?.glbTrace?.slice?.()||[]",true);const firstGenerations=mid.filter(x=>x.stage==="generation-accepted"&&!baselineGenerations.has(String(x.generation))).map(x=>String(x.generation));const second=await characterHost.replaceCharacterForCi(alt);await wait(500);const after=await execJs(w,"(()=>({trace:window.saeedCharacterRuntime?.glbTrace?.slice?.()||[],engine:window.saeedCharacterRuntime?.engine?.get3DStatus?.()}))()",true);const secondGenerations=after.trace.filter(x=>x.stage==="generation-accepted"&&!baselineGenerations.has(String(x.generation))&&!firstGenerations.includes(String(x.generation))).map(x=>String(x.generation));const firstGeneration=firstGenerations[firstGenerations.length-1];const secondGeneration=secondGenerations[secondGenerations.length-1];const eventsFor=g=>after.trace.filter(x=>String(x.generation)===String(g));const firstEvents=eventsFor(firstGeneration),secondEvents=eventsFor(secondGeneration);const firstPass=Boolean(firstGeneration&&firstEvents.some(x=>x.stage==="parse-success")&&firstEvents.some(x=>x.stage==="display-success"));const secondPass=Boolean(secondGeneration&&secondEvents.some(x=>x.stage==="parse-success")&&secondEvents.some(x=>x.stage==="display-success"));return {pass:Boolean(first?.ok&&second?.ok&&firstPass&&secondPass&&after.engine?.components?.sceneContent?.state==="rendered"),first,second,firstGeneration,secondGeneration,firstPass,secondPass,traceBefore:before,trace:after.trace,engine:after.engine}}finally{try{fs.unlinkSync(alt)}catch{}}},{timeoutMs:45000});
   await check("glb.current-character-loaded",async()=>{const w=getCharacterWindow?.();if(!visible(w))return false;const r=await execJs(w,'(()=>({bootstrap:window.saeed3DBootstrap,moduleLoaded:window.saeed3DBootstrap?.moduleLoaded!==false,engine:window.saeedCharacterRuntime?.engine?.get3DStatus?.()}))()',true);const pose=await execJs(w,"window.saeedCharacterRuntime?.controller?.status?.()",true).catch(()=>null);return {pass:Boolean(r.moduleLoaded&&!r.bootstrap?.error&&r.engine?.components?.sceneContent?.state==="rendered"&&pose?.characterLoaded&&Object.keys(pose?.autoRig||{}).length>0&&Number(pose?.skeletonCount||0)>0),detail:r,pose}});
   await check("tray.single-owner-and-menu",async()=>{const t=getTray?.();if(!t)return false;const menu=t.__saeedContextMenu;const labels=menu?.items?.map?.(x=>x.label)||[];const required=["Saeed","Mute","Voice","Character","Add-ons / Plug-ins","Learning / Teach Mode","Diagnostics","Updates & Settings","Quit"];const transcriptToggle=labels.some(x=>/^(Show|Hide) microphone transcript label$/.test(String(x)));return {pass:Boolean(t&&menu&&required.every(x=>labels.includes(x))&&transcriptToggle),labels,required,transcriptToggle}});
   await check("hide-saeed-keeps-tray",async()=>{
    characterHost.hideCharacter();await wait(500);
    return {pass:!visible(getCharacterWindow?.())&&Boolean(getTray?.()),characterVisible:visible(getCharacterWindow?.()),tray:Boolean(getTray?.())};
   });

   await check("show-saeed-restores",async()=>{
    await characterHost.showCharacter();await wait(800);
    return {pass:visible(getCharacterWindow?.())&&Boolean(getTray?.()),characterVisible:visible(getCharacterWindow?.()),tray:Boolean(getTray?.())};
   });

   await check("idle-final",async()=>{await wait(1000);return {pass:Boolean(getCharacterWindow?.())}});
   report.finishedAt=new Date().toISOString();
   report.durationMs=Date.now()-started;
   report.diagnostics={runnerVersion:4,timeoutPolicy:"continue-after-check-timeout",trace:trace.slice(),timeoutCount:Object.values(report.checks).filter(x=>x.status==="TIMEOUT").length,errorCount:Object.values(report.checks).filter(x=>x.status==="ERROR").length,suite: suiteArg,suiteCheckCount:Object.keys(report.checks).length};
   const requiredChecks=Object.values(report.checks).filter(x=>x.required!==false);report.pass=Object.keys(report.checks).length>0&&requiredChecks.length>0&&requiredChecks.every(x=>x.pass);
  }catch(e){report.error=String(e?.stack||e);report.pass=false;report.finishedAt=new Date().toISOString()}
  try{fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2),"utf8")}catch(e){report.pass=false;report.error=String(e?.stack||e)}
  return report;
 }
 return{run};
}
module.exports={createCiE2E};
