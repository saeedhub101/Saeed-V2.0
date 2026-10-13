# Saeed V2.0 — Completion Roadmap (Two Phases)

**Status date:** 2026-10-13  
**Branch:** `main` only  
**Current checkpoint:** [GitHub Issue #9](https://github.com/saeedhub101/Saeed-V2.0/issues/9)

This roadmap is the execution plan, not a claim that any listed feature is already complete. A feature is complete only when implementation, diagnostics, and observable behavior support that conclusion. A green CI job alone is not proof that the full product works.

## Phase 1 — Complete and integrate the product

**Goal:** Finish the actual user-facing capabilities and remove known integration defects before release acceptance.

- **Task engine and AI brain:** preserve durable task state; never report success after persistence errors, failed/incomplete steps, weak verification evidence, or uncertain external outcomes. Make cancellation, timeouts, stale responses, recovery, and diagnostics consistent. Never automatically replay an external action whose result is uncertain.
- **3D character:** reliably load and display valid GLB meshes even when rigs are incomplete; map available bones without false zero-slot reports; establish clear ownership between CharacterEngine, CharacterController, and CharacterRig; repair Character Studio interactions and live preview; persist rig mappings/rest pose; support motion creation/edit/replay and available face/eye/finger behaviors without axis corruption.
- **Voice and conversation:** one shared chat/microphone history and brain; mic defaults off; independent mute and visibility lifecycle; robust STT/TTS/realtime provider selection, cancellation, interruption, cleanup, and visible errors.
- **Memory and learning:** durable recall/update/forget behavior, user controls, stale-record handling, and cancellation-aware skill execution.
- **Tools, MCP, add-ons, and security:** central tool registry; validated arguments/results; explicit permissions; correct MCP timeout/cancel handling; secret protection; add-on lifecycle and isolation; email sends require explicit approval.
- **Product UI and distribution foundations:** finish settings, diagnostics, character/voice/provider/memory/add-on controls, first-run setup, backups/restore, updater and installer resource packaging; measure idle and hidden-mode resource use.
- **Implementation rule:** fix the underlying behavior, not just a source-pattern assertion. Keep required `npm test`, Electron validation, Windows installer checks, and build automation. Do not spend the phase merely adding tests.

**Phase 1 exit conditions**
1. The key product paths above are implemented and integrated with actionable diagnostics.
2. Regression checks cover previously fixed defects, and `npm test` passes without hidden failures or ignored exit codes.
3. There are no known critical startup, task-integrity, character-loading, voice lifecycle, persistence, or packaging blockers.
4. Remaining limitations are explicit rather than silently treated as success.

## Phase 2 — Packaged Windows acceptance and release

**Goal:** Prove the installed/packaged product works, then make the workflow enforce that proof.

- Keep automatic builds on pushes to `main` and manual `workflow_dispatch`; retain essential test, Electron, and installer validation.
- Build the actual Windows NSIS installer and unpacked app; inspect required packaged resources, executable metadata, updater files, and third-party notices.
- Install and launch the packaged application in a clean Windows test profile. Exercise startup, tray show/hide/quit, chat, microphone default-off, mute, provider/error paths, task planning/execution/verification/recovery, memory, file/web tools, add-on permission boundaries, and clean shutdown.
- Exercise the 3D path with the real bundled GLB: mesh visible, rig mapping counts, partial-rig behavior, bone editing, save/read-back of rest pose across a full process restart, motion playback/editing, and diagnostics for unavailable assets or controls.
- Test voice/STT/TTS using deterministic offline/fake-provider cases where credentials or network services are unavailable; separately run live provider smoke tests only when authorized credentials are present. Never treat a skipped provider check as a pass.
- Produce machine-readable per-check reports containing `passed`, actual observed values, logs, and failure details. Missing reports, missing checks, timeouts, crashes, or any failed required subcheck must fail the workflow. Do not infer success from job color alone.
- Upload the installer, unpacked-package evidence, test reports, logs, and diagnostics as artifacts. Publish an official release only after all required packaged acceptance checks pass.

**Phase 2 exit conditions**
1. The packaged EXE/installer launches and the required real journeys pass on Windows.
2. Every mandatory component has explicit pass/fail evidence; skipped or unverified checks are not counted as passed.
3. The full acceptance reports and logs are attached to the run, and the workflow fails closed on missing evidence.
4. The release is published only from the verified commit and artifacts.

## Operating constraints

- Work on `main` only; do not create branches.
- Existing Markdown documents must be preserved. This roadmap is a new file; update existing docs only when needed to keep them accurate.
- Do not report overall completion until Phase 1 and Phase 2 exit conditions are satisfied.
- Check current repository state and workflow logs before each substantial change. Treat a green build as one piece of evidence, not the final acceptance verdict.
