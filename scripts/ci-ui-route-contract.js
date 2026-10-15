"use strict";
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const failures = [];
const checks = [];
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const exists = file => fs.existsSync(path.join(root, file));
const check = (name, pass, detail = "") => {
  checks.push({ name, pass: Boolean(pass), detail });
  if (!pass) failures.push({ name, detail });
};
const manager = read("src/main/application/window-manager.js");
const composition = read("src/main/application/runtime-composition.js");
const controls = read("src/main/application/system-controls.js");
const runtime = read("src/main/runtime.js");
const appIpc = read("src/main/ipc/app-ipc.js");
const packagedAcceptance = read("src/main/ci/packaged-acceptance.js");
const preload = read("src/preload.js");
const characterUi = read("src/character-studio.html");
const performanceUi = read("src/performance.html");
const settingsUi = read("src/settings.html");
const settingsJs = read("src/settings.js");
const testRunner = read("scripts/run-all-tests.js");
const ciFiles = fs.readdirSync(path.join(root, "scripts")).filter(name => /^ci-.*\.js$/.test(name));
const unitTestFiles = [];
function collectUnitTests(directory) {
  const full = path.join(root, directory);
  if (!exists(directory)) return;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) collectUnitTests(relative);
    else if (/\.test\.(?:cjs|mjs|js)$/.test(entry.name)) unitTestFiles.push(relative);
  }
}
collectUnitTests("tests/unit");


const routes = [
  { name: "performance", fn: "showPerformance", file: "performance.html", load: 'path.join(rootPath,"performance.html")' },
  { name: "settings", fn: "showSettings", file: "settings.html", load: 'path.join(rootPath,"settings.html")' },
  { name: "learning", fn: "showLearning", file: "learning/window.html", load: 'path.join(rootPath,"learning","window.html")' },
  { name: "add-ons", fn: "showAddons", file: "addons/window.html", load: 'path.join(rootPath,"addons","window.html")' },
  { name: "character-settings", fn: "showCharacterSettings", file: "character-studio.html", load: 'path.join(rootPath,"character-studio.html")' }
];
check("every-ci-contract-suite-is-in-the-test-runner",
  ciFiles.every(file => testRunner.includes(file)),
  "Unwired CI scripts: " + ciFiles.filter(file => !testRunner.includes(file)).join(", "));
check("every-unit-regression-test-is-in-the-test-runner",
  unitTestFiles.every(file => testRunner.includes(path.basename(file))),
  "Unwired unit tests: " + unitTestFiles.filter(file => !testRunner.includes(path.basename(file))).join(", "));
for (const route of routes) {
  check(route.name + "-window-file-exists", exists(path.join("src", route.file)), route.file);
  check(route.name + "-window-manager-route",
    manager.includes("function " + route.fn + "(") &&
    manager.includes(route.load) &&
    new RegExp("return \\{[^}]*\\b" + route.fn + "\\b").test(manager),
    "Window manager must export " + route.fn + " and load " + route.file);
}
check("character-settings-runtime-composition-route",
  composition.includes("const showCharacterSettings=async()=>") &&
  composition.includes("ensureWindowManager().showCharacterSettings()") &&
  runtime.includes("showCharacterSettings: composition.showCharacterSettings"),
  "The composition must connect the Character Settings route to the implemented window manager");
check("character-settings-tray-action-route",
  /label:"Character Settings",click:showCharacterSettings/.test(controls) &&
  /showCharacterSettings/.test(runtime),
  "The visible tray action must call the injected Character Settings route");
check("character-settings-ipc-and-preload-pair",
  /ipcMain\.handle\("character-settings:show"[\s\S]*?composition\.showCharacterSettings/.test(appIpc) &&
  /showCharacterSettings:\(\)=>invoke\("character-settings:show"\)/.test(preload),
  "The renderer API and main-process IPC handler must resolve to the same Character Settings route");
check("general-settings-character-button-calls-canonical-api",
  settingsJs.includes("window.saeed.character.showCharacterSettings()") &&
  !settingsJs.includes("showRestPoseEditor"),
  "The general Settings shortcut must call the current namespaced Character Settings preload method");
check("packaged-lifecycle-tests-the-current-character-settings-window",
  packagedAcceptance.includes("showCharacterSettings") &&
  packagedAcceptance.includes('"characterSettingsWin"') &&
  packagedAcceptance.includes('screen("character-settings-window","characterSettingsWin",showCharacterSettings,true)') &&
  !packagedAcceptance.includes("showNormalizeHumanoidRestPose") &&
  !packagedAcceptance.includes("restPoseEditorWin"),
  "Packaged lifecycle acceptance must open and close the current Character Settings window through the real composition function");
check("character-settings-page-has-current-authoring-capabilities",
  /<title>Character Setting<\/title>/.test(characterUi) &&
  manager.includes('title:"Character Setting"') &&
  characterUi.includes('id="skeletonTree"') &&
  characterUi.includes('id="keyframePx"') &&
  characterUi.includes('id="meshVisibilityList"') &&
  characterUi.includes('id="saveVisemeMapping"') &&
  characterUi.includes('id="createAccessory"'),
  "The single Character Settings page must contain rig, animation, face/viseme and accessory controls");
check("performance-does-not-own-character-authoring-controls",
  !/id="(?:skeletonTree|keyframePx|meshVisibilityList|saveCustomExpression|createAccessory)"/.test(performanceUi),
  "Rig, pose, animation, morph and accessory editing must not be duplicated in Performance");
check("general-settings-does-not-duplicate-character-authoring",
  !/data-section="character"/.test(settingsUi) &&
  !/id="chooseCharacter"/.test(settingsUi) &&
  !/id="saveCharacter"/.test(settingsUi),
  "Character selection and authoring must live in Character Settings, not the general Settings page");
check("legacy-character-studio-prototype-is-removed",
  !exists("src/studio.js") && !exists("src/studio.css") &&
  !runtime.includes("character-studio:config:") &&
  !preload.includes("studio:{getConfig"),
  "The obsolete standalone studio prototype and its separate config/model-save API must not be shipped");
check("normalize-rest-pose-window-is-not-routed",
  !manager.includes("normalizehumanoidrestpose.html") &&
  !runtime.includes("normalizeHumanoidRestPoseWin") &&
  !runtime.includes("showNormalizeHumanoidRestPose"),
  "Rest-pose normalization belongs to Character Settings, not a second window");

const report = { suite: "ui-route-and-ipc-wiring", createdAt: new Date().toISOString(), pass: failures.length === 0,
  summary: { checks: checks.length, passed: checks.filter(x => x.pass).length, failed: failures.length }, checks, failures };
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
