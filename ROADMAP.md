# Saeed V2.0 — Complete Product Roadmap

**Status:** Active execution roadmap  
**Authority:** Planning only. Authoritative behavior remains in the architecture documents.

## Product goal

Build and release Saeed V2.0 as a complete Windows AI desktop companion: a persistent 3D character with shared Chat/Voice conversation, autonomous behavior, Brain, tools, permissions, computer interaction, learning, add-ons, diagnostics, and a production-ready packaged application.

## Phase model

**Execution status:** Phases 1, 2, 3, and 4 are all active parts of the current product-development roadmap. Their active status does not mean every acceptance criterion is complete; completion must be recorded only when the corresponding implementation and test evidence exists.


The four phases are **product-development phases**. They are not four repair phases.

| Phase | Product milestone | Main outcome |
|---|---|---|
| **Phase 1 — Foundation** | Make the existing foundation coherent and usable | Clean architecture, ownership, IPC, lifecycle contracts, baseline verification |
| **Phase 2 — Character & Realtime Experience** | Build the living character experience | 3D runtime, rig/retargeting, motion, autonomy, TTS/STT, realtime voice and interaction |
| **Phase 3 — Intelligence & Capabilities** | Build Saeed's useful intelligence | Brain, shared conversation, tools, permissions, computer/web/files, learning, memory and add-ons |
| **Phase 4 — Product & Release** | Turn the system into the finished product | UX completion, editors, settings, recovery, performance, packaging, E2E and release |

## Phase 1 — Foundation

**Status:** Active — foundation conformance and remaining Phase 1 work are in progress. 

Phase 1 contains the **current repair/conformance work**, but it is not only repair.

### Build
- canonical repository structure;
- clear ownership boundaries;
- namespaced preload/IPC;
- lifecycle foundation;
- architecture contracts;
- baseline diagnostics and verification;
- foundation needed by later character and intelligence work.

### Repair scope
Only repair defects that block a coherent foundation or create duplicate ownership.

### Exit
The foundation is internally coherent and statically verifiable. This exit criterion improves confidence in the already-active Phases 2–4; it is not a gate that prevents their work from starting.

## Phase 2 — Character & Realtime Experience

**Status:** Active — current character, GLB, rigging, Rest Pose, animation and realtime voice work is in progress. 

This is the primary character/runtime feature phase and is already active alongside Phases 1, 3, and 4.

### Character
- CharacterEngine;
- CharacterController;
- CharacterRig;
- retargeting;
- GLB preparation;
- capability detection;
- rest-pose correction;
- animation registry;
- motion safety;
- face/eyes/blink/neck/fingers where supported;
- motion editor and runtime control;
- demand-driven rendering.

### Living behavior
- autonomous behavior;
- mood/state/energy;
- idle behavior;
- micro behavior;
- attention behavior;
- user interaction priority;
- sleep/wake;
- natural motion suppression and cooldowns.

### Voice
- TTS lifecycle;
- local/API TTS providers;
- microphone lifecycle;
- STT providers;
- realtime audio;
- interruption/barge-in;
- speaking animation;
- voice/chat continuity;
- visible answer bubble.

### Phase result
Saeed becomes a convincing interactive 3D character that can listen, speak, move and react without requiring the Brain to control physical animation directly.

## Phase 3 — Intelligence & Capabilities

**Status:** Active — current Brain, conversation, tools, permissions, learning and capability work is in progress. 

### Brain
- one Brain per conversation;
- local-first routing;
- provider escalation;
- structured semantic outcomes;
- cancellation;
- stale-result protection;
- context-aware routing.

### Conversation
- one authoritative conversation;
- Chat and Voice as channels;
- persistent history;
- streaming/final-message rules;
- provider independence;
- conversation continuity across runtime lifecycle.

### Tools
- one Tool Registry;
- stable schemas;
- validation;
- permission;
- execution;
- verification;
- cancellation;
- result routing.

### Capabilities
- computer interaction;
- web;
- files;
- image/screen understanding;
- memory;
- learning;
- task execution;
- future capability providers.

### Add-ons
- capability catalog;
- explicit permission;
- load/unload lifecycle;
- provider isolation;
- credential management;
- failure isolation.

### Phase result
Saeed can understand a request, decide what is needed, safely use capabilities, verify the result and communicate it through Chat or Voice.

## Phase 4 — Product & Release

**Status:** Active — current UX, reliability, packaging and release-readiness work is in progress. 

### Product UX
- polished character controls;
- Chat;
- Voice controls;
- Motion/Animation Control;
- Character Preparation/Rigging;
- settings;
- provider management;
- add-on management;
- learning management;
- diagnostics;
- recovery UI.

### Reliability
- fault injection;
- provider failure recovery;
- invalid asset recovery;
- plugin failure isolation;
- cancellation;
- shutdown during work;
- stale event rejection;
- conversation preservation.

### Performance
Measure and optimize:
- startup;
- tray-only resources;
- Character idle resources;
- CPU/GPU;
- render activity;
- memory;
- provider connections;
- child processes;
- add-on resources.

### Release
- Windows installer;
- packaged runtime;
- update mechanism;
- E2E verification;
- security verification;
- performance verification;
- release acceptance.

### Final result
Saeed V2.0 is a complete, packaged and verified product rather than a collection of working screens.

## Execution rule

Speed matters. Do not block feature development on cosmetic cleanup.

A defect is repaired immediately when it:
1. breaks the current milestone;
2. creates duplicate ownership;
3. violates a security/lifecycle contract;
4. prevents reliable testing;
5. would force a later architectural rewrite.

Otherwise, keep moving forward and schedule the improvement with the feature that needs it.

## Global dependency

**Foundation → Character/Realtime → Intelligence/Capabilities → Product/Release** (dependency order, not a rule that later phases remain inactive until an earlier phase is fully closed).

Cross-cutting security, lifecycle and verification are implemented with the feature that needs them, not postponed to the end.

## Active cross-phase work added to the roadmap

### Character asset and motion verification

- Verify GLB parsing, typed-array offsets, skeleton discovery, humanoid bone mapping, required/optional rig capabilities, and safe replacement of a working model.
- Verify rest-pose preview, edit, commit, reset, save/load, and runtime reapplication.
- Verify animation clip discovery, playback, generation/editing workflow, retargeting, axis conventions, nested-parent stability, and recovery from invalid clips or rigs.
- Each check must inspect the real runtime state and diagnostic report; static source assertions alone are not acceptance proof.

#### Implementation added — 2026-10-09

- Repaired a malformed ternary in the Character Studio motion-status handler that prevented the module from parsing.
- Added a parser-backed CI script that syntax-checks inline JavaScript and local external scripts referenced by HTML pages; it is included in `npm test` and the manual verification workflow.
- Source parsing was checked after the repair. Runtime acceptance still requires executing the regression suite and inspecting the actual Windows E2E reports.

### Email capability

- Add an optional, permission-controlled email capability: IMAP for receiving/synchronizing and reading messages, POP3 as an alternative retrieval path, SMTP for sending.
- Store credentials only through the established secret/settings boundary; never expose credentials in renderer logs or diagnostics.
- Add account setup, connection status, mailbox listing, message reading, send confirmation, cancellation, timeout/retry handling, and provider-independent tests.

#### Implementation added — 2026-10-09

- Added separate, non-secret per-account server profiles for IMAP, POP3, and SMTP, with validated host/port/TLS settings.
- Added Settings UI controls to save server profiles and test protocol authentication without sending a message.
- Added POP3 message listing and retrieval tools, with message-index validation and dot-stuffing handling.
- Added SMTP authentication verification, socket cleanup, request-cancellation checks, and corrected OAuth SASL control-byte encoding.
- Added local protocol regression coverage for POP3, SMTP, server-profile persistence, command-injection rejection, cancellation, and message redaction. The suite is included in `npm test` and the manual no-build Phase 1–3 verification workflow.

**Acceptance status: pending execution.** Source-level parsing and contract checks are not substitutes for running the regression suite and inspecting its results. Do not mark the email capability or any product phase complete until the manual verification and Windows packaged E2E reports pass.

### Optional microphone transcript label

- Add a tray/taskbar toggle for a small optional label/bubble beneath Saeed.
- When enabled, show the recognized text from the user's microphone input so the user can verify speech-to-text accuracy.
- Persist the toggle, display transcription failures/empty results clearly, and leave microphone capture OFF at startup.

### Add-ons and Learning access

- Verify that tray commands open the existing `src/addons/window.html` and `src/learning/window.html` pages through the current window manager and that page-load failures are reported and covered by E2E checks.
