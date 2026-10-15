# Saeed V2.0 — Architecture and Documentation Index

This index defines document ownership. Keep the documentation set small and avoid duplicate plans, historical status diaries, or copied contracts.

## Authority and evidence

1. Domain architecture documents define intended ownership, invariants and behavior.
2. Source code is the implementation truth; resolve discrepancies rather than assuming the docs or code are correct.
3. Static checks and unit tests prove only the specific properties they execute.
4. Packaged Windows runtime evidence is required to claim end-user behavior and release readiness.
5. README.md is the project entry point. ROADMAP.md records the current baseline and remaining acceptance work. Neither overrides an architecture contract.

## Domain owners

| Document | Owns |
|---|---|
| Character_Architecture.md | Character intent, mood, autonomous behavior, motion, rigging, GLB clips, engine boundary and 3D resource rules |
| Lifecycle_Architecture.md | Startup, lazy loading, parent/child lifetimes, hide/show, shutdown and resource release |
| Voice_Conversation_Architecture.md | Chat/Mic parity, shared conversation, STT/TTS, audio providers, mute and realtime semantics |
| Core_Architecture.md | Brain lifecycle, local-first routing, model/API escalation, tools, capabilities, security and trust boundaries |
| Testing_and_Acceptance_Architecture.md | Verification evidence, packaged-runtime acceptance and release gates |
| ROADMAP.md | Current product baseline, remaining acceptance work and release sequence |
| src/learning/README.md | Learning skill data format and the learning feature's local safety contract |

## Canonical ownership rules

- Electron composition: src/main.js -> src/main/runtime.js; renderer access crosses src/preload.js.
- Character runtime namespace: window.saeedCharacterRuntime; one CharacterController, one owned AutonomousBehaviorController, one CharacterEngine, and one animation playback authority.
- Do not introduce duplicate global aliases such as window.saeedAvatar, window.saeedCharacterController or window.saeedAvatarLoadData.
- Character UI sends semantic commands; it does not manipulate GLB bones directly. The Engine owns technical 3D resources, not behavior decisions.
- The Brain/LLM produces untrusted intent, never authorization. Tools and consequential actions pass through the central Tool Registry and permission policy.
- Optional add-ons stay lazy, isolated and subordinate to Core. Credentials use secure storage; logs redact secrets; external providers receive only task-relevant data.
- Keep names aligned with the real import graph. Remove legacy aliases only after checking references and migration paths.

## Change protocol

- Update the owning contract when behavior changes; update this index only when document ownership or structure changes.
- Prefer one concise roadmap over parallel phase plans and dated status documents.
- Distinguish implemented source, automated checks and verified packaged behavior.
- Preserve cohesive modules; split only when ownership or lifecycle becomes clearer.
- Work on main and use the existing Node.js/npm/Electron toolchain. Do not introduce Rust/Cargo checks.
