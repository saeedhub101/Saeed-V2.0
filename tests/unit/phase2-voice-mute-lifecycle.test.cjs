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
});

test("mute changes output state without forcing microphone mode off", () => {
  assert.match(body, /voiceBroadcast\("voice:mute",voiceMuted\)/);
  assert.doesNotMatch(body, /setMicMode\("off"\)/);
  assert.doesNotMatch(body, /currentMicMode\s*=\s*"off"/);
});

test("unmuting while Character is hidden keeps TTS released until it is shown",()=>{
 const composition=fs.readFileSync(path.join(__dirname,"../../src/main/application/runtime-composition.js"),"utf8");
 const start=composition.indexOf("const setVoiceMuted=muted=>");
 const end=composition.indexOf(";\n const ensureScreenCapture",start);
 const body=composition.slice(start,end);
 assert.ok(start>=0&&end>start);
 assert.match(body,/target\.isVisible\(\)/);
 assert.match(body,/host\.releaseTts\("character hidden"\)/);
});
