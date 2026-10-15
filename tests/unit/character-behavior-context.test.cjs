"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");

test("character reacts to greetings and gratitude with distinct gestures",async()=>{
 const {AutonomousBehaviorController}=await import("../../src/character/AutonomousBehaviorController.js");
 const calls=[];
 const character={
  mood:"cheerful",
  moodPalette:()=>["wave","nod","think","dance","stretch","lookCloser","yawn"],
  animation:{registry:{get:id=>({id})},active:[]},
  face:{expression:(name,intensity)=>calls.push({expression:name,intensity}),blink:()=>true,lookAt:()=>true},
  play:(id,options)=>{calls.push({motion:id,options});return true},
  stopAll:()=>true,
  engine:{setRestRelativeBoneRotation:()=>true}
 };
 const behavior=new AutonomousBehaviorController(character);
 behavior.running=true;
 assert.equal(behavior.handleEvent({type:"user-input",text:"Hello Saeed!"}),true);
 assert.equal(character.mood,"cheerful");
 assert.ok(calls.some(x=>x.motion==="wave"));
 behavior.handleEvent({type:"user-input",text:"Thank you, that was great"});
 assert.equal(character.mood,"pleased");
 assert.ok(calls.some(x=>x.motion==="nod"));
 behavior.stop();
});

test("character responds empathetically to frustration instead of a generic idle gesture",async()=>{
 const {AutonomousBehaviorController}=await import("../../src/character/AutonomousBehaviorController.js");
 const calls=[];
 const character={
  mood:"cheerful",
  moodPalette:()=>["wave","nod","think"],
  animation:{registry:{get:id=>({id}),},active:[]},
  face:{expression:(name,intensity)=>calls.push({expression:name,intensity}),blink:()=>true,lookAt:()=>true},
  play:(id,options)=>{calls.push({motion:id,options});return true},
  stopAll:()=>true,
  engine:{setRestRelativeBoneRotation:()=>true}
 };
 const behavior=new AutonomousBehaviorController(character);
 behavior.running=true;
 assert.equal(behavior.handleEvent({type:"user-input",text:"This is broken and does not work"}),true);
 assert.equal(character.mood,"thoughtful");
 assert.ok(calls.some(x=>x.motion==="think"));
 assert.ok(calls.some(x=>x.expression==="confused"));
 behavior.stop();
});


test("character notices questions in Arabic and switches to an attentive curious gesture",async()=>{
 const {AutonomousBehaviorController}=await import("../../src/character/AutonomousBehaviorController.js");
 const calls=[];
 const character={
  mood:"cheerful",
  moodPalette:()=>["wave","nod","think","lookCloser","shake"],
  animation:{registry:{get:id=>({id})},active:[]},
  face:{expression:(name,intensity)=>calls.push({expression:name,intensity}),blink:()=>true,lookAt:()=>true},
  play:(id,options)=>{calls.push({motion:id,options});return true},
  stopAll:()=>true,
  engine:{setRestRelativeBoneRotation:()=>true}
 };
 const behavior=new AutonomousBehaviorController(character);
 behavior.running=true;
 assert.equal(behavior.handleEvent({type:"user-input",text:"كيف أعمل هذا؟"}),true);
 assert.equal(character.mood,"curious");
 assert.ok(calls.some(x=>x.motion==="lookCloser"));
 behavior.stop();
});

test("tool outcomes produce distinct positive and failure reactions",async()=>{
 const {AutonomousBehaviorController}=await import("../../src/character/AutonomousBehaviorController.js");
 const calls=[];
 const character={
  mood:"cheerful",
  moodPalette:()=>["wave","nod","think","dance","shake"],
  animation:{registry:{get:id=>({id})},active:[]},
  face:{expression:(name,intensity)=>calls.push({expression:name,intensity}),blink:()=>true,lookAt:()=>true},
  play:(id,options)=>{calls.push({motion:id,options});return true},
  stopAll:()=>true,
  engine:{setRestRelativeBoneRotation:()=>true}
 };
 const behavior=new AutonomousBehaviorController(character);
 behavior.running=true;
 assert.equal(behavior.handleEvent({type:"tool_result"}),true);
 assert.equal(character.mood,"pleased");
 assert.equal(behavior.handleEvent({type:"tool_error"}),true);
 assert.equal(character.mood,"thoughtful");
 assert.ok(calls.some(x=>x.motion==="shake"));
 behavior.stop();
});


test("speaking and thinking gesture cycles are observable and cancel on lifecycle end",async()=>{
 const {AutonomousBehaviorController}=await import("../../src/character/AutonomousBehaviorController.js");
 const character={
  mood:"cheerful",
  moodPalette:()=>["wave","nod","think","dance","stretch","lookCloser","yawn","clap"],
  animation:{registry:{get:id=>({id})},active:[]},
  face:{expression:()=>true,blink:()=>true,lookAt:()=>true},
  play:(id)=>{character.animation.active=[];return true},
  stopAll:()=>true,
  engine:{setRestRelativeBoneRotation:()=>true}
 };
 const behavior=new AutonomousBehaviorController(character);
 behavior.running=true;
 assert.equal(behavior.handleEvent({type:"speech-start"}),true);
 assert.equal(behavior.getStatus().speakingCycle,true);
 behavior.handleEvent({type:"speech-end"});
 assert.equal(behavior.getStatus().speakingCycle,false);
 assert.equal(behavior.handleEvent({type:"thinking"}),true);
 assert.equal(behavior.getStatus().thinkingCycle,true);
 behavior.handleEvent({type:"request-cancelled"});
 assert.equal(behavior.getStatus().thinkingCycle,false);
 behavior.handleEvent({type:"speech-start"});
 assert.equal(behavior.getStatus().speakingCycle,true);
 behavior.handleEvent({type:"mute"});
 const status=behavior.getStatus();
 assert.equal(status.speakingCycle,false);
 assert.equal(status.activeTimers.speaking,false);
 assert.equal(status.eventCounts.mute,1);
 assert.equal(typeof status.lastMotionReason,"string");
 behavior.stop();
});


test("character behavior preferences keep deterministic idle active and filter disabled motions",async()=>{
 const {AutonomousBehaviorController}=await import("../../src/character/AutonomousBehaviorController.js");
 const character={
  mood:"cheerful",
  moodPalette:()=>["wave","nod","think","dance","walk"],
  animation:{registry:{get:id=>({id})},active:[]},
  face:{expression:()=>true,blink:()=>true,lookAt:()=>true},
  play:()=>true,stopAll:()=>true,
  engine:{setRestRelativeBoneRotation:()=>true}
 };
 const behavior=new AutonomousBehaviorController(character);
 behavior.configure({random:false,dancing:false,walking:false,idleThoughts:false});
 const selected=behavior.chooseIdle();
 assert.equal(selected,"nod");
 assert.equal(behavior.getStatus().lastMotionId,"nod");
 behavior.configure({random:true,dancing:false,walking:false});
 const selectedAgain=behavior.chooseWeighted(["dance","walk","nod"]);
 assert.equal(selectedAgain,"nod");
 behavior.onMoodChanged("thoughtful");
 behavior.configure({random:false,moodPalettes:false,walking:false,dancing:false});
 assert.equal(behavior.chooseIdle(),"nod");
 behavior.stop();
});


test("busy-state suppresses casual motion and resumes the autonomous scheduler",async()=>{
 const {AutonomousBehaviorController}=await import("../../src/character/AutonomousBehaviorController.js");
 const character={mood:"cheerful",moodPalette:()=>["wave","nod","think"],animation:{registry:{get:id=>({id})},active:[]},face:{expression:()=>true,blink:()=>true,lookAt:()=>true},play:()=>true,stopAll:()=>true,engine:{setRestRelativeBoneRotation:()=>true}};
 const behavior=new AutonomousBehaviorController(character);
 behavior.running=true;
 behavior.schedule(1000);
 assert.equal(behavior.setUserBusy(true),true);
 assert.equal(behavior.getStatus().userBusy,true);
 assert.equal(behavior.getStatus().activeTimers.idle,false);
 assert.equal(behavior.evaluateNow(),false);
 assert.equal(behavior.handleEvent({type:"user-busy-end"}),true);
 assert.equal(behavior.getStatus().userBusy,false);
 assert.equal(behavior.getStatus().activeTimers.idle,true);
 assert.equal(behavior.setWindowFocused(false),true);
 assert.equal(behavior.getStatus().windowFocused,false);
 behavior.schedule(1000);
 assert.equal(behavior.getStatus().activeTimers.idle,false);
 assert.equal(behavior.setWindowFocused(true),true);
 assert.equal(behavior.getStatus().windowFocused,true);
 behavior.stop();
});

test("negated emotions and reassuring phrases do not trigger contradictory reactions",async()=>{
 const {AutonomousBehaviorController}=await import("../../src/character/AutonomousBehaviorController.js");
 const behavior=new AutonomousBehaviorController({animation:{registry:{get:id=>({id})},active:[]},play:()=>true,moodPalette:()=>["nod"]});
 assert.equal(behavior.classifyText("I'm not sad"),null);
 assert.equal(behavior.classifyText("I'm not curious"),null);
 assert.equal(behavior.classifyText("No problem, I'm not angry"),null);
 assert.equal(behavior.classifyText("Don't worry, I'm not upset"),null);
 assert.equal(behavior.classifyText("I'm excited")?.id,"excitement");
 behavior.stop();
});
test("autonomous behavior starts focused and schedules idle motion without a prior focus event",async()=>{
 const {AutonomousBehaviorController}=await import("../../src/character/AutonomousBehaviorController.js");
 const behavior=new AutonomousBehaviorController({animation:{registry:{get:id=>({id})},active:[]},play:()=>true,moodPalette:()=>["nod"]});
 assert.equal(behavior.getStatus().windowFocused,true);
 behavior.running=true;
 behavior.schedule(1000);
 assert.equal(behavior.getStatus().activeTimers.idle,true);
 behavior.stop();
 behavior.destroy?.();
});


test("tool success reactions preserve tool identity and choose an outcome-specific gesture",async()=>{
 const {AutonomousBehaviorController}=await import("../../src/character/AutonomousBehaviorController.js");
 const calls=[];
 const character={
  mood:"cheerful",moodPalette:()=>["wave","nod","think","lookCloser","clap"],
  animation:{registry:{get:id=>({id})},active:[]},
  face:{expression:(name,intensity)=>calls.push({expression:name,intensity}),blink:()=>true,lookAt:()=>true},
  play:(id,options)=>{calls.push({motion:id,options});return true},
  stopAll:()=>true,engine:{setRestRelativeBoneRotation:()=>true}
 };
 const behavior=new AutonomousBehaviorController(character);
 behavior.running=true;
 assert.equal(behavior.handleEvent({type:"tool_result",name:"read_file",success:true,resultMeta:{ok:true,hasData:true}}),true);
 assert.equal(behavior.getStatus().lastToolOutcome.name,"read_file");
 assert.equal(behavior.getStatus().lastToolOutcome.success,true);
 assert.ok(calls.some(x=>x.motion==="lookCloser"||x.motion==="nod"||x.motion==="think"));
 assert.equal(behavior.handleEvent({type:"tool_result",name:"write_file",success:true,resultMeta:{ok:true}}),true);
 assert.equal(behavior.getStatus().lastToolOutcome.name,"write_file");
 assert.ok(calls.some(x=>x.motion==="clap"||x.motion==="wave"||x.motion==="nod"));
 behavior.stop();
});

test("tool failures use a distinct puzzled reaction and retain a safe diagnostic summary",async()=>{
 const {AutonomousBehaviorController}=await import("../../src/character/AutonomousBehaviorController.js");
 const calls=[];
 const character={
  mood:"cheerful",moodPalette:()=>["wave","nod","think","shake"],
  animation:{registry:{get:id=>({id})},active:[]},
  face:{expression:(name,intensity)=>calls.push({expression:name,intensity}),blink:()=>true,lookAt:()=>true},
  play:(id,options)=>{calls.push({motion:id,options});return true},
  stopAll:()=>true,engine:{setRestRelativeBoneRotation:()=>true}
 };
 const behavior=new AutonomousBehaviorController(character);
 behavior.running=true;
 assert.equal(behavior.handleEvent({type:"tool_error",name:"email_send",error:"provider unavailable"}),true);
 const status=behavior.getStatus();
 assert.equal(status.lastToolOutcome.name,"email_send");
 assert.equal(status.lastToolOutcome.success,false);
 assert.equal(status.lastToolOutcome.error,"provider unavailable");
 assert.equal(status.mood,"thoughtful");
 assert.ok(calls.some(x=>x.expression==="sad"));
 assert.ok(calls.some(x=>x.motion==="think"||x.motion==="nod"||x.motion==="shake"));
 behavior.stop();
});

test("Arabic emotional input produces an empathetic reaction rather than a generic response",async()=>{
 const {AutonomousBehaviorController}=await import("../../src/character/AutonomousBehaviorController.js");
 const calls=[];
 const character={
  mood:"cheerful",moodPalette:()=>["wave","nod","think","lookCloser"],
  animation:{registry:{get:id=>({id})},active:[]},
  face:{expression:(name,intensity)=>calls.push({expression:name,intensity}),blink:()=>true,lookAt:()=>true},
  play:(id,options)=>{calls.push({motion:id,options});return true},
  stopAll:()=>true,engine:{setRestRelativeBoneRotation:()=>true}
 };
 const behavior=new AutonomousBehaviorController(character);
 behavior.running=true;
 assert.equal(behavior.handleEvent({type:"user-input",text:"أنا متوتر وقلقان"}),true);
 assert.equal(behavior.getStatus().mood,"thoughtful");
 assert.ok(calls.some(x=>x.expression==="sad"||x.expression==="confused"));
 assert.ok(calls.some(x=>x.motion==="think"||x.motion==="nod"));
 behavior.stop();
});
