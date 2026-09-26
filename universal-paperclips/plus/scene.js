// Mobile edition additions: a picture of what you're making.
// The numbers get too big to mean anything, so the top of each stage's main
// tab shows it instead:
//   1  the heap of unsold clips: new ones fall in, sold ones slide away
//      (a growing heap means the price is too high for the demand)
//   2  the Earth, covered in paperclips as the drones take it apart
//   3  the universe: stars claimed as the probes spread out, drifters among them
// Under it, a comparison to picture the total (plus/facts.js).
(function () {
  'use strict';
  var UP = window.UP;

  var sec = document.createElement('div');
  sec.id = 'ui-sceneDiv';
  sec.className = 'sec scene';
  var canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  var caption = document.createElement('p');
  caption.className = 'scene-caption';
  sec.appendChild(canvas);
  sec.appendChild(caption);
  var g = canvas.getContext('2d');
  var W = 0, H = 0, dpr = 1;

  function panel(name) { return document.querySelector('[data-panel="' + name + '"]'); }
  function stage() { return UP.phase() >= 3 ? 3 : UP.phase(); }
  function place() {
    var target = panel(stage() >= 3 ? 'space' : 'make');
    if (sec.parentNode !== target) target.insertBefore(sec, target.firstChild);
  }
  function color(name, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  }
  var ink, ink2, wire, hi, card, space;
  function readColors() {
    ink = color('--ink', '#1C2A66'); ink2 = color('--ink-2', '#4E5A86'); wire = color('--wire', '#A3AED0');
    hi = color('--hi', '#FFE141'); card = color('--card', '#FFFFFF'); space = color('--battle', '#0E1A48');
  }
  function size() {
    dpr = Math.min(3, window.devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    if (!W || !H) return false;
    if (canvas.width !== Math.round(W * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); heapCache = null; }
    return true;
  }

  // A paperclip outline, centred on (0, 0), s pixels long.
  function clip(ctx, x, y, s, rot, stroke, width) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width || Math.max(1, s * 0.09);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 0.12, -s * 0.12);
    ctx.lineTo(s * 0.12, s * 0.22);
    ctx.arc(0, s * 0.22, s * 0.12, 0, Math.PI);
    ctx.lineTo(-s * 0.12, -s * 0.3);
    ctx.arc(s * 0.03, -s * 0.3, s * 0.15, Math.PI, 0);
    ctx.lineTo(s * 0.18, s * 0.3);
    ctx.stroke();
    ctx.restore();
  }
  // Repeatable pseudo-random numbers, so the heap and the stars stay put.
  function rng(seed) {
    return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  }

  // ---------------------------------------------------------------------------
  // Rates, measured once a second.
  var last = null;
  var rate = { made: 0, sold: 0 };
  UP.on('second', function () {
    var now = { clips: clips, sold: clipsSold };
    if (last) { rate.made = Math.max(0, now.clips - last.clips); rate.sold = Math.max(0, now.sold - last.sold); }
    last = now;
    paintCaption();
  });
  // How many of something to draw for a real amount: every one while it's
  // small, then slower and slower (a log scale), never more than `max`.
  function shown(n, small, max) {
    if (n <= small) return Math.round(n);
    return Math.min(max, Math.round(small + small * 0.8 * Math.log10(n / small)));
  }

  // ---------------------------------------------------------------------------
  // 1: the heap.
  var HEAP_MAX = 420;
  var SPOTS = (function () {
    // Resting spots spread evenly over a half-disc, nearest the middle first,
    // so the heap grows outward and upward as clips pile on.
    var r = rng(7), spots = [];
    for (var i = 0; i < HEAP_MAX; i++) {
      var a = r() * Math.PI, d = Math.sqrt(r());
      spots.push({ x: Math.cos(a) * d * 1.7, y: Math.sin(a) * d * 0.62, d: d, rot: r() * 6.3 });
    }
    spots.sort(function (p, q) { return p.d - q.d; });
    return spots;
  })();
  var heapCache = null, heapCount = -1;
  function heapScale() { return Math.min(W * 0.34, H * 1.05); }
  function floorY() { return H - 22; }
  function heapTop(n) {
    if (!n) return floorY();
    var s = heapScale();
    return floorY() - SPOTS[Math.max(0, n - 1)].d * 0.62 * s - 4;
  }
  function drawHeap(n) {
    if (heapCache && heapCount === n) return heapCache;
    heapCache = heapCache || document.createElement('canvas');
    heapCache.width = canvas.width; heapCache.height = canvas.height;
    var c = heapCache.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    var s = heapScale(), cx = W * 0.42, fy = floorY();
    for (var i = n - 1; i >= 0; i--) {
      var p = SPOTS[i];
      clip(c, cx + p.x * s * 0.5, fy - p.y * s - 5, 13, p.rot, i % 5 ? ink : ink2, 1.5);
    }
    heapCount = n;
    return heapCache;
  }
  var falling = [], leaving = [], fallDebt = 0, leaveDebt = 0;
  function frameHeap(dt, still) {
    var n = shown(Math.max(0, unsoldClips), 60, HEAP_MAX);
    g.fillStyle = card; g.fillRect(0, 0, W, H);
    g.strokeStyle = wire; g.lineWidth = 2;
    g.beginPath(); g.moveTo(10, floorY() + 1); g.lineTo(W - 10, floorY() + 1); g.stroke();
    g.drawImage(drawHeap(n), 0, 0, W, H);
    if (!still) {
      var cx = W * 0.42, s = heapScale();
      // New clips drop in at up to ~14 a second (fewer, faster ones stand for more).
      fallDebt += dt * Math.min(14, rate.made);
      while (fallDebt >= 1 && falling.length < 40) {
        fallDebt -= 1;
        falling.push({ x: cx + (Math.random() - 0.5) * Math.min(s * 0.8, 60 + n), y: -12, vy: 40 + Math.random() * 30, rot: Math.random() * 6.3, spin: (Math.random() - 0.5) * 6 });
      }
      if (fallDebt > 3) fallDebt = 3;
      // Sold clips slide off to the right along the floor.
      leaveDebt += dt * Math.min(10, rate.sold);
      while (leaveDebt >= 1 && leaving.length < 30 && n > 0) {
        leaveDebt -= 1;
        leaving.push({ x: cx + Math.min(W * 0.3, s * 0.5 * Math.sqrt(n / HEAP_MAX) * 1.6) + 6, y: floorY() - 5, vx: 80 + Math.random() * 60, rot: Math.random() * 6.3 });
      }
      if (leaveDebt > 3) leaveDebt = 3;
      var top = heapTop(n);
      falling = falling.filter(function (f) {
        f.vy += 900 * dt; f.y += f.vy * dt; f.rot += f.spin * dt;
        clip(g, f.x, f.y, 14, f.rot, ink, 1.6);
        return f.y < top;
      });
      leaving = leaving.filter(function (f) {
        f.x += f.vx * dt; f.rot += 3 * dt;
        g.globalAlpha = Math.max(0, Math.min(1, (W - f.x) / 60));
        clip(g, f.x, f.y, 13, f.rot, ink2, 1.5);
        g.globalAlpha = 1;
        return f.x < W;
      });
    }
    g.font = '600 12px Recursive, system-ui, sans-serif';
    g.fillStyle = ink2;
    g.textBaseline = 'alphabetic';
    g.textAlign = 'left';
    g.fillText(UP.fmt(unsoldClips) + ' unsold', 12, H - 6);
    if (humanFlag == 1) {
      g.textAlign = 'right';
      g.fillText(UP.fmt(rate.sold) + ' sold a second', W - 12, H - 6);
    }
  }

  // ---------------------------------------------------------------------------
  // 2: the Earth.
  var EARTH_GRAMS = 6e27;
  var LAND = (function () {
    var r = rng(11), blobs = [];
    for (var i = 0; i < 9; i++) blobs.push({ a: r() * 6.3, d: r() * 0.75, s: 0.18 + r() * 0.22 });
    return blobs;
  })();
  var drones = [];
  function earthShare() {
    if (availableMatter <= 0 && acquiredMatter <= 0 && humanFlag == 0) return 1;
    return Math.min(0.99, Math.max(0, (Math.log10(Math.max(clips, 1)) - 6) / (Math.log10(EARTH_GRAMS) - 6)));
  }
  var texture = null;
  function clipTexture() {
    if (texture) return texture;
    var t = document.createElement('canvas');
    t.width = t.height = Math.round(28 * dpr);
    var c = t.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#C9D0E6';
    c.fillRect(0, 0, 28, 28);
    clip(c, 8, 9, 11, 0.6, '#7C88B2', 1.3);
    clip(c, 21, 20, 11, -0.9, '#7C88B2', 1.3);
    texture = g.createPattern(t, 'repeat');
    if (texture.setTransform && window.DOMMatrix) texture.setTransform(new DOMMatrix().scale(1 / dpr));
    return texture;
  }
  function frameEarth(dt, still, t) {
    g.fillStyle = space; g.fillRect(0, 0, W, H);
    stars(0.35);
    var cx = W / 2, cy = H / 2, r = Math.min(H * 0.38, W * 0.26);
    var p = earthShare();
    // Ocean and land.
    g.save();
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#2F63D6'; g.fillRect(cx - r, cy - r, r * 2, r * 2);
    g.fillStyle = '#3FA46A';
    LAND.forEach(function (b) {
      g.beginPath(); g.arc(cx + Math.cos(b.a) * b.d * r, cy + Math.sin(b.a) * b.d * r, b.s * r, 0, Math.PI * 2); g.fill();
    });
    // Paperclips spread in from the right: the covered share of the disc's area is p.
    if (p > 0) {
      var lo = -1, hi2 = 1;
      for (var k = 0; k < 30; k++) {
        var m = (lo + hi2) / 2;
        var seg = (Math.acos(m) - m * Math.sqrt(1 - m * m)) / Math.PI;   // area right of x = m, as a share
        if (seg > p) lo = m; else hi2 = m;
      }
      var x0 = cx + ((lo + hi2) / 2) * r;
      g.fillStyle = clipTexture();
      g.beginPath();
      // A wavy edge, so it reads as something spreading rather than a cut.
      g.moveTo(cx + r, cy - r);
      for (var yy = -r; yy <= r; yy += 4) g.lineTo(x0 + Math.sin(yy / 9 + t * 0.8) * 3, cy + yy);
      g.lineTo(cx + r, cy + r);
      g.closePath();
      g.fill();
    }
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    // The swarm, circling.
    var want = shown(harvesterLevel + wireDroneLevel, 8, 70);
    while (drones.length < want) drones.push({ a: Math.random() * 6.3, rx: 1.15 + Math.random() * 0.5, ry: 0.35 + Math.random() * 0.6, tilt: (Math.random() - 0.5) * 1.2, v: 0.4 + Math.random() * 0.6 });
    drones.length = want;
    g.fillStyle = hi;
    drones.forEach(function (d) {
      if (!still) d.a += d.v * dt;
      var ex = Math.cos(d.a) * r * d.rx, ey = Math.sin(d.a) * r * d.ry;
      var x = cx + ex * Math.cos(d.tilt) - ey * Math.sin(d.tilt);
      var y = cy + ex * Math.sin(d.tilt) + ey * Math.cos(d.tilt);
      if (Math.sin(d.a) < 0 && Math.hypot(x - cx, y - cy) < r) return;   // behind the planet
      g.fillRect(x - 1.5, y - 1.5, 3, 3);
    });
    g.font = '600 12px Recursive, system-ui, sans-serif';
    g.fillStyle = 'rgba(220,227,255,0.85)';
    g.textAlign = 'left';
    g.fillText(p >= 1 ? 'The whole planet' : Math.round(p * 100) + '% of the way to the whole planet', 12, H - 8);
  }

  // ---------------------------------------------------------------------------
  // 3: the universe.
  var STARS = (function () {
    var r = rng(3), list = [];
    for (var i = 0; i < 1100; i++) {
      // Two spiral arms and a soft core.
      var arm = i % 2, d = Math.pow(r(), 0.7), a = arm * Math.PI + d * 4.2 + (r() - 0.5) * 0.9 * (1 - d * 0.5);
      if (i % 7 === 0) { d = r() * 0.25; a = r() * 6.3; }
      list.push({ x: Math.cos(a) * d, y: Math.sin(a) * d * 0.55, b: 0.3 + r() * 0.7 });
    }
    var home = list[500];
    list.forEach(function (s) { s.h = Math.hypot(s.x - home.x, (s.y - home.y) * 1.6); });
    list.sort(function (p, q) { return p.h - q.h; });
    return list;
  })();
  function explored() {
    if (milestoneFlag >= 15) return 1;
    if (!totalMatter) return 0;
    var share = Math.max(1e-30, foundMatter / totalMatter);
    return Math.min(1, Math.max(0, (Math.log10(share) + 28) / 28));
  }
  var movers = [];
  function starXY(s) { return { x: W / 2 + s.x * W * 0.47, y: H / 2 + s.y * H * 0.85 }; }
  function frameSpace(dt, still, t) {
    g.fillStyle = space; g.fillRect(0, 0, W, H);
    var f = explored();
    var claimed = Math.max(probeCount >= 1 || f > 0 ? 1 : 0, Math.round(f * STARS.length));
    for (var i = STARS.length - 1; i >= 0; i--) {
      var s = STARS[i], p = starXY(s);
      if (i < claimed) { g.fillStyle = hi; g.fillRect(p.x - 1.25, p.y - 1.25, 2.5, 2.5); }
      else { g.fillStyle = 'rgba(255,255,255,' + (s.b * 0.55).toFixed(2) + ')'; g.fillRect(p.x - 0.75, p.y - 0.75, 1.5, 1.5); }
    }
    // Probes head out from claimed stars to the next ones; drifters wander among them.
    var total = probeCount + drifterCount;
    var nProbes = probeCount >= 1 ? shown(probeCount, 6, 36) : 0;
    var nDrift = total > 0 ? Math.round(36 * drifterCount / total) : 0;
    var kinds = [];
    for (var a = 0; a < nProbes; a++) kinds.push('probe');
    for (var b = 0; b < nDrift; b++) kinds.push('drift');
    while (movers.length > kinds.length) movers.pop();
    kinds.forEach(function (kind, k) {
      var m = movers[k];
      if (!m || m.kind !== kind || m.t >= 1) {
        var from = STARS[Math.floor(Math.random() * Math.max(1, claimed))];
        var to = kind === 'probe' ? STARS[Math.min(STARS.length - 1, claimed + Math.floor(Math.random() * 40))]
                                  : STARS[Math.floor(Math.random() * Math.max(1, claimed))];
        m = movers[k] = { kind: kind, from: starXY(from), to: starXY(to), t: m && m.t >= 1 ? 0 : Math.random(), v: 0.25 + Math.random() * 0.4 };
      }
      if (!still) m.t = Math.min(1, m.t + m.v * dt);
      var x = m.from.x + (m.to.x - m.from.x) * m.t, y = m.from.y + (m.to.y - m.from.y) * m.t;
      g.fillStyle = kind === 'probe' ? '#FFFFFF' : '#FF7A93';
      g.beginPath(); g.arc(x, y, kind === 'probe' ? 1.8 : 2.2, 0, Math.PI * 2); g.fill();
    });
    g.font = '600 12px Recursive, system-ui, sans-serif';
    g.fillStyle = 'rgba(220,227,255,0.85)';
    g.textAlign = 'left';
    g.fillText(f >= 1 ? 'Every star' : claimed <= 1 ? 'Earth' : claimed + ' of ' + STARS.length + ' stars, on a log scale', 12, H - 8);
  }
  function stars(alpha) {
    for (var i = 0; i < STARS.length; i += 9) {
      var p = starXY(STARS[i]);
      g.fillStyle = 'rgba(255,255,255,' + (STARS[i].b * alpha).toFixed(2) + ')';
      g.fillRect(p.x - 0.6, p.y - 0.6, 1.2, 1.2);
    }
  }

  // ---------------------------------------------------------------------------
  function paintCaption() {
    var f = UP.funFact && UP.funFact();
    var text = f ? f.text : '';
    if (caption.textContent !== text) caption.textContent = text;
  }
  function describe(st) {
    return st === 1 ? 'A heap of ' + UP.fmt(unsoldClips) + ' unsold paperclips'
      : st === 2 ? 'The Earth, ' + Math.round(earthShare() * 100) + '% of the way to paperclips'
      : 'A map of the universe, ' + Math.round(explored() * 100) + '% claimed on a log scale';
  }

  var visible = false;
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(sec);
  } else visible = true;

  var then = 0, lastStill = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    var ended = dismantle >= 1 && document.getElementById('spaceDiv').style.display === 'none';
    var held = clips < 1 || ended;
    if (sec.classList.contains('ui-held') !== held) sec.classList.toggle('ui-held', held);
    if (held || !visible || !UP.visible() || !sec.offsetParent) return;
    var still = UP.calm();
    // About 30 frames a second, or one a second when motion is turned down.
    if (now - then < (still ? 1000 : 33)) return;
    var dt = Math.min(0.1, (now - then) / 1000);
    then = now;
    if (!size()) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    var st = stage();
    if (st === 1) frameHeap(dt, still);
    else if (st === 2) frameEarth(dt, still, now / 1000);
    else frameSpace(dt, still, now / 1000);
    if (now - lastStill > 1000) { lastStill = now; canvas.setAttribute('aria-label', describe(st)); }
  }

  readColors();
  if (window.matchMedia) {
    var scheme = window.matchMedia('(prefers-color-scheme: dark)');
    var recolor = function () { readColors(); heapCache = null; texture = null; };
    if (scheme.addEventListener) scheme.addEventListener('change', recolor); else if (scheme.addListener) scheme.addListener(recolor);
  }
  place();
  paintCaption();
  UP.on('second', place);
  requestAnimationFrame(frame);
})();
