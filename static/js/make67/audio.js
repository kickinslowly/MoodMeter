/**
 * make67/audio.js - Sound system constants and helpers
 */

import { randomChoice } from './utils.js';

// Sound options with unlock thresholds
export const SOUND_OPTIONS = [
  { id: 'snd_brainrot', label: 'Brainrot', threshold: 0 },
  { id: 'snd_meme', label: 'Meme', threshold: 200 },
  { id: 'snd_lol', label: 'Lol', threshold: 400 },
  { id: 'snd_hehe', label: 'Hehe', threshold: 600 },
  { id: 'snd_ah', label: 'Ah', threshold: 800 },
  { id: 'snd_reload', label: 'Reload', threshold: 1000 },
  { id: 'snd_cry', label: 'Cry', threshold: 1200 },
  { id: 'snd_enemy', label: 'Enemy', threshold: 1400 },
  { id: 'snd_huh', label: 'Huh', threshold: 1600 },
  { id: 'snd_minecraft', label: 'Minecraft', threshold: 1800 },
  { id: 'snd_yes', label: 'Yes', threshold: 2000 },
  { id: 'snd_ahhaha', label: 'Ahhaha', threshold: 2200 },
  { id: 'snd_amongus', label: 'Among Us', threshold: 2400 },
  { id: 'snd_bad', label: 'Bad', threshold: 2600 },
  { id: 'snd_duck', label: 'Duck', threshold: 2800 },
  { id: 'snd_hello', label: 'Hello', threshold: 3000 },
  { id: 'snd_punch', label: 'Punch', threshold: 3200 },
  { id: 'snd_rizzbot', label: 'Rizzbot', threshold: 3400 },
  { id: 'snd_watdadogdoin', label: 'Wat Da Dog Doin', threshold: 3600 },
  { id: 'snd_youwhat', label: 'You What', threshold: 3800 }
];

// Level up sounds for random selection
export const LEVELUP_SOUNDS = [
  'snd_levelup_brainrot',
  'snd_levelup_coffin',
  'snd_levelup_funnysong',
  'snd_levelup_ruletheworld',
  'snd_levelup_thai',
  'snd_levelup_xenogenesis'
];

// All sound IDs for audio unlock
export const ALL_SOUND_IDS = [
  'snd_brainrot', 'snd_meme', 'snd_lol', 'snd_hehe', 'snd_ah', 'snd_reload',
  'snd_cry', 'snd_enemy', 'snd_huh', 'snd_minecraft', 'snd_yes',
  'snd_ahhaha', 'snd_amongus', 'snd_bad', 'snd_duck', 'snd_hello',
  'snd_punch', 'snd_rizzbot', 'snd_watdadogdoin', 'snd_youwhat',
  'snd_shop_open', 'snd_shop_coins', 'snd_item_mud', 'snd_item_boost',
  'snd_item_dust', 'snd_item_shield',
  ...LEVELUP_SOUNDS
];

// Mobile-optimized sound list
export const MOBILE_SOUND_IDS = [
  'snd_brainrot', 'snd_levelup_brainrot', 'snd_levelup_coffin', 'snd_shop_open'
];

/**
 * Get the sound threshold based on total solves
 */
export function getSoundThreshold(total) {
  const thresholds = [3800, 3600, 3400, 3200, 3000, 2800, 2600, 2400, 2200, 2000, 1800, 1600, 1400, 1200, 1000, 800, 600, 400, 200, 0];
  for (const t of thresholds) {
    if (total > t) return t;
  }
  return 0;
}

/**
 * Get the default sound ID for a given total
 */
export function getDefaultSoundId(total) {
  const soundMap = [
    [3800, 'snd_youwhat'],
    [3600, 'snd_watdadogdoin'],
    [3400, 'snd_rizzbot'],
    [3200, 'snd_punch'],
    [3000, 'snd_hello'],
    [2800, 'snd_duck'],
    [2600, 'snd_bad'],
    [2400, 'snd_amongus'],
    [2200, 'snd_ahhaha'],
    [2000, 'snd_yes'],
    [1800, 'snd_minecraft'],
    [1600, 'snd_huh'],
    [1400, 'snd_enemy'],
    [1200, 'snd_cry'],
    [1000, 'snd_reload'],
    [800, 'snd_ah'],
    [600, 'snd_hehe'],
    [400, 'snd_lol'],
    [200, 'snd_meme'],
  ];
  for (const [threshold, id] of soundMap) {
    if (total > threshold) return id;
  }
  return 'snd_brainrot';
}

/**
 * Check if a sound is unlocked
 */
export function isSoundUnlocked(id, currentThreshold) {
  const opt = SOUND_OPTIONS.find(o => o.id === id);
  if (!opt) return false;
  return currentThreshold >= opt.threshold;
}

/**
 * Play an audio element by ID
 */
export function playSfx(id) {
  const el = document.getElementById(id);
  if (!el) return;
  try { el.pause(); } catch (_) {}
  try { el.currentTime = 0; } catch (_) {}
  try {
    const p = el.play();
    if (p && typeof p.then === 'function') p.catch(() => {});
  } catch (_) {}
}

/**
 * Play a random level-up sound
 */
export function playRandomLevelUpSound() {
  playSfx(randomChoice(LEVELUP_SOUNDS));
}

/**
 * Setup audio unlock on first user interaction (required for mobile)
 */
export function setupAudioUnlock() {
  let unlocked = false;

  function unlock() {
    if (unlocked) return;
    unlocked = true;

    const ids = window.innerWidth < 820 ? MOBILE_SOUND_IDS : ALL_SOUND_IDS;

    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      try {
        el.muted = true;
        const p = el.play();
        if (p && typeof p.then === 'function') {
          p.then(() => {
            try { el.pause(); el.currentTime = 0; } catch (_) {}
            el.muted = false;
          }).catch(() => { el.muted = false; });
        } else {
          try { el.pause(); el.currentTime = 0; } catch (_) {}
          el.muted = false;
        }
      } catch (_) {
        try { el.muted = false; } catch (__) {}
      }
    });
  }

  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true });
}

/**
 * Get/set preferred sound from localStorage
 */
export function getPreferredSound(userId) {
  const key = 'm67_pref_sound:' + (userId || 'anon');
  try { return window.localStorage.getItem(key) || ''; } catch (_) { return ''; }
}

export function setPreferredSound(userId, id) {
  const key = 'm67_pref_sound:' + (userId || 'anon');
  try { window.localStorage.setItem(key, String(id || '')); } catch (_) {}
}
