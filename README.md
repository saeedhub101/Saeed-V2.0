# Saeed V2.0

Saeed is a Windows desktop AI companion built around a persistent 3D character. Chat and microphone are optional interaction surfaces that share one Brain, conversation history, routing and tool execution path.

This file is the concise project entry point. **Domain contracts define architecture; source code defines implementation; packaged runtime evidence defines release readiness.**

## Product baseline

- Startup initializes the application shell/tray and the visible 3D character. Microphone capture, STT, Chat, Brain, tool workers and add-ons are loaded only when needed.
- Chat and Mic share the same Brain and conversation. Mic defaults OFF. Mute disables audible TTS without silently disabling listening or tools.
- The Character is orchestrated through one CharacterController and its owned behavior controller. AnimationController handles playback; CharacterEngine owns Three.js, rendering, camera, GLB and low-level 3D execution.
- GLB animation clips can be mapped to semantic user intents through Character settings. The controller selects a mapped clip when configured and otherwise retains the procedural behavior path.
- Hide/Show, Chat/Mic, mute and animation pause have distinct resource-lifecycle semantics. Follow the lifecycle contract rather than adding independent background services.
- Runtime and user settings belong in Electron userData, not bundled source assets.
- Prefer cohesive modules and explicit ownership. Do not split code into tiny files without a concrete maintenance benefit, or recreate duplicate controllers, registries, Brain routers or voice lifecycles.

## Runtime map

| Responsibility | Primary location |
|---|---|
| Electron entry and composition | src/main.js, src/main/runtime.js |
| Windows, tray and shell controls | src/main/application/ |
| Safe renderer bridge | src/preload.js |
| 3D model, scene and renderer | src/character/CharacterEngine.js |
| Character intent and orchestration | src/character/CharacterController.js |
| Animation playback and retargeting | src/character/AnimationController.js, src/character/CharacterRetargeter.js |
| Character settings and authoring | src/character-studio.html |
| Voice renderer/host | src/renderer/voice/, src/main/voice/ |
| Learning / Teach Mode | src/learning/ |
| Add-ons | src/addons/ |
| Packaged acceptance and diagnostics | src/main/ci-e2e.js, src/main/ci/, .github/workflows/build-windows-electron.yml |

## Documentation map

- [Architecture index](Architecture_Index.md) — source of truth for document ownership and precedence.
- [Character architecture](Character_Architecture.md) — intent, mood, behavior, rigging, motion and GLB integration.
- [Character behavior engine](CHARACTER_BEHAVIOR_ENGINE.md) — autonomous behavior state and acceptance expectations.
- [Animation flow guide](docs/تعليمات%20ربط%20الانيميشن.md) — Arabic implementation trace from semantic command to GLB bones.
- [Engine architecture](Engine_Architecture.md) — rendering, model loading and low-level 3D ownership.
- [Lifecycle architecture](Lifecycle_Architecture.md) — startup, lazy activation, shutdown and resource ownership.
- [Voice and conversation](Voice_Conversation_Architecture.md) — Chat/Mic, STT/TTS, shared conversation and audio providers.
- [Core architecture](Core_Architecture.md) — Brain, routing, tools, permissions and capabilities.
- [Security architecture](Security_Architecture.md) — trust boundaries, secrets and approval requirements.
- [Naming and ownership](Naming_and_Ownership_Architecture.md) — canonical names, owners and module boundaries.
- [Testing and acceptance](Testing_and_Acceptance_Architecture.md) — verification evidence and release gates.
- [Product roadmap](ROADMAP.md) — current product baseline and remaining acceptance work.

## Development and release truth

Use the repository's npm scripts and existing Windows workflow; do not introduce Rust/Cargo checks into this Electron/Node.js project. Keep all changes on main.

A source change, static assertion, successful build, or green workflow alone does not prove that the packaged application works. Release readiness requires the packaged EXE/installer to be exercised on Windows, including real user journeys, persistence, lifecycle/resource release, character behavior and actual UI actions. Record failures honestly and fix them before release. Do not claim a runtime check passed unless its evidence exists.
