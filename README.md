# Saeed AI

Saeed AI is a Windows desktop AI companion and computer agent built as one Electron application with Three.js/WebGL for the permanent 3D character.

## Current architecture

- Desktop runtime: Electron + Chromium.
- UI: HTML/CSS/JavaScript.
- 3D: Three.js 0.180.0 + WebGL.
- 3D loader: src/three/GLTFLoader.js.
- Geometry utility: src/three/BufferGeometryUtils.js.
- AI orchestration: src/agent.js.
- Offline intent routing: src/local-brain.js.
- Computer and general tools: src/computer.js and src/tools.js.
- Persistent memory: src/memory.js.
- Optional realtime API: src/realtime.js.
- Local speech input: bundled Whisper CLI/model built by CI and invoked by src/main.js.
- Voice lifecycle: src/character-voice.js.
- Main process and IPC: src/main.js and src/preload.js.
- Autonomous brain boundary: src/autonomous/brain-supervisor.js, default-brain.js, context.js, tasks.js, and feelings.js.
- Character behavior layers: src/character-animation-controller.js, character-interaction.js, and character-feelings.js.

Old C++/Win32, C# desktop, Tauri/WebView2, duplicate character runtimes, and obsolete 3D reload-test APIs are not part of the current architecture.

## Startup behavior

- The 3D character window is available at startup.
- The microphone is OFF by default.
- No microphone capture stream or STT processing runs while Mic is OFF.
- TTS is idle until a response is spoken.
- Realtime API connections are not opened automatically.
- No agent task continuously executes in the background.
- Chat, Status, Performance, and 3D Status windows are created only when opened.

The saved microphone setting must not silently reopen the microphone at startup. Microphone activation is an explicit user action.

## Microphone and voice

The character window contains the authoritative MIC ON / MIC OFF control.

Mic OFF stops the complete microphone lifecycle, including the media stream, audio processing, microphone-level reporting, local speech buffering, transcription work, realtime audio transmission, and related voice resources.

Mic ON starts Windows/Electron microphone capture and selects the configured STT path. With the local Whisper provider, captured speech is sent to the bundled offline Whisper runtime. With a realtime provider, the realtime connection is started when required. Recognized text enters the same Agent/Chat path used for normal text requests.

The live microphone level is measured from the actual capture path; it is not a fixed placeholder.

## Local-first request flow

Normal requests follow:

User input → Local Brain → Agent/tools → verification → response

If Local Brain cannot handle the request safely or appropriately:

User input → configured external model/API → Agent/tools → verification → response

External API connections are on demand. The Agent is an orchestrator, not a collection of permanently running specialist agents.

## 3D character

The current authoritative runtime character is assets/Saeed_Test-3D.glb.

The character is loaded through the Three.js/WebGL renderer. The renderer uses the capabilities available in the GLB for rigging, animation, facial behavior, and interaction without creating a second character runtime.

The 3D renderer does not run a permanent render loop. It renders only when the scene actually needs an update, such as initial character load, resize, or another explicit visual change.

The renderer exposes live 3D status information for the 3D Status window, including component state and runtime render metrics.

## Windows and UI

### Character window

- Permanent visible Saeed surface.
- Three.js/WebGL canvas.
- Character surface can be dragged.
- Double-clicking the character opens Chat.
- Microphone control is available directly in the character window.
- Update UI is transient and appears only while an update/check operation has relevant state.

### Secondary windows

Chat, Status, Performance, and 3D Status are independent Electron windows. They are created when opened and destroyed when closed.

Opening a secondary window must not silently start microphone capture, STT, TTS, realtime networking, agent execution, or unnecessary background services.

## Agent, tools, and permissions

- src/agent.js — request orchestration, settings/history, model execution, and tool coordination.
- src/local-brain.js — local/offline intent handling.
- src/tools.js — tool registry and tool definitions.
- src/computer.js — Windows computer operations.
- src/memory.js — persistent memory.

Sensitive or destructive computer operations remain confirmation-gated.

Electron permission handling explicitly supports media access and does not grant unrelated Chromium permissions by default.

## Diagnostics and performance

Diagnostics have two purposes: live runtime state for Status/Performance/3D Status, and diagnostic events for the Chat diagnostics surface.

Diagnostic events are not broadcast indiscriminately to every renderer.

Application resource monitoring uses a centralized Electron application-metrics collection path so different monitoring features do not repeatedly collect the same metrics independently.

CI diagnostic reports are preserved with the verified build artifact so CPU, RAM, process, GPU, disk, network, brain, voice, STT/TTS and 3D verification results can be inspected after the build.

## Updates

The application uses electron-updater. Update checking and downloading are on demand. The character update UI is transient and is not permanently displayed while idle.

There is no separate native C++ updater.

## Application icon

The source artwork is assets/saeed.png.

The Windows ICO is generated from that PNG during the official Windows build, so the generated ICO is not required as a committed source file.

## Build system

There is exactly one Windows build workflow:

.github/workflows/build-windows-electron.yml

Workflow name: Saeed AI — Windows Build

The workflow checks the exact commit, validates VERSION/package identity, installs dependencies, validates JavaScript, generates the Windows ICO, builds and tests bundled offline Whisper, builds the NSIS installer, runs the isolated 3D baseline, runs the application runtime smoke test and resource report, verifies the installer/updater metadata, removes temporary CI reports, and uploads the verified Windows artifact.

Normal push and manual test builds do not create a GitHub Release. Release publication is gated by a matching v* version tag.

## Versioning

VERSION is the authoritative release version in MAJOR.MINOR form.

The current product version is 3.9 and the Windows package/build version is 3.9.0.

A GitHub Actions build number is a CI run number, not a product release version.

## Local development

Requirements: Windows, Node.js 22.14.0 or a compatible version, and npm.

Install: npm install

Run: npm start

Validate: npm test

Build installer: npm run build

The CI workflow is the authoritative Windows verification path because it also builds the bundled Whisper runtime, runs smoke tests, verifies the installer, and uploads the resulting artifact.

## Important files

### Application core

- src/main.js
- src/preload.js
- src/index.html
- src/renderer.js

### Character and voice

- src/character.html
- src/avatar.js
- src/character-controls.js
- src/character-voice.js
- assets/Saeed_Test-3D.glb
- assets/saeed.png

### Status and monitoring

- src/status.html / src/status.js / src/status.css
- src/performance.html / src/performance.js / src/performance.css
- src/3d-status.html / src/3d-status.js / src/3d-status.css

### Intelligence and tools

- src/agent.js
- src/local-brain.js
- src/tools.js
- src/computer.js
- src/memory.js
- src/realtime.js

### Three.js runtime

- src/three/GLTFLoader.js
- src/three/BufferGeometryUtils.js

### Packaging and CI

- package.json
- VERSION
- build/installer.nsh
- .github/workflows/build-windows-electron.yml

## File architecture and ownership map

The source tree is organized by responsibility. **Agents must follow this map before creating, moving, or modifying files. Do not create duplicate implementations in arbitrary directories.** If a new capability belongs to an existing domain, add it to that domain's folder/module instead of creating a parallel runtime.

### Authoritative directory map

~~~text
Saeed-V2.0/
├── assets/                         # Runtime assets only
│   ├── Saeed_Test-3D.glb          # Current default/fallback character
│   └── saeed.png                  # Source application icon
├── src/
│   ├── main.js                    # Electron main process, windows, IPC, startup
│   ├── preload.js                 # Renderer-safe IPC/API bridge
│   ├── renderer.js                # Main renderer/UI orchestration
│   ├── index.html                 # Main renderer document
│   ├── agent.js                   # Agent brain/orchestration and tool coordination
│   ├── local-brain.js             # Fast offline/local intent routing
│   ├── tools.js                   # Central Tool Registry, schemas, permissions, dispatch
│   ├── computer.js                # Low-level Windows computer/GUI operations
│   ├── memory.js                  # Persistent Agent memory
│   ├── realtime.js                # Optional realtime API transport
│   ├── agent-tools/               # Structured specialist tools
│   │   ├── index.js               # Tool registration/export boundary
│   │   ├── document-tools.js      # PDF/document extraction and inspection
│   │   └── office-tools.js        # Excel/spreadsheet reading and writing
│   ├── avatar.js                  # Three.js/WebGL character renderer
│   ├── character.html             # Character window
│   ├── character-controls.js      # Character interaction/window controls
│   ├── character-voice.js         # Character voice lifecycle
│   ├── autonomous/                # Separate autonomous behavior system
│   │   ├── brain-supervisor.js    # Controller selection/lifecycle
│   │   ├── default-brain.js       # Lightweight idle decision scheduler
│   │   ├── context.js             # Brain capability boundary
│   │   ├── tasks.js               # Existing task-store adapter
│   │   └── feelings.js            # Persistent mood adapter
│   ├── status.*                   # General runtime status
│   ├── performance.*              # Performance/resource monitoring
│   ├── 3d-status.*                # 3D renderer diagnostics
│   ├── update-toast.*             # Transient update notification
│   ├── update-status.*            # Dedicated update status/download window
│   └── three/                     # Bundled Three.js runtime helpers
│       ├── GLTFLoader.js
│       └── BufferGeometryUtils.js
├── build/                         # Build/installer resources, NOT Agent tools
├── .github/workflows/             # CI/build automation only
│   └── build-windows-electron.yml # The only Windows build workflow
├── package.json                   # Dependencies/scripts/build config
└── VERSION                        # Authoritative product release version
~~~

### Where an Agent must store new code

| New capability | Correct location | Do not put it in |
|---|---|---|
| Agent reasoning/planning/orchestration | src/agent.js | main.js, renderer.js |
| New local/offline intent | src/local-brain.js | a second brain file |
| Generic tool registration/permissions | src/tools.js | duplicated tool registries |
| PDF/document capability | src/agent-tools/document-tools.js | main.js, random utils.js |
| Excel/Office capability | src/agent-tools/office-tools.js | GUI-only code in computer.js |
| New specialist Agent tool family | src/agent-tools/ + index.js | a parallel Agent runtime |
| Windows mouse/keyboard/process/window primitive | src/computer.js | agent.js |
| Persistent Agent memory | src/memory.js | arbitrary JSON files under src/ |
| 3D rendering | src/avatar.js | agent.js, renderer.js |
| Character interaction | src/character-controls.js | avatar.js unless it is renderer logic |
| Voice lifecycle | src/character-voice.js / existing voice path | a new microphone runtime |
| Electron windows / IPC | src/main.js + src/preload.js | direct Electron access from renderer |
| Window UI | matching .html/.js/.css files | main.js unless window creation/IPC is required |
| Three.js loaders/helpers | src/three/ | another copy of Three.js |
| Build/CI behavior | .github/workflows/ | application runtime code |
| Installer customization | build/ | src/ |
| Static runtime assets | assets/ | src/ |

### Data/storage ownership

**Source code belongs in the repository. User/runtime state belongs in Electron userData. Temporary CI/build data belongs in dist/ or the CI workspace and must not become application state.**

~~~text
Repository
├── src/                  application source
├── assets/               bundled runtime assets
├── build/                installer/build resources
└── .github/              CI/build automation

Electron userData/
├── characters/           selected/persisted character data
├── tasks.json            Agent task state
└── other existing        persistent application state

dist/ / CI workspace       temporary build and verification output
~~~

**Never store user-specific runtime state inside src/ or assets/.** Do not overwrite the bundled default GLB when the user selects another character. Persist the selected character separately and restore it at startup.

### Agent tool lifecycle

Agent tools are **on-demand capabilities**, not permanently running services.

~~~text
User request
    ↓
Local Brain / Agent
    ↓
Select only the required tool(s)
    ↓
Central Tool Registry permission check
    ↓
Execute
    ↓
Observe / verify
    ↓
Use another tool only if required
    ↓
Return result
    ↓
Release temporary resources / end task
~~~

Rules:

1. Do not initialize specialist libraries at startup unless the architecture requires it.
2. Prefer lazy loading for heavy optional dependencies.
3. Prefer native structured tools over GUI automation when a reliable structured API exists.
4. Use GUI automation as a fallback when no suitable structured tool exists.
5. Tools must return clear results/errors; the Agent decides whether another tool is needed.
6. Do not create persistent workers, polling loops, or background services for one-shot Agent tasks.
7. Do not create duplicate implementations of existing capabilities.
8. New specialist tool families belong under src/agent-tools/, are exported through index.js, then registered by src/tools.js.
9. Permissions belong to the central Tool Registry; specialist tools must not create a second permission system.
10. Important file operations must be verified after execution.

### Resource-efficiency rules

- No permanent Agent loop. The Agent runs when a request requires it.
- No continuous 3D render loop. Render only when the scene actually needs updating.
- No unnecessary API calls. Use Local Brain first where appropriate.
- No unnecessary GUI automation. Use direct file/API operations first.
- No loading every specialist library at startup. Load capabilities when requested.
- No duplicated state stores. Use the existing memory/task/userData mechanisms.
- No speculative tool creation. Create/use a tool because the current request requires it.
- Bound Agent/tool execution with safe step/resource limits.
- Verify, then finish. Do not keep a session alive after the task is complete.

### File retrieval rule for future Agents

Before implementing a task, an Agent must:

1. Read this README.
2. Locate the existing owner of the capability in the map above.
3. Read that owner file and directly related modules.
4. Reuse existing interfaces before creating a new one.
5. Put new files only in the directory assigned to that responsibility.
6. Update this README whenever the architecture or ownership map changes.

If an existing capability already has an authoritative file, **modify that file instead of creating a second file with similar responsibility.**

## Architecture rules

1. Keep one coherent Electron + Three.js/WebGL application architecture.
2. Keep assets/Saeed_Test-3D.glb as the current runtime character unless a deliberate replacement is made and tested.
3. Do not reintroduce old C++/Win32, C# desktop, Tauri/WebView2, or duplicate 3D application paths.
4. Keep one character runtime and one microphone/voice lifecycle.
5. Keep the microphone OFF at startup unless the user explicitly turns it ON.
6. Keep the live microphone level tied to the real capture path.
7. Use Local Brain first for requests that can be handled locally; use external APIs only when required.
8. Keep secondary windows on demand and destroy them when closed.
9. Do not add permanent background polling or services merely to support a secondary window.
10. Keep 3D animation and procedural work throttled rather than executing at unrestricted display refresh rate.
11. Keep diagnostics live and purposeful; do not reintroduce obsolete diagnostic storage or reload-test APIs.
12. Do not grant unrelated Chromium permissions broadly.
13. Preserve working Chat/API/voice behavior when making unrelated 3D or performance changes.
14. Keep CI diagnostic reports temporary and remove them before artifacts are uploaded.
15. Treat the current source tree, package configuration, workflow, VERSION, and this README as the authoritative project description.


## Release 3.10

- Organized character right-click controls into compact Voice, Character, Diagnostics, and Updates/Settings submenus.
- Added grouped Windows taskbar Jump List actions for Chat, Performance, Settings, microphone, character size, Status, and 3D Status.
- Added live Performance resource breakdown by Electron process, including CPU, Working Set, Private Memory and process count.
- Added a live Diagnostics panel for Mic, Brain API, Local Brain, Whisper/STT, TTS, GLB, CPU and 3D state.
- Added microphone mode control to Settings and Performance.
- Preserved local Whisper/STT and existing TTS behavior.
