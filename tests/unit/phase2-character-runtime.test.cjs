"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../../src/character/CharacterController.js"), "utf8");
const playStart = source.indexOf(" play(id,options={}){");
const playEnd = source.indexOf("\n stop(id)", playStart);
const playBody = source.slice(playStart, playEnd);
const semanticStart = source.indexOf(" semantic(intent,options={}){");
const semanticEnd = source.indexOf("\n}\nwindow.saeedCharacterRuntime", semanticStart);
const semanticBody = source.slice(semanticStart, semanticEnd);

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
