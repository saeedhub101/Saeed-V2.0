const {spawn}=require("child_process"),path=require("path");
let child=null,buffer="";
function start(onEvent,userData){
  if(child)throw new Error("Windows recorder is already running");
  if(process.platform!=="win32")throw new Error("Learning recorder is currently supported on Windows only");
  const script=path.join(__dirname,"windows-recorder.ps1");
  child=spawn("powershell.exe",["-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-File",script,"-IgnorePid",String(process.pid)],{windowsHide:true,stdio:["ignore","pipe","pipe"]});
  child.stdout.on("data",d=>{buffer+=String(d);let i;while((i=buffer.indexOf("\n"))>=0){const line=buffer.slice(0,i).trim();buffer=buffer.slice(i+1);if(!line)continue;try{const e=JSON.parse(line);if(e.type==="action"&&typeof onEvent==="function")onEvent(e)}catch{}}});
  child.stderr.on("data",d=>{});
  child.on("error",()=>{child=null;buffer=""});
  child.on("exit",()=>{child=null;buffer=""});
  return true;
}
function stop(){if(!child)return false;try{child.kill()}catch{}child=null;buffer="";return true}
module.exports={start,stop};
