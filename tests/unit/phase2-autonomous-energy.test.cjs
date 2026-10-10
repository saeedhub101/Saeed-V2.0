"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");

test("autonomous idle selection becomes calmer at low energy",async()=>{
 const {AutonomousBehaviorController}=await import("../../src/character/AutonomousBehaviorController.js");
 const character={moodPalette:()=>["wave","yawn","think"],animation:{registry:{get:id=>({id})}},play:()=>true};
 const behavior=new AutonomousBehaviorController(character);
 behavior.energy=30;
 const original=Math.random;Math.random=()=>0;
 try{assert.equal(behavior.chooseIdle(),"yawn")}finally{Math.random=original;behavior.destroy()}
});

test("autonomous motion intensity follows energy and the scheduler remains stoppable",async()=>{
 const {AutonomousBehaviorController}=await import("../../src/character/AutonomousBehaviorController.js");
 const calls=[];
 const character={moodPalette:()=>["wave"],animation:{registry:{get:id=>({id}),},active:[]},play:(id,options)=>{calls.push({id,options});return true},face:{lookAt:()=>false}};
 const behavior=new AutonomousBehaviorController(character);
 behavior.running=true;behavior.visible=true;behavior.energy=35;behavior.cooldownMs=0;behavior.settings.sleepAfterMs=60000;
 const original=Math.random;Math.random=()=>0;
 try{
  assert.equal(behavior.evaluateNow(),true);
  assert.equal(calls[0].id,"wave");
  assert.ok(calls[0].options.intensity>0&&calls[0].options.intensity<1);
  assert.ok(behavior.timer,"evaluation reschedules the autonomous loop");
 }finally{Math.random=original;behavior.destroy()}
});
