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
const {createModuleLoader}=require("./application/module-loader");
const moduleLoader=createModuleLoader();
const load=(key,modulePath)=>moduleLoader.load("main:"+key,()=>require(modulePath));


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


let characterWin,performanceWin,settingsWin,addonsWin,learningWin,characterSettingsWin,agent,tray,statusWin,threeDStatusWin;
let addonService,learning,learningRecorder,apiHealth,resourceService,autoUpdater;
let chatHost=null,voiceHost=null,brainHost=null,screenCapture=null,windowManager=null,updateManager=null,characterHost;

const compositionState={get addonService(){return addonService},set addonService(v){addonService=v},get learning(){return learning},set learning(v){learning=v},get learningRecorder(){return learningRecorder},set learningRecorder(v){learningRecorder=v},get apiHealth(){return apiHealth},set apiHealth(v){apiHealth=v},get resourceService(){return resourceService},set resourceService(v){resourceService=v},get autoUpdater(){return autoUpdater},set autoUpdater(v){autoUpdater=v},get chatHost(){return chatHost},set chatHost(v){chatHost=v},get voiceHost(){return voiceHost},set voiceHost(v){voiceHost=v},get brainHost(){return brainHost},set brainHost(v){brainHost=v},get screenCapture(){return screenCapture},set screenCapture(v){screenCapture=v},get windowManager(){return windowManager},set windowManager(v){windowManager=v},get updateManager(){return updateManager},set updateManager(v){updateManager=v}};
const getState=()=>({characterWin,performanceWin,settingsWin,addonsWin,learningWin,characterSettingsWin,statusWin,threeDStatusWin,tray});
const setWindow=(name,value)=>{if(name==="characterWin")characterWin=value;else if(name==="performanceWin")performanceWin=value;else if(name==="settingsWin")settingsWin=value;else if(name==="addonsWin")addonsWin=value;else if(name==="learningWin")learningWin=value;else if(name==="characterSettingsWin")characterSettingsWin=value;else if(name==="statusWin")statusWin=value;else if(name==="threeDStatusWin")threeDStatusWin=value;else if(name==="tray")tray=value};
const {createRuntimeComposition}=moduleLoader.load("application:runtime-composition",()=>require("./application/runtime-composition"));
let composition;
composition=createRuntimeComposition({app,ipcMain,BrowserWindow,path,fs,spawn,desktopCapturer,screen,dialog,Menu,process,windowsIconPath,state:compositionState,getState,setWindow,getAgent:()=>agent,setAgent:value=>{agent=value},moduleLoader,ensureFeatureIpc});
const {diagnosticState,diagnostic,publish3DStatus,accept3DStatus,request3DStatus,updateDiagnosticState,startCpuMonitoring,stopCpuMonitoring,updateCpuMetrics,diagnosticFromAgent,getAddonService,getLearning,getLearningRecorder,getApiHealth,getResourceService,getChatWindow,ensureChatHost,getCurrentMicMode,getVoiceMuted,ensureVoiceHost,setMicMode,setVoiceMuted,ensureScreenCapture,captureScreen,permissionPolicy,confirmPermission,confirmations,voiceBroadcast,characterStore,character3DSettingsFile,writeCharacter3DSettings,captureCharacter3DWindowSettings,characterApi,ensureWindowManager,showPerformance,showSettings,showLearning,showAddons,ensureUpdateManager,updateNow,rebuildTray,contextMenu,ensureBrainHost,ensureBrain,releaseBrainIfIdle,showStatus,show3DStatus}=composition;
characterHost=composition.characterHost;
// Persistent authoring data for the original Character Studio, separate from runtime settings.
const characterStudioConfigPath=()=>path.join(app.getPath("userData"),"character-studio-config.json");
ipcMain.handle("character-studio:config:get",async()=>{
 try{return JSON.parse(await fs.promises.readFile(characterStudioConfigPath(),"utf8"))}
 catch(error){if(error?.code==="ENOENT")return {};diagnostic("ERROR","CHARACTER STUDIO CONFIG READ",error?.message||String(error));return {}}
});
ipcMain.handle("character-studio:config:set",async(_event,patch={})=>{
 if(!patch||typeof patch!=="object"||Array.isArray(patch))throw new TypeError("Character Studio settings patch must be an object");
 let current={};try{current=JSON.parse(await fs.promises.readFile(characterStudioConfigPath(),"utf8"))}catch(error){if(error?.code!=="ENOENT")throw error}
 const next={...current,...patch},file=characterStudioConfigPath(),temp=file+".tmp";
 await fs.promises.mkdir(path.dirname(file),{recursive:true});
 await fs.promises.writeFile(temp,JSON.stringify(next,null,2),"utf8");
 await fs.promises.rename(temp,file);
 return next;
});
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

app.whenReady().then(async () => {
  app.isQuitting = false;
  configureMediaPermissions();
  ciWriteStartupReport("ready");
  diagnostic("INFO", "APPLICATION", "Diagnostics system started");

  try {
    tray = new Tray(trayIcon());
    tray.setToolTip("Saeed AI");
    rebuildTray(tray);
  } catch (error) {
    console.error("Tray failed:", error);
  }

  try {
    await createWindow();
    if (characterWin && !getVoiceMuted() && !ciSmoke) ensureVoiceHost().ensureTts();
  } catch (error) {
    console.error("Saeed startup failed:", error);
    ciWriteStartupReport("startup-failed", error);
    app.quit();
    return;
  }

  try {
    const updateMode = agent?.settings?.updateMode ||
      require("./services/settings-store").createSettingsStore(app.getPath("userData")).load().updateMode ||
      "manual";
    if (app.isPackaged && ["notify", "automatic"].includes(updateMode)) {
      const updateTimer = setTimeout(() => {
        if (!app.isQuitting) void ensureUpdateManager().check();
      }, 15000);
      updateTimer.unref?.();
    }
  } catch (error) {
    diagnostic("WARN", "UPDATE AUTO CHECK CONFIG", error?.message || String(error));
  }

  // Explicit packaged acceptance modes are isolated from the normal startup path.
  if (process.argv.includes("--ci-character-rig-builder-save")) {
    void require("./ci/character-rig-builder").runCiCharacterRigBuilder("save", {
      app, session, process, path, fs, characterHost, getState, diagnostic
    });
    return;
  }
  if (process.argv.includes("--ci-brain-learning-save") || process.argv.includes("--ci-brain-learning-verify")) {
    const mode = process.argv.includes("--ci-brain-learning-save") ? "save" : "verify";
    void require("./ci/packaged-acceptance").runBrainLearning(mode, {
      app, ensureBrain, ensureBrainHost, getAgent: () => agent, diagnostic
    });
    return;
  }
  if (process.argv.includes("--ci-lifecycle")) {
    void require("./ci/packaged-acceptance").runLifecycle({
      app, BrowserWindow, getState, setWindow, characterApi, characterHost,
      showPerformance, showSettings, showLearning, showAddons, showStatus, show3DStatus,
      showCharacterSettings: composition.showCharacterSettings,
      ensureChatHost, ensureBrain, ensureBrainHost, getAgent: () => agent,
      setMicMode, getCurrentMicMode, ensureVoiceHost, diagnostic, stopCpuMonitoring
    });
    return;
  }
  if (process.argv.includes("--ci-ram-cpu")) {
    void require("./ci/packaged-acceptance").runResource({
      app, BrowserWindow, getState, characterApi, characterHost, showPerformance,
      ensureChatHost, ensureBrain, ensureBrainHost, getAgent: () => agent,
      setMicMode, getCurrentMicMode, ensureVoiceHost, getResourceService
    });
    return;
  }
  if (process.argv.includes("--ci-character-rig-builder-verify")) {
    void require("./ci/character-rig-builder").runCiCharacterRigBuilder("verify", {
      app, session, process, path, fs, characterHost, getState, diagnostic
    });
    return;
  }
  if (process.argv.includes("--ci-rest-pose-save")) {
    void require("./ci/rest-pose-restart").runCiRestPoseRestart("save", {
      app, session, process, path, fs, characterHost
    });
    return;
  }
  if (process.argv.includes("--ci-rest-pose-verify")) {
    void require("./ci/rest-pose-restart").runCiRestPoseRestart("verify", {
      app, session, process, path, fs, characterHost
    });
    return;
  }
  if (process.argv.includes("--ci-acceptance")) {
    void require("./ci/product-acceptance").runCiProductAcceptance({
      app, session, process, path, fs, characterHost, getState, composition,
      showAddons, showLearning, showCharacter, hideCharacter, ensureVoiceHost
    });
    return;
  }

  const launchArgs = [
    "--exit", "--show-saeed", "--3d-status", "--chat", "--performance",
    "--settings", "--addons", "--learning", "--status", "--mic-on", "--mic-off"
  ];
  if (process.argv.some(arg => launchArgs.includes(arg) || arg.startsWith("--size-"))) {
    handleLaunchArgs(process.argv.slice(1));
  }

  globalShortcut.register("CommandOrControl+Shift+M", () => ensureChatHost().showChat());
  globalShortcut.register("CommandOrControl+Shift+S", async () => {
    try {
      const image = await captureScreen();
      await ensureChatHost().showChat();
      getChatWindow()?.webContents.send("screen:capture", image);
    } catch (error) {
      console.error("Screen capture failed:", error);
    }
  });

  const refreshCharacter = () => {
    if (characterWin) fitCharacterToDisplay(displayForWindow());
  };
  screen.on("display-added", refreshCharacter);
  screen.on("display-removed", () => {
    if (characterWin) fitCharacterToDisplay(displayForWindow());
  });
  screen.on("display-metrics-changed", refreshCharacter);
});
// Email and settings IPC are loaded when their settings surface is first opened.
require("./ipc/window-ipc").registerWindowIpc({
  ipcMain, BrowserWindow, screen, accept3DStatus, request3DStatus, show3DStatus, diagnostic
});
require("./ipc/app-ipc").registerAppIpc({
  ipcMain, app, composition, getAgent: () => agent,
  showStatus, showPerformance, showSettings, showAddons
});
require("./ipc/core-ipc").registerCoreIpc({
  ipcMain, diagnostic, diagnosticState, getApiHealth, getResourceService, updateCpuMetrics
});
// Feature IPC modules are registered only when their surface is requested.
// Character and voice IPC remain eager because the always-visible character uses them.
function ensureFeatureIpc(feature) {
  const c = composition;
  if (!c) throw new Error("Runtime composition is not ready for feature IPC");
  const register = (name, callback) => {
    if (registeredFeatureIpc.has(name)) return;
    callback();
    registeredFeatureIpc.add(name);
  };
  if (feature === "settings") {
    register("email", () => load("emailIpc", "./ipc/email-ipc").registerEmailIpc({ ipcMain, app, diagnostic }));
    register("settings", () => load("settingsIpc", "./ipc/settings-ipc").registerSettingsIpc({
      ipcMain, ensureBrain, getAgent: () => agent, getVoiceHost: ensureVoiceHost,
      setMicMode, setSaeedSize, getCharacterWindow: () => characterWin, diagnostic
    }));
    return true;
  }
  if (feature === "chat") {
    register("chat", () => load("chatIpc", "./ipc/chat-ipc").registerChatIpc({
      ipcMain, ensureBrain, getBrainHost: ensureBrainHost,
      getAgent: () => agent, getCharacterWindow: () => characterWin, getChatHost: () => chatHost
    }));
    register("history", () => load("historyIpc", "./ipc/history-ipc").registerHistoryIpc({
      ipcMain, getAgent: () => agent, getChatWindow, getConfirmations: () => confirmations, dialog
    }));
    register("backup", () => load("backupIpc", "./ipc/backup-ipc").registerBackupIpc({
      ipcMain, dialog, app, ensureBrain, getAgent: () => agent, diagnostic
    }));
    return true;
  }
  if (feature === "learning") {
    register("learning", () => load("learningIpc", "./ipc/learning-ipc").registerLearningIpc({
      ipcMain, app, getLearning, getLearningRecorder, ensureBrain, getAgent: () => agent,
      getChatWindow, getConfirmations: () => confirmations, showLearning: () => showLearning
    }));
    return true;
  }
  if (feature === "addons") {
    register("addons", () => load("addonsIpc", "./ipc/addons-ipc").registerAddonsIpc({ ipcMain, app, getAddonService }));
    return true;
  }
  if (feature === "update") {
    register("update", () => load("updateIpc", "./ipc/update-ipc").registerUpdateIpc({
      ipcMain, getUpdateManager: ensureUpdateManager,
      showUpdateStatus: () => {
        ensureUpdateManager();
        return composition.showUpdateStatus?.() || false;
      }
    }));
    return true;
  }
  return false;
}

const registeredFeatureIpc = new Set();
load("characterIpc", "./ipc/character-ipc").registerCharacterIpc({
  ipcMain, getCharacterWindow: () => characterWin, chooseCharacter,
  saveCharacterModel: characterApi.saveCharacterModel,
  command: payload => characterHost.command(payload),
  getPendingCharacter: () => characterHost.getPendingCharacter?.() || null,
  captureCharacter3DWindowSettings, writeCharacter3DSettings
});
load("voiceIpc", "./ipc/voice-ipc").registerVoiceIpc({
  ipcMain, getAgent: () => agent, diagnostic, app, getVoiceHost: ensureVoiceHost,
  getBrainHost: ensureBrainHost, diagnosticState, getStatusWindow: () => statusWin,
  getThreeDStatusWindow: () => threeDStatusWin, getCharacterWindow: () => characterWin,
  getChatWindow: () => chatHost?.getChatWindow?.()
});

app.on("activate", () => {
  if (characterWin && !characterWin.isDestroyed()) {
    showCharacter();
    return;
  }
  createWindow().catch(error => diagnostic("ERROR", "APPLICATION ACTIVATE", error.message));
});
app.on("window-all-closed", () => {
  if (app.isQuitting) return;
  diagnostic("INFO", "WINDOW LIFECYCLE", "All windows closed; Saeed remains alive in the tray");
});
app.on("before-quit", () => {
  try { captureCharacter3DWindowSettings(); } catch {}
  app.isQuitting = true;
  try { voiceHost?.stopVoiceServices?.("app quit"); } catch {}
  try { learningRecorder?.stop?.(); } catch {}
  const windows = [
    getChatWindow(), performanceWin, settingsWin, addonsWin, learningWin,
    characterSettingsWin, statusWin, threeDStatusWin, characterWin
  ];
  for (const win of windows) {
    try {
      if (win && !win.isDestroyed()) win.destroy();
    } catch {}
  }
  try {
    if (tray) {
      tray.destroy();
      tray = null;
    }
  } catch {}
});
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  try { voiceHost?.stopVoiceServices?.("app quit"); } catch {}
});

function handleLaunchArgs(args = []) {
  const values = args.map(String);
  if (values.includes("--exit")) return app.quit();
  if (values.includes("--show-saeed")) return showCharacter();
  if (values.includes("--chat")) return ensureChatHost().showChat();
  if (values.includes("--performance")) return showPerformance();
  if (values.includes("--settings")) return showSettings();
  if (values.includes("--addons")) return showAddons();
  if (values.includes("--learning")) return showLearning();
  if (values.includes("--status")) return showStatus();
  if (values.includes("--3d-status")) return show3DStatus();
  if (values.includes("--mic-on")) return setMicMode("on");
  if (values.includes("--mic-off")) return setMicMode("off");
  if (values.includes("--size-small")) return setSaeedSize("small");
  if (values.includes("--size-medium")) return setSaeedSize("medium");
  if (values.includes("--size-large")) return setSaeedSize("large");
  return showCharacter();
}


async function createWindow(){await createCharacterWindow()}
