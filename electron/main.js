const { app, BrowserWindow, screen, ipcMain, nativeImage } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const { ClaudeWatcher } = require('./watcher');

let compactWin = null;
let watcher = null;

function createCompactWindow() {
  const { width: screenW } = screen.getPrimaryDisplay().workAreaSize;
  const compactW = 420;
  const compactH = 180;

  compactWin = new BrowserWindow({
    width: compactW,
    height: compactH,
    x: Math.floor((screenW - compactW) / 2),
    y: 0,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: true,
    hasShadow: false,
    icon: path.join(__dirname, '..', 'assets', 'icon.icns'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  compactWin.loadFile(path.join(__dirname, '..', 'src', 'compact.html'));
  compactWin.setVisibleOnAllWorkspaces(true);

  return compactWin;
}

app.whenReady().then(() => {
  // Set dock icon on macOS
  if (process.platform === 'darwin') {
    const dockIcon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'icon_1024.png'));
    app.dock.setIcon(dockIcon);
  }

  compactWin = createCompactWindow();

  // Start Claude Code watcher
  watcher = new ClaudeWatcher();
  watcher.start();

  watcher.on('instance-update', (snapshot) => {
    if (compactWin && !compactWin.isDestroyed()) {
      compactWin.webContents.send('claude-instances', snapshot);
    }
  });

  // Refresh session stats every 10s
  setInterval(() => {
    if (!watcher) return;
    for (const [pid] of watcher.instances) {
      watcher.refreshSessionStats(pid).then(() => watcher.emitIfChanged());
    }
  }, 10000);

  ipcMain.on('reset-watcher-stats', () => {
    if (watcher) watcher.resetStats();
  });

  // Hide to dock
  ipcMain.on('hide-compact', () => {
    if (compactWin && !compactWin.isDestroyed()) compactWin.hide();
  });

  // Quit app
  ipcMain.on('quit-app', () => {
    app.isQuitting = true;
    app.quit();
  });

  // Drag compact window by delta
  ipcMain.on('move-compact-window', (_, { dx, dy }) => {
    if (!compactWin || compactWin.isDestroyed()) return;
    const [x, y] = compactWin.getPosition();
    compactWin.setPosition(x + Math.round(dx), y + Math.round(dy));
  });

  // Snap compact window to top-center of screen
  ipcMain.on('snap-compact-window', () => {
    if (!compactWin || compactWin.isDestroyed()) return;
    const { width: screenW } = screen.getPrimaryDisplay().workAreaSize;
    const compactW = 420;
    compactWin.setPosition(Math.floor((screenW - compactW) / 2), 0);
  });

  // Focus a Claude instance by bringing its terminal app to front
  ipcMain.handle('focus-instance', async (_, pid) => {
    const appName = (watcher ? watcher.getTerminalApp(pid) : null) || 'Terminal';

    // Unminimize all windows, then activate the app to bring it to front.
    // This handles windows minimized to dock.
    const script = `
      tell application "${appName}"
        reopen
        activate
      end tell
    `;
    return new Promise((resolve) => {
      execFile('osascript', ['-e', script], () => resolve());
    });
  });

  // Auto-resize compact window to fit content
  ipcMain.on('resize-compact', (_, { height }) => {
    if (!compactWin || compactWin.isDestroyed()) return;
    const [w] = compactWin.getSize();
    compactWin.setSize(w, Math.max(50, Math.min(400, height)));
  });

  // Make transparent areas click-through
  ipcMain.on('set-ignore-mouse', (_, ignore) => {
    if (!compactWin || compactWin.isDestroyed()) return;
    if (ignore) {
      compactWin.setIgnoreMouseEvents(true, { forward: true });
    } else {
      compactWin.setIgnoreMouseEvents(false);
    }
  });
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (watcher) watcher.stop();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (compactWin) compactWin.show();
});
