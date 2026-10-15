# Saeed AI — Current Architecture

Source code and runtime behavior are authoritative. Update this document when ownership changes.

## Process and loading lifecycle

`src/main.js` enters `src/main/runtime.js`, which composes the tray, character window, IPC and feature services. Optional work is lazy-loaded through the shared module loader; Chat/Brain/STT/TTS/add-ons must not all start at application launch.

- Startup: tray + character display.
- Mic ON: start required capture/STT and Brain services.
- Mic OFF: stop capture/STT and release services no longer needed.
- Chat open: keep the shared Brain/conversation active; closing Chat releases Brain when Mic is also OFF.
- Mute: stop audible TTS/output without implicitly turning Mic OFF.
- Hide Saeed: stop character-associated microphone/audio/renderer work; keep the tray. Keep Brain only when an open interaction still needs it.
- Quit: close windows, stop child workers, release timers/processes and exit cleanly.

## Character ownership

- `src/character/CharacterEngine.js`: Three.js scene, camera, GLB loading, render scheduling, mesh/morph/bone operations.
- `src/character/CharacterController.js`: one behavior owner; semantic state, mood, event reactions, motion coordination and autonomous behavior.
- `src/character/AnimationController.js`, `MotionEditor.js`, `CharacterRig.js`, `CharacterRetargeter.js`, `AutoRigMapper.js`: playback/editing, logical rig mapping and retargeting.
- `src/main/character/character-host.js`: main-process window and GLB delivery.
- `src/character/client.js` and the namespaced preload API: renderer-to-controller commands.

The window titled **Character Setting** is the single authoring UI, currently served by `src/character-studio.html`. It owns character selection, rig/bone editing, rest pose, motion/keyframes, face/visemes, mesh visibility and accessories. General Settings and Performance must not duplicate those controls. The obsolete Normalize Rest Pose window must not return.

GLB policy: a visible mesh is required; a complete humanoid skeleton is not. Support partial rigs and mesh-only characters where appropriate. A failed replacement must not destroy the working model. Persist character-specific rest pose, rig mapping, motion and face settings under user data and verify persisted state by reading it back.

## Conversation, voice and tools

Chat and Mic share one Brain and conversation history. Brain/model output is untrusted intent, not permission. Tool execution goes through the central registry and permission policy. Consequential actions require explicit confirmation. Redact secrets from diagnostics and learning records. Optional add-ons stay lazy and subordinate to core capabilities.

## Change rules

1. Follow existing ownership/import paths before adding modules.
2. Keep the character engine independent of Brain/tool code.
3. Map each UI action to implemented preload IPC and main-process handlers.
4. Keep state in user data, not bundled application files.
5. When changing a route, update the window manager, composition, IPC/preload, tests and documentation together.
