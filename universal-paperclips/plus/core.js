// Mobile edition additions: shared state, events and helpers.
// Everything the new features need to remember lives in one save ("up-plus")
// that survives new universes, next to the engine's own save.
(function () {
  'use strict';

  var UP = window.UP = window.UP || {};
  var KEY = 'up-plus';

  function freshRun() {
    return { playSeconds: 0, handClips: 0, lucky: 0, projects: 0, priceChanges: 0, startedAt: Date.now() };
  }
  var DEFAULTS = {
    v: 1,
    settings: { sound: true, haptics: true },
    seenLog: null,          // newest changelog entry the player has opened
    trophies: {},           // id -> time earned
    stats: {                // lifetime, across universes
      playSeconds: 0, handClips: 0, lucky: 0, projects: 0,
      universes: 0, clips: 0, fastestUniverse: 0
    },
    stardust: 0,
    blueprints: {},         // id -> level
    universe: 1,            // which universe this is
    laws: [],               // laws of physics in this universe
    pending: null,          // a finished universe waiting for the multiverse screen
    run: freshRun(),        // stats for this universe only
    lastSeen: 0,            // for the welcome back gift
    seenIntro: false
  };

  function merge(base, extra) {
    var out = {};
    Object.keys(base).forEach(function (k) {
      var b = base[k];
      var e = extra ? extra[k] : undefined;
      if (b && typeof b === 'object' && !Array.isArray(b)) out[k] = merge(b, e && typeof e === 'object' ? e : {});
      else out[k] = e === undefined ? b : e;
    });
    if (extra) Object.keys(extra).forEach(function (k) { if (!(k in out)) out[k] = extra[k]; });
    return out;
  }

  var stored = null;
  try { stored = JSON.parse(localStorage.getItem(KEY)); } catch (e) { stored = null; }
  UP.data = merge(DEFAULTS, stored);
  UP.isNewPlayer = !stored && localStorage.getItem('saveGame') === null;
  UP.freshRun = freshRun;

  UP.save = function () {
    try { localStorage.setItem(KEY, JSON.stringify(UP.data)); } catch (e) { /* storage full or blocked */ }
  };
  // Save alongside the engine.
  var engineSave = window.save;
  window.save = function () {
    var r = engineSave.apply(this, arguments);
    UP.data.lastSeen = Date.now();
    UP.save();
    return r;
  };

  // ---------------------------------------------------------------------------
  // Events.
  var handlers = {};
  UP.on = function (name, fn) { (handlers[name] = handlers[name] || []).push(fn); };
  UP.emit = function (name, data) {
    (handlers[name] || []).forEach(function (fn) {
      try { fn(data); } catch (err) { if (window.console) console.error(err); }
    });
  };

  // Messages from the engine.
  var engineMessage = window.displayMessage;
  window.displayMessage = function (msg) {
    var r = engineMessage.apply(this, arguments);
    UP.emit('message', String(msg));
    return r;
  };

  // Finished projects.
  projects.forEach(function (p) {
    var effect = p.effect;
    p.effect = function () {
      var flagBefore = p.flag;
      var usesBefore = p.uses;
      var r = effect.apply(this, arguments);
      if (p.flag !== flagBefore || p.uses !== usesBefore || p.flag == 1) {
        UP.data.run.projects++;
        UP.data.stats.projects++;
        UP.emit('project', p);
      }
      return r;
    };
  });

  // Taps on Make paperclip.
  var engineHandClip = window.handClip;
  window.handClip = function () {
    var before = clips;
    var r = engineHandClip.apply(this, arguments);
    var made = clips - before;
    if (made > 0) {
      UP.data.run.handClips += made;
      UP.data.stats.handClips += made;
    }
    UP.emit('handclip', made);
    return r;
  };

  // Price changes (for a trophy).
  ['raisePrice', 'lowerPrice'].forEach(function (name) {
    var fn = window[name];
    window[name] = function () {
      var r = fn.apply(this, arguments);
      UP.data.run.priceChanges++;
      return r;
    };
  });

  // ---------------------------------------------------------------------------
  // Helpers.
  // 1 business, 2 Earth, 3 space, 4 the universe is paperclips.
  UP.phase = function () {
    if (milestoneFlag >= 15) return 4;
    if (humanFlag == 1) return 1;
    return spaceFlag == 1 ? 3 : 2;
  };
  UP.busy = false; // true while a full-screen moment is playing
  UP.visible = function () { return document.visibilityState !== 'hidden'; };

  // "1,234" for small numbers, "1.2 million" for big ones.
  UP.fmt = function (n) {
    n = Math.max(0, Math.floor(n || 0));
    if (n < 1e6) return formatWithCommas(n);
    return spellf(n).trim().replace(/\s+,.*$/, '');
  };
  UP.money = function (n) { return '$' + formatWithCommas(Math.max(0, n || 0), 2); };
  UP.duration = function (seconds) {
    seconds = Math.max(0, Math.round(seconds));
    var h = Math.floor(seconds / 3600);
    var m = Math.floor(seconds % 3600 / 60);
    var s = seconds % 60;
    if (h) return h + 'h ' + m + 'm';
    if (m) return m + 'm ' + s + 's';
    return s + 's';
  };
  UP.rand = function (a, b) { return a + Math.random() * (b - a); };
  UP.pick = function (list) {
    var total = list.reduce(function (t, x) { return t + x.w; }, 0);
    var r = Math.random() * total;
    for (var i = 0; i < list.length; i++) { r -= list[i].w; if (r <= 0) return list[i]; }
    return list[list.length - 1];
  };

  // ---------------------------------------------------------------------------
  // Short-lived bonuses (e.g. from lucky paperclips). They multiply the
  // engine's `boost` numbers and are never saved, so they can't get stuck on.
  UP.boosts = [];
  UP.addBoost = function (kind, mult, seconds, label) {
    UP.boosts.push({ kind: kind, mult: mult, left: seconds, total: seconds, label: label });
    applyBoosts();
    UP.emit('boosts');
  };
  function applyBoosts() {
    boost.demand = 1; boost.clips = 1; boost.ops = 1;
    UP.boosts.forEach(function (b) { boost[b.kind] *= b.mult; });
  }

  // ---------------------------------------------------------------------------
  // Clock: a tick every 100ms, and a second counter that only runs while the
  // game is on screen.
  var tenths = 0;
  setInterval(function () {
    if (!UP.visible()) return;
    UP.emit('tick');
    if (++tenths < 10) return;
    tenths = 0;
    UP.data.run.playSeconds++;
    UP.data.stats.playSeconds++;
    if (UP.boosts.length) {
      UP.boosts.forEach(function (b) { b.left--; });
      var before = UP.boosts.length;
      UP.boosts = UP.boosts.filter(function (b) { return b.left > 0; });
      applyBoosts();
      if (UP.boosts.length !== before) UP.emit('boosts');
    }
    UP.emit('second');
  }, 100);

  // ---------------------------------------------------------------------------
  // Perks: permanent multipliers from the multiverse and from new projects.
  // Every feature that grants perks registers a function here.
  var perkSources = [];
  UP.perkSource = function (fn) { perkSources.push(fn); UP.updatePerks(); };
  UP.updatePerks = function () {
    Object.keys(perk).forEach(function (k) { perk[k] = 1; });
    perk.tap = 1;
    perk.lucky = 1;
    perk.luckyReward = 1;
    perkSources.forEach(function (fn) { fn(perk); });
  };
  UP.updatePerks();
  UP.on('project', function () { UP.updatePerks(); });
})();
