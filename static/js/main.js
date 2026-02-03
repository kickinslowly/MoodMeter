/*
  Interactivity for Mood Meter
  - Adds hover and click behavior for grid cells
  - Colors each cell based on its (x,y) position to reflect mood quadrants
  - Posts clicks to /click for future DB logging
*/
(function() {
  const size = typeof window.MOOD_GRID_SIZE === 'number' ? window.MOOD_GRID_SIZE : 10;

  // Ensure axis arrowheads point outward on both ends
  try {
    document.querySelectorAll('marker#arrowhead-x, marker#arrowhead-y').forEach(m => m.setAttribute('orient', 'auto-start-reverse'));
  } catch {}

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp01(x) { return Math.max(0, Math.min(1, x)); }


  function rgb(r, g, b) { return `rgb(${r}, ${g}, ${b})`; }

  // Corner colors: top-left (high energy, unpleasant) red, top-right yellow,
  // bottom-left blue, bottom-right green
  const C_TL = [224, 56, 56];     // red-ish
  const C_TR = [246, 223, 95];    // yellow-ish
  const C_BL = [70, 112, 214];    // blue-ish
  const C_BR = [74, 201, 129];    // green-ish

  // Quadrant-based color: sharp boundary at midlines, gradient within each quadrant
  function quadrantColor(tX, tY) {
    // Determine quadrant by center split
    const left = tX <= 0.5;
    const top = tY <= 0.5;
    // Normalize local coordinates within the quadrant [0,1]
    const qX = left ? (tX / 0.5) : ((tX - 0.5) / 0.5);
    const qY = top ? (tY / 0.5) : ((tY - 0.5) / 0.5);
    // For each quadrant, blend between its two corner anchors to create depth
    // Top-left: blend from a deep red (towards TL) to a slightly warmer/yellow edge as you move right/down
    if (top && left) {
      const anchor0 = C_TL;                 // strong red
      const anchor1 = [235, 120, 80];       // warm red-orange for variety
      const horiz = [220, 70, 70];          // horizontal influence
      const vert = [210, 60, 60];           // vertical influence
      const mixH = [
        Math.round(lerp(anchor0[0], horiz[0], qX)),
        Math.round(lerp(anchor0[1], horiz[1], qX)),
        Math.round(lerp(anchor0[2], horiz[2], qX)),
      ];
      const mixV = [
        Math.round(lerp(anchor0[0], vert[0], qY)),
        Math.round(lerp(anchor0[1], vert[1], qY)),
        Math.round(lerp(anchor0[2], vert[2], qY)),
      ];
      return [
        Math.round(lerp(mixH[0], anchor1[0], 0.25 * Math.max(qX, qY))),
        Math.round(lerp(mixH[1], anchor1[1], 0.25 * Math.max(qX, qY))),
        Math.round(lerp(mixH[2], anchor1[2], 0.25 * Math.max(qX, qY))),
      ];
    }
    // Top-right: yellow family
    if (top && !left) {
      const anchor0 = C_TR;                 // yellow
      const anchor1 = [255, 200, 80];       // warmer yellow-orange
      const horiz = [248, 230, 120];        // lighter towards right
      const vert = [240, 210, 90];          // slightly deeper towards center
      const mixH = [
        Math.round(lerp(anchor0[0], horiz[0], qX)),
        Math.round(lerp(anchor0[1], horiz[1], qX)),
        Math.round(lerp(anchor0[2], horiz[2], qX)),
      ];
      const mixV = [
        Math.round(lerp(anchor0[0], vert[0], qY)),
        Math.round(lerp(anchor0[1], vert[1], qY)),
        Math.round(lerp(anchor0[2], vert[2], qY)),
      ];
      return [
        Math.round(lerp(mixH[0], anchor1[0], 0.25 * Math.max(qX, qY))),
        Math.round(lerp(mixH[1], anchor1[1], 0.25 * Math.max(qX, qY))),
        Math.round(lerp(mixH[2], anchor1[2], 0.25 * Math.max(qX, qY))),
      ];
    }
    // Bottom-left: blue family
    if (!top && left) {
      const anchor0 = C_BL;                 // blue
      const anchor1 = [110, 150, 230];      // lighter blue
      const horiz = [80, 130, 220];
      const vert = [60, 100, 200];
      const mixH = [
        Math.round(lerp(anchor0[0], horiz[0], qX)),
        Math.round(lerp(anchor0[1], horiz[1], qX)),
        Math.round(lerp(anchor0[2], horiz[2], qX)),
      ];
      const mixV = [
        Math.round(lerp(anchor0[0], vert[0], qY)),
        Math.round(lerp(anchor0[1], vert[1], qY)),
        Math.round(lerp(anchor0[2], vert[2], qY)),
      ];
      return [
        Math.round(lerp(mixH[0], anchor1[0], 0.25 * Math.max(qX, qY))),
        Math.round(lerp(mixH[1], anchor1[1], 0.25 * Math.max(qX, qY))),
        Math.round(lerp(mixH[2], anchor1[2], 0.25 * Math.max(qX, qY))),
      ];
    }
    // Bottom-right: green family
    {
      const anchor0 = C_BR;                 // green
      const anchor1 = [120, 220, 150];      // lighter green
      const horiz = [90, 210, 140];
      const vert = [80, 200, 130];
      const mixH = [
        Math.round(lerp(anchor0[0], horiz[0], qX)),
        Math.round(lerp(anchor0[1], horiz[1], qX)),
        Math.round(lerp(anchor0[2], horiz[2], qX)),
      ];
      const mixV = [
        Math.round(lerp(anchor0[0], vert[0], qY)),
        Math.round(lerp(anchor0[1], vert[1], qY)),
        Math.round(lerp(anchor0[2], vert[2], qY)),
      ];
      return [
        Math.round(lerp(mixH[0], anchor1[0], 0.25 * Math.max(qX, qY))),
        Math.round(lerp(mixH[1], anchor1[1], 0.25 * Math.max(qX, qY))),
        Math.round(lerp(mixH[2], anchor1[2], 0.25 * Math.max(qX, qY))),
      ];
    }
  }

  function computeCellColor(xIdx, yIdx) {
    const tX = xIdx / (size - 1); // 0 (unpleasant) -> 1 (pleasant)
    const tY = yIdx / (size - 1); // 0 (high energy top) -> 1 (low energy bottom)
    const [r, g, b] = quadrantColor(tX, tY);
    return rgb(r, g, b);
  }

  function initGrid() {
    const cells = Array.from(document.querySelectorAll('.cell'));
    // Color and setup behavior
    for (const cell of cells) {
      const x = parseInt(cell.dataset.x, 10);
      const y = parseInt(cell.dataset.y, 10);
      const bg = computeCellColor(x, y);
      cell.style.background = `linear-gradient(140deg, ${bg}, rgba(0,0,0,0.15))`;
      cell.style.filter = 'saturate(1.05)';

      cell.addEventListener('mouseenter', () => {
        document.body.style.setProperty('--hover-hint', bg);
      });
      cell.addEventListener('mouseleave', () => {
        document.body.style.removeProperty('--hover-hint');
      });

      cell.addEventListener('click', () => onCellClick(cell));
      cell.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onCellClick(cell);
        }
      });
    }
  }

  async function onCellClick(cell) {
    // Toggle visual selection and deselect others
    for (const el of document.querySelectorAll('.cell.selected')) {
      if (el !== cell) el.classList.remove('selected');
    }
    cell.classList.toggle('selected');

    const x = parseInt(cell.dataset.x, 10);
    const y = parseInt(cell.dataset.y, 10);
    const label = cell.dataset.label;
    const ts = Date.now();
    // Browser local timezone info
    const tzOffset = -new Date().getTimezoneOffset(); // minutes offset from UTC (e.g., -420 for PDT)
    const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    const sid = (typeof window.getActiveSessionId === 'function') ? window.getActiveSessionId() : null;

    try {
      const res = await fetch('/moodmeter/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y, label, ts, tzOffset, tzName, session_id: sid })
      });
      const data = await res.json();
      if (!data.ok) {
        if (data.error === 'TOO_SOON') {
          const msg = 'You can record a mood once every 10 minutes.' + (data.last_entry ? `\nLast Mood Meter entry: ${data.last_entry}` : '');
          showNeonWarning(msg);
        } else {
          console.warn('Server rejected mood submit', data);
        }
        return;
      }
      flash(cell);
      // Celebratory near-full-screen overlay confirmation
      try {
        const base = computeCellColor(x, y);
        showCelebrationOverlay(label, base, cell);
      } catch (_) { /* ignore */ }
      // Update the Last Mood Meter entry banner immediately after a successful record
      fetchLastEntryAndUpdate();
    } catch (e) {
      console.warn('Failed to record click', e);
    }
  }

  async function fetchLastEntryAndUpdate() {
    try {
      const res = await fetch('/moodmeter/api/last-entry', { headers: { 'Accept': 'application/json' }, cache: 'no-store' });
      if (!res.ok) return;
      const j = await res.json();
      if (!j.ok) return;
      setLastEntryText(j.last_entry);
    } catch (e) {
      // ignore polling errors
    }
  }

  function setLastEntryText(text) {
    const footer = document.querySelector('.footer');
    if (!footer) return;
    let el = document.getElementById('last-entry-footer');
    if (text) {
      if (!el) {
        el = document.createElement('div');
        el.id = 'last-entry-footer';
        el.className = 'footer-last-entry';
        footer.appendChild(el);
      } else if (el.parentNode !== footer) {
        footer.appendChild(el);
      }
      el.textContent = 'Last Mood Meter entry: ' + text;
      el.style.display = '';
    } else if (el) {
      el.textContent = '';
      el.style.display = 'none';
    }
  }

  function flash(cell) {
    cell.animate([
      { transform: 'translateY(-1px) scale(1.02)', boxShadow: '0 0 0 2px #fff, 0 8px 20px rgba(0,0,0,0.45)' },
      { transform: 'translateY(0) scale(1.0)', boxShadow: '0 0 0 0 rgba(0,0,0,0)' }
    ], { duration: 420, easing: 'ease-out' });
  }

  // Toast utilities
  function ensureToastRoot() {
    let root = document.getElementById('mood-toast-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'mood-toast-root';
      root.className = 'mood-toast-root';
      document.body.appendChild(root);
    }
    return root;
  }

  function showCozyToast(label, baseColor) {
    const root = ensureToastRoot();
    // Remove any existing toasts gracefully
    for (const el of Array.from(root.children)) {
      el.getAnimations().forEach(a => a.finish());
      el.animate([
        { transform: 'translateY(0) scale(1)', opacity: 1 },
        { transform: 'translateY(6px) scale(0.98)', opacity: 0 }
      ], { duration: 220, easing: 'ease-out' }).finished.then(() => el.remove());
    }

    const toast = document.createElement('div');
    toast.className = 'mood-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.setAttribute('aria-atomic', 'true');
    if (baseColor) toast.style.setProperty('--accent', baseColor);

    toast.innerHTML = `
      <span class="mood-toast__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      </span>
      <div class="mood-toast__text">
        <div class="mood-toast__title">Entry recorded</div>
        <div class="mood-toast__sub">${label ? escapeHtml(label) : ''}</div>
      </div>
    `;

    root.appendChild(toast);

    // Pop-in animation (smooth and gentle)
    toast.animate([
      { transform: 'translateY(14px) scale(.96)', opacity: 0 },
      { transform: 'translateY(0) scale(1)', opacity: 1 }
    ], { duration: 360, easing: 'cubic-bezier(.21,1,.21,1)' });

    // Icon pulse
    const icon = toast.querySelector('.mood-toast__icon');
    if (icon) {
      icon.animate([
        { transform: 'scale(0.9)', boxShadow: '0 0 0 0 rgba(255,255,255,0.0)' },
        { transform: 'scale(1.0)', boxShadow: '0 0 0 8px rgba(255,255,255,0.0)' }
      ], { duration: 600, easing: 'ease-out' });
    }

    // Auto-dismiss
    const timeout = setTimeout(() => dismiss(), 2600);

    function dismiss() {
      // Guard if already removed
      if (!toast.isConnected) return;
      toast.animate([
        { transform: 'translateY(0) scale(1)', opacity: 1 },
        { transform: 'translateY(6px) scale(0.98)', opacity: 0 }
      ], { duration: 260, easing: 'ease-in' }).finished.then(() => toast.remove());
    }

    // Close on Escape without stealing focus
    window.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') {
        clearTimeout(timeout);
        dismiss();
        window.removeEventListener('keydown', esc);
      }
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"]/g, function(s) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]);
    });
  }

  // Near-full-screen celebratory overlay
  function ensureOverlayRoot() {
    let root = document.getElementById('mood-overlay-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'mood-overlay-root';
      root.className = 'mood-overlay-root';
      document.body.appendChild(root);
    }
    return root;
  }

  function showCelebrationOverlay(label, baseColor, originEl) {
    const root = ensureOverlayRoot();
    // Clear any existing overlay
    root.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'mood-overlay';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', 'Mood entry recorded');

    const backdrop = document.createElement('div');
    backdrop.className = 'mood-overlay__backdrop';

    const panel = document.createElement('div');
    panel.className = 'mood-overlay__panel';
    if (baseColor) panel.style.setProperty('--accent', baseColor);

    panel.innerHTML = `
      <div class="mood-overlay__glow" aria-hidden="true"></div>
      <div class="mood-overlay__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      </div>
      <div class="mood-overlay__sub">${label ? escapeHtml(label) : ''}</div>
    `;

    wrap.appendChild(backdrop);
    wrap.appendChild(panel);
    root.appendChild(wrap);

    // Animate in
    try {
      backdrop.animate([
        { opacity: 0 },
        { opacity: 1 }
      ], { duration: 260, easing: 'ease-out' });

      // If we have an origin element (the clicked cell), scale from its center for a delightful feel
      let keyframes = [
        { transform: 'translateY(10px) scale(0.96)', opacity: 0 },
        { transform: 'translateY(0) scale(1)', opacity: 1 }
      ];
      panel.animate(keyframes, { duration: 420, easing: 'cubic-bezier(.21,1,.21,1)' });

      const icon = panel.querySelector('.mood-overlay__icon');
      if (icon) {
        icon.animate([
          { transform: 'scale(0.9)', filter: 'brightness(1.05)' },
          { transform: 'scale(1.0)', filter: 'brightness(1.0)' }
        ], { duration: 600, easing: 'ease-out' });
      }
    } catch (_) { /* ignore animation errors */ }

    // Auto-dismiss quickly to keep flow
    const timeout = setTimeout(dismiss, 1700);

    function dismiss() {
      if (!wrap.isConnected) return;
      try {
        const a1 = backdrop.animate([
          { opacity: 1 },
          { opacity: 0 }
        ], { duration: 220, easing: 'ease-in' });
        const a2 = panel.animate([
          { transform: 'translateY(0) scale(1)', opacity: 1 },
          { transform: 'translateY(8px) scale(0.98)', opacity: 0 }
        ], { duration: 240, easing: 'ease-in' });
        Promise.allSettled([a1.finished, a2.finished]).then(() => {
          wrap.remove();
        });
      } catch (_) {
        wrap.remove();
      }
    }

    // Close on interactions
    function onEsc(e) {
      if (e.key === 'Escape') {
        clearTimeout(timeout);
        dismiss();
        window.removeEventListener('keydown', onEsc);
      }
    }
    window.addEventListener('keydown', onEsc);
    backdrop.addEventListener('click', () => { clearTimeout(timeout); dismiss(); });
    panel.addEventListener('click', () => { clearTimeout(timeout); dismiss(); });
  }

  function initLastEntryPolling() {
    // Initial fetch when page becomes ready/visible
    fetchLastEntryAndUpdate();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        fetchLastEntryAndUpdate();
      }
    });
    // Poll every 30 seconds while the tab is visible
    setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchLastEntryAndUpdate();
      }
    }, 30000);
  }

  function isMobileViewport() {
    return window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  }

  function buildQuadrantMap() {
    const mid = Math.floor(size / 2);
    const cells = Array.from(document.querySelectorAll('.grid .cell'));
    const map = { red: [], yellow: [], blue: [], green: [] };
    for (const c of cells) {
      const x = parseInt(c.dataset.x, 10);
      const y = parseInt(c.dataset.y, 10);
      const label = c.dataset.label || (c.textContent || '').trim();
      const top = y < mid;
      const left = x < mid;
      let q;
      if (top && left) q = 'red';
      else if (top && !left) q = 'yellow';
      else if (!top && left) q = 'blue';
      else q = 'green';
      map[q].push({ x, y, label });
    }
    for (const k of Object.keys(map)) {
      map[k] = map[k]
        .filter(it => it.label && it.label.length > 0)
        .sort((a, b) => (a.y - b.y) || (a.x - b.x));
    }
    return map;
  }

  function initMobileMoodUI() {
    const root = document.getElementById('mobile-mood-ui');
    if (!root) return;
    const drill = document.getElementById('mobile-drilldown');
    const drillTitle = drill ? drill.querySelector('.mobile-drilldown-title') : null;
    const drillList = drill ? drill.querySelector('.mobile-drilldown-list') : null;
    const backBtn = drill ? drill.querySelector('.back-btn') : null;

    function showDrill(quadrant, titleText, quadMap) {
      if (!drill || !drillTitle || !drillList) return;
      drillTitle.textContent = titleText || '';
      drillList.innerHTML = '';
      const items = quadMap[quadrant] || [];
      for (const item of items) {
        const btn = document.createElement('button');
        btn.className = 'mobile-mood-item';
        btn.type = 'button';
        btn.setAttribute('role', 'gridcell');
        btn.textContent = item.label;
        btn.dataset.x = String(item.x);
        btn.dataset.y = String(item.y);
        btn.dataset.label = item.label;
        btn.ariaLabel = item.label;
        try {
          const base = computeCellColor(item.x, item.y);
          btn.style.background = `linear-gradient(140deg, ${base}, rgba(0,0,0,0.15))`;
          btn.style.filter = 'saturate(1.05)';
        } catch (_) { /* ignore coloring errors */ }
        const handlePick = () => {
          const selector = `.grid .cell[data-x="${item.x}"][data-y="${item.y}"]`;
          const cell = document.querySelector(selector);
          if (cell) {
            try { onCellClick(cell); } catch (_) {}
          }
          drill.hidden = true;
        };
        btn.addEventListener('click', handlePick);
        btn.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handlePick();
          }
        });
        drillList.appendChild(btn);
      }
      drill.hidden = false;
      try {
        const first = drillList.querySelector('.mobile-mood-item');
        if (first) first.focus();
      } catch (_) { /* ignore focus errors */ }
    }

    function setup() {
      const mobile = isMobileViewport();
      root.hidden = !mobile;
      if (!mobile) return;
      if (root.dataset.ready === '1') return;

      const quadMap = buildQuadrantMap();
      const redBtn = root.querySelector('[data-quadrant="red"]');
      const yellowBtn = root.querySelector('[data-quadrant="yellow"]');
      const blueBtn = root.querySelector('[data-quadrant="blue"]');
      const greenBtn = root.querySelector('[data-quadrant="green"]');

      if (redBtn) redBtn.addEventListener('click', () => showDrill('red', 'Angry', quadMap));
      if (yellowBtn) yellowBtn.addEventListener('click', () => showDrill('yellow', 'Happy', quadMap));
      if (blueBtn) blueBtn.addEventListener('click', () => showDrill('blue', 'Sad', quadMap));
      if (greenBtn) greenBtn.addEventListener('click', () => showDrill('green', 'Calm', quadMap));
      if (backBtn) backBtn.addEventListener('click', () => { if (drill) drill.hidden = true; });

      root.dataset.ready = '1';
    }

    setup();
    window.addEventListener('resize', setup);
  }

  function initAll() {
    initGrid();
    initLastEntryPolling();
    try { initMobileMoodUI(); } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();


// Neon Warning Modal
function ensureNeonModalRoot() {
  let root = document.getElementById('neon-modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'neon-modal-root';
    root.className = 'neon-modal-root';
    document.body.appendChild(root);
  }
  return root;
}

function showNeonWarning(message, options) {
  const root = ensureNeonModalRoot();
  root.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'neon-modal';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.setAttribute('aria-label', 'Wait before submitting again');

  const backdrop = document.createElement('div');
  backdrop.className = 'neon-modal__backdrop';

  const panel = document.createElement('div');
  panel.className = 'neon-modal__panel';
  panel.innerHTML = `
    <div class="neon-modal__glow" aria-hidden="true"></div>
    <div class="neon-modal__icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 9v4"/>
        <path d="M12 17h.01"/>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      </svg>
    </div>
    <div class="neon-modal__title">Too soon</div>
    <div class="neon-modal__message"></div>
    <div class="neon-modal__actions">
      <button class="neon-btn" type="button">Okay</button>
    </div>
  `;

  const msgEl = panel.querySelector('.neon-modal__message');
  msgEl.textContent = String(message || 'You can record a mood once every 10 minutes.');

  wrap.appendChild(backdrop);
  wrap.appendChild(panel);
  root.appendChild(wrap);

  // Focus management
  const previouslyFocused = document.activeElement;
  const okBtn = panel.querySelector('.neon-btn');
  okBtn.focus({ preventScroll: true });

  function close() {
    try {
      const a1 = backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-in' });
      const a2 = panel.animate([
        { transform: 'translateY(0) scale(1)', opacity: 1 },
        { transform: 'translateY(8px) scale(0.98)', opacity: 0 }
      ], { duration: 220, easing: 'ease-in' });
      Promise.allSettled([a1.finished, a2.finished]).then(() => {
        wrap.remove();
        if (previouslyFocused && previouslyFocused.focus) {
          previouslyFocused.focus({ preventScroll: true });
        }
      });
    } catch (_) {
      wrap.remove();
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus({ preventScroll: true });
    }
  }

  // Animations in
  try {
    backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
    panel.animate([
      { transform: 'translateY(12px) scale(0.96)', opacity: 0 },
      { transform: 'translateY(0) scale(1)', opacity: 1 }
    ], { duration: 360, easing: 'cubic-bezier(.21,1,.21,1)' });
  } catch (_) { /* ignore */ }

  // Events
  okBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  function onKey(e) {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      close();
      window.removeEventListener('keydown', onKey);
    }
  }
  window.addEventListener('keydown', onKey);
}


// --- Session management and aggregated heat rendering ---
(function(){
  function getActiveSession(){
    try {
      const id = localStorage.getItem('session_id');
      const pin = localStorage.getItem('session_pin');
      return id ? { id: parseInt(id, 10), pin: pin || null } : null;
    } catch { return null; }
  }
  window.getActiveSessionId = function(){ const s = getActiveSession(); return s ? s.id : null; };

  function setActiveSession(id, pin){
    try { localStorage.setItem('session_id', String(id)); if (pin) localStorage.setItem('session_pin', String(pin)); } catch {}
    updateSessionUI();
    startSessionPolling();
  }
  function clearActiveSession(){
    try { localStorage.removeItem('session_id'); localStorage.removeItem('session_pin'); } catch {}
    updateSessionUI();
    stopSessionPolling();
    applySessionHeat(null, 0);
  }

  async function createSession(){
    const res = await fetch('/moodmeter/api/session/create', { method: 'POST' });
    const j = await res.json().catch(()=>null);
    if (res.ok && j && j.ok){
      setActiveSession(j.session_id, j.pin);
      try { await navigator.clipboard.writeText(String(j.pin)); } catch {}
      return { id: j.session_id, pin: j.pin };
    }
    throw new Error((j && j.error) || 'CREATE_FAILED');
  }
  async function joinSession(pin){
    const res = await fetch('/moodmeter/api/session/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: String(pin).trim() })
    });
    const j = await res.json().catch(()=>null);
    if (res.ok && j && j.ok){
      setActiveSession(j.session_id, String(pin).trim());
      return { id: j.session_id, pin: String(pin).trim() };
    }
    const err = (j && j.error) || 'JOIN_FAILED';
    const e = new Error(err); e.code = err; throw e;
  }

  function updateSessionUI(){
    const btn = document.getElementById('sessionBtn');
    const status = document.getElementById('sessionStatus');
    const s = getActiveSession();
    if (!btn) return;
    if (s){
      btn.textContent = 'Session ' + (s.pin || ('#' + s.id));
      btn.classList.add('active');
      if (status) status.textContent = 'PIN ' + (s.pin || '—');
    } else {
      btn.textContent = 'Session';
      btn.classList.remove('active');
      if (status) status.textContent = '';
    }
  }
  function onSessionBtn(e){
    if (e && e.preventDefault) e.preventDefault();
    openSessionMenu();
  }

  // In-page Session Menu (popover)
  let sessionMenuEl = null;
  function ensureSessionMenu(){
    if (!sessionMenuEl){
      sessionMenuEl = document.createElement('div');
      sessionMenuEl.id = 'sessionMenu';
      sessionMenuEl.className = 'session-menu';
      sessionMenuEl.setAttribute('role', 'dialog');
      sessionMenuEl.setAttribute('aria-modal', 'true');
      sessionMenuEl.style.display = 'none';
      document.body.appendChild(sessionMenuEl);
    }
    return sessionMenuEl;
  }
  function openSessionMenu(){
    const el = ensureSessionMenu();
    renderSessionMenu(el);
    el.style.display = 'block';
    positionSessionMenu();
    document.addEventListener('click', onSessionDocClick, true);
    window.addEventListener('resize', positionSessionMenu);
    window.addEventListener('keydown', onSessionKey);
  }
  function closeSessionMenu(){
    if (!sessionMenuEl) return;
    sessionMenuEl.style.display = 'none';
    document.removeEventListener('click', onSessionDocClick, true);
    window.removeEventListener('resize', positionSessionMenu);
    window.removeEventListener('keydown', onSessionKey);
  }
  function onSessionDocClick(e){
    const btn = document.getElementById('sessionBtn');
    if (!sessionMenuEl) return;
    if (sessionMenuEl.contains(e.target)) return;
    if (btn && (btn === e.target || btn.contains(e.target))) return;
    closeSessionMenu();
  }
  function onSessionKey(e){ if (e.key === 'Escape'){ e.preventDefault(); closeSessionMenu(); } }
  function positionSessionMenu(){
    const btn = document.getElementById('sessionBtn'); if (!btn || !sessionMenuEl) return;
    const r = btn.getBoundingClientRect();
    const top = r.bottom + 8;
    let left = r.left;
    // Ensure width is measured
    sessionMenuEl.style.visibility = 'hidden';
    sessionMenuEl.style.display = 'block';
    const menuWidth = sessionMenuEl.offsetWidth || 280;
    sessionMenuEl.style.display = '';
    sessionMenuEl.style.visibility = '';
    const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    if (left + menuWidth > vw - 8) left = vw - menuWidth - 8;
    sessionMenuEl.style.top = Math.round(top) + 'px';
    sessionMenuEl.style.left = Math.round(left) + 'px';
  }
  function renderSessionMenu(root){
    const s = getActiveSession();
    if (!s){
      root.innerHTML = `
        <h4>Session</h4>
        <div class="actions">
          <button type="button" id="createSessionBtn">Create a session</button>
        </div>
        <div class="row" style="margin-top:8px;">
          <input id="joinPinInput" type="text" inputmode="numeric" pattern="\\d*" maxlength="6" placeholder="Enter PIN" />
          <button type="button" id="joinSessionBtn">Join</button>
        </div>
        <div class="note" id="sessionNote">Create to generate a PIN to share, or join with a PIN.</div>
      `;
      const createBtn = root.querySelector('#createSessionBtn');
      const joinBtn = root.querySelector('#joinSessionBtn');
      const pinInput = root.querySelector('#joinPinInput');
      const note = root.querySelector('#sessionNote');
      createBtn.addEventListener('click', async ()=>{
        createBtn.disabled = true;
        try {
          const out = await createSession();
          note.textContent = `Session created. PIN ${out.pin} was copied to clipboard.`;
          // Re-render to show active actions
          renderSessionMenu(root);
        } catch (_e) {
          note.textContent = 'Failed to create session. Please try again.';
        } finally {
          createBtn.disabled = false;
        }
      });
      joinBtn.addEventListener('click', async ()=>{
        const pin = pinInput.value.trim();
        if (!pin){ note.textContent = 'Please enter a PIN.'; pinInput.focus(); return; }
        joinBtn.disabled = true; pinInput.disabled = true;
        try {
          await joinSession(pin);
          closeSessionMenu();
        } catch (e) {
          note.textContent = (e && e.code === 'NOT_FOUND') ? 'Session not found or inactive.' : 'Failed to join session.';
          pinInput.disabled = false; joinBtn.disabled = false; pinInput.focus();
        }
      });
      pinInput.addEventListener('keydown', (e)=>{ if (e.key === 'Enter'){ e.preventDefault(); root.querySelector('#joinSessionBtn').click(); } });
      setTimeout(()=>{ pinInput.focus(); }, 0);
    } else {
      const pin = s.pin || '';
      root.innerHTML = `
        <h4>Session active</h4>
        <div class="note">PIN: <strong>${pin || '—'}</strong></div>
        <div class="actions" style="margin-top:8px;">
          <button type="button" id="copyPinBtn">Copy PIN</button>
          <button type="button" id="leaveSessionBtn">Leave session</button>
        </div>
      `;
      const copyBtn = root.querySelector('#copyPinBtn');
      copyBtn.addEventListener('click', async ()=>{
        try { await navigator.clipboard.writeText(String(pin)); } catch {}
        const n = document.createElement('div'); n.className = 'note'; n.textContent = 'PIN copied to clipboard.'; root.appendChild(n);
        setTimeout(()=>{ if (n.isConnected) n.remove(); }, 1800);
      });
      root.querySelector('#leaveSessionBtn').addEventListener('click', ()=>{
        clearActiveSession();
        closeSessionMenu();
      });
    }
    positionSessionMenu();
  }

  // Polling aggregated stats for active session
  let pollTimer = null;
  function startSessionPolling(){
    const s = getActiveSession();
    if (!s || !s.id) return;
    stopSessionPolling();
    const intervalMs = 2000;
    const tick = async () => {
      const cur = getActiveSession();
      if (!cur || !cur.id){ stopSessionPolling(); return; }
      try {
        const res = await fetch(`/moodmeter/api/session/${encodeURIComponent(cur.id)}/stats`, { headers: { 'Accept': 'application/json' }, cache: 'no-store' });
        const j = await res.json().catch(()=>null);
        if (res.ok && j && j.ok){
          applySessionHeat(j.heatmap, j.max_count || 0);
        }
      } catch {}
    };
    pollTimer = setInterval(tick, intervalMs);
    tick();
  }
  function stopSessionPolling(){ if (pollTimer){ clearInterval(pollTimer); pollTimer = null; } }

  function ensureCountBadge(cell){
    let b = cell.querySelector('.count-badge');
    if (!b){ b = document.createElement('span'); b.className = 'count-badge'; cell.appendChild(b); }
    return b;
  }
  function applySessionHeat(heat, maxCount){
    const cells = document.querySelectorAll('.grid .cell');
    if (!cells.length) return;
    if (!heat){
      for (const cell of cells){
        cell.classList.remove('session-glow');
        cell.style.removeProperty('--session-glow');
        const b = cell.querySelector('.count-badge'); if (b) b.remove();
      }
      return;
    }
    for (const cell of cells){
      const x = parseInt(cell.dataset.x, 10);
      const y = parseInt(cell.dataset.y, 10);
      const c = (heat[y] && heat[y][x]) ? heat[y][x] : 0;
      const t = maxCount ? Math.sqrt(c / maxCount) : 0;
      if (c > 0){
        cell.classList.add('session-glow');
        cell.style.setProperty('--session-glow', String(t));
        const badge = ensureCountBadge(cell);
        badge.textContent = String(c);
        badge.style.display = '';
      } else {
        cell.classList.remove('session-glow');
        cell.style.removeProperty('--session-glow');
        const badge = cell.querySelector('.count-badge'); if (badge) badge.style.display = 'none';
      }
    }
  }

  function initSession(){
    const btn = document.getElementById('sessionBtn');
    if (btn){ btn.addEventListener('click', onSessionBtn); }
    updateSessionUI();
    const s = getActiveSession();
    if (s && s.id){ startSessionPolling(); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSession); else initSession();
})();
