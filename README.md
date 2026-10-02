# Saeed AI

Saeed AI is a Windows desktop AI companion and computer agent built as one Electron application with a Three.js/WebGL 3D character.

## Authoritative architecture

- Runtime: Electron + Chromium.
- UI: HTML/CSS/JavaScript.
- 3D: Three.js 0.180.0 + WebGL.
- Character renderer: `src/avatar.js`.
- AI orchestration: `src/agent.js`.
- Brain routing: `src/task-router.js`, `src/brain-levels.js`.
- Task lifecycle/planning: `src/task-engine.js`, `src/task-planner.js`.
- Local/offline computer brain: `src/local-brain.js`.
- Central tools and permissions: `src/tools/registry.js`.
- Tool implementations: `src/tools/*.js`.
- Windows primitives: `src/computer.js`.
- Persistent memory: `src/memory.js`.
- Voice lifecycle: `src/character-voice.js`.
- Optional OpenAI Realtime transport: `src/realtime.js`.
- Main process/IPC: `src/main.js`, `src/preload.js`.
- Autonomous character behavior: `src/autonomous/*`.
- Runtime diagnostics: Status, Performance and 3D Status windows.

Old C++/Win32, C#, Tauri/WebView2, duplicate character runtimes, and obsolete isolated 3D test applications are not part of the architecture.

## Brain and task model

Saeed has three user-selectable brain modes:

- **Local** — Local Brain is authoritative. It must not silently fall back to an API.
- **API** — API Brain is authoritative and can use the Agent/tool system to execute computer tasks.
- **Auto** — simple/local-capable work can stay local; complex work can be routed to the API brain.

The Agent is an on-demand orchestrator. It is not a permanently running specialist-agent pool.

Task execution uses:

`TaskRouter → TaskPlanner → TaskEngine → Agent → ToolRegistry → tools`

Agent tools are created/used only when a request needs them and should be released when the task ends.

### Confirmation policy

Routine safe operations do not require confirmation.

Confirmation is reserved for destructive/sensitive operations, including:

- deleting a file;
- removing a saved task or memory;
- overwriting an existing file;
- other actions explicitly classified as destructive by the central permission policy.

Verification tools exist for deterministic checks, but routine actions must not be slowed down by unnecessary verification calls. Verification should be used when the result actually needs to be proven or when safety requires it.

### Step limits and recovery

The Agent has a configurable step limit.

When a task reaches the limit, Saeed can request a temporary increase for that task. The original configured limit is restored afterward.

Task state stores the route, plan and completed/failed tool signatures so a paused task can be resumed without intentionally repeating completed actions.

Resume is not a transactional rollback system: external side effects cannot be undone automatically, and image/task context that is not persisted must not be assumed recoverable.

## Startup and resource lifecycle

Startup must remain lightweight.

- Microphone is OFF by default.
- No microphone capture or STT processing runs while Mic is OFF.
- Realtime connections are not opened unless their configured conditions require them.
- TTS is idle until Saeed actually speaks.
- Agent execution is on demand.
- Heavy optional libraries should be lazy-loaded.
- Secondary windows are created only when opened and are destroyed when closed.
- No permanent background Agent loop is allowed.

The autonomous character subsystem is separate from task execution. It uses delayed timers for optional idle movement/thought behavior; it must never become a continuous high-frequency polling loop or a hidden task executor.

## Voice

The character window provides the authoritative microphone control.

Mic OFF stops microphone input resources. It must not mute Saeed's output voice.

Mic ON starts capture and selects the configured STT path.

Supported voice paths include:

- Local Whisper STT using the bundled CI-built Whisper runtime.
- API STT when configured.
- Optional OpenAI Realtime transport.
- Local browser TTS.
- API TTS when configured.

Realtime is a transport/voice path, not automatically the controlling brain. In controller mode, the transcript is passed into Saeed's configured brain/execution path.

The microphone RMS thresholds are configurable. Speech interruption must stop Saeed speaking when real user speech is detected without reacting to tiny noise.

## 3D character

The current authoritative bundled character is:

`assets/Saeed_Test-3D.glb`

The renderer loads the GLB through the bundled Three.js GLTFLoader.

The 3D renderer should remain event-driven/on-demand rather than running an unrestricted permanent render loop. Rendering may temporarily wake for character animation, speech, interaction, resize, or another visual change and should return to idle afterward.

The 3D Status window exposes runtime renderer metrics and state. The status window itself currently refreshes its displayed 3D state periodically; this is a UI monitoring operation and should not be confused with a permanent 3D render loop.

Selected external characters are persisted under Electron `userData` and must not overwrite the bundled default GLB.

## Windows and UI

### Character

- Permanent Saeed surface.
- Three.js/WebGL character.
- Dragging support.
- Double-click opens Chat.
- Direct microphone control.
- Character size and character selection controls.

### Secondary windows

- Chat.
- Status.
- Performance.
- 3D Status.
- Settings.
- Transient update UI.
- Independent task notifications.

Closing a secondary window must not start or keep unnecessary microphone, STT, TTS, Realtime, Agent or polling services alive.

## Tools

There is one authoritative runtime registry:

`src/tools/registry.js`

| Domain | Owner |
|---|---|
| Registry, schemas, permissions, dispatch | `src/tools/registry.js` |
| Files | `src/tools/files.js` |
| PDF / Excel / documents | `src/tools/office.js` |
| Windows / system / applications | `src/tools/windows.js` + `src/computer.js` |
| Web / search | `src/tools/web.js` |
| Screen / mouse / keyboard | `src/tools/interaction.js` + `src/computer.js` |
| Tasks / memory | `src/tools/memory-tasks.js` |
| Deterministic verification | `src/tools/verification.js` |
| Agent reasoning/tool loop | `src/agent.js` |

`src/tools.js` and `src/agent-tools/index.js` are compatibility facades. They are not new homes for capabilities.

Do not create duplicate tool implementations.

### Tool efficiency rules

1. Prefer a direct structured operation over GUI automation.
2. Use the smallest sufficient tool.
3. Do not call verification merely because a tool finished successfully.
4. Read only the amount of file/document data required.
5. Use bounded results for directory, Excel, web and process queries.
6. Load heavy optional libraries only when their capability is requested.
7. Do not create persistent workers for one-shot tasks.
8. Parallelize only genuinely independent read-only operations.
9. Stop the task as soon as the requested result is complete.
10. Never hide a failed tool call behind a success message.

## Permissions

Permissions are centralized in the Tool Registry.

Permission categories include files, applications, system, network, screen, mouse/keyboard, microphone, tasks/memory, credentials and destructive actions.

Sensitive/destructive actions are confirmation-gated. Normal safe actions should execute without unnecessary prompts.

Electron media permission is explicitly handled for the user-controlled microphone; unrelated Chromium permissions must not be granted broadly.

## Persistence

User/runtime state belongs in Electron `userData`, not in `src/` or `assets/`.

Important runtime state includes:

- selected character data;
- application settings;
- tasks;
- persistent memory;
- resumable task state.

Bundled assets remain immutable application resources.

## Diagnostics and performance monitoring

Electron application metrics are collected through the main process.

Performance monitoring must remain demand-driven. A status/performance view may sample metrics while that view is open, but closed windows must not leave unnecessary monitoring timers running.

Diagnostics are live runtime state, not a reason to create permanent logging/storage infrastructure.

CI reports are build artifacts, not persistent application data.

## Current repository layout

```
Saeed-V2.0/
├── assets/
│   ├── Saeed_Test-3D.glb
│   └── saeed.png
├── src/
│   ├── main.js
│   ├── preload.js
│   ├── renderer.js
│   ├── agent.js
│   ├── brain-levels.js
│   ├── local-brain.js
│   ├── task-router.js
│   ├── task-planner.js
│   ├── task-engine.js
│   ├── computer.js
│   ├── memory.js
│   ├── realtime.js
│   ├── character-voice.js
│   ├── avatar.js
│   ├── tools/
│   │   ├── registry.js
│   │   ├── files.js
│   │   ├── office.js
│   │   ├── windows.js
│   │   ├── web.js
│   │   ├── interaction.js
│   │   ├── memory-tasks.js
│   │   └── verification.js
│   ├── autonomous/
│   └── UI/status modules
├── build/
├── tests/
├── package.json
├── VERSION
└── .github/workflows/build-windows-electron.yml
```

## Packaging and dependencies

Current product version:

- `VERSION`: **4.0**
- `package.json`: **4.0.0**
- Electron: **38.8.6**
- Three.js: **0.180.0**
- electron-builder: **26.15.3**
- Whisper runtime/model are generated/downloaded during the Windows CI build.

The packaged application currently includes the Offline Whisper runtime and model through Electron Builder `extraResources`. This is an important contributor to installed/package size and should be reconsidered before optimizing other areas.

There is currently no committed `package-lock.json`; dependency installation uses `npm install`. Reproducible dependency locking should be considered before release hardening.

The Windows ICO is generated from `assets/saeed.png` during the official CI build. A local installer build may therefore require the same icon-generation preparation used by CI.

## Build and verification

There is one Windows workflow:

`.github/workflows/build-windows-electron.yml`

Workflow name:

**Saeed AI — Windows Build**

The workflow currently performs:

1. exact-commit checkout;
2. VERSION/package identity validation;
3. repository structure validation;
4. dependency installation;
5. JavaScript/tests;
6. comprehensive source validation;
7. Windows ICO generation;
8. bundled Offline Whisper build and synthetic speech test;
9. installer build;
10. packaged Whisper/runtime asset checks;
11. updater metadata validation;
12. installer/release-output validation;
13. artifact upload.

The workflow's **application runtime smoke/resource test is currently disabled**. It writes reports explicitly stating that GLB, brain, Chat, TTS, microphone and runtime resource checks were disabled. Therefore a successful CI build must not be interpreted as proof that the packaged application was fully exercised.

Isolated 3D CI testing is intentionally not part of the workflow.

Normal push/manual builds do not necessarily publish a GitHub Release. Official release publication is gated by the workflow's release conditions and matching VERSION/tag rules.

## Tests

`npm test` performs syntax validation plus:

- `tests/task-architecture.js`
- `tests/task-real.js`

The tests cover routing, planning, task lifecycle, destructive confirmation and real local file operations.

A CI failure must be investigated against the exact commit that the workflow checked out. Do not assume that a failure from an older commit describes the current `main`.

## Development

Requirements:

- Windows.
- Node.js 22.14.0 or compatible Node 22.
- npm.

Commands:

```text
npm install
npm start
npm test
npm run build
npm run dist
```

The CI workflow is the authoritative Windows packaging path because it also prepares the icon and builds the bundled Whisper runtime.

## Performance principles

Saeed should optimize in this order:

1. **Do not run work that is not needed.**
2. **Do not load code/resources before they are needed.**
3. **Do not keep windows, timers, audio streams, WebSockets or workers alive when their feature is inactive.**
4. **Do not duplicate data or monitoring.**
5. **Do not send large context/results to an API when a small structured result is enough.**
6. **Do not use GUI automation when a direct Windows/file/API operation exists.**
7. **Do not optimize by arbitrarily reducing functionality; measure the actual bottleneck first.**
8. **Measure CPU, RAM, startup time, installed size and task latency before and after each major optimization.**

## Architecture change rule

Before changing Saeed:

1. Read this README.
2. Find the authoritative owner of the capability.
3. Read that owner and its directly related modules.
4. Reuse existing interfaces.
5. Do not create duplicate runtimes.
6. Keep heavy dependencies lazy.
7. Keep user/runtime state outside the repository.
8. Update this README when architecture or ownership changes.
9. Do not modify unrelated systems while fixing one specific problem.
