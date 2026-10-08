function registerCharacterIpc({ipcMain,chooseCharacter,command,captureCharacter3DWindowSettings,writeCharacter3DSettings,getCharacterWindow,getPendingCharacter}){ipcMain.handle("character:choose",()=>{chooseCharacter();return true});ipcMain.handle("character:get-pending",()=>getPendingCharacter?.()||null);ipcMain.handle("character:controller:get",async()=>{
 let result=await command({action:"status"});
 let status=result?.status||result;
 if(!status?.characterLoaded){
  const started=Date.now();
  while(Date.now()-started<10000){
   result=await command({action:"status"});
   status=result?.status||result;
   if(status?.characterLoaded)break;
   await new Promise(resolve=>setTimeout(resolve,200));
  }
 }
 if(status?.characterLoaded&&!Object.keys(status?.autoRig||{}).length){
  await command({action:"autoMap"}).catch(()=>{});
  result=await command({action:"status"});
 }
 return result?.status||result;
});ipcMain.handle("character:controller:command",(_,payload={})=>command(payload));ipcMain.handle("character:3d:get",()=>captureCharacter3DWindowSettings());ipcMain.handle("character:3d:set",(_,patch={})=>{const current=captureCharacter3DWindowSettings(),saved=writeCharacter3DSettings({...current,...patch,window:{...current.window,...(patch.window||{})},camera:{...current.camera,...(patch.camera||{})},character:{...current.character,...(patch.character||{})},canvas:{...current.canvas,...(patch.canvas||{})}});const win=getCharacterWindow();if(win&&!win.isDestroyed()){win.setSize(Math.max(300,Math.min(1400,Math.round(Number(saved.window.width)||430))),Math.max(360,Math.min(1400,Math.round(Number(saved.window.height)||520))),false);win.webContents.send("character:3d-settings",saved)}return saved})}
module.exports={registerCharacterIpc};