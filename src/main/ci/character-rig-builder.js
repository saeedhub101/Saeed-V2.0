// Character rig-builder acceptance routine. All Electron/runtime dependencies are injected explicitly.
async function runCiCharacterRigBuilder(mode){
 const report={schemaVersion:1,mode,startedAt:new Date().toISOString(),passed:false,checks:[],error:null};
 const check=(name,passed,details={})=>{report.checks.push({name,passed:Boolean(passed),details});if(!passed)console.error("CHARACTER_RIG_BUILDER_FAIL="+name,JSON.stringify(details))};
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const output=process.env.SAEED_CI_RIG_REPORT||path.join(process.cwd(),"dist","ci-character-rig-builder-"+mode+".json");
 const statePath=process.env.SAEED_CI_RIG_STATE;
 const near=(a,b,t=.035)=>Number.isFinite(Number(a))&&Number.isFinite(Number(b))&&Math.abs(Number(a)-Number(b))<=t;
 const getTarget=()=>{const state=getState();return state?.characterWin&&!state.characterWin.isDestroyed()?state.characterWin:null};
 const getSnapshot=async()=>{const win=getTarget();if(!win)throw new Error("Character renderer window is unavailable");return await win.webContents.executeJavaScript("window.saeedCharacterRuntime?.engine?.getDeformationSnapshot?.(2400)||null")};
 const capture=async name=>{const win=getTarget();if(!win)throw new Error("Character renderer window is unavailable for visual capture");try{await win.webContents.executeJavaScript("(()=>{const c=document.querySelector('canvas');if(!c)return false;for(const el of document.body.querySelectorAll('*')){if(el===c||el.contains(c))continue;const r=el.getBoundingClientRect();if(r.width>0&&r.height>0){el.dataset.saeedCiOldVisibility=el.style.visibility;el.dataset.saeedCiCaptureHidden='1';el.style.visibility='hidden'}}return true})()")}catch{}let image;try{await wait(60);image=await win.webContents.capturePage()}finally{try{await win.webContents.executeJavaScript("document.querySelectorAll('[data-saeed-ci-capture-hidden=\"1\"]').forEach(el=>{el.style.visibility=el.dataset.saeedCiOldVisibility||'';delete el.dataset.saeedCiOldVisibility;delete el.dataset.saeedCiCaptureHidden})")}catch{}}const envKey="SAEED_CI_RIG_SCREENSHOT_"+name.toUpperCase().replace(/[^A-Z0-9]/g,"_");const file=process.env[envKey]||path.join(process.cwd(),"dist","ci-character-rig-builder-"+name+".png");fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,image.toPNG());return{file,width:image.getSize().width,height:image.getSize().height,bitmap:image.toBitmap()}};
 const imageDiff=(a,b)=>{if(a.bitmap.length!==b.bitmap.length||!a.bitmap.length)return{changedPixels:0,fraction:0};let changed=0,total=a.bitmap.length/4;for(let i=0;i<a.bitmap.length;i+=4){if(Math.abs(a.bitmap[i]-b.bitmap[i])>18||Math.abs(a.bitmap[i+1]-b.bitmap[i+1])>18||Math.abs(a.bitmap[i+2]-b.bitmap[i+2])>18||Math.abs(a.bitmap[i+3]-b.bitmap[i+3])>18)changed++}return{changedPixels:changed,totalPixels:total,fraction:changed/total}};
 const displacement=(a,b)=>{const map=new Map((a?.samples||[]).map(s=>[s.key,s.p]));let count=0,sum=0,max=0,finite=0;for(const item of b?.samples||[]){const p=map.get(item.key);if(!p||!item.p||p.length!==3)continue;const d=Math.hypot(item.p[0]-p[0],item.p[1]-p[1],item.p[2]-p[2]);if(!Number.isFinite(d))continue;finite++;if(d>.001)count++;sum+=d;max=Math.max(max,d)}return{matchedSamples:finite,displacedVertices:count,meanDisplacement:finite?sum/finite:0,maxDisplacement:max}};
 try{
  const target=getTarget();check("packaged-character-renderer-created",Boolean(target),{exists:Boolean(target)});
  if(!target)throw new Error("Character renderer window did not start");
  if(mode==="save"){

   await wait(350);
   const liveRig=await characterHost.command({action:"getRig"});
   const liveBefore=await getSnapshot();
   const liveBeforePose=await target.webContents.executeJavaScript("window.saeedCharacterRuntime?.engine?.getCharacterPoseStatus?.()||null");
   check("actual-saeed-glb-has-loaded-skinned-body",liveRig?.ok===true&&liveRig.bones.length>0&&liveBefore?.skinnedMeshCount>0&&liveBefore?.weightedVertices>0,{boneCount:liveRig?.bones?.length||0,skinnedMeshCount:liveBefore?.skinnedMeshCount||0,vertexCount:liveBefore?.vertexCount||0});
   const saeedBeforeShot=await capture("saeed-before");
   const morphResult=await target.webContents.executeJavaScript("(()=>{const e=window.saeedCharacterRuntime?.engine,b=e?.getMorphSnapshot?.(),pose=()=>e?.getCharacterPoseStatus?.()?.bones||{};if(!e||!b)return{ok:false,error:'morph/pose snapshot API unavailable'};const beforePose=pose(),beforeJaw=beforePose.jaw?.rotation||beforePose.mandible?.rotation||null,ok=Boolean(e.setCharacterViseme?.('aa',.65)),a=e.getMorphSnapshot?.(),afterPose=pose(),afterJaw=afterPose.jaw?.rotation||afterPose.mandible?.rotation||null;const changedMorphs=Object.keys(a?.values||{}).filter(k=>Math.abs(Number(a.values[k])-Number(b.values[k]||0))>.1);const jawChanged=Boolean(beforeJaw&&afterJaw&&Math.abs(Number(afterJaw.x)-Number(beforeJaw.x))>.05);e.setCharacterViseme?.('aa',0);return{ok,count:b.count,changedMorphs,jawChanged,beforeJaw,afterJaw,available:b.names.slice(0,40)}})()");
   check("viseme-alias-changes-real-shape-key-or-jaw-fallback",morphResult?.ok===true&&(morphResult.changedMorphs?.length>0||morphResult.jawChanged===true),{ok:Boolean(morphResult?.ok),morphCount:morphResult?.count||0,changedMorphs:morphResult?.changedMorphs||[],jawChanged:Boolean(morphResult?.jawChanged),beforeJaw:morphResult?.beforeJaw||null,afterJaw:morphResult?.afterJaw||null,available:morphResult?.available||[],error:morphResult?.error||null});
   await characterHost.command({action:"setUserBusy",value:true});
   const liveMotion=await characterHost.command({action:"play",motion:"wave",options:{priority:100,blend:.01}});
   await wait(700);
   const liveAfter=await getSnapshot(),liveAfterPose=await target.webContents.executeJavaScript("window.saeedCharacterRuntime?.engine?.getCharacterPoseStatus?.()||null"),liveDelta=displacement(liveBefore,liveAfter),saeedAfterShot=await capture("saeed-after"),saeedVisual=imageDiff(saeedBeforeShot,saeedAfterShot);
   const motionBoneChanges=["rightUpperArm","rightForeArm"].map(slot=>{const value=liveRig.mapping?.[slot],name=typeof value==="string"?value:value?.name,before=liveBeforePose?.bones?.[name]?.rotation,after=liveAfterPose?.bones?.[name]?.rotation;return{slot,name:name||null,delta:before&&after?Math.max(Math.abs(after.x-before.x),Math.abs(after.y-before.y),Math.abs(after.z-before.z)):null,before:before||null,after:after||null}});
   check("actual-saeed-motion-deforms-real-skinned-vertices",liveMotion?.ok===true&&liveDelta.displacedVertices>0&&liveDelta.maxDisplacement>.003,{ok:Boolean(liveMotion?.ok),...liveDelta,mappedSlots:Object.keys(liveRig.mapping||{}),motionBoneChanges,motionStatus:liveMotion?.status||null});
   check("actual-saeed-body-visually-changes-during-motion",liveMotion?.ok===true&&saeedVisual.fraction>.001&&saeedVisual.changedPixels>50,{...saeedVisual,motionBoneChanges,before:saeedBeforeShot.file,after:saeedAfterShot.file});
   await characterHost.command({action:"stopAll"});
   await target.webContents.executeJavaScript("window.saeedCharacterRuntime?.engine?.wakeRender?.(1200);true");
   const directBefore=await getSnapshot();
   const directTest=await target.webContents.executeJavaScript("(()=>{const e=window.saeedCharacterRuntime?.engine,m=e?.getCharacterRigAutoMap?.()||{},v=m.rightUpperArm,name=typeof v==='string'?v:v?.name,before=name?e.getBoneRotation?.(name):null;if(!name||!before)return{ok:false,name:name||null,error:'rightUpperArm mapping or rotation unavailable'};const target={x:before.x+.6,y:before.y,z:before.z},ok=e.setBoneRotation?.(name,target);e.wakeRender?.(1200);return{ok:Boolean(ok),name,before,target,after:e.getBoneRotation?.(name)}})()");
   await wait(250);
   const directAfter=await getSnapshot(),directDelta=displacement(directBefore,directAfter);
   check("actual-saeed-mapped-arm-bone-deforms-real-skinned-vertices",directTest?.ok===true&&directDelta.displacedVertices>0&&directDelta.maxDisplacement>.003,{ok:Boolean(directTest?.ok),name:directTest?.name||null,...directDelta});
   if(directTest?.name)await target.webContents.executeJavaScript("window.saeedCharacterRuntime?.engine?.resetBoneToRest?.("+JSON.stringify(directTest.name)+");window.saeedCharacterRuntime?.engine?.wakeRender?.(1200);true");
   await characterHost.command({action:"setUserBusy",value:false});

   const fixture=process.env.SAEED_CI_RIG_FIXTURE;
   if(!fixture||!fs.existsSync(fixture))throw new Error("SAEED_CI_RIG_FIXTURE must point to a generated static humanoid GLB");
   const loaded=await characterHost.replaceCharacterForCi(fixture);
   check("static-humanoid-glb-loaded-in-real-renderer",loaded?.ok===true&&Number(loaded?.meshCount)>=8,{ok:Boolean(loaded?.ok),meshCount:loaded?.meshCount||0,boneCount:loaded?.boneCount||0,error:loaded?.error||null});
   if(loaded?.ok!==true)throw new Error("Static humanoid fixture failed actual packaged renderer loading: "+String(loaded?.error||"unknown"));
   await wait(350);
   const initial=await target.webContents.executeJavaScript("window.saeedCharacterRuntime?.engine?.get3DStatus?.()||null");
   check("static-mesh-is-rendered-before-rigging",Boolean(initial?.character?.loaded)&&Number(initial?.metrics?.renderCount)>0,{loaded:Boolean(initial?.character?.loaded),renderCount:initial?.metrics?.renderCount||0});
   const beforeBuild=await getSnapshot();
   check("unrigged-fixture-has-static-meshes",Boolean(beforeBuild)&&beforeBuild.skinnedMeshCount===0&&beforeBuild.meshCount>=8,{skinnedMeshCount:beforeBuild?.skinnedMeshCount||0,meshCount:beforeBuild?.meshCount||0,vertexCount:beforeBuild?.vertexCount||0});
   const built=await characterHost.command({action:"buildProceduralRig",template:"full",options:{face:true,fingers:true}});
   const builtBones=Array.isArray(built?.bones)?built.bones:[];
   const expectedBoneNames=["head","jaw","leftEye","rightEye","leftUpperArm","leftForeArm","leftThigh","leftShin","leftThumb1","rightPinky4"];
   check("procedural-rig-builds-real-skeleton",built?.ok===true&&Number(built?.createdBoneCount)>=60&&Number(built?.meshCount)>=8,{ok:Boolean(built?.ok),createdBoneCount:built?.createdBoneCount||0,meshCount:built?.meshCount||0,mappedSlots:built?.mappedSlots||0,error:built?.error||null});
   check("face-and-finger-bone-chains-created",expectedBoneNames.every(n=>builtBones.includes(n)),{expected:expectedBoneNames,missing:expectedBoneNames.filter(n=>!builtBones.includes(n))});
   check("procedural-rig-profile-persisted",built?.persisted===true,{persisted:Boolean(built?.persisted)});
   if(built?.ok!==true)throw new Error("Procedural rig builder did not produce a skeleton");
   const rig=await characterHost.command({action:"getRig"});
   check("generated-bones-are-visible-through-character-api",rig?.ok===true&&rig.bones.length>=60,{ok:Boolean(rig?.ok),boneCount:rig?.bones?.length||0,mappedSlots:Object.keys(rig?.mapping||{}).length});
   const afterBuild=await getSnapshot();
   check("generated-meshes-are-skinned-and-weighted",Boolean(afterBuild?.ok)&&afterBuild.skinnedMeshCount>=8&&afterBuild.weightedVertices>0&&afterBuild.invalidWeightSums===0&&afterBuild.nonFiniteWeights===0&&afterBuild.nonFinitePositions===0&&afterBuild.finiteBounds===true,{skinnedMeshCount:afterBuild?.skinnedMeshCount||0,meshCount:afterBuild?.meshCount||0,vertexCount:afterBuild?.vertexCount||0,sampleCount:afterBuild?.sampleCount||0,weightedVertices:afterBuild?.weightedVertices||0,invalidWeightSums:afterBuild?.invalidWeightSums||0,nonFiniteWeights:afterBuild?.nonFiniteWeights||0,nonFinitePositions:afterBuild?.nonFinitePositions||0,finiteBounds:Boolean(afterBuild?.finiteBounds),bounds:afterBuild?.bounds||null});
   if(!afterBuild?.ok)throw new Error("Skinned geometry snapshot was unavailable");
   const beforeShot=await capture("before");
   const joints=[{bone:"leftUpperArm",rotation:{x:0,y:0,z:.36}},{bone:"leftForeArm",rotation:{x:0,y:0,z:.62}},{bone:"leftThigh",rotation:{x:0,y:0,z:.28}},{bone:"leftShin",rotation:{x:0,y:0,z:.34}}];
   const jointResults=[];
   for(const joint of joints){
    await characterHost.command({action:"stopAll"});
    const set=await characterHost.command({action:"setBoneRotation",bone:joint.bone,rotation:joint.rotation});
    await wait(100);
    const moved=await getSnapshot();
    const delta=displacement(afterBuild,moved);
    const passed=set?.ok===true&&delta.matchedSamples>0&&delta.displacedVertices>0&&delta.maxDisplacement>.003;
    jointResults.push({bone:joint.bone,passed,rotation:joint.rotation,...delta});
    check("joint-deformation-"+joint.bone,passed,jointResults[jointResults.length-1]);
    await characterHost.command({action:"setBoneRotation",bone:joint.bone,rotation:{x:0,y:0,z:0}});
   }
   const visibleJoint=await characterHost.command({action:"setBoneRotation",bone:"head",rotation:{x:.42,y:0,z:0}});
   await target.webContents.executeJavaScript("window.saeedCharacterRuntime?.engine?.wakeRender?.(2200);true");
   await wait(650);
   const posed=await getSnapshot(),deform=displacement(afterBuild,posed),afterShot=await capture("after"),visual=imageDiff(beforeShot,afterShot);
   check("vertex-positions-change-under-skinning",deform.matchedSamples>0&&deform.displacedVertices>0&&deform.maxDisplacement>.003,{...deform});
   check("joint-pose-visual-diagnostic-captured",visibleJoint?.ok===true&&afterShot.width>0&&afterShot.height>0&&afterShot.bitmap.length>0,{...visual,bone:"head",before:beforeShot.file,after:afterShot.file,captureWidth:afterShot.width,captureHeight:afterShot.height});
   const weightQuality=afterBuild.vertexCount>0?afterBuild.invalidWeightSums/afterBuild.vertexCount:1;
   check("skin-weight-quality-within-tolerance",afterBuild.vertexCount>0&&weightQuality<=.01&&afterBuild.nonFiniteWeights===0&&afterBuild.nonFinitePositions===0,{invalidWeightSums:afterBuild.invalidWeightSums,vertexCount:afterBuild.vertexCount,invalidRatio:weightQuality});
   const motionId="ci-avatar-agent-wave-persistence";
   const define=await characterHost.command({action:"defineMotion",motion:{id:motionId,duration:1,loop:false,layer:"body",keyframes:[{time:0,pose:{head:{x:0,y:0,z:0},leftForeArm:{x:0,y:0,z:0}}},{time:1,pose:{head:{x:.18,y:0,z:0},leftForeArm:{x:0,y:0,z:.42}}}]}});
   check("custom-motion-created-through-real-engine",define?.ok===true&&define?.motion?.id===motionId,{ok:Boolean(define?.ok),motionId:define?.motion?.id||null});
   const motionPlay=await characterHost.command({action:"play",motion:motionId,options:{priority:100,blend:.01}});
   await wait(450);
   const motionSnapshot=await getSnapshot();
   const motionDelta=displacement(afterBuild,motionSnapshot);
   check("custom-motion-changes-real-skinned-vertices",motionPlay?.ok===true&&motionDelta.displacedVertices>0&&motionDelta.maxDisplacement>.003,{ok:Boolean(motionPlay?.ok),...motionDelta});
   await characterHost.command({action:"stopAll"});
   const saveBone=await characterHost.command({action:"setBoneRotation",bone:"leftForeArm",rotation:{x:0,y:0,z:.62}});
   const savedPose=await characterHost.command({action:"saveRestPose"});
   const status=await characterHost.command({action:"status"});
   const actual=status?.status?.actualBones?.leftForeArm?.rotation||null;
   check("actual-joint-pose-saved-as-persistent-rest-pose",saveBone?.ok===true&&savedPose?.ok===true&&savedPose?.persisted===true&&savedPose?.restPose?.persisted===true&&actual&&near(actual.z,.62),{bone:"leftForeArm",rotation:actual,persisted:Boolean(savedPose?.persisted),profileId:savedPose?.restPose?.profileId||null,error:savedPose?.restPose?.persistenceError||savedPose?.error||null});
   const finalRig=await characterHost.command({action:"getRig"});
   const finalNames=Array.isArray(finalRig?.bones)?finalRig.bones:[];
   const finalMapping=finalRig?.mapping||{};
   const mappedSlot=Object.keys(finalMapping).find(k=>finalMapping[k]==="head")||"head";
   const state={schemaVersion:1,fixture:path.basename(fixture),template:"full",options:{face:true,fingers:true},expectedBones:builtBones,expectedBoneCount:built?.createdBoneCount||0,expectedPose:{bone:"leftForeArm",rotation:actual},motionId,expectedMotionSlots:["head","leftForeArm"],expectedMeshCount:built?.meshCount||0,expectedWeightQuality:{invalidWeightSums:afterBuild.invalidWeightSums,vertexCount:afterBuild.vertexCount},screenshots:{before:beforeShot.file,after:afterShot.file},visualDiff:visual,createdAt:new Date().toISOString()};
   if(!statePath)throw new Error("SAEED_CI_RIG_STATE is required");
   fs.mkdirSync(path.dirname(statePath),{recursive:true});fs.writeFileSync(statePath,JSON.stringify(state,null,2)+"\n","utf8");
   check("restart-marker-written",fs.existsSync(statePath),{statePath,boneCount:state.expectedBoneCount,motionId});
   check("rig-api-and-status-return-finite-bone-data",finalNames.length>=60&&Boolean(status?.status?.actualBones?.leftForeArm),{boneCount:finalNames.length,headSlot:mappedSlot});
  }else if(mode==="verify"){
   if(!statePath||!fs.existsSync(statePath))throw new Error("Rig builder restart state marker is missing");
   const saved=JSON.parse(fs.readFileSync(statePath,"utf8"));
   await wait(500);
   const rig=await characterHost.command({action:"getRig"});
   const bones=Array.isArray(rig?.bones)?rig.bones:[];
   const missing=(saved.expectedBones||[]).filter(n=>!bones.includes(n));
   check("procedural-rig-restored-after-new-process",rig?.ok===true&&missing.length===0&&bones.length>=saved.expectedBoneCount,{ok:Boolean(rig?.ok),expectedBoneCount:saved.expectedBoneCount,actualBoneCount:bones.length,missingBones:missing.slice(0,25)});
   const snapshot=await getSnapshot();
   check("restored-rig-has-real-skinned-geometry",Boolean(snapshot?.ok)&&snapshot.skinnedMeshCount>=saved.expectedMeshCount&&snapshot.invalidWeightSums===0&&snapshot.nonFiniteWeights===0&&snapshot.nonFinitePositions===0,{skinnedMeshCount:snapshot?.skinnedMeshCount||0,expectedMeshCount:saved.expectedMeshCount,vertexCount:snapshot?.vertexCount||0,invalidWeightSums:snapshot?.invalidWeightSums||0,nonFiniteWeights:snapshot?.nonFiniteWeights||0,nonFinitePositions:snapshot?.nonFinitePositions||0});
   const status=await characterHost.command({action:"status"});
   const actual=status?.status?.actualBones?.[saved.expectedPose?.bone]?.rotation||null,expected=saved.expectedPose?.rotation||{};
   check("saved-rest-pose-survives-full-app-restart",actual&&["x","y","z"].every(axis=>near(actual[axis],expected[axis],.05)),{bone:saved.expectedPose?.bone,expected,actual});
   const baseline=await characterHost.command({action:"boneRotation",bone:saved.expectedPose?.bone});
   check("rest-pose-is-new-baseline-not-original-pose",baseline?.ok===true&&baseline.rotation&&["x","y","z"].every(axis=>near(baseline.rotation[axis],0,.05)),{bone:saved.expectedPose?.bone,editorDelta:baseline?.rotation||null});
   const motions=await characterHost.command({action:"listMotions"});
   const savedMotion=(motions?.motions||[]).find(m=>m?.id===saved.motionId);
   check("custom-motion-survives-full-app-restart",Boolean(savedMotion)&&Array.isArray(savedMotion.keyframes)&&savedMotion.keyframes.length>=2,{motionId:saved.motionId,found:Boolean(savedMotion),keyframes:savedMotion?.keyframes?.length||0});
   if(savedMotion){
    await characterHost.command({action:"setBoneRotation",bone:"leftForeArm",rotation:{x:0,y:0,z:0}});
    const play=await characterHost.command({action:"play",motion:saved.motionId,options:{priority:100,blend:.01}});
    await wait(450);
    const moved=await getSnapshot(),delta=displacement(snapshot,moved);
    check("restarted-motion-still-drives-real-bones",play?.ok===true&&delta.displacedVertices>0&&delta.maxDisplacement>.003,{ok:Boolean(play?.ok),...delta});
    await characterHost.command({action:"stopAll"});
   }
   const verifyShot=await capture("restart");
   check("restart-visual-screenshot-captured",verifyShot.width>0&&verifyShot.height>0,{file:verifyShot.file,width:verifyShot.width,height:verifyShot.height});
  }else throw new Error("Unsupported Character Engine/Rig Builder test mode: "+mode);
 }catch(error){report.error=String(error?.stack||error);check("character-rig-builder-exception",false,{error:report.error})}
 report.finishedAt=new Date().toISOString();
 report.passed=report.checks.length>0&&report.checks.every(item=>item.passed);
 try{fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n","utf8")}catch(error){report.passed=false;report.error=String(error?.stack||error);console.error("Could not write Character Engine/Rig Builder report:",report.error)}
 console.log("CHARACTER_ENGINE_RIG_BUILDER_"+String(mode).toUpperCase()+"="+(report.passed?"PASS":"FAIL"));
 console.log(JSON.stringify(report,null,2));
 setTimeout(async()=>{try{await session.defaultSession.flushStorageData()}catch(error){console.error("CI storage flush failed:",error?.message||String(error))}app.exit(report.passed?0:1)},200);
}

module.exports = { runCiCharacterRigBuilder };
