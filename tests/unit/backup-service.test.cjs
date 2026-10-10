"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {writeJsonAtomic}=require("../../src/main/services/atomic-json-store");
const backupService=require("../../src/main/services/backup-service");
const memory=require("../../src/main/services/memory-service");
function makeAgent(userData){
 let currentSettings={provider:"openai",model:"gpt-5",language:"en",apiKey:"keep-this-secret",permissions:{files:"ask"}};
 const agent={get settings(){return currentSettings},set settings(value){currentSettings={...currentSettings,...value}},conversations:[{id:"chat-1",title:"Original chat",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),messages:[{role:"user",content:"Remember this"},{role:"assistant",content:"Saved"}]}],currentConversationId:"chat-1",history:[],globalMemory:{facts:[]},memoryFile:path.join(userData,"global-memory.json"),saveConversations(){return true},saveHistory(){return true}};
 agent.history=agent.conversations[0].messages.slice();
 return agent;
}
test("backup excludes API secrets and restores settings, conversations and saved memory facts",t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"saeed-backup-test-"));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const agent=makeAgent(dir);
 memory.addFact(dir,"preferred language is English");
 const backup=backupService.createBackup({agent,userDataPath:dir,allowedSettingKeys:Object.keys(agent.settings)});
 assert.equal(backup.format,"saeed-ai-backup");
 assert.equal(Object.hasOwn(backup.settings,"apiKey"),false,"API keys must not enter backup files");
 assert.equal(backup.conversations.conversations.length,1);
 assert.equal(backup.globalMemory.facts.length,1);
 agent.settings={provider:"changed",language:"ar"};
 agent.conversations=[{id:"chat-2",title:"Temporary chat",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),messages:[{role:"user",content:"temporary"}]}];
 agent.currentConversationId="chat-2";agent.history=agent.conversations[0].messages.slice();
 memory.writeFacts(dir,[{key:"temporary",text:"temporary fact",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}]);
 const restored=backupService.restoreBackup({backup,agent,userDataPath:dir});
 assert.equal(restored.ok,true);
 assert.equal(agent.settings.provider,"openai");
 assert.equal(agent.settings.language,"en");
 assert.equal(agent.settings.apiKey,"keep-this-secret","restore must preserve credentials already on this computer");
 assert.equal(agent.conversations.length,1);
 assert.equal(agent.conversations[0].id,"chat-1");
 assert.equal(memory.listFacts(dir)[0].text,"preferred language is English");
});
test("backup validation rejects unknown formats and malformed conversation archives",()=>{
 assert.throws(()=>backupService.validateBackup({format:"other",version:1},[]),/unsupported format/);
 assert.throws(()=>backupService.validateBackup({format:"saeed-ai-backup",version:1,settings:{},conversations:{format:"bad"},globalMemory:{facts:[]}},[]),/Invalid conversation archive/);
});
