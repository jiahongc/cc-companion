const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Claude Code instance tracking
  onClaudeInstances: (callback) => ipcRenderer.on('claude-instances', (_, data) => callback(data)),
  resetWatcherStats: () => ipcRenderer.send('reset-watcher-stats'),

  // Island controls
  hideCompact: () => ipcRenderer.send('hide-compact'),
  quitApp: () => ipcRenderer.send('quit-app'),
  moveCompactWindow: (dx, dy) => ipcRenderer.send('move-compact-window', { dx, dy }),
  snapCompactWindow: () => ipcRenderer.send('snap-compact-window'),
  resizeCompact: (height) => ipcRenderer.send('resize-compact', { height }),
  focusInstance: (pid) => ipcRenderer.invoke('focus-instance', pid),
});
