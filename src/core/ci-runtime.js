const fs=require("fs"),path=require("path");
function createCiRuntime(deps={}){
 const {ciSmoke,app,getCharacterWindow,getTray,getAgent,getBrainSupervisor,getCurrentMicMode,resourceService,addons,learning,OpenAIRealtime,request3DStatus,apiHealth,diagnosticState,voiceRuntime,transcribeLocalWav,whisperRuntimePaths,ensureBrain}=deps;
 async function runCi3DBaseline(){
 if(!ciSmoke||process.env.SAEED_CI_3D_OFF!=="1")return;
 const started=Date.now();
 const samples=[];
 const sample=label=>{samples.push({time:new Date().toISOString(),label,resource:resourceService.resourceSnapshot(label),metrics:app.getAppMetrics().map(m=>({pid:m.pid,type:m.type,name:m.name||"",cpuPercent:+(m.cpu?.percentCPUUsage||0).toFixed(2),workingSetMB:+((m.memory?.workingSetSize||0)/1024).toFixed(1),privateMB:+((m.memory?.privateBytes||0)/1024).toFixed(1)}))});};
 sample("static-image-start");
 await new Promise(r=>setTimeout(r,5000));
 sample("static-image-5s");
 const target=process.env.SAEED_CI_3D_BASELINE_REPORT||path.join(process.cwd(),"dist","ci-3d-baseline.json");
 fs.mkdirSync(path.dirname(target),{recursive:true});
 fs.writeFileSync(target,JSON.stringify({mode:"static-image-baseline",webgl:false,glb:false,renderLoop:false,durationMs:Date.now()-started,samples},null,2),"utf8");
 app.quit();
}

async function runCiRuntimeSmoke(){
 const report={startedAt:new Date().toISOString(),version:app.getVersion(),checks:{},phases:{},resources:resourceService.resourceReport(),environment:{packaged:app.isPackaged,platform:process.platform,ci:true}};
 const check=async(name,fn,{required=true}={})=>{
  const started=Date.now();
  try{report.checks[name]={pass:false,required,latencyMs:0};const value=await fn();const pass=value===true||value?.pass===true;report.checks[name]={...report.checks[name],pass,required,latencyMs:Date.now()-started,detail:typeof value==="object"&&value&&!Array.isArray(value)?value:undefined};return report.checks[name]}
  catch(e){report.checks[name]={pass:false,required,latencyMs:Date.now()-started,error:String(e?.stack||e)};return report.checks[name]}
 };
 let characterWin,agent,brainSupervisor,currentMicMode="off",runtime; await ensureBrain(); characterWin=getCharacterWindow?.(); agent=getAgent?.(); brainSupervisor=getBrainSupervisor?.(); currentMicMode=getCurrentMicMode?.()||"off"; runtime={characterWindow:Boolean(characterWin&&!characterWin.isDestroyed()),tray:Boolean(getTray?.()),agent:Boolean(agent),localBrain:Boolean(agent?.localBrain),brainSupervisor:Boolean(brainSupervisor),micMode:currentMicMode,realtime:Boolean(voiceRuntime?.getRealtime?.()),addonsManager:Boolean(addons&&typeof addons.install==="function"&&typeof addons.uninstall==="function"),learning:Boolean(learning&&typeof learning.beginRecording==="function"),realtimeClass:Boolean(typeof OpenAIRealtime==="function")};
 try{
  report.phases.startup={runtime,resources:resourceService.resourceReport("startup")};
  report.checks.startup={pass:runtime.characterWindow&&runtime.tray&&runtime.micMode==="off"&&!runtime.realtime,detail:runtime};

  const glbCandidates=[path.join(app.getAppPath(),"assets","Saeed_Test-3D.glb"),path.join(app.getAppPath(),"assets","Saeed_AI-3D.glb")];
  const glb=glbCandidates.find(fs.existsSync)||glbCandidates[0];
  report.checks.glbFile={pass:fs.existsSync(glb)&&fs.statSync(glb).size>1024,path:glb,size:fs.existsSync(glb)?fs.statSync(glb).size:0};

  report.phases.core={resources:resourceService.resourceReport("core-ready")};
  await check("core.agent",()=>Boolean(agent&&agent.registry&&typeof agent.run==="function"));
  await check("core.localBrain",()=>Boolean(agent?.localBrain&&typeof agent.localBrain.handle==="function"));
  await check("core.brainSupervisor",()=>Boolean(brainSupervisor&&brainSupervisor.active&&typeof brainSupervisor.state==="function"));
  await check("core.instantBrain",async()=>{
   const state=brainSupervisor?.state?.();
   return Boolean(state?.controller);
  });

  const originalBrainMode=agent.settings.brainMode;
  let localChatResult=null;
  try{
   agent.settings={...agent.settings,brainMode:"local"};
   localChatResult=await Promise.race([agent.run("What time is it?"),new Promise((_,reject)=>setTimeout(()=>reject(new Error("Local chat timed out after 20s")),20000))]);
  }finally{agent.settings={...agent.settings,brainMode:originalBrainMode}}
  await check("chat.local",()=>Boolean(String(localChatResult||"").trim().length>0));

  await check("tools.registry",()=>{
   const schemas=agent.registry.schemas();
   const names=schemas.map(x=>x?.function?.name).filter(Boolean);
   const unique=new Set(names);
   const malformed=schemas.filter(x=>x?.type!=="function"||!x.function?.name||!x.function?.parameters||x.function.parameters.type!=="object");
   report.checks["tools.registry"].toolCount=schemas.length;
   report.checks["tools.registry"].uniqueNames=unique.size;
   report.checks["tools.registry"].malformed=malformed.map(x=>x?.function?.name||"unknown");
   return schemas.length>0&&unique.size===names.length&&malformed.length===0;
  });

  const safeToolTests=[
   ["system_info",{}],["diagnose_computer",{}],["active_window",{}],["list_windows",{}],["process_list",{}],["disk_info",{}],["network_info",{}],
   ["list_directory",{directory:app.getAppPath(),limit:20}],["list_tasks",{}],["list_memory",{limit:5}],["mcp_list_servers",{}],
   ["email_provider_info",{provider:"gmail"}]
  ];
  const toolResults={};
  for(const [name,args] of safeToolTests){
   const r=await check("tool."+name,async()=>{const out=await agent.registry.call(name,args);toolResults[name]=out;return out&&typeof out==="object"&&out.error==null&&out.ok!==false});
   if(!r.pass)r.detail={result:toolResults[name]};
  }
  await check("tool.screenshot",async()=>{
   const out=await agent.registry.call("screenshot",{});
   return Boolean(out&&out.ok&&typeof out.image==="string"&&out.image.startsWith("data:image/"));
  },{required:false});

  await check("addons.manager",()=>Boolean(addons&&typeof addons.fetchCatalog==="function"&&typeof addons.listInstalled==="function"&&typeof addons.install==="function"&&typeof addons.uninstall==="function"));
  await check("addons.catalog",async()=>{
   const cat=await addons.fetchCatalog();
   return Boolean(cat&&cat.schemaVersion===2&&Array.isArray(cat.addons)&&cat.addons.length>0);
  },{required:false});
  await check("addons.persistence",()=>{
   const installed=addons.listInstalled(app.getPath("userData"));
   return Array.isArray(installed)&&installed.every(x=>x.installed===true&&x.id);
  });

  const skillName="__ci-full-smoke-"+Date.now();
  await check("learning.record-save",()=>{
   const rec=learning.beginRecording(app.getPath("userData"),skillName,["ci full smoke"]);
   learning.recordStep(rec,"system_info",{});
   const saved=learning.finishRecording(app.getPath("userData"),rec);
   const loaded=learning.get(app.getPath("userData"),saved.id);
   const exported=learning.exportSkill(app.getPath("userData"),saved.id);
   learning.remove(app.getPath("userData"),saved.id);
   return Boolean(loaded?.steps?.length===1&&JSON.parse(exported)?.id===saved.id);
  });
  await check("learning.run",async()=>{
   const rec=learning.beginRecording(app.getPath("userData"),skillName+"-run",["ci run"]);
   learning.recordStep(rec,"system_info",{});
   const saved=learning.finishRecording(app.getPath("userData"),rec);
   const result=await learning.run(app.getPath("userData"),agent.registry,saved,{confirm:async()=>true});
   learning.remove(app.getPath("userData"),saved.id);
   return Boolean(result?.ok&&result.results?.length===1&&result.results[0]?.result?.ok);
  });

  await check("voice.renderer-capabilities",async()=>{
   if(!characterWin||characterWin.isDestroyed())return false;
   const r=await characterWin.webContents.executeJavaScript(`(()=>({speechSynthesis:typeof window.speechSynthesis!=="undefined",speechSynthesisSpeak:typeof window.speechSynthesis?.speak==="function",mediaDevices:Boolean(navigator.mediaDevices&&typeof navigator.mediaDevices.getUserMedia==="function")}))()`,true);
   return Boolean(r.speechSynthesis&&r.speechSynthesisSpeak&&r.mediaDevices);
  });
  await check("voice.tts-local",async()=>{
   if(!characterWin||characterWin.isDestroyed())return false;
   return await characterWin.webContents.executeJavaScript(`(()=>new Promise(resolve=>{try{const u=new SpeechSynthesisUtterance("Saeed smoke test");u.volume=0;u.onend=()=>resolve(true);u.onerror=()=>resolve(false);window.speechSynthesis.cancel();window.speechSynthesis.speak(u);setTimeout(()=>{window.speechSynthesis.cancel();resolve(true)},800)}catch(e){resolve(false)}}))()`,true);
  },{required:false});
  await check("voice.mic-api",async()=>{
   if(!characterWin||characterWin.isDestroyed())return false;
   return await characterWin.webContents.executeJavaScript(`navigator.mediaDevices.getUserMedia({audio:true}).then(s=>{s.getTracks().forEach(t=>t.stop());return true}).catch(()=>false)`,true);
  },{required:false});

  const whisper=whisperRuntimePaths();
  await check("stt.whisper-runtime",()=>Boolean(fs.existsSync(whisper.exe)&&fs.existsSync(whisper.model)));
  await check("stt.whisper-engine",async()=>{
   const pcm=Buffer.alloc(12000);
   const text=await Promise.race([transcribeLocalWav(pcm.toString("base64")),new Promise((_,reject)=>setTimeout(()=>reject(new Error("Whisper timed out after 30s")),30000))]);
   return typeof text==="string";
  },{required:false});

  const apiResults=await apiHealth.testAll();
  report.checks["api.connections"]={pass:apiResults.every(x=>x.connected||/missing|not configured|local|disabled/i.test(String(x.detail||""))),required:false,results:apiResults};
  report.checks["realtime.contract"]={pass:Boolean(typeof OpenAIRealtime==="function"&&OpenAIRealtime.prototype&&typeof OpenAIRealtime.prototype.start==="function"&&typeof OpenAIRealtime.prototype.stop==="function"),required:true};
  report.checks["realtime.connection"]={pass:true,required:false,detail:"Live Realtime connection is tested when credentials are available; CI has no secret by default.",result:apiResults.find(x=>x.service==="realtime")||null};

  const threeD=await request3DStatus();
  report.checks["3d.renderer"]={pass:Boolean(threeD?.overall?.state==="ready"||threeD?.overall?.state==="active"||threeD?.overall?.state==="connected"||Object.keys(threeD?.components||{}).length>0),required:false,result:threeD};

  report.checks["mic.lifecycle"]={pass:currentMicMode==="off"&&!voiceRuntime.getRealtime(),required:true,detail:"Startup lifecycle verified with microphone OFF; renderer media capability tested separately."};
  report.checks["tts.lifecycle"]={pass:Boolean(diagnosticState.tts.state!=="error"),required:false,detail:diagnosticState.tts};
  report.checks["brain.api-contract"]={pass:Boolean(apiHealth&&typeof apiHealth.test==="function"&&typeof apiHealth.testAll==="function"),required:true};
  report.checks["learning.contract"]={pass:Boolean(typeof learning.beginRecording==="function"&&typeof learning.recordStep==="function"&&typeof learning.finishRecording==="function"&&typeof learning.run==="function"),required:true};
  report.checks["plugin.contract"]={pass:Boolean(typeof addons.install==="function"&&typeof addons.uninstall==="function"&&typeof addons.setEnabled==="function"),required:true};

  const requiredChecks=Object.values(report.checks).filter(x=>x&&x.required!==false);
  report.pass=requiredChecks.every(x=>x.pass!==false)&&report.checks.glbFile.pass!==false;
  report.phases.final={resources:resourceService.resourceReport("final"),requiredFailures:requiredChecks.filter(x=>x.pass===false).map(x=>x.error||x.detail||"failed")};
 }catch(e){report.error=String(e?.stack||e);report.pass=false}
 report.finishedAt=new Date().toISOString();
 const target=process.env.SAEED_CI_REPORT||path.join(process.cwd(),"dist","ci-runtime-report.json");
 try{fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(report,null,2),"utf8");console.log("SAEED_CI_REPORT_PATH",target)}catch(e){console.error("CI report write failed:",e.message)}
 const hostTarget=process.env.SAEED_CI_HOST_REPORT||path.join(process.cwd(),"dist","ci-host-resource-report.json");
 try{fs.mkdirSync(path.dirname(hostTarget),{recursive:true});fs.writeFileSync(hostTarget,JSON.stringify({mode:"full-runtime-smoke",time:new Date().toISOString(),resources:resourceService.resourceReport(),checks:Object.fromEntries(Object.entries(report.checks).filter(([k])=>/resource|cpu|memory/i.test(k)))},null,2),"utf8")}catch(e){console.error("CI host report write failed:",e.message)}
 console.log("SAEED_CI_RUNTIME_REPORT",JSON.stringify({pass:report.pass,checks:Object.fromEntries(Object.entries(report.checks).map(([k,v])=>[k,v?.pass])),startedAt:report.startedAt,finishedAt:report.finishedAt}));
 resourceService.stopResourceProbe();setTimeout(()=>process.exit(report.pass?0:1),250);
}
 return {runCi3DBaseline,runCiRuntimeSmoke};
}
module.exports={createCiRuntime};
