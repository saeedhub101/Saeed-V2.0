const {app,BrowserWindow,ipcMain,globalShortcut,desktopCapturer,Tray,Menu,screen,dialog,nativeImage,session}=require("electron");
const path=require("path"),fs=require("fs"),{spawn}=require("child_process");
const ciSmoke=process.env.SAEED_CI_SMOKE==="1"||process.argv.includes("--ci-smoke");
if(ciSmoke){app.commandLine.appendSwitch("use-fake-device-for-media-stream");app.commandLine.appendSwitch("use-fake-ui-for-media-stream");}
function ciWriteStartupReport(kind,error){
 if(!ciSmoke)return;
 try{
  const target=process.env.SAEED_CI_REPORT||path.join(process.cwd(),"dist","ci-runtime-report.json");
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,JSON.stringify({kind,time:new Date().toISOString(),argv:process.argv,appPath:app.isReady()?app.getAppPath():null,resourcesPath:process.resourcesPath,error:error?String(error?.stack||error):null},null,2),"utf8");
 }catch(writeError){console.error("CI startup report write failed:",writeError)}
}
process.on("uncaughtException",e=>{console.error("Saeed uncaught:",e);ciWriteStartupReport("uncaughtException",e)});
process.on("unhandledRejection",e=>{console.error("Saeed rejection:",e);ciWriteStartupReport("unhandledRejection",e)});
if(ciSmoke)ciWriteStartupReport("bootstrap-loaded");
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


let characterWin,performanceWin,addonsWin,learningWin,agent,tray,statusWin,threeDStatusWin;
let addonService,learning,learningRecorder,apiHealth,resourceService,autoUpdater;
let chatHost=null,voiceHost=null,brainHost=null,screenCapture=null,windowManager=null,updateManager=null,characterHost,ciE2E=null;

const getAddonService=()=>addonService||(addonService=require("./services/addon-service"));
const getLearning=()=>learning||(learning=require("../learning"));
const getLearningRecorder=()=>learningRecorder||(learningRecorder=require("../learning/windows-recorder"));
const getApiHealth=()=>apiHealth||(apiHealth=require("./services/api-health").createApiHealth({getAgent:()=>agent}));
const getResourceService=()=>resourceService||(resourceService=require("./services/resource-service").createResourceService({app,BrowserWindow,process}));
const getAutoUpdater=()=>autoUpdater||(autoUpdater=require("electron-updater").autoUpdater);
const getChatWindow=()=>chatHost?.getChatWindow?.();
const ensureChatHost=()=>chatHost||(chatHost=load("chatHost","./application/chat-host").createChatHost({BrowserWindow,path,Menu,windowsIconPath,diagnostic,ensureBrain,onClose:releaseBrainIfIdle}));
const getCurrentMicMode=()=>voiceHost?.getCurrentMicMode?.()||"off";
const getVoiceMuted=()=>voiceHost?.getVoiceMuted?.()||false;
const ensureVoiceHost=()=>voiceHost||(voiceHost=load("voiceHost","./voice/voice-host").createVoiceHost({app,path,fs,spawn,diagnostic,voiceBroadcast,getAgent:()=>agent,getAddonService,ensureBrain,releaseBrainIfIdle,permissionPolicy,confirmPermission,rebuildTray:()=>rebuildTray(tray),showChat:()=>ensureChatHost().showChat(),getCharacterWindow:()=>characterWin,getChatWindow,getStatusWindow:()=>statusWin,diagnosticState}));
const setMicMode=mode=>ensureVoiceHost().setMicMode(mode);
const setVoiceMuted=muted=>ensureVoiceHost().setVoiceMuted(muted);
const ensureScreenCapture=()=>screenCapture||(screenCapture=load("screenCapture","./application/screen-capture").createScreenCapture({desktopCapturer,permissionPolicy,confirmPermission,diagnostic}));
const captureScreen=()=>ensureScreenCapture().captureScreen();
const {createDiagnostics}=load("diagnostics","./application/diagnostics");
const diagnostics=createDiagnostics({getWindows:()=>({chatWin:getChatWindow(),characterWin,statusWin,performanceWin,threeDStatusWin}),getResourceService});
const {diagnosticState,diagnostic,publish3DStatus,request3DStatus,updateDiagnosticState,startCpuMonitoring,stopCpuMonitoring,updateCpuMetrics,diagnosticFromAgent}=diagnostics;
const {createPermissionManager}=load("permissionManager","./application/permission-manager");
const permissionManager=createPermissionManager({getAgent:()=>agent,showChat:()=>ensureChatHost().showChat(),getChatWindow,diagnostic:(...a)=>diagnostic(...a)});
const {permissionPolicy,confirmPermission,confirmations}=permissionManager;
const voiceBroadcast=(channel,...args)=>{for(const win of [getChatWindow(),characterWin,statusWin,threeDStatusWin])if(win&&!win.isDestroyed())try{win.webContents.send(channel,...args)}catch{}};
const {createCharacterStore}=load("characterStore","./character/character-store");
const characterStore=createCharacterStore({app,path,fs,screen,getCharacterWindow:()=>characterWin,fitCharacterToDisplay:(...args)=>characterHost?.fitCharacterToDisplay?.(...args),diagnostic});
const {character3DSettingsFile,writeCharacter3DSettings,captureCharacter3DWindowSettings}=characterStore;
const {createCharacterHost}=load("characterHost","./character/character-host");
characterHost=createCharacterHost({app,BrowserWindow,dialog,path,fs,screen,diagnostic,windowsIconPath,getCharacterWindow:()=>characterWin,setCharacterWindow:v=>{characterWin=v},getAgent:()=>agent,characterStore,showChat:()=>ensureChatHost().showChat(),permissionPolicy,confirmPermission,contextMenu:()=>contextMenu()});
const {displayForWindow,fitCharacterToDisplay,sendCharacterData,chooseCharacter,setSaeedSize,showCharacter,hideCharacter,createCharacterWindow,characterSizeMenu}=characterHost;
const ensureWindowManager=()=>windowManager||(windowManager=load("windowManager","./application/window-manager").createWindowManager({BrowserWindow,path,getWindow:name=>({performanceWin,learningWin,addonsWin,statusWin}[name]),setWindow:(name,value)=>{if(name==="performanceWin")performanceWin=value;else if(name==="learningWin")learningWin=value;else if(name==="addonsWin")addonsWin=value;else if(name==="statusWin")statusWin=value},iconPath:windowsIconPath,diagnostic,startCpuMonitoring,stopCpuMonitoring,preloadPath:path.join(__dirname,"..","preload.js"),rootPath:path.join(__dirname,"..")}));
const showPerformance=()=>ensureWindowManager().showPerformance();
const showSettings=()=>ensureWindowManager().showSettings();
const showLearning=()=>ensureWindowManager().showLearning();
const showAddons=()=>ensureWindowManager().showAddons();
const ensureUpdateManager=()=>updateManager||(updateManager=load("updateManager","./application/update-manager").createUpdateManager({app,getAutoUpdater,voiceBroadcast,diagnostic}));
const updateNow=()=>ensureUpdateManager().check();
const {createSystemControls}=load("systemControls","./application/system-controls");
const systemControls=createSystemControls({app,diagnostic,showChat:()=>ensureChatHost().showChat(),showCharacter,hideCharacter,showAddons,showLearning,showPerformance,showStatus,show3DStatus,showSettings,setSaeedSize,chooseCharacter,Menu,getCharacterWindow:()=>characterWin,getVoiceMuted,setVoiceMuted,setMicMode,getCurrentMicMode,updateNow});
const {rebuildTray,contextMenu}=systemControls;
const ensureBrainHost=()=>brainHost||(brainHost=load("brainHost","./application/brain-host").createBrainHost({app,getChatWindow,getMicMode:getCurrentMicMode,characterCommand:(payload)=>characterHost.command(payload),permissionPolicy,showChat:()=>ensureChatHost().showChat(),diagnostic,diagnosticFromAgent,voiceBroadcast,captureScreen,getCharacter3DSettingsFile:()=>character3DSettingsFile(),setSaeedSize,setAgent:value=>{agent=value},setVoiceMuted:value=>setVoiceMuted(value),recordLearningStep:()=>{},confirmations,characterSettingsExists:()=>fs.existsSync(character3DSettingsFile())}));
const ensureBrain=(...args)=>ensureBrainHost().ensureBrain(...args);
const releaseBrainIfIdle=()=>!getChatWindow()&&getCurrentMicMode()==="off"?(brainHost?.releaseBrain?.()||true):true;

function show3DStatus(){if(threeDStatusWin&&!threeDStatusWin.isDestroyed()){threeDStatusWin.show();threeDStatusWin.focus();request3DStatus().then(r=>threeDStatusWin?.webContents.send("3d:status",r));return}threeDStatusWin=new BrowserWindow({width:960,height:720,minWidth:760,minHeight:560,title:"Saeed 3D Status",show:false,backgroundColor:"#f5f7fb",icon:windowsIconPath(),webPreferences:{preload:path.join(__dirname,"..","preload.js"),contextIsolation:true,nodeIntegration:false,sandbox:false}});threeDStatusWin.on("closed",()=>{threeDStatusWin=null});threeDStatusWin.loadFile(path.join(__dirname,"..","3d-status.html")).then(async()=>{threeDStatusWin?.show();threeDStatusWin?.focus();const r=await request3DStatus();threeDStatusWin?.webContents.send("3d:status",r)}).catch(e=>diagnostic("ERROR","3D STATUS WINDOW",e.message))}
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

function showStatus(){startCpuMonitoring();if(statusWin&&!statusWin.isDestroyed()){statusWin.show();statusWin.focus();statusWin.webContents.send("diagnostic:snapshot",{state:diagnosticState});return}statusWin=new BrowserWindow({width:880,height:660,minWidth:680,minHeight:500,title:"Saeed Status",show:false,backgroundColor:"#f5f7fb",icon:windowsIconPath(),webPreferences:{preload:path.join(__dirname,"..","preload.js"),contextIsolation:true,nodeIntegration:false,sandbox:false}});statusWin.on("closed",()=>{statusWin=null;stopCpuMonitoring()});statusWin.loadFile(path.join(__dirname,"..","status.html")).then(()=>{statusWin.show();statusWin.webContents.send("diagnostic:snapshot",{state:diagnosticState})}).catch(e=>diagnostic("ERROR","STATUS WINDOW",e.message))}

function scheduleCiRuntimeSmoke(){if(!ciSmoke)return;setTimeout(()=>void runCiRuntimeSmoke(),1500)}

let ciRuntime;
function initCiE2E(){if(ciE2E)return ciE2E;const {createCiE2E}=require("./ci-e2e");ciE2E=createCiE2E({app,getCharacterWindow:()=>characterWin,getChatHost:ensureChatHost,getAgent:()=>agent,getTray:()=>tray,getBrainActive:()=>brainHost?.isActive?.(),ensureBrain,releaseBrainIfIdle,setMicMode,setVoiceMuted,getVoiceMuted,getVoiceHost:ensureVoiceHost,characterHost});return ciE2E;}
function initCiRuntime(){if(ciRuntime)return ciRuntime;const {createCiRuntime}=require("./ci-runtime");ciRuntime=createCiRuntime({ciSmoke,app,getCharacterWindow:()=>characterWin,getTray:()=>tray,getAgent:()=>agent,getBrainSupervisor:()=>null,getCurrentMicMode,resourceService:getResourceService(),addons:getAddonService(),learning:getLearning(),OpenAIRealtime:require("../realtime").OpenAIRealtime,request3DStatus,apiHealth:getApiHealth(),diagnosticState,voiceRuntime:ensureVoiceHost().getVoiceRuntime(),transcribeLocalWav:ensureVoiceHost().transcribeLocalWav,whisperRuntimePaths:ensureVoiceHost().whisperRuntimePaths,ensureBrain});return ciRuntime;}
async function runCi3DBaseline(){return initCiRuntime().runCi3DBaseline()}
async function runCiRuntimeSmoke(){return initCiRuntime().runCiRuntimeSmoke()}



app.whenReady().then(async()=>{app.isQuitting=false;configureMediaPermissions();ciWriteStartupReport("ready");diagnostic("INFO","APPLICATION","Diagnostics system started");if(ciSmoke)getResourceService().startResourceProbe();
 try{await createWindow()}catch(e){console.error("Saeed startup failed:",e);ciWriteStartupReport("startup-failed",e);app.quit();return}
 // Windows Jump List disabled to avoid Electron runtime incompatibility in the CI/build environment.
 if(process.argv.includes("--exit")||process.argv.includes("--show-saeed")||process.argv.includes("--3d-status")||process.argv.includes("--chat")||process.argv.includes("--performance")||process.argv.includes("--settings")||process.argv.includes("--addons")||process.argv.includes("--learning")||process.argv.includes("--status")||process.argv.includes("--mic-on")||process.argv.includes("--mic-off")||process.argv.includes("--ci-e2e")||process.argv.some(x=>x.startsWith("--size-")))handleLaunchArgs(process.argv.slice(1));
 try{tray=new Tray(trayIcon());tray.setToolTip("Saeed AI");rebuildTray(tray)}catch(e){console.error("Tray failed:",e)}

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

ipcMain.on("3d:status-report",(_,requestId,report)=>{publish3DStatus(report)});ipcMain.handle("3d:query",()=>request3DStatus());ipcMain.handle("3d-status:show",()=>{show3DStatus();return true});
ipcMain.handle("settings:get",async()=>{await ensureBrain();return agent.publicSettings()});ipcMain.on("character:activity",()=>{});
ipcMain.handle("diagnostic:report",(_,level,stage,message,meta)=>diagnostic(level,stage,message,meta));ipcMain.handle("diagnostic:snapshot",()=>({state:diagnosticState}));ipcMain.handle("api-status:test",(_,service)=>getApiHealth().test(String(service||"")));ipcMain.handle("api-status:test-all",()=>getApiHealth().testAll());ipcMain.handle("resource:snapshot",()=>getResourceService().resourceReport());ipcMain.handle("cpu:metrics",()=>{updateCpuMetrics();return diagnosticState.cpu});ipcMain.handle("status:show",()=>{showStatus();return true});ipcMain.handle("performance:show",()=>{showPerformance();return true});ipcMain.handle("settings:show",()=>{showPerformance();return true});ipcMain.handle("addons:show",()=>{showAddons();return true});
load("chatIpc","./ipc/chat-ipc").registerChatIpc({ipcMain,ensureBrain,getBrainHost:ensureBrainHost,getAgent:()=>agent,getCharacterWindow:()=>characterWin,getChatHost:()=>chatHost});
load("learningIpc","./ipc/learning-ipc").registerLearningIpc({ipcMain,app,getLearning,getLearningRecorder,ensureBrain,getAgent:()=>agent,getChatWindow,getConfirmations:()=>confirmations,showLearning:()=>showLearning});
load("addonsIpc","./ipc/addons-ipc").registerAddonsIpc({ipcMain,app,getAddonService});
load("characterIpc","./ipc/character-ipc").registerCharacterIpc({ipcMain,getCharacterWindow:()=>characterWin,chooseCharacter,command:(payload)=>characterHost.command(payload),captureCharacter3DWindowSettings,writeCharacter3DSettings});
load("settingsIpc","./ipc/settings-ipc").registerSettingsIpc({ipcMain,ensureBrain,getAgent:()=>agent,getVoiceHost:ensureVoiceHost,setMicMode,setSaeedSize,getCharacterWindow:()=>characterWin,diagnostic});
load("voiceIpc","./ipc/voice-ipc").registerVoiceIpc({ipcMain,getAgent:()=>agent,diagnostic,app,getVoiceHost:ensureVoiceHost,diagnosticState,getStatusWindow:()=>statusWin,getThreeDStatusWindow:()=>threeDStatusWin,getCharacterWindow:()=>characterWin});
load("updateIpc","./ipc/update-ipc").registerUpdateIpc({ipcMain,getUpdateManager:ensureUpdateManager});
load("historyIpc","./ipc/history-ipc").registerHistoryIpc({ipcMain,getAgent:()=>agent,getChatWindow,getConfirmations:()=>confirmations});


app.on("activate",()=>{if(characterWin&&!characterWin.isDestroyed()){showCharacter();return}createWindow().catch(e=>diagnostic("ERROR","APPLICATION ACTIVATE",e.message))});
app.on("window-all-closed",()=>{if(app.isQuitting)return;diagnostic("INFO","WINDOW LIFECYCLE","All windows closed; Saeed remains alive in the tray")});
app.on("before-quit",()=>{try{captureCharacter3DWindowSettings()}catch{};app.isQuitting=true;try{voiceHost?.stopVoiceServices?.("app quit")}catch{};try{learningRecorder?.stop?.()}catch{};for(const win of [getChatWindow(),performanceWin,addonsWin,learningWin,statusWin,threeDStatusWin,characterWin])try{if(win&&!win.isDestroyed())win.destroy()}catch{};try{if(tray){tray.destroy();tray=null}}catch{}});
app.on("will-quit",()=>{globalShortcut.unregisterAll();try{voiceHost?.stopVoiceServices?.("app quit")}catch{}});

function handleLaunchArgs(args=[]){const a=args.map(String);if(a.includes("--exit"))return app.quit();if(a.includes("--show-saeed"))return showCharacter();if(a.includes("--chat"))return ensureChatHost().showChat();if(a.includes("--performance"))return showPerformance();if(a.includes("--settings"))return showSettings();if(a.includes("--addons"))return showAddons();if(a.includes("--learning"))return showLearning();if(a.includes("--status"))return showStatus();if(a.includes("--3d-status"))return show3DStatus();if(a.includes("--mic-on"))return setMicMode("on");if(a.includes("--mic-off"))return setMicMode("off");if(a.includes("--size-small"))return setSaeedSize("small");if(a.includes("--size-medium"))return setSaeedSize("medium");if(a.includes("--size-large"))return setSaeedSize("large");if(a.includes("--ci-e2e"))return initCiE2E().run().then(r=>{console.log("SAEED_CI_E2E",JSON.stringify({pass:r.pass,checks:Object.fromEntries(Object.entries(r.checks||{}).map(([k,v])=>[k,v?.pass]))}));return app.quit()});return showCharacter()}
async function createWindow(){await createCharacterWindow();if(ciSmoke)scheduleCiRuntimeSmoke()}
