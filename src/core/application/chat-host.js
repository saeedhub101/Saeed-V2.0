function createChatHost({BrowserWindow,path,Menu,windowsIconPath,diagnostic,ensureBrain,onClose}){
 let chatWin=null;
 let closing=false;
 async function showChat(){try{if(!chatWin||chatWin.isDestroyed())await createChatWindow();if(!chatWin||chatWin.isDestroyed())return;chatWin.setIgnoreMouseEvents(false);if(chatWin.isMinimized())chatWin.restore();chatWin.show();chatWin.focus();chatWin.webContents.send("chat:show")}catch(e){diagnostic("ERROR","CHAT WINDOW",e.message)}}
 async function closeChat(){
  if(closing)return;
  closing=true;
  const win=chatWin;
  chatWin=null;
  try{if(win&&!win.isDestroyed()){try{await win.webContents.executeJavaScript('window.speechSynthesis?.cancel?.();void 0',true)}catch{};win.destroy()}}finally{closing=false;await onClose?.()}
 }
 function setMousePassthrough(ignore){if(chatWin&&!chatWin.isDestroyed())chatWin.setIgnoreMouseEvents(Boolean(ignore),{forward:true});}
 function minimize(){if(chatWin&&!chatWin.isDestroyed())chatWin.minimize();}
 function moveBy(dx,dy){if(!chatWin||chatWin.isDestroyed())return;const [x,y]=chatWin.getPosition();chatWin.setPosition(x+Number(dx||0),y+Number(dy||0));}
 async function createChatWindow(){if(chatWin&&!chatWin.isDestroyed())return chatWin;chatWin=new BrowserWindow({name:"saeed-chat",width:820,height:620,minWidth:560,minHeight:400,frame:false,transparent:true,alwaysOnTop:false,show:false,hasShadow:false,resizable:true,skipTaskbar:false,icon:windowsIconPath(),webPreferences:{preload:path.join(__dirname,"..","..","preload.js"),contextIsolation:true,nodeIntegration:false,sandbox:false}});const win=chatWin;win.setIcon(windowsIconPath());if(process.platform==="win32")win.setAppDetails({appId:"ai.saeed.desktop",appIconPath:windowsIconPath(),appIconIndex:0,relaunchCommand:process.execPath,relaunchDisplayName:"Saeed AI Chat"});win.on("closed",async()=>{if(chatWin===win)chatWin=null;await onClose?.()});win.webContents.on("context-menu",(event,params)=>{event.preventDefault();const items=params.isEditable?[{role:"undo"},{role:"redo"},{role:"cut"},{role:"copy"},{role:"paste"},{role:"selectAll"}]:params.selectionText?[{role:"copy"},{role:"selectAll"}]:[{role:"selectAll"}];Menu.buildFromTemplate(items).popup({window:win})});await win.loadFile(path.join(__dirname,"..","..","index.html"));return win}
 return{createChatWindow,closeChat,showChat,getChatWindow:()=>chatWin,setMousePassthrough,minimize,moveBy};
}
module.exports={createChatHost};