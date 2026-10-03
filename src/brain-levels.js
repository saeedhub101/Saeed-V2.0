class BrainLevelRouter{
 constructor({settings,getLocalBrain,getSkills,getCapabilities}){
  this.settings=settings;this.getLocalBrain=getLocalBrain;this.getSkills=typeof getSkills==="function"?getSkills:()=>[];this.getCapabilities=typeof getCapabilities==="function"?getCapabilities:()=>[];
 }
 async classify(text){
  const s=typeof this.settings==="function"?await this.settings():this.settings||{};
  const mode=String(s.brainMode||"auto");
  const t=String(text||"").trim().toLowerCase();
  const skills=Array.isArray(this.getSkills?.())?this.getSkills():[];
  const capabilities=Array.isArray(this.getCapabilities?.())?this.getCapabilities():[];
  const learned=skills.find(x=>x?.enabled!==false&&(x.trigger?.phrases||[]).some(p=>String(p).trim().toLowerCase()===t));
  if(learned)return{level:1,name:"learned-skill",reason:"exact-learned-skill",skill:learned.id,skillName:learned.name};
  if(mode==="local")return{level:1,name:"local",reason:"forced-local"};
  if(mode==="api"||mode==="realtime")return{level:3,name:"api",reason:"forced-api"};
  const local=this.getLocalBrain?.();
  if(local)return{level:1,name:"local",reason:"local-first",capabilities};
  if(String(s.provider||"").toLowerCase()==="ollama")return{level:2,name:"local-llm",reason:"ollama",capabilities};
  return{level:3,name:"api",reason:"local-llm-unavailable",capabilities};
 }
 shouldRetry(result){
  if(!result||result.ok!==false)return false;
  const e=String(result.error||"").toLowerCase();
  return /unknown tool|not found|unsupported|cannot handle|wrong route|no handler|unavailable/.test(e);
 }
 nextAfterFailure(route,result){
  if(!this.shouldRetry(result))return route;
  if(route?.name==="local"||route?.name==="learned-skill")return{level:3,name:"api-fallback",reason:"local-route-failed"};
  if(route?.name==="local-llm")return{level:3,name:"api-fallback",reason:"local-llm-route-failed"};
  return route;
 }
}
module.exports={BrainLevelRouter};
