const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');
const EventEmitter = require('events');
const readline = require('readline');

const execAsync = promisify(exec);

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const SESSIONS_DIR = path.join(CLAUDE_DIR, 'sessions');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');

function toProjectKey(cwd) {
  return cwd.replace(/[^a-zA-Z0-9]/g, '-');
}

class ClaudeWatcher extends EventEmitter {
  constructor() {
    super();
    this.instances = new Map(); // pid -> instance info
    this.pollInterval = null;
    this._lastSnapshotJSON = null; // for change detection
  }

  async _detectTerminalApp(pid) {
    try {
      let currentPid = pid;
      for (let i = 0; i < 10; i++) {
        // Get parent pid of current process
        const { stdout: ppidOut } = await execAsync(`ps -o ppid= -p ${currentPid}`);
        const ppid = parseInt(ppidOut.trim());
        if (!ppid || ppid <= 1) break;

        // Get the parent's comm and check for known terminal apps
        const { stdout: commOut } = await execAsync(`ps -o comm= -p ${ppid}`);
        const comm = commOut.trim();

        if (comm.includes('/Terminal.app/')) return 'Terminal';
        if (comm.includes('/iTerm2.app/') || comm.includes('/iTerm.app/')) return 'iTerm2';
        if (comm.includes('/Warp.app/')) return 'Warp';
        if (comm.includes('/Cursor.app/')) return 'Cursor';
        if (comm.includes('/Visual Studio Code.app/') || comm.includes('/Code.app/')) return 'Visual Studio Code';
        if (comm.includes('/Alacritty.app/')) return 'Alacritty';
        if (comm.includes('/kitty.app/')) return 'kitty';

        currentPid = ppid;
      }
    } catch { /* process tree walk failed */ }
    return null;
  }

  start() {
    this.check();
    this.pollInterval = setInterval(() => this.check(), 2000);
  }

  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  check() {
    exec(
      "ps -eo pid,tty,%cpu,%mem,rss,etime,command | grep -i '^[[:space:]]*[0-9].*claude' | grep -v grep | grep -v cc-companion | grep -v Electron | grep -v '/bin/'",
      (err, stdout) => {
        const now = Date.now();
        const seenPids = new Set();
        let hasNewInstances = false;

        if (stdout && stdout.trim()) {
          const lines = stdout.trim().split('\n');
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length < 5) continue;

            const pid = parseInt(parts[0]);
            const tty = parts[1];
            const cpu = parseFloat(parts[2]);
            const mem = parseFloat(parts[3]);
            const rss = parseInt(parts[4]);
            const etime = parts[5];

            if (tty === '??' || tty === '?') continue;

            seenPids.add(pid);
            const existing = this.instances.get(pid);

            if (existing) {
              existing.cpu = cpu;
              existing.mem = mem;
              existing.rss = rss;
              existing.etime = etime;
              existing.lastSeen = now;

              const isActive = cpu > 3;
              const wasActive = existing.active;
              existing.active = isActive;

              if (isActive && !wasActive) {
                existing.activeStart = now;
                existing.idleStart = null;
              } else if (!isActive && wasActive) {
                existing.idleStart = now;
                existing.activeStart = null;
              }
            } else {
              hasNewInstances = true;
              this._initInstance(pid, tty, cpu, mem, rss, etime, cpu > 3, now);
            }
          }
        }

        // Remove instances that disappeared
        for (const [pid] of this.instances) {
          if (!seenPids.has(pid)) {
            this.instances.delete(pid);
          }
        }

        // Only emit if we didn't defer to async init (avoids double emit)
        if (!hasNewInstances) {
          this.emitIfChanged();
        }
      }
    );
  }

  async _initInstance(pid, tty, cpu, mem, rss, etime, isActive, now) {
    const cwd = await this.getCwd(pid);
    const projectName = cwd ? cwd.split('/').pop() : `session-${pid}`;
    const sessionInfo = this._readSessionFile(pid);
    // Pass both the lsof cwd and the session-file cwd for robust JSONL lookup
    const sessionStats = await this._getSessionStats(sessionInfo?.sessionId, cwd, sessionInfo?.cwd);

    // Detect terminal app (async, cached once)
    const terminalApp = await this._detectTerminalApp(pid);

    this.instances.set(pid, {
      pid, tty, cpu, mem, rss,
      active: isActive, etime,
      cwd: cwd || 'unknown', project: projectName,
      discoveredAt: now,
      activeStart: isActive ? now : null,
      idleStart: isActive ? null : now,
      lastSeen: now,
      _terminalApp: terminalApp,
      // Session metadata
      sessionId: sessionInfo?.sessionId || null,
      startedAt: sessionInfo?.startedAt || null,
      // Conversation stats
      turnCount: sessionStats?.turnCount || 0,
      inputTokens: sessionStats?.inputTokens || 0,
      outputTokens: sessionStats?.outputTokens || 0,
      cacheReadTokens: sessionStats?.cacheReadTokens || 0,
      cacheCreateTokens: sessionStats?.cacheCreateTokens || 0,
      contextTokens: sessionStats?.contextTokens || 0,
      model: sessionStats?.model || null,
      gitBranch: sessionStats?.gitBranch || null,
    });
    this.emitIfChanged();
  }

  // Read ~/.claude/sessions/{pid}.json for session metadata
  _readSessionFile(pid) {
    try {
      const filePath = path.join(SESSIONS_DIR, `${pid}.json`);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return {
        sessionId: data.sessionId,
        startedAt: data.startedAt,
        cwd: data.cwd,
      };
    } catch {
      return null;
    }
  }

  // Parse conversation JSONL for token usage and message counts
  async _getSessionStats(sessionId, cwd, sessionCwd) {
    // Collect unique cwds to try (session-file cwd is more reliable than lsof)
    const cwds = [...new Set([sessionCwd, cwd].filter(Boolean))];
    if (cwds.length === 0) return null;

    let jsonlPath = null;

    // First: try to find by known sessionId across all candidate cwds
    if (sessionId) {
      for (const c of cwds) {
        const projectKey = toProjectKey(c);
        const candidate = path.join(PROJECTS_DIR, projectKey, `${sessionId}.jsonl`);
        try {
          await fs.promises.access(candidate);
          jsonlPath = candidate;
          break;
        } catch { /* try next */ }
      }
    }

    // Fallback: scan project directory for most-recently-modified JSONL
    // But only if we have no sessionId — if we do, the JSONL just hasn't been created yet
    if (!jsonlPath && !sessionId) {
      for (const c of cwds) {
        const projectKey = toProjectKey(c);
        const projectDir = path.join(PROJECTS_DIR, projectKey);
        try {
          const files = await fs.promises.readdir(projectDir);
          const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));
          if (jsonlFiles.length === 0) continue;
          const withStats = await Promise.all(
            jsonlFiles.map(async f => {
              const fp = path.join(projectDir, f);
              const s = await fs.promises.stat(fp);
              return { path: fp, mtime: s.mtimeMs };
            })
          );
          withStats.sort((a, b) => b.mtime - a.mtime);
          jsonlPath = withStats[0].path;
          break;
        } catch { /* try next */ }
      }
    }

    if (!jsonlPath) return null;

    return new Promise((resolve) => {
      const stats = {
        turnCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreateTokens: 0,
        contextTokens: 0, // last input_tokens = current context window usage
        model: null,
        gitBranch: null,
        jsonlPath, // return path so we can check mtime for activity detection
      };

      const stream = fs.createReadStream(jsonlPath, { encoding: 'utf8' });
      const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

      rl.on('line', (line) => {
        try {
          const entry = JSON.parse(line);
          // Count turns: a "turn" is a real user prompt (not a tool-use result)
          if (entry.type === 'user' && !entry.toolUseResult) {
            stats.turnCount++;
          }
          if (entry.type === 'assistant' && entry.message) {
            if (entry.message.model) stats.model = entry.message.model;
            if (entry.gitBranch) stats.gitBranch = entry.gitBranch;
            const usage = entry.message.usage;
            if (usage) {
              stats.inputTokens += (usage.input_tokens || 0);
              stats.outputTokens += (usage.output_tokens || 0);
              stats.cacheReadTokens += (usage.cache_read_input_tokens || 0);
              stats.cacheCreateTokens += (usage.cache_creation_input_tokens || 0);
              // Track the most recent input_tokens — this is the current context window fill
              stats.contextTokens = (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
            }
          }
        } catch { /* skip malformed lines */ }
      });

      rl.on('close', () => resolve(stats));
      rl.on('error', () => resolve(stats));
    });
  }

  // Refresh stats for a specific instance (called periodically)
  async refreshSessionStats(pid) {
    const inst = this.instances.get(pid);
    if (!inst) return;
    // Re-read session file to detect /clear (new sessionId, same pid)
    const sessionInfo = this._readSessionFile(pid);
    if (sessionInfo?.sessionId && sessionInfo.sessionId !== inst.sessionId) {
      inst.sessionId = sessionInfo.sessionId;
    }
    // Also refresh cwd from session file (more reliable than stale lsof)
    if (sessionInfo?.cwd) {
      inst.cwd = sessionInfo.cwd;
      inst.project = sessionInfo.cwd.split('/').pop();
    }
    // Pass both cwds for robust JSONL lookup (same as _initInstance)
    const stats = await this._getSessionStats(inst.sessionId, inst.cwd, sessionInfo?.cwd);
    if (stats) {
      inst.turnCount = stats.turnCount;
      inst.inputTokens = stats.inputTokens;
      inst.outputTokens = stats.outputTokens;
      inst.cacheReadTokens = stats.cacheReadTokens;
      inst.cacheCreateTokens = stats.cacheCreateTokens;
      inst.contextTokens = stats.contextTokens;
      inst.model = stats.model;
      inst.gitBranch = stats.gitBranch;
    }
  }

  emitIfChanged() {
    const snapshot = this.getSnapshot();
    const key = JSON.stringify(snapshot.instances.map(i => [i.pid, i.active, i.cpu.toFixed(0), i.rss, i.turnCount, i.outputTokens, i.contextTokens, i.model, i.gitBranch]));
    if (key !== this._lastSnapshotJSON) {
      this._lastSnapshotJSON = key;
      this.emit('instance-update', snapshot);
    }
  }

  getInstance(pid) {
    return this.instances.get(pid) || null;
  }

  getTerminalApp(pid) {
    const inst = this.instances.get(pid);
    return inst?._terminalApp || null;
  }

  getCwd(pid) {
    return new Promise((resolve) => {
      exec(`lsof -a -p ${pid} -d cwd -Fn 2>/dev/null | grep '^n'`, (err, stdout) => {
        if (stdout && stdout.trim()) {
          resolve(stdout.trim().replace(/^n/, ''));
        } else {
          resolve(null);
        }
      });
    });
  }

  getSnapshot() {
    const instances = [];
    let totalActive = 0;
    for (const [, inst] of this.instances) {
      // Strip private fields from snapshot sent to renderer
      const { _terminalApp, ...publicInst } = inst;
      instances.push(publicInst);
      if (inst.active) totalActive++;
    }
    return {
      instances,
      count: instances.length,
      anyActive: totalActive > 0,
      totalActive,
    };
  }

  resetStats() {
    this.instances.clear();
    this._lastSnapshotJSON = null;
    this.emit('instance-update', this.getSnapshot());
  }
}

module.exports = { ClaudeWatcher };
