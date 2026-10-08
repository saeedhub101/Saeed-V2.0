const $=id=>document.getElementById(id);
const diagnosticLog=[];function diagnostic(level,stage,message,meta={}){const item={at:new Date().toISOString(),level,stage,message:String(message||""),meta};diagnosticLog.unshift(item);diagnosticLog.splice(30);const el=$("diagnostics");if(el)el.textContent=diagnosticLog.map(x=>`[${x.at}] ${x.level} ${x.stage}\n${x.message}${Object.keys(x.meta||{}).length?"\n"+JSON.stringify(x.meta):""}`).join("\n\n");try{window.saeed?.system?.reportDiagnostic?.(level,stage,message,{domain:"3D",...meta})}catch{}}window.saeed?.system?.onDiagnostic?.(e=>{if(String(e?.stage||"").includes("3D")||String(e?.stage||"").includes("CHARACTER")||String(e?.stage||"GLB")||e?.level==="ERROR")diagnosticLog.unshift({at:e.at||new Date().toISOString(),level:e.level,stage:e.stage,message:e.message,meta:e.meta||{}});const el=$("diagnostics");if(el)el.textContent=diagnosticLog.slice(0,30).map(x=>`[${x.at}] ${x.level} ${x.stage}\n${x.message}${Object.keys(x.meta||{}).length?"\n"+JSON.stringify(x.meta):""}`).join("\n\n")});
let bones=[],selected="",draft={},baseRotations={};
const axes=["X","Y","Z"];
function status(text,kind=""){const el=$("state");el.textContent=text;el.className=kind}
async function command(payload){try{const result=await window.saeed.character.characterController(payload);if(result?.ok===false)diagnostic("ERROR","CHARACTER COMMAND",result.error||"Command failed",{action:payload?.action,bone:payload?.bone});return result}catch(error){diagnostic("ERROR","CHARACTER IPC",error?.stack||error?.message||String(error),{action:payload?.action,bone:payload?.bone});throw error}}
function radians(value){return Number(value||0)*Math.PI/180}
function readDraft(){return{x:radians($("rotX").value),y:radians($("rotY").value),z:radians($("rotZ").value)}}
function writeDraft(rotation={}){for(const axis of axes){const key=axis.toLowerCase();$("rot"+axis).value=Number((Number(rotation[key])||0)*180/Math.PI).toFixed(1)}}
function setSelected(name){selected=String(name||"");const bone=bones.find(item=>item.name===selected);$("boneTitle").textContent=selected||"No bone selected";$("boneParent").textContent=bone?(bone.parent?"Parent: "+bone.parent:"Root bone"):"Load a character to list its bones.";writeDraft(draft[selected]||baseRotations[selected]||{});$("applyBone").disabled=!bone;$("resetBone").disabled=!bone}
function fillBones(filter=""){
 const needle=String(filter||"").trim().toLowerCase(),list=bones.filter(item=>!needle||item.name.toLowerCase().includes(needle)||String(item.parent||"").toLowerCase().includes(needle));
 $("bone").innerHTML=list.map(item=>{const option=document.createElement("option");option.value=item.name;option.textContent=item.parent?item.name+"  ·  "+item.parent:item.name;return option.outerHTML}).join("");
 $("boneCount").textContent=bones.length+" bones";
 if(list.some(item=>item.name===selected))$("bone").value=selected;else if(list.length){$("bone").value=list[0].name;setSelected(list[0].name)}else setSelected("");
}
async function refresh(){
 $("refresh").disabled=true;status("Reading the loaded skeleton…");
 try{
  let result=null,actual={};
  const deadline=Date.now()+15000;
  while(Date.now()<deadline){
   result=await command({action:"status"});
   actual=result?.status?.actualBones||result?.actualBones||{};
   if(Object.keys(actual).length)break;
   await new Promise(resolve=>setTimeout(resolve,150));
  }
  bones=Object.entries(actual).map(([name,detail])=>({name,parent:String(detail?.parent||"")}));
    baseRotations=Object.fromEntries(Object.entries(actual).map(([name,detail])=>[name,detail?.rotation||{x:0,y:0,z:0}]));
    $("characterState").textContent=result?.status?.characterLoaded||result?.characterLoaded?"Character connected. Adjust any bone, then save the complete rest pose.":"Character renderer is available; waiting for its GLB skeleton.";
  if(!bones.length){$("characterState").className="error";status(result?.error||"No bones found. Load a GLB character first.","error");fillBones();return}
    $("characterState").className="";fillBones($("search").value);status("Found "+bones.length+" bones. Select one to edit its rotation on all three axes.");
 }catch(error){$("characterState").textContent="Character unavailable";$("characterState").className="error";status(error.message,"error")}
 finally{$("refresh").disabled=false}
}
async function apply(value){
 if(!selected)return;
 try{
    const result=await command({action:"setBoneRotation",bone:selected,rotation:value});
  if(result?.ok===false)throw new Error(result.error||"Could not apply bone pose");
    draft[selected]=value;status("Applied changes to "+selected+".","success");return true;
 }catch(error){status(error.message,"error");return false}
}
$("bone").addEventListener("change",()=>setSelected($("bone").value));
$("search").addEventListener("input",()=>fillBones($("search").value));
$("refresh").addEventListener("click",refresh);
$("close").addEventListener("click",async()=>{try{await command({action:"endAuthoring"})}catch{}try{window.saeed.character.closeWindow?.()}catch{} });
$("applyBone").addEventListener("click",()=>apply(readDraft()));
$("resetBone").addEventListener("click",async()=>{if(!selected)return;const result=await command({action:"resetBoneToRest",bone:selected});if(result?.ok){const rotation=result.rotation||{x:0,y:0,z:0};writeDraft(rotation);draft[selected]=rotation;status("Reset "+selected+" to the authoritative Rest Pose.","success")}else status("Could not reset "+selected+" to the authoritative Rest Pose.","error")});
$("save").addEventListener("click",async()=>{
 $("save").disabled=true;status("Saving the complete pose to this character profile…");
 try{
  if(selected&&!await apply(readDraft()))throw new Error("Could not apply the selected bone before saving");
  const result=await command({action:"saveRestPose"});
  if(result?.ok===false)throw new Error(result.error||"Could not save rest pose");
  draft={};const refreshed=await command({action:"status"}),actual=refreshed?.status?.actualBones||{};baseRotations=Object.fromEntries(Object.entries(actual).map(([name,detail])=>[name,detail?.rotation||{x:0,y:0,z:0}]));writeDraft(baseRotations[selected]||{});status("Saved normalizehumanoidrestpose for this character. Future motions now use these values as their rest pose.","success");
 }catch(error){status(error.message,"error")}
 finally{$("save").disabled=false}
});
for(const id of ["rotX","rotY","rotZ"]){$(id).addEventListener("change",()=>void apply(readDraft()));$(id).addEventListener("keydown",event=>{if(event.key==="Enter")void apply(readDraft())})}
void command({action:"beginAuthoring"});refresh();