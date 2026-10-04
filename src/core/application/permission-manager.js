const DEFAULT_PERMISSIONS={files:"allow",applications:"allow",system:"allow",network:"allow",screen:"allow",mouseKeyboard:"allow",microphone:"allow",tasksMemory:"allow",credentials:"allow",destructive:"allow",execution:"allow"};
const LABELS={files:"file access",applications:"application control",system:"system access",network:"network access",screen:"screen capture",mouseKeyboard:"mouse and keyboard control",microphone:"microphone access",tasksMemory:"tasks and memory",credentials:"credentials and secrets",destructive:"destructive actions",execution:"execution limit"};
function createPermissionManager({getAgent,showChat,getChatWindow,diagnostic}){
 const confirmations=new Map();
 function permissionPolicy(category){return getAgent()?.settings?.permissions?.[category]||DEFAULT_PERMISSIONS[category]||"allow";}
 async function confirmPermission(category,request={}){
  if(permissionPolicy(category)==="deny")return false;
  await showChat();
  const id=Date.now().toString(36)+Math.random().toString(36).slice(2,7);
  return new Promise(resolve=>{
   const timer=setTimeout(()=>{if(!confirmations.has(id))return;confirmations.delete(id);resolve(false);diagnostic?.("INFO","AGENT CONFIRMATION","Confirmation timed out; operation denied",{id,name:request.name||category});},120000);
   confirmations.set(id,approved=>{clearTimeout(timer);resolve(Boolean(approved));});
   getChatWindow()?.webContents.send("agent:confirm",{id,name:request.name||category,args:request.args||{},permissionCategory:category,permissionLabel:LABELS[category]||category});
  });
 }
 function resolve(id,approved){const fn=confirmations.get(String(id));if(!fn)return false;confirmations.delete(String(id));fn(Boolean(approved));return true;}
 return {permissionPolicy,confirmPermission,confirmations,resolve};
}
module.exports={createPermissionManager};