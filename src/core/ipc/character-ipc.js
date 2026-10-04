function registerCharacterIpc(deps){const {ipcMain}=deps;ipcMain.handle("character:choose",()=>{chooseCharacter();return true});
ipcMain.handle("character:controller:get",async()=>{
 if(!characterWin||characterWin.isDestroyed()) return {available:false};
 try{return characterWin.webContents.executeJavaScript("window.saeedCharacterController?.status?.()||null",true).then(x=>x||{available:false});}
 catch(e){return {available:false,error:e.message}}
});
ipcMain.handle("character:controller:command",async(_,command={})=>{
 if(!characterWin||characterWin.isDestroyed()) return {ok:false,error:"Character window is not available"};
 const payload=JSON.stringify(command||{});
 const script="(async()=>{const c=window.saeedCharacterController;if(!c)return {ok:false,error:'Character controller unavailable'};const x="+payload+";if(x.action==='play')return {ok:c.play(String(x.motion||'idle'),x.options||{})};if(x.action==='stop')return {ok:c.stop(x.motion)};if(x.action==='stopAll')return {ok:c.stopAll()};if(x.action==='pose')return {ok:true,pose:c.setPose(x.pose||{})};if(x.action==='idlePose')return {ok:true,pose:c.setIdlePose(x.pose||{})};if(x.action==='resetPose')return {ok:c.resetPose()};if(x.action==='status')return {ok:true,status:c.status()};if(x.action==='remap')return {ok:c.remap(x.mapping||{})};if(x.action==='limit')return {ok:c.setLimit(x.slot,x.limit)};if(x.action==='semantic')return c.semantic(x.intent,x.options||{});if(x.action==='defineMotion')return {ok:true,motion:c.defineMotion(x.motion||{})};if(x.action==='deleteMotion')return {ok:c.deleteMotion(x.id)};if(x.action==='listMotions')return {ok:true,motions:c.listMotions()};if(x.action==='face')return {ok:true,result:c.face?.expression?.(x.expression,x.intensity)};if(x.action==='blink')return {ok:c.face?.blink?.()};if(x.action==='lookAt')return {ok:c.face?.lookAt?.(x.x,x.y,x.z)};if(x.action==='viseme')return {ok:c.face?.viseme?.(x.viseme,x.value)};if(x.action==='fingers')return {ok:c.fingers?.curl?.(x.hand,x.amount)};if(x.action==='boneNames')return {ok:true,bones:window.saeedAvatar?.getAvailableBoneNames?.()||[]};return {ok:false,error:'Unknown character controller action'}})()";
 try{return await characterWin.webContents.executeJavaScript(script,true)}catch(e){return {ok:false,error:e.message}}
});
ipcMain.handle("character:3d:get",()=>captureCharacter3DWindowSettings());
ipcMain.handle("character:3d:set",(_,patch={})=>{
 const current=captureCharacter3DWindowSettings(), next={...current,...patch,window:{...current.window,...(patch.window||{})},camera:{...current.camera,...(patch.camera||{})},character:{...current.character,...(patch.character||{})},canvas:{...current.canvas,...(patch.canvas||{})}};
 const saved=writeCharacter3DSettings(next);
 if(characterWin&&!characterWin.isDestroyed()){
  const w=Math.max(300,Math.min(1400,Math.round(Number(saved.window.width)||430))),h=Math.max(360,Math.min(1400,Math.round(Number(saved.window.height)||520)));
  characterWin.setSize(w,h,false);
  if(Number.isFinite(Number(saved.window.x))&&Number.isFinite(Number(saved.window.y))){const d=screen.getDisplayNearestPoint({x:Math.round(Number(saved.window.x))+w/2,y:Math.round(Number(saved.window.y))+h/2})||screen.getPrimaryDisplay();const a=d.workArea;const x=Math.max(a.x,Math.min(Math.round(Number(saved.window.x)),a.x+Math.max(0,a.width-w)));const y=Math.max(a.y,Math.min(Math.round(Number(saved.window.y)),a.y+Math.max(0,a.height-h)));saved.window.x=x;saved.window.y=y;}
  writeCharacter3DSettings(saved);
  characterWin.webContents.send("character:3d-settings",saved);
 }
 return saved;
});

}
module.exports={registerCharacterIpc};
