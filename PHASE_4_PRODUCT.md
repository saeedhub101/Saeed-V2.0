# Saeed V2.0 — Phase 4: Product & Release

**Status:** Active — current product-development phase  
**Type:** Product-development phase

## Goal

Continue integrating, hardening, and validating the runtime and intelligence layers as a polished Windows product. Phase 4 productization is active alongside foundation, runtime, and intelligence work.

## 1. User experience

Complete:
- Character controls;
- Chat;
- Voice controls;
- response bubble/presentation;
- optional user speech-transcript label/bubble, toggleable from the taskbar/tray, showing the recognized text from microphone input so the user can verify STT accuracy;
- Motion/Animation Control;
- Character Preparation/Rigging;
- settings;
- provider management;
- add-on management;
- learning and memory controls;
- diagnostics;
- email account and capability controls with safe credential handling;

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

## Optional microphone transcript label

Provide a taskbar/tray toggle to enable or disable a small label/bubble beneath the character. When enabled, it displays the user's recognized speech text after STT returns it; it must not display raw microphone audio or claim transcription success before text is available. The feature is optional, persists its setting, handles empty/error results visibly, and does not change the existing microphone startup policy (Mic remains OFF at startup).
