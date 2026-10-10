function createWindowManager({BrowserWindow,path,getWindow,setWindow,iconPath,diagnostic,startCpuMonitoring,stopCpuMonitoring,preloadPath,rootPath}){
 const loadFileBounded=async(win,file,ms=12000)=>{let timer;try{await Promise.race([win.loadFile(file),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error("Window load timeout after "+ms+" ms")),ms)})]);return true}catch(e){diagnostic("ERROR","WINDOW LOAD",e?.message||String(e));try{win.close()}catch{}return false}finally{clearTimeout(timer)}};
 async function showPerformance(){
  try{
   let win=getWindow("performanceWin");
   if(win&&!win.isDestroyed()){win.show();win.focus();return}
   win=new BrowserWindow({width:980,height:720,minWidth:760,minHeight:560,title:"Saeed Performance",show:false,resizable:true,skipTaskbar:false,icon:iconPath(),webPreferences:{preload:preloadPath,contextIsolation:true,nodeIntegration:false,sandbox:true}});
   win.setIcon(iconPath());
   win.on("closed",()=>{setWindow("performanceWin",null)});
   setWindow("performanceWin",win);
   if(!await loadFileBounded(win,path.join(rootPath,"performance.html")))return;
   win.show();win.focus();
  }catch(e){diagnostic("ERROR","PERFORMANCE WINDOW",e.message)}
 }
 async function showRestPoseEditor(){
  try{
   let win=getWindow("restPoseEditorWin");
   if(win&&!win.isDestroyed()){win.show();win.focus();return}
  win=new BrowserWindow({width:1200,height:800,minWidth:900,minHeight:620,title:"Saeed Character Studio",show:false,resizable:true,skipTaskbar:false,icon:iconPath(),webPreferences:{preload:preloadPath,contextIsolation:true,nodeIntegration:false,sandbox:true}});
   win.setIcon(iconPath());
   win.on("closed",()=>{setWindow("restPoseEditorWin",null)});
   setWindow("restPoseEditorWin",win);
  if(!await loadFileBounded(win,path.join(rootPath,"character-studio.html")))return;
   win.show();win.focus();
  }catch(e){diagnostic("ERROR","REST POSE EDITOR",e.message)}
 }
 async function showNormalizeHumanoidRestPose(){
  try{
   let win=getWindow("normalizeHumanoidRestPoseWin");
   if(win&&!win.isDestroyed()){win.show();win.focus();return}
   win=new BrowserWindow({width:1200,height:800,minWidth:900,minHeight:620,title:"Saeed Normalize Humanoid Rest Pose",show:false,resizable:true,skipTaskbar:false,icon:iconPath(),webPreferences:{preload:preloadPath,contextIsolation:true,nodeIntegration:false,sandbox:true}});
   win.setIcon(iconPath());
   win.on("closed",()=>{setWindow("normalizeHumanoidRestPoseWin",null)});
   setWindow("normalizeHumanoidRestPoseWin",win);
   if(!await loadFileBounded(win,path.join(rootPath,"normalizehumanoidrestpose.html")))return;
   win.show();win.focus();
  }catch(e){diagnostic("ERROR","NORMALIZE HUMANOID REST POSE WINDOW",e.message)}
 }
 async function showSettings(){
  try{
   let win=getWindow("settingsWin");
   if(win&&!win.isDestroyed()){win.show();win.focus();return}
   win=new BrowserWindow({width:1060,height:760,minWidth:820,minHeight:600,title:"Saeed Settings",show:false,resizable:true,skipTaskbar:false,icon:iconPath(),webPreferences:{preload:preloadPath,contextIsolation:true,nodeIntegration:false,sandbox:true}});
   win.setIcon(iconPath());
   win.on("closed",()=>setWindow("settingsWin",null));
   setWindow("settingsWin",win);
   if(!await loadFileBounded(win,path.join(rootPath,"settings.html")))return;
   win.show();win.focus();
  }catch(e){diagnostic("ERROR","SETTINGS WINDOW",e.message)}
}
 async function showLearning(){
  try{
   let win=getWindow("learningWin");
   if(win&&!win.isDestroyed()){win.show();win.focus();return}
   win=new BrowserWindow({width:1060,height:760,minWidth:760,minHeight:560,title:"Saeed Learning / Teach Mode",show:false,resizable:true,skipTaskbar:false,icon:iconPath(),webPreferences:{preload:preloadPath,contextIsolation:true,nodeIntegration:false,sandbox:true}});
   win.setIcon(iconPath());win.on("closed",()=>setWindow("learningWin",null));setWindow("learningWin",win);
   if(!await loadFileBounded(win,path.join(rootPath,"learning","window.html")))return;win.show();win.focus();
  }catch(e){diagnostic("ERROR","LEARNING WINDOW",e.message)}
 }
 async function showAddons(){
  try{
   let win=getWindow("addonsWin");
   if(win&&!win.isDestroyed()){win.show();win.focus();win.webContents.send("addons:refresh");return}
   win=new BrowserWindow({width:1060,height:760,minWidth:760,minHeight:560,title:"Saeed Add-ons / Plug-ins",show:false,resizable:true,skipTaskbar:false,icon:iconPath(),backgroundColor:"#f4f6fa",webPreferences:{preload:preloadPath,contextIsolation:true,nodeIntegration:false,sandbox:true}});
   win.setIcon(iconPath());win.on("closed",()=>setWindow("addonsWin",null));setWindow("addonsWin",win);
   if(!await loadFileBounded(win,path.join(rootPath,"addons","window.html")))return;
   win.show();win.focus();
  }catch(e){diagnostic("ERROR","ADDONS WINDOW",e.message)}
 }
 return {showPerformance,showSettings,showLearning,showAddons,showRestPoseEditor,showNormalizeHumanoidRestPose};
}
module.exports={createWindowManager};
