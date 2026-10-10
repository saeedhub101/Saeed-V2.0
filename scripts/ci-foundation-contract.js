const fs=require("fs"),path=require("path");
const root=path.join(__dirname,"..");
const failures=[];
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const exists=p=>fs.existsSync(path.join(root,p));
const must=(ok,msg)=>{if(!ok)failures.push(msg)};

const canonical=["src/main","src/renderer","src/character","src/tools","src/addons","src/learning","src/main/runtime.js","src/preload.js","src/character/CharacterEngine.js","src/character/CharacterController.js","src/main/character/character-host.js","src/main/brain/brain.js","src/main/conversation/conversation-agent.js","src/main/voice/voice-host.js","src/tools/registry.js"];
for(const p of canonical)must(exists(p),"Missing canonical foundation path: "+p);

must(!exists("src/avatar.js"),"Legacy src/avatar.js still exists");
must(exists("src/addons/window.html")&&exists("src/addons/window.js"),"Add-ons / Plug-ins page assets are missing");
must(exists("src/learning/window.html")&&exists("src/learning/window.js"),"Learning / Teach Mode page assets are missing");
const windowManager=read("src/main/application/window-manager.js");
const trayControls=read("src/main/application/system-controls.js");
must(windowManager.includes('path.join(rootPath,"addons","window.html")'),"Add-ons page is not connected to the current window manager path");
must(windowManager.includes('path.join(rootPath,"learning","window.html")'),"Learning page is not connected to the current window manager path");
must(windowManager.includes('loadFileBounded(win,path.join(rootPath,"addons","window.html"))'),"Add-ons page does not use bounded, diagnosable loading");
must(windowManager.includes('loadFileBounded(win,path.join(rootPath,"learning","window.html"))'),"Learning page does not use bounded, diagnosable loading");
must(trayControls.includes('label:"Add-ons / Plug-ins",click:showAddons'),"Tray menu cannot open Add-ons / Plug-ins");
must(trayControls.includes('label:"Learning / Teach Mode",click:showLearning'),"Tray menu cannot open Learning / Teach Mode");
const studio=read("src/character-studio.html");
const engine=read("src/character/CharacterEngine.js");
const glbBytes=read("src/character/glb-bytes.js");
const glbBytesTest=read("scripts/ci-glb-bytes.js");
const packageJson=read("package.json");
const testRunner=read("scripts/run-all-tests.js");
must(packageJson.includes('"test": "node scripts/run-all-tests.js"'),"npm test must invoke the complete test orchestrator");

must(engine.includes('import {normalizeGlbArrayBuffer} from "./glb-bytes.js"')&&engine.includes("normalizeGlbArrayBuffer(data)"),"CharacterEngine does not use the canonical GLB byte normalizer");
must(engine.includes("candidateMeshCount=countSceneMeshes(parsed.scene)")&&engine.includes("no renderable mesh in its active scene"),"CharacterEngine must reject invisible GLB candidates before replacing the current character");
must(glbBytes.includes("ArrayBuffer.isView(value)")&&glbBytes.includes("value.byteOffset")&&glbBytes.includes("missing glTF magic"),"GLB byte normalization does not protect typed-array offsets and binary headers");
must(glbBytesTest.includes("offset Uint8Array")&&glbBytesTest.includes("serialized Node Buffer")&&testRunner.includes('path.join(root, "scripts", "ci-glb-bytes.js")'),"GLB byte normalization regression tests are not wired into npm test");
must(exists("scripts/ci-authoritative-glb-rig.js")&&testRunner.includes('path.join(root, "scripts", "ci-authoritative-glb-rig.js")'),"Authoritative GLB rig mapping test is not wired into npm test");
const controller=read("src/character/CharacterController.js");
must(read("src/character/AutoRigMapper.js").includes("const REQUIRED_RIG=[]")&&read("src/character/AutoRigMapper.js").includes("const OPTIONAL_RIG=Object.keys(aliases)")&&controller.includes("Partial rig: missing")&&controller.includes("Object.keys(mapped).length>0"),"Rig mapping must allow partial skeletons and animate available mapped joints");
const characterHostForChecks=read("src/main/character/character-host.js");
must(!characterHostForChecks.includes("!(Number(result?.boneCount)>=1)")&&characterHostForChecks.includes("!(Number(result?.meshCount)>=1)"),"Character host must accept visible meshes without requiring a skeleton");
for(const [name,src,tokens] of [
 ["GLB engine",engine,["GLTFLoader","getCharacterPoseStatus","getAvailableBoneNames","setBoneEditorRotation"]],
 ["Character controller",controller,["saveRestPose","defineMotion","play("]],
 ["Character Studio",studio,["setBoneEditorRotation","saveRestPose","resetBoneToRest","defineMotion","loadMotion"]],
 ["Character host",characterHostForChecks,['"setBoneEditorRotation"','"saveRestPose"','"resetBoneToRest"']]
])for(const token of tokens)must(src.includes(token),name+" missing required GLB/rig/rest-pose/animation contract: "+token);
const transcriptUi=read("src/renderer/character.html");
const transcriptCss=read("src/renderer/style.css");
const voiceClient=read("src/renderer/voice/voice-client.js");
const composition=read("src/main/application/runtime-composition.js");
const preloadSource=read("src/preload.js");
must((preloadSource.match(/characterLoadResult:/g)||[]).length===1,"Preload exposes duplicate characterLoadResult API entries");
must(transcriptUi.includes("saeedTranscriptLabel")&&transcriptCss.includes("saeedTranscriptLabel"),"Optional microphone transcript label UI is missing");
must(voiceClient.includes("saeedShowTranscript?.(clean)")&&voiceClient.includes("saeedShowTranscript?.(text)"),"Realtime/local STT results are not routed to the optional transcript label");
must(composition.includes("transcript-label.json")&&composition.includes("toggleTranscriptLabel"),"Taskbar transcript label setting is not persisted");
must(trayControls.includes("microphone transcript label"),"Taskbar has no microphone transcript label toggle");
must(preloadSource.includes("onTranscriptLabel")&&preloadSource.includes("getTranscriptLabelEnabled"),"Transcript label renderer API is missing");
const learningSource=read("src/learning/index.js");
const brainSource=read("src/main/brain/brain.js");
must(learningSource.includes("isCurrent=()=>true")&&learningSource.includes("stale:true"),"Learned skill runner does not stop when the active conversation is cancelled");
must(brainSource.includes("learning().run(this.getDir(),this.registry,learned,{isCurrent:current})"),"Brain does not propagate request cancellation into learned skills");
must(read("src/main/runtime.js").includes('ipcMain.handle("transcript-label:get"'),"Transcript label preference IPC is missing");


must(exists(".github/workflows/build-windows-electron.yml"),"Windows build workflow is missing");

const workflow=read(".github/workflows/build-windows-electron.yml");
must(/^on:\s*$/m.test(workflow)&&/workflow_dispatch:/m.test(workflow),"Windows build workflow must retain a manual dispatch option");
must(/^\s*push:\s*$/m.test(workflow)&&/branches:\s*\n\s*-\s*main/m.test(workflow),"Windows build workflow must automatically run on pushes to main");
must(!/^\s*(pull_request|schedule):/m.test(workflow),"Unexpected non-main automatic trigger detected in Windows workflow");
const characterHost=read("src/main/character/character-host.js");
const characterClient=read("src/character/client.js");
must(characterHost.includes('"setBoneEditorRotation"'),"Rest-relative editor rotation is missing from the skeleton-ready command allowlist");
must(characterClient.includes('action==="setBoneEditorRotation"'),"Rest-relative editor rotation is missing from the client skeleton-ready action list");
const preload=read("src/preload.js");
for(const ns of ["system","character","voice","chat","tools"])must(preload.includes("\n "+ns+":{"),"Missing preload namespace: "+ns);

const rendererFiles=[];
function walk(dir){
 const base=path.join(root,dir);
 if(!fs.existsSync(base))return;
 for(const name of fs.readdirSync(base)){
  const rel=path.join(dir,name),full=path.join(root,rel),stat=fs.statSync(full);
  if(stat.isDirectory())walk(rel);
  else if(/\.js$/i.test(name))rendererFiles.push(rel);
 }
}
walk("src/renderer");
for(const p of ["src/renderer.js","src/status.js","src/settings.js","src/performance.js","src/3d-status.js","src/learning/window.js","src/addons/window.js","src/voice/voice-client.js"])if(exists(p))rendererFiles.push(p);
for(const p of [...new Set(rendererFiles)]){
 const s=read(p);
 const privileged=s.includes('require("electron")')||s.includes("require('electron')")||s.includes('from "electron"')||s.includes("from 'electron'")||s.includes("ipcRenderer");
 must(!privileged,"Privileged Electron API detected in renderer file: "+p);
}
must(!preload.includes("window.saeedAvatar"),"Legacy avatar API exposed by preload");
const registrySource=read("src/tools/registry.js");
const permissionManagerSource=read("src/main/application/permission-manager.js");
const settingsStoreSource=read("src/main/services/settings-store.js");
must(registrySource.includes('require("./memory-tasks"),require("./addons")'),"Tool Registry does not route declared memory/email/MCP capabilities through the canonical dispatcher");
must(!registrySource.includes('permissionPolicy=permissionPolicy||(()=> "allow")'),"Tool Registry must not default unknown permission policies to allow");
must(registrySource.includes('new Set(["email_send","mcp_call_tool"])'),"Email sending and MCP tool calls must require explicit confirmation");
must(!registrySource.includes('name:"credential_store"')&&!registrySource.includes('name:"credential_get"'),"Credential storage/retrieval must not be exposed as model-callable tools");
must(permissionManagerSource.includes('DEFAULT_PERMISSIONS[category]||"ask"'),"Unknown permission categories must fail closed to Always ask");
must(permissionManagerSource.includes("No live confirmation surface; operation denied"),"Permission confirmation must fail closed without a live UI");
must(settingsStoreSource.includes('files:"ask"')&&settingsStoreSource.includes('addons:"ask"')&&settingsStoreSource.includes('mcp:"ask"'),"New installations must default side-effecting/external capabilities to Always ask");
must(read("src/performance.js").includes('execution:"ask",mcp:"ask",addons:"ask"'),"Performance UI does not expose the new secure permission categories");
must(read("src/performance.html").includes('id="permission-mcp"')&&read("src/performance.html").includes('id="permission-addons"'),"Performance UI is missing MCP/add-on permission controls");
must(read("src/tools/registry.js").includes('redactToolArgs(name,args)'),"Tool Registry learning records must redact secrets");
must(read("src/main/brain/model-executor.js").includes('args:redactToolArgs(c.function.name,a)'),"Chat tool events must redact credentials and email bodies");
must(read("src/main/voice/voice-runtime.js").includes('args:redactToolArgs(name,args)'),"Realtime tool events must redact credentials and email bodies");
must(read("src/main/brain/model-executor.js").includes("result:redactToolResult(c.function.name,out)"),"Chat tool result events must redact private email bodies");
must(read("src/main/voice/voice-runtime.js").includes("result:redactToolResult(name,out)"),"Realtime tool result events must redact private email bodies");
must(read("src/tools/redact.js").includes("function redactToolResult(name,result)"),"Private tool-result redaction helper is missing");
must(read("src/tools/email.js").includes('credentials.get(provider,account)')&&!read("src/tools/email.js").includes('password:{type:"string"}'),"Canonical email tools must retrieve saved credentials without exposing passwords in model schemas");
must(read("src/addons/credentials.js").includes("child.stdin.end(JSON.stringify({target:target(provider,account)")&&!read("src/addons/credentials.js").includes('"/pass:"'),"Windows Credential Manager writes must not expose passwords in process arguments");
must(read("src/addons/credentials.js").includes("$d=[Console]::In.ReadToEnd()|ConvertFrom-Json;$t=[string]$d.target;")&&!read("src/addons/credentials.js").includes("CredRead('$t'"),"Credential Manager reads must not interpolate account text into PowerShell");
must(read("src/performance.html").includes('id="emailCredentialPassword"')&&read("src/preload.js").includes("storeEmailCredential:"),"Secure email credential setup UI/IPC is missing");
must(read("src/main/runtime.js").includes('ipcMain.handle("email:credential:store"'),"Secure email credential IPC handler is missing");
must(read("src/addons/email-account-store.js").includes("function validateRecord")&&read("src/addons/email-account-store.js").includes("function save"),"Validated non-secret email server profile storage is missing");
must(read("src/performance.html").includes('id="emailServerHost"')&&read("src/performance.html").includes('id="saveEmailServer"')&&read("src/performance.html").includes('id="testEmailConnection"'),"Email server setup and authentication-test controls are missing");
must(read("src/preload.js").includes("saveEmailAccount:")&&read("src/preload.js").includes("testEmailConnection:"),"Email server profile/test IPC bridge is missing");
must(read("src/main/runtime.js").includes('ipcMain.handle("email:account:save"')&&read("src/main/runtime.js").includes('ipcMain.handle("email:connection:test"'),"Email server profile/test IPC handlers are missing");
must(read("src/addons/email-client.js").includes("smtpVerify")&&read("src/addons/email-client.js").includes("pop3ListMessages")&&read("src/addons/email-client.js").includes("pop3Fetch"),"SMTP authentication verification and POP3 read operations are missing");
must(testRunner.includes('path.join(root, "scripts", "ci-email-protocol.js")')&&testRunner.includes('path.join(root, "scripts", "ci-html-script-syntax.js")'),"Protocol and inline HTML syntax regression suites are not part of npm test");
must(read("src/main/application/brain-host.js").includes("Confirm sending this email?"),"Email send confirmation does not show a send-specific confirmation");
must(read("src/main/application/brain-host.js").includes("Confirm access to this mailbox?")&&read("src/main/application/brain-host.js").includes('detail+="\\nMailbox: "+mailbox'),"Email read confirmation must identify the mailbox being accessed");
must(read("src/character/CharacterController.js").includes("AutonomousBehaviorController"),"Character autonomy ownership missing");
must(read("src/main/application/brain-host.js").includes("2*60*1000"),"Brain idle lifecycle contract missing");
must(read("src/main/character/character-host.js").includes("characterLoadGeneration"),"Character stale-load generation guard missing");
must(read("src/character/CharacterEngine.js").includes("boneRest.set"),"CharacterEngine does not capture GLB rest pose");
const glbValidation=read("src/main/character/glb-validation.js");
must(glbValidation.includes("GLB first chunk is not JSON")&&glbValidation.includes("asset.version"),"GLB candidate structural validation is missing");
must(glbValidation.includes("sceneMeshCount<1")&&!glbValidation.includes("if(sceneSkinnedMeshCount<1)throw")&&read("scripts/ci-glb-candidate-validation.js").includes("visible static mesh without a skeleton"),"GLB validation must accept mesh-only candidates while still requiring a visible mesh");
must(read("src/renderer/character.html").includes("meshCount>0||boneCount>0")&&read("src/renderer/character.html").includes("rigAvailable:boneCount>0"),"Renderer acknowledgement must separate visible mesh loading from rig availability");
must(read("src/main/character/character-store.js").includes("validateGlbCandidate(data)")&&read("src/main/character/character-store.js").includes("fs.renameSync(temporary,file)"),"Persisted GLB is not validated and atomically replaced");
must(read("src/main/character/character-host.js").includes("loadCandidateCharacter")&&read("src/main/character/character-host.js").includes("character:load-result"),"Character replacement does not wait for renderer-confirmed load and skeleton readiness");
must(read("src/main/conversation/conversation-agent.js").includes("invalidateRequests()")&&read("src/main/conversation/conversation-agent.js").includes("if(!isCurrent()||result?.stale)return"),"Conversation changes do not invalidate stale replies");
must(read("src/main/brain/brain.js").includes("isCurrent:current")&&read("src/main/brain/model-executor.js").includes("Stale conversation request cancelled"),"Conversation cancellation is not propagated through API and tool execution");
must(read("src/main/automation/local-executor.js").includes("tryExecute(text,{isCurrent=()=>true}={})")&&read("src/main/automation/local-executor.js").includes("if(!isCurrent())return null"),"Local tool execution does not stop after its conversation becomes stale");
must(registrySource.includes("options={}")&&registrySource.includes("const current=()=>{try{return Boolean(isCurrent())&&!this.emergencyStopped&&generation===this.emergencyGeneration&&!controller.signal.aborted}catch{return false}}")&&registrySource.includes("Stale conversation request cancelled"),"Tool Registry does not guard dispatch against cancelled conversations");
must(read("src/main/brain/model-executor.js").includes("registry.call(name,args,{isCurrent:current})"),"Model tool calls do not propagate conversation cancellation to the registry");
must(read("src/main/voice/voice-host.js").includes("registry?.call?.(name,args,options)"),"Realtime tool calls do not propagate session cancellation to the registry");
must(read("src/renderer/character.html").includes("characterLoadResult")&&read("src/preload.js").includes("characterLoadResult:"),"Character GLB load acknowledgement is missing from renderer/preload");
must(controller.includes("Character is visible as a static mesh; this GLB contains no bones to animate")&&read("src/renderer/character.html").includes("rigAvailable:boneCount>0"),"A mesh-only GLB must load visibly while reporting skeletal animation as unavailable");
must(!read("src/character/CharacterEngine.js").includes("candidateBoneCount<1")&&read("src/character/CharacterEngine.js").includes("rigAvailable:candidateBoneCount>0"),"Character engine must display mesh-only candidates and report rig availability separately");
must(read("src/character/CharacterEngine.js").includes("function getSceneBoneGroups(target=model)")&&read("src/character/CharacterEngine.js").includes("target?.traverse(o=>{if(o?.isBone)add(o)})"),"Candidate skeleton inspection must inspect the parsed candidate, not the currently displayed model");
must(read("src/character/CharacterEngine.js").includes("load(p.data,p.generation).then(result=>p.resolve?.(result),error=>p.reject?.(error))"),"Queued initial GLB load does not resolve its renderer acknowledgement");
must(exists("assets/Saeed_AI-3D.glb"),"Authoritative Saeed GLB is missing");
must(read("src/main/character/character-host.js").includes('path.join(__dirname,"..","..","..","assets","Saeed_AI-3D.glb")'),"Character startup does not reference authoritative bundled GLB");
must(!read("src/main/character/character-host.js").includes("const saved=readPersistedCharacter()"),"Character startup must not replace authoritative bundled GLB with persisted/automatic GLB");


if(failures.length){
 console.error("Foundation contract FAILED");
 for(const f of failures)console.error(" - "+f);
 process.exit(1);
}
console.log("Foundation contract PASSED");
