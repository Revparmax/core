/* ============================================================
   RevPARMAX — Motion: light-up reveals, count-up, replay
   ============================================================ */
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.body.classList.add('motion-ready');

  /* ---- count-up ---- */
  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-countup'));
    if (isNaN(target)) return;
    var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
    var dur = parseInt(el.getAttribute('data-dur') || '1000', 10);
    if (reduce) { el.textContent = target.toFixed(decimals); return; }
    var start = performance.now();
    function frame(now) {
      var p = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - p, 3);          // ease-out cubic
      el.textContent = (target * eased).toFixed(decimals);
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = target.toFixed(decimals);
    }
    requestAnimationFrame(frame);
  }

  /* ---- reveal on view (charts + count-ups) ---- */
  function reveal(container) {
    container.classList.add('lit');
    container.querySelectorAll('.countup').forEach(countUp);
    if (container.matches && container.matches('.countup')) countUp(container);
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { reveal(en.target); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.25 });
    document.querySelectorAll('[data-lit]').forEach(function (el) { io.observe(el); });
    // standalone count-ups not inside a [data-lit]
    document.querySelectorAll('.countup').forEach(function (el) {
      if (!el.closest('[data-lit]')) io.observe(el);
    });
  } else {
    document.querySelectorAll('[data-lit]').forEach(reveal);
    document.querySelectorAll('.countup').forEach(countUp);
  }

  /* ---- replay controls ---- */
  function replay(target) {
    target.classList.remove('lit');
    // force reflow so the animation restarts
    void target.offsetWidth;
    requestAnimationFrame(function () { reveal(target); });
  }
  document.addEventListener('click', function (e) {
    var rb = e.target.closest('[data-replay]');
    if (rb) {
      var t = document.querySelector(rb.getAttribute('data-replay'));
      if (t) replay(t);
      return;
    }
    var cb = e.target.closest('[data-recount]');
    if (cb) {
      var c = document.querySelector(cb.getAttribute('data-recount'));
      if (c) countUp(c);
    }
  });
})();
