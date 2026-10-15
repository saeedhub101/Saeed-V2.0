// One boundary for translating brain and realtime events into safe character semantics.
// This module is loaded only when the brain or realtime voice runtime is first used.
const CHARACTER_EVENT_TYPES = new Set([
  "user-input", "user-message", "user-transcript",
  "thinking", "tool", "tool-start", "tool-progress",
  "tool_result", "tool-success", "tool_error", "tool-failure",
  "task-complete", "task-failure", "task-finished", "task-start",
  "answer", "assistant-message", "assistant-response", "voice-answer",
  "speech-start", "assistant-speech-start", "speech-end", "assistant-speech-end",
  "speech-cancelled", "listening-start", "listening-end",
  "mute", "muted", "audio-muted", "voice-muted",
  "chat-end", "assistant-cancelled", "request-cancelled",
  "double-click", "right-click", "summon", "zoom", "hover",
  "drag-start", "drag-end", "app-focus", "app-blur", "wake",
  "user-busy-start", "user-busy-end", "system-busy", "system-active",
  "idle-timeout"
]);

function toCharacterSemanticEvent(event) {
  if (!event || typeof event !== "object") return null;
  const sourceType = String(event.type || "").trim().toLowerCase();
  if (!CHARACTER_EVENT_TYPES.has(sourceType)) return null;

  const status = String(event.status || "").trim().toLowerCase();
  let type = sourceType;
  if (sourceType === "task-start" || sourceType === "thinking") type = "thinking";
  else if (sourceType === "tool-start") type = "tool";
  else if (sourceType === "tool-success") type = "tool_result";
  else if (sourceType === "tool-failure") type = "tool_error";
  else if (sourceType === "answer" || sourceType === "assistant-response" || sourceType === "voice-answer") type = "assistant-message";
  else if (sourceType === "task-finished") {
    type = status === "finished" || status === "success" || status === "completed"
      ? "task-complete"
      : ["needs_attention", "failed", "error", "cancelled"].includes(status)
        ? "task-failure"
        : "chat-end";
  }

  const name = String(event.name || "").slice(0, 120);
  const result = event.result && typeof event.result === "object" ? event.result : null;
  const text = type === "user-input" || type === "user-message" || type === "user-transcript"
    ? String(event.text || event.message?.content || event.message || event.transcript || event.content || "").slice(0, 500)
    : type === "assistant-message"
      ? String(event.text || event.answer || event.message?.content || event.message || event.content || "").slice(0, 500)
      : undefined;

  const semantic = {
    type,
    source: String(event.source || "brain").slice(0, 40),
    sourceType,
    ...(text !== undefined ? { text } : {}),
    ...(name ? { name } : {}),
    ...(event.status !== undefined ? { status: String(event.status).slice(0, 80) } : {})
  };

  if (type === "tool_result") {
    const ok = event.success === false || result?.ok === false ? false : true;
    semantic.success = ok;
    semantic.resultMeta = {
      ok,
      kind: String(result?.kind || result?.type || "").slice(0, 80) || null,
      hasData: Boolean(result && Object.keys(result).some(key => !["ok", "status", "kind", "type"].includes(key)))
    };
    if (!ok) {
      semantic.type = "tool_error";
      semantic.error = String(event.error || result?.error || "Tool failed").slice(0, 240);
    }
  } else if (type === "tool_error" || type === "task-failure") {
    semantic.success = false;
    semantic.error = String(event.error || event.message || event.status || "Task failed").slice(0, 240);
  } else if (type === "task-complete") {
    semantic.success = true;
  }

  // Never forward tool arguments, file contents, model payloads, or raw result objects.
  return semantic;
}

module.exports = { toCharacterSemanticEvent };
