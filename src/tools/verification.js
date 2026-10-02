const fs=require("fs"),path=require("path"),{execFile}=require("child_process");
function schemas(){return[
 {type:"function",function:{name:"verify_path",description:"Verify that a file or directory exists and report its type and size.",parameters:{type:"object",properties:{path:{type:"string"}},required:["path"]}}},
 {type:"function",function:{name:"verify_file_contains",description:"Verify that a UTF-8 text file exists and contains requested text.",parameters:{type:"object",properties:{path:{type:"string"},text:{type:"string"}},required:["path","text"]}}},
 {type:"function",function:{name:"verify_process",description:"Verify that a Windows process is running by executable/process name.",parameters:{type:"object",properties:{name:{type:"string"}},required:["name"]}}},
 {type:"function",function:{name:"verify_window",description:"Verify that a named window is currently visible/open on Windows.",parameters:{type:"object",properties:{title:{type:"string"}},required:["title"]}}}
]}
async function call(name,a){
 if(name==="verify_path"){const p=path.resolve(String(a?.path||""));if(!fs.existsSync(p))return{ok:true,verified:false,path:p};const s=fs.statSync(p);return{ok:true,verified:true,path:p,type:s.isDirectory()?"directory":"file",bytes:s.isFile()?s.size:null}}
 if(name==="verify_file_contains"){const p=path.resolve(String(a?.path||""));if(!fs.existsSync(p))return{ok:true,verified:false,path:p,error:"File not found"};const content=fs.readFileSync(p,"utf8");return{ok:true,verified:content.includes(String(a?.text||"")),path:p}}
 if(name==="verify_process")return new Promise(resolve=>execFile("powershell.exe",["-NoProfile","-Command","@(Get-Process -Name '"+String(a?.name||"").replace(/'/g,"''")+"' -ErrorAction SilentlyContinue).Count"],{windowsHide:true},(e,out)=>resolve({ok:true,verified:Number(String(out||"0").trim())>0,name:String(a?.name||"")})));
 if(name==="verify_window")return new Promise(resolve=>execFile("powershell.exe",["-NoProfile","-Command","@(Get-Process | Where-Object { $_.MainWindowTitle -like '*"+String(a?.title||"").replace(/'/g,"''")+"*' }).Count"],{windowsHide:true},(e,out)=>resolve({ok:true,verified:Number(String(out||"0").trim())>0,title:String(a?.title||"")})));
 return null;
}
module.exports={schemas,call};
