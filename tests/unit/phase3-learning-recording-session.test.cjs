"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const learning=require("../../src/learning");
const sessions=require("../../src/learning/recording-session");
const brainHost=fs.readFileSync(path.join(__dirname,"../../src/main/application/brain-host.js"),"utf8");
const composition=fs.readFileSync(path.join(__dirname,"../../src/main/application/runtime-composition.js"),"utf8");
function temp(){return fs.mkdtempSync(path.join(os.tmpdir(),"saeed-learning-session-"))}

test("tool results are recorded only during an explicit learning recording session",()=>{
 const userData=temp();
 try{
  assert.equal(sessions.recordToolStep({tool:"character_motion",args:{intent:"wave"}}),false);
  const session=learning.beginRecording(userData,"motion-workflow",["perform the motion"]);
  sessions.setActiveSession({learning,userData,session});
  assert.equal(sessions.recordToolStep({tool:"character_motion",args:{intent:"wave"}}),true);
  assert.deepEqual(session.skill.steps,[{tool:"character_motion",args:{intent:"wave"}}]);
  assert.equal(sessions.clearActiveSession(session),true);
  assert.equal(sessions.recordToolStep({tool:"character_motion",args:{intent:"nod"}}),false);
 }finally{sessions.clearActiveSession();fs.rmSync(userData,{recursive:true,force:true})}
});

test("recorded tool steps persist as part of the user-approved learned skill",()=>{
 const userData=temp();
 try{
  const session=learning.beginRecording(userData,"saved-workflow",["run saved workflow"]);
  sessions.setActiveSession({learning,userData,session});
  assert.equal(sessions.recordToolStep({tool:"character_motion",args:{intent:"wave"}}),true);
  sessions.clearActiveSession(session);
  const saved=learning.finishRecording(userData,session);
  assert.equal(saved.steps.length,1);
  assert.deepEqual(saved.steps[0],{tool:"character_motion",args:{intent:"wave"}});
 }finally{sessions.clearActiveSession();fs.rmSync(userData,{recursive:true,force:true})}
});

test("Brain forwards both the successful tool name and redacted arguments into the active recorder",()=>{
 assert.ok(brainHost.includes("recordHook:(name,args)=>recordLearningStep?.({tool:name,args})"));
 assert.ok(composition.includes('recordLearningStep:step=>require("../../learning/recording-session").recordToolStep(step)'));
});
