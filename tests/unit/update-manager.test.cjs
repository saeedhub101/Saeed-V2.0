"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {EventEmitter}=require("node:events");
const {createUpdateManager}=require("../../src/main/application/update-manager");
function fixture(updateMode="manual",version="2.0.0"){
 const updater=new EventEmitter();updater.downloadCalls=0;updater.installCalls=0;updater.checkForUpdates=async()=>({updateInfo:{version}});updater.downloadUpdate=async()=>{updater.downloadCalls++;return true};updater.quitAndInstall=()=>{updater.installCalls++};
 const manager=createUpdateManager({app:{isPackaged:true,getVersion:()=>"1.0.0"},getAutoUpdater:()=>updater,getSettings:()=>({updateMode}),voiceBroadcast:()=>{},diagnostic:()=>{}});manager.bind();return{updater,manager};
}
test("manual update policy never downloads automatically",()=>{const{updater,manager}=fixture("manual");updater.emit("update-available",{version:"2.0.0"});assert.equal(manager.getState(),"available");assert.equal(updater.downloadCalls,0);assert.equal(updater.autoDownload,false);assert.equal(updater.autoInstallOnAppQuit,false)});
test("automatic update policy downloads but waits for explicit installation",async()=>{const{updater,manager}=fixture("automatic");updater.emit("update-available",{version:"2.0.0"});assert.equal(manager.getState(),"downloading");await new Promise(resolve=>setImmediate(resolve));assert.equal(updater.downloadCalls,1);updater.emit("update-downloaded",{version:"2.0.0"});assert.equal(manager.getState(),"downloaded");assert.equal(manager.install(),true);assert.equal(updater.installCalls,1)});
test("update checks are disabled for unpackaged development builds",async()=>{const updater=new EventEmitter();let checks=0;updater.checkForUpdates=async()=>{checks++};const manager=createUpdateManager({app:{isPackaged:false,getVersion:()=>"1.0.0"},getAutoUpdater:()=>updater,diagnostic:()=>{}});const result=await manager.check();assert.equal(result.state,"unavailable");assert.equal(checks,0)});
test("a successful check marks a newer release available even without an event",async()=>{const{manager}=fixture("manual");const result=await manager.check();assert.equal(result.state,"available");assert.equal(result.version,"2.0.0")});
test("a successful check marks the current release as latest",async()=>{const{updater,manager}=fixture("manual","1.0.0");const result=await manager.check();assert.equal(result.state,"latest");assert.equal(result.currentVersion,"1.0.0")});
test("binding twice does not duplicate updater event handlers",()=>{const{updater,manager}=fixture();const before=updater.listenerCount("update-available");assert.equal(manager.bind(),false);assert.equal(updater.listenerCount("update-available"),before)});
test("concurrent update checks share one request",async()=>{const{updater,manager}=fixture();let calls=0;let release;updater.checkForUpdates=()=>{calls++;return new Promise(resolve=>{release=()=>resolve({updateInfo:{version:"2.0.0"}})})};const a=manager.check(),b=manager.check();assert.equal(calls,1);release();assert.equal((await a).state,"available");assert.equal((await b).state,"available")});

test("update state messages do not overwrite the update metadata",async()=>{
 const{manager,updater}=fixture("manual");
 const result=await manager.check();
 assert.equal(result.state,"available");
 assert.equal(result.info.version,"2.0.0");
 assert.match(result.message,/2\.0\.0/);
 updater.emit("update-downloaded",{version:"2.0.0"});
 const ready=manager.snapshot();
 assert.equal(ready.info.version,"2.0.0");
 assert.match(ready.message,/ready to install/i);
});
