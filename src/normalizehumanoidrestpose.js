const $=id=>document.getElementById(id);
let bones=[],selected="",draft={};
const axes=["X","Y","Z"];
function status(text,kind=""){const el=$("state");el.textContent=text;el.className=kind}
function command(payload){return window.saeed.characterController(payload)}
function radians(value){return Number(value||0)*Math.PI/180}
function readDraft(){return{rotation:{x:radians($("rotX").value),y:radians($("rotY").value),z:radians($("rotZ").value)},position:{x:Number($("posX").value)||0,y:Number($("posY").value)||0,z:Number($("posZ").value)||0}}}
function writeDraft(value={}){const rotation=value.rotation||{},position=value.position||{};for(const [axis,key] of axes.map(x=>[x,x.toLowerCase()])){$("rot"+axis).value=Number((Number(rotation[key])||0)*180/Math.PI).toFixed(1);$("pos"+axis).value=Number(position[key])||0}}
function setSelected(name){selected=String(name||"");const bone=bones.find(item=>item.name===selected);$("boneTitle").textContent=selected||"No bone selected";$("boneParent").textContent=bone?(bone.parent?"Parent: "+bone.parent:"Root bone"):"Load a character to list its bones.";writeDraft(draft[selected]||{});$("applyBone").disabled=!bone;$("resetBone").disabled=!bone}
function fillBones(filter=""){
 const needle=String(filter||"").trim().toLowerCase(),list=bones.filter(item=>!needle||item.name.toLowerCase().includes(needle)||String(item.parent||"").toLowerCase().includes(needle));
 $("bone").innerHTML=list.map(item=>{const option=document.createElement("option");option.value=item.name;option.textContent=item.parent?item.name+"  ·  "+item.parent:item.name;return option.outerHTML}).join("");
 $("boneCount").textContent=bones.length+" bones";
 if(list.some(item=>item.name===selected))$("bone").value=selected;else if(list.length){$("bone").value=list[0].name;setSelected(list[0].name)}else setSelected("");
}
async function refresh(){
 $("refresh").disabled=true;status("Reading the loaded skeleton…");
 try{
  const result=await command({action:"status"}),actual=result?.status?.actualBones||result?.status?.status?.actualBones||result?.actualBones||{};
  bones=Object.entries(actual).map(([name,detail])=>({name,parent:String(detail?.parent||"")}));
  $("characterState").textContent=result?.status?.characterLoaded||result?.characterLoaded?"Character connected. Adjust a bone, apply it, then save the complete rest pose.":"Character renderer is available; waiting for its GLB skeleton.";
  if(!bones.length){$("characterState").className="error";status(result?.error||"No bones found. Load a GLB character first.","error");fillBones();return}
  $("characterState").className="";fillBones($("search").value);status("Found "+bones.length+" bones. Adjustments are relative to the current saved rest pose.");
 }catch(error){$("characterState").textContent="Character unavailable";$("characterState").className="error";status(error.message,"error")}
 finally{$("refresh").disabled=false}
}
async function apply(value){
 if(!selected)return;
 try{
  const result=await command({action:"pose",pose:{__bones:{[selected]:value}}});
  if(result?.ok===false)throw new Error(result.error||"Could not apply bone pose");
  draft[selected]=value;status("Applied changes to "+selected+".","success");
 }catch(error){status(error.message,"error")}
}
$("bone").addEventListener("change",()=>setSelected($("bone").value));
$("search").addEventListener("input",()=>fillBones($("search").value));
$("refresh").addEventListener("click",refresh);
$("close").addEventListener("click",()=>window.close());
$("applyBone").addEventListener("click",()=>apply(readDraft()));
$("resetBone").addEventListener("click",async()=>{writeDraft({});await apply(readDraft())});
$("save").addEventListener("click",async()=>{
 $("save").disabled=true;status("Saving the complete pose to this character profile…");
 try{
  const result=await command({action:"pose",pose:{__captureRest:true}});
  if(result?.ok===false)throw new Error(result.error||"Could not save rest pose");
  draft={};writeDraft({});status("Saved normalizehumanoidrestpose for this character. Future motions now use these bone values as their rest pose.","success");
 }catch(error){status(error.message,"error")}
 finally{$("save").disabled=false}
});
for(const id of ["rotX","rotY","rotZ","posX","posY","posZ"]){$(id).addEventListener("change",()=>void apply(readDraft()));$(id).addEventListener("keydown",event=>{if(event.key==="Enter")void apply(readDraft())})}
refresh();