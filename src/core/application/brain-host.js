function createBrainHost({app,getCharacterWindow,getChatWindow,getLearning,permissionPolicy,showChat,diagnostic,diagnosticFromAgent,voiceBroadcast,captureScreen,getCharacter3DSettingsFile,setSaeedSize,setAgent,setBrainSupervisor,setVoiceMuted,recordLearningStep,confirmations,characterSettingsExists}){
 let brainInitPromise=null;
 async function ensureBrain(){
  if(brainInitPromise)return brainInitPromise;
  brainInitPromise=(async()=>{
   const {CoreRuntime}=require("../runtime");
   const characterWin=getCharacterWindow();
   const runtime=new CoreRuntime({
    captureScreen,userDataPath:app.getPath("userData"),
    characterController:async({intent,duration,intensity}={})=>{
     const win=getCharacterWindow();
     if(!win||win.isDestroyed())return{ok:false,error:"Character window is not available"};
     const payload=JSON.stringify({intent,options:{duration,speed:1,intensity}});
     try{return await win.webContents.executeJavaScript("(async()=>{const c=window.saeedCharacterController;if(!c)return {ok:false,error:\"Character controller unavailable\"};return c.semantic("+payload+".intent,"+payload+".options||{});})()",true)}
     catch(e){return{ok:false,error:e.message}}
    },
    recordHook:step=>{recordLearningStep(step)},
    permissionPolicy,
    confirm:async({name,args,permissionCategory})=>{
     await showChat();
     return new Promise(resolve=>{
      const chatWin=getChatWindow();
      const id=Date.now().toString(36)+Math.random().toString(36).slice(2,7);
      const labels={files:"Files",applications:"Applications",system:"System information",network:"Network & web",screen:"Screen capture",mouseKeyboard:"Mouse & keyboard control",microphone:"Microphone & voice",tasksMemory:"Tasks & memory",credentials:"Credentials & secrets",destructive:"Destructive actions"};
      const permissionLabel=labels[permissionCategory]||permissionCategory||"Permission";
      chatWin?.webContents.send("agent:confirm",{id,name,args,permissionCategory,permissionLabel});
      confirmations.set(id,resolve);
     });
    },
    onEvent:e=>{diagnosticFromAgent(e);voiceBroadcast("agent:event",e)},
    requestStepIncrease:async({current,requested,task})=>{
     await showChat();
     return new Promise(resolve=>{
      const chatWin=getChatWindow();
      const id=Date.now().toString(36)+Math.random().toString(36).slice(2,7);
      pendingConfirmations.set(id,resolve);
      chatWin?.webContents.send("agent:confirm",{id,name:"agent_step_increase",args:{currentLimit:current,requestedLimit:requested,task:String(task||"")},permissionCategory:"execution",permissionLabel:"Execution limit",reason:"This task needs more execution steps. Allow an additional "+(requested-current)+" steps for this task?"});
     });
    }
   });
   const started=await runtime.start();
   setAgent(started);
   setBrainSupervisor(runtime.brainSupervisor);
   setVoiceMuted(Boolean(started.settings.voiceMuted));
   if(!characterSettingsExists())setSaeedSize(started.settings.characterSize||"small");
   const win=getCharacterWindow();
   if(win&&!win.isDestroyed())win.webContents.send("character:behavior",{type:"settings",settings:started.publicSettings()});
   return started;
  })().catch(e=>{brainInitPromise=null;diagnostic("ERROR","BRAIN INIT",e.message);throw e});
  return brainInitPromise;
 }
 return {ensureBrain};
}
module.exports={createBrainHost};
