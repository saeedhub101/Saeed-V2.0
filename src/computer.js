const {execFile,spawn}=require("child_process"),{promisify}=require("util"),run=promisify(execFile),{clipboard,shell}=require("electron");

class Computer{
 constructor(){this.cache=new Map();this.taskCache=new Map();this.cacheTtlMs=1500;this.taskActive=false;}
 beginTask(){this.taskActive=true;this.taskCache.clear();}
 endTask(){this.taskActive=false;this.taskCache.clear();}
 cached(key,loader,ttl=this.cacheTtlMs){
  const now=Date.now(),hit=this.cache.get(key);
  if(hit&&now-hit.time<ttl)return hit.value;
  const pending=this.cache.get(key)?.pending;
  if(pending)return pending;
  const promise=Promise.resolve().then(loader).then(value=>{this.cache.set(key,{time:Date.now(),value});return value}).catch(error=>{this.cache.delete(key);throw error});
  this.cache.set(key,{time:now,pending:promise});return promise;
 }
 taskCached(key,loader){
  if(!this.taskActive)return loader();
  if(this.taskCache.has(key))return this.taskCache.get(key);
  const p=Promise.resolve().then(loader);this.taskCache.set(key,p);return p;
 }
 async powershell(command){
  const r=await run("powershell.exe",["-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-Command",command],{windowsHide:true,maxBuffer:8*1024*1024});
  return {ok:true,stdout:r.stdout,stderr:r.stderr};
 }
 esc(s){return String(s).replace(/'/g,"''");}
 async openApp(app){
  const value=String(app||"").trim();
  if(!value)return{ok:false,error:"Application name is empty"};
  const aliases={"my computer":["explorer.exe",["shell:MyComputerFolder"]],"this pc":["explorer.exe",["shell:MyComputerFolder"]],"file explorer":["explorer.exe",[]],"windows explorer":["explorer.exe",[]],"explorer":["explorer.exe",[]],"calculator":["calc.exe",[]],"calc":["calc.exe",[]],"notepad":["notepad.exe",[]],"command prompt":["cmd.exe",[]],"cmd":["cmd.exe",[]],"powershell":["powershell.exe",[]],"task manager":["taskmgr.exe",[]],"control panel":["control.exe",[]]};
  const key=value.toLowerCase().replace(/\s+/g," ").trim();
  if(/^https?:\/\//i.test(value)){try{await shell.openExternal(value);return{ok:true,opened:value}}catch(e){return{ok:false,error:e.message}}}
  if(/^[A-Za-z]:\\|^[\\/]/.test(value)){try{const error=await shell.openPath(value);return error?{ok:false,error}:{ok:true,opened:value}}catch(e){return{ok:false,error:e.message}}}
  const target=aliases[key];
  if(target){try{const child=spawn(target[0],target[1],{detached:true,windowsHide:true,stdio:"ignore"});child.unref();return{ok:true,application:target[0]}}catch(e){return{ok:false,error:e.message}}}
  try{
   const found=await run("where.exe",[value],{windowsHide:true,maxBuffer:256*1024});
   const executable=String(found.stdout||"").split(/\r?\n/).map(x=>x.trim()).find(Boolean);
   if(!executable)return{ok:false,error:"Application not found: "+value};
   const child=spawn(executable,[],{detached:true,windowsHide:true,stdio:"ignore"});child.unref();
   return{ok:true,application:executable};
  }catch{return{ok:false,error:"Application not found: "+value}}
 }
 async mouseMove(x,y){
  const X=Math.round(Number(x)),Y=Math.round(Number(y));if(!Number.isFinite(X)||!Number.isFinite(Y))return{ok:false,error:"Invalid coordinates"};
  const code='using System;using System.Runtime.InteropServices;public static class M{[DllImport("user32.dll")]public static extern bool SetCursorPos(int X,int Y);}';
  return this.powershell("$sig='"+code+"';Add-Type $sig;[M]::SetCursorPos("+X+","+Y+")");
 }
 async mouseClick(x,y,button="left"){
  const X=Math.round(Number(x)),Y=Math.round(Number(y));if(!Number.isFinite(X)||!Number.isFinite(Y))return{ok:false,error:"Invalid coordinates"};
  const down=button==="right"?"0x0008":"0x0002",up=button==="right"?"0x0010":"0x0004";
  const code='using System;using System.Runtime.InteropServices;public static class M{[DllImport("user32.dll")]public static extern bool SetCursorPos(int X,int Y);[DllImport("user32.dll")]public static extern void mouse_event(uint f,uint dx,uint dy,uint data,UIntPtr e);}';
  return this.powershell("$sig='"+code+"';Add-Type $sig;[M]::SetCursorPos("+X+","+Y+");[M]::mouse_event("+down+",0,0,0,[UIntPtr]::Zero);[M]::mouse_event("+up+",0,0,0,[UIntPtr]::Zero)");
 }
 async typeText(text){
  const value=String(text),previous=clipboard.readText();
  try{
   clipboard.writeText(value);
   const r=await this.powershell('$ws=New-Object -ComObject WScript.Shell;$ws.SendKeys("^v")');
   return r;
  }finally{
   try{clipboard.writeText(previous)}catch{}
  }
 }
 async keyPress(key){
  const k=String(key).replace(/"/g,"").toUpperCase();
  const map={ENTER:"{ENTER}",ESC:"{ESC}",ESCAPE:"{ESC}",TAB:"{TAB}",BACKSPACE:"{BACKSPACE}",DELETE:"{DELETE}",DEL:"{DELETE}",SPACE:" ",UP:"{UP}",DOWN:"{DOWN}",LEFT:"{LEFT}",RIGHT:"{RIGHT}",HOME:"{HOME}",END:"{END}",PGUP:"{PGUP}",PGDN:"{PGDN}",CTRL:"^",ALT:"%",SHIFT:"+",WIN:"^{ESC}",F1:"{F1}",F2:"{F2}",F3:"{F3}",F4:"{F4}",F5:"{F5}",F6:"{F6}",F7:"{F7}",F8:"{F8}",F9:"{F9}",F10:"{F10}",F11:"{F11}",F12:"{F12}"};
  const seq=k.split("+").map(x=>map[x]||x).join("");
  return this.powershell('$ws=New-Object -ComObject WScript.Shell;$ws.SendKeys("'+seq.replace(/"/g,'""')+'")');
 }
 async activeWindow(){
  const code='using System;using System.Text;using System.Runtime.InteropServices;public static class W{[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();[DllImport("user32.dll")]public static extern int GetWindowText(IntPtr h,StringBuilder s,int n);[DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);}';
  const command="$sig='"+code+"';Add-Type $sig -ErrorAction Stop;$h=[W]::GetForegroundWindow();$s=New-Object Text.StringBuilder 1024;[W]::GetWindowText($h,$s,1024)|Out-Null;$p=0;[W]::GetWindowThreadProcessId($h,[ref]$p)|Out-Null;[pscustomobject]@{title=$s.ToString();pid=$p}|ConvertTo-Json -Compress";
  const r=await this.powershell(command);try{return{ok:true,window:JSON.parse(r.stdout)}}catch{return{ok:true,window:{raw:r.stdout}}}
 }
 async listWindows(){
  return this.taskCached("list_windows",()=>this.cached("windows",async()=>{
   try{
    const r=await run("tasklist.exe",["/V","/FO","CSV","/NH"],{windowsHide:true,maxBuffer:4*1024*1024});
    return this.parseTasklist(r.stdout,true);
   }catch(e){return{ok:false,error:e.message,windows:[]}}
  }));
 }
 parseTasklist(stdout,includeWindows=false){
  const processes=[],windows=[];
  for(const line of String(stdout||"").split(/\r?\n/).filter(Boolean)){
   const cols=[];const re=/"([^"]*)"/g;let m;while((m=re.exec(line)))cols.push(m[1]);
   if(cols.length>=5){
    const item={Id:Number(cols[1])||0,ProcessName:cols[0],WorkingSet:cols[4],CPU:null,Responding:null};
    processes.push(item);
    if(includeWindows&&cols.length>=9&&cols[8]&&cols[8]!=="N/A")windows.push({...item,MainWindowTitle:cols[8]});
   }
  }
  return{ok:true,processes:processes.slice(0,100),windows};
 }
 async windowsAndProcesses(){
  return this.taskCached("windows_and_processes",()=>this.cached("tasklist_all",async()=>{
   try{
    const r=await run("tasklist.exe",["/V","/FO","CSV","/NH"],{windowsHide:true,maxBuffer:8*1024*1024});
    return this.parseTasklist(r.stdout,true);
   }catch(e){return{ok:false,error:e.message,processes:[],windows:[]}}
  }));
 }
 async focusWindow(pid){
  const p=Math.round(Number(pid));if(!Number.isFinite(p))return{ok:false,error:"Invalid pid"};
  return this.powershell('$p=Get-Process -Id '+p+' -ErrorAction Stop;Add-Type -AssemblyName Microsoft.VisualBasic;[Microsoft.VisualBasic.Interaction]::AppActivate($p.Id)');
 }
 async processes(){
  return this.taskCached("process_list",()=>this.cached("processes",async()=>{
   try{
    const r=await run("tasklist.exe",["/FO","CSV","/NH"],{windowsHide:true,maxBuffer:8*1024*1024});
    return this.parseTasklist(r.stdout,false);
   }catch(e){return{ok:false,error:e.message,processes:[]}}
  }));
 }
 async diagnose(){
  const result={ok:true,timestamp:new Date().toISOString()};
  try{
   const info=await this.powershell('$os=Get-CimInstance Win32_OperatingSystem;$cpu=Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average;$disks=Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select DeviceID,Size,FreeSpace;$top=Get-Process | Sort-Object CPU -Descending | Select-Object -First 12 Id,ProcessName,CPU,WorkingSet,Responding;[pscustomobject]@{os=$os.Caption;version=$os.Version;lastBoot=$os.LastBootUpTime;cpuLoad=[math]::Round($cpu.Average,1);memoryTotal=$os.TotalVisibleMemorySize*1KB;memoryFree=$os.FreePhysicalMemory*1KB;disks=$disks;topProcesses=$top} | ConvertTo-Json -Depth 5 -Compress');
   return {ok:true,diagnostics:JSON.parse(info.stdout)};
  }catch(e){return{ok:false,error:e.message}};
 }
}
module.exports={Computer};
