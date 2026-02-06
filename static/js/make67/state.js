/**
 * make67/state.js - Shared state and DOM element references
 */

// DOM Elements (populated by init)
export const dom = {
  cardsEl: null,
  opsEl: null,
  resetBtn: null,
  hintEl: null,
  scoreEl: null,
  allTimeEl: null,
  overlayRoot: null,
  nextBtn: null,
  hintBtn: null,
  lbList: null,
  allTimeBoxEl: null,
  sessionBoxEl: null,
  pageRoot: null,
  bannedBtn: null,
  bannedRoot: null,
  bannedListEl: null,
  soundBtn: null,
  themeBtn: null,
  invBtn: null,
  shopBtn: null,
  btnToggleChat: null,
  chatOverlay: null,
  btnMobileRank: null,
  panelLeft: null,
  invModalRoot: null,
  shopModalRoot: null,
  rankUpOverlayEl: null,
  rankUpNamesEl: null,
  rankUpFlavorEl: null,
  invRoot: null,
  shopRoot: null,
  effectsRoot: null,
  shopNoteEl: null,
  chatLogEl: null,
  chatFormEl: null,
  chatInputEl: null,
};

// Game state
export const game = {
  baseCards: [],
  curCards: [],
  removed: new Set(),
  selectedIndex: null,
  selectedOp: null,
  score: 0,
  currentHint: '',
  hintUsed: false,
  hintTimer: null,
};

// User state
export const user = {
  myUid: '',
  isAuthed: false,
  allTime: null,
  lastKnownRankKey: null,
  lastKnownRankTitle: null,
  lastKnownAllTime: null,
};

// Shop/inventory state
export const shop = {
  catalog: [],
  inventory: [],
  effects: { invisible: 0, boost: 0, mud: 0, shield: 0 },
  stateTimer: null,
  lastStateVersion: 0,
  stateBlockUntil: 0,
  stateReqSeq: 0,
  stateReqApplied: 0,
};

// Leaderboard state
export const leaderboard = {
  bannedCache: [],
  prevLBHash: '',
};

// Theme state
export const theme = {
  currentEmp: 0,
  prefersReducedMotion: false,
  menuEl: null,
};

// Sound state
export const sound = {
  menuEl: null,
  lastShieldSfxAt: 0,
};

// Events/polling state
export const events = {
  lastSeq: 0,
  pollTimer: 0,
  pollDelay: 10000,
};

// Chat state
export const chat = {
  lastId: 0,
  polling: true,
  pollDelay: 2000,
};

// FX state
export const fx = {
  app: null,
  emitters: null,
};

// Initialize DOM references
export function initDom() {
  dom.cardsEl = Array.from(document.querySelectorAll('.make67-page .card'));
  dom.opsEl = Array.from(document.querySelectorAll('.make67-page .op-btn[data-op]'));
  dom.resetBtn = document.getElementById('resetBtn');
  dom.hintEl = document.getElementById('m67Hint');
  dom.scoreEl = document.getElementById('m67Score');
  dom.allTimeEl = document.getElementById('m67AllTime');
  dom.overlayRoot = document.querySelector('.m67-overlay-root');
  dom.nextBtn = document.getElementById('nextPuzzleBtn');
  dom.hintBtn = document.getElementById('hintBtn');
  dom.lbList = document.getElementById('m67Leaderboard');
  dom.allTimeBoxEl = dom.allTimeEl ? dom.allTimeEl.closest('.score-box') : null;
  dom.sessionBoxEl = dom.scoreEl ? dom.scoreEl.closest('.score-box') : null;
  dom.pageRoot = document.querySelector('.page.make67-page');
  dom.bannedBtn = document.getElementById('m67BannedBtn');
  dom.bannedRoot = document.querySelector('.m67-ban-root');
  dom.bannedListEl = document.getElementById('m67BannedList');
  dom.soundBtn = document.getElementById('m67SoundBtn');
  dom.themeBtn = document.getElementById('m67ThemeBtn');
  dom.invBtn = document.getElementById('m67InvBtn');
  dom.shopBtn = document.getElementById('m67ShopBtn');
  dom.btnToggleChat = document.getElementById('btn-toggle-chat');
  dom.chatOverlay = document.getElementById('chat-overlay');
  dom.btnMobileRank = document.getElementById('btn-mobile-rank');
  dom.panelLeft = document.querySelector('.panel-left');
  dom.invModalRoot = document.querySelector('.m67-inv-root');
  dom.shopModalRoot = document.querySelector('.m67-shop-root');
  dom.rankUpOverlayEl = document.getElementById('rankUpOverlay');
  dom.rankUpNamesEl = document.getElementById('rankUpNames');
  dom.rankUpFlavorEl = document.getElementById('rankUpFlavor');
  dom.invRoot = document.getElementById('m67Inv');
  dom.shopRoot = document.getElementById('m67ShopList');
  dom.effectsRoot = document.getElementById('m67Effects');
  dom.shopNoteEl = document.getElementById('m67ShopNote');
  dom.chatLogEl = document.getElementById('m67ChatLog');
  dom.chatFormEl = document.getElementById('m67ChatForm');
  dom.chatInputEl = document.getElementById('m67ChatInput');

  // Get user ID from body data attribute
  user.myUid = (document.body?.dataset?.userId) ? String(document.body.dataset.userId) : '';

  // Check reduced motion preference
  theme.prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
}
