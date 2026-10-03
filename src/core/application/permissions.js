const DEFAULT_PERMISSIONS={"files":"allow","applications":"allow","system":"allow","network":"allow","screen":"allow","mouseKeyboard":"allow","microphone":"allow","tasksMemory":"allow","credentials":"allow","destructive":"allow"};
function createPermissions({session,getAgent,showChat,getChatWindow,diagnostic}){
 function permissionPolicy(category){const p=getAgent()?.settings?.permissions||DEFAULT_PERMISSIONS;return p[category]||"allow"}
 const confirmations=new Map();
 function configureMediaPermissions(){
  try{
   session.defaultSession.setPermissionCheckHandler((webContents,permission,origin,details)=>permission==="media");
   session.defaultSession.setPermissionRequestHandler((webContents,permission,callback,details)=>{
    if(permission==="media"){diagnostic("INFO","MIC PERMISSION","Electron granted media permission",details||{});callback(true);return;}
    callback(false);
   });
   diagnostic("INFO","MIC PERMISSION","Electron microphone/media permission handlers configured");
  }catch(e){diagnostic("ERROR","MIC PERMISSION",e.message)}
 }
 async function confirmPermission(category,request){
  const label={files:"file access",applications:"application control",system:"system access",network:"network access",screen:"screen capture",mouseKeyboard:"mouse and keyboard control",microphone:"microphone access",tasksMemory:"tasks and memory",credentials:"credentials and secrets",destructive:"destructive actions"}[category]||category;
  await showChat();
  const chatWin=getChatWindow();
  return new Promise(resolve=>{const id=Date.now().toString(36)+Math.random().toString(36).slice(2,7);const timer=setTimeout(()=>{if(!confirmations.has(id))return;confirmations.delete(id);resolve(false);diagnostic("INFO","AGENT CONFIRMATION","Confirmation timed out; operation denied",{id,name:request?.name||category});},120000);confirmations.set(id,approved=>{clearTimeout(timer);resolve(Boolean(approved))});chatWin?.webContents.send("agent:confirm",{id,name:request?.name||category,args:request?.args||{},permissionCategory:category,permissionLabel:label});});
 }
 function resolveConfirmation(id,approved){const resolve=confirmations.get(id);if(!resolve)return false;confirmations.delete(id);resolve(Boolean(approved));return true}
 return {DEFAULT_PERMISSIONS,permissionPolicy,configureMediaPermissions,confirmPermission,resolveConfirmation};
}
module.exports={createPermissions,DEFAULT_PERMISSIONS};
