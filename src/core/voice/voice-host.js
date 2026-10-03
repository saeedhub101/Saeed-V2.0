function createVoiceHost({app,path,fs,spawn,diagnostic,voiceBroadcast,getAgent,getVoiceRuntime,permissionPolicy,confirmPermission,rebuildTray,showChat,getCharacterWindow,getChatWindow,getStatusWindow,diagnosticState}){
 function whisperRuntimePaths(){
  const roots=[
   getAddonService().addonDir(app.getPath("userData"),"stt-whisper"),
   path.join(process.resourcesPath||"","whisper"),
   path.join(process.resourcesPath||"","addons","stt-whisper"),
   path.join(process.resourcesPath||"","saeed-addon-stt-whisper")
  ].filter(Boolean);
  const found=[];
  const walk=(root,depth=0)=>{
   if(!root||depth>4||!fs.existsSync(root))return;
   let entries=[];try{entries=fs.readdirSync(root,{withFileTypes:true})}catch{return}
   for(const e of entries){
    const p=path.join(root,e.name);
    if(e.isFile()&&e.name.toLowerCase()==="whisper-cli.exe")found.push({root:path.dirname(p),exe:p});
    else if(e.isDirectory())walk(p,depth+1);
   }
  };
  roots.forEach(r=>walk(r));
  for(const item of found){
   let model="";
   const preferred=["ggml-base-q5_1.bin","ggml-base.bin","ggml-base.en-q5_1.bin","ggml-base.en.bin"];
   for(const name of preferred){const p=path.join(item.root,name);if(fs.existsSync(p)){model=p;break}}
   if(!model){try{const n=fs.readdirSync(item.root).find(x=>/^ggml-.*\\.bin$/i.test(x));if(n)model=path.join(item.root,n)}catch{}}
   if(model)return{root:item.root,exe:item.exe,model};
  }
  const root=roots[0]||getAddonService().addonDir(app.getPath("userData"),"stt-whisper");
  return{root,exe:path.join(root,"whisper-cli.exe"),model:path.join(root,"ggml-base-q5_1.bin")};
 }
 function voiceBroadcast(channel,...args){for(const win of [characterWin,chatWin]){if(win&&!win.isDestroyed())win.webContents.send(channel,...args)}}
 let currentMicMode="off",voiceMuted=false;
 function updateNow(){if(!app.isPackaged)return;updateUiRequested=true;try{updateState="checking";showUpdateToast("checking","Checking for updates…");voiceBroadcast("update:state","checking");void getAutoUpdater().checkForUpdates()}catch(e){updateState="error";voiceBroadcast("update:state","error",e.message)}}
 function characterSizeMenu(){return[{label:"Small",click:()=>setSaeedSize("small")},{label:"Medium",click:()=>setSaeedSize("medium")},{label:"Large",click:()=>setSaeedSize("large")}]}
 function rebuildTray(){if(!tray)return;tray.setContextMenu(Menu.buildFromTemplate([{label:"Saeed",submenu:[{label:"Show Saeed",click:showCharacter},{label:"Chat Me",click:showChat},{label:"Hide Saeed",click:hideCharacter}]},{label:voiceMuted?"Unmute":"Mute",type:"checkbox",checked:voiceMuted,click:()=>setVoiceMuted(!voiceMuted)},{label:"Voice",submenu:[{label:"Mic ON",type:"radio",checked:currentMicMode==="on",click:()=>setMicMode("on")},{label:"Mic OFF",type:"radio",checked:currentMicMode==="off",click:()=>setMicMode("off")}]},{label:"Character",submenu:[{label:"Change Character (GLB)",click:chooseCharacter},{label:"Size",submenu:characterSizeMenu()}]},{label:"Add-ons / Plug-ins",click:showAddons},{label:"Learning / Teach Mode",click:showLearning},{label:"Diagnostics",submenu:[{label:"Performance",click:showPerformance},{label:"Status",click:showStatus},{label:"3D Status",click:show3DStatus}]},{label:"Updates",submenu:[{label:"Check for Updates",click:updateNow}]},{label:"Quit",click:()=>app.quit()}]))}
 function setVoiceMuted(muted){voiceMuted=Boolean(muted);if(agent){agent.settings={...agent.settings,voiceMuted};agent.persistSettings();}if(voiceMuted){try{getVoiceRuntime().stop()}catch{}voiceBroadcast("voice:stop")}else if(currentMicMode==="on"&&agent?.settings?.micPath==="realtime"&&agent?.settings?.realtimeEnabled&&String(agent?.settings?.brainMode||"auto")==="api"){getVoiceRuntime().start()}voiceBroadcast("voice:mute",voiceMuted);diagnostic("INFO","TTS MUTE",voiceMuted?"Saeed voice muted":"Saeed voice unmuted");rebuildTray();return voiceMuted}
 async function setMicMode(mode,fromUser=false){
  const value=String(mode||"off")==="on"?"on":"off";
  if(value==="on")await ensureBrain();
  if(value==="on"){
   const policy=permissionPolicy("microphone");
   if(policy==="deny"){diagnostic("INFO","MIC PERMISSION","Microphone access is denied by Permissions settings");return false}
   if(policy==="ask"&&!await confirmPermission("microphone",{name:"microphone",args:{action:"enable"}})){diagnostic("INFO","MIC PERMISSION","Microphone access was denied by user");return false}
  }
  currentMicMode=value;
  if(agent)agent.settings={...agent.settings,micMode:value};
  diagnosticState.mic={...diagnosticState.mic,state:value==="on"?"active":"disabled",level:value==="on"?diagnosticState.mic.level:0,detail:value==="on"?"Microphone ON":"Microphone OFF"};
  voiceBroadcast("mic:mode",value);
  if(statusWin&&!statusWin.isDestroyed())statusWin.webContents.send("mic:mode",value);
  if(value==="off"){
   try{getVoiceRuntime().stop()}catch{}
   diagnostic("INFO","MIC INPUT","Microphone input is OFF; voice input services stopped");
   voiceBroadcast("local-stt:state","disconnected","Microphone input is off");
  }else{
   if(agent?.settings?.micPath==="realtime"&&agent?.settings?.realtimeEnabled&&String(agent?.settings?.brainMode||"auto")==="api")getVoiceRuntime().start();
   else if(agent?.settings?.sttProvider==="whisper"){voiceBroadcast("local-stt:state","ready","Local Whisper ready");diagnostic("INFO","STT READY","Local Whisper is ready for microphone input");}
   else diagnostic("INFO","STT READY","Selected API STT is ready for microphone input");
   diagnostic("INFO","TTS READY","TTS is ready for voice replies");
  }
  diagnostic("INFO","MIC MODE","Microphone mode: "+value);
  rebuildTray();
 }
 function setSaeedSize(size){const m={small:[300,360],medium:[430,520],large:[560,660]};const key=Object.prototype.hasOwnProperty.call(m,size)?size:"medium";const v=m[key];if(characterWin&&!characterWin.isDestroyed()){const d=displayForWindow();const a=d.workArea;const margin=18;const [oldX,oldY]=characterWin.getPosition();const [oldW,oldH]=characterWin.getSize();const oldRight=oldX+oldW,oldBottom=oldY+oldH;const x=Math.max(a.x,Math.min(oldRight-v[0],a.x+a.width-v[0]-margin));const y=Math.max(a.y,Math.min(oldBottom-v[1],a.y+a.height-v[1]-margin));characterWin.setMinimumSize(300,360);characterWin.setMaximumSize(900,900);characterWin.setResizable(true);characterWin.setSize(v[0],v[1],false);characterWin.setPosition(Math.round(x),Math.round(y),false);characterWin.webContents.send("character:size",key)}if(agent){agent.settings={...agent.settings,characterSize:key};agent.persistSettings()}}
 function contextMenu(){
  const menu=Menu.buildFromTemplate([
   {label:"Saeed",submenu:[{label:"Chat Me",click:showChat},{label:"Hide Saeed",click:hideCharacter}]},
   {label:"Voice",submenu:[{label:"Mic ON",type:"radio",checked:currentMicMode==="on",click:()=>setMicMode("on")},{label:"Mic OFF",type:"radio",checked:currentMicMode==="off",click:()=>setMicMode("off")}]},
   {label:"Character",submenu:[{label:"Change Character (GLB)",click:chooseCharacter},{label:"Size",submenu:characterSizeMenu()}]},
   {label:"Add-ons / Plug-ins",click:showAddons},
   {label:"Learning / Teach Mode",click:showLearning},
   {label:"Diagnostics",submenu:[{label:"Performance",click:showPerformance},{label:"Status",click:showStatus},{label:"3D Status",click:show3DStatus}]},
   {label:"Updates & Settings",submenu:[{label:"Check for Updates",click:updateNow},{label:"Settings",click:showSettings}]},
   {label:"Quit",click:()=>app.quit()}
  ]);
  menu.popup({window:characterWin});
 }
 
 return {whisperRuntimePaths,setMicMode,setVoiceMuted,updateNow};
}
module.exports={createVoiceHost};
