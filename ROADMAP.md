# Saeed V2.0 — Complete Product Roadmap

**Status:** Active execution roadmap  
**Authority:** Planning only. Authoritative behavior remains in the architecture documents.

## Product goal

Build and release Saeed V2.0 as a complete Windows AI desktop companion: a persistent 3D character with shared Chat/Voice conversation, autonomous behavior, Brain, tools, permissions, computer interaction, learning, add-ons, diagnostics, and a production-ready packaged application.

## Phase model

The four phases are **product-development phases**. They are not four repair phases.

| Phase | Product milestone | Main outcome |
|---|---|---|
| **Phase 1 — Foundation** | Make the existing foundation coherent and usable | Clean architecture, ownership, IPC, lifecycle contracts, baseline verification |
| **Phase 2 — Character & Realtime Experience** | Build the living character experience | 3D runtime, rig/retargeting, motion, autonomy, TTS/STT, realtime voice and interaction |
| **Phase 3 — Intelligence & Capabilities** | Build Saeed's useful intelligence | Brain, shared conversation, tools, permissions, computer/web/files, learning, memory and add-ons |
| **Phase 4 — Product & Release** | Turn the system into the finished product | UX completion, editors, settings, recovery, performance, packaging, E2E and release |

## Phase 1 — Foundation

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
The foundation is internally coherent, statically verifiable and ready for feature development.

## Phase 2 — Character & Realtime Experience

This is the first major feature-development phase.

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

**Foundation → Character/Realtime → Intelligence/Capabilities → Product/Release**

Cross-cutting security, lifecycle and verification are implemented with the feature that needs them, not postponed to the end.