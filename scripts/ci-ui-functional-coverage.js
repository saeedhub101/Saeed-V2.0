"use strict";
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const srcRoot = path.join(root, "src");
const failures = [];
const inventory = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
function read(file) { return fs.readFileSync(file, "utf8"); }
function fail(message) { failures.push(message); console.error("FAIL " + message); }
function escRe(value) { return value.replace(/[.*+?^\${}()|[\]\\]/g, "\\$&"); }
function attrs(tag) {
  const out = {};
  for (const match of tag.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    out[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return out;
}
const htmlFiles = walk(srcRoot).filter(file => file.endsWith(".html") && !path.basename(file).startsWith("ci-"));
const allSourceFiles = walk(srcRoot).filter(file => /\.(?:js|mjs|cjs)$/.test(file));
const sourceByRelative = new Map(allSourceFiles.map(file => [path.relative(root, file).split(path.sep).join("/"), read(file)]));
function scriptsFor(htmlFile, html) {
  const rel = path.relative(root, htmlFile).split(path.sep).join("/");
  const pieces = [];
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    const a = attrs(match[1]);
    if (a.src) {
      if (/^(?:https?:|data:|\/\/)/i.test(a.src)) continue;
      const scriptRel = path.posix.normalize(path.posix.join(path.posix.dirname(rel), a.src));
      const body = sourceByRelative.get(scriptRel);
      if (body != null) pieces.push(body);
      else fail(rel + " references missing script " + scriptRel);
    } else pieces.push(match[2]);
  }
  return { rel, text: pieces.join("\n") };
}
function isReferenced(id, js) {
  const q = escRe(id);
  return new RegExp("['\"]" + q + "['\"]").test(js) || new RegExp("\\b" + q + "\\b").test(js);
}
for (const file of htmlFiles) {
  const html = read(file);
  const { rel, text: js } = scriptsFor(file, html);
  const ids = [...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(m => m[1]);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  for (const id of [...new Set(dup)]) fail(rel + " contains duplicate DOM id #" + id);
  const buttons = [...html.matchAll(/<button\b[^>]*>/gi)].map(m => ({ tag: m[0], a: attrs(m[0]) }));
  const actionable = [...html.matchAll(/<(?:input|select|textarea)\b[^>]*>/gi)].map(m => ({ tag: m[0], a: attrs(m[0]) }))
    .filter(x => !["hidden","button","submit","reset"].includes((x.a.type || "").toLowerCase()) && !("readonly" in x.a) && !("disabled" in x.a));
  let bound = 0;
  for (const b of buttons) {
    const id = b.a.id;
    const dataAttrs = Object.keys(b.a).filter(k => k.startsWith("data-"));
    const hasFormDefault = (b.a.type || "").toLowerCase() === "submit" && /<form\b/i.test(html);
    let ok = false;
    if (id) ok = isReferenced(id, js);
    else if (dataAttrs.length) {
      const attr = dataAttrs[0].slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      ok = js.includes("dataset." + attr) || js.includes(dataAttrs[0]);
    } else ok = hasFormDefault || /querySelectorAll\([^)]*button|addEventListener\(["']click|\.onclick\s*=/.test(js);
    if (ok) bound++;
    else fail(rel + " has a button with no detectable handler route: " + b.tag.slice(0, 180));
  }
  const unreferencedInputs = actionable.filter(x => x.a.id && !isReferenced(x.a.id, js) && !(x.a.id.startsWith("permission-") && js.includes('$("permission-"+id)'))).map(x => x.a.id);
  for (const id of unreferencedInputs) fail(rel + " has an interactive field not referenced by its screen script: #" + id);
  if (/\bdata-tab\s*=/.test(html) && !/(?:dataset\.tab|data-tab)/.test(js)) fail(rel + " exposes tabs but has no tab-routing code");
  if (/\bdata-category\s*=/.test(html) && !/(?:dataset\.category|data-category)/.test(js)) fail(rel + " exposes categories but has no category-routing code");
  inventory.push({ screen: rel, buttons: buttons.length, buttonRoutesDetected: bound, interactiveFields: actionable.length, fieldsWithoutReference: unreferencedInputs.length });
}
const preloadPath = path.join(srcRoot, "preload.js");
const preload = fs.existsSync(preloadPath) ? read(preloadPath) : "";
const mainFiles = walk(path.join(srcRoot, "main")).filter(file => /\.(?:js|mjs|cjs)$/.test(file));
const mainText = mainFiles.map(read).join("\n");
const invokes = new Set([...preload.matchAll(/\binvoke\(\s*["']([^"']+)["']/g)].map(m => m[1]));
const handlers = [...mainText.matchAll(/ipcMain\.handle\(\s*["']([^"']+)["']/g)].map(m => m[1]);
const handlerSet = new Set(handlers);
const screenJs = htmlFiles.map(file => scriptsFor(file, read(file)).text).join("\n");
const preloadNamespaces = new Map();
const preloadLines = preload.split("\n");
for (let i = 0; i < preloadLines.length; i++) {
  const startMatch = preloadLines[i].match(/^\s{1,4}([A-Za-z_$][\w$]*):\{/);
  if (!startMatch) continue;
  let block = preloadLines[i].slice(preloadLines[i].indexOf("{") + 1);
  if (!/\},?\s*$/.test(preloadLines[i])) {
    for (i++; i < preloadLines.length; i++) {
      if (/^\s{1,4}\},?\s*$/.test(preloadLines[i])) break;
      block += "\n" + preloadLines[i];
    }
  } else block = block.slice(0, block.lastIndexOf("}"));
  preloadNamespaces.set(startMatch[1], new Set([...block.matchAll(/\b([A-Za-z_$][\w$]*)\s*:/g)].map(m => m[1])));
}
const rendererApiCalls = new Set([...screenJs.matchAll(/window\.saeed(?:\.|\?\.)([A-Za-z_$][\w$]*)(?:\.|\?\.)([A-Za-z_$][\w$]*)/g)].map(m => m[1] + "." + m[2]));
for (const api of rendererApiCalls) {
  const [namespace, method] = api.split(".");
  if (!preloadNamespaces.has(namespace)) fail("Renderer calls missing preload namespace: window.saeed." + namespace + "." + method);
  else if (!preloadNamespaces.get(namespace).has(method)) fail("Renderer calls missing preload method: window.saeed." + namespace + "." + method);
}
if (/window\.saeed\.studio\b/.test(screenJs)) fail("A screen still calls the removed window.saeed.studio API");
if (!screenJs.includes("window.saeed.character.saveCharacterModel") || !preload.includes("saveCharacterModel:") || !handlerSet.has("character:model:save")) fail("Character Settings custom-rig export is not connected from UI through preload to main-process IPC");
for (const channel of invokes) if (!handlerSet.has(channel)) fail("Preload invokes IPC channel without a registered ipcMain.handle: " + channel);
const duplicateHandlers = handlers.filter((channel, i) => handlers.indexOf(channel) !== i);
for (const channel of [...new Set(duplicateHandlers)]) fail("IPC channel registered more than once: " + channel);
console.log("\n=== UI FUNCTIONAL COVERAGE INVENTORY ===");
for (const item of inventory) console.log(item.screen + " — buttons " + item.buttons + ", routed " + item.buttonRoutesDetected + ", interactive fields " + item.interactiveFields + ", unreferenced fields " + item.fieldsWithoutReference);
console.log("Screen files: " + inventory.length + "; static buttons: " + inventory.reduce((n, x) => n + x.buttons, 0) + "; IPC invoke channels: " + invokes.size + "; registered handlers: " + handlerSet.size);
if (failures.length) {
  console.error("\nUI functional coverage audit failed with " + failures.length + " issue(s).");
  process.exitCode = 1;
} else {
  console.log("\nUI functional coverage audit passed. This is a static wiring audit; packaged end-to-end behavior remains covered by dedicated runtime acceptance stages.");
}
