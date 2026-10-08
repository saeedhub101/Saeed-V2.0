function createDiagnostics({getWindows,getResourceService}){
 const pending3DQueries=new Map();
 const diagnosticState={mic:{state:"unknown",level:0,detail:""},brainApi:{state:"unknown",detail:""},brainLocal:{state:"ready",detail:"Local intent engine"},stt:{state:"unknown",detail:""},tts:{state:"unknown",detail:""},glb:{state:"unknown",detail:""},cpu:{state:"unknown",percent:0,detail:"Waiting for CPU measurement"},threeD:{overall:{state:"unknown",detail:"Waiting for 3D renderer"},components:{},lastUpdated:null}};
 function diagnostic(level,stage,message,meta={}){
  const event={time:new Date().toISOString(),level:String(level||"INFO").toUpperCase(),stage:String(stage||"GENERAL"),message:String(message||""),meta:meta||{}};
  if(getWindows().chatWin&&!getWindows().chatWin.isDestroyed())getWindows().chatWin.webContents.send("diagnostic:event",event);
  updateDiagnosticState(event);return event;
 }
 function publish3DStatus(report){if(!report)return;diagnosticState.threeD=report;diagnosticState.threeD.lastUpdated=new Date().toISOString();const windows=getWindows();if(windows.threeDStatusWin&&!windows.threeDStatusWin.isDestroyed())windows.threeDStatusWin.webContents.send("3d:status",diagnosticState.threeD);if(windows.performanceWin&&!windows.performanceWin.isDestroyed())windows.performanceWin.webContents.send("diagnostic:state",diagnosticState)}
 function accept3DStatus(requestId,report){const resolve=pending3DQueries.get(String(requestId||""));if(resolve){resolve(report);return true}publish3DStatus(report);return false}
 function request3DStatus(){return new Promise(resolve=>{const character=getWindows().characterWin;if(!character||character.isDestroyed()){const previous=diagnosticState.threeD?.lastUpdated?diagnosticState.threeD:null;const report=previous||{overall:{state:"waiting",detail:"3D character renderer is not running"},components:{},lastUpdated:new Date().toISOString()};publish3DStatus(report);resolve(report);return}const id=Date.now().toString(36)+Math.random().toString(36).slice(2,8);const timer=setTimeout(()=>{pending3DQueries.delete(id);const previous=diagnosticState.threeD||{};const report={...previous,overall:{state:previous.components&&Object.keys(previous.components).length?"warn":"error",detail:previous.components&&Object.keys(previous.components).length?"3D renderer is responding slowly; showing last verified state":"3D renderer status query timed out"},lastUpdated:new Date().toISOString()};publish3DStatus(report);resolve(report)},15000);pending3DQueries.set(id,report=>{clearTimeout(timer);pending3DQueries.delete(id);publish3DStatus(report);resolve(report)});const sendQuery=()=>{try{character.webContents.send("3d:query",id)}catch(error){clearTimeout(timer);pending3DQueries.delete(id);const report={...diagnosticState.threeD,overall:{state:"error",detail:error?.message||String(error)},lastUpdated:new Date().toISOString()};publish3DStatus(report);resolve(report)}};try{if(character.webContents.isLoadingMainFrame?.()){const onLoaded=()=>{character.webContents.removeListener("did-finish-load",onLoaded);sendQuery()};character.webContents.once("did-finish-load",onLoaded);setTimeout(()=>{character.webContents.removeListener("did-finish-load",onLoaded);if(pending3DQueries.has(id))sendQuery()},5000)}else sendQuery()}catch(error){sendQuery()}})}
 function updateDiagnosticState(e){const s=String(e.stage||"").toUpperCase(),fail=e.level==="ERROR";
  if(s.includes("MIC")){const msg=String(e.message||"").toLowerCase();const disabled=s.includes("MIC MODE")&&msg.includes("off")||s.includes("MIC STOP")||s.includes("MIC PERMISSION");diagnosticState.mic.state=fail?"error":disabled?"disabled":"active";diagnosticState.mic.detail=e.message;if(disabled)diagnosticState.mic.level=0;else if(e.meta?.level!=null)diagnosticState.mic.level=Number(e.meta.level)||0}
  if(s.includes("LLM")||s.includes("BRAIN API")){diagnosticState.brainApi.state=fail?"error":(s.includes("SUCCESS")||s.includes("CONNECTED")?"connected":"active");diagnosticState.brainApi.detail=e.message}
  if(s.includes("LOCAL")){diagnosticState.brainLocal.state=fail?"error":"ready";diagnosticState.brainLocal.detail=e.message}
  if(s.includes("STT")){diagnosticState.stt.state=fail?"error":s.includes("DISCONNECTED")?"disabled":(s.includes("READY")||s.includes("CONNECTED")||s.includes("ACTIVE")||s.includes("START")?"active":diagnosticState.stt.state);diagnosticState.stt.detail=e.message}
  if(s.includes("TTS")){diagnosticState.tts.state=fail?"error":s.includes("DISCONNECTED")?"disabled":(s.includes("READY")||s.includes("CONNECTED")||s.includes("ACTIVE")||s.includes("START")||s.includes("SUCCESS")?"active":diagnosticState.tts.state);diagnosticState.tts.detail=e.message}
  if(s.includes("GLB")||s.includes("CHARACTER READY")){diagnosticState.glb.state=fail?"error":s.includes("READY")?"ready":"active";diagnosticState.glb.detail=e.message}
  
  if(getWindows().statusWin&&!getWindows().statusWin.isDestroyed())getWindows().statusWin.webContents.send("diagnostic:state",diagnosticState);if(getWindows().performanceWin&&!getWindows().performanceWin.isDestroyed())getWindows().performanceWin.webContents.send("diagnostic:state",diagnosticState);
 }
 let cpuTimer=null;
 function startCpuMonitoring(){
  if(cpuTimer)return;
  updateCpuMetrics();
  cpuTimer=setInterval(updateCpuMetrics,1000);
 }
 function stopCpuMonitoring(){
  if(getWindows().statusWin||getWindows().performanceWin)return;
  if(cpuTimer)clearInterval(cpuTimer);
  cpuTimer=null;
 }
 
 function updateCpuMetrics(){try{const {rawMetrics:metrics,logical}=getResourceService().getAppResourceMetrics();const total=metrics.reduce((sum,m)=>sum+Number(m?.cpu?.percentCPUUsage||0),0);const percent=Math.max(0,total/logical);diagnosticState.cpu={state:"active",percent,detail:`Saeed CPU ${percent.toFixed(1)}% across ${logical} logical processors`,processCount:metrics.length,lastUpdated:new Date().toISOString()};if(getWindows().statusWin&&!getWindows().statusWin.isDestroyed())getWindows().statusWin.webContents.send("diagnostic:state",diagnosticState);if(getWindows().chatWin&&!getWindows().chatWin.isDestroyed())getWindows().chatWin.webContents.send("cpu:metrics",diagnosticState.cpu)}catch(e){diagnosticState.cpu={state:"error",percent:0,detail:e.message,lastUpdated:new Date().toISOString()};diagnostic("ERROR","CPU METRICS",e.message)}}
 function diagnosticFromAgent(e){if(!e)return;if(e.type==="thinking")diagnostic("INFO","LLM THINKING","LLM planning/execution step "+(Number(e.step||0)+1));if(e.type==="answer")diagnostic("INFO","LLM SUCCESS","Successful LLM response");if(e.type==="tool_error")diagnostic("ERROR","LLM TOOL ERROR",e.error||"Tool failed",{tool:e.name});if(e.type==="tool_result")diagnostic("INFO","LLM TOOL SUCCESS","Tool completed",{tool:e.name});if(e.type==="diagnostic")diagnostic(e.level,e.stage,e.message,e.meta);}
 return {diagnosticState,diagnostic,publish3DStatus,accept3DStatus,request3DStatus,updateDiagnosticState,startCpuMonitoring,stopCpuMonitoring,updateCpuMetrics,diagnosticFromAgent};
}
module.exports={createDiagnostics};
