/**
 * make67/theme.js - Color theme system
 */

import { clamp01 } from './utils.js';

// Color theme options with unlock thresholds
export const COLOR_THEME_OPTIONS = [
  { id: 'neon-lime', label: 'Neon Lime', threshold: 1500, icon: '🟢' },
  { id: 'electric-blue', label: 'Electric Blue', threshold: 2000, icon: '🔵' },
  { id: 'hot-pink', label: 'Hot Pink', threshold: 2500, icon: '💗' },
  { id: 'gold-rush', label: 'Gold Rush', threshold: 3000, icon: '🟡' },
  { id: 'crimson-fire', label: 'Crimson Fire', threshold: 3500, icon: '🔴' },
  { id: 'prismatic', label: 'Prismatic', threshold: 4000, icon: '🌈' },
  { id: 'ohio-corn', label: 'Ohio Corn', threshold: 4500, icon: '🌽' },
  { id: 'void-aura', label: 'Void Aura', threshold: 5000, icon: '🕳️' },
  { id: 'god-mode', label: 'God Mode', threshold: 5500, icon: '👁️' }
];

/**
 * Pick rank-based theme class based on total solves
 */
export function pickTheme(total) {
  const t = Number(total) || 0;
  if (t >= 1000) return 'theme-elite';
  if (t >= 700) return 'theme-darkking';
  if (t >= 400) return 'theme-mystic';
  if (t >= 200) return 'theme-tycoon';
  if (t >= 50) return 'theme-hero';
  return '';
}

/**
 * Calculate empowerment value (0-1) for visual effects scaling
 */
export function calculateEmpowerment(total) {
  // 0-1000 = 0-0.5, 1000-5500 = 0.5-1.0
  if (total <= 1000) {
    return clamp01(total / 2000);
  }
  return clamp01(0.5 + (total - 1000) / 9000);
}

/**
 * Get the highest unlocked theme threshold
 */
export function getHighestUnlockedThreshold(total) {
  let highest = 0;
  for (const opt of COLOR_THEME_OPTIONS) {
    if (total >= opt.threshold && opt.threshold > highest) {
      highest = opt.threshold;
    }
  }
  return highest;
}

/**
 * Check if a theme is unlocked
 */
export function isThemeUnlocked(themeId, total) {
  const opt = COLOR_THEME_OPTIONS.find(o => o.id === themeId);
  if (!opt) return false;
  return total >= opt.threshold;
}

/**
 * Get/set preferred color theme from localStorage
 */
export function getPreferredTheme(userId) {
  const key = 'm67_pref_theme:' + (userId || 'anon');
  try { return window.localStorage.getItem(key) || ''; } catch (_) { return ''; }
}

export function setPreferredTheme(userId, id) {
  const key = 'm67_pref_theme:' + (userId || 'anon');
  try { window.localStorage.setItem(key, String(id || '')); } catch (_) {}
}

/**
 * Apply color theme to page element
 */
export function applyColorTheme(pageRoot, themeId) {
  if (!pageRoot) return;
  if (themeId) {
    pageRoot.setAttribute('data-color-theme', themeId);
  } else {
    pageRoot.removeAttribute('data-color-theme');
  }
}

/**
 * Apply empowerment CSS variable
 */
export function applyEmpowermentCSS(pageRoot, empValue) {
  if (!pageRoot) return;
  pageRoot.style.setProperty('--emp', empValue.toFixed(3));
}
