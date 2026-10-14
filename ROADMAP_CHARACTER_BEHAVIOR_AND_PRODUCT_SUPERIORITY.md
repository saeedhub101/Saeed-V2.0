# Character Behavior and Saeed Product Superiority Roadmap

Scope: implementation methodology and product roadmap only. Keep existing Markdown files unchanged.

## Current implementation status — 2026-10-13

A behavior-parity increment is committed on `main`: mood-weighted anti-repeat motion selection; energy/time-of-day influence on idle cadence and night drain; sleep recovery and wake-on-interaction; independent speech/thinking gesture cycles; a bounded reaction-finish timer and clearer intent returns; casual-motion throttling to prevent backlog; lifecycle cancellation on mute/cancel/hide; Arabic/English reactions; mood-specific pools for praise, excitement, confusion, disagreement and farewell; deterministic/random, walking/dancing, gaze, expression and idle-thought preferences; and diagnostics for intent, mood, energy, event counts, active timers, recent motions and motion-selection reasons. Performance exposes speech/thinking controls plus independent mood-palette and energy/time-of-day adaptation switches; saved behavior preferences are forwarded to the live controller, which now starts with the same defaults as Performance. Focused regression tests cover contextual reactions, deterministic selection, disabled motions, lifecycle cancellation and diagnostics. The Windows acceptance/package workflow for commit `b98b5fdf45a8ed9b0511d6c7b00c81933e7fef63` completed successfully; newer behavior commits are still being checked. The checklist below now distinguishes implemented behavior from runtime acceptance. Items marked **تم الانتهاء** are implemented in the current source; this does not imply the latest packaged Windows runtime has passed acceptance. Do not reimplement these items without first identifying a concrete regression.

## Product comparison
## Detailed feature comparison

| Capability | Older Saeed | Saeed-V2.0 target | Reference Assistant |
|---|---|---|---|
| Character | 3D avatar; Studio for bones, pose, rig building, custom keyframes, shape keys, visemes, lip-sync, outfits/accessories | **Strategic winner**: retain and harden 3D GLB, rig, rest-pose, face, and motion-authoring stack | 2D MS Agent sprites; multiple selectable characters and sprite animation |
| Autonomous personality | Intent-driven 3D motions and face behavior are part of its design | Existing Arabic/English reactions and 3D behavior controller; expand into complete state/mood/energy engine | **Current behavior reference**: mood-weighted animation palettes, recent-motion suppression, energy/time modulation, sleep/wake, gaze, speaking/thinking cycles |
| Voice | Multiple STT/LLM/TTS provider options; offline Windows voice; RMS gate and interruption; shared chat/voice brain | Preserve and finish the unified provider/lifecycle architecture; connect voice events to 3D expression and motion timing | Edge Neural/SAPI and provider TTS options, push-to-talk STT, synchronized bubble/audio |
| AI providers | Documented Claude, OpenAI-compatible services, local Whisper/LLM and offline TTS add-ons | **Potential winner** if provider-independent, local/cloud, memory, and tools are integrated without breaking behavior | Groq, OpenRouter, Ollama, MiniMax, Hermes Agent; convenient switching |
| Productivity | **Strongest documented breadth**: file operations, Windows UI Automation, browser, Office/PDF/Excel/Word, database, web research, reminders, commands, skill memory, procedures, charts/pump selection, prayer times | Must selectively migrate useful tools into a coherent permissioned tool system; verify which are already present before porting | Smaller built-in tool set: movement/window control, tasks, web search, attachments and screenshots |
| Memory and learning | Persistent facts, reminders, reusable learned skills and user-written procedures | **Opportunity to win** with durable conversation/user memory plus tool/skill learning and verification | Conversation history and tasks; personality/context features, but narrower documented skill/productivity layer |
| Extensibility | Add-ons for tools, providers, language, accessories, independent process lifecycle and store | Keep plugin/add-on architecture, add permission review, isolation, lifecycle and diagnostics | Custom character personas, provider registry and extension settings |
| Desktop interaction | Windows app control, UI Automation, quick launch, permissions and stop-all safety controls | Combine tray/transparent movable 3D companion with robust safe desktop automation | Polished draggable transparent sprite, tray, hotkeys, classic bubble and modern chat panel |
| Safety/operations | Explicit permission gates, activity logs, stop-all, encrypted API secrets, protected irreversible actions | **Must match or exceed** permission controls, encrypted secrets, audit trail, backup/restore, updater and installer reliability | DPAPI-protected provider keys, asset integrity checks, layered unit/e2e tests |
| Localization | Documented Arabic/English speech and an Arabic RTL language add-on | **Strategic differentiator**: full Arabic/English behavior, RTL/LTR across chat, settings, tools and voice | Mainly English-oriented product documentation and UI |

### What each currently wins at
- **Older Saeed wins on breadth of desktop productivity and automation**: Office/PDF/data/browser/files, Windows UI Automation, skill memory, procedures, and domain-specific chart/pump tools. Its README describes these capabilities; V2.0 must inspect current code and port only missing pieces rather than assume every feature is already integrated.
- **the reference assistant wins on character behavior cohesion**: its central controller explicitly coordinates intent, mood palettes, energy, time-of-day, anti-repeat, sleep/wake, and separate thinking/speaking cycles.
- **Saeed-V2.0 should win overall by integration**: a real expressive 3D character plus reference-assistant-quality autonomous behavior plus Saeed's productivity breadth, persistent memory, Arabic-first experience, provider independence, and reliable commercial packaging. These are target advantages, not a claim that all are complete today.


### Saeed-V2.0 strengths
- Native 3D GLB character, Three.js/Electron runtime, rig discovery and mapping, rest-pose tools, bone/pose editing, and custom motion direction.
- Broader product ambition: shared chat/voice history, AI providers, memory, files, tools, settings, diagnostics, updater, installer, and extensibility.
- Existing Arabic/English reactions and `AutonomousBehaviorController`; extend this single behavior authority rather than creating a competing controller.

### Older Saeed strengths to selectively migrate
- Broader desktop automation/productivity concepts and integrations.
- File/application workflows and operational tools. Migrate only missing, useful capabilities; do not import legacy duplication or architecture.

### the reference assistant strengths to adopt
- Central animation/intent controller with explicit idle, reacting, thinking, speaking, doing, sleeping, and hidden states.
- Mood-weighted animation pools for idle, speech, wake, success/failure, thanks, surprise, and confusion.
- Recent-animation suppression and throttling to prevent repetitive gestures and queue buildup.
- Energy that rises with interaction and decays during idle; time-of-day and energy influence motion frequency and selection.
- Separate timed gesture cycles while thinking and speaking; reliable cancellation at lifecycle transitions.
- Sleep/wake, gaze/attention, immediate interruption during drag, and reactions to clicks, zoom, chat, and tool outcomes.
- Configurable behavior features and diagnostic state.

### Do not inherit the reference assistant's limitations
- the reference assistant uses a 2D sprite runtime; Saeed keeps the real 3D GLB, skeleton, face, gaze, and motion editing.
- Never copy sprite-specific animation IDs, IPC, or window architecture. Resolve motions from Saeed's actual registered motion set.
- Behavior must remain autonomous without an LLM/network and respect Saeed's existing chat, microphone, visibility, and settings contracts.

## Implementation plan

### Phase 1 — complete the reference assistant behavior parity
- [x] One central intent state machine; central ownership of timers and transitions. — **تم الانتهاء من التنفيذ البرمجي**
- [x] Mood-specific semantic motion pools for idle, speech, thinking, wake, success, failure, thanks, surprise, and confusion. — **تم الانتهاء من التنفيذ البرمجي**
- [x] Recent-motion ring buffer, weighted selection, cooldowns, deduplication, and priority-based interruption. — **تم الانتهاء من التنفيذ البرمجي**
- [x] Energy 0–100, idle decay, interaction recovery, time-of-day bias, sleep recovery, configurable sleep/wake. — **تم الانتهاء من التنفيذ البرمجي**
- [x] Arabic/English contextual reactions: greeting, thanks, praise, excitement, sadness, agreement, disagreement, frustration, questions, confusion, farewell. — **تم الانتهاء من التنفيذ البرمجي**
- [x] Reactions to pointer/gaze, hover, drag start/end, zoom, double-click, focus/blur, voice input, chat lifecycle, tool start/success/failure. — **تم الانتهاء من التنفيذ البرمجي**
- [x] Bounded speaking/thinking gesture cycles; cancel on speech end, mute, hide, cancellation, sleep, or destruction. — **تم الانتهاء من التنفيذ البرمجي**
- [x] Diagnostics expose intent, mood, energy, last event, recent motions, active timers, and why a motion was chosen/skipped. — **تم الانتهاء من التنفيذ البرمجي**
- [ ] Validate real logs and pass counts; a green workflow status alone is not acceptance — **ما زال التحقق التشغيلي مطلوبًا، وليس إعادة تنفيذ الميزة**.

### Phase 2 — exceed the reference assistant through 3D
- [x] Rig-aware semantic adapter for each GLB; never assume optional bones, expressions, or motions exist. — **تم الانتهاء من التنفيذ البرمجي**
- [x] Coordinate face expressions, blink, eye/head gaze, torso motion, and speech-visemes. — **تم الانتهاء من التنفيذ البرمجي**
- [x] Motion blending and interruption without damaging rest pose or user-authored keyframes. — **تم الانتهاء من التنفيذ البرمجي**
- [x] Keep the mesh visible even when a GLB has an incomplete rig; map whatever bones exist. — **تم الانتهاء من التنفيذ البرمجي**
- [x] Persist behavior settings and custom motions across restarts; add usable behavior controls in settings/Performance. — **تم الانتهاء من التنفيذ البرمجي**
- [x] Ensure timers are bounded and cleanly stopped; preserve responsive rendering. — **تم الانتهاء من التنفيذ البرمجي**

### Phase 3 — surpass both as a desktop assistant
- [x] Autonomous behavior without model calls; proactive actions quiet by default, rate-limited, user-controlled, and explainable. — **تم الانتهاء من التنفيذ البرمجي**
- [x] Unified conversation, voice, tools, and long-term memory; provider switching does not reset personality or history. — **تم الانتهاء من التنفيذ البرمجي**
- [x] Strong productivity tools: tasks, reminders, files, app/window control, web research, and safe permissioned actions. — **تم الانتهاء من التنفيذ البرمجي**
- [x] Local and cloud AI providers; privacy controls, encrypted secrets, audit trail, backup/restore, updater, and reliable installer. — **تم الانتهاء من التنفيذ البرمجي**
- [ ] Arabic/English parity, RTL/LTR correctness, accessibility, and polished tray/overlay behavior — **يلزم تدقيق قبول مستقل؛ لا تُصنّف كمنجزة دون دليل**.

## Acceptance criteria
- One behavior controller; no duplicate timer/state systems.
- Only valid registered Saeed motions are requested; missing rig features degrade safely.
- Speech/thinking cycles stop on every terminal lifecycle event and never build an animation backlog.
- User interactions and tool outcomes take priority over idle motion; recent motions are not repeated unnecessarily.
- Sleep/wake, mood, energy, and settings stay coherent during long idle periods.
- Diagnostics explain intent and motion decisions.
- Existing Markdown files remain untouched; this roadmap is new.
