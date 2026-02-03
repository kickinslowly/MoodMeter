/*
  Shared heatmap color logic for student and teacher dashboards.
  Usage: window.initHeatmap(gridSize) — call after DOM ready.
*/
(function () {
  'use strict';

  function lerp(a, b, t) { return a + (b - a) * t; }
  function mix(c0, c1, t) {
    return [
      Math.round(lerp(c0[0], c1[0], t)),
      Math.round(lerp(c0[1], c1[1], t)),
      Math.round(lerp(c0[2], c1[2], t))
    ];
  }
  function rgb(c) { return 'rgb(' + c[0] + ', ' + c[1] + ', ' + c[2] + ')'; }

  var C_TL = [224, 56, 56];
  var C_TR = [246, 223, 95];
  var C_BL = [70, 112, 214];
  var C_BR = [74, 201, 129];
  var NEUTRAL = [34, 36, 43];

  function quadrantColor(tX, tY) {
    var left = tX <= 0.5;
    var top = tY <= 0.5;
    var qX = left ? (tX / 0.5) : ((tX - 0.5) / 0.5);
    var qY = top ? (tY / 0.5) : ((tY - 0.5) / 0.5);
    var anchor0, anchor1, horiz;
    if (top && left) {
      anchor0 = C_TL; anchor1 = [235, 120, 80]; horiz = [220, 70, 70];
    } else if (top && !left) {
      anchor0 = C_TR; anchor1 = [255, 200, 80]; horiz = [248, 230, 120];
    } else if (!top && left) {
      anchor0 = C_BL; anchor1 = [110, 150, 230]; horiz = [80, 130, 220];
    } else {
      anchor0 = C_BR; anchor1 = [120, 220, 150]; horiz = [90, 210, 140];
    }
    var mixH = [
      Math.round(lerp(anchor0[0], horiz[0], qX)),
      Math.round(lerp(anchor0[1], horiz[1], qX)),
      Math.round(lerp(anchor0[2], horiz[2], qX)),
    ];
    var blend = 0.25 * Math.max(qX, qY);
    return [
      Math.round(lerp(mixH[0], anchor1[0], blend)),
      Math.round(lerp(mixH[1], anchor1[1], blend)),
      Math.round(lerp(mixH[2], anchor1[2], blend)),
    ];
  }

  function applyHeatColors(root, size) {
    var cells = root.querySelectorAll('.cell[data-x][data-y]');
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      var x = parseInt(cell.dataset.x, 10) || 0;
      var y = parseInt(cell.dataset.y, 10) || 0;
      var t = Math.max(0, Math.min(1, parseFloat(cell.dataset.intensity || '0')));
      var tX = size > 1 ? x / (size - 1) : 0;
      var tY = size > 1 ? y / (size - 1) : 0;
      var base = quadrantColor(tX, tY);
      var strength = 0.25 + 0.75 * t;
      var mixed = mix(NEUTRAL, base, strength);
      cell.style.background = 'linear-gradient(140deg, ' + rgb(mixed) + ', rgba(0,0,0,0.15))';
      cell.style.filter = 'saturate(' + (0.7 + 0.8 * t) + ') brightness(' + (0.9 + 0.2 * t) + ')';
    }
  }

  function addAvgGlow(root) {
    var txStr = root.dataset.avgTx;
    var tyStr = root.dataset.avgTy;
    if (!txStr || !tyStr) return;
    var tx = parseFloat(txStr);
    var ty = parseFloat(tyStr);
    if (!isFinite(tx) || !isFinite(ty)) return;
    var c = quadrantColor(tx, ty);
    var px = Math.round(tx * 10000) / 100;
    var py = Math.round(ty * 10000) / 100;
    var overlay = document.createElement('div');
    overlay.className = 'avg-glow';
    overlay.style.background = 'radial-gradient(circle at ' + px + '% ' + py + '%, rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0.22) 0%, rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0.12) 22%, rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0.06) 38%, transparent 62%)';
    root.appendChild(overlay);
  }

  window.initHeatmap = function (size) {
    var grids = document.querySelectorAll('.grid');
    for (var i = 0; i < grids.length; i++) {
      applyHeatColors(grids[i], size);
      addAvgGlow(grids[i]);
    }
  };
})();
