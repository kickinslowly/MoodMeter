/*
  Interactivity for Mood Meter
  - Adds hover and click behavior for grid cells
  - Colors each cell based on its (x,y) position to reflect mood quadrants
  - Posts clicks to /click for future DB logging
*/
(function() {
  const size = typeof window.MOOD_GRID_SIZE === 'number' ? window.MOOD_GRID_SIZE : 10;

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp01(x) { return Math.max(0, Math.min(1, x)); }

  // Bilinear blend between four corner colors (in RGB arrays)
  function bilinearColor(x, y, c00, c10, c01, c11) {
    const tX = clamp01(x);
    const tY = clamp01(y);
    const top = [
      lerp(c00[0], c10[0], tX),
      lerp(c00[1], c10[1], tX),
      lerp(c00[2], c10[2], tX),
    ];
    const bottom = [
      lerp(c01[0], c11[0], tX),
      lerp(c01[1], c11[1], tX),
      lerp(c01[2], c11[2], tX),
    ];
    return [
      Math.round(lerp(top[0], bottom[0], tY)),
      Math.round(lerp(top[1], bottom[1], tY)),
      Math.round(lerp(top[2], bottom[2], tY)),
    ];
  }

  function rgb(r, g, b) { return `rgb(${r}, ${g}, ${b})`; }

  // Corner colors: top-left (high energy, unpleasant) red, top-right yellow,
  // bottom-left blue, bottom-right green
  const C_TL = [224, 56, 56];     // red-ish
  const C_TR = [246, 223, 95];    // yellow-ish
  const C_BL = [70, 112, 214];    // blue-ish
  const C_BR = [74, 201, 129];    // green-ish

  function computeCellColor(xIdx, yIdx) {
    const tX = xIdx / (size - 1); // 0 (unpleasant) -> 1 (pleasant)
    const tY = yIdx / (size - 1); // 0 (high energy top) -> 1 (low energy bottom)
    const [r, g, b] = bilinearColor(tX, tY, C_TL, C_TR, C_BL, C_BR);
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

    try {
      const res = await fetch('/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y, label, ts })
      });
      const data = await res.json();
      if (!data.ok) throw new Error('Not OK');
      flash(cell);
    } catch (e) {
      console.warn('Failed to record click', e);
    }
  }

  function flash(cell) {
    cell.animate([
      { transform: 'translateY(-1px) scale(1.02)', boxShadow: '0 0 0 2px #fff, 0 8px 20px rgba(0,0,0,0.45)' },
      { transform: 'translateY(0) scale(1.0)', boxShadow: '0 0 0 0 rgba(0,0,0,0)' }
    ], { duration: 420, easing: 'ease-out' });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGrid);
  } else {
    initGrid();
  }
})();
