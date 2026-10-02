const fs=require("fs"),path=require("path");
const {TaskRouter}=require("./task-router");
class TaskEngine{
 constructor({agent,userDataPath,emit}={}){this.agent=agent;this.emit=typeof emit==="function"?emit:()=>{};this.file=path.join(userDataPath||process.cwd(),"task-state.json");this.router=new TaskRouter({getSettings:()=>this.agent?.settings||{},getLocalBrain:()=>this.agent?.localBrain});this.active=null}
 loadState(){try{return JSON.parse(fs.readFileSync(this.file,"utf8"))}catch{return null}}
 saveState(state){try{fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file,JSON.stringify(state,null,2),"utf8")}catch{}}
 clearState(){try{fs.rmSync(this.file,{force:true})}catch{}}
 async run(text,image=null,{source="user"}={}){
  const request=String(text||"").trim();if(!request)return "اكتب لي المهمة التي تريد تنفيذها.";if(this.active)return "هناك مهمة قيد التنفيذ حاليًا. سأكملها قبل بدء مهمة أخرى.";
  const route=await this.router.route(request),id=Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8);
  this.active={id,text:request,image,source,route,startedAt:new Date().toISOString(),status:"running"};this.saveState({...this.active,resumable:true,image:null});
  this.emit({type:"task:start",taskId:id,route,source,text:request});this.agent.beginTask?.({id,route,source,text:request});
  try{const result=await this.agent.run(request,image);this.active.status="completed";this.active.completedAt=new Date().toISOString();this.emit({type:"task:complete",taskId:id,text:String(result||""),source});this.clearState();return result}
  catch(e){this.active.status="paused";this.active.error=e.message;this.active.updatedAt=new Date().toISOString();this.saveState({...this.active,resumable:true,image:null});this.emit({type:"task:error",taskId:id,error:e.message,source});throw e}
  finally{this.agent.endTask?.();this.emit({type:"task:end",taskId:id,source});this.active=null}
 }
 async resumeLast(){const state=this.loadState();if(!state?.resumable||!state.text)return{ok:false,reason:"no-resumable-task"};const prompt="Continue the unfinished task and verify what has already been completed. Do not repeat completed destructive actions. Original task: "+state.text;return{ok:true,result:await this.run(prompt,state.image,{source:"resume"})}}
}
module.exports={TaskEngine};
