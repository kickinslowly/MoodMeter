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
    if (sec <= 0) return '0s';
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
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
    { id: 'prismatic', label: 'Prismatic', threshold: 4000, icon: '🌈' }
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
      const av = Math.abs(val);
      if (Math.abs(av - 6) <= TOL || Math.abs(av - 7) <= TOL){
        // success
        score += 1;
        if (scoreEl) scoreEl.textContent = String(score);
        try{
          overlayRoot.hidden = false;
          const panel = document.querySelector('.m67-overlay__panel');
          if (panel){ panel.style.transform = 'scale(1.0)'; setTimeout(()=>{ panel.style.transform = ''; }, 200); }
          playSolveSound();
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

  const FLAVOR_TEXTS = [
    "BRAIN EXPANDING...",
    "KNOWLEDGE ASCENDING...",
    "MAXIMUM COGNITION...",
    "NEURONS FIRING...",
    "ABSOLUTE UNIT...",
    "CRITICAL THINKING++",
    "GIGABRAIN MOMENT...",
    "UNSTOPPABLE FORCE...",
    "PEAK PERFORMANCE..."
  ];

  function triggerRankHype(oldTitle, newTitle) {
    if (!rankUpOverlayEl) return;

    // Set titles
    if (rankUpNamesEl) {
      rankUpNamesEl.textContent = `${(oldTitle || 'NOOB').toUpperCase()} → ${(newTitle || 'ROOKIE').toUpperCase()}`;
    }

    // Set random flavor text
    if (rankUpFlavorEl) {
      rankUpFlavorEl.textContent = randomChoice(FLAVOR_TEXTS);
    }

    // Show overlay
    rankUpOverlayEl.style.display = 'flex';

    // Generate particles
    const emojis = ['💯', '🔥', '🧠', '🦍', '🆙', '🚨', '💎', '📈', '🤪', '🤩'];
    const particleCount = 30;
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

    // Auto-cleanup after 3.5s
    setTimeout(() => {
      rankUpOverlayEl.style.display = 'none';
      container.querySelectorAll('.rank-up-emoji').forEach(el => el.remove());
    }, 3500);
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
    const el = document.querySelector('.xmas-title');
    if (!el) return;
    el.classList.add('celebrate-spark');
    setTimeout(()=> el.classList.remove('celebrate-spark'), 1000);
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
      for (let i=0; i<items.length; i++){
        const u = items[i];
        lbList.appendChild(makeLiUser(u, false, i));
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
    if (!effectsRoot) return;
    effectsRoot.innerHTML = '';
    const parts = [];
    if (fx.invisible > 0) parts.push(`Invisible (${fmtTime(fx.invisible)})`);
    if (fx.boost > 0) parts.push(`Boost (${fmtTime(fx.boost)})`);
    if (fx.mud > 0) parts.push(`Mud (${fmtTime(fx.mud)})`);
    if (fx.shield > 0) parts.push(`Shield (${fmtTime(fx.shield)})`);

    if (parts.length === 0){
      const empty = document.createElement('span');
      empty.textContent = 'No active effects';
      empty.style.opacity = '0.5';
      effectsRoot.appendChild(empty);
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
    try {
      const r = await fetch('/api/make6or7/state');
      if (!r.ok) return;
      const data = await r.json();
      if (!data || !data.ok) return;
      const st = data.state || {};
      allTime = Number(st.currency||0);
      if (allTimeEl) allTimeEl.textContent = String(allTime);
      inventory = Array.isArray(st.inventory) ? st.inventory : [];
      effects = st.effects || {};
      renderInventory();
      updateEffectsSummary(effects);
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
        loadState();
      } else {
        const err = d.error || '';
        if (shopNoteEl) shopNoteEl.textContent = (err==='INVENTORY_FULL')? 'Inventory full.' : (err==='INSUFFICIENT_FUNDS')? 'Not enough solves.' : 'Buy failed.';
      }
    } catch(_){ }
  }

  async function useItem(it){
    hideTip();
    try {
      let target_id = null;
      if (it.key === 'mud'){
        target_id = await pickMudTarget();
        if (!target_id) return;
      }
      const r = await fetch('/api/make6or7/use', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({item_id: it.id, target_id})
      });
      const d = await r.json().catch(()=>({ok:false}));
      if (d.ok){
        if (it.key === 'mud') play('snd_item_mud');
        else if (it.key === 'boost') play('snd_item_boost');
        else if (it.key === 'sneaky_dust') play('snd_item_dust');
        else if (it.key === 'divine_shield') play('snd_item_shield');
        loadState();
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
        if (chatOverlay && chatOverlay.style.display !== 'none') { chatOverlay.style.display = 'none'; }
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
          return;
        }
        // Optimistic FX: add mudded look
        li.classList.add('mudded');
        throwMudTo(li);
        try { sparkAt(li, 4); } catch(_){ }
        cleanup();
        resolve(id);
      }
      lbList.addEventListener('click', onClick, true);

      function onKey(e){ if (e.key === 'Escape'){ cleanup(); resolve(null); } }
      document.addEventListener('keydown', onKey);
      function onBackdrop(e){
        if (e.target === overlay) { cleanup(); resolve(null); }
      }
      document.addEventListener('click', onBackdrop, true);
    });
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
    // Unlocked themes
    COLOR_THEME_OPTIONS.forEach(o => {
      const unlocked = t >= o.threshold;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('role','option');
      btn.setAttribute('aria-selected', String(pref === o.id));
      btn.disabled = !unlocked;
      btn.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:8px 10px;margin:2px 0;background:' + (pref === o.id ? 'rgba(159,227,181,.12)' : 'transparent') + ';border:1px solid ' + (pref === o.id ? 'var(--selected-outline,#3aa876)' : 'transparent') + ';color:' + (unlocked ? '#e6ebf5' : '#666') + ';border-radius:8px;cursor:' + (unlocked ? 'pointer' : 'not-allowed') + ';font-size:14px;opacity:' + (unlocked ? '1' : '0.5') + ';';
      const labelText = unlocked ? o.label : o.label + ' (' + o.threshold + ' pts)';
      btn.innerHTML = '<span>' + o.icon + ' ' + labelText + '</span><span style="opacity:.9;color:#9fe3b5;">' + (pref === o.id ? '✓' : '') + '</span>';
      if (unlocked){
        btn.addEventListener('click', ()=>{
          setPreferredColorTheme(o.id);
          applyColorTheme(o.id);
          renderThemeMenu();
          setTimeout(closeThemeMenu, 50);
        });
      }
      el.appendChild(btn);
    });
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

  // --- Init shop/inventory polling ---
  setInterval(()=>{ tickState(); }, 1000);
  setInterval(()=>{ loadState(); }, 8000);
  setInterval(()=>{ loadLeaderboard(); }, 15000);

  // Initialize
  loadLeaderboard();
  newPuzzle();
  applyEmpowerment();
  initColorTheme();
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
