# Saeed V2.0 — Testing and Acceptance Architecture

**Status:** Authoritative verification contract

## 1. Principle

A build that compiles is not a complete Saeed build.

Acceptance requires architecture conformance, automated tests and installed-runtime verification.

## 2. Verification layers
### Current mandatory character verification

The current test pipeline includes static contracts plus packaged-runtime E2E. The following are required gates, not diagnostic-only suggestions:

- GLB loader and current bundled character path exist; GLB delivery is generation-guarded and invalid replacements must not silently displace a working character.
- A loaded model exposes real skeleton/bone names and a usable rig mapping; an empty mapping or unavailable skeleton is a failed character test.
- Character Studio opens in the packaged application and exposes bones, mapping status, Rest Pose controls, animation controls, and face/finger controls.
- World-axis bone rotation and nested-parent axis stability are exercised by E2E checks against the live character and reset to Rest Pose afterward.
- Rest Pose save/reset/normalization verify persisted state and runtime application, not merely button clicks or success-shaped responses.
- Motion definitions are parsed and validated, saved through the character profile path, listed again, played on the live character, and safely stopped/deleted.
- Add-ons and Learning windows open from the taskbar/tray menu and expose their actual page controls.
- Optional microphone transcript-label state persists across restarts; realtime and local STT results reach the label only when enabled.


### Gate A — Architecture
Verify ownership rules, duplicate-system prevention, semantic boundaries, lifecycle rules, security boundaries, Character independence and provider independence.

### Gate B — Static
Verify syntax, imports, schema consistency, forbidden dependency directions, forbidden duplicate implementations and machine-checkable documentation invariants.

### Gate C — Unit
Verify routing, permission decisions, motion policy, state/mood separation, motion suppression, capability fallback, lifecycle transitions, cancellation and stale-event invalidation.

### Gate D — Integration
Verify Brain → Tool Registry, Voice → shared conversation, Brain → semantic Character events, Character → Engine, Engine → Character failure reporting, plugin → Core isolation and provider replacement.

### Gate E — Runtime
Run the installed application and verify single instance, startup state, Character creation/destruction, Chat lifecycle, Brain lifecycle, Mic lifecycle, TTS lifecycle, Realtime lifecycle, render activation/deactivation, resource disposal, memory behavior and stale callback protection.

### Gate F — End-to-End
Verify text conversation, voice conversation, tool execution, Character reaction, interruption, Hide/Show, provider failure, invalid asset recovery and application shutdown.

## 2.1 Current repository checks and evidence requirements

The following implementation paths and test IDs are active in the current repository. Keep these names synchronized with the code and reports; do not treat a source-token check as proof that the packaged runtime works.

- Static contract runner: `npm test`, including `scripts/ci-animation-health.js`, `scripts/ci-architecture-contract.js`, and `scripts/ci-foundation-contract.js`.
- Actual bundled GLB binary inspection: `scripts/ci-animation-health.js` validates the GLB magic/header, version, declared byte length, JSON chunk bounds and parse, node table, skins, and skin-joint indices. A passing static GLB inspection is necessary but does not replace loading the GLB through Three.js.
- Actual packaged GLB load path: Suite 4 (`scripts/ci-run-packaged-e2e.ps1 -Suite 4`) writes `dist/ci-e2e-glb-character-test.json`; inspect its individual checks and stage trace for load/parse/display success, generation handling, and repeat loads.
- Character Studio startup and live skeleton discovery: `character.studio-open-and-controls` verifies the visible window, loaded character state, mapped rig, and actual bone options.
- Rest Pose save/reset: `character.studio-rest-pose-save-reset`, `character.studio-bone-rotation`, `performance.character-save-rest-pose`, and `character.normalize-humanoid-rest-pose-window` must verify live rotations and saved/restored values, not merely button existence.
- Axis editing: `character.studio-editor-world-axis-rotation` verifies applied values against actual bone rotation; `character.studio-nested-axis-stability` verifies parent/child axes remain stable under nested transforms.
- Animation authoring and playback: `character.studio-animation-any-bone-edit-play`, `character.studio-every-button-and-live-animation`, and `performance.create-edit-delete-motion` verify motion creation, editing, registry state, playback-induced bone changes, and cleanup. The generated motion test must observe an actual change in the loaded character.
- Add-ons and Learning access: `startup.addons-window-opens` and `startup.learning-window-opens` verify the real windows and expected page controls.
- Optional microphone transcript label: `startup.microphone-transcript-label-toggle-and-render` verifies persisted enable/disable IPC and actual recognized-text label rendering.
- Workflow policy: Windows builds are manual-only via `workflow_dispatch`. Do not enable automatic builds to execute tests. Run the manual workflow deliberately, then inspect every required report and each check's actual `pass` value.

A test name or report file existing is not a pass. A workflow's overall green status is not sufficient if any required subcheck failed, timed out, or has missing evidence.

## 3. Character acceptance

The Character must be tested independently of the LLM.

Required tests:

- semantic event produces the correct class of response
- no direct bone command from Brain
- state/mood/motion remain distinct
- recent motion suppression works
- user interaction wins over autonomous events
- autonomous behavior can run without LLM
- sleep/wake works
- missing optional capabilities degrade safely
- invalid GLB does not destroy current valid Character
- Character destruction stops autonomous scheduling
- renderer cannot invent autonomous behavior

## 3.1 Character Studio / Rig / Rest Pose / Animation acceptance

The Character Studio is an independent character-authoring surface and is not part of Performance.

The packaged-runtime acceptance suite must prove real behavior on the loaded GLB, not only the presence of controls or JSON definitions:

1. Open Character Studio independently.
2. Detect a real mapped logical bone and its actual GLB bone.
3. Rotate that actual bone and verify the live transform changes.
4. Save that changed transform as the authoritative Rest Pose.
5. Change the same bone again.
6. Reset the character and verify it returns to the newly saved Rest Pose.
7. Restore the original Rest Pose after the test.
8. Create an animation containing every mapped controllable logical bone.
9. Play the animation and verify every corresponding actual GLB bone changes.
10. Edit the animation keyframe values.
11. Play the edited animation and verify the actual GLB bone transforms change again.
12. Stop and delete the test animation.
13. Verify no test motion remains registered.

A motion definition existing in a registry is not sufficient evidence of animation functionality.

## 4. Conversation acceptance

Verify:

- Chat and Voice share history
- one Brain serves both
- Mic OFF releases voice input resources
- Mute disables audible TTS without deleting text
- TTS can be recreated
- Realtime is optional
- provider changes do not create new histories
- Chat and Voice continue after runtime destruction

## 5. Core/tool acceptance

Verify local-first routing, API escalation, one Tool Registry, validation before execution, permission before side effects, verification after execution, cancellation, plugin isolation and absence of duplicate dispatch paths.

## 6. Security acceptance

Verify secrets are absent from logs, unauthorized tool calls are rejected, plugin permission boundaries work, network boundaries are respected and Emergency Stop works.

## 7. Lifecycle acceptance

Mandatory simulation:

1. Start application.
2. Confirm single Core/Tray.
3. Confirm Character is visible and TTS runtime is READY/IDLE.
4. Confirm MIC/STT/Realtime/Brain are not created merely by startup.
5. Let Character idle.
6. Open Chat and send a message.
7. Close Chat.
8. Turn Mic ON.
9. Speak and receive response.
10. Mute TTS and confirm TTS stops/is destroyed.
11. Continue with text/bubble output.
12. Unmute while Character remains visible and confirm TTS is recreated READY/IDLE.
13. Turn Mic OFF.
14. Hide Character.
15. Confirm Character runtime and Character-owned TTS are destroyed.
16. Wait for Brain idle timeout.
17. Confirm Brain/resources are destroyed.
18. Show Character again.
19. Confirm a fresh Character runtime and TTS READY/IDLE are created.
20. Open Chat.
21. Confirm conversation persistence.
22. Quit through the authoritative application control.
23. Confirm complete shutdown.

## 8. Fault injection

Simulate invalid GLB, provider timeout/disconnect, STT failure, TTS failure, plugin crash, tool denial, tool failure, malformed arguments, window destruction during active request, late callbacks, cancellation and shutdown during active work.

Expected result: controlled failure, not undefined behavior.

## 9. Performance acceptance

Measure startup time, idle CPU/GPU, memory baseline, Character memory, post-destruction memory, child processes, render activity, provider connections and plugin resources.

Targets are defined by Lifecycle and Engine architecture and must be measured in the packaged runtime.

## 10. Release gate

A release is PASS only when architecture, static, unit, integration, packaged-runtime, lifecycle and security gates pass.

A green CI compile is insufficient.

## 11. Regression rule

Every architectural bug should produce a regression test when practical.

A fix without a regression test is incomplete when the failure can recur automatically.

## 12. Final verification law

> Prove ownership, prove behavior, prove lifecycle, prove security, then ship.
