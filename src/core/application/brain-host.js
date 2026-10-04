function createBrainHost({app,getChatWindow,characterCommand,permissionPolicy,showChat,diagnostic,diagnosticFromAgent,voiceBroadcast,captureScreen,setSaeedSize,setAgent,setVoiceMuted,recordLearningStep,confirmations,characterSettingsExists}){
 let brainInitPromise=null,runtime=null;
 async function ensureBrain(){
  if(brainInitPromise)return brainInitPromise;
  brainInitPromise=(async()=>{
   const {CoreRuntime}=require("../runtime/core-runtime");
   runtime=new CoreRuntime({captureScreen,userDataPath:app.getPath("userData"),characterController:({intent,duration,intensity}={})=>characterCommand({action:"semantic",intent,options:{duration,speed:1,intensity}}),recordHook:step=>recordLearningStep?.(step),permissionPolicy,confirm:async({name,args,permissionCategory})=>{
    await showChat();
    return new Promise(resolve=>{
     const chatWin=getChatWindow(),id=Date.now().toString(36)+Math.random().toString(36).slice(2,7),labels={files:"Files",applications:"Applications",system:"System information",network:"Network & web",screen:"Screen capture",mouseKeyboard:"Mouse & keyboard control",microphone:"Microphone & voice",tasksMemory:"Tasks & memory",credentials:"Credentials & secrets",destructive:"Destructive actions"};
     confirmations.set(id,resolve);
     chatWin?.webContents.send("agent:confirm",{id,name,args,permissionCategory,permissionLabel:labels[permissionCategory]||permissionCategory||"Permission"});
    });
   },onEvent:e=>{diagnosticFromAgent(e);voiceBroadcast("agent:event",e)},requestStepIncrease:async({current,requested,task})=>{
    await showChat();
    return new Promise(resolve=>{
     const chatWin=getChatWindow(),id=Date.now().toString(36)+Math.random().toString(36).slice(2,7);
     confirmations.set(id,resolve);
     chatWin?.webContents.send("agent:confirm",{id,name:"agent_step_increase",args:{currentLimit:current,requestedLimit:requested,task:String(task||"")},permissionCategory:"execution",permissionLabel:"Execution limit"});
    });
   }});
   const started=await runtime.start();
   setAgent(started);
   setVoiceMuted(Boolean(started.settings.voiceMuted));
   voiceBroadcast("character:behavior",{type:"settings",settings:started.publicSettings()});
   if(!characterSettingsExists())setSaeedSize(started.settings.characterSize||"small");
   return started;
  })().catch(e=>{brainInitPromise=null;runtime=null;setAgent(null);diagnostic("ERROR","BRAIN INIT",e.message);throw e});
  return brainInitPromise;
 }
 async function releaseBrain(){
  if(runtime){try{runtime.stop()}catch(e){diagnostic("ERROR","BRAIN RELEASE",e.message)}}
  runtime=null;brainInitPromise=null;setAgent(null);
  voiceBroadcast("character:behavior",{type:"brain-released"});
  diagnostic("INFO","BRAIN RELEASE","Brain runtime released because no Chat or Mic input surface is active");
  return true;
 }
 return{ensureBrain,releaseBrain,isActive:()=>Boolean(runtime)};
}
module.exports={createBrainHost};