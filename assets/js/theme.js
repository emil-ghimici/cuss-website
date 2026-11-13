/* CuSS · light/dark theme toggle.
   Follows the device setting by default. Pressing the button picks the opposite of what is showing
   and remembers it. Other modules listen for the "cuss:theme" event to recolour themselves. */
(function () {
  'use strict';
  var root = document.documentElement;
  var btn = document.querySelector('[data-theme-toggle]');
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function current() {
    var set = root.getAttribute('data-theme');
    if (set === 'light' || set === 'dark') return set;
    return mq && mq.matches ? 'dark' : 'light';
  }
  function announce() {
    var next = current() === 'dark' ? 'light' : 'dark';
    if (btn) btn.setAttribute('aria-label', 'Switch to ' + next + ' theme');
    var meta = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < meta.length; i++) meta[i].setAttribute('content', current() === 'dark' ? '#0b1312' : '#f4f7f6');
    document.dispatchEvent(new CustomEvent('cuss:theme', { detail: { theme: current() } }));
  }

  if (btn) btn.addEventListener('click', function () {
    var next = current() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('cuss-theme', next); } catch (e) {}
    announce();
  });
  if (mq) {
    var onChange = function () { if (!root.getAttribute('data-theme')) announce(); };
    if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
  }
  announce();
})();
