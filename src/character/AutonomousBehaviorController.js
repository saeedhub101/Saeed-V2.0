const DEFAULT_IDLE_DELAY=7000;
const SLEEP_AFTER_MS=60*60*1000;
const RECENT_LIMIT=4;
const MIN_ENERGY=20;

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
  this.mood="cheerful";this.breathTime=0;this.settings={idle:true,blinking:true,expressions:true,speechFace:true,eyeTracking:true,autonomousMovement:true,frequencyMs:7000,eventCooldownMs:2500,sleepAfterMs:3600000};
 }
 start(){
  if(this.running)return;
  this.running=true;
  this.schedule(1800);
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
  const lowEnergy=this.energy<45;
  const calm=new Set(["nod","think","yawn","stretch","lookCloser"]);
  const pool=lowEnergy?available.filter(id=>calm.has(id)):available;
  const choices=pool.length?pool:available;
  const fresh=choices.filter(id=>!this.recent.includes(id));
  const source=fresh.length?fresh:choices;
  const id=source[Math.floor(Math.random()*source.length)];
  this.recent=[...this.recent.filter(x=>x!==id),id].slice(-RECENT_LIMIT);
  return id;
 }
 schedule(delay=DEFAULT_IDLE_DELAY){
  this.clearTimer();
  if(!this.running||!this.visible||this.sleeping)return;
  this.armBlinkTimer();
  this.timer=setTimeout(()=>{this.timer=null;this.evaluateNow()},Math.max(1000,Number(delay)||Number(this.settings.frequencyMs)||DEFAULT_IDLE_DELAY));
 }
 evaluateNow(){
  if(!this.running||!this.visible||this.sleeping||this.settings.idle===false)return false;
  this.decayEnergy();
  if(this.character.animation?.active?.length){this.schedule(DEFAULT_IDLE_DELAY);return false}
  if(performance.now()-this.lastMotionAt<this.cooldownMs){this.schedule(this.cooldownMs);return false}
  const id=this.chooseIdle();
  if(!id){this.schedule(DEFAULT_IDLE_DELAY);return false}
  this.intent="idle";
  this.lastMotionAt=performance.now();
  const intensity=Math.max(.25,Math.min(1,this.energy/70));
  const played=this.character.play(id,{priority:10,intensity});
  if(played&&this.settings.autonomousMovement!==false&&this.settings.eyeTracking!==false)this.lookAround();
  this.armSleepTimer();
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
 onMoodChanged(mood){this.mood=String(mood||"cheerful");this.character.mood=this.mood}
 handleEvent(event){
  const type=typeof event==="string"?event:String(event?.type||"");
  if(!this.running||!this.visible)return false;
  this.touch();
  if(type==="speech-start"){this.intent="speaking";this.character.face?.expression?.("happy",.45);this.character.play("talkGesture",{duration:.9,priority:25});return true}
  if(type==="speech-end"){this.intent="idle";this.character.face?.expression?.(this.mood==="sad"?"sad":"neutral",.5);this.schedule(3500);return true}
  if(type==="thinking"){this.intent="thinking";this.character.play("think",{duration:2.2,priority:35});return true}
  if(type==="user-input"){this.intent="reacting";this.character.play("think",{duration:1.8,priority:35});return true}
  if(type==="tool"){this.intent="doing";this.character.face?.expression?.("confused",.65);this.character.play("think",{duration:1.4,priority:30});return true}
  if(type==="tool_result"){this.intent="reacting";this.character.face?.expression?.("happy",.65);this.character.play("nod",{duration:.65,priority:40});return true}
  if(type==="tool_error"){this.intent="reacting";this.character.face?.expression?.("sad",.55);this.character.play("shake",{duration:.7,priority:40});return true}
  if(type==="double-click"||type==="right-click"){this.character.play("wave",{duration:1.2,priority:45});return true}
  if(type==="zoom"){this.character.play("lookCloser",{duration:2.2,priority:35});return true}
  if(type==="drag-end"){this.character.play("nod",{duration:.65,priority:30});return true}
  return false;
 }
 update(dt=.016){this.breathTime+=Math.max(0,Number(dt)||0);if(this.running&&this.settings.breathing!==false&&!this.sleeping&&this.visible){const a=Math.sin(this.breathTime*1.7)*0.018;this.character.engine?.setRestRelativeBoneRotation?.("chest",{x:a});this.character.engine?.setRestRelativeBoneRotation?.("spine",{x:a*.65});}}
 getStatus(){
  this.decayEnergy();
  return {running:this.running,visible:this.visible,intent:this.intent,energy:Math.round(this.energy),sleeping:this.sleeping,recent:[...this.recent],lastInteraction:this.lastInteraction};
 }
 destroy(){this.stop();this.character=null}
}
