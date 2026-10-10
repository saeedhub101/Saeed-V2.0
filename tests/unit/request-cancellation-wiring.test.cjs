"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..","..");
const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");

test("conversation cancellation is propagated as an AbortSignal through Brain to provider fetch",()=>{
 const conversation=read("src/main/conversation/conversation-agent.js");
 const brain=read("src/main/brain/brain.js");
 const executor=read("src/main/brain/model-executor.js");
 assert.match(conversation,/this\.requestController\?\.abort/);
 assert.match(conversation,/signal:controller\.signal/);
 assert.match(brain,/signal=null/);
 assert.match(brain,/providerDefaults:this\.providerDefaults,isCurrent:current,signal/);
 assert.match(executor,/signal=null/);
 assert.equal((executor.match(/provider\.chat\(\{messages,tools:registry\.schemas\(\),settings:s,model:s\.model\|\|null,signal,isCurrent:current\}\)/g)||[]).length,2,"add-on providers must receive the same cancellation signal and current-request guard");
 assert.match(executor,/signal\?\.addEventListener\?\.\("abort",cancelRequest/);
 assert.match(executor,/fetch\(url,\{method:"POST",headers,body:JSON\.stringify\(body\),signal:requestController\.signal\}\)/);
});

test("provider request cancellation does not use a recurring polling timer",()=>{
 const executor=read("src/main/brain/model-executor.js");
 assert.equal(executor.includes("requestCancellationPoll"),false);
 assert.equal(/setInterval\s*\(/.test(executor),false);
 assert.match(executor,/signal\?\.removeEventListener\?\.\("abort",cancelRequest\)/);
});
test("an aborted provider fetch settles without publishing a stale answer",async()=>{
 const {ModelExecutor}=require("../../src/main/brain/model-executor");
 const executor=new ModelExecutor();
 const controller=new AbortController();
 const originalFetch=global.fetch;
 let markFetchStarted;
 const fetchStarted=new Promise(resolve=>{markFetchStarted=resolve});
 const events=[];
 global.fetch=(url,options)=>new Promise((resolve,reject)=>{
  markFetchStarted();
  if(options.signal.aborted){reject(options.signal.reason||new Error("aborted"));return}
  options.signal.addEventListener("abort",()=>reject(options.signal.reason||new Error("aborted")),{once:true});
 });
 try{
  const running=executor.run({
   text:"test cancellation",settings:{provider:"openai",model:"test-model",baseUrl:"https://example.invalid/v1",apiKey:"test-key"},
   history:[],registry:{schemas:()=>[],call:async()=>({ok:true})},onEvent:event=>events.push(event),dir:process.cwd(),
   memoryContext:()=>"",saveHistory:()=>{},baseStepLimit:()=>1,askForMoreSteps:async()=>1,providerDefaults:()=>({}),
   isCurrent:()=>!controller.signal.aborted,signal:controller.signal
  });
  await fetchStarted;
  controller.abort(new Error("test cancellation"));
  const result=await running;
  assert.equal(result,"");
  assert.equal(events.some(event=>event.type==="answer"),false,"cancelled provider calls must not publish an answer");
 }finally{global.fetch=originalFetch}
});

test("Brain converts unexpected provider exceptions into a truthful recoverable result",async()=>{
 const {Brain}=require("../../src/main/brain/brain");
 const events=[];
 const brain=new Brain({registry:{schemas:()=>[]},getSettings:()=>({brainMode:"api",provider:"broken-provider"}),getDir:()=>process.cwd(),onEvent:event=>events.push(event),providerDefaults:()=>({}),memoryContext:()=>"",saveHistory:()=>{},baseStepLimit:()=>1});
 brain.api={run:async()=>{throw new Error("provider\r\nfailed")}};
 const result=await brain.run({text:"test provider error",history:[]});
 assert.equal(result.source,"api-provider-error");
 assert.match(result.answer,/failed before completing/);
 const diagnostic=events.find(event=>event.stage==="BRAIN PROVIDER FAILURE");
 assert.ok(diagnostic,"unexpected provider failures must be diagnosed");
 assert.equal(diagnostic.meta.error,"provider failed","diagnostics must normalize control characters without corrupting ordinary letters");
});
