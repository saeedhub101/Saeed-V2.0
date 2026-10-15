"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../../src/main/voice/voice-host.js"), "utf8");
const start = source.indexOf("function setVoiceMuted(muted)");
const end = source.indexOf("\n async function setMicMode", start);
const body = source.slice(start, end);

test("unmuting restores the TTS ready/idle lifecycle", () => {
  assert.ok(start >= 0 && end > start, "setVoiceMuted must exist");
  assert.match(body, /if\(voiceMuted\)\{releaseTts\("mute"\)\}else\{ensureTts\(\)\}/);
  assert.match(source, /function characterVisible\(\).*?isVisible\(\)/s);
  assert.match(source, /if\(!characterVisible\(\)\)\{releaseTts\("character hidden"\);return false\}/);
});

test("mute changes output state without forcing microphone mode off", () => {
  assert.match(body, /voiceBroadcast\("voice:mute",voiceMuted\)/);
  assert.doesNotMatch(body, /setMicMode\("off"\)/);
  assert.doesNotMatch(body, /currentMicMode\s*=\s*"off"/);
});

test("unmuting while Character is hidden keeps TTS released until it is shown",()=>{
 const composition=fs.readFileSync(path.join(__dirname,"../../src/main/application/runtime-composition.js"),"utf8");
 const start=composition.indexOf("const setVoiceMuted=muted=>");
 const body=composition.slice(start,start+650);
 assert.ok(start>=0);
 assert.match(body,/target\.isVisible\(\)/);
 assert.match(body,/host\.releaseTts\("character hidden"\)/);
});

test("muted or released TTS drops realtime audio and invalidates pending API playback",()=>{
 const renderer=fs.readFileSync(path.join(__dirname,"../../src/renderer/voice/voice-client.js"),"utf8");
 assert.match(renderer,/function stopSpeaking\(\)\{outputGeneration\+\+;speechSuppressed=false;stopRealtimePlayback\(\)/);
 assert.match(renderer,/onRealtimeAudio\(async b=>\{if\(voiceMuted\|\|!ttsReady\)return;const generation=outputGeneration/);
 assert.match(renderer,/generation!==outputGeneration\|\|voiceMuted\|\|!ttsReady\)return/);
});

test("renderer respects TTS readiness and stops output when the character audio runtime is released",()=>{
 const renderer=fs.readFileSync(path.join(__dirname,"../../src/renderer/voice/voice-client.js"),"utf8");
 assert.match(renderer,/if\(!text\|\|voiceMuted\|\|!ttsReady\)return;\s*window\.saeedShowMessage/);
 assert.match(renderer,/onVoiceTts\?\.\(state=>\{ttsReady=String\(state\|\|""\)==="ready";if\(!ttsReady\)stopSpeaking\(\)/);
});

test("delayed local TTS and stale utterance callbacks cannot restart or cancel newer speech",()=>{
 const renderer=fs.readFileSync(path.join(__dirname,"../../src/renderer/voice/voice-client.js"),"utf8");
 assert.match(renderer,/pendingSpeechStarts=new Set\(\)/);
 assert.match(renderer,/for\(const timer of pendingSpeechStarts\)clearTimeout\(timer\)/);
 assert.match(renderer,/generation===outputGeneration&&!voiceMuted&&ttsReady\)window\.speechSynthesis\.speak\(u\)/);
 assert.match(renderer,/u\.onend=\(\)=>\{if\(generation!==outputGeneration\)return/);
 assert.match(renderer,/src\.onended=\(\)=>\{mic\.audioSources\.delete\(src\);if\(generation!==outputGeneration\)return/);
});


test("packaged resource probe simulates mic activation without requesting a physical microphone",()=>{
 const preload=fs.readFileSync(path.join(__dirname,"../../src/preload.js"),"utf8");
 const renderer=fs.readFileSync(path.join(__dirname,"../../src/renderer/voice/voice-client.js"),"utf8");
 assert.match(preload,/isCiResourceProbe:\(\)=>process\.env\.SAEED_CI_SMOKE==="1"\|\|process\.argv\.includes\("--ci-ram-cpu"\)/);
 assert.match(renderer,/if\(window\.saeed\.system\.isCiResourceProbe\?\.\(\)\)\{report\("INFO","CI MIC SIMULATION"/);
 assert.ok(renderer.indexOf("CI MIC SIMULATION")<renderer.indexOf('await mic.start("on",false)'));
 assert.match(renderer,/await mic\.start\("on",false\)/);
});
