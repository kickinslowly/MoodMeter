/*
  TuffGamez Homepage Stick Figure Platformer
  - Runs along the bottom of the screen
  - Double jumps, climbs cards
  - Canvas overlay with pointer-events: none so cards stay clickable
*/
(function () {
  'use strict';

  // Only run on the home page
  if (!document.querySelector('.home-page')) return;
  // Skip on mobile (no keyboard)
  if (window.innerWidth < 768) return;

  // ─── Constants ──────────────────────────────────────────────
  const P = {
    GRAVITY:         1400,
    JUMP_VEL:        -800,
    DOUBLE_JUMP_VEL: -680,
    MOVE_SPEED:      250,
    CLIMB_SPEED:     140,
    SHIMMY_SPEED:    110,
    FRICTION:        0.85,
    AIR_CONTROL:     0.65,
    GROUND_MARGIN:   20,
    FIG_H:           36,
    FIG_W:           16,
    HEAD_R:          5,
  };

  // ─── Canvas Setup ───────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.id = 'stickman-canvas';
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:999;';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    _cardsDirty = true;
  }
  window.addEventListener('resize', resize);
  window.addEventListener('scroll', function () { _cardsDirty = true; }, { passive: true });
  resize();

  // ─── Player State ───────────────────────────────────────────
  const player = {
    x: window.innerWidth / 2,
    y: window.innerHeight - P.GROUND_MARGIN,
    prevX: window.innerWidth / 2,
    prevY: window.innerHeight - P.GROUND_MARGIN,
    vx: 0,
    vy: 0,
    facing: 1,        // 1 right, -1 left
    state: 'IDLE',
    hasDoubleJump: true,
    onCard: null,
    cardSide: null,    // 'left' | 'right'
    animTimer: 0,
    stateTimer: 0,
  };

  // ─── Input ──────────────────────────────────────────────────
  const keys = new Set();
  const justPressed = new Set();

  function isFormEl(el) {
    return el && (el.tagName === 'INPUT' || el.tagName === 'BUTTON' ||
                  el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.tagName === 'A');
  }

  window.addEventListener('keydown', function (e) {
    if (isFormEl(e.target)) return;
    const k = e.key.toLowerCase();
    if (['arrowleft','arrowright','arrowup','arrowdown','a','d','w','s',' '].includes(k)) {
      e.preventDefault();
      if (!keys.has(k)) justPressed.add(k);
      keys.add(k);
    }
  });
  window.addEventListener('keyup', function (e) {
    keys.delete(e.key.toLowerCase());
  });

  function wantLeft()  { return keys.has('arrowleft')  || keys.has('a'); }
  function wantRight() { return keys.has('arrowright') || keys.has('d'); }
  function wantUp()    { return keys.has('arrowup')    || keys.has('w'); }
  function wantDown()  { return keys.has('arrowdown')  || keys.has('s'); }
  function moveDir()   { return wantRight() ? 1 : wantLeft() ? -1 : 0; }

  function jpJump() { return justPressed.has(' ') || justPressed.has('w') || justPressed.has('arrowup'); }

  // ─── Card Rects (cached – updated only on resize/scroll) ────
  var _cardEls = null;
  var _cachedCards = null;
  var _cardsDirty = true;

  function _rebuildCardCache() {
    if (!_cardEls) _cardEls = document.querySelectorAll('.home-card');
    _cachedCards = Array.from(_cardEls).map(function (el) {
      var r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom,
               width: r.width, height: r.height,
               cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    });
    _cardsDirty = false;
  }

  function getCards() {
    if (_cardsDirty || !_cachedCards) _rebuildCardCache();
    return _cachedCards;
  }

  // ─── Ground ─────────────────────────────────────────────────
  function groundY() { return window.innerHeight - P.GROUND_MARGIN; }

  function isOnSurface() {
    return player.state === 'IDLE' || player.state === 'RUNNING' || player.state === 'STANDING_ON_TOP';
  }

  // ─── Jump ───────────────────────────────────────────────────
  function doJump() {
    if (isOnSurface()) {
      player.vy = P.JUMP_VEL;
      player.state = 'JUMPING';
      player.hasDoubleJump = true;
      player.onCard = null;
    } else if ((player.state === 'JUMPING' || player.state === 'FALLING' || player.state === 'DOUBLE_JUMPING') && player.hasDoubleJump) {
      player.vy = P.DOUBLE_JUMP_VEL;
      player.state = 'DOUBLE_JUMPING';
      player.hasDoubleJump = false;
    } else if (player.state === 'HANGING_BOTTOM') {
      player.vy = P.JUMP_VEL * 0.7;
      player.state = 'JUMPING';
      player.hasDoubleJump = true;
      player.onCard = null;
    } else if (player.state === 'CLIMBING_SIDE') {
      // wall jump: push away from the card
      var push = player.cardSide === 'left' ? -1 : 1;
      player.vx = push * P.MOVE_SPEED * 1.3;
      player.vy = P.JUMP_VEL * 0.85;
      player.state = 'JUMPING';
      player.hasDoubleJump = true;
      player.onCard = null;
      player.facing = push;
    }
  }

  // ─── Physics Update ─────────────────────────────────────────
  function updatePhysics(dt) {
    var md = moveDir();
    var gY = groundY();

    if (player.state === 'HANGING_BOTTOM') {
      player.x += md * P.SHIMMY_SPEED * dt;
      if (md !== 0) player.facing = md;
      if (player.onCard) {
        var c = player.onCard;
        // shimmied past edge → climb that side
        if (player.x <= c.left) {
          player.x = c.left - P.FIG_W / 2;
          player.cardSide = 'left';
          player.facing = 1;
          player.state = 'CLIMBING_SIDE';
          return;
        }
        if (player.x >= c.right) {
          player.x = c.right + P.FIG_W / 2;
          player.cardSide = 'right';
          player.facing = -1;
          player.state = 'CLIMBING_SIDE';
          return;
        }
        player.x = Math.max(c.left + 4, Math.min(c.right - 4, player.x));
      }
      if (wantDown()) {
        player.state = 'FALLING';
        player.onCard = null;
        player.vy = 0;
      }
      return;
    }

    if (player.state === 'CLIMBING_SIDE') {
      var climbDir = wantUp() ? -1 : wantDown() ? 1 : 0;
      player.y += climbDir * P.CLIMB_SPEED * dt;
      if (player.onCard) {
        var c = player.onCard;
        var halfW = P.FIG_W / 2;
        // pin to card side
        if (player.cardSide === 'left') {
          player.x = c.left - halfW;
          player.facing = 1;
        } else {
          player.x = c.right + halfW;
          player.facing = -1;
        }
        // reached top → stand on card
        if (player.y - P.FIG_H <= c.top) {
          player.y = c.top;
          player.x = player.cardSide === 'left' ? c.left + halfW + 4 : c.right - halfW - 4;
          player.state = 'STANDING_ON_TOP';
        }
        // went past bottom → fall off
        if (player.y > c.bottom + P.FIG_H + 4) {
          player.state = 'FALLING';
          player.onCard = null;
          player.vy = 0;
        }
        // clamp while climbing
        if (player.state === 'CLIMBING_SIDE') {
          var minY = c.top + P.FIG_H;
          var maxY = c.bottom + P.FIG_H;
          player.y = Math.max(minY, Math.min(maxY, player.y));
        }
      }
      return;
    }

    // Normal states: IDLE, RUNNING, JUMPING, DOUBLE_JUMPING, FALLING, STANDING_ON_TOP
    var onSurface = isOnSurface();
    if (md !== 0) {
      player.facing = md;
      var ctrl = onSurface ? 1.0 : P.AIR_CONTROL;
      player.vx = md * P.MOVE_SPEED * ctrl;
    } else if (onSurface) {
      player.vx *= P.FRICTION;
      if (Math.abs(player.vx) < 5) player.vx = 0;
    }

    // gravity
    if (!onSurface) {
      player.vy += P.GRAVITY * dt;
    }

    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // ground
    if (player.y >= gY) {
      player.y = gY;
      player.vy = 0;
      player.hasDoubleJump = true;
      if (!onSurface) {
        player.state = Math.abs(player.vx) > 10 ? 'RUNNING' : 'IDLE';
      }
      player.onCard = null;
    }

    // horizontal wrap
    if (player.x < -30) player.x = window.innerWidth + 30;
    if (player.x > window.innerWidth + 30) player.x = -30;
  }

  // ─── Collision Detection ────────────────────────────────────
  // Uses previous-position to determine entry direction (much more
  // reliable than minimum-penetration when the character moves fast).
  function checkCollisions(cards) {
    if (player.state === 'HANGING_BOTTOM' || player.state === 'CLIMBING_SIDE') return;

    var halfW = P.FIG_W / 2;

    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];

      // Current player AABB
      var pLeft  = player.x - halfW;
      var pRight = player.x + halfW;
      var pTop   = player.y - P.FIG_H;
      var pBot   = player.y;

      // No overlap → skip
      if (pRight <= c.left || pLeft >= c.right || pBot <= c.top || pTop >= c.bottom) continue;

      // Previous-frame player AABB
      var prevLeft  = player.prevX - halfW;
      var prevRight = player.prevX + halfW;
      var prevTop   = player.prevY - P.FIG_H;
      var prevBot   = player.prevY;

      // Determine which side the player entered from
      var wasLeft  = prevRight <= c.left  + 2;
      var wasRight = prevLeft  >= c.right - 2;
      var wasAbove = prevBot   <= c.top   + 2;
      var wasBelow = prevTop   >= c.bottom - 2;

      if (wasAbove && player.vy >= 0) {
        // Entered from above → land on top
        player.y = c.top;
        player.vy = 0;
        player.onCard = c;
        player.hasDoubleJump = true;
        player.state = Math.abs(player.vx) > 10 ? 'RUNNING' : 'STANDING_ON_TOP';
      } else if (wasBelow && player.vy <= 0) {
        // Entered from below → hang on bottom
        player.y = c.bottom + P.FIG_H;
        player.vy = 0;
        player.vx = 0;
        player.onCard = c;
        player.state = 'HANGING_BOTTOM';
      } else if (wasLeft) {
        // Entered from the left → grab left side
        player.x = c.left - halfW;
        player.vx = 0;
        player.vy = 0;
        player.onCard = c;
        player.cardSide = 'left';
        player.facing = 1;
        player.state = 'CLIMBING_SIDE';
      } else if (wasRight) {
        // Entered from the right → grab right side
        player.x = c.right + halfW;
        player.vx = 0;
        player.vy = 0;
        player.onCard = c;
        player.cardSide = 'right';
        player.facing = -1;
        player.state = 'CLIMBING_SIDE';
      } else {
        // Fallback (spawned inside or multi-axis overlap) → use penetration
        var overlapLeft   = pRight - c.left;
        var overlapRight  = c.right - pLeft;
        var overlapTop    = pBot - c.top;
        var overlapBottom = c.bottom - pTop;
        var minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

        if (minOverlap === overlapTop) {
          player.y = c.top; player.vy = 0;
          player.onCard = c; player.hasDoubleJump = true;
          player.state = 'STANDING_ON_TOP';
        } else if (minOverlap === overlapBottom) {
          player.y = c.bottom + P.FIG_H; player.vy = 0;
        } else if (minOverlap === overlapLeft) {
          player.x = c.left - halfW; player.vx = 0;
          player.onCard = c; player.cardSide = 'left';
          player.facing = 1; player.state = 'CLIMBING_SIDE';
        } else {
          player.x = c.right + halfW; player.vx = 0;
          player.onCard = c; player.cardSide = 'right';
          player.facing = -1; player.state = 'CLIMBING_SIDE';
        }
      }
      return;
    }

    // walked off card top
    if ((player.state === 'STANDING_ON_TOP' || player.state === 'RUNNING') && player.onCard) {
      var card = player.onCard;
      if (player.x < card.left - 4 || player.x > card.right + 4) {
        player.onCard = null;
        player.state = 'FALLING';
      }
    }
  }

  // ─── State Update ───────────────────────────────────────────
  function updateState(dt) {
    player.animTimer += dt;
    player.stateTimer += dt;

    // idle <-> running
    if (player.state === 'IDLE' || player.state === 'STANDING_ON_TOP') {
      if (moveDir() !== 0) {
        player.state = 'RUNNING';
      }
    }
    if (player.state === 'RUNNING' && Math.abs(player.vx) < 5 && moveDir() === 0) {
      player.state = player.onCard ? 'STANDING_ON_TOP' : 'IDLE';
    }

    // jump apex -> falling
    if (player.state === 'JUMPING' && player.vy > 0) player.state = 'FALLING';
    if (player.state === 'DOUBLE_JUMPING' && player.vy > 0) player.state = 'FALLING';
  }

  // ─── Drawing ────────────────────────────────────────────────
  function drawStickFigure() {
    var x = player.x, y = player.y;
    var h = P.FIG_H, hr = P.HEAD_R, hw = P.FIG_W / 2;
    var f = player.facing, t = player.animTimer;

    ctx.save();
    ctx.strokeStyle = '#e6e6ea';
    ctx.fillStyle = '#e6e6ea';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    var headCY = y - h + hr;
    var neckY  = y - h + hr * 2 + 2;
    var shoulderY = neckY + 2;
    var hipY   = y - h * 0.35;
    var armLen = h * 0.28;
    var legLen = h * 0.35;

    // pose angles
    var la = 0, ra = 0, ll = 0, rl = 0, tilt = 0;

    switch (player.state) {
      case 'RUNNING':
        var cyc = Math.sin(t * 10);
        ll = cyc * 0.5;  rl = -cyc * 0.5;
        la = -cyc * 0.4; ra = cyc * 0.4;
        tilt = f * 0.06;
        break;
      case 'JUMPING':
      case 'DOUBLE_JUMPING':
        la = -0.8; ra = -0.8;
        ll = 0.3;  rl = -0.3;
        break;
      case 'FALLING':
        la = -0.5; ra = 0.5;
        ll = 0.15; rl = -0.15;
        break;
      case 'HANGING_BOTTOM':
        la = -Math.PI * 0.8;
        ra = -Math.PI * 0.8;
        var sw = Math.sin(t * 3) * 0.15;
        ll = sw; rl = -sw;
        break;
      case 'CLIMBING_SIDE':
        var climbCyc = Math.sin(t * 5);
        if (f === 1) { la = -Math.PI * 0.55 + climbCyc * 0.15; ra = -Math.PI * 0.25 - climbCyc * 0.15; }
        else         { ra = -Math.PI * 0.55 + climbCyc * 0.15; la = -Math.PI * 0.25 - climbCyc * 0.15; }
        ll = climbCyc * 0.2; rl = -climbCyc * 0.2;
        break;
      case 'IDLE':
      case 'STANDING_ON_TOP':
      default:
        var bob = Math.sin(t * 2) * 0.05;
        la = bob; ra = -bob;
        break;
    }

    // body spine
    var hipX = x + Math.sin(tilt) * (hipY - neckY);
    ctx.beginPath(); ctx.moveTo(x, neckY); ctx.lineTo(hipX, hipY); ctx.stroke();

    // head
    ctx.beginPath(); ctx.arc(x, headCY, hr, 0, Math.PI * 2); ctx.stroke();

    // left arm
    var lsx = x - hw, lsy = shoulderY;
    ctx.beginPath(); ctx.moveTo(lsx, lsy);
    ctx.lineTo(lsx + Math.sin(la) * armLen, lsy + Math.cos(la) * armLen);
    ctx.stroke();

    // right arm
    var rsx = x + hw, rsy = shoulderY;
    ctx.beginPath(); ctx.moveTo(rsx, rsy);
    ctx.lineTo(rsx + Math.sin(ra) * armLen, rsy + Math.cos(ra) * armLen);
    ctx.stroke();

    // left leg
    ctx.beginPath(); ctx.moveTo(hipX, hipY);
    ctx.lineTo(hipX + Math.sin(ll) * legLen * f, hipY + Math.cos(ll) * legLen);
    ctx.stroke();

    // right leg
    ctx.beginPath(); ctx.moveTo(hipX, hipY);
    ctx.lineTo(hipX + Math.sin(rl) * legLen * f, hipY + Math.cos(rl) * legLen);
    ctx.stroke();

    ctx.restore();
  }

  function drawGround() {
    var gY = groundY();
    ctx.save();
    ctx.strokeStyle = 'rgba(230, 230, 234, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, gY);
    ctx.lineTo(window.innerWidth, gY);
    ctx.stroke();
    ctx.restore();
  }

  // ─── Game Loop ──────────────────────────────────────────────
  var lastTime = 0;

  function loop(timestamp) {
    var dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    if (jpJump()) doJump();
    justPressed.clear();

    var cards = getCards();

    // Save previous position for collision entry detection
    player.prevX = player.x;
    player.prevY = player.y;

    updatePhysics(dt);
    checkCollisions(cards);
    updateState(dt);

    var w = window.innerWidth, vh = window.innerHeight;
    ctx.clearRect(0, 0, w, vh);
    drawGround();
    drawStickFigure();

    requestAnimationFrame(loop);
  }

  // ─── Init ───────────────────────────────────────────────────
  function init() {
    player.x = window.innerWidth / 2;
    player.y = groundY();
    player.prevX = player.x;
    player.prevY = player.y;
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
