// Diagnostics and service health IPC. Window creation remains outside this module.
function registerCoreIpc({
  ipcMain, diagnostic, diagnosticState, getApiHealth, getResourceService, updateCpuMetrics
}) {
  ipcMain.handle("diagnostic:report", (_event, level, stage, message, meta) => {
    return diagnostic(level, stage, message, meta);
  });
  ipcMain.handle("diagnostic:snapshot", () => ({ state: diagnosticState }));
  ipcMain.handle("api-status:test", (_event, service) => getApiHealth().test(String(service || "")));
  ipcMain.handle("api-status:test-all", () => getApiHealth().testAll());
  ipcMain.handle("resource:snapshot", () => getResourceService().resourceReport());
  ipcMain.handle("cpu:metrics", () => {
    updateCpuMetrics();
    return diagnosticState.cpu;
  });
}
module.exports = { registerCoreIpc };
