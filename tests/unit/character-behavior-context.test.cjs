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
