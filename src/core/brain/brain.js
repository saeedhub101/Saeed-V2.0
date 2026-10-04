const {LocalExecutor}=require("../../local-executor");
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
  if(mode==="realtime")return{mode:"realtime",reason:"forced-realtime"};
  if(mode==="api")return{mode:"api",reason:"forced-api"};
  if(mode==="local")return{mode:"local",reason:"forced-local"};
  return{mode:"auto",reason:"local-first"};
 }
 async run({text,image=null,history=[]}={}){
  const s=String(text||"").trim(),settings=this.getSettings()||{};
  if(!s)return{handled:true,answer:"Please tell me what you want me to do.",source:"empty"};

  const learned=learning().match(this.getDir(),s);
  if(learned){
   try{
    const result=await learning().run(this.getDir(),this.registry,learned);
    return{handled:true,answer:"Done — I followed the learned skill: "+learned.name+".",source:"learned-skill",event:{type:"learned-skill",skill:learned.id,name:learned.name,result}};
   }catch(e){this.onEvent({type:"diagnostic",level:"ERROR",stage:"LEARNED SKILL",message:e.message,meta:{skill:learned.id}})}
  }

  const route=this.classify(s);
  this.onEvent({type:"diagnostic",level:"INFO",stage:"BRAIN ROUTE",message:"Single brain route selected: "+(route.mode==="auto"?"local-first":route.mode),meta:route});

  if(route.mode==="realtime")return{handled:true,answer:"Realtime mode is active. Use the microphone for the live conversation.",source:"realtime"};

  if(route.mode!=="api"){
   try{
    const local=await this.local.tryExecute(s);
    if(local?.handled)return{handled:true,answer:local.answer,source:"local"};
   }catch(e){this.onEvent({type:"diagnostic",level:"ERROR",stage:"BRAIN LOCAL",message:e.message})}
   if(route.mode==="local")return{handled:true,answer:"I can handle common Windows computer tasks offline, but this request needs the API brain.",source:"local-fallback"};
  }

  if(settings.apiServices?.brain===false)return{handled:true,answer:"API Brain is disabled in Performance settings. Enable API Brain or switch Agent to Local only.",source:"api-disabled"};
  const answer=await this.api.run({
   text:s,image,settings,history,registry:this.registry,onEvent:this.onEvent,dir:this.getDir(),
   memoryContext:this.memoryContext,saveHistory:this.saveHistory,baseStepLimit:this.baseStepLimit,
   askForMoreSteps:this.requestStepIncrease,providerDefaults:this.providerDefaults
  });
  return{handled:false,answer,source:"api"};
 }
 async dispose(){try{await this.local?.dispose?.()}catch{}try{await this.api?.dispose?.()}catch{}this.local=null;this.api=null;this.registry=null;this.onEvent=()=>{};return true}
}
module.exports={Brain};