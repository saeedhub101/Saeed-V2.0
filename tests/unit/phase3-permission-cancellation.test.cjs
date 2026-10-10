"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {createPermissionManager}=require("../../src/main/application/permission-manager");

test("cancelling a request dismisses its pending permission wait and denies execution",async()=>{
 const controller=new AbortController(),sent=[],diagnostics=[];
 const chatWindow={isDestroyed:()=>false,webContents:{isDestroyed:()=>false,send:(channel,payload)=>sent.push({channel,payload})}};
 const manager=createPermissionManager({getAgent:()=>({settings:{permissions:{files:"ask"}}}),showChat:async()=>{},getChatWindow:()=>chatWindow,diagnostic:(...args)=>diagnostics.push(args)});
 const pending=manager.confirmPermission("files",{name:"read_file",args:{filePath:"example.txt"},signal:controller.signal});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(sent.length,1);
 assert.equal(sent[0].channel,"agent:confirm");
 assert.equal(manager.confirmations.size,1);
 controller.abort(new Error("conversation switched"));
 assert.equal(await pending,false);
 assert.equal(manager.confirmations.size,0);
 assert.ok(diagnostics.some(item=>String(item[2]).includes("cancelled with its originating request")));
});

test("an already-aborted request never opens a confirmation prompt",async()=>{
 const controller=new AbortController();controller.abort();
 let sent=0;
 const manager=createPermissionManager({getAgent:()=>({settings:{permissions:{files:"ask"}}}),showChat:async()=>{},getChatWindow:()=>({isDestroyed:()=>false,webContents:{isDestroyed:()=>false,send:()=>sent++}}),diagnostic:()=>{}});
 assert.equal(await manager.confirmPermission("files",{name:"read_file",signal:controller.signal}),false);
 assert.equal(sent,0);
});
