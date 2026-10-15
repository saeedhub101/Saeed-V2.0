// Packaged-product acceptance logic is kept separate from application startup.
async function runCiProductAcceptance({ app, session, process, path, fs, characterHost, getState, composition, showAddons, showLearning, showCharacter, hideCharacter, ensureVoiceHost }){
 const report={schemaVersion:1,startedAt:new Date().toISOString(),passed:false,checks:[],error:null};
 const check=(name,passed,details={})=>{report.checks.push({name,passed:Boolean(passed),details});if(!passed)console.error("PACKAGED_ACCEPTANCE_FAIL="+name,JSON.stringify(details))};
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 try{
  const target=getState().characterWin;
  check("character-window-created",Boolean(target&&!target.isDestroyed()));
  if(!target||target.isDestroyed())throw new Error("Character window was not created");
  const rig=await characterHost.command({action:"getRig"});
  check("bundled-glb-loaded",rig?.ok===true&&Array.isArray(rig.bones)&&rig.bones.length>0,{boneCount:rig?.bones?.length||0,error:rig?.error||null});
  const mapping=rig?.mapping&&typeof rig.mapping==="object"?rig.mapping:{};
  check("humanoid-rig-mapped",Object.keys(mapping).length>0,{mappedSlots:Object.keys(mapping).length});
  const engineStatus=await target.webContents.executeJavaScript("window.saeedCharacterRuntime?.engine?.get3DStatus?.()");
  check("three-renderer-active",Boolean(engineStatus?.character?.loaded&&Number(engineStatus?.metrics?.renderCount)>0),{loaded:Boolean(engineStatus?.character?.loaded),renderCount:engineStatus?.metrics?.renderCount||0});
  const motion=await characterHost.command({action:"play",motion:"think",options:{priority:100}});
  check("semantic-motion-playback",motion?.ok===true,{ok:Boolean(motion?.ok),error:motion?.error||null});
  await wait(120);
  const stopped=await characterHost.command({action:"stopAll"});
  check("motion-stop",stopped?.ok===true,{ok:Boolean(stopped?.ok)});
  const initialGlbIntentMap=await characterHost.command({action:"glbIntentMapGet"});
  check("glb-intent-map-api-available",initialGlbIntentMap?.ok===true&&initialGlbIntentMap.mapping&&typeof initialGlbIntentMap.mapping==="object",{ok:Boolean(initialGlbIntentMap?.ok),mappingCount:Object.keys(initialGlbIntentMap?.mapping||{}).length,error:initialGlbIntentMap?.error||null});
  const glbIntentFixture=String(process.env.SAEED_CI_GLB_INTENT_FIXTURE||"");
  let glbIntentFixtureLoaded=false,glbIntentFixtureRestored=false,glbIntentMappingRestored=false;
  try{
   if(!glbIntentFixture||!fs.existsSync(glbIntentFixture)){
    check("glb-intent-test-fixture-loaded",false,{fixture:glbIntentFixture||null,error:"Animated GLB intent fixture was not provided"});
    check("glb-intent-map-set-readback",false,{error:"Cannot test mapping without the animated GLB fixture"});
    check("glb-semantic-intent-plays-mapped-glb-clip",false,{error:"Cannot test semantic playback without the animated GLB fixture"});
    check("glb-intent-map-stop",false,{error:"Cannot test clip stop without the animated GLB fixture"});
   }else{
    const fixtureLoad=await characterHost.replaceCharacterForCi(glbIntentFixture);
    glbIntentFixtureLoaded=fixtureLoad?.ok===true;
    check("glb-intent-test-fixture-loaded",glbIntentFixtureLoaded,{fixture:path.basename(glbIntentFixture),ok:glbIntentFixtureLoaded,error:fixtureLoad?.error||null});
    if(glbIntentFixtureLoaded){
     await wait(180);
     const fixtureClips=await characterHost.command({action:"glbClipList"});
     const testClip=(fixtureClips?.clips||[]).find(item=>item?.name==="CI-GLB-Intent-Wave")?.name||"";
     check("glb-intent-fixture-animation-present",Boolean(testClip),{clipNames:(fixtureClips?.clips||[]).map(item=>item?.name),expected:"CI-GLB-Intent-Wave"});
     if(testClip){
      const testIntent="ciGlbIntentMappingTest";
      const savedMap=await characterHost.command({action:"glbIntentMapSet",mapping:{[testIntent]:testClip}});
      const readMap=await characterHost.command({action:"glbIntentMapGet"});
      const normalizedIntent="ciglbintentmappingtest";
      const mappingRoundTrip=savedMap?.ok===true&&savedMap?.persisted===true&&readMap?.ok===true&&readMap?.mapping?.[normalizedIntent]===testClip;
      check("glb-intent-map-set-readback",mappingRoundTrip,{saveOk:Boolean(savedMap?.ok),persisted:Boolean(savedMap?.persisted),readBack:readMap?.mapping?.[normalizedIntent]||null,expected:testClip,error:savedMap?.error||readMap?.error||null});
      const semanticResult=mappingRoundTrip?await characterHost.command({action:"semantic",intent:testIntent,options:{cooldownMs:0,loop:"once"}}):{played:false,error:"Mapping save/readback failed"};
      await wait(260);
      const playingStatus=await target.webContents.executeJavaScript("window.saeedCharacterRuntime?.engine?.getGlbAnimationStatus?.()||null");
      const actualPlayback=semanticResult?.source==="glb"&&semanticResult?.played===true&&semanticResult?.clip===testClip&&playingStatus?.active===true&&playingStatus?.name===testClip&&Number(playingStatus?.time)>0;
      check("glb-semantic-intent-plays-mapped-glb-clip",actualPlayback,{intent:testIntent,expectedClip:testClip,result:semanticResult,engineStatus:playingStatus});
      const stoppedGlb=await characterHost.command({action:"stopGlbClip"});
      const stoppedStatus=await target.webContents.executeJavaScript("window.saeedCharacterRuntime?.engine?.getGlbAnimationStatus?.()||null");
      const stopPassed=stoppedGlb?.ok===true&&stoppedGlb?.stopped===true&&stoppedStatus?.active===false;
      check("glb-intent-map-stop",stopPassed,{stopResult:stoppedGlb,statusAfterStop:stoppedStatus});
      const invalidMap=await characterHost.command({action:"glbIntentMapSet",mapping:{[testIntent]:"CI-CLIP-DOES-NOT-EXIST"}});
      const afterInvalidMap=await characterHost.command({action:"glbIntentMapGet"});
      check("glb-intent-map-invalid-clip-rejected",invalidMap?.ok!==true&&afterInvalidMap?.mapping?.[normalizedIntent]===testClip,{rejected:invalidMap?.ok!==true,preserved:afterInvalidMap?.mapping?.[normalizedIntent]===testClip,error:invalidMap?.error||null});
      const clearedMap=await characterHost.command({action:"glbIntentMapSet",mapping:{}});
      const afterClearMap=await characterHost.command({action:"glbIntentMapGet"});
      check("glb-intent-map-clear-readback",clearedMap?.ok===true&&clearedMap?.persisted===true&&!Object.prototype.hasOwnProperty.call(afterClearMap?.mapping||{},normalizedIntent),{clearOk:Boolean(clearedMap?.ok),remaining:Object.keys(afterClearMap?.mapping||{}),error:clearedMap?.error||null});
     }else{
      check("glb-intent-map-set-readback",false,{error:"Fixture animation clip missing"});
      check("glb-semantic-intent-plays-mapped-glb-clip",false,{error:"Fixture animation clip missing"});
      check("glb-intent-map-stop",false,{error:"Fixture animation clip missing"});
     }
    }else{
     check("glb-intent-map-set-readback",false,{error:"Fixture GLB could not be loaded"});
     check("glb-semantic-intent-plays-mapped-glb-clip",false,{error:"Fixture GLB could not be loaded"});
     check("glb-intent-map-stop",false,{error:"Fixture GLB could not be loaded"});
    }
   }
  }catch(error){
   check("glb-intent-mapping-runtime-exception",false,{error:error?.stack||String(error)});
  }finally{
   if(glbIntentFixtureLoaded){
    const bundledGlb=path.join(app.getAppPath(),"assets","Saeed_AI-3D.glb");
    const restored=await characterHost.replaceCharacterForCi(bundledGlb);
    glbIntentFixtureRestored=restored?.ok===true;
    await wait(250);
    check("glb-intent-test-fixture-restored",glbIntentFixtureRestored,{bundledGlb,ok:glbIntentFixtureRestored,error:restored?.error||null});
   }else{
    check("glb-intent-test-fixture-restored",true,{notNeeded:true});
   }
   if(glbIntentFixtureRestored&&initialGlbIntentMap?.ok===true){
    const restoreMap=await characterHost.command({action:"glbIntentMapSet",mapping:initialGlbIntentMap.mapping||{}});
    const verifyMap=await characterHost.command({action:"glbIntentMapGet"});
    glbIntentMappingRestored=restoreMap?.ok===true&&JSON.stringify(verifyMap?.mapping||{})===JSON.stringify(restoreMap?.mapping||{});
    check("glb-intent-map-restored",glbIntentMappingRestored,{ok:Boolean(restoreMap?.ok),count:Object.keys(verifyMap?.mapping||{}).length,error:restoreMap?.error||verifyMap?.error||null});
   }else{
    glbIntentMappingRestored=initialGlbIntentMap?.ok===true&&!glbIntentFixtureLoaded;
    check("glb-intent-map-restored",glbIntentMappingRestored,{notRestored:glbIntentFixtureLoaded&&!glbIntentFixtureRestored,initialMapAvailable:Boolean(initialGlbIntentMap?.ok)});
   }
  }
  const mappedHead=rig.mapping?.head;const restPoseBone=String(typeof mappedHead==="string"&&mappedHead?mappedHead:rig.bones.find(name=>/head/i.test(String(name)))||rig.bones[0]||"");
  const restPoseInitialStatus=await characterHost.command({action:"status"});
  const restPoseInitialBone=restPoseInitialStatus?.status?.actualBones?.[restPoseBone]||null;
  const originalRestRotation=restPoseInitialBone?.rotation?{x:Number(restPoseInitialBone.rotation.x),y:Number(restPoseInitialBone.rotation.y),z:Number(restPoseInitialBone.rotation.z)}:null;
  const originalRestPosition=restPoseInitialBone?.position?{x:Number(restPoseInitialBone.position.x),y:Number(restPoseInitialBone.position.y),z:Number(restPoseInitialBone.position.z)}:null;
  const desiredRestRotation={x:0.123,y:0.087,z:-0.061};
  // Keep autonomous gestures from racing the rest-pose persistence/reload assertion.
  // The production character remains autonomous; only this deterministic acceptance window is paused.
  const restPosePause=await characterHost.command({action:"setAnimationPaused",paused:true});
  check("rest-pose-reload-paused-autonomous-motion",restPosePause?.ok===true&&restPosePause?.paused===true,{ok:Boolean(restPosePause?.ok),paused:Boolean(restPosePause?.paused),error:restPosePause?.error||null});
  const editedBone=restPoseBone?await characterHost.command({action:"setBoneRotation",bone:restPoseBone,rotation:desiredRestRotation}):{ok:false,error:"No bone available"};
  const editRotation=editedBone?.rotation||{};
  const boneEditPassed=editedBone?.ok===true&&["x","y","z"].every(axis=>Number.isFinite(Number(editRotation[axis]))&&Math.abs(Number(editRotation[axis])-desiredRestRotation[axis])<0.02);
  check("rest-pose-real-bone-edit-applied",boneEditPassed,{bone:restPoseBone,rotation:editRotation,error:editedBone?.error||null});
  const rest=await characterHost.command({action:"saveRestPose"});
  check("rest-pose-persistent-readback",rest?.ok===true&&rest?.persisted===true&&rest?.restPose?.persisted===true,{persisted:Boolean(rest?.persisted),profileId:rest?.restPose?.profileId||null,error:rest?.restPose?.persistenceError||null});
  await hideCharacter();await wait(100);await showCharacter();await wait(250);
  const reloadPause=await characterHost.command({action:"setAnimationPaused",paused:true});
  const restoredBone=restPoseBone?await characterHost.command({action:"boneRotation",bone:restPoseBone}):{ok:false};
  const restoredRotation=restoredBone?.rotation||{};
  const restPoseReloadPassed=reloadPause?.ok===true&&restoredBone?.ok===true&&["x","y","z"].every(axis=>Number.isFinite(Number(restoredRotation[axis]))&&Math.abs(Number(restoredRotation[axis]))<0.03);
  check("rest-pose-reapplied-after-character-runtime-reload",restPoseReloadPassed,{bone:restPoseBone,editorDelta:restoredRotation,ok:Boolean(restoredBone?.ok),pauseOk:Boolean(reloadPause?.ok)});
  await characterHost.command({action:"setAnimationPaused",paused:false});
  const invalidCandidatePath=path.join(app.getPath("userData"),"ci-invalid-character-candidate.glb");
  try{
   fs.writeFileSync(invalidCandidatePath,Buffer.from("not-a-valid-glb"));
   const invalidCandidate=await characterHost.replaceCharacterForCi(invalidCandidatePath);
   const rigAfterInvalid=await characterHost.command({action:"getRig"});
   check("invalid-glb-rejected-preserves-current-character",invalidCandidate?.ok!==true&&rigAfterInvalid?.ok===true&&rigAfterInvalid?.bones?.length===rig.bones.length,{rejected:invalidCandidate?.ok!==true,error:invalidCandidate?.error||null,bonesBefore:rig.bones.length,bonesAfter:rigAfterInvalid?.bones?.length||0});
  }catch(error){check("invalid-glb-rejected-preserves-current-character",false,{error:error?.message||String(error)})}
  finally{try{fs.unlinkSync(invalidCandidatePath)}catch{}}
  const seenMotionBones=new Set();
  const motionSlots=Object.entries(rig.mapping||{}).filter(([slot,bone])=>typeof slot==="string"&&typeof bone==="string"&&rig.bones.includes(bone)&&!seenMotionBones.has(bone)&&seenMotionBones.add(bone)).map(([slot,bone])=>({slot,bone}));
  const motionBone=String(motionSlots[0]?.bone||"");
  const motionId="ci-generated-motion-acceptance";
  const motionStatus=await characterHost.command({action:"status"});
  const initialMotionRotations=Object.fromEntries(motionSlots.map(({bone})=>[bone,motionStatus?.status?.actualBones?.[bone]?.rotation||null]));
  const makePose=angle=>Object.fromEntries(motionSlots.map(({slot})=>[slot,{x:angle,y:angle*0.4,z:-angle*0.25}]));
  const makeCiMotion=angle=>({id:motionId,duration:1,loop:false,layer:"body",keyframes:[{time:0,pose:makePose(0)},{time:1,pose:makePose(angle)}]});
  let motionFirstRotations={},motionEditedRotations={};
  try{
   await characterHost.command({action:"stopAll"});
   const defined=motionSlots.length?await characterHost.command({action:"defineMotion",motion:makeCiMotion(0.35)}):{ok:false,error:"No mapped logical slots"};
   check("generated-motion-created",defined?.ok===true&&defined?.motion?.id===motionId,{mappedSlots:motionSlots.length,bones:motionSlots.map(item=>item.bone),error:defined?.error||null});
   const played=defined?.ok===true?await characterHost.command({action:"play",motion:motionId,options:{priority:100,blend:0.01}}):{ok:false};
   await wait(300);
   const afterFirst=await characterHost.command({action:"status"});
   motionFirstRotations=Object.fromEntries(motionSlots.map(({bone})=>[bone,afterFirst?.status?.actualBones?.[bone]?.rotation||null]));
   const changedMotionBones=motionSlots.filter(({bone})=>{const before=initialMotionRotations[bone],after=motionFirstRotations[bone];return Boolean(before&&after)&&["x","y","z"].some(axis=>Math.abs(Number(after[axis])-Number(before[axis]))>0.015)});
   const firstMoved=played?.ok===true&&changedMotionBones.length===motionSlots.length&&motionSlots.length>0;
   check("generated-motion-changes-real-bone",firstMoved,{mappedBoneCount:motionSlots.length,changedBoneCount:changedMotionBones.length,unchangedBones:motionSlots.filter(({bone})=>!changedMotionBones.some(item=>item.bone===bone)).map(item=>item.bone),representativeBone:motionBone,before:initialMotionRotations[motionBone]||null,after:motionFirstRotations[motionBone]||null});
   check("generated-motion-changes-all-mapped-bones",firstMoved,{mappedSlots:motionSlots.map(item=>item.slot),mappedBones:motionSlots.map(item=>item.bone),changedBones:changedMotionBones.map(item=>item.bone)});
   // Keep the same stored motion, change and persist one real mapped bone's rest pose,
   // then replay that unchanged motion. This detects stale/original-pose retargeting.
   await characterHost.command({action:"stopAll"});
   const restProbeBone=motionSlots[0]?.bone||"";
   const restBeforeStatus=await characterHost.command({action:"status"});
   const restBefore=restBeforeStatus?.status?.actualBones?.[restProbeBone]?.rotation||null;
   const restChanged=Boolean(restProbeBone&&restBefore)&&await characterHost.command({action:"setBoneRotation",bone:restProbeBone,rotation:{x:Number(restBefore.x)+0.22,y:Number(restBefore.y),z:Number(restBefore.z)}});
   const restSaved=restChanged?.ok===true?await characterHost.command({action:"saveRestPose"}):{ok:false,error:restChanged?.error||"Could not change mapped bone rest pose"};
   check("rest-pose-change-is-persisted",restSaved?.ok===true&&restSaved?.persisted===true&&restSaved?.restPose?.persisted===true,{bone:restProbeBone,persisted:Boolean(restSaved?.persisted),error:restSaved?.restPose?.persistenceError||restSaved?.error||null});
   await characterHost.command({action:"stopAll"});
   const replaySameMotion=restSaved?.ok===true?await characterHost.command({action:"play",motion:motionId,options:{priority:100,blend:0.01}}):{ok:false};
   await wait(300);
   const afterRestRebind=await characterHost.command({action:"status"});
   const afterRestRotations=Object.fromEntries(motionSlots.map(({bone})=>[bone,afterRestRebind?.status?.actualBones?.[bone]?.rotation||null]));
   const beforeProbe=motionFirstRotations[restProbeBone],afterProbe=afterRestRotations[restProbeBone];
   const restPoseChangedMotion=Boolean(replaySameMotion?.ok&&beforeProbe&&afterProbe)&&["x","y","z"].some(axis=>Math.abs(Number(afterProbe[axis])-Number(beforeProbe[axis]))>0.06);
   check("rest-pose-change-rebinds-existing-motion",restPoseChangedMotion,{bone:restProbeBone,motionId,rotationBeforeRestChange:beforeProbe||null,rotationAfterRestChange:afterProbe||null,delta:beforeProbe&&afterProbe?{x:Number(afterProbe.x)-Number(beforeProbe.x),y:Number(afterProbe.y)-Number(beforeProbe.y),z:Number(afterProbe.z)-Number(beforeProbe.z)}:null,playSucceeded:Boolean(replaySameMotion?.ok)});
   if(replaySameMotion?.ok)motionFirstRotations=afterRestRotations;
   await characterHost.command({action:"stopAll"});
   const edited=motionSlots.length?await characterHost.command({action:"defineMotion",motion:makeCiMotion(-0.55)}):{ok:false};
   const playedEdited=edited?.ok===true?await characterHost.command({action:"play",motion:motionId,options:{priority:100,blend:0.01}}):{ok:false};
   await wait(300);
   const afterEdited=await characterHost.command({action:"status"});
   motionEditedRotations=Object.fromEntries(motionSlots.map(({bone})=>[bone,afterEdited?.status?.actualBones?.[bone]?.rotation||null]));
   const editedChangedBones=motionSlots.filter(({bone})=>{const initial=initialMotionRotations[bone],first=motionFirstRotations[bone],editedRotation=motionEditedRotations[bone];return Boolean(initial&&first&&editedRotation)&&["x","y","z"].some(axis=>Math.abs(Number(editedRotation[axis])-Number(initial[axis]))>0.015)&&["x","y","z"].some(axis=>Math.abs(Number(editedRotation[axis])-Number(first[axis]))>0.025)});
   const editedMoved=playedEdited?.ok===true&&motionSlots.length>0&&editedChangedBones.length===motionSlots.length;
   check("edited-motion-changes-real-bone-differently",editedMoved,{mappedBoneCount:motionSlots.length,changedBoneCount:editedChangedBones.length,unchangedBones:motionSlots.filter(({bone})=>!editedChangedBones.some(item=>item.bone===bone)).map(item=>item.bone)});
   check("edited-motion-changes-all-mapped-bones-differently",editedMoved,{mappedSlots:motionSlots.map(item=>item.slot),mappedBones:motionSlots.map(item=>item.bone),changedBones:editedChangedBones.map(item=>item.bone)});
  }catch(error){check("generated-motion-and-edit-playback",false,{error:error?.message||String(error)})}
  finally{try{await characterHost.command({action:"stopAll"})}catch{}try{await characterHost.command({action:"deleteMotion",id:motionId})}catch{}}
  const motionList=await characterHost.command({action:"listMotions"});
  check("generated-motion-cleaned-up",Array.isArray(motionList?.motions)&&!motionList.motions.some(m=>m?.id===motionId),{remaining:motionList?.motions?.filter(m=>m?.id===motionId).length||0});
  try{
   const rotationSet=restPoseBone&&originalRestRotation?await characterHost.command({action:"setBoneRotation",bone:restPoseBone,rotation:originalRestRotation}):{ok:false};
   const positionSet=restPoseBone&&originalRestPosition?await characterHost.command({action:"setBonePosition",bone:restPoseBone,position:originalRestPosition}):{ok:false};
   const originalSaved=await characterHost.command({action:"saveRestPose"});
   const originalRead=await characterHost.command({action:"status"});
   const actualOriginal=originalRead?.status?.actualBones?.[restPoseBone]||null;
   const rotationRestored=Boolean(actualOriginal?.rotation&&originalRestRotation)&&["x","y","z"].every(axis=>Math.abs(Number(actualOriginal.rotation[axis])-originalRestRotation[axis])<0.02);
   const positionRestored=Boolean(actualOriginal?.position&&originalRestPosition)&&["x","y","z"].every(axis=>Math.abs(Number(actualOriginal.position[axis])-originalRestPosition[axis])<0.005);
   check("rest-pose-original-transform-restored",rotationSet?.ok===true&&positionSet?.ok===true&&originalSaved?.persisted===true&&rotationRestored&&positionRestored,{bone:restPoseBone,rotationRestored,positionRestored,persisted:Boolean(originalSaved?.persisted)});
  }catch(error){check("rest-pose-original-transform-restored",false,{error:error?.message||String(error)})}
  const voice=ensureVoiceHost();
  const whisper=voice.whisperRuntimePaths();
  check("packaged-whisper-runtime-present",Boolean(fs.existsSync(whisper.exe)&&fs.existsSync(whisper.model)),{executableExists:fs.existsSync(whisper.exe),modelExists:fs.existsSync(whisper.model)});
  try{
   const transcription=await voice.transcribeLocalWav(Buffer.alloc(24000).toString("base64"));
   check("packaged-whisper-transcription-runs",typeof transcription==="string",{transcriptCharacters:transcription.length});
  }catch(error){check("packaged-whisper-transcription-runs",false,{error:error?.message||String(error)})}
  const micOff=await voice.setMicMode("off");
  check("microphone-off-lifecycle",micOff===true&&voice.getCurrentMicMode()==="off",{mode:voice.getCurrentMicMode()});
  voice.ensureTts();
  check("tts-ready-when-unmuted",voice.getTtsReady()===true&&voice.getVoiceMuted()===false,{ready:voice.getTtsReady(),muted:voice.getVoiceMuted()});
  voice.setVoiceMuted(true);
  check("mute-is-output-only",voice.getVoiceMuted()===true&&voice.getCurrentMicMode()==="off"&&voice.getTtsReady()===false,{muted:voice.getVoiceMuted(),micMode:voice.getCurrentMicMode(),ttsReady:voice.getTtsReady()});
  voice.setVoiceMuted(false);
  check("unmute-restores-tts",voice.getVoiceMuted()===false&&voice.getTtsReady()===true&&voice.getCurrentMicMode()==="off",{muted:voice.getVoiceMuted(),micMode:voice.getCurrentMicMode(),ttsReady:voice.getTtsReady()});
  await hideCharacter();await wait(80);
  voice.setVoiceMuted(true);voice.setVoiceMuted(false);
  const characterVisible=()=>{const current=getState().characterWin;return Boolean(current&&!current.isDestroyed()&&current.isVisible())};
  check("unmute-while-hidden-keeps-tts-released",voice.getVoiceMuted()===false&&voice.getTtsReady()===false&&!characterVisible(),{muted:voice.getVoiceMuted(),ttsReady:voice.getTtsReady(),visible:characterVisible()});
  await showCharacter();await wait(120);
  check("show-after-hidden-unmute-restores-tts",characterVisible()&&voice.getTtsReady()===true,{visible:characterVisible(),ttsReady:voice.getTtsReady()===true});

  for(let i=1;i<=3;i++){
   await hideCharacter();await wait(80);
   check("hide-character-"+i,!characterVisible(),{visible:characterVisible()});
   await showCharacter();await wait(120);
   check("show-character-"+i,characterVisible(),{visible:characterVisible()});
  }
  const verifyFeaturePage=async(name,title,open,key,probe)=>{
   try{
    await open();await wait(180);
    const win=getState()[key];
    if(!win||win.isDestroyed())throw new Error("Feature window was not created");
    const page=await win.webContents.executeJavaScript(probe);
    const passed=win.isVisible()&&page?.readyState==="complete"&&page?.title===title&&page?.hasMain===true&&page?.apiAvailable===true&&page?.apiRoundTrip===true;
    check(name+"-window-and-ipc",passed,{visible:win.isVisible(),readyState:page?.readyState||null,title:page?.title||null,hasMain:Boolean(page?.hasMain),apiAvailable:Boolean(page?.apiAvailable),apiRoundTrip:Boolean(page?.apiRoundTrip)});
    return win;
   }catch(error){check(name+"-window-and-ipc",false,{error:error?.message||String(error)});return null}
  };
  const learningAcceptanceWindow=await verifyFeaturePage("learning","Saeed Learning",showLearning,"learningWin","(async()=>{const api=typeof window.saeed?.learning?.list===\"function\";const result=api?await window.saeed.learning.list():null;return{readyState:document.readyState,title:document.title,hasMain:!!document.querySelector(\"main\"),apiAvailable:api,apiRoundTrip:Array.isArray(result)}})()");
  const addonsAcceptanceWindow=await verifyFeaturePage("addons","Saeed Add-ons",showAddons,"addonsWin","(async()=>{const api=typeof window.saeed?.addons?.catalog===\"function\";const result=api?await window.saeed.addons.catalog():null;return{readyState:document.readyState,title:document.title,hasMain:!!document.querySelector(\"main\"),apiAvailable:api,apiRoundTrip:result!==null&&result!==undefined}})()");
  try{learningAcceptanceWindow?.close()}catch{}
  try{addonsAcceptanceWindow?.close()}catch{}
  const transcriptSettingBefore=composition.getTranscriptLabelEnabled();
  try{
   const enabled=composition.setTranscriptLabelEnabled(true);
   await wait(100);
   const rendered=await getState().characterWin.webContents.executeJavaScript("(()=>{window.saeedShowTranscript(\'CI recognized speech\');const e=document.getElementById(\'saeedTranscriptLabel\');return{text:e?.textContent||\'\',hidden:!!e?.hidden}})()");
   check("microphone-transcript-label-toggle-and-render",enabled===true&&rendered?.text==="CI recognized speech"&&rendered?.hidden===false,{enabled:Boolean(enabled),text:rendered?.text||"",hidden:rendered?.hidden!==false});
  }catch(error){check("microphone-transcript-label-toggle-and-render",false,{error:error?.message||String(error)})}
  finally{
   const restored=composition.setTranscriptLabelEnabled(transcriptSettingBefore);
   check("microphone-transcript-label-setting-restored",restored===transcriptSettingBefore&&composition.getTranscriptLabelEnabled()===transcriptSettingBefore,{restored:Boolean(restored),expected:Boolean(transcriptSettingBefore)});
  }
  const after=await characterHost.command({action:"getRig"});
  check("character-survives-repeated-visibility-cycles",after?.ok===true&&after?.bones?.length===rig.bones.length,{before:rig.bones.length,after:after?.bones?.length||0});
 }catch(error){report.error=String(error?.stack||error);check("runtime-acceptance-exception",false,{error:report.error})}
 for(const required of ["glb-intent-map-api-available","glb-intent-test-fixture-loaded","glb-intent-fixture-animation-present","glb-intent-map-set-readback","glb-semantic-intent-plays-mapped-glb-clip","glb-intent-map-stop","glb-intent-test-fixture-restored","glb-intent-map-restored"]){if(!report.checks.some(item=>item.name===required))check(required,false,{error:"Required GLB intent mapping check did not execute"});}
 report.finishedAt=new Date().toISOString();
 report.passed=report.checks.length>0&&report.checks.every(item=>item.passed);
 const output=process.env.SAEED_CI_ACCEPTANCE_REPORT||path.join(process.cwd(),"dist","ci-product-acceptance.json");
 try{fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n","utf8")}catch(error){report.passed=false;report.error=String(error?.stack||error);console.error("Could not write packaged acceptance report:",report.error)}
 console.log("PACKAGED_RUNTIME_ACCEPTANCE="+(report.passed?"PASS":"FAIL"));
 console.log(JSON.stringify(report,null,2));
 setTimeout(async()=>{try{await session.defaultSession.flushStorageData()}catch(error){console.error("CI storage flush failed:",error?.message||String(error))}app.exit(report.passed?0:1)},150);
}

module.exports = { runCiProductAcceptance };
