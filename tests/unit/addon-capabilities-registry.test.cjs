"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const capabilities=require("../../src/addons/capabilities");

test("add-on capability registry validates metadata and deduplicates declared capabilities",()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"saeed-addon-registry-"));
 try{
  assert.equal(capabilities.register(root,{id:"../escape",name:"bad",capabilities:["email"]}),false);
  assert.equal(capabilities.register(root,{id:"mail-provider",name:"Mail Provider",version:"1.0",capabilities:["email","email","SMTP","invalid capability",null]}),true);
  assert.deepEqual(capabilities.find(root,"email").map(x=>x.id),["mail-provider"]);
  assert.deepEqual(capabilities.list(root)[0].capabilities,["email","SMTP"]);
  assert.equal(capabilities.unregister(root,"missing"),false);
  assert.equal(capabilities.unregister(root,"mail-provider"),true);
  assert.deepEqual(capabilities.list(root),[]);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test("malformed registry fails closed instead of silently overwriting installed provider records",()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"saeed-addon-registry-corrupt-"));
 const file=path.join(root,"addons","registry.json");
 try{
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,"{not-json","utf8");
  assert.throws(()=>capabilities.register(root,{id:"provider",capabilities:["email"]}),/invalid JSON.*refusing to overwrite/i);
  assert.equal(fs.readFileSync(file,"utf8"),"{not-json");
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test("registry writes leave a parseable complete JSON document with no temporary files",()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"saeed-addon-registry-atomic-"));
 const dir=path.join(root,"addons");
 try{
  assert.equal(capabilities.register(root,{id:"provider",capabilities:["email"]}),true);
  const file=path.join(dir,"registry.json");
  assert.doesNotThrow(()=>JSON.parse(fs.readFileSync(file,"utf8")));
  assert.deepEqual(fs.readdirSync(dir),["registry.json"]);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
