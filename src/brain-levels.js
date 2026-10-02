class BrainLevelRouter{
 constructor({settings,getLocalBrain}){this.settings=settings;this.getLocalBrain=getLocalBrain}
 async classify(text){
  const s=typeof this.settings==="function"?await this.settings():this.settings||{};
  const mode=String(s.brainMode||"auto");
  if(mode==="local")return{level:1,name:"local",reason:"forced-local"};
  if(mode==="api")return{level:3,name:"api",reason:"forced-api"};
  if(mode==="realtime")return{level:3,name:"api",reason:"forced-api"};
  const local=this.getLocalBrain?.();
  if(local?.canHandle?.(text))return{level:1,name:"local",reason:"local-capability-match"};
  if(String(s.provider||"").toLowerCase()==="ollama")return{level:2,name:"local-llm",reason:"ollama"};
  return{level:3,name:"api",reason:"controller-api-fallback"};
 }
}
module.exports={BrainLevelRouter};
