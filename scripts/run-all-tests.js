"use strict";
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const suites = [
  { name: "current acceptance suite", args: [path.join(root, "scripts", "ci-current-acceptance.js")] },
  { name: "foundation contract suite", args: [path.join(root, "scripts", "ci-foundation-contract.js")] },
  { name: "architecture contract suite", args: [path.join(root, "scripts", "ci-architecture-contract.js")] },
  { name: "authoritative GLB and rig suite", args: [path.join(root, "scripts", "ci-authoritative-glb-rig.js")] },
  { name: "character diagnostics suite", args: [path.join(root, "scripts", "ci-character-diagnostics.js")] },
  { name: "animation health suite", args: [path.join(root, "scripts", "ci-animation-health.js")] },
  { name: "GLB byte handling suite", args: [path.join(root, "scripts", "ci-glb-bytes.js")] },
  { name: "GLB candidate validation suite", args: [path.join(root, "scripts", "ci-glb-candidate-validation.js")] },
  { name: "HTML module syntax suite", args: [path.join(root, "scripts", "ci-html-script-syntax.js")] },
  { name: "email protocol suite", args: [path.join(root, "scripts", "ci-email-protocol.js")] },
  { name: "intelligence and security suite", args: [path.join(root, "scripts", "ci-intelligence-security.js")] },
  { name: "rest-pose regression unit tests", args: ["--test", path.join(root, "tests", "unit", "rest-pose-validation.test.mjs")] },
  { name: "emergency-stop regression unit tests", args: ["--test", path.join(root, "tests", "unit", "emergency-stop.test.cjs")] },
  { name: "microphone lifecycle race unit tests", args: ["--test", path.join(root, "tests", "unit", "mic-mode-race.test.cjs")] },
  { name: "computer keypress security tests", args: ["--test", path.join(root, "tests", "unit", "computer-keypress-security.test.cjs")] },
  { name: "local media permission security tests", args: ["--test", path.join(root, "tests", "unit", "media-permissions.test.cjs")] },
  { name: "project JavaScript syntax suite", args: ["--test", path.join(root, "tests", "unit", "source-syntax.test.cjs")] },
  { name: "tool argument schema regression tests", args: ["--test", path.join(root, "tests", "unit", "tool-schema-validation.test.cjs")] },
  { name: "microphone RMS settings wiring tests", args: ["--test", path.join(root, "tests", "unit", "microphone-rms-wiring.test.cjs")] },
  { name: "conversation archive validation tests", args: ["--test", path.join(root, "tests", "unit", "conversation-archive.test.cjs")] },
  { name: "atomic JSON persistence tests", args: ["--test", path.join(root, "tests", "unit", "atomic-json-store.test.cjs")] }
,  { name: "persistent memory normalization tests", args: ["--test", path.join(root, "tests", "unit", "memory-stack.test.cjs")] }
,  { name: "Phase 2 character runtime regression tests", args: ["--test", path.join(root, "tests", "unit", "phase2-character-runtime.test.cjs")] }
,  { name: "Phase 3 shared conversation persistence tests", args: ["--test", path.join(root, "tests", "unit", "phase3-conversation-persistence.test.cjs")] }
,  { name: "Phase 3 explicit memory capture tests", args: ["--test", path.join(root, "tests", "unit", "phase3-memory-capture.test.cjs")] }
,  { name: "Phase 2 voice mute lifecycle tests", args: ["--test", path.join(root, "tests", "unit", "phase2-voice-mute-lifecycle.test.cjs")] }
,  { name: "Add-on capability registry persistence tests", args: ["--test", path.join(root, "tests", "unit", "addon-capabilities-registry.test.cjs")] }
,  { name: "Phase 3 tool-result learning integrity tests", args: ["--test", path.join(root, "tests", "unit", "phase3-tool-result-learning.test.cjs")] }
,  { name: "Phase 2 autonomous energy behavior tests", args: ["--test", path.join(root, "tests", "unit", "phase2-autonomous-energy.test.cjs")] }
,  { name: "Phase 3 persistent memory integrity tests", args: ["--test", path.join(root, "tests", "unit", "phase3-memory-persistence.test.cjs")] }
,  { name: "Phase 3 learned-skill integrity tests", args: ["--test", path.join(root, "tests", "unit", "phase3-learning-integrity.test.cjs")] }
,  { name: "Phase 2 character profile persistence tests", args: ["--test", path.join(root, "tests", "unit", "phase2-character-profile-store.test.cjs")] }
,  { name: "Phase 3 web security and cancellation tests", args: ["--test", path.join(root, "tests", "unit", "phase3-web-security.test.cjs")] },
  { name: "Phase 3 permission-prompt cancellation tests", args: ["--test", path.join(root, "tests", "unit", "phase3-permission-cancellation.test.cjs")] },
  { name: "Phase 2 packaged-acceptance and IPC contract tests", args: ["--test", path.join(root, "tests", "unit", "phase2-packaged-acceptance.test.cjs")] },
  { name: "Phase 3 email secret-redaction tests", args: ["--test", path.join(root, "tests", "unit", "phase3-email-security.test.cjs")] },
  { name: "Atomic settings persistence tests", args: ["--test", path.join(root, "tests", "unit", "settings-store-persistence.test.cjs")] }
];
const results = [];

for (const suite of suites) {
  console.log("");
  console.log("=== RUN: " + suite.name + " ===");
  const result = spawnSync(process.execPath, suite.args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
    windowsHide: true
  });
  const code = result.error ? 1 : (Number.isInteger(result.status) ? result.status : 1);
  results.push({ name: suite.name, code, error: result.error?.message || null });
  console.log("=== " + (code === 0 ? "PASS" : "FAIL") + ": " + suite.name + " (exit " + code + ") ===");
}

const failed = results.filter(result => result.code !== 0);
console.log("");
console.log("=== SUITE SUMMARY ===");
for (const result of results) console.log((result.code === 0 ? "PASS " : "FAIL ") + result.name + (result.error ? " — " + result.error : ""));
if (failed.length) {
  console.error(failed.length + " suite(s) failed; all configured suites were executed.");
  process.exitCode = 1;
} else {
  console.log("All configured suites passed.");
}
