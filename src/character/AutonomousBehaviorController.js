const DEFAULT_IDLE_DELAY=7000;
const SLEEP_AFTER_MS=20*60*1000;
const RECENT_LIMIT=4;
const MIN_ENERGY=20;
const MOOD_DURATION_MS=26000;
const REACTION_GAP_MS=1400;
const TEXT_REACTIONS=[
 {id:"question",pattern:/(?:\b(why|how|what|when|where|who|which|can you|could you|would you|is it|are you|explain)\b|كيف|لماذا|ليش|شو|ماذا|متى|أين|وين|هل|اشرح)/i,mood:"curious",motion:"lookCloser",expression:"surprised"},
 {id:"excitement",pattern:/(?:\b(wow|awesome|fantastic|amazing|excited|love it|perfect|yes!)\b|واو|رائع جدا|ممتاز جدا|يا سلام|مذهل|متحمس)/i,mood:"cheerful",motion:"dance",expression:"happy"},
 {id:"sadness",pattern:/(?:\b(sad|upset|lonely|bad day|disappointed|sorry to hear)\b|حزين|زعلان|متضايق|وحيد|يوم سيء|آسف)/i,mood:"thoughtful",motion:"nod",expression:"sad"},
 {id:"affirmation",pattern:/(?:\b(yes|yeah|yep|correct|exactly|agreed|sure|okay|ok)\b|نعم|اه|آه|تمام|صحيح|بالضبط|موافق)/i,mood:"pleased",motion:"nod",expression:"happy"},
 {id:"disagreement",pattern:/(?:\b(no|nope|not really|disagree|incorrect|that's wrong)\b|لا|مش صحيح|غير صحيح|بالعكس|خطأ)/i,mood:"puzzled",motion:"shake",expression:"confused"},
 {id:"greeting",pattern:/(?:\b(hello|hi|hey|good morning|good evening)\b|مرحبا|اهلا|أهلا|السلام عليكم|صباح الخير|مساء الخير)/i,mood:"cheerful",motion:"wave",expression:"happy"},
 {id:"thanks",pattern:/(?:\b(thanks|thank you|thx|much appreciated)\b|شكرا|شكرًا|يسلمو|مشكور|ممتاز)/i,mood:"pleased",motion:"nod",expression:"happy"},
 {id:"praise",pattern:/(?:\b(great job|well done|amazing|awesome|brilliant|you are great)\b|رائع|مبدع|أحسنت|احسنت|ممتاز جدا)/i,mood:"mischievous",motion:"dance",expression:"happy"},
 {id:"frustration",pattern:/(?:\b(doesn't work|does not work|broken|wrong|annoying|frustrated|failed|error)\b|ما اشتغل|لا يعمل|خطأ|غلط|فاشل|مزعج)/i,mood:"thoughtful",motion:"think",expression:"confused"},
 {id:"farewell",pattern:/(?:\b(bye|goodbye|see you|good night)\b|تصبح على خير|مع السلامة|الى اللقاء|إلى اللقاء)/i,mood:"pleased",motion:"wave",expression:"happy"},
 {id:"confusion",pattern:/(?:\b(i don't understand|i do not understand|confused|what do you mean)\b|مش فاهم|مش فاهمة|لم أفهم|ماذا تقصد)/i,mood:"curious",motion:"think",expression:"confused"}
];

export class AutonomousBehaviorController{
 constructor(character){
  this.character=character;
  this.running=false;
  this.speakingTimer=null;
  this.thinkingTimer=null;
  this.lastEvent="startup";
  this.lastMotionReason="startup";
  this.lastMotionId=null;
  this.visible=true;
  this.timer=null;
  this.sleepTimer=null;
  this.blinkTimer=null;
  this.intent="idle";
  this.energy=70;
  this.lastEnergyAt=performance.now();
  this.lastInteraction=performance.now();
  this.sleeping=false;
  this.recent=[];
  this.lastMotionAt=0;
  this.cooldownMs=2500;
  this.mood="cheerful";this.baseMood="cheerful";this.moodUntil=0;this.lastReactionAt=0;this.lastReactionId=null;this.lastGazeAt=0;this.eventCounts=new Map();this.breathTime=0;this.settings={idle:true,blinking:true,expressions:true,speechFace:true,eyeTracking:true,autonomousMovement:true,random:true,idleThoughts:true,events:true,greeting:true,dancing:true,sleep:true,speakingCycle:true,thinkingCycle:true,frequencyMs:7000,eventCooldownMs:2500,sleepAfterMs:SLEEP_AFTER_MS};
 }
 start(){
  if(this.running)return;
  this.running=true;
  this.schedule(1800);
  this.armBlinkTimer();
  this.armSleepTimer();
 }
 stop(){
  this.running=false;
  this.clearTimer();
  this.clearSleepTimer();
  this.clearBlinkTimer();
  this.clearCycleTimers();
  this.sleeping=false;
 }
 clearTimer(){if(this.timer){clearTimeout(this.timer);this.timer=null}}
 clearSleepTimer(){if(this.sleepTimer){clearTimeout(this.sleepTimer);this.sleepTimer=null}}
 clearBlinkTimer(){if(this.blinkTimer){clearTimeout(this.blinkTimer);this.blinkTimer=null}}
 clearSpeakingTimer(){if(this.speakingTimer){clearTimeout(this.speakingTimer);this.speakingTimer=null}}
 clearThinkingTimer(){if(this.thinkingTimer){clearTimeout(this.thinkingTimer);this.thinkingTimer=null}}
 clearCycleTimers(){this.clearSpeakingTimer();this.clearThinkingTimer()}
 configure(settings={}){this.settings={...this.settings,...settings};this.cooldownMs=Math.max(0,Number(this.settings.eventCooldownMs)||2500);this.clearBlinkTimer();this.clearSleepTimer();if(this.settings.speakingCycle===false)this.clearSpeakingTimer();if(this.settings.thinkingCycle===false)this.clearThinkingTimer();if(this.running){this.armBlinkTimer();this.armSleepTimer();if(this.intent==="speaking"&&this.settings.speakingCycle!==false)this.scheduleSpeakingGesture();if(this.intent==="thinking"&&this.settings.thinkingCycle!==false)this.scheduleThinkingGesture()}return {...this.settings}}
 armBlinkTimer(){this.clearBlinkTimer();if(!this.running||!this.visible||this.sleeping||this.settings.blinking===false)return;const delay=3500+Math.random()*2500;this.blinkTimer=setTimeout(()=>{this.blinkTimer=null;if(!this.running||!this.visible||this.sleeping)return;this.character.face?.blink?.();this.armBlinkTimer()},delay)}
 setVisible(value){
  this.visible=value!==false&&String(value)!=="hidden";
  if(!this.visible){this.stop();return true}
  if(!this.running)this.start();
  this.schedule(1800);
  return true;
 }
 decayEnergy(){
  const now=performance.now(),minutes=Math.max(0,(now-this.lastEnergyAt)/60000);
  this.lastEnergyAt=now;
  if(this.sleeping){this.energy=Math.min(85,Math.max(this.energy,55+minutes*2));return}
  this.energy=Math.max(MIN_ENERGY,this.energy-minutes*.5);
 }
 gainEnergy(amount){this.decayEnergy();this.energy=Math.min(100,this.energy+amount)}
 touch(){
  this.lastInteraction=performance.now();
  this.gainEnergy(15);
  this.wakeIfSleeping();
  this.clearSleepTimer();
  this.armSleepTimer();
  if(this.visible)this.schedule(4500);
  return true;
 }
 wakeIfSleeping(){
  if(!this.sleeping)return false;
  this.sleeping=false;
  this.intent="reacting";
  this.gainEnergy(15);
  const wakeMotion=this.chooseContextMotion("wake")||"wave";
  this.character.play(wakeMotion,{duration:wakeMotion==="dance"?1.6:1.2,priority:45});
  this.schedule(2500);
  return true;
 }
 armSleepTimer(){
  this.clearSleepTimer();
  if(!this.running||!this.visible||this.sleeping||this.settings.sleep===false)return;
  this.sleepTimer=setTimeout(()=>{
   this.sleepTimer=null;
   if(!this.running||!this.visible)return;
   if(this.intent!=="idle"||performance.now()-this.lastInteraction<Math.max(60000,Number(this.settings.sleepAfterMs)||SLEEP_AFTER_MS)){
    this.armSleepTimer();
    return;
   }
   this.clearCycleTimers();
   this.sleeping=true;
   this.intent="sleeping";
   this.character.stopAll();
   this.character.play("sleep",{priority:60});
  },Math.max(60000,Number(this.settings.sleepAfterMs)||SLEEP_AFTER_MS));
 }
 chooseWeighted(candidates,weights={}){
  const available=[...new Set((candidates||[]).filter(id=>typeof id==="string"&&this.character?.animation?.registry?.get?.(id)&&!(this.settings.dancing===false&&id==="dance")))];
  if(!available.length)return null;
  const fresh=available.filter(id=>!this.recent.includes(id));
  const source=fresh.length?fresh:available;
  const total=source.reduce((sum,id)=>sum+Math.max(.05,Number(weights[id])||1),0);
  let roll=Math.random()*total;
  for(const id of source){roll-=Math.max(.05,Number(weights[id])||1);if(roll<=0){this.recent=[...this.recent.filter(x=>x!==id),id].slice(-RECENT_LIMIT);this.lastMotionId=id;return id}}
  const id=source[source.length-1];this.recent=[...this.recent.filter(x=>x!==id),id].slice(-RECENT_LIMIT);this.lastMotionId=id;return id;
 }
 chooseContextMotion(kind){
  const palettes={
   wake:{cheerful:["wave","nod","dance"],curious:["lookCloser","think","wave"],thoughtful:["nod","think"],mischievous:["wave","dance"],pleased:["wave","nod"],sleepy:["nod","stretch"],puzzled:["think","shake"],sad:["nod","think"]},
   success:{cheerful:["dance","clap","wave","nod"],curious:["clap","nod","lookCloser"],thoughtful:["nod","wave"],mischievous:["dance","clap","wave"],pleased:["dance","clap","nod"],sleepy:["nod","wave"],puzzled:["nod","wave"],sad:["nod","wave"]},
   failure:{cheerful:["think","shake","lookCloser"],curious:["think","lookCloser","shake"],thoughtful:["think","nod","shake"],mischievous:["shake","think"],pleased:["think","nod"],sleepy:["think","nod"],puzzled:["think","shake","lookCloser"],sad:["think","nod"]},
   thanks:{cheerful:["nod","wave"],curious:["nod","lookCloser"],thoughtful:["nod"],mischievous:["wave","nod"],pleased:["nod","wave","dance"],sleepy:["nod"],puzzled:["nod"],sad:["nod"]}
  };
  const candidates=palettes[kind]?.[this.mood]||palettes[kind]?.cheerful||[];
  const weights={dance:this.energy>=65?1.6:.45,clap:1.35,wave:1.2,nod:1.15,think:1.1,lookCloser:.95,shake:.8,stretch:.7};
  return this.chooseWeighted(candidates,weights);
 }
 chooseIdle(){
  const available=(this.character.moodPalette?.()||[]).filter(id=>this.character.animation?.registry?.get?.(id));
  if(!available.length)return null;
  const hour=new Date().getHours(),night=hour>=22||hour<6,morning=hour>=5&&hour<12;
  const lowEnergy=this.energy<40||night,highEnergy=this.energy>=70;
  const calm=new Set(["nod","think","yawn","stretch","lookCloser"]);
  const pool=lowEnergy?available.filter(id=>calm.has(id)):available;
  const weights={wave:1.1,nod:1.2,think:1.1,stretch:1,lookCloser:1.15,yawn:lowEnergy?1.8:.35,crackBack:.8,crackFingers:.85,dance:night?.2:(highEnergy&&morning?1.45:.7)};
  if(this.mood==="curious"){weights.lookCloser=(weights.lookCloser||1)*1.8;weights.think=(weights.think||1)*1.25}
  if(this.mood==="pleased"||this.mood==="cheerful"){weights.wave=(weights.wave||1)*1.35;weights.nod=(weights.nod||1)*1.2}
  if(this.mood==="thoughtful"||this.mood==="sad"||this.mood==="sleepy"){weights.yawn=(weights.yawn||1)*1.25;weights.dance=(weights.dance||1)*.25}
  this.lastMotionReason=night?"nighttime calm bias":lowEnergy?"low-energy calm bias":this.mood+" mood palette";
  return this.chooseWeighted(pool.length?pool:available,weights);
 }
 schedule(delay=DEFAULT_IDLE_DELAY){
  this.clearTimer();
  if(!this.running||!this.visible||this.sleeping)return;
  this.armBlinkTimer();
  const base=Math.max(1000,Number(delay)||Number(this.settings.frequencyMs)||DEFAULT_IDLE_DELAY);
  const energyFactor=Math.max(.65,Math.min(1.35,this.energy/70));
  const energyAdjusted=delay===DEFAULT_IDLE_DELAY?base/energyFactor:base;
  const jitter=delay===DEFAULT_IDLE_DELAY?(.72+Math.random()*.78):1;
  this.timer=setTimeout(()=>{this.timer=null;this.evaluateNow()},Math.round(energyAdjusted*jitter));
 }
 evaluateNow(){
  if(!this.running||!this.visible||this.sleeping||this.settings.idle===false)return false;
  if(this.settings.random===false||this.settings.idleThoughts===false||this.settings.autonomousMovement===false){this.schedule(DEFAULT_IDLE_DELAY);return false;}
  this.decayEnergy();
  if(["speaking","thinking","doing","being-moved"].includes(this.intent)){
   this.schedule(DEFAULT_IDLE_DELAY);
   return false;
  }
  this.restoreMoodIfDue();
  if(this.character.animation?.active?.length){this.schedule(DEFAULT_IDLE_DELAY);return false}
  if(performance.now()-this.lastMotionAt<this.cooldownMs){this.schedule(this.cooldownMs);return false}
  const id=this.chooseIdle();
  if(!id){this.schedule(DEFAULT_IDLE_DELAY);return false}
  this.intent="idle";
  this.lastMotionAt=performance.now();
  const intensity=Math.max(.25,Math.min(1,this.energy/70));
  const played=this.character.play(id,{priority:10,intensity});
  if(played&&this.settings.autonomousMovement!==false&&this.settings.eyeTracking!==false&&Math.random()<.68)this.lookAround();
  this.schedule(DEFAULT_IDLE_DELAY);
  return Boolean(played);
 }
 lookAround(){
  if(!this.character||this.sleeping)return false;
  const x=(Math.random()*2-1)*1.35;
  const y=1.35+Math.random()*.45;
  const z=.9+Math.random()*.7;
  const ok=Boolean(this.character.face?.lookAt?.(x,y,z));
  if(ok)this.intent="attending";
  return ok;
 }
 onUserInteraction(event={}){this.touch();return this.handleEvent(event)}
 onStateChanged(state){
  if(state?.intent){
   const next=String(state.intent).toLowerCase();
   if(next!=="speaking")this.clearSpeakingTimer();
   if(next!=="thinking")this.clearThinkingTimer();
   this.intent=next;
   if(next==="speaking")this.scheduleSpeakingGesture();
   if(next==="thinking")this.scheduleThinkingGesture();
  }
  if(state?.visible!==undefined)this.setVisible(state.visible);
 }
 onMoodChanged(mood,temporary=false){
  const valid=["cheerful","curious","thoughtful","mischievous","pleased","sleepy","puzzled","sad"];
  const next=String(mood||"cheerful").toLowerCase();
  this.mood=valid.includes(next)?next:"cheerful";
  this.character.mood=this.mood;
  if(!temporary){this.baseMood=this.mood;this.moodUntil=0}
  else this.moodUntil=performance.now()+MOOD_DURATION_MS;
  return this.mood;
 }
 restoreMoodIfDue(){
  if(this.moodUntil&&performance.now()>=this.moodUntil){
   this.moodUntil=0;
   this.onMoodChanged(this.baseMood,false);
   const faceMap={cheerful:"happy",curious:"surprised",thoughtful:"thinking",mischievous:"happy",pleased:"happy",sleepy:"sleepy",puzzled:"confused",sad:"sad"};
   this.character.face?.expression?.(faceMap[this.mood]||"neutral",.45);
  }
 }
 interruptLowPriorityMotions(){
  if(this.character?.authoring)return false;
  const active=[...(this.character?.animation?.active||[])];
  for(const item of active){if(Number(item?.priority??0)<=20&&item?.m?.id)this.character.animation.stop(item.m.id)}
  return active.length>0;
 }
 playMotion(motion,options={}){
  const registry=this.character?.animation?.registry;
  if(registry?.get&&!registry.get(motion))return false;
  return Boolean(this.character?.play?.(motion,options));
 }
 react(reaction){
  const now=performance.now();
  if(this.lastReactionId===reaction.id&&now-this.lastReactionAt<REACTION_GAP_MS)return false;
  this.lastReactionAt=now;this.lastReactionId=reaction.id;this.lastEvent="text:"+reaction.id;
  this.onMoodChanged(reaction.mood,true);
  this.character.face?.expression?.(reaction.expression,.78);
  this.intent="reacting";
  const duration=reaction.motion==="dance"?2.1:reaction.motion==="lookCloser"?1.8:1.25;
  return this.playMotion(reaction.motion,{duration,priority:42});
 }
 classifyText(text){
  const clean=String(text||"").trim();
  if(!clean)return null;
  return TEXT_REACTIONS.find(item=>item.pattern.test(clean))||null;
 }
 scheduleSpeakingGesture(){
  this.clearSpeakingTimer();
  if(!this.running||!this.visible||this.sleeping||this.intent!=="speaking"||this.settings.speakingCycle===false)return;
  const delay=4500+Math.random()*3500;
  this.speakingTimer=setTimeout(()=>{
   this.speakingTimer=null;
   if(!this.running||!this.visible||this.sleeping||this.intent!=="speaking")return;
   const id=this.chooseWeighted(["talkGesture","nod","lookCloser","wave"],{talkGesture:1.5,nod:1.2,lookCloser:.8,wave:.45});
   if(id&&(!this.character?.animation?.active||this.character.animation.active.length<2))this.playMotion(id,{duration:id==="talkGesture" ? .9 : .7,priority:18});
   this.scheduleSpeakingGesture();
  },delay);
 }
 scheduleThinkingGesture(){
  this.clearThinkingTimer();
  if(!this.running||!this.visible||this.sleeping||this.intent!=="thinking"||this.settings.thinkingCycle===false)return;
  const delay=2800+Math.random()*2200;
  this.thinkingTimer=setTimeout(()=>{
   this.thinkingTimer=null;
   if(!this.running||!this.visible||this.sleeping||this.intent!=="thinking")return;
   const id=this.chooseWeighted(["think","lookCloser","nod"],{think:1.5,lookCloser:1.1,nod:.4});
   if(id)this.playMotion(id,{duration:id==="lookCloser"?1.2:.85,priority:26});
   this.scheduleThinkingGesture();
  },delay);
 }
 handleEvent(event){
  const type=typeof event==="string"?event:String(event?.type||"").toLowerCase();
  if(!this.running||!this.visible)return false;
  this.lastEvent=type;
  if(type==="pointer-move"){
   if(this.settings.eyeTracking===false)return false;
   const now=performance.now();if(now-this.lastGazeAt<110)return false;this.lastGazeAt=now;
   const x=Math.max(-1,Math.min(1,Number(event?.x)||0)),y=Math.max(-1,Math.min(1,Number(event?.y)||0));
   const ok=Boolean(this.character.face?.lookAt?.(x*1.35,1.5-y*.25,1.2));if(ok)this.intent="attending";return ok;
  }
  const wasSleeping=this.sleeping;
  this.touch();
  if(type==="speech-start"||type==="assistant-speech-start"){
   this.clearThinkingTimer();
   this.interruptLowPriorityMotions();
   this.intent="speaking";
   this.character.face?.expression?.(this.mood==="sad"?"sad":"happy",.45);
   this.playMotion("talkGesture",{duration:.9,priority:25});
   this.scheduleSpeakingGesture();
   return true;
  }
  if(type==="speech-end"||type==="assistant-speech-end"||type==="speech-cancelled"||type==="mute"||type==="muted"||type==="audio-muted"||type==="voice-muted"){
   this.clearCycleTimers();
   this.intent="idle";
   this.character.face?.expression?.(this.mood==="sad"?"sad":"neutral",.5);
   this.schedule(3200);
   return true;
  }
  if(type==="thinking"||type==="assistant-thinking"||type==="tool-progress"){
   this.clearSpeakingTimer();
   this.interruptLowPriorityMotions();
   this.intent="thinking";
   this.playMotion("think",{duration:1.1,priority:35});
   this.scheduleThinkingGesture();
   return true;
  }
  if(type==="chat-end"||type==="assistant-cancelled"||type==="request-cancelled"){
   this.clearCycleTimers();
   this.intent="idle";
   this.schedule(1800);
   return true;
  }
  if(type==="user-input"||type==="user-message"||type==="user-transcript"){
   this.clearCycleTimers();
   this.interruptLowPriorityMotions();
   const text=String(typeof event==="object"?(event.text||event.message?.content||event.message||event.transcript||event.content||""):"").trim();
   const reaction=this.classifyText(text);
   if(reaction)return this.react(reaction);
   this.intent="attending";
   this.onMoodChanged("curious",true);
   this.character.face?.expression?.("surprised",.55);
   this.playMotion("think",{duration:1.35,priority:35});
   return true;
  }
  if(type==="assistant-message"||type==="assistant-response"||type==="voice-answer"){
   this.clearCycleTimers();
   const text=String(event?.text||event?.message?.content||event?.message||"");
   const reaction=this.classifyText(text);
   if(reaction)return this.react(reaction);
   this.intent="responding";
   this.character.face?.expression?.("happy",.5);
   this.playMotion("nod",{duration:.65,priority:32});
   return true;
  }
  if(type==="tool"||type==="tool-start"){
   this.clearCycleTimers();
   this.interruptLowPriorityMotions();
   this.intent="doing";
   this.character.face?.expression?.("thinking",.45);
   this.playMotion("think",{duration:1.4,priority:30});
   return true;
  }
  if(type==="tool_result"||type==="tool-success"||type==="task-complete"){
   this.clearCycleTimers();
   this.intent="reacting";
   this.onMoodChanged("pleased",true);
   this.character.face?.expression?.("happy",.65);
   const motion=this.chooseContextMotion("success")||"nod";
   this.playMotion(motion,{duration:motion==="dance"?1.6:.75,priority:40});
   return true;
  }
  if(type==="tool_error"||type==="tool-failure"){
   this.clearCycleTimers();
   this.intent="reacting";
   this.onMoodChanged("thoughtful",true);
   this.character.face?.expression?.("sad",.55);
   this.playMotion("shake",{duration:.7,priority:40});
   return true;
  }
  if(type==="double-click"||type==="right-click"||type==="summon"){
   if(wasSleeping)return true;
   this.onMoodChanged("cheerful",true);
   this.character.face?.expression?.("happy",.7);
   const motion=this.chooseContextMotion("wake")||"wave";
   this.playMotion(motion,{duration:motion==="dance"?1.6:1.2,priority:45});
   return true;
  }
  if(type==="zoom"||type==="hover"){
   this.character.face?.expression?.("curious",.5);
   this.playMotion("lookCloser",{duration:1.7,priority:35});
   return true;
  }
  if(type==="drag-start"){
   this.clearTimer();
   this.clearCycleTimers();
   this.interruptLowPriorityMotions();
   this.intent="being-moved";
   this.character.face?.expression?.("surprised",.35);
   return true;
  }
  if(type==="drag-end"){
   this.intent="reacting";
   this.playMotion("nod",{duration:.65,priority:30});
   this.schedule(1200);
   return true;
  }
  if(type==="app-focus"||type==="wake"){
   if(wasSleeping)return true;
   this.playMotion(this.chooseContextMotion("wake")||"wave",{duration:1,priority:30});
   return true;
  }
  if(type==="app-blur"||type==="idle-timeout"){
   this.intent="idle";
   return true;
  }
  return false;
 }
 update(dt=.016){this.breathTime+=Math.max(0,Number(dt)||0);if(this.running&&this.settings.breathing!==false&&!this.sleeping&&this.visible){const a=Math.sin(this.breathTime*1.7)*0.018;this.character.engine?.setRestRelativeBoneRotation?.("chest",{x:a});this.character.engine?.setRestRelativeBoneRotation?.("spine",{x:a*.65});}}
 getStatus(){
  this.decayEnergy();
  return {running:this.running,visible:this.visible,intent:this.intent,mood:this.mood,energy:Math.round(this.energy),timeOfDay:(()=>{const h=new Date().getHours();return h>=5&&h<12?"morning":h>=12&&h<17?"afternoon":h>=17&&h<22?"evening":"night"})(),sleeping:this.sleeping,recent:[...this.recent],lastInteraction:this.lastInteraction,lastEvent:this.lastEvent,lastMotionId:this.lastMotionId,lastMotionReason:this.lastMotionReason,speakingCycle:Boolean(this.speakingTimer),thinkingCycle:Boolean(this.thinkingTimer)};
 }
 destroy(){this.stop();this.character=null}
}
