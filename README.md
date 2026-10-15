# Saeed AI

Saeed is a Windows desktop AI companion with a persistent 3D character, optional chat and microphone, a shared Brain/conversation, tools, learning and add-ons.

## Current product map

- **Application shell:** `src/main.js`, `src/main/runtime.js`; window/tray composition in `src/main/application/`.
- **Renderer security boundary:** `src/preload.js`; renderer code does not access privileged Electron APIs directly.
- **Character Settings:** the window titled **Character Setting** is loaded from `src/character-studio.html` by `src/main/application/window-manager.js`. This is the single authoring surface for GLB selection, rig/bones, rest pose, motion/keyframes, face/visemes, mesh visibility and accessories.
- **3D runtime:** `src/character/CharacterEngine.js` owns Three.js/GLB/rendering; `CharacterController.js` owns semantic behavior and motion coordination.
- **Voice/conversation:** `src/main/voice/`, `src/renderer/voice/`, `src/main/brain/`, `src/main/conversation/`.
- **Learning and add-ons:** `src/learning/`, `src/addons/`.
- **Verification:** `npm test` runs `scripts/run-all-tests.js`; packaged acceptance lives in `src/main/ci/` and the Windows workflow.

## Product invariants

Startup should create only the tray/application shell and character display. Chat, Brain, STT, TTS and optional features activate lazily. Mic defaults OFF. Chat and Mic use the same conversation. Muting stops audible output without silently switching off listening. Hiding Saeed stops character/voice resources while keeping the tray available. Keep one authoritative owner for each feature and avoid tiny files without a concrete maintenance benefit.

## Development

Use branch `main`, install with `npm ci`, run `npm test`, and use the existing Electron Builder/Windows workflow. A green workflow or static test alone is not proof that the packaged Windows application works. See [ARCHITECTURE.md](ARCHITECTURE.md), [TESTING.md](TESTING.md), and [RELEASE.md](RELEASE.md).
