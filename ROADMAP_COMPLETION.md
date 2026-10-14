## Current implementation inventory — 2026-10-14

**تم الانتهاء من التنفيذ البرمجي** for the Brain/task engine, shared Chat/Voice history, tool/permission registry, local/cloud provider routing, persistent user facts and query-relevant memory retrieval, add-on/MCP integration, Windows automation and document tools, voice mute/mic lifecycle, GLB character loading and rig mapping, rest-pose persistence, motion editing/playback, behavior settings, backup/restore, and updater foundations. Do not rebuild these systems merely because older items below describe them as work to do. Fix concrete defects in the existing implementation. Current source fixes include the renderer voice diagnostic bridge, query-relevant memory context, and mute-state persistence before agent initialization. **Realtime implementation is explicitly out of scope for these changes and remains unchanged.** Add-on process isolation and phoneme-timed lip-sync remain real enhancement areas; they must not be labelled completed until implemented.

# Saeed V2.0 — Completion Roadmap (Two Phases)

**Status date:** 2026-10-13  
**Branch:** `main` only  
**Current checkpoint:** [GitHub Issue #9](https://github.com/saeedhub101/Saeed-V2.0/issues/9)

This roadmap is the execution plan, not a claim that any listed feature is already complete. A feature is complete only when implementation, diagnostics, and observable behavior support that conclusion. A green CI job alone is not proof that the full product works.

## Phase 1 — Complete and integrate the product

**Goal:** Finish the actual user-facing capabilities and remove known integration defects before release acceptance.

- **Task engine and AI brain — تم الانتهاء من البنية الأساسية برمجيًا؛ بقي تحسين محدد:** durable task runs, cancellation, stale-result suppression, recovery, diagnostics, and no automatic replay are implemented. Do not rebuild them. Goal-specific verification remains an enhancement; completion must not rely only on any read-only result after an action.
- **3D character — تم الانتهاء من التنفيذ الأساسي برمجيًا:** GLB loading, rig mapping, CharacterEngine/CharacterController/CharacterRig ownership, rest-pose persistence, motion creation/edit/playback, and available face/eye behaviors exist. Do not recreate them. Any remaining Character Studio/live-preview or axis issue must be tied to a specific reproducible defect and verified in the packaged app.
- **Voice and conversation — تم الانتهاء من التنفيذ الأساسي برمجيًا:** shared Chat/Voice history and Brain, microphone-off startup, independent mute/visibility lifecycle, STT/TTS provider routing, cancellation/interruption, and diagnostics are present. The renderer diagnostic bridge and mute persistence were corrected. **Realtime behavior is explicitly unchanged**; verify runtime behavior rather than rebuilding this subsystem.
- **Memory and learning — تم الانتهاء من البنية الأساسية برمجيًا:** persistent facts, vector index, recall/search/forget, learned workflows, experience memory, and cancellation-aware execution exist. Query-relevant retrieval is now added to the model context. Do not rebuild memory; improve ranking, deduplication, and stale-record policy only against concrete cases.
- **Tools, MCP, add-ons, and security — تم الانتهاء من البنية الأساسية باستثناء عزل الإضافات:** the central registry, schema validation, permissions, cancellation, secret handling, add-on lifecycle, MCP, and explicit approval for email sending exist. Third-party add-on process isolation remains unfinished and must be implemented as a separate security improvement; do not label it complete.
- **Product UI and distribution foundations — تم الانتهاء من الأساس البرمجي:** settings, diagnostics, character/voice/provider/memory/add-on controls, backup/restore, updater foundations, and Windows packaging workflow exist. First-run polish, packaged resource acceptance, and measured idle/hidden resource use still need evidence; do not rebuild the existing controls.
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
