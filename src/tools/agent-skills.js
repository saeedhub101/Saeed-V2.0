const learning=()=>require("../learning");
function schemas(){return[
 {type:"function",function:{name:"agent_skills",description:"Manage saved learned workflows. Use list to find skills, get to inspect one, update to correct its name/description/trigger phrases/parameters, enable to activate it, disable to prevent automatic matching, and delete only when the user explicitly requests removal. Preserve existing action steps unless the user specifically asks to change them. Never create a workflow from an unverified guess.",parameters:{type:"object",properties:{operation:{type:"string",enum:["list","get","update","enable","disable","delete"]},skillId:{type:"string",maxLength:64},name:{type:"string",maxLength:160},description:{type:"string",maxLength:500},triggerPhrases:{type:"array",items:{type:"string",minLength:1,maxLength:180},maxItems:20},parameters:{type:"array",maxItems:30,items:{type:"object",properties:{name:{type:"string",pattern:"^[a-z][a-zA-Z0-9_]{0,39}$"},description:{type:"string",maxLength:180},aliases:{type:"array",items:{type:"string",maxLength:100},maxItems:20},required:{type:"boolean"}},required:["name"]}}},required:["operation"]}}}
]}
function call(name,args,context){
 if(name!=="agent_skills")return null;
 const api=learning(),dir=context.userDataPath,operation=String(args.operation||"");
 if(operation==="list")return{ok:true,skills:api.list(dir).map(skill=>({id:skill.id,name:skill.name,description:skill.description,triggerPhrases:skill.trigger.phrases,parameters:skill.parameters,stepCount:skill.steps.length,enabled:skill.enabled,updatedAt:skill.updatedAt}))};
 if(!String(args.skillId||"").trim())return{ok:false,error:"skillId is required for this operation"};
 const skill=api.get(dir,args.skillId);
 if(!skill)return{ok:false,error:"Saved skill not found: "+args.skillId};
 if(operation==="get")return{ok:true,skill};
 if(operation==="enable"||operation==="disable"){const updated=api.setEnabled(dir,skill.id,operation==="enable");return{ok:true,skill:{id:updated.id,name:updated.name,enabled:updated.enabled}}}
 if(operation==="delete")return{ok:api.remove(dir,skill.id),deletedSkillId:skill.id};
 if(operation==="update"){
  if(args.name!==undefined)skill.name=String(args.name).trim();
  if(args.description!==undefined)skill.description=String(args.description).trim();
  if(args.triggerPhrases!==undefined){const phrases=args.triggerPhrases.map(api.normalize).filter(Boolean);if(!phrases.length)return{ok:false,error:"At least one non-empty trigger phrase is required"};skill.trigger.phrases=phrases}
  if(args.parameters!==undefined)skill.parameters=args.parameters;
  const updated=api.save(dir,skill);
  return{ok:true,skill:{id:updated.id,name:updated.name,description:updated.description,triggerPhrases:updated.trigger.phrases,parameters:updated.parameters,stepCount:updated.steps.length,enabled:updated.enabled,updatedAt:updated.updatedAt}};
 }
 return{ok:false,error:"Unsupported skill operation"};
}
module.exports={schemas,call};
