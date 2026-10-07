
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

# 76. Definition of Done

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

# 77. Authoritative Statement

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
