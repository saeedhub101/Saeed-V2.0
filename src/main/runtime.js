const {app,BrowserWindow,ipcMain,globalShortcut,desktopCapturer,Tray,Menu,screen,dialog,nativeImage,session}=require("electron");
const path=require("path"),fs=require("fs"),{spawn}=require("child_process");
const {isTrustedLocalMediaRequest}=require("./application/media-permissions");
if(process.env.SAEED_CI_USER_DATA){try{fs.mkdirSync(path.resolve(process.env.SAEED_CI_USER_DATA),{recursive:true});app.setPath("userData",path.resolve(process.env.SAEED_CI_USER_DATA))}catch(error){console.error("CI user-data path setup failed:",error)}}
const ciSmoke=process.env.SAEED_CI_SMOKE==="1"||process.argv.includes("--ci-smoke");
function ciWriteStartupReport(kind,error){
 if(!ciSmoke)return;
 try{
  const target=process.env.SAEED_CI_REPORT||path.join(process.cwd(),"dist","ci-runtime-report.json");
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,JSON.stringify({kind,time:new Date().toISOString(),argv:process.argv,appPath:app.isReady()?app.getAppPath():null,resourcesPath:process.resourcesPath,error:error?String(error?.stack||error):null},null,2),"utf8");
 }catch(writeError){console.error("CI startup report write failed:",writeError)}
}
process.on("uncaughtException",e=>{console.error("Saeed uncaught:",e);ciWriteStartupReport("uncaughtException",e);
});
process.on("unhandledRejection",e=>{console.error("Saeed rejection:",e);ciWriteStartupReport("unhandledRejection",e);
});
if(ciSmoke)ciWriteStartupReport("bootstrap-loaded");

// Startup contract: only Electron + the character surface are eager.
// Brain, voice runtime, chat, capture, updater and secondary feature modules are lazy.
const lazy={};
const load=(key,modulePath)=>lazy[key]||(lazy[key]=require(modulePath));


// Explicit Electron microphone permission handling for the user-controlled microphone lifecycle.
// Chromium must be allowed to request/use media audio before getUserMedia can open the device.
function configureMediaPermissions(){
 const appRoot=path.resolve(__dirname,"..");
 const allowed=(webContents,permission,requestingOrigin,details={})=>isTrustedLocalMediaRequest({
  webContents,permission,requestingOrigin,requestingUrl:details?.requestingUrl,
  isMainFrame:details?.isMainFrame,mediaType:details?.mediaType,mediaTypes:details?.mediaTypes,appRoot
 });
 try{
  session.defaultSession.setPermissionCheckHandler((webContents,permission,requestingOrigin,details)=>{
   return allowed(webContents,permission,requestingOrigin,details);
  });
  session.defaultSession.setPermissionRequestHandler((webContents,permission,callback,details={})=>{
   const origin=details?.securityOrigin||details?.requestingUrl||"";
   const granted=allowed(webContents,permission,origin,details);
   if(granted)diagnostic("INFO","MIC PERMISSION","Trusted local renderer requested audio-only media access",{mediaTypes:details?.mediaTypes||[]});
   else diagnostic("WARN","MIC PERMISSION","Denied untrusted, non-audio, or non-local media permission request",{permission,mediaTypes:details?.mediaTypes||[]});
   callback(granted);
  });
  diagnostic("INFO","MIC PERMISSION","Restricted local audio permission handlers configured");
 }catch(e){diagnostic("ERROR","MIC PERMISSION",e.message)}
}


let characterWin,performanceWin,settingsWin,addonsWin,learningWin,restPoseEditorWin,normalizeHumanoidRestPoseWin,agent,tray,statusWin,threeDStatusWin;
let addonService,learning,learningRecorder,apiHealth,resourceService,autoUpdater;
let chatHost=null,voiceHost=null,brainHost=null,screenCapture=null,windowManager=null,updateManager=null,characterHost;

const compositionState={get addonService(){return addonService},set addonService(v){addonService=v},get learning(){return learning},set learning(v){learning=v},get learningRecorder(){return learningRecorder},set learningRecorder(v){learningRecorder=v},get apiHealth(){return apiHealth},set apiHealth(v){apiHealth=v},get resourceService(){return resourceService},set resourceService(v){resourceService=v},get autoUpdater(){return autoUpdater},set autoUpdater(v){autoUpdater=v},get chatHost(){return chatHost},set chatHost(v){chatHost=v},get voiceHost(){return voiceHost},set voiceHost(v){voiceHost=v},get brainHost(){return brainHost},set brainHost(v){brainHost=v},get screenCapture(){return screenCapture},set screenCapture(v){screenCapture=v},get windowManager(){return windowManager},set windowManager(v){windowManager=v},get updateManager(){return updateManager},set updateManager(v){updateManager=v}};
const getState=()=>({characterWin,performanceWin,settingsWin,addonsWin,learningWin,restPoseEditorWin,normalizeHumanoidRestPoseWin,statusWin,threeDStatusWin,tray});
const setWindow=(name,value)=>{if(name==="characterWin")characterWin=value;else if(name==="performanceWin")performanceWin=value;else if(name==="settingsWin")settingsWin=value;else if(name==="addonsWin")addonsWin=value;else if(name==="learningWin")learningWin=value;else if(name==="restPoseEditorWin")restPoseEditorWin=value;else if(name==="normalizeHumanoidRestPoseWin")normalizeHumanoidRestPoseWin=value;else if(name==="statusWin")statusWin=value;else if(name==="threeDStatusWin")threeDStatusWin=value;else if(name==="tray")tray=value};
const {createRuntimeComposition}=require("./application/runtime-composition");
const composition=createRuntimeComposition({app,ipcMain,BrowserWindow,path,fs,spawn,desktopCapturer,screen,dialog,Menu,process,windowsIconPath,state:compositionState,getState,setWindow,getAgent:()=>agent,setAgent:value=>{agent=value}});
const {diagnosticState,diagnostic,publish3DStatus,accept3DStatus,request3DStatus,updateDiagnosticState,startCpuMonitoring,stopCpuMonitoring,updateCpuMetrics,diagnosticFromAgent,getAddonService,getLearning,getLearningRecorder,getApiHealth,getResourceService,getChatWindow,ensureChatHost,getCurrentMicMode,getVoiceMuted,ensureVoiceHost,setMicMode,setVoiceMuted,ensureScreenCapture,captureScreen,permissionPolicy,confirmPermission,confirmations,voiceBroadcast,characterStore,character3DSettingsFile,writeCharacter3DSettings,captureCharacter3DWindowSettings,characterApi,ensureWindowManager,showPerformance,showSettings,showLearning,showAddons,ensureUpdateManager,updateNow,rebuildTray,contextMenu,ensureBrainHost,ensureBrain,releaseBrainIfIdle,showStatus,show3DStatus}=composition;
characterHost=composition.characterHost;
const {displayForWindow,fitCharacterToDisplay,sendCharacterData,chooseCharacter,setSaeedSize,showCharacter,hideCharacter,createCharacterWindow,characterSizeMenu}=characterApi;

// AUTHORITATIVE SAEED ICON CODE — DO NOT REMOVE OR REPLACE.
// This code defines the official Saeed Windows application/taskbar icon source.
function windowsIconPath(){
 const ico=path.join(__dirname,"..","..","assets","saeed.ico");
 const png=path.join(__dirname,"..","..","assets","saeed.png");
 return fs.existsSync(ico)?ico:png;
}

// AUTHORITATIVE SAEED SYSTEM TRAY ICON CODE — DO NOT REMOVE OR REPLACE.
// This code creates the official Saeed system-tray icon from the same source.
function trayIcon(){
 return nativeImage.createFromPath(windowsIconPath());
}
app.setAppUserModelId("ai.saeed.desktop");
const singleInstanceLock=app.requestSingleInstanceLock();
if(!singleInstanceLock)app.quit();
else app.on("second-instance",(event,commandLine)=>{setTimeout(()=>handleLaunchArgs(commandLine.slice(1)),100);});

app.whenReady().then(async()=>{app.isQuitting=false;configureMediaPermissions();ciWriteStartupReport("ready");diagnostic("INFO","APPLICATION","Diagnostics system started");
 try{tray=new Tray(trayIcon());tray.setToolTip("Saeed AI");rebuildTray(tray)}catch(e){console.error("Tray failed:",e)}
 try{await createWindow();if(characterWin&&!getVoiceMuted()&&!ciSmoke)ensureVoiceHost().ensureTts()}catch(e){console.error("Saeed startup failed:",e);ciWriteStartupReport("startup-failed",e);app.quit();return}
try{const updateMode=agent?.settings?.updateMode||require("./services/settings-store").createSettingsStore(app.getPath("userData")).load().updateMode||"manual";if(app.isPackaged&&["notify","automatic"].includes(updateMode)){const updateTimer=setTimeout(()=>{if(!app.isQuitting)void ensureUpdateManager().check()},15000);updateTimer.unref?.()}}catch(error){diagnostic("WARN","UPDATE AUTO CHECK CONFIG",error?.message||String(error))}
 // Windows Jump List disabled to avoid Electron runtime incompatibility in the CI/build environment.
 if(process.argv.includes("--ci-character-rig-builder-save")){void require("./ci/character-rig-builder").runCiCharacterRigBuilder("save",{app,session,process,path,fs,characterHost,getState,diagnostic});return}
 if(process.argv.includes("--ci-brain-learning-save")||process.argv.includes("--ci-brain-learning-verify")){void require("./ci/packaged-acceptance").runBrainLearning(process.argv.includes("--ci-brain-learning-save")?"save":"verify",{app,ensureBrain,ensureBrainHost,getAgent:()=>agent,diagnostic});return}
 if(process.argv.includes("--ci-lifecycle")){void require("./ci/packaged-acceptance").runLifecycle({app,BrowserWindow,getState,setWindow,characterApi,characterHost,showPerformance,showSettings,showLearning,showAddons,showStatus,show3DStatus,showRestPoseEditor:composition.showRestPoseEditor,showNormalizeHumanoidRestPose:composition.showNormalizeHumanoidRestPose,ensureChatHost,ensureBrain,ensureBrainHost,getAgent:()=>agent,setMicMode,getCurrentMicMode,ensureVoiceHost,diagnostic,stopCpuMonitoring});return}
 if(process.argv.includes("--ci-ram-cpu")){void require("./ci/packaged-acceptance").runResource({app,BrowserWindow,getState,characterApi,characterHost,showPerformance,ensureChatHost,ensureBrain,ensureBrainHost,getAgent:()=>agent,setMicMode,getCurrentMicMode,ensureVoiceHost,getResourceService});return}
 if(process.argv.includes("--ci-character-rig-builder-verify")){void require("./ci/character-rig-builder").runCiCharacterRigBuilder("verify",{app,session,process,path,fs,characterHost,getState,diagnostic});return}
 if(process.argv.includes("--ci-rest-pose-save")){void require("./ci/rest-pose-restart").runCiRestPoseRestart("save",{app,session,process,path,fs,characterHost});return}
 if(process.argv.includes("--ci-rest-pose-verify")){void require("./ci/rest-pose-restart").runCiRestPoseRestart("verify",{app,session,process,path,fs,characterHost});return}
 if(process.argv.includes("--ci-acceptance")){void runCiProductAcceptance();return}
 if(process.argv.includes("--exit")||process.argv.includes("--show-saeed")||process.argv.includes("--3d-status")||process.argv.includes("--chat")||process.argv.includes("--performance")||process.argv.includes("--settings")||process.argv.includes("--addons")||process.argv.includes("--learning")||process.argv.includes("--status")||process.argv.includes("--mic-on")||process.argv.includes("--mic-off")||process.argv.some(x=>x.startsWith("--size-"))){handleLaunchArgs(process.argv.slice(1));}

 globalShortcut.register("CommandOrControl+Shift+M",()=>ensureChatHost().showChat());
 globalShortcut.register("CommandOrControl+Shift+S",async()=>{
  try{const image=await captureScreen();await ensureChatHost().showChat();getChatWindow()?.webContents.send("screen:capture",image)}
  catch(e){console.error("Screen capture failed:",e)}
 });
 const refresh=()=>{if(characterWin)fitCharacterToDisplay(displayForWindow())};
 screen.on("display-added",refresh);
 screen.on("display-removed",()=>{if(characterWin)fitCharacterToDisplay(displayForWindow())});
 screen.on("display-metrics-changed",refresh);
});

require("./ipc/email-ipc").registerEmailIpc({ipcMain,app,diagnostic});
require("./ipc/window-ipc").registerWindowIpc({ipcMain,BrowserWindow,screen,accept3DStatus,request3DStatus,show3DStatus,diagnostic});
require("./ipc/app-ipc").registerAppIpc({ipcMain,app,composition,getAgent:()=>agent,showStatus,showPerformance,showSettings,showAddons});
require("./ipc/core-ipc").registerCoreIpc({ipcMain,diagnostic,diagnosticState,getApiHealth,getResourceService,updateCpuMetrics});
load("chatIpc","./ipc/chat-ipc").registerChatIpc({ipcMain,ensureBrain,getBrainHost:ensureBrainHost,getAgent:()=>agent,getCharacterWindow:()=>characterWin,getChatHost:()=>chatHost});
load("learningIpc","./ipc/learning-ipc").registerLearningIpc({ipcMain,app,getLearning,getLearningRecorder,ensureBrain,getAgent:()=>agent,getChatWindow,getConfirmations:()=>confirmations,showLearning:()=>showLearning});
load("addonsIpc","./ipc/addons-ipc").registerAddonsIpc({ipcMain,app,getAddonService});
load("characterIpc","./ipc/character-ipc").registerCharacterIpc({ipcMain,getCharacterWindow:()=>characterWin,chooseCharacter,command:(payload)=>characterHost.command(payload),getPendingCharacter:()=>characterHost.getPendingCharacter?.()||null,captureCharacter3DWindowSettings,writeCharacter3DSettings});
load("settingsIpc","./ipc/settings-ipc").registerSettingsIpc({ipcMain,ensureBrain,getAgent:()=>agent,getVoiceHost:ensureVoiceHost,setMicMode,setSaeedSize,getCharacterWindow:()=>characterWin,diagnostic});

load("voiceIpc","./ipc/voice-ipc").registerVoiceIpc({ipcMain,getAgent:()=>agent,diagnostic,app,getVoiceHost:ensureVoiceHost,getBrainHost:ensureBrainHost,diagnosticState,getStatusWindow:()=>statusWin,getThreeDStatusWindow:()=>threeDStatusWin,getCharacterWindow:()=>characterWin,getChatWindow:()=>chatHost?.getChatWindow?.()});
load("updateIpc","./ipc/update-ipc").registerUpdateIpc({ipcMain,getUpdateManager:ensureUpdateManager,showUpdateStatus:()=>{const m=ensureUpdateManager();return composition.showUpdateStatus?.()||false}});
load("historyIpc","./ipc/history-ipc").registerHistoryIpc({ipcMain,getAgent:()=>agent,getChatWindow,getConfirmations:()=>confirmations,dialog});
load("backupIpc","./ipc/backup-ipc").registerBackupIpc({ipcMain,dialog,app,ensureBrain,getAgent:()=>agent,diagnostic});


app.on("activate",()=>{if(characterWin&&!characterWin.isDestroyed()){showCharacter();return}createWindow().catch(e=>diagnostic("ERROR","APPLICATION ACTIVATE",e.message))});
app.on("window-all-closed",()=>{if(app.isQuitting)return;diagnostic("INFO","WINDOW LIFECYCLE","All windows closed; Saeed remains alive in the tray")});
app.on("before-quit",()=>{try{captureCharacter3DWindowSettings()}catch{};app.isQuitting=true;try{voiceHost?.stopVoiceServices?.("app quit")}catch{};try{learningRecorder?.stop?.()}catch{};for(const win of [getChatWindow(),performanceWin,settingsWin,addonsWin,learningWin,restPoseEditorWin,statusWin,threeDStatusWin,characterWin])try{if(win&&!win.isDestroyed())win.destroy()}catch{};try{if(tray){tray.destroy();tray=null}}catch{}});
app.on("will-quit",()=>{globalShortcut.unregisterAll();try{voiceHost?.stopVoiceServices?.("app quit")}catch{}});

function handleLaunchArgs(args=[]){const a=args.map(String);if(a.includes("--exit"))return app.quit();if(a.includes("--show-saeed"))return showCharacter();if(a.includes("--chat"))return ensureChatHost().showChat();if(a.includes("--performance"))return showPerformance();if(a.includes("--settings"))return showSettings();if(a.includes("--addons"))return showAddons();if(a.includes("--learning"))return showLearning();if(a.includes("--status"))return showStatus();if(a.includes("--3d-status"))return show3DStatus();if(a.includes("--mic-on"))return setMicMode("on");if(a.includes("--mic-off"))return setMicMode("off");if(a.includes("--size-small"))return setSaeedSize("small");if(a.includes("--size-medium"))return setSaeedSize("medium");if(a.includes("--size-large"))return setSaeedSize("large");return showCharacter()}


async function runCiProductAcceptance(){
 const report={schemaVersion:1,startedAt:new Date().toISOString(),passed:false,checks:[],error:null};
 const check=(name,passed,details={})=>{report.checks.push({name,passed:Boolean(passed),details});if(!passed)console.error("PACKAGED_ACCEPTANCE_FAIL="+name,JSON.stringify(details))};
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 try{
  const target=getState().characterWin;
  check("character-window-created",Boolean(target&&!target.isDestroyed()));
  if(!target||target.isDestroyed())throw new Error("Character window was not created");
  const rig=await characterHost.command({action:"getRig"});
  check("bundled-glb-loaded",rig?.ok===true&&Array.isArray(rig.bones)&&rig.bones.length>0,{boneCount:rig?.bones?.length||0,error:rig?.error||null});
  const mapping=rig?.mapping&&typeof rig.mapping==="object"?rig.mapping:{};
  check("humanoid-rig-mapped",Object.keys(mapping).length>0,{mappedSlots:Object.keys(mapping).length});
  const engineStatus=await target.webContents.executeJavaScript("window.saeedCharacterRuntime?.engine?.get3DStatus?.()");
  check("three-renderer-active",Boolean(engineStatus?.character?.loaded&&Number(engineStatus?.metrics?.renderCount)>0),{loaded:Boolean(engineStatus?.character?.loaded),renderCount:engineStatus?.metrics?.renderCount||0});
  const motion=await characterHost.command({action:"play",motion:"think",options:{priority:100}});
  check("semantic-motion-playback",motion?.ok===true,{ok:Boolean(motion?.ok),error:motion?.error||null});
  await wait(120);
  const stopped=await characterHost.command({action:"stopAll"});
  check("motion-stop",stopped?.ok===true,{ok:Boolean(stopped?.ok)});
  const mappedHead=rig.mapping?.head;const restPoseBone=String(typeof mappedHead==="string"&&mappedHead?mappedHead:rig.bones.find(name=>/head/i.test(String(name)))||rig.bones[0]||"");
  const restPoseInitialStatus=await characterHost.command({action:"status"});
  const restPoseInitialBone=restPoseInitialStatus?.status?.actualBones?.[restPoseBone]||null;
  const originalRestRotation=restPoseInitialBone?.rotation?{x:Number(restPoseInitialBone.rotation.x),y:Number(restPoseInitialBone.rotation.y),z:Number(restPoseInitialBone.rotation.z)}:null;
  const originalRestPosition=restPoseInitialBone?.position?{x:Number(restPoseInitialBone.position.x),y:Number(restPoseInitialBone.position.y),z:Number(restPoseInitialBone.position.z)}:null;
  const desiredRestRotation={x:0.123,y:0.087,z:-0.061};
  // Keep autonomous gestures from racing the rest-pose persistence/reload assertion.
  // The production character remains autonomous; only this deterministic acceptance window is paused.
  const restPosePause=await characterHost.command({action:"setAnimationPaused",paused:true});
  check("rest-pose-reload-paused-autonomous-motion",restPosePause?.ok===true&&restPosePause?.paused===true,{ok:Boolean(restPosePause?.ok),paused:Boolean(restPosePause?.paused),error:restPosePause?.error||null});
  const editedBone=restPoseBone?await characterHost.command({action:"setBoneRotation",bone:restPoseBone,rotation:desiredRestRotation}):{ok:false,error:"No bone available"};
  const editRotation=editedBone?.rotation||{};
  const boneEditPassed=editedBone?.ok===true&&["x","y","z"].every(axis=>Number.isFinite(Number(editRotation[axis]))&&Math.abs(Number(editRotation[axis])-desiredRestRotation[axis])<0.02);
  check("rest-pose-real-bone-edit-applied",boneEditPassed,{bone:restPoseBone,rotation:editRotation,error:editedBone?.error||null});
  const rest=await characterHost.command({action:"saveRestPose"});
  check("rest-pose-persistent-readback",rest?.ok===true&&rest?.persisted===true&&rest?.restPose?.persisted===true,{persisted:Boolean(rest?.persisted),profileId:rest?.restPose?.profileId||null,error:rest?.restPose?.persistenceError||null});
  await hideCharacter();await wait(100);await showCharacter();await wait(250);
  const reloadPause=await characterHost.command({action:"setAnimationPaused",paused:true});
  const restoredBone=restPoseBone?await characterHost.command({action:"boneRotation",bone:restPoseBone}):{ok:false};
  const restoredRotation=restoredBone?.rotation||{};
  const restPoseReloadPassed=reloadPause?.ok===true&&restoredBone?.ok===true&&["x","y","z"].every(axis=>Number.isFinite(Number(restoredRotation[axis]))&&Math.abs(Number(restoredRotation[axis]))<0.03);
  check("rest-pose-reapplied-after-character-runtime-reload",restPoseReloadPassed,{bone:restPoseBone,editorDelta:restoredRotation,ok:Boolean(restoredBone?.ok),pauseOk:Boolean(reloadPause?.ok)});
  await characterHost.command({action:"setAnimationPaused",paused:false});
  const invalidCandidatePath=path.join(app.getPath("userData"),"ci-invalid-character-candidate.glb");
  try{
   fs.writeFileSync(invalidCandidatePath,Buffer.from("not-a-valid-glb"));
   const invalidCandidate=await characterHost.replaceCharacterForCi(invalidCandidatePath);
   const rigAfterInvalid=await characterHost.command({action:"getRig"});
   check("invalid-glb-rejected-preserves-current-character",invalidCandidate?.ok!==true&&rigAfterInvalid?.ok===true&&rigAfterInvalid?.bones?.length===rig.bones.length,{rejected:invalidCandidate?.ok!==true,error:invalidCandidate?.error||null,bonesBefore:rig.bones.length,bonesAfter:rigAfterInvalid?.bones?.length||0});
  }catch(error){check("invalid-glb-rejected-preserves-current-character",false,{error:error?.message||String(error)})}
  finally{try{fs.unlinkSync(invalidCandidatePath)}catch{}}
  const seenMotionBones=new Set();
  const motionSlots=Object.entries(rig.mapping||{}).filter(([slot,bone])=>typeof slot==="string"&&typeof bone==="string"&&rig.bones.includes(bone)&&!seenMotionBones.has(bone)&&seenMotionBones.add(bone)).map(([slot,bone])=>({slot,bone}));
  const motionBone=String(motionSlots[0]?.bone||"");
  const motionId="ci-generated-motion-acceptance";
  const motionStatus=await characterHost.command({action:"status"});
  const initialMotionRotations=Object.fromEntries(motionSlots.map(({bone})=>[bone,motionStatus?.status?.actualBones?.[bone]?.rotation||null]));
  const makePose=angle=>Object.fromEntries(motionSlots.map(({slot})=>[slot,{x:angle,y:angle*0.4,z:-angle*0.25}]));
  const makeCiMotion=angle=>({id:motionId,duration:1,loop:false,layer:"body",keyframes:[{time:0,pose:makePose(0)},{time:1,pose:makePose(angle)}]});
  let motionFirstRotations={},motionEditedRotations={};
  try{
   await characterHost.command({action:"stopAll"});
   const defined=motionSlots.length?await characterHost.command({action:"defineMotion",motion:makeCiMotion(0.35)}):{ok:false,error:"No mapped logical slots"};
   check("generated-motion-created",defined?.ok===true&&defined?.motion?.id===motionId,{mappedSlots:motionSlots.length,bones:motionSlots.map(item=>item.bone),error:defined?.error||null});
   const played=defined?.ok===true?await characterHost.command({action:"play",motion:motionId,options:{priority:100,blend:0.01}}):{ok:false};
   await wait(300);
   const afterFirst=await characterHost.command({action:"status"});
   motionFirstRotations=Object.fromEntries(motionSlots.map(({bone})=>[bone,afterFirst?.status?.actualBones?.[bone]?.rotation||null]));
   const changedMotionBones=motionSlots.filter(({bone})=>{const before=initialMotionRotations[bone],after=motionFirstRotations[bone];return Boolean(before&&after)&&["x","y","z"].some(axis=>Math.abs(Number(after[axis])-Number(before[axis]))>0.015)});
   const firstMoved=played?.ok===true&&changedMotionBones.length===motionSlots.length&&motionSlots.length>0;
   check("generated-motion-changes-real-bone",firstMoved,{mappedBoneCount:motionSlots.length,changedBoneCount:changedMotionBones.length,unchangedBones:motionSlots.filter(({bone})=>!changedMotionBones.some(item=>item.bone===bone)).map(item=>item.bone),representativeBone:motionBone,before:initialMotionRotations[motionBone]||null,after:motionFirstRotations[motionBone]||null});
   check("generated-motion-changes-all-mapped-bones",firstMoved,{mappedSlots:motionSlots.map(item=>item.slot),mappedBones:motionSlots.map(item=>item.bone),changedBones:changedMotionBones.map(item=>item.bone)});
   // Keep the same stored motion, change and persist one real mapped bone's rest pose,
   // then replay that unchanged motion. This detects stale/original-pose retargeting.
   await characterHost.command({action:"stopAll"});
   const restProbeBone=motionSlots[0]?.bone||"";
   const restBeforeStatus=await characterHost.command({action:"status"});
   const restBefore=restBeforeStatus?.status?.actualBones?.[restProbeBone]?.rotation||null;
   const restChanged=Boolean(restProbeBone&&restBefore)&&await characterHost.command({action:"setBoneRotation",bone:restProbeBone,rotation:{x:Number(restBefore.x)+0.22,y:Number(restBefore.y),z:Number(restBefore.z)}});
   const restSaved=restChanged?.ok===true?await characterHost.command({action:"saveRestPose"}):{ok:false,error:restChanged?.error||"Could not change mapped bone rest pose"};
   check("rest-pose-change-is-persisted",restSaved?.ok===true&&restSaved?.persisted===true&&restSaved?.restPose?.persisted===true,{bone:restProbeBone,persisted:Boolean(restSaved?.persisted),error:restSaved?.restPose?.persistenceError||restSaved?.error||null});
   await characterHost.command({action:"stopAll"});
   const replaySameMotion=restSaved?.ok===true?await characterHost.command({action:"play",motion:motionId,options:{priority:100,blend:0.01}}):{ok:false};
   await wait(300);
   const afterRestRebind=await characterHost.command({action:"status"});
   const afterRestRotations=Object.fromEntries(motionSlots.map(({bone})=>[bone,afterRestRebind?.status?.actualBones?.[bone]?.rotation||null]));
   const beforeProbe=motionFirstRotations[restProbeBone],afterProbe=afterRestRotations[restProbeBone];
   const restPoseChangedMotion=Boolean(replaySameMotion?.ok&&beforeProbe&&afterProbe)&&["x","y","z"].some(axis=>Math.abs(Number(afterProbe[axis])-Number(beforeProbe[axis]))>0.06);
   check("rest-pose-change-rebinds-existing-motion",restPoseChangedMotion,{bone:restProbeBone,motionId,rotationBeforeRestChange:beforeProbe||null,rotationAfterRestChange:afterProbe||null,delta:beforeProbe&&afterProbe?{x:Number(afterProbe.x)-Number(beforeProbe.x),y:Number(afterProbe.y)-Number(beforeProbe.y),z:Number(afterProbe.z)-Number(beforeProbe.z)}:null,playSucceeded:Boolean(replaySameMotion?.ok)});
   if(replaySameMotion?.ok)motionFirstRotations=afterRestRotations;
   await characterHost.command({action:"stopAll"});
   const edited=motionSlots.length?await characterHost.command({action:"defineMotion",motion:makeCiMotion(-0.55)}):{ok:false};
   const playedEdited=edited?.ok===true?await characterHost.command({action:"play",motion:motionId,options:{priority:100,blend:0.01}}):{ok:false};
   await wait(300);
   const afterEdited=await characterHost.command({action:"status"});
   motionEditedRotations=Object.fromEntries(motionSlots.map(({bone})=>[bone,afterEdited?.status?.actualBones?.[bone]?.rotation||null]));
   const editedChangedBones=motionSlots.filter(({bone})=>{const initial=initialMotionRotations[bone],first=motionFirstRotations[bone],editedRotation=motionEditedRotations[bone];return Boolean(initial&&first&&editedRotation)&&["x","y","z"].some(axis=>Math.abs(Number(editedRotation[axis])-Number(initial[axis]))>0.015)&&["x","y","z"].some(axis=>Math.abs(Number(editedRotation[axis])-Number(first[axis]))>0.025)});
   const editedMoved=playedEdited?.ok===true&&motionSlots.length>0&&editedChangedBones.length===motionSlots.length;
   check("edited-motion-changes-real-bone-differently",editedMoved,{mappedBoneCount:motionSlots.length,changedBoneCount:editedChangedBones.length,unchangedBones:motionSlots.filter(({bone})=>!editedChangedBones.some(item=>item.bone===bone)).map(item=>item.bone)});
   check("edited-motion-changes-all-mapped-bones-differently",editedMoved,{mappedSlots:motionSlots.map(item=>item.slot),mappedBones:motionSlots.map(item=>item.bone),changedBones:editedChangedBones.map(item=>item.bone)});
  }catch(error){check("generated-motion-and-edit-playback",false,{error:error?.message||String(error)})}
  finally{try{await characterHost.command({action:"stopAll"})}catch{}try{await characterHost.command({action:"deleteMotion",id:motionId})}catch{}}
  const motionList=await characterHost.command({action:"listMotions"});
  check("generated-motion-cleaned-up",Array.isArray(motionList?.motions)&&!motionList.motions.some(m=>m?.id===motionId),{remaining:motionList?.motions?.filter(m=>m?.id===motionId).length||0});
  try{
   const rotationSet=restPoseBone&&originalRestRotation?await characterHost.command({action:"setBoneRotation",bone:restPoseBone,rotation:originalRestRotation}):{ok:false};
   const positionSet=restPoseBone&&originalRestPosition?await characterHost.command({action:"setBonePosition",bone:restPoseBone,position:originalRestPosition}):{ok:false};
   const originalSaved=await characterHost.command({action:"saveRestPose"});
   const originalRead=await characterHost.command({action:"status"});
   const actualOriginal=originalRead?.status?.actualBones?.[restPoseBone]||null;
   const rotationRestored=Boolean(actualOriginal?.rotation&&originalRestRotation)&&["x","y","z"].every(axis=>Math.abs(Number(actualOriginal.rotation[axis])-originalRestRotation[axis])<0.02);
   const positionRestored=Boolean(actualOriginal?.position&&originalRestPosition)&&["x","y","z"].every(axis=>Math.abs(Number(actualOriginal.position[axis])-originalRestPosition[axis])<0.005);
   check("rest-pose-original-transform-restored",rotationSet?.ok===true&&positionSet?.ok===true&&originalSaved?.persisted===true&&rotationRestored&&positionRestored,{bone:restPoseBone,rotationRestored,positionRestored,persisted:Boolean(originalSaved?.persisted)});
  }catch(error){check("rest-pose-original-transform-restored",false,{error:error?.message||String(error)})}
  const voice=ensureVoiceHost();
  const whisper=voice.whisperRuntimePaths();
  check("packaged-whisper-runtime-present",Boolean(fs.existsSync(whisper.exe)&&fs.existsSync(whisper.model)),{executableExists:fs.existsSync(whisper.exe),modelExists:fs.existsSync(whisper.model)});
  try{
   const transcription=await voice.transcribeLocalWav(Buffer.alloc(24000).toString("base64"));
   check("packaged-whisper-transcription-runs",typeof transcription==="string",{transcriptCharacters:transcription.length});
  }catch(error){check("packaged-whisper-transcription-runs",false,{error:error?.message||String(error)})}
  const micOff=await voice.setMicMode("off");
  check("microphone-off-lifecycle",micOff===true&&voice.getCurrentMicMode()==="off",{mode:voice.getCurrentMicMode()});
  voice.ensureTts();
  check("tts-ready-when-unmuted",voice.getTtsReady()===true&&voice.getVoiceMuted()===false,{ready:voice.getTtsReady(),muted:voice.getVoiceMuted()});
  voice.setVoiceMuted(true);
  check("mute-is-output-only",voice.getVoiceMuted()===true&&voice.getCurrentMicMode()==="off"&&voice.getTtsReady()===false,{muted:voice.getVoiceMuted(),micMode:voice.getCurrentMicMode(),ttsReady:voice.getTtsReady()});
  voice.setVoiceMuted(false);
  check("unmute-restores-tts",voice.getVoiceMuted()===false&&voice.getTtsReady()===true&&voice.getCurrentMicMode()==="off",{muted:voice.getVoiceMuted(),micMode:voice.getCurrentMicMode(),ttsReady:voice.getTtsReady()});
  await hideCharacter();await wait(80);
  voice.setVoiceMuted(true);voice.setVoiceMuted(false);
  const characterVisible=()=>{const current=getState().characterWin;return Boolean(current&&!current.isDestroyed()&&current.isVisible())};
  check("unmute-while-hidden-keeps-tts-released",voice.getVoiceMuted()===false&&voice.getTtsReady()===false&&!characterVisible(),{muted:voice.getVoiceMuted(),ttsReady:voice.getTtsReady(),visible:characterVisible()});
  await showCharacter();await wait(120);
  check("show-after-hidden-unmute-restores-tts",characterVisible()&&voice.getTtsReady()===true,{visible:characterVisible(),ttsReady:voice.getTtsReady()===true});

  for(let i=1;i<=3;i++){
   await hideCharacter();await wait(80);
   check("hide-character-"+i,!characterVisible(),{visible:characterVisible()});
   await showCharacter();await wait(120);
   check("show-character-"+i,characterVisible(),{visible:characterVisible()});
  }
  const verifyFeaturePage=async(name,title,open,key,probe)=>{
   try{
    await open();await wait(180);
    const win=getState()[key];
    if(!win||win.isDestroyed())throw new Error("Feature window was not created");
    const page=await win.webContents.executeJavaScript(probe);
    const passed=win.isVisible()&&page?.readyState==="complete"&&page?.title===title&&page?.hasMain===true&&page?.apiAvailable===true&&page?.apiRoundTrip===true;
    check(name+"-window-and-ipc",passed,{visible:win.isVisible(),readyState:page?.readyState||null,title:page?.title||null,hasMain:Boolean(page?.hasMain),apiAvailable:Boolean(page?.apiAvailable),apiRoundTrip:Boolean(page?.apiRoundTrip)});
    return win;
   }catch(error){check(name+"-window-and-ipc",false,{error:error?.message||String(error)});return null}
  };
  const learningAcceptanceWindow=await verifyFeaturePage("learning","Saeed Learning",showLearning,"learningWin","(async()=>{const api=typeof window.saeed?.learning?.list===\"function\";const result=api?await window.saeed.learning.list():null;return{readyState:document.readyState,title:document.title,hasMain:!!document.querySelector(\"main\"),apiAvailable:api,apiRoundTrip:Array.isArray(result)}})()");
  const addonsAcceptanceWindow=await verifyFeaturePage("addons","Saeed Add-ons",showAddons,"addonsWin","(async()=>{const api=typeof window.saeed?.addons?.catalog===\"function\";const result=api?await window.saeed.addons.catalog():null;return{readyState:document.readyState,title:document.title,hasMain:!!document.querySelector(\"main\"),apiAvailable:api,apiRoundTrip:result!==null&&result!==undefined}})()");
  try{learningAcceptanceWindow?.close()}catch{}
  try{addonsAcceptanceWindow?.close()}catch{}
  const transcriptSettingBefore=composition.getTranscriptLabelEnabled();
  try{
   const enabled=composition.setTranscriptLabelEnabled(true);
   await wait(100);
   const rendered=await getState().characterWin.webContents.executeJavaScript("(()=>{window.saeedShowTranscript(\'CI recognized speech\');const e=document.getElementById(\'saeedTranscriptLabel\');return{text:e?.textContent||\'\',hidden:!!e?.hidden}})()");
   check("microphone-transcript-label-toggle-and-render",enabled===true&&rendered?.text==="CI recognized speech"&&rendered?.hidden===false,{enabled:Boolean(enabled),text:rendered?.text||"",hidden:rendered?.hidden!==false});
  }catch(error){check("microphone-transcript-label-toggle-and-render",false,{error:error?.message||String(error)})}
  finally{
   const restored=composition.setTranscriptLabelEnabled(transcriptSettingBefore);
   check("microphone-transcript-label-setting-restored",restored===transcriptSettingBefore&&composition.getTranscriptLabelEnabled()===transcriptSettingBefore,{restored:Boolean(restored),expected:Boolean(transcriptSettingBefore)});
  }
  const after=await characterHost.command({action:"getRig"});
  check("character-survives-repeated-visibility-cycles",after?.ok===true&&after?.bones?.length===rig.bones.length,{before:rig.bones.length,after:after?.bones?.length||0});
 }catch(error){report.error=String(error?.stack||error);check("runtime-acceptance-exception",false,{error:report.error})}
 report.finishedAt=new Date().toISOString();
 report.passed=report.checks.length>0&&report.checks.every(item=>item.passed);
 const output=process.env.SAEED_CI_ACCEPTANCE_REPORT||path.join(process.cwd(),"dist","ci-product-acceptance.json");
 try{fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n","utf8")}catch(error){report.passed=false;report.error=String(error?.stack||error);console.error("Could not write packaged acceptance report:",report.error)}
 console.log("PACKAGED_RUNTIME_ACCEPTANCE="+(report.passed?"PASS":"FAIL"));
 console.log(JSON.stringify(report,null,2));
 setTimeout(async()=>{try{await session.defaultSession.flushStorageData()}catch(error){console.error("CI storage flush failed:",error?.message||String(error))}app.exit(report.passed?0:1)},150);
}



async function createWindow(){await createCharacterWindow()}
