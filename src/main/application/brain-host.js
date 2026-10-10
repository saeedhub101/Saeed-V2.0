function createBrainHost({app,dialog,getMicMode,isChatSurfaceOpen,characterCommand,permissionPolicy,diagnostic,diagnosticFromAgent,voiceBroadcast,captureScreen,setAgent,setVoiceMuted,recordLearningStep}){
 let brainInitPromise=null,agent=null,registry=null,idleTimer=null,lastActivity=0,activeRequests=0,emergencyStopped=false;
 const labels={files:"Files",applications:"Applications",system:"System information",network:"Network & web",screen:"Screen capture",mouseKeyboard:"Mouse & keyboard control",microphone:"Microphone & voice",tasksMemory:"Tasks & memory",credentials:"Credentials & secrets",destructive:"Destructive actions",mcp:"External MCP tool",addons:"Add-on capability"};
 const confirm=async({name,args,permissionCategory})=>{
  const label=labels[permissionCategory]||permissionCategory||"Permission";
  if(dialog?.showMessageBox){
   let detail=String(args?.path||args?.command||args?.url||"").trim();
   if(name.startsWith("email_")){const provider=String(args?.provider||"").trim(),account=String(args?.account||"").trim(),mailbox=String(args?.mailbox||"INBOX").trim();detail="Provider: "+(provider||"not specified")+"\nAccount: "+(account||"not specified")+"\nAction: "+name;if(name.startsWith("email_imap_"))detail+="\nMailbox: "+mailbox;if(name==="email_imap_fetch"&&args?.sequence)detail+="\nMessage sequence: "+String(args.sequence);if(name==="email_send"){const to=[].concat(args?.to||[]).map(x=>String(x)).join(", "),subject=String(args?.subject||"(no subject)"),body=String(args?.body||"");detail+="\nTo: "+to+"\nSubject: "+subject+"\n\n"+body.slice(0,2500)+(body.length>2500?"\n… (message preview truncated)":"")}}
   const message=name==="email_send"?"Confirm sending this email?":name.startsWith("email_imap_")?"Confirm access to this mailbox?":"Allow Saeed to perform this action?";
   const result=await dialog.showMessageBox({type:"question",buttons:["Allow","Deny"],defaultId:name==="email_send"?1:0,cancelId:1,title:"Saeed Permission",message,detail:label+(detail?"\n"+detail:"")});
   return result.response===0;
  }
  diagnostic("WARN","PERMISSION","No native confirmation dialog is available; operation denied",{name,permissionCategory});
  return false;
 };
 const requestStepIncrease=async({current,requested,task})=>{
  if(dialog?.showMessageBox){
   const result=await dialog.showMessageBox({type:"question",buttons:["Allow","Deny"],defaultId:0,cancelId:1,title:"Saeed Execution Limit",message:"Allow Saeed to continue with more steps?",detail:"Current limit: "+current+"\nRequested: "+requested+"\n"+String(task||"")});
   return result.response===0;
  }
  diagnostic("WARN","EXECUTION LIMIT","No native confirmation dialog is available; additional steps denied",{current,requested});
  return false;
 };
 const IDLE_TIMEOUT_MS=2*60*1000;
 function scheduleIdleRelease(){clearTimeout(idleTimer);if(!agent||IDLE_TIMEOUT_MS<=0)return;if(getMicMode?.()==="on")return;idleTimer=setTimeout(()=>{void evaluateLifecycle()},IDLE_TIMEOUT_MS)}
 function evaluateLifecycle(force=false){
  clearTimeout(idleTimer);idleTimer=null;
  if(!agent)return false;
    if(getMicMode?.()==="on"||isChatSurfaceOpen?.()){lastActivity=Date.now();return false}
  if(activeRequests>0){return false}
  if(!force&&Date.now()-lastActivity<IDLE_TIMEOUT_MS){scheduleIdleRelease();return false}
  void releaseBrain();
  return true;
 }
 function touchActivity(){lastActivity=Date.now();scheduleIdleRelease()}
 function beginRequest(){activeRequests++;touchActivity()}
 function endRequest(){activeRequests=Math.max(0,activeRequests-1);if(activeRequests===0)void evaluateLifecycle();else touchActivity()}
 function notifyLifecycle(options={}){return evaluateLifecycle(Boolean(options?.force))}
 async function ensureBrain(){
  touchActivity();
  if(brainInitPromise)return brainInitPromise;
  brainInitPromise=(async()=>{
   const {ConversationAgent}=require("../conversation/conversation-agent");
   const {ToolRegistry}=require("../../tools");
   registry=new ToolRegistry({
    captureScreen,
    userDataPath:app.getPath("userData"),
    characterController:({intent,duration,intensity}={})=>characterCommand({action:"semantic",intent,options:{duration,speed:1,intensity}}),
    recordHook:step=>recordLearningStep?.(step),
    permissionPolicy,
    confirm
   });
   if(emergencyStopped)registry.emergencyStop?.();
   agent=new ConversationAgent({registry,onEvent:e=>{diagnosticFromAgent(e);voiceBroadcast("agent:event",e)},requestStepIncrease});
   setAgent(agent);
   setVoiceMuted(Boolean(agent.settings.voiceMuted));
   lastActivity=Date.now();
   scheduleIdleRelease();
   voiceBroadcast("character:behavior",{type:"settings",settings:agent.publicSettings()});
   return agent;
  })().catch(e=>{brainInitPromise=null;agent=null;setAgent(null);diagnostic("ERROR","BRAIN INIT",e.message);throw e});
  return brainInitPromise;
 }
 async function releaseBrain(){
  clearTimeout(idleTimer);idleTimer=null;
  const oldAgent=agent;
  agent=null;
  brainInitPromise=null;
  registry=null;
  try{await oldAgent?.dispose?.()}catch(e){diagnostic("ERROR","BRAIN RELEASE",e.message)}
  setAgent(null);
  voiceBroadcast("character:behavior",{type:"brain-released"});
  diagnostic("INFO","BRAIN RELEASE","Brain runtime released because no active input surface is using it");
  return true;
 }
 function emergencyStop(){emergencyStopped=true;registry?.emergencyStop?.();return{stopped:true,active:Boolean(agent)}}
 function resumeEmergencyStop(){emergencyStopped=false;registry?.resumeAfterEmergencyStop?.();return{stopped:false,active:Boolean(agent)}}
 return{ensureBrain,releaseBrain,touchActivity,beginRequest,endRequest,notifyLifecycle,evaluateLifecycle,emergencyStop,resumeEmergencyStop,isEmergencyStopped:()=>emergencyStopped,isActive:()=>Boolean(agent)};
}
module.exports={createBrainHost};
