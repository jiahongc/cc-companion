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
    this._initializingPids = new Set(); // PIDs currently being async-initialized
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

  // Read the last JSONL entry to determine Claude's actual state.
  // Returns { entry, mtimeMs } or null.
  // This is the ground truth — Claude writes an entry for each state transition:
  //   end_turn → finished, waiting for user input
  //   tool_use → a tool/subagent is executing
  //   user message → Claude is processing a prompt or tool result
  _getLastJsonlEntry(inst) {
    if (!inst.sessionId) return null;
    const cwds = [...new Set([inst._sessionCwd, inst.cwd].filter(Boolean))];
    for (const c of cwds) {
      const projectKey = toProjectKey(c);
      const jsonlPath = path.join(PROJECTS_DIR, projectKey, `${inst.sessionId}.jsonl`);
      try {
        const stat = fs.statSync(jsonlPath);
        if (stat.size === 0) continue;

        // Agent dispatches can produce 50-200KB+ JSONL lines (full prompts).
        // Progressively read larger chunks until we can parse the last line.
        for (let readSize = 65536; readSize <= stat.size; readSize *= 4) {
          const actualSize = Math.min(stat.size, readSize);
          const fd = fs.openSync(jsonlPath, 'r');
          const buf = Buffer.alloc(actualSize);
          fs.readSync(fd, buf, 0, actualSize, stat.size - actualSize);
          fs.closeSync(fd);

          const text = buf.toString('utf8');
          const trimmed = text.trimEnd();
          const lastNl = trimmed.lastIndexOf('\n');
          const lastLine = lastNl >= 0 ? trimmed.substring(lastNl + 1) : trimmed;

          if (!lastLine) continue;
          try {
            return { entry: JSON.parse(lastLine), mtimeMs: stat.mtimeMs };
          } catch {
            if (actualSize >= stat.size) {
              // Full file read but last line won't parse — could be a write in progress.
              // If file was modified recently, Claude is actively writing → treat as active.
              const age = Date.now() - stat.mtimeMs;
              if (age < 5000) {
                return { entry: { type: '_write_in_progress' }, mtimeMs: stat.mtimeMs };
              }
              // Stale file with corrupt last line — scan backwards for last valid entry
              const lines = text.split('\n').filter(l => l.trim());
              for (let i = lines.length - 1; i >= 0; i--) {
                try { return { entry: JSON.parse(lines[i]), mtimeMs: stat.mtimeMs }; }
                catch { continue; }
              }
              break;
            }
            // Buffer started mid-line — try larger buffer
            continue;
          }
        }
      } catch { /* file not found */ }
    }
    return null;
  }

  _isInstanceActive(inst) {
    const result = this._getLastJsonlEntry(inst);

    // No JSONL found — process may be brand new or session file not yet written.
    // Fall back to CPU: if the process is burning CPU, it's likely initializing.
    if (!result) return (inst.cpu || 0) >= 5;

    const { entry, mtimeMs } = result;
    const fileAge = Date.now() - mtimeMs;
    const cpu = inst.cpu || 0;

    // ── Immediately-idle entries (no staleness check needed) ──────────
    // These entry types always mean Claude is done and waiting for user input.

    // assistant with end_turn/max_tokens/stop_sequence = finished responding
    if (entry.type === 'assistant') {
      const sr = entry.message?.stop_reason;
      if (sr === 'end_turn' || sr === 'max_tokens' || sr === 'stop_sequence') return false;
    }
    // system entries (turn_duration, compact_boundary, etc.) = bookkeeping after turn ends
    if (entry.type === 'system') return false;
    // file-history-snapshot = bookkeeping
    if (entry.type === 'file-history-snapshot') return false;
    // last-prompt = session metadata
    if (entry.type === 'last-prompt') return false;

    // ── Active entries with tiered staleness thresholds ───────────────
    // Each entry type gets a staleness window tuned to how long that state
    // can legitimately last without new JSONL writes. Beyond the threshold,
    // fall through to CPU check as a last resort.

    // Write in progress — actively writing to JSONL (very short-lived)
    if (entry.type === '_write_in_progress') {
      return fileAge < 10000 || cpu >= 5;
    }

    // assistant(null) — mid-stream generation OR user interrupted.
    // Claude streams continuously, so 10s of silence = interrupted.
    if (entry.type === 'assistant' && entry.message?.stop_reason == null) {
      return fileAge < 10000 || cpu >= 5;
    }

    // assistant(tool_use) — a tool was dispatched and is executing.
    // Tools (builds, browser, subagents) can run for minutes without writes.
    // Exception: user-input tools (AskUserQuestion) are waiting for the human,
    // not doing work — treat those as idle.
    if (entry.type === 'assistant' && entry.message?.stop_reason === 'tool_use') {
      const content = entry.message?.content;
      if (Array.isArray(content)) {
        const hasUserInputTool = content.some(
          block => block.type === 'tool_use' && block.name === 'AskUserQuestion'
        );
        if (hasUserInputTool) return false;
      }
      return fileAge < 300000 || cpu >= 5;  // 5 min
    }

    // user message (prompt or tool result) — Claude is processing input.
    // Should start responding within ~2 min; longer means stalled.
    if (entry.type === 'user') {
      return fileAge < 120000 || cpu >= 5;  // 2 min
    }

    // progress — subagent is running, can take minutes.
    if (entry.type === 'progress') {
      return fileAge < 300000 || cpu >= 5;  // 5 min
    }

    // queue-operation — task notification, should be quick.
    if (entry.type === 'queue-operation') {
      return fileAge < 30000 || cpu >= 5;  // 30s
    }

    // result — tool output returned, Claude should pick it up quickly.
    if (entry.type === 'result') {
      return fileAge < 30000 || cpu >= 5;  // 30s
    }

    // Unknown entry type — treat as idle unless CPU says otherwise.
    return cpu >= 5;
  }

  check() {
    // Note: exec with hardcoded command string (no user input) — safe from injection.
    exec(
      "ps -eo pid,ppid,tty,%cpu,%mem,rss,etime,command | grep -i '^[[:space:]]*[0-9].*claude' | grep -v grep | grep -v cc-companion | grep -v Electron | grep -v '/bin/' | grep -v 'Claude.app' | grep -v 'Claude Helper'",
      (err, stdout) => {
        const now = Date.now();
        const seenPids = new Set();
        let hasNewInstances = false;

        // First pass: collect all Claude PIDs so we can filter out subagents
        const allClaudePids = new Set();
        const parsedLines = [];
        if (stdout && stdout.trim()) {
          const lines = stdout.trim().split('\n');
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length < 6) continue;
            const pid = parseInt(parts[0]);
            const ppid = parseInt(parts[1]);
            allClaudePids.add(pid);
            parsedLines.push({ pid, ppid, parts });
          }
        }

        for (const { pid, ppid, parts } of parsedLines) {
            const tty = parts[2];
            const cpu = parseFloat(parts[3]);
            const mem = parseFloat(parts[4]);
            const rss = parseInt(parts[5]);
            const etime = parts[6];

            if (tty === '??' || tty === '?') continue;

            // Skip subagent processes (parent is another Claude instance)
            if (allClaudePids.has(ppid)) continue;

            seenPids.add(pid);
            const existing = this.instances.get(pid);

            if (existing) {
              existing.cpu = cpu;
              existing.mem = mem;
              existing.rss = rss;
              existing.etime = etime;
              existing.lastSeen = now;

              // Quick session-file check: detect /clear or session change within 2s
              const sessionInfo = this._readSessionFile(pid);
              if (sessionInfo?.sessionId && sessionInfo.sessionId !== existing.sessionId) {
                this._resetSessionStats(existing, sessionInfo);
              }
              if (sessionInfo?.cwd) {
                existing._sessionCwd = sessionInfo.cwd;
              }

              // Ground truth: read Claude's state from the last JSONL entry
              const isActive = this._isInstanceActive(existing);
              const wasActive = existing.active;

              if (isActive) {
                // Reset idle grace period since we're active
                existing._graceStart = null;

                if (!wasActive) {
                  // Transitioning idle → active
                  // Reset timer if the turn count increased (new user prompt)
                  // or if the idle gap was long enough for a distinct session
                  const gap = existing.idleStart ? (now - existing.idleStart) : Infinity;
                  const turnChanged = existing._lastActiveTurn != null && existing.turnCount > existing._lastActiveTurn;
                  if (!existing.activeStart || gap > 30000 || turnChanged) {
                    existing.activeStart = now;
                  }
                  existing.idleStart = null;
                }
                existing.active = true;
                existing._lastActiveTurn = existing.turnCount;
              } else {
                // JSONL says idle — apply grace period to prevent flickering
                // Also check CPU: if process is still burning CPU, reset grace timer
                if (wasActive) {
                  if (!existing._graceStart) {
                    existing._graceStart = now;
                  } else if (cpu >= 5) {
                    // CPU still hot — reset grace timer, stay active
                    existing._graceStart = now;
                  } else if (now - existing._graceStart >= 3000) {
                    // JSONL idle AND CPU low for 3+ seconds — actually transition
                    existing.active = false;
                    existing.idleStart = now;
                    existing._graceStart = null;
                  }
                  // If < 3s, keep existing.active = true (grace period)
                } else {
                  existing.active = false;
                  existing._graceStart = null;
                }
              }
            } else if (!this._initializingPids.has(pid)) {
              hasNewInstances = true;
              this._initializingPids.add(pid);
              this._initInstance(pid, tty, cpu, mem, rss, etime, now);
            }
          }

        // Remove instances that disappeared (but not ones still initializing)
        for (const [pid] of this.instances) {
          if (!seenPids.has(pid) && !this._initializingPids.has(pid)) {
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

  async _initInstance(pid, tty, cpu, mem, rss, etime, now) {
    try {
    const cwd = await this.getCwd(pid);
    const projectName = cwd ? cwd.split('/').pop() : `session-${pid}`;
    const sessionInfo = this._readSessionFile(pid);
    // Pass both the lsof cwd and the session-file cwd for robust JSONL lookup
    const sessionStats = await this._getSessionStats(sessionInfo?.sessionId, cwd, sessionInfo?.cwd);

    // Detect terminal app (async, cached once)
    const terminalApp = await this._detectTerminalApp(pid);

    // Determine initial active state from Claude's JSONL state
    const initInst = { sessionId: sessionInfo?.sessionId, cwd: cwd || 'unknown', _sessionCwd: sessionInfo?.cwd };
    const initiallyActive = this._isInstanceActive(initInst);

    this.instances.set(pid, {
      pid, tty, cpu, mem, rss,
      active: initiallyActive, etime,
      cwd: cwd || 'unknown', project: projectName,
      discoveredAt: now,
      activeStart: initiallyActive ? now : null,
      idleStart: initiallyActive ? null : now,
      _graceStart: null,
      _lastActiveTurn: sessionStats?.turnCount || 0,
      lastSeen: now,
      _terminalApp: terminalApp,
      _sessionCwd: sessionInfo?.cwd || null,
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
    } finally {
      this._initializingPids.delete(pid);
    }
  }

  // Zero out session stats when session changes (/clear or new session)
  _resetSessionStats(inst, sessionInfo) {
    inst.sessionId = sessionInfo.sessionId;
    inst.startedAt = sessionInfo.startedAt || null;
    inst.turnCount = 0;
    inst.inputTokens = 0;
    inst.outputTokens = 0;
    inst.cacheReadTokens = 0;
    inst.cacheCreateTokens = 0;
    inst.contextTokens = 0;
    inst.model = null;
    inst.gitBranch = null;
    inst._lastActiveTurn = 0;
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
      this._resetSessionStats(inst, sessionInfo);
    }
    // Also refresh cwd from session file (more reliable than stale lsof)
    if (sessionInfo?.cwd) {
      inst.cwd = sessionInfo.cwd;
      inst.project = sessionInfo.cwd.split('/').pop();
      inst._sessionCwd = sessionInfo.cwd;
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
    const key = JSON.stringify(snapshot.instances.map(i => [i.pid, i.active, i.cpu.toFixed(0), i.rss, i.turnCount, i.outputTokens, i.contextTokens, i.model, i.gitBranch, i.activeStart, i.startedAt, i.idleStart]));
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
      const { _terminalApp, _sessionCwd, _graceStart, _lastActiveTurn, ...publicInst } = inst;
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
    this._initializingPids.clear();
    this._lastSnapshotJSON = null;
    this.emit('instance-update', this.getSnapshot());
  }
}

module.exports = { ClaudeWatcher };
