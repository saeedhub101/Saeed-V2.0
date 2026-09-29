(()=>{
 const button=document.getElementById("micToggle");
 const icon=document.getElementById("micToggleIcon");
 const label=document.getElementById("micToggleLabel");
 if(!button||!icon||!label||!window.saeed)return;
 const render=mode=>{
  const on=String(mode||"off")==="on";
  button.classList.toggle("on",on);
  button.classList.toggle("off",!on);
  button.setAttribute("aria-pressed",String(on));
  button.title=on?"Turn microphone OFF":"Turn microphone ON";
  icon.textContent=on?"Ⅱ":"▶";
  label.textContent=on?"MIC ON":"MIC OFF";
 };
 button.addEventListener("click",async e=>{
  e.preventDefault();
  e.stopPropagation();
  const on=button.classList.contains("on");
  button.disabled=true;
  try{await window.saeed.setMicMode(on?"off":"on");}
  catch(error){window.saeed.reportDiagnostic?.("ERROR","MIC BUTTON",error?.message||String(error));}
  finally{button.disabled=false;}
 });
 window.saeed.onMicMode?.(render);
 window.addEventListener("load",async()=>{try{const s=await window.saeed.getSettings();render(s?.micMode||"off")}catch{render("off")}});
})();
