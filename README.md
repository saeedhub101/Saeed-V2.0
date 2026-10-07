# Saeed AI — Architecture Contract

Saeed is a lightweight Windows desktop companion. **The character is the primary application surface. Chat and Mic are two optional input/output surfaces for the same Saeed brain.**

This README is the **architecture contract** and contains the red lines that must not be crossed.

## 1. RED LINES — NON-NEGOTIABLE

1. Saeed character is available at startup. It does not depend on Chat.
2. Mic is OFF at startup. No capture, STT, realtime audio, or microphone worker starts automatically.
3. Chat and Mic are peers. Neither owns the Brain.
4. Exactly one Brain runtime exists per active Saeed session. Chat and Mic share it.
5. Brain is on-demand: create it when Chat or Mic needs intelligence; release it when both are inactive.
6. Local-first: simple supported computer requests are handled locally.
7. API is escalation, not the default path for every simple request.
8. Tools are on-demand. No permanent tool worker for a one-shot task.
9. Add-ons are optional and lazy. Installed does not mean loaded.
10. Exactly one authoritative Tool Registry/permission/dispatch path.
11. Exactly one CharacterController owns behavior, motion intent, idle selection, mood and animation playback.
12. AvatarRenderer only renders. It does not decide behavior.
13. Idle is intermittent and event-driven. No permanent idle animation loop.
14. Recent idle motions are suppressed so Saeed does not mechanically repeat the same movement.
15. Animation update/render activity exists only while a visual change is occurring.
16. Hide destroys the Character runtime; Show creates a fresh Character runtime. Persistent Character profile/state survives.
17. Mic OFF releases microphone resources. If Chat is open, Brain remains.
18. Closing Chat releases Brain only when Mic is also OFF.
19. Mute is different from Mic OFF: listening/Brain/tools remain available, audible TTS is disabled, and text can still appear.
20. Chat and Mic use the same Brain/request/tool path. There is no Chat brain and Voice brain.
21. Do not move the same complexity into another giant file.
22. Do not reintroduce duplicate Brain routers, executors, registries, character runtimes, animation controllers, or voice lifecycles.
23. Voice behavior is not rewritten during unrelated architecture work.
24. The authoritative 3D asset is assets/Saeed_AI-3D.glb.
25. Runtime/user state belongs in Electron userData, not source or bundled assets.

If a proposed change breaks a red line, redesign it before coding.

## 2. Intended architecture

```text
                         Saeed
                           │
                ┌──────────┴──────────┐
                │                     │
              MIC                    CHAT
                │                     │
                └──────────┬──────────┘
                           ↓
                         BRAIN
                           │
                 ┌─────────┴─────────┐
                 ↓                   ↓
           Local Executor       Model/API Executor
                 │                   │
                 └─────────┬─────────┘
                           ↓
                     Tool Registry
                           │
              ┌────────────┼────────────┐
              ↓            ↓            ↓
           Windows       Files        Add-ons
```

The Brain is a coordinator, not a permanent background service.

Character side:

```text
CharacterController
 ├─ state / mood
 ├─ idle scheduler
 ├─ recent-motion suppression
 ├─ event reactions
 ├─ semantic intents
 └─ animation playback
          ↓
    AvatarRenderer
          ↓
     Three.js / GLB
```

## 3. Startup

```text
Electron
  ↓
application shell / tray / IPC
  ↓
Character window
  ↓
character.html
  ↓
Three.js + Saeed_AI-3D.glb
  ↓
CharacterController
  ↓
resting character + lightweight idle scheduler
```

Startup state:

- Brain OFF
- Local executor OFF
- API executor OFF
- Tool execution OFF
- Mic OFF
- STT OFF
- Realtime OFF
- TTS idle
- Chat closed
- Add-on runtimes unloaded

Saeed may perform an occasional one-shot idle gesture. He must not become a permanent CPU animation workload.

## 4. Mic

### Mic ON

```text
MIC ON
  ↓
ensure shared Brain
  ↓
microphone permission
  ↓
capture
  ↓
configured STT / realtime path
  ↓
recognized text
  ↓
shared Brain
  ↓
Local Executor OR Model/API Executor
  ↓
required Tool(s)
  ↓
result
  ↓
text + optional TTS
  ↓
CharacterController reaction
```

Saeed can be used entirely through the character window without opening Chat.

### Mic OFF

```text
MIC OFF
  ↓
stop capture
stop STT input
stop realtime input
release audio resources
  ↓
Chat open?  → keep Brain
Chat closed? → release Brain
```

### Mute

```text
Mute ON
 ├─ microphone: unchanged
 ├─ STT: unchanged
 ├─ Brain: unchanged
 ├─ Tools: unchanged
 └─ audible TTS: OFF
       ↓
    response text remains visible
```

## 5. Chat

Opening Chat creates the Chat window and ensures the shared Brain.

```text
Open Chat
  ↓
Chat window
  ↓
shared Brain
```

Sending text:

```text
Chat input
  ↓
shared Brain
  ↓
Local Executor OR Model/API Executor
  ↓
Tool Registry when required
  ↓
result
```

Closing Chat:

```text
Chat CLOSED
  ↓
Mic ON?  → Brain remains
Mic OFF? → Brain released
```

The character remains alive.

## 6. Brain routing

There is one routing decision.

Local-first handles reliable supported operations such as application/folder launch, system information, processes, disks, network information, and other registered local capabilities.

API escalation is used when stronger reasoning is needed, local handling is insufficient, the configured mode requires it, or an installed add-on supplies the selected model path.

A failed or wrong local route must not become a final user-facing answer when another valid capability can handle the request. The Brain reassesses.

## 7. Tools

Every tool call follows one path:

```text
request
  ↓
Brain
  ↓
Tool Registry
  ↓
resolve
  ↓
validate
  ↓
permission
  ↓
execute
  ↓
verify / return
```

No second dispatcher is allowed.

## 8. Add-ons

Add-ons extend capabilities without making Core heavy.

```text
Installed Add-on
      ↓
Addon Registry
      ↓
Brain discovers capability
      ↓
load only when requested
      ↓
execute
      ↓
return result
      ↓
release temporary resources
```

Examples: Excel, Word/DOCX, PDF, OCR, additional STT/TTS, LLM providers, and future specialist capabilities.

Installing an add-on does not start its library/model at application startup.

## 9. Character and animation

The useful design idea taken from Merlin is the **single animation controller with context-aware choices and recent-animation suppression**, not a copy of Merlin's implementation.

Idle behavior:

```text
rest
 ↓
wait a variable interval
 ↓
choose weighted idle motion
 ↓
exclude recently used motions
 ↓
play one-shot motion
 ↓
return to rest
 ↓
wait again
```

Possible idle motions:

- nod
- look closer
- stretch
- think
- wave
- yawn
- crack back
- crack fingers

Reactive behavior may respond to user input, listening, thinking, speaking, tools, successful results, errors, click/double-click, drag, zoom, hide and show.

The Brain never manipulates bones directly.

During a motion, the controller temporarily wakes the animation/update path. When the motion ends, it stops. There is no permanent 60 FPS character update merely because Saeed is visible.

## 10. Character ownership

CharacterController owns:

- state
- mood
- idle scheduling
- recent-motion history
- semantic intents
- event reactions
- animation playback
- visibility

AvatarRenderer owns:

- Three.js scene
- camera
- lights
- GLB loading
- fitting
- resize
- render scheduling
- disposal

AvatarRenderer must not own Brain routing, tool selection, idle decisions, API decisions, permissions, or user intent.

## 11. Windows

Character window:
- permanent Saeed surface
- 3D character
- Mic control
- text/speech bubble
- status
- direct interaction

Chat window:
- temporary secondary input surface
- never creates another Character runtime
- never creates another Brain

Hide Saeed:
- hide the window
- destroy the Character runtime and rendering resources
- preserve persistent Character profile/state
- recreate a fresh Character runtime on Show

## 12. Resource lifetime

| Component | Startup | Active when |
|---|---|---|
| Character | Yes | visible |
| Idle scheduler | Lightweight | visible |
| Brain | No | Chat or Mic needs it |
| Local Executor | No | Brain request |
| Model/API Executor | No | API request |
| Tool runtime | No | tool request |
| Microphone | No | Mic ON |
| STT | No | Mic ON / configured voice path |
| Realtime | No | required voice configuration |
| TTS | No | response needs speech |
| Chat | No | Chat opened |
| Add-on runtime | No | capability requested |

## 13. Authoritative ownership map

| Responsibility | Owner |
|---|---|
| Electron lifecycle | src/core/app-runtime.js |
| Brain lifecycle | src/core/application/brain-host.js |
| Brain routing | src/core/brain/brain.js |
| Local execution | src/local-executor.js |
| Model/API execution | src/core/brain/model-executor.js |
| Agent session | src/agent.js |
| Tool registry/permission/dispatch | src/tools/registry.js |
| Character behavior | src/character/CharacterController.js |
| Motion definitions | src/character/motions.js |
| 3D rendering | src/avatar.js |
| Character window | src/core/character/character-host.js |
| Voice lifecycle | src/core/voice/voice-host.js + existing voice runtime |
| Voice renderer client | src/voice/client.js |
| Chat lifecycle | src/core/application/chat-host.js |
| Chat IPC | src/core/ipc/chat-ipc.js |
| Add-on lifecycle | existing add-on service/runtime |

One responsibility has one owner. If two modules independently decide the same thing, the architecture is broken.

## 14. Forbidden architecture

Do NOT introduce:

- another Brain router
- another Local Brain
- another API executor for the same path
- another ToolExecutor
- another Tool Registry
- another CharacterController
- another animation controller
- another voice lifecycle
- another memory source of truth
- permanent background agents for one-shot tasks
- permanent render loops
- startup loading of specialist libraries
- duplicate IPC paths for the same action
- a giant Runtime file that merely hides the same complexity

When a feature grows, first ask: **which existing owner should own this?**

## 15. Change rule

Before adding code:

1. Identify the existing authoritative owner.
2. Read the owner and directly related code.
3. Extend the owner if the responsibility already exists.
4. Create a new module only for a genuinely new responsibility.
5. Update this README if ownership changes.
6. Never create a parallel implementation to avoid understanding existing code.

## 16. Current character

Authoritative asset: assets/Saeed_AI-3D.glb

Old GLB names must not return as alternate runtime defaults.

## 17. Final user experience

```text
Start Saeed
   ↓
Saeed is already there
   ↓
Talk through Mic
   OR
Talk through Chat
   ↓
same intelligence
   ↓
local first
   ↓
API only when useful / required
   ↓
tools only when required
   ↓
add-ons when available
   ↓
Saeed reacts visually
   ↓
resources released when no longer needed
```

**Saeed must feel active and intelligent without behaving like a collection of permanently running services.**


## 18. Authoritative Architecture Documents

The project architecture is documented as separate authoritative contracts:

- Character_Architecture.md — Character behavior, autonomy, motion, rigging and Character/Engine boundary.
- Lifecycle_Architecture.md — creation, destruction, ownership, startup, shutdown and resource lifetime.
- Voice_Conversation_Architecture.md — Chat, Mic, STT, TTS, Realtime and shared conversation.
- Core_Architecture.md — Brain, local-first routing, tools, permissions and capabilities.
- Engine_Architecture.md — 3D engine, rendering, GLB loading and technical resource lifetime.
- Security_Architecture.md — trust boundaries, credentials, permissions, plugins and Emergency Stop.
- Testing_and_Acceptance_Architecture.md — architecture gates, runtime verification and release acceptance.
- Architecture_Index.md — documentation authority and change protocol.

When this README conflicts with an authoritative document, the authoritative document wins. Architecture changes must be made at the owning document first.
