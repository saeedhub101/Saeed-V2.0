// Application-level IPC: metadata, settings, feature windows, and transcript preference.
function registerAppIpc({
  ipcMain, app, composition, getAgent, showStatus, showPerformance, showSettings, showAddons
}) {
  ipcMain.handle("app:version", () => app.getVersion());
  ipcMain.handle("capture", async () => { const image = await composition.captureScreen?.(); return image || null; });
  ipcMain.handle("settings:get", () => {
    const agent = getAgent();
    if (agent) return agent.publicSettings();
    const { createSettingsStore } = require("../services/settings-store");
    const store = createSettingsStore(app.getPath("userData"));
    return store.public(store.load());
  });

  // Retained for compatibility with existing renderer activity notifications.
  ipcMain.on("character:activity", () => {});

  ipcMain.handle("transcript-label:get", () => composition.getTranscriptLabelEnabled?.() === true);
  ipcMain.handle("transcript-label:set", (_event, enabled) => {
    composition.setTranscriptLabelEnabled?.(enabled);
    const actual = composition.getTranscriptLabelEnabled?.() === true;
    return { ok: actual === Boolean(enabled), enabled: actual };
  });
  ipcMain.handle("app:chat:show", async () => { await composition.ensureChatHost?.().showChat(); return true; });
  ipcMain.handle("status:show", () => { showStatus(); return true; });
  ipcMain.handle("performance:show", () => { showPerformance(); return true; });
  ipcMain.handle("character-settings:show", () => {
    composition.showCharacterSettings?.();
    return true;
  });
  ipcMain.handle("settings:show", () => { showSettings(); return true; });
  ipcMain.handle("addons:show", () => { showAddons(); return true; });
  ipcMain.handle("app:learning:show", () => composition.showLearning?.() || false);
  ipcMain.handle("app:update-status:show", () => composition.showUpdateStatus?.() || false);
}
module.exports = { registerAppIpc };
