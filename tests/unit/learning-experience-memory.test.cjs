"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const memory=require("../../src/learning/experience-memory");

test("verified successful experience persists and is recalled for a similar task",t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"saeed-learning-experience-"));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const saved=memory.record(dir,{goal:"Create a new Excel workbook and save it",tools:["open_application","write_excel","read_excel"],outcome:"success",verified:true});
 assert.equal(saved.saved,true);
 const hits=memory.recall(dir,"create Excel workbook and save",3);
 assert.equal(hits.length,1);
 assert.equal(hits[0].successes,1);
 assert.match(memory.promptText(dir,"create Excel workbook and save"),/Previously verified tool sequence/);
});

test("failed experience is recalled as a caution rather than a trusted recipe",t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"saeed-learning-failure-"));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 memory.record(dir,{goal:"Submit a customer record in the CRM",tools:["inspect_window_controls","interact_ui_element","inspect_window_controls"],outcome:"failure",failureTool:"interact_ui_element"});
 const prompt=memory.promptText(dir,"submit customer record CRM");
 assert.match(prompt,/not reliably successful/);
 assert.match(prompt,/interact_ui_element/);
 assert.doesNotMatch(prompt,/Previously verified tool sequence/);
});

test("experience memory ignores underspecified single-action runs",t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"saeed-learning-short-"));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const result=memory.record(dir,{goal:"Open Excel",tools:["open_application"],outcome:"success",verified:true});
 assert.equal(result.saved,false);
 assert.equal(fs.existsSync(path.join(dir,"learning-experiences.json")),false);
});
