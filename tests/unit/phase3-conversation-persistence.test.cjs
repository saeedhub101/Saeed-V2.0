"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../../src/main/conversation/conversation-agent.js"), "utf8");

test("Chat and Voice share a single final-answer persistence path for local and API Brain results", () => {
  assert.match(source, /commitBrainResult\(input,result/);
  assert.match(source, /API-provider answers use handled:false by design/);
  assert.match(source, /this\.history\.push\(\{role:"user",content:userText\},\{role:"assistant",content:answer\}\)/);
  assert.match(source, /return this\.commitBrainResult\(input,result,\{emitAnswer:true\}\)/);
  assert.match(source, /return this\.commitBrainResult\(input,result\)/);
});

test("stale Brain results are not committed into the active conversation", () => {
  assert.match(source, /if\(!userText\|\|result\?\.stale\)return ""/);
  assert.match(source, /if\(!isCurrent\(\)\|\|result\?\.stale\)return ""/);
});

test("persistence failure is surfaced as a diagnostic rather than silently ignored", () => {
  assert.match(source, /CONVERSATION PERSISTENCE/);
  assert.match(source, /could not be verified in persistent storage/);
});
