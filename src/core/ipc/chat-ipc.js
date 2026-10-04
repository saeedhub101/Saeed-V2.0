function registerChatIpc({ipcMain,ensureBrain,getAgent,getCharacterWindow,getChatHost}){
 ipcMain.handle("chat",async(_,payload)=>{await ensureBrain();const data=typeof payload==="string"?{text:payload}:payload||{};const win=getCharacterWindow();if(win&&!win.isDestroyed())win.webContents.send("character:behavior",{type:"user-input",text:String(data.text||"")});const result=await getAgent().run(String(data.text||""),data.image||null);const out=getCharacterWindow();if(out&&!out.isDestroyed())out.webContents.send("character:behavior",{type:"answer",text:result});return result});
 ipcMain.on("window:show-chat",()=>void getChatHost()?.showChat());
 ipcMain.on("window:close-chat",()=>void getChatHost()?.closeChat());
 ipcMain.on("chat:mouse-passthrough",(_,ignore)=>getChatHost()?.setMousePassthrough(Boolean(ignore)));
 ipcMain.handle("chat:minimize",()=>{getChatHost()?.minimize();return true});
 ipcMain.on("chat:move-by",(_,dx,dy)=>getChatHost()?.moveBy(dx,dy));
}
module.exports={registerChatIpc};