function createSystemControls({app,showChat,showCharacter,hideCharacter,showAddons,showLearning,showRestPoseEditor,showPerformance,showStatus,show3DStatus,showSettings,showUpdateStatus,setSaeedSize,chooseCharacter,Menu,getCharacterWindow,getVoiceMuted,setVoiceMuted,setMicMode,getCurrentMicMode,updateNow}){
 function characterSizeMenu(){return[{label:"Small",click:()=>setSaeedSize("small")},{label:"Medium",click:()=>setSaeedSize("medium")},{label:"Large",click:()=>setSaeedSize("large")}]}
 function rebuildTray(tray){
  if(!tray)return;
  const muted=Boolean(getVoiceMuted?.());
  const mic=getCurrentMicMode?.()||"off";
  const menu=Menu.buildFromTemplate([
   {label:"Saeed",submenu:[{label:"Show Saeed",click:showCharacter},{label:"Chat Me",click:showChat},{label:"Hide Saeed",click:hideCharacter}]},
   {label:muted?"Unmute":"Mute",type:"checkbox",checked:muted,click:()=>setVoiceMuted(!muted)},
   {label:"Voice",submenu:[{label:"Mic ON",type:"radio",checked:mic==="on",click:()=>setMicMode("on")},{label:"Mic OFF",type:"radio",checked:mic==="off",click:()=>setMicMode("off")}]},
    {label:"Character",submenu:[{label:"Change Character (GLB)",click:chooseCharacter},{label:"Set Normalize Humanoid Rest Pose",click:showRestPoseEditor},{label:"Size",submenu:characterSizeMenu()}]},
   {label:"Add-ons / Plug-ins",click:showAddons},
   {label:"Learning / Teach Mode",click:showLearning},
   {label:"Diagnostics",submenu:[{label:"Performance",click:showPerformance},{label:"Status",click:showStatus},{label:"3D Status",click:show3DStatus}]},
   {label:"Updates & Settings",submenu:[{label:"Update status",click:showUpdateStatus},{label:"Check for Updates",click:updateNow},{label:"Settings",click:showSettings}]},
   {label:"Quit",click:()=>app.quit()}
  ]);
  tray.setContextMenu(menu);
  tray.__saeedContextMenu=menu;
 }
 function contextMenu(){
  const win=getCharacterWindow?.();
  if(!win||win.isDestroyed())return;
  Menu.buildFromTemplate([
   {label:"Chat Me",click:showChat},
   {label:"Hide Saeed",click:hideCharacter},
   {label:"Voice",submenu:[{label:"Mic ON",click:()=>setMicMode("on")},{label:"Mic OFF",click:()=>setMicMode("off")}]},
    {label:"Character",submenu:[{label:"Change Character (GLB)",click:chooseCharacter},{label:"Set Normalize Humanoid Rest Pose",click:showRestPoseEditor},{label:"Size",submenu:characterSizeMenu()}]},
   {label:"Diagnostics",submenu:[{label:"Performance",click:showPerformance},{label:"Status",click:showStatus},{label:"3D Status",click:show3DStatus}]},
   {label:"Updates & Settings",submenu:[{label:"Update status",click:showUpdateStatus},{label:"Check for Updates",click:updateNow},{label:"Settings",click:showSettings}]},
   {label:"Quit",click:()=>app.quit()}
  ]).popup({window:win});
 }
 return{rebuildTray,contextMenu,characterSizeMenu};
}
module.exports={createSystemControls};