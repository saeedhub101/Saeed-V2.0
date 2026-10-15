"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createModuleLoader } = require("../../src/main/application/module-loader");

test("shared module loader returns one authoritative instance for repeated loads", () => {
  const loader = createModuleLoader();
  let calls = 0;
  const first = loader.load("feature:chat", () => ({ id: ++calls }));
  const second = loader.load("feature:chat", () => ({ id: ++calls }));
  assert.equal(first, second);
  assert.equal(calls, 1);
  assert.equal(loader.has("feature:chat"), true);
  assert.equal(loader.get("feature:chat"), first);
  assert.equal(loader.snapshot().filter(item => item.name === "feature:chat").length, 1);
});

test("failed module load remains diagnosable and a later load can recover", () => {
  const events = [];
  const loader = createModuleLoader({ onEvent: event => events.push(event) });
  assert.throws(() => loader.load("feature:broken", () => { throw new Error("expected failure"); }), /expected failure/);
  assert.equal(loader.snapshot()[0].state, "failed");
  const recovered = loader.load("feature:broken", () => ({ ready: true }));
  assert.deepEqual(recovered, { ready: true });
  assert.equal(loader.snapshot()[0].state, "loaded");
  assert.ok(events.some(event => event.type === "load-failure"));
  assert.ok(events.some(event => event.type === "load-success"));
});

test("recursive loading of the same named module fails clearly instead of recursing", () => {
  const loader = createModuleLoader();
  assert.throws(
    () => loader.load("feature:cycle", () => loader.load("feature:cycle", () => ({}))),
    /Circular module load detected: feature:cycle/
  );
  assert.equal(loader.snapshot()[0].state, "failed");
});
