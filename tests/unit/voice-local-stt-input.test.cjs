"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const fs=require("node:fs");
const os=require("node:os");
const {EventEmitter}=require("node:events");
const {PassThrough}=require("node:stream");
const {createVoiceHost}=require("../../src/main/voice/voice-host");
function host(dir,spawn=()=>{throw new Error("spawn should not be called for invalid audio")}){
 return createVoiceHost({app:{getPath:()=>dir},path,fs,spawn,diagnostic:()=>{},voiceBroadcast:()=>{},getAgent:()=>null,getAddonService:()=>({addonDir:()=>path.join(dir,"addons")}),ensureBrain:async()=>{},releaseBrainIfIdle:async()=>{},permissionPolicy:async()=>"allow",confirmPermission:async() =>true,rebuildTray:()=>{},showChat:()=>{},getCharacterWindow:()=>null,getStatusWindow:()=>null,diagnosticState:{mic:{}}});
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

test("concurrent local STT requests use separate temporary WAV files and clean them up",async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"saeed-whisper-concurrent-"));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const runtime=path.join(dir,"addons");fs.mkdirSync(runtime,{recursive:true});
 fs.writeFileSync(path.join(runtime,"whisper-cli.exe"),"stub");fs.writeFileSync(path.join(runtime,"ggml-base.bin"),"stub");
 const wavPaths=[];
 const service=host(dir,(exe,args)=>{
  const wav=args[args.indexOf("-f")+1];wavPaths.push(wav);
  const bytes=fs.readFileSync(wav);assert.equal(bytes.toString("ascii",0,4),"RIFF");assert.equal(bytes.toString("ascii",8,12),"WAVE");
  const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>{};
  process.nextTick(()=>{child.stdout.once("end",()=>child.emit("close",0));child.stdout.end("recognized speech\n");child.stderr.end()});
  return child;
 });
 const audio=Buffer.from([0,0,1,0,2,0,3,0]).toString("base64");
 const results=await Promise.all([service.transcribeLocalWav(audio),service.transcribeLocalWav(audio)]);
 assert.deepEqual(results,["recognized speech","recognized speech"]);
 assert.equal(wavPaths.length,2);assert.notEqual(wavPaths[0],wavPaths[1]);
 assert.ok(wavPaths.every(file=>!fs.existsSync(file)));
});
