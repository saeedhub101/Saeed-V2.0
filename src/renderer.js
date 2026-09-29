const $=id=>document.getElementById(id),messages=$("messages");
let chatDragging=false,chatLastX=0,chatLastY=0;
const chatHeader=document.querySelector(".chatHeader");
chatHeader?.addEventListener("mousedown",e=>{if(e.button!==0||e.target.closest("button,.micBadge"))return;chatDragging=true;chatLastX=e.screenX;chatLastY=e.screenY;e.preventDefault()});
window.addEventListener("mousemove",e=>{if(!chatDragging)return;const dx=e.screenX-chatLastX,dy=e.screenY-chatLastY;chatLastX=e.screenX;chatLastY=e.screenY;window.saeed.moveChatBy?.(dx,dy)});
window.addEventListener("mouseup",()=>{chatDragging=false});
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function markdown(s){let x=escapeHtml(s);x=x.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/`([^`]+)`/g,"<code>$1</code>").split("\n").join("<br>");return x}
function add(role,text){const d=document.createElement("div");d.className="msg "+role;d.innerHTML=role==="assistant"?markdown(text):escapeHtml(text).split("\n").join("<br>");messages.appendChild(d);messages.scrollTop=messages.scrollHeight}
let busy=false,pendingImage=null,attachments=[];
let realtimeConnected=false;
async function send(){
 if(busy)return;let t=$("input").value.trim();if(!t&&!attachments.length)return;
 if(attachments.length){t=(t?t+"\n\n":"")+"[مرفقات]\n"+attachments.map(a=>"--- "+a.name+" ---\n"+a.text).join("\n");attachments=[];renderAttachments()}
 busy=true;$("input").value="";add("user",t);$("status").textContent="يفكر...";
 const image=pendingImage;pendingImage=null;
 try{const answer=await window.saeed.chat(t,image);if(answer?.error)add("assistant","حدث خطأ: "+answer.error);else if(answer)add("assistant",answer);}
 catch(e){add("assistant","حدث خطأ: "+e.message)}
 finally{busy=false;$("status").textContent="جاهز"}
}
function renderAttachments(){$("attachments").textContent=attachments.length?attachments.map(a=>a.name).join(" • "):""}
$("send").onclick=send;
$("togglePanel").onclick=()=>window.saeed.minimizeChat();
const chatPanel=$("panel");
let chatMouseIgnored=false;
function updateChatMousePassthrough(e){
 if(false||!chatPanel)return;
 const target=document.elementFromPoint(e.clientX,e.clientY);
 const inside=Boolean(target&&chatPanel.contains(target));
 const shouldIgnore=!inside;
 if(shouldIgnore!==chatMouseIgnored){
  chatMouseIgnored=shouldIgnore;
  window.saeed.setChatMousePassthrough(shouldIgnore);
 }
}
document.addEventListener("mousemove",updateChatMousePassthrough,{passive:true});
chatPanel?.addEventListener("mouseenter",()=>{chatMouseIgnored=false;window.saeed.setChatMousePassthrough(false)});
chatPanel?.addEventListener("mouseleave",()=>{chatMouseIgnored=true;window.saeed.setChatMousePassthrough(true)});
$("input").ondblclick=()=>window.saeed.showChat();
$("input").onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}};
$("closeChat").onclick=()=>window.saeed.closeChat();window.saeed.onDiagnostic(e=>{if(e.level==="ERROR")add("tool","[DIAGNOSTIC] ERROR | "+e.stage+" | "+e.message)});window.saeed.onCharacterSelected(data=>window.saeedAvatarLoadData?.(data));
$("capture").onclick=async()=>{try{pendingImage=await window.saeed.capture();add("tool",pendingImage?"تم التقاط الشاشة. اكتب الآن ما تريد تحليله.":"تعذر التقاط الشاشة.")}catch(e){add("tool","تعذر التقاط الشاشة: "+e.message)}};
window.saeed.onScreenCapture(data=>{if(data){pendingImage=data;add("tool","التقاط الشاشة جاهز للرسالة التالية.")}});
window.saeed.onShowChat(()=>{$("panel").classList.remove("collapsed");$("panel").classList.add("visible")});

window.saeed.onEvent(e=>{if(e.type==="tool")add("tool","تنفيذ: "+e.name);if(e.type==="tool_error")add("tool","فشل: "+e.name+" — "+e.error);if(e.type==="tool_result")$("status").textContent="تحقق من النتيجة...";if(e.type==="thinking"){ $("status").textContent="يخطط / ينفذ..."; window.saeedAvatar?.setState("think"); }if(e.type==="tool"){const n=String(e.name||"");if(n==="mouse_move")window.saeedAvatar?.gesture("happy")}if(e.type==="tool_result"){const n=String(e.name||"");if(n==="open_application"||n==="open_url")window.saeedAvatar?.stop()}if(e.type==="answer"){ $("status").textContent="جاهز"; window.saeedAvatar?.setState("talk"); window.saeedAvatar?.nod(); }});
async function handleDrop(files){let total=attachments.reduce((n,a)=>n+a.size,0);for(const f of [...files]){if(!/^(text\/(plain|csv|markdown)|application\/json|application\/xml)/i.test(f.type)&&!/[.](txt|md|csv|json|xml|log)$/i.test(f.name))continue;if(f.size>256*1024||total+f.size>1024*1024)continue;const text=await f.text();attachments.push({name:f.name,text,size:f.size});total+=f.size}renderAttachments()}
window.saeed.onConfirmation(async e=>{const label={write_file:"تعديل ملف",remove_task:"حذف مهمة",mouse_click:"نقرة بالماوس",type_text:"كتابة نص",key_press:"ضغط مفتاح"}[e.name]||e.name;const ok=confirm(`سعيد يريد تنفيذ: ${label}\n\n${JSON.stringify(e.args,null,2)}\n\nهل تسمح؟`);await window.saeed.respondConfirmation(e.id,ok);});
let realtimeAssistant="";
window.saeed.onRealtimeState((state,message)=>{const badge=$("micBadge");if(badge)badge.className="micBadge "+state;realtimeConnected=state==="connected";if(!false)$("status").textContent=state==="connected"?"الصوت متصل":state==="connecting"?"يتصل بالصوت...":state==="not-configured"?"أدخل OpenAI API key":"الصوت: "+state;});
window.saeed.onRealtimeAudio(()=>{});
window.saeed.onRealtimeAssistantDelta(t=>{realtimeAssistant+=t;window.saeedAvatar?.play("talk");});
window.saeed.onRealtimeAssistantFinal(t=>{if(t){add("assistant",t);realtimeAssistant="";}});
window.saeed.onRealtimeUserFinal(t=>{if(t&&!false){const clean=String(t).replace(/^[\s\.,!?؟،؛:。]+/u,"").trim();if($("input").value.trim()===""&&clean)add("user",clean)}});
window.saeed.onRealtimeError(e=>{window.saeed.reportDiagnostic("ERROR","REALTIME API ERROR",String(e));if(!false)$("status").textContent="Realtime: "+e});
window.addEventListener("load",async()=>{try{currentMicMode="off";$("status").textContent="Microphone off";document.querySelectorAll(".suggestions button").forEach(b=>b.onclick=()=>{$("input").value=b.dataset.prompt||"";send()});}catch(e){console.warn("Startup:",e);window.saeed.reportDiagnostic("ERROR","STARTUP",e.message)}});
window.saeed.onLocalSttState((state,message)=>{const badge=$("micBadge");if(badge)badge.className="micBadge "+state;$("status").textContent=state==="connected"?"Offline Whisper listening":state==="starting"?"Starting Offline Whisper...":state==="error"?"Whisper error: "+(message||"unknown"):"Offline Whisper: "+state;});

$("clearChat").onclick=async()=>{if(!confirm("Clear this conversation?"))return;try{const ok=await window.saeed.clearHistory();if(ok){messages.innerHTML='<div class="welcome"><div class="suggestions"><button data-prompt="Open File Explorer">Open File Explorer</button><button data-prompt="Show my computer information">Computer info</button><button data-prompt="Check my computer health">Computer health</button><button data-prompt="What is the local time?">Local time</button></div></div>';document.querySelectorAll(".suggestions button").forEach(b=>b.onclick=()=>{$("input").value=b.dataset.prompt||"";send()});$("status").textContent="Conversation cleared"}}catch(e){add("tool","Clear error: "+e.message)}};
