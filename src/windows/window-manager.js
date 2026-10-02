const {BrowserWindow}=require("electron");
class WindowManager{
 constructor({preload,iconPath,baseDir}={}){this.preload=preload;this.iconPath=iconPath;this.baseDir=baseDir;this.windows=new Map()}
 create(key,options,file,{onClosed}={}){
  const existing=this.windows.get(key);
  if(existing&&!existing.isDestroyed()){existing.show();existing.focus();return existing}
  const win=new BrowserWindow({...options,icon:this.iconPath,webPreferences:{preload:this.preload,contextIsolation:true,nodeIntegration:false,sandbox:false,...(options.webPreferences||{})}});
  if(this.iconPath)try{win.setIcon(this.iconPath)}catch{}
  this.windows.set(key,win);
  win.on("closed",()=>{this.windows.delete(key);onClosed?.()});
  if(file)win.loadFile(file);
  return win;
 }
 get(key){const w=this.windows.get(key);return w&&!w.isDestroyed()?w:null}
 close(key){const w=this.get(key);if(w)w.destroy()}
 closeAll(){for(const k of this.windows.keys())this.close(k)}
}
module.exports={WindowManager};