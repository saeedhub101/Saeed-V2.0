# Saeed V2.0 — Phase 3: Intelligence & Capabilities

**Status:** Active — current product-development phase  
**Type:** Product-development phase

## Goal

Continue implementing and verifying useful intelligence and safe capabilities while preserving one Brain, one conversation and one execution boundary. This phase is active, not a future placeholder.

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

## Additional capability in the active roadmap: email

Provide an optional, permission-controlled email capability using IMAP for mailbox synchronization and reading, POP3 as an alternative retrieval protocol, and SMTP for sending. Keep credentials in the existing secret/settings boundary, use explicit account setup and network permissions, and require user confirmation for consequential sends. Do not log passwords, tokens, or message bodies by default. Add provider-independent tests for connection failures, authentication failures, message listing/reading, sending confirmation, cancellation, and secret redaction.


## Source implementation updates — 2026-10-10

- The central Tool Registry now validates declared tool argument schemas before permission prompts or execution, including required fields, types, enums, numeric/string bounds, and nested arrays/objects. Installed add-on tools are discovered from metadata without loading their executable modules, then resolved and validated against their own manifest schemas through the same registry path; the runtime loads only after permission authorization.
- Add-on LLM providers now support bounded multi-step tool loops instead of stopping after one tool batch. Calls still pass through the central Tool Registry, and stale requests are discarded between provider and tool steps.
- Model API requests now have an explicit timeout and are aborted when the conversation request becomes stale, including while the response body is being read.
- Email SMTP delivery now supplies a validated envelope sender; email confirmation displays the actual body field and defaults the consequential send prompt to Deny.

**Verification status:** source changes only. No test suite or build was run for these updates; runtime and packaged acceptance remain pending.
