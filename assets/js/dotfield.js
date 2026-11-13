/* CuSS · Interaction A: the living dot field behind the hero.
   - A grid of small square dots on one canvas.
   - The pointer (or a finger) pushes nearby dots away and makes them swell; springs pull them back.
   - After ~3 s without movement, some dots drift into the letters "CuSS". Any movement scatters them.
   - A click or tap sends out a ripple ring. Keyboard focus inside the hero does the same.
   - Colours come from the CSS theme tokens and update when the theme changes.
   - Runs only while the hero is on screen and the tab is visible.
   - Reduced motion: a still grid with "CuSS" already formed. */
(function () {
  'use strict';
  var hero = document.querySelector('[data-dotfield]');
  if (!hero) return;
  var canvas = hero.querySelector('canvas');
  var stageEl = hero.querySelector('.hero-stage');
  var ctx = canvas && canvas.getContext && canvas.getContext('2d');
  if (!ctx) return;

  var C = window.CuSS || {};
  var reduced = C.reducedMotion ? C.reducedMotion() : false;

  /* Tuning */
  var IDLE_MS = 3000;          // pointer still for this long → letters form
  var SPRING = 0.05;           // pull back to home
  var DAMPING = 0.86;          // velocity kept per frame
  var WELL_R = 130;            // pointer influence radius (px)
  var WELL_PUSH = 7;           // pointer push strength
  var RING_SPEED = 0.55;       // ripple growth (px per ms)
  var RING_LIFE = 1400;        // ripple lifetime (ms)

  var W = 0, H = 0, dpr = 1, spacing = 16, base = 1.6;
  var dots = [], letterDots = [];
  var colors = { dot: '#b2c4bf', hot: '#0f6b5c', letter: '#0f6b5c' };
  var pointer = { x: -1e5, y: -1e5 };
  var lastMove = 0, formed = 0, wasFormed = false;
  var ripples = [];
  var onScreen = false, raf = 0, lastT = 0;

  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    colors.dot = cs.getPropertyValue('--dot').trim() || colors.dot;
    colors.hot = cs.getPropertyValue('--accent').trim() || colors.hot;
    colors.letter = cs.getPropertyValue('--dot-letter').trim() || colors.letter;
  }

  function build() {
    var r = hero.getBoundingClientRect();
    W = r.width; H = r.height;
    if (W < 10 || H < 10) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var maxDots = W < 700 ? 1500 : 3200;
    spacing = Math.max(13, Math.sqrt((W * H) / maxDots));
    base = W < 700 ? 1.5 : 1.7;
    var cols = Math.floor(W / spacing), rows = Math.floor(H / spacing);
    var ox = (W - (cols - 1) * spacing) / 2, oy = (H - (rows - 1) * spacing) / 2;

    dots = [];
    for (var j = 0; j < rows; j++) {
      for (var i = 0; i < cols; i++) {
        var x = ox + i * spacing, y = oy + j * spacing;
        dots.push({ hx: x, hy: y, x: x, y: y, vx: 0, vy: 0, s: 1, ph: Math.random() * 6.283, tx: null, ty: null });
      }
    }
    sampleLetters();
    if (reduced || !onScreen) drawStill();
  }

  /* Draw "CuSS" on a hidden canvas, read which pixels are filled, and give those spots to the nearest dots. */
  function sampleLetters() {
    letterDots = [];
    for (var z = 0; z < dots.length; z++) { dots[z].tx = null; dots[z].ty = null; }
    if (!stageEl) return;
    var hr = hero.getBoundingClientRect(), sr = stageEl.getBoundingClientRect();
    var sw = Math.floor(sr.width), sh = Math.floor(sr.height);
    if (sw < 120 || sh < 60) return;
    var off = document.createElement('canvas');
    off.width = sw; off.height = sh;
    var o = off.getContext('2d');
    var family = '"Bricolage Grotesque", "Segoe UI", system-ui, sans-serif';
    o.font = '700 100px ' + family;
    var wAt100 = o.measureText('CuSS').width || 260;
    var fs = Math.min((sw * 0.92) / wAt100 * 100, sh * 0.95);
    o.font = '700 ' + fs + 'px ' + family;
    o.textAlign = 'center'; o.textBaseline = 'middle';
    o.fillStyle = '#000';
    o.fillText('CuSS', sw / 2, sh / 2 + fs * 0.04);
    var data = o.getImageData(0, 0, sw, sh).data;

    var step = Math.max(6, Math.min(10, fs / 14));
    var pts = [];
    for (var y = step / 2; y < sh; y += step) {
      for (var x = step / 2; x < sw; x += step) {
        if (data[((y | 0) * sw + (x | 0)) * 4 + 3] > 128) pts.push({ x: sr.left - hr.left + x, y: sr.top - hr.top + y });
      }
    }
    var limit = Math.floor(dots.length * 0.45);
    if (pts.length > limit) pts = pts.filter(function (_, k) { return k % Math.ceil(pts.length / limit) === 0; });
    if (!pts.length) return;

    // Take the dots closest to the letters' centre, then pair them with the letter spots left to right.
    var cx = sr.left - hr.left + sw / 2, cy = sr.top - hr.top + sh / 2;
    var pool = dots.slice().sort(function (a, b) {
      return ((a.hx - cx) * (a.hx - cx) + (a.hy - cy) * (a.hy - cy)) - ((b.hx - cx) * (b.hx - cx) + (b.hy - cy) * (b.hy - cy));
    }).slice(0, pts.length);
    pool.sort(function (a, b) { return a.hx - b.hx || a.hy - b.hy; });
    pts.sort(function (a, b) { return a.x - b.x || a.y - b.y; });
    for (var k = 0; k < pool.length; k++) { pool[k].tx = pts[k].x; pool[k].ty = pts[k].y; letterDots.push(pool[k]); }
  }

  function step(now, dt) {
    var idle = now - lastMove > IDLE_MS;
    var goal = idle && letterDots.length ? 1 : 0;
    formed += (goal - formed) * (goal ? 0.012 : 0.09) * dt;
    if (formed < 0.001) formed = 0;
    var e = formed * formed * (3 - 2 * formed);
    var R2 = WELL_R * WELL_R;

    for (var n = 0; n < dots.length; n++) {
      var d = dots[n];
      var hx = d.hx + Math.sin(now * 0.0007 + d.ph) * 1.1;
      var hy = d.hy + Math.cos(now * 0.0009 + d.ph) * 1.1;
      if (d.tx !== null && e > 0) { hx += (d.tx - hx) * e; hy += (d.ty - hy) * e; }
      var ax = (hx - d.x) * SPRING, ay = (hy - d.y) * SPRING, swell = 0;

      var dx = d.x - pointer.x, dy = d.y - pointer.y, d2 = dx * dx + dy * dy;
      if (d2 < R2 && d2 > 0.01) {
        var dist = Math.sqrt(d2), f = 1 - dist / WELL_R;
        var push = f * f * WELL_PUSH;
        ax += (dx / dist) * push; ay += (dy / dist) * push;
        swell = f;
      }
      for (var r = 0; r < ripples.length; r++) {
        var rp = ripples[r], rdx = d.x - rp.x, rdy = d.y - rp.y;
        var rd = Math.sqrt(rdx * rdx + rdy * rdy) || 1;
        var band = Math.abs(rd - rp.rad);
        if (band < 26) {
          var k = (1 - band / 26) * rp.power;
          ax += (rdx / rd) * k; ay += (rdy / rd) * k;
          if (k > swell) swell = Math.min(1, k);
        }
      }
      var damp = Math.pow(DAMPING, dt);
      d.vx = (d.vx + ax * dt) * damp; d.vy = (d.vy + ay * dt) * damp;
      d.x += d.vx * dt; d.y += d.vy * dt;
      d.s += ((1 + swell * 2.4) - d.s) * Math.min(1, 0.25 * dt);
    }
    for (var q = ripples.length - 1; q >= 0; q--) {
      var age = now - ripples[q].t0;
      ripples[q].rad = age * RING_SPEED;
      ripples[q].power = 2.6 * (1 - age / RING_LIFE);
      ripples[q].alpha = 1 - age / RING_LIFE;
      if (age > RING_LIFE) ripples.splice(q, 1);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    var showLetters = formed > 0.35;
    var n, d, sz;
    // Resting dots
    ctx.fillStyle = colors.dot;
    for (n = 0; n < dots.length; n++) {
      d = dots[n];
      if (d.s > 1.45 || (showLetters && d.tx !== null)) continue;
      sz = base * d.s;
      ctx.fillRect(d.x - sz / 2, d.y - sz / 2, sz, sz);
    }
    // Letter dots
    if (showLetters) {
      ctx.globalAlpha = Math.min(1, (formed - 0.35) / 0.4);
      ctx.fillStyle = colors.letter;
      for (n = 0; n < letterDots.length; n++) {
        d = letterDots[n];
        if (d.s > 1.45) continue;
        sz = base * 1.5 * d.s;
        ctx.fillRect(d.x - sz / 2, d.y - sz / 2, sz, sz);
      }
      ctx.globalAlpha = 1;
    }
    // Swollen dots near the pointer or a ripple
    ctx.fillStyle = colors.hot;
    for (n = 0; n < dots.length; n++) {
      d = dots[n];
      if (d.s <= 1.45) continue;
      sz = base * d.s;
      ctx.fillRect(d.x - sz / 2, d.y - sz / 2, sz, sz);
    }
    // Ripple rings
    if (ripples.length) {
      ctx.strokeStyle = colors.hot; ctx.lineWidth = 1;
      for (var r = 0; r < ripples.length; r++) {
        ctx.globalAlpha = Math.max(0, ripples[r].alpha) * 0.5;
        ctx.beginPath(); ctx.arc(ripples[r].x, ripples[r].y, ripples[r].rad, 0, 6.283); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  /* Reduced motion, or before the loop starts: a still grid, letters formed */
  function drawStill() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = colors.dot;
    for (var n = 0; n < dots.length; n++) {
      var d = dots[n];
      if (reduced && d.tx !== null) continue;
      ctx.fillRect(d.hx - base / 2, d.hy - base / 2, base, base);
    }
    if (reduced) {
      ctx.fillStyle = colors.letter;
      var sz = base * 1.5;
      for (var k = 0; k < letterDots.length; k++) ctx.fillRect(letterDots[k].tx - sz / 2, letterDots[k].ty - sz / 2, sz, sz);
    }
  }

  function loop(t) {
    raf = requestAnimationFrame(loop);
    var dt = lastT ? Math.min(3, (t - lastT) / 16.667) : 1;
    lastT = t;
    step(t, dt);
    draw();
  }
  function start() { if (!raf && !reduced) { lastT = 0; raf = requestAnimationFrame(loop); } }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
  function sync() { if (onScreen && !document.hidden) start(); else stop(); }

  /* Input */
  function setPointer(cx, cy) {
    var r = canvas.getBoundingClientRect();
    var x = cx - r.left, y = cy - r.top;
    if (x < -WELL_R || y < -WELL_R || x > r.width + WELL_R || y > r.height + WELL_R) { pointer.x = pointer.y = -1e5; return; }
    pointer.x = x; pointer.y = y;
  }
  function moved(now) {
    if (formed > 0.4 && !wasFormed) wasFormed = true;
    if (wasFormed) {
      // Scatter: give the letter dots a little kick
      for (var i = 0; i < letterDots.length; i++) { letterDots[i].vx += (Math.random() - 0.5) * 9; letterDots[i].vy += (Math.random() - 0.5) * 9; }
      wasFormed = false;
    }
    lastMove = now;
  }
  function ripple(x, y) {
    if (reduced) return;
    ripples.push({ x: x, y: y, t0: performance.now(), rad: 0, power: 2.6, alpha: 1 });
    if (ripples.length > 4) ripples.shift();
    moved(performance.now());
  }

  window.addEventListener('pointermove', function (e) {
    if (!onScreen || reduced) return;
    setPointer(e.clientX, e.clientY);
    if (pointer.x > -1e4) moved(performance.now());
  }, { passive: true });
  hero.addEventListener('pointerdown', function (e) {
    setPointer(e.clientX, e.clientY);
    var r = canvas.getBoundingClientRect();
    ripple(e.clientX - r.left, e.clientY - r.top);
  }, { passive: true });
  window.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') pointer.x = pointer.y = -1e5; }, { passive: true });
  document.addEventListener('pointerleave', function () { pointer.x = pointer.y = -1e5; });
  window.addEventListener('blur', function () { pointer.x = pointer.y = -1e5; });
  hero.addEventListener('focusin', function (e) {
    var r = canvas.getBoundingClientRect(), b = e.target.getBoundingClientRect();
    ripple(b.left + b.width / 2 - r.left, b.top + b.height / 2 - r.top);
  });

  /* Lifecycle */
  readColors();
  document.addEventListener('cuss:theme', function () { readColors(); if (reduced || !raf) drawStill(); });
  document.addEventListener('visibilitychange', sync);

  var pending = 0, lastW = 0;
  function scheduleBuild() {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(function () {
      var w = hero.getBoundingClientRect().width;
      // Phones change height when the address bar slides; only rebuild for real size changes.
      if (Math.abs(w - lastW) < 1 && Math.abs(hero.getBoundingClientRect().height - H) < 80 && dots.length) return;
      lastW = w; build();
    });
  }
  if ('ResizeObserver' in window) new ResizeObserver(scheduleBuild).observe(hero);
  else window.addEventListener('resize', scheduleBuild);

  lastMove = performance.now();
  build(); lastW = W;
  if (document.fonts && document.fonts.load) {
    document.fonts.load('700 100px "Bricolage Grotesque"').then(function () { sampleLetters(); if (reduced) drawStill(); }, function () {});
  }
  (C.watch || function (el, cb) { cb(true); })(hero, function (v) { onScreen = v; sync(); }, '0px');
})();
