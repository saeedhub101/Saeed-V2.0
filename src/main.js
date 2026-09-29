const {app,BrowserWindow,ipcMain,globalShortcut,desktopCapturer,Tray,Menu,screen,dialog,nativeImage,session}=require("electron");
const path=require("path"),fs=require("fs"),{spawn}=require("child_process"),{Agent}=require("./agent"),{ToolRegistry}=require("./tools"),{OpenAIRealtime}=require("./realtime"),{autoUpdater}=require("electron-updater");

process.on("uncaughtException",e=>console.error("Saeed uncaught:",e));
process.on("unhandledRejection",e=>console.error("Saeed rejection:",e));
// Explicit Electron microphone permission handling for Always Listening.
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


let chatWin,characterWin,agent,tray,realtime,localWhisper,statusWin,threeDStatusWin;
const pending3DQueries=new Map();
const diagnosticFile=path.join(app.getPath("userData"),"diagnostics.jsonl");
const diagnosticState={mic:{state:"unknown",level:0,detail:""},brainApi:{state:"unknown",detail:""},brainLocal:{state:"ready",detail:"Local intent engine"},stt:{state:"unknown",detail:""},tts:{state:"unknown",detail:""},glb:{state:"unknown",detail:""},threeD:{overall:{state:"unknown",detail:"Waiting for 3D renderer"},components:{},lastUpdated:null}};
function diagnostic(level,stage,message,meta={}){
 const event={time:new Date().toISOString(),level:String(level||"INFO").toUpperCase(),stage:String(stage||"GENERAL"),message:String(message||""),meta:meta||{}};
 try{fs.mkdirSync(path.dirname(diagnosticFile),{recursive:true});fs.appendFileSync(diagnosticFile,JSON.stringify(event)+"\n")}catch(e){console.error("Diagnostics write failed:",e)}
 if(statusWin&&!statusWin.isDestroyed())statusWin.webContents.send("diagnostic:event",event);if(threeDStatusWin&&!threeDStatusWin.isDestroyed())threeDStatusWin.webContents.send("diagnostic:event",event);if(chatWin&&!chatWin.isDestroyed())chatWin.webContents.send("diagnostic:event",event);if(characterWin&&!characterWin.isDestroyed())characterWin.webContents.send("diagnostic:event",event);updateDiagnosticState(event);return event;
}
function publish3DStatus(report){if(!report)return;diagnosticState.threeD=report;diagnosticState.threeD.lastUpdated=new Date().toISOString();if(threeDStatusWin&&!threeDStatusWin.isDestroyed())threeDStatusWin.webContents.send("3d:status",diagnosticState.threeD)}
function request3DStatus(){return new Promise(resolve=>{if(!characterWin||characterWin.isDestroyed()){const report={overall:{state:"error",detail:"3D character window is not available"},components:{},lastUpdated:new Date().toISOString()};publish3DStatus(report);resolve(report);return}const id=Date.now().toString(36)+Math.random().toString(36).slice(2,8);const timer=setTimeout(()=>{pending3DQueries.delete(id);const report={...diagnosticState.threeD,overall:{state:"error",detail:"3D renderer status query timed out"}};publish3DStatus(report);resolve(report)},1800);pending3DQueries.set(id,report=>{clearTimeout(timer);pending3DQueries.delete(id);publish3DStatus(report);resolve(report)});characterWin.webContents.send("3d:query",id)})}
function show3DStatus(){if(threeDStatusWin&&!threeDStatusWin.isDestroyed()){threeDStatusWin.show();threeDStatusWin.focus();request3DStatus().then(r=>threeDStatusWin?.webContents.send("3d:status",r));return}threeDStatusWin=new BrowserWindow({width:900,height:700,minWidth:680,minHeight:500,title:"Saeed 3D Status",show:false,backgroundColor:"#f5f7fb",webPreferences:{preload:path.join(__dirname,"preload.js"),contextIsolation:true,nodeIntegration:false,sandbox:false}});threeDStatusWin.on("closed",()=>{threeDStatusWin=null});threeDStatusWin.loadFile(path.join(__dirname,"3d-status.html")).then(async()=>{threeDStatusWin?.show();threeDStatusWin?.focus();const r=await request3DStatus();threeDStatusWin?.webContents.send("3d:status",r)}).catch(e=>diagnostic("ERROR","3D STATUS WINDOW",e.message))}
function updateDiagnosticState(e){const s=String(e.stage||"").toUpperCase(),fail=e.level==="ERROR";
 if(s.includes("MIC")){diagnosticState.mic.state=fail?"error":"active";diagnosticState.mic.detail=e.message;if(e.meta?.level!=null)diagnosticState.mic.level=Number(e.meta.level)||0}
 if(s.includes("LLM")||s.includes("BRAIN API")){diagnosticState.brainApi.state=fail?"error":(s.includes("SUCCESS")||s.includes("CONNECTED")?"connected":"active");diagnosticState.brainApi.detail=e.message}
 if(s.includes("LOCAL")){diagnosticState.brainLocal.state=fail?"error":"ready";diagnosticState.brainLocal.detail=e.message}
 if(s.includes("STT")){diagnosticState.stt.state=fail?"error":(s.includes("CONNECTED")||s.includes("ACTIVE")||s.includes("START")?"active":diagnosticState.stt.state);diagnosticState.stt.detail=e.message}
 if(s.includes("TTS")){diagnosticState.tts.state=fail?"error":(s.includes("CONNECTED")||s.includes("ACTIVE")||s.includes("START")||s.includes("SUCCESS")?"active":diagnosticState.tts.state);diagnosticState.tts.detail=e.message}
 if(s.includes("GLB")||s.includes("CHARACTER READY")){diagnosticState.glb.state=fail?"error":s.includes("READY")?"ready":"active";diagnosticState.glb.detail=e.message}
 if((s.startsWith("3D")||s.startsWith("THREE")||s.includes("WEBGL")||s.includes("GLTF")||s.includes("CANVAS")||s.includes("RENDER LOOP"))&&diagnosticState.threeD){diagnosticState.threeD.lastEvent={time:e.time,level:e.level,stage:e.stage,message:e.message}}
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
const singleInstanceLock=app.requestSingleInstanceLock();
if(!singleInstanceLock)app.quit();
else app.on("second-instance",(event,commandLine)=>{if(commandLine.includes("--3d-status"))show3DStatus();else if(commandLine.includes("--chat"))showChat();else showChat();});
let updateState="idle";
const confirmations=new Map();
const WINDOW={width:760,height:480,minWidth:360,minHeight:260};

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
async function showChat(){try{if(!chatWin||chatWin.isDestroyed())await createChatWindow();if(!chatWin||chatWin.isDestroyed())return;chatWin.show();chatWin.focus();chatWin.webContents.send("chat:show")}catch(e){diagnostic("ERROR","CHAT WINDOW",e.message)}}
function closeChat(){if(chatWin&&!chatWin.isDestroyed()){chatWin.destroy();chatWin=null}}
function showCharacter(){if(!characterWin||characterWin.isDestroyed())return;characterWin.show();characterWin.focus()}
function showStatus(){if(statusWin&&!statusWin.isDestroyed()){statusWin.show();statusWin.focus();statusWin.webContents.send("diagnostic:snapshot",{state:diagnosticState,file:diagnosticFile});return}statusWin=new BrowserWindow({width:820,height:620,minWidth:620,minHeight:420,title:"Saeed Status",show:false,backgroundColor:"#f5f7fb",webPreferences:{preload:path.join(__dirname,"preload.js"),contextIsolation:true,nodeIntegration:false,sandbox:false}});statusWin.on("closed",()=>{statusWin=null});statusWin.loadFile(path.join(__dirname,"status.html")).then(()=>{statusWin.show();statusWin.webContents.send("diagnostic:snapshot",{state:diagnosticState,file:diagnosticFile})}).catch(e=>diagnostic("ERROR","STATUS WINDOW",e.message))}
function openDiagnosticsLog(){require("electron").shell.openPath(diagnosticFile).catch(e=>diagnostic("ERROR","DIAGNOSTICS LOG",e.message))}
function chooseCharacter(){dialog.showOpenDialog(characterWin||chatWin,{title:"Choose Saeed Character",filters:[{name:"GLB 3D Character",extensions:["glb"]}],properties:["openFile"]}).then(r=>{if(r.canceled||!r.filePaths[0])return;const file=r.filePaths[0];try{const data=fs.readFileSync(file);characterWin?.webContents.send("character:selected",new Uint8Array(data));diagnostic("INFO","GLB SELECTED","Character GLB selected",{name:path.basename(file),size:data.length})}catch(e){diagnostic("ERROR","GLB SELECTED",e.message)}})}

function whisperRuntimePaths(){const root=app.isPackaged?process.resourcesPath:path.join(__dirname,"..","build");return{exe:path.join(root,"whisper","whisper-stream.exe"),model:path.join(root,"whisper","ggml-base-q5_1.bin")}}
function stopLocalWhisper(){if(localWhisper){try{localWhisper.kill()}catch{}localWhisper=null}diagnostic("INFO","LOCAL STT STOP","Offline Whisper stopped");chatWin?.webContents.send("local-stt:state","disconnected")}
function startLocalWhisper(){const s=agent?.settings||{};if(s.micMode==="off"||s.sttProvider!=="whisper"){stopLocalWhisper();return false}const p=whisperRuntimePaths();if(!fs.existsSync(p.exe)||!fs.existsSync(p.model)){diagnostic("ERROR","LOCAL STT","Bundled Whisper engine/model is missing",{exe:p.exe,model:p.model});chatWin?.webContents.send("local-stt:state","error","Whisper engine/model is missing from this build");return false}stopLocalWhisper();const args=["-m",p.model,"-t",String(Math.max(2,Math.min(8,Number(s.whisperThreads)||4))),"--step","0","--length","5000","-vth","0.6"];if(s.sttLanguage&&s.sttLanguage!=="auto")args.push("-l",String(s.sttLanguage));try{localWhisper=spawn(p.exe,args,{cwd:path.dirname(p.exe),windowsHide:true});chatWin?.webContents.send("local-stt:state","starting");let block="";const line=d=>{const x=String(d||"").replace(/\x1b\[[0-9;]*[A-Za-z]/g,"").trim();if(!x)return;if(x.startsWith("### Transcription")&&x.includes("START")){block="";return}if(x.startsWith("### Transcription")&&x.includes("END")){const text=block.replace(/\[[^\]]+-->[^\]]+\]/g,"").replace(/\s+/g," ").trim();block="";if(text){diagnostic("INFO","LOCAL STT RESULT",text);chatWin?.webContents.send("local-stt:result",{text})}return}if(!x.startsWith("[Start speaking]")&&!x.startsWith("system_info"))block+=(block?" ":"")+x};localWhisper.stdout.setEncoding("utf8");localWhisper.stdout.on("data",d=>String(d).split(/\r?\n/).forEach(line));localWhisper.stderr.setEncoding("utf8");localWhisper.stderr.on("data",d=>diagnostic("INFO","LOCAL STT ENGINE",String(d).trim().slice(-1000)));localWhisper.on("error",e=>{localWhisper=null;diagnostic("ERROR","LOCAL STT PROCESS",e.message);chatWin?.webContents.send("local-stt:state","error",e.message)});localWhisper.on("close",(code,signal)=>{localWhisper=null;diagnostic(code===0?"INFO":"ERROR","LOCAL STT EXIT","Offline Whisper exited",{code,signal});chatWin?.webContents.send("local-stt:state",code===0?"disconnected":"error",code===0?"Whisper stopped":"Whisper exited with code "+code)});chatWin?.webContents.send("local-stt:state","connected");diagnostic("INFO","LOCAL STT CONNECTED","Bundled Whisper streaming engine is active");return true}catch(e){diagnostic("ERROR","LOCAL STT START",e.message);chatWin?.webContents.send("local-stt:state","error",e.message);return false}}
function setMicMode(mode){const value=String(mode||"always");if(agent)agent.settings={...agent.settings,micMode:value,alwaysListening:value==="always"};chatWin?.webContents.send("mic:mode",value);if(value==="off"){stopRealtime();stopLocalWhisper()}else if(agent?.settings?.sttProvider==="whisper"){stopRealtime();startLocalWhisper()}else if(String(agent?.settings?.brainMode||"auto")==="realtime")startRealtime();else stopRealtime();diagnostic("INFO","MIC MODE","Microphone mode: "+value)}
function setSaeedSize(size){const m={small:[360,440],medium:[430,520],large:[520,620]};const v=m[size]||m.medium;characterWin?.setSize(v[0],v[1],true)}
function contextMenu(){
 const menu=Menu.buildFromTemplate([
  {label:"Chat Me",click:showChat},
  {label:"3D Status",click:show3DStatus},
  {label:"Hide Saeed",click:()=>characterWin?.hide()},
  {type:"separator"},
  {label:"Change Character (GLB)",click:chooseCharacter},
  {label:"Settings",click:async()=>{await showChat();chatWin?.webContents.send("settings:show")}},
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
 chatWin.webContents.on("context-menu",()=>contextMenu());
 await chatWin.loadFile(path.join(__dirname,"index.html"));
 return chatWin;
}
async function createWindow(){
 await createCharacterWindow();
 const registry=new ToolRegistry({captureScreen,userDataPath:app.getPath("userData"),confirm:async({name,args})=>{await showChat();return new Promise(resolve=>{const id=Date.now().toString(36)+Math.random().toString(36).slice(2,7);confirmations.set(id,resolve);chatWin?.webContents.send("agent:confirm",{id,name,args});});}});
 agent=new Agent({registry,onEvent:e=>{diagnosticFromAgent(e);chatWin?.webContents.send("agent:event",e)}});
}
async function createCharacterWindow(){
 characterWin=new BrowserWindow({name:"saeed-character",width:430,height:520,minWidth:300,minHeight:360,frame:false,transparent:true,alwaysOnTop:true,show:false,hasShadow:false,resizable:true,skipTaskbar:false,icon:windowsIconPath(),webPreferences:{preload:path.join(__dirname,"preload.js"),contextIsolation:true,nodeIntegration:false,sandbox:false}});
 characterWin.setIcon(windowsIconPath());
 if(process.platform==="win32")characterWin.setAppDetails({appId:"ai.saeed.desktop",appIconPath:windowsIconPath(),appIconIndex:0,relaunchCommand:process.execPath,relaunchDisplayName:"Saeed AI Character"});
 characterWin.on("closed",()=>{characterWin=null});
 characterWin.on("close",e=>{if(!app.isQuitting()){e.preventDefault();characterWin.hide()}});
 characterWin.webContents.on("context-menu",()=>contextMenu());
 await characterWin.loadFile(path.join(__dirname,"character.html"));
 fitCharacterToDisplay(screen.getPrimaryDisplay(),{bottomRight:true});
 characterWin.show();
}
function configureUpdater(){autoUpdater.autoDownload=false;autoUpdater.autoInstallOnAppQuit=false;autoUpdater.on("checking-for-update",()=>{updateState="checking";chatWin?.webContents.send("update:state","checking")});autoUpdater.on("update-not-available",()=>{updateState="latest";chatWin?.webContents.send("update:state","latest")});autoUpdater.on("update-available",info=>{updateState="available";chatWin?.webContents.send("update:available",{version:info.version,releaseDate:info.releaseDate||null,releaseNotes:info.releaseNotes||null})});autoUpdater.on("download-progress",p=>chatWin?.webContents.send("update:progress",{percent:p.percent,transferred:p.transferred,total:p.total,bytesPerSecond:p.bytesPerSecond}));autoUpdater.on("update-downloaded",info=>{updateState="downloaded";chatWin?.webContents.send("update:downloaded",{version:info.version})});autoUpdater.on("error",e=>{updateState="error";chatWin?.webContents.send("update:state","error",e?.message||String(e))})}
app.whenReady().then(async()=>{app.isQuitting=false;diagnostic("INFO","APPLICATION","Diagnostics system started");
 configureUpdater();
 if(process.platform==="win32")app.setUserTasks([{program:process.execPath,arguments:"--chat",iconPath:windowsIconPath(),iconIndex:0,title:"Chat Me",description:"Open Saeed Chat"},{program:process.execPath,arguments:"--3d-status",iconPath:windowsIconPath(),iconIndex:0,title:"3D Status",description:"Open live 3D renderer and GLB status"}]);
 try{await createWindow()}catch(e){console.error("Saeed startup failed:",e);app.quit();return}
 if(process.argv.includes("--3d-status"))show3DStatus(); else if(process.argv.includes("--chat"))void showChat();
 try{
  tray=new Tray(trayIcon());
  tray.setToolTip("Saeed AI");
  tray.setContextMenu(Menu.buildFromTemplate([
   {label:"Show Saeed",click:showCharacter},{label:"Chat Me",click:showChat},{label:"3D Status",click:show3DStatus},{label:"Status",click:showStatus},{label:"Hide Saeed",click:()=>characterWin?.hide()},
   {type:"separator"},{label:"Always Listening",type:"radio",checked:true,click:()=>setMicMode("always")},{label:"Push to Talk",type:"radio",click:()=>setMicMode("ptt")},{label:"Mic Off",type:"radio",click:()=>setMicMode("off")},
   {label:"Change Character (GLB)",click:chooseCharacter},{label:"Check for Updates",click:async()=>{await showChat();chatWin?.webContents.send("update:check-ui");try{await autoUpdater.checkForUpdates()}catch(e){diagnostic("ERROR","UPDATE",e.message)}}},{label:"Settings",click:async()=>{await showChat();chatWin?.webContents.send("settings:show")}},{label:"Open Diagnostics Log",click:openDiagnosticsLog},
   {label:"Saeed Size",submenu:[{label:"Small",click:()=>setSaeedSize("small")},{label:"Medium",click:()=>setSaeedSize("medium")},{label:"Large",click:()=>setSaeedSize("large")}]},{type:"separator"},{label:"Quit",click:()=>app.quit()}
  ]));
 }catch(e){console.error("Tray failed:",e)}
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
ipcMain.handle("diagnostic:report",(_,level,stage,message,meta)=>diagnostic(level,stage,message,meta));ipcMain.handle("diagnostic:snapshot",()=>({state:diagnosticState,file:diagnosticFile}));ipcMain.handle("diagnostic:open-log",()=>{openDiagnosticsLog();return true});ipcMain.handle("status:show",()=>{showStatus();return true});ipcMain.handle("character:choose",()=>{chooseCharacter();return true});
ipcMain.handle("settings:set",(_,s)=>{
 if(!agent)throw new Error("Saeed is still starting.");
 agent.settings={...(s||{})};
 const mode=String(agent.settings.brainMode||"auto");
 if(mode==="realtime")startRealtime(); else stopRealtime(); if(agent.settings.sttProvider==="whisper"&&agent.settings.micMode!=="off")startLocalWhisper(); else if(agent.settings.sttProvider!=="whisper")stopLocalWhisper();
 diagnostic("INFO","BRAIN MODE","Brain mode selected: "+mode);
 return agent.publicSettings();
});
ipcMain.handle("realtime:start",(_,options={})=>{startRealtime(options);return true});
ipcMain.handle("realtime:stop",()=>{stopRealtime();return true});
ipcMain.handle("realtime:audio",(_,base64)=>{realtime?.appendAudio(String(base64||""));return true});
ipcMain.handle("realtime:text",(_,text)=>realtime?.text(String(text||""))||false);
ipcMain.handle("realtime:cancel",()=>{realtime?.cancel();return true});ipcMain.handle("local-stt:start",()=>startLocalWhisper());ipcMain.handle("local-stt:stop",()=>{stopLocalWhisper();return true});ipcMain.handle("local-stt:transcribe",(_,base64)=>transcribeLocalWav(String(base64||"")));function transcribeLocalWav(base64){return new Promise((resolve,reject)=>{const p=whisperRuntimePaths();const cli=path.join(path.dirname(p.exe),"whisper-cli.exe");if(!fs.existsSync(cli)||!fs.existsSync(p.model))return reject(new Error("Offline Whisper CLI/model is missing"));const wav=path.join(app.getPath("temp"),"saeed-ptt-"+Date.now()+".wav");try{const pcm=Buffer.from(String(base64||""),"base64");const header=Buffer.alloc(44);header.write("RIFF",0);header.writeUInt32LE(36+pcm.length,4);header.write("WAVE",8);header.write("fmt ",12);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(24000,24);header.writeUInt32LE(24000*2,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write("data",36);header.writeUInt32LE(pcm.length,40);fs.writeFileSync(wav,Buffer.concat([header,pcm]));const args=["-m",p.model,"-f",wav,"-nt","-np","--no-timestamps"];if(agent?.settings?.sttLanguage&&agent.settings.sttLanguage!=="auto")args.push("-l",String(agent.settings.sttLanguage));const child=spawn(cli,args,{cwd:path.dirname(cli),windowsHide:true});let out="";let err="";child.stdout.setEncoding("utf8");child.stderr.setEncoding("utf8");child.stdout.on("data",d=>out+=d);child.stderr.on("data",d=>err+=d);child.on("error",e=>{try{fs.unlinkSync(wav)}catch{}reject(e)});child.on("close",code=>{try{fs.unlinkSync(wav)}catch{}if(code!==0)return reject(new Error(err.slice(-1200)||("Whisper CLI exited with code "+code)));const text=out.replace(/\x1b\[[0-9;]*[A-Za-z]/g,"").split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith("[")&&!x.startsWith("whisper_")).join(" ").replace(/^\s*[\[\(].*?[\]\)]\s*/,"").trim();diagnostic("INFO","LOCAL STT PTT RESULT",text);resolve(text)})}catch(e){try{fs.unlinkSync(wav)}catch{}reject(e)}})}
ipcMain.handle("mic:mode",(_,mode)=>{setMicMode(String(mode||"always"));return true});
ipcMain.handle("capture",()=>captureScreen());
ipcMain.handle("update:check",async()=>{if(!app.isPackaged)return {ok:false,state:"unavailable",message:"Updates are available only in the installed Windows build."};try{updateState="checking";chatWin?.webContents.send("update:state","checking");const result=await autoUpdater.checkForUpdates();return {ok:true,state:updateState,version:result?.updateInfo?.version||null}}catch(e){updateState="error";chatWin?.webContents.send("update:state","error",e.message);return {ok:false,state:"error",message:e.message}}});
ipcMain.handle("update:download",async()=>{if(updateState!=="available")return false;try{updateState="downloading";chatWin?.webContents.send("update:state","downloading");await autoUpdater.downloadUpdate();return true}catch(e){updateState="error";chatWin?.webContents.send("update:state","error",e.message);return false}});
ipcMain.handle("update:install",()=>{if(updateState!=="downloaded")return false;autoUpdater.quitAndInstall(false,true);return true});
ipcMain.handle("update:state",()=>updateState);

ipcMain.handle("history:get",()=>agent?.history||[]);
ipcMain.handle("agent:confirm-response",(_,id,approved)=>{
 const resolve=confirmations.get(id);if(!resolve)return false;
 confirmations.delete(id);resolve(Boolean(approved));return true;
});
function stopRealtime(){
 if(realtime){realtime.stop();realtime=null}diagnostic("INFO","STT DISCONNECTED","Realtime STT connection stopped");diagnostic("INFO","TTS DISCONNECTED","Realtime TTS connection stopped");chatWin?.webContents.send("realtime:state","disconnected");
}
function startRealtime(options={}){
 const s=agent?.settings||{};
 const key=s.realtimeApiKey||s.apiKey||"";
 if(!key || s.provider==="ollama"){diagnostic("ERROR","STT API KEY","Realtime/OpenAI API key is missing");diagnostic("ERROR","TTS API KEY","Realtime/OpenAI API key is missing");chatWin?.webContents.send("realtime:state","not-configured","OpenAI API key is not configured.");return false}
 diagnostic("INFO","STT START","Starting Realtime STT");diagnostic("INFO","TTS START","Starting Realtime TTS");if(realtime) realtime.stop();
 const registry=agent?.registry;
 const realtimeTools=(registry?.schemas()||[]).map(t=>({
  type:"function",
  name:t.function?.name,
  description:t.function?.description||"",
  parameters:t.function?.parameters||{type:"object",properties:{},required:[]}
 })).filter(t=>t.name);
 realtime=new OpenAIRealtime({
  state:(state,message)=>{diagnostic("INFO","REALTIME "+String(state||"").toUpperCase(),message||"");if(state==="connected"){diagnostic("INFO","STT CONNECTED","Realtime STT connected");diagnostic("INFO","TTS CONNECTED","Realtime TTS connected")}if(state==="error")diagnostic("ERROR","REALTIME API",message||"Realtime API error");if(state==="disconnected")diagnostic("ERROR","REALTIME DISCONNECTED",message||"Realtime connection closed");chatWin?.webContents.send("realtime:state",state,message)},
  event:async(event)=>{
   if(event.type==="response.output_audio.delta"&&event.delta){diagnostic("INFO","TTS AUDIO","Realtime audio received");chatWin?.webContents.send("realtime:audio",event.delta);}
   else if(event.type==="response.output_audio_transcript.delta"&&event.delta)chatWin?.webContents.send("realtime:assistant-delta",event.delta);
   else if(event.type==="response.output_audio_transcript.done"&&event.transcript)chatWin?.webContents.send("realtime:assistant-final",event.transcript);
   else if(event.type==="conversation.item.input_audio_transcription.delta"&&event.delta)chatWin?.webContents.send("realtime:user-delta",event.delta);
   else if(event.type==="conversation.item.input_audio_transcription.completed"&&event.transcript)chatWin?.webContents.send("realtime:user-final",event.transcript);
   else if(event.type==="response.function_call_arguments.done"&&event.call_id){
    const name=String(event.name||"");
    let args={};
    try{args=JSON.parse(event.arguments||"{}")}catch{args={}};
    chatWin?.webContents.send("agent:event",{type:"tool",name,args,source:"realtime"});
    let out;
    try{out=await registry.call(name,args)}catch(e){out={ok:false,error:e.message}};
    if(out?.ok===false)chatWin?.webContents.send("agent:event",{type:"tool_error",name,error:out.error||"Tool failed",source:"realtime"});
    else chatWin?.webContents.send("agent:event",{type:"tool_result",name,result:out,source:"realtime"});
    realtime?.toolResult(event.call_id,out||{ok:false,error:"Tool returned no result"});
   }
   else if(event.type==="response.done")chatWin?.webContents.send("realtime:done",event.response?.status||"completed");
   else if(event.type==="error")chatWin?.webContents.send("realtime:error",event.error?.message||"Realtime API error");
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
ipcMain.on("window:show-chat",()=>{void showChat()});
ipcMain.on("window:close-chat",()=>{if(chatWin&&!chatWin.isDestroyed()){chatWin.destroy();chatWin=null}});

app.on("activate",()=>{if(characterWin&&!characterWin.isDestroyed()){showCharacter();return}createWindow().catch(e=>console.error(e))});
app.on("window-all-closed",()=>{if(process.platform!=="darwin"&&!app.isQuitting)app.quit()});
app.on("before-quit",()=>{
 app.isQuitting=true;
 try{stopRealtime();stopLocalWhisper()}catch(e){console.error("Voice shutdown failed:",e)}
 for(const win of [chatWin,statusWin,threeDStatusWin,characterWin]){try{if(win&&!win.isDestroyed())win.destroy()}catch(e){console.error("Window shutdown failed:",e)}}
 try{if(tray){tray.destroy();tray=null}}catch(e){console.error("Tray shutdown failed:",e)}
});
app.on("will-quit",()=>{globalShortcut.unregisterAll();try{stopRealtime()}catch{}});
