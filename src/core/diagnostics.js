function createDiagnostics({getWindows=()=>[],getThreeDWindow=()=>null}={}){
 const state={mic:{state:"unknown",level:0,detail:""},brainApi:{state:"unknown",detail:""},brainLocal:{state:"ready",detail:"Local intent engine"},stt:{state:"unknown",detail:""},tts:{state:"unknown",detail:""},glb:{state:"unknown",detail:""},cpu:{state:"unknown",percent:0,detail:"Waiting for CPU measurement"},threeD:{overall:{state:"unknown",detail:"Waiting for 3D renderer"},components:{},lastUpdated:null}};
 function update(e){
  const s=String(e.stage||"").toUpperCase(),fail=e.level==="ERROR";
  if(s.includes("MIC")){const msg=String(e.message||"").toLowerCase();const disabled=s.includes("MIC MODE")&&msg.includes("off")||s.includes("MIC STOP")||s.includes("MIC PERMISSION");state.mic.state=fail?"error":disabled?"disabled":"active";state.mic.detail=e.message;if(disabled)state.mic.level=0;else if(e.meta?.level!=null)state.mic.level=Number(e.meta.level)||0}
  if(s.includes("LLM")||s.includes("BRAIN API")){state.brainApi.state=fail?"error":(s.includes("SUCCESS")||s.includes("CONNECTED")?"connected":"active");state.brainApi.detail=e.message}
  if(s.includes("LOCAL")){state.brainLocal.state=fail?"error":"ready";state.brainLocal.detail=e.message}
  if(s.includes("STT")){state.stt.state=fail?"error":s.includes("DISCONNECTED")?"disabled":(s.includes("READY")||s.includes("CONNECTED")||s.includes("ACTIVE")||s.includes("START")?"active":state.stt.state);state.stt.detail=e.message}
  if(s.includes("TTS")){state.tts.state=fail?"error":s.includes("DISCONNECTED")?"disabled":(s.includes("READY")||s.includes("CONNECTED")||s.includes("ACTIVE")||s.includes("START")||s.includes("SUCCESS")?"active":state.tts.state);state.tts.detail=e.message}
  if(s.includes("GLB")||s.includes("CHARACTER READY")){state.glb.state=fail?"error":s.includes("READY")?"ready":"active";state.glb.detail=e.message}
  const win=getWindows();if(win?.status&&!win.status.isDestroyed())win.status.webContents.send("diagnostic:state",state);
 }
 function publish3D(report){if(!report)return;state.threeD=report;state.threeD.lastUpdated=new Date().toISOString();const win=getThreeDWindow();if(win&&!win.isDestroyed())win.webContents.send("3d:status",state.threeD)}
 function event(level,stage,message,meta={}){
  const e={time:new Date().toISOString(),level:String(level||"INFO").toUpperCase(),stage:String(stage||"GENERAL"),message:String(message||""),meta:meta||{}};
  const win=getWindows();if(win?.chat&&!win.chat.isDestroyed())win.chat.webContents.send("diagnostic:event",e);update(e);return e;
 }
 return {state,event,update,publish3D};
}
module.exports={createDiagnostics};