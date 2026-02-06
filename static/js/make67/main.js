/**
 * make67/main.js - Main entry point for Make67 game
 *
 * This module imports reusable components and contains the game logic.
 */

import { TOL, fmt, clamp, clamp01, randomChoice, fmtTime, shuffleArray } from './utils.js';
import { generatePuzzle } from './puzzle.js';
import { dom, game, user, shop, leaderboard, theme, sound, events, chat, fx, initDom } from './state.js';
import {
  SOUND_OPTIONS, LEVELUP_SOUNDS,
  getSoundThreshold, getDefaultSoundId, isSoundUnlocked,
  playSfx, playRandomLevelUpSound, setupAudioUnlock,
  getPreferredSound, setPreferredSound
} from './audio.js';
import {
  COLOR_THEME_OPTIONS,
  pickTheme, calculateEmpowerment, getHighestUnlockedThreshold, isThemeUnlocked,
  getPreferredTheme, setPreferredTheme, applyColorTheme, applyEmpowermentCSS
} from './theme.js';

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize DOM references
initDom();

// Setup audio unlock for mobile
setupAudioUnlock();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function updateBodyLock() {
  const anyOpen = (dom.invModalRoot && !dom.invModalRoot.hidden)
    || (dom.shopModalRoot && !dom.shopModalRoot.hidden)
    || (dom.bannedRoot && !dom.bannedRoot.hidden)
    || (dom.chatOverlay && !dom.chatOverlay.hasAttribute('hidden') && dom.chatOverlay.style.display !== 'none');
  document.body.classList.toggle('m67-modal-open', !!anyOpen);
}

function currentTotalLike() {
  if (typeof user.allTime === 'number') return user.allTime;
  return (game.score || 0) * 5;
}

function predictedTotalForSound() {
  let t = (typeof user.allTime === 'number') ? user.allTime : 0;
  if (user.isAuthed && !game.hintUsed) t += 1;
  return t;
}

// ============================================================================
// THEME & EMPOWERMENT
// ============================================================================

function applyEmpowerment() {
  if (!dom.pageRoot) return;
  const totalLike = currentTotalLike();
  const emp = calculateEmpowerment(totalLike);
  theme.currentEmp = emp;
  applyEmpowermentCSS(dom.pageRoot, emp);

  // Apply rank-based theme
  const rankTheme = pickTheme(totalLike);
  const themes = ['theme-hero', 'theme-tycoon', 'theme-mystic', 'theme-darkking', 'theme-elite'];
  themes.forEach(t => dom.pageRoot.classList.remove(t));
  if (rankTheme) dom.pageRoot.classList.add(rankTheme);

  // Apply user-selected color theme if unlocked
  const prefTheme = getPreferredTheme(user.myUid);
  if (prefTheme && isThemeUnlocked(prefTheme, totalLike)) {
    applyColorTheme(dom.pageRoot, prefTheme);
  } else {
    applyColorTheme(dom.pageRoot, null);
  }

  updateThemeBtnVisibility();
}

function updateThemeBtnVisibility() {
  if (!dom.themeBtn) return;
  const totalLike = currentTotalLike();
  const anyUnlocked = COLOR_THEME_OPTIONS.some(o => totalLike >= o.threshold);
  dom.themeBtn.style.display = anyUnlocked ? '' : 'none';
}

function initColorTheme() {
  const prefTheme = getPreferredTheme(user.myUid);
  const totalLike = currentTotalLike();
  if (prefTheme && isThemeUnlocked(prefTheme, totalLike)) {
    applyColorTheme(dom.pageRoot, prefTheme);
  }
  updateThemeBtnVisibility();
}

// ============================================================================
// SOUND SYSTEM
// ============================================================================

function playSolveSound() {
  const total = predictedTotalForSound();
  const threshold = getSoundThreshold(total);
  const preferred = getPreferredSound(user.myUid);

  let soundId;
  if (preferred && isSoundUnlocked(preferred, threshold)) {
    soundId = preferred;
  } else {
    soundId = getDefaultSoundId(total);
  }

  playSfx(soundId);
}

// ============================================================================
// SPARK EFFECTS
// ============================================================================

function sparkAt(el, count) {
  if (!el || theme.prefersReducedMotion) return;
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  for (let i = 0; i < count; i++) {
    const sp = document.createElement('span');
    sp.className = 'm67-spark';
    sp.style.left = cx + 'px';
    sp.style.top = cy + 'px';
    const angle = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 40;
    sp.style.setProperty('--dx', (Math.cos(angle) * dist) + 'px');
    sp.style.setProperty('--dy', (Math.sin(angle) * dist) + 'px');
    document.body.appendChild(sp);
    setTimeout(() => sp.remove(), 600);
  }
}

function burstCharge() {
  sparkAt(dom.allTimeBoxEl, Math.floor(3 + theme.currentEmp * 5));
}

// ============================================================================
// LEADERBOARD
// ============================================================================

function renderLeaderboard(list) {
  if (!dom.lbList) return;
  const html = list.map((u, idx) => {
    const isSelf = user.myUid && String(u.id) === user.myUid;
    const rankClass = u.rank_key ? `rank-${u.rank_key}` : '';
    const effectClasses = [
      u.is_boosted ? 'is-boosted' : '',
      u.is_mudded ? 'is-mudded' : '',
      u.is_shielded ? 'is-shielded' : ''
    ].filter(Boolean).join(' ');

    return `<li class="m67-lb-item ${rankClass} ${effectClasses} ${isSelf ? 'is-self' : ''}" data-uid="${u.id}">
      <span class="pos">${idx + 1}</span>
      <span class="icon">${u.rank_icon || ''}</span>
      <span class="name">${u.name || 'Anonymous'}</span>
      <span class="score">${u.total}</span>
    </li>`;
  }).join('');

  if (html !== leaderboard.prevLBHash) {
    dom.lbList.innerHTML = html;
    leaderboard.prevLBHash = html;
  }
}

async function loadLeaderboard() {
  try {
    const res = await fetch('/api/make67/leaderboard');
    const data = await res.json().catch(() => ({ ok: false }));

    if (data && data.ok) {
      renderLeaderboard(data.top || []);
      leaderboard.bannedCache = Array.isArray(data.banned) ? data.banned : [];

      if (data.me) {
        user.isAuthed = true;
        const newAllTime = Number(data.me.total || 0);
        const newRankKey = String(data.me.rank_key || '');
        const newRankTitle = String(data.me.rank_title || '');

        // Detect rank up
        if (user.lastKnownRankKey && newRankKey !== user.lastKnownRankKey && newAllTime > (user.lastKnownAllTime || 0)) {
          triggerRankHype(user.lastKnownRankTitle, newRankTitle);
        }

        user.lastKnownRankKey = newRankKey;
        user.lastKnownRankTitle = newRankTitle;
        user.lastKnownAllTime = newAllTime;
        user.allTime = newAllTime;

        if (dom.allTimeEl) dom.allTimeEl.textContent = String(newAllTime);
        applyEmpowerment();
      }
    }
  } catch (e) { /* ignore */ }
}

// ============================================================================
// RANK UP CELEBRATION
// ============================================================================

const FLAVOR_TEXTS_BASIC = [
  "You're getting better!",
  "Keep it up!",
  "Nice progress!"
];

const FLAVOR_TEXTS_MID = [
  "You're on fire!",
  "Impressive skills!",
  "The grind pays off!"
];

const FLAVOR_TEXTS_HIGH = [
  "ABSOLUTE LEGEND",
  "UNSTOPPABLE FORCE",
  "ELITE STATUS ACHIEVED"
];

const FLAVOR_TEXTS_ULTRA = [
  "BEYOND MORTAL LIMITS",
  "TRANSCENDENT GAMEPLAY",
  "THE PROPHECY IS TRUE"
];

const FLAVOR_TEXTS_GOD = [
  "YOU HAVE ASCENDED",
  "REALITY BENDS TO YOUR WILL",
  "THE FINAL FORM"
];

function getFlavorTextsForRank(newAllTime) {
  if (newAllTime >= 5000) return FLAVOR_TEXTS_GOD;
  if (newAllTime >= 4000) return FLAVOR_TEXTS_ULTRA;
  if (newAllTime >= 2500) return FLAVOR_TEXTS_HIGH;
  if (newAllTime >= 1000) return FLAVOR_TEXTS_MID;
  return FLAVOR_TEXTS_BASIC;
}

function triggerRankHype(oldTitle, newTitle) {
  if (!dom.rankUpOverlayEl) return;

  playRandomLevelUpSound();

  const newAllTime = user.lastKnownAllTime || 0;
  const flavorTexts = getFlavorTextsForRank(newAllTime);
  const flavor = randomChoice(flavorTexts);

  if (dom.rankUpNamesEl) {
    dom.rankUpNamesEl.innerHTML = `<span class="old-rank">${oldTitle || '???'}</span>
      <span class="arrow">→</span>
      <span class="new-rank">${newTitle || '???'}</span>`;
  }

  if (dom.rankUpFlavorEl) {
    dom.rankUpFlavorEl.textContent = flavor;
  }

  dom.rankUpOverlayEl.style.display = 'flex';

  // Particle burst scaled by rank
  const particleCount = Math.min(50, 10 + Math.floor(newAllTime / 200));
  for (let i = 0; i < particleCount; i++) {
    setTimeout(() => sparkAt(dom.rankUpOverlayEl, 3), i * 30);
  }

  // Auto-cleanup
  const cleanupDelay = newAllTime >= 4000 ? 4500 : 3500;
  setTimeout(() => {
    dom.rankUpOverlayEl.style.display = 'none';
  }, cleanupDelay);
}

// ============================================================================
// CARD MANAGEMENT
// ============================================================================

function setCard(i, value) {
  game.curCards[i] = value;
  const el = dom.cardsEl[i];
  if (!el) return;
  const span = el.querySelector('span');
  if (span) span.textContent = fmt(value);
}

function setRemoved(i, isRemoved) {
  const el = dom.cardsEl[i];
  if (!el) return;
  el.classList.toggle('removed', isRemoved);
  el.setAttribute('aria-hidden', String(isRemoved));
}

function clearSelections() {
  game.selectedIndex = null;
  game.selectedOp = null;
  dom.cardsEl.forEach(el => el.classList.remove('selected'));
  dom.opsEl.forEach(el => el.classList.remove('selected'));
}

// ============================================================================
// GAME LOGIC
// ============================================================================

function resetToBase() {
  game.curCards = game.baseCards.slice();
  game.removed = new Set();
  dom.cardsEl.forEach((el, i) => {
    setCard(i, game.curCards[i]);
    setRemoved(i, false);
  });
  clearSelections();
  if (dom.hintEl) {
    dom.hintEl.textContent = game.currentHint ? 'Hint available' : '';
  }
}

function newPuzzle() {
  const puzzle = generatePuzzle();
  game.baseCards = puzzle.cards.slice();
  game.currentHint = puzzle.expr;
  game.hintUsed = false;
  resetToBase();
}

async function notifySolve() {
  try {
    if (!user.isAuthed) return;
    const res = await fetch('/api/make67/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hint_used: !!game.hintUsed })
    });
    const data = await res.json().catch(() => ({ ok: false }));

    if (data && data.ok && typeof data.all_time_total === 'number') {
      user.allTime = data.all_time_total;
      if (dom.allTimeEl) dom.allTimeEl.textContent = String(user.allTime);
      applyEmpowerment();
      burstCharge();
      loadState();
    }
    loadLeaderboard();
  } catch (e) { /* ignore */ }
}

function playSuccess() {
  if (!dom.overlayRoot) return;
  dom.overlayRoot.classList.remove('hidden');
  dom.overlayRoot.classList.add('visible');
  playSolveSound();
}

function checkEnd() {
  const alive = [];
  for (let i = 0; i < game.curCards.length; i++) {
    if (!game.removed.has(i)) alive.push(i);
  }

  if (alive.length === 1) {
    const val = game.curCards[alive[0]];
    if (Math.abs(val - 67) <= TOL || Math.abs(val + 67) <= TOL) {
      if (!game.hintUsed) {
        game.score += 1;
        if (dom.scoreEl) dom.scoreEl.textContent = String(game.score);
        sparkAt(dom.sessionBoxEl, 5);
        applyEmpowerment();
        notifySolve();
      } else {
        notifySolve();
      }
      playSuccess();
    } else {
      // Wrong answer - shake and reset
      const el = dom.cardsEl[alive[0]];
      if (el) {
        el.classList.add('shake');
        setTimeout(() => {
          el.classList.remove('shake');
          resetToBase();
        }, 700);
      }
    }
    return true;
  }
  return false;
}

function doOperation(i, j, op) {
  const a = game.curCards[i];
  const b = game.curCards[j];
  let r;

  switch (op) {
    case '+': r = a + b; break;
    case '-': r = a - b; break;
    case '*': r = a * b; break;
    case '/':
      if (Math.abs(b) < TOL) {
        // Division by zero - shake
        dom.cardsEl[j]?.classList.add('shake');
        setTimeout(() => dom.cardsEl[j]?.classList.remove('shake'), 400);
        clearSelections();
        return;
      }
      r = a / b;
      break;
    default: return;
  }

  // Animate merge
  game.removed.add(i);
  setRemoved(i, true);
  setCard(j, r);
  clearSelections();

  if (!checkEnd()) {
    // Continue playing
  }
}

// ============================================================================
// SHOP & INVENTORY (Stub - full implementation in separate module)
// ============================================================================

async function loadState() {
  // Simplified state loading
  try {
    const res = await fetch('/api/make67/state');
    const data = await res.json().catch(() => ({ ok: false }));
    if (data && data.ok) {
      shop.inventory = data.inventory || [];
      shop.effects = data.effects || { invisible: 0, boost: 0, mud: 0, shield: 0 };
      shop.lastStateVersion = data.state_version || 0;
    }
  } catch (e) { /* ignore */ }
}

async function loadShop() {
  try {
    const res = await fetch('/api/make67/shop');
    const data = await res.json().catch(() => ({ ok: false }));
    if (data && data.ok) {
      shop.catalog = data.catalog || [];
    }
  } catch (e) { /* ignore */ }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

// Card click handler
dom.cardsEl.forEach((el, i) => {
  el.addEventListener('click', () => {
    if (game.removed.has(i)) return;

    if (game.selectedIndex === null) {
      game.selectedIndex = i;
      el.classList.add('selected');
    } else if (game.selectedIndex === i) {
      clearSelections();
    } else if (game.selectedOp) {
      doOperation(game.selectedIndex, i, game.selectedOp);
    } else {
      // Switch selection
      dom.cardsEl[game.selectedIndex]?.classList.remove('selected');
      game.selectedIndex = i;
      el.classList.add('selected');
    }
  });
});

// Operation button handlers
dom.opsEl.forEach(el => {
  el.addEventListener('click', () => {
    const op = el.dataset.op;
    if (game.selectedOp === op) {
      el.classList.remove('selected');
      game.selectedOp = null;
    } else {
      dom.opsEl.forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      game.selectedOp = op;
    }
  });
});

// Reset button
if (dom.resetBtn) {
  dom.resetBtn.addEventListener('click', resetToBase);
}

// Next puzzle button
if (dom.nextBtn) {
  dom.nextBtn.addEventListener('click', () => {
    if (dom.overlayRoot) {
      dom.overlayRoot.classList.remove('visible');
      dom.overlayRoot.classList.add('hidden');
    }
    newPuzzle();
  });
}

// Hint button
if (dom.hintBtn) {
  dom.hintBtn.addEventListener('click', () => {
    if (game.currentHint && dom.hintEl) {
      game.hintUsed = true;
      dom.hintEl.textContent = game.currentHint;
    }
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize the game
newPuzzle();
initColorTheme();
loadLeaderboard();
loadShop();
loadState();

// Set up periodic state refresh
setInterval(() => {
  if (!document.hidden && user.isAuthed) {
    loadState();
  }
}, 5000);

console.log('Make67 module loaded successfully');
