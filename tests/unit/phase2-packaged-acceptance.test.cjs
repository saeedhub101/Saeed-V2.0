"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..","..");
const runtime=fs.readFileSync(path.join(root,"src/main/runtime.js"),"utf8");
const client=fs.readFileSync(path.join(root,"src/character/client.js"),"utf8");
const workflow=fs.readFileSync(path.join(root,".github/workflows/build-windows-electron.yml"),"utf8");

test("packaged acceptance launches after startup and exits from a machine-readable result",()=>{
 assert.match(runtime,/process\.argv\.includes\("--ci-acceptance"\)\)\{void runCiProductAcceptance\(\);return\}/);
 assert.match(runtime,/PACKAGED_RUNTIME_ACCEPTANCE=/);
 assert.match(runtime,/SAEED_CI_ACCEPTANCE_REPORT/);
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
 assert.match(behavior,/if\(!this\.running\|\|!this\.visible\|\|!this\.windowFocused\|\|this\.sleeping\|\|this\.userBusy\)return/);
 assert.match(behavior,/if\(!focused\)\{this\.clearTimer\(\);this\.clearSleepTimer\(\);this\.clearCycleTimers\(\)/);
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
 assert.match(behavior,/if\(this\.paused\)\{this\.clearTimer\(\);this\.clearSleepTimer\(\);this\.clearBlinkTimer\(\);this\.clearCycleTimers\(\)/);
 assert.match(controller,/this\.autonomous\?\.setPaused\?\.\(!enabled\|\|this\.animationPaused\)/);
 assert.match(controller,/this\.autonomous\?\.setPaused\?\.\(paused\|\|!this\.animationEnabled\)/);
 assert.match(behavior,/if\(this\.paused\)\{\s*if\(\["speech-end","assistant-speech-end","speech-cancelled","mute","muted","audio-muted","voice-muted","chat-end","assistant-cancelled","request-cancelled"\]/);
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
 for(const token of ["bundled-glb-loaded","humanoid-rig-mapped","three-renderer-active","semantic-motion-playback","rest-pose-real-bone-edit-applied","rest-pose-persistent-readback","rest-pose-reapplied-after-character-runtime-reload","packaged-whisper-runtime-present","packaged-whisper-transcription-runs","mute-is-output-only","unmute-restores-tts","unmute-while-hidden-keeps-tts-released","show-after-hidden-unmute-restores-tts","character-survives-repeated-visibility-cycles"])assert.ok(runtime.includes(token),"missing packaged acceptance check: "+token);
});

test("packaged acceptance exercises real motion edits, invalid-GLB preservation, and fresh-process rest-pose persistence",()=>{
 for(const token of ["invalid-glb-rejected-preserves-current-character","generated-motion-created","generated-motion-changes-real-bone","generated-motion-changes-all-mapped-bones","rest-pose-change-is-persisted","rest-pose-change-rebinds-existing-motion","edited-motion-changes-real-bone-differently","edited-motion-changes-all-mapped-bones-differently","generated-motion-cleaned-up","rest-pose-original-transform-restored","runCiRestPoseRestart","restart-real-bone-rotation-written","restart-real-bone-position-written","restart-rotation-survives-fresh-process","restart-position-survives-fresh-process","--ci-rest-pose-save","--ci-rest-pose-verify"])assert.ok(runtime.includes(token),"missing real-runtime acceptance contract: "+token);
 assert.match(workflow,/Verify rest pose survives a full application restart/);
 assert.match(workflow,/dist\/ci-rest-pose-save\.json/);
 assert.match(workflow,/dist\/ci-rest-pose-verify\.json/);
});

test("packaged acceptance verifies the transcript label toggle and actual recognized-text rendering",()=>{
 for(const token of ["microphone-transcript-label-toggle-and-render","microphone-transcript-label-setting-restored","saeedTranscriptLabel","CI recognized speech"])assert.ok(runtime.includes(token),"missing transcript-label runtime acceptance: "+token);
});

test("packaged acceptance opens Learning and Add-ons and verifies renderer IPC round trips",()=>{
 for(const token of ["verifyFeaturePage","window-and-ipc","learningAcceptanceWindow","addonsAcceptanceWindow","window.saeed.learning.list()","window.saeed.addons.catalog()"])assert.ok(runtime.includes(token),"missing feature-window acceptance wiring: "+token);
});
