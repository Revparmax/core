/* ============================================================
   RevPARMAX — Structure & Overlays interactions
   Dropdown menus, date-range picker, drawer, combobox.
   ============================================================ */
(function () {
  'use strict';

  /* ---- generic dropdown / popover menus ---- */
  function closeAllMenus(except) {
    document.querySelectorAll('.menu-wrap.open').forEach(function (m) {
      if (m !== except) m.classList.remove('open');
    });
  }
  document.querySelectorAll('[data-menu]').forEach(function (wrap) {
    var trigger = wrap.querySelector('[data-menu-trigger]');
    if (trigger) trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      var willOpen = !wrap.classList.contains('open');
      closeAllMenus(wrap);
      wrap.classList.toggle('open', willOpen);
    });
    wrap.querySelectorAll('[data-menu-close]').forEach(function (b) {
      b.addEventListener('click', function () { wrap.classList.remove('open'); });
    });
    // plain menu items (not the date picker) close on pick
    if (!wrap.hasAttribute('data-drange')) {
      wrap.querySelectorAll('.menu-i').forEach(function (i) {
        i.addEventListener('click', function () { wrap.classList.remove('open'); });
      });
    }
  });
  document.addEventListener('click', function (e) {
    document.querySelectorAll('.menu-wrap.open').forEach(function (m) {
      if (!m.contains(e.target)) m.classList.remove('open');
    });
  });

  /* ---- date-range picker ---- */
  document.querySelectorAll('[data-drange]').forEach(function (dr) {
    var grid = dr.querySelector('[data-dr-grid]');
    var label = dr.querySelector('[data-dr-label]');
    var foot = dr.querySelector('[data-dr-foot]');
    var presets = dr.querySelectorAll('[data-dr-presets] button');
    var start = 4, end = 8;
    function fmt(d) { return 'Jun ' + d; }
    function paint() {
      grid.querySelectorAll('[data-dr-day]').forEach(function (b) {
        var d = parseInt(b.getAttribute('data-dr-day'), 10);
        b.classList.remove('start', 'end', 'inrange');
        if (end == null) { if (d === start) b.classList.add('start', 'end'); }
        else {
          if (d === start) b.classList.add('start');
          else if (d === end) b.classList.add('end');
          else if (d > start && d < end) b.classList.add('inrange');
        }
      });
      if (end == null) { label.textContent = fmt(start) + ', 2026'; foot.textContent = fmt(start) + ' · 1 night'; }
      else {
        label.textContent = fmt(start) + ' – ' + fmt(end) + ', 2026';
        foot.textContent = fmt(start) + ' – ' + fmt(end) + ' · ' + (end - start) + ' night' + (end - start === 1 ? '' : 's');
      }
    }
    grid.addEventListener('click', function (e) {
      var b = e.target.closest('[data-dr-day]');
      if (!b) return;
      var d = parseInt(b.getAttribute('data-dr-day'), 10);
      if (end != null || d < start) { start = d; end = null; }   // begin new range
      else { end = d; }
      presets.forEach(function (p) { p.classList.toggle('active', p.textContent === 'Custom'); });
      paint();
    });
    presets.forEach(function (p) {
      p.addEventListener('click', function () {
        presets.forEach(function (x) { x.classList.remove('active'); });
        p.classList.add('active');
        var t = p.textContent;
        if (t === 'Today') { start = 1; end = null; }
        else if (t === 'Next 7 days') { start = 1; end = 7; }
        else if (t === 'Next 30 days') { start = 1; end = 30; }
        else if (t === 'This month') { start = 1; end = 30; }
        else if (t === 'Last month') { start = 1; end = 30; }
        else { start = 4; end = 8; }
        paint();
      });
    });
    paint();
  });

  /* ---- drawer ---- */
  document.querySelectorAll('[data-drawer]').forEach(function (dw) {
    dw.querySelectorAll('[data-drawer-open]').forEach(function (b) {
      b.addEventListener('click', function () { dw.classList.add('open'); });
    });
    dw.querySelectorAll('[data-drawer-close]').forEach(function (b) {
      b.addEventListener('click', function () { dw.classList.remove('open'); });
    });
  });

  /* ---- combobox ---- */
  document.querySelectorAll('[data-combo]').forEach(function (combo) {
    var control = combo.querySelector('[data-combo-control]');
    var input = combo.querySelector('[data-combo-input]');
    var list = combo.querySelector('[data-combo-list]');
    var opts = Array.prototype.slice.call(list.querySelectorAll('.combo-opt'));

    function open() { combo.classList.add('open'); }
    function close() { combo.classList.remove('open'); }

    function addToken(name) {
      if (control.querySelector('[data-token="' + name + '"]')) return;
      var t = document.createElement('span');
      t.className = 'combo-token';
      t.setAttribute('data-token', name);
      t.innerHTML = name + '<button class="x" aria-label="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 6l12 12M18 6 6 18" stroke-linecap="round"/></svg></button>';
      control.insertBefore(t, input);
    }
    function removeToken(name) {
      var t = control.querySelector('[data-token="' + name + '"]');
      if (t) t.remove();
      var o = opts.filter(function (x) { return x.getAttribute('data-opt') === name; })[0];
      if (o) o.classList.remove('sel');
    }

    control.addEventListener('click', function () { open(); input.focus(); });
    input.addEventListener('focus', open);
    input.addEventListener('input', function () {
      open();
      var q = input.value.toLowerCase();
      var any = false;
      opts.forEach(function (o) {
        var hit = o.getAttribute('data-opt').toLowerCase().indexOf(q) > -1 ||
                  (o.getAttribute('data-meta') || '').toLowerCase().indexOf(q) > -1;
        o.style.display = hit ? '' : 'none';
        if (hit) any = true;
      });
      var empty = list.querySelector('.combo-empty');
      if (!any && !empty) { empty = document.createElement('div'); empty.className = 'combo-empty'; empty.textContent = 'No properties match.'; list.appendChild(empty); }
      else if (any && empty) empty.remove();
    });
    opts.forEach(function (o) {
      o.addEventListener('click', function () {
        var name = o.getAttribute('data-opt');
        if (o.classList.contains('sel')) { o.classList.remove('sel'); removeToken(name); }
        else { o.classList.add('sel'); addToken(name.replace(/&amp;/g, '&')); }
        input.value = '';
        opts.forEach(function (x) { x.style.display = ''; });
        input.focus();
      });
    });
    control.addEventListener('click', function (e) {
      var x = e.target.closest('.combo-token .x');
      if (x) { e.stopPropagation(); removeToken(x.parentElement.getAttribute('data-token')); }
    });
    document.addEventListener('click', function (e) { if (!combo.contains(e.target)) close(); });
  });

  /* ---- notification inbox ---- */
  document.querySelectorAll('[data-inbox]').forEach(function (ib) {
    var tabs = ib.querySelectorAll('[data-ib-tab]');
    var items = ib.querySelectorAll('.ib-item');
    var countEl = ib.querySelector('[data-ib-count]');
    function recount() {
      var n = ib.querySelectorAll('.ib-item.unread').length;
      if (countEl) countEl.textContent = n;
    }
    function applyTab(tab) {
      ib.querySelectorAll('.ib-grp').forEach(function (g) { g.style.display = ''; });
      items.forEach(function (it) {
        it.style.display = (tab === 'unread' && !it.classList.contains('unread')) ? 'none' : '';
      });
      // hide empty groups
      ib.querySelectorAll('.ib-grp').forEach(function (g) {
        var sib = g.nextElementSibling, any = false;
        while (sib && sib.classList.contains('ib-item')) { if (sib.style.display !== 'none') any = true; sib = sib.nextElementSibling; }
        g.style.display = any ? '' : 'none';
      });
    }
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        tabs.forEach(function (x) { x.classList.remove('active'); });
        t.classList.add('active');
        applyTab(t.getAttribute('data-ib-tab'));
      });
    });
    var mark = ib.querySelector('[data-ib-mark]');
    if (mark) mark.addEventListener('click', function () {
      items.forEach(function (it) { it.classList.remove('unread'); });
      recount();
      var active = ib.querySelector('[data-ib-tab].active');
      if (active) applyTab(active.getAttribute('data-ib-tab'));
    });
    items.forEach(function (it) {
      it.addEventListener('click', function () { it.classList.remove('unread'); recount(); });
    });
  });
})();
