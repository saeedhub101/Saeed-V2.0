# Saeed V2.0 — Architecture Documentation Index

**Status:** Authoritative documentation map  
**Version:** 2.0

## 1. Documentation hierarchy

1. Character_Architecture.md — authoritative character behavior and 3D runtime contract.
2. Lifecycle_Architecture.md — authoritative resource lifetime and application lifecycle contract.
3. Voice_Conversation_Architecture.md — authoritative conversation and voice-channel contract.
4. Core_Architecture.md — authoritative application-shell, Brain, routing, tools and capability boundaries.
5. Engine_Architecture.md — authoritative runtime, rendering, asset and engine integration contract.
6. Security_Architecture.md — authoritative permissions, secrets, isolation and trust boundaries.
7. Testing_and_Acceptance_Architecture.md — authoritative verification and release gates.
8. README.md — concise project entry point; it must never contradict the authoritative documents.

## 2. Domain ownership

Character behavior, state, mood, energy, autonomy, motion, rigging, retargeting, face, fingers, bubbles and character capabilities belong to Character_Architecture.md.

Creation, destruction, ownership, shutdown, startup, resource lifetime and idle timeouts belong to Lifecycle_Architecture.md.

Chat, Mic, STT, TTS, Realtime, shared history and provider independence belong to Voice_Conversation_Architecture.md.

Application shell, Brain, local-first routing, LLM escalation, Tool Registry, permissions and plugins belong to Core_Architecture.md.

Three.js/browser runtime, GLB loading, render scheduling, GPU/resource handling and asset integration belong to Engine_Architecture.md.

Secrets, permissions, process isolation, plugin trust, network boundaries, logging and emergency stop belong to Security_Architecture.md.

Verification, regression, runtime tests and release gates belong to Testing_and_Acceptance_Architecture.md.

## 3. Documentation rules

- Architecture documents remain implementation-agnostic unless implementation detail is itself an architectural constraint.
- Do not encode transient filenames as architecture.
- Do not duplicate ownership definitions.
- Every responsibility has one authoritative owner.
- A new subsystem requires an explicit ownership decision.
- A feature is incomplete until its lifecycle, security and test requirements are documented.
- Code must conform to the documents; documentation must not be weakened merely to excuse violating code.

## 4. Change protocol

1. Identify the architectural domain.
2. Read the owning document.
3. Identify affected ownership boundaries.
4. Update the relevant contract.
5. Update affected tests and acceptance requirements.
6. Implement.
7. Run static and runtime verification.
8. Update this index only when a new authoritative document is added.

## 5. Global architectural law

> One responsibility, one owner, one source of truth, one lifecycle.

Saeed V2.0 is one runtime with strict boundaries between Character, Core, Conversation, Engine and optional capabilities.


## 6. Execution planning

The following are non-authoritative implementation plans:

- ROADMAP.md
- REPAIR_PLAN.md
- PHASE_1_FOUNDATION.md
- PHASE_2_RUNTIME.md
- PHASE_3_INTELLIGENCE.md
- PHASE_4_PRODUCT.md

Planning documents may sequence work and identify missing implementation, but they may not weaken or override an authoritative architecture contract.

## 7. Pre-Build Rule

No packaged build is considered meaningful until the active phase's static and architecture checks are addressed. Runtime acceptance remains required according to Testing_and_Acceptance_Architecture.md.
