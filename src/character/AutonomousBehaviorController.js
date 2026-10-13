const DEFAULT_IDLE_DELAY=7000;
const SLEEP_AFTER_MS=60*60*1000;
const RECENT_LIMIT=4;
const MIN_ENERGY=20;
const MOOD_DURATION_MS=26000;
const REACTION_GAP_MS=1400;
const TEXT_REACTIONS=[
 {id:"question",pattern:/(?:\b(why|how|what|when|where|who|which|can you|could you|would you|is it|are you|explain)\b|كيف|لماذا|ليش|شو|ماذا|متى|أين|وين|هل|اشرح)/i,mood:"curious",motion:"lookCloser",expression:"curious"},
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
  this.mood="cheerful";this.baseMood="cheerful";this.moodUntil=0;this.lastReactionAt=0;this.eventCounts=new Map();this.breathTime=0;this.settings={idle:true,blinking:true,expressions:true,speechFace:true,eyeTracking:true,autonomousMovement:true,frequencyMs:7000,eventCooldownMs:2500,sleepAfterMs:3600000};
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
  this.sleeping=false;
 }
 clearTimer(){if(this.timer){clearTimeout(this.timer);this.timer=null}}
 clearSleepTimer(){if(this.sleepTimer){clearTimeout(this.sleepTimer);this.sleepTimer=null}}
 clearBlinkTimer(){if(this.blinkTimer){clearTimeout(this.blinkTimer);this.blinkTimer=null}}
 configure(settings={}){this.settings={...this.settings,...settings};this.cooldownMs=Math.max(0,Number(this.settings.eventCooldownMs)||2500);this.clearBlinkTimer();this.clearSleepTimer();if(this.running){this.armBlinkTimer();this.armSleepTimer()}return {...this.settings}}
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
  this.character.play("wave",{duration:1.2,priority:45});
  this.schedule(2500);
  return true;
 }
 armSleepTimer(){
  this.clearSleepTimer();
  if(!this.running||!this.visible||this.sleeping)return;
  this.sleepTimer=setTimeout(()=>{
   this.sleepTimer=null;
   if(!this.running||!this.visible)return;
   this.sleeping=true;
   this.intent="sleeping";
   this.character.stopAll();
   this.character.play("sleep",{priority:60});
  },Math.max(60000,Number(this.settings.sleepAfterMs)||SLEEP_AFTER_MS));
 }
 chooseIdle(){
  const available=(this.character.moodPalette?.()||[]).filter(id=>this.character.animation?.registry?.get(id));
  if(!available.length)return null;
  const hour=new Date().getHours();
  const night=hour>=22||hour<7;
  const lowEnergy=this.energy<45||night;
  const calm=new Set(["nod","think","yawn","stretch","lookCloser"]);
  const pool=lowEnergy?available.filter(id=>calm.has(id)):available;
  const choices=pool.length?pool:available;
  const fresh=choices.filter(id=>!this.recent.includes(id));
  const source=fresh.length?fresh:choices;
  const weights={wave:1.15,nod:1.35,think:1.1,stretch:1.05,lookCloser:1.15,yawn:lowEnergy?1.7:.45,crackBack:.8,crackFingers:.85,dance:night?.25:0.65};
  const weighted=source.map(motion=>({motion,weight:Math.max(.05,weights[motion]||1)}));
  const total=weighted.reduce((sum,item)=>sum+item.weight,0);
  let roll=Math.random()*total,id=weighted[weighted.length-1].motion;
  for(const item of weighted){roll-=item.weight;if(roll<=0){id=item.motion;break}}
  this.recent=[...this.recent.filter(x=>x!==id),id].slice(-RECENT_LIMIT);
  return id;
 }
 schedule(delay=DEFAULT_IDLE_DELAY){
  this.clearTimer();
  if(!this.running||!this.visible||this.sleeping)return;
  this.armBlinkTimer();
  const base=Math.max(1000,Number(delay)||Number(this.settings.frequencyMs)||DEFAULT_IDLE_DELAY);
  const jitter=delay===DEFAULT_IDLE_DELAY?(.72+Math.random()*.78):1;
  this.timer=setTimeout(()=>{this.timer=null;this.evaluateNow()},Math.round(base*jitter));
 }
 evaluateNow(){
  if(!this.running||!this.visible||this.sleeping||this.settings.idle===false)return false;
  this.decayEnergy();
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
 onStateChanged(state){if(state?.intent)this.intent=String(state.intent);if(state?.visible!==undefined)this.setVisible(state.visible)}
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
   const faceMap={cheerful:"happy",curious:"curious",thoughtful:"thinking",mischievous:"happy",pleased:"happy",sleepy:"sleepy",puzzled:"confused",sad:"sad"};
   this.character.face?.expression?.(faceMap[this.mood]||"neutral",.45);
  }
 }
 playMotion(motion,options={}){
  const registry=this.character?.animation?.registry;
  if(registry?.get&&!registry.get(motion))return false;
  return Boolean(this.character?.play?.(motion,options));
 }
 react(reaction){
  const now=performance.now();
  if(now-this.lastReactionAt<REACTION_GAP_MS)return false;
  this.lastReactionAt=now;
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
 handleEvent(event){
  const type=typeof event==="string"?event:String(event?.type||"").toLowerCase();
  if(!this.running||!this.visible)return false;
  this.touch();
  if(type==="speech-start"){
   this.intent="speaking";
   this.character.face?.expression?.(this.mood==="sad"?"sad":"happy",.45);
   this.playMotion("talkGesture",{duration:.9,priority:25});
   return true;
  }
  if(type==="speech-end"){
   this.intent="idle";
   this.character.face?.expression?.(this.mood==="sad"?"sad":"neutral",.5);
   this.schedule(3200);
   return true;
  }
  if(type==="thinking"||type==="assistant-thinking"){
   this.intent="thinking";
   this.playMotion("think",{duration:2.2,priority:35});
   return true;
  }
  if(type==="user-input"||type==="user-message"||type==="user-transcript"){
   const text=String(typeof event==="object"?(event.text||event.message?.content||event.message||event.transcript||event.content||""):"").trim();
   const reaction=this.classifyText(text);
   if(reaction)return this.react(reaction);
   this.intent="attending";
   this.onMoodChanged("curious",true);
   this.character.face?.expression?.("curious",.55);
   this.playMotion("think",{duration:1.35,priority:35});
   return true;
  }
  if(type==="assistant-message"||type==="assistant-response"||type==="voice-answer"){
   const text=String(event?.text||event?.message?.content||event?.message||"");
   const reaction=this.classifyText(text);
   if(reaction)return this.react(reaction);
   this.intent="responding";
   this.character.face?.expression?.("happy",.5);
   this.playMotion("nod",{duration:.65,priority:32});
   return true;
  }
  if(type==="tool"||type==="tool-start"){
   this.intent="doing";
   this.character.face?.expression?.("thinking",.45);
   this.playMotion("think",{duration:1.4,priority:30});
   return true;
  }
  if(type==="tool_result"||type==="tool-success"||type==="task-complete"){
   this.intent="reacting";
   this.onMoodChanged("pleased",true);
   this.character.face?.expression?.("happy",.65);
   this.playMotion(Math.random()<.28?"dance":"nod",{duration:.75,priority:40});
   return true;
  }
  if(type==="tool_error"||type==="tool-failure"){
   this.intent="reacting";
   this.onMoodChanged("thoughtful",true);
   this.character.face?.expression?.("sad",.55);
   this.playMotion("shake",{duration:.7,priority:40});
   return true;
  }
  if(type==="double-click"||type==="right-click"||type==="summon"){
   this.onMoodChanged("cheerful",true);
   this.character.face?.expression?.("happy",.7);
   this.playMotion("wave",{duration:1.2,priority:45});
   return true;
  }
  if(type==="zoom"||type==="hover"){
   this.character.face?.expression?.("curious",.5);
   this.playMotion("lookCloser",{duration:1.7,priority:35});
   return true;
  }
  if(type==="drag-start"){
   this.intent="being-moved";
   this.character.face?.expression?.("surprised",.35);
   return true;
  }
  if(type==="drag-end"){
   this.intent="reacting";
   this.playMotion("nod",{duration:.65,priority:30});
   return true;
  }
  if(type==="app-focus"||type==="wake"){
   if(this.sleeping)this.wakeIfSleeping();
   else this.playMotion("wave",{duration:1,priority:30});
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
  return {running:this.running,visible:this.visible,intent:this.intent,energy:Math.round(this.energy),sleeping:this.sleeping,recent:[...this.recent],lastInteraction:this.lastInteraction};
 }
 destroy(){this.stop();this.character=null}
}
