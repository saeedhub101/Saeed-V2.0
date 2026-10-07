# Saeed V2.0 — Repair Plan

**Status:** Active implementation plan  
**Authority:** Non-authoritative planning document

## Objective

Repair the existing implementation without creating parallel systems. Every repair must extend or remove existing ownership rather than hide complexity in another large runtime file.

## Repair rules

1. Inspect the current owner before creating a module.
2. One responsibility has one owner.
3. Rename ambiguous files before adding more behavior.
4. Remove dead compatibility paths instead of preserving duplicates.
5. Keep renderer code presentation-focused.
6. Keep Electron privileges behind preload/IPC.
7. Keep Brain semantic.
8. Keep Character physical behavior inside Character Runtime.
9. Keep tools behind one Registry and Permission boundary.
10. Add a regression test for every repeatable architectural bug.

## Ordered repair backlog

### R1 — Repository and naming
- Resolve every duplicate/ambiguous directory.
- Resolve agent.js vs conversation-agent.js.
- Remove stale documentation paths.
- Verify imports after every rename.
- Establish canonical naming conventions.

### R2 — Preload and IPC
- Replace broad flat renderer APIs with namespaced APIs.
- Keep privileged operations in main-process owners.
- Ensure every IPC channel has one owner.
- Remove direct renderer access to privileged internals.
- Add IPC contract tests.

### R3 — Application lifecycle
- Verify one Core/Tray lifecycle owner.
- Verify Character Show=create and Hide=destroy.
- Verify Brain 2-minute idle lifecycle.
- Verify stale-event invalidation.
- Verify single-instance behavior.
- Verify idempotent shutdown.

### R4 — Character runtime
- Verify one CharacterController.
- Verify one AutonomousBehaviorController.
- Keep AnimationController as playback layer.
- Verify autonomous behavior can run without Brain/LLM.
- Verify user interaction wins over autonomy.
- Verify recent-motion suppression.
- Verify demand-driven rendering.

### R5 — Engine and assets
- Verify CharacterEngine owns technical 3D resources only.
- Verify atomic GLB replacement.
- Verify logical-joint retargeting.
- Verify optional capability degradation.
- Verify complete disposal.

### R6 — Voice and conversation
- Verify TTS READY/IDLE while visible and unmuted.
- Verify mute is output-only.
- Verify Mic OFF destroys capture/VAD/STT.
- Verify Realtime exclusivity.
- Verify one Agent/history/Brain.
- Verify Chat↔Voice continuity.

### R7 — Brain, tools and security
- Verify local-first routing.
- Verify reassessment after failed local routes.
- Verify one Tool Registry.
- Verify permission before side effects.
- Verify cancellation and verification.
- Verify LLM is never authorization.
- Verify plugin isolation.

### R8 — Runtime proof
- Run all static contracts.
- Run unit/integration tests.
- Build manually.
- Install packaged application.
- Run lifecycle and fault-injection acceptance.
- Measure memory/render/resource behavior.

## Definition of repaired

A repair is complete only when code, documentation, and verification agree. Compilation alone is never sufficient.
