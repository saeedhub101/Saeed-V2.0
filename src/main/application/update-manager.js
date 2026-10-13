"use strict";
function createUpdateManager({app,getAutoUpdater,voiceBroadcast,diagnostic,getSettings=()=>({})}){
 let state="idle",info=null,message="",boundUpdater=null,checking=null,downloadPromise=null;
 const listeners=new Set();
 function publish(...args){voiceBroadcast?.("update:state",state,...args);for(const fn of listeners)try{fn(state,info,...args)}catch{}}
 function setState(next,nextInfo=null){state=String(next||"idle");if(nextInfo&&typeof nextInfo==="object")info=nextInfo;else if(typeof nextInfo==="string")message=nextInfo;publish(message)}
 function snapshot(){return{state,info,message,currentVersion:app.getVersion()}}
 function reportError(stage,error){const message=error?.message||String(error);diagnostic?.("ERROR",stage,message);return message}
 function maybeAutomaticDownload(){if(getSettings()?.updateMode==="automatic"&&state==="available")void download()}
 async function check(){
  if(!app.isPackaged){setState("unavailable","Updates are available only in the installed Windows build.");return{ok:false,...snapshot(),message:"Updates are available only in the installed Windows build."}}
  if(checking)return checking;
  checking=(async()=>{
   setState("checking","Checking for updates…");
   try{
    const result=await getAutoUpdater().checkForUpdates();
    if(result?.updateInfo)info=result.updateInfo;
    const version=info?.version||null,current=app.getVersion();
    if(state==="checking"){
     if(!version||String(version)===String(current))setState("latest","Saeed is up to date.");
     else {setState("available",`Saeed ${version} is available.`);maybeAutomaticDownload()}
    }
    return{ok:true,...snapshot(),version,currentVersion:current}
   }catch(error){
    const message=reportError("UPDATE",error);setState("error",message);
    return{ok:false,...snapshot(),message}
   }finally{checking=null}
  })();
  return checking;
 }
 async function download(){
  if(state==="downloading"&&downloadPromise)return downloadPromise;
  if(state!=="available")return false;
  setState("downloading","Downloading the update…");
  downloadPromise=(async()=>{
   try{await getAutoUpdater().downloadUpdate();return true}
   catch(error){const message=reportError("UPDATE DOWNLOAD",error);setState("error",message);return false}
   finally{downloadPromise=null}
  })();
  return downloadPromise;
 }
 function install(){if(state!=="downloaded")return false;try{getAutoUpdater().quitAndInstall(false,true);return true}catch(error){reportError("UPDATE INSTALL",error);setState("error","Update installation could not be started.");return false}}
 function bind(){
  const updater=getAutoUpdater();
  if(boundUpdater===updater)return false;
  if(boundUpdater&&typeof boundUpdater.removeListener==="function"){
   for(const [event,handler] of boundHandlers)boundUpdater.removeListener(event,handler);
  }
  boundUpdater=updater;boundHandlers=[];
  try{updater.autoDownload=false;updater.autoInstallOnAppQuit=false}catch{}
  const on=(event,handler)=>{updater.on(event,handler);boundHandlers.push([event,handler])};
  on("update-available",update=>{info=update||info;setState("available",info?.version?`Saeed ${info.version} is available.`:"An update is available.");maybeAutomaticDownload()});
  on("update-not-available",update=>{info=update||info;setState("latest","Saeed is up to date.")});
  on("download-progress",progress=>{voiceBroadcast?.("update:progress",progress);voiceBroadcast?.("update:state","downloading","Downloading the update…")});
  on("update-downloaded",update=>{info=update||info;setState("downloaded","Update downloaded and ready to install.")});
  on("error",error=>{const message=reportError("UPDATE",error);setState("error",message)});
  return true;
 }
 let boundHandlers=[];
 return{check,download,install,setState,snapshot,onChange:fn=>(listeners.add(fn),()=>listeners.delete(fn)),getState:()=>state,bind};
}
module.exports={createUpdateManager};
