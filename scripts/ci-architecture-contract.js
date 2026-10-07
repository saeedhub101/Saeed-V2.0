const fs=require("fs"),path=require("path");
const root=path.join(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const failures=[];
function must(condition,message){if(!condition)failures.push(message)}
const controller=read("src/character/CharacterController.js");
const client=read("src/character/client.js");
const avatar=read("src/avatar.js");
const voice=read("src/core/voice/voice-host.js");
const workflow=read(".github/workflows/build-windows-electron.yml");
must(fs.existsSync(path.join(root,"src/character/AutonomousBehaviorController.js")),"AutonomousBehaviorController.js is missing");
must(controller.includes("AutonomousBehaviorController"),"CharacterController does not own AutonomousBehaviorController");
for(const legacy of ["window.saeedAvatar","window.saeedCharacterController","window.saeedAvatarLoadData","window.saeedCharacterBehavior","window.saeedAnimationController","window.__saeedPendingCharacterData"]){
 must(!controller.includes(legacy),`legacy character global remains in CharacterController: ${legacy}`);
 must(!client.includes(legacy),`legacy character global remains in character client: ${legacy}`);
 must(!avatar.includes(legacy),`legacy character global remains in avatar engine: ${legacy}`);
}
must(client.includes("window.saeedCharacterRuntime"),"character client is not using the canonical runtime");
must(avatar.includes("window.saeedCharacterRuntime.engine"),"3D engine is not owned by canonical runtime");
must(voice.includes("ensureTts"),"Voice host has no TTS lifecycle owner");
must(voice.includes('ttsReady=false'),"TTS lifecycle state is missing");
must(read("src/core/application/brain-host.js").includes("2*60*1000"),"Brain idle timeout is not two minutes");
must(workflow.includes("workflow_dispatch:"),"Windows build workflow is not manual-only");
const characterArch=read("Character_Architecture.md");
must(characterArch.includes("AutonomousBehaviorController"),"Character architecture does not document autonomous ownership");
if(failures.length){console.error("Architecture contract FAILED");for(const f of failures)console.error(" - "+f);process.exit(1)}
console.log("Architecture contract PASSED");
