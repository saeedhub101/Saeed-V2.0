# Saeed V2.0 — Phase 3: Intelligence & Capabilities

**Status:** Planned  
**Type:** Product-development phase

## Goal

Give Saeed useful intelligence and safe capabilities while preserving one Brain, one conversation and one execution boundary.

## 1. Brain

Build:
- one Brain per active conversation;
- local-first deterministic routing;
- controlled model/API escalation;
- provider abstraction;
- semantic outcomes;
- cancellation;
- stale-result protection;
- context-aware reassessment.

The Brain decides **what should happen**, not how Character bones move.

## 2. Conversation

Complete:
- shared Chat/Voice history;
- final-message persistence;
- streaming handling;
- conversation switching;
- persistence;
- continuity after Character/Brain lifecycle changes;
- provider changes without duplicate history.

## 3. Tool Registry

One authoritative registry handles:
- tool identity;
- schema;
- validation;
- permission;
- execution;
- verification;
- cancellation;
- stale-result invalidation;
- capability discovery.

No secondary dispatcher may bypass it.

## 4. Core capabilities

Develop and integrate:
- computer interaction;
- files;
- web;
- screen/image understanding;
- task execution;
- memory;
- learning;
- future providers.

Capabilities are exposed semantically to the Brain and physically executed behind controlled boundaries.

## 5. Permissions and security

Implement with each capability:
- least authority;
- explicit permission for side effects;
- LLM output is never authorization;
- secrets outside source/logs;
- explicit network access;
- emergency stop;
- plugin isolation;
- auditable results.

## 6. Add-ons

Build:
`Available → Requested → Permission → Load → Use → Idle → Destroy`

Requirements:
- installed ≠ loaded;
- failure isolation;
- discoverability without unnecessary resource activation;
- credential isolation;
- no permission bypass.

## 7. Learning and memory

Develop:
- persistent user preferences where appropriate;
- task/skill learning;
- controlled memory retrieval;
- user-visible learning controls;
- safe import/export;
- memory lifecycle independent from Character rendering.

## Exit criteria

A real request can travel through:

`Chat/Voice → Conversation → Brain → Tool Registry → Permission → Execute → Verify → Response → Character`

without a second Brain, second history or second execution path.