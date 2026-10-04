function registerHistoryIpc(deps){const {ipcMain}=deps;ipcMain.handle("history:get",()=>agent?.history||[]);
ipcMain.handle("chat:list",()=>agent?.listConversations?.()||[]);
ipcMain.handle("chat:current",()=>agent?.getCurrentConversation?.()||null);
ipcMain.handle("chat:memory",()=>agent?.getGlobalMemory?.()||[]);
ipcMain.handle("chat:new",()=>{if(!agent)return null;const chat=agent.newConversation();chatWin?.webContents.send("chat:switched",chat,[]);return {chat,history:[]};});
ipcMain.handle("chat:select",(_,id)=>{if(!agent)return null;const chat=agent.selectConversation(String(id||""));if(!chat)return null;const history=agent.history||[];chatWin?.webContents.send("chat:switched",chat,history);return {chat,history};});
ipcMain.handle("history:clear",()=>{if(!agent)return false;agent.clearHistory();chatWin?.webContents.send("history:cleared");return true});
ipcMain.handle("agent:confirm-response",(_,id,approved)=>{
 const resolve=confirmations.get(id);if(!resolve)return false;
 confirmations.delete(id);resolve(Boolean(approved));return true;
});
}
module.exports={registerHistoryIpc};
