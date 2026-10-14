const DEFAULT_IDLE_DELAY=7000;
const SLEEP_AFTER_MS=20*60*1000;
const RECENT_LIMIT=6;
const MIN_ENERGY=20;
const MOOD_DURATION_MS=26000;
const REACTION_GAP_MS=1400;
const TEXT_REACTIONS=[
 {id:"worry",pattern:/(?:\b(worried|anxious|nervous|scared|afraid|concerned|i am stressed|i'm stressed)\b|قلقان|قلقة|متوتر|متوترة|خائف|خايف|خايفة|أشعر بالقلق|اشعر بالقلق|حاسس بضغط)/i,mood:"thoughtful",motion:"think",expression:"sad"},
 {id:"anger",pattern:/(?:\b(i am angry|i'm angry|furious|pissed off|fed up|this is ridiculous)\b|أنا غاضب|انا غاضب|معصب|مستفز|طفح الكيل|هذا سخيف)/i,mood:"thoughtful",motion:"think",expression:"confused"},
 {id:"empathy",pattern:/(?:\b(having a hard time|rough day|i feel terrible|i feel bad|i am struggling|i'm struggling)\b|يوم صعب|أشعر بالسوء|اشعر بالسوء|تعبان نفسيا|أعاني|اعاني|الأمور صعبة|الامور صعبة)/i,mood:"thoughtful",motion:"nod",expression:"sad"},
 {id:"celebration",pattern:/(?:\b(i did it|we did it|finally worked|it worked|problem solved|we made it)\b|نجحت|زبطت|اشتغل|انحلت المشكلة|حليناها|أخيرا نجح|اخيرا نجح)/i,mood:"cheerful",motion:"clap",expression:"happy"},
 {id:"curiosity",pattern:/(?:\b(i wonder|interesting|tell me more|i am curious|i'm curious)\b|مثير للاهتمام|احكيلي أكثر|احكيلي اكثر|أخبرني المزيد|اخبرني المزيد|عندي فضول|غريب فعلا)/i,mood:"curious",motion:"lookCloser",expression:"surprised"},

 {id:"urgency",pattern:/(?:\b(urgent|asap|emergency|quickly|hurry|right now)\b|بسرعة|مستعجل|ضروري جدا|ضروري|حالا|فورا|مستعجل جدا)/i,mood:"puzzled",motion:"lookCloser",expression:"surprised"},
 {id:"apology",pattern:/(?:\b(i am sorry|i'm sorry|my apologies|forgive me|sorry about that)\b|آسف|اسف|أعتذر|اعتذر|سامحني|حقك علي)/i,mood:"thoughtful",motion:"nod",expression:"sad"},
 {id:"encouragement",pattern:/(?:\b(you can do it|keep going|don't give up|well try again|you've got this)\b|تقدر|استمر|لا تستسلم|حاول مرة أخرى|أنت قادر)/i,mood:"cheerful",motion:"nod",expression:"happy"},
 {id:"affection",pattern:/(?:\b(i appreciate you|you are the best|love you|proud of you)\b|أحبك|بحبك|أقدرك|فخور بك|انت الأفضل|أنت الأفضل)/i,mood:"pleased",motion:"wave",expression:"happy"},
 {id:"boredom",pattern:/(?:\b(bored|boring|nothing to do|i'm tired of this)\b|طفشان|مللت|ممل|زهقان|لا يوجد شيء أفعله)/i,mood:"sleepy",motion:"stretch",expression:"sleepy"},
 {id:"confusion",pattern:/(?:\b(i don't understand|i do not understand|confused|what do you mean)\b|مش فاهم|مش فاهمة|لم أفهم|ماذا تقصد)/i,mood:"curious",motion:"think",expression:"confused"},
 {id:"question",pattern:/(?:\b(why|how|what|when|where|who|which|can you|could you|would you|is it|are you|explain|what do you think)\b|كيف|لماذا|ليش|شو|ماذا|متى|أين|اين|وين|ازاي|شلون|اشلون|هل|اشرح)/i,mood:"curious",motion:"lookCloser",expression:"surprised"},
 {id:"excitement",pattern:/(?:\b(wow|awesome|fantastic|amazing|excited|love it|perfect|yes!)\b|واو|رائع جدا|ممتاز جدا|يا سلام|مذهل|متحمس)/i,mood:"cheerful",motion:"dance",expression:"happy"},
 {id:"sadness",pattern:/(?:\b(sad|upset|lonely|bad day|disappointed|sorry to hear)\b|حزين|زعلان|متضايق|وحيد|يوم سيء|آسف)/i,mood:"thoughtful",motion:"nod",expression:"sad"},
 {id:"affirmation",pattern:/(?:\b(yes|yeah|yep|correct|exactly|agreed|sure|okay|ok)\b|نعم|اه|آه|تمام|صحيح|بالضبط|موافق)/i,mood:"pleased",motion:"nod",expression:"happy"},
 {id:"disagreement",pattern:/(?:\b(no|nope|not really|disagree|incorrect|that's wrong)\b|لا|مش صحيح|غير صحيح|بالعكس|خطأ)/i,mood:"puzzled",motion:"shake",expression:"confused"},
 {id:"greeting",pattern:/(?:\b(hello|hi|hey|good morning|good evening)\b|مرحبا|اهلا|أهلا|السلام عليكم|صباح الخير|مساء الخير)/i,mood:"cheerful",motion:"wave",expression:"happy"},
 {id:"thanks",pattern:/(?:\b(thanks|thank you|thx|much appreciated)\b|شكرا|شكرًا|يسلمو|مشكور)/i,mood:"pleased",motion:"nod",expression:"happy"},
 {id:"praise",pattern:/(?:\b(great job|well done|amazing|awesome|brilliant|you are great)\b|رائع|مبدع|أحسنت|احسنت|ممتاز جدا)/i,mood:"mischievous",motion:"dance",expression:"happy"},
 {id:"frustration",pattern:/(?:\b(doesn't work|does not work|broken|wrong|annoying|frustrated|failed|error)\b|ما اشتغل|لا يعمل|خطأ|غلط|فاشل|مزعج)/i,mood:"thoughtful",motion:"think",expression:"confused"},
 {id:"farewell",pattern:/(?:\b(bye|goodbye|see you|good night)\b|تصبح على خير|مع السلامة|الى اللقاء|إلى اللقاء)/i,mood:"pleased",motion:"wave",expression:"happy"},
];

export class AutonomousBehaviorController{
 constructor(character){
  this.character=character;
  this.running=false;
  this.paused=false;
  // Treat the character as focused at startup; explicit lifecycle events can pause/resume it.
  this.speakingTimer=null;
  this.thinkingTimer=null;
  this.reactionTimer=null;
  this.lastEvent="startup";
  this.lastMotionReason="startup";
  this.lastMotionId=null;
  this.visible=true;
  this.windowFocused=true;
  this.userBusy=false;
  this.timer=null;
  this.sleepTimer=null;
  this.blinkTimer=null;
  this.intent="idle";
  this.energy=70;
  this.lastEnergyAt=performance.now();
  this.sleepStartedAt=0;
  this.lastInteraction=performance.now();
  this.sleeping=false;
  this.recent=[];
  this.lastMotionAt=0;
  this.lastCasualMotionAt=0;
  this.cooldownMs=2500;
  this.mood="cheerful";this.baseMood="cheerful";this.moodUntil=0;this.lastReactionAt=0;this.lastReactionId=null;this.lastGazeAt=0;this.lastUserText="";this.lastUserTextAt=0;this.interactionCooldowns=new Map();this.eventCounts=new Map();this.breathTime=0;this.settings={idle:true,blinking:true,expressions:true,speechFace:true,eyeTracking:true,autonomousMovement:true,random:true,idleThoughts:true,events:true,greeting:true,dancing:true,sleep:true,speakingCycle:true,thinkingCycle:true,moodPalettes:true,energyModulation:true,frequencyMs:7000,eventCooldownMs:2500,sleepAfterMs:SLEEP_AFTER_MS};
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
  this.sleepStartedAt=0;
 }
 clearTimer(){if(this.timer){clearTimeout(this.timer);this.timer=null}}
 clearSleepTimer(){if(this.sleepTimer){clearTimeout(this.sleepTimer);this.sleepTimer=null}}
 clearBlinkTimer(){if(this.blinkTimer){clearTimeout(this.blinkTimer);this.blinkTimer=null}}
 clearSpeakingTimer(){if(this.speakingTimer){clearTimeout(this.speakingTimer);this.speakingTimer=null}}
 clearThinkingTimer(){if(this.thinkingTimer){clearTimeout(this.thinkingTimer);this.thinkingTimer=null}}
 clearReactionTimer(){if(this.reactionTimer){clearTimeout(this.reactionTimer);this.reactionTimer=null}}
 clearCycleTimers(){this.clearSpeakingTimer();this.clearThinkingTimer();this.clearReactionTimer()}
 scheduleReactionFinish(delay=2200){
  this.clearReactionTimer();
  this.reactionTimer=setTimeout(()=>{
   this.reactionTimer=null;
   if(this.running&&this.visible&&this.intent==="reacting"){
    this.intent="idle";
    this.schedule(900);
    this.armSleepTimer();
   }
  },Math.max(500,Number(delay)||2200));
 }
 setExpression(name,intensity=.5){if(this.settings.expressions===false)return false;return Boolean(this.character?.face?.expression?.(name,intensity))}
 setSpeechExpression(name,intensity=.5){if(this.settings.speechFace===false)return false;return this.setExpression(name,intensity)}
 expressionForMood(){return ({cheerful:"happy",curious:"surprised",thoughtful:"thinking",mischievous:"happy",pleased:"happy",sleepy:"sleepy",puzzled:"confused",sad:"sad"})[this.mood]||"neutral"}
 configure(settings={}){this.settings={...this.settings,...settings};this.cooldownMs=Math.max(0,Number(this.settings.eventCooldownMs)||2500);this.clearBlinkTimer();this.clearSleepTimer();if(this.settings.speakingCycle===false)this.clearSpeakingTimer();if(this.settings.thinkingCycle===false)this.clearThinkingTimer();if(this.running){this.armBlinkTimer();this.armSleepTimer();if(this.intent==="speaking"&&this.settings.speakingCycle!==false)this.scheduleSpeakingGesture();if(this.intent==="thinking"&&this.settings.thinkingCycle!==false)this.scheduleThinkingGesture()}return {...this.settings}}
 armBlinkTimer(){this.clearBlinkTimer();if(!this.running||this.paused||!this.visible||this.sleeping||this.settings.blinking===false)return;const delay=3500+Math.random()*2500;this.blinkTimer=setTimeout(()=>{this.blinkTimer=null;if(!this.running||this.paused||!this.visible||this.sleeping)return;this.character.face?.blink?.();this.armBlinkTimer()},delay)}
 setPaused(value){
  const paused=Boolean(value);
  if(this.paused===paused)return true;
  this.paused=paused;
  if(paused){this.clearTimer();this.clearSleepTimer();this.clearBlinkTimer();this.clearCycleTimers();this.lastMotionReason="paused: character animation disabled";return true;}
  if(this.running&&this.visible){this.armBlinkTimer();this.armSleepTimer();if(this.intent==="speaking")this.scheduleSpeakingGesture();if(this.intent==="thinking")this.scheduleThinkingGesture();this.schedule(1200);}
  return true;
 }
 setUserBusy(value){
  const busy=Boolean(value);
  if(this.userBusy===busy)return true;
  this.userBusy=busy;
  if(busy){
   this.clearTimer();
   this.clearSleepTimer();
   this.clearCycleTimers();
   this.interruptLowPriorityMotions();
   if(!["speaking","thinking","doing","reacting","being-moved"].includes(this.intent)){this.intent="busy";}
   this.lastMotionReason="paused: user/system activity";
   return true;
  }
  if(this.intent==="busy")this.intent="idle";
  if(this.running&&this.visible&&this.windowFocused&&!this.sleeping){this.armBlinkTimer();this.armSleepTimer();if(this.intent==="speaking")this.scheduleSpeakingGesture();if(this.intent==="thinking")this.scheduleThinkingGesture();this.schedule(1200);}
  return true;
 }
 setWindowFocused(value){
  const focused=Boolean(value);
  if(this.windowFocused===focused)return true;
  this.windowFocused=focused;
  if(!focused){this.clearTimer();this.clearSleepTimer();this.clearCycleTimers();this.interruptLowPriorityMotions();this.lastMotionReason="paused: application window unfocused";return true;}
  if(this.running&&this.visible&&!this.sleeping&&!this.userBusy){this.schedule(1200);this.armSleepTimer();if(this.intent==="speaking")this.scheduleSpeakingGesture();if(this.intent==="thinking")this.scheduleThinkingGesture();}
  return true;
 }
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
  if(this.sleeping){
   const sleptMinutes=this.sleepStartedAt?Math.max(0,(now-this.sleepStartedAt)/60000):0;
   if(sleptMinutes>5)this.energy=Math.max(this.energy,Math.min(85,55+sleptMinutes*2));
   return;
  }
  const hour=new Date().getHours(),night=hour>=22||hour<6;
  this.energy=Math.max(MIN_ENERGY,this.energy-minutes*(night ? .7 : .5));
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
  this.decayEnergy();
  this.sleeping=false;
  this.sleepStartedAt=0;
  this.intent="reacting";
  this.gainEnergy(15);
  const wakeMotion=this.chooseContextMotion("wake")||"wave";
  this.character.play(wakeMotion,{duration:wakeMotion==="dance"?1.6:1.2,priority:45});
  this.schedule(2500);
  return true;
 }
 armSleepTimer(){
  this.clearSleepTimer();
  if(!this.running||this.paused||!this.visible||!this.windowFocused||this.userBusy||this.sleeping||this.settings.sleep===false)return;
  this.sleepTimer=setTimeout(()=>{
   this.sleepTimer=null;
   if(!this.running||!this.visible)return;
   if(this.intent!=="idle"||performance.now()-this.lastInteraction<Math.max(60000,Number(this.settings.sleepAfterMs)||SLEEP_AFTER_MS)){
    this.armSleepTimer();
    return;
   }
   this.clearCycleTimers();
   this.sleeping=true;
   this.sleepStartedAt=performance.now();
   this.intent="sleeping";
   this.character.stopAll();
   this.character.play("sleep",{priority:60});
  },Math.max(60000,Number(this.settings.sleepAfterMs)||SLEEP_AFTER_MS));
 }
 chooseWeighted(candidates,weights={}){
  const available=[...new Set((candidates||[]).filter(id=>typeof id==="string"&&this.character?.animation?.registry?.get?.(id)&&!(this.settings.dancing===false&&id==="dance")&&!(this.settings.walking===false&&["walk","walking","step","run"].includes(String(id).toLowerCase()))))];
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
   thanks:{cheerful:["nod","wave"],curious:["nod","lookCloser"],thoughtful:["nod"],mischievous:["wave","nod"],pleased:["nod","wave","dance"],sleepy:["nod"],puzzled:["nod"],sad:["nod"]},
   praise:{cheerful:["clap","wave","dance"],curious:["clap","nod"],thoughtful:["nod","wave"],mischievous:["dance","wave","clap"],pleased:["clap","dance","nod"],sleepy:["nod"],puzzled:["nod","wave"],sad:["nod"]},
   excitement:{cheerful:["dance","clap","wave"],curious:["wave","clap"],thoughtful:["wave","nod"],mischievous:["dance","clap"],pleased:["dance","clap","wave"],sleepy:["wave","nod"],puzzled:["wave","nod"],sad:["wave","nod"]},
   confusion:{cheerful:["think","lookCloser"],curious:["lookCloser","think","shake"],thoughtful:["think","nod"],mischievous:["think","lookCloser"],pleased:["think","nod"],sleepy:["think","nod"],puzzled:["think","shake","lookCloser"],sad:["think","nod"]},
   disagreement:{cheerful:["shake","think"],curious:["shake","lookCloser"],thoughtful:["shake","nod"],mischievous:["shake","think"],pleased:["shake","nod"],sleepy:["shake","nod"],puzzled:["shake","think"],sad:["nod","think"]},
   farewell:{cheerful:["wave","nod"],curious:["wave","nod"],thoughtful:["wave","nod"],mischievous:["wave","dance"],pleased:["wave","nod"],sleepy:["wave","nod"],puzzled:["wave","nod"],sad:["wave","nod"]},
   apology:{cheerful:["nod","think"],curious:["nod","think"],thoughtful:["nod","think"],mischievous:["nod"],pleased:["nod"],sleepy:["nod"],puzzled:["nod","think"],sad:["nod","think"]},
   worry:{cheerful:["think","nod"],curious:["think","lookCloser"],thoughtful:["think","nod"],mischievous:["think"],pleased:["think","nod"],sleepy:["nod"],puzzled:["think","nod"],sad:["think","nod"]},
   anger:{cheerful:["think","nod"],curious:["think","lookCloser"],thoughtful:["think","nod"],mischievous:["think"],pleased:["think"],sleepy:["think"],puzzled:["think","nod"],sad:["think","nod"]},
   empathy:{cheerful:["nod","think"],curious:["nod","think"],thoughtful:["nod","think"],mischievous:["nod"],pleased:["nod"],sleepy:["nod"],puzzled:["nod","think"],sad:["nod","think"]},
   celebration:{cheerful:["clap","dance","wave"],curious:["clap","wave"],thoughtful:["clap","nod"],mischievous:["dance","clap"],pleased:["clap","dance"],sleepy:["clap","nod"],puzzled:["clap","wave"],sad:["clap","nod"]},
   curiosity:{cheerful:["lookCloser","nod"],curious:["lookCloser","think"],thoughtful:["lookCloser","think"],mischievous:["lookCloser","nod"],pleased:["lookCloser","nod"],sleepy:["lookCloser"],puzzled:["lookCloser","think"],sad:["lookCloser","nod"]},
   encouragement:{cheerful:["nod","clap","wave"],curious:["nod","wave"],thoughtful:["nod","wave"],mischievous:["clap","wave"],pleased:["clap","nod"],sleepy:["nod"],puzzled:["nod","wave"],sad:["nod","wave"]},
   affection:{cheerful:["wave","nod"],curious:["nod","wave"],thoughtful:["nod"],mischievous:["wave","dance"],pleased:["wave","nod","clap"],sleepy:["nod"],puzzled:["nod"],sad:["nod"]},
   urgency:{cheerful:["lookCloser","think"],curious:["lookCloser","think"],thoughtful:["think","lookCloser"],mischievous:["think"],pleased:["lookCloser"],sleepy:["lookCloser","think"],puzzled:["lookCloser","think"],sad:["think"]},
   boredom:{cheerful:["stretch","yawn"],curious:["stretch","lookCloser"],thoughtful:["stretch","yawn"],mischievous:["stretch"],pleased:["stretch"],sleepy:["yawn","stretch"],puzzled:["stretch"],sad:["stretch","nod"]}
  };
  const activeMood=this.settings.moodPalettes===false?"cheerful":this.mood;
  const candidates=palettes[kind]?.[activeMood]||palettes[kind]?.cheerful||[];
  const weights={dance:this.settings.energyModulation===false?1:(this.energy>=65?1.6:.45),clap:1.35,wave:1.2,nod:1.15,think:1.1,lookCloser:.95,shake:.8,stretch:.7};
  const motion=this.chooseWeighted(candidates,weights);
  this.lastMotionReason=motion?"context "+kind+" / "+activeMood:"skipped: no registered motion for "+kind+" / "+activeMood;
  return motion;
 }
 chooseIdle(){
  const source=this.settings.moodPalettes===false?["nod","wave","stretch","lookCloser","think"]:this.character.moodPalette?.()||[];
  let available=source.filter(id=>this.character.animation?.registry?.get?.(id));
  if(this.settings.walking===false)available=available.filter(id=>!["walk","walking","step","run"].includes(String(id).toLowerCase()));
  if(this.settings.dancing===false)available=available.filter(id=>id!=="dance");
  if(!available.length)return null;
  const activeMood=this.settings.moodPalettes===false?"cheerful":this.mood;
  // Deterministic mode must not depend on energy, time-of-day, weighting, or recent-motion history.
  // Keep a stable default gesture so identical settings always produce identical idle behavior.
  if(this.settings.random===false){
   const preferred=activeMood==="curious"?"lookCloser":activeMood==="thoughtful"||activeMood==="puzzled"?"think":activeMood==="sleepy"?"stretch":activeMood==="pleased"||activeMood==="cheerful"?"nod":"wave";
   const id=available.includes(preferred)?preferred:available.includes("nod")?"nod":available[0];
   this.lastMotionId=id;this.lastMotionReason=activeMood+" mood palette; deterministic selection";return id;
  }
  const hour=new Date().getHours(),night=hour>=22||hour<6,morning=hour>=5&&hour<12;
  const useEnergy=this.settings.energyModulation!==false;
  const lowEnergy=useEnergy&&(this.energy<40||night),highEnergy=useEnergy&&this.energy>=70;
  const calm=new Set(["nod","think","yawn","stretch","lookCloser"]);
  const pool=lowEnergy?available.filter(id=>calm.has(id)):available;
  const weights={wave:1.1,nod:1.2,think:this.settings.idleThoughts===false ? .05 : 1.1,stretch:1,lookCloser:1.15,yawn:lowEnergy?1.8:.35,crackBack:.8,crackFingers:.85,dance:night ? .2 : (highEnergy&&morning ? 1.45 : .7)};
  if(activeMood==="curious"){weights.lookCloser=(weights.lookCloser||1)*1.8;weights.think=(weights.think||1)*1.25}
  if(activeMood==="pleased"||activeMood==="cheerful"){weights.wave=(weights.wave||1)*1.35;weights.nod=(weights.nod||1)*1.2}
  if(activeMood==="thoughtful"||activeMood==="sad"||activeMood==="sleepy"){weights.yawn=(weights.yawn||1)*1.25;weights.dance=(weights.dance||1)*.25}
  this.lastMotionReason=useEnergy&&night?"nighttime calm bias":lowEnergy?"low-energy calm bias":activeMood+" mood palette";
  return this.chooseWeighted(pool.length?pool:available,weights);
 }
 schedule(delay){
  this.clearTimer();
  if(!this.running||this.paused||!this.visible||!this.windowFocused||this.sleeping||this.userBusy)return;
  this.armBlinkTimer();
  const supplied=Number(delay);
  const configured=Math.max(1000,Number(this.settings.frequencyMs)||DEFAULT_IDLE_DELAY);
  const base=Math.max(1000,Number.isFinite(supplied)&&supplied>0?supplied:configured);
  const usesConfiguredCadence=delay==null||!Number.isFinite(supplied)||supplied<=0||supplied===DEFAULT_IDLE_DELAY;
  const energyFactor=this.settings.energyModulation===false?1:Math.max(.65,Math.min(1.35,this.energy/70));
  const energyAdjusted=usesConfiguredCadence?base/energyFactor:base;
  const jitter=usesConfiguredCadence?(.72+Math.random()*.78):1;
  this.timer=setTimeout(()=>{this.timer=null;this.evaluateNow()},Math.round(energyAdjusted*jitter));
 }
 evaluateNow(){
  if(!this.running||this.paused||!this.visible||!this.windowFocused||this.sleeping||this.userBusy||this.settings.idle===false)return false;
  if(this.settings.autonomousMovement===false){this.schedule();return false;}
  this.decayEnergy();
  if(["speaking","thinking","doing","being-moved"].includes(this.intent)){
   this.schedule();
   return false;
  }
  this.restoreMoodIfDue();
  if(this.character.animation?.active?.length){this.schedule();return false}
  if(performance.now()-this.lastMotionAt<this.cooldownMs){this.schedule(this.cooldownMs);return false}
  const id=this.chooseIdle();
  if(!id){this.schedule();return false}
  this.intent="idle";
  this.lastMotionAt=performance.now();
  const intensity=Math.max(.25,Math.min(1,this.energy/70));
  const played=this.character.play(id,{priority:10,intensity});
  if(played&&this.settings.autonomousMovement!==false&&this.settings.eyeTracking!==false&&Math.random()<.68)this.lookAround();
  this.schedule();
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
 onUserInteraction(event={}){return this.handleEvent(event)}
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
   this.setExpression(faceMap[this.mood]||"neutral",.45);
  }
 }
 interruptLowPriorityMotions(){
  if(this.character?.authoring)return false;
  const active=[...(this.character?.animation?.active||[])];
  for(const item of active){if(Number(item?.priority??0)<=20&&item?.m?.id)this.character.animation.stop(item.m.id)}
  this.lastCasualMotionAt=0;
  return active.length>0;
 }
 playMotion(motion,options={}){
  const registry=this.character?.animation?.registry;
  if(registry?.get&&!registry.get(motion)){this.lastMotionReason="skipped: unregistered motion "+String(motion);return false}
  const priority=Number(options.priority??0),now=performance.now();
  if(priority<=20){
   if(now-this.lastCasualMotionAt<2500){this.lastMotionReason="skipped: casual-motion throttle";return false}
   if((this.character?.animation?.active||[]).length>=2){this.lastMotionReason="skipped: casual-motion queue limit";return false}
  }
  const ok=Boolean(this.character?.play?.(motion,options));
  if(ok&&priority<=20)this.lastCasualMotionAt=now;
  this.lastMotionReason=ok?"played "+String(motion)+" at priority "+String(priority):"skipped: motion controller rejected "+String(motion);
  return ok;
 }
 react(reaction){
  this.clearSleepTimer();
  if(reaction.id==="greeting"&&this.settings.greeting===false)reaction={...reaction,motion:"nod"};
  if(reaction.motion==="dance"&&this.settings.dancing===false)reaction={...reaction,motion:"nod"};
  const now=performance.now();
  if(this.lastReactionId===reaction.id&&now-this.lastReactionAt<REACTION_GAP_MS)return false;
  this.lastReactionAt=now;this.lastReactionId=reaction.id;this.lastEvent="text:"+reaction.id;
  this.onMoodChanged(reaction.mood,true);
  this.setExpression(reaction.expression,.78);
  this.intent="reacting";
  const contextual=["praise","excitement","confusion","disagreement","farewell","apology","encouragement","affection","urgency","boredom","worry","anger","empathy","celebration","curiosity"].includes(reaction.id)?this.chooseContextMotion(reaction.id):null;
  const motion=contextual||reaction.motion;
  const duration=motion==="dance"?2.1:motion==="lookCloser"?1.8:1.25;
  const played=this.playMotion(motion,{duration,priority:42});
  this.scheduleReactionFinish(duration*1000+350);
  return played;
 }
 classifyText(text){
  const clean=String(text||"").normalize("NFC").replace(/[\u064B-\u065F\u0670\u0640]/g,"").replace(/[إأآٱ]/g,"ا").replace(/ى/g,"ي").toLocaleLowerCase().trim();
  if(!clean)return null;
  // Avoid treating negated emotion/intent words as positive signals.
  const guarded=[
   {id:"urgency",pattern:/(?:\b(?:not urgent|no rush|don't hurry|do not hurry|not an emergency)\b|مش مستعجل|ليس عاجلا|مش ضروري)/i},
   {id:"affirmation",pattern:/(?:\b(?:not okay|not ok|not correct|not agreed|not sure)\b|مش تمام|غير موافق|مش صحيح)/i},
   {id:"disagreement",pattern:/(?:\b(?:no problem|not wrong|not disagree)\b|لا مشكلة|ما في مشكلة)/i}
  ];
  const blocked=new Set(guarded.filter(item=>item.pattern.test(clean)).map(item=>item.id));
  const found=TEXT_REACTIONS.find(item=>!blocked.has(item.id)&&item.pattern.test(clean));
  if(found)return found;
  // Recover common Arabic variants without diacritics or hamza differences.
  const compact=clean.replace(/\s+/g," ");
  if(/(?:^|\s)(?:اهلا|مرحبا|السلام عليكم|صباح الخير|مساء الخير)(?:\s|$)/i.test(compact))return TEXT_REACTIONS.find(x=>x.id==="greeting");
  if(/(?:^|\s)(?:شكرا|مشكور|يسلمو)(?:\s|$)/i.test(compact))return TEXT_REACTIONS.find(x=>x.id==="thanks");
  return null;
 }
 scheduleSpeakingGesture(){
  this.clearSpeakingTimer();
  if(!this.running||this.paused||!this.visible||!this.windowFocused||this.userBusy||this.sleeping||this.intent!=="speaking"||this.settings.speakingCycle===false)return;
  const energyFactor=this.settings.energyModulation===false?1:Math.max(.1,Math.min(1,this.energy/100));
  const base=6000+(1-energyFactor)*3000;
  const span=6000*(.7+energyFactor*.6);
  const delay=base+Math.random()*span;
  this.speakingTimer=setTimeout(()=>{
   this.speakingTimer=null;
   if(!this.running||!this.visible||!this.windowFocused||this.userBusy||this.sleeping||this.intent!=="speaking")return;
   const id=this.chooseWeighted(["talkGesture","nod","lookCloser","wave"],{talkGesture:1.5,nod:1.2,lookCloser:.8,wave:.45});
   if(id&&(!this.character?.animation?.active||this.character.animation.active.length<2))this.playMotion(id,{duration:id==="talkGesture" ? .9 : .7,priority:18});
   this.scheduleSpeakingGesture();
  },delay);
 }
 scheduleThinkingGesture(){
  this.clearThinkingTimer();
  if(!this.running||this.paused||!this.visible||!this.windowFocused||this.userBusy||this.sleeping||this.intent!=="thinking"||this.settings.thinkingCycle===false)return;
  const delay=2800+Math.random()*2200;
  this.thinkingTimer=setTimeout(()=>{
   this.thinkingTimer=null;
   if(!this.running||!this.visible||!this.windowFocused||this.userBusy||this.sleeping||this.intent!=="thinking")return;
   const id=this.chooseWeighted(["think","lookCloser","nod"],{think:1.5,lookCloser:1.1,nod:.4});
   if(id)this.playMotion(id,{duration:id==="lookCloser"?1.2:.85,priority:26});
   this.scheduleThinkingGesture();
  },delay);
 }
 handleEvent(event){
  const type=typeof event==="string"?event:String(event?.type||"").toLowerCase();
  if(!this.running||this.paused||!this.visible)return false;
  this.lastEvent=type;
  this.eventCounts.set(type,(this.eventCounts.get(type)||0)+1);
  const lifecycleEvents=["speech-start","assistant-speech-start","speech-end","assistant-speech-end","speech-cancelled","mute","muted","audio-muted","voice-muted","thinking","assistant-thinking","chat-end","assistant-cancelled","request-cancelled","app-focus","wake"];
  if(this.settings.events===false&&!lifecycleEvents.includes(type))return false;
  if(type==="user-busy-start"||type==="system-busy")return this.setUserBusy(true);
  if(type==="user-busy-end"||type==="system-active")return this.setUserBusy(false);
  if(type==="pointer-move"){
   if(this.settings.eyeTracking===false)return false;
   const now=performance.now();if(now-this.lastGazeAt<110)return false;this.lastGazeAt=now;
   const x=Math.max(-1,Math.min(1,Number(event?.x)||0)),y=Math.max(-1,Math.min(1,Number(event?.y)||0));
   const ok=Boolean(this.character.face?.lookAt?.(x*1.35,1.5-y*.25,1.2));if(ok)this.intent="attending";return ok;
  }
  if(type==="hover"||type==="zoom"){
   const now=performance.now(),previous=this.interactionCooldowns.get(type)||0;
   if(now-previous<1100){this.lastMotionReason="skipped: repeated "+type+" event";return false}
   this.interactionCooldowns.set(type,now);
  }
  const wasSleeping=this.sleeping;
  this.touch();
  if(type==="speech-start"||type==="assistant-speech-start"){
   this.clearSleepTimer();
   this.clearThinkingTimer();
   this.interruptLowPriorityMotions();
   this.intent="speaking";
   this.setSpeechExpression(this.expressionForMood(),.45);
   this.playMotion("talkGesture",{duration:.9,priority:25});
   this.scheduleSpeakingGesture();
   return true;
  }
  if(type==="speech-end"||type==="assistant-speech-end"||type==="speech-cancelled"||type==="mute"||type==="muted"||type==="audio-muted"||type==="voice-muted"){
   this.clearSleepTimer();
   this.clearCycleTimers();
   this.intent="idle";
   this.setSpeechExpression(this.expressionForMood(),.5);
   this.schedule(3200);
   this.armSleepTimer();
   return true;
  }
  if(type==="thinking"||type==="assistant-thinking"||type==="tool-progress"){
   this.clearSleepTimer();
   this.clearSpeakingTimer();
   this.interruptLowPriorityMotions();
   this.intent="thinking";
   this.playMotion("think",{duration:1.1,priority:35});
   this.scheduleThinkingGesture();
   return true;
  }
  if(type==="chat-end"||type==="assistant-cancelled"||type==="request-cancelled"){
   this.clearSleepTimer();
   this.clearCycleTimers();
   this.intent="idle";
   this.schedule(1800);
   this.armSleepTimer();
   return true;
  }
  if(type==="user-input"||type==="user-message"||type==="user-transcript"){
   const text=String(typeof event==="object"?(event.text||event.message?.content||event.message||event.transcript||event.content||""):"").trim();
   const normalized=text.toLocaleLowerCase().replace(/[\s\p{P}]+/gu," ").trim();
   const inputNow=performance.now();
   if(normalized&&normalized===this.lastUserText&&inputNow-this.lastUserTextAt<1500){this.lastMotionReason="skipped: duplicate user transcript";return false}
   if(normalized){this.lastUserText=normalized;this.lastUserTextAt=inputNow}
   this.clearCycleTimers();
   this.interruptLowPriorityMotions();
   const reaction=this.classifyText(text);
   if(reaction)return this.react(reaction);
   this.intent="attending";
   this.onMoodChanged("curious",true);
   this.setExpression("surprised",.55);
   this.playMotion("think",{duration:1.35,priority:35});
   return true;
  }
  if(type==="assistant-message"||type==="assistant-response"||type==="voice-answer"){
   this.clearSleepTimer();
   this.clearCycleTimers();
   const text=String(event?.text||event?.message?.content||event?.message||"");
   const reaction=this.classifyText(text);
   if(reaction)return this.react(reaction);
   this.intent="reacting";
   this.setExpression("happy",.5);
   this.playMotion("nod",{duration:.65,priority:32});
   this.scheduleReactionFinish(1100);
   return true;
  }
  if(type==="tool"||type==="tool-start"){
   this.clearSleepTimer();
   this.clearCycleTimers();
   this.interruptLowPriorityMotions();
   this.intent="doing";
   this.setExpression("thinking",.45);
   this.playMotion("think",{duration:1.4,priority:30});
   return true;
  }
  if(type==="tool_result"||type==="tool-success"||type==="task-complete"){
   this.clearSleepTimer();
   this.clearCycleTimers();
   this.intent="reacting";
   this.onMoodChanged("pleased",true);
   this.setExpression("happy",.65);
   const motion=this.chooseContextMotion("success")||"nod";
   this.playMotion(motion,{duration:motion==="dance"?1.6:.75,priority:40});
   this.scheduleReactionFinish(motion==="dance"?2000:1300);
   return true;
  }
  if(type==="tool_error"||type==="tool-failure"){
   this.clearSleepTimer();
   this.clearCycleTimers();
   this.intent="reacting";
   this.onMoodChanged("thoughtful",true);
   this.setExpression("sad",.55);
   this.playMotion("shake",{duration:.7,priority:40});
   this.scheduleReactionFinish(1200);
   return true;
  }
  if(type==="double-click"||type==="right-click"||type==="summon"){
   this.clearSleepTimer();
   if(wasSleeping)return true;
   this.onMoodChanged("cheerful",true);
   this.setExpression("happy",.7);
   const motion=this.chooseContextMotion("wake")||"wave";
   this.playMotion(motion,{duration:motion==="dance"?1.6:1.2,priority:45});
   this.scheduleReactionFinish(1900);
   return true;
  }
  if(type==="zoom"||type==="hover"){
   this.intent="reacting";
   this.setExpression("curious",.5);
   this.playMotion("lookCloser",{duration:1.7,priority:35});
   this.scheduleReactionFinish(2100);
   return true;
  }
  if(type==="drag-start"){
   this.clearSleepTimer();
   this.clearTimer();
   this.clearCycleTimers();
   this.interruptLowPriorityMotions();
   this.intent="being-moved";
   this.setExpression("surprised",.35);
   return true;
  }
  if(type==="drag-end"){
   this.intent="reacting";
   this.playMotion("nod",{duration:.65,priority:30});
   this.scheduleReactionFinish(1100);
   return true;
  }
  if(type==="app-focus"||type==="wake"){
   this.setWindowFocused(true);
   if(wasSleeping)return true;
   this.intent="reacting";
   this.playMotion(this.chooseContextMotion("wake")||"wave",{duration:1,priority:30});
   this.scheduleReactionFinish(1400);
   return true;
  }
  if(type==="app-blur")return this.setWindowFocused(false);
  if(type==="idle-timeout")return this.setUserBusy(true);
  return false;
 }
 update(dt=.016){this.breathTime+=Math.max(0,Number(dt)||0);if(this.running&&this.settings.breathing!==false&&!this.sleeping&&this.visible){const a=Math.sin(this.breathTime*1.7)*0.018;this.character.engine?.setRestRelativeBoneRotation?.("chest",{x:a});this.character.engine?.setRestRelativeBoneRotation?.("spine",{x:a*.65});}}
 getStatus(){
  this.decayEnergy();
  return {running:this.running,visible:this.visible,windowFocused:this.windowFocused,userBusy:this.userBusy,intent:this.intent,mood:this.mood,energy:Math.round(this.energy),timeOfDay:(()=>{const h=new Date().getHours();return h>=5&&h<12?"morning":h>=12&&h<17?"afternoon":h>=17&&h<22?"evening":"night"})(),sleeping:this.sleeping,recent:[...this.recent],lastInteraction:this.lastInteraction,lastEvent:this.lastEvent,lastUserText:this.lastUserText,interactionCooldowns:Object.fromEntries(this.interactionCooldowns),eventCounts:Object.fromEntries(this.eventCounts),lastMotionId:this.lastMotionId,lastMotionReason:this.lastMotionReason,activeTimers:{idle:Boolean(this.timer),sleep:Boolean(this.sleepTimer),blink:Boolean(this.blinkTimer),reaction:Boolean(this.reactionTimer),speaking:Boolean(this.speakingTimer),thinking:Boolean(this.thinkingTimer)},speakingCycle:Boolean(this.speakingTimer),thinkingCycle:Boolean(this.thinkingTimer)};
 }
 destroy(){this.stop();this.character=null}
}
