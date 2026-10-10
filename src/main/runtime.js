const {app,BrowserWindow,ipcMain,globalShortcut,desktopCapturer,Tray,Menu,screen,dialog,nativeImage,session}=require("electron");
const path=require("path"),fs=require("fs"),{spawn}=require("child_process");
const ciSmoke=process.env.SAEED_CI_SMOKE==="1"||process.argv.includes("--ci-smoke");
if(ciSmoke){app.commandLine.appendSwitch("use-fake-device-for-media-stream");app.commandLine.appendSwitch("use-fake-ui-for-media-stream");}
function ciWriteE2EStartup(stage,meta={}){
 if(!process.argv.includes("--ci-e2e"))return;
 try{
  const target=String(process.env.SAEED_CI_E2E_REPORT||path.join(process.cwd(),"dist","ci-e2e-report.json"))+".startup.json";
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,JSON.stringify({stage,time:new Date().toISOString(),pid:process.pid,argv:process.argv,appReady:app.isReady(),appPath:app.isReady()?app.getAppPath():null,resourcesPath:process.resourcesPath,...meta},null,2),"utf8");
 }catch(e){console.error("CI E2E startup report write failed:",e)}
}
function ciWriteStartupReport(kind,error){
 if(!ciSmoke)return;
 try{
  const target=process.env.SAEED_CI_REPORT||path.join(process.cwd(),"dist","ci-runtime-report.json");
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,JSON.stringify({kind,time:new Date().toISOString(),argv:process.argv,appPath:app.isReady()?app.getAppPath():null,resourcesPath:process.resourcesPath,error:error?String(error?.stack||error):null},null,2),"utf8");
 }catch(writeError){console.error("CI startup report write failed:",writeError)}
}
process.on("uncaughtException",e=>{console.error("Saeed uncaught:",e);ciWriteStartupReport("uncaughtException",e);ciWriteE2EStartup("uncaughtException",{error:String(e?.stack||e)})});
process.on("unhandledRejection",e=>{console.error("Saeed rejection:",e);ciWriteStartupReport("unhandledRejection",e);ciWriteE2EStartup("unhandledRejection",{error:String(e?.stack||e)})});
if(ciSmoke)ciWriteStartupReport("bootstrap-loaded");
ciWriteE2EStartup("process-start");
// Startup contract: only Electron + the character surface are eager.
// Brain, voice runtime, chat, capture, updater and secondary feature modules are lazy.
const lazy={};
const load=(key,modulePath)=>lazy[key]||(lazy[key]=require(modulePath));


// Explicit Electron microphone permission handling for the user-controlled microphone lifecycle.
// Chromium must be allowed to request/use media audio before getUserMedia can open the device.
function configureMediaPermissions(){
 try{
  session.defaultSession.setPermissionCheckHandler((webContents,permission,origin,details)=>{
   return permission==="media";
  });
  session.defaultSession.setPermissionRequestHandler((webContents,permission,callback,details)=>{
   if(permission==="media"){diagnostic("INFO","MIC PERMISSION","Electron granted media permission",details||{});callback(true);return;}
   callback(false);
  });
  diagnostic("INFO","MIC PERMISSION","Electron microphone/media permission handlers configured");
 }catch(e){diagnostic("ERROR","MIC PERMISSION",e.message)}
}


let characterWin,performanceWin,settingsWin,addonsWin,learningWin,restPoseEditorWin,normalizeHumanoidRestPoseWin,agent,tray,statusWin,threeDStatusWin;
let addonService,learning,learningRecorder,apiHealth,resourceService,autoUpdater;
let chatHost=null,voiceHost=null,brainHost=null,screenCapture=null,windowManager=null,updateManager=null,characterHost,ciE2E=null;

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
const singleInstanceLock=ciSmoke?true:app.requestSingleInstanceLock();
if(!singleInstanceLock)app.quit();
else if(!ciSmoke)app.on("second-instance",(event,commandLine)=>{setTimeout(()=>handleLaunchArgs(commandLine.slice(1)),100);});

function scheduleCiRuntimeSmoke(){if(!ciSmoke)return;setTimeout(()=>void runCiRuntimeSmoke(),1500)}

let ciRuntime;
function initCiE2E(suite="all"){const key=String(suite||"all");if(ciE2E&&ciE2E.suite===key)return ciE2E;const {createCiE2E}=require("./ci-e2e");ciE2E=createCiE2E({app,getCharacterWindow:()=>characterWin,getChatHost:ensureChatHost,getAgent:()=>agent,getTray:()=>tray,getBrainActive:()=>composition.ensureBrainHost?.().isActive?.(),ensureBrain,releaseBrainIfIdle,setMicMode,setVoiceMuted,getVoiceMuted,getVoiceHost:ensureVoiceHost,characterHost,getPerformanceWindow:()=>performanceWin,showPerformance,getSettingsWindow:()=>settingsWin,getAddonsWindow:()=>addonsWin,getLearningWindow:()=>learningWin,getStatusWindow:()=>statusWin,getRestPoseEditorWindow:()=>restPoseEditorWin,getNormalizeHumanoidRestPoseWindow:()=>normalizeHumanoidRestPoseWin,showSettings,showAddons,showLearning,showStatus,showRestPoseEditor:composition.showRestPoseEditor,showNormalizeHumanoidRestPose:composition.showNormalizeHumanoidRestPose});ciE2E.suite=key;return ciE2E;}
function initCiRuntime(){if(ciRuntime)return ciRuntime;const {createCiRuntime}=require("./ci-runtime");ciRuntime=createCiRuntime({ciSmoke,app,getCharacterWindow:()=>characterWin,getTray:()=>tray,getAgent:()=>agent,getBrainSupervisor:()=>null,getCurrentMicMode,resourceService:getResourceService(),addons:getAddonService(),learning:getLearning(),OpenAIRealtime:require("../realtime").OpenAIRealtime,request3DStatus,apiHealth:getApiHealth(),diagnosticState,voiceRuntime:ensureVoiceHost().getVoiceRuntime(),transcribeLocalWav:ensureVoiceHost().transcribeLocalWav,whisperRuntimePaths:ensureVoiceHost().whisperRuntimePaths,ensureBrain});return ciRuntime;}
async function runCi3DBaseline(){return initCiRuntime().runCi3DBaseline()}
async function runCiRuntimeSmoke(){return initCiRuntime().runCiRuntimeSmoke()}



app.whenReady().then(async()=>{app.isQuitting=false;configureMediaPermissions();ciWriteStartupReport("ready");ciWriteE2EStartup("app-ready");diagnostic("INFO","APPLICATION","Diagnostics system started");if(ciSmoke)getResourceService().startResourceProbe();
 try{tray=new Tray(trayIcon());tray.setToolTip("Saeed AI");rebuildTray(tray)}catch(e){console.error("Tray failed:",e)}
 try{ciWriteE2EStartup("create-window-start");await createWindow();ciWriteE2EStartup("create-window-complete");if(characterWin&&!getVoiceMuted()&&!ciSmoke&&!process.argv.includes("--ci-e2e"))ensureVoiceHost().ensureTts()}catch(e){console.error("Saeed startup failed:",e);ciWriteStartupReport("startup-failed",e);ciWriteE2EStartup("startup-failed",{error:String(e?.stack||e)});app.quit();return}
 // Windows Jump List disabled to avoid Electron runtime incompatibility in the CI/build environment.
 if(process.argv.includes("--exit")||process.argv.includes("--show-saeed")||process.argv.includes("--3d-status")||process.argv.includes("--chat")||process.argv.includes("--performance")||process.argv.includes("--settings")||process.argv.includes("--addons")||process.argv.includes("--learning")||process.argv.includes("--status")||process.argv.includes("--mic-on")||process.argv.includes("--mic-off")||process.argv.includes("--ci-e2e")||process.argv.some(x=>x.startsWith("--size-"))){ciWriteE2EStartup("launch-args");handleLaunchArgs(process.argv.slice(1));}

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
ipcMain.handle("email:credential:store",async(_,provider,account,username,password)=>{const p=String(provider||"").trim().toLowerCase(),a=String(account||"").trim(),u=String(username||"").trim(),secret=String(password||"");if(!["gmail","yahoo","hotmail","custom"].includes(p))throw new Error("Unsupported email provider");if(!a||a.length>254||/[\r\n\0]/.test(a))throw new Error("Invalid email account key");if(!u||u.length>254||/[\r\n\0]/.test(u))throw new Error("Invalid email username");if(!secret||secret.length>4096)throw new Error("Password/app password is required");const stored=await require("../addons/credentials").set(p,a,u,secret);diagnostic("INFO","EMAIL CREDENTIAL","Email credential saved to Windows Credential Manager",{provider:p});return{ok:Boolean(stored?.stored),provider:p,account:a,stored:Boolean(stored?.stored)}});ipcMain.handle("email:account:save",async(_,record={})=>{const store=require("../addons/email-account-store"),saved=store.save(app.getPath("userData"),record);diagnostic("INFO","EMAIL SERVER SETTINGS","Email server settings saved",{provider:saved.provider,account:saved.account,protocol:record.protocol});return{ok:true,account:saved}});ipcMain.handle("email:account:get",(_,provider,account)=>({ok:true,account:require("../addons/email-account-store").get(app.getPath("userData"),provider,account)}));ipcMain.handle("email:connection:test",async(_,record={})=>{const store=require("../addons/email-account-store"),email=require("../addons/email"),credentials=require("../addons/credentials"),client=require("../addons/email-client"),provider=String(record.provider||"").trim().toLowerCase(),protocol=String(record.protocol||"").trim().toLowerCase(),account=String(record.account||"").trim();if(!account)throw new Error("Enter the email account key before testing the server");const profile=store.get(app.getPath("userData"),provider,account),savedServer=profile?.servers?.[protocol]||{},defaults=email.provider(provider)[protocol]||{},validated=store.validateRecord({provider,account,protocol,host:record.host||savedServer.host||defaults.host,port:record.port||savedServer.port||defaults.port,tls:record.tls===undefined?(savedServer.tls===undefined?defaults.tls:savedServer.tls):record.tls,startTls:record.startTls===undefined?(savedServer.startTls===undefined?defaults.startTls:savedServer.startTls):record.startTls}),saved=await credentials.get(provider,account);if(!saved||!String(saved.username||"").trim()||(!String(saved.password||"")&&!String(saved.accessToken||"")))throw new Error("Save the account credentials before testing protocol authentication");const config={...defaults,...savedServer,...validated,username:saved.username,password:saved.password,accessToken:saved.accessToken};if(protocol==="imap")await client.imapLogin(config);else if(protocol==="pop3")await client.pop3ListMessages(config);else await client.smtpVerify(config);const transport=validated.startTls?"SMTP STARTTLS authenticated":validated.tls?"TLS and protocol authentication succeeded":"Protocol authentication succeeded";diagnostic("INFO","EMAIL CONNECTION TEST","Email protocol authentication succeeded",{provider,protocol,host:validated.host,port:validated.port,authenticated:true,transport});return{ok:true,connected:true,authenticated:true,provider,protocol,host:validated.host,port:validated.port,transport}});ipcMain.handle("settings:get",()=>{if(agent)return agent.publicSettings();const {createSettingsStore}=require("./services/settings-store");const store=createSettingsStore(app.getPath("userData"));return store.public(store.load())});ipcMain.on("character:activity",()=>{});
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


app.on("activate",()=>{if(characterWin&&!characterWin.isDestroyed()){showCharacter();return}createWindow().catch(e=>diagnostic("ERROR","APPLICATION ACTIVATE",e.message))});
app.on("window-all-closed",()=>{if(app.isQuitting)return;diagnostic("INFO","WINDOW LIFECYCLE","All windows closed; Saeed remains alive in the tray")});
app.on("before-quit",()=>{try{captureCharacter3DWindowSettings()}catch{};app.isQuitting=true;try{voiceHost?.stopVoiceServices?.("app quit")}catch{};try{learningRecorder?.stop?.()}catch{};for(const win of [getChatWindow(),performanceWin,settingsWin,addonsWin,learningWin,restPoseEditorWin,statusWin,threeDStatusWin,characterWin])try{if(win&&!win.isDestroyed())win.destroy()}catch{};try{if(tray){tray.destroy();tray=null}}catch{}});
app.on("will-quit",()=>{globalShortcut.unregisterAll();try{voiceHost?.stopVoiceServices?.("app quit")}catch{}});

function handleLaunchArgs(args=[]){const a=args.map(String);if(a.includes("--exit"))return app.quit();if(a.includes("--show-saeed"))return showCharacter();if(a.includes("--chat"))return ensureChatHost().showChat();if(a.includes("--performance"))return showPerformance();if(a.includes("--settings"))return showSettings();if(a.includes("--addons"))return showAddons();if(a.includes("--learning"))return showLearning();if(a.includes("--status"))return showStatus();if(a.includes("--3d-status"))return show3DStatus();if(a.includes("--mic-on"))return setMicMode("on");if(a.includes("--mic-off"))return setMicMode("off");if(a.includes("--size-small"))return setSaeedSize("small");if(a.includes("--size-medium"))return setSaeedSize("medium");if(a.includes("--size-large"))return setSaeedSize("large");if(a.includes("--ci-e2e")){const arg=a.find(x=>x.startsWith("--ci-e2e-suite="));const suite=arg?arg.split("=")[1]:(process.env.SAEED_CI_E2E_SUITE||"all");ciWriteE2EStartup("ci-e2e-start",{suite});return initCiE2E(suite).run().then(r=>{console.log("SAEED_CI_E2E",JSON.stringify({suite:r.suite,pass:r.pass,checks:Object.fromEntries(Object.entries(r.checks||{}).map(([k,v])=>[k,v?.pass]))}));return app.quit()});}return showCharacter()}
async function createWindow(){await createCharacterWindow();if(ciSmoke)scheduleCiRuntimeSmoke()}
