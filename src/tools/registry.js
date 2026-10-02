const path=require("path"),fs=require("fs"),{Computer}=require("../computer");
const domains=[require("./files"),require("./office"),require("./windows"),require("./web"),require("./interaction"),require("./memory-tasks"),require("./verification")];
class ToolRegistry{
 constructor({captureScreen,userDataPath,confirm,permissionPolicy}={}){this.computer=new Computer();this.memory=null;this.tasks=null;this.userDataPath=userDataPath||process.cwd();this.captureScreen=captureScreen||(()=>null);this.confirm=confirm|| (async()=>false);this.permissionPolicy=permissionPolicy||(()=>"allow");this.tasksFile=path.join(this.userDataPath,"tasks.json")}
 schemas(){return domains.flatMap(d=>d.schemas())}
 rankForTask(text){const l=String(text||"").toLowerCase(),groups=[];const add=(name,score)=>groups.push({name,score});if(/pdf|document|word|docx|spreadsheet|excel|xlsx|csv|ملف|مستند|جدول/i.test(l))add("native-office/files",10);if(/screen|screenshot|mouse|click|keyboard|type|نافذة|شاشة|ماوس|لوحة المفاتيح/i.test(l))add("screen/interaction/windows",8);if(/website|web|internet|search|url|موقع|ابحث|الانترنت/i.test(l))add("web",8);if(/task|remember|memory|مهام|تذكر|ذاكرة/i.test(l))add("tasks-memory",8);if(/computer|system|cpu|ram|disk|network|جهاز|النظام|المعالج|الذاكرة|القرص|الشبكة/i.test(l))add("windows/system",7);if(!groups.length)add("direct-answer",1);return groups.sort((a,b)=>b.score-a.score).slice(0,3)}
 categoryFor(name,args={}){
  if(["delete_file","remove_task"].includes(name))return"destructive";
  if(["system_info","diagnose_computer","active_window","list_windows","focus_window","process_list","disk_info","verify_process","verify_window"].includes(name))return"system";
  if(["list_directory","read_file","write_file","open_file","reveal_file","inspect_document","extract_pdf_text","read_excel","calculate_excel","write_excel","verify_path","verify_file_contains"].includes(name))return"files";
  if(name==="open_application")return"applications";
  if(["open_url","web_search","fetch_web_page","network_info"].includes(name))return"network";
  if(["screenshot"].includes(name))return"screen";
  if(["mouse_move","mouse_click","type_text","key_press"].includes(name))return"mouseKeyboard";
  if(["add_task","list_tasks","complete_task","remember","recall","list_memory","forget"].includes(name))return"tasksMemory";
  return"system";
 }
 isReadOnly(name){return new Set(["list_directory","read_file","inspect_document","extract_pdf_text","read_excel","calculate_excel","system_info","diagnose_computer","active_window","list_windows","process_list","disk_info","network_info","web_search","fetch_web_page","screenshot","list_tasks","recall","list_memory","verify_path","verify_file_contains","verify_process","verify_window"]).has(String(name||""))}
 async callMany(calls=[]){const list=Array.isArray(calls)?calls:[];if(list.length>1&&list.every(x=>this.isReadOnly(x?.name)))return Promise.all(list.map(x=>this.call(x.name,x.args||{})));const out=[];for(const x of list)out.push(await this.call(x.name,x.args||{}));return out}
 async authorize(category,request){
  const p=this.permissionPolicy(category);
  if(p==="deny")return false;
  if(category==="destructive")return this.confirm({...request,permissionCategory:category});
  if(p==="ask")return this.confirm({...request,permissionCategory:category});
  return true;
 }
 async call(name,args={}){
  try{const category=this.categoryFor(name,args);if(!(await this.authorize(category,{name,args})))return{ok:false,error:"Permission denied for "+category};
   const context={computer:this.computer,captureScreen:this.captureScreen,userDataPath:this.userDataPath,memory:this.memory,tasks:this.tasks,tasksFile:this.tasksFile};
   for(const d of domains){const out=await d.call(name,args,context);if(out!==null){this.memory=context.memory;this.tasks=context.tasks;this.tasksFile=context.tasksFile;return out}}
   return{ok:false,error:"Unknown tool: "+name};
  }catch(e){return{ok:false,error:e.message}}
 }
}
module.exports={ToolRegistry};
