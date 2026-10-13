const taskEngine=()=>require("../main/brain/task-engine");
function schemas(){return[
 {type:"function",function:{name:"task_plan",description:"Create the initial task plan once; set_plan cannot overwrite an existing plan. Call set_plan before taking action; use append_steps to add recovery steps without erasing completed progress; then update_step as each planned step starts, completes, fails, is skipped, or needs user approval. Use the active taskRunId supplied in the system context.",parameters:{type:"object",properties:{operation:{type:"string",enum:["set_plan","append_steps","update_step"]},taskRunId:{type:"string",minLength:8,maxLength:80,pattern:"^[a-z0-9-]+$"},steps:{type:"array",minItems:1,maxItems:30,items:{type:"object",properties:{title:{type:"string",minLength:1,maxLength:180},successCriteria:{type:"string",maxLength:300}},required:["title","successCriteria"]}},index:{type:"integer",minimum:1,maximum:30},status:{type:"string",enum:["pending","running","completed","failed","skipped","needs_approval","interrupted"]},evidence:{type:"string",maxLength:300}},required:["operation","taskRunId"]}}},
 {type:"function",function:{name:"agent_task_history",description:"List recent Saeed agent task runs with their current status, executed tools, failures and verification attempts. Use this to inspect what was actually attempted; a finished run is not proof of business completion.",parameters:{type:"object",properties:{limit:{type:"integer",minimum:1,maximum:50}},required:[]}}},
 {type:"function",function:{name:"agent_task_details",description:"Inspect one persisted Saeed agent task run by taskRunId, including step statuses and verification evidence. Never treat a finished status alone as proof of success.",parameters:{type:"object",properties:{taskRunId:{type:"string",minLength:8,maxLength:80,pattern:"^[a-z0-9-]+$"}},required:["taskRunId"]}}}
]}
async function call(name,args,context){
 if(name==="task_plan"){
  const engine=taskEngine();
  if(args.operation==="set_plan")return{ok:true,taskRunId:args.taskRunId,plan:engine.setPlan(context.userDataPath,args.taskRunId,args.steps)};
  if(args.operation==="append_steps")return{ok:true,taskRunId:args.taskRunId,plan:engine.appendPlanSteps(context.userDataPath,args.taskRunId,args.steps)};
  if(args.operation==="update_step")return{ok:true,taskRunId:args.taskRunId,plan:engine.updatePlanStep(context.userDataPath,args.taskRunId,args.index,args.status,args.evidence)};
  return{ok:false,error:"Unsupported task plan operation"};
 }
 if(name==="agent_task_history"){
  const engine=taskEngine();const recovered=engine.recoverStaleRuns(context.userDataPath);const runs=engine.list(context.userDataPath,Math.min(50,Math.max(1,Number(args.limit)||10)));
  return{ok:true,recovered,runs:runs.map(run=>({id:run.id,goal:run.goal,status:run.status,createdAt:run.createdAt,finishedAt:run.finishedAt,stepCount:(run.steps||[]).length,plan:(run.plan||[]).map(step=>({index:step.index,title:step.title,status:step.status})),failedSteps:(run.steps||[]).filter(step=>step.status==="failed").map(step=>({index:step.index,tool:step.tool,error:step.error})),interruptedSteps:(run.steps||[]).filter(step=>step.status==="interrupted").map(step=>({index:step.index,tool:step.tool,externalTool:step.externalTool||"",startedAt:step.startedAt,operation:step.operation||""})),interruptedPlanSteps:(run.plan||[]).filter(step=>step.status==="interrupted").map(step=>({index:step.index,title:step.title,successCriteria:step.successCriteria})),failedPlanSteps:(run.plan||[]).filter(step=>step.status==="failed").map(step=>({index:step.index,title:step.title,successCriteria:step.successCriteria,evidence:step.evidence})),lastActionAt:run.lastActionAt||null,lastDiagnostic:run.lastDiagnostic||null,recovery:run.recovery||null,verification:run.verification,summary:run.summary}))};
 }
 if(name==="agent_task_details"){
  const run=taskEngine().get(context.userDataPath,args.taskRunId);
  if(!run)return{ok:false,error:"Task run not found"};
  return{ok:true,run};
 }
 return null;
}
module.exports={schemas,call};
