const { app, BrowserWindow, screen, ipcMain, nativeImage } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const { ClaudeWatcher } = require('./watcher');

let compactWin = null;
let watcher = null;

function createCompactWindow() {
  const { width: screenW } = screen.getPrimaryDisplay().workAreaSize;
  const compactW = 440;
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

  // Refresh session stats every 5s (detects session changes, token updates)
  setInterval(() => {
    if (!watcher) return;
    for (const [pid] of watcher.instances) {
      watcher.refreshSessionStats(pid).then(() => watcher.emitIfChanged());
    }
  }, 5000);

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
    const compactW = 440;
    compactWin.setPosition(Math.floor((screenW - compactW) / 2), 0);
  });

  // Focus a Claude instance by bringing its terminal/IDE window AND tab to front.
  // Terminal.app and iTerm2 support tty-based tab matching via AppleScript.
  // Other apps fall back to window-name matching.
  ipcMain.handle('focus-instance', async (_, pid) => {
    const inst = watcher ? watcher.getInstance(pid) : null;
    const appName = (watcher ? watcher.getTerminalApp(pid) : null) || 'Terminal';
    const project = inst?.project || '';
    const tty = inst?.tty ? `/dev/${inst.tty}` : '';

    let script;
    if (appName === 'Terminal' && tty) {
      // Terminal.app: match tab by tty, unminimize if needed, select it, raise the window
      script = `
        tell application "Terminal"
          activate
          set matched to false
          repeat with w in windows
            repeat with t in tabs of w
              if tty of t is "${tty}" then
                set selected of t to true
                set miniaturized of w to false
                set index of w to 1
                set matched to true
                exit repeat
              end if
            end repeat
            if matched then exit repeat
          end repeat
        end tell
      `;
    } else if (appName === 'iTerm2' && tty) {
      // iTerm2: match session by tty, unminimize if needed, select its tab, raise the window
      script = `
        tell application "iTerm2"
          activate
          set matched to false
          repeat with w in windows
            repeat with t in tabs of w
              repeat with s in sessions of t
                if tty of s is "${tty}" then
                  select t
                  select s
                  set miniaturized of w to false
                  set index of w to 1
                  set matched to true
                  exit repeat
                end if
              end repeat
              if matched then exit repeat
            end repeat
            if matched then exit repeat
          end repeat
        end tell
      `;
    } else {
      // Cursor, VS Code, etc.: match window by project name, AXRaise it
      script = `
        tell application "System Events"
          if exists process "${appName}" then
            set frontmost of process "${appName}" to true
            tell process "${appName}"
              set allWindows to every window
              set matched to false
              repeat with w in allWindows
                if name of w contains "${project}" then
                  if value of attribute "AXMinimized" of w is true then
                    set value of attribute "AXMinimized" of w to false
                  end if
                  perform action "AXRaise" of w
                  set matched to true
                  exit repeat
                end if
              end repeat
              if not matched and (count of allWindows) > 0 then
                set w to item 1 of allWindows
                if value of attribute "AXMinimized" of w is true then
                  set value of attribute "AXMinimized" of w to false
                end if
                perform action "AXRaise" of w
              end if
            end tell
          end if
        end tell
      `;
    }
    return new Promise((resolve) => {
      execFile('osascript', ['-e', script], () => resolve());
    });
  });

  // Kill a Claude Code instance (SIGTERM to process group)
  ipcMain.handle('kill-instance', async (_, pid) => {
    try {
      // Kill the process group (negative PID) to clean up subagents/children
      process.kill(-pid, 'SIGTERM');
    } catch {
      try {
        // Fallback: kill just the process if process group fails
        process.kill(pid, 'SIGTERM');
      } catch { /* process already gone */ }
    }
  });

  // Get session history from ~/.claude/history.jsonl
  ipcMain.handle('get-session-history', async () => {
    const os = require('os');
    const fs = require('fs');
    const path = require('path');
    const readline = require('readline');

    const historyFile = path.join(os.homedir(), '.claude', 'history.jsonl');
    if (!fs.existsSync(historyFile)) return [];

    const sessions = new Map(); // sessionId -> { sessionId, project, firstMessage, timestamp, lastTimestamp }

    try {
      const stream = fs.createReadStream(historyFile, { encoding: 'utf8' });
      const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

      for await (const line of rl) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line);
          const { sessionId, project, display, timestamp } = entry;
          if (!sessionId) continue;

          if (!sessions.has(sessionId)) {
            sessions.set(sessionId, {
              sessionId,
              project: project || '',
              firstMessage: display || '',
              timestamp,
              lastTimestamp: timestamp,
              messageCount: 1,
            });
          } else {
            const s = sessions.get(sessionId);
            s.lastTimestamp = timestamp;
            s.messageCount++;
          }
        } catch { /* skip malformed lines */ }
      }
    } catch { return []; }

    // Return sorted by most recent, limit to 50
    return Array.from(sessions.values())
      .sort((a, b) => b.lastTimestamp - a.lastTimestamp)
      .slice(0, 50);
  });

  // Resume a Claude Code session in a new Terminal tab
  ipcMain.handle('resume-session', async (_, sessionId, cwd) => {
    const script = `
      tell application "Terminal"
        activate
        do script "cd ${cwd.replace(/"/g, '\\"')} && claude --resume ${sessionId}"
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
