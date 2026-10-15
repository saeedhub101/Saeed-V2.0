# Saeed V2.0 — Documentation and Architecture Index

**Purpose:** one authoritative map for product and architecture documentation. Keep this index short; implementation details belong in the owning contract, not duplicated across plans.

## Authority order

1. **Architecture contracts** define intended ownership, behavior and invariants.
2. **Source code** is the implementation truth. If code and documentation differ, identify and resolve the discrepancy; do not assume either is correct without inspection.
3. **Automated results** prove only the checks they actually execute.
4. **Packaged Windows runtime evidence** determines whether end-user behavior and release acceptance have been demonstrated.
5. README.md is the entry point; ROADMAP.md tracks the product baseline and remaining acceptance work. Neither overrides a domain contract.

## Domain owners

| Document | Authority |
|---|---|
| Character_Architecture.md | Character intent, state, mood, rig, motion, GLB clips and Character/Engine boundary |
| CHARACTER_BEHAVIOR_ENGINE.md | Autonomous behavior policy, event arbitration, idle cadence and behavior acceptance |
| Engine_Architecture.md | Three.js, rendering, camera, model/GLB loading and low-level 3D resources |
| Lifecycle_Architecture.md | Startup, lazy loading, parent/child lifetimes, hide/show, shutdown and resource release |
| Voice_Conversation_Architecture.md | Chat/Mic parity, shared conversation, STT/TTS, audio providers and mute semantics |
| Core_Architecture.md | Brain lifecycle, local-first routing, model/API escalation, tools and capabilities |
| Security_Architecture.md | Permissions, credentials, trust boundaries and consequential actions |
| Naming_and_Ownership_Architecture.md | Canonical runtime owners, file naming and anti-duplication rules |
| Testing_and_Acceptance_Architecture.md | Test evidence, packaged-runtime acceptance and release gates |
| ROADMAP.md | Current baseline, outstanding validation and release sequence |

## Focused feature guides

- docs/تعليمات ربط الانيميشن.md — Arabic trace of the motion pipeline, ownership boundaries and GLB semantic-intent mapping.
- src/learning/README.md — learned-skill data format, ToolRegistry routing and safety boundaries.

These guides explain feature workflows; they do not override the architecture contracts above.

`Character_Architecture.md` also contains the consolidated engine, autonomous behavior, GLB intent mapping and 3D resource rules. `Core_Architecture.md` contains the security and trust-boundary rules. Canonical runtime names and anti-duplication rules are summarized here.

## Change protocol

- Update the contract that owns the behavior; update this index only when ownership or document structure changes.
- Avoid parallel plans, dated progress diaries, duplicate roadmaps and copied status blocks. Closed implementation plans should be removed or summarized in the roadmap, not left looking active.
- Mark work as **implemented**, **automatically checked**, or **verified in the packaged app** accurately; these states are not interchangeable.
- Keep runtime ownership aligned with the code. Startup should not eagerly activate Chat, Brain, STT, tools or optional add-ons.
- Keep the application cohesive: split modules only where ownership or lifecycle becomes clearer, not for file-count reduction alone.
- Product changes target main. Do not add Rust/Cargo checks to this JavaScript/Node.js/Electron application.

## Canonical naming and ownership rules

- Electron composition: `src/main.js` -> `src/main/runtime.js`; renderer access crosses `src/preload.js`.
- Character runtime namespace: `window.saeedCharacterRuntime`; one `CharacterController`, one owned `AutonomousBehaviorController`, one `CharacterEngine`, and one playback authority.
- Never introduce duplicate global aliases such as `window.saeedAvatar`, `window.saeedCharacterController`, `window.saeedAvatarLoadData`, or independent global references to character subsystems.
- Character UI sends semantic commands; it does not directly manipulate GLB bones. The Engine owns technical 3D resources, not behavior decisions.
- Keep canonical ownership aligned with actual imports and runtime wiring; migrate/remove legacy aliases only after checking references.

