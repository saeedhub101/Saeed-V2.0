const fs=require("fs");
const path=require("path");
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function makeReport(mode,output){
 const report={schemaVersion:1,mode,startedAt:new Date().toISOString(),passed:false,checks:[],error:null};
 const check=(name,passed,details={})=>{report.checks.push({name,passed:Boolean(passed),details});if(!passed)console.error("PACKAGED_ACCEPTANCE_FAIL="+name,JSON.stringify(details))};
 const finish=()=>{report.finishedAt=new Date().toISOString();report.passed=report.checks.length>0&&report.checks.every(x=>x.passed);try{fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n","utf8")}catch(error){report.passed=false;report.error=String(error?.stack||error)}console.log("PACKAGED_ACCEPTANCE_"+mode.toUpperCase()+"="+(report.passed?"PASS":"FAIL"));console.log(JSON.stringify(report,null,2));return report};
 return{report,check,finish};
}
async function runBrainLearning(mode,deps){
 const {app,ensureBrain,ensureBrainHost,getAgent,diagnostic}=deps;
 const output=process.env.SAEED_CI_BRAIN_LEARNING_REPORT||path.join(process.cwd(),"dist","ci-brain-learning-"+mode+".json");
 const {report,check,finish}=makeReport("brain-learning-"+mode,output),userData=app.getPath("userData"),statePath=process.env.SAEED_CI_BRAIN_STATE;
 const learning=require("../../learning"),tasks=require("../brain/task-engine"),capabilities=require("../../addons/capabilities");
 const skillId="ci-brain-learning-contract",addonId="ci-learning-addon";
 try{
  if(!statePath)throw new Error("SAEED_CI_BRAIN_STATE is required");
  const agent=await ensureBrain(),host=ensureBrainHost(),tools=host.getCapabilities?.()||[];
  check("brain-initializes-in-packaged-exe",Boolean(agent)&&host.isActive(),{active:host.isActive(),agentType:agent?.constructor?.name||typeof agent});
  check("agent-has-registered-tools",tools.length>=5,{toolCount:tools.length,tools:tools.slice(0,35)});
  const uiPath=path.join(app.getAppPath(),"src","addons","window.html");
  const ui=fs.readFileSync(uiPath,"utf8");
  check("add-on-screen-has-search-category-and-direct-add-action",ui.includes('id="search"')&&ui.includes('id="categories"')&&ui.includes("Add add-on"),{uiPath,hasSearch:ui.includes('id="search"'),hasCategories:ui.includes('id="categories"'),hasDirectAdd:ui.includes("Add add-on")});
  if(mode==="save"){
   const task=tasks.begin(userData,"CI brain/learning persistence contract");
   tasks.setPlan(userData,task.id,[{title:"Verify task plan persistence",successCriteria:"Task plan can be read back from disk"}]);
   const savedTask=tasks.get(userData,task.id);
   check("agent-task-plan-is-created-and-persisted",Boolean(savedTask)&&savedTask.plan?.length===1&&savedTask.plan[0].status==="pending",{taskId:task.id,planCount:savedTask?.plan?.length||0});
   tasks.finish(userData,task.id,{status:"cancelled",summary:"Packaged CI persistence check completed"});
   const skill=learning.save(userData,{id:skillId,name:"CI learned workflow",description:"Temporary workflow used to verify saved learned skills.",trigger:{phrases:["run ci learned workflow"]},steps:[{tool:"system_info",args:{}}]});
   const matched=learning.match(userData,"run ci learned workflow");
   check("learned-skill-create-and-trigger-match",Boolean(skill)&&skill.enabled!==false&&matched?.id===skillId,{saved:Boolean(skill),matchedId:matched?.id||null,enabled:skill?.enabled});
   learning.recordOutcome(userData,skillId,"success","packaged acceptance");
   const withOutcome=learning.get(userData,skillId);
   check("learning-outcome-is-persisted",withOutcome?.metadata?.outcomes?.successes===1,{outcomes:withOutcome?.metadata?.outcomes||null});
   const registered=capabilities.register(userData,{id:addonId,name:"CI add-on capability",version:"1.0.0",capabilities:["ci-test-capability"]});
   const found=capabilities.find(userData,"ci-test-capability");
   check("add-on-capability-registers-and-is-discoverable",registered&&found.some(x=>x.id===addonId),{registered,found:found.map(x=>x.id)});
   const state={schemaVersion:1,taskId:task.id,skillId,addonId,createdAt:new Date().toISOString()};
   fs.mkdirSync(path.dirname(statePath),{recursive:true});fs.writeFileSync(statePath,JSON.stringify(state,null,2)+"\n","utf8");
   check("brain-learning-restart-marker-written",fs.existsSync(statePath),{statePath,taskId:task.id,skillId});
  }else if(mode==="verify"){
   check("brain-learning-restart-marker-exists",fs.existsSync(statePath),{statePath});
   if(!fs.existsSync(statePath))throw new Error("Brain/learning restart marker missing");
   const state=JSON.parse(fs.readFileSync(statePath,"utf8")),task=tasks.get(userData,state.taskId),skill=learning.get(userData,state.skillId),matched=learning.match(userData,"run ci learned workflow"),found=capabilities.find(userData,"ci-test-capability");
   check("agent-task-history-survives-new-process",Boolean(task)&&task.status==="cancelled"&&task.plan?.length===1,{taskId:state.taskId,status:task?.status||null,planCount:task?.plan?.length||0});
   check("learned-skill-survives-new-process-and-still-matches",Boolean(skill)&&matched?.id===state.skillId&&skill.metadata?.outcomes?.successes===1,{skillId:state.skillId,found:Boolean(skill),matchedId:matched?.id||null,outcomes:skill?.metadata?.outcomes||null});
   check("add-on-capability-registry-survives-new-process",found.some(x=>x.id===state.addonId),{addonId:state.addonId,found:found.map(x=>x.id)});
   learning.remove(userData,state.skillId);capabilities.unregister(userData,state.addonId);
   check("temporary-ci-capability-cleaned-up",!capabilities.find(userData,"ci-test-capability").some(x=>x.id===state.addonId),{addonId:state.addonId});
  }else throw new Error("Unsupported brain/learning mode: "+mode);
 }catch(error){report.error=String(error?.stack||error);check("brain-learning-exception",false,{error:report.error})}
 try{await ensureBrainHost().releaseBrain?.()}catch(error){diagnostic?.("WARN","CI BRAIN RELEASE",error?.message||String(error))}
 return finish();
}
async function runLifecycle(deps){
 const {app,BrowserWindow,getState,setWindow,characterApi,showPerformance,showSettings,showLearning,showAddons,showStatus,show3DStatus,showRestPoseEditor,showNormalizeHumanoidRestPose,ensureChatHost,ensureBrain,ensureBrainHost,getAgent,setMicMode,getCurrentMicMode,ensureVoiceHost,diagnostic,stopCpuMonitoring}=deps;
 const output=process.env.SAEED_CI_LIFECYCLE_REPORT||path.join(process.cwd(),"dist","ci-lifecycle-report.json");
 const {report,check,finish}=makeReport("lifecycle",output),pause=ms=>wait(ms);
 const windows=()=>BrowserWindow.getAllWindows().filter(w=>w&&!w.isDestroyed());
 const closeKey=key=>{const win=getState()[key];try{if(win&&!win.isDestroyed())win.destroy()}catch{}try{setWindow(key,null)}catch{}};
 const closeEverything=async()=>{await characterApi.hideCharacter();await pause(120);};
 const screen=(name,key,open,requiresCharacter=false)=>async()=>{
  await closeEverything();
  try{await open();await pause(500);const win=getState()[key];check(name+"-opens",Boolean(win&&!win.isDestroyed()&&win.isVisible()),{exists:Boolean(win&&!win.isDestroyed()),visible:Boolean(win&&!win.isDestroyed()&&win.isVisible()),windowCount:windows().length,requiresCharacter});}
  catch(error){check(name+"-opens",false,{error:String(error?.stack||error)})}
  await closeEverything();
  check(name+"-closes-all-surfaces",windows().length===0,{windowCount:windows().length,remaining:windows().map(w=>w.getTitle())});
 };
 try{
  await closeEverything();
  check("hidden-idle-has-no-feature-windows",windows().length===0,{windowCount:windows().length});
  for(const fn of [
   screen("performance-window","performanceWin",showPerformance),
   screen("settings-window","settingsWin",showSettings),
   screen("add-ons-window","addonsWin",showAddons),
   screen("learning-window","learningWin",showLearning),
   screen("status-window","statusWin",showStatus),
   screen("3d-status-window","threeDStatusWin",show3DStatus,true),
   screen("character-studio-window","restPoseEditorWin",showRestPoseEditor,true),
   screen("normalize-rest-pose-window","normalizeHumanoidRestPoseWin",showNormalizeHumanoidRestPose,true)
  ])await fn();
  await closeEverything();
  await ensureChatHost().showChat();await pause(450);await ensureBrain();
  check("chat-open-keeps-brain-active-with-mic-off",ensureBrainHost().isActive()&&getCurrentMicMode()==="off",{brainActive:ensureBrainHost().isActive(),micMode:getCurrentMicMode(),chatExists:Boolean(ensureChatHost().getChatWindow())});
  await ensureChatHost().closeChat();await pause(120);
  check("chat-close-releases-brain-when-mic-off",!ensureBrainHost().isActive(),{brainActive:ensureBrainHost().isActive(),micMode:getCurrentMicMode()});
  await characterApi.showCharacter();await pause(250);
  const character=getState().characterWin;
  check("character-only-surface-is-visible",Boolean(character&&!character.isDestroyed()&&character.isVisible())&&windows().length===1,{visible:Boolean(character&&!character.isDestroyed()&&character.isVisible()),windowCount:windows().length,windows:windows().map(w=>w.getTitle())});
  const readyRig=await deps.characterHost.command({action:"getRig"});
  check("character-rig-ready-before-animation",readyRig?.ok===true&&Array.isArray(readyRig.bones)&&readyRig.bones.length>0,{ok:Boolean(readyRig?.ok),boneCount:readyRig?.bones?.length||0,error:readyRig?.error||null});
  const motion=await deps.characterHost.command({action:"play",motion:"wave",options:{priority:100,blend:.01}});await pause(300);
  check("animation-starts-on-demand",motion?.ok===true,{ok:Boolean(motion?.ok),error:motion?.error||null});
  await deps.characterHost.command({action:"stopAll"});
  await ensureBrain();const agent=getAgent();agent.settings={...agent.settings,permissions:{...(agent.settings?.permissions||{}),microphone:"allow"}};
  const micOn=await setMicMode("on");
  check("mic-on-activates-brain-and-stt-mode",micOn===true&&getCurrentMicMode()==="on"&&ensureBrainHost().isActive(),{micOn:Boolean(micOn),micMode:getCurrentMicMode(),brainActive:ensureBrainHost().isActive()});
  const micOff=await setMicMode("off");await pause(120);
  check("mic-off-stops-stt-and-releases-idle-brain",micOff===true&&getCurrentMicMode()==="off"&&!ensureBrainHost().isActive()&&!ensureVoiceHost().isVoiceRuntimeActive(),{micOff:Boolean(micOff),micMode:getCurrentMicMode(),brainActive:ensureBrainHost().isActive(),sttRuntimeActive:Boolean(ensureVoiceHost().getVoiceRuntime())});
  await closeEverything();
  check("final-idle-leaves-only-tray",windows().length===0,{windowCount:windows().length,windows:windows().map(w=>w.getTitle())});
 }catch(error){report.error=String(error?.stack||error);check("lifecycle-exception",false,{error:report.error})}
 try{stopCpuMonitoring()}catch{}
 return finish();
}
async function runResource(deps){
 const {app,BrowserWindow,getState,characterApi,showPerformance,ensureChatHost,ensureBrain,ensureBrainHost,getAgent,setMicMode,getCurrentMicMode,ensureVoiceHost,getResourceService,characterHost}=deps;
 const output=process.env.SAEED_CI_RESOURCE_REPORT||path.join(process.cwd(),"dist","ci-ram-cpu-report.json");
 const {report,check,finish}=makeReport("ram-cpu",output),samples=[];
 const pause=ms=>wait(ms);
 const sample=async label=>{await pause(450);const item=getResourceService().resourceSnapshot(label);samples.push(item);const finite=n=>Number.isFinite(Number(n))&&Number(n)>=0;const good=finite(item.rssMB)&&finite(item.heapUsedMB)&&finite(item.saeedTotal?.workingSetMB)&&finite(item.saeedTotal?.privateMB)&&finite(item.saeedTotal?.cpuPercent)&&Number(item.saeedTotal?.processCount)>0&&Array.isArray(item.processes)&&item.processes.every(p=>finite(p.workingSetMB)&&finite(p.privateMB)&&finite(p.cpuPercent));check("resource-sample-"+label,good,{label,rssMB:item.rssMB,heapUsedMB:item.heapUsedMB,processCount:item.processCount,processes:item.processes?.map(p=>({pid:p.pid,type:p.type,name:p.name,cpuPercent:p.cpuPercent,workingSetMB:p.workingSetMB,privateMB:p.privateMB}))||[],windows:item.windows?.map(w=>w.title)||[]});return item};
 try{
  await characterApi.hideCharacter();await sample("idle-tray-only");
  await showPerformance();await sample("performance-open");await characterApi.hideCharacter();await sample("performance-closed-idle");
  await ensureChatHost().showChat();await ensureBrain();await sample("chat-open-brain-active");await ensureChatHost().closeChat();await pause(120);await sample("chat-closed-brain-released");
  await characterApi.showCharacter();
  const readyRig=await characterHost.command({action:"getRig"});
  check("resource-character-rig-ready",readyRig?.ok===true&&Array.isArray(readyRig.bones)&&readyRig.bones.length>0,{ok:Boolean(readyRig?.ok),boneCount:readyRig?.bones?.length||0,error:readyRig?.error||null});
  await sample("character-visible-idle");
  const motion=await characterHost.command({action:"play",motion:"wave",options:{priority:100,blend:.01}});await sample("character-animation-running");await characterHost.command({action:"stopAll"});
  check("resource-animation-state-reached",motion?.ok===true,{ok:Boolean(motion?.ok),error:motion?.error||null});
  await ensureBrain();const agent=getAgent();agent.settings={...agent.settings,permissions:{...(agent.settings?.permissions||{}),microphone:"allow"}};
  const micOn=await setMicMode("on");await sample("character-and-mic-on");
  check("resource-mic-state-reached",micOn===true&&getCurrentMicMode()==="on"&&ensureBrainHost().isActive(),{micOn:Boolean(micOn),micMode:getCurrentMicMode(),brainActive:ensureBrainHost().isActive()});
  await setMicMode("off");await sample("mic-off-brain-released");
  await characterApi.hideCharacter();const last=await sample("final-tray-only");
  check("final-resource-state-has-no-windows",last.windows.length===0,{windows:last.windows.map(w=>w.title),processCount:last.processCount});
 }catch(error){report.error=String(error?.stack||error);check("resource-monitor-exception",false,{error:report.error})}
 report.resourceSamples=samples;
 return finish();
}
module.exports={runBrainLearning,runLifecycle,runResource};
