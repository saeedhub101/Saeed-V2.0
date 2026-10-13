const taskEngine=()=>require("../main/brain/task-engine");
function schemas(){return[
 {type:"function",function:{name:"agent_task_history",description:"List recent Saeed agent task runs with their current status, executed tools, failures and verification attempts. Use this to inspect what was actually attempted; a finished run is not proof of business completion.",parameters:{type:"object",properties:{limit:{type:"integer",minimum:1,maximum:50}},required:[]}}},
 {type:"function",function:{name:"agent_task_details",description:"Inspect one persisted Saeed agent task run by taskRunId, including step statuses and verification evidence. Never treat a finished status alone as proof of success.",parameters:{type:"object",properties:{taskRunId:{type:"string",minLength:8,maxLength:80,pattern:"^[a-z0-9-]+$"}},required:["taskRunId"]}}}
]}
async function call(name,args,context){
 if(name==="agent_task_history"){
  const runs=taskEngine().list(context.userDataPath,Math.min(50,Math.max(1,Number(args.limit)||10)));
  return{ok:true,runs:runs.map(run=>({id:run.id,goal:run.goal,status:run.status,createdAt:run.createdAt,finishedAt:run.finishedAt,stepCount:run.steps.length,failedSteps:run.steps.filter(step=>step.status==="failed").map(step=>({index:step.index,tool:step.tool,error:step.error})),verification:run.verification,summary:run.summary}))};
 }
 if(name==="agent_task_details"){
  const run=taskEngine().get(context.userDataPath,args.taskRunId);
  if(!run)return{ok:false,error:"Task run not found"};
  return{ok:true,run};
 }
 return null;
}
module.exports={schemas,call};
