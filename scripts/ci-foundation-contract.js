const fs=require("fs"),path=require("path");
const root=path.join(__dirname,"..");
const failures=[];
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const exists=p=>fs.existsSync(path.join(root,p));
const must=(ok,msg)=>{if(!ok)failures.push(msg)};

const canonical=["src/main","src/renderer","src/character","src/tools","src/addons","src/learning","src/main/runtime.js","src/preload.js","src/character/CharacterEngine.js","src/character/CharacterController.js","src/main/character/character-host.js","src/main/brain/brain.js","src/main/conversation/conversation-agent.js","src/main/voice/voice-host.js","src/tools/registry.js"];
for(const p of canonical)must(exists(p),"Missing canonical foundation path: "+p);

must(!exists("src/avatar.js"),"Legacy src/avatar.js still exists");
must(exists(".github/workflows/build-windows-electron.yml"),"Windows build workflow is missing");

const workflow=read(".github/workflows/build-windows-electron.yml");
must(/^on:\s*$/m.test(workflow)&&/workflow_dispatch:/m.test(workflow),"Windows build workflow must be manual-only");
must(!/^\s*(push|pull_request|schedule):/m.test(workflow),"Automatic build trigger detected in Windows workflow");
const suiteNames=[1,2,3,4];
for(const n of suiteNames){
 const marker=`- name: Packaged EXE E2E Suite ${n} `;
 const start=workflow.indexOf(marker);
 const end=start<0?-1:workflow.indexOf("\n      - name:",start+marker.length);
 const block=start<0?"":workflow.slice(start,end<0?workflow.length:end);
 must(start>=0,`Missing independent E2E Suite ${n} step`);
 must(block.includes("if: always()"),`E2E Suite ${n} is not forced to run`);
 must(block.includes("continue-on-error: true"),`E2E Suite ${n} can stop the workflow`);
 must(block.includes(`--ci-e2e-suite=${n}`),`E2E Suite ${n} does not launch its own suite`);
 must(block.includes(`ci-e2e-suite-${n}.json`),`E2E Suite ${n} has no dedicated report`);
 must(block.includes("catch {"),`E2E Suite ${n} has no isolated PowerShell error boundary`);
}


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
must(read("src/character/CharacterController.js").includes("AutonomousBehaviorController"),"Character autonomy ownership missing");
must(read("src/main/application/brain-host.js").includes("2*60*1000"),"Brain idle lifecycle contract missing");
must(read("src/main/character/character-host.js").includes("characterLoadGeneration"),"Character stale-load generation guard missing");
must(read("src/character/CharacterEngine.js").includes("boneRest.set"),"CharacterEngine does not capture GLB rest pose");
must(exists("assets/Saeed_AI-3D.glb"),"Authoritative Saeed GLB is missing");
must(read("src/main/character/character-host.js").includes('path.join(__dirname,"..","..","..","assets","Saeed_AI-3D.glb")'),"Character startup does not reference authoritative bundled GLB");
must(!read("src/main/character/character-host.js").includes("const saved=readPersistedCharacter()"),"Character startup must not replace authoritative bundled GLB with persisted/automatic GLB");


if(failures.length){
 console.error("Foundation contract FAILED");
 for(const f of failures)console.error(" - "+f);
 process.exit(1);
}
console.log("Foundation contract PASSED");
