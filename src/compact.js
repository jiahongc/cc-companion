// Compact mode (Dynamic Island) script

let snapshot = null;
let lastCompactHeight = 0;
let selectedPid = null;
let pidOrder = []; // user-defined tile order, new instances prepended
let showRuntime = localStorage.getItem('showRuntime') === 'true'; // default off
let showIdleTime = localStorage.getItem('showIdleTime') === 'true'; // default off
let customNames = {}; // pid -> name (session-only, not persisted — each instance is unique)
let isRenaming = false; // block render() while editing a name

// ── Helpers ──────────────────────────────────────────────────
function formatTime(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sc = s % 60;
  if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(sc).padStart(2, '0');
  return String(m).padStart(2, '0') + ':' + String(sc).padStart(2, '0');
}

function formatTokens(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(0) + 'k';
  return String(n);
}

function formatMem(kb) {
  if (kb >= 1048576) return (kb / 1048576).toFixed(1) + 'G';
  if (kb >= 1024) return (kb / 1024).toFixed(0) + 'M';
  return kb + 'K';
}

function getCtxLimit(model) {
  if (!model) return 200000;
  const m = model.toLowerCase();
  // Opus models have 1M context; detect by name pattern
  if (m.includes('opus')) return 1000000;
  // Default for sonnet, haiku, and any unknown future models
  return 200000;
}

function shortModelName(model) {
  if (!model) return '';
  // Strip "claude-" prefix and any date suffix (e.g., -20260301)
  return model
    .replace(/^claude-/, '')
    .replace(/-\d{8}$/, '');
}

function formatStartTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const now = new Date();
  let h = d.getHours(), m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const time = h + ':' + String(m).padStart(2, '0') + ' ' + ampm;
  // If not today, prepend the date
  if (d.toDateString() !== now.toDateString()) {
    const mon = d.toLocaleString('en-US', { month: 'short' });
    return mon + ' ' + d.getDate() + ', ' + time;
  }
  return time;
}

function formatElapsed(ts) {
  if (!ts) return '—';
  const secs = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (secs < 60) return secs + 's';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return mins + 'm';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ' + (mins % 60) + 'm';
  const days = Math.floor(hrs / 24);
  return days + 'd ' + (hrs % 24) + 'h';
}

function ctxInfo(inst) {
  const limit = getCtxLimit(inst.model);
  const pct = inst.contextTokens > 0 ? Math.min(100, (inst.contextTokens / limit) * 100) : 0;
  const label = limit >= 1000000 ? '1M' : '200k';
  const cls = pct > 80 ? 'ci-ctx hot' : pct > 50 ? 'ci-ctx warm' : 'ci-ctx';
  return { pct, label, cls };
}

// ── SVG icons (static, allocated once) ───────────────────────
const WORKING_ICON = `<svg viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
  <rect x="3" y="4" width="20" height="15" rx="3" fill="#e8590c"/>
  <circle cx="9" cy="10" r="2" fill="#1a1a1a"/>
  <circle cx="17" cy="10" r="2" fill="#1a1a1a"/>
  <circle cx="9.7" cy="9.3" r="0.7" fill="rgba(255,255,255,0.6)"/>
  <circle cx="17.7" cy="9.3" r="0.7" fill="rgba(255,255,255,0.6)"/>
  <path d="M9.5 14.5 Q13 17 16.5 14.5" stroke="#1a1a1a" stroke-width="1.2" stroke-linecap="round" fill="none"/>
  <line x1="24.5" y1="5" x2="24.5" y2="9" stroke="#f4a82a" stroke-width="1" stroke-linecap="round"/>
  <line x1="22.5" y1="7" x2="26.5" y2="7" stroke="#f4a82a" stroke-width="1" stroke-linecap="round"/>
  <rect x="5" y="19" width="3" height="5" rx="0.5" fill="#e8590c"/>
  <rect x="11.5" y="19" width="3" height="5" rx="0.5" fill="#e8590c"/>
  <rect x="18" y="19" width="3" height="5" rx="0.5" fill="#e8590c"/>
</svg>`;

const SLEEPING_ICON = `<svg viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
  <rect x="3" y="6" width="20" height="15" rx="3" fill="#7a6e6a" opacity="0.6"/>
  <path d="M7 12 Q9 9.5 11 12" stroke="#1a1a1a" stroke-width="1.5" stroke-linecap="round" fill="none"/>
  <path d="M15 12 Q17 9.5 19 12" stroke="#1a1a1a" stroke-width="1.5" stroke-linecap="round" fill="none"/>
  <path d="M10.5 16 Q13 18 15.5 16" stroke="#1a1a1a" stroke-width="1" stroke-linecap="round" fill="none"/>
  <text x="22" y="8" font-size="6" font-weight="900" fill="rgba(255,255,255,0.5)" font-family="sans-serif">Z</text>
  <text x="24.5" y="4.5" font-size="4.5" font-weight="900" fill="rgba(255,255,255,0.35)" font-family="sans-serif">z</text>
  <text x="26" y="2" font-size="3" font-weight="900" fill="rgba(255,255,255,0.2)" font-family="sans-serif">z</text>
  <rect x="5" y="21" width="3" height="3.5" rx="0.5" fill="#7a6e6a" opacity="0.5"/>
  <rect x="11.5" y="21" width="3" height="3.5" rx="0.5" fill="#7a6e6a" opacity="0.5"/>
  <rect x="18" y="21" width="3" height="3.5" rx="0.5" fill="#7a6e6a" opacity="0.5"/>
</svg>`;

function sortedInstances() {
  if (!snapshot) return [];
  const instances = snapshot.instances;
  // Find new PIDs not yet in our order — prepend them
  const known = new Set(pidOrder);
  const newPids = instances.filter(i => !known.has(i.pid)).map(i => i.pid);
  if (newPids.length > 0) {
    pidOrder = [...newPids, ...pidOrder];
  }
  // Remove PIDs that no longer exist
  const alive = new Set(instances.map(i => i.pid));
  pidOrder = pidOrder.filter(pid => alive.has(pid));
  // Sort by pidOrder
  const orderMap = new Map(pidOrder.map((pid, i) => [pid, i]));
  return [...instances].sort((a, b) => (orderMap.get(a.pid) ?? 0) - (orderMap.get(b.pid) ?? 0));
}

function resizeWindow() {
  requestAnimationFrame(() => {
    const bar = document.getElementById('compactBar');
    if (!bar || !window.api) return;
    let h = bar.offsetHeight + 4;
    // Account for absolute-positioned settings panel
    const panel = document.getElementById('settingsPanel');
    if (panel && panel.classList.contains('visible')) {
      h = Math.max(h, panel.offsetTop + panel.offsetHeight + 10);
    }
    // Account for context menu
    const ctx = document.querySelector('.context-menu');
    if (ctx) {
      h = Math.max(h, ctx.offsetTop + ctx.offsetHeight + 10);
    }
    if (h !== lastCompactHeight) {
      lastCompactHeight = h;
      window.api.resizeCompact(h);
    }
  });
}

// ── Render ───────────────────────────────────────────────────
function render() {
  if (isRenaming) return; // don't rebuild DOM while editing a name
  const summary = document.getElementById('compactSummary');
  const list = document.getElementById('compactInstances');
  const icon = document.getElementById('claudeIcon');

  if (!snapshot || snapshot.instances.length === 0) {
    summary.textContent = 'no instances';
    list.innerHTML = '<div class="ci-empty">waiting for Claude Code…</div>';
    icon.classList.remove('active');
    lastCompactHeight = 0;
    return;
  }

  const total = snapshot.instances.length;
  const working = snapshot.totalActive || 0;
  summary.textContent = working > 0
    ? `${total} total · ${working} working`
    : `${total} total · all ready`;

  icon.classList.toggle('active', working > 0);

  // Auto-resize compact window to fit content
  resizeWindow();

  const sorted = sortedInstances();
  list.classList.toggle('scrollable', sorted.length > 6);

  list.innerHTML = sorted.map(inst => {
    const active = inst.active;
    const sc = active ? 'active' : 'idle';
    let durText = '';
    if (active && inst.activeStart) {
      durText = formatTime(Math.floor((Date.now() - inst.activeStart) / 1000));
    }
    const ctx = ctxInfo(inst);
    const ctxHtml = ctx.pct > 0
      ? `<span class="${ctx.cls}" title="${Math.round(inst.contextTokens/1000)}k / ${ctx.label}">usage ${ctx.pct.toFixed(0)}%</span>`
      : '';
    const selClass = inst.pid === selectedPid ? ' selected' : '';

    const displayName = customNames[inst.pid] || inst.project;

    return `<div class="ci-tile ${sc}${selClass}" data-pid="${inst.pid}">
      <div class="ci-top">
        <div class="ci-icon">${active ? WORKING_ICON : SLEEPING_ICON}</div>
        <div class="ci-project">${displayName}</div>
      </div>
      <div class="ci-bottom">
        <span class="ci-label">${active
          ? (showRuntime && durText ? durText : 'working')
          : (showIdleTime && inst.idleStart ? formatTime(Math.floor((Date.now() - inst.idleStart) / 1000)) : 'ready')}</span>
        <span class="ci-model">${shortModelName(inst.model)}</span>
        ${ctxHtml}
        <button class="ci-info-btn no-drag" data-info-pid="${inst.pid}">ⓘ</button>
      </div>
    </div>`;
  }).join('');

  renderDetail();
}

// ── Detail panel ─────────────────────────────────────────────
let _lastDetailKey = null; // cache key to avoid innerHTML thrashing

function renderDetail() {
  const panel = document.getElementById('detailPanel');

  if (!selectedPid || !snapshot) {
    panel.classList.remove('visible');
    panel.innerHTML = '';
    _lastDetailKey = null;
    return;
  }

  const inst = snapshot.instances.find(i => i.pid === selectedPid);
  if (!inst) {
    selectedPid = null;
    panel.classList.remove('visible');
    panel.innerHTML = '';
    _lastDetailKey = null;
    return;
  }

  panel.classList.add('visible');

  const ctx = ctxInfo(inst);
  const shortCwd = inst.cwd ? inst.cwd.replace(/^\/Users\/[^/]+/, '~') : '—';

  const elapsedStr = formatElapsed(inst.startedAt);

  // Build a cache key from all displayed values to avoid re-creating the DOM
  // (innerHTML destroys the button mid-click when snapshot updates arrive)
  const detailKey = [inst.pid, inst.project, inst.model, inst.gitBranch,
    inst.turnCount, ctx.pct.toFixed(0), inst.inputTokens, inst.outputTokens,
    inst.cacheReadTokens, inst.cpu.toFixed(1), inst.rss, shortCwd, elapsedStr].join('|');

  if (detailKey === _lastDetailKey) return;
  _lastDetailKey = detailKey;

  // All values are derived from trusted local process data (watcher.js), not user input.
  // Safe to use innerHTML here — no untrusted content.
  panel.innerHTML = `
    <div class="detail-header">
      <span class="detail-title">${inst.project}</span>
      <button class="detail-close no-drag" id="detailClose">✕</button>
    </div>
    <div class="detail-grid">
      <div class="detail-row"><span class="detail-key">started</span><span class="detail-val">${formatStartTime(inst.startedAt)}</span></div>
      <div class="detail-row"><span class="detail-key">elapsed</span><span class="detail-val">${elapsedStr}</span></div>
      <div class="detail-row"><span class="detail-key">model</span><span class="detail-val">${shortModelName(inst.model) || '—'}</span></div>
      <div class="detail-row"><span class="detail-key">branch</span><span class="detail-val">${inst.gitBranch || '—'}</span></div>
      <div class="detail-row"><span class="detail-key">context</span><span class="detail-val">${ctx.pct.toFixed(0)}%</span></div>
      <div class="detail-row"><span class="detail-key">in tokens</span><span class="detail-val">${formatTokens(inst.inputTokens)}</span></div>
      <div class="detail-row"><span class="detail-key">turns</span><span class="detail-val">${inst.turnCount}</span></div>
      <div class="detail-row"><span class="detail-key">out tokens</span><span class="detail-val">${formatTokens(inst.outputTokens)}</span></div>
      <div class="detail-row"><span class="detail-key">cached</span><span class="detail-val">${formatTokens(inst.cacheReadTokens)}</span></div>
      <div class="detail-row"><span class="detail-key">cpu / mem</span><span class="detail-val">${inst.cpu.toFixed(1)}% / ${formatMem(inst.rss)}</span></div>
    </div>
    <div class="detail-path" title="${inst.cwd}">${shortCwd}</div>
  `;
}

// ── Tile drag-to-reorder (FLIP animation) ────────────────────
let tileDrag = null;
let lastSwapTime = 0;

// Capture positions of all tiles before a DOM change
function captureTilePositions() {
  const positions = new Map();
  document.querySelectorAll('.ci-tile').forEach(tile => {
    const rect = tile.getBoundingClientRect();
    positions.set(tile.dataset.pid, { x: rect.left, y: rect.top });
  });
  return positions;
}

// Animate tiles from old positions to new positions (FLIP)
function animateTileSwap(oldPositions) {
  document.querySelectorAll('.ci-tile').forEach(tile => {
    if (tile.classList.contains('dragging')) return;
    const pid = tile.dataset.pid;
    const oldPos = oldPositions.get(pid);
    if (!oldPos) return;
    const newRect = tile.getBoundingClientRect();
    const dx = oldPos.x - newRect.left;
    const dy = oldPos.y - newRect.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    // Set to old position instantly
    tile.style.transition = 'none';
    tile.style.transform = `translate(${dx}px, ${dy}px)`;
    // Force reflow, then animate to new position
    tile.offsetHeight;
    tile.classList.add('swap-animate');
    tile.style.transform = '';
    const onEnd = () => {
      tile.classList.remove('swap-animate');
      tile.style.transition = '';
      tile.removeEventListener('transitionend', onEnd);
    };
    tile.addEventListener('transitionend', onEnd);
  });
}

document.addEventListener('mousedown', (e) => {
  // Don't start tile drag/click for info button, right-click, rename input, or context menu
  if (e.target.closest('.ci-info-btn')) return;
  if (e.target.closest('.rename-input')) return;
  if (e.target.closest('.context-menu')) return;
  if (e.button === 2) return; // right-click
  const tile = e.target.closest('.ci-tile');
  if (tile) {
    tileDrag = {
      pid: parseInt(tile.dataset.pid),
      el: tile,
      startX: e.clientX,
      startY: e.clientY,
      started: false,
    };
    return;
  }
  if (!e.target.closest('.no-drag')) {
    windowDrag = true;
    windowDragX = e.screenX;
    windowDragY = e.screenY;
    e.preventDefault();
  }
});

document.addEventListener('mousemove', (e) => {
  if (tileDrag) {
    const dx = e.clientX - tileDrag.startX;
    const dy = e.clientY - tileDrag.startY;
    if (!tileDrag.started && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      tileDrag.started = true;
      tileDrag.el.classList.add('dragging');
      document.getElementById('compactInstances').classList.add('reordering');
    }
    if (tileDrag.started) {
      tileDrag.el.style.transform = `translate(${dx}px, ${dy}px) scale(1.05)`;
      tileDrag.el.style.zIndex = '10';
      // Throttle swap checks
      const now = Date.now();
      if (now - lastSwapTime < 200) return;
      // Find tile under cursor
      tileDrag.el.style.pointerEvents = 'none';
      const under = document.elementFromPoint(e.clientX, e.clientY);
      tileDrag.el.style.pointerEvents = '';
      const targetTile = under?.closest('.ci-tile');
      if (targetTile && targetTile !== tileDrag.el) {
        const targetPid = parseInt(targetTile.dataset.pid);
        const fromIdx = pidOrder.indexOf(tileDrag.pid);
        const toIdx = pidOrder.indexOf(targetPid);
        if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
          lastSwapTime = now;
          // Capture old positions for FLIP
          const oldPositions = captureTilePositions();
          pidOrder.splice(fromIdx, 1);
          pidOrder.splice(toIdx, 0, tileDrag.pid);
          // Re-render (this changes DOM order)
          const savedPid = tileDrag.pid;
          render();
          // Animate non-dragged tiles from old to new positions
          animateTileSwap(oldPositions);
          // Restore drag on new element
          const newEl = document.querySelector(`.ci-tile[data-pid="${savedPid}"]`);
          if (newEl) {
            tileDrag.el = newEl;
            newEl.classList.add('dragging');
            newEl.style.transform = `translate(${dx}px, ${dy}px) scale(1.05)`;
            newEl.style.zIndex = '10';
            newEl.style.transition = 'none';
          }
        }
      }
    }
    return;
  }
  if (windowDrag) {
    const dx = e.screenX - windowDragX;
    const dy = e.screenY - windowDragY;
    windowDragX = e.screenX;
    windowDragY = e.screenY;
    if (window.api) window.api.moveCompactWindow(dx, dy);
  }
});

document.addEventListener('mouseup', () => {
  if (tileDrag) {
    if (tileDrag.started) {
      // Animate drop back into place
      const el = tileDrag.el;
      el.classList.remove('dragging');
      el.classList.add('drop-animate');
      el.style.transform = '';
      el.style.zIndex = '';
      const onEnd = () => {
        el.classList.remove('drop-animate');
        el.style.transition = '';
        el.removeEventListener('transitionend', onEnd);
      };
      el.addEventListener('transitionend', onEnd);
      document.getElementById('compactInstances').classList.remove('reordering');
    } else {
      // Click — focus the instance's terminal
      const pid = tileDrag.pid;
      if (window.api) window.api.focusInstance(pid);
    }
    tileDrag = null;
    return;
  }
  windowDrag = false;
});

// ── Event delegation for detail buttons ──────────────────────
document.addEventListener('click', (e) => {
  // Info button on tile — toggle detail panel
  const infoBtn = e.target.closest('[data-info-pid]');
  if (infoBtn) {
    e.stopPropagation();
    const pid = parseInt(infoBtn.dataset.infoPid);
    selectedPid = selectedPid === pid ? null : pid;
    render();
    return;
  }
  if (e.target.closest('#detailClose')) {
    e.stopPropagation();
    selectedPid = null;
    render();
    return;
  }
});

// ── Right-click context menu for tiles ────────────────────────
let contextMenu = null;

document.addEventListener('contextmenu', (e) => {
  const tile = e.target.closest('.ci-tile');
  if (!tile) return;
  e.preventDefault();
  removeContextMenu();

  const pid = tile.dataset.pid;
  if (!pid) return;

  contextMenu = document.createElement('div');
  contextMenu.className = 'context-menu no-drag';
  contextMenu.innerHTML = `
    <div class="context-item" data-action="rename">Rename</div>
    <div class="context-item" data-action="reset-name">Reset name</div>
    <div class="context-divider"></div>
    <div class="context-item danger" data-action="close">Close instance</div>
  `;
  contextMenu.style.left = e.clientX + 'px';
  contextMenu.style.top = e.clientY + 'px';
  document.body.appendChild(contextMenu);

  // Resize window to fit context menu
  resizeWindow();

  contextMenu.addEventListener('click', (ce) => {
    const item = ce.target.closest('.context-item');
    if (!item) return;
    const action = item.dataset.action;
    if (action === 'rename') {
      removeContextMenu();
      startRename(tile, pid);
    } else if (action === 'reset-name') {
      delete customNames[pid];
      removeContextMenu();
      render();
    } else if (action === 'close') {
      // Replace menu with confirmation
      contextMenu.innerHTML = `
        <div class="context-confirm">Close this instance?</div>
        <div class="context-item danger" data-action="confirm-close">Yes, close</div>
        <div class="context-item" data-action="cancel">Cancel</div>
      `;
    } else if (action === 'confirm-close') {
      if (window.api) window.api.killInstance(parseInt(pid));
      removeContextMenu();
    } else if (action === 'cancel') {
      removeContextMenu();
    }
  });
});

function removeContextMenu() {
  if (contextMenu) {
    contextMenu.remove();
    contextMenu = null;
    resizeWindow();
  }
}

// Close context menu on any click
document.addEventListener('mousedown', (e) => {
  if (contextMenu && !e.target.closest('.context-menu')) {
    removeContextMenu();
  }
});

function startRename(tile, pid) {
  const projectEl = tile.querySelector('.ci-project');
  if (!projectEl) return;

  isRenaming = true;
  const currentName = projectEl.textContent;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'rename-input no-drag';
  input.value = currentName;

  projectEl.textContent = '';
  projectEl.appendChild(input);
  input.focus();
  input.select();

  let finished = false;
  const finish = () => {
    if (finished) return; // prevent double-fire from Enter + blur
    finished = true;
    const newName = input.value.trim();
    if (newName && newName !== currentName) {
      customNames[pid] = newName;
    }
    isRenaming = false;
    render();
  };

  input.addEventListener('keydown', (ke) => {
    ke.stopPropagation();
    if (ke.key === 'Enter') { ke.preventDefault(); finish(); }
    if (ke.key === 'Escape') { isRenaming = false; render(); }
  });
  input.addEventListener('blur', finish);
}

// ── Window drag state ────────────────────────────────────────
let windowDrag = false;
let windowDragX = 0, windowDragY = 0;

// ── Settings persistence ──────────────────────────────────────
const savedTheme = localStorage.getItem('theme') || 'light';
const savedOpacity = parseFloat(localStorage.getItem('opacity') || '1');

if (savedTheme !== 'dark') {
  document.getElementById('compactBar').classList.add('light');
}
applyOpacity(savedOpacity);

function applyOpacity(val) {
  const bar = document.getElementById('compactBar');
  const isLight = bar.classList.contains('light');
  if (isLight) {
    bar.style.setProperty('--bar-bg', `rgba(255, 250, 245, ${val})`);
  } else {
    bar.style.setProperty('--bar-bg', `rgba(22, 18, 16, ${val})`);
  }
}

// Mark active setting buttons on load
function markActive(groupId, val) {
  const group = document.getElementById(groupId);
  group.querySelectorAll('.stoggle-opt').forEach(b => {
    b.classList.toggle('active', b.dataset.val === String(val));
  });
}
markActive('settingTheme', savedTheme);
markActive('settingRuntime', showRuntime ? 'on' : 'off');
markActive('settingIdleTime', showIdleTime ? 'on' : 'off');
markActive('settingOpacity', savedOpacity);

// ── Settings panel toggle ─────────────────────────────────────
document.getElementById('settingsBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('settingsPanel').classList.toggle('visible');
  resizeWindow();
});
// Close settings when clicking outside
document.addEventListener('mousedown', (e) => {
  const panel = document.getElementById('settingsPanel');
  if (panel.classList.contains('visible') && !e.target.closest('#settingsPanel') && !e.target.closest('#settingsBtn')) {
    panel.classList.remove('visible');
    resizeWindow();
  }
});

// ── Settings handlers (event delegation) ──────────────────────
document.getElementById('settingsPanel').addEventListener('click', (e) => {
  e.stopPropagation();
  const opt = e.target.closest('.stoggle-opt');
  if (!opt) return;

  const group = opt.closest('.settings-toggle');
  group.querySelectorAll('.stoggle-opt').forEach(b => b.classList.remove('active'));
  opt.classList.add('active');

  const val = opt.dataset.val;
  const bar = document.getElementById('compactBar');

  if (group.id === 'settingTheme') {
    bar.classList.toggle('light', val === 'light');
    localStorage.setItem('theme', val);
    applyOpacity(parseFloat(localStorage.getItem('opacity') || '1'));
  } else if (group.id === 'settingRuntime') {
    showRuntime = val === 'on';
    localStorage.setItem('showRuntime', showRuntime);
    render();
  } else if (group.id === 'settingIdleTime') {
    showIdleTime = val === 'on';
    localStorage.setItem('showIdleTime', showIdleTime);
    render();
  } else if (group.id === 'settingOpacity') {
    applyOpacity(parseFloat(val));
    localStorage.setItem('opacity', val);
  }
});

// ── Header buttons ───────────────────────────────────────────
document.getElementById('snapBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  if (window.api) window.api.snapCompactWindow();
});
document.getElementById('closeBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  if (window.api) window.api.quitApp();
});
document.getElementById('minimizeBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  if (window.api) window.api.hideCompact();
});

// ── Data & refresh ───────────────────────────────────────────
window.api.onClaudeInstances((data) => { snapshot = data; render(); });
// Only re-render on interval when active instances exist (for duration timers)
setInterval(() => {
  if (snapshot && snapshot.totalActive > 0) render();
}, 1000);
