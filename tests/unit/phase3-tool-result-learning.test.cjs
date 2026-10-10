"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {ToolRegistry}=require("../../src/tools/registry");

test("failed character tool results are not recorded as successful learning events",async()=>{
 let recorded=0;
 const registry=new ToolRegistry({
  userDataPath:process.cwd(),
  permissionPolicy:()=> "allow",
  recordHook:()=>{recorded++},
  characterController:async()=>({ok:false,error:"rig unavailable"})
 });
 const result=await registry.call("character_motion",{intent:"wave"});
 assert.equal(result.ok,false);
 assert.equal(recorded,0,"failed physical actions must not be added to success-learning history");
});

test("successful character tool results remain eligible for learning records",async()=>{
 let recorded=0;
 const registry=new ToolRegistry({
  userDataPath:process.cwd(),
  permissionPolicy:()=> "allow",
  recordHook:()=>{recorded++},
  characterController:async()=>({ok:true,played:"wave"})
 });
 const result=await registry.call("character_motion",{intent:"wave"});
 assert.equal(result.ok,true);
 assert.equal(recorded,1);
});

test("undefined or null character results do not create false learning records",async()=>{
 let recorded=0;
 const registry=new ToolRegistry({
  userDataPath:process.cwd(),
  permissionPolicy:()=> "allow",
  recordHook:()=>{recorded++},
  characterController:async()=>undefined
 });
 await registry.call("character_motion",{intent:"wave"});
 assert.equal(recorded,0);
});
