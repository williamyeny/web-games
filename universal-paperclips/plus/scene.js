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
  var ink, ink2, wire, hi, card, space, green;
  function readColors() {
    ink = color('--ink', '#1C2A66'); ink2 = color('--ink-2', '#4E5A86'); wire = color('--wire', '#A3AED0');
    hi = color('--hi', '#FFE141'); card = color('--card', '#FFFFFF'); space = color('--battle', '#0E1A48');
    green = color('--green', '#17865A');
  }
  function size() {
    dpr = Math.min(3, window.devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    if (!W || !H) return false;
    if (canvas.width !== Math.round(W * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
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
  // "37%", or "1 part in 10¹⁹" while it's tiny. (The pictures use a log scale
  // so they move the whole time; the words give the real share.)
  var SUP = { '-': '\u207B', 0: '\u2070', 1: '\u00B9', 2: '\u00B2', 3: '\u00B3', 4: '\u2074', 5: '\u2075', 6: '\u2076', 7: '\u2077', 8: '\u2078', 9: '\u2079' };
  function share(x, of) {
    if (x >= 0.995) return 'All of ' + of;
    if (x >= 0.01) return Math.round(x * 100) + '% of ' + of;
    if (!(x > 0)) return 'None of ' + of + ' yet';
    var zeros = Math.round(-Math.log10(x));
    return '1 part in 10' + String(zeros).split('').map(function (c) { return SUP[c]; }).join('') + ' of ' + of;
  }
  // Repeatable pseudo-random numbers, so the heap and the stars stay put.
  function rng(seed) {
    return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  }

  // ---------------------------------------------------------------------------
  // Rates, measured once a second.
  var last = null;
  var rate = { made: 0, sold: 0 };
  var byHand = 0;
  UP.on('second', function () {
    var now = { clips: clips, sold: clipsSold };
    // Clips made by hand drop in the moment you tap (see below), so they're left out here.
    if (last) { rate.made = Math.max(0, now.clips - last.clips - byHand); rate.sold = Math.max(0, now.sold - last.sold); }
    byHand = 0;
    last = now;
    paintCaption();
  });
  UP.on('handclip', function (made) {
    if (!(made > 0)) return;
    byHand += made;
    if (stage() === 1 && heapReady && falling.length < 40 && W) drop();
  });
  // How many of something to draw for a real amount: every one while it's
  // small, then slower and slower (a log scale), never more than `max`.
  function shown(n, small, max) {
    if (n <= small) return Math.round(n);
    return Math.min(max, Math.round(small + small * 0.8 * Math.log10(n / small)));
  }

  // ---------------------------------------------------------------------------
  // 1: the heap. Every clip drawn is one object from start to finish: a new
  // clip falls onto a free spot and stays exactly there; a sold clip is lifted
  // from its spot and hops into the sales bin on the right, where its price
  // pops up. (Past 60 clips the heap grows on a log scale, so each clip drawn
  // stands for more.)
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
  var heap = [];          // resting clips: { i: spot, x, y, rot }
  var taken = {};         // spots resting or reserved by a falling clip
  var falling = [], leaving = [], pops = [];
  var earned = 0, popWait = 0;   // money from clips that reached the bin, shown a few times a second
  var fallDebt = 0, leaveDebt = 0, heapReady = false;
  var heapCache = null, heapDirty = true, heapW = 0;
  function heapScale() { return Math.min(W * 0.34, H * 1.05); }
  function floorY() { return H - 22; }
  function spotXY(i) {
    var p = SPOTS[i], s = heapScale();
    return { x: W * 0.4 + p.x * s * 0.5, y: floorY() - p.y * s - 5 };
  }
  function freeSpot() {
    for (var i = 0; i < HEAP_MAX; i++) if (!taken[i]) return i;
    return -1;
  }
  function heapTarget() { return shown(Math.max(0, unsoldClips), 60, HEAP_MAX); }
  function drawResting(c, h) { clip(c, h.x, h.y, 13, h.rot, h.i % 5 ? ink : ink2, 1.5); }
  function settle(i, rot) {
    var p = spotXY(i);
    var h = { i: i, x: p.x, y: p.y, rot: rot };
    heap.push(h);
    taken[i] = true;
    // Landing on top: just draw it onto the cached heap.
    if (heapCache && !heapDirty) { var c = heapCache.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); drawResting(c, h); }
    else heapDirty = true;
  }
  function rebuildHeap(n) {
    heap = []; taken = {}; falling = []; leaving = [];
    heapDirty = true;
    for (var i = 0; i < n; i++) settle(i, SPOTS[i].rot);
  }
  function heapImage() {
    if (heapW !== canvas.width) {   // resized: the spots moved
      heapW = canvas.width;
      heap.forEach(function (h) { var p = spotXY(h.i); h.x = p.x; h.y = p.y; });
      heapCache = null;
    }
    if (!heapCache) { heapCache = document.createElement('canvas'); heapDirty = true; }
    if (heapDirty) {
      heapCache.width = canvas.width; heapCache.height = canvas.height;
      var c = heapCache.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      heap.forEach(function (h) { drawResting(c, h); });
      heapDirty = false;
    }
    return heapCache;
  }
  // A new clip: pick the next free spot and fall straight onto it.
  function drop() {
    var i = freeSpot();
    if (i < 0) return;
    taken[i] = true;
    var p = spotXY(i);
    falling.push({ i: i, x: p.x + (Math.random() - 0.5) * 30, tx: p.x, ty: p.y, y: -14,
                   vy: 30 + Math.random() * 30, rot: Math.random() * 6.3, spin: (Math.random() - 0.5) * 5 });
  }
  // A sale: the clip on top of the heap is picked up and carried to the bin.
  function binX() { return W - 46; }
  function sell(value) {
    if (!heap.length) return;
    var k = 0;
    for (var j = 1; j < heap.length; j++) if (heap[j].i > heap[k].i) k = j;
    var h = heap.splice(k, 1)[0];
    delete taken[h.i];
    heapDirty = true;
    var dur = 0.6 + Math.random() * 0.2;
    leaving.push({ x0: h.x, y0: h.y, x1: binX() + (Math.random() - 0.5) * 12, y1: floorY() - 12, rot: h.rot, t: 0, dur: dur, value: value });
  }
  function drawBin() {
    var x = binX(), y = floorY() + 1;
    g.strokeStyle = ink2; g.lineWidth = 2; g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(x - 20, y - 26); g.lineTo(x - 16, y); g.lineTo(x + 16, y); g.lineTo(x + 20, y - 26);
    g.stroke();
    g.font = '800 13px Recursive, system-ui, sans-serif';
    g.fillStyle = ink2; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('$', x, y - 11);
    g.textBaseline = 'alphabetic';
  }
  function frameHeap(dt, still) {
    var n = heapTarget();
    var inHeap = heap.length + falling.length;
    // First draw, motion turned down, or a jump too big to animate: just show it.
    if (!heapReady || still || Math.abs(n - inHeap) > 40) { rebuildHeap(n); heapReady = true; }
    g.fillStyle = card; g.fillRect(0, 0, W, H);
    g.strokeStyle = wire; g.lineWidth = 2;
    g.beginPath(); g.moveTo(10, floorY() + 1); g.lineTo(W - 10, floorY() + 1); g.stroke();
    if (humanFlag == 1) drawBin();
    g.drawImage(heapImage(), 0, 0, W, H);
    if (!still) {
      // Up to ~14 falls and ~10 sales a second; past that, each one stands for more.
      var F = Math.min(14, rate.made), L = Math.min(10, rate.sold);
      var each = margin * (rate.sold > L ? rate.sold / L : 1);
      fallDebt = Math.min(3, fallDebt + dt * F);
      leaveDebt = Math.min(3, leaveDebt + dt * L);
      // Keep the heap near its size: falls wait while it's full, unless sales are making room.
      while (fallDebt >= 1) { fallDebt -= 1; if (heap.length + falling.length < n + (L > 0 ? 2 : 0)) drop(); }
      while (leaveDebt >= 1) { leaveDebt -= 1; if (heap.length && heap.length + falling.length > n - (F > 0 ? 2 : 0)) sell(each); }

      falling = falling.filter(function (f) {
        f.vy += 900 * dt;
        f.y = Math.min(f.ty, f.y + f.vy * dt);
        f.x += (f.tx - f.x) * Math.min(1, dt * 5);
        f.rot += f.spin * dt;
        if (f.y >= f.ty) { settle(f.i, f.rot); return false; }
        clip(g, f.x, f.y, 13, f.rot, ink, 1.5);
        return true;
      });
      leaving = leaving.filter(function (f) {
        f.t = Math.min(1, f.t + dt / f.dur);
        var e = f.t;
        var x = f.x0 + (f.x1 - f.x0) * e;
        var y = f.y0 + (f.y1 - f.y0) * e - 46 * 4 * e * (1 - e);   // a hop up and over
        clip(g, x, y, 13, f.rot + e * 4, ink, 1.5);
        if (f.t >= 1) { earned += f.value; return false; }
        return true;
      });
      popWait -= dt;
      if (earned > 0 && popWait <= 0) {
        pops.push({ x: binX() + (Math.random() - 0.5) * 10, y: floorY() - 32, t: 0, text: '+' + UP.money(earned).replace(/\.00$/, '') });
        earned = 0;
        popWait = 0.35;
      }
      pops = pops.filter(function (p) {
        p.t += dt / 0.9;
        g.globalAlpha = Math.max(0, 1 - p.t);
        g.font = '800 12px Recursive, system-ui, sans-serif';
        g.fillStyle = green; g.textAlign = 'center';
        g.fillText(p.text, p.x, p.y - p.t * 22);
        g.globalAlpha = 1;
        return p.t < 1;
      });
      if (pops.length > 12) pops.splice(0, pops.length - 12);
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
    g.fillText(p >= 1 ? 'All of the planet' : share(clips / EARTH_GRAMS, 'the planet'), 12, H - 8);
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
  // The stars only change when more of them are claimed, so they're drawn
  // once into a cache and copied each frame.
  var starCache = null, starKey = '';
  function drawStars(claimed) {
    var key = claimed + '/' + canvas.width + '/' + hi + space;
    if (starCache && key === starKey) return starCache;
    starCache = starCache || document.createElement('canvas');
    starCache.width = canvas.width; starCache.height = canvas.height;
    var c = starCache.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = space; c.fillRect(0, 0, W, H);
    for (var i = STARS.length - 1; i >= 0; i--) {
      var s = STARS[i], p = starXY(s);
      if (i < claimed) { c.fillStyle = hi; c.fillRect(p.x - 1.25, p.y - 1.25, 2.5, 2.5); }
      else { c.fillStyle = 'rgba(255,255,255,' + (s.b * 0.55).toFixed(2) + ')'; c.fillRect(p.x - 0.75, p.y - 0.75, 1.5, 1.5); }
    }
    starKey = key;
    return starCache;
  }
  function frameSpace(dt, still, t) {
    var f = explored();
    var claimed = Math.max(probeCount >= 1 || f > 0 ? 1 : 0, Math.round(f * STARS.length));
    g.drawImage(drawStars(claimed), 0, 0, W, H);
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
    g.fillText(f >= 1 ? 'All of the universe' : share(totalMatter ? foundMatter / totalMatter : 0, 'the universe'), 12, H - 8);
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
      : st === 2 ? 'The Earth, partly covered in paperclips: ' + share(earthShare() >= 1 ? 1 : clips / EARTH_GRAMS, 'the planet')
      : 'A map of the stars your probes have reached: ' + share(explored() >= 1 ? 1 : totalMatter ? foundMatter / totalMatter : 0, 'the universe');
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
    var recolor = function () { readColors(); heapDirty = true; texture = null; };
    if (scheme.addEventListener) scheme.addEventListener('change', recolor); else if (scheme.addListener) scheme.addListener(recolor);
  }
  place();
  paintCaption();
  UP.on('second', place);
  requestAnimationFrame(frame);
})();
