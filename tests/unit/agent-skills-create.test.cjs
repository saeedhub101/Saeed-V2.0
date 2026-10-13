"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const agentSkills=require("../../src/tools/agent-skills");
const learning=require("../../src/learning");

test("agent can persist a reusable workflow after a verified task",t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"saeed-agent-skill-create-"));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 assert.ok(agentSkills.schemas()[0].function.parameters.properties.operation.enum.includes("create"));
 const result=agentSkills.call("agent_skills",{operation:"create",name:"Open named application",description:"Open an app specified by the user",triggerPhrases:["open application","launch app"],parameters:[{name:"appName",description:"Application name",required:true}],steps:[{tool:"open_application",args:{name:"Calculator"}}]},{userDataPath:dir});
 assert.equal(result.ok,true);
 assert.equal(result.skill.stepCount,1);
 assert.equal(learning.get(dir,result.skill.id).steps.length,1);
});

test("workflow creation rejects incomplete or duplicate skills",t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"saeed-agent-skill-duplicate-"));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const incomplete=agentSkills.call("agent_skills",{operation:"create",name:"Missing steps",triggerPhrases:["do it"]},{userDataPath:dir});
 assert.equal(incomplete.ok,false);
 const input={operation:"create",name:"Unique workflow",triggerPhrases:["do workflow"],steps:[{tool:"open_application",args:{name:"Calculator"}}]};
 assert.equal(agentSkills.call("agent_skills",input,{userDataPath:dir}).ok,true);
 const duplicate=agentSkills.call("agent_skills",input,{userDataPath:dir});
 assert.equal(duplicate.ok,false);
 assert.match(duplicate.error,/already exists/);
});
