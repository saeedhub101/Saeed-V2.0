const {app,BrowserWindow,ipcMain,globalShortcut,desktopCapturer,Tray,Menu,screen,dialog,nativeImage,session}=require("electron");
const path=require("path"),fs=require("fs"),os=require("os"),{spawn}=require("child_process");
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
const {createRuntimeDependencies}=require("./services/runtime-dependencies");
const {createBrainHost}=require("./application/brain-host");
const {createVoiceHost}=require("./voice/voice-host");
const {createSystemControls}=require("./application/system-controls");
const {createChatHost}=require("./application/chat-host");
const {registerVoiceIpc}=require("./ipc/voice-ipc");
const {createWindowManager}=require("./application/window-manager");
const {createCharacterStore}=require("./character/character-store");
const {createCharacterHost}=require("./character/character-host");
const {createDiagnostics}=require("./application/diagnostics");
const {createPermissionManager}=require("./application/permission-manager");
const {createScreenCapture}=require("./application/screen-capture");
const {createUpdateManager}=require("./application/update-manager");
const {registerChatIpc}=require("./ipc/chat-ipc");
const {registerLearningIpc}=require("./ipc/learning-ipc");
const {registerAddonsIpc}=require("./ipc/addons-ipc");
const {registerCharacterIpc}=require("./ipc/character-ipc");
const {registerSettingsIpc}=require("./ipc/settings-ipc");
const {registerUpdateIpc}=require("./ipc/update-ipc");
const {registerHistoryIpc}=require("./ipc/history-ipc");


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


let chatWin,characterWin,performanceWin,settingsWin,addonsWin,learningWin,agent,tray,statusWin,threeDStatusWin,updateToastWin,brainSupervisor,brainInitPromise;
const runtimeDeps=createRuntimeDependencies({app,BrowserWindow,process,getAgent:()=>agent,diagnostic:(...a)=>diagnostic(...a),voiceBroadcast:(...a)=>voiceBroadcast(...a)});
const getAddonService=()=>runtimeDeps.getAddonService(),getLearning=()=>runtimeDeps.getLearning(),getLearningRecorder=()=>runtimeDeps.getLearningRecorder(),getApiHealth=()=>runtimeDeps.getApiHealth(),getVoiceRuntime=()=>runtimeDeps.getVoiceRuntime(),getResourceService=()=>runtimeDeps.getResourceService(),getAutoUpdater=()=>runtimeDeps.getAutoUpdater();
const permissionManager=createPermissionManager({getAgent:()=>agent,showChat:()=>chatHost?.showChat?.(),getChatWindow:()=>chatWin,diagnostic:(...a)=>diagnostic(...a)});
const {permissionPolicy,confirmPermission,confirmations}=permissionManager;
const voiceBroadcast=(channel,...args)=>{for(const win of [chatWin,characterWin,statusWin,threeDStatusWin])if(win&&!win.isDestroyed())try{win.webContents.send(channel,...args)}catch{}};
const diagnostics=createDiagnostics({getWindows:()=>({chatWin,characterWin,statusWin,performanceWin,threeDStatusWin}),getResourceService});
const {diagnosticState,diagnostic,publish3DStatus,request3DStatus,updateDiagnosticState,startCpuMonitoring,stopCpuMonitoring,updateCpuMetrics,diagnosticFromAgent}=diagnostics;
const voiceHost=createVoiceHost({app,path,fs,spawn,diagnostic,voiceBroadcast,getAgent:()=>agent,getVoiceRuntime,getAddonService,ensureBrain:()=>brainHost?.ensureBrain?.(),permissionPolicy,confirmPermission,rebuildTray:()=>rebuildTray(tray),showChat:()=>chatHost?.showChat?.(),getCharacterWindow:()=>characterWin,getChatWindow:()=>chatWin,getStatusWindow:()=>statusWin,diagnosticState});
const {whisperRuntimePaths,setMicMode,setVoiceMuted}=voiceHost;
const updateManager=createUpdateManager({app,getAutoUpdater,voiceBroadcast,diagnostic});
const updateNow=()=>updateManager.check();
const systemControls=createSystemControls({app,diagnostic,showChat:()=>chatHost.showChat(),showCharacter:()=>characterHost.showCharacter(),hideCharacter:()=>characterHost.hideCharacter(),showAddons:()=>showAddons(),showLearning:()=>showLearning(),showPerformance:()=>showPerformance(),showStatus:()=>showStatus(),show3DStatus:()=>show3DStatus(),showSettings:()=>showSettings(),setSaeedSize:(v)=>characterHost.setSaeedSize(v),chooseCharacter:()=>characterHost.chooseCharacter(),Menu,getCharacterWindow:()=>characterWin,getVoiceMuted:()=>voiceHost.getVoiceMuted(),setVoiceMuted:(v)=>setVoiceMuted(v),setMicMode:(m)=>setMicMode(m),getCurrentMicMode:()=>voiceHost.getCurrentMicMode(),updateNow,getAgent:()=>agent});
const {rebuildTray,contextMenu}=systemControls;
const chatHost=createChatHost({BrowserWindow,path,Menu,windowsIconPath,diagnostic,ensureBrain});
const {createChatWindow,closeChat}=chatHost;
const screenCapture=createScreenCapture({desktopCapturer,permissionPolicy,confirmPermission,diagnostic});
const captureScreen=screenCapture.captureScreen;

registerVoiceIpc({ipcMain,getAgent:()=>agent,getVoiceRuntime,diagnostic,diagnosticState,getStatusWindow:()=>statusWin,getThreeDStatusWindow:()=>threeDStatusWin,getCharacterWindow:()=>characterWin,voiceHost});
let characterHost;
const characterStore=createCharacterStore({app,path,fs,screen,getCharacterWindow:()=>characterWin,fitCharacterToDisplay:(...args)=>characterHost?.fitCharacterToDisplay?.(...args),diagnostic});
const {persistedCharacterFile,character3DSettingsFile,readCharacter3DSettings,writeCharacter3DSettings,applyCharacter3DWindowSettings,captureCharacter3DWindowSettings,persistSelectedCharacter,readPersistedCharacter}=characterStore;
characterHost=createCharacterHost({app,BrowserWindow,dialog,path,fs,screen,diagnostic,windowsIconPath,getCharacterWindow:()=>characterWin,setCharacterWindow:v=>{characterWin=v},getAgent:()=>agent,characterStore,showChat:()=>chatHost?.showChat?.(),permissionPolicy,confirmPermission,contextMenu:()=>contextMenu()});
const {displayForWindow,fitCharacterToDisplay,sendCharacterData,chooseCharacter,setSaeedSize,showCharacter,hideCharacter,createCharacterWindow,characterSizeMenu}=characterHost;
const windowManager=createWindowManager({BrowserWindow,path,getWindow:name=>({performanceWin,learningWin,addonsWin,statusWin}[name]),setWindow:(name,value)=>{if(name==="performanceWin")performanceWin=value;else if(name==="learningWin")learningWin=value;else if(name==="addonsWin")addonsWin=value;else if(name==="statusWin")statusWin=value},iconPath:windowsIconPath,diagnostic,startCpuMonitoring,stopCpuMonitoring,preloadPath:path.join(__dirname,"..","preload.js"),rootPath:path.join(__dirname,"..")});
const {showPerformance,showSettings,showLearning,showAddons}=windowManager;
let brainHost;
brainHost=createBrainHost({app,getCharacterWindow:()=>characterWin,getChatWindow:()=>chatWin,getLearning:getLearning,permissionPolicy,showChat:()=>chatHost?.showChat?.(),diagnostic,diagnosticFromAgent,voiceBroadcast,captureScreen,getCharacter3DSettingsFile:()=>character3DSettingsFile(),setSaeedSize, setAgent:value=>{agent=value},setBrainSupervisor:value=>{brainSupervisor=value},setVoiceMuted:value=>setVoiceMuted(value),recordLearningStep:step=>{if(learningRecording)getLearning().recordStep(learningRecording,step.tool,step.args)},confirmations,characterSettingsExists:()=>fs.existsSync(character3DSettingsFile())});
const ensureBrain=(...args)=>brainHost.ensureBrain(...args);
function show3DStatus(){if(threeDStatusWin&&!threeDStatusWin.isDestroyed()){threeDStatusWin.show();threeDStatusWin.focus();request3DStatus().then(r=>threeDStatusWin?.webContents.send("3d:status",r));return}threeDStatusWin=new BrowserWindow({width:960,height:720,minWidth:760,minHeight:560,title:"Saeed 3D Status",show:false,backgroundColor:"#f5f7fb",icon:windowsIconPath(),webPreferences:{preload:path.join(__dirname,"..","preload.js"),contextIsolation:true,nodeIntegration:false,sandbox:false}});threeDStatusWin.on("closed",()=>{threeDStatusWin=null});threeDStatusWin.loadFile(path.join(__dirname,"..","3d-status.html")).then(async()=>{threeDStatusWin?.show();threeDStatusWin?.focus();const r=await request3DStatus();threeDStatusWin?.webContents.send("3d:status",r)}).catch(e=>diagnostic("ERROR","3D STATUS WINDOW",e.message))}
let pendingCharacterData=null;let learningRecorderActive=false;let learningRecording=null;
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

const {createCiRuntime}=require("./ci-runtime");
let ciRuntime;
function initCiRuntime(){if(ciRuntime)return ciRuntime;ciRuntime=createCiRuntime({ciSmoke,app,characterWin,tray,agent,brainSupervisor,currentMicMode:voiceHost.getCurrentMicMode(),resourceService:getResourceService(),addons:getAddonService(),learning:getLearning(),OpenAIRealtime:require("../realtime").OpenAIRealtime,request3DStatus,apiHealth:getApiHealth(),diagnosticState,voiceRuntime:getVoiceRuntime(),transcribeLocalWav:voiceHost.transcribeLocalWav,whisperRuntimePaths,ensureBrain});return ciRuntime;}
async function runCi3DBaseline(){return initCiRuntime().runCi3DBaseline()}
async function runCiRuntimeSmoke(){return initCiRuntime().runCiRuntimeSmoke()}

app.on("before-quit",()=>{try{getLearningRecorder().stop()}catch{};learningRecorderActive=false;learningRecording=null});

app.whenReady().then(async()=>{app.isQuitting=false;configureMediaPermissions();updateManager.bind();ciWriteStartupReport("ready");diagnostic("INFO","APPLICATION","Diagnostics system started");if(ciSmoke)getResourceService().startResourceProbe();
 try{await createWindow();setMicMode("off")}catch(e){console.error("Saeed startup failed:",e);ciWriteStartupReport("startup-failed",e);app.quit();return}
 // Windows Jump List disabled to avoid Electron runtime incompatibility in the CI/build environment.
 if(process.argv.includes("--exit")||process.argv.includes("--show-saeed")||process.argv.includes("--3d-status")||process.argv.includes("--chat")||process.argv.includes("--performance")||process.argv.includes("--settings")||process.argv.includes("--addons")||process.argv.includes("--learning")||process.argv.includes("--status")||process.argv.includes("--mic-on")||process.argv.includes("--mic-off")||process.argv.some(x=>x.startsWith("--size-")))handleLaunchArgs(process.argv.slice(1));
 try{tray=new Tray(trayIcon());tray.setToolTip("Saeed AI");rebuildTray(tray)}catch(e){console.error("Tray failed:",e)}

 globalShortcut.register("CommandOrControl+Shift+M",()=>chatHost.showChat());
 globalShortcut.register("CommandOrControl+Shift+S",async()=>{
  try{const image=await captureScreen();await chatHost.showChat();chatWin?.webContents.send("screen:capture",image)}
  catch(e){console.error("Screen capture failed:",e)}
 });
 const refresh=()=>{if(characterWin)fitCharacterToDisplay(displayForWindow())};
 screen.on("display-added",refresh);
 screen.on("display-removed",()=>{if(characterWin)fitCharacterToDisplay(displayForWindow())});
 screen.on("display-metrics-changed",refresh);
});

ipcMain.on("3d:status-report",(_,requestId,report)=>{publish3DStatus(report)});ipcMain.handle("3d:query",()=>request3DStatus());ipcMain.handle("3d-status:show",()=>{show3DStatus();return true});
ipcMain.handle("settings:get",async()=>{await ensureBrain();return agent.publicSettings()});ipcMain.on("character:activity",()=>brainSupervisor?.markActivity?.());
ipcMain.handle("diagnostic:report",(_,level,stage,message,meta)=>diagnostic(level,stage,message,meta));ipcMain.handle("diagnostic:snapshot",()=>({state:diagnosticState}));ipcMain.handle("api-status:test",(_,service)=>getApiHealth().test(String(service||"")));ipcMain.handle("api-status:test-all",()=>getApiHealth().testAll());ipcMain.handle("resource:snapshot",()=>getResourceService().resourceReport());ipcMain.handle("cpu:metrics",()=>{updateCpuMetrics();return diagnosticState.cpu});ipcMain.handle("status:show",()=>{showStatus();return true});ipcMain.handle("performance:show",()=>{showPerformance();return true});ipcMain.handle("settings:show",()=>{showPerformance();return true});ipcMain.handle("addons:show",()=>{showAddons();return true});
registerChatIpc({ipcMain,ensureBrain,getAgent:()=>agent,getBrainSupervisor:()=>brainSupervisor,getCharacterWindow:()=>characterWin});
registerLearningIpc({ipcMain,app,getLearning,getLearningRecorder,ensureBrain,getAgent:()=>agent,getChatWindow:()=>chatWin,getConfirmations:()=>confirmations,showChat:()=>chatHost.showChat});
registerAddonsIpc({ipcMain,app,getAddonService});
registerCharacterIpc({ipcMain,getCharacterWindow:()=>characterWin,chooseCharacter,captureCharacter3DWindowSettings,writeCharacter3DSettings,screen});
registerSettingsIpc({ipcMain,ensureBrain,getAgent:()=>agent,getVoiceRuntime,setMicMode,setSaeedSize,getCharacterWindow:()=>characterWin,getBrainSupervisor:()=>brainSupervisor,diagnostic});
registerUpdateIpc({ipcMain,updateManager});
registerHistoryIpc({ipcMain,getAgent:()=>agent,getChatWindow:()=>chatWin,getConfirmations:()=>confirmations});


app.on("activate",()=>{if(characterWin&&!characterWin.isDestroyed()){showCharacter();return}createWindow().catch(e=>diagnostic("ERROR","APPLICATION ACTIVATE",e.message))});
app.on("window-all-closed",()=>{if(process.platform!=="darwin"&&!app.isQuitting)app.quit()});
app.on("before-quit",()=>{try{captureCharacter3DWindowSettings()}catch{};app.isQuitting=true;try{getVoiceRuntime().stop()}catch{};try{getLearningRecorder().stop()}catch{};for(const win of [chatWin,performanceWin,settingsWin,addonsWin,learningWin,statusWin,threeDStatusWin,characterWin])try{if(win&&!win.isDestroyed())win.destroy()}catch{};try{if(tray){tray.destroy();tray=null}}catch{}});
app.on("will-quit",()=>{globalShortcut.unregisterAll();try{getVoiceRuntime().stop()}catch{}});

function handleLaunchArgs(args=[]){const a=args.map(String);if(a.includes("--exit"))return app.quit();if(a.includes("--show-saeed"))return showCharacter();if(a.includes("--chat"))return chatHost.showChat();if(a.includes("--performance"))return showPerformance();if(a.includes("--settings"))return showSettings();if(a.includes("--addons"))return showAddons();if(a.includes("--learning"))return showLearning();if(a.includes("--status"))return showStatus();if(a.includes("--3d-status"))return show3DStatus();if(a.includes("--mic-on"))return setMicMode("on");if(a.includes("--mic-off"))return setMicMode("off");if(a.includes("--size-small"))return setSaeedSize("small");if(a.includes("--size-medium"))return setSaeedSize("medium");if(a.includes("--size-large"))return setSaeedSize("large");return showCharacter()}
async function createWindow(){await createCharacterWindow();if(ciSmoke)scheduleCiRuntimeSmoke()}
