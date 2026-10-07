const fs=require("fs"),path=require("path");

function createCiE2E(deps={}){
 const {app,getCharacterWindow,getChatHost,getAgent,getTray,getBrainActive,ensureBrain,releaseBrainIfIdle,setMicMode,setVoiceMuted,getVoiceMuted,characterHost,getVoiceHost,getPerformanceWindow,showPerformance:depsShowPerformance,getSettingsWindow,getAddonsWindow,getLearningWindow,getStatusWindow,getRestPoseEditorWindow,showSettings:depsShowSettings,showAddons:depsShowAddons,showLearning:depsShowLearning,showStatus:depsShowStatus,showRestPoseEditor:depsShowRestPoseEditor}=deps;
 const report={startedAt:new Date().toISOString(),checks:{},phases:{},suite:null};
 const suiteArg=String(process.env.SAEED_CI_E2E_SUITE||"all");
 const out=process.env.SAEED_CI_E2E_REPORT||path.join(process.cwd(),"dist",suiteArg==="all"?"ci-e2e-report.json":`ci-e2e-suite-${suiteArg}.json`);
 const started=Date.now();
 const suiteFor=name=>{if(suiteArg==="all")return true;const n=String(name);if(suiteArg==="1")return n.startsWith("startup.")||n.startsWith("performance.");if(suiteArg==="2")return n.startsWith("chat.")||n.startsWith("brain.")||n.startsWith("voice.")||n.startsWith("mute.")||n.startsWith("mic-");if(suiteArg==="3")return n.startsWith("windows.")||n.startsWith("character.")||n.startsWith("hide-")||n.startsWith("show-")||n.startsWith("tray.")||n.startsWith("glb.")||n.startsWith("idle-final");return true};
 const check=async(name,fn,{required=true,timeoutMs=30000}={})=>{
  if(!suiteFor(name))return {pass:true,required,skipped:true};
  const t=Date.now();
  try{const v=await Promise.race([Promise.resolve().then(fn),new Promise(resolve=>setTimeout(()=>resolve({pass:false,error:"Check timed out after "+timeoutMs+" ms"}),timeoutMs))]);const pass=v===true||v?.pass===true;report.checks[name]={pass,required,latencyMs:Date.now()-t,detail:typeof v==="object"&&v&&!Array.isArray(v)?v:undefined};return report.checks[name]}
  catch(e){report.checks[name]={pass:false,required,latencyMs:Date.now()-t,error:String(e?.stack||e)};return report.checks[name]}
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

   await check("performance.open-character-controller",async()=>{if(typeof depsShowPerformance!=="function")return false;await depsShowPerformance();const started=Date.now();let w=getPerformanceWindow?.();while(Date.now()-started<25000){w=getPerformanceWindow?.();if(visible(w)){const ready=await w.webContents.executeJavaScript('(async()=>{try{const r=await window.saeed.getCharacterController();return Boolean(r?.characterLoaded)}catch{return false}})()',true);if(ready)break;}await wait(250)}if(!visible(w))return false;return await w.webContents.executeJavaScript('Boolean(document.querySelector("#tab-character")&&document.querySelector("#characterPlayMotion")&&document.querySelector("#characterApplyPose")&&document.querySelector("#motionEditorSave")&&document.querySelector("#rigApply"))',true)});

   await check("performance.all-tabs-functional",async()=>{const w=getPerformanceWindow?.();if(!visible(w))return false;const r=await w.webContents.executeJavaScript('(()=>{const ids=[...document.querySelectorAll("nav button[data-tab]")].map(x=>x.dataset.tab);const results=ids.map(id=>{const b=document.querySelector("nav button[data-tab=\\\""+id+"\\\"]");b?.click();const panel=document.getElementById("tab-"+id);return {id,button:Boolean(b),panel:Boolean(panel),visible:Boolean(panel&&!panel.hidden&&getComputedStyle(panel).display!=="none")}});return {pass:results.length>=9&&results.every(x=>x.button&&x.panel),tabs:results}})()',true);return r});

   await check("performance.no-t-pose-after-launch",async()=>{const w=getPerformanceWindow?.();if(!visible(w))return false;const r=await w.webContents.executeJavaScript('(async()=>{let last=null;for(let i=0;i<20;i++){try{const x=await window.saeed.getCharacterController();if(x?.characterLoaded)return x;last=x;}catch(e){last={error:e.message}}await new Promise(r=>setTimeout(r,150));}return last})()',true);const t=r?.tPose||{};return {pass:Boolean(r?.characterLoaded&&t?.isTPose!==true),characterLoaded:r?.characterLoaded,tPose:t,boneCount:r?.retargeting?.boneCount||0}});

   await check("performance.control-real-bone",async()=>{const w=getPerformanceWindow?.();if(!visible(w))return false;const r=await w.webContents.executeJavaScript('(async()=>{const api=window.saeed;const before=await api.getCharacterController();const bones=before?.retargeting?.bones||{};const slot=Object.keys(bones).find(k=>bones[k]);if(!slot)return {pass:false,error:"No mapped logical bone"};const beforeRot=before.actualBones?.[slot]?.rotation;const j=document.getElementById("characterJoint"),x=document.getElementById("characterPoseX"),y=document.getElementById("characterPoseY"),z=document.getElementById("characterPoseZ");j.value=slot;x.value="17";y.value="23";z.value="11";document.getElementById("characterApplyPose")?.click();await new Promise(r=>setTimeout(r,250));const after=await api.getCharacterController();const afterRot=after.actualBones?.[slot]?.rotation;const changed=Boolean(beforeRot&&afterRot&&(Math.abs((afterRot.x||0)-(beforeRot.x||0))>.01||Math.abs((afterRot.y||0)-(beforeRot.y||0))>.01||Math.abs((afterRot.z||0)-(beforeRot.z||0))>.01));await api.characterController({action:"resetPose"});return {pass:changed,slot,before:beforeRot,after:afterRot,pose:after.pose?.[slot]}})()',true);return r});

   await check("performance.procedural-motion-real-bone",async()=>{const w=getPerformanceWindow?.();if(!visible(w))return false;const r=await w.webContents.executeJavaScript('(async()=>{const api=window.saeed;const before=await api.getCharacterController();const slot=Object.keys(before?.retargeting?.bones||{}).find(k=>before.retargeting.bones[k]);if(!slot)return {pass:false,error:"No mapped logical bone"};const id="ciGeneratedMotion";const motion={id,duration:1,layer:"special",loop:false,keyframes:[{time:0,pose:{[slot]:{x:0,y:0,z:0}}},{time:.35,pose:{[slot]:{x:.35,y:.45,z:.2}}},{time:.7,pose:{[slot]:{x:-.25,y:-.3,z:.15}}},{time:1,pose:{[slot]:{x:0,y:0,z:0}}}]};const saved=await api.characterController({action:"defineMotion",motion});if(!saved?.ok)return {pass:false,stage:"define",saved,slot};await api.characterController({action:"play",motion:id,options:{duration:1,speed:1,intensity:1,loop:false}});await new Promise(r=>setTimeout(r,300));const during=await api.getCharacterController();const a=before.actualBones?.[slot]?.rotation,b=during.actualBones?.[slot]?.rotation;const changed=Boolean(a&&b&&(Math.abs((b.x||0)-(a.x||0))>.01||Math.abs((b.y||0)-(a.y||0))>.01||Math.abs((b.z||0)-(a.z||0))>.01));await api.characterController({action:"stopAll"});await api.characterController({action:"deleteMotion",id});return {pass:changed,slot,changed,before:a,during:b,saved:saved?.motion?.id||id}})()',true);return r});

   await check("performance.create-edit-delete-motion",async()=>{const w=getPerformanceWindow?.();if(!visible(w))return false;const r=await w.webContents.executeJavaScript('(async()=>{const api=window.saeed;const before=await api.getCharacterController();const slot=Object.keys(before?.retargeting?.bones||{}).find(k=>before.retargeting.bones[k]);if(!slot)return {pass:false,error:"No mapped logical bone"};const id="ciTestMotion";const motion={id,duration:1,layer:"arms",loop:false,keyframes:[{time:0,pose:{[slot]:{x:0,y:0,z:0}}},{time:.5,pose:{[slot]:{x:.6,y:.8,z:.2}}},{time:1,pose:{[slot]:{x:0,y:0,z:0}}}]};const saved=await api.characterController({action:"defineMotion",motion});const listed=await api.characterController({action:"listMotions"});const edit={...motion,keyframes:[{time:0,pose:{[slot]:{x:0,y:0,z:0}}},{time:.5,pose:{[slot]:{x:.2,y:1.0,z:.3}}},{time:1,pose:{[slot]:{x:0,y:0,z:0}}}]};const edited=await api.characterController({action:"defineMotion",motion:edit});const listed2=await api.characterController({action:"listMotions"});const deleted=await api.characterController({action:"deleteMotion",id});const after=await api.characterController({action:"listMotions"});return {pass:Boolean(saved?.ok&&listed?.motions?.some(x=>x.id===id)&&edited?.ok&&listed2?.motions?.some(x=>x.id===id)&&deleted?.ok&&!after?.motions?.some(x=>x.id===id)),saved:saved?.ok,edited:edited?.ok,deleted:deleted?.ok,slot}})()',true);return r});

   await check("performance.rig-auto-map",async()=>{const w=getPerformanceWindow?.();if(!visible(w))return false;const r=await w.webContents.executeJavaScript('(async()=>{document.querySelector("[data-tab=rig]")?.click();await new Promise(r=>setTimeout(r,250));const result=await window.saeed.characterController({action:"autoMap"});const s=await window.saeed.getCharacterController();const mapped=Object.keys(s?.retargeting?.bones||{});return {pass:Boolean(result?.ok&&mapped.length),mapped,boneCount:s?.retargeting?.boneCount||0,tPose:s?.tPose}})()',true);return r});

   await check("performance.all-registered-compatible-motions",async()=>{const w=getPerformanceWindow?.();if(!visible(w))return false;const r=await w.webContents.executeJavaScript('(async()=>{const api=window.saeed;const before=await api.getCharacterController();const mapped=new Set(Object.keys(before?.retargeting?.bones||{}));const motions=before?.motions||[];const results=[];for(const id of motions){if(id==="idle")continue;await api.characterController({action:"play",motion:id,options:{duration:.6,speed:1,intensity:1,loop:false}});await new Promise(r=>setTimeout(r,120));const during=await api.getCharacterController();const active=Boolean(during?.active?.some(x=>x.id===id));const changed=Object.keys(before?.actualBones||{}).some(k=>mapped.has(k)&&(()=>{const a=before.actualBones[k]?.rotation,b=during.actualBones?.[k]?.rotation;return Boolean(a&&b&&(Math.abs((a.x||0)-(b.x||0))>.008||Math.abs((a.y||0)-(b.y||0))>.008||Math.abs((a.z||0)-(b.z||0))>.008))})());results.push({id,active,changed});await api.characterController({action:"stopAll"});await new Promise(r=>setTimeout(r,60));}const failed=results.filter(x=>x.active&&!x.changed);return {pass:Boolean(mapped.size)&&failed.length===0,mapped:[...mapped],motions:motions.length,results,failed}})()',true);return r});

   await check("performance.close",async()=>{const w=getPerformanceWindow?.();if(w&&!w.isDestroyed())w.close();await wait(300);return !visible(getPerformanceWindow?.())});
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

   await check("chat.response-reaches-character-bubble",async()=>{const cw=chatWindow(),aw=getCharacterWindow?.();if(!cw||!visible(aw))return false;const r=await cw.webContents.executeJavaScript('(async()=>{const input=document.getElementById("input"),send=document.getElementById("send");input.value="Say exactly: CI_RESPONSE_CHAIN_OK";send.click();const started=Date.now();while(Date.now()-started<20000){const a=[...document.querySelectorAll("#messages .assistant")].map(x=>x.textContent.trim()).filter(Boolean);if(a.some(x=>x.includes("CI_RESPONSE_CHAIN_OK")))return a.find(x=>x.includes("CI_RESPONSE_CHAIN_OK"));await new Promise(r=>setTimeout(r,250));}return ""})()',true);await wait(250);const bubble=await aw.webContents.executeJavaScript('(()=>({visible:Boolean(document.getElementById("saeedMessageBubble")&&!document.getElementById("saeedMessageBubble").hidden),text:document.getElementById("saeedMessageText")?.textContent||""}))()',true);return {pass:Boolean(r&&bubble.visible&&bubble.text.includes("CI_RESPONSE_CHAIN_OK")),response:r,bubble}});
   await check("voice.chat-response-tts-chain",async()=>{const w=getCharacterWindow?.();if(!w)return false;const r=await w.webContents.executeJavaScript('(async()=>{const original=window.speechSynthesis?.speak;if(!original)return {pass:false,error:"speechSynthesis.speak unavailable"};let started=false;let text="CI_TTS_CHAIN_OK";const old=window.speechSynthesis.speak.bind(window.speechSynthesis);window.speechSynthesis.speak=u=>{started=true;try{u.onstart?.()}catch{};try{u.onend?.()}catch{};return old(u)};try{window.saeedSpeakText?.(text);await new Promise(r=>setTimeout(r,500));const b=document.getElementById("saeedMessageText")?.textContent||"";return {pass:Boolean(started&&b.includes(text)),started,bubbleText:b}}finally{window.speechSynthesis.speak=original}})()',true);return r});

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

   await check("windows.settings",async()=>{if(typeof depsShowSettings!=="function")return false;await depsShowSettings();await wait(500);const w=getSettingsWindow?.();if(!visible(w))return {pass:false,error:"Settings window did not open"};const ok=await w.webContents.executeJavaScript('Boolean(document.querySelector("h1")&&document.querySelector(".sidebar")&&document.querySelector("[data-tab=general]"))',true);w.close();return {pass:ok}});
   await check("windows.addons",async()=>{if(typeof depsShowAddons!=="function")return false;await depsShowAddons();await wait(500);const w=getAddonsWindow?.();if(!visible(w))return {pass:false,error:"Add-ons window did not open"};const ok=await w.webContents.executeJavaScript('Boolean(document.querySelector("#refresh")&&document.querySelector("#search")&&document.querySelector("#list"))',true);w.close();return {pass:ok}});
   await check("windows.learning",async()=>{if(typeof depsShowLearning!=="function")return false;await depsShowLearning();await wait(500);const w=getLearningWindow?.();if(!visible(w))return {pass:false,error:"Learning window did not open"};const ok=await w.webContents.executeJavaScript('Boolean(document.querySelector("#refresh")&&document.querySelector("#import")&&document.querySelector("#export")&&document.querySelector("#record")&&document.querySelector("#save")&&document.querySelector("#list"))',true);w.close();return {pass:ok}});
   await check("windows.status",async()=>{if(typeof depsShowStatus!=="function")return false;await depsShowStatus();await wait(500);const w=getStatusWindow?.();if(!visible(w))return {pass:false,error:"Status window did not open"};const ok=await w.webContents.executeJavaScript('Boolean(document.body&&document.body.innerText&&document.body.innerText.trim().length>20)',true);w.close();return {pass:ok}});
   await check("character.studio-open-and-controls",async()=>{if(typeof depsShowRestPoseEditor!=="function")return false;await depsShowRestPoseEditor();await wait(700);const w=getRestPoseEditorWindow?.();if(!visible(w))return {pass:false,error:"Character Studio did not open"};const r=await w.webContents.executeJavaScript('(()=>({boneList:Boolean(document.querySelector("#boneList")),apply:Boolean(document.querySelector("#apply")),bind:Boolean(document.querySelector("#bind")),auto:Boolean(document.querySelector("#auto")),capture:Boolean(document.querySelector("#capture")),normalize:Boolean(document.querySelector("#normalize")),resetRest:Boolean(document.querySelector("#resetRest")),viewer:Boolean(document.querySelector("#studio3d"))}))()',true);return {pass:Object.values(r).every(Boolean),controls:r}});
   await check("character.studio-rest-pose-operation",async()=>{const w=getRestPoseEditorWindow?.();if(!visible(w))return false;const r=await w.webContents.executeJavaScript('(async()=>{const before=await window.saeed.character.characterController({action:"status"});const a=await window.saeed.character.characterController({action:"normalizeRestPose"});const b=await window.saeed.character.characterController({action:"resetPose"});const after=await window.saeed.character.characterController({action:"status"});return {pass:Boolean(a&&b&&after),before,normalize:a,reset:b,after}})()',true);return r});
   await check("glb.replace-character-file",async()=>{const w=getCharacterWindow?.();if(!visible(w)||typeof characterHost?.replaceCharacterForCi!=="function")return {pass:false,error:"CI GLB replacement API unavailable"};const source=path.join(app.getAppPath(),"assets","Saeed_AI-3D.glb");const alt=path.join(app.getPath("temp"),"Saeed-CI-Replacement.glb");try{fs.copyFileSync(source,alt);const result=await characterHost.replaceCharacterForCi(alt);await wait(1200);const after=await w.webContents.executeJavaScript('(()=>({bootstrap:window.saeed3DBootstrap,engine:window.saeedCharacterRuntime?.engine?.get3DStatus?.()}))()',true);return {pass:Boolean(result?.ok&&!after.bootstrap?.error),result,after}}finally{try{fs.unlinkSync(alt)}catch{}}});
   await check("glb.current-character-loaded",async()=>{const w=getCharacterWindow?.();if(!visible(w))return false;const r=await w.webContents.executeJavaScript('(()=>({bootstrap:window.saeed3DBootstrap,moduleLoaded:window.saeed3DBootstrap?.moduleLoaded!==false,engine:window.saeedCharacterRuntime?.engine?.get3DStatus?.()}))()',true);return {pass:Boolean(r.moduleLoaded&&!r.bootstrap?.error),detail:r}});
   await check("tray.single-owner-and-menu",async()=>{const t=getTray?.();if(!t)return false;const menu=t.getContextMenu?.();const labels=menu?.items?.map?.(x=>x.label)||[];return {pass:Boolean(t&&labels.length>=5),labels}});
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
