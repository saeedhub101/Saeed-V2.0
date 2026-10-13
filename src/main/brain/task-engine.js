const fs=require("fs"),path=require("path"),crypto=require("crypto");
const {writeJsonAtomic}=require("../services/atomic-json-store");
const ROOT="agent-runs",MAX_RUNS=100,MAX_STEPS=200;
function directory(userData){return path.join(userData,ROOT)}
function safeText(value,max=500){return String(value??"").replace(/[\r\n\t]+/g," ").trim().slice(0,max)}
function ensure(userData){fs.mkdirSync(directory(userData),{recursive:true});return directory(userData)}
function fileFor(userData,id){if(!/^[a-z0-9-]{8,80}$/i.test(String(id||"")))throw new Error("Invalid task run id");return path.join(directory(userData),id+".json")}
function persist(userData,run){run.updatedAt=new Date().toISOString();const result=writeJsonAtomic(fileFor(userData,run.id),run);if(!result?.ok)throw new Error("Task run persistence failed: "+(result?.error||"unknown error"));return run}
function begin(userData,goal){
 ensure(userData);
 const id=Date.now().toString(36)+"-"+crypto.randomBytes(6).toString("hex");
 const run={schemaVersion:1,id,goal:safeText(goal,2000),status:"running",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),finishedAt:null,steps:[],lastActionAt:null,verification:{attempted:false,evidence:[]},plan:[],summary:""};
 persist(userData,run);
 return run;
}
function get(userData,id){const file=fileFor(userData,id);if(!fs.existsSync(file))return null;return JSON.parse(fs.readFileSync(file,"utf8"))}
function setPlan(userData,id,steps){
 const run=get(userData,id);if(!run||run.status!=="running")throw new Error("Active task run not found");
 if(!Array.isArray(steps)||!steps.length||steps.length>30)throw new Error("A task plan must contain 1-30 steps");
 if(steps.some(step=>!safeText(step?.title,180)||!safeText(step?.successCriteria,300)))throw new Error("Every plan step requires a title and measurable success criteria");
 run.plan=steps.map((step,index)=>({index:index+1,title:safeText(step.title,180),successCriteria:safeText(step.successCriteria,300),status:"pending",startedAt:null,finishedAt:null,evidence:""}));
 return persist(userData,run);
}
function updatePlanStep(userData,id,index,status,evidence=""){
 const run=get(userData,id);if(!run||run.status!=="running")throw new Error("Active task run not found");
 const step=run.plan?.[Number(index)-1];if(!step)throw new Error("Task plan step not found");
 const next=String(status||"");
 if(!["pending","running","completed","failed","skipped","needs_approval","interrupted"].includes(next))throw new Error("Invalid task plan step status");
 if(next==="completed"&&!String(evidence||"").trim())throw new Error("A completed plan step requires verification evidence");
 const now=new Date().toISOString();step.status=next;
 if(next==="running"&&!step.startedAt)step.startedAt=now;
 if(["completed","failed","skipped","needs_approval","interrupted"].includes(next))step.finishedAt=now;
 if(evidence)step.evidence=safeText(evidence,300);
 return persist(userData,run);
}
function observe(userData,id,event){
 if(!event||typeof event!=="object")return null;
 const run=get(userData,id);if(!run||run.status!=="running")return run;
 const now=new Date().toISOString(),type=String(event.type||""),toolName=String(event.name||"");
 if(toolName==="task_plan")return run;
 const mutatingTools=new Set(["open_application","open_url","write_file","write_excel","mouse_click","type_text","key_press","interact_ui_element","email_send","mcp_call_tool","complete_task","remove_task"]);
 if(type==="tool"&&mutatingTools.has(toolName))run.lastActionAt=now;
 if(type==="tool"){
  if(run.steps.length>=MAX_STEPS)return run;
  const name=safeText(event.name,100);
  run.steps.push({index:run.steps.length+1,tool:name,status:"running",startedAt:now,finishedAt:null,argsShape:Object.keys(event.args&&typeof event.args==="object"?event.args:{}).slice(0,40),resultShape:[],error:""});
 }else if(type==="tool_result"||type==="tool_error"){
  const name=safeText(event.name,100);
  let step=null;
  for(let i=run.steps.length-1;i>=0;i--){if(run.steps[i].tool===name&&run.steps[i].status==="running"){step=run.steps[i];break}}
  if(step){
   step.status=type==="tool_error"?"failed":"returned";
   step.finishedAt=now;
   if(type==="tool_result")for(const previous of run.steps){if(previous!==step&&previous.tool===name&&previous.status==="failed"){previous.status="recovered";previous.recoveredAt=now}}
   if(type==="tool_error")step.error=safeText(event.error,240);
   else step.resultShape=Object.keys(event.result&&typeof event.result==="object"?event.result:{}).slice(0,40);
   if(["read_file","list_directory","inspect_document","extract_pdf_text","read_excel","active_window","list_windows","inspect_window_controls","screenshot","ocr_image","inspect_image","fetch_web_page"].includes(name)){
    run.verification.attempted=true;
    run.verification.evidence.push({at:now,tool:name,result:type==="tool_result"?"returned":"failed",afterAction:Boolean(run.lastActionAt&&now>=run.lastActionAt)});
    if(run.verification.evidence.length>30)run.verification.evidence.shift();
   }
  }
 }else if(type==="diagnostic"&&/timeout|failure|error|retry/i.test(String(event.stage||"")+" "+String(event.level||""))){
  run.lastDiagnostic={at:now,stage:safeText(event.stage,100),level:safeText(event.level,30),message:safeText(event.message,240)};
 }
 return persist(userData,run);
}
function finish(userData,id,{status="finished",summary="",verification=null}={}){
 const run=get(userData,id);if(!run)return null;
 if(run.status!=="running")return run;
 run.status=["finished","needs_attention","cancelled"].includes(status)?status:"finished";
 run.summary=safeText(summary,1000);run.finishedAt=new Date().toISOString();
 for(const step of run.steps)if(step.status==="running"){step.status="interrupted";step.finishedAt=run.finishedAt}
 for(const step of run.plan||[])if(step.status==="running"){step.status="interrupted";step.finishedAt=run.finishedAt}
 if(verification&&typeof verification==="object")run.verification={...run.verification,...verification};
 return persist(userData,run);
}
function list(userData,limit=20){
 const dir=ensure(userData);
 return fs.readdirSync(dir,{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith(".json")).map(x=>{try{return JSON.parse(fs.readFileSync(path.join(dir,x.name),"utf8"))}catch{return null}}).filter(Boolean).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,Math.max(1,Math.min(100,Number(limit)||20)));
}
module.exports={begin,get,setPlan,updatePlanStep,observe,finish,list};
