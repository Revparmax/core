/* ============================================================
   RevPARMAX — Line chart engine
   Pixel-accurate (1:1 viewBox) so circles stay round and dashes
   even; supports area, band, solid/dashed lines, dots w/ glow,
   draw-on reveal (reuses motion CSS), hover light-up, and a
   snapping tooltip + hairline.
   ============================================================ */
(function () {
  'use strict';
  var SVGNS = 'http://www.w3.org/2000/svg';

  /* normalized configs: x in 0..1 (left→right), y in 0..1 (top→bottom of value range) */
  var CONFIGS = {
    forecast: {
      height: 210, insetT: 16, insetB: 10, insetR: 14, insetL: 4,
      // revenue $k, range 300..500
      months: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
      central: [330,342,355,360,378,392,405,415,426,430,444,458],
      upper:   [null,null,null,null,null,null,405,422,438,448,468,488],
      lower:   [null,null,null,null,null,null,405,408,414,412,420,428],
      splitAt: 6, vmin: 300, vmax: 500,
      band: true,
      dots: [{ i: 6, cls: 'mid' }, { i: 11, cls: 'acc', glow: true }],
      nowAt: 6,
      tip: function (i, self) {
        var rows = [{ k: 'Revenue', v: '$' + self.central[i] + 'K' }];
        if (i >= self.splitAt) {
          rows.push({ k: 'Band', v: '$' + self.lower[i] + 'K – $' + self.upper[i] + 'K' });
          rows[0].k = 'Forecast';
        }
        return { title: self.months[i] + (i === self.nowAt ? ' · now' : (i > self.splitAt ? ' · modeled' : '')), rows: rows };
      }
    },
    pace: {
      height: 188, insetT: 14, insetB: 10, insetR: 14, insetL: 4,
      labels: ['60d','50d','40d','30d','20d','10d','Arrival'],
      central: [12,24,38,52,67,79,89],      // this year occ %
      compare: [10,20,32,45,58,70,82],      // last year
      vmin: 0, vmax: 100, splitAt: 99,
      dots: [{ i: 6, cls: 'acc', glow: true }],
      nowAt: 4,
      tip: function (i, self) {
        return { title: self.labels[i] + (i === self.nowAt ? ' · today' : ''), rows: [
          { k: 'This year', v: self.central[i] + '%' },
          { k: 'Last year', v: self.compare[i] + '%' }
        ] };
      }
    },
    ridge: {
      height: 188, insetT: 16, insetB: 10, insetR: 16, insetL: 4,
      adr: [180,200,220,240,260,280,300,320,340],
      central: [14,17.5,20.5,22.7,24.3,25.4,25.2,23.8,21.5], // revenue $k
      vmin: 10, vmax: 30, splitAt: 99,
      dots: [{ i: 3, cls: 'mid' }, { i: 5, cls: 'acc', glow: true }],
      nowAt: 5, nowLabel: 'optimal',
      tip: function (i, self) {
        return { title: 'ADR $' + self.adr[i], rows: [
          { k: 'Revenue', v: '$' + self.central[i].toFixed(1) + 'K' },
          { k: i === 5 ? 'Optimal' : (i === 3 ? 'Current' : 'Modeled'), v: '90% occ' }
        ] };
      }
    },
    demo: {
      height: 132, insetT: 14, insetB: 8, insetR: 14, insetL: 4,
      central: [22,40,33,62,55,86,104],
      vmin: 0, vmax: 120, splitAt: 99, interactive: false,
      dots: [{ i: 6, cls: 'acc', glow: true }]
    }
  };

  function el(tag, attrs) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function yFrac(v, cfg) { return 1 - (v - cfg.vmin) / (cfg.vmax - cfg.vmin); }

  function render(host, cfg) {
    var W = host.clientWidth || 600, H = cfg.height;
    if (!W) return;
    var n = cfg.central.length;
    var plotW = W - cfg.insetL - cfg.insetR, plotH = H - cfg.insetT - cfg.insetB;
    function X(i) { return cfg.insetL + (i / (n - 1)) * plotW; }
    function Y(v) { return cfg.insetT + yFrac(v, cfg) * plotH; }

    var svg = el('svg', { width: '100%', height: H, viewBox: '0 0 ' + W + ' ' + H });
    svg.setAttribute('class', 'c2-svg');

    // points
    var pts = cfg.central.map(function (v, i) { return [X(i), Y(v)]; });
    var split = cfg.splitAt;

    // ---- confidence band ----
    if (cfg.band) {
      var up = [], lo = [];
      for (var i = split; i < n; i++) { up.push(X(i) + ',' + Y(cfg.upper[i])); lo.unshift(X(i) + ',' + Y(cfg.lower[i])); }
      var bandPath = 'M' + up.join(' L') + ' L' + lo.join(' L') + ' Z';
      var g = el('g', { class: 'fadeup' }); g.style.setProperty('--fade-to', '.15');
      g.appendChild(el('path', { d: bandPath, class: 'c2-band' }));
      svg.appendChild(g);
    }

    // ---- area under primary line ----
    var areaParts = pts.map(function (p) { return p[0] + ',' + p[1]; });
    var areaPath = 'M' + areaParts.join(' L') + ' L' + X(n - 1) + ',' + (H - cfg.insetB) + ' L' + X(0) + ',' + (H - cfg.insetB) + ' Z';
    var area = el('path', { d: areaPath, class: 'c2-area fadeup' }); area.style.setProperty('--fade-to', '.12');
    svg.appendChild(area);

    // ---- compare line (dashed, e.g. last year) ----
    if (cfg.compare) {
      var cp = cfg.compare.map(function (v, i) { return X(i) + ',' + Y(v); });
      svg.appendChild(el('path', { d: 'M' + cp.join(' L'), class: 'c2-line c2-compare draw d1', pathLength: '1' }));
    }

    // ---- primary line: solid up to split, dashed after ----
    if (split < n - 1) {
      var solid = pts.slice(0, split + 1).map(function (p) { return p[0] + ',' + p[1]; });
      var dash = pts.slice(split).map(function (p) { return p[0] + ',' + p[1]; });
      svg.appendChild(el('path', { d: 'M' + solid.join(' L'), class: 'c2-line c2-main draw d1', pathLength: '1' }));
      svg.appendChild(el('path', { d: 'M' + dash.join(' L'), class: 'c2-line c2-fore draw d2', pathLength: '1' }));
    } else {
      svg.appendChild(el('path', { d: 'M' + areaParts.join(' L'), class: 'c2-line c2-main draw d1', pathLength: '1' }));
    }

    // ---- now / optimal marker ----
    if (cfg.nowAt != null) {
      svg.appendChild(el('line', { x1: X(cfg.nowAt), y1: cfg.insetT - 6, x2: X(cfg.nowAt), y2: H - cfg.insetB, class: 'c2-now' }));
    }

    // ---- dots ----
    cfg.dots.forEach(function (d) {
      var cx = X(d.i), cy = Y(cfg.central[d.i]);
      if (d.glow) {
        svg.appendChild(el('circle', { cx: cx, cy: cy, r: 5, class: 'c2-halo halo ' + d.cls }));
        svg.appendChild(el('circle', { cx: cx, cy: cy, r: 4.5, class: 'c2-dot ignite ' + d.cls }));
      } else {
        svg.appendChild(el('circle', { cx: cx, cy: cy, r: 4.5, class: 'c2-dot ' + d.cls }));
      }
    });

    // ---- interactive hairline + focus dot ----
    var hair = el('line', { x1: 0, y1: cfg.insetT - 6, x2: 0, y2: H - cfg.insetB, class: 'c2-hair' });
    var focus = el('circle', { cx: 0, cy: 0, r: 4.5, class: 'c2-focus' });
    svg.appendChild(hair); svg.appendChild(focus);

    host.innerHTML = '';
    host.appendChild(svg);

    // tooltip element
    var tip = document.createElement('div'); tip.className = 'c2-tip'; host.appendChild(tip);

    // ---- pointer interaction ----
    function nearest(clientX) {
      var r = svg.getBoundingClientRect();
      var px = (clientX - r.left) * (W / r.width);
      var best = 0, bd = Infinity;
      for (var i = 0; i < n; i++) { var dd = Math.abs(X(i) - px); if (dd < bd) { bd = dd; best = i; } }
      return best;
    }
    function showAt(i) {
      var cx = X(i), cy = Y(cfg.central[i]);
      hair.setAttribute('x1', cx); hair.setAttribute('x2', cx); hair.classList.add('on');
      focus.setAttribute('cx', cx); focus.setAttribute('cy', cy); focus.classList.add('on');
      var data = cfg.tip(i, cfg);
      tip.innerHTML = '<div class="t-h">' + data.title + '</div>' + data.rows.map(function (row) {
        return '<div class="t-r"><span>' + row.k + '</span><b>' + row.v + '</b></div>';
      }).join('');
      var rb = svg.getBoundingClientRect();
      var leftPx = (cx / W) * rb.width;
      tip.style.left = leftPx + 'px';
      tip.style.top = ((cy / H) * rb.height) + 'px';
      tip.classList.toggle('flip', leftPx > rb.width * 0.6);
      tip.classList.add('on');
    }
    function hide() { hair.classList.remove('on'); focus.classList.remove('on'); tip.classList.remove('on'); }
    if (cfg.interactive !== false && cfg.tip) {
      svg.addEventListener('pointermove', function (e) { showAt(nearest(e.clientX)); });
      svg.addEventListener('pointerleave', hide);
    } else {
      hair.remove(); focus.remove(); tip.remove();
    }
  }

  function init() {
    document.querySelectorAll('[data-chart]').forEach(function (host) {
      var cfg = CONFIGS[host.getAttribute('data-chart')];
      if (!cfg) return;
      var raf;
      function draw() { render(host, cfg); }
      draw();
      if ('ResizeObserver' in window) {
        var ro = new ResizeObserver(function () { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); });
        ro.observe(host);
      } else {
        window.addEventListener('resize', function () { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); });
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
