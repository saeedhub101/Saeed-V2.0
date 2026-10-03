function createVoiceHost({app,path,fs,spawn,diagnostic,voiceBroadcastExternal,getAgent,getVoiceRuntime,permissionPolicy,confirmPermission,rebuildTray,showChat,getStatusWindow,diagnosticState}){
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
 
 function voiceBroadcast(channel,...args){return voiceBroadcastExternal(channel,...args)}
 let currentMicMode="off",voiceMuted=false;
 
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
 
 return {whisperRuntimePaths,setMicMode,setVoiceMuted,getCurrentMicMode:()=>currentMicMode,getVoiceMuted:()=>voiceMuted};
}
module.exports={createVoiceHost};
