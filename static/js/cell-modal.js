/*
  Shared cell-details modal for student and teacher dashboards.
  Usage: window.initCellModal() — call after DOM ready.
  Reads optional data-group-id / data-student-id from .grid elements.
*/
(function () {
  'use strict';

  function ensureModalRoot() {
    var root = document.getElementById('neon-modal-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'neon-modal-root';
      root.className = 'neon-modal-root';
      document.body.appendChild(root);
    }
    return root;
  }

  function closeModal(wrap) {
    if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
  }

  function openDetailsModal(cell, data) {
    var root = ensureModalRoot();
    var wrap = document.createElement('div');
    wrap.className = 'neon-modal';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');

    var backdrop = document.createElement('div');
    backdrop.className = 'neon-modal__backdrop';

    var panel = document.createElement('div');
    panel.className = 'neon-modal__panel';
    panel.style.maxWidth = '820px';
    panel.style.width = '92vw';
    panel.style.maxHeight = '82vh';
    panel.style.overflow = 'hidden';

    var countLabel = data.cell.count === 1 ? 'entry' : 'entries';
    var listOrEmpty = data.entries.length
      ? '<ul id="hm-list" style="list-style:none; margin:0; padding:0; display:grid; gap:8px; max-height:60vh; overflow:auto;"></ul>'
      : '<div style="padding:16px; text-align:center; color:#cfe7ff;">No entries</div>';

    panel.innerHTML =
      '<div class="neon-modal__glow" aria-hidden="true"></div>' +
      '<div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px;">' +
        '<div>' +
          '<div class="neon-modal__title">' + (data.cell.label || 'Selected cell') + ' — ' + data.cell.count + ' ' + countLabel + '</div>' +
          '<div class="neon-modal__message" style="opacity:.85;">Pleasantness ' + (data.cell.x + 1) + ', Energy ' + (data.cell.y + 1) + '</div>' +
        '</div>' +
        '<button type="button" aria-label="Close" class="btn" id="hm-close-btn">Close</button>' +
      '</div>' +
      '<div style="border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:10px; background:#121418; box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);">' +
        listOrEmpty +
      '</div>';

    wrap.appendChild(backdrop);
    wrap.appendChild(panel);
    root.appendChild(wrap);

    function onEsc(e) { if (e.key === 'Escape') { e.preventDefault(); cleanup(); } }
    function cleanup() { document.removeEventListener('keydown', onEsc); closeModal(wrap); }
    backdrop.addEventListener('click', cleanup);
    var closeBtn = panel.querySelector('#hm-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', cleanup);
    document.addEventListener('keydown', onEsc);

    var list = panel.querySelector('#hm-list');
    if (list) {
      var fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
      for (var i = 0; i < data.entries.length; i++) {
        var entry = data.entries[i];
        var li = document.createElement('li');
        li.style.padding = '10px 12px';
        li.style.border = '1px solid rgba(255,255,255,0.06)';
        li.style.borderRadius = '10px';
        li.style.background = '#0f1217';
        var d = entry.chosen_at ? new Date(entry.chosen_at) : null;
        var when = d ? fmt.format(d) : (entry.created_at ? fmt.format(new Date(entry.created_at)) : 'Unknown time');
        var mood = entry.label ? '<span style="opacity:.9"> — ' + entry.label + '</span>' : '';
        li.innerHTML = '<div><strong>' + when + '</strong>' + mood + '</div>';
        list.appendChild(li);
      }
    }
  }

  function attachCellHandlers() {
    var grids = document.querySelectorAll('.grid');
    for (var i = 0; i < grids.length; i++) {
      (function (grid) {
        grid.addEventListener('click', function (ev) {
          var cell = ev.target.closest('.cell');
          if (!cell || !grid.contains(cell)) return;
          var count = parseInt(cell.dataset.count || '0', 10);
          if (!count) return;
          var x = parseInt(cell.dataset.x, 10);
          var y = parseInt(cell.dataset.y, 10);
          var qs = new URLSearchParams();
          qs.set('x', String(x));
          qs.set('y', String(y));
          var df = grid.dataset.dateFrom;
          var dt = grid.dataset.dateTo;
          var tf = grid.dataset.timeFrom;
          var tt = grid.dataset.timeTo;
          if (df) qs.set('date_from', df);
          if (dt) qs.set('date_to', dt);
          if (tf) qs.set('time_from', tf);
          if (tt) qs.set('time_to', tt);
          var gid = grid.dataset.groupId;
          var sid = grid.dataset.studentId;
          if (gid) qs.set('group_id', gid);
          if (sid) qs.set('student_id', sid);
          fetch('/moodmeter/api/cell-entries?' + qs.toString())
            .then(function (res) { return res.json(); })
            .then(function (data) {
              if (!data.ok) { console.warn('Failed to load entries', data); return; }
              openDetailsModal(cell, data);
            })
            .catch(function (e) { console.error(e); });
        });
      })(grids[i]);
    }
  }

  window.initCellModal = function () {
    attachCellHandlers();
  };
})();
