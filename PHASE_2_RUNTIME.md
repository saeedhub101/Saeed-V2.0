# Saeed V2.0 — Phase 2: Character & Realtime Experience

**Status:** Active — current product-development phase  
**Type:** Product-development phase

## Goal

Continue bringing the current living 3D character and realtime voice implementation to verified acceptance. This phase is active; existing modules must be validated and completed, not blindly recreated.

## 1. Character runtime

Current runtime modules to validate and complete (do not create duplicate owners):
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

Validate and extend the existing motion system:
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

## Current repository mapping

- Three.js scene, renderer, camera, GLB load and live model state: `src/character/CharacterEngine.js`.
- Character orchestration, animation, retargeting, autonomous behavior and rig binding: `src/character/CharacterController.js`.
- Bone aliases and rig slots: `src/character/AutoRigMapper.js`.
- Animation playback: `src/character/AnimationController.js`.
- Character authoring / bones / rest pose / animation UI: `src/character-studio.html`.
- Main-process character delivery and window ownership: `src/main/character/character-host.js`.

Keep these paths synchronized with the actual imports and runtime ownership whenever implementation changes.


## Current execution status — 2026-10-13

This document must be read as implementation guidance, not evidence that the product is complete. Saeed V2.0 remains under active development across all four phases. A feature is complete only after its implementation and relevant real behavior are demonstrated; a green workflow, source-level assertion, or report file alone is not sufficient.

- Work targets `main` only. Existing Markdown files are preserved and maintained; none are to be deleted.
- Automatic Windows builds are the current policy, while retaining `workflow_dispatch` for deliberate runs. This supersedes older manual-only wording in this repository.
- Development work takes priority over adding test-only changes. Keep `npm test`, Electron/build validation, and installer requirements.
- After substantive product development is complete, the Windows workflow must validate the packaged installer/EXE on Windows, exercise real app journeys and component behavior, and fail when required evidence is missing, timed out, or reports a failed subcheck.
- The task engine must never claim success when persistence fails, a plan step was not actually started, verification is only tool discovery/connection, or an external action has an ambiguous outcome. Interrupted external actions are not replayed automatically.
- The current checkpoint is GitHub Issue #9: https://github.com/saeedhub101/Saeed-V2.0/issues/9. All four roadmap phases remain active; no overall completion claim is authorized until the packaged product is verified.
