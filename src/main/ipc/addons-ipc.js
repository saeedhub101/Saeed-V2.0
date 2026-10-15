"use strict";
const fs=require("node:fs");
const addonManager=require("../../addons/manager");
function registerAddonsIpc({ipcMain,app,getAddonService}){
 ipcMain.handle("addons:catalog",async()=>{const s=getAddonService(),catalog=await s.fetchCatalog();return{catalog,installed:s.listInstalled(app.getPath("userData"))}});
 ipcMain.handle("addons:install",async(event,id)=>{const s=getAddonService(),catalog=await s.fetchCatalog(),item=(catalog.addons||[]).find(x=>x.id===String(id));if(!item)throw new Error("Add-on not found in catalog: "+id);return s.install(app.getPath("userData"),item,state=>{if(!event.sender.isDestroyed())event.sender.send("addons:progress",id,state)})});
 ipcMain.handle("addons:uninstall",(_,id)=>getAddonService().uninstall(app.getPath("userData"),id));
 ipcMain.handle("addons:enable",(_,id,enabled)=>getAddonService().setEnabled(app.getPath("userData"),id,enabled));
 ipcMain.handle("addons:accessories:list",()=>{
  const userData=app.getPath("userData");
  return addonManager.listInstalled(userData).filter(addon=>addon.enabled!==false&&Array.isArray(addon.accessories)).flatMap(addon=>addon.accessories.filter(item=>item&&typeof item==="object"&&typeof item.id==="string").map(item=>({...item,id:String(addon.id)+":"+String(item.id),addon:String(addon.id)})));
 });
 ipcMain.handle("addons:file",(_,addonId,relativeFile)=>{
  const userData=app.getPath("userData"),id=String(addonId||""),rel=String(relativeFile||"");
  const addon=addonManager.listInstalled(userData).find(item=>item.id===id&&item.enabled!==false);
  if(!addon)throw new Error("Accessory add-on is not installed or enabled: "+id);
  const declared=(addon.accessories||[]).some(item=>item&&String(item.file||"")===rel);
  if(!declared)throw new Error("Requested file is not declared as an accessory asset");
  const resolved=addonManager.resolveEntryPath(userData,id,rel),stat=fs.statSync(resolved);
  if(!stat.isFile()||stat.size>100*1024*1024)throw new Error("Accessory asset is not a supported file or exceeds the 100 MB limit");
  const bytes=fs.readFileSync(resolved);
  return new Uint8Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 });
}
module.exports={registerAddonsIpc};
