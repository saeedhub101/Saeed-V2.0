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
const {createWindowManager}=require("./application/window-manager");
const {createCharacterStore}=require("./character/character-store");
const {createCharacterHost}=require("./character/character-host");


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
const pendingConfirmations=new Map();
const diagnostics=createDiagnostics({getWindows:()=>({chatWin,characterWin,statusWin,performanceWin,threeDStatusWin}),getResourceService});
const {diagnosticState,diagnostic,publish3DStatus,request3DStatus,updateDiagnosticState,startCpuMonitoring,stopCpuMonitoring,updateCpuMetrics,diagnosticFromAgent}=diagnostics;
const voiceHost=createVoiceHost({app,path,fs,spawn,diagnostic,voiceBroadcast,getAgent:()=>agent,getVoiceRuntime,permissionPolicy,confirmPermission,rebuildTray:()=>rebuildTray(),showChat:()=>showChat(),getCharacterWindow:()=>characterWin,getChatWindow:()=>chatWin,getStatusWindow:()=>statusWin,diagnosticState});
const {whisperRuntimePaths,setMicMode,setVoiceMuted,updateNow}=voiceHost;
const characterStore=createCharacterStore({app,path,fs,screen,getCharacterWindow:()=>characterWin,fitCharacterToDisplay,diagnostic});
const {persistedCharacterFile,character3DSettingsFile,readCharacter3DSettings,writeCharacter3DSettings,applyCharacter3DWindowSettings,captureCharacter3DWindowSettings,persistSelectedCharacter,readPersistedCharacter}=characterStore;
const characterHost=createCharacterHost({app,BrowserWindow,dialog,path,fs,screen,diagnostic,windowsIconPath,getCharacterWindow:()=>characterWin,setCharacterWindow:v=>{characterWin=v},getAgent:()=>agent,characterStore,showChat:()=>showChat(),permissionPolicy,confirmPermission});
const {displayForWindow,fitCharacterToDisplay,sendCharacterData,chooseCharacter,setSaeedSize,showCharacter,hideCharacter,createCharacterWindow,characterSizeMenu}=characterHost;
const windowManager=createWindowManager({BrowserWindow,path,getWindow:name=>({performanceWin,learningWin,addonsWin,statusWin}[name]),setWindow:(name,value)=>{if(name==="performanceWin")performanceWin=value;else if(name==="learningWin")learningWin=value;else if(name==="addonsWin")addonsWin=value;else if(name==="statusWin")statusWin=value},iconPath:windowsIconPath,diagnostic,startCpuMonitoring,stopCpuMonitoring,preloadPath:path.join(__dirname,"..","preload.js"),rootPath:path.join(__dirname,"..")});
const {showPerformance,showSettings,showLearning,showAddons}=windowManager;
const brainHost=createBrainHost({app,getCharacterWindow:()=>characterWin,getChatWindow:()=>chatWin,getLearning:getLearning,permissionPolicy,showChat:()=>showChat(),diagnostic,diagnosticFromAgent,voiceBroadcast,captureScreen,getCharacter3DSettingsFile:()=>character3DSettingsFile(),setSaeedSize, setAgent:value=>{agent=value},setBrainSupervisor:value=>{brainSupervisor=value},setVoiceMuted:value=>{voiceMuted=value},recordLearningStep:step=>{if(learningRecording)getLearning().recordStep(learningRecording,step.tool,step.args)},confirmations:pendingConfirmations,characterSettingsExists:()=>fs.existsSync(character3DSettingsFile())});
const ensureBrain=brainHost.ensureBrain;
function show3DStatus(){if(threeDStatusWin&&!threeDStatusWin.isDestroyed()){threeDStatusWin.show();threeDStatusWin.focus();request3DStatus().then(r=>threeDStatusWin?.webContents.send("3d:status",r));return}threeDStatusWin=new BrowserWindow({width:960,height:720,minWidth:760,minHeight:560,title:"Saeed 3D Status",show:false,backgroundColor:"#f5f7fb",icon:windowsIconPath(),webPreferences:{preload:path.join(__dirname,"..","preload.js"),contextIsolation:true,nodeIntegration:false,sandbox:false}});threeDStatusWin.on("closed",()=>{threeDStatusWin=null});threeDStatusWin.loadFile(path.join(__dirname,"..","3d-status.html")).then(async()=>{threeDStatusWin?.show();threeDStatusWin?.focus();const r=await request3DStatus();threeDStatusWin?.webContents.send("3d:status",r)}).catch(e=>diagnostic("ERROR","3D STATUS WINDOW",e.message))}
let pendingCharacterData=null;let learningRecorderActive=false;let learningRecording=null;
const DEFAULT_PERMISSIONS={files:"allow",applications:"allow",system:"allow",network:"allow",screen:"allow",mouseKeyboard:"allow",microphone:"allow",tasksMemory:"allow",credentials:"allow",destructive:"allow"};
function permissionPolicy(category){const p=agent?.settings?.permissions||DEFAULT_PERMISSIONS;return p[category]||"allow"}
const confirmations=pendingConfirmations;
async function confirmPermission(category,request){
 const label={files:"file access",applications:"application control",system:"system access",network:"network access",screen:"screen capture",mouseKeyboard:"mouse and keyboard control",microphone:"microphone access",tasksMemory:"tasks and memory",credentials:"credentials and secrets",destructive:"destructive actions"}[category]||category;
 await showChat();
 return new Promise(resolve=>{const id=Date.now().toString(36)+Math.random().toString(36).slice(2,7);const timer=setTimeout(()=>{if(!confirmations.has(id))return;confirmations.delete(id);resolve(false);diagnostic("INFO","AGENT CONFIRMATION","Confirmation timed out; operation denied",{id,name:request?.name||category});},120000);confirmations.set(id,approved=>{clearTimeout(timer);resolve(Boolean(approved))});chatWin?.webContents.send("agent:confirm",{id,name:request?.name||category,args:request?.args||{},permissionCategory:category,permissionLabel:label});});
}
const {createDiagnostics}=require("./application/diagnostics");


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
let updateState="idle",updateUiRequested=false,updateStatusWin=null,updateInfo=null;

async function captureScreen(){
 const sources=await desktopCapturer.getSources({types:["screen"],thumbnailSize:{width:1920,height:1080}});
 return sources[0]?.thumbnail.toDataURL()||null;
}
function displayForWindow(target=characterWin){
 if(!target)return screen.getPrimaryDisplay();
 const [x,y]=target.getPosition();const [w,h]=target.getSize();
 return screen.getDisplayMatching({x,y,width:w,height:h})||screen.getDisplayNearestPoint({x:x+w/2,y:y+h/2})||screen.getPrimaryDisplay();
}
function fitCharacterToDisplay(display=displayForWindow(),{bottomRight=false}={}){
 if(!characterWin)return;
 const area=display.workArea;const [w,h]=characterWin.getSize();const margin=18;
 const [x0,y0]=characterWin.getPosition();
 const x=bottomRight?area.x+Math.max(0,area.width-w-margin):Math.max(area.x,Math.min(x0,area.x+Math.max(0,area.width-w)));
 const y=bottomRight?area.y+Math.max(0,area.height-h-margin):Math.max(area.y,Math.min(y0,area.y+Math.max(0,area.height-h)));
 characterWin.setPosition(Math.round(x),Math.round(y),false);
}
async function showChat(){try{if(!chatWin||chatWin.isDestroyed())await createChatWindow();if(!chatWin||chatWin.isDestroyed())return;chatWin.setIgnoreMouseEvents(false);if(chatWin.isMinimized())chatWin.restore();chatWin.show();chatWin.focus();chatWin.webContents.send("chat:show");void ensureBrain().catch(e=>diagnostic("ERROR","BRAIN INIT",e.message))}catch(e){diagnostic("ERROR","CHAT WINDOW",e.message)}}
function closeChat(){if(chatWin&&!chatWin.isDestroyed()){chatWin.destroy();chatWin=null}}
function stopCharacterRuntime(){if(!characterWin||characterWin.isDestroyed())return;try{characterWin.webContents.send("character:visibility","hidden")}catch{} try{characterWin.webContents.setBackgroundThrottling(true)}catch{}}
function wakeCharacterRuntime(){if(!characterWin||characterWin.isDestroyed())return;try{characterWin.webContents.setBackgroundThrottling(false)}catch{} try{characterWin.webContents.send("character:visibility","visible")}catch{} }
function hideCharacter(){if(!characterWin||characterWin.isDestroyed())return;try{captureCharacter3DWindowSettings()}catch{};stopCharacterRuntime();try{characterWin.hide()}catch{}}
async function showCharacter(){try{if(!characterWin||characterWin.isDestroyed())await createCharacterWindow();if(!characterWin||characterWin.isDestroyed())return;wakeCharacterRuntime();characterWin.show();characterWin.focus()}catch(e){diagnostic("ERROR","3D WINDOW",e.message)}}
function showStatus(){startCpuMonitoring();if(statusWin&&!statusWin.isDestroyed()){statusWin.show();statusWin.focus();statusWin.webContents.send("diagnostic:snapshot",{state:diagnosticState});return}statusWin=new BrowserWindow({width:880,height:660,minWidth:680,minHeight:500,title:"Saeed Status",show:false,backgroundColor:"#f5f7fb",icon:windowsIconPath(),webPreferences:{preload:path.join(__dirname,"..","preload.js"),contextIsolation:true,nodeIntegration:false,sandbox:false}});statusWin.on("closed",()=>{statusWin=null;stopCpuMonitoring()});statusWin.loadFile(path.join(__dirname,"..","status.html")).then(()=>{statusWin.show();statusWin.webContents.send("diagnostic:snapshot",{state:diagnosticState})}).catch(e=>diagnostic("ERROR","STATUS WINDOW",e.message))}
let characterLoadGeneration=0;
function sendCharacterData(data){const generation=++characterLoadGeneration;if(!characterWin||characterWin.isDestroyed()){pendingCharacterData={data,generation};return false}pendingCharacterData={data,generation};characterWin.webContents.send("character:selected",data,generation);return true}

function scheduleCiRuntimeSmoke(){if(!ciSmoke)return;setTimeout(()=>void runCiRuntimeSmoke(),1500)}

const {createCiRuntime}=require("./ci-runtime");
let ciRuntime;
function initCiRuntime(){if(ciRuntime)return ciRuntime;ciRuntime=createCiRuntime({ciSmoke,app,characterWin,tray,agent,brainSupervisor,currentMicMode,resourceService,addons,learning,OpenAIRealtime,request3DStatus,apiHealth,diagnosticState,voiceRuntime,transcribeLocalWav,whisperRuntimePaths,ensureBrain});return ciRuntime;}
async function runCi3DBaseline(){return initCiRuntime().runCi3DBaseline()}
async function runCiRuntimeSmoke(){return initCiRuntime().runCiRuntimeSmoke()}

app.on("before-quit",()=>{try{getLearningRecorder().stop()}catch{};learningRecorderActive=false;learningRecording=null});

app.whenReady().then(async()=>{app.isQuitting=false;ciWriteStartupReport("ready");diagnostic("INFO","APPLICATION","Diagnostics system started");if(ciSmoke)getResourceService().startResourceProbe();
 configureUpdater();
 try{await createWindow();currentMicMode="off";setMicMode("off")}catch(e){console.error("Saeed startup failed:",e);ciWriteStartupReport("startup-failed",e);app.quit();return}
 // Windows Jump List disabled to avoid Electron runtime incompatibility in the CI/build environment.
 if(process.argv.includes("--exit")||process.argv.includes("--show-saeed")||process.argv.includes("--3d-status")||process.argv.includes("--chat")||process.argv.includes("--performance")||process.argv.includes("--settings")||process.argv.includes("--addons")||process.argv.includes("--learning")||process.argv.includes("--status")||process.argv.includes("--mic-on")||process.argv.includes("--mic-off")||process.argv.some(x=>x.startsWith("--size-")))handleLaunchArgs(process.argv.slice(1));
 try{tray=new Tray(trayIcon());tray.setToolTip("Saeed AI");rebuildTray()}catch(e){console.error("Tray failed:",e)}

 globalShortcut.register("CommandOrControl+Shift+M",showChat);
 globalShortcut.register("CommandOrControl+Shift+S",async()=>{
  try{const image=await captureScreen();await showChat();chatWin?.webContents.send("screen:capture",image)}
  catch(e){console.error("Screen capture failed:",e)}
 });
 const refresh=()=>{if(characterWin)fitCharacterToDisplay(displayForWindow())};
 screen.on("display-added",refresh);
 screen.on("display-removed",()=>{if(characterWin)fitCharacterToDisplay(displayForWindow())});
 screen.on("display-metrics-changed",refresh);
});
ipcMain.on("3d:status-report",(_,requestId,report)=>{publish3DStatus(report);const resolve=pending3DQueries.get(String(requestId||""));if(resolve)resolve(report)});
ipcMain.handle("3d:query",()=>request3DStatus());ipcMain.handle("3d-status:show",()=>{show3DStatus();return true});
ipcMain.handle("chat",async(_,payload)=>{
 await ensureBrain();
 const data=typeof payload==="string"?{text:payload}:payload||{};brainSupervisor?.markActivity?.();if(characterWin&&!characterWin.isDestroyed())characterWin.webContents.send("character:behavior",{type:"user-input",text:String(data.text||"")});
 const result=await agent.run(String(data.text||""),data.image||null);
 if(characterWin&&!characterWin.isDestroyed())characterWin.webContents.send("character:behavior","answer");
 return result;
});
ipcMain.handle("settings:get",async()=>{await ensureBrain();return agent.publicSettings()});ipcMain.on("character:activity",()=>brainSupervisor?.markActivity?.());
ipcMain.handle("diagnostic:report",(_,level,stage,message,meta)=>diagnostic(level,stage,message,meta));ipcMain.handle("diagnostic:snapshot",()=>({state:diagnosticState}));ipcMain.handle("api-status:test",(_,service)=>getApiHealth().test(String(service||"")));ipcMain.handle("api-status:test-all",()=>getApiHealth().testAll());ipcMain.handle("resource:snapshot",()=>getResourceService().resourceReport());ipcMain.handle("cpu:metrics",()=>{updateCpuMetrics();return diagnosticState.cpu;});ipcMain.handle("status:show",()=>{showStatus();return true});ipcMain.handle("performance:show",()=>{showPerformance();return true});ipcMain.handle("settings:show",()=>{showPerformance();return true});ipcMain.handle("addons:show",()=>{showAddons();return true});ipcMain.handle("learning:show",()=>{showLearning();return true});ipcMain.handle("learning:list",()=>getLearning().list(app.getPath("userData")));ipcMain.handle("learning:get",(_,id)=>getLearning().get(app.getPath("userData"),id));ipcMain.handle("learning:record-start",(_,name,phrases)=>{if(learningRecording)throw new Error("Learning recorder is already running");learningRecording=getLearning().beginRecording(app.getPath("userData"),name,phrases);try{getLearningRecorder().start(e=>{if(learningRecording&&e?.type==="action")getLearning().recordStep(learningRecording,e.tool,e.args)},app.getPath("userData"));learningRecorderActive=true;return true}catch(e){learningRecording=null;getLearningRecorder().stop();throw e}});ipcMain.handle("learning:record-stop",()=>{if(!learningRecording)throw new Error("Learning recorder is not running");getLearningRecorder().stop();learningRecorderActive=false;if(!Array.isArray(learningRecording.skill?.steps)||learningRecording.skill.steps.length===0){learningRecording=null;return{ok:false,empty:true,message:"No actions were recorded. Perform at least one action in another Windows application, then record again."}}const result=getLearning().finishRecording(app.getPath("userData"),learningRecording);learningRecording=null;return result});ipcMain.handle("learning:save",(_,skill)=>require("../learning").save(app.getPath("userData"),skill));ipcMain.handle("learning:remove",(_,id)=>require("../learning").remove(app.getPath("userData"),id));ipcMain.handle("learning:enable",(_,id,enabled)=>require("../learning").setEnabled(app.getPath("userData"),id,enabled));ipcMain.handle("learning:run",async(_,id)=>{await ensureBrain();const skill=getLearning().get(app.getPath("userData"),id);if(!skill)throw new Error("Skill not found: "+id);return getLearning().run(app.getPath("userData"),agent.registry,skill,{confirm:async({skill,step})=>{await showChat();return new Promise(resolve=>{const cid=Date.now().toString(36)+Math.random().toString(36).slice(2,7);confirmations.set(cid,resolve);chatWin?.webContents.send("agent:confirm",{id:cid,name:step.tool,args:step.args,permissionCategory:agent.registry.categoryFor(step.tool),permissionLabel:"Learned skill: "+skill.name,reason:"Approve this learned step?"})})}})});ipcMain.handle("learning:export",(_,id)=>require("../learning").exportSkill(app.getPath("userData"),id));ipcMain.handle("learning:import",(_,data)=>require("../learning").importSkill(app.getPath("userData"),data));ipcMain.handle("addons:catalog",async()=>{const catalog=await getAddonService().fetchCatalog();return{catalog,installed:getAddonService().listInstalled(app.getPath("userData"))}});ipcMain.handle("addons:install",async(event,id)=>{const catalog=await getAddonService().fetchCatalog();const item=(catalog.addons||[]).find(x=>x.id===String(id));if(!item)throw new Error("Add-on not found in catalog: "+id);return getAddonService().install(app.getPath("userData"),item,state=>{if(event.sender&&!event.sender.isDestroyed())event.sender.send("addons:progress",id,state)})});ipcMain.handle("addons:uninstall",async(_,id)=>getAddonService().uninstall(app.getPath("userData"),id));ipcMain.handle("addons:enable",async(_,id,enabled)=>getAddonService().setEnabled(app.getPath("userData"),id,enabled));ipcMain.handle("character:choose",()=>{chooseCharacter();return true});
ipcMain.handle("character:controller:get",async()=>{
 if(!characterWin||characterWin.isDestroyed()) return {available:false};
 try{return characterWin.webContents.executeJavaScript("window.saeedCharacterController?.status?.()||null",true).then(x=>x||{available:false});}
 catch(e){return {available:false,error:e.message}}
});
ipcMain.handle("character:controller:command",async(_,command={})=>{
 if(!characterWin||characterWin.isDestroyed()) return {ok:false,error:"Character window is not available"};
 const payload=JSON.stringify(command||{});
 const script="(async()=>{const c=window.saeedCharacterController;if(!c)return {ok:false,error:'Character controller unavailable'};const x="+payload+";if(x.action==='play')return {ok:c.play(String(x.motion||'idle'),x.options||{})};if(x.action==='stop')return {ok:c.stop(x.motion)};if(x.action==='stopAll')return {ok:c.stopAll()};if(x.action==='pose')return {ok:true,pose:c.setPose(x.pose||{})};if(x.action==='idlePose')return {ok:true,pose:c.setIdlePose(x.pose||{})};if(x.action==='resetPose')return {ok:c.resetPose()};if(x.action==='status')return {ok:true,status:c.status()};if(x.action==='remap')return {ok:c.remap(x.mapping||{})};if(x.action==='limit')return {ok:c.setLimit(x.slot,x.limit)};if(x.action==='semantic')return c.semantic(x.intent,x.options||{});if(x.action==='defineMotion')return {ok:true,motion:c.defineMotion(x.motion||{})};if(x.action==='deleteMotion')return {ok:c.deleteMotion(x.id)};if(x.action==='listMotions')return {ok:true,motions:c.listMotions()};if(x.action==='face')return {ok:true,result:c.face?.expression?.(x.expression,x.intensity)};if(x.action==='blink')return {ok:c.face?.blink?.()};if(x.action==='lookAt')return {ok:c.face?.lookAt?.(x.x,x.y,x.z)};if(x.action==='viseme')return {ok:c.face?.viseme?.(x.viseme,x.value)};if(x.action==='fingers')return {ok:c.fingers?.curl?.(x.hand,x.amount)};if(x.action==='boneNames')return {ok:true,bones:window.saeedAvatar?.getAvailableBoneNames?.()||[]};return {ok:false,error:'Unknown character controller action'}})()";
 try{return await characterWin.webContents.executeJavaScript(script,true)}catch(e){return {ok:false,error:e.message}}
});
ipcMain.handle("character:3d:get",()=>captureCharacter3DWindowSettings());
ipcMain.handle("character:3d:set",(_,patch={})=>{
 const current=captureCharacter3DWindowSettings(), next={...current,...patch,window:{...current.window,...(patch.window||{})},camera:{...current.camera,...(patch.camera||{})},character:{...current.character,...(patch.character||{})},canvas:{...current.canvas,...(patch.canvas||{})}};
 const saved=writeCharacter3DSettings(next);
 if(characterWin&&!characterWin.isDestroyed()){
  const w=Math.max(300,Math.min(1400,Math.round(Number(saved.window.width)||430))),h=Math.max(360,Math.min(1400,Math.round(Number(saved.window.height)||520)));
  characterWin.setSize(w,h,false);
  if(Number.isFinite(Number(saved.window.x))&&Number.isFinite(Number(saved.window.y))){const d=screen.getDisplayNearestPoint({x:Math.round(Number(saved.window.x))+w/2,y:Math.round(Number(saved.window.y))+h/2})||screen.getPrimaryDisplay();const a=d.workArea;const x=Math.max(a.x,Math.min(Math.round(Number(saved.window.x)),a.x+Math.max(0,a.width-w)));const y=Math.max(a.y,Math.min(Math.round(Number(saved.window.y)),a.y+Math.max(0,a.height-h)));saved.window.x=x;saved.window.y=y;}
  writeCharacter3DSettings(saved);
  characterWin.webContents.send("character:3d-settings",saved);
 }
 return saved;
});

ipcMain.handle("settings:set",async(_,s)=>{
 await ensureBrain();
 const previous={...agent.settings};
 agent.settings={...previous,...(s||{}),brainMode:["api","local","auto"].includes(String((s||{}).brainMode||""))?String((s||{}).brainMode):String(previous.brainMode||"auto")};
 delete agent.settings.alwaysListening;
 if(agent.settings.micMode==="always"||agent.settings.micMode==="ptt")agent.settings.micMode="on";
 if(agent.settings.micMode!=="on")agent.settings.micMode="off";
 const mode=String(agent.settings.brainMode||"auto");
 let micMode=String(agent.settings.micMode||currentMicMode||"off");
 const realtimeChanged=Object.prototype.hasOwnProperty.call(s||{},"realtimeEnabled")&&previous.realtimeEnabled!==agent.settings.realtimeEnabled;
 const voiceConfigChanged=["sttProvider","sttModel","sttLanguage","ttsProvider","ttsModel","ttsVoice","voiceRouting","micPath","realtimeProvider","realtimeModel","realtimeVoice","micSpeechRms","micInterruptRms"].some(k=>Object.prototype.hasOwnProperty.call(s||{},k)&&previous[k]!==agent.settings[k]);
 // Non-local STT must use the selected STT pipeline unless the user explicitly chooses Realtime.
 if(Object.prototype.hasOwnProperty.call(s||{},"sttProvider")&&String(agent.settings.sttProvider||"whisper")!=="whisper"&&!Object.prototype.hasOwnProperty.call(s||{},"micPath"))agent.settings.micPath="whisper";
 if(mode!=="api"&&agent.settings.realtimeEnabled)agent.settings.realtimeEnabled=false;
 if(mode!=="api"||!agent.settings.realtimeEnabled||agent.settings.micPath!=="realtime")getVoiceRuntime().stop();
 if(Object.prototype.hasOwnProperty.call(s||{},"micMode"))setMicMode(micMode);
 if(Object.prototype.hasOwnProperty.call(s||{},"micPath")&&previous.micPath!==agent.settings.micPath&&micMode==="on"){setMicMode("off").then(()=>setMicMode("on"));} if(realtimeChanged&&micMode==="on")setMicMode("off").then(()=>setMicMode("on"));
 if(Object.prototype.hasOwnProperty.call(s||{},"characterSize"))setSaeedSize(agent.settings.characterSize);
 if(Object.prototype.hasOwnProperty.call(s||{},"displayMode")&&characterWin&&!characterWin.isDestroyed())characterWin.setAlwaysOnTop(agent.settings.displayMode==="always-on-top");
 if(Object.prototype.hasOwnProperty.call(s||{},"characterController")||Object.prototype.hasOwnProperty.call(s||{},"characterBehavior")||Object.prototype.hasOwnProperty.call(s||{},"idleThoughtsEnabled")||Object.prototype.hasOwnProperty.call(s||{},"brainController")||Object.prototype.hasOwnProperty.call(s||{},"mood")||Object.prototype.hasOwnProperty.call(s||{},"appearance")||Object.prototype.hasOwnProperty.call(s||{},"zoom")||Object.prototype.hasOwnProperty.call(s||{},"muteSounds")||Object.prototype.hasOwnProperty.call(s||{},"brainMode")||Object.prototype.hasOwnProperty.call(s||{},"voiceRouting")||Object.prototype.hasOwnProperty.call(s||{},"ttsProvider"))characterWin?.webContents.send("character:behavior",{type:"settings",settings:agent.publicSettings()});
 if(previous.sttProvider!==agent.settings.sttProvider||previous.micMode!==micMode)diagnostic("INFO","MIC CONFIG","Microphone configuration applied",{mode:micMode,sttProvider:agent.settings.sttProvider});
 if(Object.prototype.hasOwnProperty.call(s||{},"characterController")&&characterWin&&!characterWin.isDestroyed()){
  const cc=agent.settings.characterController||{};
  const script="(()=>{const c=window.saeedCharacterController;if(!c)return false;if("+JSON.stringify(cc)+".idlePose)return c.setIdlePose("+JSON.stringify(cc)+".idlePose);return true})()";
  characterWin.webContents.executeJavaScript(script,true).catch(()=>{});
}
if(brainSupervisor)void brainSupervisor.refresh?.();
 diagnostic("INFO","BRAIN MODE","Brain mode selected: "+mode);
 return agent.publicSettings();
});
function audioProviderConfig(kind,s){const provider=String(s?.[kind+"Provider"]||"local");if(kind==="tts")return provider==="openai"?{provider,baseUrl:"https://api.openai.com/v1/audio/speech",key:s.ttsApiKey,model:s.ttsModel||"gpt-4o-mini-tts",voice:s.ttsVoice||"alloy"}:provider==="groq"?{provider,baseUrl:"https://api.groq.com/openai/v1/audio/speech",key:s.ttsApiKey,model:(!s.ttsModel||s.ttsModel==="gpt-4o-mini-tts")?"canopylabs/orpheus-v1-english":s.ttsModel,voice:["autumn","diana","hannah","austin","daniel","troy"].includes(String(s.ttsVoice||""))?s.ttsVoice:"austin"}:provider==="elevenlabs"?{provider,baseUrl:"https://api.elevenlabs.io/v1/text-to-speech/"+encodeURIComponent(s.ttsVoice||"JBFqnCBsd6RMkjVDRZzb"),key:s.ttsApiKey,model:s.ttsModel||"eleven_flash_v2_5",voice:s.ttsVoice||"JBFqnCBsd6RMkjVDRZzb"}:{provider};return provider==="openai"?{provider,baseUrl:"https://api.openai.com/v1/audio/transcriptions",key:s.sttApiKey,model:(!s.sttModel||s.sttModel==="base-q5_1")?"gpt-4o-mini-transcribe":s.sttModel}:provider==="groq"?{provider,baseUrl:"https://api.groq.com/openai/v1/audio/transcriptions",key:s.sttApiKey,model:(!s.sttModel||s.sttModel==="base-q5_1")?"whisper-large-v3-turbo":s.sttModel}:provider==="elevenlabs"?{provider,baseUrl:"https://api.elevenlabs.io/v1/speech-to-text",key:s.sttApiKey,model:(!s.sttModel||s.sttModel==="base-q5_1")?"scribe_v2":s.sttModel}:{provider}}
function pcm16ToWav(base64,rate=24000){const pcm=Buffer.from(String(base64||""),"base64"),h=Buffer.alloc(44);h.write("RIFF",0);h.writeUInt32LE(36+pcm.length,4);h.write("WAVE",8);h.write("fmt ",12);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);h.writeUInt32LE(rate,24);h.writeUInt32LE(rate*2,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write("data",36);h.writeUInt32LE(pcm.length,40);return Buffer.concat([h,pcm])}
ipcMain.handle("tts:speak",async(_,text)=>{const s=agent?.settings||{},cfg=audioProviderConfig("tts",s),input=String(text||"").trim();if(!input)return{ok:false,reason:"empty"};if(cfg.provider==="local")return{ok:false,reason:"tts-provider-local"};if(!cfg.key&&cfg.provider==="openai")cfg.key=s.apiKey||"";if(!cfg.key)return{ok:false,error:String(cfg.provider).toUpperCase()+" TTS API key is missing"};try{const body=cfg.provider==="elevenlabs"?{text:input,model_id:cfg.model}: {model:cfg.model,input,response_format:"wav"};if(cfg.voice&&cfg.provider!=="elevenlabs")body.voice=cfg.voice;const headers=cfg.provider==="elevenlabs"?{"xi-api-key":cfg.key,"Content-Type":"application/json"}:{"Authorization":"Bearer "+cfg.key,"Content-Type":"application/json"};const r=await fetch(cfg.baseUrl+(cfg.provider==="elevenlabs"?"?output_format=mp3_44100_128":""),{method:"POST",headers,body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});if(!r.ok){const msg=await r.text().catch(()=>"");diagnostic("ERROR","TTS API",cfg.provider.toUpperCase()+" TTS HTTP "+r.status+(msg?": "+msg.slice(0,240):""));return{ok:false,error:cfg.provider.toUpperCase()+" TTS HTTP "+r.status}}const b=Buffer.from(await r.arrayBuffer());diagnostic("INFO","TTS API AUDIO",cfg.provider.toUpperCase()+" TTS audio generated",{bytes:b.length,model:cfg.model,voice:cfg.voice||""});return{ok:true,base64:b.toString("base64")}}catch(e){diagnostic("ERROR","TTS API",e.message);return{ok:false,error:e.message}}});
ipcMain.handle("stt:transcribe",async(_,base64)=>{const s=agent?.settings||{},cfg=audioProviderConfig("stt",s);if(cfg.provider==="local")return{ok:false,reason:"stt-provider-local"};if(!cfg.key&&cfg.provider==="openai")cfg.key=s.apiKey||"";if(!cfg.key)return{ok:false,error:String(cfg.provider).toUpperCase()+" STT API key is missing"};try{const wav=pcm16ToWav(base64,24000),form=new FormData();form.append("file",new Blob([wav],{type:"audio/wav"}),"saeed.wav");if(cfg.provider==="elevenlabs")form.append("model_id",cfg.model);else{form.append("model",cfg.model);form.append("response_format","json");}if(s.sttLanguage&&s.sttLanguage!=="auto")form.append("language",String(s.sttLanguage));const headers=cfg.provider==="elevenlabs"?{"xi-api-key":cfg.key}:{"Authorization":"Bearer "+cfg.key};const r=await fetch(cfg.baseUrl,{method:"POST",headers,body:form,signal:AbortSignal.timeout(60000)});const body=await r.text();if(!r.ok){diagnostic("ERROR","STT API",cfg.provider.toUpperCase()+" STT HTTP "+r.status+(body?": "+body.slice(0,240):""));return{ok:false,error:cfg.provider.toUpperCase()+" STT HTTP "+r.status}}let j={};try{j=JSON.parse(body)}catch{}const text=String(j.text||body||"").trim();diagnostic("INFO","STT API RESULT",cfg.provider.toUpperCase()+" STT transcript received",{model:cfg.model,text});return{ok:true,text}}catch(e){diagnostic("ERROR","STT API",e.message);return{ok:false,error:e.message}}});
ipcMain.handle("realtime:start",(_,options={})=>{getVoiceRuntime().start(options);return true});
ipcMain.handle("api:clear-all",async()=>{if(agent){agent.settings={...agent.settings,apiKey:"",sttApiKey:"",ttsApiKey:"",realtimeApiKey:"",realtimeEnabled:false,micMode:"off"};agent.persistSettings()}try{getVoiceRuntime().stop()}catch{}currentMicMode="off";diagnostic("INFO","API RESET","All stored API keys cleared and Realtime disabled");return agent?.publicSettings()||null});
ipcMain.handle("realtime:stop",()=>{getVoiceRuntime().stop();return true});
ipcMain.handle("realtime:audio",(_,base64)=>{getVoiceRuntime().getRealtime()?.appendAudio(String(base64||""));return true});
ipcMain.handle("realtime:text",(_,text)=>getVoiceRuntime().getRealtime()?.text(String(text||""))||false);
ipcMain.handle("realtime:cancel",()=>{getVoiceRuntime().getRealtime()?.cancel();return true});ipcMain.handle("local-stt:transcribe",(_,base64)=>transcribeLocalWav(String(base64||"")));
function transcribeLocalWav(base64){return new Promise((resolve,reject)=>{const p=whisperRuntimePaths();const cli=p.exe;if(!fs.existsSync(cli)||!fs.existsSync(p.model)){
 diagnostic("ERROR","LOCAL STT","Whisper STT runtime is not installed",{runtime:p.root,cliExists:fs.existsSync(cli),modelExists:fs.existsSync(p.model)});
 return reject(new Error("Bundled Whisper runtime/model is missing from this Saeed installation."));
}const wav=path.join(app.getPath("temp"),"saeed-stt-"+Date.now()+".wav");try{const pcm=Buffer.from(String(base64||""),"base64");const header=Buffer.alloc(44);header.write("RIFF",0);header.writeUInt32LE(36+pcm.length,4);header.write("WAVE",8);header.write("fmt ",12);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(24000,24);header.writeUInt32LE(48000,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write("data",36);header.writeUInt32LE(pcm.length,40);fs.writeFileSync(wav,Buffer.concat([header,pcm]));const args=["-m",p.model,"-f",wav,"-nt","-np","--no-timestamps"];if(agent?.settings?.sttLanguage&&agent.settings.sttLanguage!=="auto")args.push("-l",String(agent.settings.sttLanguage));const child=spawn(cli,args,{cwd:path.dirname(cli),windowsHide:true});let out="",err="";child.stdout.setEncoding("utf8");child.stderr.setEncoding("utf8");child.stdout.on("data",d=>out+=d);child.stderr.on("data",d=>err+=d);child.on("error",e=>{try{fs.unlinkSync(wav)}catch{}reject(e)});child.on("close",code=>{try{fs.unlinkSync(wav)}catch{}if(code!==0)return reject(new Error(err.slice(-1200)||("Whisper CLI exited with code "+code)));const text=out.replace(/\x1b\[[0-9;]*[A-Za-z]/g,"").split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith("[")&&!x.startsWith("whisper_")).join(" ").replace(/^\s*[\[\(].*?[\]\)]\s*/,"").trim();diagnostic("INFO","LOCAL STT RESULT",text);resolve(text)})}catch(e){try{fs.unlinkSync(wav)}catch{}reject(e)}})}
ipcMain.handle("mic:mode",async(_,mode)=>await setMicMode(String(mode||"off"),true));
ipcMain.handle("voice:mute",async(_,muted)=>setVoiceMuted(Boolean(muted)));
ipcMain.on("mic:level",(_,level)=>{const v=Math.max(0,Math.min(1,Number(level)||0));diagnosticState.mic={...diagnosticState.mic,state:v>0?"active":diagnosticState.mic.state,level:v,detail:"Live microphone input"};for(const win of [statusWin,threeDStatusWin,characterWin])if(win&&!win.isDestroyed())win.webContents.send("mic:level",v);if(statusWin&&!statusWin.isDestroyed())statusWin.webContents.send("diagnostic:state",diagnosticState);});
ipcMain.handle("chat:minimize",()=>{if(!chatWin||chatWin.isDestroyed())return false;chatWin.minimize();return true});
ipcMain.on("chat:mouse-passthrough",(event,ignore)=>{
 const win=BrowserWindow.fromWebContents(event.sender);
 if(!win||win.isDestroyed()||win!==chatWin)return;
 win.setIgnoreMouseEvents(Boolean(ignore),{forward:true});
});

ipcMain.handle("capture",async()=>{
 const policy=permissionPolicy("screen");
 if(policy==="deny")return null;
 if(policy==="ask"&&!await confirmPermission("screen",{name:"screen_capture",args:{action:"capture screen"}}))return null;
 return captureScreen();
});
ipcMain.handle("update:check",async()=>{if(!app.isPackaged)return {ok:false,state:"unavailable",message:"Updates are available only in the installed Windows build."};try{updateUiRequested=true;updateState="checking";showUpdateToast("checking","Checking for updates…");voiceBroadcast("update:state","checking");const result=await getAutoUpdater().checkForUpdates();return {ok:true,state:updateState,version:result?.updateInfo?.version||null}}catch(e){updateState="error";showUpdateToast("error","Update check failed");chatWin?.webContents.send("update:state","error",e.message);setTimeout(()=>{updateUiRequested=false;hideUpdateToast();voiceBroadcast("update:state","idle")},3200);return {ok:false,state:"error",message:e.message}}});
ipcMain.handle("update:download",async()=>{if(updateState!=="available")return false;try{showUpdateStatus();updateState="downloading";publishUpdate("update:state","downloading");await getAutoUpdater().downloadUpdate();return true}catch(e){updateState="error";publishUpdate("update:state","error",e.message);return false}});
ipcMain.handle("update:install",()=>{if(updateState!=="downloaded")return false;getAutoUpdater().quitAndInstall(false,true);return true});
ipcMain.handle("update:show-status",()=>showUpdateStatus());
ipcMain.handle("update:toast-close",()=>{updateUiRequested=false;hideUpdateToast();return true});
ipcMain.handle("update:snapshot",()=>({state:updateState,info:updateInfo,currentVersion:app.getVersion()}));
ipcMain.handle("update:state",()=>updateState);

ipcMain.handle("history:get",()=>agent?.history||[]);
ipcMain.handle("chat:list",()=>agent?.listConversations?.()||[]);
ipcMain.handle("chat:current",()=>agent?.getCurrentConversation?.()||null);
ipcMain.handle("chat:memory",()=>agent?.getGlobalMemory?.()||[]);
ipcMain.handle("chat:new",()=>{if(!agent)return null;const chat=agent.newConversation();chatWin?.webContents.send("chat:switched",chat,[]);return {chat,history:[]};});
ipcMain.handle("chat:select",(_,id)=>{if(!agent)return null;const chat=agent.selectConversation(String(id||""));if(!chat)return null;const history=agent.history||[];chatWin?.webContents.send("chat:switched",chat,history);return {chat,history};});
ipcMain.handle("history:clear",()=>{if(!agent)return false;agent.clearHistory();chatWin?.webContents.send("history:cleared");return true});
ipcMain.handle("agent:confirm-response",(_,id,approved)=>{
 const resolve=confirmations.get(id);if(!resolve)return false;
 confirmations.delete(id);resolve(Boolean(approved));return true;
});

ipcMain.on("window:move-by",(_,dx,dy)=>{
 if(!characterWin)return;
 const [x,y]=characterWin.getPosition(),[w,h]=characterWin.getSize();
 const nextX=x+Math.round(Number(dx)||0),nextY=y+Math.round(Number(dy)||0);
 const center={x:nextX+w/2,y:nextY+h/2};
 const d=screen.getDisplayNearestPoint(center)||screen.getPrimaryDisplay();
 const a=d.workArea;
 const nx=Math.max(a.x,Math.min(nextX,a.x+Math.max(0,a.width-w)));
 const ny=Math.max(a.y,Math.min(nextY,a.y+Math.max(0,a.height-h)));
 characterWin.setPosition(nx,ny,true);
});
ipcMain.on("chat:move-by",(_,dx,dy)=>{if(!chatWin||chatWin.isDestroyed())return;const [x,y]=chatWin.getPosition(),[w,h]=chatWin.getSize();const nx=x+Math.round(Number(dx)||0),ny=y+Math.round(Number(dy)||0);const d=screen.getDisplayNearestPoint({x:nx+w/2,y:ny+h/2})||screen.getPrimaryDisplay(),a=d.workArea;chatWin.setPosition(Math.max(a.x,Math.min(nx,a.x+Math.max(0,a.width-w))),Math.max(a.y,Math.min(ny,a.y+Math.max(0,a.height-h))),true)});
ipcMain.on("window:show-chat",()=>{void showChat()});
ipcMain.on("window:close-chat",()=>{if(chatWin&&!chatWin.isDestroyed()){chatWin.setIgnoreMouseEvents(false);chatWin.close()}});

app.on("activate",()=>{if(characterWin&&!characterWin.isDestroyed()){showCharacter();return}createWindow().catch(e=>console.error(e))});
app.on("window-all-closed",()=>{if(process.platform!=="darwin"&&!app.isQuitting)app.quit()});
app.on("before-quit",()=>{
 try{captureCharacter3DWindowSettings()}catch{}
 app.isQuitting=true;
 try{getVoiceRuntime().stop()}catch(e){console.error("Voice shutdown failed:",e)}
 for(const win of [chatWin,performanceWin,settingsWin,addonsWin,learningWin,statusWin,threeDStatusWin,characterWin]){try{if(win&&!win.isDestroyed())win.destroy()}catch(e){console.error("Window shutdown failed:",e)}}
 try{if(tray){tray.destroy();tray=null}}catch(e){console.error("Tray shutdown failed:",e)}
});
app.on("will-quit",()=>{globalShortcut.unregisterAll();try{getVoiceRuntime().stop()}catch{}try{if(cpuTimer)clearInterval(cpuTimer)}catch{}cpuTimer=null})
async function createChatWindow(){
 if(chatWin&&!chatWin.isDestroyed())return chatWin;
 chatWin=new BrowserWindow({name:"saeed-chat",width:820,height:620,minWidth:560,minHeight:400,frame:false,transparent:true,alwaysOnTop:false,show:false,hasShadow:false,resizable:true,skipTaskbar:false,icon:windowsIconPath(),webPreferences:{preload:path.join(__dirname,"..","preload.js"),contextIsolation:true,nodeIntegration:false,sandbox:false}});
 chatWin.setIcon(windowsIconPath());
 if(process.platform==="win32")chatWin.setAppDetails({appId:"ai.saeed.desktop",appIconPath:windowsIconPath(),appIconIndex:0,relaunchCommand:process.execPath,relaunchDisplayName:"Saeed AI Chat"});
 chatWin.on("closed",()=>{chatWin=null});
 chatWin.webContents.on("context-menu",(event,params)=>{event.preventDefault();const items=[];if(params.isEditable){items.push({role:"undo"},{role:"redo"},{role:"cut"},{role:"copy"},{role:"paste"},{role:"selectAll"});}else if(params.selectionText){items.push({role:"copy"},{role:"selectAll"});}else{items.push({role:"selectAll"});}Menu.buildFromTemplate(items).popup({window:chatWin});});
 chatWin.setIgnoreMouseEvents(false);
 await chatWin.loadFile(path.join(__dirname,"..","index.html"));
 return chatWin;
}
function handleLaunchArgs(args=[]){const a=args.map(String);if(a.includes("--exit"))return app.quit();if(a.includes("--show-saeed"))return showCharacter();if(a.includes("--chat"))return showChat();if(a.includes("--performance"))return showPerformance();if(a.includes("--settings"))return showSettings();if(a.includes("--addons"))return showAddons();if(a.includes("--learning"))return showLearning();if(a.includes("--status"))return showStatus();if(a.includes("--3d-status"))return show3DStatus();if(a.includes("--mic-on"))return setMicMode("on");if(a.includes("--mic-off"))return setMicMode("off");if(a.includes("--size-small"))return setSaeedSize("small");if(a.includes("--size-medium"))return setSaeedSize("medium");if(a.includes("--size-large"))return setSaeedSize("large");return showCharacter()}
async function createWindow(){
 await createCharacterWindow();
 if(ciSmoke)scheduleCiRuntimeSmoke();
}
async function createCharacterWindow(){
 characterWin=new BrowserWindow({name:"saeed-character",width:430,height:520,minWidth:300,minHeight:360,frame:false,transparent:true,alwaysOnTop:true,show:false,hasShadow:false,resizable:true,skipTaskbar:false,icon:windowsIconPath(),webPreferences:{preload:path.join(__dirname,"..","preload.js"),contextIsolation:true,nodeIntegration:false,sandbox:false}});
 characterWin.setIcon(windowsIconPath());
 if(process.platform==="win32")characterWin.setAppDetails({appId:"ai.saeed.desktop",appIconPath:windowsIconPath(),appIconIndex:0,relaunchCommand:process.execPath,relaunchDisplayName:"Saeed AI Character"});
 characterWin.on("closed",()=>{try{captureCharacter3DWindowSettings()}catch{};characterWin=null});
 characterWin.on("close",()=>{if(!app.isQuitting())diagnostic("INFO","WINDOW","Saeed character window closed");});
 characterWin.webContents.on("context-menu",()=>contextMenu());
 await characterWin.loadFile(path.join(__dirname,"..","character.html"));
 applyCharacter3DWindowSettings();
 try{const saved=readPersistedCharacter();const bundled=path.join(__dirname,"..","..","assets","Saeed_Test-3D.glb");const source=saved||((fs.existsSync(bundled))?{data:new Uint8Array(fs.readFileSync(bundled)),path:bundled,size:fs.statSync(bundled).size}:null);if(source){pendingCharacterData={data:source.data,generation:++characterLoadGeneration};setTimeout(()=>{if(characterWin&&!characterWin.isDestroyed()&&pendingCharacterData)characterWin.webContents.send("character:selected",pendingCharacterData.data,pendingCharacterData.generation)},0);diagnostic("INFO",saved?"GLB RESTORE":"GLB DEFAULT",saved?"Previously selected character restored":"Bundled Saeed_Test-3D.glb loaded as the default character",{size:source.size,path:source.path})}else diagnostic("ERROR","GLB DEFAULT","No default or persisted Saeed GLB is available")}catch(e){diagnostic("ERROR","GLB STARTUP",e.message)}
 if(!Number.isFinite(Number(readCharacter3DSettings().window.x))||!Number.isFinite(Number(readCharacter3DSettings().window.y)))fitCharacterToDisplay(screen.getPrimaryDisplay(),{bottomRight:true});
 characterWin.show();
}

;