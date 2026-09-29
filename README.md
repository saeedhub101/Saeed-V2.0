# Saeed AI

Saeed AI is a Windows desktop AI companion and computer agent built with **Electron + Chromium + HTML/CSS/JavaScript + Three.js/WebGL**.

The current architecture is lifecycle-based: the 3D character is ready when the application starts, while microphone, speech processing, external API work, agent execution, and secondary windows are activated only when needed.

## Startup lifecycle

When Saeed starts:

- The 3D character is visible and its Three.js/WebGL renderer remains active.
- The microphone is **OFF**.
- No microphone capture stream is running.
- STT is not processing audio.
- TTS is idle.
- No external API connection is opened.
- No agent task is executing.
- Chat, Status, Performance, and 3D Status windows do not exist in the background.
- The tray and character remain available.

The saved microphone preference does not automatically reopen the microphone at startup. The user explicitly turns the microphone ON.

## Voice lifecycle

There is one authoritative microphone state:

- **Mic ON** — starts microphone capture and the voice lifecycle.
- **Mic OFF** — completely stops microphone/STT/voice resources.

There is no **Always Listening** requirement or separate Always Listening mode.

When Mic ON is active:

1. Microphone capture starts.
2. Local Whisper STT is used by default.
3. A recognized sentence enters the same Agent path used by Chat.
4. The Local Brain is checked first.
5. If the Local Brain can handle the request, local Agent/tools execute it.
6. If the Local Brain cannot handle it, the external LLM/API is requested.
7. Tool results are verified through the normal Agent path.
8. Saeed replies through the configured TTS path.
9. Listening continues until Mic OFF.

Mic OFF must stop the microphone stream, audio context, STT processing, timers, and voice resources.

## Local-first intelligence

The normal request path is:

**User input → Local Brain → Local Agent/tools → verify → answer**

If the Local Brain has no safe/appropriate handler:

**User input → external LLM/API → Agent tools → verify → answer**

The external API is therefore **on demand**, not a startup service.

The Agent and Local Brain objects may exist in a lightweight ready state at startup. They do not continuously poll, process tasks, or make network requests.

## Secondary windows

Chat, Status, Performance, and 3D Status are independent Electron windows.

They are created only when opened, initialized when created, and **destroyed when X is pressed**. They are recreated fresh on the next open.

Closing a secondary window must not leave its renderer, timers, listeners, audio resources, or background polling running.

The 3D character is different: it is the permanent visible Saeed surface and remains alive while the application is running.

## 3D character

The current default character is:

`assets/Saeed_AI-3D.glb`

The runtime is Three.js/WebGL based and handles GLB loading, humanoid rig detection, animation/idle behavior, eye/head movement, blinking, facial morphs/visemes when available, expressions, gestures, sizing, movement, and renderer diagnostics.

If an optional GLB capability is missing, the renderer falls back instead of starting a second character runtime.

## Agent and permissions

- `src/agent.js` — local-first Agent routing, persistent settings/history, and external model execution.
- `src/local-brain.js` — offline intent routing.
- `src/tools.js` — tool registry.
- `src/computer.js` — Windows computer operations.
- `src/memory.js` — persistent memory.

Sensitive or destructive computer operations remain confirmation-gated. The permission model is independent from the microphone lifecycle.

## Voice implementation

The default local STT engine is the bundled Whisper CLI plus the bundled model.

The renderer owns live microphone capture and reports a real microphone level while the microphone is ON. Audio is sent to local transcription in local-first mode.

Optional realtime API support remains in `src/realtime.js`; it is not opened automatically at startup.

The default TTS path is the local browser speech-synthesis path already used by the application. API-backed voice providers remain configurable.

## UI control rule

There must be one source of truth for each runtime service.

In particular:

- Mic ON/OFF changes the actual microphone lifecycle, not only a label.
- Status reflects the real microphone state and live input level.
- Tray microphone state reflects the same state.
- Closing a secondary window destroys it rather than merely hiding it.
- Update UI is transient and appears only during an update operation/check.
- Chat, Status, Performance, and 3D Status must not silently start background services just because their windows were opened.

## Application icon

The authoritative artwork is:

- `assets/saeed.png` — master artwork.
- `assets/saeed.ico` — native Windows ICO generated from the PNG.

The official Windows build workflow generates the ICO before packaging. `src/main.js` uses the same resolved icon for the application window, taskbar identity, and tray.

Do not replace this icon architecture without deliberately redesigning and testing the Windows EXE, taskbar identity, and tray icon.

## Updates

The application uses `electron-updater`.

Update checking/downloading is on demand. The character update panel is hidden while idle and appears only while an update operation has UI state to show.

There is no separate native C++ updater.

## Build

The official Windows workflow is:

`.github/workflows/build-windows-electron.yml`

It is named **Saeed AI — Windows Build** and is the only Windows build workflow.

It validates the repository, installs dependencies, validates JavaScript, creates the native Saeed ICO, builds the bundled offline Whisper CLI/model, builds the Windows NSIS installer, verifies the installer/updater metadata, and uploads the verified EXE artifact.

A normal test/fix build does not become a GitHub Release. Release publication remains explicitly gated.

## Local development

Requirements: Windows, Node.js compatible with the workflow, and npm.

```powershell
npm install
npm start
npm test
npm run build
```

## Important files

- `package.json`
- `src/main.js`
- `src/preload.js`
- `src/index.html` / `src/renderer.js`
- `src/status.html` / `src/status.js`
- `src/performance.html` / `src/performance.js`
- `src/character.html` / `src/avatar.js`
- `src/3d-status.html` / `src/3d-status.js`
- `src/agent.js`
- `src/local-brain.js`
- `src/tools.js` / `src/computer.js`
- `src/memory.js`
- `src/realtime.js`
- `assets/Saeed_AI-3D.glb`
- `assets/saeed.png` / `assets/saeed.ico`
- `.github/workflows/build-windows-electron.yml`

## Architecture rules

1. Keep one coherent Electron + Three.js/WebGL architecture.
2. Do not reintroduce the deleted C++/Win32 or old WebView2 application paths.
3. Do not create duplicate character, agent, memory, or microphone runtimes.
4. Keep the 3D character alive; keep secondary windows on-demand and destroy them on close.
5. Keep the microphone OFF at startup.
6. Use one Mic ON/OFF controller and synchronize every UI surface to it.
7. Use Local Brain first; call an external API only when the local path cannot handle the request.
8. Do not start API connections, STT, TTS processing, or agent tasks merely because the application started.
9. Do not reintroduce an Always Listening contract or automatically reopen the microphone from saved settings.
10. Preserve the working Chat/API/voice paths while repairing unrelated 3D code unless a lifecycle change requires touching them.
11. The repository and current source code are the implementation source of truth; this README describes the intended architecture and must stay synchronized with it.
