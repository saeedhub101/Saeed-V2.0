"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..","..");
const runtime=fs.readFileSync(path.join(root,"src/main/runtime.js"),"utf8");
const acceptance=fs.readFileSync(path.join(root,"src/main/ci/product-acceptance.js"),"utf8");
const rigBuilder=fs.readFileSync(path.join(root,"src/main/ci/character-rig-builder.js"),"utf8");
const restPoseRestart=fs.readFileSync(path.join(root,"src/main/ci/rest-pose-restart.js"),"utf8");
const textReactions=fs.readFileSync(path.join(root,"src/character/TextReactions.js"),"utf8");
const reactionClassifier=fs.readFileSync(path.join(root,"src/character/TextReactionClassifier.js"),"utf8");
const engine=fs.readFileSync(path.join(root,"src/character/CharacterEngine.js"),"utf8");
const client=fs.readFileSync(path.join(root,"src/character/client.js"),"utf8");
const workflow=fs.readFileSync(path.join(root,".github/workflows/build-windows-electron.yml"),"utf8");

test("packaged acceptance launches after startup and exits from a machine-readable result",()=>{
 assert.match(runtime,/process\.argv\.includes\("--ci-acceptance"\)/);
 assert.match(runtime,/require\("\.\/ci\/product-acceptance"\)\.runCiProductAcceptance/);
 assert.match(acceptance,/PACKAGED_RUNTIME_ACCEPTANCE=/);
 assert.match(acceptance,/SAEED_CI_ACCEPTANCE_REPORT/);
 assert.match(workflow,/Verify packaged runtime acceptance/);
 assert.match(workflow,/dist\\win-unpacked\\Saeed AI\.exe/);
 assert.match(workflow,/PACKAGED_RUNTIME_ACCEPTANCE=PASS/);
});

test("autonomous character focus lifecycle is wired without inferring inactivity from blur",()=>{
 const controller=fs.readFileSync(path.join(root,"src/character/CharacterController.js"),"utf8");
 const behavior=fs.readFileSync(path.join(root,"src/character/AutonomousBehaviorController.js"),"utf8");
 assert.match(controller,/setWindowFocused:v=>controller\.autonomous\?\.setWindowFocused\?\.\(v\)/);
 assert.match(controller,/window\.addEventListener\("focus",\(\)=>window\.saeedCharacterRuntime\?\.controller\?\.setWindowFocused\?\.\(true\)\)/);
 assert.doesNotMatch(controller,/window\.addEventListener\("blur",/);
 assert.match(behavior,/this\.windowFocused=true/);
 assert.match(behavior,/if\(!this\.running\|\|this\.paused\|\|!this\.visible\|\|!this\.windowFocused\|\|this\.sleeping\|\|this\.userBusy\)return/);
 assert.match(behavior,/if\(!focused\)\{this\.clearTimer\(\);this\.clearSleepTimer\(\);this\.clearBlinkTimer\(\);this\.clearCycleTimers\(\)/);
 assert.match(behavior,/if\(this\.intent==="speaking"\)this\.scheduleSpeakingGesture\(\)/);
 assert.match(behavior,/if\(this\.intent==="thinking"\)this\.scheduleThinkingGesture\(\)/);
 assert.match(behavior,/this\.intent!=="speaking"\|\|this\.settings\.speakingCycle===false\)return/);
 assert.match(behavior,/this\.intent!=="thinking"\|\|this\.settings\.thinkingCycle===false\)return/);
 assert.match(behavior,/const configured=Math\.max\(1000,Number\(this\.settings\.frequencyMs\)\|\|DEFAULT_IDLE_DELAY\)/);
 assert.match(behavior,/const base=Math\.max\(1000,Number\.isFinite\(supplied\)&&supplied>0\?supplied:configured\)/);
});

test("character animation pause stops every autonomous timer and resumes the current behavior",()=>{
 const controller=fs.readFileSync(path.join(root,"src/character/CharacterController.js"),"utf8");
 const behavior=fs.readFileSync(path.join(root,"src/character/AutonomousBehaviorController.js"),"utf8");
 assert.match(behavior,/setPaused\(value\)/);
 assert.match(behavior,/if\(!this\.running\|\|this\.paused\|\|!this\.visible\|\|!this\.windowFocused\|\|this\.sleeping\|\|this\.userBusy\)return/);
 assert.ok(behavior.includes("if(paused){this.clearTimer();this.clearSleepTimer();this.clearBlinkTimer();this.clearCycleTimers();"));
 assert.match(controller,/this\.autonomous\?\.setPaused\?\.\(!enabled\|\|this\.animationPaused\)/);
 assert.match(controller,/this\.autonomous\?\.setPaused\?\.\(paused\|\|!this\.animationEnabled\)/);
 assert.match(behavior,/if\(this\.paused\)\{\s*if\(\["speech-end","assistant-speech-end","speech-cancelled","mute","muted","audio-muted","voice-muted","chat-end","assistant-cancelled","request-cancelled"\]/);
 assert.match(behavior,/return \{running:this\.running,paused:this\.paused,visible:this\.visible/);
 assert.match(behavior,/if\(this\.running&&!this\.paused&&this\.settings\.breathing!==false&&!this\.sleeping&&this\.visible\)/);
 assert.match(behavior,/if\(ok\)\{this\.lastMotionId=String\(motion\);if\(priority<=20\)this\.lastCasualMotionAt=now;\}/);
 assert.ok(textReactions.includes('id:"anger",pattern:')&&reactionClassifier.includes("not angry"));
 assert.ok(textReactions.includes('id:"sadness",pattern:')&&reactionClassifier.includes("not sad"));
 assert.ok(textReactions.includes('id:"curiosity",pattern:')&&reactionClassifier.includes("not curious"));
 assert.match(behavior,/if\(!this\.running\|\|this\.paused\|\|!this\.visible\|\|!this\.windowFocused\|\|this\.userBusy\|\|this\.sleeping\|\|this\.settings\.blinking===false\)return/);
});

test("Character IPC serializes logical rig names instead of cyclic THREE.Bone objects",()=>{
 const start=client.indexOf('if(x.action==="getRig")');
 const end=client.indexOf("\n",start);
 const body=client.slice(start,end);
 assert.ok(start>=0&&end>start);
 assert.match(body,/getCharacterRigAutoMap\?\.\(\)/);
 assert.doesNotMatch(body,/getBoneMap\?\.\(\)/);
});

test("packaged acceptance covers GLB, rig, rendering, motion, rest pose, voice lifecycle and repeated show/hide",()=>{
 for(const token of ["bundled-glb-loaded","humanoid-rig-mapped","three-renderer-active","semantic-motion-playback","glb-intent-map-api-available","glb-intent-test-fixture-loaded","glb-intent-fixture-animation-present","glb-intent-map-set-readback","glb-semantic-intent-plays-mapped-glb-clip","glb-intent-map-stop","glb-intent-test-fixture-restored","glb-intent-map-restored","rest-pose-real-bone-edit-applied","rest-pose-persistent-readback","rest-pose-reapplied-after-character-runtime-reload","packaged-whisper-runtime-present","packaged-whisper-transcription-runs","mute-is-output-only","unmute-restores-tts","unmute-while-hidden-keeps-tts-released","show-after-hidden-unmute-restores-tts","character-survives-repeated-visibility-cycles"])assert.ok(acceptance.includes(token),"missing packaged acceptance check: "+token);
});

test("GLB semantic intent mapping is persisted, dispatched through CharacterController, and tested on the packaged EXE",()=>{
 const controller=fs.readFileSync(path.join(root,"src/character/CharacterController.js"),"utf8");
 const studio=fs.readFileSync(path.join(root,"src/character-studio.html"),"utf8");
 const fixture=fs.readFileSync(path.join(root,"scripts/create-ci-static-humanoid-glb.js"),"utf8");
 for(const token of ["getGlbIntentMap()","setGlbIntentMap(mapping={})","saeed.character.glb-intent-map","this.engine?.playGlbAnimation?.(mappedClip","source:\"glb\""])assert.ok(controller.includes(token),"missing controller mapping behavior: "+token);
 for(const token of ["glbIntentMapGet","glbIntentMapSet","glbClipList","playGlbClip"])assert.ok(client.includes(token),"missing renderer command: "+token);
 for(const token of ["saveGlbIntentMapping","testGlbIntentMapping","clearGlbIntentMapping","read-back verification"])assert.ok(studio.includes(token),"missing functional mapping UI: "+token);
 assert.match(fixture,/CI-GLB-Intent-Wave/);
 assert.match(fixture,/animations:\[\{name:/);
 for(const token of ["SAEED_CI_GLB_INTENT_FIXTURE","glb-semantic-intent-plays-mapped-glb-clip","glb-intent-map-stop","glb-intent-test-fixture-restored"])assert.ok(acceptance.includes(token),"missing real GLB mapping acceptance: "+token);
 assert.match(workflow,/SAEED_CI_GLB_INTENT_FIXTURE/);
});

test("packaged acceptance exercises real motion edits, invalid-GLB preservation, and fresh-process rest-pose persistence",()=>{
 for(const token of ["invalid-glb-rejected-preserves-current-character","generated-motion-created","generated-motion-changes-real-bone","generated-motion-changes-all-mapped-bones","rest-pose-change-is-persisted","rest-pose-change-rebinds-existing-motion","edited-motion-changes-real-bone-differently","edited-motion-changes-all-mapped-bones-differently","generated-motion-cleaned-up","rest-pose-original-transform-restored","runCiRestPoseRestart","--ci-rest-pose-save","--ci-rest-pose-verify"])assert.ok(acceptance.includes(token)||runtime.includes(token),"missing real-runtime acceptance contract: "+token);
 for(const token of ["restart-real-bone-rotation-written","restart-real-bone-position-written","restart-rotation-survives-fresh-process","restart-position-survives-fresh-process"])assert.ok(restPoseRestart.includes(token),"missing fresh-process rest-pose check: "+token);
 assert.match(workflow,/Verify rest pose survives a full application restart/);
 assert.match(workflow,/dist\/ci-rest-pose-save\.json/);
 assert.match(workflow,/dist\/ci-rest-pose-verify\.json/);
});

test("packaged acceptance verifies the transcript label toggle and actual recognized-text rendering",()=>{
 for(const token of ["microphone-transcript-label-toggle-and-render","microphone-transcript-label-setting-restored","saeedTranscriptLabel","CI recognized speech"])assert.ok(acceptance.includes(token),"missing transcript-label runtime acceptance: "+token);
});

test("packaged acceptance opens Learning and Add-ons and verifies renderer IPC round trips",()=>{
 for(const token of ["verifyFeaturePage","window-and-ipc","learningAcceptanceWindow","addonsAcceptanceWindow","window.saeed.learning.list()","window.saeed.addons.catalog()"])assert.ok(acceptance.includes(token),"missing feature-window acceptance wiring: "+token);
});

test("Character Engine/Rig Builder gate runs immediately after EXE packaging and verifies real deformation plus restart persistence",()=>{
 const build=workflow.indexOf("- name: Build Windows installer and unpacked runtime");
 const gate=workflow.indexOf("- name: character ebgine, rig builder");
 const next=workflow.indexOf("- name: Character, behavior");
 assert.ok(build>=0&&gate>build&&next>gate,"Character Engine/Rig Builder gate must immediately follow EXE packaging");
 assert.equal(workflow.slice(build,next).match(/- name:/g)?.length,2,"No unrelated workflow step may be placed before the rig gate");
 for(const token of ["--ci-character-rig-builder-save","--ci-character-rig-builder-verify","ci-character-rig-builder-save.json","ci-character-rig-builder-verify.json","ci-character-rig-builder-before.png","ci-character-rig-builder-after.png","create-ci-static-humanoid-glb.js","CHARACTER_ENGINE_RIG_BUILDER_RESTART=PASS"])assert.ok(workflow.includes(token),"missing workflow gate contract: "+token);
 for(const token of ["runCiCharacterRigBuilder","actual-saeed-glb-has-loaded-skinned-body","actual-saeed-motion-deforms-real-skinned-vertices","actual-saeed-body-visually-changes-during-motion","viseme-alias-changes-real-shape-key","procedural-rig-restored-after-new-process","saved-rest-pose-survives-full-app-restart","custom-motion-survives-full-app-restart","joint-deformation-","leftForeArm","leftUpperArm","leftThigh","leftShin","skin-weight-quality-within-tolerance","joint-pose-visual-diagnostic-captured","getDeformationSnapshot"])assert.ok(runtime.includes(token)||rigBuilder.includes(token)||restPoseRestart.includes(token)||engine.includes(token),"missing runtime deformation/persistence check: "+token);
 assert.ok(engine.includes("function getDeformationSnapshot("),"renderer must expose sampled skinned-vertex data, not only a visible-window assertion");
 assert.ok(client.includes('action==="buildProceduralRig"'),"rig builder must bypass pre-existing-skeleton readiness gates");
});
