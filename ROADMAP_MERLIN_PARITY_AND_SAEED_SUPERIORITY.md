# Merlin Behavior Parity and Saeed Superiority Roadmap

Target: `saeedhub101/Saeed-V2.0`, branch `main`. This is a new roadmap; existing Markdown files must remain unchanged.

## Current implementation status — 2026-10-13

An initial behavior-parity increment is committed on `main`: mood-weighted anti-repeat motion selection; energy/time-of-day influence on idle motion and cadence; 20-minute default sleep with wake-on-interaction; separate bounded speech and thinking gesture cycles; lifecycle cancellation for those cycles; and behavior diagnostics for intent, mood, energy, recent motion, last event, and motion-selection reason. Existing Arabic/English text reactions and tool-result reactions are retained. This is **partial parity, not complete Merlin parity**: the remaining checklist items below still require implementation and verified acceptance.

## Product comparison

### Saeed-V2.0 strengths
- Native 3D GLB character, Three.js/Electron runtime, rig discovery and mapping, rest-pose tools, bone/pose editing, and custom motion direction.
- Broader product ambition: shared chat/voice history, AI providers, memory, files, tools, settings, diagnostics, updater, installer, and extensibility.
- Existing Arabic/English reactions and `AutonomousBehaviorController`; extend this single behavior authority rather than creating a competing controller.

### Older Saeed strengths to selectively migrate
- Broader desktop automation/productivity concepts and integrations.
- File/application workflows and operational tools. Migrate only missing, useful capabilities; do not import legacy duplication or architecture.

### Merlin strengths to adopt
- Central animation/intent controller with explicit idle, reacting, thinking, speaking, doing, sleeping, and hidden states.
- Mood-weighted animation pools for idle, speech, wake, success/failure, thanks, surprise, and confusion.
- Recent-animation suppression and throttling to prevent repetitive gestures and queue buildup.
- Energy that rises with interaction and decays during idle; time-of-day and energy influence motion frequency and selection.
- Separate timed gesture cycles while thinking and speaking; reliable cancellation at lifecycle transitions.
- Sleep/wake, gaze/attention, immediate interruption during drag, and reactions to clicks, zoom, chat, and tool outcomes.
- Configurable behavior features and diagnostic state.

### Do not inherit Merlin's limitations
- Merlin uses a 2D sprite runtime; Saeed keeps the real 3D GLB, skeleton, face, gaze, and motion editing.
- Never copy sprite-specific animation IDs, IPC, or window architecture. Resolve motions from Saeed's actual registered motion set.
- Behavior must remain autonomous without an LLM/network and respect Saeed's existing chat, microphone, visibility, and settings contracts.

## Implementation plan

### Phase 1 — complete Merlin behavior parity
- [ ] One central intent state machine; central ownership of timers and transitions.
- [ ] Mood-specific semantic motion pools for idle, speech, thinking, wake, success, failure, thanks, surprise, and confusion.
- [ ] Recent-motion ring buffer, weighted selection, cooldowns, deduplication, and priority-based interruption.
- [ ] Energy 0–100, idle decay, interaction recovery, time-of-day bias, sleep recovery, configurable sleep/wake.
- [ ] Arabic/English contextual reactions: greeting, thanks, praise, excitement, sadness, agreement, disagreement, frustration, questions, confusion, farewell.
- [ ] Reactions to pointer/gaze, hover, drag start/end, zoom, double-click, focus/blur, voice input, chat lifecycle, tool start/success/failure.
- [ ] Bounded speaking/thinking gesture cycles; cancel on speech end, mute, hide, cancellation, sleep, or destruction.
- [ ] Diagnostics expose intent, mood, energy, last event, recent motions, active timers, and why a motion was chosen/skipped.
- [ ] Validate real logs and pass counts; a green workflow status alone is not acceptance.

### Phase 2 — exceed Merlin through 3D
- [ ] Rig-aware semantic adapter for each GLB; never assume optional bones, expressions, or motions exist.
- [ ] Coordinate face expressions, blink, eye/head gaze, torso motion, and speech-visemes.
- [ ] Motion blending and interruption without damaging rest pose or user-authored keyframes.
- [ ] Keep the mesh visible even when a GLB has an incomplete rig; map whatever bones exist.
- [ ] Persist behavior settings and custom motions across restarts; add usable behavior controls in settings/Performance.
- [ ] Ensure timers are bounded and cleanly stopped; preserve responsive rendering.

### Phase 3 — surpass both as a desktop assistant
- [ ] Autonomous behavior without model calls; proactive actions quiet by default, rate-limited, user-controlled, and explainable.
- [ ] Unified conversation, voice, tools, and long-term memory; provider switching does not reset personality or history.
- [ ] Strong productivity tools: tasks, reminders, files, app/window control, web research, and safe permissioned actions.
- [ ] Local and cloud AI providers; privacy controls, encrypted secrets, audit trail, backup/restore, updater, and reliable installer.
- [ ] Arabic/English parity, RTL/LTR correctness, accessibility, and polished tray/overlay behavior.

## Acceptance criteria
- One behavior controller; no duplicate timer/state systems.
- Only valid registered Saeed motions are requested; missing rig features degrade safely.
- Speech/thinking cycles stop on every terminal lifecycle event and never build an animation backlog.
- User interactions and tool outcomes take priority over idle motion; recent motions are not repeated unnecessarily.
- Sleep/wake, mood, energy, and settings stay coherent during long idle periods.
- Diagnostics explain intent and motion decisions.
- Existing Markdown files remain untouched; this roadmap is new.
