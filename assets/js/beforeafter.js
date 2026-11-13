/* CuSS · Interaction B: Before → After.
   Big screens with a mouse: the section pins while you scroll; a divider sweeps across and spreadsheet
   cells fly into the app (broken values get fixed in flight). The divider can also be dragged, or moved
   with the arrow keys.
   Phones and tablets: a Before/After switch (or a swipe) plays a short version of the same change.
   Reduced motion or no JavaScript: both states shown side by side (the CSS default).
   The "Send invoice" demo button works in every mode. */
(function () {
  'use strict';
  var root = document.querySelector('[data-ba]');
  if (!root) return;
  var C = window.CuSS || {};

  /* --- Demo button: works everywhere, nothing is actually sent --- */
  var sendBtn = root.querySelector('[data-demo-send]');
  var statusPill = root.querySelector('[data-demo-status]');
  if (sendBtn && statusPill) {
    sendBtn.addEventListener('click', function () {
      var sent = sendBtn.classList.toggle('is-undo');
      statusPill.textContent = sent ? 'Sent' : 'Draft';
      statusPill.classList.toggle('is-sent', sent);
      sendBtn.textContent = sent ? 'Undo send' : 'Send invoice';
      if (C.toast) C.toast(sent ? 'Invoice sent (demo only, nothing left this page)' : 'Back to draft');
    });
  }

  if (C.reducedMotion && C.reducedMotion()) return; // calm side-by-side layout

  var stage = root.querySelector('.ba-stage');
  var before = root.querySelector('.ba-before');
  var after = root.querySelector('.ba-after');
  var layer = root.querySelector('.ba-fly-layer');
  var divider = root.querySelector('.ba-divider');
  var track = root.querySelector('.ba-track');
  var buttons = root.querySelectorAll('[data-ba-show]');
  var pinMQ = window.matchMedia('(min-width: 900px) and (min-height: 620px) and (pointer: fine)');

  root.classList.add('ba--live');

  /* Pair each spreadsheet cell with its place in the app */
  var pairs = [];
  Array.prototype.forEach.call(before.querySelectorAll('[data-fly]'), function (src) {
    var dst = after.querySelector('[data-fly-to="' + src.getAttribute('data-fly') + '"]');
    if (!dst) return;
    var el = document.createElement('span');
    el.className = 'ba-fly';
    el.textContent = src.textContent.trim();
    layer.appendChild(el);
    pairs.push({ src: src, dst: dst, el: el, from: src.textContent.trim(), to: dst.textContent.trim(), a: null, b: null, k: 1, fixed: false });
  });

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function measure() {
    var s = stage.getBoundingClientRect();
    pairs.forEach(function (p) {
      var a = p.src.getBoundingClientRect(), b = p.dst.getBoundingClientRect();
      p.a = { x: a.left - s.left, y: a.top - s.top, h: a.height };
      p.b = { x: b.left - s.left, y: b.top - s.top, h: b.height };
      p.el.style.height = a.height + 'px';
      p.el.style.lineHeight = (a.height - 15) + 'px';
      p.k = Math.max(0.85, Math.min(1.8, b.height / a.height));
    });
  }

  var state = { p: 0, manual: false, revealed: false };

  function setSplit(pct) {
    stage.style.setProperty('--split', pct + '%');
    if (divider) {
      divider.setAttribute('aria-valuenow', String(Math.round(pct)));
      divider.setAttribute('aria-valuetext', pct > 95 ? 'Showing the spreadsheet' : pct < 5 ? 'Showing the app' : 'Spreadsheet on the left, app on the right');
    }
  }

  function flyers(f) {
    var n = pairs.length, st = 0.07, span = Math.max(0.2, 1 - st * (n - 1));
    for (var i = 0; i < n; i++) {
      var p = pairs[i], t = clamp01((f - i * st) / span);
      p.src.classList.toggle('is-gone', t > 0);
      p.dst.classList.toggle('is-landed', t >= 1);
      if (t <= 0 || t >= 1 || !p.a) { p.el.style.visibility = 'hidden'; continue; }
      var e = ease(t);
      var x = lerp(p.a.x, p.b.x, e);
      var y = lerp(p.a.y, p.b.y, e) - Math.sin(Math.PI * t) * 40;
      var sc = lerp(1, p.k, e);
      p.el.style.visibility = 'visible';
      p.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) scale(' + sc.toFixed(3) + ')';
      var fixed = t > 0.5;
      if (fixed !== p.fixed) { p.fixed = fixed; p.el.textContent = fixed ? p.to : p.from; p.el.classList.toggle('is-fixed', fixed); }
    }
  }

  function reveal(on) {
    if (on === state.revealed) return;
    state.revealed = on;
    after.classList.toggle('is-revealed', on);
    if (on && C.countUp) Array.prototype.forEach.call(after.querySelectorAll('[data-count]'), function (el) { C.countUp(el, 1000); });
  }

  function pressed(isAfter) {
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      b.setAttribute('aria-pressed', String((b.getAttribute('data-ba-show') === 'after') === isAfter));
    }
  }

  /* One function draws any moment of the change, p from 0 (before) to 1 (after) */
  function render(p) {
    state.p = p;
    setSplit(100 - 100 * ease(clamp01((p - 0.04) / 0.7)));
    var f = clamp01((p - 0.1) / 0.8);
    flyers(f);
    if (f >= 0.97) reveal(true); else if (p < 0.05) reveal(false);
    pressed(p >= 0.5);
  }

  /* Manual divider (drag / keys): everything has landed, you just choose how much of each side to see */
  function manualSplit(pct) {
    state.manual = true;
    flyers(1); reveal(true);
    pct = Math.max(0, Math.min(100, pct));
    setSplit(pct);
    pressed(pct < 50);
  }

  /* --- Drivers --- */
  var pinned = false, ticking = false, anim = 0;

  function trackProgress() {
    var r = track.getBoundingClientRect();
    var total = r.height - window.innerHeight;
    return total > 0 ? clamp01(-r.top / total) : 0;
  }
  function onScroll() {
    if (!pinned || state.manual || ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; render(trackProgress()); });
  }

  function animateTo(target) {
    cancelAnimationFrame(anim);
    state.manual = false;
    var from = state.p, t0 = null, ms = 1300 * Math.abs(target - from) + 200;
    function frame(t) {
      if (t0 === null) t0 = t;
      var k = clamp01((t - t0) / ms);
      render(lerp(from, target, k));
      if (k < 1) anim = requestAnimationFrame(frame);
    }
    anim = requestAnimationFrame(frame);
  }

  function show(which) {
    var target = which === 'after' ? 1 : 0;
    if (pinned) {
      state.manual = false;
      var r = track.getBoundingClientRect();
      var top = window.scrollY + r.top + (r.height - window.innerHeight) * (target ? 0.97 : 0);
      window.scrollTo({ top: top, behavior: 'smooth' });
      onScroll();
    } else {
      animateTo(target);
    }
  }
  Array.prototype.forEach.call(buttons, function (b) {
    b.addEventListener('click', function () { show(b.getAttribute('data-ba-show')); });
  });

  /* Divider: drag with mouse/pen/finger, or arrow keys */
  if (divider) {
    var dragging = false;
    var fromPointer = function (e) { var s = stage.getBoundingClientRect(); manualSplit((e.clientX - s.left) / s.width * 100); };
    divider.addEventListener('pointerdown', function (e) { dragging = true; try { divider.setPointerCapture(e.pointerId); } catch (x) {} fromPointer(e); e.preventDefault(); });
    divider.addEventListener('pointermove', function (e) { if (dragging) fromPointer(e); });
    divider.addEventListener('pointerup', function () { dragging = false; });
    divider.addEventListener('pointercancel', function () { dragging = false; });
    divider.addEventListener('keydown', function (e) {
      var cur = parseFloat(divider.getAttribute('aria-valuenow')) || 0, next = null;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = cur - 5;
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = cur + 5;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = 100;
      if (next !== null) { e.preventDefault(); manualSplit(next); }
    });
  }

  /* Swipe on phones/tablets: left = after, right = before */
  var sx = null, sy = null;
  stage.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') { sx = e.clientX; sy = e.clientY; } }, { passive: true });
  stage.addEventListener('pointerup', function (e) {
    if (sx === null) return;
    var dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) show(dx < 0 ? 'after' : 'before');
  }, { passive: true });
  stage.addEventListener('pointercancel', function () { sx = null; });

  /* Mode: pinned scroll on big screens with a mouse, switch + swipe elsewhere */
  function setMode() {
    pinned = pinMQ.matches;
    root.classList.toggle('ba--pin', pinned);
    state.manual = false;
    requestAnimationFrame(function () {
      measure();
      if (pinned) render(trackProgress()); else render(state.p >= 0.5 ? 1 : 0);
    });
  }
  if (pinMQ.addEventListener) pinMQ.addEventListener('change', setMode); else if (pinMQ.addListener) pinMQ.addListener(setMode);

  window.addEventListener('scroll', onScroll, { passive: true });
  var rm = 0;
  var remeasure = function () { cancelAnimationFrame(rm); rm = requestAnimationFrame(function () { measure(); if (state.manual) flyers(1); else render(state.p); }); };
  if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(stage); else window.addEventListener('resize', remeasure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);

  /* When the section is scrolled fully away, hand control back to scrolling */
  (C.watch || function () {})(root, function (v) {
    if (!v && state.manual) { state.manual = false; if (pinned) render(trackProgress()); }
  }, '0px');

  setMode();
})();
