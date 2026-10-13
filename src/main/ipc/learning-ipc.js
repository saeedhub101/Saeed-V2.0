function registerLearningIpc({ipcMain,app,getLearning,getLearningRecorder,ensureBrain,getAgent,getChatWindow,getConfirmations,showLearning}){
 let recording=null;
 const recordingSessions=()=>require("../../learning/recording-session");
 ipcMain.handle("learning:show",()=>{showLearning();return true});
 ipcMain.handle("learning:list",()=>getLearning().list(app.getPath("userData")));
 ipcMain.handle("learning:run-task",async(_,goal)=>{
  const text=String(goal||"").trim();
  if(!text)throw new Error("Describe the task you want Saeed to complete.");
  if(text.length>4000)throw new Error("Task description is too long (maximum 4000 characters).");
  await ensureBrain();
  const agent=getAgent();
  if(!agent||typeof agent.run!=="function")throw new Error("Saeed's AI brain is unavailable. Check the Brain settings and try again.");
  const instruction=[
   "You are Saeed, an AI computer-use agent. Complete the user's goal, not merely describe how to do it.",
   "For tasks involving the desktop or a GUI, inspect the current screen and available UI Automation controls before acting; prefer semantic element names and accessibility information over fixed coordinates.",
   "If the layout changes or an action fails, inspect the current state again and adapt. Use screenshot/vision and OCR tools when accessibility information is insufficient and those tools are available.",
   "Verify the result after consequential actions. Never claim success without evidence. Ask for clarification only if essential information is missing or an action is unsafe/irreversible.",
   "Follow configured permissions and confirmation prompts; never bypass them.",
   "User's goal: "+text
  ].join("\n\n");
  return await agent.run(instruction,null);
 });
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
