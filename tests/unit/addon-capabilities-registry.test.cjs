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

test("add-on context path resolution cannot escape its own data directory",()=>{
 const runtime=require("../../src/addons/runtime");
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"saeed-addon-path-"));
 try{
  const expected=path.join(root,"addons","mail-provider","cache","entry.json");
  assert.equal(runtime.resolveAddonPath(root,"mail-provider","cache/entry.json"),expected);
  assert.throws(()=>runtime.resolveAddonPath(root,"mail-provider","../other/secret.json"),/escapes its isolated data directory/);
  assert.throws(()=>runtime.resolveAddonPath(root,"mail-provider",path.resolve(root,"outside.txt")),/escapes its isolated data directory/);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});

test("add-on path resolver rejects symlink escapes from an installed provider",()=>{
 const runtime=require("../../src/addons/runtime");
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"saeed-addon-symlink-"));
 const outside=fs.mkdtempSync(path.join(os.tmpdir(),"saeed-addon-outside-"));
 const addon=path.join(root,"addons","provider");
 try{
  fs.mkdirSync(addon,{recursive:true});
  try{fs.symlinkSync(outside,path.join(addon,"external"),process.platform==="win32"?"junction":"dir")}catch(error){
   if(process.platform==="win32"&&["EPERM","EACCES","UNKNOWN"].includes(error.code))return;
   throw error;
  }
  assert.throws(()=>runtime.resolveAddonPath(root,"provider","external/secret.txt"),/symlink/);
 }finally{fs.rmSync(root,{recursive:true,force:true});fs.rmSync(outside,{recursive:true,force:true})}
});

test("add-on manifests cannot declare executable entries outside their installation",()=>{
 const manager=require("../../src/addons/manager");
 const base={schemaVersion:1,id:"provider",name:"Provider",version:"1.0.0",capabilities:["email"]};
 assert.throws(()=>manager.validateManifest({...base,entry:"../outside.js"}),/Invalid add-on entry/);
 assert.throws(()=>manager.validateManifest({...base,entry:path.resolve("outside.js")}),/Invalid add-on entry/);
 assert.equal(manager.validateManifest({...base,entry:"lib/provider.js"}).entry,"lib/provider.js");
});

test("resolved add-on entry paths must remain inside the installed package",()=>{
 const manager=require("../../src/addons/manager");
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"saeed-addon-entry-"));
 const entry=path.join(root,"addons","provider","lib","entry.js");
 try{
  fs.mkdirSync(path.dirname(entry),{recursive:true});fs.writeFileSync(entry,"module.exports={}","utf8");
  assert.equal(manager.resolveEntryPath(root,"provider","lib/entry.js"),entry);
  assert.throws(()=>manager.resolveEntryPath(root,"provider","../outside.js"),/escapes its installation directory/);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
