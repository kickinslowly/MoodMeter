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
  const snowballPile = document.getElementById('snowballPile');
  const myUid = (document.body && document.body.dataset && document.body.dataset.userId) ? String(document.body.dataset.userId) : '';
  // FX: Pixi overlay (lazy)
  const prefersReducedMotion = (function(){
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch(_){ return false; }
  })();
  let FX = null; // will hold pixi app + emitters when available
  // Helper: lock body scroll when any modal is open
  function updateBodyLock(){
    const anyOpen = (invModalRoot && !invModalRoot.hidden)
      || (shopModalRoot && !shopModalRoot.hidden)
      || (bannedRoot && !bannedRoot.hidden)
      || (chatOverlay && !chatOverlay.hasAttribute('hidden') && chatOverlay.style.display !== 'none');
    document.body.classList.toggle('m67-modal-open', !!anyOpen);
  }
  // Inventory/Shop modal controls
  const invBtn = document.getElementById('m67InvBtn');
  const shopBtn = document.getElementById('m67ShopBtn');
  // Chat and mobile rank toggles (new split layout controls)
  const btnToggleChat = document.getElementById('btn-toggle-chat');
  const chatOverlay = document.getElementById('chat-overlay');
  const btnMobileRank = document.getElementById('btn-mobile-rank');
  const panelLeft = document.querySelector('.panel-left');
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
        'snd_shop_open','snd_shop_coins','snd_item_mud','snd_item_boost','snd_item_dust'
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
      // Effect classes
      if (item && item.is_mudded) li.classList.add('mudded');
      if (item && item.is_boosted) li.classList.add('boosted');
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
      // Boost indicator
      if (item && item.is_boosted){
        const bolt = document.createElement('span');
        bolt.className = 'boost-ind';
        bolt.title = 'Boosted';
        bolt.textContent = '⚡';
        name.append(' ', bolt);
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
          ensureEventsStream();
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
    updateBodyLock();
  }
  function closeBanned(){ if (bannedRoot) { bannedRoot.hidden = true; updateBodyLock(); } }

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
    updateBodyLock();
  }
  function closeInventory(){ if (invModalRoot) { invModalRoot.hidden = true; updateBodyLock(); } }
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
    updateBodyLock();
  }
  function closeShop(){ if (shopModalRoot) { shopModalRoot.hidden = true; updateBodyLock(); } }
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
      if (bannedRoot && !bannedRoot.hidden) closeBanned();
    }
  });

  // --- Snowballs Feature ---
  let holdingSnowball = false;
  let snowCursorEl = null;
  let eventsEs = null;

  function ensureFx(){
    if (FX || !window.PIXI) return;
    try {
      const app = new PIXI.Application({
        backgroundAlpha: 0,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
        resizeTo: window
      });
      const view = app.view;
      view.style.position = 'fixed';
      view.style.inset = '0';
      view.style.pointerEvents = 'none';
      view.style.zIndex = '900';
      document.body.appendChild(view);

      const root = new PIXI.Container();
      app.stage.addChild(root);

      // Textures
      function makeShardTexture(){
        const g = new PIXI.Graphics();
        const w = 24, h = 36;
        const c1 = 0xffffff, c2 = 0xcfe9ff;
        g.beginFill(c2, 0.95);
        // Triangle shard
        g.moveTo(0, 0);
        g.lineTo(w, h*0.25);
        g.lineTo(w*0.2, h);
        g.closePath();
        g.endFill();
        // highlight edge
        g.lineStyle(2, c1, 0.6)
         .moveTo(w*0.2, h)
         .lineTo(w, h*0.25);
        const tex = app.renderer.generateTexture(g);
        g.destroy(true);
        return tex;
      }
      function makePuffTexture(){
        const g = new PIXI.Graphics();
        const r = 24;
        g.beginFill(0xffffff, 0.9);
        g.drawCircle(r, r, r);
        g.endFill();
        const tex = app.renderer.generateTexture(g);
        g.destroy(true);
        return tex;
      }
      function makeRingTexture(){
        const g = new PIXI.Graphics();
        const R = 64;
        g.lineStyle(6, 0xffffff, 0.8);
        g.drawCircle(R, R, R);
        const tex = app.renderer.generateTexture(g);
        g.destroy(true);
        return tex;
      }
      const shardTextures = [makeShardTexture(), makeShardTexture()];
      const puffTex = makePuffTexture();
      const ringTex = makeRingTexture();

      // Pools
      const shardLayer = new PIXI.ParticleContainer(800, { scale: true, position: true, rotation: true, uvs: true, alpha: true });
      const ringLayer = new PIXI.Container();
      const puffLayer = new PIXI.ParticleContainer(300, { scale: true, position: true, rotation: true, alpha: true });
      root.addChild(puffLayer);
      root.addChild(shardLayer);
      root.addChild(ringLayer);

      const shardPool = [];
      const shards = [];
      const puffs = [];
      const puffPool = [];
      const rings = [];

      function getShard(){
        let s = shardPool.pop();
        if (!s){
          s = new PIXI.Sprite(shardTextures[Math.random()<0.5?0:1]);
          s.anchor.set(0.5, 0.5);
        }
        return s;
      }
      function releaseShard(s){
        if (!s) return;
        s.visible = false;
        s.parent && s.parent.removeChild(s);
        shardPool.push(s);
      }
      function getPuff(){
        let s = puffPool.pop();
        if (!s){
          s = new PIXI.Sprite(puffTex);
          s.anchor.set(0.5);
        }
        return s;
      }
      function releasePuff(s){
        if (!s) return;
        s.visible = false;
        s.parent && s.parent.removeChild(s);
        puffPool.push(s);
      }

      function spawnBurst(x, y, opts){
        const big = !!(opts && opts.big);
        const quality = big ? 1.0 : 0.8;
        const baseCount = prefersReducedMotion ? (big ? 50 : 24) : (big ? 160 : 90);
        const count = Math.min(320, Math.max(20, Math.round(baseCount * quality)));
        const g = prefersReducedMotion ? 600 : 900; // gravity px/s^2
        const drag = 0.985;
        const lifeBase = big ? 1.1 : 0.9;
        const speedBase = big ? 820 : 640;

        // shards
        for (let i=0;i<count;i++){
          const sp = getShard();
          sp.texture = shardTextures[i % shardTextures.length];
          sp.x = x; sp.y = y;
          sp.scale.set(0.35 + Math.random()*0.35);
          sp.rotation = Math.random() * Math.PI * 2;
          sp.alpha = 1;
          const ang = Math.random() * Math.PI * 2;
          const speed = speedBase * (0.45 + Math.random()*0.75);
          sp.__vx = Math.cos(ang) * speed;
          sp.__vy = Math.sin(ang) * speed * 0.85 - (big ? 120 : 60);
          sp.__spin = (Math.random() * 6 - 3) * (prefersReducedMotion ? 0.4 : 1);
          sp.__life = lifeBase + Math.random()*0.6; // seconds
          sp.__drag = drag;
          sp.__g = g;
          shards.push(sp);
          shardLayer.addChild(sp);
          sp.visible = true;
        }

        // puffs (soft snow)
        const puffCount = prefersReducedMotion ? (big? 6:4) : (big? 16:10);
        for (let i=0;i<puffCount;i++){
          const p = getPuff();
          p.x = x; p.y = y; p.alpha = 0.9;
          const ang = Math.random() * Math.PI * 2;
          const speed = (big ? 280 : 220) * (0.6 + Math.random()*0.8);
          p.__vx = Math.cos(ang) * speed;
          p.__vy = Math.sin(ang) * speed * 0.7;
          p.scale.set(0.4 + Math.random()*0.6);
          p.__life = 0.8 + Math.random()*0.7;
          p.__drag = 0.99;
          puffs.push(p);
          puffLayer.addChild(p);
          p.visible = true;
        }

        // shockwave ring
        const ring = new PIXI.Sprite(ringTex);
        ring.anchor.set(0.5);
        ring.x = x; ring.y = y;
        ring.scale.set(0.1);
        ring.alpha = big ? 0.75 : 0.6;
        ring.__life = big ? 0.65 : 0.5;
        ring.__scaleTo = big ? 3.4 : 2.4;
        rings.push(ring);
        ringLayer.addChild(ring);
      }

      let lastTime = performance.now();
      app.ticker.add(() => {
        const now = performance.now();
        const dt = Math.min(0.05, (now - lastTime) / 1000); // cap 50ms
        lastTime = now;

        // shards update
        for (let i=shards.length-1;i>=0;i--){
          const s = shards[i];
          s.__vy += s.__g * dt;
          s.__vx *= s.__drag; s.__vy *= s.__drag;
          s.x += s.__vx * dt; s.y += s.__vy * dt;
          s.rotation += s.__spin * dt;
          s.__life -= dt;
          s.alpha = Math.max(0, Math.min(1, s.__life / 1.2));
          if (s.__life <= 0 || s.x < -200 || s.x > window.innerWidth + 200 || s.y > window.innerHeight + 200){
            releaseShard(s);
            shards.splice(i,1);
          }
        }

        // puffs
        for (let i=puffs.length-1;i>=0;i--){
          const p = puffs[i];
          p.__vx *= p.__drag; p.__vy *= p.__drag;
          p.x += p.__vx * dt; p.y += p.__vy * dt;
          p.__life -= dt;
          p.alpha = Math.max(0, Math.min(1, p.__life / 1.0));
          if (p.__life <= 0){
            releasePuff(p);
            puffs.splice(i,1);
          }
        }

        // rings
        for (let i=rings.length-1;i>=0;i--){
          const r = rings[i];
          const life0 = r.__life;
          r.__life -= dt;
          const t = 1 - Math.max(0, r.__life / life0);
          const s = 0.1 + (r.__scaleTo - 0.1) * t;
          r.scale.set(s);
          r.alpha = Math.max(0, (prefersReducedMotion ? 0.5 : 0.7) * (1 - t));
          if (r.__life <= 0){
            r.parent && r.parent.removeChild(r);
            r.destroy({ children: false, texture: false, baseTexture: false });
            rings.splice(i,1);
          }
        }
      });

      // Pause updates when hidden
      document.addEventListener('visibilitychange', ()=>{
        app.ticker.autoStart = !document.hidden;
        app.ticker.started = !document.hidden;
      });

      FX = {
        app,
        burst: (x, y, opts) => { spawnBurst(x,y,opts||{}); }
      };
    } catch(_){ /* no-op */ }
  }

  function ensureEventsStream(){
    if (eventsEs || !isAuthed) return;
    try {
      eventsEs = new EventSource('/api/make67/events');
      eventsEs.onmessage = (ev)=>{
        if (!ev || !ev.data) return;
        try {
          const msg = JSON.parse(ev.data);
          if (msg && msg.type === 'snowball_hit' && myUid && String(msg.to) === String(myUid)){
            // Mega burst at center on hit
            ensureFx();
            if (FX && typeof FX.burst === 'function'){
              FX.burst(window.innerWidth/2, window.innerHeight/2, {big:true});
            }
            showFullscreenSplat();
          }
        } catch(_){ /* ignore */ }
      };
      eventsEs.onerror = ()=>{ /* keep silent; browser will retry */ };
    } catch(_){ /* ignore */ }
  }

  function showFullscreenSplat(){
    const el = document.createElement('div');
    el.className = 'splat-overlay';
    document.body.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 1100);
  }

  function spawnExplosionAt(x, y){
    ensureFx();
    if (FX && typeof FX.burst === 'function'){
      FX.burst(x, y, {big:false});
      return;
    }
    // Fallback CSS-based puff
    const ex = document.createElement('div');
    ex.className = 'snow-explosion';
    ex.style.left = String(x) + 'px';
    ex.style.top = String(y) + 'px';
    document.body.appendChild(ex);
    ex.addEventListener('animationend', ()=>{ try{ ex.remove(); }catch(_){} }, {once:true});
  }

  function endHoldSnowball(){
    holdingSnowball = false;
    document.body.classList.remove('holding-snowball');
    if (snowCursorEl){ try{ snowCursorEl.remove(); }catch(_){} snowCursorEl = null; }
  }

  function throwSnowball(ev){
    const x = (ev && typeof ev.clientX === 'number') ? ev.clientX : (window.innerWidth/2);
    const y = (ev && typeof ev.clientY === 'number') ? ev.clientY : (window.innerHeight/2);
    let targetLi = null;
    try {
      if (ev && ev.target && ev.target.closest) targetLi = ev.target.closest('li.m67-lb-item');
    } catch(_){ targetLi = null; }
    if (targetLi && targetLi.dataset && targetLi.dataset.userId){
      const targetId = String(targetLi.dataset.userId);
      try {
        fetch('/api/make67/snowball', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_uid: targetId })
        }).catch(()=>{});
      } catch(_){ /* ignore */ }
      try { targetLi.classList.add('hit'); setTimeout(()=> targetLi.classList.remove('hit'), 600); } catch(_){ }
    } else {
      spawnExplosionAt(x, y);
    }
    endHoldSnowball();
  }

  function beginHoldSnowball(){
    if (holdingSnowball) return;
    holdingSnowball = true;
    document.body.classList.add('holding-snowball');
    snowCursorEl = document.createElement('div');
    snowCursorEl.className = 'snowball-cursor';
    document.body.appendChild(snowCursorEl);
    const move = (ev)=>{
      if (!snowCursorEl) return;
      const cx = ev.clientX, cy = ev.clientY;
      snowCursorEl.style.left = String(cx) + 'px';
      snowCursorEl.style.top = String(cy) + 'px';
    };
    const up = (ev)=>{
      document.removeEventListener('mousemove', move);
      document.removeEventListener('click', up, true);
      throwSnowball(ev);
    };
    document.addEventListener('mousemove', move);
    // Capture next click anywhere to perform throw
    document.addEventListener('click', up, {once:true, capture:true});
  }

  if (snowballPile){
    snowballPile.addEventListener('click', (e)=>{
      const t = e.target;
      if (t && t.classList && t.classList.contains('snowball')){
        beginHoldSnowball();
        e.preventDefault();
        e.stopPropagation();
      }
    });
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

  // Disable shop when inventory is full (Make67)
  function updateShopCapacityUI(){
    const isFull = Array.isArray(inventory) && inventory.length >= 4;
    if (shopRoot){
      const btns = shopRoot.querySelectorAll('button');
      btns.forEach(b=>{ b.disabled = !!isFull; });
    }
    if (shopNoteEl){
      shopNoteEl.textContent = isFull
        ? 'Inventory full. Use an item to free a slot before purchasing.'
        : 'Inventory has 4 slots. Items cost all-time solves.';
    }
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
        fontSize: '13px', lineHeight: '1.25', zIndex: 12000, display: 'none', pointerEvents:'none'
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
    updateShopCapacityUI();
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
        // Non-stackable effects: disable use if already active
        let disabledReason = '';
        if (it.key === 'boost' && effects && Number(effects.boost||0) > 0){
          disabledReason = 'Already boosted — wait until it ends.';
          slot.disabled = true;
        } else if (it.key === 'sneaky_dust' && effects && Number(effects.invisible||0) > 0){
          disabledReason = 'Already invisible — wait until it ends.';
          slot.disabled = true;
        }
        slot.title = disabledReason ? `${it.name} — ${disabledReason}` : `${it.name}`;
        slot.innerHTML = `<span style="font-size:22px; color:${it.color||'#fff'}; text-shadow:0 0 8px color-mix(in srgb, ${it.color||'#fff'} 60%, transparent);">${it.icon||'•'}</span><div style="font-size:12px; font-weight:700; opacity:.95;">${it.name}</div>`;
        if (!slot.disabled){
          makeLongPress(slot, ()=>useItem(it));
        }
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
    // Reflect capacity in the shop UI too
    updateShopCapacityUI();
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
    // Block purchases client-side when inventory is full
    if (Array.isArray(inventory) && inventory.length >= 4){
      updateShopCapacityUI();
      return;
    }
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
    // Client-side guard for non-stackable status effects
    try {
      if (it.key === 'boost' && effects && Number(effects.boost||0) > 0){
        alert('You are already boosted. Wait until it ends before using another Boost.');
        return;
      }
      if (it.key === 'sneaky_dust' && effects && Number(effects.invisible||0) > 0){
        alert('You are already invisible. Wait until it ends before using another Sneaky Dust.');
        return;
      }
    } catch(_){ }
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
      if (!d.ok){
        const code = d.error || 'ERROR';
        if (code === 'EFFECT_ACTIVE'){
          const eff = String(d.effect||'effect');
          alert(`That ${eff} is already active. Please wait until it ends.`);
          loadState();
        } else if (code === 'TARGET_EFFECT_ACTIVE'){
          alert('That player is already muddied. Pick someone else.');
          loadState();
        }
        return;
      }
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
      } else if (it.key === 'sneaky_dust') {
        playSfx('snd_item_dust');
      }
    } catch(_){ }
  }

  function pickMudTarget(){
    return new Promise(resolve=>{
      if (!lbList){ resolve(null); return; }

      // State
      let mouseX = window.innerWidth/2, mouseY = window.innerHeight/2;
      let done = false;

      // Minimize/close any open popups before entering mud targeting mode
      try {
        if (typeof closeInventory === 'function' && invModalRoot && !invModalRoot.hidden) closeInventory();
      } catch(_){}
      try {
        if (typeof closeShop === 'function' && shopModalRoot && !shopModalRoot.hidden) closeShop();
      } catch(_){}
      try {
        if (typeof closeBanned === 'function' && bannedRoot && !bannedRoot.hidden) closeBanned();
      } catch(_){}
      try {
        if (chatOverlay && !chatOverlay.hidden) { chatOverlay.hidden = true; }
      } catch(_){}
      try {
        if (overlayRoot && !overlayRoot.hidden) { overlayRoot.hidden = true; }
      } catch(_){}
      try { updateBodyLock && updateBodyLock(); } catch(_){}

      // Fullscreen overlay instruction
      const overlay = document.createElement('div');
      overlay.className = 'm67-mud-overlay';
      overlay.setAttribute('role','dialog');
      overlay.setAttribute('aria-live','polite');
      overlay.textContent = 'choose a target to mud!';
      document.body.appendChild(overlay);

      // Custom cursor follower (mud ball)
      const cursor = document.createElement('div');
      cursor.className = 'm67-mud-cursor';
      document.body.appendChild(cursor);

      // Body class to hide default cursor and block scroll
      document.body.classList.add('m67-mud-mode');

      function placeCursor(x,y){
        mouseX = x; mouseY = y;
        cursor.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      }
      const onMove = (e)=>{
        const x = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
        const y = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
        placeCursor(x, y);
      };
      window.addEventListener('mousemove', onMove, {passive:true});
      window.addEventListener('touchmove', onMove, {passive:true});
      // Initialize position near center
      placeCursor(mouseX, mouseY);

      function cleanup(){
        if (done) return; done = true;
        try { window.removeEventListener('mousemove', onMove, {passive:true}); } catch(_){ window.removeEventListener('mousemove', onMove); }
        try { window.removeEventListener('touchmove', onMove, {passive:true}); } catch(_){ window.removeEventListener('touchmove', onMove); }
        lbList.removeEventListener('click', onClick, true);
        document.removeEventListener('keydown', onKey);
        document.removeEventListener('click', onBackdrop, true);
        try { overlay.remove(); } catch(_){ }
        try { cursor.remove(); } catch(_){ }
        document.body.classList.remove('m67-mud-mode');
      }

      function throwMudTo(targetEl){
        // Create a projectile at current cursor position and animate to target
        const proj = document.createElement('div');
        proj.className = 'm67-mud-throw';
        document.body.appendChild(proj);
        // starting position
        proj.style.left = mouseX + 'px';
        proj.style.top = mouseY + 'px';
        // destination
        const r = targetEl.getBoundingClientRect();
        const tx = r.left + r.width*0.15; // towards name area
        const ty = r.top + r.height*0.5;
        // next frame to apply transition
        requestAnimationFrame(()=>{
          proj.style.setProperty('--tx', (tx - mouseX) + 'px');
          proj.style.setProperty('--ty', (ty - mouseY) + 'px');
          proj.classList.add('go');
        });
        // After animation ends, remove
        proj.addEventListener('animationend', ()=>{ try{ proj.remove(); }catch(_){ } }, {once:true});
      }

      function onClick(e){
        const li = e.target && e.target.closest && e.target.closest('li.m67-lb-item');
        const id = li && li.dataset && li.dataset.userId;
        if (!li || !id) return;
        // Prevent selecting already-mudded targets
        if (li.classList && li.classList.contains('mudded')){
          try { sparkAt(li, 4); } catch(_){ }
          return;
        }
        // Optimistic FX: add mudded look
        li.classList.add('mudded');
        throwMudTo(li);
        cleanup();
        resolve(id);
      }
      lbList.addEventListener('click', onClick, true);

      function onKey(e){ if (e.key === 'Escape'){ cleanup(); resolve(null); } }
      document.addEventListener('keydown', onKey);
      function onBackdrop(e){
        // If click outside leaderboard, treat as cancel (but ignore overlay itself to avoid immediate close)
        if (!lbList.contains(e.target) && !overlay.contains(e.target)){
          cleanup(); resolve(null);
        }
      }
      document.addEventListener('click', onBackdrop, true);

      // Safety timeout
      const TO = setTimeout(()=>{ cleanup(); resolve(null); }, 15000);
      // Ensure cleanup clears timeout
      const prevCleanup = cleanup;
      cleanup = function(){ clearTimeout(TO); prevCleanup(); };
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

  // Keyboard shortcuts: R (reset), H (hint)
  window.addEventListener('keydown', (e)=>{
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'r' || e.key === 'R'){
      if (resetBtn){ e.preventDefault(); resetBtn.click(); }
    } else if (e.key === 'h' || e.key === 'H'){
      if (hintBtn){ e.preventDefault(); hintBtn.click(); }
    }
  });

  // Chat overlay toggle
  if (btnToggleChat && chatOverlay){
    btnToggleChat.addEventListener('click', ()=>{
      chatOverlay.hidden = !chatOverlay.hidden;
    });
  }
  // Chat overlay close button and backdrop
  if (chatOverlay){
    chatOverlay.addEventListener('click', (e)=>{
      const t = e.target;
      if (t && t.getAttribute && t.getAttribute('data-close-chat')==='1'){
        chatOverlay.hidden = true;
      }
      // Close on backdrop click
      if (t && t.id === 'chat-overlay'){
        chatOverlay.hidden = true;
      }
    });
  }

  // Mobile rank drawer toggle
  if (btnMobileRank && panelLeft){
    btnMobileRank.addEventListener('click', ()=>{
      panelLeft.classList.toggle('mobile-visible');
    });
    // Close drawer on backdrop click
    document.addEventListener('click', (e)=>{
      if (!panelLeft.classList.contains('mobile-visible')) return;
      if (!panelLeft.contains(e.target) && e.target !== btnMobileRank){
        panelLeft.classList.remove('mobile-visible');
      }
    });
  }

  // Fit split layout under the header (avoid page scroll)
  function measureHeader(){
    const header = document.querySelector('.make67-page .header');
    if (!header || !pageRoot) return;
    const h = Math.round(header.getBoundingClientRect().height);
    pageRoot.style.setProperty('--header-h', h + 'px');
  }
  measureHeader();
  window.addEventListener('resize', measureHeader);
  // Re-measure once after fonts/images settle
  setTimeout(measureHeader, 300);

  // Global click-to-clear: clicking outside cards/ops clears selection
  window.addEventListener('click', (e)=>{
    const t = e.target;
    // Ignore clicks in interactive text inputs (e.g., chat input)
    const tag = (t && t.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (t && t.isContentEditable)) return;
    // Do not clear when clicking inside puzzle controls
    if (t.closest('.make67-page .cards-grid') || t.closest('.make67-page .ops')) return;
    // Do not react inside overlays/modals/drawers
    if (t.closest('.m67-modal-root') || t.closest('.m67-ban-root') || t.closest('#chat-overlay') || t.closest('.panel-left.mobile-visible')) return;
    // Clear any current selection/op
    if (typeof clearSelections === 'function') clearSelections();
  }, true);
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

// --- Gentle Snowfall Overlay ---
(function initMake67Snow(){
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
  function initFlakes(){
    flakes.length = 0;
    const base = (W * H) / 18000; // density
    const count = Math.max(40, Math.min(180, Math.round(base)));
    for (let i=0; i<count; i++){
      flakes.push(makeFlake(Math.random() * W, Math.random() * H));
    }
  }
  function makeFlake(x, y){
    const r = 0.8 + Math.random() * 2.0;
    return {
      x, y, r,
      vy: 0.12 + Math.random() * 0.35, // slow fall
      vx: (-0.15 + Math.random() * 0.3),
      amp: 8 + Math.random() * 18,
      phase: Math.random() * Math.PI * 2,
      tw: 0.6 + Math.random() * 0.4 // twinkle
    };
  }
  initFlakes();
  window.addEventListener('resize', initFlakes);

  let rafId = 0;
  function draw(){
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);
    for (let i=0; i<flakes.length; i++){
      const f = flakes[i];
      // update
      f.y += f.vy;
      f.x += f.vx + Math.sin((f.y * 0.015) + f.phase) * 0.3;
      if (f.y - f.r > H) { // respawn at top
        flakes[i] = makeFlake(Math.random() * W, -10 - Math.random() * 40);
        continue;
      }
      if (f.x < -20) f.x = W + 20; else if (f.x > W + 20) f.x = -20;

      // draw flake
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${0.65 + Math.sin((performance.now()/1000)*f.tw)*0.1})`;
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    rafId = requestAnimationFrame(draw);
  }

  function onVis(){
    if (document.visibilityState === 'hidden'){
      cancelAnimationFrame(rafId);
    } else {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(draw);
    }
  }
  document.addEventListener('visibilitychange', onVis);
  rafId = requestAnimationFrame(draw);
})();

// --- Santa hover-triggered horizontal move ---
(function initSantaHoverMove(){
  function setup(){
    const santa = document.getElementById('santa-overlay');
    if (!santa) return false;

    // Keep Santa centered vertically at bottom; we only adjust horizontal position via `left` (%)
    // Santa is non-interactive (pointer-events:none). We detect pointing by tracking mouse coordinates
    // against Santa's bounding box for a continuous 3 seconds.

    let isOver = false;
    let hoverTimer = null;
    let isMoving = false;
    let cooldown = false;

    function isPointerOverSanta(mx, my){
      const r = santa.getBoundingClientRect();
      return mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom;
    }

    function startHoverTimer(){
      clearHoverTimer();
      hoverTimer = setTimeout(()=>{
        hoverTimer = null;
        if (isOver && !isMoving) moveSanta();
      }, 3000);
    }

    function clearHoverTimer(){
      if (hoverTimer){
        clearTimeout(hoverTimer);
        hoverTimer = null;
      }
    }

    function moveSanta(){
      const rect = santa.getBoundingClientRect();
      const vw = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
      const margin = 8; // small margin from edges
      const centerMin = margin + rect.width / 2;
      const centerMax = vw - margin - rect.width / 2;
      let currentCenter = rect.left + rect.width / 2;

      // Choose random direction and distance, then clamp within screen
      const dir = Math.random() < 0.5 ? -1 : 1; // left or right
      const available = centerMax - centerMin;
      const minDelta = Math.min(160, Math.max(40, available * 0.15));
      const maxDelta = Math.min(Math.max(220, vw * 0.4), available);
      const delta = minDelta + Math.random() * Math.max(0, (maxDelta - minDelta));
      let targetCenter = currentCenter + dir * delta;
      targetCenter = Math.max(centerMin, Math.min(centerMax, targetCenter));

      // If movement is negligible due to clamping, try opposite direction, else pick random within range
      if (Math.abs(targetCenter - currentCenter) < 10){
        const alt = currentCenter - dir * delta;
        targetCenter = Math.max(centerMin, Math.min(centerMax, alt));
        if (Math.abs(targetCenter - currentCenter) < 10){
          targetCenter = centerMin + Math.random() * (centerMax - centerMin);
        }
      }

      // Animate horizontal move by updating `left` as a percentage; we keep translateX(-50%) for centering
      isMoving = true;
      // Ensure we have a transition on `left`
      const existing = santa.style.transition || '';
      if (!/left\s+\d/.test(existing)){
        santa.style.transition = (existing ? existing + ', ' : '') + 'left 600ms ease';
      }
      santa.style.willChange = 'left, transform';
      const percent = (targetCenter / vw) * 100;
      santa.style.left = percent.toFixed(4) + '%';

      const onEnd = (ev)=>{
        if (ev.propertyName !== 'left') return;
        santa.removeEventListener('transitionend', onEnd);
        isMoving = false;
        cooldown = true;
        // Small cooldown to avoid immediate re-trigger while pointer still over
        setTimeout(()=>{
          cooldown = false;
          if (isOver) startHoverTimer();
        }, 500);
      };
      santa.addEventListener('transitionend', onEnd);
    }

    function onMouseMove(e){
      const mx = e.clientX, my = e.clientY;
      const nowOver = isPointerOverSanta(mx, my);
      if (nowOver && !isOver && !isMoving && !cooldown){
        isOver = true;
        startHoverTimer();
      } else if (!nowOver && isOver){
        isOver = false;
        clearHoverTimer();
      }
    }

    document.addEventListener('mousemove', onMouseMove, { passive: true });
    return true;
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => { setup(); }, { once: true });
  } else {
    // DOM already parsed
    setup();
  }
})();

// --- Santa click-to-hide for 2 minutes ---
(function initSantaClickHide(){
  const HIDE_MS = 2 * 60 * 1000; // 2 minutes
  const LS_KEY = 'm67SantaHiddenUntil';

  function setup(){
    const santa = document.getElementById('santa-overlay');
    if (!santa) return false;

    let revealTimer = null;
    let suppressClickUntil = 0; // avoid double-fire across pointer/mouse/touch/click

    // Ensure Santa can receive direct clicks/taps (reliable on all browsers)
    // This only intercepts interactions when the user actually clicks Santa.
    santa.style.pointerEvents = 'auto';

    function clearRevealTimer(){
      if (revealTimer){
        clearTimeout(revealTimer);
        revealTimer = null;
      }
    }

    function scheduleReveal(ms){
      clearRevealTimer();
      if (ms <= 0){
        reveal();
      } else {
        revealTimer = setTimeout(reveal, ms);
      }
    }

    function hideFor(durationMs){
      // Use the hidden attribute so the element is not hit-tested and has no rect
      santa.hidden = true;
      const until = Date.now() + Math.max(0, durationMs|0);
      try { localStorage.setItem(LS_KEY, String(until)); } catch(e) {}
      scheduleReveal(until - Date.now());
    }

    function reveal(){
      santa.hidden = false;
      try { localStorage.removeItem(LS_KEY); } catch(e) {}
      clearRevealTimer();
    }

    // Restore hidden state if applicable
    let hiddenUntil = 0;
    try { hiddenUntil = parseInt(localStorage.getItem(LS_KEY) || '0', 10) || 0; } catch(e) { hiddenUntil = 0; }
    const remaining = hiddenUntil - Date.now();
    if (remaining > 0){
      santa.hidden = true;
      scheduleReveal(remaining);
    }

    // Intercept clicks that land on Santa's visual bounds without changing pointer-events on the image
    function isPointInSanta(x, y){
      if (santa.hidden) return false;
      const r = santa.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    }

    function handleHit(ev, x, y){
      if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
      if (isPointInSanta(x, y)){
        ev.preventDefault();
        ev.stopPropagation();
        suppressClickUntil = Date.now() + 500; // suppress trailing click
        hideFor(HIDE_MS);
        return true;
      }
      return false;
    }

    function onPointerDown(ev){
      const x = ev.clientX, y = ev.clientY;
      handleHit(ev, x, y);
    }

    function onMouseDown(ev){
      // Fallback if Pointer Events are unavailable
      if (window.PointerEvent) return; // prefer pointerdown when supported
      const x = ev.clientX, y = ev.clientY;
      handleHit(ev, x, y);
    }

    function onTouchStart(ev){
      if (window.PointerEvent) return; // prefer pointerdown when supported
      const t = ev.touches && ev.touches[0];
      if (!t) return;
      handleHit(ev, t.clientX, t.clientY);
    }

    function onDocClick(ev){
      if (Date.now() < suppressClickUntil){
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
      const x = ev.clientX, y = ev.clientY;
      handleHit(ev, x, y);
    }

    function onSantaDown(ev){
      // Direct hit on Santa element — hide immediately
      ev.preventDefault();
      ev.stopPropagation();
      suppressClickUntil = Date.now() + 500;
      hideFor(HIDE_MS);
    }

    function onSantaClick(ev){
      // Redundant safety for environments without Pointer Events
      onSantaDown(ev);
    }

    // Use capture so we can cancel before underlying targets receive the event
    document.addEventListener('pointerdown', onPointerDown, { capture: true });
    document.addEventListener('mousedown', onMouseDown, { capture: true });
    document.addEventListener('touchstart', onTouchStart, { capture: true, passive: false });
    document.addEventListener('click', onDocClick, { capture: true });
    santa.addEventListener('pointerdown', onSantaDown, { capture: true });
    santa.addEventListener('click', onSantaClick, { capture: true });

    return true;
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => { setup(); }, { once: true });
  } else {
    setup();
  }
})();
