const {redactToolArgs}=require("./redact");
const path=require("path"),{Computer}=require("../main/automation/computer");
const domains=[require("./files"),require("./office"),require("./image"),require("./windows"),require("./web"),require("./interaction"),require("./memory-tasks"),require("./addons"),require("./email")];
const characterMotionToolSchema={type:"function",function:{name:"character_motion",description:"Control Saeed's character semantically. Use gestures such as wave, nod, think, talk, celebrate, clap or jump; never provide bone angles.",parameters:{type:"object",properties:{intent:{type:"string"},duration:{type:"number"},intensity:{type:"number"}},required:["intent"]}}};

function schemaTypeMatches(value,type){
 if(type==="null")return value===null;
 if(type==="object")return value!==null&&typeof value==="object"&&!Array.isArray(value);
 if(type==="array")return Array.isArray(value);
 if(type==="integer")return Number.isInteger(value);
 if(type==="number")return typeof value==="number"&&Number.isFinite(value);
 if(type==="string")return typeof value==="string";
 if(type==="boolean")return typeof value==="boolean";
 return true;
}
function validateSchemaValue(value,schema,pathName){
 if(!schema||typeof schema!=="object")return null;
 if(Array.isArray(schema.type)?!schema.type.some(t=>schemaTypeMatches(value,t)):schema.type&&!schemaTypeMatches(value,schema.type)){
  return pathName+" must be "+(Array.isArray(schema.type)?schema.type.join(" or "):schema.type);
 }
 if(Array.isArray(schema.enum)&&!schema.enum.some(item=>Object.is(item,value)))return pathName+" must be one of: "+schema.enum.join(", ");
 if(typeof value==="string"){
  if(Number.isInteger(schema.minLength)&&value.length<schema.minLength)return pathName+" is too short";
  if(Number.isInteger(schema.maxLength)&&value.length>schema.maxLength)return pathName+" is too long";
  if(schema.pattern){try{if(!(new RegExp(schema.pattern)).test(value))return pathName+" has an invalid format"}catch{}}
 }
 if(typeof value==="number"){
  if(Number.isFinite(schema.minimum)&&value<schema.minimum)return pathName+" must be at least "+schema.minimum;
  if(Number.isFinite(schema.maximum)&&value>schema.maximum)return pathName+" must be at most "+schema.maximum;
 }
 if(Array.isArray(value)){
  if(Number.isInteger(schema.minItems)&&value.length<schema.minItems)return pathName+" needs at least "+schema.minItems+" item(s)";
  if(Number.isInteger(schema.maxItems)&&value.length>schema.maxItems)return pathName+" supports at most "+schema.maxItems+" item(s)";
  if(schema.items)for(let i=0;i<value.length;i++){const error=validateSchemaValue(value[i],schema.items,pathName+"["+(i+1)+"]");if(error)return error}
 }
 if(value&&typeof value==="object"&&!Array.isArray(value)){
  for(const key of schema.required||[])if(!Object.prototype.hasOwnProperty.call(value,key)||value[key]===undefined||value[key]===null)return pathName+" is missing required field \""+key+"\"";
  for(const [key,child] of Object.entries(schema.properties||{})){
   if(!Object.prototype.hasOwnProperty.call(value,key)||value[key]===undefined||value[key]===null)continue;
   const error=validateSchemaValue(value[key],child,pathName+"."+key);if(error)return error;
  }
 }
 return null;
}
function validateToolArguments(args,schema,name){
 if(!schema)return null;
 const value=args&&typeof args==="object"&&!Array.isArray(args)?args:{};
 return validateSchemaValue(value,schema,"Arguments for "+name);
}
class ToolRegistry{
 constructor({captureScreen,userDataPath,confirm,permissionPolicy,recordHook,characterController}={}){
  this.computer=new Computer();this.memory=null;this.tasks=null;this.userDataPath=userDataPath||process.cwd();this.captureScreen=captureScreen||(()=>null);
  this.confirm=confirm||(async()=>false);this.permissionPolicy=permissionPolicy||(()=> "ask");this.recordHook=typeof recordHook==="function"?recordHook:null;this.characterController=typeof characterController==="function"?characterController:null;this.tasksFile=path.join(this.userDataPath,"tasks.json");
 }
 setRecordHook(fn){this.recordHook=typeof fn==="function"?fn:null}
 schemas(){let addonSchemas=[];try{addonSchemas=require("../addons/runtime").toolSchemas(this.userDataPath)}catch{}return domains.flatMap(d=>d.schemas()).concat([characterMotionToolSchema],addonSchemas)}
 categoryFor(name){
  if(["system_info","diagnose_computer","active_window","list_windows","focus_window","process_list","disk_info"].includes(name))return"system";
  if(["list_directory","read_file","write_file","open_file","reveal_file","inspect_document","extract_pdf_text","read_excel","calculate_excel","write_excel"].includes(name))return"files";
  if(name==="open_application")return"applications";
  if(name==="character_motion")return"system";
  if(["open_url","web_search","fetch_web_page","network_info"].includes(name))return"network";
  if(["screenshot","ocr_image","extract_image_table","inspect_image"].includes(name))return"screen";
  if(["mouse_move","mouse_click","type_text","key_press"].includes(name))return"mouseKeyboard";
  if(["add_task","list_tasks","complete_task","remember","recall","list_memory","forget","memory_add","memory_search","knowledge_add"].includes(name))return"tasksMemory";
  if(["mcp_list_servers","mcp_list_tools","mcp_call_tool"].includes(name))return"mcp";
  if(/^addon_[a-z0-9][a-z0-9._-]{0,63}_.+/i.test(name))return"addons";
  if(["email_provider_info","email_test_connection","email_imap_folders","email_imap_search","email_imap_fetch","email_pop3_list","email_pop3_fetch"].includes(name))return"network";
  if(name==="email_send")return"credentials";
  if(name==="remove_task")return"destructive";
  return"system";
 }
 async authorize(category,request,isCurrent=()=>true){
  const current=()=>{try{return typeof isCurrent==="function"?Boolean(isCurrent()):true}catch{return false}};
  if(!current())return false;
  let policy="ask";
  try{policy=typeof this.permissionPolicy==="function"?await this.permissionPolicy(category,request):"ask"}catch{return false}
  if(!current()||policy==="deny")return false;
  const name=String(request?.name||"");
  const alwaysConfirm=new Set(["email_send","mcp_call_tool"]);
  if(policy==="allow"&&!alwaysConfirm.has(name))return current();
  try{return current()&&Boolean(await this.confirm({...request,permissionCategory:category}))&&current()}catch{return false}
 }
 async call(name,args={},options={}){
  const isCurrent=typeof options?.isCurrent==="function"?options.isCurrent:()=>true;
  const current=()=>{try{return Boolean(isCurrent())}catch{return false}};
  const stale=()=>({ok:false,stale:true,error:"Stale conversation request cancelled"});
  if(!current())return stale();
  try{
   const toolName=String(name||"");
   const requiredArgs={ocr_image:"filePath",extract_image_table:"filePath",inspect_image:"filePath",open_file:"filePath",reveal_file:"filePath",read_file:"filePath",open_application:"application"};
   if(toolName==="character_motion"){const validationError=validateToolArguments(args,characterMotionToolSchema.function.parameters,toolName);if(validationError)return{ok:false,error:validationError};if(!(await this.authorize("system",{name:toolName,args},current)))return current()?{ok:false,error:"Permission denied for system"}:stale();if(!current())return stale();if(!this.characterController)return{ok:false,error:"Character controller unavailable"};const out=await this.characterController(args||{});if(!current())return stale();this.record(toolName,args);return out}
   const required=requiredArgs[toolName];if(required&&!String(args?.[required]??"").trim())return{ok:false,error:'Missing required argument "'+required+'" for tool "'+toolName+'".'};
   const toolSchema=domains.flatMap(d=>d.schemas()).find(s=>s?.function?.name===toolName);const addon=/^addon_[a-z0-9][a-z0-9._-]{0,63}_.+/i.test(toolName);const addonTool=addon?require("../addons/runtime").resolveTool(this.userDataPath,toolName):null;if(!toolSchema&&!addonTool)return{ok:false,error:"Unknown tool: "+toolName};const argumentSchema=toolSchema?.function?.parameters||addonTool?.tool?.parameters;const validationError=validateToolArguments(args,argumentSchema,toolName);if(validationError)return{ok:false,error:validationError};const category=this.categoryFor(toolName);if(!(await this.authorize(category,{name:toolName,args},current)))return current()?{ok:false,error:"Permission denied for "+category}:stale();if(!current())return stale();
   const context={computer:this.computer,captureScreen:this.captureScreen,userDataPath:this.userDataPath,memory:this.memory,tasks:this.tasks,tasksFile:this.tasksFile,isCurrent:current,requestPermission:(c,r)=>this.authorize(c,r,current),characterController:this.characterController};
   for(const d of domains){if(!current())return stale();const out=await d.call(toolName,args,context);if(!current())return stale();if(out!==null){this.memory=context.memory;this.tasks=context.tasks;this.tasksFile=context.tasksFile;this.record(toolName,args);return out}}
   if(addon){if(!current())return stale();const out=await require("../addons/runtime").callTool(this.userDataPath,toolName,args,{isCurrent:current,signal:options?.signal||null});if(!current())return stale();this.record(toolName,args);return out}
   return{ok:false,error:"Unknown tool: "+toolName}
  }catch(e){return{ok:false,error:e.message}}
 }
 record(name,args){if(this.recordHook)try{this.recordHook(name,redactToolArgs(name,args))}catch{}}
}
module.exports={ToolRegistry};
