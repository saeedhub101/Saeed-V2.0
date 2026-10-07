# Saeed V2.0 — Phase 2: Runtime

**Status:** Planned  
**Purpose:** Make Character, Engine, lifecycle and voice behavior correct in the real application.

## Objectives

- Prove Character creation/destruction.
- Prove demand-driven rendering.
- Prove TTS/Mic/Realtime lifecycle.
- Prove autonomous Character behavior independent of Brain.
- Prove GLB safety and capability-based animation.

## Work

### Character
- CharacterController is the only behavior boundary.
- AutonomousBehaviorController owns autonomous decisions.
- AnimationController owns playback.
- CharacterEngine owns technical 3D resources.
- User interaction has higher priority than autonomous behavior.
- Recent motion suppression is active.
- Idle is intermittent and lightweight.

### Engine
- Atomic asset replacement.
- Rest pose validation.
- Logical joint mapping.
- Capability matrix.
- Complete GPU/resource disposal.
- No renderer-created behavior.

### Voice
- Character visible + unmuted => TTS READY/IDLE.
- Mute => TTS stopped/destroyed, text remains available.
- Unmute => TTS recreated.
- Mic OFF => capture/VAD/STT destroyed.
- Realtime suppresses standard STT/TTS when it provides native equivalents.
- Voice and Chat share one conversation.

### Lifecycle
- Show=create, Hide=destroy.
- Brain idle timeout = 2 minutes.
- Stale callbacks invalidated.
- Shutdown is idempotent.
- Single instance is enforced.

## Exit criteria

The packaged application passes the mandatory lifecycle simulation, Character acceptance tests, voice lifecycle tests and invalid-asset recovery tests.
