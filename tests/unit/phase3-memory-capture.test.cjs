"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../../src/main/conversation/conversation-agent.js"), "utf8");

test("explicit remember requests and supported user preferences are captured only on a current final exchange", () => {
  assert.match(source, /try\{this\.rememberFromUserText\(userText\)\}/);
  assert.match(source, /if\(!userText\|\|result\?\.stale\)return ""/);
  assert.match(source, /remember that/);
  assert.match(source, /please remember/);
  assert.match(source, /تذكر/);
  assert.match(source, /أفضل/);
});

test("memory capture failure does not discard the conversation answer", () => {
  assert.match(source, /stage:"MEMORY CAPTURE"/);
  assert.match(source, /this\.history\.push\(\{role:"user",content:userText\}/);
});
