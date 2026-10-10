"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("Performance exposes the full supported RMS range for both speech and interruption", () => {
  const html = read("src/performance.html");
  assert.match(html, /id="micSpeechRms"[^>]*min="0\.005"[^>]*max="0\.5"/);
  assert.match(html, /id="micInterruptRms"[^>]*min="0\.005"[^>]*max="0\.5"/);
});

test("Performance clamps and persists both RMS values without dropping either setting", () => {
  const source = read("src/performance.js");
  assert.match(source, /micSpeechRms:Math\.max\(0\.005,Math\.min\(0\.5,Number\(\$\("micSpeechRms"\)\.value\)\|\|0\.02\)\)/);
  assert.match(source, /micInterruptRms:Math\.max\(0\.005,Math\.min\(0\.5,Number\(\$\("micInterruptRms"\)\.value\)\|\|0\.09\)\)/);
  assert.match(source, /window\.saeed\.system\.setSettings\(\{\.\.\.settings,\.\.\.p\}\)/);
});

test("the live microphone runtime consumes saved RMS settings and uses them for gating", () => {
  const source = read("src/renderer/voice/voice-client.js");
  assert.match(source, /Number\(cfg\?\.micSpeechRms\)/);
  assert.match(source, /Number\(cfg\?\.micInterruptRms\)/);
  assert.match(source, /rms>=micSpeechRms/);
  assert.match(source, /rms>=micInterruptRms/);
  assert.match(source, /setInterval\(refreshRmsSettings,1000\)/);
});
