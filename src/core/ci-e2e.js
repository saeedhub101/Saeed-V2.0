const fs=require("fs"),path=require("path");

function createCiE2E(deps={}){
 const {app,getCharacterWindow,getChatHost,getAgent,getTray,getBrainActive,ensureBrain,releaseBrainIfIdle,setMicMode,setVoiceMuted,getVoiceMuted,characterHost,getVoiceHost}=deps;
 const report={startedAt:new Date().toISOString(),checks:{},phases:{},resources:[]};
 const out=process.env.SAEED_CI_E2E_REPORT||path.join(process.cwd(),"dist","ci-e2e-report.json");
 const started=Date.now();
 const check=async(name,fn,{required=true,timeoutMs=30000}={})=>{
  const t=Date.now();
  try{const v=await Promise.race([Promise.resolve().then(fn),new Promise(resolve=>setTimeout(()=>resolve({pass:false,error:"Check timed out after "+timeoutMs+" ms"}),timeoutMs))]);const pass=v===true||v?.pass===true;report.checks[name]={pass,required,latencyMs:Date.now()-t,detail:typeof v==="object"&&v&&!Array.isArray(v)?v:undefined};return report.checks[name]}
  catch(e){report.checks[name]={pass:false,required,latencyMs:Date.now()-t,error:String(e?.stack||e)};return report.checks[name]}
 };
 const metrics=label=>{
  const rows=app.getAppMetrics().map(m=>({pid:m.pid,type:m.type,name:m.name||"",cpuPercent:+((m.cpu?.percentCPUUsage||0)).toFixed(2),workingSetMB:+((m.memory?.workingSetSize||0)/1024).toFixed(1),privateMB:+((m.memory?.privateBytes||0)/1024).toFixed(1)}));
  const totalWorkingSetMB=+rows.reduce((n,r)=>n+(r.workingSetMB||0),0).toFixed(1);
  const totalPrivateMB=+rows.reduce((n,r)=>n+(r.privateMB||0),0).toFixed(1);
  report.resources.push({time:new Date().toISOString(),label,processes:rows,totalWorkingSetMB,totalPrivateMB});
  return {processes:rows,totalWorkingSetMB,totalPrivateMB};
 };
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const chatWindow=()=>getChatHost?.().getChatWindow?.()||null;
 const visible=w=>Boolean(w&&!w.isDestroyed()&&w.isVisible());
 async function run(){
  try{
   report.phases.startup={idleStart:metrics("startup-idle-start")};
   await wait(10000);
   report.phases.startup.idle10s=metrics("idle-10s");
   await check("startup.glb-file",()=>{const p=path.join(app.getAppPath(),"assets","Saeed_AI-3D.glb");return {pass:fs.existsSync(p)&&fs.statSync(p).size>1024,path:p,size:fs.existsSync(p)?fs.statSync(p).size:0}});
   await check("startup.glb-rendered",async()=>{const w=getCharacterWindow?.();if(!w)return false;const s=await w.webContents.executeJavaScript(`(()=>{try{return window.saeedAvatar?.get3DStatus?.()||null}catch(e){return {error:String(e)}}})()`,true);return {pass:Boolean(s?.overall?.state==="ready"&&s?.components?.sceneContent?.state==="rendered"),status:s}});
   await check("startup.character-visible",()=>visible(getCharacterWindow?.()));
   await check("startup.tray",()=>Boolean(getTray?.()));
   await check("startup.mic-off",()=>String(getVoiceHost?.()?.getCurrentMicMode?.()||"off")==="off");
   await check("startup.brain-off",()=>!Boolean(getBrainActive?.()));

   await check("chat.open",async()=>{await getChatHost().showChat();await wait(800);return visible(chatWindow())});
   await check("chat.local-time",async()=>{
    const w=chatWindow();if(!w)return false;
    const result=await w.webContents.executeJavaScript('(async()=>{try{await window.saeed.clearHistory()}catch{};const input=document.getElementById("input"),send=document.getElementById("send"),messages=document.getElementById("messages");messages.innerHTML="";input.value="What is the local time?";send.click();const started=Date.now();while(Date.now()-started<20000){const a=[...document.querySelectorAll("#messages .assistant")].map(x=>x.textContent.trim()).filter(Boolean);if(a.length)return a[a.length-1];await new Promise(r=>setTimeout(r,250));}return ""})()',true);
    const text=String(result||"").trim();
    return {pass:Boolean(text),responseText:text};
   });
   report.phases.chat={afterLocalTime:metrics("chat-local-time")};

   await check("brain.intent-open-my-computer",async()=>{
    const agent=getAgent();if(!agent)return false;
    const events=[];const old=agent.onEvent;agent.onEvent=e=>{events.push(e);old?.(e)};
    const result=await agent.run("Open my computer");
    const route=events.find(e=>String(e?.stage||"").toUpperCase()==="BRAIN ROUTE");
    return Boolean(String(result||"").trim())&&String(route?.message||"").includes("local");
   });
   await check("brain.intent-api-escalation",async()=>{
    const agent=getAgent();if(!agent)return false;
    const events=[];const old=agent.onEvent;agent.onEvent=e=>{events.push(e);old?.(e)};
    const result=await agent.run("Open Excel and then book me a ticket");
    const api=events.find(e=>String(e?.stage||"").toUpperCase()==="BRAIN API");
    return Boolean(api)&&String(result||"").trim().length>0;
   },{required:true});
   report.phases.brain={afterRouting:metrics("brain-routing")};

   await check("chat.ui-response-visible",async()=>{
    const w=chatWindow();if(!w)return false;
    return await w.webContents.executeJavaScript('Boolean([...document.querySelectorAll("#messages .assistant")].some(x=>x.textContent.trim()))',true);
   });

   await check("voice.renderer-capabilities",async()=>{
    const w=getCharacterWindow?.();if(!w)return false;
    const r=await w.webContents.executeJavaScript('(()=>({speechSynthesis:typeof window.speechSynthesis!=="undefined",speak:typeof window.speechSynthesis?.speak==="function",mediaDevices:Boolean(navigator.mediaDevices&&typeof navigator.mediaDevices.getUserMedia==="function")}))()',true);
    return Boolean(r.speechSynthesis&&r.speak&&r.mediaDevices);
   });
   await check("voice.tts-local-output",async()=>{
    const w=getCharacterWindow?.();if(!w)return false;
    return await w.webContents.executeJavaScript('(()=>new Promise(resolve=>{try{const synth=window.speechSynthesis;if(!synth)return resolve({pass:false,audioStarted:false,error:"speechSynthesis unavailable"});const voices=synth.getVoices();const u=new SpeechSynthesisUtterance("Saeed voice smoke test");u.volume=1;let started=false,done=false;const finish=v=>{if(done)return;done=true;try{synth.cancel()}catch{};resolve(v)};u.onstart=()=>{started=true};u.onend=()=>finish({pass:true,audioStarted:true,speaking:false,voiceCount:voices.length});u.onerror=e=>finish({pass:voices.length===0,audioStarted:false,speaking:Boolean(synth.speaking),voiceCount:voices.length,error:String(e?.error||"speech error"),environmentLimited:voices.length===0});try{synth.cancel();synth.speak(u)}catch(e){finish({pass:voices.length===0,audioStarted:false,error:String(e),voiceCount:voices.length,environmentLimited:voices.length===0})};setTimeout(()=>{if(done)return;const speaking=Boolean(synth.speaking);finish({pass:started||speaking||voices.length===0,audioStarted:started,speaking,voiceCount:voices.length,environmentLimited:voices.length===0})},2000)}catch(e){resolve({pass:false,audioStarted:false,error:String(e)})}}))()',true);
   },{required:true,timeoutMs:10000});

   await check("voice.mic-device-capability",async()=>{
    const w=getCharacterWindow?.();if(!w)return false;
    const r=await w.webContents.executeJavaScript('(()=>new Promise(resolve=>{if(!navigator.mediaDevices?.getUserMedia)return resolve({available:false,reason:"mediaDevices unavailable"});let done=false;const finish=v=>{if(done)return;done=true;resolve(v)};navigator.mediaDevices.getUserMedia({audio:true}).then(s=>{s.getTracks().forEach(t=>t.stop());finish({available:true})}).catch(e=>finish({available:false,reason:String(e?.name||e?.message||"permission/device error")}));setTimeout(()=>finish({available:false,reason:"timeout"}),5000)}))()',true);
    return {pass:true,hardwareMicrophoneAvailable:Boolean(r?.available),detail:r};
   },{required:false});

   await check("mute.text-still-visible",async()=>{
    const w=getCharacterWindow?.();if(!w)return false;
    await setVoiceMuted(true);
    w.webContents.send("agent:event",{type:"answer",text:"CI mute text test"});
    await wait(200);
    const visibleText=await w.webContents.executeJavaScript('(()=>{const b=document.getElementById("saeedMessageBubble"),t=document.getElementById("saeedMessageText");return {visible:Boolean(b&&!b.hidden),text:t?.textContent||""}})()',true);
    await setVoiceMuted(false);
    return Boolean(visibleText.visible&&visibleText.text.includes("CI mute text test"));
   });

   await check("chat.close-keeps-brain-when-mic-on",async()=>{
    const w=getCharacterWindow?.();let hardwareAvailable=false;if(w){try{hardwareAvailable=Boolean(await w.webContents.executeJavaScript("Boolean(navigator.mediaDevices?.getUserMedia)",true));}catch{}}
    if(hardwareAvailable){try{hardwareAvailable=Boolean(await w.webContents.executeJavaScript("navigator.mediaDevices.getUserMedia({audio:true}).then(s=>{s.getTracks().forEach(t=>t.stop());return true}).catch(()=>false)",true));}catch{hardwareAvailable=false}}
    await setMicMode("on");
    await wait(1200);
    const before=Boolean(getBrainActive?.());
    await getChatHost().closeChat();await wait(1200);
    const after=Boolean(getBrainActive?.());
    const mode=String(getVoiceHost?.()?.getCurrentMicMode?.()||"off");
    if(!hardwareAvailable&&mode==="off")return {pass:!chatWindow()&&before,environmentLimited:true,chatClosed:!chatWindow(),brainBefore:before,brainAfter:after,micMode:mode};
    return {pass:!chatWindow()&&after,chatClosed:!chatWindow(),brainBefore:before,brainAfter:after,micMode:mode};
   });
   report.phases.afterChatCloseMicOn=metrics("after-chat-close-mic-on");

   await check("mic-off-releases-brain-after-chat-closed",async()=>{
    await setMicMode("off");await wait(1500);
    const active=Boolean(getBrainActive?.());
    return {pass:!active,chatClosed:!chatWindow(),micMode:String(getVoiceHost?.()?.getCurrentMicMode?.()||"off"),brainActive:active};
   });
   report.phases.afterMicOff=metrics("after-mic-off");

   await check("hide-saeed-keeps-tray",async()=>{
    characterHost.hideCharacter();await wait(500);
    return {pass:!visible(getCharacterWindow?.())&&Boolean(getTray?.()),characterVisible:visible(getCharacterWindow?.()),tray:Boolean(getTray?.())};
   });
   report.phases.hidden=metrics("saeed-hidden");

   await check("show-saeed-restores",async()=>{
    await characterHost.showCharacter();await wait(800);
    return {pass:visible(getCharacterWindow?.())&&Boolean(getTray?.()),characterVisible:visible(getCharacterWindow?.()),tray:Boolean(getTray?.())};
   });
   report.phases.shown=metrics("saeed-shown");

   await check("idle-final",async()=>{await wait(10000);const p=metrics("idle-final-10s");return {pass:Array.isArray(p.processes)&&p.processes.length>0,processes:p}});
   report.finishedAt=new Date().toISOString();
   report.durationMs=Date.now()-started;
   const byPid={};for(const sample of report.resources)for(const p of sample.processes||[]) {const k=String(p.pid);const x=byPid[k]||(byPid[k]={pid:p.pid,type:p.type,name:p.name,maxWorkingSetMB:0,maxPrivateMB:0,maxCpuPercent:0,samples:0});x.maxWorkingSetMB=Math.max(x.maxWorkingSetMB,p.workingSetMB||0);x.maxPrivateMB=Math.max(x.maxPrivateMB,p.privateMB||0);x.maxCpuPercent=Math.max(x.maxCpuPercent,p.cpuPercent||0);x.samples++}report.processResourceSummary=Object.values(byPid);
   report.pass=Object.values(report.checks).filter(x=>x.required!==false).every(x=>x.pass);
  }catch(e){report.error=String(e?.stack||e);report.pass=false;report.finishedAt=new Date().toISOString()}
  try{fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2),"utf8")}catch(e){report.pass=false;report.error=String(e?.stack||e)}
  return report;
 }
 return{run};
}
module.exports={createCiE2E};
