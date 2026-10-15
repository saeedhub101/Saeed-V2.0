# Saeed V2.0 — Product Baseline and Acceptance Roadmap

**Purpose:** a single concise execution record. This is planning, not an architecture contract.

## Product baseline

The core product foundation is implemented in source: Electron shell and tray, a 3D GLB character, character settings and rig/motion tooling, shared Chat/Mic architecture, Brain/tool/provider integration, lifecycle controls, learning/add-ons, diagnostics, and Windows packaging/acceptance infrastructure.

Recent character work includes autonomous behavior ownership, busy-state gating, semantic reactions, and mapping user intents to available GLB clips. These implementation statements are not a claim that every feature has passed packaged Windows runtime verification.

## Remaining release gates

1. **Character and intent mapping:** confirm saved GLB intent mappings survive restart; invalid clips are rejected; a mapped semantic intent plays the selected clip; clearing a mapping restores fallback behavior; the original character and settings are restored after diagnostics.
2. **Real UI behavior:** exercise every important action in Settings, Performance, Character settings, Chat, Mic, tray, Learning and Add-ons. Verify the result/state change, not merely that a button exists.
3. **Lifecycle and resources:** measure idle and active CPU/RAM per process; confirm Mic OFF releases capture/STT, closing Chat releases Brain when Mic is also OFF, mute stops audible output without silently turning Mic off, and Hide stops character resources while preserving only the required tray shell.
4. **3D correctness:** verify the actual bundled GLB, camera framing at each character size, rest-pose and bone edits, rig mapping, facial/viseme behavior, animation playback, and persistence across full application restart.
5. **Packaged Windows journey:** install and launch the produced installer/EXE in a clean Windows profile; verify startup, tray commands, Show/Hide, Chat/Mic, errors, settings persistence, shutdown and recovery.
6. **Release hygiene:** resolve release-blocking errors and warnings, validate permissions and updater behavior, and preserve actionable diagnostic artifacts.

## Evidence policy

- A source-level assertion proves only the source property it checks.
- A passing unit test does not prove the packaged EXE works.
- A green workflow is not sufficient unless required suites ran and their actual results are successful.
- Do not label the product fully release-verified until the packaged Windows runtime gates above have evidence.
- Do not reimplement already-present features just because old planning documents show them as incomplete; inspect the current source first.

## Operating constraints

- Work on main only.
- Use the existing Node.js/npm/Electron toolchain; no Rust/Cargo checks.
- Keep architecture details in the domain contracts listed in [Architecture_Index.md](Architecture_Index.md).
- Prefer product behavior and functional evidence over adding test scaffolding without a real assertion.
