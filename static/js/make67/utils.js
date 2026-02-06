/**
 * make67/utils.js - Pure utility functions
 */

export const TOL = 1e-6;

export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

export function fmt(n) {
  if (Number.isInteger(n)) return String(n);
  const r = Math.round(n * 10000) / 10000;
  return String(r);
}

export function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomInt(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

export function fmtTime(sec) {
  if (sec <= 0) return '0s';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
