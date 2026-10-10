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


## Source implementation updates — 2026-10-10

- Email-send confirmation now previews the correct message body and selects Deny as the default action so Enter does not authorize a consequential send accidentally.
- Model requests are cancelled when their conversation becomes stale, and provider responses are bounded by a timeout.


- The API Brain provider selector now lists enabled, installed LLM add-ons, so provider selection is explicit instead of silently replacing the configured API provider. A stale selection reports that the add-on is unavailable rather than falling through to a different provider.

**Verification status:** these are source-level changes only. No test suite or build was run; Phase 4 release criteria remain pending.


## Source implementation updates — 2026-10-10 (continued)

- Character profile writes now read the saved profile back from persistent storage and throw an explicit error if the write cannot be verified.
- Rest-pose saving now verifies the persisted profile by loading it again from storage, including its retry path, instead of trusting only the object returned by the save call.
- Added static acceptance contracts for both persistence guarantees. These contracts have been authored but have **not** been run; no tests or builds were started.


## Source implementation updates — 2026-10-10 (continued)

- Rest-pose snapshots now include each bone's local position in addition to Euler/quaternion rotation. Loading a saved profile and resetting to the saved rest pose restore those positions when present, while old profiles without position data remain readable.
- Save verification now compares the persisted position components as well as rotation values.
- A static acceptance contract now requires position capture, restore, and persistence verification. Runtime position-editing acceptance remains pending.


## Source implementation updates — 2026-10-10 (continued)

- The packaged release gate now includes a two-process rest-pose persistence scenario: the first EXE process saves a real bone's position and rotation, exits, and a fresh EXE process verifies the restored transform and persisted rest-pose baseline before cleanup.
- The current acceptance runner requires both the in-process position save/reset scenario and the fresh-process restart scenario. These checks are implemented but remain unexecuted; no tests or builds were started.


- The Rest Pose Editor now exposes local bone-position fields alongside rotation controls. Position reads and writes use the actual GLB bone transforms, and direct position editing is allowed even before logical humanoid slots are fully mapped.
- The new two-process restart acceptance verifies that a bone's saved local position and rotation survive closing and relaunching the packaged EXE. It then restores the original transform and profile state. This acceptance is authored only and has not been run.


## Verification-status correction — 2026-10-10

No test suite or Windows build was manually launched during this work. The repository initially still had a push trigger on the Windows acceptance/build workflow, so GitHub Actions automatically started runs as source commits were pushed; superseded runs were cancelled and one run ended in failure. That run has not been treated as product validation. The workflow has since been returned to **manual-only workflow_dispatch**, with no automatic push trigger. All new acceptance checks remain unverified until deliberately run later.
