"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { ToolRegistry } = require("../../src/tools/registry");

test("Emergency Stop invalidates in-flight tool calls and prevents their success from being recorded", async () => {
  let releaseFirst;
  let announceStarted;
  const started = new Promise(resolve => { announceStarted = resolve; });
  const firstResult = new Promise(resolve => { releaseFirst = resolve; });
  let calls = 0;
  const recorded = [];
  const registry = new ToolRegistry({
    userDataPath: process.cwd(),
    permissionPolicy: () => "allow",
    characterController: async () => {
      calls++;
      if (calls === 1) {
        announceStarted();
        return firstResult;
      }
      return { ok: true, motion: "wave" };
    },
    recordHook: name => recorded.push(name)
  });

  const inFlight = registry.call("character_motion", { intent: "wave" });
  await started;
  assert.deepEqual(registry.emergencyStop().stopped, true);
  releaseFirst({ ok: true, motion: "wave" });

  assert.deepEqual(await inFlight, {
    ok: false,
    stale: true,
    error: "Stale conversation request cancelled"
  });
  assert.deepEqual(recorded, []);
  assert.deepEqual(await registry.call("character_motion", { intent: "wave" }), {
    ok: false,
    stale: true,
    error: "Stale conversation request cancelled"
  });

  assert.equal(registry.resumeAfterEmergencyStop().stopped, false);
  assert.deepEqual(await registry.call("character_motion", { intent: "wave" }), {
    ok: true,
    motion: "wave"
  });
  assert.deepEqual(recorded, ["character_motion"]);
});
