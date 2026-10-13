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
 assert.throws(()=>engine.updatePlanStep(dir,run.id,1,"completed","Observed resulting state"),/observed successful tool result/);
 engine.observe(dir,run.id,{type:"tool",name:"read_file",args:{path:"example.txt"}});
 engine.observe(dir,run.id,{type:"tool_result",name:"read_file",result:{ok:true,content:"verified"}});
 engine.updatePlanStep(dir,run.id,1,"completed","Read-back confirmed the expected state");
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

test("evidence without an explicit post-action link cannot verify a state-changing action",t=>{
 const dir=temp();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const run=engine.begin(dir,"reject unrelated verification");
 engine.observe(dir,run.id,{type:"tool",name:"write_file",args:{path:"example.txt"}});
 engine.observe(dir,run.id,{type:"tool_result",name:"write_file",result:{ok:true}});
 const file=path.join(dir,"agent-runs",run.id+".json");
 const saved=JSON.parse(fs.readFileSync(file,"utf8"));
 saved.verification.evidence.push({at:new Date(Date.now()+1000).toISOString(),tool:"read_file",result:"returned",afterAction:false});
 fs.writeFileSync(file,JSON.stringify(saved));
 const finished=engine.finish(dir,run.id,{status:"finished",summary:"claimed done",verification:{attempted:true,evidence:[{at:new Date().toISOString(),tool:"spoofed-proof",result:"returned",afterAction:true}]}});
 assert.equal(finished.status,"needs_attention");
 assert.equal(finished.verification.evidence.some(item=>item.tool==="spoofed-proof"),false);
});
