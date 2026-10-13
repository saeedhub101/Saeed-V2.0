"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const engine=require("../../src/main/brain/task-engine");

function temp(){return fs.mkdtempSync(path.join(os.tmpdir(),"saeed-task-engine-"))}
test("a pending plan step cannot be marked completed before it starts",t=>{
 const dir=temp();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const run=engine.begin(dir,"test plan state");
 engine.setPlan(dir,run.id,[{title:"Do the action",successCriteria:"State changed"}]);
 assert.throws(()=>engine.updatePlanStep(dir,run.id,1,"completed","I say it worked"),/must be started/);
 assert.equal(engine.get(dir,run.id).plan[0].status,"pending");
 engine.updatePlanStep(dir,run.id,1,"running");
 engine.updatePlanStep(dir,run.id,1,"completed","Observed resulting state");
 assert.equal(engine.get(dir,run.id).plan[0].status,"completed");
});
test("MCP discovery and connection checks do not verify a prior state-changing action",t=>{
 const dir=temp();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const run=engine.begin(dir,"verify an external action");
 engine.observe(dir,run.id,{type:"tool",name:"write_file",args:{path:"example.txt"}});
 engine.observe(dir,run.id,{type:"tool_result",name:"write_file",result:{ok:true}});
 engine.observe(dir,run.id,{type:"tool",name:"mcp_call_tool",args:{tool:"mcp_list_tools"}});
 engine.observe(dir,run.id,{type:"tool_result",name:"mcp_call_tool",result:{tools:["write_file"]}});
 const saved=engine.get(dir,run.id);
 assert.equal(saved.verification.evidence.some(item=>item.tool==="mcp_call_tool"),false);
 assert.equal(engine.finish(dir,run.id,{status:"finished",summary:"claimed done"}).status,"needs_attention");
});
