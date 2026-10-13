const {LocalExecutor}=require("../automation/local-executor");
const {ModelExecutor}=require("./model-executor");
const learning=()=>require("../../learning");

class Brain{
 constructor({registry,getSettings,getDir,onEvent,requestStepIncrease,providerDefaults,memoryContext,saveHistory,baseStepLimit}={}){
  this.registry=registry;
  this.getSettings=getSettings||(()=>({}));
  this.getDir=getDir||(()=>process.cwd());
  this.onEvent=onEvent||(()=>{});
  this.requestStepIncrease=requestStepIncrease|| (async()=>false);
  this.providerDefaults=providerDefaults||(()=>({}));
  this.memoryContext=memoryContext||(()=> "");
  this.saveHistory=saveHistory||(()=>{});
  this.baseStepLimit=baseStepLimit||(()=>16);
  this.local=new LocalExecutor(registry,this.onEvent);
  this.api=new ModelExecutor();
 }
 capabilities(){return this.registry?.schemas?.().map(x=>x?.function?.name).filter(Boolean)||[]}
 classify(text){
  const s=String(text||"").trim(),settings=this.getSettings()||{},mode=String(settings.brainMode||"auto");
  if(mode==="api")return{mode:"api",reason:"forced-api"};
  if(mode==="local")return{mode:"local",reason:"forced-local"};
  return{mode:"auto",reason:"local-first"};
 }
 async run({text,image=null,history=[],isCurrent=()=>true,signal=null}={}){
  const current=()=>{try{return !signal?.aborted&&(typeof isCurrent==="function"?Boolean(isCurrent()):true)}catch{return false}};
  const taskEngine=require("./task-engine");let taskRun=null,taskPersistenceWarned=false;
  const emit=event=>{
   if(!current())return;
   if(taskRun){
    try{
     const saved=taskEngine.observe(this.getDir(),taskRun.id,event);
     if(["tool","tool_result","tool_error"].includes(String(event?.type||""))){
      const step=[...(saved?.steps||[])].reverse().find(item=>item.tool===String(event.name||""));
      if(step)this.onEvent({type:"task-progress",taskId:taskRun.id,step:{index:step.index,tool:step.tool,status:step.status,startedAt:step.startedAt,finishedAt:step.finishedAt}});
     }
    }catch(error){if(!taskPersistenceWarned){taskPersistenceWarned=true;this.onEvent({type:"diagnostic",level:"ERROR",stage:"TASK PERSISTENCE",message:"Task progress could not be saved: "+String(error?.message||error).replace(/[\\r\\n\\t]+/g," ").slice(0,180)});}}
   }
   this.onEvent(event);
  };
  const finishTask=(answer,status)=>{
   let finalAnswer=String(answer||"");
   if(!taskRun)return{status:status||"finished",answer:finalAnswer};
   try{
    const saved=taskEngine.get(this.getDir(),taskRun.id);
    const failed=saved?.steps?.some(step=>step.status==="failed");
    const incompletePlan=Boolean(saved?.plan?.length&&saved.plan.some(step=>!["completed","skipped"].includes(step.status)));
    const verifiedAfterLastAction=Boolean(saved?.lastActionAt&&saved?.verification?.evidence?.some(item=>item.result==="returned"&&Number.isFinite(Date.parse(item.at))&&Date.parse(item.at)>=Date.parse(saved.lastActionAt)));
    const unverifiedAction=Boolean(saved?.lastActionAt&&!verifiedAfterLastAction);
    const finalStatus=taskPersistenceWarned?"needs_attention":(status||(failed||incompletePlan||unverifiedAction?"needs_attention":"finished"));
    if(finalStatus==="needs_attention"){
     if(taskPersistenceWarned)finalAnswer="Task progress could not be saved reliably, so I cannot confirm completion. Check the task diagnostics before retrying.";
     else if(!status&&unverifiedAction)finalAnswer="I attempted the requested actions, but I couldn't verify the final state. I can't confirm completion.";
     else if(incompletePlan)finalAnswer="The task plan still has unfinished steps, so I can't confirm completion.";
     else if(failed)finalAnswer="At least one action failed, so I can't confirm completion.";
    }
    const persisted=taskEngine.finish(this.getDir(),taskRun.id,{status:finalStatus,summary:finalAnswer.slice(0,1000)});
    const actualStatus=persisted?.status||finalStatus;
    if(actualStatus==="needs_attention"&&finalStatus==="finished")finalAnswer="I attempted the requested actions, but the task log shows an interrupted or unverified step. I can't confirm completion.";
    if(taskPersistenceWarned&&actualStatus==="needs_attention")finalAnswer="Task progress could not be saved reliably, so I cannot confirm completion.";
    this.onEvent({type:"task-finished",taskId:taskRun.id,status:actualStatus});
    return{status:actualStatus,answer:finalAnswer};
   }catch(error){
    this.onEvent({type:"diagnostic",level:"WARN",stage:"TASK PERSISTENCE",message:String(error?.message||error).slice(0,200)});
    return{status:"needs_attention",answer:finalAnswer};
   }
  };
  if(!current()){finishTask("", "cancelled");return{handled:true,answer:"",source:"stale",stale:true}};
  const s=String(text||"").trim(),settings=this.getSettings()||{};
  if(!s)return{handled:true,answer:"Please tell me what you want me to do.",source:"empty"};
  try{taskRun=taskEngine.begin(this.getDir(),s);this.onEvent({type:"task-start",taskId:taskRun.id,goal:s})}catch(error){this.onEvent({type:"diagnostic",level:"WARN",stage:"TASK PERSISTENCE",message:String(error?.message||error).slice(0,200)})}
  const learned=learning().match(this.getDir(),s);
  if(learned){
   try{const variables=learning().extractParameters(learned,s);const result=await learning().run(this.getDir(),this.registry,learned,{isCurrent:current,onEvent:emit,variables});if(!current()||result?.stale){finishTask("", "cancelled");return{handled:true,answer:"",source:"stale",stale:true}}if(result?.missingParameters?.length){const missingAnswer="I found the saved skill \""+learned.name+"\" but need these values before executing it: "+result.missingParameters.join(", ")+". Please provide them clearly (for example, field: value).";finishTask(missingAnswer,"needs_attention");return{handled:true,answer:missingAnswer,source:"learned-skill-missing-parameters",event:{type:"learned-skill",skill:learned.id,name:learned.name,result}}}const learnedAnswer="Done — I followed the learned skill: "+learned.name+".";const finished=finishTask(learnedAnswer,result?.ok===false?"needs_attention":undefined);return{handled:true,answer:finished.answer,source:finished.status==="needs_attention"?"learned-skill-unverified":"learned-skill",event:{type:"learned-skill",skill:learned.id,name:learned.name,result}}}
   catch(e){const detail=String(e?.message||e||"Unknown learned-skill error").replace(/[\r\n\t]+/g," ").slice(0,240);emit({type:"diagnostic",level:"ERROR",stage:"LEARNED SKILL",message:detail,meta:{skill:learned.id}});const failedAnswer="The saved skill \""+learned.name+"\" stopped because a step failed. I did not restart it automatically, to avoid repeating actions that may already have succeeded. Error: "+detail;const finished=finishTask(failedAnswer,"needs_attention");return{handled:true,answer:finished.answer,source:"learned-skill-failed",event:{type:"learned-skill",skill:learned.id,name:learned.name,result:{ok:false,error:detail}}}}
  }
  if(!current()){finishTask("", "cancelled");return{handled:true,answer:"",source:"stale",stale:true}};
  const route=this.classify(s);
  emit({type:"diagnostic",level:"INFO",stage:"BRAIN ROUTE",message:"Single brain route selected: "+(route.mode==="auto"?"local-first":route.mode),meta:route});
  if(route.mode!=="api"){
   try{const local=await this.local.tryExecute(s,{isCurrent:current,onEvent:emit});if(!current()){finishTask("", "cancelled");return{handled:true,answer:"",source:"stale",stale:true}};if(local?.handled){const finished=finishTask(local.answer);return{handled:true,answer:finished.answer,source:finished.status==="needs_attention"?"local-unverified":"local"}}}
   catch(e){emit({type:"diagnostic",level:"ERROR",stage:"BRAIN LOCAL",message:e.message})}
   if(route.mode==="local"){const fallbackAnswer="I can handle common Windows computer tasks offline, but this request needs the API brain.";finishTask(fallbackAnswer,"needs_attention");return{handled:true,answer:fallbackAnswer,source:"local-fallback"}}
  }
  if(!current()){finishTask("", "cancelled");return{handled:true,answer:"",source:"stale",stale:true}};
  if(settings.apiServices?.brain===false){const disabledAnswer="API Brain is disabled in Performance settings. Enable API Brain or switch Agent to Local only.";finishTask(disabledAnswer,"needs_attention");return{handled:true,answer:disabledAnswer,source:"api-disabled"}}
  let answer;
  try{
   answer=await this.api.run({text:s,image,settings,history,registry:this.registry,onEvent:emit,dir:this.getDir(),taskRunId:taskRun?.id||null,memoryContext:this.memoryContext,saveHistory:this.saveHistory,baseStepLimit:this.baseStepLimit,askForMoreSteps:this.requestStepIncrease,providerDefaults:this.providerDefaults,isCurrent:current,signal});
  }catch(error){
   if(!current()){finishTask("", "cancelled");return{handled:true,answer:"",source:"stale",stale:true}};
   const detail=String(error?.message||error||"Unknown provider error").replace(/[\r\n\t]+/g," ").slice(0,240);
   emit({type:"diagnostic",level:"ERROR",stage:"BRAIN PROVIDER FAILURE",message:"The selected AI provider failed before returning a result",meta:{provider:String(settings.provider||"unknown"),error:detail}});
   answer="The selected AI provider failed before completing the request. Check its configuration or choose another provider, then try again.";
   finishTask(answer,"needs_attention");return{handled:false,answer,source:"api-provider-error"};
  }
  if(!current()){finishTask("", "cancelled");return{handled:true,answer:"",source:"stale",stale:true}};
  const finished=finishTask(answer);
  return{handled:false,answer:finished.answer,source:finished.status==="needs_attention"?"api-unverified":"api"};
 }
 async dispose(){try{await this.local?.dispose?.()}catch{}try{await this.api?.dispose?.()}catch{}this.local=null;this.api=null;this.registry=null;this.onEvent=()=>{};return true}
}
module.exports={Brain};