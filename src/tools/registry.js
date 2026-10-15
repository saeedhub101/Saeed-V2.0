const {redactToolArgs}=require("./redact");
const {validateSchemaValue,validateToolArguments,schemaTypeMatches}=require("./schema-validator");
const {categoryForTool,authorizeToolRequest}=require("./tool-policy");
const path=require("path"),{Computer}=require("../main/automation/computer");
const domains=[require("./files"),require("./office"),require("./image"),require("./windows"),require("./web"),require("./interaction"),require("./memory-tasks"),require("./agent-tasks"),require("./agent-skills"),require("./addons"),require("./email")];
const characterMotionToolSchema={type:"function",function:{name:"character_motion",description:"Control Saeed's character semantically. Use gestures such as wave, nod, think, talk, celebrate, clap or jump; never provide bone angles.",parameters:{type:"object",properties:{intent:{type:"string"},duration:{type:"number"},intensity:{type:"number"}},required:["intent"]}}};

class ToolRegistry{
 constructor({captureScreen,userDataPath,confirm,permissionPolicy,recordHook,characterController}={}){
  this.computer=new Computer();this.memory=null;this.tasks=null;this.addonRuntime=null;this.userDataPath=userDataPath||process.cwd();this.captureScreen=captureScreen||(()=>null);
  this.confirm=confirm||(async()=>false);this.permissionPolicy=permissionPolicy||(()=> "ask");this.recordHook=typeof recordHook==="function"?recordHook:null;this.characterController=typeof characterController==="function"?characterController:null;this.tasksFile=path.join(this.userDataPath,"tasks.json");this.emergencyStopped=false;this.emergencyGeneration=0;this.activeControllers=new Set();
 }
 getAddonRuntime(){if(!this.addonRuntime)this.addonRuntime=require("../addons/runtime");return this.addonRuntime}
 setRecordHook(fn){this.recordHook=typeof fn==="function"?fn:null}
emergencyStop(){if(!this.emergencyStopped){this.emergencyStopped=true;this.emergencyGeneration++;}for(const controller of this.activeControllers){try{controller.abort(new Error("Emergency Stop activated"))}catch{}}return{stopped:true,generation:this.emergencyGeneration}}
 resumeAfterEmergencyStop(){this.emergencyStopped=false;this.emergencyGeneration++;return{stopped:false,generation:this.emergencyGeneration}}
 schemas(){let addonSchemas=[];try{addonSchemas=this.getAddonRuntime().toolSchemas(this.userDataPath)}catch{}return domains.flatMap(d=>d.schemas()).concat([characterMotionToolSchema],addonSchemas)}
 categoryFor(name,args={}){ return categoryForTool(name,args); }
 async authorize(category,request,isCurrent=()=>true){
  return authorizeToolRequest({category,request,isCurrent,permissionPolicy:this.permissionPolicy,confirm:this.confirm});
 }
 async call(name,args={},options={}){
  const isCurrent=typeof options?.isCurrent==="function"?options.isCurrent:()=>true;
  const generation=this.emergencyGeneration;
  const controller=new AbortController();
  const externalSignal=options?.signal||null;
  const externalAbort=()=>{try{controller.abort(externalSignal?.reason instanceof Error?externalSignal.reason:new Error("Tool request cancelled"))}catch{}};
  if(externalSignal?.aborted)externalAbort();else externalSignal?.addEventListener?.("abort",externalAbort,{once:true});
  this.activeControllers.add(controller);
  const current=()=>{try{return Boolean(isCurrent())&&!this.emergencyStopped&&generation===this.emergencyGeneration&&!controller.signal.aborted}catch{return false}};
  const stale=()=>({ok:false,stale:true,error:"Stale conversation request cancelled"});
  try{
   if(!current())return stale();
   const toolName=String(name||"");
   const requiredArgs={ocr_image:"filePath",extract_image_table:"filePath",inspect_image:"filePath",open_file:"filePath",reveal_file:"filePath",read_file:"filePath",open_application:"application"};
   if(toolName==="character_motion"){const validationError=validateToolArguments(args,characterMotionToolSchema.function.parameters,toolName);if(validationError)return{ok:false,error:validationError};if(!(await this.authorize("system",{name:toolName,args,signal:controller.signal},current)))return current()?{ok:false,error:"Permission denied for system"}:stale();if(!current())return stale();if(!this.characterController)return{ok:false,error:"Character controller unavailable"};const out=await this.characterController(args||{});if(!current())return stale();if(out?.ok!==false&&out!==undefined&&out!==null)this.record(toolName,args);return out}
   const required=requiredArgs[toolName];if(required&&!String(args?.[required]??"").trim())return{ok:false,error:'Missing required argument "'+required+'" for tool "'+toolName+'".'};
   const toolSchema=domains.flatMap(d=>d.schemas()).find(s=>s?.function?.name===toolName);const addon=/^addon_[a-z0-9][a-z0-9._-]{0,63}_.+/i.test(toolName);const addonTool=addon?this.getAddonRuntime().resolveTool(this.userDataPath,toolName):null;if(!toolSchema&&!addonTool)return{ok:false,error:"Unknown tool: "+toolName};const argumentSchema=toolSchema?.function?.parameters||addonTool?.tool?.parameters;const validationError=validateToolArguments(args,argumentSchema,toolName);if(validationError)return{ok:false,error:validationError};const category=this.categoryFor(toolName,args);if(!(await this.authorize(category,{name:toolName,args,signal:controller.signal},current)))return current()?{ok:false,error:"Permission denied for "+category}:stale();if(!current())return stale();
   const context={computer:this.computer,captureScreen:this.captureScreen,userDataPath:this.userDataPath,memory:this.memory,tasks:this.tasks,tasksFile:this.tasksFile,isCurrent:current,signal:controller.signal,requestPermission:(c,r)=>this.authorize(c,{...r,signal:controller.signal},current),characterController:this.characterController};
   for(const d of domains){if(!current())return stale();const out=await d.call(toolName,args,context);if(!current())return stale();if(out!==null){this.memory=context.memory;this.tasks=context.tasks;this.tasksFile=context.tasksFile;if(out?.ok!==false&&out!==undefined)this.record(toolName,args);return out}}
   if(addon){if(!current())return stale();const out=await this.getAddonRuntime().callTool(this.userDataPath,toolName,args,{isCurrent:current,signal:controller.signal});if(!current())return stale();if(out?.ok!==false&&out!==undefined)this.record(toolName,args);return out}
   return{ok:false,error:"Unknown tool: "+toolName}
  }catch(e){if(!current())return stale();return{ok:false,error:e?.message||String(e)}}
  finally{this.activeControllers.delete(controller);externalSignal?.removeEventListener?.("abort",externalAbort)}
 }
 record(name,args){if(this.recordHook)try{this.recordHook(name,redactToolArgs(name,args))}catch{}}
}
module.exports={ToolRegistry,validateSchemaValue,validateToolArguments,schemaTypeMatches};
