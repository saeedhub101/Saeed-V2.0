const {execFile}=require("child_process"),{promisify}=require("util"),run=promisify(execFile),{clipboard}=require("electron"),path=require("path");

class Computer{
 async powershell(command){
  const r=await run("powershell.exe",["-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-Command",command],{windowsHide:true,maxBuffer:8*1024*1024});
  return {ok:true,stdout:r.stdout,stderr:r.stderr};
 }
 esc(s){return String(s).replace(/'/g,"''");}
 async openApp(app){
  const value=String(app||"").trim();
  if(!value)return{ok:false,error:"Application name is empty"};
  const aliases={"my computer":"Start-Process explorer.exe -ArgumentList 'shell:MyComputerFolder'","this pc":"Start-Process explorer.exe -ArgumentList 'shell:MyComputerFolder'","file explorer":"Start-Process explorer.exe","windows explorer":"Start-Process explorer.exe","explorer":"Start-Process explorer.exe","calculator":"Start-Process calc.exe","calc":"Start-Process calc.exe","notepad":"Start-Process notepad.exe","command prompt":"Start-Process cmd.exe","cmd":"Start-Process cmd.exe","powershell":"Start-Process powershell.exe","task manager":"Start-Process taskmgr.exe","control panel":"Start-Process control.exe","excel":"Start-Process excel.exe","microsoft excel":"Start-Process excel.exe","word":"Start-Process winword.exe","microsoft word":"Start-Process winword.exe","powerpoint":"Start-Process powerpnt.exe","microsoft powerpoint":"Start-Process powerpnt.exe","outlook":"Start-Process outlook.exe","microsoft outlook":"Start-Process outlook.exe"};
  const key=value.toLowerCase().replace(/\s+/g," ").trim();
  if(aliases[key])return this.powershell(aliases[key]);
  if(/^https?:\/\//i.test(value))return this.powershell("Start-Process -FilePath '"+this.esc(value)+"'");
  if(/^[A-Za-z]:\\|^[\\/]/.test(value))return this.powershell("Start-Process -FilePath '"+this.esc(value)+"'");
  const known=await this.powershell("$name='"+this.esc(value)+"';$cmd=Get-Command $name -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source;if(-not $cmd){$exe=[IO.Path]::GetFileName($name);$keys=@('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\'+$exe,'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\'+$exe,'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths\\'+$exe);foreach($k in $keys){if(Test-Path $k){$cmd=(Get-Item $k).GetValue('');if($cmd){break}}}};if($cmd){$cmd}");
  if(!known.stdout.trim())return{ok:false,error:"Application not found: "+value};
  return this.powershell("Start-Process -FilePath '"+this.esc(known.stdout.trim())+"'");
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
  const k=String(key||"").trim().toUpperCase();
  if(!k||k.length>64)return{ok:false,error:"Key sequence is empty or too long"};
  const map={ENTER:"{ENTER}",ESC:"{ESC}",ESCAPE:"{ESC}",TAB:"{TAB}",BACKSPACE:"{BACKSPACE}",DELETE:"{DELETE}",DEL:"{DELETE}",SPACE:" ",UP:"{UP}",DOWN:"{DOWN}",LEFT:"{LEFT}",RIGHT:"{RIGHT}",HOME:"{HOME}",END:"{END}",PGUP:"{PGUP}",PGDN:"{PGDN}",CTRL:"^",ALT:"%",SHIFT:"+",WIN:"^{ESC}",F1:"{F1}",F2:"{F2}",F3:"{F3}",F4:"{F4}",F5:"{F5}",F6:"{F6}",F7:"{F7}",F8:"{F8}",F9:"{F9}",F10:"{F10}",F11:"{F11}",F12:"{F12}",PLUS:"{+}"};
  const tokens=k.split("+");
  const invalid=tokens.find(token=>!Object.prototype.hasOwnProperty.call(map,token)&&!/^[A-Z0-9]$/.test(token));
  if(invalid)return{ok:false,error:"Unsupported key token: "+invalid};
  const seq=tokens.map(token=>Object.prototype.hasOwnProperty.call(map,token)?map[token]:token).join("");
  return this.powershell('$ws=New-Object -ComObject WScript.Shell;$ws.SendKeys("'+seq+'")');
 }
 async activeWindow(){
  const code='using System;using System.Text;using System.Runtime.InteropServices;public static class W{[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();[DllImport("user32.dll")]public static extern int GetWindowText(IntPtr h,StringBuilder s,int n);[DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);}';
  const command="$sig='"+code+"';Add-Type $sig -ErrorAction Stop;$h=[W]::GetForegroundWindow();$s=New-Object Text.StringBuilder 1024;[W]::GetWindowText($h,$s,1024)|Out-Null;$p=0;[W]::GetWindowThreadProcessId($h,[ref]$p)|Out-Null;[pscustomobject]@{title=$s.ToString();pid=$p}|ConvertTo-Json -Compress";
  const r=await this.powershell(command);try{return{ok:true,window:JSON.parse(r.stdout)}}catch{return{ok:true,window:{raw:r.stdout}}}
 }
 async listWindows(){
  const r=await this.powershell('Get-Process | Where-Object {$_.MainWindowHandle -ne 0} | Select-Object Id,ProcessName,MainWindowTitle,MainWindowHandle | ConvertTo-Json -Compress');
  try{return{ok:true,windows:JSON.parse(r.stdout)}}catch{return{ok:true,windows:[]}}
 }
 async focusWindow(pid){
  const p=Math.round(Number(pid));if(!Number.isFinite(p))return{ok:false,error:"Invalid pid"};
  return this.powershell('$p=Get-Process -Id '+p+' -ErrorAction Stop;Add-Type -AssemblyName Microsoft.VisualBasic;[Microsoft.VisualBasic.Interaction]::AppActivate($p.Id)');
 }
 async inspectWindowControls(pid=null,limit=150,windowTitle=""){
  const targetPid=pid==null?0:Math.round(Number(pid)),max=Math.max(1,Math.min(500,Math.round(Number(limit)||150)));
  if(!Number.isFinite(targetPid)||targetPid<0)return{ok:false,error:"Invalid target process id"};
  const script=path.join(__dirname,"windows-ui-automation.ps1");
  const command="& '"+this.esc(script)+"' -Mode Inspect -TargetPid "+targetPid+" -TargetWindowTitle '"+this.esc(windowTitle)+"' -Limit "+max;
  try{const result=await this.powershell(command);const data=JSON.parse(result.stdout||"{}");return data&&typeof data==="object"?data:{ok:false,error:"UI Automation returned an invalid response"}}catch(error){return{ok:false,error:String(error?.message||error).slice(0,400)}}
 }
 async interactUiElement({pid=null,windowTitle="",elementIndex,action,value="",expectedName="",automationId="",controlType="",expectedBounds=null}={}){
  const targetPid=pid==null?0:Math.round(Number(pid)),rawIndex=Number(elementIndex),index=Math.round(rawIndex);
  const allowed=new Set(["invoke","set_value","select","toggle","focus","expand","collapse"]);
  if(!Number.isFinite(targetPid)||targetPid<0||!Number.isInteger(rawIndex)||index<0||!allowed.has(String(action||"")))return{ok:false,error:"Invalid UI Automation target or action"};
  if(action==="set_value"&&value==null)return{ok:false,error:"A value is required for set_value"};
  const script=path.join(__dirname,"windows-ui-automation.ps1");
  const quote=v=>"'"+this.esc(v)+"'";
  let boundsArgs=" -CheckBounds $false";
  if(expectedBounds&&typeof expectedBounds==="object"){
   const coordinates=[expectedBounds.x,expectedBounds.y,expectedBounds.width,expectedBounds.height].map(Number);
   if(coordinates.some(value=>!Number.isFinite(value))||coordinates[2]<0||coordinates[3]<0)return{ok:false,error:"Invalid expected control bounds"};
   boundsArgs=" -CheckBounds $true -ExpectedX "+coordinates[0]+" -ExpectedY "+coordinates[1]+" -ExpectedWidth "+coordinates[2]+" -ExpectedHeight "+coordinates[3];
  }
  const command="& "+quote(script)+" -Mode Act -TargetPid "+targetPid+" -TargetWindowTitle "+quote(windowTitle)+" -ElementIndex "+index+" -Action "+quote(action)+" -Value "+quote(value)+" -ExpectedName "+quote(expectedName)+" -AutomationId "+quote(automationId)+" -ControlType "+quote(controlType)+boundsArgs;
  try{const result=await this.powershell(command);const data=JSON.parse(result.stdout||"{}");return data&&typeof data==="object"?data:{ok:false,error:"UI Automation returned an invalid response"}}catch(error){return{ok:false,error:String(error?.message||error).slice(0,400)}}
 }
 async processes(){
  const r=await this.powershell('Get-Process | Sort-Object CPU -Descending | Select-Object -First 100 Id,ProcessName,CPU,WorkingSet,Responding | ConvertTo-Json -Compress');
  try{return{ok:true,processes:JSON.parse(r.stdout)}}catch{return{ok:true,processes:[]}}
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
