class ToolExecutor{
 constructor(registry,{onEvent}={}){this.registry=registry;this.onEvent=onEvent||(()=>{});}
 schemas(){return this.registry.schemas()}
 categoryFor(name){return this.registry.categoryFor(name)}
 async authorize(category,request){return this.registry.authorize(category,request)}
 async call(name,args={}){return this.registry.call(String(name||""),args)}
 get computer(){return this.registry.computer}
 get userDataPath(){return this.registry.userDataPath}
 get tasksFile(){return this.registry.tasksFile}
}
module.exports={ToolExecutor};