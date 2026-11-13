/* CuSS · Interaction A: the living dot field behind the hero.
   - A grid of small square dots on one canvas.
   - The pointer (or a finger) pushes nearby dots away and makes them swell; springs pull them back.
   - Left alone for 1 s, the dots gather into "CuSS". Left alone a little longer, "CuSS" opens out
     into "Custom / Software / Solutions", with Cu, S and S still highlighted. Any movement scatters them.
   - A click or tap sends out a ripple ring. Keyboard focus inside the hero does the same.
   - Colours come from the CSS theme tokens; the letter shapes use the headline font.
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
  var IDLE_SHORT = 1000;       // still for this long → "CuSS"
  var IDLE_LONG = 4000;        // still for this long → "Custom Software Solutions"
  var SPRING = 0.05;           // pull towards the current goal
  var DAMPING = 0.86;          // velocity kept per frame
  var WELL_R = 130;            // pointer influence radius (px)
  var WELL_PUSH = 7;           // pointer push strength
  var RING_SPEED = 0.55;       // ripple growth (px per ms)
  var RING_LIFE = 1400;        // ripple lifetime (ms)

  var W = 0, H = 0, dpr = 1, spacing = 16, base = 1.6, cols = 0, rows = 0;
  var dots = [], parts = [], wellK = 1;
  var MAX_PARTS = 1400;         // cap on letter dots
  var colors = { dot: '#b2c4bf', hot: '#0f6b5c', letter: '#0f6b5c' };
  var pointer = { x: -1e5, y: -1e5 };
  var lastMove = 0, f1 = 0, f2 = 0, scatterArmed = false;   // f1: CuSS, f2: full name (0..1)
  var ripples = [];
  var onScreen = false, raf = 0, lastT = 0;

  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    colors.dot = cs.getPropertyValue('--dot').trim() || colors.dot;
    colors.hot = cs.getPropertyValue('--accent').trim() || colors.hot;
    colors.letter = cs.getPropertyValue('--dot-letter').trim() || colors.letter;
  }
  // The letter shapes are drawn from a solid font (the headline font is itself made of dots,
  // which would not sample cleanly). The dots then give it the dot-matrix look.
  var LETTER_FONT = '"Bricolage Grotesque", "Segoe UI", system-ui, sans-serif';
  function letterFont() { return LETTER_FONT; }
  function smooth(v) { return v * v * (3 - 2 * v); }

  function build() {
    var r = hero.getBoundingClientRect();
    W = r.width; H = r.height;
    if (W < 10 || H < 10) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background grid: about 2,000–2,800 dots. The letters use their own finer dots (up to MAX_PARTS).
    spacing = W < 700 ? 15 : Math.min(24, Math.max(16, Math.sqrt((W * H) / 2800)));
    base = W < 700 ? 1.5 : 1.7;
    cols = Math.floor(W / spacing); rows = Math.floor(H / spacing);
    var ox = (W - (cols - 1) * spacing) / 2, oy = (H - (rows - 1) * spacing) / 2;

    dots = [];
    for (var j = 0; j < rows; j++) {
      for (var i = 0; i < cols; i++) {
        var x = ox + i * spacing, y = oy + j * spacing;
        dots.push({ hx: x, hy: y, x: x, y: y, vx: 0, vy: 0, s: 1, ph: Math.random() * 6.283 });
      }
    }
    sampleShapes();
    if (reduced || !raf) drawStill();
  }

  /* ---------- Letter shapes ----------
     Letters use their own finer dots ("letter dots"), so text stays crisp at any screen size.
     Each letter dot starts hidden on top of the nearest grid dot; when the field is left alone it
     peels off and flies to its spot, so the grid looks like it is gathering into the words.
     A shape is drawn on a hidden canvas the size of the stage: the top half holds the whole shape,
     the bottom half only the highlighted initials. */
  function samplePoints(paint, fsOut) {
    var hr = hero.getBoundingClientRect(), sr = stageEl.getBoundingClientRect();
    var sl = sr.left - hr.left, st = sr.top - hr.top;
    var sw = Math.floor(sr.width), sh = Math.floor(sr.height);
    if (sw < 120 || sh < 60) return [];
    var off = document.createElement('canvas');
    off.width = sw; off.height = sh * 2;
    var o = off.getContext('2d');
    var fs = paint(o, sw, sh);
    var data = o.getImageData(0, 0, sw, sh * 2).data;
    var stepPx = Math.max(4.5, Math.min(9, fs / 20));
    fsOut.step = stepPx;
    var pts = [];
    for (var y = stepPx / 2; y < sh; y += stepPx) {
      for (var x = stepPx / 2; x < sw; x += stepPx) {
        var idx = ((y | 0) * sw + (x | 0)) * 4 + 3;
        if (data[idx] > 110) pts.push({ x: sl + x, y: st + y, hi: data[idx + sh * sw * 4] > 110 });
      }
    }
    return pts;
  }

  function nearestGrid(x, y) {
    var best = dots[0], bd = Infinity;
    // Grid is regular, so look only at the cell around the point
    var i0 = Math.round((x - dots[0].hx) / spacing), j0 = Math.round((y - dots[0].hy) / spacing);
    for (var dj = -1; dj <= 1; dj++) for (var di = -1; di <= 1; di++) {
      var i = i0 + di, j = j0 + dj;
      if (i < 0 || j < 0 || i >= cols || j >= rows) continue;
      var d = dots[j * cols + i], dd = (d.hx - x) * (d.hx - x) + (d.hy - y) * (d.hy - y);
      if (dd < bd) { bd = dd; best = d; }
    }
    return best;
  }

  function sampleShapes() {
    parts = [];
    if (!stageEl || !dots.length) return;
    var font = letterFont();
    var m1 = {}, m2 = {};

    // Shape 1: "CuSS", all highlighted
    var p1 = samplePoints(function (o, sw, sh) {
      o.font = '700 100px ' + font;
      var fs = Math.min((sw * 0.94) / (o.measureText('CuSS').width || 260) * 100, sh * 1.1);
      o.font = '700 ' + fs + 'px ' + font;
      o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillStyle = '#000';
      o.fillText('CuSS', sw / 2, sh / 2 + fs * 0.04);
      o.fillText('CuSS', sw / 2, sh + sh / 2 + fs * 0.04);
      return fs;
    }, m1);

    // Shape 2: "Custom / Software / Solutions", with Cu, S, S highlighted
    var lines = [['Cu', 'stom'], ['S', 'oftware'], ['S', 'olutions']];
    var p2 = samplePoints(function (o, sw, sh) {
      o.font = '700 100px ' + font;
      var widest = 0;
      lines.forEach(function (l) { widest = Math.max(widest, o.measureText(l[0] + l[1]).width); });
      var fs = Math.min((sw * 0.98) / (widest || 400) * 100, sh / 3 / 1.02);
      o.font = '700 ' + fs + 'px ' + font;
      o.textAlign = 'left'; o.textBaseline = 'middle'; o.fillStyle = '#000';
      var lh = fs * 1.02, x0 = (sw - widest * fs / 100) / 2, y0 = sh / 2 - lh;
      lines.forEach(function (l, k) {
        o.fillText(l[0] + l[1], x0, y0 + k * lh);
        o.fillText(l[0], x0, sh + y0 + k * lh);
      });
      return fs;
    }, m2);

    // Pair the two shapes left to right, so each dot moves a short way when CuSS opens out
    var byX = function (a, b) { return a.x - b.x || a.y - b.y; };
    p1.sort(byX); p2.sort(byX);
    var n = Math.min(MAX_PARTS, Math.max(p1.length, p2.length));
    var r1 = p1.length / n, r2 = p2.length / n;
    for (var k = 0; k < n; k++) {
      var t1 = k < p1.length ? p1[k] : null, t2 = k < p2.length ? p2[k] : null;
      if (p1.length > n) t1 = p1[Math.floor(k * r1)];
      if (p2.length > n) t2 = p2[Math.floor(k * r2)];
      var anchor = t1 || t2, src = nearestGrid(anchor.x, anchor.y);
      parts.push({ hx: src.hx, hy: src.hy, x: src.hx, y: src.hy, vx: 0, vy: 0, s: 1, ph: src.ph, lit: 0, hi: false,
        t1: t1, t2: t2, z1: m1.step || 6, z2: m2.step || 6 });
    }
  }

  /* ---------- Motion ---------- */
  // Spring + pointer + ripple physics for one dot towards (gx, gy). Returns how much it swells (0..1).
  function physics(d, gx, gy, dt, R2) {
    var ax = (gx - d.x) * SPRING, ay = (gy - d.y) * SPRING, swell = 0;
    var dx = d.x - pointer.x, dy = d.y - pointer.y, d2 = dx * dx + dy * dy;
    if (wellK > 0 && d2 < R2 && d2 > 0.01) {
      var dist = Math.sqrt(d2), f = 1 - dist / WELL_R;
      var push = f * f * WELL_PUSH * wellK;
      ax += (dx / dist) * push; ay += (dy / dist) * push;
      swell = f * wellK;
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

  function step(now, dt) {
    var still = now - lastMove;
    var g1 = still > IDLE_SHORT ? 1 : 0, g2 = still > IDLE_LONG ? 1 : 0;
    f1 += (g1 - f1) * (g1 ? 0.045 : 0.12) * dt;
    f2 += (g2 - f2) * (g2 ? 0.035 : 0.12) * dt;
    if (f1 < 0.001) f1 = 0;
    if (f2 < 0.001) f2 = 0;
    var e1 = smooth(Math.min(1, f1)), e2 = smooth(Math.min(1, f2));
    // The pointer's push fades out once it stops moving, so a resting mouse doesn't dent the letters
    wellK = Math.max(0, Math.min(1, 1 - (still - 250) / 650));
    var R2 = WELL_R * WELL_R, n, d, hx, hy;

    for (n = 0; n < dots.length; n++) {
      d = dots[n];
      physics(d, d.hx + Math.sin(now * 0.0007 + d.ph) * 1.1, d.hy + Math.cos(now * 0.0009 + d.ph) * 1.1, dt, R2);
    }
    // Letter dots: goal goes home → CuSS spot (if any) → full-name spot (if any)
    for (n = 0; n < parts.length; n++) {
      d = parts[n];
      hx = d.hx; hy = d.hy;
      var p1x = d.t1 ? d.t1.x : hx, p1y = d.t1 ? d.t1.y : hy;
      var p2x = d.t2 ? d.t2.x : hx, p2y = d.t2 ? d.t2.y : hy;
      var gx = hx + (p1x - hx) * e1, gy = hy + (p1y - hy) * e1;
      physics(d, gx + (p2x - gx) * e2, gy + (p2y - gy) * e2, dt, R2);
      var w1 = d.t1 ? e1 * (1 - e2) : 0, w2 = d.t2 ? e2 : 0;
      d.lit = w1 + w2;
      d.hi = w2 >= w1 ? !!(d.t2 && d.t2.hi) : true;
      d.z = d.z1 + (d.z2 - d.z1) * e2;
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
    var n, d, sz;
    // Grid dots (swollen ones are drawn last, in the accent colour)
    ctx.fillStyle = colors.dot;
    for (n = 0; n < dots.length; n++) {
      d = dots[n];
      if (d.s > 1.45) continue;
      sz = base * d.s;
      ctx.fillRect(d.x - sz / 2, d.y - sz / 2, sz, sz);
    }
    // Letter dots: initials at full strength, the rest of each word softer
    ctx.fillStyle = colors.letter;
    for (n = 0; n < parts.length; n++) {
      d = parts[n];
      if (!(d.lit > 0.01)) continue;
      ctx.globalAlpha = d.lit * (d.hi ? 1 : 0.55);
      sz = (base + (d.z * 0.62 - base) * d.lit) * Math.min(d.s, 1.6);
      ctx.fillRect(d.x - sz / 2, d.y - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.hot;
    for (n = 0; n < dots.length; n++) {
      d = dots[n];
      if (d.s <= 1.45) continue;
      sz = base * d.s;
      ctx.fillRect(d.x - sz / 2, d.y - sz / 2, sz, sz);
    }
    if (ripples.length) {
      ctx.strokeStyle = colors.hot; ctx.lineWidth = 1;
      for (var r = 0; r < ripples.length; r++) {
        ctx.globalAlpha = Math.max(0, ripples[r].alpha) * 0.5;
        ctx.beginPath(); ctx.arc(ripples[r].x, ripples[r].y, ripples[r].rad, 0, 6.283); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  /* Reduced motion, or before the loop starts: a still grid (with "CuSS" formed under reduced motion) */
  function drawStill() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = colors.dot;
    for (var n = 0; n < dots.length; n++) ctx.fillRect(dots[n].hx - base / 2, dots[n].hy - base / 2, base, base);
    if (reduced) {
      ctx.fillStyle = colors.letter;
      for (var k = 0; k < parts.length; k++) {
        var p = parts[k];
        if (!p.t1) continue;
        var sz = p.z1 * 0.62;
        ctx.fillRect(p.t1.x - sz / 2, p.t1.y - sz / 2, sz, sz);
      }
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

  /* ---------- Input ---------- */
  function setPointer(cx, cy) {
    var r = canvas.getBoundingClientRect();
    var x = cx - r.left, y = cy - r.top;
    if (x < -WELL_R || y < -WELL_R || x > r.width + WELL_R || y > r.height + WELL_R) { pointer.x = pointer.y = -1e5; return; }
    pointer.x = x; pointer.y = y;
  }
  function moved(now) {
    if (f1 > 0.4 || f2 > 0.4) scatterArmed = true;
    if (scatterArmed) {
      // Scatter: give the dots that were part of a letter a little kick
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].lit > 0.2) { parts[i].vx += (Math.random() - 0.5) * 9; parts[i].vy += (Math.random() - 0.5) * 9; }
      }
      scatterArmed = false;
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

  /* ---------- Lifecycle ---------- */
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
  // Re-read the letter shapes once the headline font has loaded
  if (document.fonts && document.fonts.load) document.fonts.load('700 100px "Bricolage Grotesque"').then(function () { sampleShapes(); if (reduced) drawStill(); }, function () {});
  (C.watch || function (el, cb) { cb(true); })(hero, function (v) { onScreen = v; sync(); }, '0px');
})();
