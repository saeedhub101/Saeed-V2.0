"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const memory=require("../../src/main/services/memory-service");

test("vector index and fact files survive atomic round-trip persistence",()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"saeed-memory-persist-"));
 try{
  memory.add(root,"User prefers concise responses",{type:"preference"});
  memory.addFact(root,"User prefers concise responses");
  assert.equal(memory.search(root,"concise responses",1).length,1);
  assert.equal(memory.listFacts(root).length,1);
  assert.doesNotThrow(()=>JSON.parse(fs.readFileSync(path.join(root,"addons","memory-stack","vectors","index.json"),"utf8")));
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test("corrupt vector index is preserved and rejected instead of being replaced by an empty index",()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"saeed-memory-corrupt-vectors-"));
 const file=path.join(root,"addons","memory-stack","vectors","index.json");
 try{
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,"{broken","utf8");
  assert.throws(()=>memory.add(root,"new memory"),/invalid JSON.*refusing to overwrite/i);
  assert.equal(fs.readFileSync(file,"utf8"),"{broken");
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test("corrupt facts are preserved and rejected instead of being replaced by a new fact",()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"saeed-memory-corrupt-facts-"));
 const file=path.join(root,"addons","memory-stack","knowledge","facts.json");
 try{
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,"{broken","utf8");
  assert.throws(()=>memory.addFact(root,"new fact"),/invalid JSON.*refusing to overwrite/i);
  assert.equal(fs.readFileSync(file,"utf8"),"{broken");
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test("failed atomic memory writes do not leave fixed-name temporary files",()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"saeed-memory-atomic-"));
 try{
  memory.add(root,"atomic item");
  const dir=path.join(root,"addons","memory-stack","vectors");
  assert.deepEqual(fs.readdirSync(dir),["index.json"]);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
