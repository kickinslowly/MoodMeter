/**
 * make67/puzzle.js - Puzzle generation using expression trees
 */

import { TOL, fmt, clamp, randomChoice, randomInt } from './utils.js';

/**
 * Binary expression tree node
 */
class Node {
  constructor(value = null, left = null, right = null, op = null) {
    this.value = value;
    this.left = left;
    this.right = right;
    this.op = op;
  }
}

function evalNode(node) {
  if (!node) return NaN;
  if (node.op == null) return node.value;
  const a = evalNode(node.left);
  const b = evalNode(node.right);
  switch (node.op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return b === 0 ? NaN : a / b;
    default: return NaN;
  }
}

function collectLeaves(node, arr) {
  if (node.op == null) {
    arr.push(node.value);
    return;
  }
  collectLeaves(node.left, arr);
  collectLeaves(node.right, arr);
}

function collectSolutionSteps(node, steps) {
  if (node.op == null) return { val: node.value, repr: fmt(node.value) };
  const L = collectSolutionSteps(node.left, steps);
  const R = collectSolutionSteps(node.right, steps);
  const op = node.op;
  let val;
  switch (op) {
    case '+': val = L.val + R.val; break;
    case '-': val = L.val - R.val; break;
    case '*': val = L.val * R.val; break;
    case '/': val = R.val === 0 ? NaN : L.val / R.val; break;
    default: val = NaN;
  }
  steps.push({ op, a: L.val, b: R.val });
  return { val, repr: `(${L.repr} ${op} ${R.repr})` };
}

function makeSplitForValue(L) {
  const attempts = 200;
  for (let i = 0; i < attempts; i++) {
    const op = randomChoice(['+', '-', '*', '/', '+', '-', '/']);
    let a, b;

    if (op === '+') {
      const span = clamp(Math.abs(L), 5, 60);
      a = randomInt(-span, span);
      b = L - a;
      if (Number.isInteger(a) && Number.isInteger(b) && Math.abs(a) <= 200 && Math.abs(b) <= 200) {
        return { op, a, b };
      }
    } else if (op === '-') {
      const span = 60;
      b = randomInt(-span, span);
      a = L + b;
      if (Number.isInteger(a) && Number.isInteger(b) && Math.abs(a) <= 200 && Math.abs(b) <= 200) {
        return { op, a, b };
      }
    } else if (op === '*') {
      const factors = [];
      const absL = Math.abs(L);
      for (let f = 1; f <= Math.min(50, absL); f++) {
        if (absL % f === 0) factors.push(f);
      }
      if (factors.length) {
        const f = randomChoice(factors);
        const sign = (L < 0) ? -1 : 1;
        if (Math.random() < 0.5) {
          a = f * sign;
          b = (absL / f);
        } else {
          a = (absL / f);
          b = f * sign;
        }
        if (Math.abs(a) <= 200 && Math.abs(b) <= 200) return { op, a, b };
      }
    } else if (op === '/') {
      b = randomChoice([-12, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 8, 10, 12]);
      a = L * b;
      if (b !== 0 && Number.isFinite(a) && Math.abs(a) <= 400 && Math.abs(b) <= 200) {
        return { op, a, b };
      }
    }
  }
  return null;
}

/**
 * Generate a new puzzle that evaluates to 67
 * @returns {{ cards: number[], steps: Array, expr: string }}
 */
export function generatePuzzle() {
  for (let tries = 0; tries < 200; tries++) {
    let root = new Node(67);

    // Expand 3 times at random leaves to get 4 cards
    for (let k = 0; k < 3; k++) {
      const leaves = [];
      function collectLeafNodes(n) {
        if (!n) return;
        if (n.op == null) {
          leaves.push(n);
          return;
        }
        collectLeafNodes(n.left);
        collectLeafNodes(n.right);
      }
      collectLeafNodes(root);

      const leaf = randomChoice(leaves);
      const L = leaf.value;
      const split = makeSplitForValue(L);
      if (!split) {
        root = null;
        break;
      }
      leaf.op = split.op;
      leaf.left = new Node(split.a);
      leaf.right = new Node(split.b);
      leaf.value = null;
    }

    if (!root) continue;

    // Validate
    const val = evalNode(root);
    const leavesVals = [];
    collectLeaves(root, leavesVals);

    if (!Number.isFinite(val) || Math.abs(val - 67) > TOL) continue;
    if (leavesVals.length !== 4) continue;
    if (leavesVals.some(v => !Number.isFinite(v) || Math.abs(v) > 500)) continue;

    const uniq = new Set(leavesVals.map(v => fmt(v)));
    if (uniq.size < 2) continue;

    // Build hint sequence
    const steps = [];
    const solved = collectSolutionSteps(root, steps);
    if (!Number.isFinite(solved.val) || Math.abs(solved.val - 67) > TOL) continue;

    return { cards: leavesVals, steps, expr: solved.repr };
  }

  // Fallback
  return { cards: [60, 7, 3, 1], steps: [], expr: '' };
}
