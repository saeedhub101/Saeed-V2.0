(()=>{
const defaults={breathing:true,blinking:true,expressions:true,speechFace:true,idle:true,walking:true,dancing:true,greeting:true,events:true,random:true,frequency:"normal",eventCooldownSec:30,autonomousMovement:true,idleThoughts:true,sleep:true,eyeTracking:true,sleepAfterMin:20,renderWakeMs:1200};
let config={...defaults},stateName="idle",energy=70,lastEnergy=Date.now(),lastActivity=Date.now(),lastEventAt=0,active=false,visible=true,timer=0,recent=[];
const has=n=>Boolean(window.saeedAvatar?.hasAnimation?.(n));
const wake=()=>window.saeedAvatar?.wakeRender?.(config.renderWakeMs);
const play=(n,opts={})=>{if(!active||!visible||!has(n))return false;const ok=window.saeedAvatar?.play?.(n,opts);if(ok){recent.push(n);if(recent.length>6)recent.shift();wake()}return Boolean(ok)};
const pick=pool=>{const v=(pool||[]).filter(has),f=v.filter(x=>!recent.includes(x));const a=f.length?f:v;return a.length?a[Math.floor(Math.random()*a.length)]:null};
const clear=()=>{if(timer){clearTimeout(timer);timer=0}};
const gap=()=>Math.max(0,Number(config.eventCooldownSec)||30)*1000;
const allowed=()=>{const n=Date.now();if(n-lastEventAt<gap())return false;lastEventAt=n;return true};
const decay=()=>{const m=(Date.now()-lastEnergy)/60000;lastEnergy=Date.now();energy=Math.max(20,energy-m*.5)};
const setState=s=>{stateName=s;clear()};
const finish=delay=>{timer=setTimeout(()=>{timer=0;if(active&&visible)setState("idle"),schedule()},Math.max(150,delay||500))};

const plans={
 curious:()=>{const seq=[["LookLeft",700],["LookRight",700],["LookUp",600]];runSequence(seq,"idle")},
 playful:()=>{const seq=[pick(["Idle1_1","Idle1_2","Idle2_1","GestureLeft"]),pick(["GestureRight","Pleased","Acknowledge"]),pick(["Idle1_3","Idle2_2","Idle3_1"])];runSequence(seq.map((n,i)=>[n,n?(650+Math.random()*450):0]),"idle")},
 tired:()=>{play(pick(["Idle2_1","Idle3_1","LookDown","RestPose"])||"RestPose",{duration:1400});finish(1800)},
 waking:()=>{const seq=[["RestPose",900],["LookLeft",650],["LookRight",650],["Pleased",700]];runSequence(seq,"idle")},
 reacting:()=>{const p=pick(["Acknowledge","Pleased","Surprised","GestureLeft","GestureRight"]);if(p)play(p,{duration:1100});finish(1400)}
};
function runSequence(seq,next="idle"){let i=0;const step=()=>{if(!active||!visible)return;while(i<seq.length&&!seq[i][0])i++;if(i>=seq.length){setState(next);if(next==="idle")schedule();return}const [n,d]=seq[i++];play(n,{duration:d});timer=setTimeout(()=>{timer=0;step()},d+120)};step()}
const context=()=>{decay();const now=new Date(),h=now.getHours(),idleMs=Date.now()-lastActivity;return{hour:h,period:h<6?"night":h<12?"morning":h<18?"day":"evening",idleMin:idleMs/60000,energy,visible,active,state:stateName,userActive:idleMs<90000,recent:recent.slice(),mood:window.saeedFeelings?.get?.()||"neutral"}};function chooseBehavior(){
 decay();
 const idleMin=(Date.now()-lastActivity)/60000;
 if(config.sleep&&idleMin>=Math.max(1,Number(config.sleepAfterMin)||20)){setState("sleeping");play("RestPose",{important:true,duration:1800});return}
 if(energy<35){setState("tired");plans.tired();return}
 const c=context();
 if(c.userActive){setState("idle");schedule();return}
 if(c.period==="night"&&c.idleMin>8){setState("tired");plans.tired();return}
 const r=Math.random();
 if(c.mood==="happy"&&r<.55){setState("playful");plans.playful()}
 else if(c.energy<50&&r<.45){setState("tired");plans.tired()}
 else if(r<.30){setState("curious");plans.curious()}
 else if(r<.52){setState("playful");plans.playful()}
 else if(r<.68){setState("reacting");plans.reacting()}
 else {setState("idle");schedule()}
}
function schedule(){
 clear();if(!active||!visible||stateName!=="idle"||!config.idle)return;
 const f=String(config.frequency||"normal"),[a,b]=f==="high"?[5000,12000]:f==="low"?[18000,36000]:[10000,24000];
 timer=setTimeout(()=>{timer=0;if(active&&visible&&stateName==="idle")chooseBehavior()},a+Math.random()*(b-a));
}
function showBubble(text){if(!active||!visible||stateName!=="idle"||context().userActive)return;window.saeedShowMessageBubble?.(text,false)}
function maybeBubble(){const c=context();if(!config.idleThoughts||!visible||stateName!=="idle"||c.userActive)return;if(Math.random()>0.18)return;const p=["Hmm...","I wonder what's next.","That was interesting.","Let's see..."];showBubble(p[Math.floor(Math.random()*p.length)])}
function touch(){
 lastActivity=Date.now();energy=Math.min(100,energy+15);
 if(stateName==="sleeping"){setState("waking");plans.waking();return}
 if(stateName!=="thinking"&&stateName!=="speaking"&&stateName!=="doing")setState("idle");
 if(active&&visible)schedule();
}
function start(){if(active)return;active=true;visible=true;lastActivity=Date.now();setState("idle");schedule()}
function stop(){active=false;visible=false;clear();try{window.saeedCharacterController?.stopAll?.()}catch{}}
function setVisible(v){visible=Boolean(v);clear();if(!visible){stateName="hidden";try{window.saeedCharacterController?.stopAll?.()}catch{};return}if(stateName==="hidden")stateName="idle";lastActivity=Date.now();if(active)schedule()}
function applySettings(s){config={...defaults,...(s?.characterBehavior||s||{})};if(active&&visible&&stateName==="idle")schedule()}
function event(e){
 if(!e)return;const t=typeof e==="string"?e:e.type;
 if(t==="settings"){applySettings(e.settings||{});return}
 touch();
 if(t==="speech-start"){setState("speaking");if(config.speechFace)play("Explain",{important:true})}
 else if(t==="speech-end"){setState("idle");schedule()}
 else if(t==="thinking"){setState("thinking");play("Think",{important:true})}
 else if(t==="answer"){setState("speaking");if(config.speechFace)play("Explain",{important:true})}
 else if(t==="tool"){if(!config.events||!allowed())return;setState("doing");play(({web_search:"Searching",add_task:"Write",complete_task:"Write",remove_task:"Write",list_tasks:"Read",remember:"Write",recall:"Read",move_to:"GestureRight",move_relative:"GestureRight",hide:"Hide",show:"Show"})[e.name]||"Process",{important:true})}
 else if(t==="tool_error"){setState("reacting");plans.reacting()}
 else if(t==="tool_result"&&config.events){setState("reacting");play(e.ok===false?pick(["Confused","Uncertain"]):pick(["Pleased","Acknowledge"]),{duration:1200});finish(1500)}
 else if(t==="user-input"&&config.events&&allowed()){const s=String(e.text||"").toLowerCase();const p=/\\bthanks?\\b|\\bthank you\\b/.test(s)?pick(["Pleased","Acknowledge"]):/\\b(wow|amazing|awesome)\\b/.test(s)?pick(["Surprised","Pleased"]):/\\b(what|why|how)\\b.*\\?/.test(s)?pick(["Confused","Uncertain"]):null;if(p){setState("reacting");play(p,{duration:1200});finish(1400)}}
 else if(t==="right-click"&&config.events&&allowed()){setState("reacting");play("Acknowledge",{important:true});finish(1500)}
 else if(t==="zoom"&&config.events&&allowed()){setState("reacting");play("Surprised",{duration:1200});finish(1500)}
 else if(t==="mood"&&e.mood)window.saeedFeelings?.set(e.mood);
}
function autonomousMotion(e){if(!config.autonomousMovement||!visible||stateName==="sleeping")return false;const type=String(e?.motion||e?.name||"");if(type==="wander"&&config.walking&&typeof window.saeedAvatar?.move==="function"){setState("reacting");window.saeedAvatar.move(Math.random()<.5?"left":"right",1600);finish(1800);return true}if(type){const p=pick([type,...(window.saeedFeelings?.palette?.()||[])]);if(p){setState("reacting");play(p,{duration:1400});finish(1600);return true}}return false}
window.saeedAnimationController={start,stop,touch,setIntent:setState,getIntent:()=>stateName,getEnergy:()=>{decay();return Math.round(energy)},getRenderWakeMs:()=>Math.max(120,Number(config.renderWakeMs)||1200),onEvent:event,autonomousMotion,applySettings,setVisible,state:()=>({intent:stateName,energy:Math.round(energy),idleMs:Date.now()-lastActivity,recent:recent.slice(),visible,config:{...config}})};
["pointerdown","pointermove","keydown","wheel"].forEach(t=>window.addEventListener(t,touch,{passive:true}));
window.saeed?.onEvent?.(event);
window.addEventListener("load",()=>void start());
})();