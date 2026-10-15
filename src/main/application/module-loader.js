"use strict";

/**
 * Process-wide CommonJS module registry.
 *
 * Loading is synchronous by design: CommonJS factories are synchronous, and
 * every named module has one authoritative cache entry. Failed loads are not
 * cached as successful values, so diagnostics and a later retry remain honest.
 */
function createModuleLoader({ onEvent } = {}) {
  const records = new Map();
  let sequence = 0;

  function emit(type, record, error) {
    try {
      onEvent?.({
        type,
        name: record.name,
        state: record.state,
        sequence: record.sequence,
        error: error ? String(error?.stack || error?.message || error) : undefined,
        at: new Date().toISOString()
      });
    } catch {}
  }

  function load(name, factory) {
    const key = String(name || "").trim();
    if (!key) throw new TypeError("A non-empty module name is required");
    if (typeof factory !== "function") throw new TypeError("Module factory must be a function");

    const current = records.get(key);
    if (current?.state === "loaded") return current.value;
    if (current?.state === "loading") {
      throw new Error("Circular module load detected: " + key);
    }

    const record = {
      name: key,
      state: "loading",
      sequence: ++sequence,
      startedAt: Date.now(),
      value: undefined,
      error: null
    };
    records.set(key, record);
    emit("load-start", record);

    try {
      const value = factory();
      record.value = value;
      record.state = "loaded";
      record.loadedAt = Date.now();
      emit("load-success", record);
      return value;
    } catch (error) {
      record.state = "failed";
      record.error = String(error?.stack || error?.message || error);
      record.failedAt = Date.now();
      emit("load-failure", record, error);
      // Keep the failure visible in snapshots; a later call may replace it with a new attempt.
      throw error;
    }
  }

  function has(name) {
    return records.get(String(name))?.state === "loaded";
  }

  function get(name) {
    const record = records.get(String(name));
    return record?.state === "loaded" ? record.value : undefined;
  }

  function snapshot() {
    return [...records.values()]
      .map(({ name, state, sequence, startedAt, loadedAt, failedAt, error }) => ({
        name, state, sequence, startedAt, loadedAt, failedAt, error
      }))
      .sort((a, b) => a.sequence - b.sequence);
  }

  return Object.freeze({ load, has, get, snapshot });
}

module.exports = { createModuleLoader };
