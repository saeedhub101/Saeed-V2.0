"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {SettingsStore}=require("../../src/main/services/settings-store");

test("settings are atomically persisted and reload with normalized preferences",t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"saeed-settings-"));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const store=new SettingsStore(dir);
 const next=store.apply(store.load(),{language:"ar",maxSteps:24,permissions:{files:"deny"}});
 assert.equal(next.language,"ar");
 assert.equal(next.maxSteps,24);
 const loaded=store.load();
 assert.equal(loaded.language,"ar");
 assert.equal(loaded.maxSteps,24);
 assert.equal(loaded.permissions.files,"deny");
 assert.equal(fs.existsSync(store.file),true);
 assert.deepEqual(store.providerDefaults("ollama"),{baseUrl:"http://localhost:11434/v1",model:"llama3.2"});
 assert.deepEqual(fs.readdirSync(dir).filter(name=>name.includes(".tmp-")),[]);
});

test("settings changes fail loudly when durable persistence fails",t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"saeed-settings-fail-"));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const store=new SettingsStore(dir);
 const previous=store.load();
 store.file=path.join(dir,"missing-parent","settings.json");
 assert.throws(()=>store.apply(previous,{language:"ar"}),/previous settings were preserved/);
 assert.equal(previous.language,"en");
});
test("provider fallback preferences and credential presence survive settings reload",t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"saeed-fallback-settings-"));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const store=new SettingsStore(dir);
 store.apply(store.load(),{fallbackEnabled:true,fallbackProvider:"ollama",fallbackBaseUrl:"http://localhost:11434/v1",fallbackModel:"llama3.2",fallbackApiKey:"fallback-secret"});
 const loaded=store.load();
 assert.equal(loaded.fallbackEnabled,true);
 assert.equal(loaded.fallbackProvider,"ollama");
 assert.equal(loaded.fallbackApiKey,"fallback-secret");
 const safe=store.public(loaded);
 assert.equal(safe.fallbackApiKey,"");
 assert.equal(safe.hasFallbackApiKey,true);
});
