"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const learning=require("../../src/learning");

test("learned skill persistence is readable and verified after an atomic save",()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"saeed-learning-atomic-"));
 try{
  const saved=learning.save(root,{id:"open-notes",name:"Open notes",trigger:{phrases:["open notes"]},steps:[{tool:"open_file",args:{filePath:"notes.txt"}}]});
  const loaded=learning.get(root,"open-notes");
  assert.equal(saved.id,"open-notes");
  assert.equal(loaded.steps.length,1);
  assert.deepEqual(fs.readdirSync(path.join(root,"skills")),["open-notes.json"]);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test("learned skills stop and report failure when a tool returns no verifiable result",async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"saeed-learning-no-result-"));
 let calls=0;
 try{
  const skill={id:"two-step",steps:[{tool:"first"},{tool:"second"}]};
  await assert.rejects(()=>learning.run(root,{call:async()=>{calls++;return null}},skill),/no verifiable result/);
  assert.equal(calls,1,"later side effects must not run after an unverifiable step");
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test("learned skills stop when a tool explicitly reports failure",async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"saeed-learning-failed-step-"));
 let calls=0;
 try{
  await assert.rejects(()=>learning.run(root,{call:async()=>{calls++;return{ok:false,error:"denied"}}},{id:"failed",steps:[{tool:"write_file"},{tool:"open_file"}]}),/Learned skill failed.*denied/);
  assert.equal(calls,1);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
