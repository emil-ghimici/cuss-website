/* CuSS · Interaction E: the footer wordmark made of dots.
   The big faded "CuSS" is redrawn as dots that move aside from the cursor (a quieter version of the
   hero), then ease back. Runs only while the footer is on screen. Reduced motion: still dots.
   Without JavaScript the plain text wordmark shows instead. */
(function () {
  'use strict';
  var host = document.querySelector('[data-footerdots]');
  if (!host) return;
  var canvas = host.querySelector('canvas');
  var ctx = canvas && canvas.getContext && canvas.getContext('2d');
  if (!ctx) return;
  var C = window.CuSS || {};
  var reduced = C.reducedMotion && C.reducedMotion();

  var R = 90, PUSH = 3.2, SPRING = 0.06, DAMP = 0.84;
  var W = 0, H = 0, dots = [], size = 3, colors = {};
  var pointer = { x: -1e5, y: -1e5 }, raf = 0, onScreen = false, lastT = 0, settle = 0;

  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    colors.dot = cs.getPropertyValue('--wordmark').trim() || '#c9d6d2';
    colors.hot = cs.getPropertyValue('--accent').trim() || '#0f6b5c';
  }

  function build() {
    var r = host.getBoundingClientRect();
    W = r.width; H = r.height;
    if (W < 50 || H < 30) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var off = document.createElement('canvas');
    off.width = Math.ceil(W); off.height = Math.ceil(H);
    var o = off.getContext('2d');
    var font = '"Bricolage Grotesque", "Segoe UI", system-ui, sans-serif';
    o.font = '700 100px ' + font;
    var fs = Math.min((W * 0.86) / (o.measureText('CuSS').width || 260) * 100, H * 1.15);
    o.font = '700 ' + fs + 'px ' + font;
    o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillStyle = '#000';
    o.fillText('CuSS', W / 2, H / 2 + fs * 0.05);
    var data = o.getImageData(0, 0, off.width, off.height).data;
    var step = Math.max(5, Math.min(10, fs / 22));
    size = step * 0.62;
    dots = [];
    for (var y = step / 2; y < H; y += step) {
      for (var x = step / 2; x < W; x += step) {
        if (data[((y | 0) * off.width + (x | 0)) * 4 + 3] > 120) dots.push({ hx: x, hy: y, x: x, y: y, vx: 0, vy: 0, h: 0 });
      }
    }
    host.classList.add('is-dots');
    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = colors.dot;
    for (var i = 0; i < dots.length; i++) { var d = dots[i]; if (d.h < 0.25) ctx.fillRect(d.x - size / 2, d.y - size / 2, size, size); }
    ctx.fillStyle = colors.hot;
    for (var j = 0; j < dots.length; j++) {
      var e = dots[j]; if (e.h < 0.25) continue;
      ctx.globalAlpha = Math.min(1, e.h); ctx.fillRect(e.x - size / 2, e.y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function step(dt) {
    var moving = false, R2 = R * R;
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      var ax = (d.hx - d.x) * SPRING, ay = (d.hy - d.y) * SPRING, h = 0;
      var dx = d.x - pointer.x, dy = d.y - pointer.y, d2 = dx * dx + dy * dy;
      if (d2 < R2 && d2 > 0.01) {
        var dist = Math.sqrt(d2), f = 1 - dist / R;
        ax += dx / dist * f * f * PUSH; ay += dy / dist * f * f * PUSH; h = f;
      }
      var damp = Math.pow(DAMP, dt);
      d.vx = (d.vx + ax * dt) * damp; d.vy = (d.vy + ay * dt) * damp;
      d.x += d.vx * dt; d.y += d.vy * dt;
      d.h += (h - d.h) * 0.2;
      if (Math.abs(d.vx) + Math.abs(d.vy) > 0.02 || d.h > 0.01) moving = true;
    }
    return moving;
  }

  // The loop sleeps once every dot has settled, and wakes on the next pointer move
  function loop(t) {
    var dt = lastT ? Math.min(3, (t - lastT) / 16.667) : 1;
    lastT = t;
    var moving = step(dt);
    draw();
    raf = (moving || settle-- > 0) && onScreen && !document.hidden ? requestAnimationFrame(loop) : 0;
  }
  function wake() { if (!raf && !reduced && onScreen && !document.hidden) { lastT = 0; settle = 10; raf = requestAnimationFrame(loop); } }

  window.addEventListener('pointermove', function (e) {
    if (!onScreen || reduced) return;
    var r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top;
    wake();
  }, { passive: true });
  document.addEventListener('pointerleave', function () { pointer.x = pointer.y = -1e5; wake(); });

  readColors();
  document.addEventListener('cuss:theme', function () { readColors(); draw(); });
  var pend = 0;
  var rebuild = function () { cancelAnimationFrame(pend); pend = requestAnimationFrame(build); };
  if ('ResizeObserver' in window) new ResizeObserver(rebuild).observe(host); else window.addEventListener('resize', rebuild);
  if (document.fonts && document.fonts.load) document.fonts.load('700 100px "Bricolage Grotesque"').then(rebuild, function () {});
  (C.watch || function (el, cb) { cb(true); })(host, function (v) { onScreen = v; if (!v) { pointer.x = pointer.y = -1e5; } });
})();
