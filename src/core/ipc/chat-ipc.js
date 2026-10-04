function registerChatIpc(deps){const {ipcMain}=deps;ipcMain.handle("chat",async(_,payload)=>{
 await ensureBrain();
 const data=typeof payload==="string"?{text:payload}:payload||{};brainSupervisor?.markActivity?.();if(characterWin&&!characterWin.isDestroyed())characterWin.webContents.send("character:behavior",{type:"user-input",text:String(data.text||"")});
 const result=await agent.run(String(data.text||""),data.image||null);
 if(characterWin&&!characterWin.isDestroyed())characterWin.webContents.send("character:behavior","answer");
 return result;
});
}
module.exports={registerChatIpc};
