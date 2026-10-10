"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "../..");
const sourceRoots = ["src", "scripts", "tests", "learning"];
const excludedDirs = new Set(["node_modules", ".git", "dist", "artifacts", "ci-reports"]);
function collect(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (error) { out.push({ file: path.relative(root, dir), error: error.message }); return out; }
  for (const entry of entries) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!excludedDirs.has(entry.name)) collect(file, out);
      continue;
    }
    if (entry.isFile() && /\.(?:js|mjs|cjs)$/i.test(entry.name)) out.push({ file });
  }
  return out;
}

test("all project JavaScript source files parse successfully", () => {
  const files = sourceRoots.flatMap(name => collect(path.join(root, name)));
  const failures = [];
  for (const item of files) {
    if (item.error) { failures.push(item); continue; }
    const absolute = path.join(root, item.file);
    const source = fs.readFileSync(absolute, "utf8");
    const isCommonJs = absolute.endsWith(".cjs");
    const args = isCommonJs ? ["--check"] : ["--check", "--input-type=module"];
    const result = spawnSync(process.execPath, args, { input: source, encoding: "utf8", windowsHide: true });
    if (result.status !== 0) failures.push({
      file: item.file,
      status: result.status,
      error: String(result.stderr || result.stdout || result.error || "node --check failed").slice(0, 4000)
    });
  }
  assert.equal(failures.length, 0, JSON.stringify({ filesChecked: files.length, failures }, null, 2));
});
