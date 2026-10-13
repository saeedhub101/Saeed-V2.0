const fs=require("fs"),path=require("path"),crypto=require("crypto");
const {writeJsonAtomic}=require("../services/atomic-json-store");
const ROOT="agent-runs",MAX_RUNS=100,MAX_STEPS=200;
function directory(userData){return path.join(userData,ROOT)}
function safeText(value,max=500){return String(value??"").replace(/[\r\n\t]+/g," ").trim().slice(0,max)}
function ensure(userData){fs.mkdirSync(directory(userData),{recursive:true});return directory(userData)}
function fileFor(userData,id){if(!/^[a-z0-9-]{8,80}$/i.test(String(id||"")))throw new Error("Invalid task run id");return path.join(directory(userData),id+".json")}
function persist(userData,run){run.updatedAt=new Date().toISOString();const result=writeJsonAtomic(fileFor(userData,run.id),run);if(!result?.ok)throw new Error("Task run persistence failed: "+(result?.error||"unknown error"));return run}
function prune(userData,keepId){
 const dir=ensure(userData);
 const files=fs.readdirSync(dir,{withFileTypes:true}).filter(entry=>entry.isFile()&&entry.name.endsWith(".json")).map(entry=>{const file=path.join(dir,entry.name);let createdAt=0;try{createdAt=Date.parse(JSON.parse(fs.readFileSync(file,"utf8")).createdAt)||fs.statSync(file).mtimeMs}catch{try{createdAt=fs.statSync(file).mtimeMs}catch{}}return{file,name:entry.name,createdAt}}).sort((a,b)=>b.createdAt-a.createdAt);
 let kept=0;
 for(const entry of files){if(entry.name===String(keepId)+".json"||kept<MAX_RUNS){kept++;continue}try{fs.unlinkSync(entry.file)}catch{}}
}
function recoverStaleRuns(userData,maxAgeMs=12*60*60*1000){
 const dir=ensure(userData),now=Date.now(),recovered=[];
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  if(!entry.isFile()||!entry.name.endsWith(".json"))continue;
  let run;try{run=JSON.parse(fs.readFileSync(path.join(dir,entry.name),"utf8"))}catch{continue}
  if(run?.status!=="running")continue;
  const updated=Date.parse(run.updatedAt||run.createdAt||"");
  if(!Number.isFinite(updated)||now-updated<maxAgeMs)continue;
  const finishedAt=new Date().toISOString();
  const uncertainActions=(run.steps||[]).filter(step=>step.status==="running").map(step=>({index:step.index,tool:safeText(step.tool,100),externalTool:safeText(step.externalTool||"",120),operation:safeText(step.operation||"",30),startedAt:step.startedAt||null}));
  run.status="needs_attention";run.finishedAt=finishedAt;
  run.summary="Recovered after the app restarted or the task stopped responding. Review the saved step log before continuing; actions were not replayed automatically.";
  for(const step of run.steps||[])if(step.status==="running"){step.status="interrupted";step.finishedAt=finishedAt}
  for(const step of run.plan||[])if(step.status==="running"||step.status==="pending"){step.status="interrupted";step.finishedAt=finishedAt}
  run.recovery={at:finishedAt,reason:"stale-running-task",autoReplay:false,uncertainActions,lastActionAt:run.lastActionAt||null};
  persist(userData,run);recovered.push({id:run.id,goal:run.goal,status:run.status});
 }
 return recovered;
}
function begin(userData,goal){
 ensure(userData);
 recoverStaleRuns(userData);
 const id=Date.now().toString(36)+"-"+crypto.randomBytes(6).toString("hex");
 const run={schemaVersion:1,id,goal:safeText(goal,2000),status:"running",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),finishedAt:null,steps:[],lastActionAt:null,verification:{attempted:false,evidence:[]},plan:[],summary:""};
 persist(userData,run);
 prune(userData,id);
 return run;
}
function get(userData,id){const file=fileFor(userData,id);if(!fs.existsSync(file))return null;return JSON.parse(fs.readFileSync(file,"utf8"))}
function setPlan(userData,id,steps){
 const run=get(userData,id);if(!run||run.status!=="running")throw new Error("Active task run not found");
 if(Array.isArray(run.plan)&&run.plan.length)throw new Error("A task plan already exists; use append_steps to preserve progress");
 if(!Array.isArray(steps)||!steps.length||steps.length>30)throw new Error("A task plan must contain 1-30 steps");
 if(steps.some(step=>!safeText(step?.title,180)||!safeText(step?.successCriteria,300)))throw new Error("Every plan step requires a title and measurable success criteria");
 run.plan=steps.map((step,index)=>({index:index+1,title:safeText(step.title,180),successCriteria:safeText(step.successCriteria,300),status:"pending",startedAt:null,finishedAt:null,evidence:""}));
 return persist(userData,run);
}
function appendPlanSteps(userData,id,steps){
 const run=get(userData,id);if(!run||run.status!=="running")throw new Error("Active task run not found");
 if(!Array.isArray(steps)||!steps.length)throw new Error("Provide at least one plan step to append");
 if(!Array.isArray(run.plan))run.plan=[];
 if(run.plan.length+steps.length>30)throw new Error("A task plan supports at most 30 steps");
 if(steps.some(step=>!safeText(step?.title,180)||!safeText(step?.successCriteria,300)))throw new Error("Every appended plan step requires a title and measurable success criteria");
 for(const step of steps)run.plan.push({index:run.plan.length+1,title:safeText(step.title,180),successCriteria:safeText(step.successCriteria,300),status:"pending",startedAt:null,finishedAt:null,evidence:""});
 return persist(userData,run);
}
function updatePlanStep(userData,id,index,status,evidence=""){
 const run=get(userData,id);if(!run||run.status!=="running")throw new Error("Active task run not found");
 const step=run.plan?.[Number(index)-1];if(!step)throw new Error("Task plan step not found");
 const next=String(status||"");
 if(!["pending","running","completed","failed","skipped","needs_approval","interrupted"].includes(next))throw new Error("Invalid task plan step status");
 if(["completed","failed","skipped","interrupted"].includes(step.status)&&next!==step.status)throw new Error("Terminal plan steps are immutable; append a recovery step instead");
 if(next==="completed"&&step.status!=="running")throw new Error("A plan step must be started before it can be completed");
 if(next==="completed"&&!String(evidence||"").trim())throw new Error("A completed plan step requires verification evidence");
 const now=new Date().toISOString();step.status=next;
 if(next==="running"&&!step.startedAt)step.startedAt=now;
 if(["completed","failed","skipped","needs_approval","interrupted"].includes(next))step.finishedAt=now;
 if(evidence)step.evidence=safeText(evidence,300);
 return persist(userData,run);
}
function isReadOnlyMcpTool(name){
 const value=String(name||"").toLowerCase().trim().replace(/\s+/g,"-");
 if(/^(mcp[-_])?(list[-_]servers|test[-_]connection|list[-_]tools|list[-_]resources|read[-_]resource|list[-_]prompts|get[-_]prompt)$/.test(value))return false;
 const readPattern=/(?:^|[_-])(get|list|read|search|find|fetch|query|inspect|describe|status|check|lookup|enumerate|count|show|view|discover|validate|head|stat|select)(?:[_-]|$)/;
 const writePattern=/(?:^|[_-])(delete|remove|update|create|write|send|submit|post|put|patch|approve|pay|issue|execute|run|start|stop|cancel|purchase|publish|commit|insert|upsert)(?:[_-]|$)/;
 return Boolean(readPattern.test(value)&&!writePattern.test(value));
}
function observe(userData,id,event){
 if(!event||typeof event!=="object")return null;
 const run=get(userData,id);if(!run||run.status!=="running")return run;
 const now=new Date().toISOString(),type=String(event.type||""),toolName=String(event.name||"");
 if(toolName==="task_plan")return run;
 const mutatingTools=new Set(["open_application","open_url","write_file","write_excel","mouse_click","type_text","key_press","interact_ui_element","email_send","complete_task","remove_task","remember","forget","memory_add","knowledge_add","add_task","agent_skills"]);
 const externalTool=toolName==="mcp_call_tool"?String(event.args?.tool||""):String(event.args?.tool||"");
 const addonTool=/^addon_[a-z0-9][a-z0-9._-]{0,63}_.+/i.test(toolName);
 const addonReadOnly=addonTool&&/(?:^|[_-])(get|list|read|search|find|fetch|query|inspect|describe|status|check|lookup|enumerate|count|show|view|discover|validate|head|stat|select)(?:[_-]|$)/i.test(toolName)&&!/(?:^|[_-])(delete|remove|update|create|write|send|submit|post|put|patch|approve|pay|issue|execute|run|start|stop|cancel|purchase|publish|commit|insert|upsert)(?:[_-]|$)/i.test(toolName);
 const mutating=mutatingTools.has(toolName)&&(toolName!=="agent_skills"||!["list","get"].includes(String(event.args?.operation||"")) )||(toolName==="mcp_call_tool"&&!isReadOnlyMcpTool(externalTool))||(addonTool&&!addonReadOnly);
 if(type==="tool"&&mutating)run.lastActionAt=now;
 if(type==="tool"){
  if(run.steps.length>=MAX_STEPS)return run;
  const name=safeText(event.name,100);
  run.steps.push({index:run.steps.length+1,tool:name,externalTool:toolName==="mcp_call_tool"?safeText(externalTool,120):"",status:"running",startedAt:now,finishedAt:null,argsShape:Object.keys(event.args&&typeof event.args==="object"?event.args:{}).slice(0,40),operation:toolName==="agent_skills"?safeText(event.args?.operation,30):"",resultShape:[],error:""});
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
   if((["read_file","list_directory","inspect_document","extract_pdf_text","read_excel","active_window","list_windows","inspect_window_controls","screenshot","ocr_image","inspect_image","fetch_web_page"].includes(name))||(name==="agent_skills"&&["list","get"].includes(step.operation))||(name==="mcp_call_tool"&&isReadOnlyMcpTool(step.externalTool))||(addonTool&&addonReadOnly)){
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
 let finalStatus=["finished","needs_attention","cancelled"].includes(status)?status:"finished";
 let finalSummary=safeText(summary,1000);
 if(finalStatus==="finished"){
  const failed=(run.steps||[]).some(step=>step.status==="failed");
  const interrupted= (run.steps||[]).some(step=>["running","interrupted"].includes(step.status));
  const incompletePlan=Boolean(run.plan?.length&&run.plan.some(step=>!["completed","skipped"].includes(step.status)));
  const verifiedAfterLastAction=Boolean(run.lastActionAt&&run.verification?.evidence?.some(item=>item.result==="returned"&&item.afterAction===true&&Number.isFinite(Date.parse(item.at))&&Number.isFinite(Date.parse(run.lastActionAt))&&Date.parse(item.at)>=Date.parse(run.lastActionAt)));
  if(failed||interrupted||incompletePlan||(run.lastActionAt&&!verifiedAfterLastAction)){
   finalStatus="needs_attention";
   finalSummary="Completion was not confirmed: "+(run.lastActionAt&&!verifiedAfterLastAction?"a state-changing action lacks subsequent verification.":incompletePlan?"the task plan has unfinished steps.":interrupted?"one or more actions were interrupted or remain in flight.":"one or more actions failed.")+" "+finalSummary;
  }
 }
 run.status=finalStatus;run.summary=finalSummary.slice(0,1000);run.finishedAt=new Date().toISOString();
 for(const step of run.steps)if(step.status==="running"){step.status="interrupted";step.finishedAt=run.finishedAt}
 for(const step of run.plan||[])if(step.status==="running"){step.status="interrupted";step.finishedAt=run.finishedAt}
 if(verification&&typeof verification==="object"){const trustedEvidence=Array.isArray(run.verification?.evidence)?run.verification.evidence:[];run.verification={...run.verification,...verification,evidence:trustedEvidence,attempted:Boolean(run.verification?.attempted)};}
 return persist(userData,run);
}
function list(userData,limit=20){
 const dir=ensure(userData);
 return fs.readdirSync(dir,{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith(".json")).map(x=>{try{return JSON.parse(fs.readFileSync(path.join(dir,x.name),"utf8"))}catch{return null}}).filter(Boolean).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,Math.max(1,Math.min(100,Number(limit)||20)));
}
module.exports={begin,get,setPlan,appendPlanSteps,updatePlanStep,observe,finish,list,recoverStaleRuns};
