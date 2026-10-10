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
  const emit=event=>{if(current())this.onEvent(event)};
  if(!current())return{handled:true,answer:"",source:"stale",stale:true};
  const s=String(text||"").trim(),settings=this.getSettings()||{};
  if(!s)return{handled:true,answer:"Please tell me what you want me to do.",source:"empty"};
  const learned=learning().match(this.getDir(),s);
  if(learned){
   try{const result=await learning().run(this.getDir(),this.registry,learned,{isCurrent:current});if(!current()||result?.stale)return{handled:true,answer:"",source:"stale",stale:true};return{handled:true,answer:"Done — I followed the learned skill: "+learned.name+".",source:"learned-skill",event:{type:"learned-skill",skill:learned.id,name:learned.name,result}}}
   catch(e){emit({type:"diagnostic",level:"ERROR",stage:"LEARNED SKILL",message:e.message,meta:{skill:learned.id}})}
  }
  if(!current())return{handled:true,answer:"",source:"stale",stale:true};
  const route=this.classify(s);
  emit({type:"diagnostic",level:"INFO",stage:"BRAIN ROUTE",message:"Single brain route selected: "+(route.mode==="auto"?"local-first":route.mode),meta:route});
  if(route.mode!=="api"){
   try{const local=await this.local.tryExecute(s,{isCurrent:current});if(!current())return{handled:true,answer:"",source:"stale",stale:true};if(local?.handled)return{handled:true,answer:local.answer,source:"local"}}
   catch(e){emit({type:"diagnostic",level:"ERROR",stage:"BRAIN LOCAL",message:e.message})}
   if(route.mode==="local")return{handled:true,answer:"I can handle common Windows computer tasks offline, but this request needs the API brain.",source:"local-fallback"};
  }
  if(!current())return{handled:true,answer:"",source:"stale",stale:true};
  if(settings.apiServices?.brain===false)return{handled:true,answer:"API Brain is disabled in Performance settings. Enable API Brain or switch Agent to Local only.",source:"api-disabled"};
  let answer;
  try{
   answer=await this.api.run({text:s,image,settings,history,registry:this.registry,onEvent:emit,dir:this.getDir(),memoryContext:this.memoryContext,saveHistory:this.saveHistory,baseStepLimit:this.baseStepLimit,askForMoreSteps:this.requestStepIncrease,providerDefaults:this.providerDefaults,isCurrent:current,signal});
  }catch(error){
   if(!current())return{handled:true,answer:"",source:"stale",stale:true};
   const detail=String(error?.message||error||"Unknown provider error").replace(/[\r\n\t]+/g," ").slice(0,240);
   emit({type:"diagnostic",level:"ERROR",stage:"BRAIN PROVIDER FAILURE",message:"The selected AI provider failed before returning a result",meta:{provider:String(settings.provider||"unknown"),error:detail}});
   answer="The selected AI provider failed before completing the request. Check its configuration or choose another provider, then try again.";
   return{handled:false,answer,source:"api-provider-error"};
  }
  if(!current())return{handled:true,answer:"",source:"stale",stale:true};
  return{handled:false,answer,source:"api"};
 }
 async dispose(){try{await this.local?.dispose?.()}catch{}try{await this.api?.dispose?.()}catch{}this.local=null;this.api=null;this.registry=null;this.onEvent=()=>{};return true}
}
module.exports={Brain};