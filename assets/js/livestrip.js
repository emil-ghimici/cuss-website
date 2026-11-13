/* CuSS · Interaction D: the live strip.
   - Irish time (Europe/Dublin), ticking every second while the strip is on screen and the tab is visible.
   - The numbers count up the first time the strip comes into view.
   - The status light pulses with CSS (switched off under reduced motion). */
(function () {
  'use strict';
  var strip = document.querySelector('[data-livestrip]');
  if (!strip) return;
  var C = window.CuSS || {};
  var clock = strip.querySelector('[data-clock]');
  var dateEl = strip.querySelector('[data-date]');
  var timeFmt, dateFmt;
  try {
    timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Dublin', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    dateFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Dublin', weekday: 'short', day: 'numeric', month: 'short' });
  } catch (e) { timeFmt = null; }

  var timer = 0, onScreen = false;
  function tick() {
    var now = new Date();
    if (clock && timeFmt) {
      clock.textContent = timeFmt.format(now);
      clock.setAttribute('datetime', now.toISOString());
    }
    if (dateEl && dateFmt) dateEl.textContent = dateFmt.format(now);
    timer = setTimeout(tick, 1000 - (now.getTime() % 1000) + 5);
  }
  function sync() {
    clearTimeout(timer); timer = 0;
    if (onScreen && !document.hidden && timeFmt) tick();
  }
  if (!timeFmt && clock) clock.parentNode.style.display = 'none';
  else tick();

  var counters = strip.querySelectorAll('[data-count]');
  var counted = false;
  if (!(C.reducedMotion && C.reducedMotion())) {
    for (var i = 0; i < counters.length; i++) counters[i].textContent = (counters[i].getAttribute('data-prefix') || '') + '0' + (counters[i].getAttribute('data-suffix') || '');
  }

  document.addEventListener('visibilitychange', sync);
  (C.watch || function (el, cb) { cb(true); })(strip, function (v) {
    onScreen = v; sync();
    if (v && !counted && C.countUp) {
      counted = true;
      for (var j = 0; j < counters.length; j++) C.countUp(counters[j], 900 + j * 250);
    }
  }, '-10% 0px');
})();
