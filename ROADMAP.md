# Saeed V2.0 — Roadmap

**Status:** Execution roadmap  
**Authority:** Non-authoritative planning document  
**Architecture source of truth:** Architecture_Index.md and the authoritative architecture contracts

## Goal

Build Saeed as one coherent Windows desktop companion: one application lifecycle, one Character runtime, one conversation, one Brain, one Tool Registry, independent providers, demand-driven resources, and verifiable runtime behavior.

## Phase sequence

| Phase | Goal | Exit condition |
|---|---|---|
| Phase 1 | Foundation and architecture conformance | clean ownership, paths, IPC, tests and static contracts |
| Phase 2 | Character, Engine, Voice and Lifecycle | startup, show/hide, TTS, Mic, Realtime and rendering lifecycle work correctly |
| Phase 3 | Brain, Conversation, Tools, Permissions and Add-ons | one intelligence/tool/security path works end-to-end |
| Phase 4 | Product completion and release hardening | packaged runtime passes acceptance, performance, fault and release gates |

## Global rule

A phase is not complete because its files exist. It is complete only when its exit criteria are demonstrated by tests or packaged-runtime verification.

## Dependency order

1. Documentation and ownership truth
2. Module/file structure
3. Preload/IPC boundary
4. Lifecycle/resource ownership
5. Character/Engine runtime
6. Voice/conversation continuity
7. Brain/routing/tools/permissions
8. Add-ons and providers
9. Runtime fault handling
10. Performance and release verification

## Never postpone

Security boundaries, lifecycle ownership, stale-event protection, permission checks and regression tests must be implemented with the feature that needs them. They are not final polish.
