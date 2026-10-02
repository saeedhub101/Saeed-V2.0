const assert=require("assert"),fs=require("fs"),os=require("os"),path=require("path");
const {TaskRouter}=require("../src/task-router");
const {TaskPlanner}=require("../src/task-planner");
const {TaskEngine}=require("../src/task-engine");
const {ToolRegistry}=require("../src/tools/registry");

(async()=>{
 const localBrain={};
 let r=new TaskRouter({getSettings:()=>({brainMode:"local"}),getLocalBrain:()=>localBrain});assert.equal((await r.route("open a file")).brain,"local");
 r=new TaskRouter({getSettings:()=>({brainMode:"api"}),getLocalBrain:()=>localBrain});assert.equal((await r.route("open a file")).brain,"api");
 r=new TaskRouter({getSettings:()=>({brainMode:"auto"}),getLocalBrain:()=>localBrain});assert.equal((await r.route("hello")).brain,"local");assert.equal((await r.route("open a file and then create a report")).brain,"api");
 const planner=new TaskPlanner(),plan=await planner.create({text:"open file and create report",route:{brain:"api",type:"agent",complexity:"complex"}});assert.deepEqual(plan.steps,["inspect_state","plan_actions","execute_actions","report_completion"]);planner.markAction(plan,"open_file",{ok:true});assert.deepEqual(plan.completedActions,["open_file"]);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"saeed-task-"));const events=[];let began=0,ended=0;
 const agent={settings:{brainMode:"api",maxSteps:16},localBrain:null,beginTask(){began++},endTask(){ended++},async run(text,image,options){assert.equal(options.brain,"api");assert(options.taskPlan);return"done"}};
 const engine=new TaskEngine({agent,userDataPath:dir,emit:e=>events.push(e)});const result=await engine.run("create a report",null,{source:"test"});assert.equal(result,"done");assert.equal(began,1);assert.equal(ended,1);assert(events.some(e=>e.type==="task:start"));assert(events.some(e=>e.type==="task:complete"));assert.equal(engine.loadState(),null);
 let confirmations=0;const reg=new ToolRegistry({userDataPath:dir,permissionPolicy:()=> "allow",confirm:async()=>{confirmations++;return true}});const temp=path.join(dir,"delete-me.txt");fs.writeFileSync(temp,"x");const deleted=await reg.call("delete_file",{filePath:temp});assert(deleted.ok&&deleted.deleted&&confirmations===1);
 const read=await reg.call("read_file",{filePath:path.join(dir,"missing.txt")});assert(read.ok===false&&confirmations===1);fs.writeFileSync(temp,"old");const overwrite=await reg.call("write_file",{filePath:temp,content:"new"});assert(overwrite.ok&&confirmations===2);
 fs.rmSync(dir,{recursive:true,force:true});console.log("Saeed task architecture tests: PASS");
})().catch(e=>{console.error(e);process.exit(1)});
