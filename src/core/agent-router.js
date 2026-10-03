const learning=require("../learning");
class AgentRouter{
 constructor(o={}){Object.assign(this,o);this.onEvent=this.onEvent||(()=>{});}
 async run({text,image=null}){
  const registry=this.getRegistry(),settings=this.getSettings()||{},mode=String(settings.brainMode||"auto"),s=String(text||"").trim();
  if(!s)return{handled:true,answer:"اكتب لي المهمة التي تريد تنفيذها.",source:"empty"};
  const learned=learning.match(this.getDir(),s);
  if(learned){try{const result=await learning.run(this.getDir(),registry,learned);return{handled:true,answer:"Done — I followed the learned skill: "+learned.name+".",source:"learned-skill",event:{type:"learned-skill",skill:learned.id,name:learned.name,result}}}catch(e){this.onEvent({type:"diagnostic",level:"ERROR",stage:"LEARNED SKILL",message:e.message,meta:{skill:learned.id}})}}
  const n=s.replace(/[.?!؟،]+$/,"").trim();
  if(/^(?:please\s+)?(?:give\s+me\s+|show\s+me\s+|tell\s+me\s+)?(?:my\s+)?(?:computer|pc|system)\s+(?:info|information|specs|specifications)$/i.test(n)){
   try{const out=await registry.call("system_info",{});return{handled:true,answer:out?.ok===false?"I could not complete that: "+out.error:"Windows system information: "+String(out?.arch||"unknown")+", "+String(out?.cpu||"unknown")+" CPU threads, "+(Number(out?.totalMemory||0)/1073741824).toFixed(1)+" GB RAM.",source:"local-direct-system-info"}}catch(e){return{handled:true,answer:"I could not complete that: "+e.message,source:"local-direct-system-info"}}
  }
  if(/^(?:please\s+)?(?:open|launch|start|show|run)\s+(?:my\s+)?(?:computer|this\s+pc|file\s+explorer)$/i.test(n)){
   try{const out=await registry.call("open_application",{application:"my computer"});return{handled:true,answer:out?.ok===false?"I could not complete that: "+out.error:"Opened My Computer.",source:"local-direct-open"}}catch(e){return{handled:true,answer:"I could not complete that: "+e.message,source:"local-direct-open"}}
  }
  if(mode==="realtime"){this.onEvent({type:"diagnostic",level:"INFO",stage:"BRAIN REALTIME",message:"Realtime mode is selected; voice streaming handles the conversation."});return{handled:true,answer:"Realtime mode is active. Use the microphone for the live conversation.",source:"realtime"}}
  const local=this.getLocalBrain();
  if(local)try{
   const bm=process.memoryUsage(),bc=process.cpuUsage(),started=Date.now(),handled=await local.handle(s),ba=process.memoryUsage(),bca=process.cpuUsage(bc);
   this.onEvent({type:"diagnostic",level:"INFO",stage:"RESOURCE LOCAL BRAIN",message:"Local brain resource sample",meta:{elapsedMs:Date.now()-started,cpuUserMs:Math.round(bca.user/1000),cpuSystemMs:Math.round(bca.system/1000),heapDeltaMB:+((ba.heapUsed-bm.heapUsed)/1048576).toFixed(2),rssMB:+(ba.rss/1048576).toFixed(1)}});
   if(handled!==null)return{handled:true,answer:handled,source:"local-brain"};
  }catch(e){this.onEvent({type:"diagnostic",level:"ERROR",stage:"BRAIN LOCAL",message:e.message})}
  const route=await this.getBrainLevels().classify(s);
  this.onEvent({type:"diagnostic",level:"INFO",stage:"BRAIN LEVEL",message:"Conversation brain selected level "+route.level+" ("+route.name+")",meta:route});
  if(mode==="local")return{handled:true,answer:"I can handle common Windows computer tasks offline, but this request needs the API brain. Please connect an API key in Settings.",source:"local-fallback"};
  const answer=await this.getApiBrain().run({text:s,image,settings,history:this.history||[],registry,onEvent:this.onEvent,dir:this.getDir(),route,memoryContext:this.memoryContext||(()=>""),saveHistory:this.saveHistory||(()=>{}),baseStepLimit:this.baseStepLimit||(()=>16),askForMoreSteps:this.askForMoreSteps|| (async n=>n),providerDefaults:this.providerDefaults||(()=>({}))});
  return{handled:false,answer,source:"api"};
 }
}
module.exports={AgentRouter};