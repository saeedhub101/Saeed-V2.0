const {redactToolArgs}=require("./redact");
const {validateSchemaValue,validateToolArguments,schemaTypeMatches}=require("./schema-validator");
const path=require("path"),{Computer}=require("../main/automation/computer");
const domains=[require("./files"),require("./office"),require("./image"),require("./windows"),require("./web"),require("./interaction"),require("./memory-tasks"),require("./agent-tasks"),require("./agent-skills"),require("./addons"),require("./email")];
const characterMotionToolSchema={type:"function",function:{name:"character_motion",description:"Control Saeed's character semantically. Use gestures such as wave, nod, think, talk, celebrate, clap or jump; never provide bone angles.",parameters:{type:"object",properties:{intent:{type:"string"},duration:{type:"number"},intensity:{type:"number"}},required:["intent"]}}};

class ToolRegistry{
 constructor({captureScreen,userDataPath,confirm,permissionPolicy,recordHook,characterController}={}){
  this.computer=new Computer();this.memory=null;this.tasks=null;this.userDataPath=userDataPath||process.cwd();this.captureScreen=captureScreen||(()=>null);
  this.confirm=confirm||(async()=>false);this.permissionPolicy=permissionPolicy||(()=> "ask");this.recordHook=typeof recordHook==="function"?recordHook:null;this.characterController=typeof characterController==="function"?characterController:null;this.tasksFile=path.join(this.userDataPath,"tasks.json");this.emergencyStopped=false;this.emergencyGeneration=0;this.activeControllers=new Set();
 }
 setRecordHook(fn){this.recordHook=typeof fn==="function"?fn:null}
emergencyStop(){if(!this.emergencyStopped){this.emergencyStopped=true;this.emergencyGeneration++;}for(const controller of this.activeControllers){try{controller.abort(new Error("Emergency Stop activated"))}catch{}}return{stopped:true,generation:this.emergencyGeneration}}
 resumeAfterEmergencyStop(){this.emergencyStopped=false;this.emergencyGeneration++;return{stopped:false,generation:this.emergencyGeneration}}
 schemas(){let addonSchemas=[];try{addonSchemas=require("../addons/runtime").toolSchemas(this.userDataPath)}catch{}return domains.flatMap(d=>d.schemas()).concat([characterMotionToolSchema],addonSchemas)}
 categoryFor(name,args={}){
  if(["system_info","diagnose_computer","active_window","list_windows","focus_window","process_list","disk_info"].includes(name))return"system";
  if(["list_directory","read_file","write_file","open_file","reveal_file","inspect_document","extract_pdf_text","read_excel","calculate_excel","write_excel"].includes(name))return"files";
  if(name==="open_application")return"applications";
  if(name==="character_motion")return"system";
  if(["open_url","web_search","fetch_web_page","network_info"].includes(name))return"network";
  if(["screenshot","ocr_image","extract_image_table","inspect_image","inspect_window_controls"].includes(name))return"screen";
  if(name==="interact_ui_element")return"mouseKeyboard";
  if(["mouse_move","mouse_click","type_text","key_press"].includes(name))return"mouseKeyboard";
  if(name==="agent_skills"&&["delete","replace_step","insert_step","remove_step","move_step"].includes(args?.operation))return"destructive";
  if(["add_task","list_tasks","complete_task","remember","recall","list_memory","forget","memory_add","memory_search","knowledge_add","agent_task_history","agent_task_details","agent_skills"].includes(name))return"tasksMemory";
  if(["mcp_list_servers","mcp_test_connection","mcp_list_tools","mcp_list_resources","mcp_read_resource","mcp_list_prompts","mcp_get_prompt","mcp_call_tool"].includes(name))return"mcp";
  if(/^addon_[a-z0-9][a-z0-9._-]{0,63}_.+/i.test(name))return"addons";
  if(["email_provider_info","email_test_connection","email_imap_folders","email_imap_search","email_imap_fetch","email_pop3_list","email_pop3_fetch"].includes(name))return"network";
  if(name==="email_send")return"credentials";
  if(name==="remove_task")return"destructive";
  return"system";
 }
 async authorize(category,request,isCurrent=()=>true){
  const current=()=>{try{return typeof isCurrent==="function"?Boolean(isCurrent()):true}catch{return false}};
  if(!current())return false;
  if(String(request?.name||"")==="task_plan")return current();
  let policy="ask";
  try{policy=typeof this.permissionPolicy==="function"?await this.permissionPolicy(category,request):"ask"}catch{return false}
  if(!current()||policy==="deny")return false;
  const name=String(request?.name||"");
  const alwaysConfirm=new Set(["email_send","mcp_call_tool"]);
  if(name==="agent_skills"&&["delete","replace_step","insert_step","remove_step","move_step"].includes(request?.args?.operation))alwaysConfirm.add(name);
  const uiLabel=String(request?.args?.expectedName||"").trim(),uiId=String(request?.args?.automationId||"").trim();
  const sensitiveUiInvoke=name==="interact_ui_element"&&request?.args?.action==="invoke"&&(!uiLabel&&!uiId||/issue|send|submit|pay|delete|remove|approve|confirm|finali[sz]|publish|purchase|release|policy|إصدار|ارسال|إرسال|دفع|حذف|اعتماد|تأكيد|نهائي/i.test(uiLabel+" "+uiId));
  if(policy==="allow"&&!alwaysConfirm.has(name)&&!sensitiveUiInvoke)return current();
  try{return current()&&Boolean(await this.confirm({...request,permissionCategory:category}))&&current()}catch{return false}
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
   const toolSchema=domains.flatMap(d=>d.schemas()).find(s=>s?.function?.name===toolName);const addon=/^addon_[a-z0-9][a-z0-9._-]{0,63}_.+/i.test(toolName);const addonTool=addon?require("../addons/runtime").resolveTool(this.userDataPath,toolName):null;if(!toolSchema&&!addonTool)return{ok:false,error:"Unknown tool: "+toolName};const argumentSchema=toolSchema?.function?.parameters||addonTool?.tool?.parameters;const validationError=validateToolArguments(args,argumentSchema,toolName);if(validationError)return{ok:false,error:validationError};const category=this.categoryFor(toolName,args);if(!(await this.authorize(category,{name:toolName,args,signal:controller.signal},current)))return current()?{ok:false,error:"Permission denied for "+category}:stale();if(!current())return stale();
   const context={computer:this.computer,captureScreen:this.captureScreen,userDataPath:this.userDataPath,memory:this.memory,tasks:this.tasks,tasksFile:this.tasksFile,isCurrent:current,signal:controller.signal,requestPermission:(c,r)=>this.authorize(c,{...r,signal:controller.signal},current),characterController:this.characterController};
   for(const d of domains){if(!current())return stale();const out=await d.call(toolName,args,context);if(!current())return stale();if(out!==null){this.memory=context.memory;this.tasks=context.tasks;this.tasksFile=context.tasksFile;if(out?.ok!==false&&out!==undefined)this.record(toolName,args);return out}}
   if(addon){if(!current())return stale();const out=await require("../addons/runtime").callTool(this.userDataPath,toolName,args,{isCurrent:current,signal:controller.signal});if(!current())return stale();if(out?.ok!==false&&out!==undefined)this.record(toolName,args);return out}
   return{ok:false,error:"Unknown tool: "+toolName}
  }catch(e){if(!current())return stale();return{ok:false,error:e?.message||String(e)}}
  finally{this.activeControllers.delete(controller);externalSignal?.removeEventListener?.("abort",externalAbort)}
 }
 record(name,args){if(this.recordHook)try{this.recordHook(name,redactToolArgs(name,args))}catch{}}
}
module.exports={ToolRegistry,validateSchemaValue,validateToolArguments,schemaTypeMatches};
