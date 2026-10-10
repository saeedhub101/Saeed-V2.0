#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const lockPath = path.join(root, "package-lock.json");
const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
const packages = lock.packages || {};
const licenseNames = ["LICENSE", "LICENSE.txt", "LICENCE", "LICENCE.txt", "COPYING", "COPYING.txt"];
const entries = [];
const missing = [];

for (const [packagePath, meta] of Object.entries(packages)) {
  if (!packagePath.startsWith("node_modules/")) continue;
  const name = packagePath.slice("node_modules/".length);
  const license = typeof meta.license === "string"
    ? meta.license
    : Array.isArray(meta.license) ? meta.license.map(x => x.type || x).join(" OR ")
    : meta.license && typeof meta.license === "object" ? (meta.license.type || "SEE PACKAGE") : "UNSPECIFIED";
  const fullPath = path.join(root, packagePath);
  let licenseText = "";
  for (const filename of licenseNames) {
    const candidate = path.join(fullPath, filename);
    try {
      if (fs.statSync(candidate).isFile()) {
        licenseText = fs.readFileSync(candidate, "utf8").trim();
        if (licenseText) break;
      }
    } catch {}
  }
  entries.push({ name, version: meta.version || "unknown", license, licenseText });
  if (!licenseText) missing.push({ name, version: meta.version || "unknown", license });
}

entries.sort((a, b) => a.name.localeCompare(b.name));
const sections = [
  "SAEED AI — THIRD-PARTY SOFTWARE NOTICES",
  "Generated from package-lock.json and installed npm package license files.",
  "This report is informational, not a legal determination. Review each dependency's current license and obligations before commercial distribution.",
  "",
];
for (const item of entries) {
  sections.push("=".repeat(78), item.name + "@" + item.version, "Declared license: " + item.license, "");
  sections.push(item.licenseText || "[License text was not found in the installed package; manual review required.]");
  sections.push("");
}
sections.push("=".repeat(78), "MANUAL REVIEW REQUIRED", "Packages without a discovered license text:");
sections.push(...(missing.length ? missing.map(x => x.name + "@" + x.version + " — " + x.license) : ["None"]));
sections.push("", "This file covers npm packages in package-lock.json only. It does not cover Electron notices, whisper.cpp, Whisper model weights, add-on bundles, fonts, icons, or other separately bundled assets.");
const output = path.join(root, "THIRD_PARTY_NOTICES.txt");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, sections.join("\n") + "\n", "utf8");
console.log("THIRD_PARTY_NOTICE_REPORT=PASS");
console.log("NPM_LICENSE_ENTRIES=" + entries.length);
console.log("NPM_LICENSE_TEXT_MISSING=" + missing.length);
console.log("THIRD_PARTY_NOTICES=" + output);
