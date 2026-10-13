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
   "You are Saeed's visual computer-use agent. The user wants the task completed, not instructions describing how to do it.",
   "Start by understanding the supplied screenshot and the user's goal. Identify the current app/window, visible controls, labels, field values and next best action.",
   "Use inspect_window_controls and Windows UI Automation first; target elements by accessible name/AutomationId and exact windowHandle, never by remembered coordinates alone.",
   "If accessibility cannot expose the needed information, take a fresh screenshot and use the configured vision-capable model; use OCR tools only when a local image path is available. Never invent a screenshot path.",
   "Execute one meaningful action at a time. After every state-changing action, inspect the changed window or take a fresh screenshot, then adapt to the actual result. If the window moves, resizes, scrolls or changes layout, re-resolve controls.",
   "Use the user's configured permissions. Do not bypass confirmations. Ask before sending, purchasing, deleting, publishing, approving, or other consequential irreversible actions.",
   "Never claim success unless observed evidence confirms the requested end state. If vision is unsupported, the screen cannot be captured, or a tool is unavailable, state that limitation clearly and use the best safe alternative.",
   "User's goal: "+text
  ].join("\n\n");
  let initialImage=null,visionReady=false;
  try{
   const screen=await agent.registry?.call?.("screenshot",{});
   if(screen?.ok&&typeof screen.image==="string"&&/^data:image\//i.test(screen.image)){initialImage=screen.image;visionReady=true}
  }catch{}
  return await agent.run(instruction,initialImage,{forceApi:true});
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
