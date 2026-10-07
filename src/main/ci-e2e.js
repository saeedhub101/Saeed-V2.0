const fs=require("fs"),path=require("path");

function createCiE2E(deps={}){
 const {app,getCharacterWindow,getChatHost,getAgent,getTray,getBrainActive,ensureBrain,releaseBrainIfIdle,setMicMode,setVoiceMuted,getVoiceMuted,characterHost,getVoiceHost,getPerformanceWindow,showPerformance:depsShowPerformance,getSettingsWindow,getAddonsWindow,getLearningWindow,getStatusWindow,getRestPoseEditorWindow,getNormalizeHumanoidRestPoseWindow,showSettings:depsShowSettings,showAddons:depsShowAddons,showLearning:depsShowLearning,showStatus:depsShowStatus,showRestPoseEditor:depsShowRestPoseEditor}=deps;
 const report={startedAt:new Date().toISOString(),checks:{},phases:{},suite:null};
 const suiteArg=String(process.env.SAEED_CI_E2E_SUITE||"all");
 const out=process.env.SAEED_CI_E2E_REPORT||path.join(process.cwd(),"dist",suiteArg==="all"?"ci-e2e-report.json":`ci-e2e-suite-${suiteArg}.json`);
 const started=Date.now();
 const suiteFor=name=>{if(suiteArg==="all")return true;const n=String(name);if(suiteArg==="1")return n.startsWith("startup.")||n.startsWith("performance.");if(suiteArg==="2")return n.startsWith("chat.")||n.startsWith("brain.")||n.startsWith("voice.")||n.startsWith("mute.")||n.startsWith("mic-");if(suiteArg==="3")return (n.startsWith("windows.")||n.startsWith("character.")||n.startsWith("hide-")||n.startsWith("show-")||n.startsWith("tray.")||n.startsWith("glb.")||n.startsWith("idle-final"))&&!n.startsWith("character.studio-")&&n!=="character.normalize-humanoid-rest-pose-window";if(suiteArg==="4")return n.startsWith("glbtest.");if(suiteArg==="5")return n.startsWith("character.studio-");if(suiteArg==="6")return n==="character.normalize-humanoid-rest-pose-window";return true};
 const {AsyncLocalStorage}=require("async_hooks");
 const checkContext=new AsyncLocalStorage();
 const trace=[];
 const active={name:null,startedAt:0,operation:null,operationStartedAt:0};
 const recordTrace=(event,detail={})=>{const item={at:new Date().toISOString(),elapsedMs:Date.now()-started,event,...detail};trace.push(item);if(trace.length>200)trace.shift();return item};
 const operation=async(name,fn,detail={})=>{
  const ctx=checkContext.getStore();
  const opStarted=Date.now();
  if(ctx){ctx.operation=String(name);ctx.operationStartedAt=opStarted}
  recordTrace("operation-start",{check:ctx?.name||active.name||null,operation:String(name),...detail});
  try{return await fn()}
  finally{
   recordTrace("operation-end",{check:ctx?.name||active.name||null,operation:String(name),elapsedMs:Date.now()-opStarted});
   if(ctx){ctx.operation=null}
  }
 };
 const execJs=async(w,script,opts)=>operation("webContents.executeJavaScript",()=>w.webContents.executeJavaScript(script,opts),{scriptPreview:String(script).replace(/\s+/g," ").slice(0,240)});
 const suite1Timeouts={
  "startup.character-visible":30000,
  "startup.tray":30000,
  "startup.mic-off":30000,
  "startup.brain-off":30000,
  "performance.open-character-controller":60000,
  "performance.all-tabs-functional":45000,
  "performance.control-real-bone":45000,
  "performance.procedural-motion-real-bone":60000,
  "performance.create-edit-delete-motion":60000,
  "performance.rig-auto-map":60000,
  "performance.all-registered-compatible-motions":120000,
  "performance.close":30000
 };
 const suite2Timeouts={
  "chat.open":30000,
  "chat.local-time":30000,
  "brain.intent-open-my-computer":45000,
  "brain.intent-api-escalation":45000,
  "chat.response-reaches-character-bubble":60000,
  "voice.chat-response-tts-chain":90000,
  "chat.ui-response-visible":30000,
  "voice.renderer-capabilities":30000,
  "voice.output-device-capability":30000,
  "voice.tts-local-output":90000,
  "voice.mic-device-capability":30000,
  "mute.text-still-visible":30000,
  "chat.close-keeps-brain-when-mic-on":45000,
  "mic-off-releases-brain-after-chat-closed":45000
 };
 const check=async(name,fn,{required=true,timeoutMs=30000}={})=>{
  if(!suiteFor(name))return {pass:true,required,skipped:true};
  const effectiveTimeoutMs=suite1Timeouts[name]||suite2Timeouts[name]||timeoutMs;
  const t=Date.now();
  const ctx={name,startedAt:t,operation:null,operationStartedAt:t,timedOut:false};
  active.name=name;active.startedAt=t;active.operation=null;active.operationStartedAt=t;
  recordTrace("check-start",{check:name,timeoutMs:effectiveTimeoutMs});
  let timer;
  const work=checkContext.run(ctx,()=>Promise.resolve().then(fn));
  const timeout=new Promise(resolve=>{timer=setTimeout(()=>{
   ctx.timedOut=true;
   const diagnostic={check:name,lastOperation:ctx.operation,lastOperationElapsedMs:ctx.operation?Date.now()-ctx.operationStartedAt:0,trace:trace.slice(-20)};
   recordTrace("check-timeout",{check:name,timeoutMs:effectiveTimeoutMs,lastOperation:diagnostic.lastOperation,lastOperationElapsedMs:diagnostic.lastOperationElapsedMs});
   resolve({pass:false,status:"TIMEOUT",error:"Check exceeded "+effectiveTimeoutMs+" ms; no subsequent check will start and this suite will stop.",diagnostic});
  },effectiveTimeoutMs)});
  try{
   const v=await Promise.race([work,timeout]);
   clearTimeout(timer);
   const pass=v===true||v?.pass===true;
   const detail=typeof v==="object"&&v&&!Array.isArray(v)?v:undefined;
   report.checks[name]={pass,required,latencyMs:Date.now()-t,status:v?.status||undefined,detail};
   recordTrace(pass?"check-pass":"check-fail",{check:name,status:v?.status||"FAILED",error:v?.error,diagnostic:v?.diagnostic});
   if(v?.status==="TIMEOUT"){
    report.abortReason={type:"CHECK_TIMEOUT",check:name,timeoutMs:effectiveTimeoutMs,diagnostic:v.diagnostic};
    throw Object.assign(new Error("E2E check timeout: "+name),{code:"E2E_CHECK_TIMEOUT",check:name,diagnostic:v.diagnostic});
   }
   return report.checks[name];
  }catch(e){
   clearTimeout(timer);
   if(e?.code==="E2E_CHECK_TIMEOUT")throw e;
   const diagnostic={check:name,lastOperation:ctx.operation,lastOperationElapsedMs:ctx.operation?Date.now()-ctx.operationStartedAt:0,trace:trace.slice(-20)};
   report.checks[name]={pass:false,required,latencyMs:Date.now()-t,status:"ERROR",error:String(e?.stack||e),diagnostic};
   recordTrace("check-error",{check:name,error:String(e?.message||e)});
   return report.checks[name];
  }finally{
   if(active.name===name){active.name=null;active.operation=null}
  }
 };
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const chatWindow=()=>getChatHost?.().getChatWindow?.()||null;
 const visible=w=>Boolean(w&&!w.isDestroyed()&&w.isVisible());
 async function run(){
  report.suite=suiteArg;
  try{
   report.phases.startup={};
   await check("startup.character-visible",()=>visible(getCharacterWindow?.()));
   await check("startup.tray",()=>Boolean(getTray?.()));
   await check("startup.mic-off",()=>String(getVoiceHost?.()?.getCurrentMicMode?.()||"off")==="off");
   await check("startup.brain-off",()=>!Boolean(getBrainActive?.()));

   await check("performance.open-character-controller",async()=>{if(typeof depsShowPerformance!=="function")return false;await depsShowPerformance();const started=Date.now();let w=getPerformanceWindow?.();while(Date.now()-started<25000){w=getPerformanceWindow?.();if(visible(w)){const ready=await execJs(w,'(async()=>{try{const r=await window.saeed.character.getCharacterController();return Boolean(r?.characterLoaded)}catch{return false}})()',true);if(ready)break;}await wait(250)}if(!visible(w))return false;return await execJs(w,'Boolean(document.querySelector("#tab-character")&&document.querySelector("#characterPlayMotion")&&document.querySelector("#characterApplyPose")&&document.querySelector("#motionEditorSave")&&document.querySelector("#rigApply"))',true)});

   await check("performance.all-tabs-functional",async()=>{const w=getPerformanceWindow?.();if(!visible(w))return false;const r=await execJs(w,'(()=>{const ids=[...document.querySelectorAll("nav button[data-tab]")].map(x=>x.dataset.tab);const results=ids.map(id=>{const b=document.querySelector("nav button[data-tab=\\\""+id+"\\\"]");b?.click();const panel=document.getElementById("tab-"+id);return {id,button:Boolean(b),panel:Boolean(panel),visible:Boolean(panel&&!panel.hidden&&getComputedStyle(panel).display!=="none")}});return {pass:results.length>=9&&results.every(x=>x.button&&x.panel),tabs:results}})()',true);return r});

   await check("performance.control-real-bone",async()=>{const w=getPerformanceWindow?.();if(!visible(w))return false;const r=await execJs(w,'(async()=>{const api=window.saeed;const before=await api.character.getCharacterController();const bones=before?.autoRig||{};const slot=Object.keys(bones).find(k=>bones[k]);if(!slot)return {pass:false,error:"No mapped logical bone"};const beforeRot=before.actualBones?.[before.autoRig?.[slot]]?.rotation;const j=document.getElementById("characterJoint"),x=document.getElementById("characterPoseX"),y=document.getElementById("characterPoseY"),z=document.getElementById("characterPoseZ");j.value=slot;x.value="17";y.value="23";z.value="11";document.getElementById("characterApplyPose")?.click();await new Promise(r=>setTimeout(r,250));const after=await api.character.getCharacterController();const afterRot=after.actualBones?.[after.autoRig?.[slot]]?.rotation;const changed=Boolean(beforeRot&&afterRot&&(Math.abs((afterRot.x||0)-(beforeRot.x||0))>.01||Math.abs((afterRot.y||0)-(beforeRot.y||0))>.01||Math.abs((afterRot.z||0)-(beforeRot.z||0))>.01));await api.characterController({action:"resetPose"});return {pass:changed,slot,before:beforeRot,after:afterRot,pose:after.pose?.[slot]}})()',true);return r});

   await check("performance.procedural-motion-real-bone",async()=>{const w=getPerformanceWindow?.();if(!visible(w))return false;const r=await execJs(w,'(async()=>{const api=window.saeed;const before=await api.character.getCharacterController();const slot=Object.keys(before?.autoRig||{}).find(k=>before.autoRig?.[k]);if(!slot)return {pass:false,error:"No mapped logical bone"};const id="ciGeneratedMotion";const motion={id,duration:1,layer:"special",loop:false,keyframes:[{time:0,pose:{[slot]:{x:0,y:0,z:0}}},{time:.35,pose:{[slot]:{x:.35,y:.45,z:.2}}},{time:.7,pose:{[slot]:{x:-.25,y:-.3,z:.15}}},{time:1,pose:{[slot]:{x:0,y:0,z:0}}}]};const saved=await api.characterController({action:"defineMotion",motion});if(!saved?.ok)return {pass:false,stage:"define",saved,slot};await api.characterController({action:"play",motion:id,options:{duration:1,speed:1,intensity:1,loop:false}});await new Promise(r=>setTimeout(r,300));const during=await api.character.getCharacterController();const a=before.actualBones?.[before.autoRig?.[slot]]?.rotation,b=during.actualBones?.[during.autoRig?.[slot]]?.rotation;const changed=Boolean(a&&b&&(Math.abs((b.x||0)-(a.x||0))>.01||Math.abs((b.y||0)-(a.y||0))>.01||Math.abs((b.z||0)-(a.z||0))>.01));await api.characterController({action:"stopAll"});await api.characterController({action:"deleteMotion",id});return {pass:changed,slot,changed,before:a,during:b,saved:saved?.motion?.id||id}})()',true);return r});

   await check("performance.create-edit-delete-motion",async()=>{const w=getPerformanceWindow?.();if(!visible(w))return false;const r=await execJs(w,'(async()=>{const api=window.saeed;const before=await api.character.getCharacterController();const slot=Object.keys(before?.autoRig||{}).find(k=>before.autoRig?.[k]);if(!slot)return {pass:false,error:"No mapped logical bone"};const id="ciTestMotion";const motion={id,duration:1,layer:"arms",loop:false,keyframes:[{time:0,pose:{[slot]:{x:0,y:0,z:0}}},{time:.5,pose:{[slot]:{x:.6,y:.8,z:.2}}},{time:1,pose:{[slot]:{x:0,y:0,z:0}}}]};const saved=await api.characterController({action:"defineMotion",motion});const listed=await api.characterController({action:"listMotions"});const edit={...motion,keyframes:[{time:0,pose:{[slot]:{x:0,y:0,z:0}}},{time:.5,pose:{[slot]:{x:.2,y:1.0,z:.3}}},{time:1,pose:{[slot]:{x:0,y:0,z:0}}}]};const edited=await api.characterController({action:"defineMotion",motion:edit});const listed2=await api.characterController({action:"listMotions"});const deleted=await api.characterController({action:"deleteMotion",id});const after=await api.characterController({action:"listMotions"});return {pass:Boolean(saved?.ok&&listed?.motions?.some(x=>x.id===id)&&edited?.ok&&listed2?.motions?.some(x=>x.id===id)&&deleted?.ok&&!after?.motions?.some(x=>x.id===id)),saved:saved?.ok,edited:edited?.ok,deleted:deleted?.ok,slot}})()',true);return r});

   await check("performance.rig-auto-map",async()=>{const w=getPerformanceWindow?.();if(!visible(w))return false;const r=await execJs(w,'(async()=>{document.querySelector("[data-tab=rig]")?.click();await new Promise(r=>setTimeout(r,250));const result=await window.saeed.character.characterController({action:"autoMap"});const s=await window.saeed.character.getCharacterController();const mapped=Object.keys(s?.autoRig||{});return {pass:Boolean(result?.ok&&mapped.length),mapped,boneCount:s?.controllableBoneCount||s?.boneCount||0,tPose:s?.tPose}})()',true);return r});

   await check("performance.all-registered-compatible-motions",async()=>{const w=getPerformanceWindow?.();if(!visible(w))return {pass:false,error:"Performance window is not visible"};const r=await execJs(w,'(async()=>{const api=window.saeed;const before=await api.character.getCharacterController();const mapped=new Set(Object.keys(before?.autoRig||{}));const motions=Array.isArray(before?.motions)?before.motions.filter(id=>id!=="idle"):[];const results=[];const deadline=Date.now()+90000;for(const id of motions){if(Date.now()>=deadline)return {pass:false,status:"TIME_LIMIT",error:"Compatible-motion validation exceeded 90 seconds",motions:motions.length,completed:results.length,results,failed:results.filter(x=>x.active&&!x.changed)};const started=Date.now();let active=false,changed=false;try{const played=await api.characterController({action:"play",motion:id,options:{duration:.6,speed:1,intensity:1,loop:false}});if(!played?.ok){results.push({id,active:false,changed:false,error:"play rejected",played});continue}await new Promise(r=>setTimeout(r,120));const during=await api.character.getCharacterController();active=Boolean(during?.active?.some(x=>x.id===id));changed=[...mapped].some(slot=>{const bone=before.autoRig?.[slot];const a=before.actualBones?.[bone]?.rotation,b=during.actualBones?.[during.autoRig?.[slot]||bone]?.rotation;return Boolean(a&&b&&(Math.abs((b.x||0)-(a.x||0))>.008||Math.abs((b.y||0)-(a.y||0))>.008||Math.abs((b.z||0)-(a.z||0))>.008))});results.push({id,active,changed,elapsedMs:Date.now()-started})}catch(e){results.push({id,active,changed,error:String(e?.stack||e),elapsedMs:Date.now()-started})}finally{try{await api.characterController({action:"stopAll"})}catch{}await new Promise(r=>setTimeout(r,60))}}const failed=results.filter(x=>x.active&&!x.changed);return {pass:Boolean(mapped.size)&&results.length===motions.length&&failed.length===0,mapped:[...mapped],motions:motions.length,completed:results.length,results,failed}})()',true);return r});

   await check("performance.close",async()=>{const w=getPerformanceWindow?.();if(w&&!w.isDestroyed())w.close();await wait(300);return !visible(getPerformanceWindow?.())});
   await check("chat.open",async()=>{await getChatHost().showChat();await wait(800);return visible(chatWindow())});
   await check("chat.local-time",async()=>{
    const w=chatWindow();if(!w)return false;
    const result=await execJs(w,'(async()=>{try{await window.saeed.clearHistory()}catch{};const input=document.getElementById("input"),send=document.getElementById("send"),messages=document.getElementById("messages");messages.innerHTML="";input.value="What is the local time?";send.click();const started=Date.now();while(Date.now()-started<20000){const a=[...document.querySelectorAll("#messages .assistant")].map(x=>x.textContent.trim()).filter(Boolean);if(a.length)return a[a.length-1];await new Promise(r=>setTimeout(r,250));}return ""})()',true);
    const text=String(result||"").trim();
    return {pass:Boolean(text)&&!/^حدث خطأ:|^Error:|window\.saeed\.chat is not a function/i.test(text),responseText:text};
   });

   await check("brain.intent-open-my-computer",async()=>{
    const agent=await ensureBrain?.();if(!agent)return false;
    const events=[];const old=agent.onEvent;agent.onEvent=e=>{events.push(e);old?.(e)};
    try{
      const result=await agent.run("Open my computer");
      const route=events.find(e=>String(e?.stage||"").toUpperCase()==="BRAIN ROUTE");
      return Boolean(String(result||"").trim())&&String(route?.message||"").includes("local");
    }finally{agent.onEvent=old}
   });
   await check("brain.intent-api-escalation",async()=>{
    const agent=await ensureBrain?.();if(!agent)return false;
    const events=[];const old=agent.onEvent;agent.onEvent=e=>{events.push(e);old?.(e)};
    try{
      const result=await agent.run("Open Excel and then book me a ticket");
      const api=events.find(e=>String(e?.stage||"").toUpperCase()==="BRAIN API");
      return Boolean(api)&&String(result||"").trim().length>0;
    }finally{agent.onEvent=old}
   },{required:true});

   await check("chat.response-reaches-character-bubble",async()=>{const cw=chatWindow(),aw=getCharacterWindow?.();if(!cw||!visible(aw))return false;const r=await execJs(cw,'(async()=>{const input=document.getElementById("input"),send=document.getElementById("send");input.value="Say exactly: CI_RESPONSE_CHAIN_OK";send.click();const started=Date.now();while(Date.now()-started<20000){const a=[...document.querySelectorAll("#messages .assistant")].map(x=>x.textContent.trim()).filter(Boolean);if(a.some(x=>x.includes("CI_RESPONSE_CHAIN_OK")))return a.find(x=>x.includes("CI_RESPONSE_CHAIN_OK"));await new Promise(r=>setTimeout(r,250));}return ""})()',true);await wait(250);const bubble=await execJs(cw,'(()=>({visible:Boolean(document.getElementById("saeedMessageBubble")&&!document.getElementById("saeedMessageBubble").hidden),text:document.getElementById("saeedMessageText")?.textContent||""}))()',true);return {pass:Boolean(r&&bubble.visible&&bubble.text.includes("CI_RESPONSE_CHAIN_OK")),response:r,bubble}});
   await check("voice.chat-response-tts-chain",async()=>{const w=getCharacterWindow?.();if(!w)return false;const r=await execJs(w,'(async()=>{const original=window.speechSynthesis?.speak;if(!original)return {pass:false,error:"speechSynthesis.speak unavailable"};let started=false;let text="CI_TTS_CHAIN_OK";const old=window.speechSynthesis.speak.bind(window.speechSynthesis);window.speechSynthesis.speak=u=>{started=true;try{u.onstart?.()}catch{};try{u.onend?.()}catch{};return old(u)};try{window.saeedSpeakText?.(text);await new Promise(r=>setTimeout(r,500));const b=document.getElementById("saeedMessageText")?.textContent||"";return {pass:Boolean(started&&b.includes(text)),started,bubbleText:b}}finally{window.speechSynthesis.speak=original}})()',true);return r});

   await check("chat.ui-response-visible",async()=>{
    const w=chatWindow();if(!w)return false;
    return await execJs(w,'Boolean([...document.querySelectorAll("#messages .assistant")].some(x=>x.textContent.trim()))',true);
   });

   await check("voice.renderer-capabilities",async()=>{
    const w=getCharacterWindow?.();if(!w)return false;
    const r=await execJs(w,'(()=>({speechSynthesis:typeof window.speechSynthesis!=="undefined",speak:typeof window.speechSynthesis?.speak==="function",mediaDevices:Boolean(navigator.mediaDevices&&typeof navigator.mediaDevices.getUserMedia==="function")}))()',true);
    return Boolean(r.speechSynthesis&&r.speak&&r.mediaDevices);
   });
   await check("voice.output-device-capability",async()=>{
    const w=getCharacterWindow?.();if(!w)return false;
    const r=await execJs(w,'(()=>new Promise(async resolve=>{try{if(!navigator.mediaDevices?.enumerateDevices)return resolve({available:false,reason:"enumerateDevices unavailable"});const devices=await navigator.mediaDevices.enumerateDevices();const outputs=devices.filter(d=>d.kind==="audiooutput").map(d=>({kind:d.kind,label:d.label||"",deviceId:Boolean(d.deviceId)}));resolve({available:true,outputDeviceCount:outputs.length,outputs,defaultOutputPresent:outputs.some(d=>d.deviceId)});}catch(e){resolve({available:false,reason:String(e?.name||e?.message||e)})}}))()',true);
    return {pass:true,hardwareOutputAvailable:Boolean(r?.available&&r?.outputDeviceCount>0),environmentLimited:!(r?.available&&r?.outputDeviceCount>0),detail:r};
   },{required:false});
   await check("voice.tts-local-output",async()=>{
    const w=getCharacterWindow?.();if(!w)return false;
    return await execJs(w,`(()=>new Promise(async resolve=>{try{
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
    const r=await execJs(w,'(()=>new Promise(resolve=>{if(!navigator.mediaDevices?.getUserMedia)return resolve({available:false,reason:"mediaDevices unavailable"});let done=false;const finish=v=>{if(done)return;done=true;resolve(v)};navigator.mediaDevices.getUserMedia({audio:true}).then(s=>{s.getTracks().forEach(t=>t.stop());finish({available:true})}).catch(e=>finish({available:false,reason:String(e?.name||e?.message||"permission/device error")}));setTimeout(()=>finish({available:false,reason:"timeout"}),5000)}))()',true);
    return {pass:true,hardwareMicrophoneAvailable:Boolean(r?.available),detail:r};
   },{required:false});

   await check("mute.text-still-visible",async()=>{
    const w=getCharacterWindow?.();if(!w)return false;
    await setVoiceMuted(true);
    w.webContents.send("agent:event",{type:"answer",text:"CI mute text test"});
    await wait(200);
    const visibleText=await execJs(w,'(()=>{const b=document.getElementById("saeedMessageBubble"),t=document.getElementById("saeedMessageText");return {visible:Boolean(b&&!b.hidden),text:t?.textContent||""}})()',true);
    await setVoiceMuted(false);
    return Boolean(visibleText.visible&&visibleText.text.includes("CI mute text test"));
   });

   await check("chat.close-keeps-brain-when-mic-on",async()=>{
    const w=getCharacterWindow?.();let hardwareAvailable=false;if(w){try{hardwareAvailable=Boolean(await execJs(w,"Boolean(navigator.mediaDevices?.getUserMedia)",true));}catch{}}
    if(hardwareAvailable){try{hardwareAvailable=Boolean(await execJs(w,"navigator.mediaDevices.getUserMedia({audio:true}).then(s=>{s.getTracks().forEach(t=>t.stop());return true}).catch(()=>false)",true));}catch{hardwareAvailable=false}}
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

   await check("windows.settings",async()=>{if(typeof depsShowSettings!=="function")return false;await depsShowSettings();await wait(500);const w=getSettingsWindow?.();if(!visible(w))return {pass:false,error:"Settings window did not open"};const ok=await execJs(w,'Boolean(document.querySelector("h1")&&document.querySelector(".sidebar")&&document.querySelector("[data-tab=general]"))',true);w.close();return {pass:ok}});
   await check("windows.addons",async()=>{if(typeof depsShowAddons!=="function")return false;await depsShowAddons();await wait(500);const w=getAddonsWindow?.();if(!visible(w))return {pass:false,error:"Add-ons window did not open"};const ok=await execJs(w,'Boolean(document.querySelector("#refresh")&&document.querySelector("#search")&&document.querySelector("#list"))',true);w.close();return {pass:ok}});
   await check("windows.learning",async()=>{if(typeof depsShowLearning!=="function")return false;await depsShowLearning();await wait(500);const w=getLearningWindow?.();if(!visible(w))return {pass:false,error:"Learning window did not open"};const ok=await execJs(w,'Boolean(document.querySelector("#refresh")&&document.querySelector("#import")&&document.querySelector("#export")&&document.querySelector("#record")&&document.querySelector("#save")&&document.querySelector("#list"))',true);w.close();return {pass:ok}});
   await check("windows.status",async()=>{if(typeof depsShowStatus!=="function")return false;await depsShowStatus();await wait(500);const w=getStatusWindow?.();if(!visible(w))return {pass:false,error:"Status window did not open"};const ok=await execJs(w,'Boolean(document.body&&document.body.innerText&&document.body.innerText.trim().length>20)',true);w.close();return {pass:ok}});
   await check("character.normalize-humanoid-rest-pose-window",async()=>{
    if(typeof depsShowNormalizeHumanoidRestPose!=="function")return {pass:false,error:"Normalize Humanoid Rest Pose opener is not registered"};
    await depsShowNormalizeHumanoidRestPose();
    const w=getNormalizeHumanoidRestPoseWindow?.();
    if(!visible(w))return {pass:false,error:"Normalize Humanoid Rest Pose window did not open"};
    const r=await execJs(w,'(()=>({title:document.title,search:Boolean(document.querySelector("#search")),boneList:Boolean(document.querySelector("#boneList")),apply:Boolean(document.querySelector("#apply")),save:Boolean(document.querySelector("#save")),rotation:Boolean(document.querySelector("#rotation"))}))()',true);
    w.close();
    return {pass:r.title==="Set Normalize Humanoid Rest Pose"&&Object.values(r).slice(1).every(Boolean),controls:r};
   });
   await check("character.studio-open-and-controls",async()=>{if(typeof depsShowRestPoseEditor!=="function")return false;await depsShowRestPoseEditor();const w=getRestPoseEditorWindow?.();if(!visible(w))return {pass:false,error:"Character Studio did not open"};const started=Date.now();let loaded=false;while(Date.now()-started<10000){try{loaded=Boolean(await execJs(w,"window.saeedCharacterRuntime?.controller?.status?.()?.characterLoaded",true));}catch{}if(loaded)break;await wait(250)}const r=await execJs(w,'(()=>({boneList:Boolean(document.querySelector("#boneList")),apply:Boolean(document.querySelector("#apply")),bind:Boolean(document.querySelector("#bind")),auto:Boolean(document.querySelector("#auto")),capture:Boolean(document.querySelector("#capture")),normalize:Boolean(document.querySelector("#normalize")),resetRest:Boolean(document.querySelector("#resetRest")),viewer:Boolean(document.querySelector("#studio3d"))}))()',true);return {pass:Object.values(r).every(Boolean),controls:r}});
   await check("character.studio-rest-pose-save-reset",async()=>{const w=getRestPoseEditorWindow?.();if(!visible(w))return {pass:false,error:"Character Studio is not open"};const r=await execJs(w,'(async()=>{const api=window.saeed.character;const first=await api.characterController({action:"status"});const map=first?.status?.autoRig||{};const slot=Object.keys(map).find(k=>map[k]);if(!slot)return {pass:false,error:"No mapped logical bone"};const bone=map[slot];const original=first.status.actualBones?.[bone]?.rotation;if(!original)return {pass:false,error:"No actual bone rotation for "+bone};const changed={x:(original.x||0)+0.21,y:(original.y||0)-0.13,z:(original.z||0)+0.09};const applied=await api.characterController({action:"setBoneRotation",bone,rotation:changed});const saved=await api.characterController({action:"saveRestPose"});const temporary={x:changed.x+0.31,y:changed.y+0.17,z:changed.z-0.19};await api.characterController({action:"setBoneRotation",bone,rotation:temporary});await api.characterController({action:"resetPose"});const restored=(await api.characterController({action:"status"}))?.status?.actualBones?.[bone]?.rotation||{};const newRest=Math.abs((restored.x||0)-changed.x)<.035&&Math.abs((restored.y||0)-changed.y)<.035&&Math.abs((restored.z||0)-changed.z)<.035;await api.characterController({action:"setBoneRotation",bone,rotation:original});await api.characterController({action:"saveRestPose"});await api.characterController({action:"resetPose"});return {pass:Boolean(applied?.ok&&saved?.ok&&newRest),slot,bone,original,changed,temporary,restored,newRest}})()',true);return r});
   await check("character.studio-bone-rotation",async()=>{const w=getRestPoseEditorWindow?.();if(!visible(w))return {pass:false,error:"Character Studio is not open"};const r=await execJs(w,'(async()=>{const api=window.saeed.character;const s=await api.characterController({action:"status"});const bones=s?.status?.actualBones||{};const name=Object.keys(bones).find(k=>bones[k]?.restPose);if(!name)return {pass:false,error:"No controllable bone with rest pose"};const before=bones[name]?.rotation||{};const target={x:(before.x||0)+0.15,y:before.y||0,z:before.z||0};const applied=await api.characterController({action:"setBoneRotation",bone:name,rotation:target});const after=(await api.characterController({action:"status"}))?.status?.actualBones?.[name]?.rotation||{};const changed=Math.abs((after.x||0)-target.x)<.02;await api.characterController({action:"resetPose"});return {pass:Boolean(applied?.ok&&changed),bone:name,before,after,target}})()',true);return r});
   await check("character.studio-animation-any-bone-edit-play",async()=>{const w=getRestPoseEditorWindow?.();if(!visible(w))return {pass:false,error:"Character Studio is not open"};const r=await execJs(w,'(async()=>{const api=window.saeed.character;const first=await api.characterController({action:"status"});const map=first?.status?.autoRig||{};const slots=Object.entries(map).filter(([,bone])=>bone&&first.status.actualBones?.[bone]?.rotation);if(!slots.length)return {pass:false,error:"No mapped controllable animation bones"};const id="ciStudioAllBonesMotion";const base={};const edited={};for(const [slot,bone] of slots){base[slot]={x:0,y:0,z:0};edited[slot]={x:.38,y:.22,z:-.17}}const def={id,duration:1,layer:"arms",loop:false,keyframes:[{time:0,pose:base},{time:.5,pose:edited},{time:1,pose:base}]};const made=await api.characterController({action:"defineMotion",motion:def});if(!made?.ok)return {pass:false,stage:"define",made,slots:slots.map(x=>x[0])};const listed=await api.characterController({action:"listMotions"});const loaded=listed?.motions?.find(x=>x.id===id);if(!loaded)return {pass:false,stage:"list",slots:slots.map(x=>x[0])};const played=await api.characterController({action:"play",motion:id,options:{speed:1,duration:1,loop:false}});await new Promise(r=>setTimeout(r,430));const during=await api.characterController({action:"status"});const active=Boolean(during?.status?.active?.some(x=>x.id===id));const changed=[];const failed=[];for(const [slot,bone] of slots){const a=first.status.actualBones?.[bone]?.rotation||{};const b=during.status.actualBones?.[bone]?.rotation||{};const ok=Math.abs((b.x||0)-(a.x||0))>.02||Math.abs((b.y||0)-(a.y||0))>.02||Math.abs((b.z||0)-(a.z||0))>.02;(ok?changed:failed).push({slot,bone,before:a,during:b})}const edit2={id,duration:1,layer:"arms",loop:false,keyframes:[{time:0,pose:base},{time:.5,pose:Object.fromEntries(slots.map(([slot])=>[slot,{x:-.29,y:.31,z:.14}]))},{time:1,pose:base}]};const editedResult=await api.characterController({action:"defineMotion",motion:edit2});await api.characterController({action:"stopAll"});await api.characterController({action:"play",motion:id,options:{speed:1,duration:1,loop:false}});await new Promise(r=>setTimeout(r,430));const afterEdit=await api.characterController({action:"status"});const editChanged=[];const editFailed=[];for(const [slot,bone] of slots){const a=during.status.actualBones?.[bone]?.rotation||{};const b=afterEdit.status.actualBones?.[bone]?.rotation||{};const ok=Math.abs((b.x||0)-(a.x||0))>.02||Math.abs((b.y||0)-(a.y||0))>.02||Math.abs((b.z||0)-(a.z||0))>.02;(ok?editChanged:editFailed).push({slot,bone,beforeEdit:a,afterEdit:b})}await api.characterController({action:"stopAll"});await api.characterController({action:"deleteMotion",id});return {pass:Boolean(made?.ok&&played?.ok&&active&&changed.length===slots.length&&editedResult?.ok&&editChanged.length===slots.length),slotCount:slots.length,slots:slots.map(x=>x[0]),changedCount:changed.length,failed,edited:editedResult?.ok,editChangedCount:editChanged.length,editFailed}})()',true);return r});

   await check("character.studio-every-button-and-live-animation",async()=>{const w=getRestPoseEditorWindow?.();if(!visible(w))return {pass:false,error:"Character Studio is not open"};const r=await execJs(w,`(async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms));const api=window.saeed.character;const result={buttons:{},bone:null,rotation:null,rest:null,motion:null,view:null};const click=async(id,delay=150)=>{const b=document.getElementById(id);if(!b)return {ok:false,error:"missing #"+id};b.click();await wait(delay);return {ok:true,text:(document.getElementById("rigStatus")||document.getElementById("poseStatus")||document.getElementById("animStatus"))?.textContent||""}};for(const id of ["front","resetCam","showBones"]){result.buttons[id]=await click(id,100)};const status0=await api.characterController({action:"status"});const map=status0?.status?.autoRig||{};const entry=Object.entries(map).find(([,bone])=>bone&&status0.status.actualBones?.[bone]?.rotation);if(!entry)return {pass:false,stage:"bone-selection",error:"No mapped controllable bone",result};const [slot,bone]=entry;result.bone={slot,bone};const option=[...document.querySelector("#boneList").options].find(o=>o.value===bone);if(!option)return {pass:false,stage:"bone-list",error:"Mapped bone is not present in Studio bone list",result};document.querySelector("#boneList").value=bone;document.querySelector("#boneList").dispatchEvent(new Event("change",{bubbles:true}));await wait(100);const before=(await api.characterController({action:"status"})).status.actualBones?.[bone]?.rotation||{};document.querySelector("#rx").value=String(Math.round((before.x||0)*180/Math.PI)+18);document.querySelector("#ry").value=String(Math.round((before.y||0)*180/Math.PI)+11);document.querySelector("#rz").value=String(Math.round((before.z||0)*180/Math.PI)-9);result.buttons.apply=await click("apply",250);const after=(await api.characterController({action:"status"})).status.actualBones?.[bone]?.rotation||{};result.rotation={before,after,changed:Math.abs((after.x||0)-(before.x||0))>.02||Math.abs((after.y||0)-(before.y||0))>.02||Math.abs((after.z||0)-(before.z||0))>.02};result.buttons.resetBone=await click("resetBone",150);document.querySelector("#slot").value=slot;result.buttons.bind=await click("bind",200);result.buttons.auto=await click("auto",250);result.buttons.capture=await click("capture",200);result.buttons.normalize=await click("normalize",250);result.buttons.resetRest=await click("resetRest",200);const s1=await api.characterController({action:"status"});result.rest={characterLoaded:s1?.status?.characterLoaded,mapped:Object.keys(s1?.status?.autoRig||{}).length};const id="ciStudioButtonMotion";document.querySelector("#motionId").value=id;document.querySelector("#duration").value="1";document.querySelector("#motionLoop").value="false";document.querySelector("#motionLayer").value="body";document.querySelector("#motionKeyframes").value=JSON.stringify([{time:0,pose:{[slot]:{x:0,y:0,z:0}}},{time:.5,pose:{[slot]:{x:.42,y:.28,z:-.18}}},{time:1,pose:{[slot]:{x:0,y:0,z:0}}}],null,2);result.buttons.saveMotion=await click("saveMotion",250);const motionBefore=await api.characterController({action:"status"});result.buttons.play=await click("play",350);const motionDuring=await api.characterController({action:"status"});result.buttons.stop=await click("stop",200);result.buttons.loadMotion=await click("loadMotion",200);document.querySelector("#motionKeyframes").value=JSON.stringify([{time:0,pose:{[slot]:{x:0,y:0,z:0}}},{time:.5,pose:{[slot]:{x:-.31,y:.36,z:.16}}},{time:1,pose:{[slot]:{x:0,y:0,z:0}}}],null,2);result.buttons.saveMotionEdit=await click("saveMotion",250);result.buttons.deleteMotion=await click("deleteMotion",250);const motionAfter=await api.characterController({action:"listMotions"});result.motion={played:Boolean(motionDuring?.status?.active?.some(x=>x.id===id)),deleted:!motionAfter?.motions?.some(x=>x.id===id),motionBefore:motionBefore?.status?.active||[],motionDuring:motionDuring?.status?.active||[]};document.querySelector("[data-tab=pose]").click();await wait(80);const poseVisible=getComputedStyle(document.getElementById("pose")).display!=="none";document.querySelector("[data-tab=anim]").click();await wait(80);const animVisible=getComputedStyle(document.getElementById("anim")).display!=="none";result.view={poseVisible,animVisible};await api.characterController({action:"resetPose"});const close=document.getElementById("close");if(!close)return {pass:false,stage:"close",error:"Missing #close",result};close.click();result.close={clicked:true};return {pass:Object.values(result.buttons).every(x=>x?.ok)&&result.rotation?.changed&&result.rest?.characterLoaded&&result.rest?.mapped>0&&result.motion?.played&&result.motion?.deleted&&result.view?.poseVisible&&result.view?.animVisible&&result.close?.clicked,result}})()`,true);return r},{timeoutMs:45000});

   await check("character.studio-close-button",async()=>{await wait(300);return {pass:!visible(getRestPoseEditorWindow?.()),visible:visible(getRestPoseEditorWindow?.())}});

   await check("glb.replace-character-file",async()=>{const w=getCharacterWindow?.();if(!visible(w)||typeof characterHost?.replaceCharacterForCi!=="function")return {pass:false,error:"CI GLB replacement API unavailable"};const source=path.join(app.getAppPath(),"assets","Saeed_AI-3D.glb");const alt=path.join(app.getPath("temp"),"Saeed-CI-Replacement.glb");try{fs.copyFileSync(source,alt);const result=await characterHost.replaceCharacterForCi(alt);await wait(1200);const after=await execJs(w,'(()=>({bootstrap:window.saeed3DBootstrap,engine:window.saeedCharacterRuntime?.engine?.get3DStatus?.()}))()',true);const pose=await execJs(w,"window.saeedCharacterRuntime?.controller?.status?.()",true).catch(()=>null);return {pass:Boolean(result?.ok&&!after.bootstrap?.error&&after.engine?.components?.sceneContent?.state==="rendered"&&pose?.characterLoaded),result,after,pose}}finally{try{fs.unlinkSync(alt)}catch{}}});
   await check("glbtest.authoritative-asset-and-visible-character",async()=>{const w=getCharacterWindow?.();if(!visible(w))return {pass:false,stage:"window",error:"Character window is not visible"};const source=path.join(app.getAppPath(),"assets","Saeed_AI-3D.glb");const fileExists=fs.existsSync(source);const fileSize=fileExists?fs.statSync(source).size:0;if(!fileExists||fileSize<=20)return {pass:false,stage:"asset-missing",source,fileExists,fileSize};const deadline=Date.now()+18000;let runtime=null,controller=null;while(Date.now()<deadline){runtime=await execJs(w,'(()=>{const e=window.saeedCharacterRuntime?.engine?.get3DStatus?.();const scene=e?.components?.sceneContent||{};const trace=window.saeedCharacterRuntime?.glbTrace||[];const objects=[];window.saeedCharacterRuntime?.engine?.getScene?.()?.traverse?.(o=>{if(o?.isMesh||o?.isSkinnedMesh)objects.push({name:o.name||"",type:o.type,visible:o.visible})});return {bootstrap:window.saeed3DBootstrap,engine:e,scene,meshCount:objects.length,meshes:objects.slice(0,20),trace:trace.slice(-30)}})()',true).catch(e=>({error:String(e?.stack||e)}));controller=await execJs(w,"window.saeedCharacterRuntime?.controller?.status?.()",true).catch(e=>({error:String(e?.stack||e)}));if(!runtime?.bootstrap?.error&&runtime?.scene?.state==="rendered"&&Number(runtime?.meshCount)>0&&controller?.characterLoaded&&Object.keys(controller?.autoRig||{}).length>0&&Number(controller?.skeletonCount||0)>0)break;await wait(250)}const trace=runtime?.trace||[];const failure=trace.find(x=>["load-error","renderer-error","renderer-rejection"].includes(x.stage));const stage=!runtime?.bootstrap&&!runtime?.scene?"bootstrap-unavailable":runtime?.bootstrap?.error?"bootstrap-error":runtime?.scene?.state!=="rendered"?"scene-not-rendered":Number(runtime?.meshCount)<=0?"no-meshes":!controller?.characterLoaded?"controller-not-loaded":"complete";return {pass:Boolean(runtime&&!runtime?.bootstrap?.error&&runtime?.scene?.state==="rendered"&&Number(runtime?.meshCount)>0&&controller?.characterLoaded&&Object.keys(controller?.autoRig||{}).length>0&&Number(controller?.skeletonCount||0)>0),stage,source,fileExists,fileSize,runtime,controller,failure}});
   await check("glbtest.full-load-pipeline",async()=>{const w=getCharacterWindow?.();if(!visible(w))return {pass:false,error:"Character window is unavailable"};const traceBefore=await execJs(w,"window.saeedCharacterRuntime?.glbTrace?.slice?.()||[]",true);const source=path.join(app.getAppPath(),"assets","Saeed_AI-3D.glb");if(!fs.existsSync(source))return {pass:false,error:"Bundled GLB is missing",source};const alt=path.join(app.getPath("temp"),"Saeed-GLB-Test.glb");try{fs.copyFileSync(source,alt);const result=await characterHost.replaceCharacterForCi(alt);const deadline=Date.now()+18000;let final=null;while(Date.now()<deadline){final=await execJs(w,'(()=>{const t=window.saeedCharacterRuntime?.glbTrace||[];const e=window.saeedCharacterRuntime?.engine?.get3DStatus?.();return {trace:t,engine:e,bootstrap:window.saeed3DBootstrap}})()',true);if(final?.trace?.some(x=>x.stage==="display-success")||final?.trace?.some(x=>x.stage==="load-error"))break;await wait(250)}const stages=(final?.trace||[]).map(x=>x.stage);const has=s=>stages.includes(s);const failure=final?.trace?.find(x=>x.stage==="load-error"||x.stage==="renderer-error"||x.stage==="renderer-rejection");const required=["character-selected-received","load-start","bytes-ready","parse-start","parse-success","generation-accepted","display-start","display-success"];const missing=required.filter(s=>!has(s));return {pass:Boolean(result?.ok&&missing.length===0&&final?.engine?.components?.sceneContent?.state==="rendered"),source,size:fs.statSync(source).size,result,traceBefore,trace:final?.trace||[],stages,missing,failure,engine:final?.engine,bootstrap:final?.bootstrap}}finally{try{fs.unlinkSync(alt)}catch{}}},{timeoutMs:30000});
   await check("glbtest.generation-and-repeat-load",async()=>{const w=getCharacterWindow?.();if(!visible(w))return {pass:false,error:"Character window is unavailable"};const source=path.join(app.getAppPath(),"assets","Saeed_AI-3D.glb"),alt=path.join(app.getPath("temp"),"Saeed-GLB-Test-Repeat.glb");try{fs.copyFileSync(source,alt);const first=await characterHost.replaceCharacterForCi(alt);const before=await execJs(w,"window.saeedCharacterRuntime?.glbTrace?.slice?.()||[]",true);const second=await characterHost.replaceCharacterForCi(alt);await wait(500);const after=await execJs(w,"(()=>({trace:window.saeedCharacterRuntime?.glbTrace?.slice?.()||[],engine:window.saeedCharacterRuntime?.engine?.get3DStatus?.()}))()",true);const accepted=after.trace.filter(x=>x.stage==="generation-accepted").map(x=>x.generation);const parses=after.trace.filter(x=>x.stage==="parse-success").length;const displays=after.trace.filter(x=>x.stage==="display-success").length;return {pass:Boolean(first?.ok&&second?.ok&&accepted.length>=2&&parses>=2&&displays>=2&&after.engine?.components?.sceneContent?.state==="rendered"),first,second,accepted,parseSuccesses:parses,displaySuccesses:displays,traceBefore:before,trace:after.trace,engine:after.engine}}finally{try{fs.unlinkSync(alt)}catch{}}},{timeoutMs:45000});
   await check("glb.current-character-loaded",async()=>{const w=getCharacterWindow?.();if(!visible(w))return false;const r=await execJs(w,'(()=>({bootstrap:window.saeed3DBootstrap,moduleLoaded:window.saeed3DBootstrap?.moduleLoaded!==false,engine:window.saeedCharacterRuntime?.engine?.get3DStatus?.()}))()',true);const pose=await execJs(w,"window.saeedCharacterRuntime?.controller?.status?.()",true).catch(()=>null);return {pass:Boolean(r.moduleLoaded&&!r.bootstrap?.error&&r.engine?.components?.sceneContent?.state==="rendered"&&pose?.characterLoaded&&Object.keys(pose?.autoRig||{}).length>0&&Number(pose?.skeletonCount||0)>0),detail:r,pose}});
   await check("tray.single-owner-and-menu",async()=>{const t=getTray?.();if(!t)return false;const menu=t.__saeedContextMenu;const labels=menu?.items?.map?.(x=>x.label)||[];const required=["Saeed","Mute","Voice","Character","Diagnostics","Updates & Settings","Quit"];return {pass:Boolean(t&&menu&&required.every(x=>labels.includes(x))),labels,required}});
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
   report.diagnostics={runnerVersion:2,timeoutPolicy:"abort-current-suite-on-check-timeout",trace:trace.slice(),timeoutCount:Object.values(report.checks).filter(x=>x.status==="TIMEOUT").length,errorCount:Object.values(report.checks).filter(x=>x.status==="ERROR").length};
   report.pass=Object.values(report.checks).filter(x=>x.required!==false).every(x=>x.pass);
  }catch(e){report.error=String(e?.stack||e);report.pass=false;report.finishedAt=new Date().toISOString();if(e?.code==="E2E_CHECK_TIMEOUT")report.abortReason=report.abortReason||{type:"CHECK_TIMEOUT",check:e.check,diagnostic:e.diagnostic}}
  try{fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2),"utf8")}catch(e){report.pass=false;report.error=String(e?.stack||e)}
  if(report.abortReason?.type==="CHECK_TIMEOUT"){
   setTimeout(()=>{try{app?.quit?.()}catch{}},50);
  }
  return report;
 }
 return{run};
}
module.exports={createCiE2E};
