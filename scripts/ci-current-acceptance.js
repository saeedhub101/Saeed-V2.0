"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const failures = [];
const checks = [];
const reportPath = path.join(root, "ci-reports", "current-acceptance.json");
const check = (name, pass, details = {}) => {
  checks.push({ name, pass: Boolean(pass), details });
  if (!pass) failures.push({ name, details });
};
const read = p => fs.readFileSync(path.join(root, p), "utf8");
const exists = p => fs.existsSync(path.join(root, p));

function inspectGlb(file) {
  const b = fs.readFileSync(file);
  if (b.length < 20) throw new Error("GLB header/chunk is truncated");
  if (b.toString("ascii", 0, 4) !== "glTF") throw new Error("Invalid GLB magic");
  const version = b.readUInt32LE(4);
  const declaredLength = b.readUInt32LE(8);
  if (version !== 2) throw new Error("Expected GLB version 2; found " + version);
  if (declaredLength !== b.length) throw new Error("Declared GLB length does not match actual file length");
  let offset = 12, json = null, chunkCount = 0;
  while (offset + 8 <= b.length) {
    const length = b.readUInt32LE(offset);
    const type = b.readUInt32LE(offset + 4);
    const start = offset + 8, end = start + length;
    if (end > b.length) throw new Error("GLB chunk exceeds file bounds");
    if (type === 0x4E4F534A) {
      if (json) throw new Error("Multiple JSON chunks found");
      json = JSON.parse(b.toString("utf8", start, end).replace(/[\u0000 ]+$/g, "").trim());
    }
    offset = end;
    chunkCount++;
  }
  if (offset !== b.length || !json) throw new Error("Invalid GLB chunk layout or missing JSON chunk");
  const nodes = Array.isArray(json.nodes) ? json.nodes : [];
  const scenes = Array.isArray(json.scenes) ? json.scenes : [];
  const sceneIndex = Number.isInteger(json.scene) ? json.scene : 0;
  const scene = scenes[sceneIndex];
  if (!scene || !Array.isArray(scene.nodes)) throw new Error("Default scene has no valid root-node list");
  const visited = new Set(), stack = [...scene.nodes], meshNodes = [];
  while (stack.length) {
    const index = stack.pop();
    if (!Number.isInteger(index) || index < 0 || index >= nodes.length) throw new Error("Scene references an invalid node index: " + index);
    if (visited.has(index)) continue;
    visited.add(index);
    const node = nodes[index];
    if (Number.isInteger(node.mesh)) {
      const mesh = json.meshes?.[node.mesh];
      if (!mesh || !Array.isArray(mesh.primitives) || mesh.primitives.length === 0) throw new Error("Scene node references a mesh without primitives");
      if (mesh.primitives.some(p => p.attributes && Number.isInteger(p.attributes.POSITION))) meshNodes.push({ node: index, mesh: node.mesh, name: node.name || "" });
    }
    if (Array.isArray(node.children)) stack.push(...node.children);
  }
  if (meshNodes.length === 0) throw new Error("The active scene contains no renderable mesh nodes");
  const skins = Array.isArray(json.skins) ? json.skins : [];
  let jointCount = 0;
  for (const skin of skins) {
    const joints = Array.isArray(skin.joints) ? skin.joints : [];
    jointCount += joints.length;
    for (const joint of joints) if (!Number.isInteger(joint) || joint < 0 || joint >= nodes.length) throw new Error("Skin contains invalid joint node index: " + joint);
  }
  const animations = Array.isArray(json.animations) ? json.animations : [];
  for (const animation of animations) {
    for (const channel of animation.channels || []) {
      const node = channel?.target?.node;
      if (node !== undefined && (!Number.isInteger(node) || node < 0 || node >= nodes.length)) throw new Error("Animation channel references invalid node index: " + node);
    }
  }
  return {
    bytes: b.length, version, chunkCount, nodeCount: nodes.length,
    activeSceneNodeCount: visited.size, renderableMeshNodeCount: meshNodes.length,
    renderableMeshes: meshNodes.slice(0, 30), skinCount: skins.length, jointCount,
    animationCount: animations.length,
    rigCapability: jointCount > 0 ? "skinned-or-partial-rig" : "mesh-only-supported"
  };
}

function main() {
  check("package-and-version-identity", (() => {
    const pkg = JSON.parse(read("package.json"));
    const version = read("VERSION").replace(/[\uFEFF\u200B\r\n ]/g, "");
    return /^\d+\.\d+$/.test(version) && pkg.version === version + ".0" && pkg.main === "src/main.js";
  })(), { package: exists("package.json"), versionFile: exists("VERSION") });

  const required = [
    "assets/Saeed_AI-3D.glb", "src/main.js", "src/preload.js",
    "src/main/runtime.js", "src/main/ci-e2e.js",
    "src/character/CharacterEngine.js", "src/character/CharacterController.js",
    "src/character/AutoRigMapper.js", "src/three/GLTFLoader.js",
    "scripts/ci-run-packaged-e2e.ps1", ".github/workflows/build-windows-electron.yml"
  ];
  const missing = required.filter(p => !exists(p));
  check("current-runtime-files-present", missing.length === 0, { requiredCount: required.length, missing });

  let glb = null, glbError = null;
  try { glb = inspectGlb(path.join(root, "assets", "Saeed_AI-3D.glb")); }
  catch (e) { glbError = String(e?.stack || e); }
  check("authoritative-glb-binary-and-active-scene", Boolean(glb), glb || { error: glbError });

  if (glb) {
    check("rig-is-capability-based-not-mandatory", glb.rigCapability === "mesh-only-supported" || glb.jointCount > 0,
      { rigCapability: glb.rigCapability, jointCount: glb.jointCount, note: "A visible mesh is mandatory; a skeleton is optional; any provided joint indices must be valid." });
  }

  const syntaxFiles = ["src/main.js", "src/preload.js", "src/main/runtime.js", "src/main/ci-e2e.js", "src/main/character/character-host.js", "scripts/ci-current-acceptance.js"];
  const syntaxResults = syntaxFiles.map(file => {
    const result = spawnSync(process.execPath, ["--check", path.join(root, file)], { encoding: "utf8" });
    return { file, pass: result.status === 0, error: result.status === 0 ? "" : String(result.stderr || result.stdout || result.error || "node --check failed") };
  });
  check("runtime-javascript-syntax", syntaxResults.every(x => x.pass), { files: syntaxResults });

  const e2e = exists("src/main/ci-e2e.js") ? read("src/main/ci-e2e.js") : "";
  const runner = exists("scripts/ci-run-packaged-e2e.ps1") ? read("scripts/ci-run-packaged-e2e.ps1") : "";
  const acceptanceIds = [
    "acceptance.app-startup",
    "acceptance.authoritative-glb-visible",
    "acceptance.repeat-load-preserves-visible-character",
    "acceptance.available-bones-animate"
  ];
  const missingIds = acceptanceIds.filter(id => !e2e.includes(id));
  check("packaged-acceptance-suite-wired", missingIds.length === 0 && runner.includes("current"),
    { requiredChecks: acceptanceIds, missingChecks: missingIds, runnerSupportsCurrentSuite: runner.includes("current") });

  const profileStore = exists("src/character/CharacterProfileStore.js") ? read("src/character/CharacterProfileStore.js") : "";
  const characterController = exists("src/character/CharacterController.js") ? read("src/character/CharacterController.js") : "";
  check("character-profile-write-is-read-back-verified",
    profileStore.includes("const persisted=read()[key]") &&
    profileStore.includes("could not be verified from persistent storage"),
    { note: "A successful return requires the profile to be read back from persistent storage after writing." });
  check("rest-pose-save-verifies-persisted-profile",
    (characterController.match(/persisted=verify\(this\.profiles\.load\(this\.characterId\)\|\|\{\}\);/g) || []).length >= 2,
    { note: "Rest-pose save and retry must verify actual profile read-back, not only the in-memory object returned by save." });

  const mcpTransport = exists("src/addons/mcp.js") ? read("src/addons/mcp.js") : "";
  check("mcp-transports-support-cancellation-and-timeouts",
    mcpTransport.includes("signal:signal") &&
    mcpTransport.includes("MCP stdio request timed out after") &&
    mcpTransport.includes("MCP HTTP request timed out after") &&
    mcpTransport.includes('child.on("close"'),
    { note: "MCP requests must honor cancellation, have bounded transport lifetimes, and reject when a stdio server exits early." });

  const memoryService = exists("src/main/services/memory-service.js") ? read("src/main/services/memory-service.js") : "";
  check("memory-fact-update-removes-stale-vector-versions",
    memoryService.includes('const indexed=add(u,value,{type:"fact",key})') &&
    memoryService.includes('x.id===indexed.id||x.metadata?.type!=="fact"||x.metadata?.key!==key'),
    { note: "Updating an explicit fact must keep the current indexed vector and remove obsolete vectors for the same fact key." });

  const runtime = exists("src/main/runtime.js") ? read("src/main/runtime.js") : "";
  const startupMarkerPresent = runtime.includes('ciWriteE2EStartup("ci-e2e-start"');
  const reportPreservedOnRunnerFailure = runner.includes('$destination = "$report.runner-failure.json"');
  const visibilityE2e = exists("src/main/ci-e2e.js") ? read("src/main/ci-e2e.js") : "";
  const visibilityCheckStart = visibilityE2e.indexOf('check("acceptance.authoritative-glb-visible"');
  const visibilityCheckEnd = visibilityE2e.indexOf('check("acceptance.repeat-load-preserves-visible-character"', visibilityCheckStart);
  const visibilityProbe = visibilityCheckStart >= 0 && visibilityCheckEnd > visibilityCheckStart ? visibilityE2e.slice(visibilityCheckStart, visibilityCheckEnd) : "";
  const visibilityProbeIsCloneSafe = visibilityProbe.includes("boneNames=(e?.getAvailableBoneNames?.()||[]).map") && !visibilityProbe.includes("rt.controller?.status?.()");
  check("authoritative-glb-probe-returns-clone-safe-data", visibilityProbeIsCloneSafe,
    { visibilityProbeIsCloneSafe, unsafeControllerStatusReturn: visibilityProbe.includes("rt.controller?.status?.()"), note: "webContents.executeJavaScript results must contain only cloneable plain data, not raw controller/Three.js objects." });

  check("packaged-runner-startup-handshake-and-report-preservation", startupMarkerPresent && reportPreservedOnRunnerFailure,
    { startupMarkerPresent, reportPreservedOnRunnerFailure, note: "The packaged app must emit the exact runner handshake, and runner failures must not overwrite the detailed app acceptance report." });

  const report = {
    suite: "current-product-preflight",
    createdAt: new Date().toISOString(),
    pass: failures.length === 0,
    summary: { checks: checks.length, passed: checks.filter(x => x.pass).length, failed: failures.length },
    checks, failures,
    productPolicy: {
      visibleMeshRequired: true,
      skeletonRequired: false,
      partialRigSupported: true,
      realPackagedRuntimeAcceptanceRequired: true
    }
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exitCode = 1;
}

main();
