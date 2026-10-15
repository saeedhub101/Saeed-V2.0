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
  const uiScriptPath=path.join(app.getAppPath(),"src","addons","window.js");
  const ui=fs.readFileSync(uiPath,"utf8");
  const uiScript=fs.readFileSync(uiScriptPath,"utf8");
  const hasSearch=ui.includes('id="search"'),hasCategories=ui.includes('id="categories"'),hasDirectAdd=uiScript.includes("Add add-on");
  check("add-on-screen-has-search-category-and-direct-add-action",hasSearch&&hasCategories&&hasDirectAdd,{uiPath,uiScriptPath,hasSearch,hasCategories,hasDirectAdd});
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
 const result=finish();
 setTimeout(()=>{try{app.exit(result.passed?0:1)}catch{}},150);
 return result;
}
async function runLifecycle(deps){
 const {app,BrowserWindow,getState,setWindow,characterApi,showPerformance,showSettings,showLearning,showAddons,showStatus,show3DStatus,showCharacterSettings,showUpdateStatus,ensureChatHost,ensureBrain,ensureBrainHost,getAgent,setMicMode,getCurrentMicMode,ensureVoiceHost,diagnostic,stopCpuMonitoring}=deps;
 const output=process.env.SAEED_CI_LIFECYCLE_REPORT||path.join(process.cwd(),"dist","ci-lifecycle-report.json");
 const {report,check,finish}=makeReport("lifecycle",output),pause=ms=>wait(ms);
 const windows=()=>BrowserWindow.getAllWindows().filter(w=>w&&!w.isDestroyed());
 const visibleWindows=()=>windows().filter(w=>{try{return w.isVisible()}catch{return false}});
 const featureWindows=()=>windows().filter(w=>w!==getState().characterWin);
 const closeKey=key=>{const win=getState()[key];try{if(win&&!win.isDestroyed())win.destroy()}catch{}try{setWindow(key,null)}catch{}};
 const closeEverything=async()=>{try{await ensureChatHost().closeChat()}catch{}await characterApi.hideCharacter();for(const key of ["performanceWin","settingsWin","addonsWin","learningWin","statusWin","threeDStatusWin","characterSettingsWin","updateStatusWin"])closeKey(key);await pause(120);};
 async function probeFeatureScreen(name){
  const route=name.replace(/-window$/,"");
  const expected={"performance":"Saeed Performance","settings":"Saeed Settings","add-ons":"Saeed Add-ons","learning":"Saeed Learning","status":"Saeed Status","3d-status":"Saeed 3D Status","character-settings":"Character Setting","update-status":"Saeed Update Status","chat":"Saeed AI","character":"Saeed 3D Character"};
  const title=document.title,readyState=document.readyState,hasPreload=Boolean(window.saeed);
  const buttonNodes=[...document.querySelectorAll("button")];
  const buttons=buttonNodes.length;
  const buttonInventory=buttonNodes.map((button,index)=>({
   index:index+1,
   label:(button.innerText||button.getAttribute("aria-label")||button.title||button.value||"").trim().replace(/\\s+/g," ").slice(0,140),
   id:button.id||null,
   type:button.type||"button",
   disabled:Boolean(button.disabled),
   visible:Boolean(button.getClientRects().length&&getComputedStyle(button).visibility!=="hidden"&&getComputedStyle(button).display!=="none"),
   inlineHandler:Boolean(button.onclick||button.getAttribute("onclick")),
   actionAttribute:button.getAttribute("data-action")||button.getAttribute("data-command")||null,
   tabTarget:button.getAttribute("data-tab")||null,
   formSubmit:Boolean(button.form&&(button.type==="submit"||button.type==="")),
   hasAccessibleName:Boolean((button.innerText||button.getAttribute("aria-label")||button.title||button.value||"").trim())
  }));
  const tabButtons=[...document.querySelectorAll("[data-tab]")],original=tabButtons.find(b=>b.classList.contains("active"))?.dataset.tab||tabButtons[0]?.dataset.tab||"";
  const tabResults=[];
  for(const button of tabButtons){const tab=button.dataset.tab;button.click();await new Promise(resolve=>setTimeout(resolve,0));const panel=document.getElementById("tab-"+tab)||document.querySelector('[data-section="'+tab+'"]')||document.getElementById(tab);tabResults.push({tab,panelFound:Boolean(panel),active:Boolean(panel&&(panel.classList.contains("active")||!panel.classList.contains("hidden")))});}
  if(original)tabButtons.find(b=>b.dataset.tab===original)?.click();
  let apiRoundTrip=false,apiDetail="";
  try{let value=null;switch(route){
   case "performance":value=await window.saeed.system.getResourceSnapshot();apiRoundTrip=Boolean(value&&typeof value==="object");break;
   case "settings":value=await window.saeed.system.getSettings();apiRoundTrip=Boolean(value&&typeof value==="object");break;
   case "add-ons":value=await window.saeed.addons.catalog();apiRoundTrip=value!==null&&value!==undefined;break;
   case "learning":value=await window.saeed.learning.list();apiRoundTrip=Array.isArray(value);break;
   case "status":value=await window.saeed.system.getDiagnosticSnapshot();apiRoundTrip=Boolean(value&&typeof value==="object");break;
   case "3d-status":value=await window.saeed.character.get3DStatus();apiRoundTrip=Boolean(value&&typeof value==="object");break;
   case "character-settings":value=await window.saeed.character.getPendingCharacter();apiRoundTrip=Boolean(value?.data&&(value.data.byteLength||value.data.length));break;
   case "update-status":value=await window.saeed.system.getUpdateSnapshot();apiRoundTrip=value!==null&&value!==undefined;break;
   case "chat":value=await window.saeed.system.getSettings();apiRoundTrip=Boolean(value&&typeof value==="object");break;
   case "character":value=await window.saeed.character.getCharacter3DSettings();apiRoundTrip=Boolean(value&&typeof value==="object");break;
  }apiDetail=apiRoundTrip?"API read-back returned a value":"API read-back returned no usable value";}catch(error){apiDetail=String(error?.message||error)}
  return {title,expectedTitle:expected[route],titleOk:title===expected[route],readyState,hasPreload,buttons,buttonInventory,tabResults,apiRoundTrip,apiDetail};
 }
 const screen=(name,key,open,requiresCharacter=false,displayName=name)=>async()=>{
  await closeEverything();
  try{
   await open();await pause(500);const win=key==="chatHost"?ensureChatHost().getChatWindow():getState()[key];const opened=Boolean(win&&!win.isDestroyed()&&win.isVisible());
   check(displayName+" — opens",opened,{exists:Boolean(win&&!win.isDestroyed()),visible:opened,windowCount:windows().length,requiresCharacter});
   if(opened){
    const page=await win.webContents.executeJavaScript("("+probeFeatureScreen.toString()+")("+JSON.stringify(name)+")");
    const tabsOk=(page?.tabResults||[]).every(t=>t.panelFound&&t.active);
    check(displayName+" — screen, tabs, API and button inventory",page?.readyState==="complete"&&page?.titleOk===true&&page?.hasPreload&&page?.buttons>0&&tabsOk&&page?.apiRoundTrip===true&&Array.isArray(page?.buttonInventory)&&page.buttonInventory.length===page.buttons,{expectedTitle:page?.expectedTitle||null,title:page?.title||null,readyState:page?.readyState||null,hasPreload:Boolean(page?.hasPreload),buttonCount:page?.buttons||0,buttons:page?.buttonInventory||[],tabResults:page?.tabResults||[],apiRoundTrip:Boolean(page?.apiRoundTrip),apiDetail:page?.apiDetail||null});
   }
  }catch(error){check(displayName+" — opens",false,{error:String(error?.stack||error)})}
  await closeEverything();
  check(displayName+" — closes and releases its window",featureWindows().length===0&&visibleWindows().length===0,{windowCount:windows().length,visibleWindowCount:visibleWindows().length,featureWindowCount:featureWindows().length,remaining:windows().map(w=>w.getTitle())});
 };
 try{
  await closeEverything();
  check("hidden-idle-has-no-feature-windows",featureWindows().length===0&&visibleWindows().length===0,{windowCount:windows().length,visibleWindowCount:visibleWindows().length,featureWindowCount:featureWindows().length,remaining:windows().map(w=>w.getTitle())});
  for(const fn of [
   screen("chat-window","chatHost",()=>ensureChatHost().showChat(),false,"Chat screen"),
   screen("character-window","characterWin",()=>characterApi.showCharacter(),true,"3D Character screen"),
   screen("performance-window","performanceWin",showPerformance,false,"Performance screen"),
   screen("settings-window","settingsWin",showSettings,false,"Settings screen"),
   screen("add-ons-window","addonsWin",showAddons,false,"Add-ons screen"),
   screen("learning-window","learningWin",showLearning,false,"Learning screen"),
   screen("status-window","statusWin",showStatus,false,"Status screen"),
   screen("3d-status-window","threeDStatusWin",show3DStatus,true,"3D Status screen"),
   screen("character-settings-window","characterSettingsWin",showCharacterSettings,true,"Character Settings screen"),
   screen("update-status-window","updateStatusWin",showUpdateStatus,false,"Update screen")
  ])await fn();
  await closeEverything();
  await ensureChatHost().showChat();await pause(450);await ensureBrain();
  check("chat-open-keeps-brain-active-with-mic-off",ensureBrainHost().isActive()&&getCurrentMicMode()==="off",{brainActive:ensureBrainHost().isActive(),micMode:getCurrentMicMode(),chatExists:Boolean(ensureChatHost().getChatWindow())});
  await ensureChatHost().closeChat();await pause(120);
  check("chat-close-releases-brain-when-mic-off",!ensureBrainHost().isActive(),{brainActive:ensureBrainHost().isActive(),micMode:getCurrentMicMode()});
  await characterApi.showCharacter();await pause(250);
  const character=getState().characterWin;
  check("character-only-surface-is-visible",Boolean(character&&!character.isDestroyed()&&character.isVisible())&&visibleWindows().length===1&&featureWindows().length===0,{visible:Boolean(character&&!character.isDestroyed()&&character.isVisible()),windowCount:windows().length,visibleWindowCount:visibleWindows().length,featureWindowCount:featureWindows().length,windows:windows().map(w=>w.getTitle())});

  await ensureChatHost().showChat();await pause(250);
  check("chat-open-does-not-change-character-visibility",Boolean(getState().characterWin&&!getState().characterWin.isDestroyed()&&getState().characterWin.isVisible()),{characterVisible:Boolean(getState().characterWin&&!getState().characterWin.isDestroyed()&&getState().characterWin.isVisible()),visibleWindows:visibleWindows().map(w=>w.getTitle())});
  await ensureChatHost().closeChat();await pause(150);
  check("chat-close-does-not-close-character",Boolean(getState().characterWin&&!getState().characterWin.isDestroyed()&&getState().characterWin.isVisible()),{characterExists:Boolean(getState().characterWin&&!getState().characterWin.isDestroyed()),characterVisible:Boolean(getState().characterWin&&!getState().characterWin.isDestroyed()&&getState().characterWin.isVisible())});
  await showPerformance();await pause(250);
  check("performance-open-does-not-change-visible-character",Boolean(getState().characterWin&&!getState().characterWin.isDestroyed()&&getState().characterWin.isVisible()),{characterVisible:Boolean(getState().characterWin&&!getState().characterWin.isDestroyed()&&getState().characterWin.isVisible()),visibleWindows:visibleWindows().map(w=>w.getTitle())});
  closeKey("performanceWin");await pause(150);
  check("performance-close-does-not-close-character",Boolean(getState().characterWin&&!getState().characterWin.isDestroyed()&&getState().characterWin.isVisible()),{characterExists:Boolean(getState().characterWin&&!getState().characterWin.isDestroyed()),characterVisible:Boolean(getState().characterWin&&!getState().characterWin.isDestroyed()&&getState().characterWin.isVisible())});
  await characterApi.hideCharacter();
  await ensureChatHost().showChat();await pause(200);
  check("chat-open-does-not-resurrect-hidden-character",Boolean(getState().characterWin&&!getState().characterWin.isDestroyed()&&!getState().characterWin.isVisible()),{characterVisible:Boolean(getState().characterWin&&!getState().characterWin.isDestroyed()&&getState().characterWin.isVisible()),visibleWindows:visibleWindows().map(w=>w.getTitle())});
  await ensureChatHost().closeChat();await pause(150);
  await showPerformance();await pause(200);
  check("performance-open-does-not-resurrect-hidden-character",Boolean(getState().characterWin&&!getState().characterWin.isDestroyed()&&!getState().characterWin.isVisible()),{characterVisible:Boolean(getState().characterWin&&!getState().characterWin.isDestroyed()&&getState().characterWin.isVisible()),visibleWindows:visibleWindows().map(w=>w.getTitle())});
  closeKey("performanceWin");await characterApi.showCharacter();await pause(200);
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
  check("final-idle-leaves-only-tray",featureWindows().length===0&&visibleWindows().length===0,{windowCount:windows().length,visibleWindowCount:visibleWindows().length,featureWindowCount:featureWindows().length,windows:windows().map(w=>w.getTitle())});
 }catch(error){report.error=String(error?.stack||error);check("lifecycle-exception",false,{error:report.error})}
 try{stopCpuMonitoring()}catch{}
 const result=finish();
 setTimeout(()=>{try{app.exit(result.passed?0:1)}catch{}},150);
 return result;
}
async function runResource(deps){
 const {app,BrowserWindow,getState,characterApi,showPerformance,ensureChatHost,ensureBrain,ensureBrainHost,getAgent,setMicMode,getCurrentMicMode,ensureVoiceHost,getResourceService,characterHost}=deps;
 const output=process.env.SAEED_CI_RESOURCE_REPORT||path.join(process.cwd(),"dist","ci-ram-cpu-report.json");
 const {report,check,finish}=makeReport("ram-cpu",output),samples=[];
 const pause=ms=>wait(ms);
 const windows=()=>BrowserWindow.getAllWindows().filter(w=>w&&!w.isDestroyed());
 const visibleWindows=()=>windows().filter(w=>{try{return w.isVisible()}catch{return false}});
 const featureWindows=()=>windows().filter(w=>w!==getState().characterWin);
 const sample=async label=>{await pause(450);const item=getResourceService().resourceSnapshot(label);samples.push(item);const finite=n=>Number.isFinite(Number(n))&&Number(n)>=0;const good=finite(item.rssMB)&&finite(item.heapUsedMB)&&finite(item.saeedTotal?.workingSetMB)&&finite(item.saeedTotal?.privateMB)&&finite(item.saeedTotal?.cpuPercent)&&Number(item.saeedTotal?.processCount)>0&&Array.isArray(item.processes)&&item.processes.every(p=>finite(p.workingSetMB)&&finite(p.privateMB)&&finite(p.cpuPercent));check("resource-sample-"+label,good,{label,rssMB:item.rssMB,heapUsedMB:item.heapUsedMB,processCount:item.processCount,processes:item.processes?.map(p=>({pid:p.pid,type:p.type,name:p.name,cpuPercent:p.cpuPercent,workingSetMB:p.workingSetMB,privateMB:p.privateMB}))||[],windows:item.windows?.map(w=>w.title)||[]});return item};
 try{
  await characterApi.hideCharacter();await sample("idle-tray-only");
  await showPerformance();await sample("performance-open");const perf=getState().performanceWin;try{if(perf&&!perf.isDestroyed())perf.destroy()}catch{}await characterApi.hideCharacter();await sample("performance-closed-idle");
  await ensureChatHost().showChat();await ensureBrain();await sample("chat-open-brain-active");await ensureChatHost().closeChat();await pause(120);await sample("chat-closed-brain-released");
  await characterApi.showCharacter();
  const readyRig=await characterHost.command({action:"getRig"});
  check("resource-character-rig-ready",readyRig?.ok===true&&Array.isArray(readyRig.bones)&&readyRig.bones.length>0,{ok:Boolean(readyRig?.ok),boneCount:readyRig?.bones?.length||0,error:readyRig?.error||null});
  await sample("character-visible-idle");
  const motion=await characterHost.command({action:"play",motion:"wave",options:{priority:100,blend:.01}});await sample("character-animation-running");await characterHost.command({action:"stopAll"});
  check("resource-animation-state-reached",motion?.ok===true,{ok:Boolean(motion?.ok),error:motion?.error||null});
  await ensureBrain();const agent=getAgent();agent.settings={...agent.settings,permissions:{...(agent.settings?.permissions||{}),microphone:"allow"}};
  const micOn=await setMicMode("on");
  const micModeImmediately=getCurrentMicMode(),brainActiveImmediately=ensureBrainHost().isActive(),micDiagnosticsImmediately=ensureVoiceHost().getMicModeDiagnostics?.()||null;
  await sample("character-and-mic-on");
  const micModeAfterSample=getCurrentMicMode(),brainActiveAfterSample=ensureBrainHost().isActive(),micDiagnosticsAfterSample=ensureVoiceHost().getMicModeDiagnostics?.()||null;
  check("resource-mic-state-reached",micOn===true&&micModeImmediately==="on"&&brainActiveImmediately&&micModeAfterSample==="on"&&brainActiveAfterSample,{micOn:Boolean(micOn),micModeImmediately,brainActiveImmediately,micMode:micModeAfterSample,brainActive:brainActiveAfterSample,micDiagnosticsImmediately,micDiagnosticsAfterSample});
  await setMicMode("off");await sample("mic-off-brain-released");
  await characterApi.hideCharacter();
  // Allow renderer/GPU work to settle before measuring tray-only idle.
  await wait(1800);
  const last=await sample("final-tray-only");
  check("final-resource-state-has-no-windows",last.windows.every(w=>!w.title||w.title===getState().characterWin?.getTitle())&&visibleWindows().length===0&&featureWindows().length===0,{windows:last.windows.map(w=>w.title),visibleWindowCount:visibleWindows().length,featureWindowCount:featureWindows().length,processCount:last.saeedTotal?.processCount});
 }catch(error){report.error=String(error?.stack||error);check("resource-monitor-exception",false,{error:report.error})}
 report.resourceSamples=samples;
 const result=finish();
 setTimeout(()=>{try{app.exit(result.passed?0:1)}catch{}},150);
 return result;
}
module.exports={runBrainLearning,runLifecycle,runResource};
