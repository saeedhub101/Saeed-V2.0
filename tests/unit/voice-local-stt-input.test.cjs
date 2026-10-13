"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const fs=require("node:fs");
const os=require("node:os");
const {createVoiceHost}=require("../../src/main/voice/voice-host");
function host(dir){
 return createVoiceHost({app:{getPath:()=>dir},path,fs,spawn:()=>{throw new Error("spawn should not be called for invalid audio")},diagnostic:()=>{},voiceBroadcast:()=>{},getAgent:()=>null,getAddonService:()=>({addonDir:()=>path.join(dir,"addons")}),ensureBrain:async()=>{},releaseBrainIfIdle:async()=>{},permissionPolicy:async()=>"allow",confirmPermission:async() =>true,rebuildTray:()=>{},showChat:()=>{},getCharacterWindow:()=>null,getStatusWindow:()=>null,diagnosticState:{mic:{}}});
}
test("local STT rejects malformed or empty audio before touching the Whisper runtime",async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"saeed-whisper-input-"));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const service=host(dir);
 await assert.rejects(service.transcribeLocalWav(""),/valid base64 PCM/);
 await assert.rejects(service.transcribeLocalWav("%%%"),/valid base64 PCM/);
 await assert.rejects(service.transcribeLocalWav("YQ=="),/16-bit PCM/);
});
test("local STT bounds audio payload size before decoding",async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"saeed-whisper-size-"));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const service=host(dir);
 await assert.rejects(service.transcribeLocalWav("A".repeat(16777220)),/no larger than 12 MiB/);
});
