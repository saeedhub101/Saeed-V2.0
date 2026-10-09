# Saeed V2.0 — Core Architecture

**Status:** Authoritative Core contract  
**Scope:** Application shell, Brain, routing, tools, capabilities and orchestration

## 1. Core principle
## Current implementation map

- Electron entry and lifecycle wiring: `src/main.js`, `src/main/runtime.js`.
- Runtime/service composition: `src/main/application/runtime-composition.js`.
- Brain routing: `src/main/brain/brain.js`; Brain lifecycle: `src/main/application/brain-host.js`.
- Conversation: `src/main/conversation/conversation-agent.js`.
- Tool execution and schemas: `src/tools/registry.js` and implementations under `src/tools/`.
- Add-on management: the service under `src/addons/` and IPC under `src/main/ipc/addons-ipc.js`.
- Secure renderer API: `src/preload.js`.

These paths reflect the current code layout. Keep one owner for each responsibility and update this map only when a real implementation move occurs.


Core is the application coordination layer. It owns application-level orchestration but does not become the owner of Character behavior, raw 3D bones, provider internals or UI presentation.

Core decides which subsystem should act. Each subsystem decides how it performs its own responsibility.

## 2. Authoritative ownership

Core owns:

- application startup and shutdown orchestration
- single-instance enforcement
- tray/application shell
- feature creation/destruction requests
- Brain lifecycle
- semantic request routing
- capability discovery
- Tool Registry ownership
- permission boundary
- plugin/add-on lifecycle orchestration
- application-level diagnostics

Core does not own:

- Character motion selection
- bone transforms
- renderer decisions
- conversation history presentation
- STT/TTS internals
- provider-specific implementation
- durable user data semantics outside the persistence contract

## 3. Request pipeline

Every user request follows one authoritative path:

User → Conversation Gateway → Brain → local-first decision → semantic action or LLM/API escalation → Tool Registry when capability execution is required → Permission → Execute → Verify → Result → Conversation response → Character semantic event when appropriate.

There must not be separate tool paths for Chat, Mic, plugins or Character.

## 4. Brain

There is exactly one active Brain for a Saeed conversation session.

Brain responsibilities:

- understand the request
- maintain conversational context
- classify intent
- choose local handling or escalation
- request capabilities
- produce semantic results
- emit semantic Character events
- never manipulate physical Character state directly

Brain is not a permanent service. Its lifecycle is governed by Lifecycle_Architecture.md.

## 5. Local-first routing

Simple deterministic supported operations should be handled locally.

Examples:

- application launch
- permitted file/folder operations
- system information
- process information
- disk information
- network information
- registered deterministic capabilities

LLM/API escalation is used when reasoning is required, local handling is insufficient, configuration requires it, or an installed capability supplies the selected provider.

Local-first does not mean local-always.

## 6. Reassessment

A failed route is not automatically a final answer.

If a local capability fails because the route was insufficient, Brain may reassess using another valid capability.

The system must distinguish:

- unsupported
- unavailable
- denied
- failed
- successful

These outcomes must not be conflated.

## 7. Tool Registry

Exactly one authoritative Tool Registry exists.

Pipeline:

Request → resolve capability → validate arguments → permission decision → execute → verify → normalize result → return to Brain.

No tool may bypass this path for convenience.

## 8. Tool contract

Every capability should declare:

- stable identity
- purpose
- required permissions
- input schema
- output schema
- side-effect class
- reversibility where known
- lifecycle requirements
- timeout/cancellation behavior
- failure behavior

Tools must reject malformed input before side effects.

## 9. Permission boundary

Permission is evaluated before execution, not after.

High-impact actions include filesystem modification, process termination, system settings, network actions, browser automation, mouse/keyboard automation, microphone access, credential access and destructive operations.

A tool cannot grant itself permission.

## 10. Plugin/add-on model

Installed does not mean loaded.

Lifecycle:

Available → Requested → Permission → Load → Use → Idle → Destroy

Plugin failure must not terminate Core.

Plugins must declare capabilities and permissions. Core controls whether they are allowed to run.

## 11. Cancellation

Potentially long operations should support cancellation.

Cancellation must stop future side effects where possible, invalidate late results, release temporary resources and report a deterministic cancelled state.

## 12. Error isolation

Character failure must not destroy Brain.
Brain failure must not destroy Character.
TTS failure must not destroy conversation.
Plugin failure must not destroy Core.
Provider failure must not corrupt persistent conversation state.

## 13. Event boundaries

Events crossing subsystem boundaries must be semantic.

Allowed examples:

- user_started_speaking
- brain_started_thinking
- tool_completed
- response_ready
- conversation_interrupted
- character_react

Forbidden:

- arbitrary bone names
- renderer-specific transforms
- provider-specific internal objects
- mutable references to another subsystem's private runtime

## 14. Core invariants

1. One application lifecycle owner.
2. One active Brain.
3. One Tool Registry.
4. One permission boundary.
5. One authoritative conversation.
6. No Brain-to-bone path.
7. No tool-to-bone path.
8. No plugin bypass of permission.
9. No provider becomes another provider's lifecycle owner.
10. Core cannot be recreated by a feature.

## 15. Architectural test

Any new feature must answer:

- Who owns it?
- Who creates it?
- Who destroys it?
- What permissions does it require?
- What persistent state does it use?
- What semantic events cross its boundary?
- How is failure isolated?
- How is cancellation handled?
- How is it tested at runtime?

If these questions cannot be answered, the feature is not ready for implementation.
