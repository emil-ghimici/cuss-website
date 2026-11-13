/* CuSS · shared helpers used by the other modules, plus the email copy button and footer year.
   Loaded first. Everything here is optional: the page reads fine without it. */
(function () {
  'use strict';
  var C = window.CuSS = window.CuSS || {};

  C.reducedMotion = function () {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  };

  /* Calls cb(true/false) as the element enters or leaves the screen (with a margin). */
  C.watch = function (el, cb, margin) {
    if (!('IntersectionObserver' in window)) { cb(true); return; }
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { cb(e.isIntersecting); });
    }, { rootMargin: margin || '120px 0px' }).observe(el);
  };

  /* Counts a number up from 0. Reads data-count, data-prefix, data-suffix. */
  C.countUp = function (el, duration) {
    var end = parseFloat(el.getAttribute('data-count'));
    if (isNaN(end)) return;
    var pre = el.getAttribute('data-prefix') || '';
    var suf = el.getAttribute('data-suffix') || '';
    var show = function (n) { el.textContent = pre + Math.round(n).toLocaleString('en-IE') + suf; };
    if (C.reducedMotion()) { show(end); return; }
    var ms = duration || 1200, t0 = null;
    function frame(t) {
      if (t0 === null) t0 = t;
      var k = Math.min(1, (t - t0) / ms);
      show(end * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(frame);
    }
    show(0);
    requestAnimationFrame(frame);
  };

  /* Small message at the bottom of the screen. */
  var toastEl = document.querySelector('[data-toast]'), toastTimer;
  C.toast = function (msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2200);
  };

  /* Footer year */
  var y = document.querySelectorAll('[data-year]');
  for (var i = 0; i < y.length; i++) y[i].textContent = new Date().getFullYear();

  /* Copy buttons: copy the address; if the browser refuses, select the text instead. */
  function selectText(el) {
    try { var r = document.createRange(); r.selectNodeContents(el); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) {}
  }
  var btns = document.querySelectorAll('[data-copy]');
  Array.prototype.forEach.call(btns, function (btn) {
    var label = btn.textContent;
    var target = document.querySelector('[data-email]');
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy');
      var done = function () {
        btn.textContent = 'Copied';
        C.toast('Copied: ' + text);
        setTimeout(function () { btn.textContent = label; }, 1800);
      };
      var fail = function () { if (target) selectText(target); C.toast('Selected. Press Ctrl+C or ⌘C to copy'); };
      try {
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fail);
        else fail();
      } catch (e) { fail(); }
    });
  });
})();
