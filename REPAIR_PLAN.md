# Saeed V2.0 — Current Repair Plan

**Status:** Active cross-phase conformance work  
**Scope:** Repair and conformance work that is necessary to establish the foundation.

This document is **not** the Saeed product roadmap. The complete product roadmap is in ROADMAP.md. Repair and conformance work may occur in any active phase when it blocks a current milestone; it must not redefine Phases 2–4 as future-only or replace their product-development scope.

## Repair principle

Repair only what is blocking coherent development, violates an architectural contract, creates duplicate ownership, creates a security/lifecycle problem, or would force a rewrite later.

Do not turn cleanup into an independent multi-phase project.

## Active backlog

### R1 — Repository and naming
- remove legacy duplicate paths;
- establish canonical module names;
- update imports and documentation;
- remove dead compatibility code.

### R2 — Preload / IPC
- namespaced renderer API;
- minimal privileged surface;
- one owner per IPC channel;
- renderer cannot reach privileged main internals directly.

### R3 — Lifecycle
- one Core/Tray owner;
- Character create/destroy boundary;
- Brain idle release;
- TTS lifecycle tied to visible/unmuted Character;
- Mic lifecycle independent from output mute;
- stale-event invalidation;
- idempotent shutdown.

### R4 — Character ownership
- one CharacterController;
- one CharacterEngine;
- one AutonomousBehaviorController;
- AnimationController remains playback-only;
- no renderer-owned autonomous policy;
- no Brain-to-bone path.

### R5 — Tools and security
- one Tool Registry;
- permission before side effects;
- no LLM authorization;
- plugin bypass prevention;
- explicit network boundaries.

### R6 — Verification
- architecture contract;
- static path/name audit;
- preload contract;
- lifecycle contract;
- regression checks for every fixed repeatable bug.

## Completion rule

The repair backlog ends when Phase 1 exits. New defects discovered later are repaired inside the phase that exposes them; they do not create new repair phases.

Compilation alone does not prove a repair.