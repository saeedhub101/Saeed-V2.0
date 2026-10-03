function createChatHost({BrowserWindow,path,Menu,windowsIconPath,diagnostic,showChat,ensureBrain,getCharacterWindow}){
 async function createChatWindow(){
  if(chatWin&&!chatWin.isDestroyed())return chatWin;
  chatWin=new BrowserWindow({name:"saeed-chat",width:820,height:620,minWidth:560,minHeight:400,frame:false,transparent:true,alwaysOnTop:false,show:false,hasShadow:false,resizable:true,skipTaskbar:false,icon:windowsIconPath(),webPreferences:{preload:path.join(__dirname,"..","preload.js"),contextIsolation:true,nodeIntegration:false,sandbox:false}});
  chatWin.setIcon(windowsIconPath());
  if(process.platform==="win32")chatWin.setAppDetails({appId:"ai.saeed.desktop",appIconPath:windowsIconPath(),appIconIndex:0,relaunchCommand:process.execPath,relaunchDisplayName:"Saeed AI Chat"});
  chatWin.on("closed",()=>{chatWin=null});
  chatWin.webContents.on("context-menu",(event,params)=>{event.preventDefault();const items=[];if(params.isEditable){items.push({role:"undo"},{role:"redo"},{role:"cut"},{role:"copy"},{role:"paste"},{role:"selectAll"});}else if(params.selectionText){items.push({role:"copy"},{role:"selectAll"});}else{items.push({role:"selectAll"});}Menu.buildFromTemplate(items).popup({window:chatWin});});
  chatWin.setIgnoreMouseEvents(false);
  await chatWin.loadFile(path.join(__dirname,"..","index.html"));
  return chatWin;
 }
 
 return {createChatWindow,closeChat,showChat};
}
module.exports={createChatHost};
