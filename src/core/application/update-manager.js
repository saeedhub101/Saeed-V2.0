function createUpdateManager({app,getAutoUpdater,voiceBroadcast,diagnostic}){
 let state="idle",info=null;const listeners=new Set();
 function publish(...args){voiceBroadcast?.("update:state",state,...args);for(const fn of listeners)try{fn(state,info,...args)}catch{}}
 function setState(next,nextInfo=null){state=String(next||"idle");if(nextInfo)info=nextInfo;publish()}
 async function check(){if(!app.isPackaged){setState("unavailable");return{ok:false,state:"unavailable",message:"Updates are available only in the installed Windows build."};}try{setState("checking","Checking for updates…");const r=await getAutoUpdater().checkForUpdates();info=r?.updateInfo||info;const availableVersion=info?.version||null;const current=app.getVersion();if(!availableVersion||String(availableVersion)===String(current)){setState("latest","Saeed is up to date.");}return{ok:true,state:getState(),version:availableVersion,currentVersion:current}}catch(e){setState("error",e.message);diagnostic?.("ERROR","UPDATE",e.message);return{ok:false,state,message:e.message}}}
 async function download(){if(state!=="available")return false;try{setState("downloading");await getAutoUpdater().downloadUpdate();return true}catch(e){setState("error");diagnostic?.("ERROR","UPDATE DOWNLOAD",e.message);return false}}
 function install(){if(state!=="downloaded")return false;getAutoUpdater().quitAndInstall(false,true);return true}
 function bind(){const u=getAutoUpdater();u.on("update-available",i=>{info=i;setState("available")});u.on("update-not-available",i=>{info=i;setState("latest","Saeed is up to date.")});u.on("download-progress",p=>{voiceBroadcast?.("update:progress",p);voiceBroadcast?.("update:state","downloading","Downloading the update…")});u.on("update-downloaded",i=>{info=i;setState("downloaded","Update downloaded and ready to install.")});u.on("error",e=>{setState("error");diagnostic?.("ERROR","UPDATE",e?.message||String(e))})}
 function snapshot(){return{state,info,currentVersion:app.getVersion()}}
 return{check,download,install,setState,snapshot,onChange:fn=>(listeners.add(fn),()=>listeners.delete(fn)),getState:()=>state,bind};
}
module.exports={createUpdateManager};