"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const memory = require("../../src/addons/memory-stack");

test("fact keys normalize repeated whitespace and update the same logical fact", t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "saeed-memory-fact-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const first = memory.addFact(dir, "User   prefers   concise answers");
  const second = memory.addFact(dir, "user prefers concise answers");
  assert.equal(first.key, second.key);
  assert.equal(memory.listFacts(dir).length, 1);
  assert.equal(memory.listFacts(dir)[0].text, "user prefers concise answers");
});

test("legacy fact migration normalizes whitespace in keys", t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "saeed-memory-migrate-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const legacy = path.join(dir, "legacy.json");
  fs.writeFileSync(legacy, JSON.stringify({ facts: [
    { key: "  User   Prefers   concise answers ", text: " User prefers concise answers " }
  ] }), "utf8");
  const migrated = memory.migrateLegacyFacts(dir, legacy);
  assert.equal(migrated.length, 1);
  assert.equal(migrated[0].key, "user prefers concise answers");
  assert.equal(memory.listFacts(dir)[0].key, "user prefers concise answers");
});
