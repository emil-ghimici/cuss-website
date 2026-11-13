/* CuSS · Interaction E: the polish layer.
   1. Section labels "type" themselves in the first time they come into view.
      The full text is always in the page for screen readers, and space is reserved so nothing jumps.
   2. Service cards tilt slightly toward the cursor (mouse only). The dot-matrix border on hover is CSS.
   3. A cursor ring that follows the mouse and grows over things you can click (mouse only).
   All three are off under reduced motion. (Email copy + toast lives in site.js.) */
(function () {
  'use strict';
  var C = window.CuSS || {};
  if (C.reducedMotion && C.reducedMotion()) return;
  var mouse = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- 1. Typing labels ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('.label'), function (el) {
    var text = el.textContent.trim();
    if (!text) return;
    el.textContent = '';
    var sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = text;
    var vis = document.createElement('span'); vis.className = 'type'; vis.setAttribute('aria-hidden', 'true');
    var typed = document.createElement('span'); typed.className = 'type-done';
    var rest = document.createElement('span'); rest.className = 'type-rest'; rest.textContent = text;
    vis.appendChild(typed); vis.appendChild(rest);
    el.appendChild(sr); el.appendChild(vis);
    var started = false;
    (C.watch || function (e, cb) { cb(true); })(el, function (v) {
      if (!v || started) return;
      started = true;
      vis.classList.add('is-typing');
      var i = 0;
      (function next() {
        i++;
        typed.textContent = text.slice(0, i);
        rest.textContent = text.slice(i);
        if (i < text.length) setTimeout(next, 22 + Math.random() * 30);
        else setTimeout(function () { vis.classList.remove('is-typing'); }, 600);
      })();
    }, '-8% 0px');
  });

  if (!mouse) return;

  /* ---------- 2. Service cards tilt toward the cursor ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('.service'), function (card) {
    var raf = 0, px = 0.5, py = 0.5;
    function apply() {
      raf = 0;
      card.style.transform = 'perspective(800px) rotateX(' + ((0.5 - py) * 5).toFixed(2) + 'deg) rotateY(' + ((px - 0.5) * 6).toFixed(2) + 'deg)';
    }
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect();
      px = (e.clientX - r.left) / r.width; py = (e.clientY - r.top) / r.height;
      if (!raf) raf = requestAnimationFrame(apply);
    });
    card.addEventListener('pointerleave', function () { cancelAnimationFrame(raf); raf = 0; card.style.transform = ''; });
  });

  /* ---------- 3. Cursor ring ---------- */
  var ring = document.createElement('div');
  ring.className = 'cursor-ring';
  ring.setAttribute('aria-hidden', 'true');
  document.body.appendChild(ring);
  var tx = -100, ty = -100, x = -100, y = -100, big = false, rafRing = 0, shown = false;
  var HOT = 'a, button, [role="slider"], input, label, summary, .service';
  function frame() {
    x += (tx - x) * 0.25; y += (ty - y) * 0.25;
    ring.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
    rafRing = (Math.abs(tx - x) > 0.3 || Math.abs(ty - y) > 0.3) ? requestAnimationFrame(frame) : 0;
  }
  window.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    tx = e.clientX; ty = e.clientY;
    if (!shown) { shown = true; x = tx; y = ty; ring.classList.add('is-on'); }
    var hot = !!(e.target.closest && e.target.closest(HOT));
    if (hot !== big) { big = hot; ring.classList.toggle('is-big', hot); }
    if (!rafRing) rafRing = requestAnimationFrame(frame);
  }, { passive: true });
  document.addEventListener('pointerleave', function () { shown = false; ring.classList.remove('is-on'); });
  window.addEventListener('blur', function () { shown = false; ring.classList.remove('is-on'); });
})();
