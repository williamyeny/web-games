// Mobile edition additions: sound, vibration and toasts.
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
    // A low, slow chord for the turning points that aren't really good news.
    toll: function () {
      var t = ctx.currentTime;
      [65.4, 98, 155.6].forEach(function (f, i) { tone(f, t + i * 0.18, 3.2, { type: 'sine', gain: 0.16 - i * 0.03 }); });
      noise(t, 2.4, { from: 180, to: 60, gain: 0.05, filter: 'lowpass', q: 0.7 });
    }
  };
  // A threnody for fallen probes (the original played a recording; this is a
  // short synthesized lament in its place).
  SOUNDS.threnody = function () {
    var t = ctx.currentTime + 0.05;
    tone(55, t, 9, { type: 'sine', gain: 0.12 });
    [[220, 0, 1.4], [261.6, 1.2, 1.4], [329.6, 2.4, 1.8], [293.7, 4, 1.2], [261.6, 5, 1.2], [246.9, 6, 1.4], [220, 7.2, 2.6]]
      .forEach(function (n) { tone(n[0], t + n[1], n[2], { type: 'triangle', gain: 0.09 }); });
  };
  window.playThrenody = function () { UP.sound('threnody'); };

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

  // Mark the engine's milestone messages with sound. The big turning points
  // (humanity gone, Earth used up, the universe used up) toll instead of cheer.
  var BIG = /Full autonomy attained|Terrestrial resources fully utilized|Universal Paperclips achieved/;
  var MEDIUM = /^(1,000,000 clips|One (Trillion|Quadrillion|Quintillion|Sextillion|Septillion|Octillion) Clips)/;
  var SMALL = /^(500 clips|1,000 clips|10,000 clips|100,000 clips) created/;
  UP.on('message', function (msg) {
    if (BIG.test(msg)) { UP.sound('toll'); UP.haptic('strong'); }
    else if (MEDIUM.test(msg)) { UP.sound('milestone'); UP.haptic('medium'); }
    else if (SMALL.test(msg)) { UP.sound('milestone'); }
    else if (/TRUST INCREASED/.test(msg)) { UP.sound('coin'); }
  });
})();
