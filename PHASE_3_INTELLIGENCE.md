# Saeed V2.0 — Phase 3: Intelligence

**Status:** Planned  
**Purpose:** Complete the shared intelligence, tool, permission and capability system.

## Objectives

- One Brain and one conversational Agent.
- Local-first routing with controlled escalation.
- One Tool Registry and Permission boundary.
- Safe add-on lifecycle.
- Provider independence.

## Work

### Conversation
- Chat and Voice use the same active conversation.
- Realtime commits final exchanges to the same history.
- Partial streaming events are not stored as final messages.
- Provider changes do not create new histories.

### Brain
- Local-first deterministic routing.
- Reassessment after unsupported/failed local handling.
- Clear outcomes: unsupported, unavailable, denied, failed, successful.
- Brain emits semantic Character events only.

### Tools
- Stable tool identity and schema.
- Validation before side effects.
- Permission before execution.
- Verification after execution.
- Cancellation and stale-result invalidation.
- No second dispatcher.

### Security
- LLM output is never authorization.
- Secrets stay outside source/logs.
- External network use is explicit.
- Plugins cannot bypass Registry or permissions.
- Emergency Stop works for high-impact active actions.

### Add-ons
- Installed does not mean loaded.
- Requested -> Permission -> Load -> Use -> Idle -> Destroy.
- Failure is isolated from Core.
- Add-on capabilities are discoverable without loading heavy runtime resources.

## Exit criteria

A complete Chat -> Brain -> Tool -> Permission -> Execute -> Verify -> Response flow works, and the same capability is reachable from Voice without creating a second path.
