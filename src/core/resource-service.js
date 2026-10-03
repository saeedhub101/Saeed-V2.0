const os=require("os");
function createResourceService(deps={}){
 const app=deps.app, BrowserWindow=deps.BrowserWindow, processRef=deps.process||process;
 const samples=[];let timer=null;
 function getAppResourceMetrics(){const rawMetrics=app.getAppMetrics();return {rawMetrics,logical:Math.max(1,os.cpus().length)}}
 function resourceSnapshot(label="sample"){
  const usage=processRef.memoryUsage(),cpu=processRef.cpuUsage();
  const rss=Math.round(usage.rss/1048576),heapUsed=Math.round(usage.heapUsed/1048576),external=Math.round(usage.external/1048576);
  const windows=BrowserWindow.getAllWindows().map(w=>({title:w.getTitle(),url:w.webContents.getURL(),processId:w.webContents.getOSProcessId(),destroyed:w.isDestroyed()}));
  const windowByPid=new Map(windows.map(w=>[Number(w.processId),String(w.title||"")]));const {rawMetrics,logical}=getAppResourceMetrics();
  const metrics=rawMetrics.map(m=>{const type=String(m.type||""),pid=Number(m.pid||0);let name=String(m.name||"").trim();if(!name)name=pid===processRef.pid?"Saeed Main Process":windowByPid.get(pid)||({GPU:"GPU Process",Renderer:"Saeed Renderer",Browser:"Saeed Browser",Utility:"Saeed Utility"}[type]||`${type||"Saeed"} Process`);return{pid,type,name,serviceName:m.serviceName||"",cpuPercent:+(m.cpu?.percentCPUUsage||0).toFixed(2),cpuTotalSec:+(m.cpu?.cumulativeCPUUsage||0).toFixed(3),workingSetMB:+((m.memory?.workingSetSize||0)/1024).toFixed(1),privateMB:+((m.memory?.privateBytes||0)/1024).toFixed(1)}});
  const totalCpuRaw=rawMetrics.reduce((sum,m)=>sum+Number(m?.cpu?.percentCPUUsage||0),0),totalWorkingSetMB=rawMetrics.reduce((sum,m)=>sum+Number(m?.memory?.workingSetSize||0),0)/1024,totalPrivateMB=rawMetrics.reduce((sum,m)=>sum+Number(m?.memory?.privateBytes||0),0)/1024;
  const sample={time:new Date().toISOString(),label,pid:processRef.pid,cpuUserMs:Math.round(cpu.user/1000),cpuSystemMs:Math.round(cpu.system/1000),rssMB:rss,heapUsedMB:heapUsed,heapTotalMB:Math.round(usage.heapTotal/1048576),externalMB:external,platform:processRef.platform,logicalProcessors:logical,saeedTotal:{cpuPercent:+(totalCpuRaw/logical).toFixed(2),cpuPercentRaw:+totalCpuRaw.toFixed(2),workingSetMB:+totalWorkingSetMB.toFixed(1),privateMB:+totalPrivateMB.toFixed(1),processCount:rawMetrics.length},windows,processes:metrics};
  samples.push(sample);if(samples.length>120)samples.shift();return sample;
 }
 function startResourceProbe(){if(timer)return;resourceSnapshot("startup");timer=setInterval(()=>resourceSnapshot("interval"),1000);timer.unref?.()}
 function stopResourceProbe(){if(timer){clearInterval(timer);timer=null}}
 function resourceReport(){return{process:resourceSnapshot("report"),samples:[...samples]}}
 return {getAppResourceMetrics,resourceSnapshot,startResourceProbe,stopResourceProbe,resourceReport};
}
module.exports={createResourceService};