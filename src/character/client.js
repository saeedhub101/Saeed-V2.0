(()=>{const button=document.getElementById("micToggle"),icon=document.getElementById("micToggleIcon"),label=document.getElementById("micToggleLabel"),character=document.getElementById("character"),runtime=()=>window.saeedCharacterRuntime,controller=()=>runtime()?.controller;let dragging=false,lastX=0,lastY=0;
async function executeCharacterCommand(command={}){
 const deadline=Date.now()+25000;
 while(Date.now()<deadline){
  const c=controller();
  if(c){
   const status=c.status?.();
   if(status?.characterLoaded)break;
  }
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 const c=controller(),engine=runtime()?.engine;
 if(!c)return{ok:false,error:"Character controller unavailable"};
 const x=command||{};
 try{
  if(x.action==="play"){const ok=c.play(String(x.motion||"idle"),x.options||{});return{ok,status:c.status()}}
  if(x.action==="stop"){const ok=c.stop(x.motion);return{ok,status:c.status()}}
  if(x.action==="stopAll"){const ok=c.stopAll();return{ok,status:c.status()}}
  if(x.action==="setAnimationEnabled"){const enabled=c.setAnimationEnabled?.(x.enabled!==false);return{ok:true,enabled,status:c.status()}}
  if(x.action==="setAnimationPaused"){const paused=c.setAnimationPaused?.(x.paused===true);return{ok:true,paused,status:c.status()}}
  if(x.action==="pose"){const pose=c.setPose(x.pose||{});return{ok:true,pose,status:c.status()}}
  if(x.action==="idlePose"){const pose=c.setIdlePose(x.pose||{});return{ok:true,pose,status:c.status()}}
  if(x.action==="resetPose"){const ok=c.resetPose();return{ok,status:c.status()}}
  if(x.action==="remap"){const ok=c.remap(x.mapping||{});return{ok,status:c.status()}}
  if(x.action==="autoMap"){const result=c.autoMap?.()||{ok:false,error:"Automatic rig mapping unavailable"};return{...result,status:c.status()}}
  if(x.action==="defineMotion"){const motion=c.defineMotion(x.motion||{});return{ok:true,motion,status:c.status()}}
  if(x.action==="deleteMotion"){const ok=c.deleteMotion(String(x.id||""));return{ok,status:c.status()}}
  if(x.action==="listMotions")return{ok:true,motions:c.listMotions(),status:c.status()};
  if(x.action==="status")return{ok:true,status:c.status()};
  if(x.action==="semantic")return c.semantic(x.intent,x.options||{});
  if(x.action==="face")return{ok:true,result:c.face?.expression?.(x.expression,x.intensity)};
  if(x.action==="blink")return{ok:Boolean(c.face?.blink?.())};
  if(x.action==="lookAt")return{ok:Boolean(c.face?.lookAt?.(x.x,x.y,x.z))};
  if(x.action==="viseme")return{ok:Boolean(c.face?.viseme?.(x.viseme,x.value))};
  if(x.action==="fingers")return{ok:Boolean(c.fingers?.curl?.(x.hand,x.amount))};
  if(x.action==="boneNames")return{ok:true,bones:engine?.getAvailableBoneNames?.()||[]};
  if(x.action==="saveRestPose"){const rest=c.saveRestPose?.();return{ok:Boolean(rest),restPose:rest||null,status:c.status()}}
  if(x.action==="normalizeRestPose"){const normalization=c.normalizeRestPose?.();return{ok:Boolean(normalization),normalization:normalization||null,status:c.status()}}
  if(x.action==="boneRotation")return{ok:true,rotation:engine?.getBoneRotation?.(String(x.bone||""))||null};
  if(x.action==="setBoneRotation"){const ok=engine?.setBoneRotation?.(String(x.bone||""),x.rotation||{});return{ok:Boolean(ok),rotation:engine?.getBoneRotation?.(String(x.bone||""))||null}};
  if(x.action==="snapshotRestPose")return{ok:true,bones:engine?.snapshotBoneRotations?.()||{}};
  return{ok:false,error:"Unknown character controller action"};
 }catch(error){return{ok:false,error:error?.message||String(error)}}
}
window.saeed?.onCharacterCommand?.(async(id,command)=>{
 const result=await executeCharacterCommand(command);
 window.saeed.characterCommandResult?.(id,result);
});
if(character){character.addEventListener("mousedown",e=>{if(e.button!==0||e.target.closest("button,input,a,select,textarea"))return;dragging=true;lastX=e.screenX;lastY=e.screenY;controller()?.touch?.();e.preventDefault()});window.addEventListener("mousemove",e=>{if(!dragging)return;const dx=e.screenX-lastX,dy=e.screenY-lastY;lastX=e.screenX;lastY=e.screenY;window.saeed.moveWindowBy(dx,dy)});window.addEventListener("mouseup",()=>{dragging=false;controller()?.touch?.()});character.addEventListener("contextmenu",()=>controller()?.handleEvent?.({type:"right-click"}));character.addEventListener("wheel",()=>controller()?.handleEvent?.({type:"zoom"}),{passive:true})}
if(button&&icon&&label&&window.saeed){const render=mode=>{const on=String(mode||"off")==="on";button.classList.toggle("on",on);button.classList.toggle("off",!on);button.setAttribute("aria-pressed",String(on));button.title=on?"Turn microphone OFF":"Turn microphone ON";icon.textContent=on?"Ⅱ":"▶";label.textContent=on?"MIC ON":"MIC OFF"};button.addEventListener("click",async e=>{e.preventDefault();e.stopPropagation();const on=button.classList.contains("on");button.disabled=true;try{await window.saeed.setMicMode(on?"off":"on")}catch(error){window.saeed.reportDiagnostic?.("ERROR","MIC BUTTON",error?.message||String(error))}finally{button.disabled=false}});window.saeed.onMicMode?.(render)}
window.saeed?.onCharacterBehavior?.(e=>controller()?.handleEvent?.(e));window.saeed?.onCharacterVisibility?.(s=>controller()?.setVisible?.(s!=="hidden"));window.addEventListener("load",()=>controller()?.setVisible?.(!document.hidden));window.addEventListener("beforeunload",()=>{try{controller()?.destroy?.()}catch{}try{runtime()?.engine?.destroy?.()}catch{}})})();