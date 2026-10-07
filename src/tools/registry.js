const path=require("path"),{Computer}=require("../main/automation/computer");
const domains=[require("./files"),require("./office"),require("./image"),require("./windows"),require("./web"),require("./interaction"),require("./memory-tasks")];
class ToolRegistry{
 constructor({captureScreen,userDataPath,confirm,permissionPolicy,recordHook,characterController}={}){
  this.computer=new Computer();this.memory=null;this.tasks=null;this.userDataPath=userDataPath||process.cwd();this.captureScreen=captureScreen||(()=>null);
  this.confirm=confirm||(async()=>false);this.permissionPolicy=permissionPolicy||(()=> "allow");this.recordHook=typeof recordHook==="function"?recordHook:null;this.characterController=typeof characterController==="function"?characterController:null;this.tasksFile=path.join(this.userDataPath,"tasks.json");
 }
 setRecordHook(fn){this.recordHook=typeof fn==="function"?fn:null}
 schemas(){return domains.flatMap(d=>d.schemas()).concat([{type:"function",function:{name:"character_motion",description:"Control Saeed's character semantically. Use gestures such as wave, nod, think, talk, celebrate, clap or jump; never provide bone angles.",parameters:{type:"object",properties:{intent:{type:"string"},duration:{type:"number"},intensity:{type:"number"}},required:["intent"]}}}]).concat(require("./addons").schemas())}
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
  if(["email_provider_info","email_test_connection","email_imap_folders","email_imap_search","email_imap_fetch"].includes(name))return"network";
  if(["email_send","credential_store","credential_get"].includes(name))return"credentials";
  if(name==="remove_task")return"destructive";
  return"system";
 }
 async authorize(category,request){const p=typeof this.permissionPolicy==="function"?await this.permissionPolicy(category,request):"allow";if(p==="allow")return true;if(p==="deny")return false;return this.confirm({...request,permissionCategory:category})}
 async call(name,args={}){
  try{
   const toolName=String(name||"");
   const requiredArgs={ocr_image:"filePath",extract_image_table:"filePath",inspect_image:"filePath",open_file:"filePath",reveal_file:"filePath",read_file:"filePath",open_application:"application"};
   if(toolName==="character_motion"){if(!String(args?.intent||"").trim())return{ok:false,error:'Missing required argument "intent" for tool "character_motion".'};if(!(await this.authorize("system",{name:toolName,args})))return{ok:false,error:"Permission denied for system"};if(!this.characterController)return{ok:false,error:"Character controller unavailable"};const out=await this.characterController(args||{});this.record(toolName,args);return out}
   const required=requiredArgs[toolName];if(required&&!String(args?.[required]??"").trim())return{ok:false,error:'Missing required argument "'+required+'" for tool "'+toolName+'".'};
   const known=domains.some(d=>d.schemas().some(s=>s?.function?.name===toolName));const addon=/^addon_[a-z0-9][a-z0-9._-]{0,63}_.+/i.test(toolName);if(!known&&!addon)return{ok:false,error:"Unknown tool: "+toolName};const category=this.categoryFor(toolName);if(!(await this.authorize(category,{name:toolName,args})))return{ok:false,error:"Permission denied for "+category};
   const context={computer:this.computer,captureScreen:this.captureScreen,userDataPath:this.userDataPath,memory:this.memory,tasks:this.tasks,tasksFile:this.tasksFile,requestPermission:(c,r)=>this.authorize(c,r),characterController:this.characterController};
   for(const d of domains){const out=await d.call(toolName,args,context);if(out!==null){this.memory=context.memory;this.tasks=context.tasks;this.tasksFile=context.tasksFile;this.record(toolName,args);return out}}
   if(/^addon_[a-z0-9][a-z0-9._-]{0,63}_.+/i.test(toolName)){const out=await require("../addons/runtime").callTool(this.userDataPath,toolName,args);this.record(toolName,args);return out}
   return{ok:false,error:"Unknown tool: "+toolName}
  }catch(e){return{ok:false,error:e.message}}
 }
 record(name,args){if(this.recordHook)try{this.recordHook(name,args)}catch{}}
}
module.exports={ToolRegistry};
