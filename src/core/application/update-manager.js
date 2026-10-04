function createUpdateManager({app,getAutoUpdater,voiceBroadcast,diagnostic}){
 let state="idle",info=null;
 const listeners=new Set();
 function publish(kind,...args){voiceBroadcast?.(kind,...args);for(const fn of listeners)try{fn(state,info,...args)}catch{}}
 function onChange(fn){listeners.add(fn);return()=>listeners.delete(fn);}
 async function check(){
  if(!app.isPackaged)return{ok:false,state:"unavailable",message:"Updates are available only in the installed Windows build."};
  try{state="checking";publish("update:state","checking");const r=await getAutoUpdater().checkForUpdates();info=r?.updateInfo||null;return{ok:true,state,version:info?.version||null}}
  catch(e){state="error";diagnostic?.("ERROR","UPDATE",e.message);publish("update:state","error",e.message);return{ok:false,state,message:e.message}}
 }
 async function download(){if(state!=="available")return false;try{state="downloading";publish("update:state","downloading");await getAutoUpdater().downloadUpdate();return true}catch(e){state="error";publish("update:state","error",e.message);return false}}
 function install(){if(state!=="downloaded")return false;getAutoUpdater().quitAndInstall(false,true);return true}
 function setState(next,nextInfo=null){state=String(next||"idle");if(nextInfo)info=nextInfo;publish("update:state",state)}
 function snapshot(){return{state,info,currentVersion:app.getVersion()}}
 return{check,download,install,setState,snapshot,onChange,getState:()=>state};
}
module.exports={createUpdateManager};