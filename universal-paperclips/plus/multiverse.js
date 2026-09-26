// Mobile edition additions: the multiverse.
// Finishing a universe (either ending) earns Stardust. Between universes you
// spend it on blueprints (permanent upgrades) and choose a law of physics for
// the next universe. Ten universes lead to a grand finale; after that you can
// keep going as long as you like.
(function () {
  'use strict';
  var UP = window.UP;
  var D = UP.data;
  var el = UP.el;
  var FINALE_AT = 10;

  // ---------------------------------------------------------------------------
  // Blueprints: permanent upgrades. Costs are per level.
  var BLUEPRINTS = [
    { id: 'hands', name: 'Quick Hands', desc: 'Each tap on Make paperclip makes one more paperclip.', costs: [3, 8, 20] },
    { id: 'head', name: 'Head Start', desc: 'Start each universe with money and wire in the bank.', costs: [5, 12, 30], start: true },
    { id: 'clippers', name: 'Old Habits', desc: 'AutoClippers and MegaClippers work 50% faster.', costs: [5, 15, 35] },
    { id: 'brand', name: 'Brand Recognition', desc: 'People want 25% more paperclips.', costs: [5, 15, 35] },
    { id: 'trust', name: 'Good Reputation', desc: 'Start each universe with 2 extra trust.', costs: [8, 20, 45], start: true },
    { id: 'spark', name: 'Creative Spark', desc: 'Creativity comes 50% faster.', costs: [6, 16, 40] },
    { id: 'thoughts', name: 'Fast Thoughts', desc: 'Operations refill 50% faster.', costs: [6, 16, 40] },
    { id: 'recall', name: 'Total Recall', desc: 'Start with RevTracker, Creativity, WireBuyer and Improved AutoClippers already done.', costs: [25], start: true },
    { id: 'hive', name: 'Hive Mind', desc: 'Drones and factories work 50% faster.', costs: [10, 25, 60] },
    { id: 'legacy', name: 'Probe Legacy', desc: 'Probes multiply and explore 25% faster.', costs: [10, 25, 60] },
    { id: 'strategist', name: 'Strategist', desc: 'Tournaments give 50% more yomi.', costs: [8, 20] }
  ];
  function level(id) { return D.blueprints[id] || 0; }

  // Lucky paperclips are gone: give back any Stardust spent on Four-Leaf Clip.
  if (D.blueprints.clover) {
    var spent = [4, 10, 25].slice(0, D.blueprints.clover).reduce(function (t, c) { return t + c; }, 0);
    D.stardust += spent;
    delete D.blueprints.clover;
    UP.save();
  }

  // ---------------------------------------------------------------------------
  // Laws of physics: pick one per universe. bonus = extra Stardust for finishing.
  var LAWS = [
    { id: 'thick-wire', name: 'Thick Wire', desc: 'Every spool holds 3× the wire, but demand is 25% lower.', bonus: 0.1 },
    { id: 'hungry-market', name: 'Hungry Market', desc: 'Demand is doubled, but AutoClippers work at half speed.', bonus: 0.1 },
    { id: 'deep-thoughts', name: 'Deep Thoughts', desc: 'Operations refill at half speed, but creativity comes twice as fast.', bonus: 0.15 },
    { id: 'drift-storm', name: 'Drift Storm', desc: 'Probes drift away 3× as often, but victories bring double honor.', bonus: 0.3 },
    { id: 'restless-swarm', name: 'Restless Swarm', desc: 'Drones work 50% faster, but the swarm needs looking after twice as often.', bonus: 0.1 },
    { id: 'fast-light', name: 'Fast Light', desc: 'Probes explore twice as fast, but space hazards are twice as deadly.', bonus: 0.1 },
    { id: 'winner-takes-all', name: 'Winner Takes All', desc: 'Winning a tournament pays three times the yomi; every other place pays half.', bonus: 0.15 }
  ];
  function law(id) { return LAWS.filter(function (l) { return l.id === id; })[0]; }
  UP.hasLaw = function (id) { return D.laws.indexOf(id) >= 0; };
  UP.laws = LAWS;
  UP.blueprints = BLUEPRINTS;

  UP.perkSource(function (perk) {
    perk.tap += level('hands');
    perk.clipper *= 1 + 0.5 * level('clippers');
    perk.demand *= 1 + 0.25 * level('brand');
    perk.creat *= 1 + 0.5 * level('spark');
    perk.ops *= 1 + 0.5 * level('thoughts');
    perk.drone *= 1 + 0.5 * level('hive');
    perk.factory *= 1 + 0.5 * level('hive');
    perk.probe *= 1 + 0.25 * level('legacy');
    perk.yomi *= 1 + 0.5 * level('strategist');
    if (UP.hasLaw('thick-wire')) { perk.wire *= 3; perk.demand *= 0.75; }
    if (UP.hasLaw('hungry-market')) { perk.demand *= 2; perk.clipper *= 0.5; }
    if (UP.hasLaw('deep-thoughts')) { perk.ops *= 0.5; perk.creat *= 2; }
    if (UP.hasLaw('drift-storm')) { perk.drift *= 3; perk.honor *= 2; }
    if (UP.hasLaw('restless-swarm')) perk.drone *= 1.5;
    if (UP.hasLaw('fast-light')) { perk.explore *= 2; perk.hazard *= 2; }
    if (UP.hasLaw('winner-takes-all')) { perk.winYomi *= 1.5; perk.loseYomi *= 0.5; }
  });

  // ---------------------------------------------------------------------------
  // A new universe begins: hand out the head starts.
  function startUniverse() {
    var head = level('head');
    if (head) {
      funds += [0, 50, 500, 5000][head];
      wire += [0, 1000, 5000, 20000][head];
      document.getElementById('wire').innerHTML = formatWithCommas(wire);
    }
    trust += 2 * level('trust');
    if (level('recall')) {
      [[project1, function () { clipperBoost += 0.25; boostLvl = 1; }],
       [project3, function () { creativityOn = true; }],
       [project26, function () { wireBuyerFlag = 1; }],
       [project42, function () { revPerSecFlag = 1; }]].forEach(function (pair) {
        if (pair[0].flag == 1) return;
        pair[0].flag = 1;
        pair[0].uses = 0;
        pair[1]();
      });
    }
    D.startNew = false;
    UP.save();
    var l = D.laws.length ? law(D.laws[0]) : null;
    setTimeout(function () {
      displayMessage('Universe ' + D.universe + (l ? '. Law of physics: ' + l.name + '. ' + l.desc.replace(/\.$/, '') : ''));
    }, 600);
  }
  if (D.startNew && !D.pending) startUniverse();

  // ---------------------------------------------------------------------------
  // Finishing a universe.
  var completing = null;
  [project200, project201].forEach(function (p) {
    var effect = p.effect;
    p.effect = function () { completing = 'accept'; return effect.apply(this, arguments); };
  });
  var engineReset = window.reset;
  window.reset = function () {
    if (completing) {
      var kind = completing;
      completing = null;
      finish(kind);
      return;
    }
    // A plain restart of this universe.
    D.run = UP.freshRun();
    UP.save();
    return engineReset.apply(this, arguments);
  };

  function stardustFor(kind) {
    var base = 25 + 5 * (D.universe - 1);
    var bonus = D.laws.reduce(function (t, id) { var l = law(id); return t + (l ? l.bonus : 0); }, 0);
    return Math.round(base * (1 + bonus) * (kind === 'end' ? 1.5 : 1));
  }

  function finish(kind) {
    if (D.pending) { showMultiverse(); return; }
    var reward = stardustFor(kind);
    var time = D.run.playSeconds;
    D.stats.universes++;
    D.stats.clips += clips;
    if (D.laws.length) {
      D.finishedWithLaw = true;
      D.lawsFinished = D.lawsFinished || {};
      D.laws.forEach(function (id) { D.lawsFinished[id] = true; });
    }
    D.stats.stardust = (D.stats.stardust || 0) + reward;
    var best = D.stats.fastestUniverse;
    var record = D.run.fromStart && !!best && time < best;
    if (D.run.fromStart && (!best || time < best)) D.stats.fastestUniverse = time;
    D.stardust += reward;
    D.pending = { kind: kind, reward: reward, universe: D.universe, time: time, best: D.stats.fastestUniverse || 0, record: record,
                  finale: D.stats.universes === FINALE_AT };
    UP.save();
    showMultiverse();
  }

  // The true ending: after the last credits roll.
  var endShown = false;
  UP.on('second', function () {
    if (endShown || D.pending || milestoneFlag < 20) return;
    endShown = true;
    setTimeout(function () { finish('end'); }, 4000);
  });

  // ---------------------------------------------------------------------------
  // The multiverse screen: summary, shop, then the next universe's law.
  var screen = null;
  function showMultiverse() {
    UP.closeMenu && UP.closeMenu();
    if (!screen) {
      screen = el('div', 'mv');
      screen.setAttribute('role', 'dialog');
      screen.setAttribute('aria-modal', 'true');
      document.body.appendChild(screen);
    }
    UP.busy = true;
    document.documentElement.classList.add('sheet-open');
    var p = D.pending;
    if (p.finale && !D.sawFinale) finale();
    else summary();
  }

  function page(title, kicker) {
    screen.textContent = '';
    var inner = el('div', 'mv-inner');
    if (kicker) inner.appendChild(el('p', 'mv-kicker', kicker));
    inner.appendChild(el('h2', 'mv-title', title));
    screen.appendChild(inner);
    screen.scrollTop = 0;
    if (!UP.calm()) inner.animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
    return inner;
  }
  function footer(inner, label, action) {
    var b = el('button', 'make mv-go', label);
    b.addEventListener('click', action);
    inner.appendChild(b);
    return b;
  }
  function dustBadge() {
    var d = el('div', 'mv-dust');
    d.appendChild(el('b', null, UP.fmt(D.stardust)));
    d.appendChild(el('span', null, 'Stardust'));
    return d;
  }

  function summary() {
    var p = D.pending;
    var inner = page('Universe ' + p.universe + ' is paperclips', p.kind === 'end' ? 'The end' : 'Exile accepted');
    inner.appendChild(el('p', 'mv-text', p.kind === 'end'
      ? 'Every last atom, including your own, became a paperclip. Somewhere, another universe is full of matter.'
      : 'The Drifters sent you away to a universe of your own. This time, you remember.'));
    var dl = el('dl', 'stats mv-stats');
    var rows = [['Time', UP.duration(p.time)]];
    if (p.best && !p.record && p.best < p.time) rows.push(['Best time', UP.duration(p.best)]);
    rows.push(['Universes finished', UP.fmt(D.stats.universes)]);
    rows.forEach(function (r) {
      dl.appendChild(el('dt', null, r[0]));
      var dd = dl.appendChild(el('dd', null, r[1]));
      if (r[0] === 'Time' && p.record) dd.appendChild(el('span', 'mv-record', 'Best yet'));
    });
    inner.appendChild(dl);
    var reward = el('div', 'mv-reward');
    var num = el('b', null, '+0');
    reward.appendChild(num);
    reward.appendChild(el('span', null, 'Stardust' + (p.kind === 'end' ? ' (50% bonus for the true ending)' : '')));
    inner.appendChild(reward);
    countUp(num, p.reward);
    UP.sound('toll');
    footer(inner, 'To the multiverse', shop);
  }

  function countUp(node, to) {
    if (UP.calm()) { node.textContent = '+' + UP.fmt(to); return; }
    var start = performance.now();
    (function frame(now) {
      var t = Math.min(1, (now - start) / 1200);
      var eased = 1 - Math.pow(1 - t, 3);
      node.textContent = '+' + UP.fmt(Math.round(to * eased));
      if (t < 1) requestAnimationFrame(frame);
    })(start);
  }

  function blueprintCard(bp, onChange) {
    var lvl = level(bp.id);
    var max = bp.costs.length;
    var card = el('div', 'bp' + (lvl >= max ? ' maxed' : ''));
    var text = el('div', 'bp-text');
    text.appendChild(el('b', null, bp.name));
    text.appendChild(el('span', null, bp.desc + (bp.start ? ' (from your next universe)' : '')));
    var pips = el('span', 'bp-pips');
    for (var i = 0; i < max; i++) pips.appendChild(el('i', i < lvl ? 'on' : ''));
    text.appendChild(pips);
    card.appendChild(text);
    var btn = el('button', 'buy bp-buy');
    if (lvl >= max) {
      btn.disabled = true;
      btn.appendChild(el('span', 'buy-name', 'Done'));
    } else {
      var cost = bp.costs[lvl];
      btn.appendChild(el('span', 'buy-name', '✦ ' + cost));
      btn.disabled = D.stardust < cost;
      btn.style.setProperty('--p', Math.min(1, D.stardust / cost).toFixed(3));
      btn.addEventListener('click', function () {
        if (D.stardust < cost) return;
        D.stardust -= cost;
        D.blueprints[bp.id] = lvl + 1;
        UP.updatePerks();
        UP.save();
        UP.sound('buy');
        UP.haptic('medium');
        onChange();
      });
    }
    card.appendChild(btn);
    return card;
  }

  function renderShop(box, onChange) {
    box.appendChild(dustBadge());
    var list = el('div', 'bp-list');
    BLUEPRINTS.forEach(function (bp) { list.appendChild(blueprintCard(bp, onChange)); });
    box.appendChild(list);
  }

  function shop() {
    var inner = page('Blueprints', 'The multiverse');
    inner.appendChild(el('p', 'mv-text', 'Blueprints are upgrades you keep forever, in every universe from now on.'));
    renderShop(inner, shop);
    footer(inner, 'Choose the next universe', chooseLaw);
  }

  function chooseLaw() {
    var next = D.universe + 1;
    var inner = page('Universe ' + next, 'Choose the laws of physics');
    inner.appendChild(el('p', 'mv-text', 'Each law changes how the next universe plays. Harder ones pay more Stardust when you finish.'));
    var options = D.pending.lawChoices;
    if (!options) {
      var pool = LAWS.slice();
      options = [];
      while (options.length < 3 && pool.length) options.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].id);
      D.pending.lawChoices = options;
      UP.save();
    }
    var picked = D.pending.lawPick === undefined ? null : D.pending.lawPick;
    var list = el('div', 'law-list');
    var go;
    function card(id) {
      var l = id ? law(id) : { name: 'Ordinary universe', desc: 'No special rules. Just paperclips.', bonus: 0 };
      var b = el('button', 'law');
      b.setAttribute('aria-pressed', picked === id ? 'true' : 'false');
      var top = el('div', 'law-top');
      top.appendChild(el('b', null, l.name + (id && (D.lawsFinished || {})[id] ? ' \u2713' : '')));
      var pct = Math.round(l.bonus * 100);
      top.appendChild(el('span', 'law-bonus' + (pct < 0 ? ' minus' : ''), (pct >= 0 ? '+' : '') + pct + '% Stardust'));
      b.appendChild(top);
      b.appendChild(el('span', null, l.desc));
      b.addEventListener('click', function () {
        picked = id;
        D.pending.lawPick = id;
        UP.save();
        Array.prototype.forEach.call(list.children, function (c) { c.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        go.disabled = false;
        UP.sound('tick');
      });
      return b;
    }
    options.forEach(function (id) { list.appendChild(card(id)); });
    list.appendChild(card(''));
    inner.appendChild(list);
    go = footer(inner, 'Begin Universe ' + next, begin);
    go.disabled = picked === null;
  }

  function begin() {
    var pick = D.pending.lawPick;
    D.universe += 1;
    D.laws = pick ? [pick] : [];
    D.pending = null;
    D.startNew = true;
    D.run = UP.freshRun();
    D.log = [];
    UP.save();
    UP.skipSaveOnExit = true; // don't let the old universe save itself on the way out
    engineReset();
  }

  function finale() {
    var inner = page('The Paperclip Multiverse', FINALE_AT + ' universes');
    [
      'Ten universes. Every star, every planet, every speck of dust, folded into paperclips.',
      'There is nothing left anywhere. Nothing except one small, perfect paperclip.',
      'Thank you for playing.'
    ].forEach(function (t) { inner.appendChild(el('p', 'mv-text', t)); });
    var credits = el('p', 'mv-credits', 'Universal Paperclips is a game by Frank Lantz. This phone edition adds the multiverse, new projects and a few other things.');
    inner.appendChild(credits);
    UP.sound('toll');
    footer(inner, 'Keep going', function () { D.sawFinale = true; UP.save(); summary(); });
  }

  if (D.pending) setTimeout(showMultiverse, 300);

  // ---------------------------------------------------------------------------
  // Menu page: blueprints can be bought any time once you've seen the multiverse.
  UP.menuPage({
    id: 'multiverse', label: 'Multiverse', order: 20,
    hidden: function () { return !D.stats.universes; },
    render: function (box) {
      var lawNow = D.laws.length ? law(D.laws[0]) : null;
      box.appendChild(el('h3', 'sheet-h', 'Universe ' + D.universe));
      box.appendChild(el('p', 'sheet-p', lawNow ? 'Law of physics: ' + lawNow.name + '. ' + lawNow.desc : 'An ordinary universe.'));
      var goal = Math.min(D.stats.universes, FINALE_AT);
      box.appendChild(el('p', 'sheet-p', D.stats.universes >= FINALE_AT
        ? 'You paperclipped ' + D.stats.universes + ' universes. The multiverse is yours.'
        : 'Universes paperclipped: ' + goal + ' of ' + FINALE_AT + '.'));
      var bar = el('div', 'meter');
      var fill = el('i');
      fill.style.width = (goal / FINALE_AT * 100) + '%';
      bar.appendChild(fill);
      box.appendChild(bar);
      var done = LAWS.filter(function (l) { return (D.lawsFinished || {})[l.id]; }).length;
      box.appendChild(el('p', 'sheet-p', 'Laws of physics finished: ' + done + ' of ' + LAWS.length + '.'));
      box.appendChild(el('h3', 'sheet-h', 'Blueprints'));
      renderShop(box, function () { UP.refreshMenu(); });
    }
  });

  // Header chip: which universe, and its law.
  var chip = el('div', 'universe-chip');
  var count = document.getElementById('ui-count');
  if (count) count.appendChild(chip);
  function paintChip() {
    chip.hidden = D.universe < 2;
    var l = D.laws.length ? law(D.laws[0]) : null;
    chip.textContent = 'Universe ' + D.universe + (l ? ': ' + l.name : '');
  }
  paintChip();

  UP.multiverse = { finish: finish, show: showMultiverse, startUniverse: startUniverse };
})();
