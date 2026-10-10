"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { createVoiceHost } = require("../../src/main/voice/voice-host");

test("a delayed microphone-enable request cannot override a later OFF request", async () => {
  let resolvePolicy;
  let announcePolicy;
  const policyStarted = new Promise(resolve => { announcePolicy = resolve; });
  let brainStarts = 0;
  const host = createVoiceHost({
    app: { getPath: () => process.cwd() },
    path,
    fs,
    spawn: () => { throw new Error("Whisper process must not start in this test"); },
    diagnostic: () => {},
    diagnosticState: { mic: { level: 0 } },
    voiceBroadcast: () => {},
    getAgent: () => null,
    getAddonService: () => ({}),
    ensureBrain: async () => { brainStarts++; },
    releaseBrainIfIdle: async () => true,
    permissionPolicy: () => new Promise(resolve => {
      resolvePolicy = resolve;
      announcePolicy();
    }),
    confirmPermission: async () => true,
    getStatusWindow: () => null
  });

  const enableRequest = host.setMicMode("on");
  await policyStarted;
  assert.equal(await host.setMicMode("off"), true);
  resolvePolicy("allow");

  assert.equal(await enableRequest, false);
  assert.equal(host.getCurrentMicMode(), "off");
  assert.equal(brainStarts, 0);
});
