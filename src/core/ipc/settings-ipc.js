function registerSettingsIpc(deps){const {ipcMain}=deps;ipcMain.handle("settings:set",async(_,s)=>{
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
}
module.exports={registerSettingsIpc};
