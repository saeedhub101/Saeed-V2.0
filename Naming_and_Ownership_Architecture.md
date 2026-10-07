# Saeed V2.0 Naming and Ownership Contract

## Canonical Character Runtime

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
