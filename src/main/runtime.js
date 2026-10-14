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
 if(process.argv.includes("--ci-character-rig-builder-save")){void runCiCharacterRigBuilder("save");return}
 if(process.argv.includes("--ci-brain-learning-save")||process.argv.includes("--ci-brain-learning-verify")){void require("./ci/packaged-acceptance").runBrainLearning(process.argv.includes("--ci-brain-learning-save")?"save":"verify",{app,ensureBrain,ensureBrainHost,getAgent:()=>agent,diagnostic});return}
 if(process.argv.includes("--ci-lifecycle")){void require("./ci/packaged-acceptance").runLifecycle({app,BrowserWindow,getState,setWindow,characterApi,characterHost,showPerformance,showSettings,showLearning,showAddons,showStatus,show3DStatus,showRestPoseEditor:composition.showRestPoseEditor,showNormalizeHumanoidRestPose:composition.showNormalizeHumanoidRestPose,ensureChatHost,ensureBrain,ensureBrainHost,getAgent:()=>agent,setMicMode,getCurrentMicMode,ensureVoiceHost,diagnostic,stopCpuMonitoring});return}
 if(process.argv.includes("--ci-ram-cpu")){void require("./ci/packaged-acceptance").runResource({app,BrowserWindow,getState,characterApi,characterHost,showPerformance,ensureChatHost,ensureBrain,ensureBrainHost,getAgent:()=>agent,setMicMode,getCurrentMicMode,ensureVoiceHost,getResourceService});return}
 if(process.argv.includes("--ci-character-rig-builder-verify")){void runCiCharacterRigBuilder("verify");return}
 if(process.argv.includes("--ci-rest-pose-save")){void runCiRestPoseRestart("save");return}
 if(process.argv.includes("--ci-rest-pose-verify")){void runCiRestPoseRestart("verify");return}
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

ipcMain.on("3d:status-report",(_,requestId,report)=>{accept3DStatus(requestId,report)});ipcMain.on("window:close-self",event=>{try{const win=BrowserWindow.fromWebContents(event.sender);if(win&&!win.isDestroyed())win.close()}catch(e){diagnostic("ERROR","WINDOW CLOSE",e.message)}});ipcMain.on("window:move-by",(event,dx,dy)=>{try{const win=BrowserWindow.fromWebContents(event.sender);if(!win||win.isDestroyed())return;const [x,y]=win.getPosition(),[w,h]=win.getSize();const px=x+w/2,py=y+h/2;const displays=screen.getAllDisplays();let d=screen.getPrimaryDisplay();let best=Infinity;for(const candidate of displays){const a=candidate.workArea;const cx=Math.max(a.x,Math.min(px,a.x+a.width));const cy=Math.max(a.y,Math.min(py,a.y+a.height));const dist=(px-cx)**2+(py-cy)**2;if(dist<best){best=dist;d=candidate}}const a=d.workArea,stepX=Math.max(-100,Math.min(100,Number(dx)||0)),stepY=Math.max(-100,Math.min(100,Number(dy)||0));const nx=Math.max(a.x,Math.min(Math.round(x+stepX),a.x+a.width-w)),ny=Math.max(a.y,Math.min(Math.round(y+stepY),a.y+a.height-h));win.setPosition(Math.trunc(nx),Math.trunc(ny),false)}catch(e){diagnostic("ERROR","3D WINDOW MOVE",e.message)}});ipcMain.handle("3d:query",()=>request3DStatus());ipcMain.handle("3d-status:show",()=>{show3DStatus();return true});
ipcMain.handle("email:credential:store",async(_,provider,account,username,password)=>{const p=String(provider||"").trim().toLowerCase(),a=String(account||"").trim(),u=String(username||"").trim(),secret=String(password||"");if(!["gmail","yahoo","hotmail","custom"].includes(p))throw new Error("Unsupported email provider");if(!a||a.length>254||/[\r\n\0]/.test(a))throw new Error("Invalid email account key");if(!u||u.length>254||/[\r\n\0]/.test(u))throw new Error("Invalid email username");if(!secret||secret.length>4096)throw new Error("Password/app password is required");const stored=await require("../addons/credentials").set(p,a,u,secret);diagnostic("INFO","EMAIL CREDENTIAL","Email credential saved to Windows Credential Manager",{provider:p});return{ok:Boolean(stored?.stored),provider:p,account:a,stored:Boolean(stored?.stored)}});ipcMain.handle("email:account:save",async(_,record={})=>{const store=require("../addons/email-account-store"),saved=store.save(app.getPath("userData"),record);diagnostic("INFO","EMAIL SERVER SETTINGS","Email server settings saved",{provider:saved.provider,account:saved.account,protocol:record.protocol});return{ok:true,account:saved}});ipcMain.handle("email:account:get",(_,provider,account)=>({ok:true,account:require("../addons/email-account-store").get(app.getPath("userData"),provider,account)}));ipcMain.handle("email:connection:test",async(_,record={})=>{const store=require("../addons/email-account-store"),email=require("../addons/email"),credentials=require("../addons/credentials"),client=require("../addons/email-client"),provider=String(record.provider||"").trim().toLowerCase(),protocol=String(record.protocol||"").trim().toLowerCase(),account=String(record.account||"").trim();if(!account)throw new Error("Enter the email account key before testing the server");const profile=store.get(app.getPath("userData"),provider,account),savedServer=profile?.servers?.[protocol]||{},defaults=email.provider(provider)[protocol]||{},validated=store.validateRecord({provider,account,protocol,host:record.host||savedServer.host||defaults.host,port:record.port||savedServer.port||defaults.port,tls:record.tls===undefined?(savedServer.tls===undefined?defaults.tls:savedServer.tls):record.tls,startTls:record.startTls===undefined?(savedServer.startTls===undefined?defaults.startTls:savedServer.startTls):record.startTls}),saved=await credentials.get(provider,account);if(!saved||!String(saved.username||"").trim()||(!String(saved.password||"")&&!String(saved.accessToken||"")))throw new Error("Save the account credentials before testing protocol authentication");const config={...defaults,...savedServer,...validated,username:saved.username,password:saved.password,accessToken:saved.accessToken};if(protocol==="imap")await client.imapLogin(config);else if(protocol==="pop3")await client.pop3ListMessages(config);else await client.smtpVerify(config);const transport=validated.startTls?"SMTP STARTTLS authenticated":validated.tls?"TLS and protocol authentication succeeded":"Protocol authentication succeeded";diagnostic("INFO","EMAIL CONNECTION TEST","Email protocol authentication succeeded",{provider,protocol,host:validated.host,port:validated.port,authenticated:true,transport});return{ok:true,connected:true,authenticated:true,provider,protocol,host:validated.host,port:validated.port,transport}});ipcMain.handle("app:version",()=>app.getVersion());ipcMain.handle("settings:get",()=>{if(agent)return agent.publicSettings();const {createSettingsStore}=require("./services/settings-store");const store=createSettingsStore(app.getPath("userData"));return store.public(store.load())});ipcMain.on("character:activity",()=>{});
ipcMain.handle("diagnostic:report",(_,level,stage,message,meta)=>diagnostic(level,stage,message,meta));ipcMain.handle("diagnostic:snapshot",()=>({state:diagnosticState}));ipcMain.handle("api-status:test",(_,service)=>getApiHealth().test(String(service||"")));ipcMain.handle("api-status:test-all",()=>getApiHealth().testAll());ipcMain.handle("resource:snapshot",()=>getResourceService().resourceReport());ipcMain.handle("cpu:metrics",()=>{updateCpuMetrics();return diagnosticState.cpu});ipcMain.handle("status:show",()=>{showStatus();return true});ipcMain.handle("performance:show",()=>{showPerformance();return true});ipcMain.handle("rest-pose:show",()=>{composition.showRestPoseEditor?.();return true});ipcMain.handle("settings:show",()=>{showSettings();return true});ipcMain.handle("addons:show",()=>{showAddons();return true});
load("chatIpc","./ipc/chat-ipc").registerChatIpc({ipcMain,ensureBrain,getBrainHost:ensureBrainHost,getAgent:()=>agent,getCharacterWindow:()=>characterWin,getChatHost:()=>chatHost});
load("learningIpc","./ipc/learning-ipc").registerLearningIpc({ipcMain,app,getLearning,getLearningRecorder,ensureBrain,getAgent:()=>agent,getChatWindow,getConfirmations:()=>confirmations,showLearning:()=>showLearning});
load("addonsIpc","./ipc/addons-ipc").registerAddonsIpc({ipcMain,app,getAddonService});
load("characterIpc","./ipc/character-ipc").registerCharacterIpc({ipcMain,getCharacterWindow:()=>characterWin,chooseCharacter,command:(payload)=>characterHost.command(payload),getPendingCharacter:()=>characterHost.getPendingCharacter?.()||null,captureCharacter3DWindowSettings,writeCharacter3DSettings});
load("settingsIpc","./ipc/settings-ipc").registerSettingsIpc({ipcMain,ensureBrain,getAgent:()=>agent,getVoiceHost:ensureVoiceHost,setMicMode,setSaeedSize,getCharacterWindow:()=>characterWin,diagnostic});
ipcMain.handle("transcript-label:get",()=>composition.getTranscriptLabelEnabled?.()===true);
ipcMain.handle("transcript-label:set",(_,enabled)=>{composition.setTranscriptLabelEnabled?.(enabled);const actual=composition.getTranscriptLabelEnabled?.()===true;return {ok:actual===Boolean(enabled),enabled:actual}});

load("voiceIpc","./ipc/voice-ipc").registerVoiceIpc({ipcMain,getAgent:()=>agent,diagnostic,app,getVoiceHost:ensureVoiceHost,getBrainHost:ensureBrainHost,diagnosticState,getStatusWindow:()=>statusWin,getThreeDStatusWindow:()=>threeDStatusWin,getCharacterWindow:()=>characterWin,getChatWindow:()=>chatHost?.getChatWindow?.()});
load("updateIpc","./ipc/update-ipc").registerUpdateIpc({ipcMain,getUpdateManager:ensureUpdateManager,showUpdateStatus:()=>{const m=ensureUpdateManager();return composition.showUpdateStatus?.()||false}});
load("historyIpc","./ipc/history-ipc").registerHistoryIpc({ipcMain,getAgent:()=>agent,getChatWindow,getConfirmations:()=>confirmations,dialog});
load("backupIpc","./ipc/backup-ipc").registerBackupIpc({ipcMain,dialog,app,ensureBrain,getAgent:()=>agent,diagnostic});


app.on("activate",()=>{if(characterWin&&!characterWin.isDestroyed()){showCharacter();return}createWindow().catch(e=>diagnostic("ERROR","APPLICATION ACTIVATE",e.message))});
app.on("window-all-closed",()=>{if(app.isQuitting)return;diagnostic("INFO","WINDOW LIFECYCLE","All windows closed; Saeed remains alive in the tray")});
app.on("before-quit",()=>{try{captureCharacter3DWindowSettings()}catch{};app.isQuitting=true;try{voiceHost?.stopVoiceServices?.("app quit")}catch{};try{learningRecorder?.stop?.()}catch{};for(const win of [getChatWindow(),performanceWin,settingsWin,addonsWin,learningWin,restPoseEditorWin,statusWin,threeDStatusWin,characterWin])try{if(win&&!win.isDestroyed())win.destroy()}catch{};try{if(tray){tray.destroy();tray=null}}catch{}});
app.on("will-quit",()=>{globalShortcut.unregisterAll();try{voiceHost?.stopVoiceServices?.("app quit")}catch{}});

function handleLaunchArgs(args=[]){const a=args.map(String);if(a.includes("--exit"))return app.quit();if(a.includes("--show-saeed"))return showCharacter();if(a.includes("--chat"))return ensureChatHost().showChat();if(a.includes("--performance"))return showPerformance();if(a.includes("--settings"))return showSettings();if(a.includes("--addons"))return showAddons();if(a.includes("--learning"))return showLearning();if(a.includes("--status"))return showStatus();if(a.includes("--3d-status"))return show3DStatus();if(a.includes("--mic-on"))return setMicMode("on");if(a.includes("--mic-off"))return setMicMode("off");if(a.includes("--size-small"))return setSaeedSize("small");if(a.includes("--size-medium"))return setSaeedSize("medium");if(a.includes("--size-large"))return setSaeedSize("large");return showCharacter()}

async function runCiRestPoseRestart(mode){
 const report={schemaVersion:1,mode,startedAt:new Date().toISOString(),passed:false,checks:[],error:null};
 const check=(name,passed,details={})=>{report.checks.push({name,passed:Boolean(passed),details});if(!passed)console.error("REST_POSE_RESTART_FAIL="+name,JSON.stringify(details))};
 const statePath=process.env.SAEED_CI_REST_POSE_STATE;
 const output=process.env.SAEED_CI_REST_POSE_REPORT||path.join(process.cwd(),"dist","ci-rest-pose-"+mode+".json");
 const near=(a,b,tolerance=0.02)=>Number.isFinite(Number(a))&&Number.isFinite(Number(b))&&Math.abs(Number(a)-Number(b))<=tolerance;
 const actualFor=async bone=>{const result=await characterHost.command({action:"status"});return result?.status?.actualBones?.[String(bone||"")]||null};
 try{
  if(!statePath)throw new Error("SAEED_CI_REST_POSE_STATE is required");
  const rig=await characterHost.command({action:"getRig"});
  const bones=Array.isArray(rig?.bones)?rig.bones.map(String):[];
  check("restart-character-rig-loaded",rig?.ok===true&&bones.length>0,{boneCount:bones.length,error:rig?.error||null});
  if(rig?.ok!==true||!bones.length)throw new Error("The packaged character rig is unavailable");
  if(mode==="save"){
   const mappedHead=rig.mapping?.head;
   const bone=String(typeof mappedHead==="string"&&mappedHead?mappedHead:bones.find(name=>/head/i.test(name))||bones[0]||"");
   if(!bone)throw new Error("No actual bone is available for restart acceptance");
   const before=await actualFor(bone);
   if(!before||!before.rotation||!before.position)throw new Error("The selected bone did not expose real rotation and position transforms");
   const expectedRotation={x:0.213,y:-0.119,z:0.077};
   const expectedPosition={x:Number(before.position.x)+0.013,y:Number(before.position.y)+0.017,z:Number(before.position.z)-0.011};
   const rotationSet=await characterHost.command({action:"setBoneRotation",bone,rotation:expectedRotation});
   const positionSet=await characterHost.command({action:"setBonePosition",bone,position:expectedPosition});
   const saved=await characterHost.command({action:"saveRestPose"});
   const after=await actualFor(bone);
   const rotationMatches=Boolean(after?.rotation)&&["x","y","z"].every(axis=>near(after.rotation[axis],expectedRotation[axis]));
   const positionMatches=Boolean(after?.position)&&["x","y","z"].every(axis=>near(after.position[axis],expectedPosition[axis],0.005));
   check("restart-real-bone-rotation-written",rotationSet?.ok===true&&rotationMatches,{bone,rotation:after?.rotation||null});
   check("restart-real-bone-position-written",positionSet?.ok===true&&positionMatches,{bone,position:after?.position||null});
   check("restart-rest-pose-persisted",saved?.ok===true&&saved?.persisted===true&&Boolean(saved?.restPose?.profileId),{persisted:Boolean(saved?.persisted),profileId:saved?.restPose?.profileId||null,error:saved?.restPose?.persistenceError||null});
   if(!rotationMatches||!positionMatches||saved?.persisted!==true)throw new Error("Could not verify the real bone transform and rest pose before process exit");
   fs.mkdirSync(path.dirname(statePath),{recursive:true});
   fs.writeFileSync(statePath,JSON.stringify({schemaVersion:1,bone,expectedRotation:after.rotation,expectedPosition:after.position,profileId:saved.restPose.profileId,createdAt:new Date().toISOString()},null,2)+"\n","utf8");
   check("restart-state-marker-written",fs.existsSync(statePath),{statePath,bone});
  }else if(mode==="verify"){
   const expected=JSON.parse(fs.readFileSync(statePath,"utf8"));
   const bone=String(expected?.bone||"");
   check("restart-state-marker-valid",expected?.schemaVersion===1&&bones.includes(bone)&&Boolean(expected?.expectedRotation)&&Boolean(expected?.expectedPosition),{bone,available:bones.includes(bone)});
   if(expected?.schemaVersion!==1||!bones.includes(bone))throw new Error("Restart marker is invalid or references a missing bone");
   const actual=await actualFor(bone);
   const rotationMatches=Boolean(actual?.rotation)&&["x","y","z"].every(axis=>near(actual.rotation[axis],expected.expectedRotation[axis]));
   const positionMatches=Boolean(actual?.position)&&["x","y","z"].every(axis=>near(actual.position[axis],expected.expectedPosition[axis],0.005));
   const baseline=await characterHost.command({action:"boneRotation",bone});
   const baselineMatches=baseline?.ok===true&&["x","y","z"].every(axis=>near(baseline?.rotation?.[axis],0,0.03));
   check("restart-rotation-survives-fresh-process",rotationMatches,{bone,expected:expected.expectedRotation,actual:actual?.rotation||null});
   check("restart-position-survives-fresh-process",positionMatches,{bone,expected:expected.expectedPosition,actual:actual?.position||null});
   check("restart-rest-pose-baseline-reapplied",baselineMatches,{bone,editorDelta:baseline?.rotation||null});
  }else throw new Error("Unsupported rest-pose restart mode: "+String(mode));
 }catch(error){report.error=String(error?.stack||error);check("restart-acceptance-exception",false,{error:report.error})}
 report.finishedAt=new Date().toISOString();
 report.passed=report.checks.length>0&&report.checks.every(item=>item.passed);
 try{fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n","utf8")}catch(error){report.passed=false;report.error=String(error?.stack||error);console.error("Could not write rest-pose restart report:",report.error)}
 console.log("REST_POSE_RESTART_"+String(mode).toUpperCase()+"="+(report.passed?"PASS":"FAIL"));
 console.log(JSON.stringify(report,null,2));
 setTimeout(()=>app.exit(report.passed?0:1),150);
}

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
  check("unmute-while-hidden-keeps-tts-released",voice.getVoiceMuted()===false&&voice.getTtsReady()===false&&!target.isVisible(),{muted:voice.getVoiceMuted(),ttsReady:voice.getTtsReady(),visible:target.isVisible()});
  await showCharacter();await wait(120);
  check("show-after-hidden-unmute-restores-tts",target.isVisible()&&voice.getTtsReady()===true,{visible:target.isVisible(),ttsReady:voice.getTtsReady()});

  for(let i=1;i<=3;i++){
   await hideCharacter();await wait(80);
   check("hide-character-"+i,!target.isVisible(),{visible:target.isVisible()});
   await showCharacter();await wait(120);
   check("show-character-"+i,target.isVisible(),{visible:target.isVisible()});
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
   const rendered=await target.webContents.executeJavaScript("(()=>{window.saeedShowTranscript(\'CI recognized speech\');const e=document.getElementById(\'saeedTranscriptLabel\');return{text:e?.textContent||\'\',hidden:!!e?.hidden}})()");
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
 setTimeout(()=>app.exit(report.passed?0:1),150);
}


async function runCiCharacterRigBuilder(mode){
 const report={schemaVersion:1,mode,startedAt:new Date().toISOString(),passed:false,checks:[],error:null};
 const check=(name,passed,details={})=>{report.checks.push({name,passed:Boolean(passed),details});if(!passed)console.error("CHARACTER_RIG_BUILDER_FAIL="+name,JSON.stringify(details))};
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const output=process.env.SAEED_CI_RIG_REPORT||path.join(process.cwd(),"dist","ci-character-rig-builder-"+mode+".json");
 const statePath=process.env.SAEED_CI_RIG_STATE;
 const near=(a,b,t=.035)=>Number.isFinite(Number(a))&&Number.isFinite(Number(b))&&Math.abs(Number(a)-Number(b))<=t;
 const getTarget=()=>{const state=getState();return state?.characterWin&&!state.characterWin.isDestroyed()?state.characterWin:null};
 const getSnapshot=async()=>{const win=getTarget();if(!win)throw new Error("Character renderer window is unavailable");return await win.webContents.executeJavaScript("window.saeedCharacterRuntime?.engine?.getDeformationSnapshot?.(2400)||null")};
 const capture=async name=>{const win=getTarget();if(!win)throw new Error("Character renderer window is unavailable for visual capture");const image=await win.webContents.capturePage();const envKey="SAEED_CI_RIG_SCREENSHOT_"+name.toUpperCase().replace(/[^A-Z0-9]/g,"_");const file=process.env[envKey]||path.join(process.cwd(),"dist","ci-character-rig-builder-"+name+".png");fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,image.toPNG());return{file,width:image.getSize().width,height:image.getSize().height,bitmap:image.toBitmap()}};
 const imageDiff=(a,b)=>{if(a.bitmap.length!==b.bitmap.length||!a.bitmap.length)return{changedPixels:0,fraction:0};let changed=0,total=a.bitmap.length/4;for(let i=0;i<a.bitmap.length;i+=4){if(Math.abs(a.bitmap[i]-b.bitmap[i])>18||Math.abs(a.bitmap[i+1]-b.bitmap[i+1])>18||Math.abs(a.bitmap[i+2]-b.bitmap[i+2])>18||Math.abs(a.bitmap[i+3]-b.bitmap[i+3])>18)changed++}return{changedPixels:changed,totalPixels:total,fraction:changed/total}};
 const displacement=(a,b)=>{const map=new Map((a?.samples||[]).map(s=>[s.key,s.p]));let count=0,sum=0,max=0,finite=0;for(const item of b?.samples||[]){const p=map.get(item.key);if(!p||!item.p||p.length!==3)continue;const d=Math.hypot(item.p[0]-p[0],item.p[1]-p[1],item.p[2]-p[2]);if(!Number.isFinite(d))continue;finite++;if(d>.001)count++;sum+=d;max=Math.max(max,d)}return{matchedSamples:finite,displacedVertices:count,meanDisplacement:finite?sum/finite:0,maxDisplacement:max}};
 try{
  const target=getTarget();check("packaged-character-renderer-created",Boolean(target),{exists:Boolean(target)});
  if(!target)throw new Error("Character renderer window did not start");
  if(mode==="save"){

   await wait(350);
   const liveRig=await characterHost.command({action:"getRig"});
   const liveBefore=await getSnapshot();
   check("actual-saeed-glb-has-loaded-skinned-body",liveRig?.ok===true&&liveRig.bones.length>0&&liveBefore?.skinnedMeshCount>0&&liveBefore?.weightedVertices>0,{boneCount:liveRig?.bones?.length||0,skinnedMeshCount:liveBefore?.skinnedMeshCount||0,vertexCount:liveBefore?.vertexCount||0});
   const saeedBeforeShot=await capture("saeed-before");
   const morphResult=await target.webContents.executeJavaScript("(()=>{const e=window.saeedCharacterRuntime?.engine,b=e?.getMorphSnapshot?.(),pose=()=>e?.getCharacterPoseStatus?.()?.bones||{};if(!e||!b)return{ok:false,error:'morph/pose snapshot API unavailable'};const beforePose=pose(),beforeJaw=beforePose.jaw?.rotation||beforePose.mandible?.rotation||null,ok=Boolean(e.setCharacterViseme?.('aa',.65)),a=e.getMorphSnapshot?.(),afterPose=pose(),afterJaw=afterPose.jaw?.rotation||afterPose.mandible?.rotation||null;const changedMorphs=Object.keys(a?.values||{}).filter(k=>Math.abs(Number(a.values[k])-Number(b.values[k]||0))>.1);const jawChanged=Boolean(beforeJaw&&afterJaw&&Math.abs(Number(afterJaw.x)-Number(beforeJaw.x))>.05);e.setCharacterViseme?.('aa',0);return{ok,count:b.count,changedMorphs,jawChanged,beforeJaw,afterJaw,available:b.names.slice(0,40)}})()");
   check("viseme-alias-changes-real-mouth-deformation",morphResult?.ok===true&&(morphResult.changedMorphs?.length>0||morphResult.jawChanged===true),{ok:Boolean(morphResult?.ok),morphCount:morphResult?.count||0,changedMorphs:morphResult?.changedMorphs||[],jawChanged:Boolean(morphResult?.jawChanged),beforeJaw:morphResult?.beforeJaw||null,afterJaw:morphResult?.afterJaw||null,available:morphResult?.available||[],error:morphResult?.error||null});
   await characterHost.command({action:"setUserBusy",value:true});
   const liveMotion=await characterHost.command({action:"play",motion:"wave",options:{priority:100,blend:.01}});
   await wait(700);
   const liveAfter=await getSnapshot(),liveDelta=displacement(liveBefore,liveAfter),saeedAfterShot=await capture("saeed-after"),saeedVisual=imageDiff(saeedBeforeShot,saeedAfterShot);
   check("actual-saeed-motion-deforms-real-skinned-vertices",liveMotion?.ok===true&&liveDelta.displacedVertices>0&&liveDelta.maxDisplacement>.003,{ok:Boolean(liveMotion?.ok),...liveDelta});
   check("actual-saeed-body-visually-changes-during-motion",liveMotion?.ok===true&&saeedVisual.fraction>.001&&saeedVisual.changedPixels>50,{...saeedVisual,before:saeedBeforeShot.file,after:saeedAfterShot.file});
   await characterHost.command({action:"stopAll"});
   await characterHost.command({action:"setUserBusy",value:false});

   const fixture=process.env.SAEED_CI_RIG_FIXTURE;
   if(!fixture||!fs.existsSync(fixture))throw new Error("SAEED_CI_RIG_FIXTURE must point to a generated static humanoid GLB");
   const loaded=await characterHost.replaceCharacterForCi(fixture);
   check("static-humanoid-glb-loaded-in-real-renderer",loaded?.ok===true&&Number(loaded?.meshCount)>=8,{ok:Boolean(loaded?.ok),meshCount:loaded?.meshCount||0,boneCount:loaded?.boneCount||0,error:loaded?.error||null});
   if(loaded?.ok!==true)throw new Error("Static humanoid fixture failed actual packaged renderer loading: "+String(loaded?.error||"unknown"));
   await wait(350);
   const initial=await target.webContents.executeJavaScript("window.saeedCharacterRuntime?.engine?.get3DStatus?.()||null");
   check("static-mesh-is-rendered-before-rigging",Boolean(initial?.character?.loaded)&&Number(initial?.metrics?.renderCount)>0,{loaded:Boolean(initial?.character?.loaded),renderCount:initial?.metrics?.renderCount||0});
   const beforeBuild=await getSnapshot();
   check("unrigged-fixture-has-static-meshes",Boolean(beforeBuild)&&beforeBuild.skinnedMeshCount===0&&beforeBuild.meshCount>=8,{skinnedMeshCount:beforeBuild?.skinnedMeshCount||0,meshCount:beforeBuild?.meshCount||0,vertexCount:beforeBuild?.vertexCount||0});
   const built=await characterHost.command({action:"buildProceduralRig",template:"full",options:{face:true,fingers:true}});
   const builtBones=Array.isArray(built?.bones)?built.bones:[];
   const expectedBoneNames=["head","jaw","leftEye","rightEye","leftUpperArm","leftForeArm","leftThigh","leftShin","leftThumb1","rightPinky4"];
   check("procedural-rig-builds-real-skeleton",built?.ok===true&&Number(built?.createdBoneCount)>=60&&Number(built?.meshCount)>=8,{ok:Boolean(built?.ok),createdBoneCount:built?.createdBoneCount||0,meshCount:built?.meshCount||0,mappedSlots:built?.mappedSlots||0,error:built?.error||null});
   check("face-and-finger-bone-chains-created",expectedBoneNames.every(n=>builtBones.includes(n)),{expected:expectedBoneNames,missing:expectedBoneNames.filter(n=>!builtBones.includes(n))});
   check("procedural-rig-profile-persisted",built?.persisted===true,{persisted:Boolean(built?.persisted)});
   if(built?.ok!==true)throw new Error("Procedural rig builder did not produce a skeleton");
   const rig=await characterHost.command({action:"getRig"});
   check("generated-bones-are-visible-through-character-api",rig?.ok===true&&rig.bones.length>=60,{ok:Boolean(rig?.ok),boneCount:rig?.bones?.length||0,mappedSlots:Object.keys(rig?.mapping||{}).length});
   const afterBuild=await getSnapshot();
   check("generated-meshes-are-skinned-and-weighted",Boolean(afterBuild?.ok)&&afterBuild.skinnedMeshCount>=8&&afterBuild.weightedVertices>0&&afterBuild.invalidWeightSums===0&&afterBuild.nonFiniteWeights===0&&afterBuild.nonFinitePositions===0&&afterBuild.finiteBounds===true,{skinnedMeshCount:afterBuild?.skinnedMeshCount||0,meshCount:afterBuild?.meshCount||0,vertexCount:afterBuild?.vertexCount||0,sampleCount:afterBuild?.sampleCount||0,weightedVertices:afterBuild?.weightedVertices||0,invalidWeightSums:afterBuild?.invalidWeightSums||0,nonFiniteWeights:afterBuild?.nonFiniteWeights||0,nonFinitePositions:afterBuild?.nonFinitePositions||0,finiteBounds:Boolean(afterBuild?.finiteBounds),bounds:afterBuild?.bounds||null});
   if(!afterBuild?.ok)throw new Error("Skinned geometry snapshot was unavailable");
   const beforeShot=await capture("before");
   const joints=[{bone:"leftUpperArm",rotation:{x:0,y:0,z:.36}},{bone:"leftForeArm",rotation:{x:0,y:0,z:.62}},{bone:"leftThigh",rotation:{x:0,y:0,z:.28}},{bone:"leftShin",rotation:{x:0,y:0,z:.34}}];
   const jointResults=[];
   for(const joint of joints){
    await characterHost.command({action:"stopAll"});
    const set=await characterHost.command({action:"setBoneRotation",bone:joint.bone,rotation:joint.rotation});
    await wait(100);
    const moved=await getSnapshot();
    const delta=displacement(afterBuild,moved);
    const passed=set?.ok===true&&delta.matchedSamples>0&&delta.displacedVertices>0&&delta.maxDisplacement>.003;
    jointResults.push({bone:joint.bone,passed,rotation:joint.rotation,...delta});
    check("joint-deformation-"+joint.bone,passed,jointResults[jointResults.length-1]);
    await characterHost.command({action:"setBoneRotation",bone:joint.bone,rotation:{x:0,y:0,z:0}});
   }
   const elbow=await characterHost.command({action:"setBoneRotation",bone:"leftForeArm",rotation:{x:0,y:0,z:.62}});
   await wait(150);
   await target.webContents.executeJavaScript("window.saeedCharacterRuntime?.engine?.wakeRender?.(1800);true");
   await wait(400);
   const posed=await getSnapshot(),deform=displacement(afterBuild,posed),afterShot=await capture("after"),visual=imageDiff(beforeShot,afterShot);
   check("vertex-positions-change-under-skinning",deform.matchedSamples>0&&deform.displacedVertices>0&&deform.maxDisplacement>.003,{...deform});
   check("visual-render-changes-after-joint-pose",elbow?.ok===true&&visual.fraction>.001&&visual.changedPixels>50,{...visual,before:beforeShot.file,after:afterShot.file});
   const weightQuality=afterBuild.vertexCount>0?afterBuild.invalidWeightSums/afterBuild.vertexCount:1;
   check("skin-weight-quality-within-tolerance",afterBuild.vertexCount>0&&weightQuality<=.01&&afterBuild.nonFiniteWeights===0&&afterBuild.nonFinitePositions===0,{invalidWeightSums:afterBuild.invalidWeightSums,vertexCount:afterBuild.vertexCount,invalidRatio:weightQuality});
   const motionId="ci-avatar-agent-wave-persistence";
   const define=await characterHost.command({action:"defineMotion",motion:{id:motionId,duration:1,loop:false,layer:"body",keyframes:[{time:0,pose:{head:{x:0,y:0,z:0},leftForeArm:{x:0,y:0,z:0}}},{time:1,pose:{head:{x:.18,y:0,z:0},leftForeArm:{x:0,y:0,z:.42}}}]}});
   check("custom-motion-created-through-real-engine",define?.ok===true&&define?.motion?.id===motionId,{ok:Boolean(define?.ok),motionId:define?.motion?.id||null});
   const motionPlay=await characterHost.command({action:"play",motion:motionId,options:{priority:100,blend:.01}});
   await wait(450);
   const motionSnapshot=await getSnapshot();
   const motionDelta=displacement(afterBuild,motionSnapshot);
   check("custom-motion-changes-real-skinned-vertices",motionPlay?.ok===true&&motionDelta.displacedVertices>0&&motionDelta.maxDisplacement>.003,{ok:Boolean(motionPlay?.ok),...motionDelta});
   await characterHost.command({action:"stopAll"});
   const saveBone=await characterHost.command({action:"setBoneRotation",bone:"leftForeArm",rotation:{x:0,y:0,z:.62}});
   const savedPose=await characterHost.command({action:"saveRestPose"});
   const status=await characterHost.command({action:"status"});
   const actual=status?.status?.actualBones?.leftForeArm?.rotation||null;
   check("actual-joint-pose-saved-as-persistent-rest-pose",saveBone?.ok===true&&savedPose?.ok===true&&savedPose?.persisted===true&&savedPose?.restPose?.persisted===true&&actual&&near(actual.z,.62),{bone:"leftForeArm",rotation:actual,persisted:Boolean(savedPose?.persisted),profileId:savedPose?.restPose?.profileId||null,error:savedPose?.restPose?.persistenceError||savedPose?.error||null});
   const finalRig=await characterHost.command({action:"getRig"});
   const finalNames=Array.isArray(finalRig?.bones)?finalRig.bones:[];
   const finalMapping=finalRig?.mapping||{};
   const mappedSlot=Object.keys(finalMapping).find(k=>finalMapping[k]==="head")||"head";
   const state={schemaVersion:1,fixture:path.basename(fixture),template:"full",options:{face:true,fingers:true},expectedBones:builtBones,expectedBoneCount:built?.createdBoneCount||0,expectedPose:{bone:"leftForeArm",rotation:actual},motionId,expectedMotionSlots:["head","leftForeArm"],expectedMeshCount:built?.meshCount||0,expectedWeightQuality:{invalidWeightSums:afterBuild.invalidWeightSums,vertexCount:afterBuild.vertexCount},screenshots:{before:beforeShot.file,after:afterShot.file},visualDiff:visual,createdAt:new Date().toISOString()};
   if(!statePath)throw new Error("SAEED_CI_RIG_STATE is required");
   fs.mkdirSync(path.dirname(statePath),{recursive:true});fs.writeFileSync(statePath,JSON.stringify(state,null,2)+"\n","utf8");
   check("restart-marker-written",fs.existsSync(statePath),{statePath,boneCount:state.expectedBoneCount,motionId});
   check("rig-api-and-status-return-finite-bone-data",finalNames.length>=60&&Boolean(status?.status?.actualBones?.leftForeArm),{boneCount:finalNames.length,headSlot:mappedSlot});
  }else if(mode==="verify"){
   if(!statePath||!fs.existsSync(statePath))throw new Error("Rig builder restart state marker is missing");
   const saved=JSON.parse(fs.readFileSync(statePath,"utf8"));
   await wait(500);
   const rig=await characterHost.command({action:"getRig"});
   const bones=Array.isArray(rig?.bones)?rig.bones:[];
   const missing=(saved.expectedBones||[]).filter(n=>!bones.includes(n));
   check("procedural-rig-restored-after-new-process",rig?.ok===true&&missing.length===0&&bones.length>=saved.expectedBoneCount,{ok:Boolean(rig?.ok),expectedBoneCount:saved.expectedBoneCount,actualBoneCount:bones.length,missingBones:missing.slice(0,25)});
   const snapshot=await getSnapshot();
   check("restored-rig-has-real-skinned-geometry",Boolean(snapshot?.ok)&&snapshot.skinnedMeshCount>=saved.expectedMeshCount&&snapshot.invalidWeightSums===0&&snapshot.nonFiniteWeights===0&&snapshot.nonFinitePositions===0,{skinnedMeshCount:snapshot?.skinnedMeshCount||0,expectedMeshCount:saved.expectedMeshCount,vertexCount:snapshot?.vertexCount||0,invalidWeightSums:snapshot?.invalidWeightSums||0,nonFiniteWeights:snapshot?.nonFiniteWeights||0,nonFinitePositions:snapshot?.nonFinitePositions||0});
   const status=await characterHost.command({action:"status"});
   const actual=status?.status?.actualBones?.[saved.expectedPose?.bone]?.rotation||null,expected=saved.expectedPose?.rotation||{};
   check("saved-rest-pose-survives-full-app-restart",actual&&["x","y","z"].every(axis=>near(actual[axis],expected[axis],.05)),{bone:saved.expectedPose?.bone,expected,actual});
   const baseline=await characterHost.command({action:"boneRotation",bone:saved.expectedPose?.bone});
   check("rest-pose-is-new-baseline-not-original-pose",baseline?.ok===true&&baseline.rotation&&["x","y","z"].every(axis=>near(baseline.rotation[axis],0,.05)),{bone:saved.expectedPose?.bone,editorDelta:baseline?.rotation||null});
   const motions=await characterHost.command({action:"listMotions"});
   const savedMotion=(motions?.motions||[]).find(m=>m?.id===saved.motionId);
   check("custom-motion-survives-full-app-restart",Boolean(savedMotion)&&Array.isArray(savedMotion.keyframes)&&savedMotion.keyframes.length>=2,{motionId:saved.motionId,found:Boolean(savedMotion),keyframes:savedMotion?.keyframes?.length||0});
   if(savedMotion){
    await characterHost.command({action:"setBoneRotation",bone:"leftForeArm",rotation:{x:0,y:0,z:0}});
    const play=await characterHost.command({action:"play",motion:saved.motionId,options:{priority:100,blend:.01}});
    await wait(450);
    const moved=await getSnapshot(),delta=displacement(snapshot,moved);
    check("restarted-motion-still-drives-real-bones",play?.ok===true&&delta.displacedVertices>0&&delta.maxDisplacement>.003,{ok:Boolean(play?.ok),...delta});
    await characterHost.command({action:"stopAll"});
   }
   const verifyShot=await capture("restart");
   check("restart-visual-screenshot-captured",verifyShot.width>0&&verifyShot.height>0,{file:verifyShot.file,width:verifyShot.width,height:verifyShot.height});
  }else throw new Error("Unsupported Character Engine/Rig Builder test mode: "+mode);
 }catch(error){report.error=String(error?.stack||error);check("character-rig-builder-exception",false,{error:report.error})}
 report.finishedAt=new Date().toISOString();
 report.passed=report.checks.length>0&&report.checks.every(item=>item.passed);
 try{fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n","utf8")}catch(error){report.passed=false;report.error=String(error?.stack||error);console.error("Could not write Character Engine/Rig Builder report:",report.error)}
 console.log("CHARACTER_ENGINE_RIG_BUILDER_"+String(mode).toUpperCase()+"="+(report.passed?"PASS":"FAIL"));
 console.log(JSON.stringify(report,null,2));
 setTimeout(()=>app.exit(report.passed?0:1),200);
}

async function createWindow(){await createCharacterWindow()}
