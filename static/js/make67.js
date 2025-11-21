(function(){
  'use strict';

  const TOL = 1e-6;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  // Utilities for formatting numbers nicely
  function fmt(n){
    if (Number.isInteger(n)) return String(n);
    // round to 4 decimals max
    const r = Math.round(n * 10000) / 10000;
    return String(r);
  }

  // Binary expression tree helpers to build solvable sets by working backward from 67
  class Node {
    constructor(value=null, left=null, right=null, op=null){
      this.value = value; // number if leaf
      this.left = left;
      this.right = right;
      this.op = op; // '+','-','*','/' when internal
    }
  }

  function evalNode(node){
    if (!node) return NaN;
    if (node.op == null) return node.value;
    const a = evalNode(node.left);
    const b = evalNode(node.right);
    switch(node.op){
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b === 0 ? NaN : a / b;
      default: return NaN;
    }
  }

  function collectLeaves(node, arr){
    if (node.op == null) { arr.push(node.value); return; }
    collectLeaves(node.left, arr);
    collectLeaves(node.right, arr);
  }

  function collectSolutionSteps(node, steps){
    // Post-order; returns value and pushes step when combining
    if (node.op == null) return {val: node.value, repr: fmt(node.value)};
    const L = collectSolutionSteps(node.left, steps);
    const R = collectSolutionSteps(node.right, steps);
    const op = node.op;
    let val;
    switch(op){
      case '+': val = L.val + R.val; break;
      case '-': val = L.val - R.val; break;
      case '*': val = L.val * R.val; break;
      case '/': val = R.val === 0 ? NaN : L.val / R.val; break;
      default: val = NaN;
    }
    steps.push({op, a: L.val, b: R.val});
    return {val, repr: `(${L.repr} ${op} ${R.repr})`};
  }

  function randomChoice(arr){ return arr[Math.floor(Math.random() * arr.length)]; }

  function randomInt(a, b){ // inclusive
    return Math.floor(Math.random() * (b - a + 1)) + a;
  }

  function makeSplitForValue(L){
    // Try to create two integers a,b and op such that a op b = L
    // Keep magnitudes reasonable for nicer display.
    const attempts = 200;
    for (let i=0; i<attempts; i++){
      const op = randomChoice(['+','-','*','/','+','-','/']); // lightly prefer +/- and /
      let a, b;
      if (op === '+'){
        // L = a + b
        const span = clamp(Math.abs(L), 5, 60);
        a = randomInt(-span, span);
        b = L - a;
        if (Number.isInteger(a) && Number.isInteger(b) && Math.abs(a) <= 200 && Math.abs(b) <= 200) return {op, a, b};
      } else if (op === '-'){
        // L = a - b => choose b, then a = L + b
        const span = 60;
        b = randomInt(-span, span);
        a = L + b;
        if (Number.isInteger(a) && Number.isInteger(b) && Math.abs(a) <= 200 && Math.abs(b) <= 200) return {op, a, b};
      } else if (op === '*'){
        // L = a * b => need factors
        // Allow 1 as factor; magnitude cap keeps numbers small
        const factors = [];
        const absL = Math.abs(L);
        for (let f=1; f<=Math.min(50, absL); f++){
          if (absL % f === 0){
            factors.push(f);
          }
        }
        if (factors.length){
          const f = randomChoice(factors);
          const sign = (L < 0) ? -1 : 1;
          // randomly assign signs to a,b such that product sign matches L
          if (Math.random() < 0.5){
            a = f * sign; b = (absL / f);
          } else {
            a = (absL / f); b = f * sign;
          }
          if (Math.abs(a) <= 200 && Math.abs(b) <= 200) return {op, a, b};
        }
      } else if (op === '/'){
        // L = a / b => choose small non-zero b, a = L * b
        b = randomChoice([-12,-6,-5,-4,-3,-2,-1,1,2,3,4,5,6,8,10,12]);
        a = L * b;
        if (b !== 0 && Number.isFinite(a) && Math.abs(a) <= 400 && Math.abs(b) <= 200) return {op, a, b};
      }
    }
    return null;
  }

  function generatePuzzle(){
    // Build a binary tree backwards from 67, expanding three times to get 4 leaves
    for (let tries=0; tries<200; tries++){
      let root = new Node(67);
      // Expand 3 times at random leaves
      for (let k=0; k<3; k++){
        // pick a leaf
        const leaves = [];
        function collectLeafNodes(n){
          if (!n) return;
          if (n.op == null) { leaves.push(n); return; }
          collectLeafNodes(n.left); collectLeafNodes(n.right);
        }
        collectLeafNodes(root);
        const leaf = randomChoice(leaves);
        const L = leaf.value;
        const split = makeSplitForValue(L);
        if (!split) { root = null; break; }
        leaf.op = split.op;
        leaf.left = new Node(split.a);
        leaf.right = new Node(split.b);
        leaf.value = null;
      }
      if (!root) continue;
      // Validate: evaluate equals 67 and leaves count = 4 and numbers are reasonable
      const val = evalNode(root);
      const leavesVals = [];
      collectLeaves(root, leavesVals);
      if (!Number.isFinite(val) || Math.abs(val - 67) > TOL) continue;
      if (leavesVals.length !== 4) continue;
      // Avoid trivially huge values
      if (leavesVals.some(v => !Number.isFinite(v) || Math.abs(v) > 500)) continue;
      // Avoid all same numbers
      const uniq = new Set(leavesVals.map(v => fmt(v)));
      if (uniq.size < 2) continue;
      // Build a hint sequence
      const steps = [];
      const solved = collectSolutionSteps(root, steps);
      if (!Number.isFinite(solved.val) || Math.abs(solved.val - 67) > TOL) continue;
      return {cards: leavesVals, steps, expr: solved.repr};
    }
    // Fallback simple puzzle
    return {cards: [60, 7, 3, 1], steps: [], expr: ''};
  }

  // --- UI Logic ---
  const cardsEl = Array.from(document.querySelectorAll('.make67-page .card'));
  const opsEl = Array.from(document.querySelectorAll('.make67-page .op-btn[data-op]'));
  const resetBtn = document.getElementById('resetBtn');
  const hintEl = document.getElementById('m67Hint');
  const scoreEl = document.getElementById('m67Score');
  const allTimeEl = document.getElementById('m67AllTime');
  const overlayRoot = document.querySelector('.m67-overlay-root');
  const nextBtn = document.getElementById('nextPuzzleBtn');
  const hintBtn = document.getElementById('hintBtn');
  const lbList = document.getElementById('m67Leaderboard');
  const allTimeBoxEl = allTimeEl ? allTimeEl.closest('.score-box') : null;

  let baseCards = [];
  let curCards = [];
  let removed = new Set();
  let selectedIndex = null;
  let selectedOp = null;
  let score = 0;
  let currentHint = '';
  let allTime = null;
  let isAuthed = false;
  let hintUsed = false;

  function renderLeaderboard(list){
    if (!lbList) return;
    lbList.innerHTML = '';
    if (!Array.isArray(list) || list.length === 0){
      const li = document.createElement('li');
      li.className = 'm67-lb-empty';
      li.textContent = 'No scores yet';
      lbList.appendChild(li);
      return;
    }
    list.forEach((item, idx)=>{
      const li = document.createElement('li');
      li.className = 'm67-lb-item';
      const rk = (item && item.rank_key) ? String(item.rank_key) : 'noob';
      li.classList.add(`rank-${rk}`);
      if (idx === 0) li.classList.add('top1');
      const rank = document.createElement('span');
      rank.className = 'rank';
      rank.textContent = String(idx + 1);
      const name = document.createElement('span');
      name.className = 'name';
      // Build: (icon) name - title
      const icon = document.createElement('span');
      icon.className = 'rank-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = item.rank_icon || '•';
      const title = document.createElement('span');
      title.className = 'rank-title';
      title.textContent = item.rank_title || '';
      const playerName = document.createTextNode(` ${item.name || 'Player'} - `);
      name.append(icon, playerName, title);
      const total = document.createElement('span');
      total.className = 'total';
      total.textContent = String(item.total ?? 0);

      // If this is the #1 leader, prepend a decorative golden star next to their name
      if (idx === 0) {
        const star = document.createElement('span');
        star.className = 'top1-star';
        star.setAttribute('aria-hidden', 'true');
        star.title = 'All-time #1';
        star.textContent = '★';
        name.prepend(star);
        li.title = 'All-time #1 leader';
      }

      li.append(rank, name, total);
      lbList.appendChild(li);
    });
  }

  async function loadLeaderboard(){
    try {
      const res = await fetch('/api/make67/leaderboard');
      const data = await res.json().catch(()=>({ok:false}));
      if (data && data.ok){
        renderLeaderboard(data.top || []);
        if (data.me){
          isAuthed = true;
          allTime = Number(data.me.total || 0);
          if (allTimeEl) allTimeEl.textContent = String(allTime);
          if (allTimeBoxEl) allTimeBoxEl.style.removeProperty('display');
        } else {
          isAuthed = false;
          allTime = null;
          if (allTimeEl) allTimeEl.textContent = '—';
          if (allTimeBoxEl) allTimeBoxEl.style.display = 'none';
        }
      }
    } catch (e) {
      // ignore network errors
    }
  }

  function setCard(i, value){
    curCards[i] = value;
    const el = cardsEl[i];
    const span = el.querySelector('span');
    span.textContent = fmt(value);
  }

  function setRemoved(i, isRemoved){
    const el = cardsEl[i];
    if (isRemoved){
      el.classList.add('removed');
      el.setAttribute('aria-disabled', 'true');
    } else {
      el.classList.remove('removed');
      el.removeAttribute('aria-disabled');
    }
  }

  function clearSelections(){
    cardsEl.forEach(el => el.classList.remove('selected'));
    opsEl.forEach(el => el.classList.remove('active'));
    selectedIndex = null;
    selectedOp = null;
  }

  function animateMerge(fromIdx, toIdx, onDone){
    const fromEl = cardsEl[fromIdx];
    const toEl = cardsEl[toIdx];
    if (!fromEl || !toEl) { onDone && onDone(); return; }
    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();
    const ghost = fromEl.cloneNode(true);
    ghost.classList.add('ghost-card');
    const dx = toRect.left - fromRect.left;
    const dy = toRect.top - fromRect.top;
    ghost.style.setProperty('--dx', dx + 'px');
    ghost.style.setProperty('--dy', dy + 'px');
    document.body.appendChild(ghost);
    const r = fromRect;
    ghost.style.position = 'fixed';
    ghost.style.left = r.left + 'px';
    ghost.style.top = r.top + 'px';
    ghost.style.width = r.width + 'px';
    ghost.style.height = r.height + 'px';
    ghost.addEventListener('animationend', ()=>{
      ghost.remove();
      onDone && onDone();
    }, {once:true});
    ghost.classList.add('fly-merge');
  }

  function playSuccess(){
    overlayRoot.hidden = false;
    // quick celebratory flop on remaining card
    const aliveIdx = curCards.findIndex((_, i) => !removed.has(i));
    if (aliveIdx >= 0){
      cardsEl[aliveIdx].classList.add('win-pop');
      setTimeout(()=>cardsEl[aliveIdx].classList.remove('win-pop'), 1200);
    }
  }

  function resetToBase(){
    curCards = baseCards.slice();
    removed = new Set();
    cardsEl.forEach((el,i)=>{
      setCard(i, curCards[i]);
      setRemoved(i, false);
    });
    clearSelections();
    hintEl.textContent = currentHint ? `Hint available` : '';
  }

  function newPuzzle(){
    const puzzle = generatePuzzle();
    baseCards = puzzle.cards.slice();
    currentHint = puzzle.expr;
    hintUsed = false;
    resetToBase();
  }

  async function notifySolve(){
    try {
      if (!isAuthed) return;
      const res = await fetch('/api/make67/solve', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ hint_used: !!hintUsed })
      });
      const data = await res.json().catch(()=>({ok:false}));
      if (data && data.ok && typeof data.all_time_total === 'number'){
        allTime = data.all_time_total;
        if (allTimeEl) allTimeEl.textContent = String(allTime);
      }
      // Refresh leaderboard after a solve (skipped or counted)
      loadLeaderboard();
    } catch (e) { /* ignore */ }
  }

  function checkEnd(){
    const alive = [];
    for (let i=0;i<curCards.length;i++) if (!removed.has(i)) alive.push(i);
    if (alive.length === 1){
      const val = curCards[alive[0]];
      if (Math.abs(val - 67) <= TOL){
        if (!hintUsed) {
          score += 1;
          scoreEl.textContent = String(score);
          notifySolve();
        } else {
          // Still celebrate, but do not count toward session or all-time
          notifySolve();
        }
        playSuccess();
      } else {
        // brief shake then reset
        cardsEl[alive[0]].classList.add('shake');
        setTimeout(()=>{
          cardsEl[alive[0]].classList.remove('shake');
          resetToBase();
        }, 700);
      }
      return true;
    }
    return false;
  }

  function doOperation(i, j, op){
    const a = curCards[i];
    const b = curCards[j];
    let r;
    switch(op){
      case '+': r = a + b; break;
      case '-': r = a - b; break;
      case '*': r = a * b; break;
      case '/': r = (b === 0) ? NaN : a / b; break;
      default: r = NaN;
    }
    if (!Number.isFinite(r)){
      // invalid, flash
      cardsEl[j].classList.add('deny');
      setTimeout(()=>cardsEl[j].classList.remove('deny'), 350);
      return;
    }
    animateMerge(i, j, ()=>{
      setCard(j, r);
      setRemoved(i, true);
      removed.add(i);
      cardsEl[j].classList.add('merge-pop');
      setTimeout(()=>cardsEl[j].classList.remove('merge-pop'), 500);
      if (!checkEnd()){
        // prepare next selection using the result card
        clearSelections();
        selectedIndex = j;
        cardsEl[j].classList.add('selected');
      }
    });
  }

  // Event wiring
  cardsEl.forEach((el, idx)=>{
    el.addEventListener('click', ()=>{
      if (removed.has(idx)) return;
      if (selectedIndex == null){
        selectedIndex = idx;
        cardsEl.forEach(e=>e.classList.remove('selected'));
        el.classList.add('selected');
      } else if (selectedOp){
        if (idx === selectedIndex) return;
        const i = selectedIndex;
        const j = idx;
        const op = selectedOp;
        clearSelections();
        doOperation(i, j, op);
      } else {
        // switch selection to this card
        cardsEl.forEach(e=>e.classList.remove('selected'));
        selectedIndex = idx;
        el.classList.add('selected');
      }
    });
  });

  opsEl.forEach(el=>{
    el.addEventListener('click', ()=>{
      if (selectedIndex == null){
        // pulse hint
        el.classList.add('deny');
        setTimeout(()=>el.classList.remove('deny'), 300);
        return;
      }
      opsEl.forEach(o=>o.classList.remove('active'));
      el.classList.add('active');
      selectedOp = el.dataset.op;
    });
  });

  resetBtn.addEventListener('click', ()=>{
    resetToBase();
  });

  nextBtn.addEventListener('click', ()=>{
    overlayRoot.hidden = true;
    newPuzzle();
  });

  // Reveal hint on long-press/tap on note area, and via explicit Hint button
  let hintTimer = null;
  function showHint(){
    if (currentHint){
      hintUsed = true;
      hintEl.textContent = `One way: ${currentHint} = 67`;
    }
  }
  // Explicit button click support
  if (hintBtn) {
    hintBtn.addEventListener('click', showHint);
  }
  // Long-press on the note area still works
  hintEl.addEventListener('mousedown', ()=>{ hintTimer = setTimeout(showHint, 700); });
  hintEl.addEventListener('touchstart', ()=>{ hintTimer = setTimeout(showHint, 700); });
  ['mouseup','mouseleave','touchend','touchcancel'].forEach(ev=>{
    hintEl.addEventListener(ev, ()=>{ if (hintTimer){ clearTimeout(hintTimer); hintTimer=null; }});
  });

  // Initialize
  loadLeaderboard();
  newPuzzle();
})();

// --- Make67 Live Chat (SSE) ---
(function initMake67Chat(){
  const logEl = document.getElementById('m67ChatLog');
  const formEl = document.getElementById('m67ChatForm');
  const inputEl = document.getElementById('m67ChatInput');
  if (!logEl || !formEl || !inputEl) return; // Chat not rendered for ineligible users

  function appendMessage(m){
    if (!m || m.type !== 'message') return;
    const row = document.createElement('div');
    row.className = 'm67-chat-row';
    const user = document.createElement('span');
    user.className = 'm67-chat-user';
    user.textContent = (m.user || 'User') + ': ';
    const text = document.createElement('span');
    text.className = 'm67-chat-text';
    text.textContent = m.text || '';
    row.appendChild(user);
    row.appendChild(text);
    logEl.appendChild(row);
    // Keep last ~500 messages max in DOM (safety)
    if (logEl.childElementCount > 500){
      logEl.removeChild(logEl.firstElementChild);
    }
    logEl.scrollTop = logEl.scrollHeight;
  }

  // Stream via SSE
  let es;
  try {
    es = new EventSource('/api/make67/chat/stream');
    es.onmessage = (evt) => {
      try {
        const m = JSON.parse(evt.data);
        appendMessage(m);
      } catch (_) { /* ignore */ }
    };
    es.onerror = () => {
      // Connection issue; browser will auto-retry SSE
    };
  } catch (_) {
    // SSE unsupported; silently no-op
  }

  // Send via POST
  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = (inputEl.value || '').trim();
    if (!text) return;
    inputEl.value = '';
    try {
      const res = await fetch('/api/make67/chat/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (!res.ok){
        // Optionally show a soft warning in the UI
      }
    } catch (_) {
      // Ignore network errors silently
    }
  });
})();
