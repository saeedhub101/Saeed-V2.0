const assert=require("assert"),fs=require("fs"),os=require("os"),path=require("path");
const {ToolRegistry}=require("../src/tools/registry");
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"saeed-real-task-"));
 let confirms=0;
 const registry=new ToolRegistry({userDataPath:dir,permissionPolicy:()=> "allow",confirm:async()=>{confirms++;return true}});
 const file=path.join(dir,"task.txt");
 const write=await registry.call("write_file",{filePath:file,content:"Saeed task execution PASS"});
 assert(write.ok);
 const read=await registry.call("read_file",{filePath:file});
 assert(read.ok&&read.content==="Saeed task execution PASS");
 const listed=await registry.call("list_directory",{directory:dir});
 assert(listed.ok&&listed.files.some(x=>x.path===file));
 const del=await registry.call("delete_file",{filePath:file});
 assert(del.ok&&del.deleted&&confirms===1);
 console.log("Saeed real task tool test: PASS");
 fs.rmSync(dir,{recursive:true,force:true});
})().catch(e=>{console.error(e);process.exit(1)});