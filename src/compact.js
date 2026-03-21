// Compact mode (Dynamic Island) script

let snapshot = null;
let lastCompactHeight = 0;
let selectedPid = null;
let pidOrder = []; // user-defined tile order, new instances prepended

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
  if (model.toLowerCase().includes('opus')) return 1000000;
  return 200000;
}

function shortModelName(model) {
  if (!model) return '';
  return model.replace(/^claude-/, '').split('-2')[0];
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

// ── Render ───────────────────────────────────────────────────
function render() {
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
  requestAnimationFrame(() => {
    const bar = document.getElementById('compactBar');
    if (bar && window.api) {
      const h = bar.offsetHeight + 4;
      if (h !== lastCompactHeight) {
        lastCompactHeight = h;
        window.api.resizeCompact(h);
      }
    }
  });

  const sorted = sortedInstances();
  list.classList.toggle('scrollable', sorted.length > 4);

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

    return `<div class="ci-tile ${sc}${selClass}" data-pid="${inst.pid}">
      <div class="ci-top">
        <div class="ci-icon">${active ? WORKING_ICON : SLEEPING_ICON}</div>
        <div class="ci-project">${inst.project}</div>
      </div>
      <div class="ci-bottom">
        <span class="ci-label">${active ? (durText || 'working') : 'ready'}</span>
        <span class="ci-model">${shortModelName(inst.model)}</span>
        ${ctxHtml}
      </div>
    </div>`;
  }).join('');

  renderDetail();
}

// ── Detail panel ─────────────────────────────────────────────
function renderDetail() {
  const panel = document.getElementById('detailPanel');

  if (!selectedPid || !snapshot) {
    panel.classList.remove('visible');
    panel.innerHTML = '';
    return;
  }

  const inst = snapshot.instances.find(i => i.pid === selectedPid);
  if (!inst) {
    selectedPid = null;
    panel.classList.remove('visible');
    panel.innerHTML = '';
    return;
  }

  panel.classList.add('visible');

  const ctx = ctxInfo(inst);
  const shortCwd = inst.cwd ? inst.cwd.replace(/^\/Users\/[^/]+/, '~') : '—';

  panel.innerHTML = `
    <div class="detail-header">
      <span class="detail-title">${inst.project}</span>
      <button class="detail-close no-drag" id="detailClose">✕</button>
    </div>
    <div class="detail-grid">
      <div class="detail-row"><span class="detail-key">model</span><span class="detail-val">${shortModelName(inst.model) || '—'}</span></div>
      <div class="detail-row"><span class="detail-key">branch</span><span class="detail-val">${inst.gitBranch || '—'}</span></div>
      <div class="detail-row"><span class="detail-key">turns</span><span class="detail-val">${inst.turnCount}</span></div>
      <div class="detail-row"><span class="detail-key">context</span><span class="detail-val">${ctx.pct.toFixed(0)}%</span></div>
      <div class="detail-row"><span class="detail-key">in tokens</span><span class="detail-val">${formatTokens(inst.inputTokens)}</span></div>
      <div class="detail-row"><span class="detail-key">out tokens</span><span class="detail-val">${formatTokens(inst.outputTokens)}</span></div>
      <div class="detail-row"><span class="detail-key">cached</span><span class="detail-val">${formatTokens(inst.cacheReadTokens)}</span></div>
      <div class="detail-row"><span class="detail-key">cpu / mem</span><span class="detail-val">${inst.cpu.toFixed(1)}% / ${formatMem(inst.rss)}</span></div>
    </div>
    <div class="detail-path" title="${inst.cwd}">${shortCwd}</div>
    <button class="detail-focus-btn no-drag" id="detailFocusBtn">Open instance</button>
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
      // Click — toggle selection
      const pid = tileDrag.pid;
      selectedPid = selectedPid === pid ? null : pid;
      render();
    }
    tileDrag = null;
    return;
  }
  windowDrag = false;
});

// ── Event delegation for detail buttons ──────────────────────
document.addEventListener('click', (e) => {
  if (e.target.closest('#detailClose')) {
    e.stopPropagation();
    selectedPid = null;
    render();
    return;
  }
  if (e.target.closest('#detailFocusBtn')) {
    e.stopPropagation();
    if (window.api && selectedPid) window.api.focusInstance(selectedPid);
    return;
  }
});

// ── Window drag state ────────────────────────────────────────
let windowDrag = false;
let windowDragX = 0, windowDragY = 0;

// ── Header buttons ───────────────────────────────────────────
document.getElementById('themeBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  const bar = document.getElementById('compactBar');
  const btn = document.getElementById('themeBtn');
  bar.classList.toggle('light');
  btn.textContent = bar.classList.contains('light') ? '☾' : '☀';
});
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
