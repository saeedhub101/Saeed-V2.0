const fs=require("fs"),path=require("path");

function createCiE2E(deps={}){
 const {app,getCharacterWindow,getChatHost,getAgent,getTray,getBrainActive,ensureBrain,releaseBrainIfIdle,setMicMode,setVoiceMuted,getVoiceMuted,characterHost,getVoiceHost,getPerformanceWindow,showPerformance:depsShowPerformance}=deps;
 const report={startedAt:new Date().toISOString(),checks:{},phases:{}};
 const out=process.env.SAEED_CI_E2E_REPORT||path.join(process.cwd(),"dist","ci-e2e-report.json");
 const started=Date.now();
 const check=async(name,fn,{required=true,timeoutMs=30000}={})=>{
  const t=Date.now();
  try{const v=await Promise.race([Promise.resolve().then(fn),new Promise(resolve=>setTimeout(()=>resolve({pass:false,error:"Check timed out after "+timeoutMs+" ms"}),timeoutMs))]);const pass=v===true||v?.pass===true;report.checks[name]={pass,required,latencyMs:Date.now()-t,detail:typeof v==="object"&&v&&!Array.isArray(v)?v:undefined};return report.checks[name]}
  catch(e){report.checks[name]={pass:false,required,latencyMs:Date.now()-t,error:String(e?.stack||e)};return report.checks[name]}
 };
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const chatWindow=()=>getChatHost?.().getChatWindow?.()||null;
 const visible=w=>Boolean(w&&!w.isDestroyed()&&w.isVisible());
 async function run(){
  try{
   report.phases.startup={};
   await check("startup.character-visible",()=>visible(getCharacterWindow?.()));
   await check("startup.tray",()=>Boolean(getTray?.()));
   await check("startup.mic-off",()=>String(getVoiceHost?.()?.getCurrentMicMode?.()||"off")==="off");
   await check("startup.brain-off",()=>!Boolean(getBrainActive?.()));

   await check("performance.open-character-controller",async()=>{if(typeof depsShowPerformance!=="function")return false;await depsShowPerformance();const started=Date.now();let w=getPerformanceWindow?.();while(Date.now()-started<8000){w=getPerformanceWindow?.();if(visible(w)){const ready=await w.webContents.executeJavaScript('(async()=>{try{const r=await window.saeed.getCharacterController();return Boolean(r?.characterLoaded&&r?.retargeting?.boneCount>=6)}catch{return false}})()',true);if(ready)break;}await wait(250)}if(!visible(w))return false;return await w.webContents.executeJavaScript('Boolean(document.querySelector("#tab-character")&&document.querySelector("#characterPlayMotion")&&document.querySelector("#characterApplyPose")&&document.querySelector("#motionEditorSave")&&document.querySelector("#rigApply"))',true)});
   await check("performance.no-t-pose-after-launch",async()=>{const w=getPerformanceWindow?.();if(!visible(w))return false;const r=await w.webContents.executeJavaScript('(async()=>{let last=null;for(let i=0;i<20;i++){try{const x=await window.saeed.characterController({action:"status"});if(x?.status?.characterLoaded&&x?.status?.retargeting?.boneCount>=6)return x.status;last=x?.status||x; }catch(e){last={error:e.message}} await new Promise(r=>setTimeout(r,150));}return last})()',true);return {pass:Boolean(r?.characterLoaded&&r?.tPose&&r.tPose.isTPose===false&&r?.retargeting?.boneCount>=6),characterLoaded:r?.characterLoaded,tPose:r?.tPose,requiredRig:r?.retargeting?.bones||{},error:r?.error||null}});
   await check("performance.control-bone-pose",async()=>{const w=getPerformanceWindow?.();if(!visible(w))return false;const r=await w.webContents.executeJavaScript('(async()=>{const j=document.getElementById("characterJoint"),x=document.getElementById("characterPoseX"),y=document.getElementById("characterPoseY"),z=document.getElementById("characterPoseZ"),b=document.getElementById("characterApplyPose");j.value="rightUpperArm";x.value="0";y.value="18";z.value="0";b.click();await new Promise(r=>setTimeout(r,300));return await window.saeed.getCharacterController()})()',true);const p=r?.pose?.rightUpperArm,actual=r?.actualBones?.rightUpperArm?.rotation;return {pass:Boolean(p&&actual&&Math.abs(Number(p.y||0)-Math.PI/10)<0.05&&r?.characterLoaded&&r?.tPose?.isTPose===false),pose:p,actualBone:actual,tPose:r?.tPose}});
   await check("performance.play-stop-motion",async()=>{const w=getPerformanceWindow?.();if(!visible(w))return false;const r=await w.webContents.executeJavaScript('(async()=>{const m=document.getElementById("characterMotion"),p=document.getElementById("characterPlayMotion"),s=document.getElementById("characterStopMotion");m.value="wave";p.click();await new Promise(r=>setTimeout(r,400));const playing=await window.saeed.getCharacterController();s.click();await new Promise(r=>setTimeout(r,200));const stopped=await window.saeed.getCharacterController();return {playing,stopped}})()',true);return {pass:Boolean(r?.playing?.active?.length&&!(r?.stopped?.active?.length)),playing:r?.playing?.active?.length||0,stopped:r?.stopped?.active?.length||0}});
   await check("performance.create-edit-delete-motion",async()=>{const w=getPerformanceWindow?.();if(!visible(w))return false;const r=await w.webContents.executeJavaScript('(async()=>{const id="ciTestMotion";document.getElementById("motionEditorId").value=id;document.getElementById("motionEditorDuration").value="1";document.getElementById("motionEditorLayer").value="arms";document.getElementById("motionEditorLoop").value="false";document.getElementById("motionEditorKeyframes").value=JSON.stringify([{time:0,pose:{rightUpperArm:{y:0.4}}},{time:0.5,pose:{rightUpperArm:{y:1.0}}},{time:1,pose:{rightUpperArm:{y:0.4}}}]);document.getElementById("motionEditorSave").click();await new Promise(r=>setTimeout(r,350));const saved=await window.saeed.characterController({action:"listMotions"});document.getElementById("motionEditorDelete").click();await new Promise(r=>setTimeout(r,350));const after=await window.saeed.characterController({action:"listMotions"});return {saved:saved?.motions?.some(x=>x.id===id),deleted:!after?.motions?.some(x=>x.id===id)}})()',true);return {pass:Boolean(r?.saved&&r?.deleted),saved:r?.saved,deleted:r?.deleted}});
   await check("performance.rig-auto-map-required",async()=>{const w=getPerformanceWindow?.();if(!visible(w))return false;const r=await w.webContents.executeJavaScript('(async()=>{document.querySelector("[data-tab=rig]")?.click();await new Promise(r=>setTimeout(r,300));document.getElementById("rigAuto")?.click();await new Promise(r=>setTimeout(r,400));return await window.saeed.getCharacterController()})()',true);const b=r?.retargeting?.bones||{};const req=["hips","head","leftUpperArm","rightUpperArm","leftThigh","rightThigh"];return {pass:req.every(k=>Boolean(b[k]))&&r?.characterLoaded&&r?.tPose?.isTPose===false,missing:req.filter(k=>!b[k]),characterLoaded:r?.characterLoaded,tPose:r?.tPose}});
   await check("performance.all-registered-motions-move-bones",async()=>{const w=getPerformanceWindow?.();if(!visible(w))return false;const r=await w.webContents.executeJavaScript('(async()=>{const api=window.saeed;const before=await api.getCharacterController();const motions=before?.motions||[];const initialTPose=before?.tPose?.isTPose;const results=[];for(const id of motions){if(id==="idle")continue;await api.characterController({action:"play",motion:id,options:{duration:0.8,speed:1,intensity:1,loop:false}});await new Promise(r=>setTimeout(r,180));const during=await api.getCharacterController();const active=Boolean(during?.active?.some(x=>x.id===id));const changed=Object.keys(before?.actualBones||{}).some(k=>{const a=before.actualBones[k]?.rotation,b=during.actualBones?.[k]?.rotation;if(!a||!b)return false;return Math.abs((Number(a.x)||0)-(Number(b.x)||0))>.008||Math.abs((Number(a.y)||0)-(Number(b.y)||0))>.008||Math.abs((Number(a.z)||0)-(Number(b.z)||0))>.008});results.push({id,active,changed});await api.characterController({action:"stopAll"});await new Promise(r=>setTimeout(r,80));}return {motions:motions.length,results,initialTPose}})()',true);const failed=(r?.results||[]).filter(x=>!x.active||!x.changed);return {pass:Boolean(r?.motions)&&failed.length===0&&r?.initialTPose===false,motions:r?.motions||0,failed,initialTPose:r?.initialTPose}});await check("performance.close",async()=>{const w=getPerformanceWindow?.();if(w&&!w.isDestroyed())w.close();await wait(300);return !visible(getPerformanceWindow?.())});

   await check("chat.open",async()=>{await getChatHost().showChat();await wait(800);return visible(chatWindow())});
   await check("chat.local-time",async()=>{
    const w=chatWindow();if(!w)return false;
    const result=await w.webContents.executeJavaScript('(async()=>{try{await window.saeed.clearHistory()}catch{};const input=document.getElementById("input"),send=document.getElementById("send"),messages=document.getElementById("messages");messages.innerHTML="";input.value="What is the local time?";send.click();const started=Date.now();while(Date.now()-started<20000){const a=[...document.querySelectorAll("#messages .assistant")].map(x=>x.textContent.trim()).filter(Boolean);if(a.length)return a[a.length-1];await new Promise(r=>setTimeout(r,250));}return ""})()',true);
    const text=String(result||"").trim();
    return {pass:Boolean(text),responseText:text};
   });

   await check("brain.intent-open-my-computer",async()=>{
    const agent=await ensureBrain?.();if(!agent)return false;
    const events=[];const old=agent.onEvent;agent.onEvent=e=>{events.push(e);old?.(e)};
    const result=await agent.run("Open my computer");
    const route=events.find(e=>String(e?.stage||"").toUpperCase()==="BRAIN ROUTE");
    return Boolean(String(result||"").trim())&&String(route?.message||"").includes("local");
   });
   await check("brain.intent-api-escalation",async()=>{
    const agent=await ensureBrain?.();if(!agent)return false;
    const events=[];const old=agent.onEvent;agent.onEvent=e=>{events.push(e);old?.(e)};
    const result=await agent.run("Open Excel and then book me a ticket");
    const api=events.find(e=>String(e?.stage||"").toUpperCase()==="BRAIN API");
    return Boolean(api)&&String(result||"").trim().length>0;
   },{required:true});

   await check("chat.ui-response-visible",async()=>{
    const w=chatWindow();if(!w)return false;
    return await w.webContents.executeJavaScript('Boolean([...document.querySelectorAll("#messages .assistant")].some(x=>x.textContent.trim()))',true);
   });

   await check("voice.renderer-capabilities",async()=>{
    const w=getCharacterWindow?.();if(!w)return false;
    const r=await w.webContents.executeJavaScript('(()=>({speechSynthesis:typeof window.speechSynthesis!=="undefined",speak:typeof window.speechSynthesis?.speak==="function",mediaDevices:Boolean(navigator.mediaDevices&&typeof navigator.mediaDevices.getUserMedia==="function")}))()',true);
    return Boolean(r.speechSynthesis&&r.speak&&r.mediaDevices);
   });
   await check("voice.output-device-capability",async()=>{
    const w=getCharacterWindow?.();if(!w)return false;
    const r=await w.webContents.executeJavaScript('(()=>new Promise(async resolve=>{try{if(!navigator.mediaDevices?.enumerateDevices)return resolve({available:false,reason:"enumerateDevices unavailable"});const devices=await navigator.mediaDevices.enumerateDevices();const outputs=devices.filter(d=>d.kind==="audiooutput").map(d=>({kind:d.kind,label:d.label||"",deviceId:Boolean(d.deviceId)}));resolve({available:true,outputDeviceCount:outputs.length,outputs,defaultOutputPresent:outputs.some(d=>d.deviceId)});}catch(e){resolve({available:false,reason:String(e?.name||e?.message||e)})}}))()',true);
    return {pass:true,hardwareOutputAvailable:Boolean(r?.available&&r?.outputDeviceCount>0),environmentLimited:!(r?.available&&r?.outputDeviceCount>0),detail:r};
   },{required:false});
   await check("voice.tts-local-output",async()=>{
    const w=getCharacterWindow?.();if(!w)return false;
    return await w.webContents.executeJavaScript(`(()=>new Promise(async resolve=>{try{
      const synth=window.speechSynthesis;
      if(!synth)return resolve({pass:false,audioStarted:false,error:"speechSynthesis unavailable"});
      const sleep=ms=>new Promise(r=>setTimeout(r,ms));
      const devices=await navigator.mediaDevices?.enumerateDevices?.().catch(()=>[]);
      const outputs=(devices||[]).filter(d=>d.kind==="audiooutput");
      if(!outputs.length)return resolve({pass:true,audioStarted:false,speaking:false,ended:false,voiceCount:synth.getVoices().length,environmentLimited:true,reason:"no audio output device available"});
      const waitForVoices=async()=>{let v=synth.getVoices();if(v.length)return v;await new Promise(r=>{let done=false;const f=()=>{if(done)return;done=true;synth.removeEventListener("voiceschanged",f);r()};synth.addEventListener("voiceschanged",f);setTimeout(f,1000)});return synth.getVoices()};
      let voices=await waitForVoices();
      if(!voices.length)return resolve({pass:true,audioStarted:false,speaking:false,ended:false,voiceCount:0,environmentLimited:true,reason:"no voices available"});
      let attempt=0,started=false,ended=false,done=false,lastError="";
      const finish=v=>{if(done)return;done=true;try{synth.cancel()}catch{};resolve(v)};
      const speakAttempt=async()=>{
        attempt++;
        try{synth.cancel()}catch{}
        await sleep(250);
        voices=await waitForVoices();
        const u=new SpeechSynthesisUtterance("Saeed voice smoke test");u.volume=1;
        u.onstart=()=>{started=true};
        u.onend=()=>{ended=true;finish({pass:true,audioStarted:true,speaking:false,ended:true,voiceCount:voices.length,attempt})};
        u.onerror=e=>{lastError=String(e?.error||"speech error");if(lastError==="interrupted"&&attempt<2&&!started){setTimeout(()=>speakAttempt(),300);return}finish({pass:false,audioStarted:started,speaking:Boolean(synth.speaking),ended,voiceCount:voices.length,error:lastError,attempt})};
        try{synth.speak(u)}catch(e){lastError=String(e);if(attempt<2&&!started){setTimeout(()=>speakAttempt(),300);return}finish({pass:false,audioStarted:started,error:lastError,voiceCount:voices.length,attempt})}
      };
      await speakAttempt();
      setTimeout(()=>{if(done)return;finish({pass:started,audioStarted:started,speaking:Boolean(synth.speaking),ended,voiceCount:voices.length,error:lastError||undefined,attempt,reason:started?"speech started":"speech start event not observed"})},12000);
    }catch(e){resolve({pass:false,audioStarted:false,error:String(e)})}}))()`,true);
   },{required:true,timeoutMs:16000});
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
    if(!hardwareAvailable&&mode==="off")return {pass:!chatWindow(),environmentLimited:true,chatClosed:!chatWindow(),brainBefore:before,brainAfter:after,micMode:mode,reason:"microphone unavailable; lifecycle check skipped"};
    return {pass:!chatWindow()&&after,chatClosed:!chatWindow(),brainBefore:before,brainAfter:after,micMode:mode};
   });

   await check("mic-off-releases-brain-after-chat-closed",async()=>{
    await setMicMode("off");await wait(1500);
    const active=Boolean(getBrainActive?.());
    return {pass:!active,chatClosed:!chatWindow(),micMode:String(getVoiceHost?.()?.getCurrentMicMode?.()||"off"),brainActive:active};
   });

   await check("hide-saeed-keeps-tray",async()=>{
    characterHost.hideCharacter();await wait(500);
    return {pass:!visible(getCharacterWindow?.())&&Boolean(getTray?.()),characterVisible:visible(getCharacterWindow?.()),tray:Boolean(getTray?.())};
   });

   await check("show-saeed-restores",async()=>{
    await characterHost.showCharacter();await wait(800);
    return {pass:visible(getCharacterWindow?.())&&Boolean(getTray?.()),characterVisible:visible(getCharacterWindow?.()),tray:Boolean(getTray?.())};
   });

   await check("idle-final",async()=>{await wait(1000);return {pass:Boolean(getCharacterWindow?.())}});
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
