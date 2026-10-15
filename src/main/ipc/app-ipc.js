// Application-level IPC: app metadata, settings, feature windows, and transcript label preference.
function registerAppIpc({ ipcMain, app, composition, getAgent, getApiHealth, getResourceService, updateCpuMetrics, diagnosticState, showStatus, showPerformance, showSettings, showAddons }) {
  const agent = getAgent();
  ipcMain.handle("app:version",()=>app.getVersion());ipcMain.handle("settings:get",()=>{if(getAgent())return getAgent().publicSettings();const {createSettingsStore}=require("../services/settings-store");const store=createSettingsStore(app.getPath("userData"));return store.public(store.load())});ipcMain.on("character:activity",()=>{});
  ipcMain.handle("transcript-label:get",()=>composition.getTranscriptLabelEnabled?.()===true);
ipcMain.handle("transcript-label:set",(_,enabled)=>{composition.setTranscriptLabelEnabled?.(enabled);const actual=composition.getTranscriptLabelEnabled?.()===true;return {ok:actual===Boolean(enabled),enabled:actual}});
}
module.exports = { registerAppIpc };
