# Saeed V2.0 — Voice & Conversation Architecture

## 1. Purpose

This document defines the authoritative architecture for Saeed V2.0 voice, speech, conversation, chat continuity, provider selection, and realtime audio.

It is intentionally separate from `Character_Architecture.md`.

`Character_Architecture.md` defines how Saeed behaves as a living 3D character.

This document defines how Saeed:

- listens through the microphone;
- converts speech to text;
- sends spoken input to the same Brain used by Chat;
- generates a textual answer;
- converts the answer to speech;
- displays the answer in the Saeed character bubble;
- continues the same conversation through Chat;
- continues a Chat conversation through the microphone;
- supports independent STT, TTS, and LLM providers;
- supports native Realtime/streaming providers;
- handles mute, microphone lifecycle, interruption, and audio resources;
- persists voice and chat turns in the same conversation history.

The central rule is:

> Voice and Chat are two input/output surfaces of the same conversation system. They are not two independent conversations.

---

# 2. Core Product Behavior

Saeed has two visible voice controls:

1. **Microphone ON/OFF**
2. **Voice Mute/Unmute**

They are different controls and must remain independent.

### Microphone

The microphone controls whether Saeed listens to the user.

- MIC OFF:
  - microphone capture is stopped;
  - STT is stopped;
  - Realtime microphone streaming is stopped;
  - microphone resources are released;
  - no new spoken user turns are accepted.

- MIC ON:
  - microphone capture starts;
  - the configured voice input pipeline starts;
  - STT or Realtime input becomes available;
  - the Brain becomes available automatically;
  - Saeed can receive spoken turns.

### Voice Mute

Mute controls whether Saeed produces audible speech.

- Unmuted:
  - normal TTS is allowed;
  - Realtime audio playback is allowed;
  - Saeed can speak answers.

- Muted:
  - current Saeed speech is stopped;
  - TTS playback is stopped;
  - Realtime output audio playback is stopped;
  - future answers may still be generated and displayed as text;
  - the conversation itself is not disabled;
  - the microphone may be independently controlled according to the application policy.

The two states must never be conflated.

---

# 3. User Experience Contract

## 3.1 Microphone ON

When the user presses the microphone button above Saeed:

```text
MIC ON
   ↓
Brain available
   ↓
Voice input service starts
   ↓
STT / Realtime input starts
   ↓
User speaks
   ↓
User speech becomes a conversation turn
   ↓
Same Brain used by Chat
   ↓
Saeed answer
   ├──→ conversation history
   ├──→ Bubble above Saeed
   └──→ TTS when Voice is Unmuted
```

The user must not have to open the Chat window to speak.

The character itself is the primary voice interaction surface.

---

# 4. Chat and Microphone Must Share One Conversation

This is one of the most important architectural rules.

There is exactly one authoritative conversation state for the active conversation.

Conceptually:

```text
                 ┌──────────────┐
                 │ Conversation │
                 │    State     │
                 └──────┬───────┘
                        │
              ┌─────────┴─────────┐
              │                   │
            Chat                Voice
              │                   │
              └─────────┬─────────┘
                        ↓
                     Agent
                        ↓
                      Brain
                        ↓
                    Response
```

Chat does not have its own Brain.

Voice does not have its own Brain.

Chat does not have a separate history.

Voice does not have a separate history.

Both surfaces submit turns to the same `Agent`.

---

# 5. Existing Saeed Conversation Mechanism

The current repository already implements the correct foundation.

The authoritative conversation owner is `Agent`.

It maintains:

- `conversations`
- `currentConversationId`
- `history`

The active conversation is stored in:

```text
conversation storage
```

The legacy/current history compatibility file is:

```text
conversation storage
```

Each conversation contains:

```js
{
  id,
  title,
  createdAt,
  updatedAt,
  messages: [
    { role: "user", content: "..." },
    { role: "assistant", content: "..." }
  ]
}
```

The active conversation history is shared by both Chat and Voice.

---

# 6. Chat Input Path

The current Chat path is:

```text
Chat renderer
   ↓
window.saeed.chat(text, image)
   ↓
IPC "chat"
   ↓
ensureBrain()
   ↓
Agent.run(text, image)
   ↓
Brain.run(...)
   ↓
Local Brain / API Brain
   ↓
Agent history
   ↓
Chat response
```

The Chat IPC handler calls the same Agent instance used by Voice.

The Agent sends the current `history` to the Brain.

The ModelExecutor uses the recent history as conversation context.

Therefore a Chat message is not an isolated request.

---

# 7. Voice Input Path — Standard STT

The current standard microphone path is:

```text
Saeed character microphone button
   ↓
setMicMode("on")
   ↓
VoiceHost
   ↓
ensureBrain()
   ↓
Renderer microphone capture
   ↓
AudioContext
   ↓
PCM 24 kHz
   ↓
Voice Activity / silence boundary
   ↓
STT
   ├── Local Whisper
   └── API STT provider
   ↓
transcribed text
   ↓
window.saeed.voiceChat(text)
   ↓
IPC "voice:chat"
   ↓
Agent.runVoice(text)
   ↓
Brain.run({
    text,
    history: current Agent history
   })
   ↓
answer
   ↓
Agent history
   ↓
Bubble
   ↓
TTS
   ↓
Saeed speaks
```

This is the authoritative non-Realtime voice path.

---

# 8. Voice Input Path — Same Brain as Chat

`Agent.runVoice()` is deliberately not a separate AI implementation.

It calls the same:

```text
Brain.run(...)
```

used by Chat.

The only difference is the input surface.

Therefore:

```text
Chat:
Agent.run(text)

Voice:
Agent.runVoice(text)

Both:
Brain.run(text, history)
```

This is essential.

Voice must not create a second personality, second memory, second tool registry, or second conversation context.

---

# 9. Voice Continuation From Chat

Example:

### Chat

User:

> Open my browser and search for today's weather.

Saeed:

> Done. I opened the browser and searched for today's weather.

The conversation history contains:

```text
user:
Open my browser and search for today's weather.

assistant:
Done. I opened the browser and searched for today's weather.
```

### User switches to microphone

User says:

> What did you find?

STT produces:

```text
What did you find?
```

The voice request enters:

```text
Agent.runVoice()
        ↓
Brain.run()
        ↓
current Agent history
```

Therefore the Brain sees the previous Chat exchange.

Saeed can answer:

> I found the current weather information for you...

No new conversation is created.

---

# 10. Voice Continuation Into Chat

The reverse direction must work identically.

Example:

### Microphone

User:

> Find the latest NVIDIA driver.

Saeed answers by voice.

The exchange is persisted:

```text
user:
Find the latest NVIDIA driver.

assistant:
...
```

### User opens Chat

The Chat surface loads the current conversation:

```text
listChats()
getCurrentChat()
history
```

The previous voice exchange appears as normal conversation history.

The user can type:

> Download the one you found.

The Chat request goes to the same Agent and the same active conversation.

---

# 11. Voice and Chat Are Peers

The architectural relationship is:

```text
                   Conversation / Agent
                    /              \
                 Chat              Voice
                  |                  |
             text input          audio input
                  |                  |
                  └──────┬───────────┘
                         ↓
                       Brain
                         ↓
                      Answer
                    /        \
                 Chat        Voice
                  |            |
              text UI         TTS
```

Neither Chat nor Voice owns the Brain.

Neither Chat nor Voice owns the conversation database.

Neither Chat nor Voice may create a duplicate conversation state.

---

# 12. Brain Lifecycle With Microphone

When MIC ON is requested:

```text
setMicMode("on")
   ↓
ensureBrain()
   ↓
permission check
   ↓
activate microphone
```

The current implementation intentionally keeps the Brain active while the microphone is ON.

When MIC OFF:

```text
setMicMode("off")
   ↓
stop voice runtime
   ↓
release microphone resources
   ↓
release Brain when no Chat surface/request requires it
```

The Brain lifecycle must remain coordinated by the application host.

---

# 13. Voice Mute Does Not Mean Conversation OFF

Mute is an output policy.

It must not mean:

- delete history;
- stop the Brain;
- clear conversation;
- disable STT;
- disable Chat;
- disable semantic character behavior.

When muted, Saeed may still:

- listen if MIC is ON;
- transcribe;
- reason;
- use tools;
- update history;
- display the answer in the bubble;
- make Chat available.

Only audible output is suppressed.

---

# 14. Bubble Output

Every normal Saeed answer generated from Voice must be visible above the character.

The output path is:

```text
Voice answer
   ↓
window.saeedShowMessage(answer)
   ↓
Saeed character bubble
```

This means the user does not need the Chat window to understand what Saeed said.

The bubble is part of the character presentation layer.

It does not own the conversation history.

---

# 15. Chat UI History

The Chat renderer obtains conversation state through the existing APIs:

```text
listChats()
getCurrentChat()
selectChat(id)
newChat()
deleteChat(id)
```

The active conversation history is rendered from the Agent's stored messages.

Voice must therefore persist turns into the same Agent history.

The Chat UI must never maintain an independent authoritative history.

---

# 16. Standard Voice Response Output

For non-Realtime Voice, the response pipeline is:

```text
User speech
   ↓
STT transcript
   ↓
Agent.runVoice()
   ↓
Brain
   ↓
assistant text
   ├──→ Agent.history
   ├──→ Bubble
   └──→ TTS if unmuted
```

TTS is an output transformation of the assistant text.

TTS must not become the source of truth for the conversation.

The assistant text is the authoritative conversational result.

---

# 17. TTS Provider Architecture

TTS must be provider-independent.

The application must expose a common TTS interface conceptually equivalent to:

```text
TTSProvider
  synthesize(text, options)
  stop()
  isAvailable()
  getVoices()
```

The selected provider must be controlled by settings.

Example:

```text
TTS Provider:
  ElevenLabs
  OpenAI
  Groq
  Local Browser TTS
```

The user must be able to select TTS independently of STT and LLM.

---

# 18. STT Provider Architecture

STT must be provider-independent.

Conceptually:

```text
STTProvider
  start()
  stop()
  transcribe(audio)
  getPartialTranscript()
  getFinalTranscript()
  isAvailable()
```

Supported/current provider family includes:

- Local Whisper
- OpenAI STT
- Groq STT
- ElevenLabs Scribe

The architecture must allow additional providers without changing the Brain or Chat layer.

Example:

```text
STT = OpenAI
TTS = ElevenLabs
LLM = Groq
```

This combination must be valid.

---

# 19. LLM Provider Architecture

The conversational Brain must also be provider-independent.

Examples include:

- OpenAI
- Groq
- Anthropic
- Gemini
- OpenAI-compatible endpoints
- Local/Ollama where supported

The LLM provider is selected independently from:

- STT;
- TTS;
- Realtime.

The Brain consumes text.

It should not care whether the text came from:

- Chat;
- standard STT;
- Realtime transcription;
- another approved text input.

---

# 20. Provider Independence Matrix

The architecture must allow combinations such as:

| Input | LLM | Output |
|---|---|---|
| OpenAI STT | Groq | ElevenLabs |
| Local Whisper | OpenAI | OpenAI TTS |
| ElevenLabs STT | Groq | ElevenLabs |
| Realtime OpenAI | Native Realtime | Native Realtime |
| Gemini Live | Native Gemini | Native Gemini |
| Chat text | Groq | ElevenLabs |
| Chat text | OpenAI | Local Browser TTS |

The UI must not imply that choosing one provider automatically selects all other providers unless a native Realtime mode explicitly requires it.

---

# 21. Realtime Is a Separate Transport Mode

Realtime is not merely another name for standard STT.

Realtime providers may provide several services in one bidirectional stream:

- input audio;
- speech detection;
- speech transcription;
- conversational reasoning;
- streamed assistant text;
- streamed assistant audio;
- tool calls;
- interruption.

Therefore Realtime is modeled as a separate transport/session layer.

Conceptually:

```text
RealtimeProvider
  ├── connect()
  ├── sendAudio()
  ├── sendText()
  ├── receiveEvents()
  ├── receiveAudio()
  ├── cancel()
  └── disconnect()
```

---

# 22. Current Realtime Providers

The current implementation supports the provider abstraction through:

- OpenAI Realtime
- Google Gemini Live

The provider is selected independently in Realtime settings.

The architecture must permit additional native realtime providers later.

No provider-specific protocol must leak into Chat UI code.

---

# 23. Realtime Brain Modes

The current Realtime architecture supports three conceptual modes:

### Saeed Brain Only

Realtime is used primarily for speech transport.

```text
Realtime STT
   ↓
Saeed Agent / Brain
   ↓
Saeed answer
   ↓
TTS/output
```

The native Realtime provider does not become the authoritative conversational Brain.

This mode preserves Saeed's normal Agent routing and tool policy.

### API Brain Only

The native Realtime provider performs the conversational reasoning.

```text
Mic
 ↓
Realtime
 ↓
Native Realtime Brain
 ↓
Realtime audio
```

Tool calls can be forwarded through the approved ToolRegistry.

The resulting user/assistant exchange must still be persisted into Saeed's active conversation history.

### Auto

The configured runtime policy determines the appropriate route.

The route must remain explicit and observable.

---

# 24. Realtime Input Flow

For native Realtime:

```text
Microphone
   ↓
PCM 24 kHz
   ↓
Realtime session
   ↓
VAD / turn detection
   ↓
User speech
   ↓
Realtime provider
```

The current OpenAI implementation uses bidirectional WebSocket audio and semantic VAD.

The renderer sends audio chunks through:

```text
window.saeed.sendRealtimeAudio(...)
```

The main process forwards them to the active Realtime session.

---

# 25. Realtime Output Flow

Native Realtime audio follows:

```text
Realtime provider
   ↓
audio delta
   ↓
main-process voice runtime
   ↓
voiceBroadcast("realtime:audio")
   ↓
character voice client
   ↓
PCM playback
   ↓
Saeed speaks
```

Assistant transcript events are also received.

The assistant transcript is used to:

- display the final response in the bubble;
- record the conversational exchange;
- maintain continuity with Chat.

---

# 26. Realtime Conversation Persistence

Realtime must not create a hidden conversation that Chat cannot see.

When a complete user/assistant turn is available:

```text
Realtime user transcript
        +
Realtime assistant final transcript
        ↓
Agent.recordConversationExchange(user, assistant)
        ↓
Agent.history
        ↓
conversation storage
```

The current repository already implements this for the API Realtime path.

This is essential for:

> Speak by microphone → open Chat → continue from exactly where Saeed stopped.

---

# 27. Realtime and Standard STT Must Not Duplicate Turns

A Realtime provider may produce:

- partial transcript;
- final transcript;
- assistant transcript;
- audio;
- response completion.

The same turn must not be inserted multiple times.

The system must have turn identity/deduplication.

The current renderer already performs duplicate suppression for repeated Realtime user transcripts.

Future implementations should strengthen this into an explicit turn/session identifier where the provider supports it.

---

# 28. Streaming Audio

Realtime audio must be played incrementally.

The audio path should not wait for the entire response when the provider supports streaming.

Conceptually:

```text
audio chunk 1 → play
audio chunk 2 → play
audio chunk 3 → play
...
```

The current renderer schedules PCM chunks using an AudioContext and a `nextPlayTime` cursor.

The implementation must prevent:

- overlapping chunks;
- gaps caused by incorrect scheduling;
- uncontrolled queue growth;
- stale audio after cancellation.

---

# 29. Barge-In / User Interruption

Saeed must be interruptible.

If Saeed is speaking and the user starts speaking:

```text
User speech detected
        ↓
stop/cancel current TTS
        ↓
cancel Realtime response when applicable
        ↓
clear stale playback
        ↓
listen to new user turn
```

The current renderer detects voice activity while assistant speech is active and calls:

```text
window.saeed.cancelRealtime()
```

for Realtime cancellation.

This behavior must remain part of the architecture.

---

# 30. TTS Interruption

All TTS implementations must support immediate stop.

Conceptually:

```text
TTSProvider.stop()
```

The UI must never leave old audio playing after:

- user interruption;
- voice mute;
- microphone shutdown when policy requires output stop;
- conversation cancellation;
- provider failure;
- application shutdown.

---

# 31. Voice State Machine

The voice system should be understood as a state machine.

```text
OFF
 ↓
LISTENING
 ↓
TRANSCRIBING
 ↓
THINKING
 ↓
SPEAKING
 ↓
LISTENING
```

Additional transitions:

```text
SPEAKING
   └── user interruption → LISTENING

ANY ACTIVE STATE
   └── MIC OFF → OFF

SPEAKING
   └── MUTE → output stopped / text remains valid

ANY STATE
   └── provider error → ERROR → recover / OFF
```

Realtime may combine several of these phases internally, but the application must still expose an understandable lifecycle.

---

# 32. Microphone Button State

The microphone button above Saeed must reflect authoritative microphone state.

States:

- MIC OFF
- MIC ON
- MIC STARTING
- MIC ERROR

The UI must not infer microphone state merely from whether an AudioContext object exists.

The main-process VoiceHost is authoritative for the microphone mode.

---

# 33. Voice Mute State

Voice mute must be authoritative and shared.

The state is persisted in settings:

```text
voiceMuted
```

Mute changes must propagate to:

- character window;
- Chat window;
- voice playback;
- Realtime audio playback;
- tray controls;
- future voice surfaces.

---

# 34. Permission Boundary

Microphone access is a real device permission.

The application must preserve the existing explicit Electron media permission handling.

Microphone access must only become active after the user intentionally enables MIC.

Startup must not silently open the microphone.

The current startup contract is:

```text
MIC OFF
STT OFF
Realtime OFF
TTS idle
```

---

# 35. No Always-Listening Startup

Saeed must not start microphone capture automatically at application launch.

The character may exist and behave independently without microphone capture.

This is consistent with the Character Runtime principle:

> Presence does not require listening.

The user explicitly controls microphone activation.

---

# 36. Chat Surface and Voice Surface Independence

Closing the Chat window must not automatically destroy the conversation.

If MIC remains ON, the voice system continues.

If Chat is closed:

```text
Chat surface → closed
Voice → may remain active
Brain → remains active if Voice requires it
Conversation → remains active
```

If MIC is OFF and no active request/surface requires the Brain, the Brain may be released according to the Brain lifecycle policy.

The stored conversation remains available.

---

# 37. Conversation Identity

Every request must execute against the current conversation.

The active identity is:

```text
currentConversationId
```

Changing Chat tabs changes the active conversation for both Chat and future Voice turns.

Therefore:

```text
Select Chat B
   ↓
Agent.currentConversationId = B
   ↓
Agent.history = B.messages
   ↓
Next microphone turn belongs to Chat B
```

The Voice system must never cache a permanently separate conversation history.

---

# 38. Switching Conversations While Mic Is ON

If the user changes the active Chat conversation while MIC is ON:

- the current active conversation changes;
- future STT turns use the newly selected Agent history;
- Realtime/native session state must be handled carefully;
- pending voice turns from the previous conversation must not be accidentally committed to the new conversation.

The safe policy is:

1. finish or cancel the current turn;
2. switch conversation;
3. reset pending voice turn state;
4. continue listening in the new conversation.

A conversation switch must never mix messages between conversations.

---

# 39. New Chat While Mic Is ON

If the user creates a new Chat:

```text
New Conversation
   ↓
history = []
   ↓
currentConversationId = new ID
   ↓
Voice remains available
```

The next spoken sentence starts the new conversation.

No old voice context may leak into the new conversation.

For native Realtime sessions, the application must reset or recreate the provider session when required by the provider's context model.

---

# 40. Clear Chat

Clear Chat means:

- clear current conversation messages;
- preserve the conversation identity unless the product explicitly chooses otherwise;
- reset Chat display;
- ensure future Voice turns use the cleared history.

It must not:

- clear global memory;
- clear provider settings;
- disable microphone;
- delete other conversations.

---

# 41. Provider Settings

Provider configuration belongs to the application settings layer.

Current provider categories include:

```text
Brain / LLM
STT
TTS
Realtime
```

Each has independent:

- provider;
- model;
- API key;
- endpoint where applicable;
- voice where applicable;
- language where applicable;
- enabled/disabled state.

---

# 42. Example Independent Configuration

A valid configuration is:

```text
LLM
  Provider: Groq
  Model: selected Groq model

STT
  Provider: OpenAI
  Model: selected OpenAI transcription model

TTS
  Provider: ElevenLabs
  Model: eleven_flash_v2_5
  Voice: selected ElevenLabs voice

Realtime
  Provider: OpenAI
  Model: selected Realtime model
```

Standard Voice may use STT + LLM + TTS.

Realtime mode may instead use the native Realtime provider.

The user must be able to understand which path is active.

---

# 43. API Key Isolation

Provider credentials must remain isolated by service.

Current credential classes include:

```text
apiKey
sttApiKey
ttsApiKey
realtimeApiKey
```

Credentials are stored through the existing settings store and encrypted using Electron safeStorage when available.

Public settings exposed to renderer must not contain raw API keys.

---

# 44. Service Enable/Disable

Each service can be disabled independently where applicable:

```text
apiServices.brain
apiServices.stt
apiServices.tts
```

If a service is disabled:

- the UI must report the disabled state;
- the runtime must fail safely;
- another valid route may be used only when explicitly permitted by the routing policy;
- the application must never silently use an unexpected cloud provider.

---

# 45. Local Whisper

Local Whisper is a first-class STT option.

The current implementation uses the bundled Whisper runtime and model.

The flow is:

```text
PCM samples
   ↓
WAV wrapper
   ↓
whisper-cli.exe
   ↓
transcript
   ↓
Agent.runVoice()
```

Local STT is especially important when the selected Brain policy requires local-first behavior.

---

# 46. API STT

API STT receives the recorded audio through the main process.

The current abstraction supports providers such as:

- OpenAI;
- Groq;
- ElevenLabs.

The main process owns provider API communication.

Renderer code should not contain raw provider API keys.

---

# 47. Standard TTS

Standard TTS is initiated after the Brain produces the authoritative assistant text.

The renderer may use:

- browser/local TTS;
- API TTS.

The API TTS request goes through the protected Electron main-process IPC boundary.

The answer text remains authoritative even if TTS fails.

---

# 48. TTS Failure Policy

If TTS fails:

```text
Brain answer = valid
TTS = failed
```

The answer must still:

- appear in the character bubble;
- remain in conversation history;
- be available in Chat.

The system must report the TTS error diagnostically.

A TTS failure must never erase a successful Brain response.

---

# 49. STT Failure Policy

If STT fails:

- do not send an empty turn to the Brain;
- do not create a fake user message;
- keep the microphone service alive when possible;
- report the failure;
- allow the user to retry.

No conversation entry should be created for a turn that has no valid transcript.

---

# 50. Brain Failure Policy

If the Brain fails:

- preserve the user transcript if product policy requires failed-turn history;
- do not invent an assistant answer;
- show an error through the character/UI;
- stop TTS;
- return to a recoverable voice state.

The exact history policy for failed requests must be deterministic and tested.

---

# 51. Realtime Failure Policy

If Realtime disconnects:

- stop or pause streaming audio safely;
- clear stale playback;
- expose disconnected/error state;
- avoid duplicate reconnect loops;
- retry according to provider policy when appropriate;
- do not duplicate a completed conversation turn;
- preserve completed turns already written to Agent history.

The current OpenAI Realtime implementation includes bounded reconnect backoff.

---

# 52. Tool Calls From Voice

Voice requests may use the same ToolRegistry as Chat.

For standard STT:

```text
Voice transcript
   ↓
Agent
   ↓
Brain
   ↓
ToolRegistry
   ↓
tool result
   ↓
Brain
   ↓
answer
```

For native Realtime API mode, provider tool calls are routed through the approved ToolRegistry.

Voice must not have a separate unrestricted tool execution path.

---

# 53. Tool Permission Policy

Voice tool execution follows the same permissions as Chat.

The fact that the request came from a microphone does not grant additional authority.

Examples:

- file access;
- application control;
- network access;
- screen capture;
- mouse/keyboard control;
- destructive actions.

The same permission manager remains authoritative.

---

# 54. Voice Does Not Bypass Agent

A major architectural red line:

> Raw microphone audio must never directly control Windows tools.

The only valid path is:

```text
Audio
 ↓
STT / Realtime
 ↓
Text / semantic request
 ↓
Agent / Brain
 ↓
approved ToolRegistry
 ↓
Windows action
```

No voice provider may directly execute arbitrary system operations.

---

# 55. Conversation Context and Tool Results

Conversation history should contain user-facing conversational turns.

Internal tool execution details should remain handled according to the existing Brain/Agent architecture.

The Brain may use tool results during a turn without exposing raw internal protocol structures to the Chat UI.

The final assistant answer is the user-facing response.

---

# 56. Character Integration

Voice and Conversation systems do not own character bones or animation.

They communicate with the Character Runtime through semantic events.

Examples:

```text
voice listening
voice thinking
speech-start
speech-end
user-input
answer
tool reaction
error
```

The Character Runtime decides:

- posture;
- gaze;
- gesture;
- facial behavior;
- speaking animation;
- idle behavior;
- autonomous reactions.

Voice must never manipulate bones directly.

---

# 57. Speech Animation

When TTS begins:

```text
speech-start
   ↓
Character Runtime
   ↓
talking behavior
```

When TTS ends:

```text
speech-end
   ↓
Character Runtime
   ↓
return to appropriate state
```

The Voice system may report speech lifecycle.

The Character Runtime decides how Saeed visually expresses it.

---

# 58. Bubble Ownership

The character bubble is presentation.

The authoritative response remains the assistant text in the conversation system.

The bubble may show:

- standard Chat answer;
- standard Voice answer;
- Realtime final answer;
- important voice status;
- error status.

It must not become a second message database.

---

# 59. Realtime Transcript vs Conversation Message

Partial Realtime transcript is not automatically a conversation message.

Only a completed user turn should be committed.

Likewise:

- assistant audio delta is not a final message;
- assistant text delta is not a final stored answer;
- final assistant transcript is the authoritative candidate for history.

This prevents history corruption from partial streaming events.

---

# 60. Event Ownership

Recommended event ownership:

```text
VoiceHost
  owns:
    microphone lifecycle
    service lifecycle
    provider session

Voice Client
  owns:
    microphone capture
    PCM conversion
    local playback
    local interruption detection

Brain / Agent
  owns:
    conversation
    Brain execution
    history
    tools

Character Runtime
  owns:
    character reaction

Chat Renderer
  owns:
    Chat presentation
```

No layer should duplicate another layer's authority.

---

# 61. Current IPC Boundaries

Current public IPC capabilities include:

```text
voice:chat
voice:speak
tts:speak
stt:transcribe
realtime:start
realtime:stop
realtime:audio
realtime:cancel
local-stt:transcribe
mic:mode
voice:mute
```

Renderer-facing APIs are exposed through the preload bridge.

This keeps provider credentials and main-process network operations outside the renderer.

---

# 62. Voice Runtime vs Voice Client

The split is intentional.

### Main Process Voice Runtime

Responsible for:

- provider sessions;
- Realtime WebSocket;
- API STT;
- API TTS;
- microphone lifecycle authority;
- service shutdown;
- diagnostics;
- Agent integration.

### Renderer Voice Client

Responsible for:

- actual browser/Electron microphone capture;
- PCM conversion;
- local audio playback;
- visual voice state;
- speech interruption detection;
- character speech presentation.

This boundary should remain explicit.

---

# 63. Standard STT vs Realtime

The system must distinguish:

### Standard STT

```text
capture chunk
   ↓
detect speech end
   ↓
transcribe
   ↓
Agent
   ↓
answer
   ↓
TTS
```

### Realtime

```text
continuous audio stream
   ↓
Realtime session
   ↓
streaming transcript / response
   ↓
streaming audio
   ↓
final turn commit
```

Do not force both implementations into the same low-level transport.

They should share higher-level conversation contracts.

---

# 64. Common Conversation Contract

Both standard Voice and Realtime must ultimately produce:

```text
UserTurn {
  conversationId
  turnId
  text
  source: "chat" | "voice" | "realtime"
  createdAt
}
```

and:

```text
AssistantTurn {
  conversationId
  turnId
  text
  source: "chat" | "voice" | "realtime"
  createdAt
}
```

The existing history format may remain backward compatible, but the runtime should internally track turn identity.

---

# 65. Turn Identity

A future robust implementation should assign:

```text
conversationId
sessionId
turnId
```

to every active voice turn.

This allows:

- deduplication;
- interruption;
- cancellation;
- provider reconnect;
- late event rejection;
- conversation switching;
- diagnostics.

Late events from an obsolete turn must be ignored.

---

# 66. Stale Event Protection

If the user:

1. starts speaking;
2. changes Chat conversation;
3. receives a late STT/Realtime event;

that late event must not be committed to the new conversation.

The event must be rejected when its session/turn identity is no longer active.

---

# 67. Voice Session

A VoiceSession should conceptually contain:

```js
{
  id,
  conversationId,
  provider,
  mode,
  startedAt,
  state,
  activeTurnId,
  microphoneEnabled,
  muted,
  interrupted,
  destroyed
}
```

The session is transport/runtime state.

It is not the conversation itself.

---

# 68. Conversation Is Longer-Lived Than Voice Session

A voice session may end while the conversation remains.

Example:

```text
Voice session
  ↓
user talks
  ↓
Saeed answers
  ↓
MIC OFF
  ↓
Voice session ends
  ↓
Conversation remains stored
  ↓
Chat opens
  ↓
same conversation continues
```

This distinction is mandatory.

---

# 69. Realtime Session Is Not Conversation Identity

A Realtime WebSocket session may be recreated after:

- disconnect;
- provider error;
- provider change;
- conversation switch;
- reconnect.

Recreating the transport must not automatically create a new Saeed conversation.

The application's `conversationId` remains authoritative.

---

# 70. Provider Switching

Provider changes must not destroy conversation history.

For example:

```text
OpenAI STT
   ↓
conversation
   ↓
change STT to ElevenLabs
   ↓
same conversation
```

Likewise:

```text
OpenAI LLM
   ↓
Groq LLM
   ↓
same conversation history
```

Provider configuration and conversation identity are separate concerns.

---

# 71. Language

STT language is configurable.

The current settings support:

```text
auto
en
ar
...
```

The selected language should be passed to providers that support explicit language selection.

TTS language/voice selection must be independent.

Chat language and voice language should not be assumed to be identical unless configured.

---

# 72. Arabic Support

The architecture must support Arabic voice conversations.

Arabic must flow through the same pipeline:

```text
Arabic speech
   ↓
Arabic STT
   ↓
Arabic text
   ↓
Brain
   ↓
Arabic answer
   ↓
Arabic-capable TTS
   ↓
Saeed speech
```

No separate Arabic conversation system should be created.

---

# 73. Text Is the Semantic Interchange Format

The primary interchange boundary between Voice and Brain is text/semantic intent.

Therefore:

```text
Audio
  ↓
STT
  ↓
Text
  ↓
Brain
```

and:

```text
Brain
  ↓
Text
  ↓
TTS
  ↓
Audio
```

The Brain should not depend on provider-specific audio formats.

Native Realtime is the exception at the transport level, but it must still expose a common conversational result to the rest of Saeed.

---

# 74. LLM Boundary

The LLM determines conversational meaning.

The LLM does not control:

- microphone hardware;
- TTS playback;
- audio buffers;
- character bones;
- raw 3D transforms.

The Voice Runtime and Character Runtime remain authoritative for their domains.

---

# 75. Latency Goals

The architecture should optimize:

```text
mic → speech detection
speech detection → transcript
transcript → first Brain token
first token → first TTS audio
first audio → user hearing
```

For Realtime providers, streaming should minimize time to first audio.

For standard STT/TTS, the system should remain asynchronous and non-blocking.

---

# 76. No Blocking UI

Microphone capture must not block:

- character rendering;
- Chat UI;
- autonomous character behavior;
- window movement.

TTS playback must not block Chat input.

Brain execution must not freeze the character renderer.

---

# 77. Audio Resource Management

Every audio resource must have a clear owner and shutdown path.

Resources include:

- MediaStream;
- MediaStreamTrack;
- AudioContext;
- AudioBufferSourceNode;
- ScriptProcessor/AudioWorklet;
- WebSocket;
- provider session;
- playback queue.

MIC OFF must release microphone resources.

Mute must stop audible output.

Application shutdown must stop all voice services.

---

# 78. No Resource Leaks

The system must never accumulate:

- microphone streams;
- WebSockets;
- AudioContexts;
- audio source nodes;
- timers;
- provider reconnect timers;
- stale event listeners.

Every start must have a matching stop/dispose path.

---

# 79. Diagnostics

Voice diagnostics must expose enough information to identify which layer failed.

Examples:

```text
MIC START
MIC ACTIVE
MIC STOP
MIC OPEN ERROR
MIC ENDED

STT START
STT RESULT
STT ERROR
STT CONNECTED
STT DISCONNECTED

BRAIN ROUTE
VOICE BRAIN ANSWER
BRAIN ERROR

TTS START
TTS AUDIO
TTS ERROR
TTS INTERRUPTED

REALTIME CONNECTED
REALTIME DISCONNECTED
REALTIME API ERROR
REALTIME RESPONSE DONE
```

Diagnostics must never expose API keys.

---

# 80. User-Visible Status

The application should make it possible to determine:

- MIC ON/OFF;
- Voice Muted/Unmuted;
- STT provider;
- TTS provider;
- LLM provider;
- Realtime provider;
- current voice mode;
- connection state;
- current conversation.

The Performance/Status surfaces remain diagnostic/control surfaces, not alternate conversation owners.

---

# 81. Security Rules

Voice input is user input.

It must follow the same security model as Chat.

Never:

- send microphone audio to an unselected provider;
- use a hidden provider;
- expose API keys to the renderer;
- let voice bypass permission checks;
- let Realtime directly execute arbitrary commands;
- persist raw microphone audio unless explicitly required by a future feature;
- transmit audio when MIC is OFF.

---

# 82. Privacy Rule

The default microphone state is OFF.

When MIC is OFF:

```text
No microphone capture
No STT audio
No Realtime audio stream
```

When MIC is ON, audio is sent only to the selected active voice route.

If the selected STT is local, audio must remain local except where another explicitly enabled service requires it.

---

# 83. Realtime Privacy

Realtime mode may transmit continuous audio to the selected Realtime provider.

The UI should clearly indicate that Realtime is active.

Stopping Realtime must stop audio transmission immediately.

---

# 84. Voice and Autonomous Character Behavior

Voice activity must integrate with the Character Runtime.

Example:

```text
User speaks
   ↓
Character Runtime:
  listening / attentive
```

Saeed answers:

```text
Brain answer
   ↓
TTS start
   ↓
Character Runtime:
  speaking
```

After speech:

```text
TTS end
   ↓
Character Runtime:
  normal / idle / autonomous policy
```

Voice is therefore a semantic event source for the Character Runtime, not its owner.

---

# 85. User Interaction Priority

When the user is actively speaking:

- autonomous attention must yield;
- autonomous voice must yield;
- autonomous major movement should not interfere with listening;
- current autonomous thought must not compete with the user's turn.

This follows the Character Runtime rule:

> User-driven events always win.

---

# 86. Autonomous Voice

Autonomous character speech is separate from conversational Voice input.

It must be heavily restricted.

Autonomous speech must never:

- speak over the user;
- speak while the user is actively talking;
- interrupt an important answer;
- ignore mute;
- bypass the TTS provider;
- create fake conversation turns unless explicitly classified as an autonomous conversational event.

---

# 87. Chat TTS

Chat answers may also be spoken.

The current Chat renderer can request speech for assistant answers.

This must use the same voice settings and mute state as the character voice system.

Chat TTS must not create a second TTS configuration.

---

# 88. One TTS Authority

There must be one effective TTS policy.

Different UI surfaces may request speech, but the system must prevent conflicting playback.

Example:

```text
Chat TTS playing
      ↓
Voice request arrives
      ↓
TTS arbitration
      ↓
old playback stopped or request queued according to policy
```

The application must never play two unrelated Saeed responses simultaneously.

---

# 89. Audio Arbitration

Communication intrusiveness follows:

```text
micro motion
   <
major motion
   <
bubble
   <
sound
   <
voice
```

Voice output is therefore one of the most intrusive character channels.

It must respect:

- mute;
- user speech;
- active Chat request;
- active Realtime response;
- autonomous behavior policy.

---

# 90. Realtime Cancellation

Cancellation must propagate through the complete active response:

```text
User interruption
   ↓
Realtime response.cancel
   ↓
provider stops generation
   ↓
renderer stops queued audio
   ↓
Character Runtime receives speech-end/interrupted
```

Late audio chunks from the cancelled response must be discarded.

---

# 91. Standard TTS Cancellation

For standard API/local TTS:

```text
interrupt
   ↓
stop current AudioBufferSourceNode / speechSynthesis
   ↓
clear playback state
   ↓
Character Runtime speech-end
```

The next response starts from a clean playback state.

---

# 92. Conversation Commit Timing

Standard Voice:

```text
STT final
   ↓
Brain answer
   ↓
commit user + assistant turn
```

Realtime:

```text
final user transcript
   +
final assistant transcript
   ↓
commit exchange
```

Partial transcripts are never authoritative history.

---

# 93. Failed/Interrupted Turns

If the user interrupts Saeed before a response completes, the system must distinguish:

- completed assistant answer;
- partial generated text;
- cancelled answer.

A cancelled answer must not be stored as if it were a complete response.

If the provider returns a valid final answer before cancellation, it may be committed according to turn state.

This must be deterministic and covered by tests.

---

# 94. Conversation Persistence Guarantees

A successful conversational turn must survive:

- closing Chat;
- hiding Saeed;
- turning MIC OFF;
- stopping Realtime;
- restarting the Chat window.

It must remain associated with the active conversation.

---

# 95. Current Storage Limit

The current Agent retains up to approximately 200 messages per conversation in persistent storage and sends the recent context to the model according to Brain policy.

The architecture must preserve this behavior unless a future memory/context system intentionally changes it.

Conversation history and Global Memory remain separate.

---

# 96. Global Memory vs Conversation History

These are different systems.

Conversation history:

```text
What happened in this conversation?
```

Global memory:

```text
What stable user facts/preferences should Saeed remember?
```

Voice must not write every spoken sentence into Global Memory.

Voice turns belong to Conversation History.

Only explicit memory rules may promote information to Global Memory.

---

# 97. Provider-Agnostic UI

The UI should expose provider settings in a way that does not hard-code one vendor as the architecture.

Example:

```text
STT Provider
  [OpenAI]
  [Groq]
  [ElevenLabs]
  [Local Whisper]

TTS Provider
  [OpenAI]
  [Groq]
  [ElevenLabs]
  [Local]

LLM Provider
  [OpenAI]
  [Groq]
  [Anthropic]
  [Gemini]
  [OpenAI-compatible]

Realtime Provider
  [OpenAI]
  [Gemini]
  [...]
```

Provider-specific options appear only when relevant.

---

# 98. Native Realtime vs Composed Voice Stack

The user must understand that these are two different architectures.

### Composed Stack

```text
Mic
 ↓
STT Provider
 ↓
Saeed Brain / LLM
 ↓
TTS Provider
 ↓
Audio
```

### Native Realtime

```text
Mic
 ↓
Realtime Provider
 ↕
native streaming conversation
 ↓
Audio
```

The application may offer both.

---

# 99. Realtime Provider Independence

The Realtime interface must not assume OpenAI-specific event names outside the adapter.

Provider adapters translate native events into Saeed events such as:

```text
connected
disconnected
user-transcript-delta
user-transcript-final
assistant-text-delta
assistant-text-final
assistant-audio
response-start
response-end
tool-call
error
```

This prevents OpenAI/Gemini protocol details from leaking throughout the application.

---

# 100. Standard STT Provider Independence

Likewise, STT providers should expose a common result:

```js
{
  text,
  language?,
  confidence?,
  isFinal: true
}
```

The Brain receives text, not provider-specific response structures.

---

# 101. Standard TTS Provider Independence

TTS providers should expose a common output:

```js
{
  audio,
  format,
  sampleRate?,
  duration?,
  provider
}
```

The playback system should not care whether the bytes came from OpenAI, ElevenLabs, Groq, or a local engine.

---

# 102. Conversation Provider Metadata

Provider information may be recorded in diagnostics or internal turn metadata.

It should not change the semantic content of the conversation.

A conversation can contain turns generated using different providers.

---

# 103. No Provider Lock-In

Changing:

- STT provider;
- TTS provider;
- LLM provider;
- Realtime provider;

must not require changing the Chat renderer.

The Chat renderer should operate against the common conversation contract.

---

# 104. Current Repository Mapping

The current architecture maps approximately as follows:

```text
character presentation layer
  └── microphone button
  └── bubble

voice client layer
  └── microphone capture
  └── PCM conversion
  └── local STT flow
  └── API STT requests through IPC
  └── TTS playback
  └── Realtime playback
  └── interruption

voice host layer
  └── microphone lifecycle
  └── Voice runtime ownership
  └── local Whisper runtime

voice runtime layer
  └── native Realtime orchestration

realtime provider adapter layer
  └── OpenAI Realtime adapter
  └── Gemini Live adapter

voice IPC boundary
  └── voice IPC boundary
  └── STT/TTS API calls
  └── Realtime transport IPC

conversation/Agent layer
  └── conversation state
  └── history
  └── run()
  └── runVoice()
  └── recordConversationExchange()

Brain layer
  └── common Brain routing

LLM execution layer
  └── LLM/API execution

Chat IPC boundary
  └── Chat → Agent

conversation management boundary
  └── conversation management

Chat presentation layer
  └── Chat UI
  └── Chat history rendering
  └── Chat answer speech request

application bridge
  └── renderer/main-process bridge
```

---

# 105. Existing Mechanism That Must Be Preserved

The following current mechanism is explicitly part of the architecture:

### Chat

```text
Chat presentation layer
  → window.saeed.chat()
  → IPC chat
  → Agent.run()
  → Brain.run()
  → Agent.history
```

### Standard Voice

```text
voice client layer
  → STT
  → window.saeed.voiceChat()
  → IPC voice:chat
  → Agent.runVoice()
  → Brain.run()
  → Agent.history
```

### Native Realtime API Brain

```text
Realtime
  → final user transcript
  → final assistant transcript
  → Agent.recordConversationExchange()
  → Agent.history
```

This is the mechanism that allows:

```text
VOICE → CHAT
and
CHAT → VOICE
```

to continue the same conversation.

---

# 106. Architectural Red Lines

The following are forbidden:

1. Separate Voice Agent.
2. Separate Voice conversation database.
3. Separate Voice memory.
4. Voice bypassing Agent.
5. Voice directly controlling tools.
6. Chat maintaining an independent authoritative history.
7. Realtime provider silently creating an unrelated conversation.
8. TTS becoming the source of conversational truth.
9. Partial transcripts being stored as final messages.
10. API keys exposed to renderer JavaScript.
11. Microphone starting at application startup.
12. Audio continuing after mute when mute requires immediate stop.
13. Audio continuing after MIC OFF when the voice lifecycle requires shutdown.
14. Duplicate conversation turns.
15. Late Realtime events modifying a different conversation.
16. Character code manipulating voice provider internals.
17. Voice code manipulating character bones.
18. Provider-specific protocols leaking into Chat UI.
19. Two simultaneous authoritative TTS streams.
20. Realtime being treated as a hidden second Brain without explicit routing mode.

---

# 107. Required Test Scenarios

## Test 1 — Chat → Voice

1. Start Chat.
2. Send a message.
3. Receive answer.
4. Enable MIC.
5. Ask a follow-up by voice.
6. Verify Brain receives previous Chat history.
7. Verify answer appears above Saeed.
8. Verify answer is spoken when unmuted.
9. Verify both turns are stored in the same conversation.

## Test 2 — Voice → Chat

1. MIC ON.
2. Speak.
3. Receive spoken answer.
4. Turn MIC OFF.
5. Open Chat.
6. Verify previous voice turn appears.
7. Send text follow-up.
8. Verify continuity.

## Test 3 — Voice → Chat While Mic Remains ON

1. Speak.
2. Saeed answers.
3. Open Chat without turning MIC OFF.
4. Send text.
5. Continue speaking.
6. Verify all turns remain in one conversation.

## Test 4 — Chat Conversation Switching

1. Create Chat A.
2. Speak in A.
3. Create Chat B.
4. Speak in B.
5. Verify B does not receive A's voice history.
6. Select A.
7. Verify Voice continues from A.

## Test 5 — Mute

1. MIC ON.
2. Voice unmuted.
3. Ask a question.
4. Verify TTS.
5. Mute.
6. Ask another question.
7. Verify answer is generated and displayed.
8. Verify no audible output.

## Test 6 — Unmute

1. Keep MIC ON.
2. Unmute.
3. Ask a new question.
4. Verify TTS resumes using the selected provider.

## Test 7 — STT Provider Switching

Test:

```text
Local Whisper
OpenAI
Groq
ElevenLabs
```

Verify all produce the same common transcript contract.

## Test 8 — TTS Provider Switching

Test:

```text
Local
OpenAI
Groq
ElevenLabs
```

Verify all use the same assistant answer.

## Test 9 — LLM Provider Switching

Switch LLM provider without clearing history.

Verify conversation continuity remains.

## Test 10 — Realtime

1. Enable Realtime.
2. Speak.
3. Verify streaming audio.
4. Verify final transcript.
5. Verify final answer.
6. Verify history persistence.
7. Open Chat.
8. Continue from the same conversation.

## Test 11 — Barge-In

1. Saeed speaks.
2. User begins speaking.
3. Verify Saeed stops speaking.
4. Verify stale audio does not continue.
5. Verify new user turn is processed.

## Test 12 — Provider Failure

Break the selected STT/TTS/LLM/RealtIme credential.

Verify:

- clear diagnostic;
- no crash;
- no fake conversation turn;
- recoverable state.

---

# 108. CI Requirements

CI must verify:

- Voice files exist.
- Voice IPC exists.
- STT/TTS provider settings exist.
- Realtime adapters exist.
- Chat and Voice both reference the same Agent.
- `runVoice()` uses the same Brain.
- Realtime final exchanges can be persisted to Agent history.
- microphone default is OFF;
- mute state exists;
- API keys are not exposed in public settings;
- voice IPC does not directly bypass permission policy;
- duplicate conversation storage is not introduced;
- provider selection remains independent;
- Realtime cancellation exists;
- microphone shutdown releases resources.

---

# 109. Conversation Continuity Acceptance Test

The most important acceptance test is:

```text
1. User types in Chat.
2. Saeed answers.
3. User turns Chat off/away.
4. User turns MIC ON.
5. User speaks a follow-up.
6. Saeed understands the previous Chat message.
7. Saeed answers by voice.
8. Bubble displays the answer.
9. User opens Chat.
10. The complete conversation is visible.
11. User types another follow-up.
12. Saeed continues normally.
```

If this test fails, the Voice/Conversation architecture is considered broken.

---

# 110. Realtime Continuity Acceptance Test

```text
1. Select Realtime.
2. Speak.
3. Receive streaming response.
4. Wait for final assistant transcript.
5. Commit the completed exchange.
6. Open Chat.
7. Verify the user transcript and assistant answer exist.
8. Type a follow-up.
9. Verify the Brain understands the Realtime turn.
```

---

# 111. Final Architecture

The complete system is:

```text
                         ┌─────────────────────┐
                         │   Conversation      │
                         │ Agent / History     │
                         └──────────┬──────────┘
                                    │
                      ┌─────────────┴─────────────┐
                      │                           │
                    CHAT                        VOICE
                      │                           │
                 text input                  microphone
                      │                           │
                      │                  ┌────────┴────────┐
                      │                  │                 │
                      │             Standard STT       Realtime
                      │                  │                 │
                      │                  └────────┬────────┘
                      │                           │
                      └──────────────┬────────────┘
                                     ↓
                                  Brain
                                     ↓
                              LLM / Agent
                                     ↓
                                Answer Text
                                  /      \
                                 /        \
                              Bubble      TTS
                                            │
                                            ↓
                                         Audio
                                            │
                                            ↓
                                          Saeed
```

---

# 112. Authoritative Principles

1. **Chat and Voice are peers.**
2. **Both use the same Agent.**
3. **Both use the same active conversation.**
4. **Both use the same Brain.**
5. **Voice does not create a second Brain.**
6. **Voice does not create a second history.**
7. **Realtime is a transport/session mode, not automatically a separate conversation.**
8. **STT, TTS, LLM, and Realtime providers are independently selectable.**
9. **The assistant text is the authoritative conversational answer.**
10. **TTS is an output representation of that answer.**
11. **Bubble is presentation, not storage.**
12. **MIC controls listening.**
13. **Mute controls audible output.**
14. **MIC OFF means no microphone capture.**
15. **MIC must not start automatically.**
16. **User speech can interrupt Saeed speech.**
17. **Tool permissions remain identical across Chat and Voice.**
18. **Raw audio never directly controls system tools.**
19. **Character Runtime owns character behavior, not Voice.**
20. **Voice Runtime owns voice transport, not character bones.**
21. **Conversation state outlives individual voice sessions.**
22. **Provider changes do not create new conversations.**
23. **Partial streaming events are not final conversation messages.**
24. **Late/stale events must never modify the wrong conversation.**
25. **Every successful voice turn must be available to Chat.**
26. **Every relevant Chat turn must be available to Voice.**

---

# 113. Final Product Principle

> Saeed should feel like one person regardless of how the user talks to him.

The user may:

```text
type → speak → type → speak → realtime → type
```

without manually transferring context.

All of these are simply different interfaces to the same Saeed:

```text
                 SAME SAEED
                     │
        ┌────────────┼────────────┐
        ↓            ↓            ↓
       Chat         Voice       Realtime
        │            │            │
        └────────────┼────────────┘
                     ↓
                 Same Agent
                     ↓
                 Same Brain
                     ↓
             Same Conversation
```

The final rule is:

> **Saeed must never feel like Voice Saeed and Chat Saeed are two different assistants. There is one Saeed, one active conversation, one Agent, and one authoritative conversational history.**
