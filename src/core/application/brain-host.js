function createBrainHost({app,getChatWindow,getMicMode,characterCommand,permissionPolicy,showChat,diagnostic,diagnosticFromAgent,voiceBroadcast,captureScreen,setSaeedSize,setAgent,setVoiceMuted,recordLearningStep,confirmations,characterSettingsExists}){
 let brainInitPromise=null,agent=null,idleTimer=null,lastActivity=0,activeRequests=0;
 const labels={files:"Files",applications:"Applications",system:"System information",network:"Network & web",screen:"Screen capture",mouseKeyboard:"Mouse & keyboard control",microphone:"Microphone & voice",tasksMemory:"Tasks & memory",credentials:"Credentials & secrets",destructive:"Destructive actions"};
 const confirm=async({name,args,permissionCategory})=>{
  await showChat();
  return new Promise(resolve=>{
   const chatWin=getChatWindow(),id=Date.now().toString(36)+Math.random().toString(36).slice(2,7);
   confirmations.set(id,resolve);
   chatWin?.webContents.send("agent:confirm",{id,name,args,permissionCategory,permissionLabel:labels[permissionCategory]||permissionCategory||"Permission"});
  });
 };
 const requestStepIncrease=async({current,requested,task})=>{
  await showChat();
  return new Promise(resolve=>{
   const chatWin=getChatWindow(),id=Date.now().toString(36)+Math.random().toString(36).slice(2,7);
   confirmations.set(id,resolve);
   chatWin?.webContents.send("agent:confirm",{id,name:"agent_step_increase",args:{currentLimit:current,requestedLimit:requested,task:String(task||"")},permissionCategory:"execution",permissionLabel:"Execution limit"});
  });
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
   if(!characterSettingsExists())setSaeedSize(agent.settings.characterSize||"small");
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
  diagnostic("INFO","BRAIN RELEASE","Brain runtime released because no Chat or Mic input surface is active");
  return true;
 }
 return{ensureBrain,releaseBrain,touchActivity,beginRequest,endRequest,isActive:()=>Boolean(agent)};
}
module.exports={createBrainHost};
