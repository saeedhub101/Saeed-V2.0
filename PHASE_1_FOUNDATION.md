# Saeed V2.0 — Phase 1: Foundation

**Status:** Planned  
**Purpose:** Establish a clean, understandable and testable foundation before feature completion.

## Objectives

- Make repository structure unambiguous.
- Establish one canonical name/path for every subsystem.
- Align documentation with actual code.
- Establish the preload/IPC boundary.
- Establish machine-checkable architecture contracts.
- Remove duplicate or obsolete ownership paths.

## Work

### 1. Repository structure
- Canonical src/main, src/renderer, src/character, src/tools, src/addons, src/learning.
- No old src/core, src/agent-tools, src/voice, src/avatar.js compatibility tree.
- Canonical conversation agent path: src/main/conversation/conversation-agent.js.
- Canonical application runtime path: src/main/runtime.js.

### 2. IPC
Create a narrow, namespaced preload surface:

- window.saeed.system
- window.saeed.character
- window.saeed.voice
- window.saeed.chat
- window.saeed.tools

Add further namespaces only when a real responsibility requires them.

### 3. Ownership
Prove:
- one lifecycle owner
- one Brain
- one Tool Registry
- one CharacterController
- one CharacterEngine
- one voice lifecycle owner
- one conversation history

### 4. Verification
Add static checks for:
- stale paths
- duplicate owners
- forbidden renderer privilege
- direct Brain-to-bone paths
- Tool Registry bypasses
- permanent render loops
- automatic workflow triggers

## Exit criteria

- No stale architecture paths remain.
- Imports resolve to canonical modules.
- Preload API is namespaced and minimal.
- Architecture contract script passes.
- Static tests pass.
- No automatic Windows build is enabled.
- Manual build can be dispatched only after Phase 1 exit criteria are met.
