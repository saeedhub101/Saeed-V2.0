const fs=require("fs"),path=require("path");

function createCiE2E(deps={}){
 const {app,getCharacterWindow,getChatHost,getAgent,getTray,getBrainActive,ensureBrain,releaseBrainIfIdle,setMicMode,setVoiceMuted,getVoiceMuted,characterHost,getVoiceHost}=deps;
 const report={startedAt:new Date().toISOString(),checks:{},phases:{},resources:[]};
 const out=process.env.SAEED_CI_E2E_REPORT||path.join(process.cwd(),"dist","ci-e2e-report.json");
 const started=Date.now();
 const check=async(name,fn,{required=true}={})=>{
  const t=Date.now();
  try{const v=await fn();const pass=v===true||v?.pass===true;report.checks[name]={pass,required,latencyMs:Date.now()-t,detail:typeof v==="object"&&v&&!Array.isArray(v)?v:undefined};return report.checks[name]}
  catch(e){report.checks[name]={pass:false,required,latencyMs:Date.now()-t,error:String(e?.stack||e)};return report.checks[name]}
 };
 const metrics=label=>{
  const rows=app.getAppMetrics().map(m=>({pid:m.pid,type:m.type,name:m.name||"",cpuPercent:+((m.cpu?.percentCPUUsage||0)).toFixed(2),workingSetMB:+((m.memory?.workingSetSize||0)/1024).toFixed(1),privateMB:+((m.memory?.privateBytes||0)/1024).toFixed(1)}));
  report.resources.push({time:new Date().toISOString(),label,processes:rows});
  return rows;
 };
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const chatWindow=()=>getChatHost?.().getChatWindow?.()||null;
 const visible=w=>Boolean(w&&!w.isDestroyed()&&w.isVisible());
 async function run(){
  try{
   report.phases.startup={idleStart:metrics("startup-idle-start")};
   await wait(10000);
   report.phases.startup.idle10s=metrics("idle-10s");
   await check("startup.character-visible",()=>visible(getCharacterWindow?.()));
   await check("startup.tray",()=>Boolean(getTray?.()));
   await check("startup.mic-off",()=>String(getVoiceHost?.()?.getCurrentMicMode?.()||"off")==="off");
   await check("startup.brain-off",()=>!Boolean(getBrainActive?.()));

   await check("chat.open",async()=>{await getChatHost().showChat();await wait(800);return visible(chatWindow())});
   await check("chat.local-time",async()=>{
    const w=chatWindow();if(!w)return false;
    const result=await w.webContents.executeJavaScript('(async()=>{const input=document.getElementById("input"),send=document.getElementById("send");input.value="What is the local time?";send.click();const started=Date.now();while(Date.now()-started<20000){const a=[...document.querySelectorAll("#messages .assistant")].map(x=>x.textContent.trim()).filter(Boolean);if(a.length)return a[a.length-1];await new Promise(r=>setTimeout(r,250));}return ""})()',true);
    return Boolean(String(result||"").trim());
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
    return await w.webContents.executeJavaScript('(()=>new Promise(resolve=>{try{const u=new SpeechSynthesisUtterance("Saeed voice smoke test");u.volume=1;let started=false;u.onstart=()=>{started=true};u.onend=()=>resolve(started);u.onerror=()=>resolve(false);window.speechSynthesis.cancel();window.speechSynthesis.speak(u);setTimeout(()=>{const ok=started||window.speechSynthesis.speaking;window.speechSynthesis.cancel();resolve(ok)},1500)}catch(e){resolve(false)}}))()',true);
   },{required:false});

   await check("voice.mic-device-capability",async()=>{
    const w=getCharacterWindow?.();if(!w)return false;
    const r=await w.webContents.executeJavaScript('(()=>new Promise(resolve=>{if(!navigator.mediaDevices?.getUserMedia)return resolve({available:false,reason:"mediaDevices unavailable"});let done=false;const finish=v=>{if(done)return;done=true;resolve(v)};navigator.mediaDevices.getUserMedia({audio:true}).then(s=>{s.getTracks().forEach(t=>t.stop());finish({available:true})}).catch(e=>finish({available:false,reason:String(e?.name||e?.message||"permission/device error")}));setTimeout(()=>finish({available:false,reason:"timeout"}),5000)}))()',true);
    return {pass:true,hardwareMicrophoneAvailable:Boolean(r?.available),detail:r};
   },{required:false});

   await check("mute.text-still-visible",async()=>{
    const w=getCharacterWindow?.();if(!w)return false;
    await setVoiceMuted(true);
    w.webContents.send("character:behavior",{type:"answer",text:"CI mute text test"});
    await wait(200);
    const visibleText=await w.webContents.executeJavaScript('(()=>{const b=document.getElementById("saeedMessageBubble"),t=document.getElementById("saeedMessageText");return {visible:Boolean(b&&!b.hidden),text:t?.textContent||""}})()',true);
    await setVoiceMuted(false);
    return Boolean(visibleText.visible&&visibleText.text.includes("CI mute text test"));
   });

   await check("chat.close-releases-brain",async()=>{
    await getChatHost().closeChat();await wait(1200);
    return {pass:!chatWindow()&&!Boolean(getBrainActive?.()),chatClosed:!chatWindow(),brainActive:Boolean(getBrainActive?.())};
   });
   report.phases.afterChatClose=metrics("after-chat-close");

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

   await check("idle-final",async()=>{await wait(10000);const p=metrics("idle-final-10s");return {pass:p.length>0,processes:p}});
   report.finishedAt=new Date().toISOString();
   report.durationMs=Date.now()-started;
   report.pass=Object.values(report.checks).filter(x=>x.required!==false).every(x=>x.pass);
  }catch(e){report.error=String(e?.stack||e);report.pass=false;report.finishedAt=new Date().toISOString()}
  try{fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2),"utf8")}catch(e){report.pass=false;report.error=String(e?.stack||e)}
  return report;
 }
 return{run};
}
module.exports={createCiE2E};
