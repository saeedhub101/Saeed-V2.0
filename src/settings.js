const $=id=>document.getElementById(id);let settings={};
function fill(){const s=settings||{};$("language").value=s.language||"en";$("selectedCharacterName").value=s.selectedCharacterName||"Bundled/default";$("characterSize").value=s.characterSize||"medium";$("displayMode").value=s.displayMode||"window";$("appearance").value=s.appearance||"dark";$("zoom").value=Number(s.zoom||1);$("muteSounds").checked=!!s.muteSounds}
async function load(){settings=await window.saeed.system.getSettings()||{};fill();try{$("appVersion").textContent=await window.saeed.system.getAppVersion()}catch{$("appVersion").textContent="Unavailable"}}
async function save(p,statusId){try{settings=await window.saeed.system.setSettings({...settings,...p});fill();$(statusId).textContent="Saved";$("saved").textContent="Saved";setTimeout(()=>$(statusId).textContent="",1400)}catch(e){$(statusId).textContent=e.message}}
$("saveGeneral").onclick=()=>save({language:$("language").value.trim()||"en"},"generalStatus");
$("chooseCharacter").onclick=async()=>{await window.saeed.character.chooseCharacter();setTimeout(async()=>{settings=await window.saeed.system.getSettings()||settings;fill()},200)};
$("saveCharacter").onclick=()=>save({characterSize:$("characterSize").value,displayMode:$("displayMode").value},"characterStatus");
$("saveAppearance").onclick=()=>save({appearance:$("appearance").value,zoom:Math.max(.5,Math.min(2,Number($("zoom").value)||1)),muteSounds:$("muteSounds").checked},"appearanceStatus");
const openPerformance=()=>window.saeed.system.showPerformance();$("openPerformance").onclick=openPerformance;$("footerPerformance").onclick=openPerformance;$("close").onclick=()=>window.close();
document.querySelectorAll(".sidebar-item").forEach(b=>b.onclick=()=>{document.querySelectorAll(".sidebar-item").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll("section[data-section]").forEach(x=>x.classList.toggle("hidden",x.dataset.section!==b.dataset.tab))});
load();