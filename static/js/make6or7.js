(function(){
  'use strict';

  const TOL = 1e-6;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  // Target for this mode: randomly 6 or 7 for each puzzle
  function pickTarget(){ return Math.random() < 0.5 ? 6 : 7; }
  let TARGET = pickTarget();

  // Utilities for formatting numbers nicely
  function fmt(n){
    if (Number.isInteger(n)) return String(n);
    const r = Math.round(n * 10000) / 10000;
    return String(r);
  }

  // Binary expression tree helpers to build solvable sets by working backward from TARGET
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
  function randomInt(a, b){ return Math.floor(Math.random() * (b - a + 1)) + a; }

  function makeSplitForValue(L){
    // Only allow + and -; ensure leaves are integers within 1..15
    const attempts = 200;
    for (let i=0; i<attempts; i++){
      const op = randomChoice(['+','-','+','-']);
      let a, b;
      if (op === '+'){
        // L = a + b, a,b in [1..15]
        a = randomInt(1, 15);
        b = L - a;
        if (Number.isInteger(b) && b >= 1 && b <= 15) return {op, a, b};
      } else if (op === '-'){
        // L = a - b, a,b in [1..15]
        a = randomInt(1, 15);
        b = a - L;
        if (Number.isInteger(b) && b >= 1 && b <= 15) return {op, a, b};
      }
    }
    return null;
  }

  function generatePuzzle(){
    // New target each puzzle
    TARGET = pickTarget();
    for (let tries=0; tries<200; tries++){
      let root = new Node(TARGET);
      for (let k=0; k<3; k++){
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
      const val = evalNode(root);
      const leavesVals = [];
      collectLeaves(root, leavesVals);
      if (!Number.isFinite(val) || Math.abs(val - TARGET) > TOL) continue;
      if (leavesVals.length !== 4) continue;
      // Enforce 1..15 integer cards only
      if (leavesVals.some(v => !Number.isInteger(v) || v < 1 || v > 15)) continue;
      const uniq = new Set(leavesVals.map(v => fmt(v)));
      if (uniq.size < 2) continue;
      const steps = [];
      const solved = collectSolutionSteps(root, steps);
      if (!Number.isFinite(solved.val) || Math.abs(solved.val - TARGET) > TOL) continue;
      if (steps.some(s => s.op !== '+' && s.op !== '-')) continue;
      return {cards: leavesVals, steps, expr: solved.repr};
    }
    // Fallback simple puzzle
    return {cards: [6, 7, 1, 2], steps: [], expr: ''};
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
  const invBtn = document.getElementById('m67InvBtn');
  const shopBtn = document.getElementById('m67ShopBtn');
  const invModalRoot = document.querySelector('.m67-inv-root');
  const shopModalRoot = document.querySelector('.m67-shop-root');
  // Chat and mobile rank controls (parity with Make67)
  const btnToggleChat = document.getElementById('btn-toggle-chat');
  const chatOverlay = document.getElementById('chat-overlay');
  const btnMobileRank = document.getElementById('btn-mobile-rank');
  const panelLeft = document.querySelector('.panel-left');
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

  function clamp01(x){ return Math.max(0, Math.min(1, x)); }
  let currentEmp = 0;

  function pickTheme(totalLike){
    const t = Number(totalLike) || 0;
    if (t >= 1000) return 'theme-elite';
    if (t >= 700)  return 'theme-darkking';
    if (t >= 400)  return 'theme-mystic';
    if (t >= 200)  return 'theme-tycoon';
    if (t >= 50)   return 'theme-hero';
    return 'theme-starter';
  }

  function applyEmpowerment(){
    const t = Number(allTime) || 0;
    const emp = clamp01(t / 500);
    if (Math.abs(emp - currentEmp) < 1e-6) return;
    currentEmp = emp;
    if (!pageRoot) return;
    pageRoot.style.setProperty('--emp', String(emp));
  }

  // Lock body scroll when any modal/overlay is open
  function updateBodyLock(){
    const anyOpen = (invModalRoot && !invModalRoot.hidden)
      || (shopModalRoot && !shopModalRoot.hidden)
      || (bannedRoot && !bannedRoot.hidden)
      || (chatOverlay && !chatOverlay.hasAttribute('hidden') && chatOverlay.style.display !== 'none');
    document.body.classList.toggle('m67-modal-open', !!anyOpen);
  }

  function setCard(index, value){
    const el = cardsEl[index];
    if (!el) return;
    el.querySelector('span').textContent = fmt(value);
    el.dataset.value = String(value);
  }

  function resetToBase(){
    curCards = baseCards.slice();
    removed = new Set();
    selectedIndex = null;
    selectedOp = null;
    cardsEl.forEach((el, i)=>{
      el.classList.remove('selected');
      el.classList.remove('removed');
      setCard(i, curCards[i]);
    });
    opsEl.forEach(o=>o.classList.remove('active'));
    hintEl.textContent = '';
    hintUsed = false;
  }

  function newPuzzle(){
    const p = generatePuzzle();
    baseCards = p.cards;
    curCards = baseCards.slice();
    removed = new Set();
    selectedIndex = null;
    selectedOp = null;
    currentHint = p.expr;
    cardsEl.forEach((el, i)=>{
      el.classList.remove('selected');
      el.classList.remove('removed');
      setCard(i, curCards[i]);
    });
    opsEl.forEach(o=>o.classList.remove('active'));
    hintEl.textContent = '';
    hintUsed = false;
  }

  function clearSelections(){
    selectedIndex = null;
    selectedOp = null;
    opsEl.forEach(o=>o.classList.remove('active'));
    cardsEl.forEach(e=>e.classList.remove('selected'));
  }

  function play(id){
    const el = document.getElementById(id);
    if (el){ try{ el.currentTime = 0; el.play(); }catch(_){}}
  }

  // On first user interaction, try to unlock audio playback for mobile browsers
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
            try{ el.pause(); el.currentTime = 0; }catch(_){ }
            el.muted = false;
          }
        } catch(_){ try{ el.muted = false; }catch(__){} }
      });
    }
    window.addEventListener('pointerdown', unlock, {once:true, passive:true});
    window.addEventListener('keydown', unlock, {once:true});
  })();

  const ALLOWED_OPS = new Set(['+','-']);

  function doOperation(i, j, op){
    if (!ALLOWED_OPS.has(op)) return;
    if (removed.has(i) || removed.has(j)) return;
    const a = Number(curCards[i]);
    const b = Number(curCards[j]);
    let v = NaN;
    switch(op){
      case '+': v = a + b; break;
      case '-': v = a - b; break;
    }
    if (!Number.isFinite(v)){
      opsEl.forEach(o=>o.classList.remove('active'));
      selectedOp = null;
      return;
    }
    // Replace one selected (i) with result and remove the other (j)
    curCards[i] = v;
    setCard(i, v);
    removed.add(j);
    cardsEl[j].classList.add('removed');
    selectedIndex = null;
    selectedOp = null;
    opsEl.forEach(o=>o.classList.remove('active'));

    const alive = [0,1,2,3].filter(ix=>!removed.has(ix));
    if (alive.length === 1){
      const val = Number(curCards[alive[0]]);
      if (Math.abs(val - TARGET) <= TOL){
        // success
        score += 1;
        if (scoreEl) scoreEl.textContent = String(score);
        try{
          overlayRoot.hidden = false;
          const panel = document.querySelector('.m67-overlay__panel');
          if (panel){ panel.style.transform = 'scale(1.0)'; setTimeout(()=>{ panel.style.transform = ''; }, 200); }
          play('snd_brainrot');
        }catch(_){}
        // credit to server
        submitSolve();
      } else {
        play('snd_reload');
      }
    } else {
      // no sound for intermediate steps in this mode
    }
  }

  function makeLiEmpty(text){
    const li = document.createElement('li');
    li.className = 'm67-lb-empty';
    li.textContent = text;
    return li;
  }

  function makeLiUser(u, isBanned){
    const li = document.createElement('li');
    li.className = isBanned ? 'm67-lb-item rank-cheater' : 'm67-lb-item';
    const name = document.createElement('span');
    name.className = 'm67-name';
    name.textContent = u.name || 'User';
    const total = document.createElement('span');
    total.className = 'm67-total';
    total.textContent = String(u.total || 0);
    const rank = document.createElement('span');
    rank.className = 'm67-rank';
    rank.textContent = (u.rank_icon || '') + ' ' + (u.rank_title || '');
    li.appendChild(name); li.appendChild(total); li.appendChild(rank);
    return li;
  }

  async function loadLeaderboard(){
    try {
      const res = await fetch('/api/make6or7/leaderboard');
      if (!res.ok){ lbList.innerHTML=''; lbList.appendChild(makeLiEmpty('Failed to load')); return; }
      const data = await res.json();
      bannedCache = data && Array.isArray(data.banned) ? data.banned : [];
      lbList.innerHTML = '';
      if (!data || !data.ok){ lbList.appendChild(makeLiEmpty('No data')); return; }
      const items = data.top || [];
      if (!items.length){ lbList.appendChild(makeLiEmpty('No entries yet')); return; }
      for (const u of items){ lbList.appendChild(makeLiUser(u, false)); }
      // update my state visuals
      const me = data.me || null;
      if (me){
        allTime = me.total || 0;
        isAuthed = true;
        if (allTimeEl) allTimeEl.textContent = String(allTime);
        if (allTimeBoxEl) allTimeBoxEl.style.display = '';
        if (sessionBoxEl) sessionBoxEl.style.display = '';
        applyEmpowerment();
      } else {
        isAuthed = false;
        if (allTimeEl) allTimeEl.textContent = '—';
        if (allTimeBoxEl) allTimeBoxEl.style.display = '';
        if (sessionBoxEl) sessionBoxEl.style.display = '';
      }
    } catch (_){
      lbList.innerHTML = '';
      lbList.appendChild(makeLiEmpty('Failed to load'));
    }
  }

  // Inventory & Shop
  const invRoot = document.getElementById('m67Inv');
  const shopRoot = document.getElementById('m67ShopList');
  const effectsRoot = document.getElementById('m67Effects');
  const shopNoteEl = document.getElementById('m67ShopNote');

  async function loadShop(){
    try {
      const r = await fetch('/api/make6or7/shop');
      if (!r.ok) return;
      const data = await r.json();
      const catalog = data.catalog || [];
      const cur = data.currency;
      if (typeof cur === 'number' && allTimeEl) allTimeEl.textContent = String(cur);
      shopRoot.innerHTML = '';
      for (const it of catalog){
        const li = document.createElement('div');
        li.className = 'm67-shop-item';
        li.innerHTML = `<div class="m67-shop-icon" style="background:${it.color || '#333'}">${it.icon || ''}</div>
                        <div class="m67-shop-name">${it.name || ''}</div>
                        <div class="m67-shop-cost">${it.cost || 0}</div>
                        <button class="m67-shop-buy" data-key="${it.key}">Buy</button>`;
        shopRoot.appendChild(li);
      }
    } catch (_){ }
  }

  async function loadState(){
    try {
      const r = await fetch('/api/make6or7/state');
      if (!r.ok) return;
      const data = await r.json();
      if (!data || !data.ok) return;
      const st = data.state || {};
      if (typeof st.currency === 'number' && allTimeEl) allTimeEl.textContent = String(st.currency);
      // Inventory
      invRoot.innerHTML = '';
      const inv = Array.isArray(st.inventory) ? st.inventory : [];
      for (const it of inv){
        const el = document.createElement('div');
        el.className = 'm67-inv-item';
        el.innerHTML = `<div class="m67-inv-icon" style="background:${it.color || '#333'}">${it.icon || ''}</div>
                        <div class="m67-inv-name">${it.name || ''}</div>
                        <button class="m67-inv-use" data-id="${it.id}" data-key="${it.key || ''}">Use</button>`;
        invRoot.appendChild(el);
      }
      // Effects tips
      effectsRoot.innerHTML = '';
      function tip(text){ const t=document.createElement('div'); t.className='m67-tip'; t.textContent=text; effectsRoot.appendChild(t); }
      const fx = st.effects || {};
      if (fx.invisible > 0) tip(`Invisible: ${Math.ceil(fx.invisible)}s`);
      if (fx.boost > 0) tip(`Boost: ${Math.ceil(fx.boost)}s`);
      if (fx.mud > 0) tip(`Mud: ${Math.ceil(fx.mud)}s`);
    } catch(_){ }
  }

  shopRoot.addEventListener('click', async (e)=>{
    const btn = e.target && e.target.closest && e.target.closest('.m67-shop-buy');
    if (!btn) return;
    const key = btn.getAttribute('data-key');
    if (!key) return;
    try{
      const r = await fetch('/api/make6or7/buy', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({key})});
      if (!r.ok) return;
      const data = await r.json();
      if (data && data.ok){
        if (typeof data.currency === 'number' && allTimeEl) allTimeEl.textContent = String(data.currency);
        play('snd_shop_coins');
        loadState();
      }
    }catch(_){ }
  });

  invRoot.addEventListener('click', async (e)=>{
    const btn = e.target && e.target.closest && e.target.closest('.m67-inv-use');
    if (!btn) return;
    const item_id = btn.getAttribute('data-id');
    const item_key = btn.getAttribute('data-key');
    if (!item_id) return;
    try{
      const r = await fetch('/api/make6or7/use', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({item_id})});
      if (!r.ok) return;
      const data = await r.json();
      if (data && data.ok){
        if (item_key === 'mud') play('snd_item_mud'); else play('snd_item_boost');
        loadState();
      }
    }catch(_){ }
  });

  // Shop/Inventory modal toggles
  // Modal helpers with body-lock parity
  function openInventory(){
    if (!invModalRoot) return;
    invModalRoot.hidden = false;
    setTimeout(()=>{ loadState(); }, 0);
    updateBodyLock();
  }
  function closeInventory(){ if (invModalRoot){ invModalRoot.hidden = true; updateBodyLock(); } }
  function toggleInventory(){ if (!invModalRoot) return; if (invModalRoot.hidden) openInventory(); else closeInventory(); }
  if (invBtn){ invBtn.addEventListener('click', toggleInventory); }
  if (invModalRoot){
    invModalRoot.addEventListener('click', (e)=>{ if (e.target && e.target.getAttribute('data-close')) closeInventory(); });
  }

  function openShop(){
    if (!shopModalRoot) return;
    shopModalRoot.hidden = false;
    play('snd_shop_open');
    setTimeout(()=>{ loadShop(); }, 0);
    updateBodyLock();
  }
  function closeShop(){ if (shopModalRoot){ shopModalRoot.hidden = true; updateBodyLock(); } }
  function toggleShop(){ if (!shopModalRoot) return; if (shopModalRoot.hidden) openShop(); else closeShop(); }
  if (shopBtn){ shopBtn.addEventListener('click', toggleShop); }
  if (shopModalRoot){
    shopModalRoot.addEventListener('click', (e)=>{ if (e.target && e.target.getAttribute('data-close')) closeShop(); });
  }

  // Global ESC to close any open overlay/modal
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape'){
      if (invModalRoot && !invModalRoot.hidden) closeInventory();
      if (shopModalRoot && !shopModalRoot.hidden) closeShop();
      if (bannedRoot && !bannedRoot.hidden) { bannedRoot.hidden = true; updateBodyLock(); }
      if (chatOverlay && !chatOverlay.hidden) { chatOverlay.hidden = true; updateBodyLock(); }
    }
  });

  // Banned list
  function showBanned(){
    if (!bannedRoot) return;
    const list = document.getElementById('m67BannedList');
    list.innerHTML = '';
    if (!bannedCache.length){ list.appendChild(makeLiEmpty('No banned users')); }
    else {
      for (const u of bannedCache){ list.appendChild(makeLiUser(u, true)); }
    }
    bannedRoot.hidden = false;
    updateBodyLock();
  }
  function hideBanned(){ if (bannedRoot){ bannedRoot.hidden = true; updateBodyLock(); } }
  if (bannedBtn){ bannedBtn.addEventListener('click', showBanned); }
  if (bannedRoot){
    bannedRoot.addEventListener('click', (e)=>{ if (e.target && e.target.getAttribute('data-close')) hideBanned(); });
  }

  // Chat overlay toggle & mobile rank drawer (parity with Make67)
  if (btnToggleChat && chatOverlay){
    btnToggleChat.addEventListener('click', ()=>{
      chatOverlay.hidden = !chatOverlay.hidden;
      updateBodyLock();
    });
  }
  if (chatOverlay){
    chatOverlay.addEventListener('click', (e)=>{
      const t = e.target;
      if (t && t.getAttribute && t.getAttribute('data-close-chat')==='1'){
        chatOverlay.hidden = true; updateBodyLock();
      }
      if (t && t.id === 'chat-overlay'){ chatOverlay.hidden = true; updateBodyLock(); }
    });
  }
  if (btnMobileRank && panelLeft){
    btnMobileRank.addEventListener('click', ()=>{ panelLeft.classList.toggle('mobile-visible'); });
    document.addEventListener('click', (e)=>{
      if (!panelLeft.classList.contains('mobile-visible')) return;
      if (!panelLeft.contains(e.target) && e.target !== btnMobileRank){ panelLeft.classList.remove('mobile-visible'); }
    });
  }

  // Fit split layout under header height
  function measureHeader(){
    const header = document.querySelector('.make67-page .header');
    if (!header || !pageRoot) return;
    const h = Math.round(header.getBoundingClientRect().height);
    pageRoot.style.setProperty('--header-h', h + 'px');
  }
  measureHeader();
  window.addEventListener('resize', measureHeader);
  setTimeout(measureHeader, 300);

  async function submitSolve(){
    try{
      const res = await fetch('/api/make6or7/solve', {
        method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({hint_used: !!hintUsed})
      });
      if (res.ok){
        const data = await res.json();
        if (data && data.ok){
          allTime = data.all_time_total;
          if (allTimeEl) allTimeEl.textContent = String(allTime);
          applyEmpowerment();
        }
      }
      // update leaderboard in background
      loadLeaderboard();
    } catch(_){ }
  }

  // Bindings
  cardsEl.forEach((el, idx)=>{
    el.addEventListener('click', ()=>{
      if (removed.has(idx)) return;
      if (selectedIndex == null){
        selectedIndex = idx;
        cardsEl.forEach(e=>e.classList.remove('selected'));
        el.classList.add('selected');
      } else if (selectedIndex === idx){
        selectedIndex = null;
        el.classList.remove('selected');
      } else if (selectedOp){
        if (idx === selectedIndex) return;
        const i = selectedIndex;
        const j = idx;
        const op = selectedOp;
        clearSelections();
        doOperation(i, j, op);
      } else {
        cardsEl.forEach(e=>e.classList.remove('selected'));
        selectedIndex = idx;
        el.classList.add('selected');
      }
    });
  });

  opsEl.forEach(el=>{
    if (!ALLOWED_OPS.has(el.dataset.op)){
      // Hide any unexpected ops (safety)
      el.style.display = 'none';
      return;
    }
    el.addEventListener('click', ()=>{
      if (selectedIndex == null){
        el.classList.add('deny');
        setTimeout(()=>el.classList.remove('deny'), 300);
        return;
      }
      el.classList.add('react-hit');
      setTimeout(()=>el.classList.remove('react-hit'), 200);
      opsEl.forEach(o=>o.classList.remove('active'));
      el.classList.add('active');
      selectedOp = el.dataset.op;
    });
  });

  resetBtn.addEventListener('click', ()=>{ resetToBase(); });
  nextBtn.addEventListener('click', ()=>{ overlayRoot.hidden = true; newPuzzle(); });

  function showHint(){
    if (currentHint){
      hintUsed = true;
      hintEl.textContent = `One way: ${currentHint} = ${TARGET}`;
    }
  }
  if (hintBtn) hintBtn.addEventListener('click', showHint);
  hintEl.addEventListener('mousedown', ()=>{ hintTimer = setTimeout(showHint, 700); });
  hintEl.addEventListener('touchstart', ()=>{ hintTimer = setTimeout(showHint, 700); });
  let hintTimer = null;
  ['mouseup','mouseleave','touchend','touchcancel'].forEach(ev=>{
    hintEl.addEventListener(ev, ()=>{ if (hintTimer){ clearTimeout(hintTimer); hintTimer=null; }});
  });

  // Initialize
  loadLeaderboard();
  newPuzzle();
  applyEmpowerment();
  loadShop();
  setTimeout(()=>{ loadState(); }, 1200);
})();

// --- Live Chat (isolated for Make 6 or 7; own endpoints) ---
(function initMakeChat(){
  const logEl = document.getElementById('m67ChatLog');
  const formEl = document.getElementById('m67ChatForm');
  const inputEl = document.getElementById('m67ChatInput');
  if (!logEl || !formEl || !inputEl) return;

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
    row.appendChild(user); row.appendChild(text);
    logEl.appendChild(row);
    if (logEl.childElementCount > 500){ logEl.removeChild(logEl.firstElementChild); }
    logEl.scrollTop = logEl.scrollHeight;
  }

  let lastId = 0;
  let polling = true;
  async function pollLoop(){
    while (polling){
      try {
        const res = await fetch(`/api/make6or7/chat/since?last_id=${lastId}`);
        if (res.ok){
          const items = await res.json();
          if (Array.isArray(items)){
            for (const m of items){
              appendMessage(m);
              if (typeof m.id === 'number' && m.id > lastId) lastId = m.id;
            }
          }
        }
      } catch (_){ }
      await new Promise(r=>setTimeout(r, 2000));
    }
  }
  pollLoop();

  formEl.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const text = (inputEl.value || '').trim();
    if (!text) return;
    inputEl.value = '';
    try{
      const res = await fetch('/api/make6or7/chat/send', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({text})});
      if (res.ok){
        const m = await res.json();
        if (m) appendMessage(m);
      }
    } catch(_){ }
  });
})();

// --- Gentle Snowfall Overlay (parity with Make67) ---
(function initMake6or7Snow(){
  const canvas = document.getElementById('snowCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;
  function resize(){
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(window.innerWidth));
    H = Math.max(1, Math.round(window.innerHeight));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }
  resize();
  window.addEventListener('resize', resize);
  const flakes = [];
  function makeFlake(x, y){
    const r = 0.8 + Math.random() * 2.0;
    return { x, y, r, vy: 0.12 + Math.random() * 0.35, vx: (-0.15 + Math.random() * 0.3), amp: 8 + Math.random() * 18, phase: Math.random() * Math.PI * 2, tw: 0.6 + Math.random() * 0.4 };
  }
  function initFlakes(){
    flakes.length = 0;
    const base = (W * H) / 18000;
    const count = Math.max(40, Math.min(180, Math.round(base)));
    for (let i=0;i<count;i++) flakes.push(makeFlake(Math.random()*W, Math.random()*H));
  }
  initFlakes();
  window.addEventListener('resize', initFlakes);
  let rafId = 0;
  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.save(); ctx.scale(dpr,dpr);
    for (let i=0;i<flakes.length;i++){
      const f = flakes[i];
      f.y += f.vy; f.x += f.vx + Math.sin((f.y*0.015)+f.phase)*0.3;
      if (f.y - f.r > H){ flakes[i] = makeFlake(Math.random()*W, -10 - Math.random()*40); continue; }
      if (f.x < -20) f.x = W + 20; else if (f.x > W + 20) f.x = -20;
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${0.65 + Math.sin((performance.now()/1000)*f.tw)*0.1})`;
      ctx.arc(f.x, f.y, f.r, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
    rafId = requestAnimationFrame(draw);
  }
  function onVis(){
    if (document.visibilityState === 'hidden'){ cancelAnimationFrame(rafId); }
    else { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(draw); }
  }
  document.addEventListener('visibilitychange', onVis);
  rafId = requestAnimationFrame(draw);
})();
