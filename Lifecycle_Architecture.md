# Saeed V2.0 — Lifecycle Architecture

## 1. Purpose

This document is the strict lifecycle contract for Saeed V2.0.

The central rule is:

> If a resource is not used, destroy it. Do not hide it.

These rules are architectural constraints. They are not optional implementation suggestions.

---

## 2. One Authoritative Lifecycle Owner

There must be exactly one permanent application lifecycle owner: the Core/Tray layer.

It owns:

- application startup
- single-instance enforcement
- tray lifetime
- creation of feature resources
- destruction of feature resources
- dependency orchestration
- idle timeout enforcement
- application shutdown
- lifecycle events
- preservation of persistent state

No window is the application owner.

No feature window may keep the application alive.

No feature may independently terminate the application.

A future Service Manager may provide lifecycle helpers, but it must never become a second lifecycle owner.

---

## 3. Permanent vs On-Demand Resources

### Permanent

Only the minimum application shell remains permanently alive:

- Core
- Tray
- lifecycle/event infrastructure
- persistent configuration access
- persistent storage access required by the shell
- required security/secret infrastructure

### On demand

These resources exist only while required:

- Character runtime/window
- Chat
- Brain
- microphone capture
- VAD
- STT
- TTS
- Realtime connection
- Control Center
- plugins
- workers
- temporary rendering resources

Unused resources must be destroyed.

---

## 4. Authoritative State Matrix

| State | Must remain running | Must be destroyed |
|---|---|---|
| Character visible, Chat closed, mic OFF | Core, Tray, Character | Chat, Voice capture, VAD, STT, TTS, Realtime, idle Brain |
| Character hidden, Chat closed, mic OFF | Core, Tray | Character, Renderer, Chat, Voice, VAD, STT, TTS, Realtime, Brain |
| Chat open and active | Core, Tray, Chat, Brain while active | STT/VAD unless mic is ON; idle TTS |
| Mic ON | Core, Tray, Voice capture, VAD, STT, Brain when required | none of the currently required voice resources |
| Voice muted | resources required by current state | TTS pipeline |
| Character hidden, Chat open | Core, Tray, Chat, Brain while active | Character, Renderer, Mic, VAD, STT, TTS unless independently required |
| Everything closed | Core, Tray only | all feature resources |
| Application Quit | shutdown coordinator until complete | all runtime resources, then Core/Tray |

This matrix is mandatory.

---

## 5. Creation Contract

Every lifecycle-managed resource must have:

1. a creation trigger
2. an owning lifecycle domain
3. dependencies
4. a destruction trigger
5. an idle policy where appropriate
6. a failure policy
7. a persistence policy

No resource may be created merely because it might be needed later.

---

## 6. Destroy Means Real Destruction

Destroying a resource means:

- stop active work
- stop its timers
- stop its event subscriptions
- close its network connections
- stop audio capture/playback
- release native handles
- release GPU resources
- release browser/WebView resources
- release workers/processes
- release memory
- remove references preventing collection
- invalidate the resource against stale events

Making a window invisible is not destruction.

Disabling rendering is not destruction.

Disconnecting the UI while leaving the service alive is not destruction.

---

## 7. Character Lifecycle

### Show

Show Saeed creates the Character runtime.

### Hide

Hide Saeed destroys the Character runtime.

Hide must not leave a hidden rendering/browser process alive.

Destroying Character must release:

- Character window
- browser/WebView runtime
- Three.js scene
- renderer
- geometries
- materials
- textures
- loaded GLB resources
- animation resources
- character-local timers
- character-local event subscriptions
- character-local input handlers
- character-local voice resources tied to Character presence

The renderer must be fully disposed.

GPU resources must be released according to the rendering backend.

The render loop must stop.

### Show again

Showing Saeed again creates a fresh Character runtime and reloads the persistent character configuration.

Therefore:

Show = create

Hide = destroy

not:

Show = create

Hide = keep hidden

---

## 8. Brain Lifecycle

Brain is not a permanent service.

### Start

Brain starts when a conversational operation requires reasoning.

Examples:

- Chat message
- Voice transcript
- another valid conversational operation

### Active

Brain remains alive while processing or while an active feature legitimately requires it.

### Idle

When no active work remains, Brain becomes idle and its idle timer begins.

### Destroy

After the idle timeout:

- stop Brain-owned workers
- close Brain-owned provider connections
- release temporary resources
- remove Brain-owned event subscriptions
- release memory
- mark Brain unavailable

Persistent conversation data remains.

Default Brain idle timeout:

**2 minutes.**

---

## 9. Voice Lifecycle

Voice is composed of independently managed resources:

- microphone capture
- VAD
- STT
- TTS
- Realtime connection

They must not be treated as one permanently running service.

### Mic ON

Mic ON activates the resources required for voice input:

- microphone capture
- VAD
- STT when transcription is required
- Brain when a transcript becomes a conversational request

### Mic OFF

Mic OFF must:

- stop microphone capture
- stop VAD
- stop STT
- release microphone resources
- invalidate pending voice-input callbacks

### Mute

Mute controls spoken output.

Mute must:

- stop/destroy TTS
- prevent new spoken playback

Mute must not:

- delete conversation history
- disable Chat
- prevent text responses
- prevent the speech bubble

---

## 10. TTS Lifecycle

TTS is created on demand for spoken output.

TTS must be destroyed:

- when muted
- after the configured idle timeout
- when no active voice output requires it
- when its owning lifecycle is destroyed

Default TTS idle timeout:

**30 seconds.**

---

## 11. Realtime Lifecycle

Realtime is optional.

When activated:

- establish the selected Realtime provider connection
- attach it to the current conversation session
- publish transcript/input/output events through the same conversation system
- synchronize speaking and interruption state

When no longer required:

- stop the stream
- close the connection
- release provider resources
- remove event subscriptions

Realtime must not keep the application alive after its owner ends.

Realtime must not create a second conversation history.

---

## 12. Unified Conversation Lifecycle

There is:

> One Saeed, one active conversation, one authoritative conversational history.

Chat and Voice are channels into the same conversational system.

Changing from Voice to Chat must not create:

- a second conversation
- a second history
- a second Brain

unless the user explicitly selects New Chat.

Voice and Chat messages belong to the same session.

The conversation must survive:

- microphone OFF
- TTS mute
- Chat close
- Character hide
- Brain destruction
- provider replacement
- application restart

Persistent conversation data must not depend on a live UI or service process.

---

## 13. Provider Independence

These are independent lifecycle slots:

- LLM
- STT
- TTS
- Realtime

No provider owns the lifecycle of another provider.

Examples:

- changing LLM must not destroy STT
- disabling TTS must not disable Chat
- changing STT must not alter conversation history
- Realtime must not become mandatory for Chat
- Chat must not require TTS
- Voice must not require one specific LLM provider

Provider adapters are created and destroyed independently according to actual demand.

---

## 14. Chat Lifecycle

Opening Chat creates the Chat runtime.

Closing Chat destroys the Chat runtime.

Closing Chat never quits the application.

Closing Chat never deletes conversation history.

If Brain is still required by another active channel, Brain remains alive.

If no feature requires Brain, its idle timer begins.

---

## 15. Window Lifecycle

| Window/resource | Create | Destroy |
|---|---|---|
| Character | Show Saeed | Hide Saeed |
| Chat | User opens Chat | User closes Chat |
| Control Center | User opens it | User closes it |
| Character preview/editor | User opens the relevant feature | Feature closes |

Closing any window must never terminate the application.

---

## 16. Application Quit Contract

Normal application Quit is controlled only by the authoritative Core/Tray lifecycle owner.

During Quit:

1. stop accepting new user requests
2. stop autonomous Character behavior
3. stop microphone capture
4. stop VAD/STT
5. stop TTS playback
6. close Realtime
7. finish or safely cancel active Brain work
8. stop plugins
9. destroy Chat
10. destroy Character
11. destroy Control Center
12. release remaining runtime resources
13. flush required persistent state
14. release tray/Core resources
15. exit

Shutdown must be idempotent.

Calling shutdown twice must not cause duplicate destruction or crashes.

Closing Character, Chat, or Control Center must never quit the application.

---

## 17. Single-Instance Contract

Saeed must be single-instance.

A second launch must not create a second application runtime.

The existing instance receives the handoff and may:

- restore/show Saeed
- focus the appropriate UI
- handle the request

The second process terminates after successful handoff.

This prevents duplicate:

- tray owners
- Brain instances
- Character runtimes
- microphone capture
- provider connections
- conversation state

---

## 18. Startup Contract

Clean startup must:

1. establish the single application instance
2. initialize Core/Tray
3. load persistent settings
4. load persistent character configuration
5. restore required persistent state
6. establish the configured initial Character state
7. create only resources required by that state

Startup must not eagerly create:

- Brain without a reason
- STT while mic is OFF
- TTS without speech output
- Realtime when inactive
- Chat when closed
- hidden Character resources

---

## 19. Persistence vs Runtime State

Persistent state may include:

- conversation history
- settings
- provider selections
- Character profile
- Character identity
- plugin metadata
- user preferences
- memory/learned data

Runtime state may include:

- window handles
- active provider connections
- timers
- audio streams
- render resources
- transient subscriptions
- temporary workers
- service instances

Destroying a runtime service must never destroy persistent user data.

Every destroyed service must be reconstructible from persistent state.

---

## 20. Window Position

Window position is runtime state unless explicitly made a persistent user preference.

A fresh process launch must place the Character automatically near the bottom-right of the Windows work area.

A drag does not automatically become persistent configuration.

The implementation must use the actual Windows work area.

---

## 21. Render Lifecycle

Rendering is demand-driven.

There must be no permanent render loop while nothing is changing.

Rendering is active only while required by:

- animation
- interaction
- motion
- loading
- visual transitions
- other active visual work

When Character is visually idle, continuous rendering stops.

Character destruction terminates all rendering activity.

This rule also applies to previews/editors.

---

## 22. Autonomous Character Lifecycle

Autonomous Character behavior is owned by the Character runtime, but lifecycle remains owned by Core/Tray.

When Character is destroyed:

- autonomous scheduling stops
- autonomous timers stop
- autonomous events expire
- autonomous subscriptions are removed
- autonomous behavior cannot recreate Character

Therefore:

> Character owns behavior.
>
> Core/Tray owns whether Character exists.

This boundary is mandatory.

---

## 23. Error Isolation

A feature failure must not unnecessarily terminate unrelated features.

### Invalid Character model

- application remains alive
- failure is reported
- persistent configuration is preserved where possible
- conversation remains intact
- recovery remains possible

### STT failure

- Chat remains available
- voice error is reported
- retry/provider replacement remains possible
- conversation history remains intact

### TTS failure

- text response remains available
- speech bubble remains available
- TTS can be retried/replaced
- Brain and Chat remain alive

### LLM failure

- user input remains preserved
- failure is reported
- Voice/Chat lifecycle remains valid
- retry/provider replacement remains possible

### Plugin crash

A plugin crash must not crash the application lifecycle owner.

---

## 24. Stale Event Protection

Destroyed resources must not continue affecting the application.

After destruction:

- late provider events are ignored
- late audio callbacks are ignored
- late network responses are ignored
- late animation callbacks are ignored
- late timers cannot resurrect the resource
- late UI events cannot operate on destroyed windows

A destroyed resource must never silently recreate itself.

Only the authoritative lifecycle owner may recreate it.

---

## 25. Dependency Rules

Dependencies are directional.

Examples:

- Chat → Brain
- Voice input → STT → Brain
- Brain → LLM when required
- Brain reply → TTS when voice output is enabled
- Character → Character-local rendering and animation

A dependent resource may request its dependency.

It may not become the dependency's lifecycle owner.

When no valid active owner requires a dependency, that dependency becomes eligible for destruction.

---

## 26. Active Ownership Rule

The implementation may use reference counting, dependency tracking, ownership tokens, or another deterministic mechanism.

The architectural rule is:

> A runtime resource remains alive only while a valid active lifecycle owner requires it.

When the final valid owner releases it, it must be destroyed immediately when safe or after its explicit documented idle grace period.

Resources must never remain alive merely because they might be useful later.

---

## 27. Idle Timeouts

Idle timeout is not a substitute for ownership.

A resource with no valid owner must be destroyed immediately when safe, or after its documented grace period.

Default inherited values:

| Resource | Idle policy |
|---|---|
| Brain | 2 minutes |
| TTS | 30 seconds |
| STT/VAD | immediately when mic OFF |
| Character | immediately when hidden |
| Chat | immediately when closed |
| Control Center | immediately when closed |
| Realtime | when Realtime mode ends and no owner remains |
| Plugin | declared plugin-specific timeout |

Timeouts reset only from genuine activity.

Background polling does not count as genuine activity.

---

## 28. Memory and Performance Targets

Lifecycle correctness must be measured, not assumed.

Inherited target budgets:

| State | Target |
|---|---|
| Tray only | Core approximately under 30 MB |
| Character visible and idle | Total approximately under 200 MB including browser/WebView runtime |
| Character hidden | Return toward tray-only baseline |

These are targets to verify.

Diagnostics should report:

- running services
- service state
- last activity
- provider
- resource lifetime
- memory where measurable
- ownership/dependency state

---

## 29. Lifecycle Diagnostics

Diagnostics should expose the actual state of:

- Core
- Character
- Chat
- Brain
- Voice
- STT
- TTS
- Realtime
- plugins
- timers
- last activity
- idle countdown
- destruction state
- current owner/dependency

A resource must not be reported as destroyed while its process, connection, timer, or other runtime resource is still alive.

---

## 30. Mandatory Lifecycle Invariants

### Invariant 1
Exactly one application lifecycle owner exists.

### Invariant 2
Unused windows and services are destroyed, not merely hidden.

### Invariant 3
Closing a feature window cannot quit the application.

### Invariant 4
Normal Quit is controlled by Core/Tray.

### Invariant 5
Unused services are not eagerly created at startup.

### Invariant 6
Hiding Character releases its runtime/rendering resources.

### Invariant 7
Mic OFF means microphone capture, VAD, and STT are destroyed.

### Invariant 8
Mute stops/destroys TTS without deleting text responses or conversation history.

### Invariant 9
Destroying Chat, Brain, Character, Voice, or TTS does not delete persistent conversation history.

### Invariant 10
LLM, STT, TTS, and Realtime are independent provider slots.

### Invariant 11
Destroyed resources cannot act through stale callbacks.

### Invariant 12
Idle Character has no permanent render loop.

### Invariant 13
A second launch cannot create a second application runtime.

### Invariant 14
Optional feature failure cannot unnecessarily terminate the application.

### Invariant 15
Destroyed resources cannot self-resurrect.

### Invariant 16
Persistent state survives runtime destruction and restart.

---

## 31. Lifecycle State Machine

    CORE + TRAY
    Permanent
         |
         +-------------------+-------------------+
         |                   |                   |
         v                   v                   v
    Character ON         Chat ON             Mic ON
         |                   |                   |
         v                   v                   v
    Character Runtime      Brain           Voice Runtime
                             |               /        \
                             v              v          v
                            LLM            STT         TTS
                                             |
                                             v
                                      Shared Conversation
                                             |
                                             v
                                       Active Services
                                             |
                                             v
                                        Idle Detection
                                             |
                                             v
                                      Destroy Unused
                                             |
                                             v
                                       CORE + TRAY

There must be no path where an unused service remains permanently resident without an explicit architectural reason.

---

## 32. Shutdown State Machine

    RUNNING
       |
       v
    QUIESCING
       |
       +-- reject new work
       +-- stop autonomous behavior
       +-- stop microphone
       +-- stop audio output
       +-- close realtime
       +-- finish/cancel active requests
       +-- stop plugins
       |
       v
    DESTROYING
       |
       +-- destroy Chat
       +-- destroy Character
       +-- destroy Control Center
       +-- destroy Brain
       +-- release remaining resources
       |
       v
    PERSISTENCE FLUSH
       |
       v
    CORE/TRAY RELEASE
       |
       v
    EXIT

Shutdown must be deterministic and idempotent.

---

## 33. Acceptance Contract

Lifecycle implementation is not complete because it compiles.

Runtime acceptance must verify:

1. clean installation starts
2. existing profile starts
3. second launch does not create a second instance
4. Character can be shown
5. Hide destroys Character
6. Show recreates Character
7. closing Character does not quit the application
8. Chat opens and closes independently
9. Brain starts only when needed
10. Brain becomes idle and is destroyed
11. Mic ON creates capture/VAD/STT resources
12. Mic OFF destroys capture/VAD/STT
13. TTS is created only when needed
14. Mute stops/destroys TTS
15. Realtime starts and stops independently
16. Voice and Chat continue the same conversation
17. conversation survives service destruction
18. hidden Character has no active rendering/browser process
19. idle rendering stops
20. invalid Character data does not crash the application
21. plugin failure does not crash the application
22. shutdown releases runtime resources
23. memory returns toward the expected baseline
24. stale callbacks cannot revive destroyed resources

A green compile without a passing runtime lifecycle test is not a lifecycle pass.

---

## 34. Five-Minute Lifecycle Simulation

The mandatory natural lifecycle test is:

1. Start application.
2. Confirm Core/Tray is alive.
3. Show Character.
4. Leave Character idle.
5. Open Chat.
6. Send a message.
7. Close Chat.
8. Turn microphone ON.
9. Speak.
10. Receive a response.
11. Mute TTS.
12. Continue using the speech bubble.
13. Turn microphone OFF.
14. Hide Character.
15. Wait for Brain idle timeout.
16. Confirm feature resources are destroyed.
17. Show Character again.
18. Confirm Character reconstructs correctly.
19. Open Chat again.
20. Confirm the same conversation continues.
21. Quit through Tray.
22. Confirm complete runtime shutdown.

Both behavior and resource destruction must be verified.

---

## 35. CI and Runtime Verification

Lifecycle requirements must be verified by runtime tests, not only static compilation.

Verification should include:

- process count
- child process count
- window existence
- single-instance handoff
- Character destruction
- browser/WebView process disappearance
- memory before and after destruction
- idle render behavior
- service activation/deactivation
- persistence across restart
- corrupted resource recovery
- clean shutdown

A green build without a passing installed-runtime lifecycle test is not a complete pass.

---

## 36. Architectural Ownership Boundaries

### Core/Tray owns

- application lifetime
- feature creation/destruction
- shutdown
- single-instance
- lifecycle orchestration

### Character Runtime owns

- character behavior
- animation
- character-local rendering state
- character-local input
- autonomous behavior

### Brain owns

- conversational reasoning
- semantic intent
- conversational tool orchestration

### Voice owns

- microphone capture
- VAD
- STT
- TTS
- Realtime voice transport

### Chat owns

- Chat presentation
- Chat input
- conversation presentation

### Persistent Store owns

- durable conversation/history
- durable settings
- durable character profile
- other explicitly persistent data

No feature may silently take over another feature's lifecycle ownership.

---

## 37. Relationship to Character Architecture

Character Architecture defines what Saeed does.

Lifecycle Architecture defines when the Character runtime exists.

Therefore:

> CharacterController owns Character behavior.
>
> Core/Tray owns whether the Character runtime exists.

The Character runtime may not bypass this boundary.

Autonomous behavior may not recreate a destroyed Character.

---

## 38. Relationship to Voice and Conversation Architecture

Voice/Conversation Architecture defines how Chat, Voice, Brain, STT, TTS, Realtime, providers, and shared history operate.

Lifecycle Architecture defines when those resources exist.

Therefore:

- Voice may exist without Chat.
- Chat may exist without Voice.
- Brain may serve both.
- TTS may be destroyed while the conversation continues.
- STT exists only while voice input requires it.
- Realtime exists only while its mode is active.
- Conversation history survives destruction of all runtime voice/chat services.

---

## 39. Forbidden Lifecycle Patterns

The following are architectural violations:

- keeping hidden windows alive for convenience
- keeping Brain permanently alive without an active requirement
- keeping STT/VAD alive while mic is OFF
- keeping TTS alive while muted
- keeping Realtime open after its owner ends
- permanent render loops while idle
- allowing a feature window to own application shutdown
- creating a second lifecycle manager
- allowing destroyed services to resurrect themselves
- allowing stale callbacks to mutate destroyed state
- deleting conversation history when Chat closes
- coupling one provider's lifetime to another
- crashing the application because an optional resource failed
- using background polling instead of real lifecycle ownership
- claiming lifecycle correctness from compilation alone

---

## 40. Final Lifecycle Law

> The application shell stays alive; feature resources do not.

Core/Tray is permanent.

Character, Chat, Brain, Voice, STT, TTS, Realtime, Control Center, plugins, renderers, workers, and other feature resources exist only while required.

When their work is finished, they are destroyed.

Persistent user state survives.

Runtime resources do not.

The final authoritative rule is:

> If it is not used, destroy it. Do not hide it.

---
# 34. Exact Runtime Startup Contract

Normal startup is mandatory in this order:
1. Acquire the single-instance lock.
2. Start the single authoritative Core/Tray owner.
3. Load persistent settings and Character configuration.
4. Create the Character runtime because the default product state is Saeed visible.
5. Start the 3D Engine resources required to display the Character.
6. Character starts with MIC OFF.
7. Do not create STT, microphone capture, VAD, TTS, Realtime or Brain merely because Character exists.
8. Character-local behavior starts only after Character initialization completes.

Initial runtime = Core/Tray + Character + Engine + MIC OFF.

# 35. Exact Feature Demand Contract

Every feature follows: user action or valid system trigger -> Core requests feature -> dependencies are created -> feature operates -> feature closes/stops -> dependencies with no remaining owner are destroyed.

## 35.1 Chat
Chat Me creates Chat and requests the shared Conversation/Brain capability. Brain Router is created only when required. Opening Chat does not create microphone, STT, TTS or Realtime merely because the window opened.
Closing Chat destroys Chat. Conversation history remains persistent. Brain remains alive only while another active owner requires it or until its documented idle timeout.

## 35.2 Standard Voice
MIC ON creates microphone capture, VAD and STT when transcription is required. Brain is created when a transcript becomes a conversational request. TTS is created only when spoken output is required and voice output is unmuted.
MIC OFF destroys microphone capture, VAD and STT and invalidates pending voice-input callbacks. Brain remains if Chat or another active conversational owner requires it.

## 35.3 Mute
Mute controls output only. TTS is stopped/destroyed and new spoken playback is blocked. Text, bubble, Chat, Brain and microphone input may continue if their own state requires them. Unmute allows TTS to be recreated on demand.

## 35.4 Realtime
Realtime is an alternative voice transport/session mode. When active, Realtime owns the active voice audio route. Standard STT is not created for that route. Standard TTS is not created when the selected Realtime provider supplies native audio output. Provider events are translated into the common Saeed conversation contract.
Realtime therefore uses Mic -> Realtime -> streaming conversation/audio instead of Mic -> STT -> Brain/LLM -> TTS.
Stopping Realtime closes its connection and releases its resources. Standard voice resources become eligible to be recreated when standard mode is selected. If a provider lacks native audio output, standard TTS may be used only as an explicit documented fallback.

## 35.5 Character Hide
Hide Saeed stops Character behavior and autonomous scheduling, destroys the Character window and Engine/renderer, releases GLB/scene/GPU resources, stops Character-local voice resources, turns off microphone capture, destroys VAD/STT, stops/destroys TTS, stops/destroys Realtime, and releases Character-owned Brain dependencies.
Chat is independent of Character. If Chat remains open, Core/Tray + Chat + Brain may remain alive. If Chat is also closed and no other conversational owner exists, Brain becomes idle and is destroyed after its documented timeout.
Hide Saeed is never Quit application.

# 36. Exact Resource Dependency Model
Core/Tray creates and destroys feature runtimes. Character owns Character Engine and Character-local behavior. Chat consumes shared Conversation and Brain when required. Standard Voice consumes Mic, VAD, STT, shared Conversation/Brain and optional TTS. Realtime consumes its own transport/session and shared Conversation. TTS exists only when spoken output is required.
A resource may have multiple consumers, but it has one lifecycle owner. Chat and Voice may both require Brain; neither directly owns Brain destruction.

# 37. Runtime State Examples
Fresh launch: Core/Tray + Character + Engine + MIC OFF.
Chat Me: add Chat + Brain; STT remains OFF, TTS remains OFF unless requested, Realtime remains OFF.
Chat + Mic ON + Unmuted: add Mic + VAD + STT and TTS on demand.
Chat + Mic ON + Muted: same, except TTS is OFF/destroyed.
Realtime active: add Realtime; standard STT is OFF and standard TTS is OFF when Realtime supplies audio.
Hide Saeed while Chat remains open: Core/Tray + Chat + Brain. Character, Engine, Mic, VAD, STT, TTS and Realtime are destroyed unless explicitly owned elsewhere.
Hide Saeed and close Chat: Core/Tray; Brain becomes idle and is destroyed according to its timeout.

# 38. Character Preparation and Rigging Lifecycle
A new Character follows: New GLB -> Asset Inspection -> Skeleton Detection -> Rig Mapping or Rig Creation -> Joint Placement -> Rest Pose Correction -> Retargeting Validation -> Motion Generation -> Motion Validation -> Character Profile Save -> Available Character.
Motion generation must not be the first step. The rest pose is the reference state for generated and retargeted motion.

# 39. Rigging Is Optional for Visual Use
Rig preparation is not mandatory for displaying a Character. If a GLB has no usable skeleton, the user may open the Character Preparation panel, perform guided mapping/rig creation where supported, or skip the process. Skipping rigging leaves the Character intact and available as a static/non-animated Character.

# 40. Guided Rig Mapping and Bone Creation
The Character Preparation panel must support, where technically possible: automatic skeleton detection; automatic logical-joint mapping; manual mapping; manual joint placement; creation of missing rig structure where the asset format and Engine permit it; rest-pose correction; validation; confidence/suspicion indicators; and saving/reopening the mapping configuration.
The user may accept incomplete mapping. Incomplete mapping produces a capability-limited Character, not a failed Character.

# 41. Rest Pose Is Authoritative
Before generating or validating motion: establish the physical skeleton; map logical joints; correct joint placement; establish the intended rest pose; validate orientation, scale and axes; only then generate or retarget motion.
Motion generated against an incorrect rest pose is invalid until corrected and revalidated. Changing the rest pose may require regeneration or revalidation of affected motions.

# 42. Capability-Based Animation
Animation generation and playback are capability-aware. Missing optional bones never invalidate the whole Character.
Examples: no eyes -> body motion works but blink is disabled or falls back; no fingers -> finger motions are disabled or use a hand/arm fallback; no facial rig -> facial motions are disabled or use available body/voice reactions; no neck -> head-specific motion is disabled or uses an available fallback.

# 43. Animation Capability Matrix
Each Character exposes capabilities such as Body, Arms, Legs, Neck, Eyes, Blink, Face and Fingers. Each capability has availability, motion eligibility and fallback information.

# 44. Animation Control / Motion Editor
Saeed must provide a dedicated Character Motion/Animation Control surface. It must allow listing motions, previewing, play/pause/stop, adjusting supported playback parameters, enabling/disabling individual motions, inspecting required capabilities, previewing transitions, identifying invalid/suspicious mappings, and saving motion configuration.
Disabling a motion does not delete its source. Disabled motions are unavailable to autonomous and semantic motion selection until re-enabled.

# 45. In-Program Pose and Rig Correction
The Character Preparation/Motion Editor must provide an authoring mode for correcting physical problems. Where supported, the user can select logical and physical joints, inspect position/orientation, adjust transforms, correct rest-pose alignment, preview, save and revalidate affected motions.
This is an authoring path, not a normal runtime behavior path.

# 46. Motion Generation Contract
Correct order: GLB -> Rig -> Rest Pose -> Capabilities -> Motion Generation.
Forbidden order: GLB -> Motion Generation -> discover/fix rig afterward.
Generated motion must be validated against the current rig mapping, current rest pose, available capabilities, safety constraints and transition compatibility.

# 47. Motion Availability States
Every motion has one of: enabled; disabled by user/configuration; unavailable because a capability is missing; invalid pending correction. These states must not be conflated.

# 48. Editor vs Runtime Boundary
The editor is an authoring tool. It may modify rig mapping, rest pose, motion definitions, motion enablement and capability configuration. It must not become a second CharacterController, MotionPolicy, scheduler or Brain. Normal runtime remains under the single authoritative Character Runtime.

# 49. Character Preparation Acceptance
Fully rigged Character: skeleton detected or created, logical joints mapped, rest pose corrected, capabilities identified, motion generation/retargeting succeeds, motions validate and profile saves.
Static Character: if the user skips rigging, the GLB remains intact, animation is unavailable, no fake skeleton is assumed, and the user can return later to Character Preparation.
Partial Character: supported motions work, unsupported motions are disabled, Character remains valid and no global failure is produced.

# 50. Character Editor Atomic Commit
Opening the Character Editor must not modify the active Character until the user explicitly commits changes.
Preferred flow: Current Character -> Edit Candidate -> Validate -> Preview -> Commit -> Character Runtime reloads or retargets.
If validation fails, the current Character remains unchanged.