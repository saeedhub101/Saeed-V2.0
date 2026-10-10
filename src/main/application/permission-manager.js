const DEFAULT_PERMISSIONS={files:"ask",applications:"ask",system:"allow",network:"ask",screen:"ask",mouseKeyboard:"ask",microphone:"ask",tasksMemory:"ask",credentials:"ask",destructive:"ask",execution:"ask",mcp:"ask",addons:"ask"};
const LABELS={files:"file access",applications:"application control",system:"system access",network:"network access",screen:"screen capture",mouseKeyboard:"mouse and keyboard control",microphone:"microphone access",tasksMemory:"tasks and memory",credentials:"credentials and secrets",destructive:"destructive actions",execution:"execution limit",mcp:"external MCP tools",addons:"add-on capabilities"};
function createPermissionManager({getAgent,showChat,getChatWindow,diagnostic}){
 const confirmations=new Map();
 function permissionPolicy(category){const configured=getAgent()?.settings?.permissions?.[category];if(configured==="allow"||configured==="deny"||configured==="ask")return configured;return DEFAULT_PERMISSIONS[category]||"ask";}
 async function confirmPermission(category,request={}){
  const signal=request.signal;if(signal?.aborted)return false;
  if(permissionPolicy(category)==="deny")return false;
  try{await showChat()}catch(error){diagnostic?.("ERROR","AGENT CONFIRMATION","Could not open confirmation surface; operation denied",{category,error:String(error?.message||error)});return false}
  if(signal?.aborted)return false;
  const chatWindow=getChatWindow?.();
  if(!chatWindow||chatWindow.isDestroyed?.()||!chatWindow.webContents||chatWindow.webContents.isDestroyed?.()){diagnostic?.("WARN","AGENT CONFIRMATION","No live confirmation surface; operation denied",{category,name:request.name||category});return false}
  const id=Date.now().toString(36)+Math.random().toString(36).slice(2,7);
  return new Promise(resolve=>{
   let settled=false;
   const settle=approved=>{if(settled)return;settled=true;clearTimeout(timer);confirmations.delete(id);signal?.removeEventListener?.("abort",abort);resolve(Boolean(approved))};
   const abort=()=>{settle(false);diagnostic?.("INFO","AGENT CONFIRMATION","Confirmation cancelled with its originating request; operation denied",{id,name:request.name||category})};
   const timer=setTimeout(()=>{if(!confirmations.has(id))return;settle(false);diagnostic?.("INFO","AGENT CONFIRMATION","Confirmation timed out; operation denied",{id,name:request.name||category});},120000);
   confirmations.set(id,settle);
   signal?.addEventListener?.("abort",abort,{once:true});
   if(signal?.aborted){abort();return}
   try{chatWindow.webContents.send("agent:confirm",{id,name:request.name||category,args:request.args||{},permissionCategory:category,permissionLabel:LABELS[category]||category})}catch(error){settle(false);diagnostic?.("ERROR","AGENT CONFIRMATION","Confirmation could not be delivered; operation denied",{id,category,error:String(error?.message||error)})}
  });
 }
 function resolve(id,approved){const fn=confirmations.get(String(id));if(!fn)return false;confirmations.delete(String(id));fn(Boolean(approved));return true;}
 return {permissionPolicy,confirmPermission,confirmations,resolve};
}
module.exports={createPermissionManager};
