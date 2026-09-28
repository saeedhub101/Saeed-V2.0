# Saeed AI

Saeed AI is a Windows desktop AI agent and 3D companion built with **Electron, Chromium, HTML/CSS/JavaScript, and Three.js**.

The current repository is an Electron application. The old native C++/Win32 application, WebView2 utility-window implementation, and legacy repair/build files are no longer part of the current architecture.

## Current architecture

```
Saeed AI
├── Electron main process
│   └── src/main.js
├── Secure renderer bridge
│   └── src/preload.js
├── HTML/CSS/JavaScript UI
│   ├── src/index.html
│   ├── src/style.css
│   └── src/renderer.js
├── 3D character
│   └── src/avatar.js + assets/Saeed_AI-3D.glb
├── Agent system
│   ├── src/agent.js
│   ├── src/tools.js
│   ├── src/computer.js
│   └── src/memory.js
└── Realtime voice
    └── src/realtime.js
```

### What each layer does

- **Electron/Chromium:** owns the Windows desktop application, window lifecycle, tray integration, screen capture, IPC, updates, and packaged EXE.
- **HTML/CSS/JavaScript:** provides the current chat interface, settings UI, controls, status displays, and application interaction.
- **Three.js/WebGL:** renders and controls the GLB character.
- **Agent:** handles local conversation, persistent history/settings, tool selection, confirmations, and model/API interaction.
- **Computer tools:** provide Windows-oriented operations such as screen capture and computer interaction exposed through the agent tool layer.
- **Realtime:** provides realtime voice/audio integration and realtime tool calls when configured.

**Chromium is provided by Electron. It is not a separate browser application.**

There is **no C++ build path in the current application**, and C++ source files are not required to build the current Windows EXE.

## Current application

The current app provides:

- Desktop chat with persistent conversation history.
- Always Listening configuration; the main process enforces `alwaysListening: true` and `micMode: "always"` when settings are saved.
- Realtime voice/audio integration when the required API configuration is available.
- LLM/API settings with separate API-key fields and masked public settings.
- Local agent execution and tool calling.
- Confirmation handling for sensitive agent operations.
- Screen capture.
- Persistent memory and task data under Electron's user-data directory.
- Three.js GLB avatar loading and animation/behavior support.
- Character movement, gestures, facial morph/viseme handling, blinking, eye behavior, and procedural behavior when the loaded character supports the required rig/features.
- System tray controls.
- Always-on-top desktop window behavior and work-area boundary handling.
- Automatic update checking/downloading/installing through `electron-updater` in installed builds.

The application currently uses one Electron desktop window containing the HTML UI and 3D surface. Chat/settings are implemented in the current renderer UI; they are **not** native C++/Win32 windows.

## 3D character

The current default character is:

`assets/Saeed_AI-3D.glb`

The runtime loads the GLB with Three.js and attempts to work with different humanoid rigs rather than requiring the old `avatar.html` runtime.

The avatar code supports, where the asset provides the required data:

- humanoid bone detection;
- camera/model framing;
- animation clip selection and playback;
- idle/procedural body behavior;
- eye/head movement;
- blinking;
- facial morphs;
- speech visemes;
- expressions;
- gestures;
- movement and turning.

If a particular GLB does not provide a required bone, morph target, or animation, the runtime can skip that capability instead of requiring a second character system.

## Agent and tools

The agent is implemented in `src/agent.js`.

The tool registry is implemented in `src/tools.js` and currently connects agent requests to capabilities including computer operations and memory/task operations.

`src/computer.js` contains the computer-execution layer.

`src/memory.js` provides persistent memory storage.

Conversation history and settings are stored through Electron's user-data path rather than inside the repository.

The agent is designed to verify important operations instead of treating a tool call alone as proof that an action succeeded.

Sensitive/destructive operations can require an explicit confirmation from the user before execution.

## Voice

`src/realtime.js` implements the realtime voice connection.

The main process connects realtime audio/transcription events to the renderer and can expose registered agent tools to the realtime model.

API configuration is stored through the application's settings system. Public settings returned to the renderer do not expose the stored API keys.

## Application icon and Windows system-tray icon — DO NOT REMOVE OR REPLACE

The Saeed icon implementation is an intentional part of the current architecture. **Do not remove it, replace it with an automatically generated Electron icon, or change the source/creation method without deliberately redesigning the icon system and updating this section.**

### Authoritative icon source

The master artwork is:

`assets/saeed.png`

This PNG is the source artwork. The Windows EXE and Windows desktop/taskbar icon use a native Windows ICO generated from this PNG.

The generated native icon is:

`assets/saeed.ico`

The build configuration uses:

`assets/saeed.ico`

as the application icon. This is deliberate: Electron Builder must consume the pre-generated ICO instead of converting the PNG itself.

### Exact method used to create `saeed.ico`

The official Windows build workflow is:

`.github/workflows/build-windows-electron.yml`

Before `npm run build`, the workflow runs ImageMagick using the following exact method:

```powershell
$source = "assets/saeed.png"
$icon = "assets/saeed.ico"

if (!(Test-Path $source)) {
  throw "Source Saeed PNG is missing: $source"
}

if (!(Get-Command magick -ErrorAction SilentlyContinue)) {
  choco install imagemagick --yes --no-progress
}

& magick $source -background none -define icon:auto-resize=256,128,64,48,32,16 $icon

if ($LASTEXITCODE -ne 0) {
  throw "ImageMagick failed to generate $icon"
}

if (!(Test-Path $icon)) {
  throw "Saeed.ico was not generated from Saeed.png."
}

$bytes = (Get-Item $icon).Length

if ($bytes -lt 1000) {
  throw "Windows icon is unexpectedly small: $bytes bytes"
}

& magick identify $icon

if ($LASTEXITCODE -ne 0) {
  throw "Generated ICO could not be inspected."
}

Write-Host "Native Windows icon generated from Saeed.png: $icon"
```

This produces a multi-size native Windows ICO containing **256, 128, 64, 48, 32, and 16 pixel** icon sizes.

### How the application uses the icon

The authoritative runtime implementation is in `src/main.js`.

The icon path is resolved by `windowsIconPath()`:

1. Look for `assets/saeed.ico`.
2. If the ICO is unavailable, fall back to `assets/saeed.png`.

The same resolved icon is intentionally used for:

- the Electron BrowserWindow icon;
- the Windows application icon;
- the Windows taskbar/application identity through `setAppDetails()`;
- the system-tray icon.

The relevant implementation must remain conceptually equivalent to:

```js
// AUTHORITATIVE SAEED ICON CODE — DO NOT REMOVE OR REPLACE.
// This code defines the official Saeed Windows application/taskbar icon source.
function windowsIconPath(){
 const ico=path.join(__dirname,"..","assets","saeed.ico");
 const png=path.join(__dirname,"..","assets","saeed.png");
 return fs.existsSync(ico)?ico:png;
}

// AUTHORITATIVE SAEED SYSTEM TRAY ICON CODE — DO NOT REMOVE OR REPLACE.
// The tray icon must use the same authoritative Saeed icon source.
function trayIcon(){
 return nativeImage.createFromPath(windowsIconPath());
}
```

The window also deliberately uses the same source:

```js
icon:windowsIconPath()
win.setIcon(windowsIconPath())

if(process.platform==="win32"){
 win.setAppDetails({
  appId:"ai.saeed.desktop",
  appIconPath:windowsIconPath(),
  appIconIndex:0,
  relaunchCommand:process.execPath,
  relaunchDisplayName:"Saeed AI"
 });
}
```

The system tray is created from that same icon:

```js
tray=new Tray(trayIcon());
tray.setToolTip("Saeed AI");
```

### Icon preservation rules

The following rules are mandatory for future changes:

1. **Do not delete `assets/saeed.png`.** It is the master icon artwork.
2. **Do not remove the ImageMagick PNG-to-ICO step from the official Windows build workflow.**
3. **Do not change `build.icon` away from `assets/saeed.ico` unless the icon architecture is intentionally redesigned.**
4. **Do not replace `windowsIconPath()` with another icon path without updating this README and deliberately validating the EXE/taskbar/tray result.**
5. **Do not replace `trayIcon()` with a different icon source.** The tray must use the same authoritative Saeed icon.
6. **Do not allow Electron Builder to generate the Windows icon directly from the PNG.** The native ICO is intentionally generated first.
7. Any future icon change must be tested in a Windows build and verified for the **EXE, installed application/taskbar identity, and system tray**.
8. If an agent modifies `src/main.js`, `package.json`, `assets/saeed.png`, `assets/saeed.ico`, or the Windows build workflow, it must preserve this icon architecture unless the user explicitly requests a redesign.

The comments marked **AUTHORITATIVE SAEED ICON CODE** and **AUTHORITATIVE SAEED SYSTEM TRAY ICON CODE** are code-level preservation markers for future developers/agents.

## Updates

The application uses `electron-updater`.

The current updater flow is:

1. Check for an update.
2. Report update state to the UI.
3. Download an available update when requested.
4. Install it when requested/restarted according to the updater state.

There is no separate native C++ updater executable in the current architecture.

## Build

The official Windows workflow is:

`.github/workflows/build-windows-electron.yml`

It is named **Saeed AI — Windows Build** and is the single official Windows build workflow.

It runs for changes to the relevant application/build files on `main`, and it can also be started manually with GitHub Actions.

The workflow performs, among other checks:

- version validation;
- repository structure validation;
- dependency pin validation;
- JavaScript syntax tests;
- Always Listening contract checks;
- native Saeed PNG-to-ICO icon generation;
- Electron Windows packaging;
- built-program chat smoke testing;
- chat/response/voice checks;
- CPU, RAM, and GPU checks where the Windows runner supports them;
- installer validation;
- artifact upload.

A normal test/fix build does not automatically become a GitHub Release. Release publication is separately gated by the workflow.

## Local development

Requirements:

- Windows
- Node.js compatible with the repository workflow
- npm

Install dependencies:

```powershell
npm install
```

Run the application:

```powershell
npm start
```

Run JavaScript validation:

```powershell
npm test
```

Build the Windows installer:

```powershell
npm run build
```

The package configuration uses Electron Builder to produce the Windows NSIS installer.

## Repository structure

Important current files:

- `package.json` — Electron project, dependencies, scripts, and Windows packaging configuration.
- `VERSION` — official product version source; currently `2.1`.
- `src/main.js` — Electron main process and **authoritative application/taskbar/tray icon implementation**.
- `src/preload.js` — renderer/main-process bridge.
- `src/index.html` — current UI markup.
- `src/style.css` — current UI styling.
- `src/renderer.js` — renderer-side chat/settings/voice interaction.
- `src/avatar.js` — Three.js GLB character runtime.
- `src/agent.js` — agent and persistent conversation/settings logic.
- `src/tools.js` — agent tool registry.
- `src/computer.js` — computer-operation layer.
- `src/memory.js` — persistent memory layer.
- `src/realtime.js` — realtime voice/API integration.
- `assets/Saeed_AI-3D.glb` — current default 3D character.
- `assets/saeed.png` — **master Saeed icon artwork**.
- `assets/saeed.ico` — **native Windows ICO generated from the master PNG**.
- `.github/workflows/build-windows-electron.yml` — official Windows build and **authoritative PNG-to-ICO creation method**.

## Architecture rule

There must be one coherent current application architecture.

The current source of truth is:

**Electron + Chromium + HTML/CSS/JavaScript + Three.js/WebGL + the current Agent/Tools/Memory/Realtime modules.**

Do not reintroduce the deleted native C++ application, old WebView2 utility-window architecture, duplicate avatar runtime, duplicate agent system, duplicate memory system, or obsolete build/repair workflows unless the architecture is deliberately redesigned and the current repository is updated as a whole.

The repository and Git history are the source of truth for the implementation.
