# Saeed V2.0 — Phase 1: Foundation

**Status:** Active — current product-development phase  
**Type:** Product-development phase  
**Repair scope:** Only the subset of existing defects that prevents a coherent foundation.

## Goal

Maintain and verify the foundation while Phase 2–4 work proceeds in parallel where dependencies permit. Phase 1 remains active for foundation conformance; it does not block all runtime, intelligence, or product work.

## Product work

### Repository and naming
- canonical `src/main`, `src/renderer`, `src/character`, `src/tools`, `src/addons`, `src/learning`;
- one canonical file for each responsibility;
- no legacy duplicate trees;
- predictable names for runtime, conversation, voice and character modules.

### Application boundary
- one Core/application lifecycle owner;
- one Character lifecycle owner;
- one Brain owner;
- one conversation owner;
- one Tool Registry;
- one voice lifecycle owner.

### Preload / IPC
Renderer access is grouped under:
- `window.saeed.system`
- `window.saeed.character`
- `window.saeed.voice`
- `window.saeed.chat`
- `window.saeed.tools`

Additional namespaces such as learning/addons exist only because they represent real independent capability domains.

### Lifecycle foundation
Establish the contracts required by later phases:
- Character Show → create;
- Character Hide → destroy;
- visible + unmuted Character → TTS ready/idle;
- Mic OFF → capture/STT resources released;
- Brain released after idle timeout;
- stale callbacks cannot mutate destroyed resources;
- shutdown is idempotent.

## Current repair work

1. remove obsolete paths and duplicate ownership;
2. migrate renderer code to the namespaced preload;
3. verify IPC ownership;
4. remove privileged renderer paths;
5. correct lifecycle violations already visible in code;
6. strengthen architecture/static contracts;
7. add regression checks for repeatable defects.

## Verification

- JavaScript syntax checks;
- architecture contract;
- naming/path audit;
- preload namespace audit;
- IPC ownership audit;
- renderer privilege audit;
- no Brain → bone access;
- no Tool Registry bypass;
- no permanent render loop;
- Windows builds remain manual-only through `workflow_dispatch`; automatic triggers stay disabled. A manual build may be run for verification while Phase 1 work continues.

## Exit criteria

Phase 1 is complete when the foundation is coherent and the application can enter Phase 2 without requiring a second architectural cleanup pass.

A successful Phase 1 does **not** mean Saeed V2.0 is finished.