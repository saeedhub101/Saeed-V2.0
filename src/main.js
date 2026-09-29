const {app,BrowserWindow,ipcMain,globalShortcut,desktopCapturer,Tray,Menu,screen,dialog,nativeImage,session}=require("electron");
const path=require("path"),fs=require("fs"),os=require("os"),{spawn}=require("child_process"),{Agent}=require("./agent"),{ToolRegistry}=require("./tools"),{OpenAIRealtime}=require("./realtime"),{LocalBrain}=require("./local-brain"),{autoUpdater}=require("electron-updater");

process.on("uncaughtException",e=>console.error("Saeed uncaught:",e));
process.on("unhandledRejection",e=>console.error("Saeed rejection:",e));
// Explicit Electron microphone permission handling for the user-controlled microphone lifecycle.
// Chromium must be allowed to request/use media audio before getUserMedia can open the device.
function configureMediaPermissions(){
 try{
  session.defaultSession.setPermissionCheckHandler((webContents,permission,origin,details)=>{
   if(permission==="media")return true;
   return true;
  });
  session.defaultSession.setPermissionRequestHandler((webContents,permission,callback,details)=>{
   if(permission==="media"){diagnostic("INFO","MIC PERMISSION","Electron granted media permission",details||{});callback(true);return;}
   callback(true);
  });
  diagnostic("INFO","MIC PERMISSION","Electron microphone/media permission handlers configured");
 }catch(e){diagnostic("ERROR","MIC PERMISSION",e.message)}
}


let chatWin,characterWin,performanceWin,agent,tray,realtime,statusWin,threeDStatusWin;
const pending3DQueries=new Map();
const diagnosticState={mic:{state:"unknown",level:0,detail:""},brainApi:{state:"unknown",detail:""},brainLocal:{state:"ready",detail:"Local intent engine"},stt:{state:"unknown",detail:""},tts:{state:"unknown",detail:""},glb:{state:"unknown",detail:""},cpu:{state:"unknown",percent:0,detail:"Waiting for CPU measurement"},threeD:{overall:{state:"unknown",detail:"Waiting for 3D renderer"},components:{},lastUpdated:null}};
function diagnostic(level,stage,message,meta={}){
 const event={time:new Date().toISOString(),level:String(level||"INFO").toUpperCase(),stage:String(stage||"GENERAL"),message:String(message||""),meta:meta||{}};
 if(statusWin&&!statusWin.isDestroyed())statusWin.webContents.send("diagnostic:event",event);if(threeDStatusWin&&!threeDStatusWin.isDestroyed())threeDStatusWin.webContents.send("diagnostic:event",event);if(chatWin&&!chatWin.isDestroyed())chatWin.webContents.send("diagnostic:event",event);if(characterWin&&!characterWin.isDestroyed())characterWin.webContents.send("diagnostic:event",event);updateDiagnosticState(event);return event;
}
function publish3DStatus(report){if(!report)return;diagnosticState.threeD=report;diagnosticState.threeD.lastUpdated=new Date().toISOString();if(threeDStatusWin&&!threeDStatusWin.isDestroyed())threeDStatusWin.webContents.send("3d:status",diagnosticState.threeD)}
function request3DStatus(){return new Promise(resolve=>{if(!characterWin||characterWin.isDestroyed()){const report={overall:{state:"error",detail:"3D character window is not available"},components:{},lastUpdated:new Date().toISOString()};publish3DStatus(report);resolve(report);return}const id=Date.now().toString(36)+Math.random().toString(36).slice(2,8);const timer=setTimeout(()=>{pending3DQueries.delete(id);const report={...diagnosticState.threeD,overall:{state:"error",detail:"3D renderer status query timed out"}};publish3DStatus(report);resolve(report)},1800);pending3DQueries.set(id,report=>{clearTimeout(timer);pending3DQueries.delete(id);publish3DStatus(report);resolve(report)});characterWin.webContents.send("3d:query",id)})}
function show3DStatus(){if(threeDStatusWin&&!threeDStatusWin.isDestroyed()){threeDStatusWin.show();threeDStatusWin.focus();request3DStatus().then(r=>threeDStatusWin?.webContents.send("3d:status",r));return}threeDStatusWin=new BrowserWindow({width:900,height:700,minWidth:680,minHeight:500,title:"Saeed 3D Status",show:false,backgroundColor:"#f5f7fb",icon:windowsIconPath(),webPreferences:{preload:path.join(__dirname,"preload.js"),contextIsolation:true,nodeIntegration:false,sandbox:false}});threeDStatusWin.on("closed",()=>{threeDStatusWin=null});threeDStatusWin.loadFile(path.join(__dirname,"3d-status.html")).then(async()=>{threeDStatusWin?.show();threeDStatusWin?.focus();const r=await request3DStatus();threeDStatusWin?.webContents.send("3d:status",r)}).catch(e=>diagnostic("ERROR","3D STATUS WINDOW",e.message))}
function updateDiagnosticState(e){const s=String(e.stage||"").toUpperCase(),fail=e.level==="ERROR";
 if(s.includes("MIC")){const msg=String(e.message||"").toLowerCase();const disabled=s.includes("MIC MODE")&&msg.includes("off")||s.includes("MIC STOP")||s.includes("MIC PERMISSION");diagnosticState.mic.state=fail?"error":disabled?"disabled":"active";diagnosticState.mic.detail=e.message;if(disabled)diagnosticState.mic.level=0;else if(e.meta?.level!=null)diagnosticState.mic.level=Number(e.meta.level)||0}
 if(s.includes("LLM")||s.includes("BRAIN API")){diagnosticState.brainApi.state=fail?"error":(s.includes("SUCCESS")||s.includes("CONNECTED")?"connected":"active");diagnosticState.brainApi.detail=e.message}
 if(s.includes("LOCAL")){diagnosticState.brainLocal.state=fail?"error":"ready";diagnosticState.brainLocal.detail=e.message}
 if(s.includes("STT")){diagnosticState.stt.state=fail?"error":s.includes("DISCONNECTED")?"disabled":(s.includes("READY")||s.includes("CONNECTED")||s.includes("ACTIVE")||s.includes("START")?"active":diagnosticState.stt.state);diagnosticState.stt.detail=e.message}
 if(s.includes("TTS")){diagnosticState.tts.state=fail?"error":s.includes("DISCONNECTED")?"disabled":(s.includes("READY")||s.includes("CONNECTED")||s.includes("ACTIVE")||s.includes("START")||s.includes("SUCCESS")?"active":diagnosticState.tts.state);diagnosticState.tts.detail=e.message}
 if(s.includes("GLB")||s.includes("CHARACTER READY")){diagnosticState.glb.state=fail?"error":s.includes("READY")?"ready":"active";diagnosticState.glb.detail=e.message}
 if((s.startsWith("3D")||s.startsWith("THREE")||s.includes("WEBGL")||s.includes("GLTF")||s.includes("CANVAS")||s.includes("RENDER LOOP"))&&diagnosticState.threeD){diagnosticState.threeD.lastEvent={time:e.time,level:e.level,stage:e.stage,message:e.message}}
 if(statusWin&&!statusWin.isDestroyed())statusWin.webContents.send("diagnostic:state",diagnosticState);
}
let cpuTimer=null;
function startCpuMonitoring(){
 if(cpuTimer)return;
 updateCpuMetrics();
 cpuTimer=setInterval(updateCpuMetrics,1000);
}
function stopCpuMonitoring(){
 if(statusWin||performanceWin)return;
 if(cpuTimer)clearInterval(cpuTimer);
 cpuTimer=null;
}

function updateCpuMetrics(){try{const metrics=app.getAppMetrics();const logical=Math.max(1,os.cpus().length);const total=metrics.reduce((sum,m)=>sum+Number(m?.cpu?.percentCPUUsage||0),0);const percent=Math.max(0,total/logical);diagnosticState.cpu={state:"active",percent,detail:`Saeed CPU ${percent.toFixed(1)}% across ${logical} logical processors`,processCount:metrics.length,lastUpdated:new Date().toISOString()};if(statusWin&&!statusWin.isDestroyed())statusWin.webContents.send("diagnostic:state",diagnosticState);if(chatWin&&!chatWin.isDestroyed())chatWin.webContents.send("cpu:metrics",diagnosticState.cpu)}catch(e){diagnosticState.cpu={state:"error",percent:0,detail:e.message,lastUpdated:new Date().toISOString()};diagnostic("ERROR","CPU METRICS",e.message)}}
function diagnosticFromAgent(e){if(!e)return;if(e.type==="thinking")diagnostic("INFO","LLM THINKING","LLM planning/execution step "+(Number(e.step||0)+1));if(e.type==="answer")diagnostic("INFO","LLM SUCCESS","Successful LLM response");if(e.type==="tool_error")diagnostic("ERROR","LLM TOOL ERROR",e.error||"Tool failed",{tool:e.name});if(e.type==="tool_result")diagnostic("INFO","LLM TOOL SUCCESS","Tool completed",{tool:e.name});if(e.type==="diagnostic")diagnostic(e.level,e.stage,e.message,e.meta);}

// AUTHORITATIVE SAEED ICON CODE — DO NOT REMOVE OR REPLACE.
// This code defines the official Saeed Windows application/taskbar icon source.
function windowsIconPath(){
 const ico=path.join(__dirname,"..","assets","saeed.ico");
 const png=path.join(__dirname,"..","assets","saeed.png");
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
else app.on("second-instance",(event,commandLine)=>{if(commandLine.includes("--3d-status"))show3DStatus();else if(commandLine.includes("--chat"))showChat();else showChat();});
let updateState="idle",updateUiRequested=false;
const confirmations=new Map();
let resourceProbeTimer=null;
const resourceProbeSamples=[];
function resourceSnapshot(label="sample"){
 const usage=process.memoryUsage(), cpu=process.cpuUsage();
 const rss=Math.round(usage.rss/1048576), heapUsed=Math.round(usage.heapUsed/1048576), external=Math.round(usage.external/1048576);
 const sample={time:new Date().toISOString(),label,pid:process.pid,cpuUserMs:Math.round(cpu.user/1000),cpuSystemMs:Math.round(cpu.system/1000),rssMB:rss,heapUsedMB:heapUsed,heapTotalMB:Math.round(usage.heapTotal/1048576),externalMB:external,platform:process.platform};
 resourceProbeSamples.push(sample);if(resourceProbeSamples.length>120)resourceProbeSamples.shift();return sample;
}
function startResourceProbe(){if(resourceProbeTimer)return;resourceSnapshot("startup");resourceProbeTimer=setInterval(()=>resourceSnapshot("interval"),1000);resourceProbeTimer.unref?.()}
function stopResourceProbe(){if(resourceProbeTimer){clearInterval(resourceProbeTimer);resourceProbeTimer=null}}
function resourceReport(){return {process:resourceSnapshot("report"),samples:[...resourceProbeSamples]}}


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
async function showChat(){try{if(!chatWin||chatWin.isDestroyed())await createChatWindow();if(!chatWin||chatWin.isDestroyed())return;chatWin.setIgnoreMouseEvents(false);if(chatWin.isMinimized())chatWin.restore();chatWin.show();chatWin.focus();chatWin.webContents.send("chat:show")}catch(e){diagnostic("ERROR","CHAT WINDOW",e.message)}}
function closeChat(){if(chatWin&&!chatWin.isDestroyed()){chatWin.destroy();chatWin=null}}
async function showPerformance(){try{startCpuMonitoring();if(performanceWin&&!performanceWin.isDestroyed()){performanceWin.show();performanceWin.focus();return}performanceWin=new BrowserWindow({width:900,height:700,minWidth:700,minHeight:520,title:"Saeed Performance",show:false,resizable:true,skipTaskbar:false,icon:windowsIconPath(),webPreferences:{preload:path.join(__dirname,"preload.js"),contextIsolation:true,nodeIntegration:false,sandbox:false}});performanceWin.setIcon(windowsIconPath());performanceWin.on("closed",()=>{performanceWin=null;stopCpuMonitoring()});await performanceWin.loadFile(path.join(__dirname,"performance.html"));performanceWin.show();performanceWin.focus()}catch(e){diagnostic("ERROR","PERFORMANCE WINDOW",e.message)}}
function showCharacter(){if(!characterWin||characterWin.isDestroyed())return;characterWin.show();characterWin.focus()}
function showStatus(){startCpuMonitoring();if(statusWin&&!statusWin.isDestroyed()){statusWin.show();statusWin.focus();statusWin.webContents.send("diagnostic:snapshot",{state:diagnosticState});return}statusWin=new BrowserWindow({width:820,height:620,minWidth:620,minHeight:420,title:"Saeed Status",show:false,backgroundColor:"#f5f7fb",icon:windowsIconPath(),webPreferences:{preload:path.join(__dirname,"preload.js"),contextIsolation:true,nodeIntegration:false,sandbox:false}});statusWin.on("closed",()=>{statusWin=null;stopCpuMonitoring()});statusWin.loadFile(path.join(__dirname,"status.html")).then(()=>{statusWin.show();statusWin.webContents.send("diagnostic:snapshot",{state:diagnosticState})}).catch(e=>diagnostic("ERROR","STATUS WINDOW",e.message))}
function chooseCharacter(){dialog.showOpenDialog(characterWin||chatWin,{title:"Choose Saeed Character",filters:[{name:"GLB 3D Character",extensions:["glb"]}],properties:["openFile"]}).then(r=>{if(r.canceled||!r.filePaths[0])return;const file=r.filePaths[0];try{const data=fs.readFileSync(file);characterWin?.webContents.send("character:selected",new Uint8Array(data));diagnostic("INFO","GLB SELECTED","Character GLB selected",{name:path.basename(file),size:data.length})}catch(e){diagnostic("ERROR","GLB SELECTED",e.message)}})}

function whisperRuntimePaths(){const root=app.isPackaged?process.resourcesPath:path.join(__dirname,"..","build");return{exe:path.join(root,"whisper","whisper-cli.exe"),model:path.join(root,"whisper","ggml-base-q5_1.bin")}}
function voiceBroadcast(channel,...args){for(const win of [characterWin,chatWin]){if(win&&!win.isDestroyed())win.webContents.send(channel,...args)}}
let currentMicMode="off";
function rebuildTray(){if(!tray)return;tray.setContextMenu(Menu.buildFromTemplate([{label:"Show Saeed",click:showCharacter},{label:"Chat Me",click:showChat},{label:"3D Status",click:show3DStatus},{label:"Status",click:showStatus},{label:"Hide Saeed",click:()=>characterWin?.hide()},{type:"separator"},{label:"Mic ON",type:"radio",checked:currentMicMode==="on",click:()=>setMicMode("on")},{label:"Mic OFF",type:"radio",checked:currentMicMode==="off",click:()=>setMicMode("off")},{label:"Change Character (GLB)",click:chooseCharacter},{label:"Check for Updates",click:async()=>{if(!app.isPackaged)return;updateUiRequested=true;try{updateState="checking";voiceBroadcast("update:state","checking");await autoUpdater.checkForUpdates()}catch(e){updateState="error";voiceBroadcast("update:state","error",e.message)}}},{label:"Performance",click:showPerformance},{label:"Saeed Size",submenu:[{label:"Small",click:()=>setSaeedSize("small")},{label:"Medium",click:()=>setSaeedSize("medium")},{label:"Large",click:()=>setSaeedSize("large")}]},{type:"separator"},{label:"Quit",click:()=>app.quit()}]))}
function setMicMode(mode){
 const value=String(mode||"off")==="on"?"on":"off";
 currentMicMode=value;
 if(agent)agent.settings={...agent.settings,micMode:value,brainMode:"auto"};
 diagnosticState.mic={...diagnosticState.mic,state:value==="on"?"active":"disabled",level:value==="on"?diagnosticState.mic.level:0,detail:value==="on"?"Microphone ON":"Microphone OFF"};
 voiceBroadcast("mic:mode",value);
 if(statusWin&&!statusWin.isDestroyed())statusWin.webContents.send("mic:mode",value);
 if(value==="off"){
  stopRealtime();
  diagnostic("INFO","STT DISCONNECTED","Speech-to-text is stopped");
  diagnostic("INFO","TTS DISCONNECTED","Text-to-speech is idle");
  voiceBroadcast("local-stt:state","disconnected","Microphone is off");
 }else{
  if(agent?.settings?.sttProvider==="whisper"){voiceBroadcast("local-stt:state","ready","Local Whisper ready");diagnostic("INFO","STT READY","Local Whisper is ready for microphone input");}
  diagnostic("INFO","TTS READY","TTS is ready for voice replies");
  if(String(agent?.settings?.brainMode||"auto")==="realtime")startRealtime();
 }
 diagnostic("INFO","MIC MODE","Microphone mode: "+value);
 rebuildTray();
}
function setSaeedSize(size){const m={small:[360,440],medium:[430,520],large:[520,620]};const v=m[size]||m.medium;characterWin?.setSize(v[0],v[1],true)}
function contextMenu(){
 const menu=Menu.buildFromTemplate([
  {label:"Chat Me",click:showChat},
  {label:"3D Status",click:show3DStatus},
  {label:"Hide Saeed",click:()=>characterWin?.hide()},
  {type:"separator"},
  {label:"Change Character (GLB)",click:chooseCharacter},
  {label:"Performance",click:showPerformance},
  {type:"separator"},{label:"Quit",click:()=>app.quit()}
 ]);
 menu.popup({window:characterWin});
}
async function createChatWindow(){
 if(chatWin&&!chatWin.isDestroyed())return chatWin;
 chatWin=new BrowserWindow({name:"saeed-chat",width:760,height:560,minWidth:520,minHeight:360,frame:false,transparent:true,alwaysOnTop:false,show:false,hasShadow:false,resizable:true,skipTaskbar:false,icon:windowsIconPath(),webPreferences:{preload:path.join(__dirname,"preload.js"),contextIsolation:true,nodeIntegration:false,sandbox:false}});
 chatWin.setIcon(windowsIconPath());
 if(process.platform==="win32")chatWin.setAppDetails({appId:"ai.saeed.desktop",appIconPath:windowsIconPath(),appIconIndex:0,relaunchCommand:process.execPath,relaunchDisplayName:"Saeed AI Chat"});
 chatWin.on("closed",()=>{chatWin=null});
 chatWin.webContents.on("context-menu",(event,params)=>{event.preventDefault();const items=[];if(params.isEditable){items.push({role:"undo"},{role:"redo"},{type:"separator"},{role:"cut"},{role:"copy"},{role:"paste"},{role:"selectAll"});}else if(params.selectionText){items.push({role:"copy"},{role:"selectAll"});}else{items.push({role:"selectAll"});}Menu.buildFromTemplate(items).popup({window:chatWin});});
 chatWin.setIgnoreMouseEvents(false);
 await chatWin.loadFile(path.join(__dirname,"index.html"));
 return chatWin;
}
async function createWindow(){
 await createCharacterWindow();
 const registry=new ToolRegistry({captureScreen,userDataPath:app.getPath("userData"),confirm:async({name,args})=>{await showChat();return new Promise(resolve=>{const id=Date.now().toString(36)+Math.random().toString(36).slice(2,7);confirmations.set(id,resolve);chatWin?.webContents.send("agent:confirm",{id,name,args});});}});
 agent=new Agent({registry,onEvent:e=>{diagnosticFromAgent(e);voiceBroadcast("agent:event",e)}});agent.localBrain=new LocalBrain(registry);
}
async function createCharacterWindow(){
 characterWin=new BrowserWindow({name:"saeed-character",width:430,height:520,minWidth:300,minHeight:360,frame:false,transparent:true,alwaysOnTop:true,show:false,hasShadow:false,resizable:true,skipTaskbar:false,icon:windowsIconPath(),webPreferences:{preload:path.join(__dirname,"preload.js"),contextIsolation:true,nodeIntegration:false,sandbox:false}});
 characterWin.setIcon(windowsIconPath());
 if(process.platform==="win32")characterWin.setAppDetails({appId:"ai.saeed.desktop",appIconPath:windowsIconPath(),appIconIndex:0,relaunchCommand:process.execPath,relaunchDisplayName:"Saeed AI Character"});
 characterWin.on("closed",()=>{characterWin=null});
 characterWin.on("close",e=>{if(!app.isQuitting()){e.preventDefault();characterWin.hide()}});
 characterWin.webContents.on("context-menu",()=>contextMenu());
 await characterWin.loadFile(path.join(__dirname,"character.html"));
 try{const bundled=path.join(__dirname,"..","assets","Saeed_AI-3D.glb");if(fs.existsSync(bundled)){const data=fs.readFileSync(bundled);characterWin.webContents.send("character:selected",new Uint8Array(data));diagnostic("INFO","GLB DEFAULT","Bundled Saeed_AI-3D.glb loaded as the default character",{size:data.length})}else diagnostic("ERROR","GLB DEFAULT","Bundled Saeed_AI-3D.glb is missing")}catch(e){diagnostic("ERROR","GLB DEFAULT",e.message)}
 fitCharacterToDisplay(screen.getPrimaryDisplay(),{bottomRight:true});
 characterWin.show();
}
function configureUpdater(){autoUpdater.autoDownload=false;autoUpdater.autoInstallOnAppQuit=false;autoUpdater.on("checking-for-update",()=>{updateState="checking";if(updateUiRequested)voiceBroadcast("update:state","checking")});autoUpdater.on("update-not-available",()=>{updateState="latest";if(updateUiRequested){voiceBroadcast("update:state","latest");setTimeout(()=>{updateUiRequested=false;voiceBroadcast("update:state","idle")},3200)}});autoUpdater.on("update-available",info=>{updateState="available";if(updateUiRequested)voiceBroadcast("update:available",{version:info.version,releaseDate:info.releaseDate||null,releaseNotes:info.releaseNotes||null})});autoUpdater.on("download-progress",p=>{if(updateUiRequested)voiceBroadcast("update:progress",{percent:p.percent,transferred:p.transferred,total:p.total,bytesPerSecond:p.bytesPerSecond})});autoUpdater.on("update-downloaded",info=>{updateState="downloaded";if(updateUiRequested){voiceBroadcast("update:downloaded",{version:info.version});setTimeout(()=>{updateUiRequested=false;voiceBroadcast("update:state","idle")},3200)}});autoUpdater.on("error",e=>{updateState="error";if(updateUiRequested){voiceBroadcast("update:state","error",e?.message||String(e));setTimeout(()=>{updateUiRequested=false;voiceBroadcast("update:state","idle")},3200)}})}
app.whenReady().then(async()=>{app.isQuitting=false;diagnostic("INFO","APPLICATION","Diagnostics system started");
 configureUpdater();
 if(process.platform==="win32")app.setUserTasks([{program:process.execPath,arguments:"--chat",iconPath:windowsIconPath(),iconIndex:0,title:"Chat Me",description:"Open Saeed Chat"},{program:process.execPath,arguments:"--3d-status",iconPath:windowsIconPath(),iconIndex:0,title:"3D Status",description:"Open live 3D renderer and GLB status"}]);
 try{await createWindow();currentMicMode="off";agent.settings={...agent.settings,micMode:"off",brainMode:"auto"};agent.persistSettings();setMicMode("off")}catch(e){console.error("Saeed startup failed:",e);app.quit();return}
 if(process.argv.includes("--3d-status"))show3DStatus(); else if(process.argv.includes("--chat"))void showChat();
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
ipcMain.handle("3d:query",()=>request3DStatus());ipcMain.handle("3d-status:show",()=>{show3DStatus();return true});ipcMain.handle("3d:reload-test",()=>{if(!characterWin||characterWin.isDestroyed())return false;characterWin.webContents.send("3d:reload-test");return true});
ipcMain.handle("chat",(_,payload)=>{
 if(!agent)return {ok:false,error:"Saeed is still starting."};
 const data=typeof payload==="string"?{text:payload}:payload||{};
 return agent.run(String(data.text||""),data.image||null);
});
ipcMain.handle("settings:get",()=>agent?.publicSettings()||null);
ipcMain.handle("diagnostic:report",(_,level,stage,message,meta)=>diagnostic(level,stage,message,meta));ipcMain.handle("diagnostic:snapshot",()=>({state:diagnosticState}));ipcMain.handle("resource:snapshot",()=>resourceReport());ipcMain.handle("cpu:metrics",()=>{updateCpuMetrics();return diagnosticState.cpu;});ipcMain.handle("status:show",()=>{showStatus();return true});ipcMain.handle("performance:show",()=>{showPerformance();return true});ipcMain.handle("character:choose",()=>{chooseCharacter();return true});
ipcMain.handle("settings:set",(_,s)=>{
 if(!agent)throw new Error("Saeed is still starting.");
 const previous={...agent.settings};
 agent.settings={...previous,...(s||{}),brainMode:"auto"};
 delete agent.settings.alwaysListening;
 if(agent.settings.micMode==="always"||agent.settings.micMode==="ptt")agent.settings.micMode="on";
 if(agent.settings.micMode!=="on")agent.settings.micMode="off";
 const mode="auto";
 let micMode=String(agent.settings.micMode||currentMicMode||"off");
 
 if(Object.prototype.hasOwnProperty.call(s||{},"micMode"))setMicMode(micMode);
 if(previous.sttProvider!==agent.settings.sttProvider||previous.micMode!==micMode)diagnostic("INFO","MIC CONFIG","Microphone configuration applied",{mode:micMode,sttProvider:agent.settings.sttProvider});
 diagnostic("INFO","BRAIN MODE","Brain mode selected: "+mode);
 return agent.publicSettings();
});
ipcMain.handle("realtime:start",(_,options={})=>{startRealtime(options);return true});
ipcMain.handle("realtime:stop",()=>{stopRealtime();return true});
ipcMain.handle("realtime:audio",(_,base64)=>{realtime?.appendAudio(String(base64||""));return true});
ipcMain.handle("realtime:text",(_,text)=>realtime?.text(String(text||""))||false);
ipcMain.handle("realtime:cancel",()=>{realtime?.cancel();return true});ipcMain.handle("local-stt:transcribe",(_,base64)=>transcribeLocalWav(String(base64||"")));
function transcribeLocalWav(base64){return new Promise((resolve,reject)=>{const p=whisperRuntimePaths();const cli=p.exe;if(!fs.existsSync(cli)||!fs.existsSync(p.model))return reject(new Error("Offline Whisper CLI/model is missing"));const wav=path.join(app.getPath("temp"),"saeed-stt-"+Date.now()+".wav");try{const pcm=Buffer.from(String(base64||""),"base64");const header=Buffer.alloc(44);header.write("RIFF",0);header.writeUInt32LE(36+pcm.length,4);header.write("WAVE",8);header.write("fmt ",12);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(24000,24);header.writeUInt32LE(48000,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write("data",36);header.writeUInt32LE(pcm.length,40);fs.writeFileSync(wav,Buffer.concat([header,pcm]));const args=["-m",p.model,"-f",wav,"-nt","-np","--no-timestamps"];if(agent?.settings?.sttLanguage&&agent.settings.sttLanguage!=="auto")args.push("-l",String(agent.settings.sttLanguage));const child=spawn(cli,args,{cwd:path.dirname(cli),windowsHide:true});let out="",err="";child.stdout.setEncoding("utf8");child.stderr.setEncoding("utf8");child.stdout.on("data",d=>out+=d);child.stderr.on("data",d=>err+=d);child.on("error",e=>{try{fs.unlinkSync(wav)}catch{}reject(e)});child.on("close",code=>{try{fs.unlinkSync(wav)}catch{}if(code!==0)return reject(new Error(err.slice(-1200)||("Whisper CLI exited with code "+code)));const text=out.replace(/\x1b\[[0-9;]*[A-Za-z]/g,"").split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith("[")&&!x.startsWith("whisper_")).join(" ").replace(/^\s*[\[\(].*?[\]\)]\s*/,"").trim();diagnostic("INFO","LOCAL STT RESULT",text);resolve(text)})}catch(e){try{fs.unlinkSync(wav)}catch{}reject(e)}})}
ipcMain.handle("mic:mode",(_,mode)=>{setMicMode(String(mode||"off"));return true});
ipcMain.on("mic:level",(_,level)=>{const v=Math.max(0,Math.min(1,Number(level)||0));diagnosticState.mic={...diagnosticState.mic,state:v>0?"active":diagnosticState.mic.state,level:v,detail:"Live microphone input"};for(const win of [statusWin,threeDStatusWin,characterWin])if(win&&!win.isDestroyed())win.webContents.send("mic:level",v);if(statusWin&&!statusWin.isDestroyed())statusWin.webContents.send("diagnostic:state",diagnosticState);});
ipcMain.handle("chat:minimize",()=>{if(!chatWin||chatWin.isDestroyed())return false;chatWin.minimize();return true});
ipcMain.on("chat:mouse-passthrough",(event,ignore)=>{
 const win=BrowserWindow.fromWebContents(event.sender);
 if(!win||win.isDestroyed()||win!==chatWin)return;
 win.setIgnoreMouseEvents(Boolean(ignore),{forward:true});
});

ipcMain.handle("capture",()=>captureScreen());
ipcMain.handle("update:check",async()=>{if(!app.isPackaged)return {ok:false,state:"unavailable",message:"Updates are available only in the installed Windows build."};try{updateState="checking";voiceBroadcast("update:state","checking");const result=await autoUpdater.checkForUpdates();return {ok:true,state:updateState,version:result?.updateInfo?.version||null}}catch(e){updateState="error";chatWin?.webContents.send("update:state","error",e.message);return {ok:false,state:"error",message:e.message}}});
ipcMain.handle("update:download",async()=>{if(updateState!=="available")return false;try{updateState="downloading";chatWin?.webContents.send("update:state","downloading");await autoUpdater.downloadUpdate();return true}catch(e){updateState="error";chatWin?.webContents.send("update:state","error",e.message);return false}});
ipcMain.handle("update:install",()=>{if(updateState!=="downloaded")return false;autoUpdater.quitAndInstall(false,true);return true});
ipcMain.handle("update:state",()=>updateState);

ipcMain.handle("history:get",()=>agent?.history||[]);
ipcMain.handle("history:clear",()=>{if(!agent)return false;agent.clearHistory();chatWin?.webContents.send("history:cleared");return true});
ipcMain.handle("agent:confirm-response",(_,id,approved)=>{
 const resolve=confirmations.get(id);if(!resolve)return false;
 confirmations.delete(id);resolve(Boolean(approved));return true;
});
function stopRealtime(){
 if(realtime){realtime.stop();realtime=null}
 diagnostic("INFO","STT DISCONNECTED","Realtime STT connection stopped");
 diagnostic("INFO","TTS DISCONNECTED","Realtime TTS connection stopped");
 voiceBroadcast("realtime:state","disconnected");
}
function startRealtime(options={}){
 const s=agent?.settings||{};
 const key=s.realtimeApiKey||s.apiKey||"";
 if(!key || s.provider==="ollama"){diagnostic("ERROR","STT API KEY","Realtime/OpenAI API key is missing");diagnostic("ERROR","TTS API KEY","Realtime/OpenAI API key is missing");voiceBroadcast("realtime:state","not-configured","OpenAI API key is not configured.");return false}
 diagnostic("INFO","STT START","Starting Realtime STT");diagnostic("INFO","TTS START","Starting Realtime TTS");if(realtime) realtime.stop();
 const registry=agent?.registry;
 const realtimeTools=(registry?.schemas()||[]).map(t=>({
  type:"function",
  name:t.function?.name,
  description:t.function?.description||"",
  parameters:t.function?.parameters||{type:"object",properties:{},required:[]}
 })).filter(t=>t.name);
 realtime=new OpenAIRealtime({
  state:(state,message)=>{diagnostic("INFO","REALTIME "+String(state||"").toUpperCase(),message||"");if(state==="connected"){diagnostic("INFO","STT CONNECTED","Realtime STT connected");diagnostic("INFO","TTS CONNECTED","Realtime TTS connected")}if(state==="error")diagnostic("ERROR","REALTIME API",message||"Realtime API error");if(state==="disconnected")diagnostic("ERROR","REALTIME DISCONNECTED",message||"Realtime connection closed");voiceBroadcast("realtime:state",state,message)},
  event:async(event)=>{
   if(event.type==="response.output_audio.delta"&&event.delta){diagnostic("INFO","TTS AUDIO","Realtime audio received");voiceBroadcast("realtime:audio",event.delta);}
   else if(event.type==="response.output_audio_transcript.delta"&&event.delta)voiceBroadcast("realtime:assistant-delta",event.delta);
   else if(event.type==="response.output_audio_transcript.done"&&event.transcript)voiceBroadcast("realtime:assistant-final",event.transcript);
   else if(event.type==="conversation.item.input_audio_transcription.delta"&&event.delta)voiceBroadcast("realtime:user-delta",event.delta);
   else if(event.type==="conversation.item.input_audio_transcription.completed"&&event.transcript)voiceBroadcast("realtime:user-final",event.transcript);
   else if(event.type==="response.function_call_arguments.done"&&event.call_id){
    const name=String(event.name||"");
    let args={};
    try{args=JSON.parse(event.arguments||"{}")}catch{args={}};
    voiceBroadcast("agent:event",{type:"tool",name,args,source:"realtime"});
    let out;
    try{out=await registry.call(name,args)}catch(e){out={ok:false,error:e.message}};
    if(out?.ok===false)voiceBroadcast("agent:event",{type:"tool_error",name,error:out.error||"Tool failed",source:"realtime"});
    else voiceBroadcast("agent:event",{type:"tool_result",name,result:out,source:"realtime"});
    realtime?.toolResult(event.call_id,out||{ok:false,error:"Tool returned no result"});
   }
   else if(event.type==="response.done")voiceBroadcast("realtime:done",event.response?.status||"completed");
   else if(event.type==="error")voiceBroadcast("realtime:error",event.error?.message||"Realtime API error");
  }
 });
 realtime.start(key,{model:s.realtimeModel||"gpt-realtime-2.1",voice:s.realtimeVoice||"marin",tools:realtimeTools});
 return true;
}
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
 app.isQuitting=true;
 try{stopRealtime()}catch(e){console.error("Voice shutdown failed:",e)}
 for(const win of [chatWin,performanceWin,statusWin,threeDStatusWin,characterWin]){try{if(win&&!win.isDestroyed())win.destroy()}catch(e){console.error("Window shutdown failed:",e)}}
 try{if(tray){tray.destroy();tray=null}}catch(e){console.error("Tray shutdown failed:",e)}
});
app.on("will-quit",()=>{globalShortcut.unregisterAll();try{stopRealtime()}catch{}try{if(cpuTimer)clearInterval(cpuTimer)}catch{}cpuTimer=null});