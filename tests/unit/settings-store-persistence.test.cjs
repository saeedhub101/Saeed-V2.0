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
