const $=id=>document.getElementById(id),messages=$("messages");
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function markdown(s){let x=escapeHtml(s);x=x.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/`([^`]+)`/g,"<code>$1</code>").split("\n").join("<br>");return x}
function add(role,text){const d=document.createElement("div");d.className="msg "+role;d.innerHTML=role==="assistant"?markdown(text):escapeHtml(text).split("\n").join("<br>");messages.appendChild(d);messages.scrollTop=messages.scrollHeight}
let busy=false,pendingImage=null,attachments=[];
let realtimeConnected=false;
// Voice output + lightweight real-time viseme driver.
let speechTimer=null;
const phonemeMap={a:"aa",e:"ee",i:"ee",o:"oh",u:"oo",y:"ee",b:"mbp",m:"mbp",p:"mbp",f:"fv",v:"fv",q:"oh",w:"oo",j:"ee"};
function visemeForChar(ch){return phonemeMap[String(ch||"").toLowerCase()]||"aa"}
function stopSpeaking(){if("speechSynthesis" in window)window.speechSynthesis.cancel();if(speechTimer){clearInterval(speechTimer);speechTimer=null}["aa","ee","oo","oh","fv","mbp"].forEach(v=>window.saeedAvatar?.setViseme(v,0));}
function speakSaeed(text){
 if(!text||!("speechSynthesis" in window))return;window.saeed.reportDiagnostic("INFO","TTS START","Local browser TTS started");
 stopSpeaking();
 const clean=String(text).replace(/[ *_#]/g,"");
 const u=new SpeechSynthesisUtterance(clean);u.lang="ar-SA";u.rate=.98;u.pitch=1;
 const chars=Array.from(clean);let pos=0,lastIndex=-1;
 u.onstart=()=>{
  window.saeedAvatar?.play("talk");
  speechTimer=setInterval(()=>{
   if(pos>=chars.length){clearInterval(speechTimer);speechTimer=null;return}
   const ch=chars[pos++];lastIndex=pos;
   const v=visemeForChar(ch);
   ["aa","ee","oo","oh","fv","mbp"].forEach(x=>window.saeedAvatar?.setViseme(x,0));
   window.saeedAvatar?.setViseme(v,/\s/.test(ch)?0:.72);
  },Math.max(45,70/u.rate));
 };
 u.onboundary=e=>{
  if(typeof e.charIndex!=="number"||e.charIndex<lastIndex)return;
  pos=Math.min(chars.length,e.charIndex);
 };
 u.onend=()=>{window.saeed.reportDiagnostic("INFO","TTS SUCCESS","Local browser TTS completed");stopSpeaking();window.saeedAvatar?.play("idle")};
 u.onerror=e=>{window.saeed.reportDiagnostic("ERROR","TTS LOCAL ERROR",e?.error||"Local TTS failed");stopSpeaking();window.saeedAvatar?.play("idle")};
 window.speechSynthesis.speak(u);
}

async function send(){
 if(busy)return;let t=$("input").value.trim();if(!t&&!attachments.length)return;
 if(attachments.length){t=(t?t+"\n\n":"")+"[مرفقات]\n"+attachments.map(a=>"--- "+a.name+" ---\n"+a.text).join("\n");attachments=[];renderAttachments()}
 busy=true;$("input").value="";add("user",t);$("status").textContent="يفكر...";
 const image=pendingImage;pendingImage=null;
 try{const answer=await window.saeed.chat(t,image);if(answer?.error)add("assistant","حدث خطأ: "+answer.error);else if(answer){add("assistant",answer);if(!realtimeConnected)speakSaeed(answer)}}
 catch(e){add("assistant","حدث خطأ: "+e.message)}
 finally{busy=false;$("status").textContent="جاهز"}
}
function renderAttachments(){$("attachments").textContent=attachments.length?attachments.map(a=>a.name).join(" • "):""}
$("send").onclick=send;
$("togglePanel").onclick=()=>{$("panel").classList.toggle("collapsed")};
$("input").ondblclick=()=>window.saeed.showChat();
$("input").onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}};
async function showSettings(){
 const s=await window.saeed.getSettings();if(!s)return;
 $("provider").value=s.provider||"openai";$("baseUrl").value=s.baseUrl||"";$("model").value=s.model||"gpt-5";
 $("key").value="";$("key").placeholder=s.hasApiKey?"Saved securely — leave blank to keep it":"Enter LLM API key";
 $("sttKey").value="";$("sttKey").placeholder=s.hasSttApiKey?"Saved securely — leave blank to keep it":"Enter STT API key";
 $("ttsKey").value="";$("ttsKey").placeholder=s.hasTtsApiKey?"Saved securely — leave blank to keep it":"Enter TTS API key";
 $("realtimeKey").value="";$("realtimeKey").placeholder=s.hasRealtimeApiKey?"Saved securely — leave blank to keep it":"Enter Realtime API key";
 $("brainMode").value=s.brainMode||"auto";$("sttProvider").value=s.sttProvider||"whisper";$("sttModel").value=s.sttModel||"base-q5_1";$("sttLanguage").value=s.sttLanguage||"auto";$("streamingMode").value=s.streamingMode||"local-whisper";
 $("ttsProvider").value=s.ttsProvider||"local";$("ttsModel").value=s.ttsModel||"gpt-4o-mini-tts";$("ttsVoice").value=s.ttsVoice||"alloy";
 $("realtimeModel").value=s.realtimeModel||"gpt-realtime-2.1";$("realtimeVoice").value=s.realtimeVoice||"marin";
 $("voiceProfile").value=s.voiceProfile||"saeed";$("micMode").value=s.micMode||"always";$("showSpeechText").checked=s.showSpeechText===true;$("speakResponses").checked=s.speakResponses!==false;$("language").value=s.language||"en";
 $("modal").classList.remove("hidden");
}
function activateSettingsTab(name){
 document.querySelectorAll(".settingsTabs button").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));
 document.querySelectorAll(".settingsTabContent").forEach(x=>x.classList.add("hidden"));
 $("tab-"+name)?.classList.remove("hidden");
}
document.querySelectorAll(".settingsTabs button").forEach(b=>b.onclick=()=>activateSettingsTab(b.dataset.tab));
function refreshApiKeyLabel(){const p=$("provider").value;const name=p==="openai"?"OpenAI / GPT":p==="anthropic"?"Anthropic / Claude":p==="gemini"?"Google / Gemini":"OpenAI-compatible";$("apiKeyLabel").textContent=name+" API Key";$("key").placeholder="Paste your "+name+" API key here"}
$("provider").onchange=()=>{$("baseUrlRow").classList.toggle("hidden",$("provider").value!=="openai-compatible");refreshApiKeyLabel()};
refreshApiKeyLabel();
$("sttProvider").onchange=()=>{$("sttKeyRow").classList.toggle("hidden",$("sttProvider").value!=="openai")};
$("ttsProvider").onchange=()=>{$("ttsKeyRow").classList.toggle("hidden",$("ttsProvider").value==="local")};
$("settings").onclick=showSettings;$("closeChat").onclick=()=>window.saeed.closeChat();window.saeed.onDiagnostic(e=>{if(e.level==="ERROR")add("tool","[DIAGNOSTIC] ERROR | "+e.stage+" | "+e.message)});window.saeed.onCharacterSelected(data=>window.saeedAvatarLoadData?.(data));
$("clearLlmKeys").onclick=async()=>{await window.saeed.setSettings({clearLlmKey:true});$("settingsStatus").textContent="LLM API key cleared";showSettings()};
$("clearAllKeys").onclick=async()=>{await window.saeed.setSettings({clearAllApiKeys:true});$("settingsStatus").textContent="All API keys cleared";showSettings()};
$("changeCharacter").onclick=()=>window.saeed.chooseCharacter();
const updatePanel=$("updatePanel");
function renderUpdatePanel(htmlText){if(!updatePanel)return;updatePanel.innerHTML=htmlText;updatePanel.classList.remove("hidden")}
function formatBytes(n){n=Number(n)||0;if(n<1024*1024)return Math.round(n/1024)+" KB";return (n/1024/1024).toFixed(1)+" MB"}
async function checkUpdatesUi(){renderUpdatePanel("<strong>Checking for updates...</strong>");try{const result=await window.saeed.checkForUpdates();if(!result?.ok)renderUpdatePanel("<strong>Update check failed</strong><div>"+(result?.message||"Unknown error")+"</div>")}catch(e){renderUpdatePanel("<strong>Update check failed</strong><div>"+e.message+"</div>")}}
$("checkUpdates").onclick=checkUpdatesUi;
window.saeed.onUpdateCheckUi(checkUpdatesUi);
window.saeed.onUpdateState((state,message)=>{if(state==="checking")renderUpdatePanel("<strong>Checking for updates...</strong>");else if(state==="latest")renderUpdatePanel("<strong>You are up to date.</strong>");else if(state==="downloading")renderUpdatePanel("<strong>Downloading update...</strong><div id="updateProgressText">Starting...</div><div class="updateProgress"><i id="updateProgressBar"></i></div>");else if(state==="error")renderUpdatePanel("<strong>Update error</strong><div>"+(message||"unknown error")+"</div>")});
window.saeed.onUpdateAvailable(info=>{renderUpdatePanel("<strong>New version "+info.version+" is available.</strong><div class="updateActions"><button id="updateNow">Update now</button><button id="updateLater">Update later</button></div>");$("updateNow").onclick=async()=>{renderUpdatePanel("<strong>Preparing download...</strong>");await window.saeed.downloadUpdate()};$("updateLater").onclick=()=>{$("updatePanel").classList.add("hidden")}});
window.saeed.onUpdateProgress(info=>{renderUpdatePanel("<strong>Downloading update...</strong><div id="updateProgressText">"+Math.round(info.percent||0)+"% — "+formatBytes(info.transferred)+" / "+formatBytes(info.total)+" — "+formatBytes(info.bytesPerSecond)+"/s</div><div class="updateProgress"><i id="updateProgressBar" style="width:"+Math.round(info.percent||0)+"%"></i></div>")});
window.saeed.onUpdateDownloaded(info=>{renderUpdatePanel("<strong>Update "+info.version+" downloaded.</strong><div>Ready to install.</div><div class="updateActions"><button id="installUpdate">Restart & Install</button><button id="updateLater">Install later</button></div>");$("installUpdate").onclick=()=>window.saeed.installUpdate();$("updateLater").onclick=()=>{$("updatePanel").classList.add("hidden")}});

$("testRealtime").onclick=async()=>{try{await window.saeed.startRealtime({});$("realtimeStatus").textContent="Realtime connection requested"}catch(e){$("realtimeStatus").textContent=e.message}};
$("testLLM").onclick=async()=>{$("llmStatus").textContent="LLM test is available through the configured provider."};
$("testSTT").onclick=async()=>{$("sttStatus").textContent="STT is configured for the selected provider."};
$("testTTS").onclick=async()=>{$("ttsStatus").textContent="TTS is configured for the selected provider."};
$("capture").onclick=async()=>{try{pendingImage=await window.saeed.capture();add("tool",pendingImage?"تم التقاط الشاشة. اكتب الآن ما تريد تحليله.":"تعذر التقاط الشاشة.")}catch(e){add("tool","تعذر التقاط الشاشة: "+e.message)}};
window.saeed.onScreenCapture(data=>{if(data){pendingImage=data;add("tool","التقاط الشاشة جاهز للرسالة التالية.")}});
window.saeed.onShowChat(()=>{$("panel").classList.remove("collapsed");$("panel").classList.add("visible")});
window.saeed.onShowSettings(showSettings);
window.saeed.onEvent(e=>{if(e.type==="tool")add("tool","تنفيذ: "+e.name);if(e.type==="tool_error")add("tool","فشل: "+e.name+" — "+e.error);if(e.type==="tool_result")$("status").textContent="تحقق من النتيجة...";if(e.type==="thinking"){ $("status").textContent="يخطط / ينفذ..."; window.saeedAvatar?.setState("think"); }if(e.type==="tool"){const n=String(e.name||"");if(n==="mouse_move")window.saeedAvatar?.gesture("happy")}if(e.type==="tool_result"){const n=String(e.name||"");if(n==="open_application"||n==="open_url")window.saeedAvatar?.stop()}if(e.type==="answer"){ $("status").textContent="جاهز"; window.saeedAvatar?.setState("talk"); window.saeedAvatar?.nod(); }});
$("settingsClose").onclick=()=>$("modal").classList.add("hidden");$("settingsCancel").onclick=()=>$("modal").classList.add("hidden");$("modal").addEventListener("click",e=>{if(e.target===$("modal"))$("modal").classList.add("hidden")});
async function handleDrop(files){let total=attachments.reduce((n,a)=>n+a.size,0);for(const f of [...files]){if(!/^(text\/(plain|csv|markdown)|application\/json|application\/xml)/i.test(f.type)&&!/[.](txt|md|csv|json|xml|log)$/i.test(f.name))continue;if(f.size>256*1024||total+f.size>1024*1024)continue;const text=await f.text();attachments.push({name:f.name,text,size:f.size});total+=f.size}renderAttachments()}
window.saeed.onConfirmation(async e=>{const label={write_file:"تعديل ملف",remove_task:"حذف مهمة",mouse_click:"نقرة بالماوس",type_text:"كتابة نص",key_press:"ضغط مفتاح"}[e.name]||e.name;const ok=confirm(`سعيد يريد تنفيذ: ${label}\n\n${JSON.stringify(e.args,null,2)}\n\nهل تسمح؟`);await window.saeed.respondConfirmation(e.id,ok);});
class RealtimeMic {
 constructor(){this.stream=null;this.ctx=null;this.source=null;this.processor=null;this.active=false;this.mode="always";this.playCtx=null;this.nextPlayTime=0}
 async start(mode="always"){
  this.mode=mode;window.saeed.reportDiagnostic("INFO","MIC START","Starting microphone",{mode});
  if(mode==="off"){this.stop();return}
  if(this.active)return;
  if(!navigator.mediaDevices?.getUserMedia)throw new Error("Microphone capture is unavailable in this Electron renderer.");
  try{
   this.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1}});
  }catch(e){
   window.saeed.reportDiagnostic("ERROR","MIC OPEN ERROR",e?.message||"Microphone permission/device request failed",{name:e?.name||"UnknownError"});
   throw new Error("Microphone could not be opened: "+(e?.message||e?.name||"permission/device error"));
  }
  const tracks=this.stream.getAudioTracks();
  if(!tracks.length){this.stream.getTracks().forEach(t=>t.stop());this.stream=null;throw new Error("No audio input track was returned by Windows/Electron.");}
  tracks[0].onended=()=>{this.active=false;window.saeed.reportDiagnostic("ERROR","MIC ENDED","Windows/Electron microphone track ended unexpectedly");};
  this.ctx=new AudioContext();
  this.source=this.ctx.createMediaStreamSource(this.stream);
  this.processor=this.ctx.createScriptProcessor(4096,1,1);
  this.processor.onaudioprocess=e=>{
   if(!this.active)return;
   const input=e.inputBuffer.getChannelData(0);let sum=0;for(let i=0;i<input.length;i++)sum+=input[i]*input[i];const rms=Math.sqrt(sum/Math.max(1,input.length));window.saeed.reportDiagnostic("INFO","MIC LEVEL","Microphone level "+Math.round(Math.min(1,rms*4)*100)+"%",{level:Math.min(1,rms*4)});const ratio=24000/this.ctx.sampleRate;
   const n=Math.max(1,Math.floor(input.length*ratio));
   const pcm=new Int16Array(n);
   for(let i=0;i<n;i++){const x=input[Math.min(input.length-1,Math.floor(i/ratio))];pcm[i]=Math.max(-1,Math.min(1,x))*32767}
   let binary="";const bytes=new Uint8Array(pcm.buffer);for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+0x8000,bytes.length)));
   window.saeed.sendRealtimeAudio(btoa(binary));
  };
  this.source.connect(this.processor);
  const mute=this.ctx.createGain();
  mute.gain.value=0;
  this.processor.connect(mute);
  mute.connect(this.ctx.destination);
  this.monitorGain=mute;
  this.active=true;window.saeed.reportDiagnostic("INFO","MIC ACTIVE","Microphone capture active",{mode:this.mode});
 }
 stop(){this.active=false;window.saeed.reportDiagnostic("INFO","MIC STOP","Microphone capture stopped");try{this.processor?.disconnect()}catch{}
  try{this.monitorGain?.disconnect()}catch{}
  try{this.source?.disconnect()}catch{}
  try{this.stream?.getTracks().forEach(t=>t.stop())}catch{}
  try{this.ctx?.close()}catch{}
  this.monitorGain=null;
  this.processor=null;this.source=null;this.stream=null;this.ctx=null;window.saeed.stopRealtime()}
 playPCM(base64){
  try{
   if(!this.playCtx)this.playCtx=new AudioContext();
   const raw=atob(base64),pcm=new Int16Array(raw.length/2);for(let i=0;i<pcm.length;i++)pcm[i]=raw.charCodeAt(i*2)|(raw.charCodeAt(i*2+1)<<8);
   const buffer=this.playCtx.createBuffer(1,pcm.length,24000),ch=buffer.getChannelData(0);for(let i=0;i<pcm.length;i++)ch[i]=pcm[i]/32768;
   const src=this.playCtx.createBufferSource();src.buffer=buffer;src.connect(this.playCtx.destination);
   const now=this.playCtx.currentTime;this.nextPlayTime=Math.max(now,this.nextPlayTime);src.start(this.nextPlayTime);this.nextPlayTime+=buffer.duration;
   window.saeedAvatar?.play("talk");
   src.onended=()=>{if(this.playCtx.currentTime>=this.nextPlayTime-.02)window.saeedAvatar?.play("idle")};
  }catch(e){window.saeed.reportDiagnostic("ERROR","TTS AUDIO PLAYBACK",e.message);console.warn("Realtime audio playback failed",e)}
 }
}
const realtimeMic=new RealtimeMic();
let realtimeAssistant="";
window.saeed.onRealtimeState(async(state,message)=>{
 const badge=$("micBadge");if(badge)badge.className="micBadge "+state;
 realtimeConnected=state==="connected";
 $("status").textContent=state==="connected"?"يستمع الآن":state==="connecting"?"يتصل بالصوت...":state==="not-configured"?"أدخل OpenAI API key":"الصوت: "+state;
 if(state==="connected"){
  window.saeed.reportDiagnostic("INFO","STT ACTIVE","Realtime speech-to-text connected");
  const cfg=await window.saeed.getSettings();const mode=cfg?.micMode||(cfg?.alwaysListening===false?"off":"always");
  if(mode!=="off" && cfg?.sttProvider!=="whisper")try{await realtimeMic.start(mode)}catch(e){$("status").textContent="تعذر تشغيل المايك: "+e.message}
 }
 // Realtime disconnects must NOT turn off Always Listening. The microphone is an independent service.
});
window.saeed.onRealtimeAudio(b=>realtimeMic.playPCM(b));
window.saeed.onRealtimeAssistantDelta(t=>{realtimeAssistant+=t;window.saeedAvatar?.play("talk");});
window.saeed.onRealtimeAssistantFinal(t=>{if(t){add("assistant",t);realtimeAssistant="";}});
window.saeed.onRealtimeUserFinal(t=>{if(t){window.saeed.reportDiagnostic("INFO","STT RECEIVE TEXT","Speech text received");if($("input").value.trim()==="")add("user",t)}});
window.saeed.onRealtimeError(e=>{window.saeed.reportDiagnostic("ERROR","REALTIME API ERROR",String(e));console.error("Realtime:",e);$("status").textContent="Realtime: "+e});
window.saeed.onMicMode(async mode=>{
 const m=String(mode||"always");
 try{if(m==="off"){realtimeMic.stop();const badge=$("micBadge");if(badge)badge.className="micBadge off";$("status").textContent="Microphone off";return;}
  await realtimeMic.start(m);
 }catch(e){const badge=$("micBadge");if(badge)badge.className="micBadge error";$("status").textContent="تعذر تشغيل المايك: "+e.message;window.saeed.reportDiagnostic("ERROR","MIC START FAILURE",e.message,{mode:m});}
});
window.addEventListener("load",async()=>{
 try{
  const cfg=await window.saeed.getSettings();
  const mode=cfg?.micMode||(cfg?.alwaysListening===false?"off":"always");
  if(mode!=="off"){
   try{await realtimeMic.start(mode)}catch(e){const badge=$("micBadge");if(badge)badge.className="micBadge error";$("status").textContent="تعذر تشغيل المايك: "+e.message;window.saeed.reportDiagnostic("ERROR","MIC STARTUP",e.message,{mode});}
  }
  if(cfg?.sttProvider==="whisper" && mode!=="off"){await window.saeed.startLocalWhisper();} else if(cfg?.brainMode==="realtime"&&(cfg?.hasRealtimeApiKey||cfg?.hasApiKey))await window.saeed.startRealtime({});
 }catch(e){console.warn("Voice startup:",e);window.saeed.reportDiagnostic("ERROR","VOICE STARTUP",e.message)}
});$("save").onclick=async()=>{
 const payload={provider:$("provider").value,baseUrl:$("baseUrl").value,model:$("model").value,brainMode:$("brainMode").value,
  sttProvider:$("sttProvider").value,sttModel:$("sttModel").value,sttLanguage:$("sttLanguage").value,streamingMode:$("streamingMode").value,
  ttsProvider:$("ttsProvider").value,ttsModel:$("ttsModel").value,ttsVoice:$("ttsVoice").value,
  realtimeModel:$("realtimeModel").value,realtimeVoice:$("realtimeVoice").value,
  voiceProfile:$("voiceProfile").value,micMode:$("micMode").value,alwaysListening:$("micMode").value==="always",showSpeechText:$("showSpeechText").checked,speakResponses:$("speakResponses").checked,language:$("language").value};
 const key=$("key").value.trim();if(key)payload.apiKey=key;
 const sttKey=$("sttKey").value.trim();if(sttKey)payload.sttApiKey=sttKey;
 const ttsKey=$("ttsKey").value.trim();if(ttsKey)payload.ttsApiKey=ttsKey;
 const realtimeKey=$("realtimeKey").value.trim();if(realtimeKey)payload.realtimeApiKey=realtimeKey;
 await window.saeed.setSettings(payload);
 $("settingsStatus").textContent="Applied";setTimeout(()=>$("modal").classList.add("hidden"),300);
};

window.saeed.onLocalSttState((state,message)=>{const badge=$("micBadge");if(badge)badge.className="micBadge "+state;$("status").textContent=state==="connected"?"Offline Whisper listening":state==="starting"?"Starting Offline Whisper...":state==="error"?"Whisper error: "+(message||"unknown"):"Offline Whisper: "+state;});
window.saeed.onLocalSttResult(async e=>{const text=String(e?.text||"").trim();if(!text)return;window.saeed.reportDiagnostic("INFO","LOCAL STT RECEIVE TEXT","Offline Whisper transcript received",{text});if($("input").value.trim()==="")add("user",text);try{const answer=await window.saeed.chat(text);if(answer?.error)add("assistant","حدث خطأ: "+answer.error);else if(answer){add("assistant",answer);speakSaeed(answer)}}catch(err){add("assistant","حدث خطأ: "+err.message)}});

const pttButton=$("pushToTalk");
let pttActive=false;
async function pttStart(e){e?.preventDefault();if(pttActive)return;const cfg=await window.saeed.getSettings();if(cfg?.micMode!=="ptt")return;pttActive=true;pttButton.classList.add("pttActive");$("status").textContent="Listening… release to send";try{await window.saeed.startLocalWhisper?.()}catch(err){pttActive=false;pttButton.classList.remove("pttActive");$("status").textContent="Mic error: "+err.message}}
async function pttStop(e){e?.preventDefault();if(!pttActive)return;pttActive=false;pttButton.classList.remove("pttActive");$("status").textContent="Processing…";await window.saeed.stopLocalWhisper?.()}
pttButton?.addEventListener("mousedown",pttStart);pttButton?.addEventListener("mouseup",pttStop);pttButton?.addEventListener("mouseleave",e=>{if(pttActive)pttStop(e)});pttButton?.addEventListener("touchstart",pttStart,{passive:false});pttButton?.addEventListener("touchend",pttStop,{passive:false});
