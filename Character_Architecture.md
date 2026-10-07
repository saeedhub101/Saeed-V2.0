
# Saeed 3D Character Architecture

**Project:** Saeed AI  
**Character:** Saeed  
**Type:** 3D humanoid character  
**Reference:** Merlin-style intent-driven character architecture  
**Runtime:** Three.js + GLB + skeletal runtime  
**Status:** Authoritative implementation contract  
**Version:** 2.0

---

## 1. Purpose

This document defines the authoritative architecture for the Saeed 3D Character Runtime.

The character must be independent from the rest of the application in the same fundamental way as the Merlin architecture: the application Brain reports semantic meaning and events, while a dedicated CharacterController owns visual behavior, motion selection, scheduling, state, mood and animation execution.

Saeed is not an animation clip library.

The required architecture is:

    User
      ↓
    Brain / LLM
      ↓
    Semantic Character Event
      ↓
    CharacterController
      ↓
    Motion Intent
      ↓
    Motion Generator
      ↓
    Motion Safety
      ↓
    CharacterRetargeter
      ↓
    CharacterRig
      ↓
    Current GLB Skeleton
      ↓
    Three.js Renderer
      ↓
    Saeed 3D

Text output is a parallel character output:

    Brain response
       ├──→ BubbleController → message above Saeed
       ├──→ TTS / voice
       └──→ speaking character behavior

The body may change by loading another GLB. The character-control architecture must not change.

---

# 2. Architectural Red Lines

These rules are mandatory.

1. Exactly one authoritative CharacterController exists.
2. CharacterController owns character behavior.
3. AvatarRenderer only renders and manages the loaded 3D asset.
4. Brain never manipulates bones.
5. Tools never manipulate bones.
6. The LLM never specifies raw GLB bone names.
7. The LLM never specifies raw quaternion or Euler transforms.
8. Character behavior is expressed semantically.
9. State, mood and motion intent are separate concepts.
10. Motion generation is independent from the Brain.
11. Motion generation is independent from the renderer.
12. The GLB must not be required to contain pre-made animation clips.
13. Motion definitions use logical joint names, not model-specific GLB names.
14. CharacterRetargeter maps logical joints to the current GLB.
15. CharacterProfileStore stores per-character mapping/rest-pose/custom state.
16. A failed GLB replacement must never destroy the currently working character.
17. Changing the GLB must not create a second Brain.
18. Changing the GLB must not create a second CharacterController.
19. Bubble messages belong to the character presentation layer, but bubble text comes from the authoritative response.
20. Every normal user-facing Saeed response must be able to appear above the character.
21. Idle behavior must not be a permanent heavy render/animation workload.
22. Recent motions must be tracked and repeated motions penalized.
23. Major motions and micro motions must be separate layers.
24. MotionSafety must validate generated skeletal movement.
25. The architecture must remain usable when optional bones are missing.
26. Runtime character state belongs in user data, not bundled source.
27. Future agents must extend the existing owners instead of creating parallel systems.

If a proposed implementation violates one of these rules, the implementation must be redesigned.

---

# 3. Existing Saeed Character Foundation

The current Saeed-v2.0 repository already contains the correct foundation for this architecture:

- CharacterController
- AnimationController
- CharacterRig
- CharacterRetargeter
- AutoRigMapper
- MotionRegistry
- MotionSequence
- MotionSafety
- FaceController
- FingerController
- CharacterProfileStore
- MotionEditor
- Three.js GLB loading
- rest-pose normalization
- character diagnostics
- character status
- character selection / GLB replacement
- message bubble support

These components should be extended and separated cleanly, not duplicated.

The intended logical ownership is:

    CharacterController
       ├── state
       ├── mood
       ├── energy
       ├── semantic intents
       ├── idle scheduling
       ├── event reactions
       ├── recent-motion history
       ├── priority
       └── motion orchestration

    AnimationController
       ├── active motion instances
       ├── layers
       ├── blending
       ├── playback
       └── pose application

    CharacterRig
       └── logical joint → actual bone

    CharacterRetargeter
       └── logical motion → model-specific skeleton

    MotionGenerator
       └── semantic motion request → skeletal motion

    AvatarRenderer
       └── GLB / Three.js / rendering

---

# 4. Merlin Principle

The important Merlin idea being adopted is not its 2D sprite technology.

The important idea is the separation:

    LLM intent
       ↓
    character state / mood
       ↓
    animation controller
       ↓
    context-aware motion selection
       ↓
    actual visual motion

Therefore a command such as:

    status = happy

does NOT mean:

    play animation named "happy"

Instead it means:

    set or update the emotional state to happy

The CharacterController then considers:

- current state
- current mood
- energy
- current conversation phase
- user interaction
- tool activity
- time/context
- recent motions
- motion priority
- character capabilities

and selects or generates an appropriate motion intent.

---

# 5. Three Independent Concepts

## 5.1 State

State describes what Saeed is doing.

Examples:

- loading
- idle
- listening
- thinking
- speaking
- reacting
- acting
- sleeping
- hidden
- transitioning
- error

## 5.2 Mood

Mood describes Saeed's emotional presentation.

Examples:

- neutral
- happy
- sad
- curious
- thoughtful
- surprised
- confused
- excited
- pleased
- concerned
- playful
- sleepy

## 5.3 Motion Intent

Motion intent describes the physical behavior to generate.

Examples:

- greet
- wave
- acknowledge
- thoughtful head tilt
- open gesture
- surprised recoil
- searching gesture
- pleased reaction

Example:

    state = speaking
    mood = happy
    intent = expressive-open-gesture

These must remain separate.

---

# 6. Complete Runtime Architecture

    +-------------------- SAeed Application --------------------+
    |                                                            |
    |  Chat / Mic / Tools / System Events / User Interaction    |
    |                         |                                  |
    +-------------------------+----------------------------------+
                              |
                              v
                     Semantic Event Gateway
                              |
                              v
                 +---------------------------+
                 |     CharacterController   |
                 |---------------------------|
                 | state                     |
                 | mood                      |
                 | energy                    |
                 | context                   |
                 | event reactions           |
                 | idle scheduler            |
                 | motion history            |
                 | priority                  |
                 | semantic intent           |
                 +-------------+-------------+
                               |
                               v
                       Motion Policy
                               |
                               v
                       Motion Generator
                               |
                               v
                         Motion Safety
                               |
                               v
                     CharacterRetargeter
                               |
                               v
                         CharacterRig
                               |
                               v
                        Loaded GLB
                               |
                               v
                       AvatarRenderer

Parallel:

    Brain response
       ├──→ BubbleController
       └──→ TTS

---

# 7. CharacterController

CharacterController is the single source of truth for visual character behavior.

It owns:

- current state
- current mood
- energy
- visibility
- animation enabled/paused state
- semantic intent
- event handling
- idle scheduling
- recent motion history
- motion priority
- motion interruption
- motion selection
- motion generation requests
- motion lifecycle
- speaking behavior
- listening behavior
- thinking behavior
- reacting behavior

It does not own:

- LLM execution
- tool execution
- API selection
- permissions
- Three.js scene construction
- GLB parsing
- application lifecycle

---

# 8. Character Event Gateway

All external character requests enter through one semantic gateway.

Possible events:

    user_speech_start
    user_speech_end
    thinking_start
    thinking_end
    speech_start
    speech_end
    tool_start
    tool_success
    tool_error
    user_click
    user_double_click
    user_drag
    character_show
    character_hide
    character_loaded
    character_changed
    system_notification

Example:

    {
      type: "tool_start",
      tool: "web_search"
    }

The event gateway converts the event into a character intent. It must not directly rotate bones.

---

# 9. Semantic LLM Interface

The LLM may produce semantic information such as:

    emotion: happy
    state: thinking
    intent: greet
    intensity: 0.7

or an internal event:

    {
      "type": "character.intent",
      "intent": "acknowledge",
      "intensity": 0.55
    }

It must never produce:

    rotate LeftUpperArm
    head.y = 0.5
    quaternion = ...
    play GLB animation "Happy"

The LLM describes WHAT. The character runtime determines HOW.

---

# 10. Example: status = happy

Input:

    setMood("happy")

Processing:

    mood = happy
          ↓
    inspect current state
          ↓
    inspect energy
          ↓
    inspect context
          ↓
    inspect recent motions
          ↓
    inspect available character capabilities
          ↓
    choose motion family
          ↓
    create motion intent
          ↓
    MotionGenerator
          ↓
    skeletal motion

Example generated intent:

    {
      "emotion": "happy",
      "family": "positive_gesture",
      "intensity": 0.62,
      "duration": 2.1,
      "gaze": "user",
      "head": "slight_tilt",
      "bodyLanguage": "open",
      "face": "smile"
    }

The same happy state can generate many different movements.

---

# 11. Motion Families

Motion families are semantic categories, not animation files.

## Happy

Possible families:

- nod
- positive head tilt
- open posture
- small bounce
- wave
- hand gesture
- excited gesture
- smile + nod

## Sad

Possible families:

- head down
- shoulder relaxation
- reduced movement
- slow gesture
- reduced eye contact

## Thinking

Possible families:

- gaze away
- head tilt
- hand-to-chin
- slow nod
- subtle weight shift

## Curious

Possible families:

- forward lean
- head tilt
- focused gaze
- small hand gesture

## Surprised

Possible families:

- head recoil
- widened eyes
- raised hands
- torso recoil
- mouth opening

## Greeting

Possible families:

- wave
- nod
- open-hand greeting
- smile
- small bow

---

# 12. One Emotion Must Never Equal One Animation

Incorrect:

    happy → happy.glb

Correct:

    happy
       ├── nod
       ├── head tilt
       ├── smile
       ├── open gesture
       ├── light bounce
       ├── wave
       └── expressive hand gesture

Selection is context-aware.

---

# 13. Motion History

The controller must maintain recent motion history.

Recommended information:

    recentMotionIds
    recentMotionFamilies
    recentGestureTypes
    lastMajorMotion
    lastMicroMotion
    timestamps

A motion that occurred recently receives a repetition penalty.

Example:

    recent = [wave, nod, wave]

A new wave should be strongly penalized unless the event explicitly requires it.

This prevents robotic repetition.

---

# 14. Motion Selection

Conceptually:

    score =
        baseWeight
      + moodCompatibility
      + stateCompatibility
      + eventCompatibility
      + energyCompatibility
      + contextCompatibility
      + capabilityCompatibility
      - recentMotionPenalty
      - recentFamilyPenalty

The exact mathematical implementation can change.

The architectural requirement cannot change:

> Motion selection must consider context and recent history.

---

# 15. Variation

A repeated semantic motion should not necessarily produce identical movement.

Variation parameters:

- amplitude
- speed
- duration
- direction
- left/right side
- head angle
- shoulder contribution
- weight shift
- hand choice
- pause length
- acceleration
- deceleration
- gesture size

For example, "nod" can be:

- one quick nod
- two small nods
- one slow confident nod
- nod + head tilt
- nod + smile
- nod + hand gesture

---

# 16. Energy

Energy is a continuous parameter.

Example:

    energy = 0.20

should produce:

- smaller movements
- slower speed
- lower amplitude
- longer pauses

Example:

    energy = 0.90

should produce:

- larger movements
- faster gestures
- more body involvement
- stronger reactions

Energy is independent from mood.

Possible combinations:

    happy + low energy
    sad + high energy
    thoughtful + high energy
    excited + low energy

---

# 17. Intensity

Every semantic motion should support intensity.

Recommended range:

    0.0  almost invisible
    0.25 subtle
    0.50 normal
    0.75 strong
    1.0  maximum

Intensity can affect:

- joint amplitude
- gesture size
- speed
- number of participating joints
- facial expression
- body involvement

---

# 18. Major and Micro Motions

Two categories are required.

## Major

Examples:

- greet
- wave
- celebrate
- surprised
- dance
- major thinking gesture
- major sad reaction

## Micro

Examples:

- breathing
- blink
- eye movement
- tiny head adjustment
- weight shift
- posture correction
- finger adjustment
- subtle facial movement

Micro motions should be able to run underneath or around major motions when compatible.

This creates an alive 3D character rather than a model that simply switches between clips.

---

# 19. Motion Layers

Recommended layers:

    base
    body
    arms
    head
    face
    hands
    special

Example:

    base  = posture / breathing
    body  = weight shift
    arms  = gesture
    head  = head movement
    face  = smile / eyebrows
    hands = fingers
    special = high-priority action

Layers allow head, face and hand behavior to coexist.

---

# 20. Motion Generator

MotionGenerator is a separate subsystem.

Input:

    {
      "characterId": "...",
      "state": "speaking",
      "emotion": "happy",
      "intent": "acknowledge",
      "family": "positive_gesture",
      "intensity": 0.62,
      "energy": 0.75,
      "duration": 2.2,
      "gaze": "user",
      "capabilities": {},
      "recentMotionIds": [],
      "seed": 128392
    }

Output:

    {
      "duration": 2.2,
      "loop": false,
      "layers": ["body", "arms", "head", "face"],
      "keyframes": [
        {"time": 0, "pose": {}},
        {"time": 0.7, "pose": {}},
        {"time": 1.4, "pose": {}},
        {"time": 2.2, "pose": {}}
      ]
    }

The generator can later be:

- procedural
- rule-based
- local AI
- remote AI
- neural motion model
- hybrid

CharacterController must not depend on the implementation technology.

---

# 21. Future AI Motion Generator

The architecture must allow:

    Character Intent
          ↓
    AI Motion Planner
          ↓
    AI Motion Generator
          ↓
    Motion Safety
          ↓
    Skeleton

The AI model is a motion generator, not an application Brain.

It must be constrained by:

- character capabilities
- joint limits
- duration
- intensity
- style
- emotion
- state
- context
- recent motion history
- safety rules

---

# 22. Motion Safety

Generated motion must pass validation before being applied.

Pipeline:

    generated motion
          ↓
    validate
          ↓
    clamp
          ↓
    blend
          ↓
    apply

Safety must reject or clamp:

- NaN
- Infinity
- invalid transforms
- excessive joint rotation
- impossible poses
- excessive acceleration
- invalid duration
- unsupported joints

---

# 23. Logical Rig

Motion must use logical joints.

Recommended:

    hips
    spine
    chest
    neck
    head
    jaw

    leftShoulder
    leftUpperArm
    leftForeArm
    leftHand

    rightShoulder
    rightUpperArm
    rightForeArm
    rightHand

    leftThigh
    leftShin
    leftFoot

    rightThigh
    rightShin
    rightFoot

    leftEye
    rightEye

Optional finger joints may be added.

Motion code must never depend on names such as:

    mixamorig:Hips
    Armature|Bone
    Bip001 Head

Those are model-specific names.

---

# 24. Auto Rig Mapping

When a new GLB is loaded:

    GLB bone names
          ↓
    name normalization
          ↓
    aliases
          ↓
    logical mapping
          ↓
    confidence
          ↓
    CharacterRig

Examples:

    mixamorig:Hips → hips
    mixamorig:Head → head
    LeftUpperArm → leftUpperArm
    RightUpperArm → rightUpperArm

Automatic mapping is preferred.

Manual mapping remains available for ambiguous models.

---

# 25. Required Rig

Minimum logical bones:

- hips
- head
- leftUpperArm
- rightUpperArm
- leftThigh
- rightThigh

Recommended optional bones:

- spine
- chest
- neck
- forearms
- hands
- shins
- feet
- jaw
- eyes
- fingers

Missing optional bones are capabilities, not automatic failures.

---

# 26. Character Capabilities

After loading a GLB, the runtime should calculate capabilities.

Example:

    {
      "head": true,
      "jaw": true,
      "eyes": true,
      "hands": true,
      "fingers": false,
      "faceMorphs": true,
      "fullBody": true
    }

The Motion Policy must use these capabilities.

If a motion requires a hand but the model has no hand bone, the controller must select a fallback.

Example:

    handToChin unavailable
          ↓
    headTilt + gazeAway

---

# 27. CharacterRetargeter

The retargeter converts logical motion to the current character.

Pipeline:

    Motion Generator
          ↓
    logical joint motion
          ↓
    CharacterRetargeter
          ↓
    actual GLB bones

This is the key mechanism that makes GLB replacement possible.

---

# 28. Rest Pose

Every character needs a valid base/rest pose.

Loading process:

1. inspect skeleton
2. determine orientation
3. detect obvious T-pose
4. normalize when possible
5. allow manual correction
6. save the result per character
7. use it as the base for future generated motion

All generated motion should be relative to the current normalized base pose.

---

# 29. Character Profiles

Every GLB gets an independent profile.

Example:

    {
      "id": "char-...",
      "name": "Saeed",
      "source": "user-selected",
      "mapping": {},
      "autoConfidence": {},
      "restPose": {},
      "idlePose": {},
      "capabilities": {},
      "customMotions": [],
      "updatedAt": "..."
    }

Profiles belong in application user data.

They must not be stored by modifying bundled source code.

---

# 30. GLB Replacement

The user must be able to select a new .glb file.

Required flow:

    Settings
       ↓
    Change Character
       ↓
    choose .glb
       ↓
    validate
       ↓
    parse
       ↓
    inspect skeleton
       ↓
    auto-map
       ↓
    validate required rig
       ↓
    load/create profile
       ↓
    normalize/apply rest pose
       ↓
    commit new model
       ↓
    rebind CharacterController
       ↓
    resume normal behavior

The Brain, conversation and tools remain unchanged.

---

# 31. Transactional GLB Replacement

Never destroy the old character first.

Correct:

    OLD CHARACTER
          |
          | load new model
          v
    validate new model
          |
          +---- failure ----→ OLD CHARACTER REMAINS
          |
          +---- success
                    ↓
              commit new model

This is mandatory.

---

# 32. GLB Load Failure

If the new file:

- is not a valid GLB
- contains no scene
- has no usable skeleton
- has incompatible data
- cannot be parsed
- fails validation

then:

- report the error
- keep the previous character
- do not restart the Brain
- do not create a second controller
- do not corrupt the previous profile

---

# 33. No Dependency on GLB Animation Clips

The runtime must not assume:

    gltf.animations["happy"]
    gltf.animations["wave"]
    gltf.animations["thinking"]

exist.

The GLB is primarily the character body/skeleton.

The motion runtime generates or applies skeletal motion.

This allows one character-control architecture to work with many different GLB models.

---

# 34. Bubble Message System

Every normal user-facing response from Saeed should appear as a message bubble above the character.

Architecture:

    Brain response
          |
          +----→ BubbleController
          |
          +----→ TTS
          |
          +----→ CharacterController speaking event

Bubble text must come from the authoritative response.

The BubbleController must not invent alternative response text.

---

# 35. Bubble Requirements

Bubble must:

- appear above Saeed
- follow Saeed's projected position
- support multi-line text
- support Arabic
- support English
- support RTL
- support LTR
- auto-size
- handle long text
- animate in
- animate out
- remain readable
- support error state
- support copy
- support configurable timeout
- remain visually associated with the character

---

# 36. Bubble Positioning

Bubble location should be calculated from the 3D character.

Pipeline:

    head/top world position
          ↓
    camera projection
          ↓
    screen coordinates
          ↓
    HTML/CSS bubble position

The bubble must not use a permanently hard-coded screen position.

It should move when Saeed moves or the camera changes.

---

# 37. Bubble Modes

Recommended:

- transient
- speaking
- persistent
- thinking
- tool-status
- error

Examples:

    "Hello, how can I help you?"

    "Thinking..."

    "Searching..."

    "I couldn't complete that action."

---

# 38. Bubble + TTS Synchronization

One response must feed both systems.

Correct:

    response
       ├──→ bubble
       ├──→ TTS
       └──→ speaking behavior

Incorrect:

    Chat response
       ├──→ one text
       ├──→ voice generates another text
       └──→ bubble generates another text

There must be one authoritative response.

---

# 39. Speaking Behavior

When speech begins:

    state = speaking

Possible layers:

- facial expression
- jaw/viseme if available
- eye attention
- head movement
- micro gesture
- semantic hand gesture

Speech must not use one fixed animation.

The gesture system should select different compatible gestures over time.

---

# 40. Listening Behavior

When user speaks:

    state = listening

Possible behavior:

- eye contact
- subtle nod
- attentive head tilt
- small posture adjustment
- minimal micro movement

Listening should not be an aggressive full-body animation.

---

# 41. Thinking Behavior

Thinking is a state, not one clip.

Possible motion:

- gaze away
- head tilt
- hand-to-chin
- slow nod
- eyebrow movement
- subtle weight shift

The controller chooses based on recent history and available bones.

---

# 42. Tool Reactions

Tools may emit semantic events.

Example:

    tool_start
       ↓
    state = acting
    mood = curious
    intent = searching

Success:

    tool_success
       ↓
    pleased reaction

Failure:

    tool_error
       ↓
    concerned reaction

Tools must never manipulate the character directly.

---

# 43. Priority

Recommended priority bands:

    100  emergency/system
     90  major user reaction
     80  speaking gesture
     70  tool reaction
     60  greeting
     50  normal semantic motion
     30  idle
     10  micro motion

Higher-priority motion may interrupt lower-priority motion.

Lower-priority motion must not interrupt important actions.

---

# 44. Interruption

Example:

    idle
      ↓
    user question
      ↓
    thinking
      ↓
    speaking
      ↓
    idle

When the user starts a meaningful interaction, idle motion must stop or yield.

Micro motions may continue if compatible.

Major reactions can interrupt idle.

---

# 45. Blending

Transitions must be smooth.

Avoid instant changes such as:

    head = 0
    next frame
    head = 0.8

Prefer:

    current pose
        ↓
    interpolation / easing
        ↓
    target pose

Use appropriate interpolation for rotations, including quaternion interpolation when required.

---

# 46. Eye Tracking

Eye/head tracking belongs to the micro behavior layer.

Possible inputs:

- cursor position
- user focus
- application focus
- conversation state

Possible output:

- eye direction
- subtle head orientation
- attention shift

All movement must respect joint limits.

---

# 47. Blink

Blinking is a micro behavior.

Preferred sources:

1. eye morph target
2. eye bone
3. safe fallback if neither exists

Blinking must not interrupt major body motion.

---

# 48. Idle System

Idle must be intermittent.

Required pattern:

    rest
      ↓
    variable wait
      ↓
    select weighted idle
      ↓
    suppress recently used motions
      ↓
    play one-shot
      ↓
    return to rest
      ↓
    wait again

Do not use a permanent heavy 60 FPS character loop simply because the character is visible.

---

# 49. Idle Pool

Example candidates:

    nod
    think
    stretch
    lookCloser
    yawn
    crackBack
    crackFingers
    wave

Each should have:

- weight
- mood compatibility
- energy compatibility
- state compatibility
- required capabilities
- recent-motion penalty

---

# 50. Interaction Reactions

Saeed may react to:

- click
- double click
- drag
- mouse movement
- window focus
- window restore
- user speech
- response start
- response completion
- tool start
- tool success
- tool failure

Examples:

    double click → surprised / acknowledge
    drag         → playful / attention
    tool success → pleased
    tool error   → concerned
    user speech  → listening

---

# 51. Character Renderer

AvatarRenderer owns:

- Three.js scene
- camera
- lights
- canvas
- GLB loading
- current model
- mesh disposal
- skeleton discovery
- morph target discovery
- fit/scale
- camera positioning
- resize
- rendering

It must not decide:

- mood
- state
- idle motion
- LLM behavior
- tool behavior
- permissions
- API routing

---

# 52. CharacterController ↔ Renderer Contract

CharacterController may ask renderer for:

- bone map
- bone names
- capabilities
- loaded status
- character profile key
- rest pose
- current character status

Renderer may expose:

- apply logical pose
- apply raw bone pose only for controlled internal/editor operations
- set morph
- blink
- look at target
- wake render
- load/replace GLB

Renderer must not decide when these actions should happen.

---

# 53. Character Profile Isolation

When a new GLB is selected, its:

- mapping
- rest pose
- idle pose
- custom motions
- capabilities
- settings

must be associated with that character profile.

Switching back to the old GLB should restore its profile.

---

# 54. Motion Persistence

Custom motions should be stored by character.

A motion requiring optional joints must declare them.

Example:

    {
      "id": "handToChin",
      "requires": [
        "head",
        "rightUpperArm",
        "rightForeArm",
        "rightHand"
      ]
    }

If requirements are not satisfied, the controller selects a fallback.

---

# 55. Character Status

The character runtime should expose diagnostic status such as:

    {
      "characterLoaded": true,
      "characterName": "Saeed",
      "state": "speaking",
      "mood": "happy",
      "energy": 0.78,
      "activeMotions": 2,
      "boneCount": 64,
      "mappedBones": 28,
      "restPose": {
        "normalized": true
      },
      "capabilities": {
        "jaw": true,
        "eyes": true,
        "hands": true,
        "fingers": true
      }
    }

This status is for diagnostics only. It is not a second state owner.

---

# 56. Diagnostics

Report:

- GLB parse failure
- invalid scene
- missing skeleton
- mapping failure
- low mapping confidence
- missing required bones
- missing optional bones
- rest-pose problems
- T-pose detection
- motion safety rejection
- invalid generated motion
- stale generation
- renderer failure
- bubble failure

Diagnostics should feed the existing Saeed diagnostic/status system.

---

# 57. Motion Request Contract

Recommended internal contract:

    {
      "characterId": "char-...",
      "state": "speaking",
      "emotion": "happy",
      "intent": "acknowledge",
      "family": "positive_gesture",
      "intensity": 0.62,
      "energy": 0.75,
      "duration": 2.2,
      "gaze": "user",
      "capabilities": {},
      "recentMotionIds": ["nod", "wave"],
      "seed": 128392
    }

---

# 58. Motion Result Contract

Recommended result:

    {
      "duration": 2.2,
      "loop": false,
      "layers": ["body", "arms", "head", "face"],
      "keyframes": [
        {"time": 0, "pose": {}},
        {"time": 0.7, "pose": {}},
        {"time": 1.4, "pose": {}},
        {"time": 2.2, "pose": {}}
      ]
    }

The result is validated before application.

---

# 59. Async Motion Generation

Motion generation may be asynchronous.

Every request should have a generation/version identifier.

Example:

    characterGeneration = 14

If a new GLB is loaded and becomes generation 15, a motion generated for generation 14 must be discarded.

This prevents old asynchronous results from being applied to a new skeleton.

---

# 60. GLB Replacement During Motion

Required sequence:

1. stop or suspend old motion
2. load new model into temporary memory
3. validate new model
4. discover skeleton
5. map logical rig
6. load/create profile
7. apply rest pose
8. commit new model
9. bind controller
10. resume state using new capabilities

Never copy raw bone rotations directly from one unrelated skeleton to another.

---

# 61. Security

User-selected GLB files are untrusted assets.

The system must:

- validate parsed scene
- avoid executing arbitrary model metadata
- reject malformed files
- protect persisted paths
- keep runtime state in user data
- never convert GLB metadata into executable code

---

# 62. Performance

Required:

- no permanent heavy character animation loop
- generate motion only when needed
- cache compatible generated motion where useful
- cancel obsolete generation
- avoid duplicate render loops
- dispose old model resources
- avoid leaking textures/geometries/materials
- wake rendering only when needed where practical
- keep micro motion lightweight

---

# 63. Recommended Character Module Structure

    src/character/
    ├── CharacterController.js
    ├── AnimationController.js
    ├── CharacterRig.js
    ├── CharacterRetargeter.js
    ├── AutoRigMapper.js
    ├── MotionRegistry.js
    ├── MotionSequence.js
    ├── MotionSafety.js
    ├── MotionGenerator.js
    ├── MotionPolicy.js
    ├── MotionHistory.js
    ├── FaceController.js
    ├── FingerController.js
    ├── CharacterProfileStore.js
    ├── MotionEditor.js
    ├── BubbleController.js
    ├── CharacterEvents.js
    ├── motions.js
    └── client.js

The current repository may use different filenames for some responsibilities. Do not create duplicates merely to match the diagram. Extend existing modules when the responsibility already exists.

---

# 64. Ownership Map

| Responsibility | Authoritative owner |
|---|---|
| Character behavior | CharacterController |
| State | CharacterController |
| Mood | CharacterController |
| Energy | CharacterController |
| Semantic intents | CharacterController |
| Idle scheduling | CharacterController |
| Motion selection | CharacterController / MotionPolicy |
| Motion history | MotionHistory |
| Motion execution | AnimationController |
| Motion definitions | MotionRegistry / motions |
| Motion safety | MotionSafety |
| Motion generation | MotionGenerator |
| Logical rig | CharacterRig |
| Retargeting | CharacterRetargeter |
| Automatic mapping | AutoRigMapper |
| Face | FaceController |
| Fingers | FingerController |
| Character persistence | CharacterProfileStore |
| GLB / Three.js | AvatarRenderer |
| Bubble | BubbleController |
| Brain | Brain |
| Tools | Tool Registry |

One responsibility must have one authoritative owner.

---

# 65. Forbidden Architecture

Do not introduce:

- another CharacterController
- another AnimationController
- another Brain router
- another Tool Registry
- another renderer that owns character behavior
- another animation runtime for the same character
- direct bone manipulation from Brain
- direct bone manipulation from tools
- LLM-generated raw bone transforms as the primary control path
- permanent heavy animation loops
- hard dependency on GLB animation clips
- model-specific bone names inside semantic motion definitions
- duplicate bubble systems
- duplicate response generation

Do not move complexity into one giant file simply to hide duplicated ownership.

---

# 66. Character Independence Test

Disable Brain.

Expected:

- the character can still load
- GLB can still render
- local character interactions can still work
- idle behavior can still work when enabled
- bubble can still show system messages

Disable Character.

Expected:

- Brain can still operate
- Chat can still operate
- tools can still operate
- no second Brain is created as a replacement

This proves the character is a separate subsystem.

---

# 67. Acceptance Test: Happy

Input:

    character.setMood("happy")

Expected:

1. mood changes to happy
2. current state is inspected
3. energy is inspected
4. recent motions are inspected
5. capabilities are inspected
6. an appropriate motion family is selected
7. a semantic motion intent is created
8. MotionGenerator produces skeletal movement
9. MotionSafety validates it
10. CharacterRetargeter maps it
11. current GLB moves
12. no fixed "happy animation" is required

---

# 68. Acceptance Test: Speaking

Input:

    response = "Hello, how can I help you?"

Expected:

- bubble appears above Saeed
- state becomes speaking
- text is visible
- voice may speak the same response
- facial/speech behavior may run
- compatible gestures may run
- bubble remains readable
- speech completion transitions back toward idle

---

# 69. Acceptance Test: New GLB

Input:

    chooseCharacter(new.glb)

Expected:

1. old model remains safe while new model loads
2. new GLB is parsed
3. skeleton is inspected
4. mapping is calculated
5. required rig is validated
6. rest pose is validated
7. profile is loaded/created
8. new model is committed
9. controller rebinds
10. Brain remains unchanged
11. Bubble remains unchanged
12. Saeed continues operating

If any validation fails, the old model remains active.

---

# 70. Acceptance Test: Tool Event

Input:

    tool_start("search")

Expected:

    state = acting
    mood = curious
    intent = searching

After success:

    pleased reaction

After failure:

    concerned reaction

The tool itself never accesses Three.js or bones.

---

# 71. Agent Rules

Any future coding agent working on Saeed must follow these instructions.

### Rule 1

Read CharacterController before modifying character behavior.

### Rule 2

Read the current renderer before changing GLB loading.

### Rule 3

Do not create a second character controller.

### Rule 4

Do not create a second animation controller.

### Rule 5

Do not move behavior decisions into avatar.js.

### Rule 6

Do not let Brain manipulate bones.

### Rule 7

Do not let tools manipulate bones.

### Rule 8

Do not depend on GLB animation clips.

### Rule 9

Use logical joints.

### Rule 10

Use CharacterRetargeter for model-specific mapping.

### Rule 11

Use CharacterProfileStore for per-character persistent state.

### Rule 12

New GLB replacement must be transactional.

### Rule 13

All user-facing Saeed responses must be able to reach BubbleController.

### Rule 14

Do not create a second bubble implementation.

### Rule 15

Do not create permanent heavy animation loops.

### Rule 16

Do not create a second source of truth for state or mood.

### Rule 17

Do not bypass MotionSafety.

### Rule 18

Do not apply an asynchronous motion result to an obsolete character generation.

### Rule 19

When a responsibility already has an owner, extend that owner.

### Rule 20

Run character diagnostics and tests after architectural changes.

---

# 72. Implementation Order

Agents should implement changes in this order.

## Phase 1 — Inspect

Read the existing:

- CharacterController
- AnimationController
- CharacterRig
- CharacterRetargeter
- AutoRigMapper
- MotionRegistry
- MotionSequence
- MotionSafety
- AvatarRenderer
- CharacterProfileStore
- bubble implementation
- character host / IPC

Do not immediately rewrite them.

## Phase 2 — Preserve

Keep:

- existing GLB loading
- existing rig mapping
- existing rest pose
- existing character profiles
- existing bubble
- existing diagnostics
- existing Brain integration

## Phase 3 — Separate

Establish clear boundaries:

- Brain
- CharacterController
- Motion Generator
- Renderer
- Bubble

## Phase 4 — Semantic motion

Implement:

- state
- mood
- energy
- intent
- family
- history
- priority
- capabilities

## Phase 5 — Generator

Add MotionGenerator behind an interface.

The generator implementation can evolve later without changing CharacterController.

## Phase 6 — GLB replacement

Make model replacement transactional and profile-based.

## Phase 7 — Validation

Run:

- syntax checks
- unit tests
- character diagnostics
- rig tests
- motion safety tests
- GLB replacement tests
- bubble tests
- application startup tests

---

# 73. Example: Full Conversation Flow

User:

    "Can you find this information for me?"

Flow:

    User
      ↓
    Brain
      ↓
    semantic state = thinking
      ↓
    CharacterController
      ↓
    thoughtful motion intent
      ↓
    MotionGenerator
      ↓
    skeletal motion
      ↓
    Saeed looks thoughtful

Tool begins:

    tool_start
      ↓
    curious/searching state
      ↓
    search gesture

Tool succeeds:

    tool_success
      ↓
    pleased reaction

Brain answers:

    "I found it. Here is the information..."
      ↓
    BubbleController
      ↓
    bubble above Saeed
      ↓
    state = speaking
      ↓
    speech gestures + face
      ↓
    TTS

Speech ends:

    speech_end
      ↓
    state = idle
      ↓
    bubble timeout
      ↓
    idle scheduler resumes

---

# 74. Why the Separation Matters

This architecture solves the fundamental problems of a 3D AI character.

## LLM unpredictability

LLM produces semantic intent only.

## Different GLB skeletons

Logical rig + retargeting.

## Repetitive behavior

Motion history + weighted selection + variation.

## Static-looking character

Major + micro motion layers.

## Model replacement

Character profile + automatic mapping + rest-pose system.

## Coupling

CharacterController separates visual behavior from Brain and renderer.

## Future AI motion model

MotionGenerator is replaceable.

---

# 75. Final Architecture Contract

The final responsibility chain is:

    WHAT
      |
      | Brain / LLM
      v
    semantic meaning
      |
      v
    WHEN / WHY
      |
      | CharacterController
      v
    motion intent
      |
      v
    HOW
      |
      | MotionGenerator
      v
    skeletal motion
      |
      v
    SAFETY
      |
      | MotionSafety
      v
    validated motion
      |
      v
    WHERE
      |
      | CharacterRetargeter + CharacterRig
      v
    current GLB skeleton
      |
      v
    DISPLAY
      |
      | AvatarRenderer
      v
    Saeed 3D

Speech:

    authoritative response
       ├──→ BubbleController → message above Saeed
       ├──→ TTS
       └──→ speaking behavior

Character replacement:

    New GLB
       ↓
    Validate
       ↓
    Map skeleton
       ↓
    Create/load profile
       ↓
    Normalize rest pose
       ↓
    Retarget
       ↓
    Same CharacterController
       ↓
    Same Brain
       ↓
    Same Bubble
       ↓
    New Saeed body

---


---

# 76. Autonomous Character Behavior Architecture

This section defines the autonomous behavior system required to make Saeed feel alive without becoming repetitive, distracting, or annoying.

The goal is not to maximize movement.

The goal is:

> **Saeed should usually be quietly present, occasionally show meaningful activity, rarely ask for attention, and never compete with the user.**

This architecture is derived from the strongest behavioral principles observed in Merlin's public implementation: autonomous behavior is separated from normal chat, idle behavior is rate-limited, wandering and idle thoughts are probabilistic, recent actions are suppressed, behavior is gated by the current intent, and the character yields to active user interaction. citeturn0search0

## 76.1 Presence Is Not Activity

A visible character must not be required to perform a noticeable action continuously.

The runtime distinguishes:

    PRESENCE
       |
       +-- breathing
       +-- blink
       +-- tiny eye movement
       +-- subtle posture adjustment
       +-- quiet gaze behavior
       |
       +-- OCCASIONAL ACTIVITY
       |      +-- idle gesture
       |      +-- look around
       |      +-- stretch
       |      +-- small wander
       |      +-- idle thought
       |
       +-- USER-DRIVEN ACTIVITY
              +-- listening
              +-- thinking
              +-- speaking
              +-- reacting
              +-- dragging
              +-- tool activity

The character must never use constant full-body animation merely to prove that it is alive.

The desired visual rhythm is:

    small behavior
       ↓
    quiet period
       ↓
    small behavior
       ↓
    longer quiet period
       ↓
    occasional noticeable event

This is more natural than continuous random animation.

---

## 76.2 Autonomous Behavior Is Its Own Subsystem

Autonomous behavior must not be scattered across:

- renderer
- UI components
- GLB loader
- chat code
- TTS
- random setInterval calls
- individual animation functions

There must be one authoritative autonomous decision path under CharacterController.

Recommended logical structure:

    CharacterController
          |
          +-- AutonomousBehaviorController
          |       |
          |       +-- Scheduler
          |       +-- Context Sensor
          |       +-- Behavior Policy
          |       +-- Cooldown Manager
          |       +-- Motion History
          |       +-- Event Arbiter
          |
          +-- AnimationController
          +-- BubbleController
          +-- VoiceController
          +-- MovementController

If an existing repository module already owns one of these responsibilities, extend that owner instead of creating a duplicate.

The AutonomousBehaviorController makes decisions.

The execution systems execute approved decisions.

---

## 76.3 Autonomous Event Model

An autonomous action is a semantic event, not an animation command.

Recommended contract:

    AutonomousEvent {
      id
      type
      priority
      reason
      state
      mood
      energy
      bubble?
      voice?
      motionIntent?
      movement?
      duration
      cooldown
      createdAt
    }

Possible types:

    micro_behavior
    idle_motion
    idle_thought
    idle_sound
    attention_call
    wander
    sleep
    wake
    gaze_shift
    posture_change

Example:

    {
      "type": "idle_thought",
      "priority": 15,
      "reason": "long_user_inactivity",
      "bubble": {
        "text": "I'm here if you need me.",
        "durationMs": 7000
      },
      "voice": null,
      "motionIntent": {
        "intent": "gentle_attention",
        "intensity": 0.25
      }
    }

A single event may produce:

    motion + bubble + voice

or only:

    motion

or only:

    gaze

The character must not speak for every autonomous event.

---

## 76.4 The Autonomous Decision Pipeline

Every autonomous action must pass through:

    Scheduler
       ↓
    Is autonomy allowed?
       ↓
    Is the user inactive enough?
       ↓
    Is Saeed visible?
       ↓
    Is the character currently busy?
       ↓
    Priority / interruption check
       ↓
    Mood / energy / time modifiers
       ↓
    Recent-history penalty
       ↓
    Cooldown check
       ↓
    Candidate weighting
       ↓
    Probability gate
       ↓
    Execute OR DROP
       ↓
    Record result in history

**DROP is a valid outcome.**

The system must not force an action simply because a scheduler tick occurred.

---

## 76.5 User Activity Floor

Autonomous behavior must first respect a minimum inactivity floor.

Recommended initial policy:

    user interaction
         ↓
    reset inactivity timer
         ↓
    autonomy suppressed
         ↓
    inactivity threshold reached
         ↓
    autonomous candidates become eligible

The initial threshold should be configurable and should not be treated as a fixed architectural constant.

Suggested starting point:

    60–120 seconds

The exact value can later be tuned from real usage.

Chat submission, mouse interaction with Saeed, drag, panel interaction, speech input, and other meaningful user actions should reset the appropriate inactivity timer.

---

## 76.6 Scheduler

The scheduler should wake periodically to evaluate behavior.

It must not mean:

    every tick = animation

Recommended conceptual cycle:

    scheduler tick
        ↓
    inspect context
        ↓
    build candidate list
        ↓
    remove invalid candidates
        ↓
    score candidates
        ↓
    apply probability
        ↓
    execute at most one autonomous major event
        ↓
    return to quiet state

The scheduler may tick frequently enough for responsive state sensing, but autonomous major events must have independent cooldowns.

This separates:

    sensing frequency

from:

    visible behavior frequency

---

## 76.7 Candidate Behavior Classes

Autonomous candidates should be divided into classes.

### Micro

Very low visibility:

- blink
- eye shift
- tiny head correction
- breathing
- weight adjustment
- finger adjustment
- posture correction

### Idle Motion

Noticeable but quiet:

- nod
- stretch
- look around
- thoughtful pose
- yawn
- small hand gesture

### Movement

Physical repositioning:

- small wander
- move closer to a preferred region
- return from an edge
- subtle reposition

### Communication

Rare:

- idle thought
- short bubble
- optional voice
- attention call

### Lifecycle

State transitions:

- sleep
- wake
- hide
- show

These classes must have different rates and cooldowns.

---

## 76.8 Probability Must Be Weighted, Not Uniform

Do not use:

    random(allBehaviors)

Instead:

    score(candidate) =
        baseWeight
      + moodCompatibility
      + energyCompatibility
      + timeCompatibility
      + contextCompatibility
      + capabilityCompatibility
      - recentMotionPenalty
      - recentFamilyPenalty
      - frequencyPenalty
      - userAnnoyancePenalty

Then apply a probability gate.

A candidate with a high score is still not guaranteed to happen.

This produces variation without chaos.

---

## 76.9 Recent-Behavior Suppression

Maintain:

    recentAutonomousEvents
    recentMotionIds
    recentMotionFamilies
    recentBubbleTypes
    recentAttentionCalls

Each candidate receives a penalty when it was recently used.

Example:

    recent:
      wave
      nod
      wave

A new wave should normally be suppressed.

The history should use time decay so that an action becomes eligible again naturally.

This is stronger than simply saying:

    do not repeat the last animation

because it also prevents repeating an entire behavior family.

---

## 76.10 Cooldowns

Each autonomous behavior has its own cooldown.

Examples:

    blink:
      very short / naturally scheduled

    idle gesture:
      tens of seconds to minutes

    wander:
      minutes

    idle thought:
      several minutes

    attention call:
      long cooldown

    sleep:
      lifecycle-based

Cooldowns must be independent.

A recent blink must not prevent a future wander.

A recent idle thought must not prevent a micro eye movement.

---

## 76.11 Anti-Annoyance Policy

The system must explicitly track user annoyance risk.

The following should reduce autonomous behavior frequency:

- user is actively typing
- user is talking
- user is reading
- chat panel is active
- character was recently dragged
- character was recently clicked repeatedly
- character is currently speaking
- user dismissed an idle thought
- user ignored repeated attention attempts
- the application is not focused
- the user has disabled autonomous communication
- quiet hours are active
- voice is disabled
- the character has recently made a noticeable movement

The character should interpret repeated non-response as a reason to become quieter, not louder.

---

## 76.12 Attention-Seeking Must Be Extremely Rare

Calling the user is a special behavior.

It should not behave like:

    "Are you there?"
    "Hello?"
    "Need anything?"
    "Hello?"
    ...

Instead:

    inactivity
       ↓
    long enough silence
       ↓
    low-probability attention candidate
       ↓
    check attention cooldown
       ↓
    check recent dismissal / non-response
       ↓
    if allowed:
       gentle motion
       optional bubble
       optional sound
       optional voice
       ↓
    return to quiet

An attention call should normally be a single event.

After a user ignores it, the next attention attempt should become much less likely.

---

## 76.13 Attention Call Should Be Multi-Modal

An attention call is not necessarily speech.

Possible levels:

### Level 1 — Invisible

    small gaze toward user

### Level 2 — Subtle

    head turn
    small wave

### Level 3 — Visible

    gentle attention gesture
    short bubble

### Level 4 — Audible

    short sound
    short voice phrase

The system should select the lowest sufficient level.

Do not jump directly to voice.

---

## 76.14 Idle Thoughts

Idle thoughts are optional communication events.

They must satisfy:

    minimum inactivity
    +
    idle-thought cooldown
    +
    no active conversation
    +
    no conflicting bubble
    +
    no active speaking
    +
    no recent dismissal
    +
    probability gate

The initial design should use local deterministic text where possible.

Examples:

    "I'm here if you need me."

    "Taking a quiet moment."

    "Anything I can help with?"

    "I was just thinking."

These messages must remain short.

---

## 76.15 LLM-Generated Idle Thoughts

The LLM must not be required for every idle thought.

Default:

    deterministic local thought pool

Optional:

    LLM-generated idle thought

The LLM path must have:

- separate cooldown
- token/cost limit
- privacy control
- failure fallback
- maximum length
- content safety filtering
- no repeated text
- no fabricated claims about what the user is doing

If the LLM is unavailable, Saeed must remain fully functional.

---

## 76.16 Idle Sound Policy

Idle sounds must be rarer than micro motion.

Examples:

- quiet sigh
- tiny hum
- subtle acknowledgement sound
- soft yawn sound

Never use sound simply because an idle animation occurred.

Recommended relationship:

    idle motion
       ↓
    may have no sound

    idle sound
       ↓
    must have its own cooldown

Speech and idle sound share an audio arbitration system.

---

## 76.17 Bubble Ownership

Autonomous bubbles must still use the same authoritative BubbleController.

There must not be:

    normal BubbleController

and:

    separate IdleBubble

Instead:

    CharacterController
       ↓
    BubbleController
       ↑
    normal response
    autonomous event
    system event

Bubble priority must be respected.

An autonomous bubble must never overwrite an important user-facing answer.

---

## 76.18 Voice Ownership

Voice must also remain centralized.

    CharacterController
          ↓
    VoiceController
          ↓
    audio queue

Rules:

- never interrupt important user-facing speech with idle speech
- never start idle speech while Saeed is already speaking
- do not overlap autonomous voice and TTS
- cancel low-priority idle voice when important speech begins
- if voice is disabled, autonomous behavior falls back to motion/bubble

---

## 76.19 Autonomous Movement / Wander

Wander is a semantic movement event.

It must not directly set arbitrary screen coordinates from random code scattered around the app.

Pipeline:

    autonomous wander candidate
          ↓
    movement policy
          ↓
    determine valid nearby targets
          ↓
    respect work-area/window bounds
          ↓
    avoid dangerous/invalid regions
          ↓
    choose small displacement
          ↓
    smooth movement
          ↓
    stop
          ↓
    return to idle

The default wander should be small.

Saeed should normally remain near his current location rather than repeatedly crossing the screen.

---

## 76.20 Wander Context

Movement selection should consider:

- current position
- display/work area
- character size
- screen edges
- application windows where relevant
- current user interaction
- current state
- energy
- mood
- recent movement
- movement cooldown

High energy may allow slightly larger movement.

Low energy should prefer remaining still.

Sleepy mood should almost never wander.

---

## 76.21 Sleep Lifecycle

Sleep is a real runtime state.

Suggested lifecycle:

    ACTIVE
      ↓
    IDLE
      ↓
    prolonged inactivity
      ↓
    SLEEP_CANDIDATE
      ↓
    probability / time / policy check
      ↓
    SLEEPING

While sleeping:

    major autonomous motion = disabled
    wander = disabled
    idle thoughts = disabled
    attention calls = disabled
    nonessential sound = disabled

Micro behavior may continue at very low intensity if the model supports it.

---

## 76.22 Wake Conditions

Wake may be triggered by:

- user click
- double click
- drag
- user speech
- chat input
- panel interaction
- summon action
- important system event
- explicit application command

Wake flow:

    sleeping
       ↓
    wake trigger
       ↓
    wake motion
       ↓
    restore active state
       ↓
    normal interaction behavior

The wake animation must be interruptible if the user immediately starts a meaningful interaction.

---

## 76.23 Mood Modifies Autonomy

Mood does not directly select a fixed animation.

Instead it changes candidate weights.

Example:

    cheerful:
      positive gestures ↑
      social reactions ↑

    curious:
      gaze shifts ↑
      look-around ↑

    thoughtful:
      quiet thinking motions ↑
      idle speech ↓

    sleepy:
      micro motion ↑
      major motion ↓
      wander ↓
      speech ↓

    mischievous:
      playful gestures ↑
      surprise events slightly ↑

Mood is therefore a probability modifier, not an animation name.

---

## 76.24 Energy Modifies Autonomy

Energy should influence:

- frequency
- amplitude
- speed
- movement distance
- probability of major events
- willingness to wander
- speaking tendency

Example:

    energy 0.9:
      more movement
      faster recovery
      larger gestures

    energy 0.2:
      longer quiet periods
      smaller gestures
      more resting
      higher sleep probability

Energy must never override user-priority events.

---

## 76.25 Time-of-Day Modifiers

Recommended time categories:

    morning
    afternoon
    evening
    night

Examples:

    morning:
      stretch
      wakefulness
      greeting

    afternoon:
      normal activity

    evening:
      lower energy
      quieter behavior

    night:
      very low autonomous communication
      low movement
      high sleep probability

Time-of-day modifies weights; it does not hard-code behavior.

---

## 76.26 State Gating

Autonomous behavior must respect current state.

Example policy:

    loading:
      no autonomy

    listening:
      micro only

    thinking:
      compatible thinking motion only

    speaking:
      speech-compatible gestures only

    acting:
      tool-compatible motion only

    sleeping:
      wake-triggered events only

    hidden:
      no visual behavior

    error:
      controlled error behavior

    idle:
      full autonomous candidate set

This prevents autonomy from fighting user-driven behavior.

---

## 76.27 User-Driven Events Always Win

Example:

    Saeed is wandering
          ↓
    user grabs Saeed
          ↓
    drag event
          ↓
    wander yields immediately
          ↓
    drag becomes authoritative

Another:

    Saeed is doing an idle gesture
          ↓
    user starts speaking
          ↓
    idle gesture is interrupted/blended as appropriate
          ↓
    listening becomes authoritative

Another:

    idle thought is scheduled
          ↓
    user sends a message
          ↓
    idle thought is dropped

This rule is mandatory:

> **Autonomy must yield to meaningful user interaction.**

---

## 76.28 Event Priority

Recommended conceptual priority:

    100  system-critical
     95  direct user manipulation
     90  direct user interaction
     85  listening / speaking
     75  active thinking
     70  important tool reaction
     60  normal semantic reaction
     40  wake
     25  autonomous movement
     15  idle thought
     10  idle major motion
      1  micro behavior

Exact values may change.

The ordering must remain.

---

## 76.29 Event Arbitration

Before execution:

    candidate event
          ↓
    compare against active event
          ↓
    higher priority?
       /       \
     yes       no
      |         |
    interrupt   defer/drop
      |
      v
    execute

Low-priority events must not accumulate indefinitely.

For example:

    5 idle gestures
    2 wander requests
    3 idle thoughts

must not become a queue that executes after the user returns.

Stale autonomous events should expire.

---

## 76.30 Autonomous Event Expiration

Every autonomous event should have:

    createdAt
    expiresAt

If the user becomes active before execution:

    event = expired
    event = dropped

This prevents outdated autonomous decisions from being executed later.

---

## 76.31 Quiet-State Feedback

The system must learn from absence of response.

Example:

    attention call
       ↓
    no response
       ↓
    attention penalty increases

Repeatedly:

    no response
       ↓
    lower attention probability
       ↓
    longer cooldown

If the user responds positively:

    interaction
       ↓
    attention penalty decreases
       ↓
    normal behavior restored

This does not require machine learning.

A simple adaptive score is sufficient.

---

## 76.32 Dismissal Feedback

If the user dismisses an idle thought:

    dismissed
       ↓
    record thought category
       ↓
    suppress same category
       ↓
    extend cooldown

Example:

    "Need anything?"

dismissed repeatedly:

    attention-question category becomes less likely.

This is essential for a non-annoying assistant.

---

## 76.33 One Event = One Coherent Character Action

When autonomy decides to act, the outputs should feel like one event.

Example:

    AutonomousEvent:
      type = attention_call

      motion:
        gentle wave

      bubble:
        "I'm here if you need me."

      voice:
        optional

This is preferable to three independent systems independently deciding:

    animation
    bubble
    sound

at the same moment.

The CharacterController owns the semantic event.

Presentation systems execute its parts.

---

## 76.34 Example Autonomous Timeline

A healthy session might look like:

    00:00  user active
           Saeed listens / speaks

    01:20  user becomes inactive
           Saeed remains quiet

    02:10  micro eye movement

    03:40  subtle posture adjustment

    05:00  idle candidate evaluated
           no event selected

    06:30  small look-around

    08:00  no event

    10:00  small wander

    12:00  no event

    15:00  idle thought candidate
           probability fails
           nothing happens

    18:00  idle thought candidate
           selected
           gentle gesture + short bubble

    18:30  user still inactive
           no repeated call

    25:00  sleep candidate
           selected

    25:05  Saeed sleeps

    31:00  user clicks Saeed
           wake

    31:02  user starts talking
           listening

This is the desired behavioral rhythm.

---

## 76.35 What Must NOT Happen

Never implement:

    setInterval(() => playRandomAnimation(), 3000)

Never implement:

    every idle tick => speak

Never implement:

    every idle tick => wander

Never implement:

    every focus event => animation

Never implement:

    every animation => sound

Never implement:

    every idle thought => TTS

Never implement:

    LLM decides every blink

Never implement:

    autonomous queue that can grow without bound

Never implement:

    renderer-owned autonomous brain

Never implement:

    separate idle bubble system

Never implement:

    separate idle voice system

Never implement:

    autonomous behavior that ignores user interaction

---

## 76.36 Proposed AutonomousBehaviorController Contract

Recommended logical interface:

    interface AutonomousBehaviorController {
      start(): void
      stop(): void
      onUserInteraction(event): void
      onStateChanged(state): void
      onMoodChanged(mood): void
      onEnergyChanged(energy): void
      evaluateNow(): void
      getStatus(): AutonomousStatus
    }

Recommended status:

    {
      enabled: true,
      lastEvaluationAt: 0,
      lastMajorEventAt: 0,
      lastThoughtAt: 0,
      lastAttentionCallAt: 0,
      lastWanderAt: 0,
      lastSleepAt: 0,
      inactivityMs: 0,
      attentionPenalty: 0,
      currentAutonomousEvent: null
    }

This is a logical contract. Existing modules may implement these responsibilities without creating a new file.

---

## 76.37 Proposed Behavior Policy Contract

Behavior policy should answer:

    canAutonomyRun(context)?
    canSpeak(context)?
    canWander(context)?
    canCallUser(context)?
    canSleep(context)?
    canWake(context)?
    scoreCandidate(candidate, context)?
    selectCandidate(candidates, context)?
    shouldInterrupt(active, candidate)?

The policy is deterministic and testable.

It must not directly manipulate the renderer.

---

## 76.38 Autonomous Context

The decision system should have access to:

    currentState
    currentMood
    energy
    visibility
    userInactivityMs
    applicationFocused
    panelVisible
    bubbleVisible
    voiceActive
    speechActive
    userTyping
    currentMotion
    currentMotionPriority
    recentMotionHistory
    recentAutonomousEvents
    recentDismissals
    timeOfDay
    sleepState
    characterCapabilities

This context should be read through the existing authoritative owners.

No duplicate state source is allowed.

---

## 76.39 Autonomous Configuration

User-configurable settings should include:

    autonomousBehavior.enabled
    autonomousBehavior.idleMotion.enabled
    autonomousBehavior.wander.enabled
    autonomousBehavior.idleThoughts.enabled
    autonomousBehavior.idleVoice.enabled
    autonomousBehavior.attentionCalls.enabled
    autonomousBehavior.sleep.enabled

Optional:

    autonomousBehavior.quietHours
    autonomousBehavior.maxAttentionCallsPerHour
    autonomousBehavior.idleThoughtCooldown
    autonomousBehavior.wanderCooldown
    autonomousBehavior.autonomyIntensity

The default configuration should favor quiet behavior.

---

## 76.40 Autonomy Intensity

Provide a global intensity concept:

    0.0 = almost completely quiet
    0.25 = very calm
    0.50 = normal
    0.75 = lively
    1.0 = highly active

This value modifies probabilities and cooldowns.

It must not override hard safety and user-priority rules.

Recommended default:

    0.35–0.50

The goal is a calm companion, not a constantly animated mascot.

---

## 76.41 Voice Policy

Voice is the most intrusive autonomous output.

Therefore:

    micro motion < major motion < bubble < sound < voice

in terms of attention cost.

The system should prefer the least intrusive output that satisfies the behavior.

For example:

    need to show presence?
        → micro motion

    need to react?
        → gesture

    need to communicate?
        → bubble

    need to alert?
        → sound

    genuinely need user attention?
        → voice

This hierarchy is a core anti-annoyance rule.

---

## 76.42 Privacy and Network Policy

Autonomous behavior should operate locally by default.

Idle behavior must not silently send user data to an LLM.

If an LLM is used for an autonomous thought:

- the user must have enabled that feature
- only minimal required context is sent
- no sensitive context is included by default
- network failure must not break autonomy
- local fallback text remains available

---

## 76.43 Autonomous Behavior and Character Replacement

Autonomous state belongs to CharacterController, not to a particular GLB.

When the GLB changes:

    old GLB
       ↓
    new GLB
       ↓
    same state
    same mood
    same energy
    same scheduler
    same history policy
       ↓
    capabilities recalculated
       ↓
    behavior continues

However, motion history may need to invalidate entries that require unavailable capabilities.

Example:

    handWave requires hand
    new GLB has no hand

Then:

    handWave candidate
       ↓
    capability check
       ↓
    rejected
       ↓
    fallback = head nod

---

## 76.44 Autonomous Behavior and Bubble Follow

When an autonomous bubble is visible:

    CharacterController
          ↓
    BubbleController
          ↓
    world-space character anchor
          ↓
    screen projection
          ↓
    bubble follows character

The bubble system remains the same system used by normal responses.

---

## 76.45 Autonomous Behavior and TTS Synchronization

If an autonomous event contains voice:

    AutonomousEvent
       |
       +-- bubble text
       |
       +-- TTS text
       |
       +-- speaking state
       |
       +-- compatible motion
       |
       +-- face behavior

The event must enter the same speech pipeline as normal responses.

There must not be a second TTS implementation for idle behavior.

---

## 76.46 Autonomous State Machine

Conceptual state machine:

    +---------+
    | ACTIVE  |
    +----+----+
         |
         | no interaction
         v
    +---------+
    |  IDLE   |
    +----+----+
         |
         | candidate selected
         v
    +-------------+
    | AUTONOMOUS  |
    |   EVENT     |
    +------+------+ 
           |
       +---+---+
       |       |
       v       v
    MOTION   COMMUNICATION
       |       |
       +---+---+
           |
           v
        IDLE
           |
           | prolonged inactivity
           v
       SLEEPING
           |
           | user/system trigger
           v
         WAKE
           |
           v
         ACTIVE

At any point:

    meaningful user interaction
             ↓
       cancel/defer autonomy
             ↓
       user-driven state

---

## 76.47 Testing Autonomous Behavior

Required tests:

### Test A — Active user

User is interacting continuously.

Expected:

    no idle thoughts
    no autonomous wander
    no attention calls
    micro behavior may continue

### Test B — Idle user

User is inactive beyond threshold.

Expected:

    scheduler evaluates
    many evaluations produce no event
    occasional event occurs
    events are not repetitive

### Test C — Repetition

Force repeated candidate selection.

Expected:

    recent candidate penalty increases
    alternative candidates become preferred

### Test D — User interrupts wander

Start wander.

Then drag Saeed.

Expected:

    wander yields
    drag becomes authoritative

### Test E — User interrupts idle thought

Schedule idle thought.

Then user sends message.

Expected:

    idle thought is dropped
    user response takes priority

### Test F — Attention call ignored

Trigger attention call.

Do not interact.

Expected:

    next attention probability decreases
    cooldown increases

### Test G — Attention call answered

Trigger attention call.

Interact positively.

Expected:

    attention penalty decreases
    normal behavior resumes

### Test H — Sleep

Remain inactive long enough.

Expected:

    Saeed enters sleeping state
    wander disabled
    idle communication disabled

### Test I — Wake

Click sleeping Saeed.

Expected:

    wake event
    wake motion
    normal idle/interaction behavior

### Test J — Voice conflict

Start normal user-facing TTS.

Attempt autonomous voice.

Expected:

    autonomous voice is dropped/deferred

### Test K — GLB replacement

Replace character while an autonomous event is pending.

Expected:

    stale event is discarded or revalidated
    new character continues with same controller
    unsupported motions fall back safely

---

## 76.48 Definition of Natural Behavior

A successful implementation should pass this human test:

> If the user watches Saeed for five minutes without interacting, the character should look alive but should not repeatedly demand attention.

And:

> If the user starts interacting, Saeed should immediately become more responsive and less autonomous.

And:

> If the user ignores Saeed, Saeed should become quieter rather than more persistent.

And:

> If Saeed performs the same semantic action twice, the physical result should not necessarily look identical.

These are behavioral requirements, not optional visual polish.

---

## 76.49 Core Anti-Annoyance Rules

The following rules are mandatory:

1. Autonomy must yield to meaningful user interaction.
2. Autonomous events are probabilistic, not guaranteed.
3. Recent behavior must be penalized.
4. Every noticeable autonomous behavior has a cooldown.
5. Attention calls have much longer cooldowns.
6. Repeated ignored attention calls reduce future probability.
7. Dismissed thoughts reduce related future probability.
8. Voice is the most restricted autonomous output.
9. Idle thoughts are optional, not mandatory.
10. Wander is small and infrequent.
11. Sleep removes almost all autonomous activity.
12. Micro behavior may continue quietly.
13. No autonomous event may overwrite an important user-facing response.
14. Autonomous events expire when context changes.
15. No autonomous queue may grow without bound.
16. No LLM request is required for basic autonomy.
17. No random behavior is implemented outside the authoritative autonomous policy.
18. No renderer component may independently decide autonomous behavior.

---

## 76.50 Final Behavioral Formula

The desired Saeed behavior can be summarized as:

    Naturalness
      =
        Presence
      + Variation
      + Context
      + Timing
      + Restraint
      + Responsiveness

Not:

    Naturalness = number of animations

The most important design principle is:

> **Do less, but choose the moment better.**

Saeed should feel alive because his behavior has timing, context, memory, variation and restraint—not because he is constantly moving.


# 127. Definition of Done

The architecture is complete only when:

- [ ] Exactly one CharacterController exists.
- [ ] Character behavior has one authoritative owner.
- [ ] State and mood are separate.
- [ ] Motion intent is separate from skeletal execution.
- [ ] MotionGenerator is independent and replaceable.
- [ ] MotionSafety validates generated movement.
- [ ] Recent-motion suppression works.
- [ ] Motion variation works.
- [ ] Major and micro motion layers work.
- [ ] Speaking behavior works.
- [ ] Listening behavior works.
- [ ] Thinking behavior works.
- [ ] Tool reactions work.
- [ ] Bubble appears above Saeed.
- [ ] Bubble follows Saeed.
- [ ] Bubble supports Arabic and English.
- [ ] Bubble supports RTL and LTR.
- [ ] Every normal Saeed response can appear in the bubble.
- [ ] New GLB can be selected at runtime.
- [ ] Failed GLB replacement preserves the old model.
- [ ] Automatic rig mapping works.
- [ ] Manual rig mapping remains available.
- [ ] Rest pose is saved per character.
- [ ] Character profiles are isolated per GLB.
- [ ] Optional missing bones degrade gracefully.
- [ ] Motion does not require GLB animation clips.
- [ ] Semantic motions use logical joints.
- [ ] Brain never manipulates bones.
- [ ] Tools never manipulate bones.
- [ ] Renderer never decides character behavior.
- [ ] Character replacement does not restart the Brain.
- [ ] No duplicate animation runtime exists.
- [ ] No duplicate bubble system exists.
- [ ] No permanent heavy character loop exists.
- [ ] Character diagnostics are available.
- [ ] Automated character tests pass.

---

# 128. Authoritative Statement

This document is the architecture contract for the Saeed 3D Character Runtime.

Future agents and developers must treat it as the source of truth for:

- character ownership
- state
- mood
- semantic intent
- motion selection
- motion generation
- motion safety
- skeletal retargeting
- GLB replacement
- character profiles
- bubble messages
- speech behavior
- idle behavior
- interaction reactions
- diagnostics
- testing

The objective is not to copy Merlin's 2D implementation.

The objective is to reproduce its strongest architectural principle in a 3D system:

> **The intelligent system describes intent. A dedicated character controller owns behavior. A separate motion system creates the physical movement. The renderer only displays it.**

Saeed is therefore:

**one character runtime, one controller, one authoritative behavior path, one replaceable 3D body, and one unified message surface above the character.**
