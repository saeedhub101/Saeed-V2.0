// Diagnostics, service health, and resource snapshots are registered independently from app/window IPC.
function registerCoreIpc({ ipcMain, diagnostic, diagnosticState, getApiHealth, getResourceService, updateCpuMetrics }) {
  ipcMain.handle("diagnostic:report",(_,level,stage,message,meta)=>diagnostic(level,stage,message,meta));ipcMain.handle("diagnostic:snapshot",()=>({state:diagnosticState}));ipcMain.handle("api-status:test",(_,service)=>getApiHealth().test(String(service||"")));ipcMain.handle("api-status:test-all",()=>getApiHealth().testAll());ipcMain.handle("resource:snapshot",()=>getResourceService().resourceReport());ipcMain.handle("cpu:metrics",()=>{updateCpuMetrics();return diagnosticState.cpu});
}
module.exports = { registerCoreIpc };
