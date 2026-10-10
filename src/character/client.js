(()=>{const button=document.getElementById("micToggle"),icon=document.getElementById("micToggleIcon"),label=document.getElementById("micToggleLabel"),character=document.getElementById("character"),runtime=()=>window.saeedCharacterRuntime,controller=()=>runtime()?.controller;
function characterDiagnostic(level,stage,message,meta={}){try{window.saeed?.system?.reportDiagnostic?.(level,stage,message,{domain:"3D",...meta})}catch{}}
function characterFailure(action,error,meta={}){const message=error?.stack||error?.message||String(error||"Unknown character error");characterDiagnostic("ERROR","CHARACTER COMMAND",message,{action,...meta});return{ok:false,error:message,diagnostic:{domain:"3D",stage:"CHARACTER COMMAND",action,message}}}let dragging=false,lastX=0,lastY=0;
async function executeCharacterCommand(command={}){
 const x=command||{};
 const action=String(x.action||"");
 const lightweight=action==="status"||action==="listMotions";
 const needsBones=action==="boneNames"||action==="getRig"||action==="jointRotation"||action==="autoMap"||action==="bindSlot"||action==="setBoneRotation"||action==="setBonePosition"||action==="setBoneTransform"||action==="setBoneEditorRotation"||action==="resetBoneToRest"||action==="boneRotation"||action==="bonePosition"||action==="saveRestPose"||action==="normalizeRestPose"||action==="snapshotRestPose"||action==="beginAuthoring"||action==="endAuthoring"||action==="stop"||action==="stopAll"||action==="setAnimationEnabled"||action==="setAnimationPaused"||action==="resetPose";
 const directBonePose=action==="pose"&&command?.pose?.__bones&&typeof command.pose.__bones==="object";
 const captureRestPose=action==="pose"&&command?.pose?.__captureRest===true;
 const requiresRig=!lightweight&&!needsBones&&!directBonePose&&!captureRestPose;
 if(action==="status"){
  const c=controller(),s=c?.status?.();
  if(c&&s!==undefined)return{ok:true,status:s};
 }
 const deadline=Date.now()+(requiresRig?25000:15000);
 while(Date.now()<deadline){
  const c=controller(),engine=runtime()?.engine;
  if(c){
   try{
    const engineStatus=engine?.getCharacterPoseStatus?.();
    const names=engine?.getAvailableBoneNames?.()||[];
    if(engineStatus?.loaded&&names.length){
     if(requiresRig){
      const current=c.status?.();
      if(current?.characterLoaded&&!Object.keys(current?.autoRig||{}).length){
       try{c.onCharacterLoaded?.()}catch{}
      }
      const bound=c.status?.();
      if(bound?.characterLoaded&&Object.keys(bound?.autoRig||{}).length)break;
     }else break;
    }
   }catch{}
  }
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 const c=controller(),engine=runtime()?.engine;
 if(!c)return characterFailure(action,"Character controller unavailable",{reason:"controller-missing"});
 try{
  const finalPose=engine?.getCharacterPoseStatus?.()||{};
  const finalNames=engine?.getAvailableBoneNames?.()||[];
  if(!finalPose?.loaded||!finalNames.length)characterDiagnostic("ERROR","CHARACTER SKELETON UNAVAILABLE","Authoritative Character Engine has no exposed GLB skeleton bones",{action,loaded:Boolean(finalPose?.loaded),boneCount:finalNames.length,pose:finalPose});
  if(x.action==="play"){const ok=c.play(String(x.motion||"idle"),x.options||{});return{ok,status:c.status()}}
  if(x.action==="stop"){const ok=c.stop(x.motion);return{ok,status:c.status()}}
  if(x.action==="stopAll"){const ok=c.stopAll();return{ok,status:c.status()}}
  if(x.action==="setAnimationEnabled"){const enabled=c.setAnimationEnabled?.(x.enabled!==false);return{ok:true,enabled,status:c.status()}}
  if(x.action==="setAnimationPaused"){const paused=c.setAnimationPaused?.(x.paused===true);return{ok:true,paused,status:c.status()}}
  if(x.action==="jointRotation"){const ok=c.setLogicalJointRotation?.(String(x.slot||""),x.rotation||{});return{ok:Boolean(ok),rotation:engine?.getBoneRotation?.(String((engine?.getBoneMap?.()||{})[String(x.slot||"")]?.name||""))||null,status:c.status()}}
  if(x.action==="pose"){const pose=c.setPose(x.pose||{});return{ok:Boolean(pose),pose,status:c.status()}}
  if(x.action==="idlePose"){const pose=c.setIdlePose(x.pose||{});return{ok:true,pose,status:c.status()}}
  if(x.action==="resetPose"){const ok=c.resetPose();return{ok,status:c.status()}}
  if(x.action==="remap"){const ok=c.remap(x.mapping||{});return{ok,status:c.status()}}
  if(x.action==="autoMap"){const result=c.autoMap?.()||{ok:false,error:"Automatic rig mapping unavailable"};return{...result,status:c.status()}}
  if(x.action==="defineMotion"){const motion=c.defineMotion(x.motion||{});return{ok:true,motion,status:c.status()}}
  if(x.action==="deleteMotion"){const ok=c.deleteMotion(String(x.id||""));return{ok,status:c.status()}}
  if(x.action==="setMotionEnabled"){const ok=c.setMotionEnabled?.(String(x.id||""),x.enabled!==false);return{ok,status:c.status()}}
  if(x.action==="listMotions")return{ok:true,motions:c.listMotions(),status:c.status()};
  if(x.action==="beginAuthoring"){const ok=c.beginAuthoring?.()??false;return{ok:Boolean(ok),status:c.status()}}
  if(x.action==="endAuthoring"){const ok=c.endAuthoring?.()??false;return{ok:Boolean(ok),status:c.status()}}
  if(x.action==="status")return{ok:true,status:c.status()};
  if(x.action==="semantic")return c.semantic(x.intent,x.options||{});
  if(x.action==="face"){const applied=Boolean(c.face?.expression?.(x.expression,x.intensity));return{ok:applied,result:applied?"expression-applied":"expression-unavailable",status:c.face?.status?.()||null}};
  if(x.action==="blink")return{ok:Boolean(c.face?.blink?.())};
  if(x.action==="lookAt")return{ok:Boolean(c.face?.lookAt?.(x.x,x.y,x.z))};
  if(x.action==="viseme")return{ok:Boolean(c.face?.viseme?.(x.viseme,x.value))};
  if(x.action==="fingers")return{ok:Boolean(c.fingers?.curl?.(x.hand,x.amount))};
  if(x.action==="getRig"){const bones=engine?.getAvailableBoneNames?.()||[];const mapping=engine?.getBoneMap?.()||{};return{ok:Boolean(bones.length),bones,mapping,status:c.status()};}
  if(x.action==="boneNames"){const bones=engine?.getAvailableBoneNames?.()||[];if(!bones.length)return characterFailure(action,"No actual skeleton bone names exposed",{reason:"empty-skeleton"});return{ok:true,bones}};
  if(x.action==="saveRestPose"){const rest=c.saveRestPose?.();return{ok:Boolean(rest?.persisted),restPose:rest||null,persisted:Boolean(rest?.persisted),status:c.status()}}
  if(x.action==="normalizeRestPose"){const normalization=c.normalizeRestPose?.();return{ok:Boolean(normalization),normalization:normalization||null,status:c.status()}}
  if(x.action==="boneRotation")return{ok:true,rotation:engine?.getBoneEditorRotation?.(String(x.bone||""))||null};
  if(x.action==="bindSlot"){const ok=c.bindSlot?.(String(x.slot||""),String(x.bone||""));return{ok:Boolean(ok),mapping:c.engine?.getCharacterRigAutoMap?.()||{},status:c.status()}}
  if(x.action==="setBoneRotation"){const ok=c.setBoneRotation?.(String(x.bone||""),x.rotation||{})??engine?.setBoneRotation?.(String(x.bone||""),x.rotation||{});return{ok:Boolean(ok),rotation:engine?.getBoneRotation?.(String(x.bone||""))||null}};
  if(x.action==="setBoneTransform"){const ok=engine?.setBoneTransform?.(String(x.bone||""),x.transform||{});return{ok:Boolean(ok),status:c.status(),transform:engine?.getCharacterPoseStatus?.()?.bones?.[String(x.bone||"")]||null}};
  if(x.action==="bonePosition")return{ok:true,position:engine?.getBonePosition?.(String(x.bone||""))||null};
  if(x.action==="setBonePosition"){const ok=engine?.setBonePosition?.(String(x.bone||""),x.position||{});return{ok:Boolean(ok),position:engine?.getBonePosition?.(String(x.bone||""))||null}};
  if(x.action==="setBoneEditorRotation"){const ok=engine?.setBoneEditorRotation?.(String(x.bone||""),x.rotation||{});return{ok:Boolean(ok),rotation:engine?.getBoneEditorRotation?.(String(x.bone||""))||null}};
  if(x.action==="resetBoneToRest"){const bone=String(x.bone||"");const rotation=c.resetBoneToRest?.(bone);return{ok:Boolean(rotation),rotation:rotation||null,status:c.status()}};
  if(x.action==="setBehavior"){const behavior=c.setBehavior?.(x.value||{})||{};return{ok:true,behavior,status:c.status()}}
  if(x.action==="calibrateJoint"){const ok=c.calibrateJoint?.(String(x.slot||""),x.rotation||{});return{ok:Boolean(ok),calibration:c.retargeter?.status?.().calibration||{},status:c.status()}}
  if(x.action==="snapshotRestPose")return{ok:true,bones:engine?.snapshotBoneRotations?.()||{}};
  return{ok:false,error:"Unknown character controller action"};
 }catch(error){return characterFailure(action,error,{payload:x})}
}
window.saeed.character.onCharacterCommand?.(async(id,command)=>{
 const result=await executeCharacterCommand(command);
 if(result?.ok===false)characterDiagnostic("ERROR","CHARACTER COMMAND FAILED",result.error||"Unknown command failure",{action:String(command?.action||""),result});
 window.saeed.character.characterCommandResult?.(id,result);
});
if(character){character.addEventListener("mousedown",e=>{if(e.button!==0||e.target.closest("button,input,a,select,textarea"))return;dragging=true;lastX=e.screenX;lastY=e.screenY;controller()?.touch?.();e.preventDefault()});window.addEventListener("mousemove",e=>{if(!dragging)return;const dx=e.screenX-lastX,dy=e.screenY-lastY;lastX=e.screenX;lastY=e.screenY;window.saeed.character.moveWindowBy(dx,dy)});window.addEventListener("mouseup",()=>{dragging=false;controller()?.touch?.()});character.addEventListener("contextmenu",()=>controller()?.handleEvent?.({type:"right-click"}));character.addEventListener("wheel",()=>controller()?.handleEvent?.({type:"zoom"}),{passive:true})}
if(button&&icon&&label&&window.saeed){const render=mode=>{const on=String(mode||"off")==="on";button.classList.toggle("on",on);button.classList.toggle("off",!on);button.setAttribute("aria-pressed",String(on));button.title=on?"Turn microphone OFF":"Turn microphone ON";icon.textContent=on?"Ⅱ":"▶";label.textContent=on?"MIC ON":"MIC OFF"};button.addEventListener("click",async e=>{e.preventDefault();e.stopPropagation();const on=button.classList.contains("on");button.disabled=true;try{await window.saeed.voice.setMicMode(on?"off":"on")}catch(error){window.saeed.system.reportDiagnostic?.("ERROR","MIC BUTTON",error?.message||String(error))}finally{button.disabled=false}});window.saeed.voice.onMicMode?.(render)}
window.saeed.character.onCharacterBehavior?.(e=>controller()?.handleEvent?.(e));window.saeed.character.onCharacterVisibility?.(s=>{const visible=s!=="hidden";controller()?.setVisible?.(visible);if(visible){runtime()?.engine?.wakeRender?.();requestAnimationFrame(()=>runtime()?.engine?.wakeRender?.())}});document.addEventListener("visibilitychange",()=>{if(!document.hidden){runtime()?.engine?.wakeRender?.();requestAnimationFrame(()=>runtime()?.engine?.wakeRender?.())}});window.addEventListener("load",()=>{controller()?.setVisible?.(!document.hidden);if(!document.hidden){runtime()?.engine?.wakeRender?.()}});window.addEventListener("beforeunload",()=>{try{controller()?.destroy?.()}catch{}try{runtime()?.engine?.destroy?.()}catch{}})})();