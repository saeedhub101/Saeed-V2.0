const {app,BrowserWindow,ipcMain,globalShortcut,desktopCapturer,Tray,Menu,screen,dialog,nativeImage,session}=require("electron");
const path=require("path"),fs=require("fs"),{Agent}=require("./agent"),{ToolRegistry}=require("./tools"),{OpenAIRealtime}=require("./realtime"),{autoUpdater}=require("electron-updater");

process.on("uncaughtException",e=>console.error("Saeed uncaught:",e));
process.on("unhandledRejection",e=>console.error("Saeed rejection:",e));\n// Explicit Electron microphone permission handling for Always Listening.\n// Chromium must be allowed to request/use media audio before getUserMedia can open the device.\nfunction configureMediaPermissions(){\n try{\n  session.defaultSession.setPermissionCheckHandler((webContents,permission,origin,details)=>{\n   if(permission==="media")return true;\n   return true;\n  });\n  session.defaultSession.setPermissionRequestHandler((webContents,permission,callback,details)=>{\n   if(permission==="media"){diagnostic("INFO","MIC PERMISSION","Electron granted media permission",details||{});callback(true);return;}\n   callback(true);\n  });\n  diagnostic("INFO","MIC PERMISSION","Electron microphone/media permission handlers configured");\n }catch(e){diagnostic("ERROR","MIC PERMISSION",e.message)}\n}\n

let win,agent,tray,realtime,statusWin;
const diagnosticFile=path.join(app.getPath("userData"),"diagnostics.jsonl");
const diagnosticState={mic:{state:"unknown",level:0,detail:""},brainApi:{state:"unknown",detail:""},brainLocal:{state:"ready",detail:"Local intent engine"},stt:{state:"unknown",detail:""},tts:{state:"unknown",detail:""},glb:{state:"unknown",detail:""}};
function diagnostic(level,stage,message,meta={}){
 const event={time:new Date().toISOString(),level:String(level||"INFO").toUpperCase(),stage:String(stage||"GENERAL"),message:String(message||""),meta:meta||{}};
 try{fs.mkdirSync(path.dirname(diagnosticFile),{recursive:true});fs.appendFileSync(diagnosticFile,JSON.stringify(event)+"\n")}catch(e){console.error("Diagnostics write failed:",e)}
 if(statusWin&&!statusWin.isDestroyed())statusWin.webContents.send("diagnostic:event",event);if(win&&!win.isDestroyed())win.webContents.send("diagnostic:event",event);updateDiagnosticState(event);return event;
}
function updateDiagnosticState(e){const s=String(e.stage||"").toUpperCase(),fail=e.level==="ERROR";
 if(s.includes("MIC")){diagnosticState.mic.state=fail?"error":"active";diagnosticState.mic.detail=e.message;if(e.meta?.level!=null)diagnosticState.mic.level=Number(e.meta.level)||0}
 if(s.includes("LLM")||s.includes("BRAIN API")){diagnosticState.brainApi.state=fail?"error":(s.includes("SUCCESS")||s.includes("CONNECTED")?"connected":"active");diagnosticState.brainApi.detail=e.message}
 if(s.includes("LOCAL")){diagnosticState.brainLocal.state=fail?"error":"ready";diagnosticState.brainLocal.detail=e.message}
 if(s.includes("STT")){diagnosticState.stt.state=fail?"error":(s.includes("CONNECTED")||s.includes("ACTIVE")||s.includes("START")?"active":diagnosticState.stt.state);diagnosticState.stt.detail=e.message}
 if(s.includes("TTS")){diagnosticState.tts.state=fail?"error":(s.includes("CONNECTED")||s.includes("ACTIVE")||s.includes("START")||s.includes("SUCCESS")?"active":diagnosticState.tts.state);diagnosticState.tts.detail=e.message}
 if(s.includes("GLB")||s.includes("CHARACTER READY")){diagnosticState.glb.state=fail?"error":s.includes("READY")?"ready":"active";diagnosticState.glb.detail=e.message}
 if(statusWin&&!statusWin.isDestroyed())statusWin.webContents.send("diagnostic:state",diagnosticState);
}
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
let updateState="idle";
const confirmations=new Map();
const WINDOW={width:760,height:480,minWidth:360,minHeight:260};

async function captureScreen(){
 const sources=await desktopCapturer.getSources({types:["screen"],thumbnailSize:{width:1920,height:1080}});
 return sources[0]?.thumbnail.toDataURL()||null;
}
function displayForWindow(){
 if(!win)return screen.getPrimaryDisplay();
 const [x,y]=win.getPosition();
 const [w,h]=win.getSize();
 return screen.getDisplayMatching({x,y,width:w,height:h})||screen.getDisplayNearestPoint({x:x+w/2,y:y+h/2})||screen.getPrimaryDisplay();
}
function fitWindowToDisplay(display=displayForWindow(),{bottomRight=false}={}){
 if(!win)return;
 const area=display.workArea;
 const width=Math.min(WINDOW.width,Math.max(WINDOW.minWidth,area.width));
 const height=Math.min(WINDOW.height,Math.max(WINDOW.minHeight,area.height));
 if(win.getSize()[0]!==width||win.getSize()[1]!==height)win.setSize(width,height,false);
 const margin=18;
 const [x0,y0]=win.getPosition();
 const x=bottomRight?area.x+Math.max(0,area.width-width-margin):Math.max(area.x,Math.min(x0,area.x+Math.max(0,area.width-width)));
 const y=bottomRight?area.y+Math.max(0,area.height-height-margin):Math.max(area.y,Math.min(y0,area.y+Math.max(0,area.height-height)));
 win.setPosition(Math.round(x),Math.round(y),false);
}
function placeBottomRight(){
 if(!win)return;
 const display=screen.getPrimaryDisplay();
 fitWindowToDisplay(display,{bottomRight:true});
}
function keepWindowVisible(){
 if(!win)return;
 const display=displayForWindow();
 fitWindowToDisplay(display);
}
function showChat(){keepWindowVisible();win?.show();win?.focus();win?.webContents.send("chat:show")}
function showStatus(){if(statusWin&&!statusWin.isDestroyed()){statusWin.show();statusWin.focus();statusWin.webContents.send("diagnostic:snapshot",{state:diagnosticState,file:diagnosticFile});return}statusWin=new BrowserWindow({width:820,height:620,minWidth:620,minHeight:420,title:"Saeed Status",show:false,backgroundColor:"#f5f7fb",webPreferences:{preload:path.join(__dirname,"preload.js"),contextIsolation:true,nodeIntegration:false,sandbox:false}});statusWin.on("closed",()=>{statusWin=null});statusWin.loadFile(path.join(__dirname,"status.html")).then(()=>{statusWin.show();statusWin.webContents.send("diagnostic:snapshot",{state:diagnosticState,file:diagnosticFile})}).catch(e=>diagnostic("ERROR","STATUS WINDOW",e.message))}
function openDiagnosticsLog(){require("electron").shell.openPath(diagnosticFile).catch(e=>diagnostic("ERROR","DIAGNOSTICS LOG",e.message))}
function chooseCharacter(){dialog.showOpenDialog(win,{title:"Choose Saeed Character",filters:[{name:"GLB 3D Character",extensions:["glb"]}],properties:["openFile"]}).then(r=>{if(r.canceled||!r.filePaths[0])return;const file=r.filePaths[0];try{const data=fs.readFileSync(file);win?.webContents.send("character:selected",new Uint8Array(data));diagnostic("INFO","GLB SELECTED","Character GLB selected",{name:path.basename(file),size:data.length})}catch(e){diagnostic("ERROR","GLB SELECTED",e.message)}})}
function setMicMode(mode){const value=String(mode||"always");if(agent)agent.settings={...agent.settings,micMode:value,alwaysListening:value==="always"};win?.webContents.send("mic:mode",value);if(value==="off"||String(agent?.settings?.brainMode||"auto")!=="realtime")stopRealtime();else startRealtime();diagnostic("INFO","MIC MODE","Microphone mode: "+value)}
function setSaeedSize(size){const m={small:[600,400],medium:[760,480],large:[980,620]};const v=m[size]||m.medium;win?.setSize(v[0],v[1],true)}
function contextMenu(){
 const menu=Menu.buildFromTemplate([
  {label:"فتح المحادثة",click:showChat},
  {label:"إخفاء Saeed",click:()=>win?.hide()},
  {type:"separator"},
  {label:"التقاط الشاشة",click:async()=>{const image=await captureScreen();showChat();win?.webContents.send("screen:capture",image)}},
  {label:"الإعدادات…",click:()=>{showChat();win?.webContents.send("settings:show")}},
  {type:"separator"},
  {label:"خروج",click:()=>app.quit()}
 ]);
 menu.popup({window:win});
}
async function createWindow(){
 win=new BrowserWindow({
  name:"saeed-main",
  width:WINDOW.width,height:WINDOW.height,minWidth:WINDOW.minWidth,minHeight:WINDOW.minHeight,
  frame:false,transparent:true,alwaysOnTop:true,show:false,hasShadow:false,resizable:true,skipTaskbar:false,
  icon:windowsIconPath(),
  webPreferences:{preload:path.join(__dirname,"preload.js"),contextIsolation:true,nodeIntegration:false,sandbox:false}
 });
 win.setIcon(windowsIconPath());
 if(process.platform==="win32")win.setAppDetails({appId:"ai.saeed.desktop",appIconPath:windowsIconPath(),appIconIndex:0,relaunchCommand:process.execPath,relaunchDisplayName:"Saeed AI"});
 win.setAlwaysOnTop(true,"floating");
 const registry=new ToolRegistry({
  captureScreen,userDataPath:app.getPath("userData"),
  confirm:({name,args})=>new Promise(resolve=>{
   const id=Date.now().toString(36)+Math.random().toString(36).slice(2,7);
   confirmations.set(id,resolve);showChat();win?.webContents.send("agent:confirm",{id,name,args});
  })
 });
 agent=new Agent({registry,onEvent:e=>{diagnosticFromAgent(e);win?.webContents.send("agent:event",e)}});
 win.on("closed",()=>{win=null});
 win.webContents.on("context-menu",()=>contextMenu());
 win.on("move",keepWindowVisible);
 await win.loadFile(path.join(__dirname,"index.html"));
 placeBottomRight();
 win.show();
}
function configureUpdater(){autoUpdater.autoDownload=false;autoUpdater.autoInstallOnAppQuit=true;autoUpdater.on("checking-for-update",()=>{updateState="checking";win?.webContents.send("update:state","checking")});autoUpdater.on("update-not-available",()=>{updateState="latest";win?.webContents.send("update:state","latest")});autoUpdater.on("update-available",info=>{updateState="available";win?.webContents.send("update:available",{version:info.version})});autoUpdater.on("download-progress",p=>win?.webContents.send("update:progress",{percent:p.percent,transferred:p.transferred,total:p.total,bytesPerSecond:p.bytesPerSecond}));autoUpdater.on("update-downloaded",info=>{updateState="downloaded";win?.webContents.send("update:downloaded",{version:info.version})});autoUpdater.on("error",e=>{updateState="error";win?.webContents.send("update:state","error",e?.message||String(e))})}
app.whenReady().then(async()=>{diagnostic("INFO","APPLICATION","Diagnostics system started");
 configureUpdater();
 try{await createWindow()}catch(e){console.error("Saeed startup failed:",e);app.quit();return}
 try{
  tray=new Tray(trayIcon());
  tray.setToolTip("Saeed AI");
  tray.setContextMenu(Menu.buildFromTemplate([
   {label:"Show Saeed",click:showChat},{label:"Chat",click:showChat},{label:"Status",click:showStatus},{label:"Hide Saeed",click:()=>win?.hide()},
   {type:"separator"},{label:"Always Listening",type:"radio",checked:true,click:()=>setMicMode("always")},{label:"Push to Talk",type:"radio",click:()=>setMicMode("ptt")},{label:"Mic Off",type:"radio",click:()=>setMicMode("off")},
   {label:"Change Character (GLB)",click:chooseCharacter},{label:"Check for Updates",click:()=>autoUpdater.checkForUpdates().catch(e=>diagnostic("ERROR","UPDATE",e.message))},{label:"Settings",click:()=>{showChat();win?.webContents.send("settings:show")}},{label:"Open Diagnostics Log",click:openDiagnosticsLog},
   {label:"Saeed Size",submenu:[{label:"Small",click:()=>setSaeedSize("small")},{label:"Medium",click:()=>setSaeedSize("medium")},{label:"Large",click:()=>setSaeedSize("large")}]},{type:"separator"},{label:"Quit",click:()=>app.quit()}
  ]));
 }catch(e){console.error("Tray failed:",e)}
 globalShortcut.register("CommandOrControl+Shift+M",showChat);
 globalShortcut.register("CommandOrControl+Shift+S",async()=>{
  try{const image=await captureScreen();showChat();win?.webContents.send("screen:capture",image)}
  catch(e){console.error("Screen capture failed:",e)}
 });
 const refresh=()=>{if(win)fitWindowToDisplay(displayForWindow())};
 screen.on("display-added",refresh);
 screen.on("display-removed",()=>{if(win)keepWindowVisible()});
 screen.on("display-metrics-changed",refresh);
});
ipcMain.handle("chat",(_,payload)=>{
 if(!agent)return {ok:false,error:"Saeed is still starting."};
 const data=typeof payload==="string"?{text:payload}:payload||{};
 return agent.run(String(data.text||""),data.image||null);
});
ipcMain.handle("settings:get",()=>agent?.publicSettings()||null);
ipcMain.handle("diagnostic:report",(_,level,stage,message,meta)=>diagnostic(level,stage,message,meta));ipcMain.handle("diagnostic:snapshot",()=>({state:diagnosticState,file:diagnosticFile}));ipcMain.handle("diagnostic:open-log",()=>{openDiagnosticsLog();return true});ipcMain.handle("status:show",()=>{showStatus();return true});ipcMain.handle("character:choose",()=>{chooseCharacter();return true});
ipcMain.handle("settings:set",(_,s)=>{
 if(!agent)throw new Error("Saeed is still starting.");
 agent.settings={...(s||{})};
 const mode=String(agent.settings.brainMode||"auto");
 if(mode==="realtime")startRealtime();
 else stopRealtime();
 diagnostic("INFO","BRAIN MODE","Brain mode selected: "+mode);
 return agent.publicSettings();
});
ipcMain.handle("realtime:start",(_,options={})=>{startRealtime(options);return true});
ipcMain.handle("realtime:stop",()=>{stopRealtime();return true});
ipcMain.handle("realtime:audio",(_,base64)=>{realtime?.appendAudio(String(base64||""));return true});
ipcMain.handle("realtime:text",(_,text)=>realtime?.text(String(text||""))||false);
ipcMain.handle("realtime:cancel",()=>{realtime?.cancel();return true});\nipcMain.handle("mic:mode",(_,mode)=>{const value=String(mode||"always");win?.webContents.send("mic:mode",value);diagnostic("INFO","MIC MODE","Microphone mode requested: "+value);return true});
ipcMain.handle("capture",()=>captureScreen());
ipcMain.handle("update:check",async()=>{if(!app.isPackaged)return {ok:false,state:"unavailable",message:"Updates are available only in the installed Windows build."};try{updateState="checking";win?.webContents.send("update:state","checking");const result=await autoUpdater.checkForUpdates();return {ok:true,state:updateState,version:result?.updateInfo?.version||null}}catch(e){updateState="error";win?.webContents.send("update:state","error",e.message);return {ok:false,state:"error",message:e.message}}});
ipcMain.handle("update:download",async()=>{if(updateState!=="available")return false;try{await autoUpdater.downloadUpdate();return true}catch(e){updateState="error";win?.webContents.send("update:state","error",e.message);return false}});
ipcMain.handle("update:install",()=>{if(updateState!=="downloaded")return false;autoUpdater.quitAndInstall(false,true);return true});
ipcMain.handle("history:get",()=>agent?.history||[]);
ipcMain.handle("agent:confirm-response",(_,id,approved)=>{
 const resolve=confirmations.get(id);if(!resolve)return false;
 confirmations.delete(id);resolve(Boolean(approved));return true;
});
function stopRealtime(){
 if(realtime){realtime.stop();realtime=null}diagnostic("INFO","STT DISCONNECTED","Realtime STT connection stopped");diagnostic("INFO","TTS DISCONNECTED","Realtime TTS connection stopped");win?.webContents.send("realtime:state","disconnected");
}
function startRealtime(options={}){
 const s=agent?.settings||{};
 const key=s.realtimeApiKey||s.apiKey||"";
 if(!key || s.provider==="ollama"){diagnostic("ERROR","STT API KEY","Realtime/OpenAI API key is missing");diagnostic("ERROR","TTS API KEY","Realtime/OpenAI API key is missing");win?.webContents.send("realtime:state","not-configured","OpenAI API key is not configured.");return false}
 diagnostic("INFO","STT START","Starting Realtime STT");diagnostic("INFO","TTS START","Starting Realtime TTS");if(realtime) realtime.stop();
 const registry=agent?.registry;
 const realtimeTools=(registry?.schemas()||[]).map(t=>({
  type:"function",
  name:t.function?.name,
  description:t.function?.description||"",
  parameters:t.function?.parameters||{type:"object",properties:{},required:[]}
 })).filter(t=>t.name);
 realtime=new OpenAIRealtime({
  state:(state,message)=>{diagnostic("INFO","REALTIME "+String(state||"").toUpperCase(),message||"");if(state==="connected"){diagnostic("INFO","STT CONNECTED","Realtime STT connected");diagnostic("INFO","TTS CONNECTED","Realtime TTS connected")}if(state==="error")diagnostic("ERROR","REALTIME API",message||"Realtime API error");if(state==="disconnected")diagnostic("ERROR","REALTIME DISCONNECTED",message||"Realtime connection closed");win?.webContents.send("realtime:state",state,message)},
  event:async(event)=>{
   if(event.type==="response.output_audio.delta"&&event.delta){diagnostic("INFO","TTS AUDIO","Realtime audio received");win?.webContents.send("realtime:audio",event.delta);}
   else if(event.type==="response.output_audio_transcript.delta"&&event.delta)win?.webContents.send("realtime:assistant-delta",event.delta);
   else if(event.type==="response.output_audio_transcript.done"&&event.transcript)win?.webContents.send("realtime:assistant-final",event.transcript);
   else if(event.type==="conversation.item.input_audio_transcription.delta"&&event.delta)win?.webContents.send("realtime:user-delta",event.delta);
   else if(event.type==="conversation.item.input_audio_transcription.completed"&&event.transcript)win?.webContents.send("realtime:user-final",event.transcript);
   else if(event.type==="response.function_call_arguments.done"&&event.call_id){
    const name=String(event.name||"");
    let args={};
    try{args=JSON.parse(event.arguments||"{}")}catch{args={}};
    win?.webContents.send("agent:event",{type:"tool",name,args,source:"realtime"});
    let out;
    try{out=await registry.call(name,args)}catch(e){out={ok:false,error:e.message}};
    if(out?.ok===false)win?.webContents.send("agent:event",{type:"tool_error",name,error:out.error||"Tool failed",source:"realtime"});
    else win?.webContents.send("agent:event",{type:"tool_result",name,result:out,source:"realtime"});
    realtime?.toolResult(event.call_id,out||{ok:false,error:"Tool returned no result"});
   }
   else if(event.type==="response.done")win?.webContents.send("realtime:done",event.response?.status||"completed");
   else if(event.type==="error")win?.webContents.send("realtime:error",event.error?.message||"Realtime API error");
  }
 });
 realtime.start(key,{model:s.realtimeModel||"gpt-realtime-2.1",voice:s.realtimeVoice||"marin",tools:realtimeTools});
 return true;
}
ipcMain.on("window:move-by",(_,dx,dy)=>{
 if(!win)return;
 const [x,y]=win.getPosition(),[w,h]=win.getSize();
 const nextX=x+Math.round(Number(dx)||0),nextY=y+Math.round(Number(dy)||0);
 const center={x:nextX+w/2,y:nextY+h/2};
 const d=screen.getDisplayNearestPoint(center)||screen.getPrimaryDisplay();
 const a=d.workArea;
 const nx=Math.max(a.x,Math.min(nextX,a.x+Math.max(0,a.width-w)));
 const ny=Math.max(a.y,Math.min(nextY,a.y+Math.max(0,a.height-h)));
 win.setPosition(nx,ny,true);
});
ipcMain.on("window:show-chat",showChat);
app.on("activate",()=>{if(BrowserWindow.getAllWindows().length===0)createWindow().catch(e=>console.error(e))});
app.on("window-all-closed",e=>e.preventDefault());
app.on("will-quit",()=>globalShortcut.unregisterAll());