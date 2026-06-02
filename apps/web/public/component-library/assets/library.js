/* ============================================================
   RevPARMAX — Component Library  ·  interactions
   ============================================================ */
(function () {
  'use strict';

  /* ---- THEME TOGGLE (persisted) ---- */
  var toggle = document.getElementById('themeToggle');
  function applyTheme(theme) {
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(theme);
    toggle.querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.theme === theme);
    });
    try { localStorage.setItem('rpm-lib-theme', theme); } catch (e) {}
  }
  if (toggle) {
    toggle.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) applyTheme(b.dataset.theme);
    });
    var saved;
    try { saved = localStorage.getItem('rpm-lib-theme'); } catch (e) {}
    if (saved) applyTheme(saved);
  }

  /* ---- SEGMENTED CONTROLS ---- */
  document.querySelectorAll('[data-seg]').forEach(function (seg) {
    seg.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      seg.querySelectorAll('button').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
    });
  });

  /* ---- BUTTON GROUPS ---- */
  document.querySelectorAll('[data-grp]').forEach(function (grp) {
    grp.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      grp.querySelectorAll('button').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
    });
  });

  /* ---- SCOPE SWITCHER ---- */
  document.querySelectorAll('[data-scope]').forEach(function (sc) {
    sc.addEventListener('click', function (e) {
      var lv = e.target.closest('.level');
      if (!lv) return;
      sc.querySelectorAll('.level').forEach(function (x) { x.classList.remove('active'); });
      lv.classList.add('active');
    });
  });

  /* ---- SIDEBAR / TABS / PAGER (single-select groups) ---- */
  function singleSelect(scope, itemSel) {
    document.querySelectorAll(scope).forEach(function (g) {
      g.addEventListener('click', function (e) {
        var it = e.target.closest(itemSel);
        if (!it || it.classList.contains('dots') || it.disabled) return;
        g.querySelectorAll(itemSel).forEach(function (x) { x.classList.remove('active'); });
        it.classList.add('active');
      });
    });
  }
  singleSelect('[data-snav]', '.sb-i');
  singleSelect('[data-tabs]', 'button');
  document.querySelectorAll('[data-pager]').forEach(function (g) {
    g.addEventListener('click', function (e) {
      var b = e.target.closest('.pg');
      if (!b || b.classList.contains('nav') || b.classList.contains('dots')) return;
      g.querySelectorAll('.pg').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
    });
  });

  /* ---- MODAL (show/hide the demo overlay) ---- */
  var modalDemo = document.querySelector('[data-modal-demo]');
  function setModal(open) {
    if (!modalDemo) return;
    modalDemo.style.display = open ? 'flex' : 'none';
  }
  document.querySelectorAll('[data-open-modal]').forEach(function (b) {
    b.addEventListener('click', function () { setModal(true); });
  });
  if (modalDemo) {
    modalDemo.addEventListener('click', function (e) {
      if (e.target.closest('[data-close-modal]') || e.target.closest('.m-close') || e.target.classList.contains('scrim')) {
        setModal(false);
      }
    });
  }

  /* ---- TOAST / BANNER dismiss ---- */
  document.querySelectorAll('.toast .tx, .banner .bx').forEach(function (x) {
    x.addEventListener('click', function () {
      var el = x.closest('.toast, .banner');
      if (el) { el.style.transition = 'opacity .2s'; el.style.opacity = '0'; setTimeout(function () { el.style.display = 'none'; }, 200); }
    });
  });

  /* ---- COUNTERFACTUAL SIMULATOR ---- */
  document.querySelectorAll('[data-sim]').forEach(function (sim) {
    var input = sim.querySelector('[data-sim-slider] input[type=range]');
    var sval = sim.querySelector('[data-sim-slider] .sval');
    var slider = sim.querySelector('[data-sim-slider]');
    var elAdr = sim.querySelector('[data-alt-adr]'),
        elOcc = sim.querySelector('[data-alt-occ]'),
        elRev = sim.querySelector('[data-alt-rev]'),
        impV = sim.querySelector('[data-imp-v]'),
        impP = sim.querySelector('[data-imp-p]'),
        impC = sim.querySelector('[data-imp-c]');
    var baseADR = 249, baseOcc = 0.91, rooms = 100, baseRev = Math.round(baseADR * baseOcc * rooms);
    function fmt(n) { return n.toLocaleString('en-US'); }
    function render() {
      var p = parseFloat(input.value);
      var pct = ((p - (-20)) / 40) * 100;
      input.style.setProperty('--p', pct + '%');
      if (sval) sval.textContent = (p > 0 ? '+' : '') + p + '%';
      var altADR = Math.round(baseADR * (1 + p / 100));
      var altOcc = Math.max(0.5, Math.min(0.99, baseOcc - 0.00167 * p));
      var altRev = Math.round(altADR * altOcc * rooms);
      var imp = altRev - baseRev;
      var impPct = (imp / baseRev) * 100;
      var conf = Math.round(92 - Math.abs(p - 12) * 0.6);
      conf = Math.max(58, Math.min(97, conf));
      elAdr.textContent = '$' + altADR;
      elOcc.textContent = Math.round(altOcc * 100) + '%';
      elRev.textContent = '$' + fmt(altRev);
      impV.textContent = (imp >= 0 ? '+$' : '−$') + fmt(Math.abs(imp));
      impP.textContent = (impPct >= 0 ? '+' : '−') + Math.abs(impPct).toFixed(1) + '%';
      impC.textContent = conf + '%';
    }
    input.addEventListener('input', render);
    render();
  });

  /* ---- SLIDERS (fill + live value) ---- */
  document.querySelectorAll('[data-slider]').forEach(function (s) {
    var input = s.querySelector('input[type=range]');
    var out = s.querySelector('.sval');
    var min = parseFloat(s.dataset.min), max = parseFloat(s.dataset.max);
    var suffix = s.dataset.suffix || '';
    function render() {
      var v = parseFloat(input.value);
      var p = ((v - min) / (max - min)) * 100;
      input.style.setProperty('--p', p + '%');
      var sign = (suffix === '%' && v > 0) ? '+' : '';
      if (out) out.textContent = sign + v + suffix;
    }
    input.addEventListener('input', render);
    render();
  });

  /* ---- STEPPERS ---- */
  document.querySelectorAll('[data-stepper]').forEach(function (st) {
    var num = st.querySelector('.num');
    var min = st.dataset.min !== undefined ? parseFloat(st.dataset.min) : -Infinity;
    var max = st.dataset.max !== undefined ? parseFloat(st.dataset.max) : Infinity;
    var step = st.dataset.step ? parseFloat(st.dataset.step) : 1;
    st.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var v = parseFloat(num.textContent) + parseInt(b.dataset.dir, 10) * step;
      v = Math.max(min, Math.min(max, v));
      num.textContent = v;
    });
  });

  /* ---- INDETERMINATE CHECKBOX ---- */
  document.querySelectorAll('.check.indeterminate input').forEach(function (i) {
    i.indeterminate = true;
    i.addEventListener('change', function () {
      i.closest('.check').classList.remove('indeterminate');
    });
  });

  /* ---- SCROLLSPY NAV + BREADCRUMB ---- */
  var crumbMap = {
    buttons:'Step 01 · Form Controls', segmented:'Step 01 · Form Controls', inputs:'Step 01 · Form Controls',
    select:'Step 01 · Form Controls', choice:'Step 01 · Form Controls', switch:'Step 01 · Form Controls',
    slider:'Step 01 · Form Controls', stepper:'Step 01 · Form Controls',
    metrics:'Step 02 · Data Display', scope:'Step 02 · Data Display', badges:'Step 02 · Data Display',
    table:'Step 02 · Data Display', meters:'Step 02 · Data Display', spark:'Step 02 · Data Display',
    sidebar:'Step 03 · Navigation', tabs:'Step 03 · Navigation', breadcrumb:'Step 03 · Navigation',
    pager:'Step 03 · Navigation', cmdk:'Step 03 · Navigation',
    modal:'Step 04 · Feedback & Overlays', toast:'Step 04 · Feedback & Overlays', tooltip:'Step 04 · Feedback & Overlays',
    popover:'Step 04 · Feedback & Overlays', banner:'Step 04 · Feedback & Overlays', empty:'Step 04 · Feedback & Overlays',
    rcal:'Step 05 · Revenue Modules', heat:'Step 05 · Revenue Modules', pace:'Step 05 · Revenue Modules', radar:'Step 05 · Revenue Modules',
    sim:'Step 05 · Revenue Modules', ridge:'Step 05 · Revenue Modules', forecast:'Step 05 · Revenue Modules', chmix:'Step 05 · Revenue Modules',
    ai:'06 · AI Copilot', motion:'07 · Motion',
    appbar:'08 · Structure & Overlays', daterange:'08 · Structure & Overlays', drawer:'08 · Structure & Overlays',
    menu:'08 · Structure & Overlays', combo:'08 · Structure & Overlays',
    inbox:'09 · System', progress:'09 · System', avatars:'09 · System'
  };
  var crumbEl = document.querySelector('.lib-top .crumb');
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav-i[href^="#"]'));
  var sections = links.map(function (l) { return document.querySelector(l.getAttribute('href')); }).filter(Boolean);
  if ('IntersectionObserver' in window && sections.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          var id = '#' + en.target.id;
          links.forEach(function (l) { l.classList.toggle('active', l.getAttribute('href') === id); });
          if (crumbEl && crumbMap[en.target.id]) {
            crumbEl.innerHTML = '<b>Component Library</b><span class="sep">/</span>' + crumbMap[en.target.id];
          }
        }
      });
    }, { rootMargin: '-15% 0px -70% 0px', threshold: 0 });
    sections.forEach(function (s) { spy.observe(s); });
  }
})();
