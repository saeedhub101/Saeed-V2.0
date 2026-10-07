# Saeed V2.0 — Phase 2: Character & Realtime Experience

**Status:** Planned  
**Type:** Product-development phase

## Goal

Turn the foundation into a convincing living 3D character with reliable realtime voice interaction.

## 1. Character runtime

Build and integrate:
- CharacterEngine;
- CharacterController;
- CharacterRig;
- CharacterRetargeter;
- AnimationController;
- MotionRegistry;
- MotionSafety;
- FaceController;
- finger/eye/blink/neck capabilities;
- character profile storage.

## 2. Character preparation

Complete the asset pipeline:

`GLB → inspect → skeleton detect → map/rig → rest pose → retarget → validate → profile → runtime`

Required behavior:
- optional capabilities degrade gracefully;
- invalid candidate assets never replace a working Character;
- edits are previewed before commit;
- runtime reload is atomic.

## 3. Motion system

Build:
- semantic motion intents;
- motion generator;
- priority;
- cooldown;
- recent-motion suppression;
- major/micro motion layers;
- animation enable/disable;
- runtime Motion/Animation Control.

The Brain may request semantic behavior. It never selects raw bones or owns physical animation.

## 4. Autonomous Character

Build:
- idle behavior;
- micro behavior;
- attention;
- mood;
- energy;
- sleep/wake;
- autonomous movement;
- interaction priority;
- anti-annoyance policy.

Autonomy must work without an LLM.

## 5. Voice

Build and verify:
- TTS providers;
- TTS ready/idle lifecycle;
- local speech;
- API speech;
- microphone capture;
- STT;
- realtime audio;
- interruption/barge-in;
- speaking animation;
- audio resource disposal.

Rules:
- Character visible + unmuted → TTS READY/IDLE;
- Mute is output-only;
- Mic OFF does not require output mute;
- Realtime takes ownership of its native audio path when active.

## 6. Conversation experience

Chat and Voice remain two channels of the same conversation.

A voice answer:
- enters the same conversation history;
- appears above Saeed;
- may be spoken;
- is available when Chat is opened.

A Chat answer:
- may be spoken by TTS;
- may trigger semantic character behavior;
- never creates a second Brain.

## Exit criteria

A packaged build can repeatedly:
1. show/hide Character;
2. load and replace a valid GLB safely;
3. reject an invalid GLB without losing the current Character;
4. run autonomous behavior;
5. speak through TTS;
6. turn Mic on/off;
7. use STT;
8. use Realtime where configured;
9. interrupt speech;
10. preserve conversation continuity.