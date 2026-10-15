// Owns window lifecycle and 3D status IPC. No application services are created here.
function registerWindowIpc({
  ipcMain, BrowserWindow, screen, accept3DStatus, request3DStatus, show3DStatus, diagnostic
}) {
  ipcMain.on("3d:status-report", (_event, requestId, report) => accept3DStatus(requestId, report));
  ipcMain.on("window:close-self", event => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win && !win.isDestroyed()) win.close();
    } catch (error) {
      diagnostic("ERROR", "WINDOW CLOSE", error.message);
    }
  });
  ipcMain.on("window:move-by", (event, dx, dy) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win || win.isDestroyed()) return;
      const [x, y] = win.getPosition();
      const [width, height] = win.getSize();
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const displays = screen.getAllDisplays();
      let display = screen.getPrimaryDisplay();
      let nearestDistance = Infinity;
      for (const candidate of displays) {
        const area = candidate.workArea;
        const nearestX = Math.max(area.x, Math.min(centerX, area.x + area.width));
        const nearestY = Math.max(area.y, Math.min(centerY, area.y + area.height));
        const distance = (centerX - nearestX) ** 2 + (centerY - nearestY) ** 2;
        if (distance < nearestDistance) {
          nearestDistance = distance;
          display = candidate;
        }
      }
      const area = display.workArea;
      const stepX = Math.max(-100, Math.min(100, Number(dx) || 0));
      const stepY = Math.max(-100, Math.min(100, Number(dy) || 0));
      const nextX = Math.max(area.x, Math.min(Math.round(x + stepX), area.x + area.width - width));
      const nextY = Math.max(area.y, Math.min(Math.round(y + stepY), area.y + area.height - height));
      win.setPosition(Math.trunc(nextX), Math.trunc(nextY), false);
    } catch (error) {
      diagnostic("ERROR", "3D WINDOW MOVE", error.message);
    }
  });
  ipcMain.handle("3d:query", () => request3DStatus());
  ipcMain.handle("3d-status:show", () => {
    show3DStatus();
    return true;
  });
}
module.exports = { registerWindowIpc };
