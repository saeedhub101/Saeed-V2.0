"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../../src/character/CharacterController.js"), "utf8");
const engineSource = fs.readFileSync(path.join(__dirname, "../../src/character/CharacterEngine.js"), "utf8");
const hostSource = fs.readFileSync(path.join(__dirname, "../../src/main/character/character-host.js"), "utf8");
const performanceSource = fs.readFileSync(path.join(__dirname, "../../src/performance.js"), "utf8");
const characterClientSource = fs.readFileSync(path.join(__dirname, "../../src/character/client.js"), "utf8");
const playStart = source.indexOf(" play(id,options={}){");
const playEnd = source.indexOf("\n stop(id)", playStart);
const playBody = source.slice(playStart, playEnd);
const semanticStart = source.indexOf(" semantic(intent,options={}){");
const semanticEnd = source.indexOf("\n}\nwindow.saeedCharacterRuntime", semanticStart);
const semanticBody = source.slice(semanticStart, semanticEnd);

test("motion deltas are transformed from character/model space through the live parent world rotation and current rest quaternion",()=>{
 const retargeter=fs.readFileSync(path.join(__dirname,"../../src/character/CharacterRetargeter.js"),"utf8");
 assert.match(retargeter,/parentWorld\.clone\(\)\.invert\(\)\.multiply\(modelDelta\)\.multiply\(parentWorld\)/);
 assert.match(retargeter,/bone\.quaternion\.copy\(localDelta\)\.multiply\(rest\.quaternion\)/);
 assert.doesNotMatch(retargeter,/canonicalToLocal\|\|new THREE\.Quaternion\(\),qLocal/);
});

test("playing an explicit or autonomous gesture does not terminate the autonomous scheduler", () => {
  assert.ok(playStart >= 0 && playEnd > playStart, "CharacterController.play method must exist");
  assert.doesNotMatch(playBody, /this\.autonomous\?\.stop\?\.\(\)/);
  assert.match(playBody, /autonomous scheduler alive during explicit motion/);
});

test("semantic motion requests suppress recent repeats and report retry time", () => {
  assert.match(source, /this\.semanticMotionHistory=\[\]/);
  assert.match(semanticBody, /recent-motion-cooldown/);
  assert.match(semanticBody, /retryAfterMs/);
  assert.match(semanticBody, /this\.semanticMotionHistory=this\.semanticMotionHistory\.slice\(-8\)/);
});

test("unknown semantic intents do not silently select an idle animation", () => {
  assert.match(semanticBody, /reason:"unknown-intent"/);
});

test("rest-pose save reports persistence failure explicitly instead of throwing away diagnostics", () => {
  const start = source.indexOf(" saveRestPose(){");
  const end = source.indexOf("\n normalizeRestPose()", start);
  const body = source.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(body, /persistenceError/);
  assert.match(body, /catch\(error\)\{persistenceError=error\?\.message\|\|String\(error\)\}/);
  assert.match(body, /persisted=verify\(this\.profiles\.load\(this\.characterId\)\|\|\{\}\)/);
});

test("destroying the Character Engine disposes the previous model before clearing scene ownership", () => {
  const start = engineSource.indexOf("function destroyEngine()");
  const end = engineSource.indexOf("\nwindow.saeedCharacterRuntime", start);
  const body = engineSource.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(body, /const previous=model;model=null/);
  assert.match(body, /dispose\(previous\)/);
  assert.match(body, /renderer\.forceContextLoss\?\.\(\)/);
  assert.ok(body.indexOf("dispose(previous)") < body.indexOf("root.clear()"));
});

test("failed character persistence restores the previous or last persisted GLB",()=>{
 assert.match(hostSource,/function restorePreviousCharacter\(previousPending,target=getCharacterWindow\(\)\)/);
 assert.match(hostSource,/previousPending\?\.data\|\|readPersistedCharacter\(\)\?\.data/);
 assert.match(hostSource,/restorePreviousCharacter\(previousPending,target\)/);
 assert.match(hostSource,/previous saved asset was restored/);
});

test("character status rebinds an already-mapped rig when profile state is not initialized after restart",()=>{
 const start=source.indexOf(" status(){");
 const end=source.indexOf("\n update(dt)",start);
 const body=source.slice(start,end);
 assert.ok(start>=0&&end>start);
 assert.match(body,/a\.loaded&&\(!this\.characterId\|\|!Object\.keys\(mapped\)\.length\)/);
 assert.match(body,/this\.onCharacterLoaded\?\.\(\)/);
});
test("custom motion profiles are not restored until the incoming rig is successfully bound",()=>{
 const bindStart=source.indexOf(" bindCurrentCharacter(){");
 const bindEnd=source.indexOf("\n autoMap()",bindStart);
 const body=source.slice(bindStart,bindEnd);
 assert.ok(bindStart>=0&&bindEnd>bindStart);
 assert.ok(body.indexOf("if(!bound||!valid)")<body.indexOf("this.editor.restore(profile.customMotions||[])"));
});

test("rig diagnostics can enumerate skeleton bones before automatic or manual mapping",()=>{
 assert.match(hostSource,/const skeletonOnlyActions=new Set\(\["(?:buildProceduralRig",)?"getRig","boneNames"/);
 const gate=hostSource.slice(hostSource.indexOf("const skeletonOnlyActions="),hostSource.indexOf("const requestId="));
 assert.match(gate,/getRig/);
 assert.match(gate,/const requiresRig=!skeletonOnlyActions\.has\(actionName\)/);
 assert.match(hostSource,/allowNoBones:actionName==="buildProceduralRig"/);
});

test("rig editor API exposes bone names instead of renderer object references",()=>{
 assert.match(source,/getRig:\(\)=>\(\{bones:engine\.getAvailableBoneNames\?\.\(\)\|\|\[\],mapping:Object\.fromEntries\(Object\.entries\(engine\.getBoneMap\?\.\(\)\|\|\{\}\)\.map\(\(\[slot,bone\]\)=>\[slot,bone\?\.name\|\|bone\]\)\)/);
});

test("direct bone editor refreshes its handlers for the currently selected character",()=>{
 assert.match(performanceSource,/rigTabCurrentBoneNames=names/);
 assert.match(performanceSource,/rigTabCurrentActualBones=s\?\.actualBones\|\|\{\}/);
 assert.match(performanceSource,/fillBoneEditor\(rigTabCurrentActualBones\)/);
 assert.match(performanceSource,/updateBoneOptions\(rigTabCurrentBoneNames,esc\)/);
});

test("direct bone editor rest-pose capture persists the authoritative pose",()=>{
 assert.match(characterClientSource,/if\(x\.action==="pose"\)\{if\(captureRestPose\)\{const rest=c\.saveRestPose\?\.\(\)/);
 assert.match(characterClientSource,/persisted:Boolean\(rest\?\.persisted\),restPose:rest\|\|null/);
});

test("direct bone transforms report failure when no actual GLB bone accepted the edit",()=>{
 const start=source.indexOf(" setPose(pose={}){");
 const end=source.indexOf("\n  ",start+20);
 const body=source.slice(start,start+1000);
 assert.ok(start>=0);
 assert.match(body,/const applied=\{\}/);
 assert.match(body,/if\(ok\)applied\[name\]=transform/);
 assert.match(body,/return Object\.keys\(applied\)\.length\?applied:false/);
});

test("rest-pose capture is not blocked when animation playback is disabled",()=>{
 const start=source.indexOf(" setPose(pose={}){");
 const body=source.slice(start,start+1000);
 assert.ok(start>=0);
 assert.ok(body.indexOf("if(pose?.__captureRest)")<body.indexOf("if(!this.animationEnabled||this.animationPaused)"));
});
test("motion editor reports failed deletion instead of claiming success",()=>{
 assert.match(performanceSource,/if\(!result\?\.ok\)throw new Error\(result\?\.error\|\|"The selected motion was not removed\."\)/);
 assert.match(performanceSource,/Motion deletion failed:/);
});

test("rig editor prefers the active controller binding over a stale auto-map",()=>{
 assert.match(characterClientSource,/const boundMapping=c\.api\?\.getRig\?\.\(\)\?\.mapping\|\|\{\}/);
 assert.match(characterClientSource,/Object\.keys\(boundMapping\)\.length\?boundMapping/);
 assert.match(characterClientSource,/status\.autoRig\|\|\{\}/);
});


test("direct bone authoring remains available when animation playback is disabled",()=>{
 const start=source.indexOf(" setPose(pose={}){");
 const body=source.slice(start,start+800);
 assert.ok(start>=0);
 assert.ok(body.indexOf("const bones=pose?.__bones")<body.indexOf("if(!this.animationEnabled||this.animationPaused)"));
 assert.match(body,/return Object\.keys\(applied\)\.length\?applied:false/);
});
