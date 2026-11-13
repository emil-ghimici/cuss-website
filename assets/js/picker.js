/* CuSS · Interaction C: "What do you need?" picker.
   - Chips toggle on and off (any order, any number).
   - The card updates live: likely solution, a short description per pick, a vague typical timeline,
     and a small dot-matrix animation (it cycles through the picks).
   - "Send this to CuSS" is a mailto link with the subject and body filled in from the picks.
     Without JavaScript it is still a plain mailto link, and the chips are hidden.
   - No prices. Timelines stay vague on purpose. */
(function () {
  'use strict';
  var root = document.querySelector('[data-picker]');
  if (!root) return;
  var C = window.CuSS || {};

  var NEEDS = {
    sheets:  { tag: 'Spreadsheets', title: 'A simple web app instead of the spreadsheet',
               text: 'One place to enter and find things, no broken formulas, and the totals work themselves out.' },
    website: { tag: 'Website', title: 'A fast, simple business website',
               text: 'On your own domain, with your email set up properly, and easy to keep up to date.' },
    reports: { tag: 'Reports', title: 'A dashboard that builds the report for you',
               text: "It pulls in the numbers you already collect and stays up to date, so Monday's report is already done." },
    tools:   { tag: 'Connecting tools', title: 'Automations that connect your tools',
               text: 'Data moves between email, Excel, Google Sheets and your other systems on its own, without copy and paste.' },
    ai:      { tag: 'AI', title: 'A practical AI plan, then the build',
               text: 'A plain look at where AI really saves time in your business. Larger AI and data work is done together with a partner team.' },
    'else':  { tag: 'Something else', title: 'Tell me about it',
               text: "If it's software or IT, there's a good chance it can be done. If it can't, you'll hear that straight away." }
  };
  var ORDER = ['sheets', 'website', 'reports', 'tools', 'ai', 'else'];

  var chips = root.querySelectorAll('[data-need]');
  var titleEl = root.querySelector('[data-pick-title]');
  var listEl = root.querySelector('[data-pick-list]');
  var timeEl = root.querySelector('[data-pick-time]');
  var sendEl = root.querySelector('[data-pick-send]');
  var canvas = root.querySelector('.pick-mock');

  function picked() {
    var out = [];
    ORDER.forEach(function (k) {
      var b = root.querySelector('[data-need="' + k + '"]');
      if (b && b.getAttribute('aria-pressed') === 'true') out.push(k);
    });
    return out;
  }

  function timeline(keys) {
    if (!keys.length) return 'Agreed in the proposal, before work starts';
    if (keys.length > 1) return 'A few weeks for the first part, then step by step';
    if (keys[0] === 'ai') return 'Agreed in the proposal, with the partner team';
    if (keys[0] === 'else') return 'Agreed in the proposal, before work starts';
    return 'Usually a few weeks';
  }

  function mailto(keys) {
    var subject = 'Project enquiry' + (keys.length ? ': ' + keys.map(function (k) { return NEEDS[k].tag; }).join(', ') : '');
    var body = 'Hi,\n\n';
    if (keys.length) {
      body += 'I picked these on cuss.ie:\n';
      keys.forEach(function (k) { body += '- ' + root.querySelector('[data-need="' + k + '"]').textContent.trim() + '\n'; });
      body += '\n';
    }
    body += 'A few lines about my business and the problem:\n\n\n';
    return 'mailto:hello@cuss.ie?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }

  function render() {
    var keys = picked();
    if (!keys.length) {
      titleEl.textContent = 'Pick one or more above';
      listEl.innerHTML = '<li>The card shows the likely fix for what you pick. You can choose several, in any order.</li>';
    } else {
      titleEl.textContent = keys.length === 1 ? NEEDS[keys[0]].title : 'A combined fix, built step by step';
      listEl.innerHTML = '';
      keys.forEach(function (k) {
        var li = document.createElement('li');
        if (keys.length > 1) { var b = document.createElement('b'); b.textContent = NEEDS[k].title + '. '; li.appendChild(b); }
        li.appendChild(document.createTextNode(NEEDS[k].text));
        listEl.appendChild(li);
      });
    }
    timeEl.textContent = timeline(keys);
    sendEl.setAttribute('href', mailto(keys));
    mock.set(keys);
  }

  /* ---------- Mini dot-matrix animation (20 × 12 dots) ---------- */
  var mock = (function () {
    var ctx = canvas && canvas.getContext && canvas.getContext('2d');
    var COLS = 20, ROWS = 12, CYCLE = 2600;
    var keys = [], raf = 0, onScreen = false, t0 = 0, colors = {};
    var reduced = C.reducedMotion && C.reducedMotion();
    var W = 0, H = 0, cell = 10;

    function readColors() {
      var cs = getComputedStyle(document.documentElement);
      colors.dim = cs.getPropertyValue('--dot').trim() || '#b2c4bf';
      colors.on = cs.getPropertyValue('--accent').trim() || '#0f6b5c';
    }
    function size() {
      if (!ctx) return;
      var r = canvas.getBoundingClientRect();
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width; H = r.height; cell = Math.min(W / COLS, H / ROWS);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /* Each pattern returns the lit dots for a moment k (0..1 through its cycle) */
    function rect(set, x0, y0, x1, y1) { for (var x = x0; x <= x1; x++) { set[x + ',' + y0] = 1; set[x + ',' + y1] = 1; } for (var y = y0; y <= y1; y++) { set[x0 + ',' + y] = 1; set[x1 + ',' + y] = 1; } }
    var PATTERNS = {
      sheets: function (k, s) {          // a table, with a highlight sweeping down the rows
        rect(s, 1, 1, 18, 10);
        for (var x = 1; x <= 18; x++) { s[x + ',4'] = 1; s[x + ',7'] = 1; }
        for (var y = 1; y <= 10; y++) { s['7,' + y] = 1; s['13,' + y] = 1; }
        var row = [2, 5, 8][Math.floor(k * 3) % 3];
        for (var xx = 2; xx <= 17; xx++) if (xx !== 7 && xx !== 13) { s[xx + ',' + row] = 1; s[xx + ',' + (row + 1)] = 1; }
      },
      website: function (k, s) {         // a browser window, lines of content appearing
        rect(s, 1, 0, 18, 11);
        for (var x = 1; x <= 18; x++) s[x + ',2'] = 1;
        s['3,1'] = s['5,1'] = s['7,1'] = 1;
        var lines = [[3, 4, 14], [3, 6, 16], [3, 8, 10]];
        lines.forEach(function (l, i) {
          var len = Math.max(0, Math.min(1, k * 3 - i)) * (l[2] - l[0]);
          for (var xx = l[0]; xx <= l[0] + len; xx++) s[Math.round(xx) + ',' + l[1]] = 1;
        });
      },
      reports: function (k, s) {         // bars growing
        for (var x = 1; x <= 18; x++) s[x + ',11'] = 1;
        [[2, 4], [6, 7], [10, 5], [14, 9]].forEach(function (b, i) {
          var hgt = Math.round(b[1] * Math.min(1, Math.max(0, k * 2 - i * 0.2)));
          for (var y = 0; y < hgt; y++) { s[b[0] + ',' + (10 - y)] = 1; s[(b[0] + 1) + ',' + (10 - y)] = 1; s[(b[0] + 2) + ',' + (10 - y)] = 1; }
        });
      },
      tools: function (k, s) {           // two boxes, a packet travelling between them
        rect(s, 1, 3, 5, 8); rect(s, 14, 3, 18, 8);
        var p = k < 0.5 ? k * 2 : 2 - k * 2;
        var x = 6 + Math.round(p * 6);
        s[x + ',5'] = s[(x + 1) + ',5'] = s[x + ',6'] = s[(x + 1) + ',6'] = 1;
      },
      ai: function (k, s) {              // a sparkle that pulses, with small twinkles
        var r = 1 + Math.round((Math.sin(k * Math.PI * 2) + 1) * 1.5);
        for (var d = -r; d <= r; d++) { s[(10 + d) + ',6'] = 1; s['10,' + (6 + d)] = 1; }
        s['9,5'] = s['11,5'] = s['9,7'] = s['11,7'] = 1;
        var tw = [[3, 2], [16, 3], [4, 9], [15, 9], [17, 6], [2, 6]];
        tw.forEach(function (p, i) { if (Math.floor(k * 6 + i) % 3 === 0) s[p[0] + ',' + p[1]] = 1; });
      },
      'else': function (k, s) {          // a question mark
        var q = ['0111110', '1100011', '0000011', '0001110', '0011000', '0011000', '0000000', '0011000'];
        q.forEach(function (row, j) { for (var i = 0; i < row.length; i++) if (row[i] === '1') s[(7 + i) + ',' + (2 + j)] = 1; });
        if (k > 0.5) delete s['9,9'], delete s['10,9'];
      }
    };
    var IDLE = function (k, s) {         // nothing picked: a slow scanning column
      var x = Math.floor(k * COLS) % COLS;
      for (var y = 0; y < ROWS; y++) if ((y + x) % 3 === 0) s[x + ',' + y] = 1;
    };

    function draw(now) {
      if (!ctx || !W) return;
      var elapsed = reduced ? CYCLE * 0.99 : now - t0;
      var idx = keys.length ? Math.floor(elapsed / CYCLE) % keys.length : 0;
      var k = (elapsed % CYCLE) / CYCLE;
      if (reduced) k = 0.99;
      var s = {};
      (keys.length ? PATTERNS[keys[idx]] : IDLE)(k, s);
      ctx.clearRect(0, 0, W, H);
      var ox = (W - cell * COLS) / 2, oy = (H - cell * ROWS) / 2;
      for (var y = 0; y < ROWS; y++) {
        for (var x = 0; x < COLS; x++) {
          var on = s[x + ',' + y];
          var sz = on ? cell * 0.62 : cell * 0.18;
          ctx.fillStyle = on ? colors.on : colors.dim;
          ctx.fillRect(ox + x * cell + (cell - sz) / 2, oy + y * cell + (cell - sz) / 2, sz, sz);
        }
      }
    }
    function loop(now) { raf = requestAnimationFrame(loop); draw(now); }
    function sync() {
      var run = onScreen && !document.hidden && !reduced;
      if (run && !raf) { raf = requestAnimationFrame(loop); }
      else if (!run && raf) { cancelAnimationFrame(raf); raf = 0; }
    }
    if (ctx) {
      readColors(); size();
      document.addEventListener('cuss:theme', function () { readColors(); draw(performance.now()); });
      document.addEventListener('visibilitychange', sync);
      if ('ResizeObserver' in window) new ResizeObserver(function () { size(); draw(performance.now()); }).observe(canvas);
      (C.watch || function (el, cb) { cb(true); })(canvas, function (v) { onScreen = v; sync(); });
    }
    return {
      set: function (k) { keys = k; t0 = performance.now(); draw(t0); }
    };
  })();

  Array.prototype.forEach.call(chips, function (chip) {
    chip.addEventListener('click', function () {
      chip.setAttribute('aria-pressed', String(chip.getAttribute('aria-pressed') !== 'true'));
      render();
    });
  });
  root.classList.add('picker--live');
  render();
})();
