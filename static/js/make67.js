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
  const sessionBoxEl = scoreEl ? scoreEl.closest('.score-box') : null;
  const pageRoot = document.querySelector('.page.make67-page');
  const bannedBtn = document.getElementById('m67BannedBtn');
  const bannedRoot = document.querySelector('.m67-ban-root');
  const bannedListEl = document.getElementById('m67BannedList');
  // Inventory/Shop modal controls
  const invBtn = document.getElementById('m67InvBtn');
  const shopBtn = document.getElementById('m67ShopBtn');
  const invModalRoot = document.querySelector('.m67-inv-root');
  const shopModalRoot = document.querySelector('.m67-shop-root');
  let bannedCache = [];

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

  // --- Empowerment & Theme Logic ---
  function clamp01(x){ return Math.max(0, Math.min(1, x)); }
  let currentEmp = 0; // cached empowerment [0..1] for FX scaling

  function pickTheme(totalLike){
    // Map total solves to theme per brief
    const t = Number(totalLike) || 0;
    if (t >= 1000) return 'theme-elite';       // Black + Gold
    if (t >= 700)  return 'theme-darkking';    // Crimson + Obsidian
    if (t >= 400)  return 'theme-mystic';      // Deep Purple + Electric Cyan
    if (t >= 200)  return 'theme-tycoon';      // Emerald + Gold
    if (t >= 50)   return 'theme-hero';        // Royal Blue + Platinum
    return '';
  }

  function currentTotalLike(){
    // Prefer all-time; fallback to a scaled session score estimate
    if (typeof allTime === 'number') return allTime;
    return (score || 0) * 5; // each session solve approximates 5 total for feel
  }

  function applyEmpowerment(){
    if (!pageRoot) return;
    const totalLike = currentTotalLike();
    const emp = clamp01(totalLike / 1000);
    currentEmp = emp;
    // Remove existing theme classes
    pageRoot.classList.remove('theme-elite','theme-mystic','theme-darkking','theme-hero','theme-tycoon');
    const theme = pickTheme(totalLike);
    if (theme) pageRoot.classList.add(theme);
    pageRoot.style.setProperty('--emp', String(emp));

    // Update charge bar on all-time score box
    if (allTimeBoxEl){
      allTimeBoxEl.classList.add('charged');
      allTimeBoxEl.style.setProperty('--charge', String(emp));
    }
    // Sync overlay accent with active theme accent
    const panel = document.querySelector('.m67-overlay__panel');
    if (panel){
      const cs = getComputedStyle(pageRoot);
      const accent = cs.getPropertyValue('--accent') || '#9fe3b5';
      panel.style.setProperty('--accent', accent.trim());
    }
  }

  function burstCharge(){
    if (!allTimeBoxEl) return;
    allTimeBoxEl.classList.remove('charge-burst');
    // force reflow to restart animation
    void allTimeBoxEl.offsetWidth;
    allTimeBoxEl.classList.add('charge-burst');
  }

  // --- Solve Sound Logic ---
  function predictedTotalForSound(){
    // Estimate the total solves at the moment of celebration.
    // If this solve counts (authed + no hint), consider +1 as the server will increment.
    let t = (typeof allTime === 'number') ? allTime : 0;
    if (isAuthed && !hintUsed) t += 1;
    return t;
  }

  function pickSolveSoundElement(){
    const t = predictedTotalForSound();
    const id = (t > 1000)
      ? 'snd_reload'
      : (t > 800)
        ? 'snd_ah'
        : (t > 600)
          ? 'snd_hehe'
          : (t > 400)
            ? 'snd_lol'
            : (t > 200)
              ? 'snd_meme'
              : 'snd_brainrot';
    return document.getElementById(id);
  }

  function playSolveSound(){
    const el = pickSolveSoundElement();
    if (!el) return;
    try { el.pause(); } catch(_){}
    try { el.currentTime = 0; } catch(_){}
    try {
      const p = el.play();
      if (p && typeof p.then === 'function') p.catch(()=>{});
    } catch(_){}
  }

  // --- Generic SFX helper ---
  function playSfx(id){
    const el = document.getElementById(id);
    if (!el) return;
    try { el.pause(); } catch(_){}
    try { el.currentTime = 0; } catch(_){}
    try {
      const p = el.play();
      if (p && typeof p.then === 'function') p.catch(()=>{});
    } catch(_){ }
  }

  // On first user interaction, try to unlock audio playback on mobile browsers
  (function setupAudioUnlock(){
    let unlocked = false;
    function unlock(){
      if (unlocked) return; unlocked = true;
      const ids = [
        'snd_brainrot','snd_meme','snd_lol','snd_hehe','snd_ah','snd_reload',
        'snd_shop_open','snd_shop_coins','snd_item_mud','snd_item_boost'
      ];
      ids.forEach(id=>{
        const el = document.getElementById(id);
        if (!el) return;
        try {
          el.muted = true;
          const p = el.play();
          if (p && typeof p.then === 'function'){
            p.then(()=>{ try{ el.pause(); el.currentTime = 0; }catch(_){} el.muted = false; })
             .catch(()=>{ el.muted = false; });
          } else {
            try{ el.pause(); el.currentTime = 0; }catch(_){}
            el.muted = false;
          }
        } catch(_){ try{ el.muted = false; }catch(__){} }
      });
    }
    window.addEventListener('pointerdown', unlock, {once:true, passive:true});
    window.addEventListener('keydown', unlock, {once:true});
  })();

  function sparkAt(el, count){
    if (!el) return;
    const base = (typeof count === 'number') ? count : 6;
    const n = Math.round(Math.max(3, Math.min(16, base + 6 * currentEmp)));
    for (let i=0;i<n;i++){
      const s = document.createElement('span');
      s.className = 'spark';
      const ang = Math.random() * Math.PI * 2;
      const dist = 24 + Math.random()*(28 + 36 * currentEmp);
      s.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      s.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
      el.appendChild(s);
      s.addEventListener('animationend', ()=> s.remove(), {once:true});
    }
  }

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
      if (item && item.id) li.dataset.userId = String(item.id);
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

      // Mud indicator
      if (item && item.is_mudded){
        const mud = document.createElement('span');
        mud.className = 'mud-ind';
        mud.title = 'Mudded';
        mud.textContent = '💩';
        name.append(' ', mud);
      }

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

  function renderBanned(list){
    if (!bannedListEl) return;
    bannedListEl.innerHTML = '';
    if (!Array.isArray(list) || list.length === 0){
      const li = document.createElement('li');
      li.className = 'm67-lb-empty';
      li.textContent = 'No banned users.';
      bannedListEl.appendChild(li);
      return;
    }
    list.forEach((item, idx)=>{
      const li = document.createElement('li');
      li.className = 'm67-lb-item rank-cheater';
      const rank = document.createElement('span');
      rank.className = 'rank';
      rank.textContent = String(idx + 1);
      const name = document.createElement('span');
      name.className = 'name';
      const icon = document.createElement('span');
      icon.className = 'rank-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = (item && item.rank_icon) ? String(item.rank_icon) : '🚫';
      const title = document.createElement('span');
      title.className = 'rank-title';
      title.textContent = 'BANNED';
      const playerName = document.createTextNode(` ${item?.name || 'User'} - `);
      name.append(icon, playerName, title);
      const total = document.createElement('span');
      total.className = 'total';
      total.textContent = String(item?.total ?? 0);
      li.append(rank, name, total);
      bannedListEl.appendChild(li);
    });
  }

  async function loadLeaderboard(){
    try {
      const res = await fetch('/api/make67/leaderboard');
      const data = await res.json().catch(()=>({ok:false}));
      if (data && data.ok){
        renderLeaderboard(data.top || []);
        bannedCache = Array.isArray(data.banned) ? data.banned : [];
        if (data.me){
          isAuthed = true;
          allTime = Number(data.me.total || 0);
          if (allTimeEl) allTimeEl.textContent = String(allTime);
          if (allTimeBoxEl) allTimeBoxEl.style.removeProperty('display');
          applyEmpowerment();
          // Update effects note
          updateEffectsSummary({
            invisible: Number(data.me.invisible_ends_in||0),
            boost: Number(data.me.boost_ends_in||0),
            mud: Number(data.me.mud_ends_in||0)
          });
          // Load full state (inventory etc.) when authenticated
          loadState();
        } else {
          isAuthed = false;
          allTime = null;
          if (allTimeEl) allTimeEl.textContent = '—';
          if (allTimeBoxEl) allTimeBoxEl.style.display = 'none';
          applyEmpowerment();
        }
      }
    } catch (e) {
      // ignore network errors
    }
  }

  function openBanned(){
    if (!bannedRoot) return;
    renderBanned(bannedCache);
    bannedRoot.hidden = false;
  }
  function closeBanned(){ if (bannedRoot) bannedRoot.hidden = true; }

  if (bannedBtn){
    bannedBtn.addEventListener('click', openBanned);
  }
  if (bannedRoot){
    bannedRoot.addEventListener('click', (e)=>{
      const t = e.target;
      if (t && t.getAttribute && t.getAttribute('data-close')==='1') closeBanned();
    });
    document.addEventListener('keydown', (e)=>{
      if (!bannedRoot.hidden && e.key === 'Escape') closeBanned();
    });
  }

  // Inventory modal handlers
  function openInventory(){
    if (!invModalRoot) return;
    invModalRoot.hidden = false;
    // Refresh state/effects when opened
    setTimeout(()=>{ loadState(); }, 0);
  }
  function closeInventory(){ if (invModalRoot) invModalRoot.hidden = true; }
  function toggleInventory(){
    if (!invModalRoot) return;
    if (invModalRoot.hidden) openInventory(); else closeInventory();
  }
  if (invBtn){ invBtn.addEventListener('click', toggleInventory); }
  if (invModalRoot){
    invModalRoot.addEventListener('click', (e)=>{
      const t = e.target;
      if (t && t.getAttribute && t.getAttribute('data-close')==='1') closeInventory();
    });
  }

  // Shop modal handlers
  function openShop(){
    if (!shopModalRoot) return;
    shopModalRoot.hidden = false;
    // Play shop open sound
    playSfx('snd_shop_open');
    // Ensure catalog is loaded/refreshed when opening
    setTimeout(()=>{ loadShop(); }, 0);
  }
  function closeShop(){ if (shopModalRoot) shopModalRoot.hidden = true; }
  function toggleShop(){
    if (!shopModalRoot) return;
    if (shopModalRoot.hidden) openShop(); else closeShop();
  }
  if (shopBtn){ shopBtn.addEventListener('click', toggleShop); }
  if (shopModalRoot){
    shopModalRoot.addEventListener('click', (e)=>{
      const t = e.target;
      if (t && t.getAttribute && t.getAttribute('data-close')==='1') closeShop();
    });
  }
  // Global ESC to close modals
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape'){
      if (invModalRoot && !invModalRoot.hidden) closeInventory();
      if (shopModalRoot && !shopModalRoot.hidden) closeShop();
    }
  });

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

  // --- Shop & Inventory ---
  const invRoot = document.getElementById('m67Inv');
  const shopRoot = document.getElementById('m67ShopList');
  const effectsRoot = document.getElementById('m67Effects');
  const shopNoteEl = document.getElementById('m67ShopNote');
  let catalog = [];
  let inventory = [];
  let effects = { invisible:0, boost:0, mud:0 };
  let stateTimer = null;
  // Guard against stale state coming from other instances: server provides a monotonic state_version per user
  let lastStateVersion = 0;
  // Avoid applying loadState immediately after local mutations
  let stateBlockUntil = 0;
  // Track request ordering to drop out-of-order responses
  let stateReqSeq = 0;
  let stateReqApplied = 0;

  function fmtTime(sec){
    sec = Math.max(0, Math.floor(Number(sec)||0));
    const m = Math.floor(sec/60), s = sec%60;
    return `${m}:${String(s).padStart(2,'0')}`;
  }

  function updateEffectsSummary(eff){
    effects = eff || effects;
    if (!effectsRoot) return;
    effectsRoot.innerHTML = '';
    const parts = [];
    if (effects.invisible>0) parts.push(`🌫️ Invisible ${fmtTime(effects.invisible)}`);
    if (effects.boost>0) parts.push(`⚡ Boost ${fmtTime(effects.boost)}`);
    if (effects.mud>0) parts.push(`💩 Slowed ${fmtTime(effects.mud)}`);
    if (parts.length===0) {
      const span = document.createElement('span');
      span.textContent = 'No active effects';
      effectsRoot.appendChild(span);
    } else {
      parts.forEach(p=>{
        const tag = document.createElement('span');
        tag.textContent = p;
        tag.className = 'tag';
        effectsRoot.appendChild(tag);
      });
    }
  }

  async function loadShop(){
    try {
      const r = await fetch('/api/make67/shop');
      const d = await r.json().catch(()=>({ok:false}));
      if (!d.ok) return;
      catalog = Array.isArray(d.catalog)? d.catalog : [];
      renderShop();
    } catch(_){ }
  }

  async function loadState(){
    if (!isAuthed) return;
    if (Date.now() < stateBlockUntil) return;
    const reqId = ++stateReqSeq;
    try {
      const r = await fetch('/api/make67/state');
      const d = await r.json().catch(()=>({ok:false}));
      if (!d.ok) return;
      const st = d.state || {};
      const sv = Number(st.state_version || 0);
      // Drop out-of-order responses
      if (reqId < stateReqApplied) return;
      // If server provides a version, ignore states older than we have
      if (sv && lastStateVersion && sv < lastStateVersion) return;
      stateReqApplied = reqId;
      if (sv) lastStateVersion = Math.max(lastStateVersion, sv);
      allTime = Number(st.currency||0);
      if (allTimeEl) allTimeEl.textContent = String(allTime);
      if (Array.isArray(st.inventory)) inventory = st.inventory;
      effects = st.effects || effects;
      renderInventory();
      updateEffectsSummary(effects);
      applyEmpowerment();
    } catch(_){ }
  }

  // --- Tiny tooltip helper ---
  let tipEl = null; let tipTimer = null;
  function ensureTip(){
    if (!tipEl){
      tipEl = document.createElement('div');
      tipEl.className = 'm67-tip';
      Object.assign(tipEl.style, {
        position: 'fixed', maxWidth: '260px', padding: '10px 12px', borderRadius: '10px',
        color:'#e6ebf4', background: 'linear-gradient(180deg, rgba(30,34,41,.96), rgba(24,28,34,.96))',
        boxShadow: '0 8px 28px rgba(0,0,0,.45), inset 0 0 0 1px rgba(255,255,255,.06)',
        fontSize: '13px', lineHeight: '1.25', zIndex: 10000, display: 'none', pointerEvents:'none'
      });
      document.body.appendChild(tipEl);
    }
    return tipEl;
  }
  function showTipFor(target, html){
    const el = ensureTip();
    el.innerHTML = html;
    el.style.display = 'block';
    const r = target.getBoundingClientRect();
    const gap = 8;
    let x = r.left + r.width/2; let y = r.top - gap;
    el.style.left = '0px'; el.style.top = '-1000px'; // set offscreen to measure
    const w = el.offsetWidth; const h = el.offsetHeight;
    x = Math.min(window.innerWidth - 8 - w/2, Math.max(8 + w/2, x));
    el.style.left = (x - w/2) + 'px';
    el.style.top = (y - h) + 'px';
    clearTimeout(tipTimer);
  }
  function hideTip(){ if (tipEl){ tipEl.style.display='none'; } }

  function shopItemTooltip(item){
    const desc = item.desc || '';
    return `<div style="font-weight:800; margin-bottom:6px; display:flex; align-items:center; gap:8px;"><span style="font-size:18px">${item.icon||'•'}</span> ${item.name}</div>
            <div style="opacity:.92">${desc}</div>
            <div style="opacity:.8; margin-top:6px; font-size:12px;">Cost: ${item.cost} solves</div>`;
  }

  function invItemTooltip(it){
    const meta = catalog.find(c=> c.key===it.key) || {};
    const desc = meta.desc || '';
    return `<div style="font-weight:800; margin-bottom:6px; display:flex; align-items:center; gap:8px;"><span style="font-size:18px">${it.icon||'•'}</span> ${it.name}</div>
            <div style="opacity:.92">${desc}</div>
            <div style="opacity:.8; margin-top:6px; font-size:12px;">Hold to use</div>`;
  }

  function renderShop(){
    if (!shopRoot) return;
    shopRoot.innerHTML='';
    catalog.forEach(item=>{
      const btn = document.createElement('button');
      btn.className = 'op-btn';
      btn.style.borderColor = '#3a3f47';
      btn.title = `${item.name} — ${item.desc} (Cost: ${item.cost})`;
      btn.innerHTML = `<span style="font-size:22px; filter:drop-shadow(0 2px 4px rgba(0,0,0,.35))">${item.icon||'•'}</span><div style="font-weight:800; font-size:14px;">${item.name}</div><div style="font-size:12px; opacity:.9;">${item.cost} solves</div>`;
      btn.addEventListener('click', ()=> buyItem(item.key));
      // Tooltip on hover/focus
      btn.addEventListener('mouseenter', ()=> showTipFor(btn, shopItemTooltip(item)));
      btn.addEventListener('mouseleave', hideTip);
      btn.addEventListener('focus', ()=> showTipFor(btn, shopItemTooltip(item)));
      btn.addEventListener('blur', hideTip);
      shopRoot.appendChild(btn);
    });
    if (shopNoteEl) shopNoteEl.textContent = 'Inventory has 4 slots. Items cost all-time solves.';
  }

  function renderInventory(){
    if (!invRoot) return;
    invRoot.innerHTML='';
    const slots = 4;
    for (let i=0;i<slots;i++){
      const slot = document.createElement('button');
      slot.className = 'op-btn';
      slot.style.minHeight = '64px';
      slot.style.display = 'grid';
      slot.style.placeItems = 'center';
      slot.style.position = 'relative';
      const it = inventory[i];
      if (it){
        slot.dataset.itemId = it.id;
        slot.title = `${it.name}`;
        slot.innerHTML = `<span style="font-size:22px; color:${it.color||'#fff'}; text-shadow:0 0 8px color-mix(in srgb, ${it.color||'#fff'} 60%, transparent);">${it.icon||'•'}</span><div style="font-size:12px; font-weight:700; opacity:.95;">${it.name}</div>`;
        makeLongPress(slot, ()=>useItem(it));
        // Hover/focus tooltip
        slot.addEventListener('mouseenter', ()=> showTipFor(slot, invItemTooltip(it)));
        slot.addEventListener('mouseleave', hideTip);
        slot.addEventListener('focus', ()=> showTipFor(slot, invItemTooltip(it)));
        slot.addEventListener('blur', hideTip);
      } else {
        slot.classList.add('ghost');
        slot.textContent = '—';
      }
      invRoot.appendChild(slot);
    }
  }

  function makeLongPress(el, onActivate){
    let t= null, start=0, ring;
    const holdMs = 900;
    const clear = ()=>{ if (t){ clearInterval(t); t=null; } if (ring){ ring.remove(); ring=null; } };
    const begin = (x,y)=>{
      start = performance.now();
      ring = document.createElement('div');
      ring.style.position='absolute'; ring.style.inset='6px'; ring.style.borderRadius='14px'; ring.style.boxShadow='0 0 0 2px rgba(255,255,255,.2) inset, 0 0 24px rgba(255,255,255,.15)';
      ring.style.background='radial-gradient(120px 80px at 50% -10%, rgba(255,255,255,.08), transparent)';
      el.appendChild(ring);
      t = setInterval(()=>{
        const p = Math.min(1, (performance.now()-start)/holdMs);
        ring.style.setProperty('opacity', String(.6+.4*Math.sin(p*10)));
        ring.style.setProperty('filter', `drop-shadow(0 0 ${4+14*p}px rgba(255,255,255,${.15+.25*p}))`);
        if (p>=1){ clear(); onActivate && onActivate(); }
      }, 30);
    };
    el.addEventListener('mousedown', e=>{ if (e.button===0) begin(e.clientX,e.clientY); });
    el.addEventListener('touchstart', e=>{ begin(); });
    ['mouseleave','mouseup','touchend','touchcancel'].forEach(evt=> el.addEventListener(evt, clear));
  }

  async function buyItem(key){
    if (!isAuthed) return;
    // Find item meta for confirmation
    const meta = catalog.find(c=> c.key===key);
    const name = meta?.name || 'Item';
    const cost = Number(meta?.cost || 0);
    // If we know currency and cost, warn if insufficient
    if (typeof allTime === 'number' && cost && allTime < cost){
      if (shopNoteEl) shopNoteEl.textContent = 'Not enough solves.';
      return;
    }
    const ok = window.confirm(`Purchase ${name} for ${cost} solves?`);
    if (!ok) return;
    try {
      const r = await fetch('/api/make67/buy', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({key})});
      const d = await r.json().catch(()=>({ok:false}));
      if (!d.ok){
        const err = d.error || 'ERROR';
        if (shopNoteEl) shopNoteEl.textContent = (err==='INVENTORY_FULL')? 'Inventory full.' : (err==='INSUFFICIENT_FUNDS'? 'Not enough solves.' : 'Cannot buy.');
        return;
      }
      allTime = Number(d.currency||0);
      if (allTimeEl) allTimeEl.textContent = String(allTime);
      inventory.push(d.item);
      renderInventory();
      applyEmpowerment();
      // Record server state version if provided and briefly block polling
      if (typeof d.state_version !== 'undefined'){
        lastStateVersion = Math.max(lastStateVersion, Number(d.state_version||0));
      }
      stateBlockUntil = Date.now() + 3000;
      // Play coins sound on successful purchase
      playSfx('snd_shop_coins');
      loadLeaderboard(); // reflects currency change in rank possibly
    } catch(_){ }
  }

  async function useItem(it){
    if (!it) return;
    let payload = { item_id: it.id };
    if (it.key === 'mud'){
      // pick a target from leaderboard
      const target = await pickMudTarget();
      if (!target) return;
      payload.target_id = target;
    }
    try {
      const r = await fetch('/api/make67/use', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
      const d = await r.json().catch(()=>({ok:false}));
      if (!d.ok) return;
      const sv = Number(d.state?.state_version || 0);
      if (sv) lastStateVersion = Math.max(lastStateVersion, sv);
      inventory = Array.isArray(d.state?.inventory)? d.state.inventory : inventory;
      renderInventory();
      loadLeaderboard();
      stateBlockUntil = Date.now() + 3000;
      // Play item activation sounds
      if (it.key === 'mud') {
        playSfx('snd_item_mud');
      } else if (it.key === 'boost') {
        playSfx('snd_item_boost');
      }
    } catch(_){ }
  }

  function pickMudTarget(){
    return new Promise(resolve=>{
      if (!lbList){ resolve(null); return; }
      const hint = document.createElement('div');
      hint.textContent = 'Tap a player to throw mud';
      hint.style.textAlign='center';
      hint.style.fontSize='12px';
      hint.style.opacity='.85';
      lbList.prepend(hint);
      const onClick = (e)=>{
        const li = e.target && e.target.closest && e.target.closest('li.m67-lb-item');
        const id = li && li.dataset && li.dataset.userId;
        if (id){
          lbList.removeEventListener('click', onClick, true);
          hint.remove();
          resolve(id);
        }
      };
      lbList.addEventListener('click', onClick, true);
      setTimeout(()=>{ lbList.removeEventListener('click', onClick, true); try{hint.remove();}catch(_){ } resolve(null); }, 12000);
    });
  }

  function tickState(){
    if (!isAuthed) return;
    if (effects && (effects.invisible>0 || effects.boost>0 || effects.mud>0)){
      // decrement locally for display smoothness
      effects.invisible = Math.max(0, (effects.invisible||0)-1);
      effects.boost = Math.max(0, (effects.boost||0)-1);
      effects.mud = Math.max(0, (effects.mud||0)-1);
      updateEffectsSummary(effects);
    }
  }

  // --- Init shop/inventory polling ---
  setInterval(()=>{ tickState(); }, 1000);
  setInterval(()=>{ loadState(); }, 8000);

  function playSuccess(){
    overlayRoot.hidden = false;
    // quick celebratory flop on remaining card
    const aliveIdx = curCards.findIndex((_, i) => !removed.has(i));
    if (aliveIdx >= 0){
      cardsEl[aliveIdx].classList.add('win-pop');
      setTimeout(()=>cardsEl[aliveIdx].classList.remove('win-pop'), 1200);
    }
    // give a quick charge skim and sync overlay accent
    burstCharge();
    applyEmpowerment();
    // Play success sound based on all-time thresholds
    playSolveSound();
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
        applyEmpowerment();
        burstCharge();
        // Refresh state (inventory/effects) and leaderboard
        loadState();
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
          // Session score spark
          sparkAt(sessionBoxEl, 5);
          applyEmpowerment();
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
      // reactive border hit
      el.classList.add('react-hit');
      setTimeout(()=>el.classList.remove('react-hit'), 200);
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
      // reactive border hit
      el.classList.add('react-hit');
      setTimeout(()=>el.classList.remove('react-hit'), 200);
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
  // First-time empowerment application (for guests too)
  applyEmpowerment();
  // Initialize shop and schedule state fetch (after auth detected)
  loadShop();
  setTimeout(()=>{ loadState(); }, 1200);
})();

// --- Make67 Live Chat (Short polling HTTP) ---
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

  // Short polling state
  let lastId = 0;
  let polling = true;

  async function pollLoop(){
    while (polling){
      try {
        const res = await fetch(`/api/make67/chat/since?last_id=${lastId}`);
        if (res.ok){
          const items = await res.json();
          if (Array.isArray(items)){
            for (const m of items){
              appendMessage(m);
              if (typeof m.id === 'number' && m.id > lastId) lastId = m.id;
            }
          }
        }
      } catch (_){ /* ignore transient errors */ }
      // wait ~2 seconds
      await new Promise(r=>setTimeout(r, 2000));
    }
  }

  // initial fetch to populate a bit
  pollLoop();

  // Send via POST
  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = (inputEl.value || '').trim();
    if (!text) return;
    inputEl.value = '';
    try {
      const res = await fetch('/api/make67/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (!res.ok){
        // Optionally show a soft warning in the UI
      } else {
        const msg = await res.json();
        // Optimistically append own message
        if (msg && msg.text){
          appendMessage({type:'message', user: msg.user || 'You', text: msg.text, id: msg.id});
          if (typeof msg.id === 'number' && msg.id > lastId) lastId = msg.id;
        }
      }
    } catch (_) {
      // Ignore network errors silently
    }
  });
})();
