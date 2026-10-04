function createWindowManager({BrowserWindow,path,getWindow,setWindow,iconPath,diagnostic,startCpuMonitoring,stopCpuMonitoring,preloadPath,rootPath}){
 async function showPerformance(){
  try{
   let win=getWindow("performanceWin");
   if(win&&!win.isDestroyed()){win.show();win.focus();return}
   win=new BrowserWindow({width:980,height:720,minWidth:760,minHeight:560,title:"Saeed Performance",show:false,resizable:true,skipTaskbar:false,icon:iconPath(),webPreferences:{preload:preloadPath,contextIsolation:true,nodeIntegration:false,sandbox:false}});
   win.setIcon(iconPath());
   win.on("closed",()=>{setWindow("performanceWin",null)});
   setWindow("performanceWin",win);
   await win.loadFile(path.join(rootPath,"performance.html"));
   win.show();win.focus();
  }catch(e){diagnostic("ERROR","PERFORMANCE WINDOW",e.message)}
 }
 async function showSettings(){
  try{
   let win=getWindow("settingsWin");
   if(win&&!win.isDestroyed()){win.show();win.focus();return}
   win=new BrowserWindow({width:1060,height:760,minWidth:820,minHeight:600,title:"Saeed Settings",show:false,resizable:true,skipTaskbar:false,icon:iconPath(),webPreferences:{preload:preloadPath,contextIsolation:true,nodeIntegration:false,sandbox:false}});
   win.setIcon(iconPath());
   win.on("closed",()=>setWindow("settingsWin",null));
   setWindow("settingsWin",win);
   await win.loadFile(path.join(rootPath,"settings.html"));
   win.show();win.focus();
  }catch(e){diagnostic("ERROR","SETTINGS WINDOW",e.message)}
}
 async function showLearning(){
  try{
   let win=getWindow("learningWin");
   if(win&&!win.isDestroyed()){win.show();win.focus();return}
   win=new BrowserWindow({width:1060,height:760,minWidth:760,minHeight:560,title:"Saeed Learning / Teach Mode",show:false,resizable:true,skipTaskbar:false,icon:iconPath(),webPreferences:{preload:preloadPath,contextIsolation:true,nodeIntegration:false,sandbox:false}});
   win.setIcon(iconPath());win.on("closed",()=>setWindow("learningWin",null));setWindow("learningWin",win);
   await win.loadFile(path.join(rootPath,"learning","window.html"));win.show();win.focus();
  }catch(e){diagnostic("ERROR","LEARNING WINDOW",e.message)}
 }
 async function showAddons(){
  try{
   let win=getWindow("addonsWin");
   if(win&&!win.isDestroyed()){win.show();win.focus();win.webContents.send("addons:refresh");return}
   win=new BrowserWindow({width:1060,height:760,minWidth:760,minHeight:560,title:"Saeed Add-ons / Plug-ins",show:false,resizable:true,skipTaskbar:false,icon:iconPath(),backgroundColor:"#f4f6fa",webPreferences:{preload:preloadPath,contextIsolation:true,nodeIntegration:false,sandbox:false}});
   win.setIcon(iconPath());win.on("closed",()=>setWindow("addonsWin",null));setWindow("addonsWin",win);
   win.webContents.once("did-finish-load",()=>{win?.show();win?.focus()});
   await win.loadFile(path.join(rootPath,"addons","window.html"));
  }catch(e){diagnostic("ERROR","ADDONS WINDOW",e.message)}
 }
 return {showPerformance,showSettings,showLearning,showAddons};
}
module.exports={createWindowManager};
