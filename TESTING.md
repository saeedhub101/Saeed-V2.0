# Automated Tests and Acceptance

## One command

`npm test` runs `scripts/run-all-tests.js`. The runner executes configured source-contract suites and unit/regression tests, prints each result and exits non-zero if any suite fails or times out. A new test must be added to the runner or it does not gate the build.

## Suite responsibilities

- **UI routes and IPC wiring:** verify visible menu action → runtime composition → window-manager method → existing HTML file, and verify the matching preload/IPC route. Detect duplicated character-authoring UI across Character Settings, general Settings and Performance.
- **Product preflight:** package/version identity, GLB structure/active scene, source syntax, persistence verification, character rig/pose/motion/face/accessory contracts, voice/STT wiring and cancellation/timeouts.
- **Architecture/foundation:** canonical owners, lazy lifecycle boundaries, renderer security, permission policy, tool/credential safety and workflow wiring.
- **Character/animation:** rig mapping, partial-rig support, motion registration/safety, GLB byte handling/candidate validation, diagnostics and render scheduling.
- **Protocol/security and unit regression:** email provider contracts, IPC/security, memory and settings persistence, cancellation races, voice lifecycle, learned skills and module-loader lifecycle.

## Evidence levels

1. Static source contract proves only the exact relationship asserted.
2. Unit/regression test proves the exercised function/condition for the test inputs.
3. Build/package proves the pipeline completed, not that every UI journey works.
4. Packaged Windows acceptance must launch the actual built app/installer and verify real state changes, persistence across restart, process termination and per-process CPU/RAM.

Tests must target the current implementation, not preserve old names simply because an old test expects them. For UI routing, assert the path from the visible action to the implemented window manager function/file and matching IPC/preload handler. Prefer behavior-linked assertions over incidental text tokens.

Do not release when a required suite fails, times out or is unexpectedly skipped. Inspect actual Actions step logs and per-suite summaries. Record packaged-runtime tests as **not run** when no evidence exists.
