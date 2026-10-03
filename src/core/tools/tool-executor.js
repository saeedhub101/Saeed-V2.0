class ToolExecutor{
 constructor(registry,{onEvent}={}){this.registry=registry;this.onEvent=onEvent||(()=>{});}
 schemas(){return this.registry.schemas();}
 categoryFor(name){return this.registry.categoryFor(name);}
 async authorize(category,request){return this.registry.authorize(category,request);}
 async call(name,args={}){
  const tool=String(name||"");let out=await this.registry.call(tool,args);
  if(out?.ok===false&&["web_search","fetch_web_page","network_info","read_file","inspect_document","extract_pdf_text","read_excel"].includes(tool)){
   this.onEvent({type:"diagnostic",level:"INFO",stage:"TOOL RETRY",message:"Retrying safe read/network tool after failure",meta:{tool}});
   try{const retry=await this.registry.call(tool,args);if(retry?.ok!==false)out=retry}catch{}
  }
  return out;
 }
 get computer(){return this.registry.computer;}
 get userDataPath(){return this.registry.userDataPath;}
 get tasksFile(){return this.registry.tasksFile;}
}
module.exports={ToolExecutor};