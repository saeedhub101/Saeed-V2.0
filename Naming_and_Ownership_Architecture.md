# Saeed V2.0 Naming and Ownership Contract

## Canonical Character Runtime
### Current canonical file paths

The verified implementation roots are `src/main/`, `src/renderer/`, `src/character/`, `src/tools/`, `src/addons/`, and `src/learning/`. The Electron entry is `src/main.js`, which loads `src/main/runtime.js`; the renderer-facing API is `src/preload.js`; character 3D execution is `src/character/CharacterEngine.js`; character orchestration is `src/character/CharacterController.js`; character authoring UI is `src/character-studio.html`; and the add-on and learning pages are `src/addons/window.html` and `src/learning/window.html`.

Use the actual import graph and the foundation contract as the source of truth for future path changes. Do not rename or remove a required subsystem just to make it match a stale document.


There is exactly one renderer-side character runtime namespace:

`window.saeedCharacterRuntime`

It contains only runtime-owned entry points:

- `engine` — the technical 3D/GLB/Three.js engine.
- `controller` — the single CharacterController command boundary.
- `load(data,generation)` — atomic character asset loading entry point.
- `pendingLoad` — one pending asset request while another load is active.

Autonomous behavior is owned by the controller through exactly one:

`controller.autonomous` → `AutonomousBehaviorController`

## Canonical names

| Responsibility | Canonical name |
|---|---|
| Character runtime | `CharacterRuntime` / `saeedCharacterRuntime` |
| Character behavior boundary | `CharacterController` |
| Autonomous behavior | `AutonomousBehaviorController` |
| 3D technical layer | `CharacterEngine` |
| Rig mapping | `CharacterRetargeter` / `AutoRigMapper` |
| Animation playback | `AnimationController` |
| Motion definitions | `MotionRegistry` / `motions.js` |
| Face | `FaceController` |
| Fingers | `FingerController` |
| Profile persistence | `CharacterProfileStore` |

## Forbidden legacy names

Do not introduce or restore:

- `window.saeedAvatar`
- `window.saeedCharacterController`
- `window.saeedAvatarLoadData`
- `window.saeedCharacterBehavior`
- `window.saeedAnimationController`
- `window.__saeedPendingCharacterData`
- multiple aliases for the same CharacterController
- renderer globals that expose individual character subsystems as independent authorities

## Ownership rules

1. CharacterController is the only public character behavior boundary.
2. AutonomousBehaviorController is the only autonomous scheduler/policy owner.
3. CharacterEngine renders and manipulates technical 3D resources; it does not decide behavior.
4. Brain/LLM produces semantic intent only.
5. UI code sends semantic commands/events; it does not manipulate bones.
6. Character load state has one owner and one generation counter.
7. A replacement GLB is atomic: candidate failure never destroys the current character.
8. Destruction is explicit and invalidates timers, animation frames, asset loads and callbacks.
9. A small feature must not create a new global object when it belongs to an existing runtime owner.
10. Compatibility aliases are temporary migration tools only and must not become new architecture.

## Merlin-derived behavior principles

The runtime follows the useful proven Merlin pattern:

- one central animation/behavior brain
- explicit intent/state
- mood and energy influence probability, not hard scripts
- recent-motion suppression
- cooldown/throttling
- user interaction wins
- sleep/wake lifecycle
- autonomous events can be dropped instead of queued
- character remains alive without the LLM
- the LLM says what should happen; the character runtime decides how and when it moves

Merlin remains a reference project only. Its source is not modified and its implementation is not imported wholesale.


## Canonical Source Tree

```text
src/
├── main/                    # Electron main-process application
│   ├── application/         # application lifecycle and window coordination
│   ├── automation/          # local Windows automation
│   ├── brain/               # reasoning and model execution
│   ├── character/           # main-process character window/store integration
│   ├── conversation/        # shared conversation agent/history
│   ├── ipc/                 # main ↔ renderer IPC registration
│   ├── services/            # reusable application services
│   ├── voice/               # main-process voice lifecycle
│   └── runtime.js           # main-process composition/runtime entry
│
├── character/               # character domain + 3D runtime
├── renderer/                # renderer-only UI adapters
│   ├── character.html
│   └── voice/voice-client.js
│
├── tools/                   # ONE authoritative tool system
│   ├── registry.js
│   └── domain tools...
│
├── addons/                  # optional extension providers
└── learning/                # learned skills UI/runtime
```

### Boundary rule

A new programmer should be able to answer "where does this belong?" from the folder alone:

- Electron lifecycle/window/IPC → `main/`
- 3D character behavior/rig/motion → `character/`
- renderer presentation/input → `renderer/`
- executable agent capabilities → `tools/`
- optional third-party extensions → `addons/`
- learned workflows → `learning/`

There is intentionally **no `core/` directory**. "Core" is a conceptual term in documentation, not a source-code dumping ground.

There is intentionally **no `agent-tools/` directory**. Agent tools are tools and belong to the single `tools/` system.
