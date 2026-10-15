(()=>{const button=document.getElementById("micToggle"),icon=document.getElementById("micToggleIcon"),label=document.getElementById("micToggleLabel"),character=document.getElementById("character"),runtime=()=>window.saeedCharacterRuntime,controller=()=>runtime()?.controller;
function characterDiagnostic(level,stage,message,meta={}){try{window.saeed?.system?.reportDiagnostic?.(level,stage,message,{domain:"3D",...meta})}catch{}}
function characterFailure(action,error,meta={}){const message=error?.stack||error?.message||String(error||"Unknown character error");characterDiagnostic("ERROR","CHARACTER COMMAND",message,{action,...meta});return{ok:false,error:message,diagnostic:{domain:"3D",stage:"CHARACTER COMMAND",action,message}}}let dragging=false,lastX=0,lastY=0;
async function executeCharacterCommand(command={}){
 const x=command||{};
 const action=String(x.action||"");
 const lightweight=action==="status"||action==="glbClipList"||action==="playGlbClip"||action==="stopGlbClip"||action==="listMotions"||action==="meshList"||action==="setMeshVisibility"||action==="morphList"||action==="setMorph"||action==="availableAccessories"||action==="accessoriesList"||action==="getVisemeMap"||action==="setVisemeMap"||action==="getMotionAxisFixes"||action==="setMotionAxisFix"||action==="clearMotionAxisFixes"||action==="setUserBusy"||action==="behaviorEvent";
 const needsBones=action==="buildProceduralRig"||action==="fixTPose"||action==="setAxisFix"||action==="boneNames"||action==="getRig"||action==="jointRotation"||action==="autoMap"||action==="remap"||action==="bindSlot"||action==="setBoneRotation"||action==="setBonePosition"||action==="setBoneTransform"||action==="setBoneEditorRotation"||action==="resetBoneToRest"||action==="boneRotation"||action==="bonePosition"||action==="saveRestPose"||action==="normalizeRestPose"||action==="snapshotRestPose"||action==="beginAuthoring"||action==="endAuthoring"||action==="stop"||action==="stopAll"||action==="setAnimationEnabled"||action==="setAnimationPaused"||action==="resetPose"||action==="setAccessory";
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
    if(engineStatus?.loaded&&(names.length||["buildProceduralRig","meshList","setMeshVisibility","morphList","setMorph","availableAccessories","accessoriesList","setAccessory"].includes(action))){
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
  if((!finalPose?.loaded||!finalNames.length)&&action!=="buildProceduralRig")characterDiagnostic("ERROR","CHARACTER SKELETON UNAVAILABLE","Authoritative Character Engine has no exposed GLB skeleton bones",{action,loaded:Boolean(finalPose?.loaded),boneCount:finalNames.length,pose:finalPose});
  if(x.action==="glbClipList")return{ok:true,clips:engine?.listGlbAnimations?.()||[]};\n  if(x.action==="playGlbClip"){c.stopAll?.();return engine?.playGlbAnimation?.(String(x.name??x.index??""),x.options||{})||{ok:false,error:"Embedded GLB animation playback unavailable"}}\n  if(x.action==="stopGlbClip")return engine?.stopGlbAnimation?.()||{ok:false,error:"Embedded GLB animation playback unavailable"}\n  if(x.action==="play"){const ok=c.play(String(x.motion||"idle"),x.options||{});return{ok,status:c.status()}}
  if(x.action==="stop"){const ok=c.stop(x.motion);return{ok,status:c.status()}}
  if(x.action==="stopAll"){const ok=c.stopAll();return{ok,status:c.status()}}
  if(x.action==="setAnimationEnabled"){const enabled=c.setAnimationEnabled?.(x.enabled!==false);return{ok:true,enabled,status:c.status()}}
  if(x.action==="setAnimationPaused"){const paused=c.setAnimationPaused?.(x.paused===true);return{ok:true,paused,status:c.status()}}
  if(x.action==="jointRotation"){const ok=c.setLogicalJointRotation?.(String(x.slot||""),x.rotation||{});return{ok:Boolean(ok),rotation:engine?.getBoneRotation?.(String((engine?.getBoneMap?.()||{})[String(x.slot||"")]?.name||""))||null,status:c.status()}}
  if(x.action==="pose"){if(captureRestPose){const rest=c.saveRestPose?.();return{ok:Boolean(rest?.persisted),persisted:Boolean(rest?.persisted),restPose:rest||null,status:c.status(),error:rest?.persistenceError||undefined}}const pose=c.setPose(x.pose||{});return{ok:Boolean(pose),pose,status:c.status()}}
  if(x.action==="idlePose"){const pose=c.setIdlePose(x.pose||{});return{ok:true,pose,status:c.status()}}
  if(x.action==="resetPose"){const ok=c.resetPose();return{ok,status:c.status()}}
  if(x.action==="remap"){const ok=c.remap(x.mapping||{});return{ok,status:c.status()}}
  if(x.action==="autoMap"){const result=c.autoMap?.()||{ok:false,error:"Automatic rig mapping unavailable"};return{...result,status:c.status()}}
  if(x.action==="defineMotion"){const motion=c.defineMotion(x.motion||{});return{ok:true,motion,status:c.status()}}
  if(x.action==="deleteMotion"){const ok=c.deleteMotion(String(x.id||""));return{ok,status:c.status()}}
  if(x.action==="setMotionEnabled"){const ok=c.setMotionEnabled?.(String(x.id||""),x.enabled!==false);return{ok,status:c.status()}}
  if(x.action==="listMotions")return{ok:true,motions:c.listMotions(),status:c.status()};
  if(x.action==="captureMotionPose"){const mapping=engine?.getBoneMap?.()||{},pose={};for(const [slot,bone] of Object.entries(mapping)){const name=typeof bone==="string"?bone:bone?.name;const rotation=name?engine?.getBoneEditorRotation?.(name):null;if(rotation&&[rotation.x,rotation.y,rotation.z].every(Number.isFinite))pose[slot]={x:rotation.x,y:rotation.y,z:rotation.z}}return{ok:Object.keys(pose).length>0,pose,mappedSlots:Object.keys(pose).length,status:c.status()}};
  if(x.action==="beginAuthoring"){const ok=c.beginAuthoring?.()??false;return{ok:Boolean(ok),status:c.status()}}
  if(x.action==="endAuthoring"){const ok=c.endAuthoring?.()??false;return{ok:Boolean(ok),status:c.status()}}
  if(x.action==="status")return{ok:true,status:c.status()};
  if(x.action==="semantic")return c.semantic(x.intent,x.options||{});
  if(x.action==="face"){const applied=Boolean(c.face?.expression?.(x.expression,x.intensity));return{ok:applied,result:applied?"expression-applied":"expression-unavailable",status:c.face?.status?.()||null}};
  if(x.action==="blink")return{ok:Boolean(c.face?.blink?.())};
  if(x.action==="lookAt")return{ok:Boolean(c.face?.lookAt?.(x.x,x.y,x.z))};
  if(x.action==="viseme")return{ok:Boolean(c.face?.viseme?.(x.viseme,x.value))};
  if(x.action==="fingers")return{ok:Boolean(c.fingers?.curl?.(x.hand,x.amount))};
  if(x.action==="buildProceduralRig"){const result=engine?.buildProceduralRig?.(String(x.template||"full"),x.options||{});if(!result)return{ok:false,error:"Procedural rig builder unavailable"};return{...result,status:c.status()}}
  if(x.action==="getVisemeMap"){return{ok:true,visemeMap:c.getVisemeMap?.()||{}}}
  if(x.action==="setVisemeMap"){return c.setVisemeMap?.(x.visemeMap||{})||{ok:false,error:"Viseme mapping unavailable"}}
  if(x.action==="getMotionAxisFixes"){return{ok:true,motionAxisFixes:c.getMotionAxisFixes?.()||{}}}
  if(x.action==="setMotionAxisFix"){return c.setMotionAxisFix?.(String(x.motionId||""),String(x.slot||""),x.fix||null)||{ok:false,error:"Motion-specific axis correction unavailable"}}
  if(x.action==="clearMotionAxisFixes"){return c.clearMotionAxisFixes?.(String(x.motionId||""))||{ok:false,error:"Motion-specific axis reset unavailable"}}
  if(x.action==="availableAccessories"){const api=window.saeed?.addons;if(typeof api?.accessoriesList!=="function")return{ok:true,available:[],providerAvailable:false};const available=await api.accessoriesList();return{ok:true,available:Array.isArray(available)?available:[],providerAvailable:true}}
  if(x.action==="accessoriesList"){return{ok:true,...(engine?.getAccessoriesSnapshot?.()||{accessories:[]}),states:c.getAccessoryState?.()||{}}}
  if(x.action==="setAccessory"){const result=await c.setAccessory?.(x.definition||{},x.enabled!==false,x.state||{});return{...(result||{ok:false,error:"Accessory controller unavailable"}),accessories:engine?.getAccessoriesSnapshot?.()?.accessories||[],states:c.getAccessoryState?.()||{}}}
  if(x.action==="morphList"){const snapshot=engine?.getMorphSnapshot?.()||{count:0,names:[],values:{}};return{ok:true,...snapshot,status:c.status()}}
  if(x.action==="setMorph"){const ok=engine?.setCharacterExpression?.(String(x.name||""),Number(x.value)||0);return{ok:Boolean(ok),name:String(x.name||""),value:Number(x.value)||0,status:c.status()}}
  if(x.action==="meshList"){const snapshot=engine?.getMeshVisibilitySnapshot?.()||{ok:false,error:"Character mesh listing unavailable",meshes:[]};return{...snapshot,status:c.status()}}
  if(x.action==="setMeshVisibility"){const ok=engine?.setMeshVisibility?.(String(x.name||""),x.visible!==false);return{ok:Boolean(ok),name:String(x.name||""),visible:x.visible!==false,status:c.status()}}
  if(x.action==="getRig"){const bones=engine?.getAvailableBoneNames?.()||[];const status=c.status?.()||{};const boundMapping=c.api?.getRig?.()?.mapping||{};const autoMapping=engine?.getCharacterRigAutoMap?.()||{};const mapping=Object.keys(boundMapping).length?boundMapping:(Object.keys(autoMapping).length?autoMapping:(status.autoRig||{}));return{ok:Boolean(bones.length),bones,mapping,status};}
  if(x.action==="boneNames"){const bones=engine?.getAvailableBoneNames?.()||[];if(!bones.length)return characterFailure(action,"No actual skeleton bone names exposed",{reason:"empty-skeleton"});return{ok:true,bones}};
  if(x.action==="saveRestPose"){const rest=c.saveRestPose?.();return{ok:Boolean(rest?.persisted),restPose:rest||null,persisted:Boolean(rest?.persisted),status:c.status()}}
  if(x.action==="normalizeRestPose"){const normalization=c.normalizeRestPose?.();return{ok:Boolean(normalization?.normalized&&normalization?.persisted),normalization:normalization||null,status:c.status()}}
  if(x.action==="fixTPose"){const result=c.fixTPose?.()||{ok:false,error:"T-pose correction unavailable"};return{...result,status:c.status()}}
  if(x.action==="setAxisFix"){const ok=c.setAxisFix?.(String(x.slot||""),x.fix||{});return{ok:Boolean(ok),axisFixes:c.retargeter?.status?.().axisFixes||{},status:c.status()}}
  if(x.action==="boneRotation")return{ok:true,rotation:engine?.getBoneEditorRotation?.(String(x.bone||""))||null};
  if(x.action==="bindSlot"){const ok=c.bindSlot?.(String(x.slot||""),String(x.bone||""));return{ok:Boolean(ok),mapping:c.engine?.getCharacterRigAutoMap?.()||{},status:c.status()}}
  if(x.action==="setBoneRotation"){const ok=c.setBoneRotation?.(String(x.bone||""),x.rotation||{})??engine?.setBoneRotation?.(String(x.bone||""),x.rotation||{});return{ok:Boolean(ok),rotation:engine?.getBoneRotation?.(String(x.bone||""))||null}};
  if(x.action==="setBoneTransform"){const ok=engine?.setBoneTransform?.(String(x.bone||""),x.transform||{});return{ok:Boolean(ok),status:c.status(),transform:engine?.getCharacterPoseStatus?.()?.bones?.[String(x.bone||"")]||null}};
  if(x.action==="bonePosition")return{ok:true,position:engine?.getBonePosition?.(String(x.bone||""))||null};
  if(x.action==="setBonePosition"){const ok=engine?.setBonePosition?.(String(x.bone||""),x.position||{});return{ok:Boolean(ok),position:engine?.getBonePosition?.(String(x.bone||""))||null}};
  if(x.action==="setBoneEditorRotation"){const ok=engine?.setBoneEditorRotation?.(String(x.bone||""),x.rotation||{});return{ok:Boolean(ok),rotation:engine?.getBoneEditorRotation?.(String(x.bone||""))||null}};
  if(x.action==="resetBoneToRest"){const bone=String(x.bone||"");const rotation=c.resetBoneToRest?.(bone);return{ok:Boolean(rotation),rotation:rotation||null,status:c.status()}};
  if(x.action==="setUserBusy"){const busy=c.setUserBusy?.(x.value===true);return{ok:Boolean(busy),userBusy:c.autonomous?.getStatus?.().userBusy===true,status:c.status()}}
  if(x.action==="behaviorEvent"){const handled=c.handleEvent?.(x.event||{});return{ok:Boolean(handled),status:c.status()}}
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
if(character){character.addEventListener("mousedown",e=>{if(e.button!==0||e.target.closest("button,input,a,select,textarea"))return;dragging=true;lastX=e.screenX;lastY=e.screenY;controller()?.handleEvent?.({type:"drag-start"});e.preventDefault()});character.addEventListener("mousemove",e=>{if(dragging)return;const rect=character.getBoundingClientRect();if(!rect.width||!rect.height)return;controller()?.handleEvent?.({type:"pointer-move",x:((e.clientX-rect.left)/rect.width-.5)*2,y:((e.clientY-rect.top)/rect.height-.5)*2})});window.addEventListener("mousemove",e=>{if(!dragging)return;const dx=e.screenX-lastX,dy=e.screenY-lastY;lastX=e.screenX;lastY=e.screenY;window.saeed.character.moveWindowBy(dx,dy)});window.addEventListener("mouseup",()=>{if(!dragging)return;dragging=false;controller()?.handleEvent?.({type:"drag-end"})});character.addEventListener("dblclick",e=>{if(e.target?.closest?.("#micToggle,button,input,select,textarea,a"))return;controller()?.handleEvent?.({type:"double-click"})});character.addEventListener("contextmenu",()=>controller()?.handleEvent?.({type:"right-click"}));character.addEventListener("mouseenter",()=>controller()?.handleEvent?.({type:"hover"}));character.addEventListener("wheel",()=>controller()?.handleEvent?.({type:"zoom"}),{passive:true})}
window.addEventListener("focus",()=>controller()?.handleEvent?.({type:"app-focus"}));window.addEventListener("blur",()=>controller()?.handleEvent?.({type:"app-blur"}));
if(button&&icon&&label&&window.saeed){const render=mode=>{const on=String(mode||"off")==="on";button.classList.toggle("on",on);button.classList.toggle("off",!on);button.setAttribute("aria-pressed",String(on));button.title=on?"Turn microphone OFF":"Turn microphone ON";icon.textContent=on?"Ⅱ":"▶";label.textContent=on?"MIC ON":"MIC OFF"};button.addEventListener("click",async e=>{e.preventDefault();e.stopPropagation();const on=button.classList.contains("on");button.disabled=true;try{await window.saeed.voice.setMicMode(on?"off":"on")}catch(error){window.saeed.system.reportDiagnostic?.("ERROR","MIC BUTTON",error?.message||String(error))}finally{button.disabled=false}});window.saeed.voice.onMicMode?.(render)}
window.saeed.character.onCharacterBehavior?.(e=>{
 if(e?.type==="settings"){
  const b=e.settings?.characterBehavior||{};
  const frequencyMs=({rare:15000,normal:7000,frequent:3500})[String(b.frequency||"normal")]||7000;
  const eventCooldownMs=Math.max(0,Number(b.eventCooldownSec)||2.5)*1000;
  const sleepAfterMs=Math.max(1,Number(b.sleepAfterMin)||20)*60000;
  controller()?.setBehavior?.({...b,frequencyMs,eventCooldownMs,sleepAfterMs});
  return;
 }
 controller()?.handleEvent?.(e);
});window.saeed.character.onCharacterVisibility?.(s=>{const visible=s!=="hidden";controller()?.setVisible?.(visible);if(visible){runtime()?.engine?.wakeRender?.();requestAnimationFrame(()=>runtime()?.engine?.wakeRender?.())}else runtime()?.engine?.suspendRender?.()});document.addEventListener("visibilitychange",()=>{if(!document.hidden){runtime()?.engine?.wakeRender?.();requestAnimationFrame(()=>runtime()?.engine?.wakeRender?.())}});window.addEventListener("load",()=>{controller()?.setVisible?.(!document.hidden);if(!document.hidden){runtime()?.engine?.wakeRender?.()}});window.addEventListener("beforeunload",()=>{try{controller()?.destroy?.()}catch{}try{runtime()?.engine?.destroy?.()}catch{}})})();