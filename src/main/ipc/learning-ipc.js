function registerLearningIpc({ipcMain,app,getLearning,getLearningRecorder,ensureBrain,getAgent,getChatWindow,getConfirmations,showLearning}){
 let recording=null;
 const recordingSessions=()=>require("../../learning/recording-session");
 ipcMain.handle("learning:show",()=>{showLearning();return true});
 ipcMain.handle("learning:list",()=>getLearning().list(app.getPath("userData")));
 ipcMain.handle("learning:get",(_,id)=>getLearning().get(app.getPath("userData"),id));
 ipcMain.handle("learning:record-start",(_,name,phrases)=>{
  if(recording)throw new Error("Learning recorder is already running");
  const userData=app.getPath("userData"),learning=getLearning();
  recording=learning.beginRecording(userData,name,phrases);
  const session=recording;
  try{
   recordingSessions().setActiveSession({learning,userData,session});
   getLearningRecorder().start(event=>{
    if(recording===session&&event?.type==="action"){
     try{learning.recordStep(session,event.tool,event.args)}catch{}
    }
   },userData);
   return true;
  }catch(error){
   recordingSessions().clearActiveSession(session);
   recording=null;
   getLearningRecorder().stop();
   throw error;
  }
 });
 ipcMain.handle("learning:record-stop",()=>{
  if(!recording)throw new Error("Learning recorder is not running");
  const session=recording,userData=app.getPath("userData"),learning=getLearning();
  getLearningRecorder().stop();
  try{
   if(!Array.isArray(session.skill?.steps)||!session.skill.steps.length)return{ok:false,empty:true,message:"No actions were recorded."};
   return learning.finishRecording(userData,session);
  }finally{
   recordingSessions().clearActiveSession(session);
   recording=null;
  }
 });
 ipcMain.handle("learning:save",(_,skill)=>require("../../learning").save(app.getPath("userData"),skill));
 ipcMain.handle("learning:remove",(_,id)=>require("../../learning").remove(app.getPath("userData"),id));
 ipcMain.handle("learning:enable",(_,id,enabled)=>require("../../learning").setEnabled(app.getPath("userData"),id,enabled));
 ipcMain.handle("learning:run",async(_,id)=>{
  await ensureBrain();
  const skill=getLearning().get(app.getPath("userData"),id);
  if(!skill)throw new Error("Skill not found: "+id);
  return getLearning().run(app.getPath("userData"),getAgent().registry,skill);
 });
 ipcMain.handle("learning:export",(_,id)=>require("../../learning").exportSkill(app.getPath("userData"),id));
 ipcMain.handle("learning:import",(_,data)=>require("../../learning").importSkill(app.getPath("userData"),data));
}
module.exports={registerLearningIpc};
