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

test("Character IPC serializes logical rig names instead of cyclic THREE.Bone objects",()=>{
 const start=client.indexOf('if(x.action==="getRig")');
 const end=client.indexOf("\n",start);
 const body=client.slice(start,end);
 assert.ok(start>=0&&end>start);
 assert.match(body,/getCharacterRigAutoMap\?\.\(\)/);
 assert.doesNotMatch(body,/getBoneMap\?\.\(\)/);
});

test("packaged acceptance covers GLB, rig, rendering, motion, rest pose, voice lifecycle and repeated show/hide",()=>{
 for(const token of ["bundled-glb-loaded","humanoid-rig-mapped","three-renderer-active","semantic-motion-playback","rest-pose-persistent-readback","packaged-whisper-runtime-present","mute-is-output-only","unmute-restores-tts","character-survives-repeated-visibility-cycles"])assert.ok(runtime.includes(token),"missing packaged acceptance check: "+token);
});
