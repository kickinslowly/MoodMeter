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

  function fmtTime(sec){
    sec = Math.max(0, Math.floor(Number(sec)||0));
    const m = Math.floor(sec/60), s = sec%60;
    return `${m}:${String(s).padStart(2,'0')}`;
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
  const chatLog = document.getElementById('m67ChatLog');
  const chatForm = document.getElementById('m67ChatForm');
  const chatInput = document.getElementById('m67ChatInput');
  const btnMobileRank = document.getElementById('btn-mobile-rank');
  const panelLeft = document.querySelector('.panel-left');
  const myUid = (document.body && document.body.dataset && document.body.dataset.userId) ? String(document.body.dataset.userId) : '';
  const soundBtn = document.getElementById('m67SoundBtn');
  let soundMenuEl = null; // created lazily
  // Color theme selector UI
  const themeBtn = document.getElementById('m67ThemeBtn');
  let themeMenuEl = null; // created lazily

  // --- Color Theme Options (unlock every 500 pts starting at 1500) ---
  const COLOR_THEME_OPTIONS = [
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
  let lastKnownRankKey = null;
  let lastKnownRankTitle = null;
  let lastKnownAllTime = null;
  // State version tracking for deduplication (matches Make67)
  let lastStateVersion = 0;
  let stateBlockUntil = 0;
  let stateReqSeq = 0;
  let stateReqApplied = 0;

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
    // Dual-scale: 0-1000 → emp 0-0.5, 1000-5500 → emp 0.5-1.0 (matches Make67)
    const emp = t <= 1000
      ? clamp01(t / 2000)
      : clamp01(0.5 + (t - 1000) / 9000);
    currentEmp = emp;
    if (!pageRoot) return;
    // Remove existing rank-based theme classes
    pageRoot.classList.remove('theme-elite','theme-mystic','theme-darkking','theme-hero','theme-tycoon');
    // Only apply rank themes if no user color theme is selected
    const userTheme = pageRoot.getAttribute('data-color-theme');
    if (!userTheme) {
      const theme = pickTheme(t);
      if (theme) pageRoot.classList.add(theme);
    }
    pageRoot.style.setProperty('--emp', String(emp));
    // Charge bar on all-time box
    if (allTimeBoxEl) {
      allTimeBoxEl.classList.add('charged');
      allTimeBoxEl.style.setProperty('--charge', String(emp));
    }
    // Sync overlay accent with active theme accent
    const panel = document.querySelector('.m67-overlay__panel');
    if (panel) {
      const cs = getComputedStyle(pageRoot);
      const accent = cs.getPropertyValue('--accent') || '#9fe3b5';
      panel.style.setProperty('--accent', accent.trim());
    }
  }

  // Lock body scroll when any modal/overlay is open
  function updateBodyLock(){
    const drawer = document.getElementById('mobileNavDrawer');
    const anyOpen = (invModalRoot && !invModalRoot.hidden)
      || (shopModalRoot && !shopModalRoot.hidden)
      || (bannedRoot && !bannedRoot.hidden)
      || (chatOverlay && !chatOverlay.hasAttribute('hidden') && chatOverlay.style.display !== 'none')
      || (drawer && !drawer.hidden);
    document.body.classList.toggle('m67-modal-open', !!anyOpen);
  }

  // --- Solve Sound Logic ---
  function predictedTotalForSound(){
    // Estimate the total solves at the moment of celebration.
    // If this solve counts (authed + no hint), consider +1 as the server will increment.
    let t = (typeof allTime === 'number') ? allTime : 0;
    if (isAuthed && !hintUsed) t += 1;
    return t;
  }

  // --- Solve Sound Preference & Thresholds ---
  const SOUND_OPTIONS = [
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

  // Level up sound IDs for random selection
  const LEVELUP_SOUNDS = [
    'snd_levelup_brainrot',
    'snd_levelup_coffin',
    'snd_levelup_funnysong',
    'snd_levelup_ruletheworld',
    'snd_levelup_thai',
    'snd_levelup_xenogenesis'
  ];

  function currentSoundThreshold(){
    const t = predictedTotalForSound();
    if (t > 3800) return 3800;
    if (t > 3600) return 3600;
    if (t > 3400) return 3400;
    if (t > 3200) return 3200;
    if (t > 3000) return 3000;
    if (t > 2800) return 2800;
    if (t > 2600) return 2600;
    if (t > 2400) return 2400;
    if (t > 2200) return 2200;
    if (t > 2000) return 2000;
    if (t > 1800) return 1800;
    if (t > 1600) return 1600;
    if (t > 1400) return 1400;
    if (t > 1200) return 1200;
    if (t > 1000) return 1000;
    if (t > 800) return 800;
    if (t > 600) return 600;
    if (t > 400) return 400;
    if (t > 200) return 200;
    return 0;
  }

  function _prefSoundKey(){ return 'm6or7_pref_sound:' + (myUid || 'anon'); }
  function getPreferredSolveSoundId(){
    try { return window.localStorage.getItem(_prefSoundKey()) || ''; } catch(_){ return ''; }
  }
  function setPreferredSolveSoundId(id){
    try { window.localStorage.setItem(_prefSoundKey(), String(id||'')); } catch(_){ }
  }
  function isSoundUnlocked(id){
    const opt = SOUND_OPTIONS.find(o => o.id === id);
    if (!opt) return false;
    return currentSoundThreshold() >= opt.threshold;
  }
  function pickPreferredSolveSoundElement(){
    const id = getPreferredSolveSoundId();
    if (id && isSoundUnlocked(id)) return document.getElementById(id);
    return null;
  }

  function pickSolveSoundElement(){
    const t = predictedTotalForSound();
    let id = 'snd_brainrot';
    if (t > 3800) id = 'snd_youwhat';
    else if (t > 3600) id = 'snd_watdadogdoin';
    else if (t > 3400) id = 'snd_rizzbot';
    else if (t > 3200) id = 'snd_punch';
    else if (t > 3000) id = 'snd_hello';
    else if (t > 2800) id = 'snd_duck';
    else if (t > 2600) id = 'snd_bad';
    else if (t > 2400) id = 'snd_amongus';
    else if (t > 2200) id = 'snd_ahhaha';
    else if (t > 2000) id = 'snd_yes';
    else if (t > 1800) id = 'snd_minecraft';
    else if (t > 1600) id = 'snd_huh';
    else if (t > 1400) id = 'snd_enemy';
    else if (t > 1200) id = 'snd_cry';
    else if (t > 1000) id = 'snd_reload';
    else if (t > 800) id = 'snd_ah';
    else if (t > 600) id = 'snd_hehe';
    else if (t > 400) id = 'snd_lol';
    else if (t > 200) id = 'snd_meme';
    return document.getElementById(id);
  }

  function playSolveSound(){
    const preferred = pickPreferredSolveSoundElement();
    const el = preferred || pickSolveSoundElement();
    if (!el) return;
    try { el.pause(); } catch(_){}
    try { el.currentTime = 0; } catch(_){}
    try {
      const p = el.play();
      if (p && typeof p.then === 'function') p.catch(()=>{});
    } catch(_){}
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
      let ids = [
        'snd_brainrot','snd_meme','snd_lol','snd_hehe','snd_ah','snd_reload',
        'snd_cry','snd_enemy', 'snd_huh','snd_minecraft','snd_yes',
        // Extended milestone sounds
        'snd_ahhaha','snd_amongus','snd_bad','snd_duck','snd_hello',
        'snd_punch','snd_rizzbot','snd_watdadogdoin','snd_youwhat',
        // Other SFX
        'snd_shop_open','snd_shop_coins','snd_item_mud','snd_item_boost','snd_item_dust','snd_item_shield',
        // Level up sounds
        'snd_levelup_brainrot','snd_levelup_coffin','snd_levelup_funnysong',
        'snd_levelup_ruletheworld','snd_levelup_thai','snd_levelup_xenogenesis'
      ];
      // Optimization: on mobile, only unlock a few critical sounds to avoid triggering massive downloads
      // since preload is set to "none".
      if (window.innerWidth < 820) {
        ids = ['snd_brainrot', 'snd_levelup_brainrot', 'snd_levelup_coffin', 'snd_shop_open'];
      }
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

  // Merge animation: clone card and fly it to the target (matches Make67)
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
    ghost.style.position = 'fixed';
    ghost.style.left = fromRect.left + 'px';
    ghost.style.top = fromRect.top + 'px';
    ghost.style.width = fromRect.width + 'px';
    ghost.style.height = fromRect.height + 'px';
    let done = false;
    function finish(){ if (done) return; done = true; ghost.remove(); onDone && onDone(); }
    // Fallback timeout in case animationend never fires
    const fallback = setTimeout(finish, 600);
    ghost.addEventListener('animationend', ()=>{ clearTimeout(fallback); finish(); }, {once:true});
    // Force reflow so browser sees element before animation class
    ghost.getBoundingClientRect();
    ghost.classList.add('fly-merge');
  }

  function setRemoved(idx, val){
    if (val){
      cardsEl[idx].classList.add('removed');
      cardsEl[idx].disabled = true;
    } else {
      cardsEl[idx].classList.remove('removed');
      cardsEl[idx].disabled = false;
    }
  }

  function checkEnd(){
    const alive = [0,1,2,3].filter(ix=>!removed.has(ix));
    if (alive.length !== 1) return false;
    const val = Number(curCards[alive[0]]);
    const av = Math.abs(val);
    if (Math.abs(av - 6) <= TOL || Math.abs(av - 7) <= TOL){
      score += 1;
      if (scoreEl) scoreEl.textContent = String(score);
      try{
        overlayRoot.hidden = false;
        const panel = document.querySelector('.m67-overlay__panel');
        if (panel){ panel.style.transform = 'scale(1.0)'; setTimeout(()=>{ panel.style.transform = ''; }, 200); }
        playSolveSound();
        if (allTimeBoxEl) sparkAt(allTimeBoxEl, 5);
      }catch(_){}
      submitSolve();
      return true;
    } else {
      // Wrong answer — shake
      cardsEl[alive[0]].classList.add('deny');
      setTimeout(()=> cardsEl[alive[0]].classList.remove('deny'), 350);
      return true; // still end of operations
    }
  }

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
      cardsEl[j].classList.add('deny');
      setTimeout(()=>cardsEl[j].classList.remove('deny'), 350);
      return;
    }
    animateMerge(i, j, ()=>{
      curCards[j] = v;
      setCard(j, v);
      setRemoved(i, true);
      removed.add(i);
      cardsEl[j].classList.add('merge-pop');
      setTimeout(()=>cardsEl[j].classList.remove('merge-pop'), 500);
      if (!checkEnd()){
        // Auto-select result card for next operation
        clearSelections();
        selectedIndex = j;
        cardsEl[j].classList.add('selected');
      }
    });
  }

  function makeLiEmpty(text){
    const li = document.createElement('li');
    li.className = 'm67-lb-empty';
    li.textContent = text;
    return li;
  }

  function makeLiUser(u, isBanned, idx){
    const li = document.createElement('li');
    li.className = 'm67-lb-item';
    if (u && u.id) li.dataset.userId = u.id;
    const rk = (u && u.rank_key) ? String(u.rank_key) : (isBanned ? 'cheater' : 'noob');
    li.classList.add(`rank-${rk}`);
    if (!isBanned && typeof idx === 'number' && idx === 0) li.classList.add('top1');
    if (u && u.is_mudded) li.classList.add('mudded');
    if (u && u.is_boosted) li.classList.add('boosted');
    if (u && u.is_shielded) li.classList.add('shielded');

    const rankNum = document.createElement('span');
    rankNum.className = 'rank';
    rankNum.textContent = String((idx ?? 0) + 1);

    const name = document.createElement('span');
    name.className = 'name';

    // Boost/Shield indicators (parity with Make67)
    if (u && u.is_shielded){
      const sh = document.createElement('span');
      sh.className = 'shield-ind';
      sh.title = 'Divine Shield Active';
      sh.textContent = '🛡️';
      name.appendChild(sh);
    }
    if (u && u.is_boosted){
      const bst = document.createElement('span');
      bst.className = 'boost-ind';
      bst.title = 'Boost Active';
      bst.textContent = '⚡';
      name.appendChild(bst);
    }

    const icon = document.createElement('span');
    icon.className = 'rank-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = isBanned ? (u?.rank_icon || '🚫') : (u?.rank_icon || '•');
    const title = document.createElement('span');
    title.className = 'rank-title';
    title.textContent = isBanned ? 'BANNED' : (u?.rank_title || '');
    const playerName = document.createTextNode(` ${u?.name || 'Player'} - `);
    name.append(icon, playerName, title);

    // Mud indicator
    if (u && u.is_mudded){
      const mud = document.createElement('span');
      mud.className = 'mud-ind';
      mud.title = 'Mudded';
      mud.textContent = '💩';
      name.append(' ', mud);
    }

    // Golden star for #1
    if (!isBanned && typeof idx === 'number' && idx === 0){
      const star = document.createElement('span');
      star.className = 'top1-star';
      star.setAttribute('aria-hidden', 'true');
      star.title = 'All-time #1';
      star.textContent = '★';
      name.prepend(star);
      li.title = 'All-time #1 leader';
    }

    const total = document.createElement('span');
    total.className = 'total';
    total.textContent = String(u?.total ?? 0);

    li.append(rankNum, name, total);
    if (isBanned) li.classList.add('rank-cheater');
    return li;
  }

  const rankUpOverlayEl = document.getElementById('rankUpOverlay');
  const rankUpNamesEl = document.getElementById('rankUpNames');
  const rankUpFlavorEl = document.getElementById('rankUpFlavor');

  // Tiered flavor texts (matches Make67)
  const FLAVOR_BASIC = [
    "BRAIN EXPANDING...", "NEURONS FIRING...", "KNOWLEDGE ASCENDING...",
    "MAXIMUM COGNITION...", "ABSOLUTE UNIT...", "CRITICAL THINKING++"
  ];
  const FLAVOR_MID = [
    "GIGABRAIN MOMENT...", "UNSTOPPABLE FORCE...", "PEAK PERFORMANCE...",
    "CAN'T BE STOPPED...", "BUILT DIFFERENT FR..."
  ];
  const FLAVOR_HIGH = [
    "LEGENDARY STATUS...", "YOU'RE HIM...", "GOATED WITH THE SAUCE...",
    "ACTUALLY INSANE...", "NO ONE IS SAFE..."
  ];
  const FLAVOR_ULTRA = [
    "OHIO CAN'T CONTAIN YOU...", "MEWING SO HARD RN...",
    "SKIBIDI TOILET WHO?...", "FANUM TAXING THE GAME...",
    "AURA IS ASTRONOMICAL..."
  ];
  const FLAVOR_GOD = [
    "LITERALLY UNPLAYABLE...", "DEVS PLZ NERF...",
    "TOUCHING GRASS IS NOT AN OPTION...", "THE FINAL BOSS WAS YOU...",
    "THEY WROTE LEGENDS ABOUT THIS..."
  ];

  function pickFlavorText(t) {
    if (t >= 5000) return randomChoice(FLAVOR_GOD);
    if (t >= 4000) return randomChoice(FLAVOR_ULTRA);
    if (t >= 2500) return randomChoice(FLAVOR_HIGH);
    if (t >= 1000) return randomChoice(FLAVOR_MID);
    return randomChoice(FLAVOR_BASIC);
  }

  function triggerRankHype(oldTitle, newTitle) {
    if (!rankUpOverlayEl) return;
    const t = Number(allTime) || 0;

    // Set titles
    if (rankUpNamesEl) {
      rankUpNamesEl.textContent = `${(oldTitle || 'NOOB').toUpperCase()} → ${(newTitle || 'ROOKIE').toUpperCase()}`;
    }

    // Set tier-appropriate flavor text
    if (rankUpFlavorEl) {
      rankUpFlavorEl.textContent = pickFlavorText(t);
    }

    // Show overlay
    rankUpOverlayEl.style.display = 'flex';

    // Tiered emoji pools
    let emojis = ['💯', '🔥', '🧠', '🦍', '🆙', '🚨', '💎', '📈', '🤪', '🤩'];
    if (t >= 2500) emojis = emojis.concat(['⚡', '👑', '🗿', '🐐', '💀', '🌀']);
    if (t >= 5000) emojis = emojis.concat(['🎯', '✨', '🕳️', '👁️', '🧬', '🌈']);

    // Particle count scales with rank
    let particleCount = 30;
    if (t >= 5000) particleCount = 60;
    else if (t >= 4000) particleCount = 50;
    else if (t >= 2500) particleCount = 40;
    else if (t >= 1000) particleCount = 35;

    const container = rankUpOverlayEl;

    // Clear any old emojis just in case
    container.querySelectorAll('.rank-up-emoji').forEach(el => el.remove());

    for (let i = 0; i < particleCount; i++) {
      const emoji = document.createElement('div');
      emoji.className = 'rank-up-emoji';
      emoji.textContent = randomChoice(emojis);

      // Random position
      emoji.style.left = Math.random() * 100 + 'vw';
      emoji.style.top = (80 + Math.random() * 20) + 'vh';

      // Random size
      emoji.style.fontSize = (2 + Math.random() * 3) + 'rem';

      // Random delay
      emoji.style.animationDelay = (Math.random() * 0.5) + 's';

      container.appendChild(emoji);
    }

    // Extended duration for ultra ranks
    const duration = t >= 4000 ? 4500 : 3500;
    setTimeout(() => {
      rankUpOverlayEl.style.display = 'none';
      container.querySelectorAll('.rank-up-emoji').forEach(el => el.remove());
    }, duration);
  }

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

  function burstCharge(){
    if (!allTimeBoxEl) return;
    allTimeBoxEl.classList.remove('charge-burst');
    // force reflow to restart animation
    void allTimeBoxEl.offsetWidth;
    allTimeBoxEl.classList.add('charge-burst');
  }

  let _prevLBHash = '';
  async function loadLeaderboard(){
    try {
      const res = await fetch('/api/make6or7/leaderboard');
      if (!res.ok){ lbList.innerHTML=''; lbList.appendChild(makeLiEmpty('Failed to load')); return; }
      const data = await res.json();
      bannedCache = data && Array.isArray(data.banned) ? data.banned : [];
      if (!data || !data.ok){ lbList.innerHTML=''; lbList.appendChild(makeLiEmpty('No data')); return; }
      const items = data.top || [];
      // Skip full DOM rebuild if leaderboard data hasn't changed
      const hash = JSON.stringify(items.map(u=>u.id+'|'+u.total+'|'+(u.is_mudded?1:0)+'|'+(u.is_boosted?1:0)+'|'+(u.is_shielded?1:0)+'|'+u.rank_key));
      const lbChanged = hash !== _prevLBHash;
      _prevLBHash = hash;
      if (lbChanged) {
        lbList.innerHTML = '';
        if (!items.length){ lbList.appendChild(makeLiEmpty('No entries yet')); }
        else { for (let i=0; i<items.length; i++) lbList.appendChild(makeLiUser(items[i], false, i)); }
      }
      // update my state visuals
      const me = data.me || null;
      if (me){
        const newAllTime = Number(me.total || 0);
        const newRankKey = String(me.rank_key || '');
        const newRankTitle = String(me.rank_title || '');
        if (lastKnownRankKey !== null && newRankKey && newRankKey !== lastKnownRankKey &&
            (typeof lastKnownAllTime === 'number' ? newAllTime > lastKnownAllTime : true)){
          play(randomChoice(LEVELUP_SOUNDS));
          triggerRankHype(lastKnownRankTitle, newRankTitle);
        }
        lastKnownRankKey = newRankKey || lastKnownRankKey;
        lastKnownRankTitle = newRankTitle || lastKnownRankTitle;
        lastKnownAllTime = (typeof newAllTime === 'number') ? newAllTime : lastKnownAllTime;
        allTime = newAllTime;
        isAuthed = true;
        if (allTimeEl) allTimeEl.textContent = String(allTime);
        if (allTimeBoxEl) allTimeBoxEl.style.display = '';
        if (sessionBoxEl) sessionBoxEl.style.display = '';
        applyEmpowerment();
        // Update color theme button visibility and reapply saved theme
        updateThemeBtnVisibility();
        const savedTheme = getPreferredColorTheme();
        if (savedTheme) applyColorTheme(savedTheme);
        // Update effects note
        updateEffectsSummary({
          invisible: Number(me.invisible_ends_in||0),
          boost: Number(me.boost_ends_in||0),
          mud: Number(me.mud_ends_in||0),
          shield: Number(me.shield_ends_in||0)
        });
        // Load full state (inventory etc.) when authenticated
        loadState();
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
    const isShield = item.key === 'divine_shield';
    const costLine = isShield ? `Use cost: ${item.cost} solves` : `Cost: ${item.cost} solves`;
    const note = isShield ? `<div style="opacity:.75; margin-top:4px; font-size:12px;">Pay only when you activate it.</div>` : '';
    return `<div style="font-weight:800; margin-bottom:6px; display:flex; align-items:center; gap:8px;"><span style="font-size:18px">${item.icon||'•'}</span> ${item.name}</div>
            <div style="opacity:.92">${desc}</div>
            <div style="opacity:.8; margin-top:6px; font-size:12px;">${costLine}</div>${note}`;
  }

  function invItemTooltip(it){
    const meta = catalog.find(c=> c.key===it.key) || {};
    const desc = meta.desc || '';
    return `<div style="font-weight:800; margin-bottom:6px; display:flex; align-items:center; gap:8px;"><span style="font-size:18px">${it.icon||'•'}</span> ${it.name}</div>
            <div style="opacity:.92">${desc}</div>
            <div style="opacity:.8; margin-top:6px; font-size:12px;">Hold to use</div>`;
  }

  // Inventory & Shop
  const invRoot = document.getElementById('m67Inv');
  const shopRoot = document.getElementById('m67ShopList');
  const effectsRoot = document.getElementById('m67Effects');
  const shopNoteEl = document.getElementById('m67ShopNote');
  let catalog = [];
  let inventory = [];
  let effects = {};

  function updateShopCapacityUI(){
    if (!shopRoot) return;
    const isFull = Array.isArray(inventory) && inventory.length >= 4;
    const btns = shopRoot.querySelectorAll('button');
    btns.forEach(b=>{
      if (isFull) b.disabled = true;
      else b.disabled = false;
    });
    if (shopNoteEl){
      shopNoteEl.textContent = isFull ? 'Inventory full (4/4)' : '';
    }
  }

  async function loadShop(){
    try {
      const r = await fetch('/api/make6or7/shop');
      if (!r.ok) return;
      const d = await r.json();
      if (!d.ok) return;
      catalog = Array.isArray(d.catalog)? d.catalog : [];
      allTime = Number(d.currency||0);
      if (allTimeEl) allTimeEl.textContent = String(allTime);
      renderShop();
    } catch (_){ }
  }

  function renderShop(){
    if (!shopRoot) return;
    shopRoot.innerHTML='';
    catalog.forEach(item=>{
      const btn = document.createElement('button');
      btn.className = 'op-btn';
      btn.style.borderColor = '#3a3f47';
      const isShield = item.key === 'divine_shield';
      btn.title = isShield
        ? `${item.name} — ${item.desc} (Use cost: ${item.cost})`
        : `${item.name} — ${item.desc} (Cost: ${item.cost})`;
      const costStr = isShield ? `Use: ${item.cost} solves` : `${item.cost} solves`;
      btn.innerHTML = `<span style="font-size:22px; filter:drop-shadow(0 2px 4px rgba(0,0,0,.35))">${item.icon||'•'}</span><div style="font-weight:800; font-size:14px;">${item.name}</div><div style="font-size:12px; opacity:.9;">${costStr}</div>`;
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
        } else if (it.key === 'divine_shield' && effects && Number(effects.shield||0) > 0){
          disabledReason = 'Shield already active — wait until it ends.';
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

  function updateEffectsSummary(fx){
    effects = fx || effects;
    if (!effectsRoot) return;
    effectsRoot.innerHTML = '';
    const parts = [];
    if (effects.invisible > 0) parts.push(`🌫️ Invisible ${fmtTime(effects.invisible)}`);
    if (effects.boost > 0) parts.push(`⚡ Boost ${fmtTime(effects.boost)}`);
    if (effects.mud > 0) parts.push(`💩 Slowed ${fmtTime(effects.mud)}`);
    if (effects.shield > 0) parts.push(`🛡️ Divine Shield ${fmtTime(effects.shield)}`);

    if (parts.length === 0){
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

  async function loadState(){
    if (!isAuthed) return;
    if (Date.now() < stateBlockUntil) return;
    const reqId = ++stateReqSeq;
    try {
      const r = await fetch('/api/make6or7/state');
      const d = await r.json().catch(()=>({ok:false}));
      if (!d.ok) return;
      const st = d.state || {};
      const sv = Number(st.state_version || 0);
      // Drop out-of-order responses
      if (reqId < stateReqApplied) return;
      if (sv && lastStateVersion && sv < lastStateVersion) return;
      stateReqApplied = reqId;
      if (sv) lastStateVersion = Math.max(lastStateVersion, sv);
      // NOTE: allTime is NOT set here — loadState uses cached data that can
      // race with authoritative sources (notifySolve, loadLeaderboard, buy/use).
      // allTime is only updated from direct action responses and leaderboard.
      if (Array.isArray(st.inventory)) inventory = st.inventory;
      effects = st.effects || effects;
      if (Array.isArray(st.trophies)) renderTrophies(st.trophies);
      renderInventory();
      updateEffectsSummary(effects);
      applyEmpowerment();
    } catch(_){ }
  }

  async function buyItem(key){
    if (inventory.length >= 4){
      updateShopCapacityUI();
      return;
    }
    const meta = catalog.find(c=> c.key===key);
    const name = meta?.name || 'Item';
    const cost = Number(meta?.cost || 0);
    if (allTime < cost){
      if (shopNoteEl) shopNoteEl.textContent = 'Not enough solves.';
      return;
    }
    let ok;
    if (key === 'divine_shield'){
      ok = window.confirm(`Add ${name} to inventory? (Costs ${cost} solves when used)`);
    } else {
      ok = window.confirm(`Buy ${name} for ${cost} solves?`);
    }
    if (!ok) return;

    try {
      const r = await fetch('/api/make6or7/buy', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({key})
      });
      const d = await r.json().catch(()=>({ok:false}));
      if (d.ok){
        play('snd_shop_coins');
        allTime = Number(d.currency||0);
        if (allTimeEl) allTimeEl.textContent = String(allTime);
        lastKnownAllTime = allTime;
        if (d.item) inventory.push(d.item);
        renderInventory();
        applyEmpowerment();
        if (d.state_version) lastStateVersion = Math.max(lastStateVersion, Number(d.state_version||0));
        stateBlockUntil = Date.now() + 3000;
        loadLeaderboard();
      } else {
        const err = d.error || '';
        if (shopNoteEl) shopNoteEl.textContent = (err==='INVENTORY_FULL')? 'Inventory full.' : (err==='INSUFFICIENT_FUNDS')? 'Not enough solves.' : 'Buy failed.';
      }
    } catch(_){ }
  }

  async function useItem(it){
    hideTip();
    if (!it) return;
    // Reverse Card is passive
    if (it.key === 'reverse_card'){
      showToast('🔄 Reverse Card is passive — it activates when someone muds you!');
      return;
    }
    try {
      let payload = {item_id: it.id};
      // Items that need a target
      if (it.key === 'mud'){
        const t = await pickItemTarget({text:'choose a target to mud!', emoji:'💩', modeClass:'m67-mud-mode'});
        if (!t) return;
        payload.target_id = t;
      } else if (it.key === 'clown_horn'){
        const t = await pickItemTarget({text:'HONK someone! 🤡', emoji:'🤡', canTargetMudded:true});
        if (!t) return;
        payload.target_id = t;
      } else if (it.key === 'banana_peel'){
        const t = await pickItemTarget({text:'place a banana peel! 🍌', emoji:'🍌', canTargetMudded:true});
        if (!t) return;
        payload.target_id = t;
      }
      const r = await fetch('/api/make6or7/use', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
      });
      const d = await r.json().catch(()=>({ok:false}));
      if (!d.ok){
        const code = d.error || 'ERROR';
        if (code === 'EFFECT_ACTIVE') showToast('That effect is already active.');
        else if (code === 'TARGET_EFFECT_ACTIVE') showToast('Target already has that effect.');
        else if (code === 'THWARTED_SHIELD') showToast(d.message || 'Blocked by Divine Shield!');
        else if (code === 'PASSIVE_ITEM') showToast(d.message || 'This item is passive.');
        loadState();
        return;
      }
      const sv = Number(d.state?.state_version || 0);
      if (sv) lastStateVersion = Math.max(lastStateVersion, sv);
      inventory = Array.isArray(d.state?.inventory)? d.state.inventory : inventory;
      // Update allTime from use response (double_or_nothing, divine_shield change currency)
      if (d.state?.currency != null){
        allTime = Number(d.state.currency);
        if (allTimeEl) allTimeEl.textContent = String(allTime);
        lastKnownAllTime = allTime;
        applyEmpowerment();
      }
      renderInventory();
      stateBlockUntil = Date.now() + 3000;
      loadLeaderboard();
      // Handle special responses
      if (d.reversed){
        showToast('🔄 YOUR MUD WAS REVERSED! UNO!');
        play('snd_item_shield');
      } else if (it.key === 'double_or_nothing'){
        if (d.won){ showToast('🎲 YOU WON! +' + d.delta + ' solves!'); play('snd_shop_coins'); }
        else { showToast('🎲 YOU LOST! ' + d.delta + ' solves...'); play('snd_item_mud'); }
      } else if (it.key === 'earthquake'){
        play('snd_item_boost');
      } else if (it.key === 'mud') play('snd_item_mud');
      else if (it.key === 'boost') play('snd_item_boost');
      else if (it.key === 'sneaky_dust') play('snd_item_dust');
      else if (it.key === 'divine_shield') play('snd_item_shield');
      else if (it.key === 'clown_horn') play('snd_brainrot');
      else if (it.key === 'banana_peel') play('snd_item_mud');
    } catch(_){ }
  }

  function pickItemTarget(opts){
    opts = opts || {};
    const overlayText = opts.text || 'Choose a target!';
    const cursorEmoji = opts.emoji || '🎯';
    const modeClass = opts.modeClass || 'm67-mud-mode';
    const canTargetMudded = opts.canTargetMudded || false;
    return new Promise(resolve=>{
      if (!lbList){ resolve(null); return; }
      let mouseX = window.innerWidth/2, mouseY = window.innerHeight/2;
      let done = false;
      try { if (typeof closeInventory === 'function' && invModalRoot && !invModalRoot.hidden) closeInventory(); } catch(_){}
      try { if (typeof closeShop === 'function' && shopModalRoot && !shopModalRoot.hidden) closeShop(); } catch(_){}
      try { if (typeof closeBanned === 'function' && bannedRoot && !bannedRoot.hidden) closeBanned(); } catch(_){}
      try { if (chatOverlay && !chatOverlay.hidden) { chatOverlay.hidden = true; } } catch(_){}
      try { updateBodyLock && updateBodyLock(); } catch(_){}

      const overlay = document.createElement('div');
      overlay.className = 'm67-mud-overlay';
      overlay.setAttribute('role','dialog');
      overlay.setAttribute('aria-live','polite');
      overlay.textContent = overlayText;
      document.body.appendChild(overlay);

      const cursor = document.createElement('div');
      cursor.style.cssText = 'position:fixed;left:0;top:0;width:36px;height:36px;margin-left:-18px;margin-top:-18px;display:grid;place-items:center;z-index:20010;pointer-events:none;font-size:24px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));';
      cursor.textContent = cursorEmoji;
      document.body.appendChild(cursor);
      document.body.classList.add(modeClass);

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
        document.body.classList.remove(modeClass);
      }

      function throwProjectile(targetEl){
        const proj = document.createElement('div');
        proj.style.cssText = 'position:fixed;left:0;top:0;width:28px;height:28px;margin-left:-14px;margin-top:-14px;z-index:20005;pointer-events:none;font-size:20px;display:grid;place-items:center;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.4));';
        proj.textContent = cursorEmoji;
        proj.className = 'm67-mud-throw';
        document.body.appendChild(proj);
        proj.style.left = mouseX + 'px';
        proj.style.top = mouseY + 'px';
        const r = targetEl.getBoundingClientRect();
        const tx = r.left + r.width*0.15;
        const ty = r.top + r.height*0.5;
        requestAnimationFrame(()=>{
          proj.style.setProperty('--tx', (tx - mouseX) + 'px');
          proj.style.setProperty('--ty', (ty - mouseY) + 'px');
          proj.classList.add('go');
        });
        proj.addEventListener('animationend', ()=>{ try{ proj.remove(); }catch(_){ } }, {once:true});
      }

      function onClick(e){
        const li = e.target && e.target.closest && e.target.closest('li.m67-lb-item');
        const id = li && li.dataset && li.dataset.userId;
        if (!li || !id) return;
        if (!canTargetMudded && li.classList && li.classList.contains('mudded')) return;
        throwProjectile(li);
        cleanup();
        resolve(id);
      }
      lbList.addEventListener('click', onClick, true);

      function onKey(e){ if (e.key === 'Escape'){ cleanup(); resolve(null); } }
      document.addEventListener('keydown', onKey);
      function onBackdrop(e){
        if (!lbList.contains(e.target) && !overlay.contains(e.target)){ cleanup(); resolve(null); }
      }
      document.addEventListener('click', onBackdrop, true);

      const TO = setTimeout(()=>{ cleanup(); resolve(null); }, 15000);
      const prevCleanup = cleanup;
      cleanup = function(){ clearTimeout(TO); prevCleanup(); };
    });
  }

  // --- Visual Effect Functions ---
  function showToast(text){
    const el = document.createElement('div');
    el.className = 'm67-toast';
    el.textContent = text;
    document.body.appendChild(el);
    requestAnimationFrame(()=>{ el.classList.add('show'); });
    setTimeout(()=>{
      el.classList.remove('show');
      setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 500);
    }, 3500);
  }

  function showClownRain(){
    const container = document.createElement('div');
    container.className = 'm67-clown-rain';
    const emojis = ['🤡','🤡','🤡','🎪','🎺','🤡','🎈','🤡','🎉','🤡'];
    for (let i = 0; i < 25; i++){
      const span = document.createElement('span');
      span.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      span.style.left = Math.random() * 100 + '%';
      span.style.animationDelay = Math.random() * 1.2 + 's';
      span.style.animationDuration = (1.5 + Math.random() * 1.5) + 's';
      span.style.fontSize = (20 + Math.random() * 28) + 'px';
      container.appendChild(span);
    }
    document.body.appendChild(container);
    try { play('snd_brainrot'); } catch(_){}
    setTimeout(()=>{ try{ container.remove(); }catch(_){} }, 4500);
  }

  function showEarthquake(userName){
    const page = document.querySelector('.make67-page');
    if (page){
      page.classList.add('m67-earthquake');
      setTimeout(()=>{ try{ page.classList.remove('m67-earthquake'); }catch(_){} }, 5000);
    }
    showToast('💥 ' + userName + ' TRIGGERED AN EARTHQUAKE!');
    try { play('snd_item_boost'); } catch(_){}
  }

  function showReverseCard(){
    const el = document.createElement('div');
    el.className = 'm67-reverse-card';
    el.textContent = '🔄';
    document.body.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 2000);
  }

  function showBananaSlip(){
    const el = document.createElement('div');
    el.className = 'm67-banana-slip';
    el.innerHTML = '🍌<br><span style="font-size:16px;font-weight:900;color:#ffe135;text-shadow:0 2px 8px rgba(0,0,0,.6)">SLIPPED!</span>';
    document.body.appendChild(el);
    try { play('snd_item_mud'); } catch(_){}
    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 2000);
  }

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
    invModalRoot.addEventListener('click', (e)=>{
      const t = e.target;
      if (t && t.getAttribute && t.getAttribute('data-close')==='1') closeInventory();
    });
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
    shopModalRoot.addEventListener('click', (e)=>{
      const t = e.target;
      if (t && t.getAttribute && t.getAttribute('data-close')==='1') closeShop();
    });
  }

  // Global ESC to close any open overlay/modal
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape'){
      const drawer = document.getElementById('mobileNavDrawer');
      if (drawer && !drawer.hidden) { drawer.hidden = true; updateBodyLock(); return; }
      if (invModalRoot && !invModalRoot.hidden) closeInventory();
      if (shopModalRoot && !shopModalRoot.hidden) closeShop();
      if (bannedRoot && !bannedRoot.hidden) { bannedRoot.hidden = true; updateBodyLock(); }
      if (chatOverlay && !chatOverlay.hidden) { chatOverlay.hidden = true; updateBodyLock(); }
      if (themeMenuEl && !themeMenuEl.hidden) closeThemeMenu();
    }
  });

  // Banned list
  function showBanned(){
    if (!bannedRoot) return;
    const list = document.getElementById('m67BannedList');
    list.innerHTML = '';
    if (!bannedCache.length){ list.appendChild(makeLiEmpty('No banned users')); }
    else {
      for (let i=0; i<bannedCache.length; i++){
        const u = bannedCache[i];
        list.appendChild(makeLiUser(u, true, i));
      }
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

  function ensureSoundMenu(){
    if (soundMenuEl) return soundMenuEl;
    const el = document.createElement('div');
    el.id = 'm67SoundMenu';
    el.hidden = true;
    el.style.cssText = 'position:fixed;z-index:1000;background:rgba(21,23,28,0.95);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:4px;width:180px;box-shadow:0 8px 32px rgba(0,0,0,.4);';
    document.body.appendChild(el);
    soundMenuEl = el;
    return el;
  }

  function renderSoundMenu(){
    const el = ensureSoundMenu();
    const threshold = currentSoundThreshold();
    const pref = getPreferredSolveSoundId();
    el.innerHTML = '';
    const header = document.createElement('div');
    header.textContent = 'Solve Sound';
    header.style.cssText = 'font-size:12px;color:#9aa4b2;opacity:.9;padding:6px 8px 8px;';
    el.appendChild(header);
    SOUND_OPTIONS.filter(o => threshold >= o.threshold).forEach(o => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('role','option');
      btn.setAttribute('aria-selected', String(pref === o.id));
      btn.dataset.id = o.id;
      btn.style.display = 'flex';
      btn.style.alignItems = 'center';
      btn.style.justifyContent = 'space-between';
      btn.style.gap = '10px';
      btn.style.width = '100%';
      btn.style.padding = '8px 10px';
      btn.style.margin = '2px 0';
      btn.style.background = pref === o.id ? 'rgba(159,227,181,.12)' : 'transparent';
      btn.style.border = '1px solid ' + (pref === o.id ? 'var(--selected-outline, #3aa876)' : 'transparent');
      btn.style.color = '#e6ebf5';
      btn.style.borderRadius = '8px';
      btn.style.cursor = 'pointer';
      btn.style.fontSize = '14px';
      btn.addEventListener('mouseenter', ()=>{ if (pref !== o.id) btn.style.background = 'rgba(255,255,255,.04)'; });
      btn.addEventListener('mouseleave', ()=>{ btn.style.background = (pref === o.id ? 'rgba(159,227,181,.12)' : 'transparent'); });
      const name = document.createElement('span');
      name.textContent = o.label;
      const mark = document.createElement('span');
      mark.textContent = pref === o.id ? '✓' : '';
      mark.style.opacity = '.9';
      mark.style.color = '#9fe3b5';
      btn.appendChild(name);
      btn.appendChild(mark);
      btn.addEventListener('click', ()=>{
        setPreferredSolveSoundId(o.id);
        // Re-render to update checkmark
        renderSoundMenu();
        // Optional: play a short preview
        const previewEl = document.getElementById(o.id);
        if (previewEl){ try { previewEl.currentTime = 0; previewEl.play().catch(()=>{}); } catch(_){} }
        // Close after selection on mobile for convenience
        setTimeout(()=> closeSoundMenu(), 50);
      });
      el.appendChild(btn);
    });
  }

  function positionSoundMenu(){
    const el = ensureSoundMenu();
    const btn = soundBtn;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const top = r.bottom + 6 + window.scrollY;
    const left = Math.min(Math.max(12, r.left + window.scrollX - 40), window.scrollX + (window.innerWidth - 220));
    el.style.top = top + 'px';
    el.style.left = left + 'px';
  }

  function openSoundMenu(){
    if (!soundBtn) return;
    const el = ensureSoundMenu();
    renderSoundMenu();
    positionSoundMenu();
    el.hidden = false;
    soundBtn.setAttribute('aria-expanded', 'true');
  }
  function closeSoundMenu(){
    if (!soundMenuEl) return;
    soundMenuEl.hidden = true;
    if (soundBtn) soundBtn.setAttribute('aria-expanded', 'false');
  }
  function toggleSoundMenu(){
    if (!soundMenuEl || soundMenuEl.hidden) openSoundMenu(); else closeSoundMenu();
  }
  if (soundBtn){
    soundBtn.addEventListener('click', (e)=>{
      e.stopPropagation();
      toggleSoundMenu();
    });
  }
  document.addEventListener('pointerdown', (e)=>{
    if (!soundMenuEl || soundMenuEl.hidden) return;
    const t = e.target;
    if (t === soundMenuEl || soundMenuEl.contains(t)) return;
    if (t === soundBtn) return;
    closeSoundMenu();
  });
  window.addEventListener('resize', ()=>{ if (soundMenuEl && !soundMenuEl.hidden) positionSoundMenu(); });
  window.addEventListener('scroll', ()=>{ if (soundMenuEl && !soundMenuEl.hidden) positionSoundMenu(); }, {passive:true});

  // --- Color Theme Menu UI ---
  function _prefThemeKey(){ return 'm6or7_pref_theme:' + (myUid || 'anon'); }
  function getPreferredColorTheme(){
    try { return window.localStorage.getItem(_prefThemeKey()) || ''; } catch(_){ return ''; }
  }
  function setPreferredColorTheme(id){
    try { window.localStorage.setItem(_prefThemeKey(), String(id||'')); } catch(_){ }
  }
  function getHighestUnlockedThemeThreshold(){
    const t = (typeof allTime === 'number') ? allTime : 0;
    let highest = 0;
    for (const opt of COLOR_THEME_OPTIONS){
      if (t >= opt.threshold && opt.threshold > highest) highest = opt.threshold;
    }
    return highest;
  }
  function isThemeUnlocked(id){
    const opt = COLOR_THEME_OPTIONS.find(o => o.id === id);
    if (!opt) return false;
    const t = (typeof allTime === 'number') ? allTime : 0;
    return t >= opt.threshold;
  }
  function applyColorTheme(id){
    if (!pageRoot) return;
    if (id && isThemeUnlocked(id)){
      pageRoot.setAttribute('data-color-theme', id);
    } else {
      pageRoot.removeAttribute('data-color-theme');
    }
  }
  function updateThemeBtnVisibility(){
    if (!themeBtn) return;
    const t = (typeof allTime === 'number') ? allTime : 0;
    if (t >= 1500){
      themeBtn.style.display = '';
    } else {
      themeBtn.style.display = 'none';
    }
  }
  function ensureThemeMenu(){
    if (themeMenuEl) return themeMenuEl;
    const el = document.createElement('div');
    el.id = 'm67ThemeMenu';
    el.setAttribute('role', 'listbox');
    el.hidden = true;
    el.style.cssText = 'position:absolute;min-width:200px;max-width:260px;background:rgba(34,36,43,.96);border:1px solid #3a3f4b;border-radius:10px;box-shadow:0 10px 32px rgba(0,0,0,.45);padding:6px;backdrop-filter:blur(6px);z-index:1000;';
    document.body.appendChild(el);
    themeMenuEl = el;
    return el;
  }
  function renderThemeMenu(){
    const el = ensureThemeMenu();
    const t = (typeof allTime === 'number') ? allTime : 0;
    const pref = getPreferredColorTheme();
    el.innerHTML = '';
    const header = document.createElement('div');
    header.textContent = 'Color Theme';
    header.style.cssText = 'font-size:12px;color:#9aa4b2;opacity:.9;padding:6px 8px 8px;';
    el.appendChild(header);
    // Default/none option
    const defBtn = document.createElement('button');
    defBtn.type = 'button';
    defBtn.setAttribute('role','option');
    defBtn.setAttribute('aria-selected', String(!pref));
    defBtn.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:8px 10px;margin:2px 0;background:' + (!pref ? 'rgba(159,227,181,.12)' : 'transparent') + ';border:1px solid ' + (!pref ? 'var(--selected-outline,#3aa876)' : 'transparent') + ';color:#e6ebf5;border-radius:8px;cursor:pointer;font-size:14px;';
    defBtn.innerHTML = '<span>⚫ Default</span><span style="opacity:.9;color:#9fe3b5;">' + (!pref ? '✓' : '') + '</span>';
    defBtn.addEventListener('click', ()=>{
      setPreferredColorTheme('');
      applyColorTheme('');
      renderThemeMenu();
      setTimeout(closeThemeMenu, 50);
    });
    el.appendChild(defBtn);
    // Only show unlocked themes
    let nextUnlock = null;
    COLOR_THEME_OPTIONS.forEach(o => {
      const unlocked = t >= o.threshold;
      if (!unlocked && !nextUnlock) {
        nextUnlock = o; // track first locked theme for "next unlock" hint
        return;
      }
      if (!unlocked) return; // skip locked themes
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('role','option');
      btn.setAttribute('aria-selected', String(pref === o.id));
      btn.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:8px 10px;margin:2px 0;background:' + (pref === o.id ? 'rgba(159,227,181,.12)' : 'transparent') + ';border:1px solid ' + (pref === o.id ? 'var(--selected-outline,#3aa876)' : 'transparent') + ';color:#e6ebf5;border-radius:8px;cursor:pointer;font-size:14px;';
      btn.innerHTML = '<span>' + o.icon + ' ' + o.label + '</span><span style="opacity:.9;color:#9fe3b5;">' + (pref === o.id ? '✓' : '') + '</span>';
      btn.addEventListener('click', ()=>{
        setPreferredColorTheme(o.id);
        applyColorTheme(o.id);
        renderThemeMenu();
        setTimeout(closeThemeMenu, 50);
      });
      el.appendChild(btn);
    });
    // Show next unlock hint if there are more themes to unlock
    if (nextUnlock) {
      const hint = document.createElement('div');
      hint.style.cssText = 'font-size:11px;color:#7a8290;padding:8px 10px 4px;border-top:1px solid rgba(255,255,255,0.08);margin-top:4px;';
      hint.textContent = 'Next: ' + nextUnlock.icon + ' ' + nextUnlock.label + ' at ' + nextUnlock.threshold + ' pts';
      el.appendChild(hint);
    }
  }
  function positionThemeMenu(){
    const el = ensureThemeMenu();
    if (!themeBtn) return;
    const r = themeBtn.getBoundingClientRect();
    const top = r.bottom + 6 + window.scrollY;
    const left = Math.min(Math.max(12, r.left + window.scrollX - 60), window.scrollX + (window.innerWidth - 240));
    el.style.top = top + 'px';
    el.style.left = left + 'px';
  }
  function openThemeMenu(){
    if (!themeBtn) return;
    const el = ensureThemeMenu();
    renderThemeMenu();
    positionThemeMenu();
    el.hidden = false;
    themeBtn.setAttribute('aria-expanded', 'true');
  }
  function closeThemeMenu(){
    if (!themeMenuEl) return;
    themeMenuEl.hidden = true;
    if (themeBtn) themeBtn.setAttribute('aria-expanded', 'false');
  }
  function toggleThemeMenu(){
    if (!themeMenuEl || themeMenuEl.hidden) openThemeMenu(); else closeThemeMenu();
  }
  if (themeBtn){
    themeBtn.addEventListener('click', (e)=>{
      e.stopPropagation();
      toggleThemeMenu();
    });
  }
  document.addEventListener('pointerdown', (e)=>{
    if (!themeMenuEl || themeMenuEl.hidden) return;
    const t = e.target;
    if (t === themeMenuEl || themeMenuEl.contains(t)) return;
    if (t === themeBtn) return;
    closeThemeMenu();
  });
  window.addEventListener('resize', ()=>{ if (themeMenuEl && !themeMenuEl.hidden) positionThemeMenu(); });
  window.addEventListener('scroll', ()=>{ if (themeMenuEl && !themeMenuEl.hidden) positionThemeMenu(); }, {passive:true});

  // Apply saved theme on load and update button visibility
  function initColorTheme(){
    updateThemeBtnVisibility();
    const saved = getPreferredColorTheme();
    if (saved && isThemeUnlocked(saved)){
      applyColorTheme(saved);
    }
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
          allTime = Number(data.all_time_total || 0);
          if (allTimeEl) allTimeEl.textContent = String(allTime);
          applyEmpowerment();
          burstCharge();
          if (allTimeBoxEl) sparkAt(allTimeBoxEl, 5);
          if (data.banana_slip) showBananaSlip();
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
      el.classList.add('react-hit');
      setTimeout(()=>el.classList.remove('react-hit'), 200);
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

  // Keyboard shortcuts (matches Make67)
  window.addEventListener('keydown', (e)=>{
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'r' || e.key === 'R'){
      if (resetBtn){ e.preventDefault(); resetBtn.click(); }
    } else if (e.key === 'h' || e.key === 'H'){
      if (hintBtn){ e.preventDefault(); hintBtn.click(); }
    }
  });

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

  // --- Swipe-to-solve (touch devices) ---
  // Touch a card, swipe through an operation, swipe to a second card, release to merge.
  (function initSwipeSolve(){
    if (!('ontouchstart' in window) && !navigator.maxTouchPoints) return;
    let sw = null;
    let dotTime = 0;

    function getHit(x, y){
      if (sw && sw.cursor) sw.cursor.style.display = 'none';
      const el = document.elementFromPoint(x, y);
      if (sw && sw.cursor) sw.cursor.style.display = '';
      if (!el) return null;
      const card = el.closest && el.closest('.card');
      if (card){
        const idx = cardsEl.indexOf(card);
        if (idx >= 0 && !removed.has(idx)) return {type:'card', idx, el:card};
      }
      const opEl = el.closest && el.closest('.op-btn[data-op]');
      if (opEl && opEl.dataset.op) return {type:'op', value:opEl.dataset.op, el:opEl};
      return null;
    }

    function spawnDot(x, y){
      const now = performance.now();
      if (now - dotTime < 30) return;
      dotTime = now;
      const d = document.createElement('div');
      d.className = 'swipe-dot';
      d.style.left = x + 'px';
      d.style.top = y + 'px';
      document.body.appendChild(d);
      setTimeout(()=>{ try{ d.remove(); }catch(_){} }, 500);
    }

    function teardown(){
      cardsEl.forEach(c => c.classList.remove('swipe-from', 'swipe-target'));
      opsEl.forEach(o => o.classList.remove('swipe-op'));
      if (sw && sw.cursor){ try{ sw.cursor.remove(); }catch(_){} }
      document.querySelectorAll('.swipe-dot').forEach(d => { try{ d.remove(); }catch(_){} });
    }

    function updateCursor(){
      if (!sw || !sw.cursor) return;
      sw.cursor.classList.toggle('swipe-ready', !!(sw.op && sw.to != null));
      sw.cursor.classList.toggle('swipe-has-op', !!(sw.op && sw.to == null));
    }

    function onMove(e){
      if (!sw) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - sw.x0;
      const dy = t.clientY - sw.y0;

      if (!sw.active){
        if (dx * dx + dy * dy < 225) return;
        sw.active = true;
        cardsEl[sw.from].classList.add('swipe-from');
        clearSelections();
        sw.cursor = document.createElement('div');
        sw.cursor.className = 'swipe-cursor';
        document.body.appendChild(sw.cursor);
      }

      e.preventDefault();

      sw.cursor.style.left = t.clientX + 'px';
      sw.cursor.style.top = t.clientY + 'px';
      spawnDot(t.clientX, t.clientY);

      const hit = getHit(t.clientX, t.clientY);

      cardsEl.forEach(c => c.classList.remove('swipe-target'));

      if (!hit){ sw.to = null; updateCursor(); return; }

      if (hit.type === 'op'){
        if (sw.op !== hit.value){
          sw.op = hit.value;
          opsEl.forEach(o => o.classList.remove('swipe-op'));
          hit.el.classList.add('swipe-op');
          try{ if (navigator.vibrate) navigator.vibrate(12); }catch(_){}
        }
        sw.to = null;
      } else if (hit.type === 'card' && hit.idx !== sw.from){
        if (sw.op){
          if (sw.to !== hit.idx){
            sw.to = hit.idx;
            hit.el.classList.add('swipe-target');
            try{ if (navigator.vibrate) navigator.vibrate(12); }catch(_){}
          }
        }
      } else {
        sw.to = null;
      }
      updateCursor();
    }

    function onEnd(){
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);

      if (!sw || !sw.active){ sw = null; return; }

      const from = sw.from, op = sw.op, to = sw.to;
      teardown();
      sw = null;

      if (from != null && op && to != null){
        clearSelections();
        doOperation(from, to, op);
        try{ if (navigator.vibrate) navigator.vibrate(25); }catch(_){}
      }
    }

    cardsEl.forEach((el, idx) => {
      el.addEventListener('touchstart', (e) => {
        if (removed.has(idx) || sw) return;
        const t = e.touches[0];
        if (!t) return;
        sw = {from:idx, op:null, to:null, x0:t.clientX, y0:t.clientY, active:false, cursor:null};
        document.addEventListener('touchmove', onMove, {passive:false});
        document.addEventListener('touchend', onEnd);
        document.addEventListener('touchcancel', onEnd);
      }, {passive:true});
    });
  })();

  // ─── Tournament System ───
  const GAME_TYPE = 'make6or7';
  const tourneyBanner = document.getElementById('tourneyBanner');
  const tourneyBannerText = document.getElementById('tourneyBannerText');
  const tourneyBannerTimer = document.getElementById('tourneyBannerTimer');
  const tourneyJoinBtn = document.getElementById('tourneyJoinBtn');
  const tourneyDismissBtn = document.getElementById('tourneyDismissBtn');
  const tourneyRoot = document.querySelector('.m67-tourney-root');
  const tourneyStatus = document.getElementById('tourneyStatus');
  const tourneyTimer = document.getElementById('tourneyTimer');
  const tourneySB = document.getElementById('tourneyScoreboard');
  const tourneyFooter = document.getElementById('tourneyPanelFooter');
  const tourneyCeleb = document.getElementById('tourneyCelebration');
  const tourneyChamName = document.getElementById('tourneyChamName');
  const tourneyChamStats = document.getElementById('tourneyChamStats');
  const tourneyRunners = document.getElementById('tourneyRunners');
  const trophyDisplay = document.getElementById('trophyDisplay');

  let tourneyState = null;
  let tourneyPollTimer = null;
  let tourneyDismissed = false;
  let tourneyCelebShown = false;

  function fmtTimerT(sec){
    const m = Math.floor(sec/60);
    const s = sec % 60;
    return m + ':' + String(s).padStart(2,'0');
  }

  function renderTrophies(trophies){
    if (!trophyDisplay || !trophies || !trophies.length){ if(trophyDisplay) trophyDisplay.hidden=true; return; }
    const medals = {1:'🥇',2:'🥈',3:'🥉'};
    trophyDisplay.innerHTML = trophies.map(t =>
      '<span class="trophy-badge trophy-badge--'+t.place+'" title="'+t.date+(t.players?' | '+t.players+' players':'')+'"><span class="trophy-badge__icon">'+
      (medals[t.place]||'🏆')+'</span>'+t.solves+'</span>'
    ).join('');
    trophyDisplay.hidden = false;
  }

  function escHtmlT(s){ const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

  function tourneyShowBanner(text, showJoin){
    if (!tourneyBanner || tourneyDismissed) return;
    tourneyBannerText.textContent = text;
    tourneyJoinBtn.style.display = showJoin ? '' : 'none';
    tourneyBanner.hidden = false;
  }
  function tourneyHideBanner(){ if(tourneyBanner) tourneyBanner.hidden = true; }

  function tourneyOpenPanel(){ if(tourneyRoot) tourneyRoot.hidden = false; }
  function tourneyClosePanel(){ if(tourneyRoot) tourneyRoot.hidden = true; }

  function tourneyUpdatePanel(st){
    if (!st) return;
    const statusMap = {pending:'STARTING SOON',active:'LIVE',ended:'FINISHED',cancelled:'CANCELLED'};
    const statusColors = {pending:'#fbbf24',active:'#4dff88',ended:'#94a3b8',cancelled:'#f87171'};
    if(tourneyStatus){
      const label = st.joined && st.status==='pending' ? '✅ YOU\'RE IN' : (statusMap[st.status] || st.status);
      tourneyStatus.textContent = label;
      tourneyStatus.style.color = statusColors[st.status] || '#ffd700';
    }
    if(tourneyTimer){
      const sec = st.status==='pending' ? st.countdown_sec : st.remaining_sec;
      tourneyTimer.textContent = fmtTimerT(Math.max(0,sec));
      tourneyTimer.classList.toggle('tourney-urgent', st.status==='active' && sec <= 30);
    }
    if(tourneySB){
      if(st.status==='pending'){
        if(st.scoreboard && st.scoreboard.length){
          tourneySB.innerHTML = st.scoreboard.map(e => {
            const isMe = e.user_id === myUid;
            return '<li class="'+(isMe?'tourney-sb__me':'')+'">'+
              '<span class="tourney-sb__name">'+escHtmlT(e.user_name)+(isMe?' (you)':'')+'</span>'+
              '<span class="tourney-sb__solves" style="color:#4dff88">Ready</span></li>';
          }).join('');
        } else {
          tourneySB.innerHTML = '<li style="color:#888;text-align:center;padding:16px">Waiting for players...</li>';
        }
      } else if(st.scoreboard){
        tourneySB.innerHTML = st.scoreboard.map((e,i) => {
          const place = i+1;
          const placeIcons = {1:'🥇',2:'🥈',3:'🥉'};
          const isMe = e.user_id === myUid;
          return '<li class="'+(isMe?'tourney-sb__me':'')+'" style="transition:transform 0.3s ease">'+
            '<span class="tourney-sb__place tourney-sb__place--'+place+'">'+(placeIcons[place]||place)+'</span>'+
            '<span class="tourney-sb__name">'+escHtmlT(e.user_name)+(isMe?' (you)':'')+'</span>'+
            '<span class="tourney-sb__solves">'+e.solves+'</span></li>';
        }).join('');
      }
    }
    if(tourneyFooter && st.participant_count !== undefined){
      const extra = st.status==='pending' && st.joined ? ' &middot; Get ready!' : '';
      tourneyFooter.innerHTML = '<span style="color:#888;font-size:12px">'+st.participant_count+' player'+(st.participant_count!==1?'s':'')+extra+'</span>';
    }
  }

  function tourneyShowCelebration(results, participantCount){
    if (!tourneyCeleb || !results || !results.length || tourneyCelebShown) return;
    tourneyCelebShown = true;
    const champ = results[0];
    tourneyChamName.textContent = champ.user_name;
    tourneyChamStats.textContent = champ.solves + ' solves' + (participantCount ? ' | ' + participantCount + ' players' : '');
    const runners = results.slice(1);
    const medals = {2:'🥈',3:'🥉'};
    tourneyRunners.innerHTML = runners.map(r =>
      '<div class="tourney-runner"><span class="tourney-runner__medal">'+(medals[r.place]||'')+'</span>'+
      '<span class="tourney-runner__name">'+escHtmlT(r.user_name)+'</span>'+
      '<span class="tourney-runner__solves">'+r.solves+' solves</span></div>'
    ).join('');
    tourneyCeleb.style.display = 'flex';
    tourneyCeleb.style.pointerEvents = 'auto';
    const dismissCeleb = ()=>{
      tourneyCeleb.style.display = 'none';
      tourneyCeleb.style.pointerEvents = 'none';
      tourneyCelebShown = false;
      tourneyCeleb.removeEventListener('click', dismissCeleb);
    };
    tourneyCeleb.addEventListener('click', dismissCeleb);
    setTimeout(dismissCeleb, 10000);
  }

  let tourneyPollDelay = 30000;
  let tourneyNullCount = 0;

  async function tourneyPoll(){
    try{
      const res = await fetch('/api/tournament/state');
      if(!res.ok) return;
      const d = await res.json();
      if(!d.ok) return;
      tourneyState = d.tournament;
      if(!tourneyState){
        tourneyHideBanner(); tourneyClosePanel();
        tourneyNullCount++;
        if(tourneyNullCount > 3) tourneyPollDelay = Math.min(60000, tourneyPollDelay * 1.5);
        return;
      }
      tourneyNullCount = 0;
      if(tourneyState.game_type !== GAME_TYPE){ tourneyHideBanner(); return; }
      tourneyPollDelay = tourneyState.status === 'active' ? 2000 : 5000;
      if((tourneyState.status==='pending'||tourneyState.status==='active') && !tourneyDismissed){
        let txt;
        if(tourneyState.status==='pending'){
          txt = tourneyState.joined
            ? '✅ You\'re in! Starting in '+fmtTimerT(tourneyState.countdown_sec)+'...'
            : '🏆 Tournament starting in '+fmtTimerT(tourneyState.countdown_sec)+'!';
        } else {
          txt = '🏆 Tournament LIVE! '+fmtTimerT(tourneyState.remaining_sec)+' left';
        }
        tourneyShowBanner(txt, tourneyState.can_join);
        if(tourneyBannerTimer) tourneyBannerTimer.textContent = fmtTimerT(
          tourneyState.status==='pending' ? tourneyState.countdown_sec : tourneyState.remaining_sec
        );
        if(tourneyBanner) tourneyBanner.classList.toggle('tourney-banner--joined', !!tourneyState.joined);
      }
      if(tourneyState.joined && (tourneyState.status==='active' || tourneyState.status==='pending')) tourneyOpenPanel();
      tourneyUpdatePanel(tourneyState);
      if(tourneyState.status==='ended') tourneyHideBanner();
    }catch(_){}
  }

  function tourneyStartPolling(){
    if(tourneyPollTimer) return;
    tourneyPollDelay = 5000; tourneyNullCount = 0;
    tourneyPollLoop();
  }
  async function tourneyPollLoop(){
    await tourneyPoll();
    tourneyPollTimer = setTimeout(tourneyPollLoop, tourneyPollDelay);
  }
  function tourneyStopPolling(){
    if(tourneyPollTimer){ clearTimeout(tourneyPollTimer); tourneyPollTimer=null; }
  }

  function tourneyHandleInvite(msg){
    if(msg.game_type && msg.game_type !== GAME_TYPE) return;
    tourneyCelebShown = false; tourneyDismissed = false;
    tourneyShowBanner('🏆 '+escHtmlT(msg.created_by||'Admin')+' started a tournament! Starting soon...', true);
    tourneyStartPolling();
  }
  function tourneyHandleStart(msg){
    if(msg.game_type && msg.game_type !== GAME_TYPE) return;
    tourneyDismissed = false;
    tourneyShowBanner('🏆 Tournament is LIVE!', false);
    tourneyStartPolling();
  }
  function tourneyHandleEnd(msg){
    tourneyHideBanner();
    if(msg.results && msg.results.length) tourneyShowCelebration(msg.results, msg.participant_count);
    tourneyUpdatePanel(tourneyState);
    setTimeout(()=>{ tourneyClosePanel(); tourneyStopPolling(); tourneyState=null; }, 10000);
  }
  function tourneyHandleCancel(msg){
    tourneyHideBanner(); tourneyClosePanel(); tourneyStopPolling(); tourneyState=null;
    showToast('🏆 Tournament was cancelled.');
  }

  if(tourneyJoinBtn){
    tourneyJoinBtn.addEventListener('click', async ()=>{
      try{
        const res = await fetch('/api/tournament/join', {method:'POST', headers:{'Content-Type':'application/json'}});
        const d = await res.json();
        if(d.ok){
          tourneyJoinBtn.style.display = 'none';
          showToast('🏆 Joined the tournament!');
          tourneyPoll();
        } else if(d.error === 'TOO_LATE'){
          showToast('⏰ Too late to join! Catch the next one.');
        } else if(d.error === 'CHEATER_BLOCKED'){
          showToast('🚫 Cheaters cannot participate in tournaments.');
        }
      }catch(_){}
    });
  }
  if(tourneyDismissBtn){
    tourneyDismissBtn.addEventListener('click', ()=>{ tourneyDismissed=true; tourneyHideBanner(); });
  }
  if(tourneyRoot){
    tourneyRoot.addEventListener('click',(e)=>{
      if(e.target.dataset.close || e.target.closest('[data-close]')) tourneyClosePanel();
    });
  }
  if(tourneyBanner){
    tourneyBanner.addEventListener('click',(e)=>{
      if(e.target===tourneyJoinBtn||e.target===tourneyDismissBtn) return;
      if(tourneyState && tourneyState.joined) tourneyOpenPanel();
    });
  }
  if(isAuthed){ setTimeout(tourneyStartPolling, 3000); }

  // --- Tournament Admin Panel (super user only) ---
  const tourneyAdminBtn = document.getElementById('m67TourneyAdminBtn');
  const tourneyAdminRoot = document.getElementById('tourneyAdminRoot');
  if(tourneyAdminBtn && tourneyAdminRoot){
    const taStatusEl = document.getElementById('tourneyAdminStatus');
    const taCreateEl = document.getElementById('tourneyAdminCreate');
    const taBadgeEl = document.getElementById('tourneyAdminBadge');
    const taInfoEl = document.getElementById('tourneyAdminInfo');
    const taCancelBtn = document.getElementById('tourneyAdminCancelBtn');
    const taGameEl = document.getElementById('tourneyAdminGame');
    const taDurSlider = document.getElementById('tourneyAdminDuration');
    const taDurLabel = document.getElementById('tourneyAdminDurLabel');
    const taCdSlider = document.getElementById('tourneyAdminCountdown');
    const taCdLabel = document.getElementById('tourneyAdminCdLabel');
    const taLaunchBtn = document.getElementById('tourneyAdminLaunchBtn');
    const taNoteEl = document.getElementById('tourneyAdminNote');
    const taHistoryEl = document.getElementById('tourneyAdminHistory');
    const taPresetsEl = document.getElementById('tourneyAdminPresets');

    if(taGameEl) taGameEl.value = GAME_TYPE;

    function taFmtDur(s){ return Math.floor(s/60)+':'+(''+(s%60)).padStart(2,'0'); }

    if(taDurSlider && taDurLabel){
      taDurSlider.addEventListener('input', ()=>{
        taDurLabel.textContent = taFmtDur(+taDurSlider.value);
        if(taPresetsEl) taPresetsEl.querySelectorAll('.tourney-admin__preset').forEach(b=>b.classList.remove('tourney-admin__preset--active'));
      });
    }
    if(taCdSlider && taCdLabel){
      taCdSlider.addEventListener('input', ()=>{ taCdLabel.textContent = taFmtDur(+taCdSlider.value); });
    }
    if(taPresetsEl){
      taPresetsEl.addEventListener('click',(e)=>{
        const btn = e.target.closest('.tourney-admin__preset');
        if(!btn) return;
        taPresetsEl.querySelectorAll('.tourney-admin__preset').forEach(b=>b.classList.remove('tourney-admin__preset--active'));
        btn.classList.add('tourney-admin__preset--active');
        const sec = +btn.dataset.sec;
        if(taDurSlider){ taDurSlider.value = sec; }
        if(taDurLabel){ taDurLabel.textContent = taFmtDur(sec); }
      });
    }

    function taOpen(){
      tourneyAdminRoot.hidden = false;
      updateBodyLock();
      taRefreshStatus();
      taLoadHistory();
    }
    function taClose(){
      tourneyAdminRoot.hidden = true;
      updateBodyLock();
    }
    tourneyAdminBtn.addEventListener('click', taOpen);
    tourneyAdminRoot.addEventListener('click',(e)=>{
      if(e.target.dataset.close || e.target.closest('[data-close]')) taClose();
    });

    function taRefreshStatus(){
      fetch('/api/tournament/state').then(r=>r.json()).then(d=>{
        if(d.ok && d.status && d.status !== 'none'){
          taStatusEl.hidden = false;
          taCreateEl.style.display = 'none';
          taBadgeEl.textContent = d.status.toUpperCase();
          taBadgeEl.className = 'tourney-admin__status-badge tourney-admin__status-badge--' + d.status;
          const parts = [];
          if(d.game_type) parts.push('Game: '+(d.game_type==='make67'?'Make 67':'Make 6 or 7'));
          if(d.participant_count!=null) parts.push('Players: '+d.participant_count);
          if(d.remaining!=null) parts.push('Time: '+fmtTimerT(Math.max(0,d.remaining)));
          if(d.duration_sec) parts.push('Duration: '+taFmtDur(d.duration_sec));
          taInfoEl.innerHTML = parts.join('<br>');
        } else {
          taStatusEl.hidden = true;
          taCreateEl.style.display = '';
        }
      }).catch(()=>{
        taStatusEl.hidden = true;
        taCreateEl.style.display = '';
      });
    }

    taLaunchBtn.addEventListener('click', async ()=>{
      taNoteEl.textContent = '';
      taLaunchBtn.disabled = true;
      try{
        const body = {
          game_type: taGameEl.value,
          duration_sec: +taDurSlider.value,
          countdown_sec: +taCdSlider.value
        };
        const res = await fetch('/api/tournament/create',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify(body)
        });
        const d = await res.json();
        if(d.ok){
          taNoteEl.textContent = 'Tournament launched!';
          taNoteEl.style.color = '#4ade80';
          taRefreshStatus();
          tourneyStartPolling();
        } else {
          taNoteEl.textContent = d.error || 'Failed to create.';
          taNoteEl.style.color = '#f87171';
        }
      }catch(e){
        taNoteEl.textContent = 'Network error.';
        taNoteEl.style.color = '#f87171';
      }
      taLaunchBtn.disabled = false;
    });

    taCancelBtn.addEventListener('click', async ()=>{
      if(!confirm('Cancel the active tournament?')) return;
      try{
        const res = await fetch('/api/tournament/cancel',{method:'POST'});
        const d = await res.json();
        if(d.ok){
          showToast('Tournament cancelled.');
          taRefreshStatus();
        } else {
          showToast(d.error || 'Failed to cancel.');
        }
      }catch(_){ showToast('Network error.'); }
    });

    async function taLoadHistory(){
      try{
        const res = await fetch('/api/tournament/history');
        const d = await res.json();
        if(!d.ok || !d.tournaments || !d.tournaments.length){
          taHistoryEl.textContent = 'No tournaments yet.';
          return;
        }
        taHistoryEl.innerHTML = d.tournaments.map(t=>{
          const game = t.game_type==='make67'?'Make 67':'Make 6 or 7';
          const stat = t.status === 'ended' ? (t.champion ? 'Won by '+escHtmlT(t.champion) : 'Ended') : t.status;
          const dur = taFmtDur(t.duration_sec||0);
          const date = t.created_at ? new Date(t.created_at).toLocaleDateString() : '';
          return '<div class="tourney-admin__history-item">'+
            '<span class="tourney-admin__history-game">'+game+'</span> '+
            '<span class="tourney-admin__history-dur">'+dur+'</span> '+
            '<span class="tourney-admin__history-stat">'+stat+'</span> '+
            '<span class="tourney-admin__history-date">'+date+'</span>'+
            '</div>';
        }).join('');
      }catch(_){ taHistoryEl.textContent = 'Failed to load.'; }
    }
  }

  function tickState(){
    if (!isAuthed) return;
    if (effects && (effects.invisible>0 || effects.boost>0 || effects.mud>0 || effects.shield>0)){
      // decrement locally for display smoothness
      effects.invisible = Math.max(0, (effects.invisible||0)-1);
      effects.boost = Math.max(0, (effects.boost||0)-1);
      effects.mud = Math.max(0, (effects.mud||0)-1);
      effects.shield = Math.max(0, (effects.shield||0)-1);
      updateEffectsSummary(effects);
    }
  }

  // --- Init shop/inventory polling (pauses when tab is hidden) ---
  let _tickId = null, _loadId = null, _lbId = null;
  function _startPolling(){
    if (!_tickId) _tickId = setInterval(()=>{ tickState(); }, 1000);
    if (!_loadId) _loadId = setInterval(()=>{ loadState(); }, 8000);
    if (!_lbId)   _lbId   = setInterval(()=>{ loadLeaderboard(); }, 15000);
  }
  function _stopPolling(){
    if (_tickId){ clearInterval(_tickId); _tickId = null; }
    if (_loadId){ clearInterval(_loadId); _loadId = null; }
    if (_lbId)  { clearInterval(_lbId);   _lbId = null; }
  }
  _startPolling();

  document.addEventListener('visibilitychange', ()=>{
    if (document.hidden){
      _stopPolling();
    } else {
      loadState();
      loadLeaderboard();
      _startPolling();
    }
  });

  // --- Mobile Navigation Drawer ---
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileNavDrawer = document.getElementById('mobileNavDrawer');
  const mobileThemeLink = document.getElementById('mobileThemeLink');

  function openMobileNav(){
    if (!mobileNavDrawer) return;
    mobileNavDrawer.hidden = false;
    if (mobileMenuBtn) mobileMenuBtn.setAttribute('aria-expanded', 'true');
    // Sync theme link visibility
    if (mobileThemeLink){
      const t = (typeof allTime === 'number') ? allTime : 0;
      mobileThemeLink.style.display = t >= 1500 ? '' : 'none';
    }
    updateBodyLock();
  }
  function closeMobileNav(){
    if (!mobileNavDrawer) return;
    mobileNavDrawer.hidden = true;
    if (mobileMenuBtn) mobileMenuBtn.setAttribute('aria-expanded', 'false');
    updateBodyLock();
  }
  if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', openMobileNav);
  if (mobileNavDrawer){
    mobileNavDrawer.addEventListener('click', (e)=>{
      const t = e.target;
      // Close on backdrop or close button
      if (t.getAttribute && t.getAttribute('data-close-nav')==='1') closeMobileNav();
      // Handle action buttons
      const action = t.getAttribute && t.getAttribute('data-action');
      if (action){
        closeMobileNav();
        switch(action){
          case 'inventory': openInventory(); break;
          case 'shop': openShop(); break;
          case 'chat':
            if (chatOverlay){ chatOverlay.hidden = false; updateBodyLock(); }
            break;
          case 'leaderboard':
            if (panelLeft) panelLeft.classList.toggle('mobile-visible');
            break;
          case 'sound': openSoundMenu(); break;
          case 'theme': openThemeMenu(); break;
          case 'tourney-admin':
            if(tourneyAdminBtn) tourneyAdminBtn.click();
            break;
        }
      }
    });
  }

  // --- Events polling (for real-time effects from other players) ---
  let eventsPollTimer = 0;
  let eventsPollDelay = 10000;
  let eventsLastSeq = 0;

  function handleIncomingEvent(msg){
    try {
      if (!msg || !msg.type) return;
      if (msg.type === 'divine_shield'){
        const uid = String(msg.user_id || '');
        if (!uid) return;
        const li = lbList && lbList.querySelector ? lbList.querySelector(`li.m67-lb-item[data-user-id="${uid}"]`) : null;
        if (li){
          try { li.classList.add('shielded'); li.classList.remove('mudded'); } catch(_){}
          const endsIn = Number(msg.ends_in || 0);
          if (endsIn > 0) setTimeout(()=>{ try{ li.classList.remove('shielded'); }catch(_){} }, Math.min(endsIn, 600) * 1000);
        }
      }
      if (msg.type === 'clown_horn'){
        if (String(msg.target_id || '') === myUid) showClownRain();
        else showToast('🤡 ' + (msg.user_name||'Someone') + ' honked at ' + (msg.target_name||'someone') + '!');
      }
      if (msg.type === 'earthquake') showEarthquake(msg.user_name || 'Someone');
      if (msg.type === 'reverse_card'){
        const attackerId = String(msg.attacker_id || '');
        const targetId = String(msg.target_id || '');
        if (attackerId === myUid){ showReverseCard(); showToast('🔄 Your mud was REVERSED!'); }
        else if (targetId === myUid) showToast('🔄 Your Reverse Card activated!');
        else showToast('🔄 ' + (msg.target_name||'Someone') + " reversed " + (msg.attacker_name||"someone") + "'s mud!");
      }
      if (msg.type === 'double_or_nothing' && String(msg.user_id || '') !== myUid){
        if (msg.won) showToast('🎲 ' + (msg.user_name||'Someone') + ' won +' + msg.delta + ' solves!');
        else showToast('🎲 ' + (msg.user_name||'Someone') + ' lost ' + msg.delta + ' solves...');
      }
      if (msg.type === 'banana_peel' && String(msg.target_id || '') === myUid) showToast('🍌 Someone placed a banana peel under you...');
      if (msg.type === 'banana_slip' && String(msg.user_id || '') !== myUid) showToast('🍌 ' + (msg.user_name||'Someone') + ' slipped on a banana peel!');
      // Tournament events
      if (msg.type === 'tournament_invite') tourneyHandleInvite(msg);
      if (msg.type === 'tournament_start') tourneyHandleStart(msg);
      if (msg.type === 'tournament_end') tourneyHandleEnd(msg);
      if (msg.type === 'tournament_cancel') tourneyHandleCancel(msg);
    } catch(_){}
  }

  function scheduleNextEventsPoll(delay){
    clearTimeout(eventsPollTimer);
    eventsPollTimer = setTimeout(eventsPollLoop, delay);
  }

  async function eventsPollLoop(){
    if (!isAuthed){ clearTimeout(eventsPollTimer); eventsPollTimer = 0; return; }
    const delay = document.hidden ? Math.max(15000, eventsPollDelay) : eventsPollDelay;
    try {
      const res = await fetch(`/api/make67/events/poll?since=${encodeURIComponent(String(eventsLastSeq||0))}`);
      const data = await res.json().catch(()=>({ok:false}));
      if (data && data.ok){
        const evs = Array.isArray(data.events) ? data.events : [];
        for (const e of evs) handleIncomingEvent(e);
        const ls = Number(data.last_seq || eventsLastSeq || 0);
        if (!Number.isNaN(ls)) eventsLastSeq = Math.max(eventsLastSeq||0, ls);
        eventsPollDelay = 10000 + Math.floor(Math.random()*3000);
      } else {
        eventsPollDelay = Math.min(60000, (eventsPollDelay||10000) * 1.5);
      }
    } catch(_){
      eventsPollDelay = Math.min(60000, (eventsPollDelay||10000) * 1.5);
    }
    scheduleNextEventsPoll(delay);
  }

  function ensureEventsStream(){
    if (eventsPollTimer || !isAuthed) return;
    eventsPollDelay = 10000 + Math.floor(Math.random()*3000);
    scheduleNextEventsPoll(0);
    window.addEventListener('beforeunload', ()=>{ try{ clearTimeout(eventsPollTimer); }catch(_){} });
  }

  // Initialize
  loadLeaderboard();
  newPuzzle();
  applyEmpowerment();
  initColorTheme();
  loadShop();
  setTimeout(()=>{ loadState(); }, 1200);
  setTimeout(()=>{ ensureEventsStream(); }, 2000);
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
  let chatDelay = 2000;
  const CHAT_DELAY_MIN = 2000;
  const CHAT_DELAY_MAX = 30000;
  async function pollLoop(){
    while (polling){
      try {
        const res = await fetch(`/api/make6or7/chat/since?last_id=${lastId}`);
        if (res.ok){
          chatDelay = CHAT_DELAY_MIN; // reset on success
          const items = await res.json();
          if (Array.isArray(items)){
            for (const m of items){
              appendMessage(m);
              if (typeof m.id === 'number' && m.id > lastId) lastId = m.id;
            }
          }
        } else {
          chatDelay = Math.min(chatDelay * 1.5, CHAT_DELAY_MAX);
        }
      } catch (_){
        chatDelay = Math.min(chatDelay * 1.5, CHAT_DELAY_MAX);
      }
      // Longer interval when tab hidden
      const delay = document.hidden ? Math.max(chatDelay, 10000) : chatDelay;
      await new Promise(r=>setTimeout(r, delay));
    }
  }
  pollLoop();

  // Pause/resume chat polling on tab visibility
  document.addEventListener('visibilitychange', ()=>{
    if (document.hidden){
      polling = false;
    } else if (!polling){
      polling = true;
      pollLoop();
    }
  });

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
