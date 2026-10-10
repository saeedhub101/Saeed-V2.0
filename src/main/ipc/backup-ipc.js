"use strict";
const fs=require("node:fs"),path=require("node:path");
const {writeJsonAtomic}=require("../services/atomic-json-store");
const backupService=require("../services/backup-service");
function registerBackupIpc({ipcMain,dialog,app,ensureBrain,getAgent,diagnostic}){
 ipcMain.handle("backup:export",async()=>{
  await ensureBrain();const agent=getAgent();if(!agent)throw new Error("The Saeed agent is not available");
  const backup=backupService.createBackup({agent,userDataPath:app.getPath("userData"),allowedSettingKeys:Object.keys(agent.settings||{})});
  const date=new Date().toISOString().replace(/[:.]/g,"-");const result=await dialog.showSaveDialog({title:"Export Saeed AI Backup",defaultPath:path.join(app.getPath("documents"),"Saeed-AI-Backup-"+date+".json"),filters:[{name:"Saeed AI Backup",extensions:["json"]}]});
  if(result.canceled||!result.filePath)return{ok:false,cancelled:true};
  const saved=writeJsonAtomic(result.filePath,backup);if(!saved.ok)throw new Error("Backup could not be saved or verified: "+saved.error);
  diagnostic?.("INFO","BACKUP","Saeed backup exported",{fileName:path.basename(result.filePath),bytes:saved.bytes,conversations:backup.conversations.conversations.length,memoryFacts:backup.globalMemory.facts.length});
  return{ok:true,fileName:path.basename(result.filePath),bytes:saved.bytes,conversations:backup.conversations.conversations.length,memoryFacts:backup.globalMemory.facts.length};
 });
 ipcMain.handle("backup:restore",async()=>{
  await ensureBrain();const agent=getAgent();if(!agent)throw new Error("The Saeed agent is not available");
  const picked=await dialog.showOpenDialog({title:"Restore Saeed AI Backup",properties:["openFile"],filters:[{name:"Saeed AI Backup",extensions:["json"]}]});if(picked.canceled||!picked.filePaths?.[0])return{ok:false,cancelled:true};
  const filePath=picked.filePaths[0],raw=fs.readFileSync(filePath,"utf8");const backup=backupService.validateBackup(raw,Object.keys(agent.settings||{}));
  const confirmation=await dialog.showMessageBox({type:"warning",title:"Restore Saeed AI Backup",message:"Restore this Saeed backup?",detail:"Conversation history and saved memory facts will be replaced. Existing API keys and credentials on this computer are preserved; secrets are not included in backups.",buttons:["Restore backup","Cancel"],defaultId:1,cancelId:1,noLink:true});
  if(confirmation.response!==0)return{ok:false,cancelled:true};
  const restored=backupService.restoreBackup({backup,agent,userDataPath:app.getPath("userData")});
  diagnostic?.("INFO","BACKUP","Saeed backup restored",{fileName:path.basename(filePath),conversations:restored.conversations,memoryFacts:restored.memoryFacts});
  return{...restored,fileName:path.basename(filePath)};
 });
}
module.exports={registerBackupIpc};