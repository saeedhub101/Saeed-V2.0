function createBrainHost({app,dialog,getMicMode,characterCommand,permissionPolicy,diagnostic,diagnosticFromAgent,voiceBroadcast,captureScreen,setAgent,setVoiceMuted,recordLearningStep}){
 let brainInitPromise=null,agent=null,idleTimer=null,lastActivity=0,activeRequests=0;
 const labels={files:"Files",applications:"Applications",system:"System information",network:"Network & web",screen:"Screen capture",mouseKeyboard:"Mouse & keyboard control",microphone:"Microphone & voice",tasksMemory:"Tasks & memory",credentials:"Credentials & secrets",destructive:"Destructive actions"};
 const confirm=async({name,args,permissionCategory})=>{
  const label=labels[permissionCategory]||permissionCategory||"Permission";
  if(dialog?.showMessageBox){
   const detail=String(args?.path||args?.command||args?.url||"").trim();
   const result=await dialog.showMessageBox({type:"question",buttons:["Allow","Deny"],defaultId:0,cancelId:1,title:"Saeed Permission",message:"Allow Saeed to perform this action?",detail:label+(detail?"\n"+detail:"")});
   return result.response===0;
  }
  return true;
 };
 const requestStepIncrease=async({current,requested,task})=>{
  if(dialog?.showMessageBox){
   const result=await dialog.showMessageBox({type:"question",buttons:["Allow","Deny"],defaultId:0,cancelId:1,title:"Saeed Execution Limit",message:"Allow Saeed to continue with more steps?",detail:"Current limit: "+current+"\nRequested: "+requested+"\n"+String(task||"")});
   return result.response===0;
  }
  return true;
 };
 function scheduleIdleRelease(){clearTimeout(idleTimer);if(!agent)return;idleTimer=setTimeout(()=>{if(agent&&activeRequests===0&&getMicMode?.()!=="on"&&Date.now()-lastActivity>=45000)void releaseBrain()},45000)}
 function touchActivity(){lastActivity=Date.now();scheduleIdleRelease()}
 function beginRequest(){activeRequests++;touchActivity()}
 function endRequest(){activeRequests=Math.max(0,activeRequests-1);touchActivity()}
 async function ensureBrain(){
  touchActivity();
  if(brainInitPromise)return brainInitPromise;
  brainInitPromise=(async()=>{
   const {Agent}=require("../../agent");
   const {ToolRegistry}=require("../../tools");
   const registry=new ToolRegistry({
    captureScreen,
    userDataPath:app.getPath("userData"),
    characterController:({intent,duration,intensity}={})=>characterCommand({action:"semantic",intent,options:{duration,speed:1,intensity}}),
    recordHook:step=>recordLearningStep?.(step),
    permissionPolicy,
    confirm
   });
   agent=new Agent({registry,onEvent:e=>{diagnosticFromAgent(e);voiceBroadcast("agent:event",e)},requestStepIncrease});
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
  try{await oldAgent?.dispose?.()}catch(e){diagnostic("ERROR","BRAIN RELEASE",e.message)}
  setAgent(null);
  voiceBroadcast("character:behavior",{type:"brain-released"});
  diagnostic("INFO","BRAIN RELEASE","Brain runtime released because no active input surface is using it");
  return true;
 }
 return{ensureBrain,releaseBrain,touchActivity,beginRequest,endRequest,isActive:()=>Boolean(agent)};
}
module.exports={createBrainHost};
