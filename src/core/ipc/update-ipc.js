function registerUpdateIpc(deps){const {ipcMain}=deps;ipcMain.handle("update:check",async()=>{if(!app.isPackaged)return {ok:false,state:"unavailable",message:"Updates are available only in the installed Windows build."};try{updateUiRequested=true;updateState="checking";showUpdateToast("checking","Checking for updates…");voiceBroadcast("update:state","checking");const result=await getAutoUpdater().checkForUpdates();return {ok:true,state:updateState,version:result?.updateInfo?.version||null}}catch(e){updateState="error";showUpdateToast("error","Update check failed");chatWin?.webContents.send("update:state","error",e.message);setTimeout(()=>{updateUiRequested=false;hideUpdateToast();voiceBroadcast("update:state","idle")},3200);return {ok:false,state:"error",message:e.message}}});
ipcMain.handle("update:download",async()=>{if(updateState!=="available")return false;try{showUpdateStatus();updateState="downloading";publishUpdate("update:state","downloading");await getAutoUpdater().downloadUpdate();return true}catch(e){updateState="error";publishUpdate("update:state","error",e.message);return false}});
ipcMain.handle("update:install",()=>{if(updateState!=="downloaded")return false;getAutoUpdater().quitAndInstall(false,true);return true});
ipcMain.handle("update:show-status",()=>showUpdateStatus());
ipcMain.handle("update:toast-close",()=>{updateUiRequested=false;hideUpdateToast();return true});
ipcMain.handle("update:snapshot",()=>({state:updateState,info:updateInfo,currentVersion:app.getVersion()}));
ipcMain.handle("update:state",()=>updateState);

}
module.exports={registerUpdateIpc};
