const learning=()=>require("../learning");
function schemas(){return[
 {type:"function",function:{name:"agent_skills",description:"Manage saved learned workflows. Use list to find skills, get to inspect one, update to correct its name/description/trigger phrases/parameters, enable to activate it, disable to prevent automatic matching, and delete only when the user explicitly requests removal. Preserve existing action steps unless the user specifically asks to change them. Never create a workflow from an unverified guess.",parameters:{type:"object",properties:{operation:{type:"string",enum:["list","get","create","update","replace_step","insert_step","remove_step","move_step","enable","disable","delete"]},skillId:{type:"string",maxLength:64},name:{type:"string",maxLength:160},description:{type:"string",maxLength:500},triggerPhrases:{type:"array",items:{type:"string",minLength:1,maxLength:180},maxItems:20},parameters:{type:"array",maxItems:30,items:{type:"object",properties:{name:{type:"string",pattern:"^[a-z][a-zA-Z0-9_]{0,39}$"},description:{type:"string",maxLength:180},aliases:{type:"array",items:{type:"string",maxLength:100},maxItems:20},required:{type:"boolean"}},required:["name"]}},stepIndex:{type:"integer",minimum:1,maximum:100},toIndex:{type:"integer",minimum:1,maximum:100},step:{type:"object",properties:{tool:{type:"string",minLength:1,maxLength:100,pattern:"^[a-zA-Z][a-zA-Z0-9_]*$"},args:{type:"object"}},required:["tool","args"],additionalProperties:false},steps:{type:"array",minItems:1,maxItems:100,items:{type:"object",properties:{tool:{type:"string",minLength:1,maxLength:100,pattern:"^[a-zA-Z][a-zA-Z0-9_]*$"},args:{type:"object"}},required:["tool","args"],additionalProperties:false}}},required:["operation"]}}}
]}
function call(name,args,context){
 if(name!=="agent_skills")return null;
 const api=learning(),dir=context.userDataPath,operation=String(args.operation||"");
 if(operation==="list")return{ok:true,skills:api.list(dir).map(skill=>({id:skill.id,name:skill.name,description:skill.description,triggerPhrases:skill.trigger.phrases,parameters:skill.parameters,stepCount:skill.steps.length,enabled:skill.enabled,outcomes:skill.metadata?.outcomes||{successes:0,failures:0},lastFailure:skill.metadata?.lastFailure||"",updatedAt:skill.updatedAt}))};
 if(operation==="create"){
  const name=String(args.name||"").trim(),phrases=Array.isArray(args.triggerPhrases)?args.triggerPhrases.map(api.normalize).filter(Boolean):[],steps=Array.isArray(args.steps)?args.steps:[];
  if(!name||!phrases.length||!steps.length)return{ok:false,error:"Creating a learned workflow requires name, triggerPhrases, and at least one verified step"};
  if(steps.length>100)return{ok:false,error:"A learned workflow cannot exceed 100 steps"};
  const id=name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,48)||"learned-skill";
  if(api.list(dir).some(item=>item.id===id))return{ok:false,error:"A skill with this id already exists; use update or choose a more specific name"};
  try{
   const saved=api.save(dir,{id,name,description:String(args.description||"").slice(0,500),trigger:{phrases},parameters:Array.isArray(args.parameters)?args.parameters:[],steps,enabled:true,approval:"per-tool",metadata:{source:"learned-from-verified-task"}});
   return{ok:true,skill:{id:saved.id,name:saved.name,triggerPhrases:saved.trigger.phrases,parameters:saved.parameters,stepCount:saved.steps.length,enabled:saved.enabled,updatedAt:saved.updatedAt}};
  }catch(error){return{ok:false,error:"Could not save learned workflow: "+String(error?.message||error).slice(0,180)}}
 }
 if(!String(args.skillId||"").trim())return{ok:false,error:"skillId is required for this operation"};
 const skill=api.get(dir,args.skillId);
 if(!skill)return{ok:false,error:"Saved skill not found: "+args.skillId};
 if(operation==="get")return{ok:true,skill};
 if(operation==="enable"||operation==="disable"){const updated=api.setEnabled(dir,skill.id,operation==="enable");return{ok:true,skill:{id:updated.id,name:updated.name,enabled:updated.enabled}}}
 if(["replace_step","insert_step","remove_step","move_step"].includes(operation)){
  const index=Number(args.stepIndex),toIndex=Number(args.toIndex);
  if(!Array.isArray(skill.steps)||!skill.steps.length)return{ok:false,error:"This saved workflow has no action steps"};
  if(!Number.isInteger(index)||index<1||index>(operation==="insert_step"?skill.steps.length+1:skill.steps.length))return{ok:false,error:"stepIndex is outside the saved workflow"};
  if(operation==="replace_step"||operation==="insert_step"){
   const step=args.step;
   if(!step||typeof step!=="object"||typeof step.tool!=="string"||!step.tool.trim()||!step.args||typeof step.args!=="object"||Array.isArray(step.args))return{ok:false,error:"A replacement step must include a tool name and an arguments object"};
   const cleanStep={tool:step.tool.trim(),args:step.args};
   if(operation==="replace_step")skill.steps[index-1]=cleanStep;else skill.steps.splice(index-1,0,cleanStep);
  }else if(operation==="remove_step"){
   if(skill.steps.length===1)return{ok:false,error:"Cannot remove the final action step; replace it or delete the workflow explicitly"};
   skill.steps.splice(index-1,1);
  }else{
   if(!Number.isInteger(toIndex)||toIndex<1||toIndex>skill.steps.length)return{ok:false,error:"toIndex is outside the saved workflow"};
   const [step]=skill.steps.splice(index-1,1);skill.steps.splice(toIndex-1,0,step);
  }
  const updated=api.save(dir,skill);
  return{ok:true,skill:{id:updated.id,name:updated.name,stepCount:updated.steps.length,steps:updated.steps.map((step,i)=>({index:i+1,tool:step.tool,argsKeys:Object.keys(step.args||{})})),updatedAt:updated.updatedAt}};
 }
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
