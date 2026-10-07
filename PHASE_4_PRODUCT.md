# Saeed V2.0 — Phase 4: Product & Release

**Status:** Planned  
**Type:** Product-development phase

## Goal

Turn the completed runtime and intelligence layers into a polished, reliable Windows product.

## 1. User experience

Complete:
- Character controls;
- Chat;
- Voice controls;
- bubble/presentation;
- Motion/Animation Control;
- Character Preparation/Rigging;
- settings;
- provider management;
- add-on management;
- learning and memory controls;
- diagnostics.

## 2. Product workflows

A new user must be able to:
1. launch Saeed;
2. see the Character;
3. configure voice/providers;
4. talk through microphone or Chat;
5. receive spoken and visual responses;
6. interact with the Character;
7. prepare or replace a Character;
8. enable capabilities;
9. manage permissions;
10. inspect health/diagnostics.

## 3. Reliability

Test and recover from:
- invalid GLB;
- provider timeout;
- provider unavailable;
- STT failure;
- TTS failure;
- realtime failure;
- tool denial;
- tool execution failure;
- plugin crash;
- cancellation;
- shutdown during active work;
- stale callbacks.

Conversation state must survive recoverable feature failures.

## 4. Performance

Measure:
- startup;
- tray-only memory;
- Character idle memory;
- CPU/GPU;
- render activity;
- post-hide resource recovery;
- provider connections;
- child processes;
- add-on resources.

Use the budgets defined by Lifecycle_Architecture.md. Measurements, not assumptions, determine release readiness.

## 5. Packaging and updates

Complete:
- Windows installer;
- first-run behavior;
- packaged asset validation;
- update flow;
- safe shutdown;
- single-instance behavior;
- release metadata.

Automatic CI builds remain disabled unless deliberately enabled later.

## 6. Release gates

Release requires:
- architecture verification;
- static verification;
- unit tests;
- integration tests;
- packaged-runtime tests;
- E2E tests;
- security checks;
- performance checks;
- fault-injection checks.

## Exit criteria

Saeed V2.0 is complete only when the packaged product passes the acceptance contract and the core user journeys work repeatedly, not merely once in development.