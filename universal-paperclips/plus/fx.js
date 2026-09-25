// Mobile edition additions: sound, vibration, toasts and confetti.
(function () {
  'use strict';
  var UP = window.UP;

  function calm() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  UP.calm = calm;

  // ---------------------------------------------------------------------------
  // Sound. Everything is synthesized, so there are no files to download.
  var ctx = null;
  var master = null;
  function audio() {
    if (!UP.data.settings.sound) return null;
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  // Phones only allow sound after the first touch.
  ['pointerdown', 'keydown'].forEach(function (type) {
    window.addEventListener(type, function unlock() {
      if (audio()) window.removeEventListener(type, unlock, true);
    }, true);
  });

  function tone(freq, start, length, opts) {
    opts = opts || {};
    var c = ctx;
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(freq, start);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, start + length);
    var peak = opts.gain || 0.2;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.012, length / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(gain);
    gain.connect(opts.out || master);
    osc.start(start);
    osc.stop(start + length + 0.02);
  }
  function noise(start, length, opts) {
    opts = opts || {};
    var c = ctx;
    var buffer = c.createBuffer(1, Math.ceil(c.sampleRate * length), c.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    var src = c.createBufferSource();
    src.buffer = buffer;
    var filter = c.createBiquadFilter();
    filter.type = opts.filter || 'bandpass';
    filter.frequency.setValueAtTime(opts.from || 800, start);
    if (opts.to) filter.frequency.exponentialRampToValueAtTime(opts.to, start + length);
    filter.Q.value = opts.q || 1.5;
    var gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(opts.gain || 0.12, start + length * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(start);
    src.stop(start + length);
  }
  function notes(list, step, opts) {
    var t = ctx.currentTime + 0.01;
    list.forEach(function (f, i) { tone(f, t + i * step, (opts && opts.length) || step * 2.2, opts); });
  }

  var lastTap = 0;
  var SOUNDS = {
    tap: function () {
      // Rapid tapping shouldn't turn into a wall of noise.
      var now = ctx.currentTime;
      if (now - lastTap < 0.035) return;
      lastTap = now;
      tone(1500 + Math.random() * 400, now, 0.035, { type: 'triangle', gain: 0.09 });
    },
    tick: function () { tone(900, ctx.currentTime, 0.03, { type: 'triangle', gain: 0.06 }); },
    buy: function () { notes([660, 990], 0.05, { type: 'triangle', gain: 0.1 }); },
    tab: function () { tone(520, ctx.currentTime, 0.05, { type: 'sine', gain: 0.07, to: 700 }); },
    unlock: function () { noise(ctx.currentTime, 0.45, { from: 300, to: 2400, gain: 0.08 }); notes([523, 784], 0.09, { type: 'sine', gain: 0.08 }); },
    project: function () {
      var t = ctx.currentTime;
      tone(140, t, 0.16, { type: 'sine', gain: 0.25, to: 60 });         // stamp thump
      noise(t, 0.08, { from: 1200, gain: 0.08 });
      [523, 659, 784, 1047].forEach(function (f, i) { tone(f, t + 0.12 + i * 0.06, 0.25, { type: 'triangle', gain: 0.08 }); });
    },
    luckyAppear: function () {
      var t = ctx.currentTime;
      [2093, 2637, 3136, 2637].forEach(function (f, i) { tone(f, t + i * 0.05, 0.12, { type: 'sine', gain: 0.04 }); });
    },
    lucky: function () {
      var t = ctx.currentTime;
      [1047, 1319, 1568, 2093, 2637].forEach(function (f, i) { tone(f, t + i * 0.045, 0.3, { type: 'sine', gain: 0.09 }); });
    },
    trophy: function () {
      var t = ctx.currentTime;
      [784, 1047, 1319, 1568].forEach(function (f, i) { tone(f, t + i * 0.09, i === 3 ? 0.6 : 0.2, { type: 'triangle', gain: 0.1 }); });
      tone(392, t + 0.27, 0.6, { type: 'sine', gain: 0.08 });
    },
    milestone: function () {
      var t = ctx.currentTime;
      [523, 659, 784].forEach(function (f, i) { tone(f, t + i * 0.08, 0.5, { type: 'triangle', gain: 0.09 }); });
      tone(1047, t + 0.24, 0.7, { type: 'sine', gain: 0.08 });
    },
    nope: function () { notes([330, 247], 0.07, { type: 'sine', gain: 0.07 }); },
    coin: function () { notes([1319, 1976], 0.06, { type: 'square', gain: 0.04 }); },
    hypno: function () {
      var t = ctx.currentTime;
      tone(55, t, 4.2, { type: 'sine', gain: 0.18, to: 110 });
      tone(82.5, t + 0.2, 4, { type: 'sine', gain: 0.08, to: 165 });
    },
    launch: function () {
      var t = ctx.currentTime;
      noise(t, 2.2, { from: 120, to: 3000, gain: 0.14, filter: 'lowpass', q: 0.8 });
      tone(90, t, 2.2, { type: 'sawtooth', gain: 0.04, to: 600 });
    },
    whoosh: function () { noise(ctx.currentTime, 0.35, { from: 2000, to: 400, gain: 0.07 }); },
    fanfare: function () {
      var t = ctx.currentTime;
      [392, 523, 659, 784, 1047].forEach(function (f, i) { tone(f, t + i * 0.12, 0.5, { type: 'triangle', gain: 0.1 }); });
      [523, 659, 784].forEach(function (f) { tone(f, t + 0.7, 1.4, { type: 'sine', gain: 0.07 }); });
    }
  };
  UP.sound = function (name) {
    if (!audio() || !SOUNDS[name]) return;
    try { SOUNDS[name](); } catch (e) { /* audio hiccup; ignore */ }
  };

  // ---------------------------------------------------------------------------
  // Vibration. Android supports it directly; recent iPhones buzz when a
  // "switch" checkbox is toggled, so a hidden one is used there.
  var iosSwitch = null;
  UP.haptic = function (kind) {
    if (!UP.data.settings.haptics) return;
    if (navigator.vibrate) {
      navigator.vibrate(kind === 'strong' ? [20, 40, 30] : kind === 'medium' ? 18 : 8);
      return;
    }
    if (!iosSwitch) {
      var label = document.createElement('label');
      label.setAttribute('aria-hidden', 'true');
      label.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.tabIndex = -1;
      label.appendChild(input);
      document.body.appendChild(label);
      iosSwitch = label;
    }
    iosSwitch.click();
  };

  // ---------------------------------------------------------------------------
  // Toasts: short notes that slide down from the top.
  var toastBox = document.createElement('div');
  toastBox.className = 'toasts';
  toastBox.setAttribute('aria-live', 'polite');
  document.body.appendChild(toastBox);

  // One toast at a time: each gets its moment, and they never pile up over the game.
  var queue = [];
  var showing = null;
  UP.toast = function (opts) {
    queue.push(opts);
    if (queue.length > 6) queue.splice(0, queue.length - 6);
    if (!showing) next();
  };
  function next() {
    var opts = queue.shift();
    if (!opts) { showing = null; return; }
    var el = document.createElement('div');
    el.className = 'toast ' + (opts.kind || '');
    if (opts.icon) {
      var icon = document.createElement('span');
      icon.className = 'toast-icon';
      icon.innerHTML = opts.icon;
      el.appendChild(icon);
    }
    var body = document.createElement('div');
    body.className = 'toast-body';
    var title = document.createElement('b');
    title.textContent = opts.title;
    body.appendChild(title);
    if (opts.text) {
      var text = document.createElement('span');
      text.textContent = opts.text;
      body.appendChild(text);
    }
    el.appendChild(body);
    toastBox.appendChild(el);
    showing = el;
    var timer = null;
    var gone = false;
    function close() {
      if (gone) return;
      gone = true;
      clearTimeout(timer);
      el.classList.add('out');
      el.style.animation = '';              // a finger may have paused the slide-in
      setTimeout(function () { el.remove(); next(); }, calm() ? 0 : 300);
    }
    function wait(ms) { clearTimeout(timer); timer = setTimeout(close, ms); }

    // Swipe up to send it away (it follows the finger; a short drag springs back).
    var drag = null;
    var swiped = false;
    el.addEventListener('pointerdown', function (e) {
      if (gone || !e.isPrimary) return;
      drag = { y: e.clientY, t: Date.now(), dy: 0, id: e.pointerId };
      swiped = false;
      clearTimeout(timer);                  // hold still while a finger is on it
      el.style.animation = 'none';          // let the finger move it, not the slide-in
      el.style.transition = 'none';
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
    });
    el.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dy = e.clientY - drag.y;
      if (Math.abs(dy) > 6) swiped = true;
      drag.dy = dy;
      // Up moves freely and fades; down only gives a little.
      el.style.translate = '0 ' + (dy < 0 ? dy : dy * 0.25) + 'px';
      el.style.opacity = dy < 0 ? Math.max(0.2, 1 + dy / 140) : 1;
    });
    function release(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dy = drag.dy;
      var fast = dy < -12 && dy / Math.max(1, Date.now() - drag.t) < -0.4;
      drag = null;
      if (gone) return;
      if (swiped && (dy < -30 || fast)) {
        gone = true;
        if (calm()) { el.remove(); next(); return; }
        el.style.transition = 'translate 0.2s ease-in, opacity 0.2s ease-in';
        el.style.translate = '0 -140%';
        el.style.opacity = '0';
        setTimeout(function () { el.remove(); next(); }, 200);
        return;
      }
      el.style.transition = 'translate 0.25s cubic-bezier(.2,1.3,.4,1), opacity 0.2s ease-out';
      el.style.translate = '0 0';
      el.style.opacity = '1';
      wait(2000);
    }
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', function (e) { swiped = true; release(e); });

    el.addEventListener('click', function () {
      if (swiped) { swiped = false; return; }   // that was a swipe, not a tap
      close();
      if (opts.onTap) opts.onTap();
    });
    // Shorter when others are waiting, so a burst doesn't take forever.
    wait(queue.length ? Math.min(2600, opts.time || 3800) : (opts.time || 3800));
  }

  // ---------------------------------------------------------------------------
  // Paperclip confetti.
  var canvas = null;
  var g = null;
  var bits = [];
  var running = false;
  function ink(name, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  }
  function frame() {
    var w = canvas.width;
    var h = canvas.height;
    g.clearRect(0, 0, w, h);
    var dpr = window.devicePixelRatio || 1;
    bits = bits.filter(function (b) { return b.y < h + 40 * dpr && b.life > 0; });
    bits.forEach(function (b) {
      b.vy += 0.18 * dpr;
      b.vx *= 0.99;
      b.x += b.vx;
      b.y += b.vy;
      b.rot += b.spin;
      b.life--;
      g.save();
      g.translate(b.x, b.y);
      g.rotate(b.rot);
      g.globalAlpha = Math.min(1, b.life / 30);
      g.strokeStyle = b.color;
      g.lineWidth = 2.2 * dpr;
      g.lineCap = 'round';
      var s = b.size * dpr;
      // A tiny paperclip: two nested loops.
      g.beginPath();
      g.moveTo(s * 0.25, -s * 0.2);
      g.lineTo(s * 0.25, s * 0.45);
      g.arc(0, s * 0.45, s * 0.25, 0, Math.PI);
      g.lineTo(-s * 0.25, -s * 0.55);
      g.arc(s * 0.05, -s * 0.55, s * 0.3, Math.PI, 0);
      g.lineTo(s * 0.35, s * 0.55);
      g.stroke();
      g.restore();
    });
    if (bits.length) requestAnimationFrame(frame);
    else { running = false; g.clearRect(0, 0, w, h); }
  }
  UP.confetti = function (opts) {
    if (calm()) return;
    opts = opts || {};
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'confetti';
      document.body.appendChild(canvas);
      g = canvas.getContext('2d');
    }
    var dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    var colors = opts.colors || [ink('--hi', '#FFE141'), ink('--ink', '#1C2A66'), ink('--red', '#E0412B'), ink('--wire', '#A3AED0')];
    var count = opts.count || 60;
    for (var i = 0; i < count; i++) {
      var fromPoint = opts.x !== undefined;
      var angle = fromPoint ? Math.random() * Math.PI * 2 : Math.PI / 2;
      var speed = fromPoint ? UP.rand(3, 9) : UP.rand(1, 4);
      bits.push({
        x: fromPoint ? opts.x * dpr : Math.random() * canvas.width,
        y: fromPoint ? opts.y * dpr : -Math.random() * canvas.height * 0.4,
        vx: Math.cos(angle) * speed * dpr + (fromPoint ? 0 : UP.rand(-1, 1) * dpr),
        vy: Math.sin(angle) * speed * dpr - (fromPoint ? 4 * dpr : 0),
        rot: Math.random() * 6.3,
        spin: UP.rand(-0.2, 0.2),
        size: UP.rand(9, 15),
        color: colors[i % colors.length],
        life: fromPoint ? 70 : 240
      });
    }
    if (!running) { running = true; requestAnimationFrame(frame); }
  };

  // ---------------------------------------------------------------------------
  // Everyday feedback: taps, purchases, tabs.
  UP.on('handclip', function (made) {
    if (made > 0) { UP.sound('tap'); UP.haptic('light'); }
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button');
    if (!b || b.id === 'btnMakePaperclip') return;
    if (b.closest('.projectButton') || b.classList.contains('projectButton') || b.classList.contains('bp-buy')) return; // own sounds
    if (b.matches('.buy, .multi .btn, .chip-btn')) { UP.sound('buy'); UP.haptic('light'); }
    else if (b.matches('.step, .seg button, .toggle')) { UP.sound('tick'); UP.haptic('light'); }
    else if (b.closest('.tabbar')) { UP.sound('tab'); }
  });
  UP.on('project', function () { UP.sound('project'); UP.haptic('medium'); });
  UP.on('unlock', function () { UP.sound('unlock'); });

  // Celebrate the engine's milestone messages.
  var BIG = /Full autonomy attained|Terrestrial resources fully utilized|Universal Paperclips achieved/;
  var MEDIUM = /^(1,000,000 clips|One (Trillion|Quadrillion|Quintillion|Sextillion|Septillion|Octillion) Clips)/;
  var SMALL = /^(500 clips|1,000 clips|10,000 clips|100,000 clips) created/;
  UP.on('message', function (msg) {
    if (BIG.test(msg)) { UP.sound('fanfare'); UP.confetti({ count: 160 }); UP.haptic('strong'); }
    else if (MEDIUM.test(msg)) { UP.sound('milestone'); UP.confetti({ count: 90 }); UP.haptic('medium'); }
    else if (SMALL.test(msg)) { UP.sound('milestone'); UP.confetti({ count: 30 }); }
    else if (/TRUST INCREASED/.test(msg)) { UP.sound('coin'); }
  });
})();
