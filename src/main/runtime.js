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
  const desiredRestRotation={x:0.123,y:0.087,z:-0.061};
  const editedBone=restPoseBone?await characterHost.command({action:"setBoneRotation",bone:restPoseBone,rotation:desiredRestRotation}):{ok:false,error:"No bone available"};
  const editRotation=editedBone?.rotation||{};
  const boneEditPassed=editedBone?.ok===true&&["x","y","z"].every(axis=>Number.isFinite(Number(editRotation[axis]))&&Math.abs(Number(editRotation[axis])-desiredRestRotation[axis])<0.02);
  check("rest-pose-real-bone-edit-applied",boneEditPassed,{bone:restPoseBone,rotation:editRotation,error:editedBone?.error||null});
  const rest=await characterHost.command({action:"saveRestPose"});
  check("rest-pose-persistent-readback",rest?.ok===true&&rest?.persisted===true&&rest?.restPose?.persisted===true,{persisted:Boolean(rest?.persisted),profileId:rest?.restPose?.profileId||null,error:rest?.restPose?.persistenceError||null});
  await hideCharacter();await wait(100);await showCharacter();await wait(250);
  const restoredBone=restPoseBone?await characterHost.command({action:"boneRotation",bone:restPoseBone}):{ok:false};
  const restoredRotation=restoredBone?.rotation||{};
  const restPoseReloadPassed=restoredBone?.ok===true&&["x","y","z"].every(axis=>Number.isFinite(Number(restoredRotation[axis]))&&Math.abs(Number(restoredRotation[axis]))<0.03);
  check("rest-pose-reapplied-after-character-runtime-reload",restPoseReloadPassed,{bone:restPoseBone,editorDelta:restoredRotation,ok:Boolean(restoredBone?.ok)});
  const invalidCandidatePath=path.join(app.getPath("userData"),"ci-invalid-character-candidate.glb");
  try{
   fs.writeFileSync(invalidCandidatePath,Buffer.from("not-a-valid-glb"));
   const invalidCandidate=await characterHost.replaceCharacterForCi(invalidCandidatePath);
   const rigAfterInvalid=await characterHost.command({action:"getRig"});
   check("invalid-glb-rejected-preserves-current-character",invalidCandidate?.ok!==true&&rigAfterInvalid?.ok===true&&rigAfterInvalid?.bones?.length===rig.bones.length,{rejected:invalidCandidate?.ok!==true,error:invalidCandidate?.error||null,bonesBefore:rig.bones.length,bonesAfter:rigAfterInvalid?.bones?.length||0});
  }catch(error){check("invalid-glb-rejected-preserves-current-character",false,{error:error?.message||String(error)})}
  finally{try{fs.unlinkSync(invalidCandidatePath)}catch{}}
  const motionSlot=typeof rig.mapping?.head==="string"&&rig.mapping.head?"head":Object.keys(rig.mapping||{}).find(slot=>typeof rig.mapping[slot]==="string"&&rig.bones.includes(rig.mapping[slot]));
  const motionBone=String(motionSlot?rig.mapping[motionSlot]:"");
  const motionId="ci-generated-motion-acceptance";
  const motionStatus=await characterHost.command({action:"status"});
  const initialMotionRotation=motionStatus?.status?.actualBones?.[motionBone]?.rotation||null;
  const makeCiMotion=angle=>({id:motionId,duration:1,loop:false,layer:"body",keyframes:[{time:0,pose:{[motionSlot]:{x:0,y:0,z:0}}},{time:1,pose:{[motionSlot]:{x:angle,y:0,z:0}}}]});
  let motionFirstRotation=null,motionEditedRotation=null;
  try{
   await characterHost.command({action:"stopAll"});
   const defined=motionSlot?await characterHost.command({action:"defineMotion",motion:makeCiMotion(0.35)}):{ok:false,error:"No mapped logical slot"};
   check("generated-motion-created",defined?.ok===true&&defined?.motion?.id===motionId,{slot:motionSlot||null,bone:motionBone,error:defined?.error||null});
   const played=defined?.ok===true?await characterHost.command({action:"play",motion:motionId,options:{priority:100,blend:0.01}}):{ok:false};
   await wait(300);
   const afterFirst=await characterHost.command({action:"status"});
   motionFirstRotation=afterFirst?.status?.actualBones?.[motionBone]?.rotation||null;
   const firstMoved=played?.ok===true&&Boolean(initialMotionRotation&&motionFirstRotation)&&Math.abs(Number(motionFirstRotation.x)-Number(initialMotionRotation.x))>0.015;
   check("generated-motion-changes-real-bone",firstMoved,{slot:motionSlot||null,bone:motionBone,before:initialMotionRotation,after:motionFirstRotation,played:Boolean(played?.ok)});
   await characterHost.command({action:"stopAll"});
   const edited=motionSlot?await characterHost.command({action:"defineMotion",motion:makeCiMotion(-0.55)}):{ok:false};
   const playedEdited=edited?.ok===true?await characterHost.command({action:"play",motion:motionId,options:{priority:100,blend:0.01}}):{ok:false};
   await wait(300);
   const afterEdited=await characterHost.command({action:"status"});
   motionEditedRotation=afterEdited?.status?.actualBones?.[motionBone]?.rotation||null;
   const editedMoved=playedEdited?.ok===true&&Boolean(initialMotionRotation&&motionEditedRotation&&motionFirstRotation)&&Math.abs(Number(motionEditedRotation.x)-Number(initialMotionRotation.x))>0.015&&Math.abs(Number(motionEditedRotation.x)-Number(motionFirstRotation.x))>0.025;
   check("edited-motion-changes-real-bone-differently",editedMoved,{slot:motionSlot||null,bone:motionBone,first:motionFirstRotation,edited:motionEditedRotation,played:Boolean(playedEdited?.ok)});
  }catch(error){check("generated-motion-and-edit-playback",false,{error:error?.message||String(error)})}
  finally{
   try{await characterHost.command({action:"stopAll"})}catch{}
   try{await characterHost.command({action:"deleteMotion",id:motionId})}catch{}
  }
  const motionList=await characterHost.command({action:"listMotions"});
  check("generated-motion-cleaned-up",Array.isArray(motionList?.motions)&&!motionList.motions.some(m=>m?.id===motionId),{remaining:motionList?.motions?.filter(m=>m?.id===motionId).length||0});
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

async function createWindow(){await createCharacterWindow()}
