function createUpdateManager({app,getAutoUpdater,voiceBroadcast,diagnostic}){
 let state="idle",info=null;const listeners=new Set();
 function publish(...args){voiceBroadcast?.("update:state",state,...args);for(const fn of listeners)try{fn(state,info,...args)}catch{}}
 function setState(next,nextInfo=null){state=String(next||"idle");if(nextInfo)info=nextInfo;publish()}
 async function check(){if(!app.isPackaged)return{ok:false,state:"unavailable",message:"Updates are available only in the installed Windows build."};try{setState("checking");const r=await getAutoUpdater().checkForUpdates();info=r?.updateInfo||null;return{ok:true,state,version:info?.version||null}}catch(e){setState("error");diagnostic?.("ERROR","UPDATE",e.message);return{ok:false,state,message:e.message}}}
 async function download(){if(state!=="available")return false;try{setState("downloading");await getAutoUpdater().downloadUpdate();return true}catch(e){setState("error");diagnostic?.("ERROR","UPDATE DOWNLOAD",e.message);return false}}
 function install(){if(state!=="downloaded")return false;getAutoUpdater().quitAndInstall(false,true);return true}
 function bind(){const u=getAutoUpdater();u.on("update-available",i=>{info=i;setState("available")});u.on("update-not-available",i=>{info=i;setState("idle")});u.on("download-progress",p=>{voiceBroadcast?.("update:progress",p)});u.on("update-downloaded",i=>{info=i;setState("downloaded")});u.on("error",e=>{setState("error");diagnostic?.("ERROR","UPDATE",e?.message||String(e))})}
 function snapshot(){return{state,info,currentVersion:app.getVersion()}}
 return{check,download,install,setState,snapshot,onChange:fn=>(listeners.add(fn),()=>listeners.delete(fn)),getState:()=>state,bind};
}
module.exports={createUpdateManager};