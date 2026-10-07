# Saeed V2.0 — Phase 4: Product Completion

**Status:** Planned  
**Purpose:** Turn the verified architecture into a reliable packaged product.

## Objectives

- Finish user-facing controls.
- Harden failure recovery.
- Measure performance.
- Complete acceptance and release verification.

## Work

### Product
- Character window controls.
- Chat experience.
- Mic/mute controls.
- Character Motion/Animation Control surface.
- Character Preparation/Rigging workflow.
- Settings/provider management.
- Add-on management.
- Diagnostics and lifecycle visibility.

### Reliability
- Fault injection for invalid GLB, provider timeout, STT/TTS failure, plugin crash, tool denial/failure, cancellation and shutdown during work.
- Verify no stale resource can mutate destroyed state.
- Verify recovery without losing conversation state.

### Performance
Measure:
- startup time
- idle CPU/GPU
- Character memory
- tray-only memory
- post-hide memory recovery
- render activity
- child processes
- provider connections
- plugin resources

Target budgets come from Lifecycle_Architecture.md and must be measured rather than assumed.

### Release
- Architecture gate
- Static gate
- Unit gate
- Integration gate
- Packaged-runtime gate
- End-to-end gate
- Security gate
- Performance gate

## Exit criteria

The packaged application passes Testing_and_Acceptance_Architecture.md, including lifecycle simulation, fault injection, security checks, conversation continuity and shutdown verification.

## Final product rule

Do not call Saeed complete because the UI works. Saeed is complete only when the architecture, lifecycle, security, behavior and packaged runtime have all been proven.
