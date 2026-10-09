function createCharacterHost({app,ipcMain,BrowserWindow,dialog,path,fs,screen,diagnostic,windowsIconPath,getCharacterWindow,getRestPoseEditorWindow,setCharacterWindow,getAgent,characterStore,contextMenu}){
 ipcMain?.on("character:renderer-ready",event=>{if(!pendingCharacterData)return;try{event.sender.send("character:selected",pendingCharacterData.data,pendingCharacterData.generation)}catch(error){diagnostic("ERROR","GLB DELIVERY",error?.message||String(error))}});
 const {persistSelectedCharacter,readPersistedCharacter,readCharacter3DSettings,writeCharacter3DSettings,applyCharacter3DWindowSettings,captureCharacter3DWindowSettings,character3DSettingsFile}=characterStore;let characterLoadGeneration=0,pendingCharacterData=null,saveMoveTimer=null;
 function displayForWindow(){const target=getCharacterWindow();if(!target)return screen.getPrimaryDisplay();const [x,y]=target.getPosition(),[w,h]=target.getSize();return screen.getDisplayMatching({x,y,width:w,height:h})||screen.getDisplayNearestPoint({x:x+w/2,y:y+h/2})||screen.getPrimaryDisplay()}
 function fitCharacterToDisplay(display=displayForWindow(),{bottomRight=false}={}){const target=getCharacterWindow();if(!target)return;const a=display.workArea,[w,h]=target.getSize(),m=18,[x0,y0]=target.getPosition();const x=bottomRight?a.x+Math.max(0,a.width-w-m):Math.max(a.x,Math.min(x0,a.x+Math.max(0,a.width-w))),y=bottomRight?a.y+Math.max(0,a.height-h-m):Math.max(a.y,Math.min(y0,a.y+Math.max(0,a.height-h)));target.setPosition(Math.round(x),Math.round(y),false)}
 function sendCharacterData(data){const generation=++characterLoadGeneration;pendingCharacterData={data,generation};const delivered=sendPendingCharacterDataToCharacterWindow();sendPendingCharacterData();return delivered} function sendPendingCharacterDataToCharacterWindow(target=getCharacterWindow()){if(!target||target.isDestroyed()||!pendingCharacterData)return false;try{target.webContents.send("character:selected",pendingCharacterData.data,pendingCharacterData.generation);return true}catch(error){diagnostic("ERROR","GLB DELIVERY",error?.message||String(error));return false}}
 function chooseCharacter(){return dialog.showOpenDialog(getCharacterWindow(),{title:"Choose Saeed Character",filters:[{name:"GLB 3D Character",extensions:["glb"]}],properties:["openFile"]}).then(r=>{if(r.canceled||!r.filePaths[0])return;const file=r.filePaths[0];try{const data=fs.readFileSync(file),persisted=persistSelectedCharacter(data);sendCharacterData(new Uint8Array(data));const agent=getAgent();if(agent){agent.settings={...agent.settings,selectedCharacterName:path.basename(file)};agent.persistSettings()}diagnostic("INFO","GLB SELECTED","Character GLB selected and saved",{name:path.basename(file),size:data.length,persistedPath:persisted})}catch(e){diagnostic("ERROR","GLB SELECTED",e.message)}})}
 async function replaceCharacterForCi(file){const target=getCharacterWindow();if(!target||target.isDestroyed())return{ok:false,error:"Character window is unavailable"};try{const source=String(file||"");if(!source||!fs.existsSync(source))return{ok:false,error:"GLB test file is missing"};const data=fs.readFileSync(source);if(data.length<20)return{ok:false,error:"GLB test file is too small"};const persisted=persistSelectedCharacter(data);sendCharacterData(new Uint8Array(data));const agent=getAgent();if(agent){agent.settings={...agent.settings,selectedCharacterName:path.basename(source)};agent.persistSettings()}diagnostic("INFO","GLB CI REPLACEMENT","CI replaced character GLB",{name:path.basename(source),size:data.length,persistedPath:persisted});const deadline=Date.now()+15000;let loaded=false;while(Date.now()<deadline){try{const status=await target.webContents.executeJavaScript("(()=>{const b=window.saeed3DBootstrap||{};const e=window.saeedCharacterRuntime?.engine?.get3DStatus?.();return {moduleLoaded:b.moduleLoaded!==false,error:b.error||null,rendered:e?.components?.sceneContent?.state===\"rendered\"}})()",true);if(status?.error)throw new Error(status.error);if(status?.moduleLoaded&&status?.rendered){loaded=true;break}}catch(error){if(String(error?.message||error).includes("3D"))throw error}await new Promise(resolve=>setTimeout(resolve,250))}if(!loaded)return{ok:false,error:"GLB replacement was sent but the 3D character did not reach rendered state within 15 seconds",name:path.basename(source),size:data.length,persistedPath:persisted};return{ok:true,name:path.basename(source),size:data.length,persistedPath:persisted}}catch(e){diagnostic("ERROR","GLB CI REPLACEMENT",e.message);return{ok:false,error:e.message}}}
 function setSaeedSize(size){const m={small:[300,360],medium:[430,520],large:[560,660]},key=Object.prototype.hasOwnProperty.call(m,size)?size:"medium",v=m[key],target=getCharacterWindow();if(target&&!target.isDestroyed()){const d=displayForWindow(),a=d.workArea,m=18,[ox,oy]=target.getPosition(),[ow,oh]=target.getSize(),right=ox+ow,bottom=oy+oh,x=Math.max(a.x,Math.min(right-v[0],a.x+a.width-v[0]-m)),y=Math.max(a.y,Math.min(bottom-v[1],a.y+a.height-v[1]-m));target.setMinimumSize(300,360);target.setMaximumSize(900,900);target.setResizable(true);target.setSize(v[0],v[1],false);target.setPosition(Math.round(x),Math.round(y),false);target.webContents.send("character:size",key)}const agent=getAgent();if(agent){agent.settings={...agent.settings,characterSize:key};agent.persistSettings()}}
 async function waitForCharacterReady(target,timeoutMs=30000,options={}){
  const requireRig=options?.requireRig!==false;
  if(!target||target.isDestroyed())return{ready:false,stage:"window"};
  const deadline=Date.now()+timeoutMs;let last=null;
  while(Date.now()<deadline){
   try{
    last=await target.webContents.executeJavaScript(`(()=>{try{const rt=window.saeedCharacterRuntime||{},e=rt.engine,c=rt.controller,p=e?.getCharacterPoseStatus?.()||{},names=e?.getAvailableBoneNames?.()||[],map=e?.getBoneMap?.()||{};if(!p.loaded||!names.length)return{ready:false,stage:p.loaded?"skeleton":"glb",loaded:Boolean(p.loaded),boneCount:names.length,mapped:Object.keys(map).length,controller:Boolean(c)};if(c&&!Object.keys(map).length){try{c.onCharacterLoaded?.()}catch{}}const next=e?.getBoneMap?.()||{};const mapped=Object.keys(next).length;return{ready:Boolean(p.loaded&&names.length&&(${JSON.stringify(requireRig)}||mapped)),stage:mapped?"ready":"skeleton",loaded:Boolean(p.loaded),boneCount:names.length,mapped,controller:Boolean(rt.controller),actualBones:Object.keys(p.bones||{}).length}}catch(error){return{ready:false,stage:"renderer",error:error?.message||String(error)}}})()`,true);
    if(last?.loaded&&last?.boneCount&&!last?.mapped){try{await target.webContents.executeJavaScript(`(()=>{const c=window.saeedCharacterRuntime?.controller;if(c){try{c.onCharacterLoaded?.()}catch{};if(!Object.keys(c.engine?.getBoneMap?.()||{}).length){try{c.autoMap?.()}catch{}}}return true})()`,true)}catch{}
      try{const retry=await target.webContents.executeJavaScript(`(()=>{const e=window.saeedCharacterRuntime?.engine,c=window.saeedCharacterRuntime?.controller,p=e?.getCharacterPoseStatus?.()||{},n=e?.getAvailableBoneNames?.()||[],m=e?.getBoneMap?.()||{};return{ready:Boolean(p.loaded&&n.length&&(${JSON.stringify(requireRig)}||Object.keys(m).length)),loaded:Boolean(p.loaded),boneCount:n.length,mapped:Object.keys(m).length,controller:Boolean(c),actualBones:Object.keys(p.bones||{}).length}})()`,true);if(retry?.ready)return retry;last=retry}catch{}}
    if(last?.ready)return last;
   }catch(error){last={ready:false,stage:"ipc",error:error?.message||String(error)}}
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  return last||{ready:false,stage:"timeout"};
 }
 async function showCharacter(){
  try{
   let target=getCharacterWindow();
   if(!target||target.isDestroyed())await createCharacterWindow();
   target=getCharacterWindow();
   if(!target||target.isDestroyed())return false;
   try{target.webContents.setBackgroundThrottling(false)}catch{}
   try{target.webContents.send("character:visibility","visible")}catch{}
   target.show();
   target.focus();
   diagnostic("INFO","3D WINDOW","Character window shown; readiness continues asynchronously",{domain:"3D"});
   void waitForCharacterReady(target,30000,{requireRig:true}).then(readiness=>{
    if(readiness?.ready)diagnostic("INFO","3D WINDOW READY","Character renderer reached Skeleton→Rig READY state",{domain:"3D",readiness});
    else diagnostic("ERROR","3D WINDOW READY","Character renderer did not reach Skeleton→Rig READY state",{domain:"3D",readiness});
   }).catch(error=>diagnostic("ERROR","3D WINDOW READY",error?.stack||error?.message||String(error),{domain:"3D"}));
   return true;
  }catch(e){diagnostic("ERROR","3D WINDOW",e?.stack||e?.message||String(e),{domain:"3D"});return false}
 }
 function hideCharacter(){
 const target=getCharacterWindow();
 if(!target||target.isDestroyed()){setCharacterWindow(null);return;}
 try{captureCharacter3DWindowSettings()}catch{}
 try{target.webContents.send("character:visibility","hidden")}catch{}
 try{target.hide()}catch{}
 // IMPORTANT: keep the Character Renderer alive.
 // Destroying this window destroys CharacterEngine, boneGroups and the actual THREE.Bone references.
 // Performance, Character Studio and Normalize must continue using the same authoritative skeleton.
 diagnostic("INFO","3D WINDOW","Saeed hidden: renderer and authoritative skeleton preserved in memory",{domain:"3D",preserved:true});
}
 async function createCharacterWindow(){let target=getCharacterWindow();if(target&&!target.isDestroyed())return target;target=new BrowserWindow({name:"saeed-character",width:430,height:520,minWidth:300,minHeight:360,frame:false,transparent:true,alwaysOnTop:true,show:false,hasShadow:false,resizable:true,skipTaskbar:false,icon:windowsIconPath(),webPreferences:{preload:path.join(__dirname,"..","..","preload.js"),contextIsolation:true,nodeIntegration:false,sandbox:false,backgroundThrottling:false,autoplayPolicy:"no-user-gesture-required"}});target.setIcon(windowsIconPath());if(process.platform==="win32")target.setAppDetails({appId:"ai.saeed.desktop",appIconPath:windowsIconPath(),appIconIndex:0,relaunchCommand:process.execPath,relaunchDisplayName:"Saeed AI Character"});target.on("move",()=>{clearTimeout(saveMoveTimer);saveMoveTimer=setTimeout(()=>{try{captureCharacter3DWindowSettings()}catch{}},250)});target.on("closed",()=>{clearTimeout(saveMoveTimer);try{captureCharacter3DWindowSettings()}catch{};setCharacterWindow(null)});target.webContents.on("context-menu",()=>contextMenu?.());setCharacterWindow(target);await target.loadFile(path.join(__dirname,"..","..","renderer","character.html"));applyCharacter3DWindowSettings();try{const persisted=readPersistedCharacter?.();let data=null,source="bundled";if(persisted?.data?.length>=20){data=Buffer.from(persisted.data);source="persisted";diagnostic("INFO","GLB STARTUP","Restoring previously selected character",{path:persisted.path,size:persisted.size})}else{const bundled=path.join(__dirname,"..","..","..","assets","Saeed_AI-3D.glb");if(!fs.existsSync(bundled))throw new Error("Authoritative Saeed GLB is missing: "+bundled);data=fs.readFileSync(bundled);if(data.length<20)throw new Error("Authoritative Saeed GLB is invalid or empty: "+bundled);diagnostic("INFO","GLB STARTUP","No persisted character found; using bundled authoritative Saeed GLB",{path:bundled,size:data.length})}sendCharacterData(new Uint8Array(data));sendPendingCharacterData();setTimeout(()=>{const w=getCharacterWindow();if(w&&!w.isDestroyed()&&pendingCharacterData){try{w.webContents.send("character:selected",pendingCharacterData.data,pendingCharacterData.generation)}catch(e){diagnostic("ERROR","GLB STARTUP DELIVERY",e?.message||String(e))}}},0);diagnostic("INFO","GLB STARTUP","Character startup asset prepared",{source,size:data.length})}catch(e){diagnostic("ERROR","GLB STARTUP",e.message)}const positionState=readCharacter3DSettings();if(positionState.window.positionInitialized&&Number.isFinite(Number(positionState.window.x))&&Number.isFinite(Number(positionState.window.y))){applyCharacter3DWindowSettings()}else{fitCharacterToDisplay(screen.getPrimaryDisplay(),{bottomRight:true});const [x,y]=target.getPosition();writeCharacter3DSettings({...positionState,window:{...positionState.window,x,y,positionInitialized:true}})}target.show();return target}
 async function command(command={}){
  let win=getCharacterWindow();
  if(!win||win.isDestroyed()){
   try{win=await createCharacterWindow()}catch(error){diagnostic("ERROR","CHARACTER WINDOW CREATE",error?.stack||error?.message||String(error),{domain:"3D",action:String(command?.action||"unknown")});return{ok:false,error:error?.message||String(error),diagnostic:{stage:"window-create"}}}
   win=getCharacterWindow();
  }
  if(!win||win.isDestroyed()){const error="Character window could not be created";diagnostic("ERROR","CHARACTER WINDOW",error,{domain:"3D",action:String(command?.action||"unknown")});return{ok:false,error};}
  if(!ipcMain){const error="Character command IPC is unavailable";diagnostic("ERROR","CHARACTER IPC",error,{domain:"3D",action:String(command?.action||"unknown")});return{ok:false,error,diagnostic:{stage:"ipc",action:command?.action}};}
  try{win.webContents.setBackgroundThrottling(false)}catch{}
  // Every controller operation starts from a real Skeleton→Rig READY state.
  // Bone edits remain direct once readiness is established; readiness never rebinds
  // an already valid rig during the actual edit operation.
  // Binding/authoring bootstrap actions must be allowed with Skeleton READY.
  // Requiring Rig READY for autoMap/remap/bindSlot creates a circular deadlock:
  // those actions are precisely what establish the Rig mapping.
  const actionName=String(command?.action||"");
  const skeletonOnlyActions=new Set(["boneNames","boneRotation","setBoneRotation","setBoneEditorRotation","resetBoneToRest","autoMap","remap","bindSlot","beginAuthoring","endAuthoring","saveRestPose","normalizeRestPose","snapshotRestPose","status","listMotions","setAnimationEnabled","setAnimationPaused","stop","stopAll","resetPose"]);
  const directBonePose=actionName==="pose"&&command?.pose?.__bones&&typeof command.pose.__bones==="object";
  const requiresRig=!skeletonOnlyActions.has(actionName)&&!directBonePose;
  const readiness=actionName==="status"?{ready:true,stage:"status"}:await waitForCharacterReady(win,30000,{requireRig:requiresRig});
  if(!readiness?.ready){diagnostic("ERROR","CHARACTER COMMAND READINESS",`Cannot execute ${String(command?.action||"unknown")}: renderer readiness failed`,{domain:"3D",action:String(command?.action||"unknown"),readiness});return{ok:false,error:`Character renderer readiness failed at ${readiness?.stage||"unknown"}: ${readiness?.error||"see diagnostics"}`,diagnostic:readiness};}
  if(win.webContents.isLoadingMainFrame?.()){
   try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{cleanup();reject(new Error("Character renderer did not finish loading"))},15000);const cleanup=()=>{clearTimeout(timer);win.webContents.removeListener("did-finish-load",ready);win.webContents.removeListener("did-fail-load",failed)};const ready=()=>{cleanup();resolve()};const failed=(_,code,description)=>{cleanup();reject(new Error("Character renderer load failed ("+code+"): "+description))};win.webContents.once("did-finish-load",ready);win.webContents.once("did-fail-load",failed)})}catch(error){diagnostic("ERROR","CHARACTER RENDERER LOAD",error?.stack||error?.message||String(error),{domain:"3D",action:String(command?.action||"unknown")});return{ok:false,error:error?.message||String(error),diagnostic:{stage:"renderer-load"}}}
  }
  const requestId="character-command-"+Date.now()+"-"+(++characterLoadGeneration);
  return await new Promise(resolve=>{
   let settled=false;
   const finish=result=>{if(settled)return;settled=true;clearTimeout(timeout);ipcMain.removeListener("character:command-result",onResult);resolve(result)};
   const onResult=(_,id,result)=>{if(id===requestId)finish(result)};
   const timeout=setTimeout(()=>{const error="Character command timed out";diagnostic("ERROR","CHARACTER COMMAND TIMEOUT",error,{domain:"3D",action:String(command?.action||"unknown"),requestId});finish({ok:false,error,diagnostic:{stage:"command-timeout",requestId,action:command?.action}})},30000);
   ipcMain.on("character:command-result",onResult);
   try{win.webContents.send("character:command",requestId,command)}catch(error){diagnostic("ERROR","CHARACTER IPC SEND",error?.stack||error?.message||String(error),{domain:"3D",action:String(command?.action||"unknown"),requestId});finish({ok:false,error:error?.message||String(error),diagnostic:{stage:"ipc-send",requestId}})}
  });
 }
 function sendPendingCharacterData(){
  const editor=getRestPoseEditorWindow?.();
  if(!editor||editor.isDestroyed()||!pendingCharacterData)return false;
  try{
   editor.webContents.send("character:selected",pendingCharacterData.data,pendingCharacterData.generation);
   return true;
  }catch(error){diagnostic("ERROR","STUDIO GLB DELIVERY",error?.stack||error?.message||String(error));return false}
 }
 function closeRestPoseEditor(){const editor=getRestPoseEditorWindow?.();if(!editor||editor.isDestroyed())return true;try{editor.hide();return true}catch(error){diagnostic("ERROR","STUDIO CLOSE",error?.stack||error?.message||String(error));return false}}
 function characterSizeMenu(){return[{label:"Small",click:()=>setSaeedSize("small")},{label:"Medium",click:()=>setSaeedSize("medium")},{label:"Large",click:()=>setSaeedSize("large")}]}
 return{displayForWindow,fitCharacterToDisplay,sendCharacterData,sendPendingCharacterData,closeWindow:closeRestPoseEditor,getPendingCharacter:()=>{if(pendingCharacterData)return{data:pendingCharacterData.data,generation:pendingCharacterData.generation};try{const persisted=readPersistedCharacter?.();if(persisted?.data?.length>=20)return{data:persisted.data,generation:characterLoadGeneration||0};const bundled=path.join(__dirname,"..","..","..","assets","Saeed_AI-3D.glb");if(fs.existsSync(bundled)){const data=new Uint8Array(fs.readFileSync(bundled));if(data.length>=20)return{data,generation:characterLoadGeneration||0}}}catch(error){diagnostic("ERROR","STUDIO GLB DELIVERY",error?.message||String(error))}return null},replaceCharacterForCi,chooseCharacter,setSaeedSize,showCharacter,hideCharacter,createCharacterWindow,command,characterSizeMenu,captureCharacter3DWindowSettings,readCharacter3DSettings,writeCharacter3DSettings,character3DSettingsFile};
}
module.exports={createCharacterHost};