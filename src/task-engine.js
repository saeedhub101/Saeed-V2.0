const fs=require("fs"),path=require("path");
const {TaskRouter}=require("./task-router");const {TaskPlanner}=require("./task-planner");
class TaskEngine{
 constructor({agent,userDataPath,emit}={}){this.agent=agent;this.emit=typeof emit==="function"?emit:()=>{};this.file=path.join(userDataPath||process.cwd(),"task-state.json");this.router=new TaskRouter({getSettings:()=>this.agent?.settings||{},getLocalBrain:()=>this.agent?.localBrain});this.planner=new TaskPlanner();this.active=null}
 loadState(){try{return JSON.parse(fs.readFileSync(this.file,"utf8"))}catch{return null}}
 saveState(state){try{fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file,JSON.stringify(state,null,2),"utf8")}catch{}}
 clearState(){try{fs.rmSync(this.file,{force:true})}catch{}}
 observeAgentEvent(e){
  if(!this.active)return;
  const type=String(e?.type||"");
  if(type==="thinking"){this.active.step=Number(e.step||0);this.active.stepLimit=Number(e.stepLimit||0);this.active.phase="execute_actions"}
  else if(type==="tool"){this.active.currentTool=e.name;this.active.phase="execute_actions";this.active.toolArgs=e.args||{};this.active.currentAction=String(e.name||"")}
  else if(type==="tool_result"){this.active.lastTool=e.name;this.active.lastToolResult=e.result;this.planner.markAction(this.active.plan,e.name,e.result);this.active.phase=e.result?.ok===false?"recover":"execute_actions"}
  else if(type==="tool_error"){this.active.phase="recover";this.active.lastError=e.error}
  this.active.updatedAt=new Date().toISOString();this.saveState({...this.active,image:null});this.emit({type:"task:progress",taskId:this.active.id,step:this.active.step||0,stepLimit:this.active.stepLimit||0,phase:this.active.phase,currentTool:this.active.currentTool||null,completedActions:this.active.plan?.completedActions||[]})
 }
 async run(text,image=null,{source="user",routeOverride=null,planOverride=null}={}){
  const request=String(text||"").trim();if(!request)return "اكتب لي المهمة التي تريد تنفيذها.";if(this.active)return "هناك مهمة قيد التنفيذ حاليًا. سأكملها قبل بدء مهمة أخرى.";
  const route=routeOverride||await this.router.route(request),plan=planOverride||await this.planner.create({text:request,route}),id=Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8);
  this.active={id,text:request,image,source,route,plan,startedAt:new Date().toISOString(),status:"running",phase:"inspect_state"};this.saveState({...this.active,resumable:true,image:null});
  this.emit({type:"task:start",taskId:id,route,source,text:request});this.agent.beginTask?.({id,route,source,text:request});
  try{
   this.planner.advance(plan,plan.steps[0]);
   this.saveState({...this.active,image:null});
   const result=await this.agent.run(request,image,{brain:route.brain,taskPlan:plan});
   this.active.status="completed";this.active.phase="complete";this.active.completedAt=new Date().toISOString();this.planner.advance(plan,"report_completion");this.emit({type:"task:complete",taskId:id,text:String(result||""),source});this.clearState();return result
  }catch(e){
   this.active.status="paused";this.active.error=e.message;this.active.updatedAt=new Date().toISOString();this.saveState({...this.active,resumable:true,image:null});this.emit({type:"task:error",taskId:id,error:e.message,source});throw e
  }finally{this.agent.endTask?.();this.emit({type:"task:end",taskId:id,source});this.active=null}
 }
 async resumeLast(){
  const state=this.loadState();if(!state?.resumable||!state.text)return{ok:false,reason:"no-resumable-task"};
  const route=state.route||await this.router.route(state.text),plan=state.plan||await this.planner.create({text:state.text,route});
  plan.status="resuming";
  const prompt="Continue the unfinished task from the saved execution state. Completed actions are listed in the task plan. Do not repeat completed actions, especially destructive or sensitive ones. Re-check only what is necessary to continue safely. Original task: "+state.text;
  return{ok:true,result:await this.run(prompt,state.image,{source:"resume",routeOverride:route,planOverride:plan})}
 }
}
module.exports={TaskEngine};
