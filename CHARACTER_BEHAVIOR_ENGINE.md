# Saeed 3D Autonomous Behavior Engine

**Status:** Implemented in source; packaged Windows runtime acceptance is still required.
**Owner:** `src/character/AutonomousBehaviorController.js`
**3D execution owner:** `src/character/CharacterController.js`
**Motion definitions:** `src/character/motions.js`
**Motion blending and safety:** `src/character/AnimationController.js`, `src/character/MotionSafety.js`, `src/character/CharacterRetargeter.js`, `src/character/CharacterRig.js`

## Design contract

Saeed's character is an independent visual agent, not an animation controlled directly by the language model. The brain emits semantic events; the character controller owns intent, mood, energy, scheduling, gesture selection, expressions, gaze, sleep/wake, and motion execution. The renderer only advances the 3D scene and applies the resulting pose to the current GLB rig.

```text
User / Brain / Voice / Tool lifecycle
                 |
          Semantic event
                 v
 AutonomousBehaviorController
   | intent + mood + energy
   | context-specific motion pool
   | anti-repeat + cooldown + cadence
   | busy/hidden/sleep lifecycle gates
                 v
        CharacterController
                 v
      AnimationController
   | layered priorities + blending
   | registered motion definitions
                 v
 MotionSafety -> Retargeter -> Rig mapping
                 v
        Current GLB skeleton
                 v
          Three.js renderer
```

## Interaction policy

- **User input:** classify common Arabic and English signals such as greetings, thanks, questions, confusion, frustration, encouragement, urgency, and celebration. Pick a fitting expression and motion rather than using one generic response.
- **Thinking:** enter a distinct thinking intent, interrupt low-priority idle movement, and use a restrained, independently scheduled thinking gesture cycle.
- **Speaking:** enter speaking intent, apply the configured speech expression, and schedule sparse gestures while speech is active. Speech-end, mute, cancellation, and chat-end clear the relevant timers.
- **Tool outcomes:** success and failure use different mood and motion choices; they do not assume that a tool succeeded merely because it was invoked.
- **Direct interaction:** hover, zoom, drag, summon, and wake events receive bounded reactions. Pointer tracking is throttled to avoid processing every mouse event.
- **Mood:** temporary reactions expire and restore the user's/base mood. Mood palettes influence choices without overriding explicit speaking/thinking states.
- **Energy and time:** energy decays slowly, recovers with interaction, and biases motion density/intensity. Late-night behavior is calmer; sleep restores energy.
- **Sleep/wake:** prolonged true idle can enter a sleep pose. Meaningful interaction wakes the character and cancels stale idle scheduling.
- **Busy-state suppression:** `setUserBusy(true)` or `user-busy-start` / `system-busy` clears the idle timer, prevents new casual gestures, and interrupts low-priority movement. `setUserBusy(false)`, `user-busy-end`, `system-active`, or a wake/focus event resumes scheduling. Speaking/thinking/tool/reaction states remain authoritative rather than being replaced by a casual busy state. Integrators should send busy events only when the user/system is genuinely occupied; do not infer global user activity from the character window losing focus alone.
- **Non-intrusive cadence:** the idle scheduler uses randomized timing, energy-aware cadence, motion cooldowns, and a recent-motion history. Recent selections are avoided until the candidate pool is exhausted. Casual gestures are throttled and limited so they cannot accumulate into a delayed animation queue.
- **Visibility and authoring:** hidden characters stop autonomous timers; Character Studio/authoring suspends autonomous behavior. Rest-pose, rig mapping, and bone safety remain owned by the existing 3D runtime.

## Relevant source behavior

- `AutonomousBehaviorController`: lifecycle state, semantic reactions, weighted motion selection, recent-motion suppression, mood palettes, energy, time-of-day, sleep/wake, blinking, gaze, breathing, speech/thinking cycles, busy-state gate, and diagnostics.
- `CharacterController`: sole public character behavior API; coordinates controller state with the authoritative loaded GLB and registered motions.
- `AnimationController`: layered motion playback, blending, priority, and animation ticking.
- `motions.js`: reusable 3D motion definitions; add/adjust motion definitions here instead of adding bone manipulation to Brain code.
- `src/main/application/brain-host.js`: translates Brain thinking/tool/result/answer/task lifecycle events into character behavior events while retaining the general agent event stream.
- `src/renderer.js`: sends the submitted user message to the behavior controller and pauses casual idle motion while the chat input is focused; blur resumes autonomous scheduling.
- `client.js` and `src/main/character/character-host.js`: expose behavior-event and busy-state commands without requiring a complete rig map first.

## Rules for future changes

1. Do not let the LLM choose raw bones, axes, quaternions, or per-frame transforms.
2. Add semantic events and motion definitions; keep the behavior engine deterministic when random mode is disabled.
3. Keep casual gestures lower priority than direct interaction, speech, thinking, and explicit user-requested motion.
4. Clear timers on cancellation, mute, hide, authoring, and teardown; do not leave delayed gestures queued after the event ends.
5. Every new behavior must report its intent/reason in controller diagnostics and respect missing-rig capabilities.
6. Do not claim visual realism or runtime acceptance from source inspection alone. Verify the packaged app on the real GLB and confirm that gestures do not conflict with its actual bone mapping/rest pose.
7. Realtime voice transport is outside this change and must not be modified as part of character behavior work.

## Acceptance still required

- Launch the packaged Windows application with the bundled GLB and confirm idle motion, breathing, gaze, blinking, and face expressions use the actual rig.
- Verify that user input and tool outcomes cause context-appropriate gestures in both Arabic and English.
- Verify that speaking/thinking/cancellation/mute/hide/authoring correctly start and stop their timers.
- Verify busy-state start suppresses casual motion and busy-state end resumes it.
- Observe a long idle session to confirm motion variety, sleep/wake, and no repeated or queued gesture bursts.
- Inspect controller diagnostics and actual rendered behavior; a successful CI status alone is not proof of visual acceptance.
