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
 assert.match(executor,/signal\?\.addEventListener\?\.\("abort",cancelRequest/);
 assert.match(executor,/fetch\(url,\{method:"POST",headers,body:JSON\.stringify\(body\),signal:requestController\.signal\}\)/);
});

test("provider request cancellation does not use a recurring polling timer",()=>{
 const executor=read("src/main/brain/model-executor.js");
 assert.equal(executor.includes("requestCancellationPoll"),false);
 assert.equal(/setInterval\s*\(/.test(executor),false);
 assert.match(executor,/signal\?\.removeEventListener\?\.\("abort",cancelRequest\)/);
});
