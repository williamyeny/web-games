// Mobile layer for the original Universal Paperclips engine (engine/*.js).
// Game rules live entirely in the engine, which is unmodified. This file only
// arranges the screen for phones and adds touch conveniences:
//   - bottom tabs that appear as each part of the game unlocks
//   - visual cues that make the next move obvious without spelling it out
//     (see "Showing the way" below)
//   - saving whenever the phone switches away from the game
//   - tap-and-hold to repeat on +/- and buy buttons
//   - tap twice to confirm "Disassemble all"
//   - tap (instead of mouse hover) to flip between tournament results and grid
//   - restoring the slider, risk and strategy pickers after a reload
//   - calm animations in place of the original's flickering (see "Motion" below)
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function shown(el) { return el && el.style.display !== 'none'; }
  function onScreen(el) { return el && el.offsetParent !== null; }

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { return null; }
  }

  var motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function calm() { return motionQuery.matches; }
  var EASE_OUT = 'cubic-bezier(.2,.8,.2,1)';

  // ---------------------------------------------------------------------------
  // Number display. The engine writes some numbers without rounding, so float
  // noise leaks onto the screen ("ratio now 0.6000000000000001"). These fixes
  // only change how numbers are shown; the values the game uses are untouched.

  // 0.6000000000000001 -> 0.6, while keeping any real precision.
  function denoise(n) { return parseFloat(n.toPrecision(12)); }

  // Messages built from raw numbers.
  var engineMessage = window.displayMessage;
  window.displayMessage = function (msg) {
    return engineMessage(String(msg).replace(/\d+\.\d{6,}/g, function (n) { return String(denoise(Number(n))); }));
  };

  // The engine's formatter cuts off digits instead of rounding, so $1.28 held as
  // 1.2799999999999998 showed as "1.27". It also garbles whole numbers held in
  // exponent form ("3e+33" became "3e+33,000,000...").
  var engineFormat = window.formatWithCommas;
  window.formatWithCommas = function (num, decimal) {
    if (typeof num === 'number' && isFinite(num)) {
      var scale = Math.pow(10, decimal > 0 ? decimal : 0);
      var scaled = num * scale;
      var nearest = Math.round(scaled);
      if (nearest !== scaled && Math.abs(scaled - nearest) <= Math.abs(scaled) * 1e-12) num = nearest / scale;
      var m = String(num).match(/^(-?\d+)e\+(\d+)$/);
      if (m) num = m[1] + new Array(+m[2] + 1).join('0');
    }
    return engineFormat(num, decimal);
  };

  // A few counters are written as bare numbers (e.g. wire during the ending).
  ['transWire', 'factoryLevelDisplay', 'harvesterLevelDisplay', 'wireDroneLevelDisplay'].forEach(function (id) {
    var el = $(id);
    function tidy() {
      var t = el.textContent.trim();
      if (/^-?\d+(\.\d+)?$/.test(t)) {
        var nice = window.formatWithCommas(denoise(Number(t)));
        if (nice !== t) el.textContent = nice;
      }
    }
    new MutationObserver(tidy).observe(el, { childList: true, characterData: true, subtree: true });
    tidy();
  });

  // main.js has already run: if a save existed, load() + refresh() filled the screen.
  var hadSave = store('saveGame') !== null;

  // ---------------------------------------------------------------------------
  // Fresh game: fill in the costs and counters the original page only showed
  // after a reload. refresh() only writes to the screen for a brand new game.
  if (!hadSave && store('savePrestige') === null) {
    refresh();
  }

  // ---------------------------------------------------------------------------
  // After a reload, put the controls back where the player left them.
  // (The original page forgot these, which is easy to trip over on a phone
  // because phones reload background tabs all the time.)
  var riskSelect = $('investStrat');
  var stratPicker = $('stratPicker');
  if (hadSave) {
    riskSelect.value = riskiness === 1 ? 'hi' : riskiness === 5 ? 'med' : 'low';
    for (var i = 0; i < stratPicker.options.length; i++) {
      if (stratPicker.options[i].value === String(pick)) { stratPicker.value = String(pick); break; }
    }
    $('slider').value = sliderPos;
  }

  // ---------------------------------------------------------------------------
  // Save when the phone switches apps or locks, so no progress is lost.
  var resetting = false;
  var engineReset = window.reset;
  window.reset = function () {
    resetting = true; // don't re-save the game we're about to wipe
    return engineReset.apply(this, arguments);
  };
  function saveNow() {
    if (resetting || (window.UP && UP.skipSaveOnExit)) return;
    try { save(); } catch (e) { /* storage full or blocked; the engine's autosave will retry */ }
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') saveNow();
  });
  window.addEventListener('pagehide', saveNow);

  function setText(el, text) {
    if (el.textContent !== text) el.textContent = text;
  }

  // ---------------------------------------------------------------------------
  // Tabs. A tab shows once any of its sections has been unlocked by the engine.
  var TABS = {
    make: ['businessDiv', 'manufacturingDiv', 'creationDiv', 'wireProductionDiv', 'powerDiv'],
    projects: ['compDiv', 'projectsDiv'],
    strategy: ['investmentEngine', 'investmentEngineUpgrade', 'strategyEngine'],
    space: ['spaceDiv', 'probeDesignDiv', 'increaseProbeTrustDiv', 'increaseMaxTrustDiv', 'battleCanvasDiv', 'honorDiv']
  };
  var ORDER = ['make', 'projects', 'strategy', 'space'];
  var tabbar = $('ui-tabbar');
  var pill = $('ui-tab-pill');
  var tabButtons = {};
  var panels = {};
  ORDER.forEach(function (name) {
    tabButtons[name] = tabbar.querySelector('[data-tab="' + name + '"]');
    panels[name] = document.querySelector('[data-panel="' + name + '"]');
    panels[name].setAttribute('role', 'tabpanel');
  });

  var seenTabs = {};
  try { seenTabs = JSON.parse(store('up-ui-seen-tabs')) || {}; } catch (e) { seenTabs = {}; }
  var current = null;
  var scrollPos = {};

  function selectTab(name) {
    if (current === name) return;
    var prev = current;
    if (prev) scrollPos[prev] = window.scrollY;
    current = name;
    ORDER.forEach(function (n) {
      panels[n].classList.toggle('on', n === name);
      tabButtons[n].setAttribute('aria-selected', n === name ? 'true' : 'false');
    });
    window.scrollTo(0, scrollPos[name] || 0);
    // Slide the new sheet in from the side of the tab that was tapped.
    if (prev && !calm()) {
      var dir = ORDER.indexOf(name) > ORDER.indexOf(prev) ? 1 : -1;
      panels[name].animate(
        [{ opacity: 0, transform: 'translateX(' + (dir * 24) + 'px)' }, { opacity: 1, transform: 'none' }],
        { duration: 280, easing: EASE_OUT }
      );
    }
    placePill();
    if (!seenTabs[name]) {
      seenTabs[name] = true;
      store('up-ui-seen-tabs', JSON.stringify(seenTabs));
    }
    store('up-ui-tab', name);
    if (name === 'projects') markProjectsSeen();
    flushReveals(name);
    fillProgress();
    updateBadges();
  }

  tabbar.addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]');
    if (!b) return;
    if (b.dataset.tab === current) {
      window.scrollTo({ top: 0, behavior: calm() ? 'auto' : 'smooth' });
    } else {
      selectTab(b.dataset.tab);
    }
  });

  // The dark pill behind the current tab's icon glides from tab to tab.
  var pillPlaced = false;
  function placePill() {
    var b = tabButtons[current];
    if (!b || b.hidden || tabbar.hidden) return;
    // Layout sizes (not getBoundingClientRect) so the tabs' pop-in scale doesn't skew it.
    var iconStyle = getComputedStyle(b.querySelector('svg'));
    var w = parseFloat(iconStyle.width);
    var h = parseFloat(iconStyle.height);
    if (!b.offsetWidth || !w) return;
    var x = b.offsetLeft + (b.offsetWidth - w) / 2;
    var y = b.offsetTop + parseFloat(getComputedStyle(b).paddingTop);
    var t = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
    if (pill.style.transform !== t) {
      pill.style.transform = t;
      pill.style.width = w + 'px';
      pill.style.height = h + 'px';
    }
    if (!pillPlaced) {
      pillPlaced = true;
      requestAnimationFrame(function () { pill.classList.add('glide'); });
    }
  }

  function visibleTabs() {
    return ORDER.filter(function (n) {
      return TABS[n].some(function (id) { return shown($(id)); });
    });
  }

  function updateTabs() {
    var vis = visibleTabs();
    ORDER.forEach(function (n) { tabButtons[n].hidden = vis.indexOf(n) < 0; });
    tabbar.hidden = vis.length < 2;
    tabbar.style.setProperty('--tabs', Math.max(vis.length, 1));
    if (vis.length && vis.indexOf(current) < 0) selectTab(vis[0]);
    placePill();

    // No divider above the first visible section of each panel.
    ORDER.forEach(function (n) {
      var first = true;
      var secs = panels[n].querySelectorAll(':scope > .sec');
      for (var i = 0; i < secs.length; i++) {
        var on = shown(secs[i]);
        secs[i].classList.toggle('first', on && first);
        if (on) first = false;
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Showing the way.
  // Instead of telling the player what to do, the whole screen speaks one
  // visual language:
  //   dashed outline             not yet
  //   yellow filling up inside   getting closer (one bar per thing it costs)
  //   solid                      you can buy it
  //   highlighter yellow         worth doing right now, including whichever
  //                              button fixes what is holding you back
  // A tab wears a badge when something inside it is yellow or new, and if the
  // current tab has nothing left to do, those tabs hop to draw the eye.

  // How close each buy button is to affordable.
  var BUY_COST = {
    btnExpandMarketing: function () { return [funds, adCost]; },
    btnBuyWire: function () { return [funds, wireCost]; },
    btnMakeClipper: function () { return [funds, clipperCost]; },
    btnMakeMegaClipper: function () { return [funds, megaClipperCost]; },
    btnMakeFactory: function () { return [unusedClips, factoryCost]; },
    btnMakeHarvester: function () { return [unusedClips, harvesterCost]; },
    btnMakeWireDrone: function () { return [unusedClips, wireDroneCost]; },
    btnMakeFarm: function () { return [unusedClips, farmCost]; },
    btnMakeBattery: function () { return [unusedClips, batteryCost]; },
    btnMakeProbe: function () { return [unusedClips, probeCost]; },
    btnImproveInvestments: function () { return [yomi, investUpgradeCost]; },
    btnNewTournament: function () { return [operations, tourneyCost]; },
    btnIncreaseProbeTrust: function () { return [yomi, probeTrustCost]; },
    btnIncreaseMaxTrust: function () { return [honor, maxTrustCost]; }
  };

  // What a project costs, read from its price tag, e.g. "(25 creat, 2,500 ops)".
  var BIG_WORDS = {
    thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12, quadrillion: 1e15,
    quintillion: 1e18, sextillion: 1e21, septillion: 1e24, oct: 1e27, octillion: 1e27,
    nonillion: 1e30, decillion: 1e33
  };
  var COST_KINDS = [
    { re: /^\$([\d,.]+)$/, label: 'money', have: function () { return funds; } },
    { re: /^([\d,.]+) ops$/i, label: 'ops', have: function () { return operations; }, cap: function () { return memory * 1000; } },
    { re: /^([\d,.]+) creat$/i, label: 'creativity', have: function () { return creativity; } },
    { re: /^([\d,.]+) yomi$/i, label: 'yomi', have: function () { return yomi; } },
    { re: /^([\d,.]+) trust$/i, label: 'trust', have: function () { return trust; } },
    { re: /^([\d,.]+) MW-seconds$/i, label: 'stored power', have: function () { return storedPower; }, cap: function () { return batteryLevel * batterySize; } },
    { re: /^([\d,.]+) (?:(\w+) )?clips$/i, label: 'clips', have: function () { return unusedClips; } },
    { re: /^([\d,.]+) MEM$/, label: 'memory', have: function () { return memory; } }
  ];
  function parseCosts(tag) {
    var inner = String(tag).trim().replace(/^\(|\)$/g, '');
    var costs = [];
    if (!inner) return costs;
    inner.split(/,\s+/).forEach(function (part) {
      for (var k = 0; k < COST_KINDS.length; k++) {
        var m = part.trim().match(COST_KINDS[k].re);
        if (!m) continue;
        var need = parseFloat(m[1].replace(/,/g, ''));
        if (m[2]) need *= BIG_WORDS[m[2].toLowerCase()] || NaN;
        if (need > 0) costs.push({ kind: COST_KINDS[k], need: need });
        return;
      }
    });
    return costs;
  }

  function fillProgress() {
    Object.keys(BUY_COST).forEach(function (id) {
      var b = $(id);
      if (!onScreen(b)) return;
      var hn = BUY_COST[id]();
      // Disabled for some other reason (e.g. a tournament is running): no bar.
      var p = !b.disabled ? 1 : (hn[0] >= hn[1] || !(hn[1] > 0)) ? 0 : Math.max(0, hn[0] / hn[1]);
      b.style.setProperty('--p', p.toFixed(3));
    });
    if (current !== 'projects') return;
    projectCards().forEach(function (card) {
      if (!card.disabled || !card._costs) return;
      card._costs.forEach(function (c) {
        var have = Math.max(0, c.kind.have() || 0);
        var reach = c.kind.cap ? Math.min(1, c.kind.cap() / c.need) : 1;
        c.bar.style.setProperty('--v', Math.min(1, have / c.need).toFixed(3));
        c.bar.style.setProperty('--cap', reach.toFixed(3));
        // Striped where the bar can't reach yet (not enough memory or batteries).
        c.bar.classList.toggle('capped', reach < 1);
      });
    });
  }

  // Highlight the button that fixes whatever is holding the player back.
  var NUDGE_IDS = ['btnBuyWire', 'btnMakeFactory', 'btnMakeFarm', 'btnMakeHarvester', 'btnMakeWireDrone', 'btnMakeBattery',
                   'btnBatteryReboot', 'btnFarmReboot', 'btnHarvesterReboot', 'btnWireDroneReboot'];
  var probeRaise = ['Speed', 'Nav', 'Rep', 'Haz', 'Fac', 'Harv', 'Wire', 'Combat'].map(function (s) { return $('btnRaiseProbe' + s); });
  function isActive(p) { return p.flag != 1 && activeProjects.indexOf(p) >= 0 && p.element; }

  function updateNudges() {
    var want = {};
    if (humanFlag == 1) {
      if (wire < 1) want.btnBuyWire = true;                                    // can't make clips
    } else if (spaceFlag == 0) {
      if (shown($('factoryDiv')) && factoryLevel < 1) want.btnMakeFactory = true; // the only way to make clips now
      if (factoryLevel + harvesterLevel + wireDroneLevel > 0 && powMod < 1) want.btnMakeFarm = true; // machines underpowered
      if (factoryLevel > 0 && wire < 1) {                                      // factories starved of wire
        if (harvesterLevel < 1) want.btnMakeHarvester = true;
        else if (wireDroneLevel < 1) want.btnMakeWireDrone = true;
      }
      if (isActive(project46) && batteryLevel * batterySize < 10000000) want.btnMakeBattery = true; // space needs stored power
      // Spent everything before building a factory: nothing makes clips anymore.
      // Point at the "Disassemble all" whose refund would pay for a factory.
      if (shown($('factoryDiv')) && factoryLevel < 1 && unusedClips < factoryCost) {
        var short = factoryCost - unusedClips;
        var refunds = [['btnBatteryReboot', batteryBill], ['btnFarmReboot', farmBill],
                       ['btnHarvesterReboot', harvesterBill], ['btnWireDroneReboot', wireDroneBill]];
        for (var r = 0; r < refunds.length; r++) {
          if (refunds[r][1] >= short) { want[refunds[r][0]] = true; break; }
        }
      }
    }
    NUDGE_IDS.forEach(function (id) { $(id).classList.toggle('nudge', !!want[id]); });
    var spareProbeTrust = spaceFlag == 1 && probeUsedTrust < probeTrust;
    probeRaise.forEach(function (b) { b.classList.toggle('nudge', spareProbeTrust); });
  }

  // Tab badges, and the hop when the current tab is a dead end.
  var projectList = $('projectListTop');
  function projectCards() {
    return Array.prototype.filter.call(projectList.children, function (b) {
      return !b.classList.contains('leaving');
    });
  }
  var seenProjects = {};
  function markProjectsSeen() {
    projectCards().forEach(function (b) { seenProjects[b.id] = true; });
  }

  var ACTIONS = '.projectButton:enabled, .chip-btn:enabled, .buy:enabled, .nudge:enabled, .multi .btn:enabled, #btnRunTournament:enabled';
  function hasAction(panel) {
    var els = panel.querySelectorAll(ACTIONS);
    for (var i = 0; i < els.length; i++) {
      if (onScreen(els[i]) && !els[i].closest('.leaving')) return true;
    }
    return false;
  }

  function setBadge(name, kind, text) {
    var badge = tabButtons[name].querySelector('.badge');
    var cls = 'badge' + (kind ? ' ' + kind : '');
    if (badge.className !== cls) badge.className = cls;
    setText(badge, text || '');
  }

  function updateBadges() {
    var sig = {};
    ORDER.forEach(function (n) { sig[n] = { count: 0, dot: !seenTabs[n] }; });

    var cards = projectCards();
    cards.forEach(function (b) {
      if (!b.disabled) sig.projects.count++;
      if (!seenProjects[b.id]) sig.projects.dot = true;
    });
    if (shown($('processorDisplay')) && !$('btnAddProc').disabled) sig.projects.count++;
    ORDER.forEach(function (n) {
      if (panels[n].querySelector('.nudge:enabled')) sig[n].dot = true;
    });
    if (shown($('strategyEngine')) && stratPicker.value === '10') sig.strategy.dot = true;
    pendingReveals.forEach(function (el) { sig[el.closest('.panel').dataset.panel].dot = true; });

    var deadEnd = current && !hasAction(panels[current]);
    var beckoning = false;
    ORDER.forEach(function (n) {
      var b = tabButtons[n];
      var s = sig[n];
      if (n === current || b.hidden) {
        setBadge(n, '');
        b.classList.remove('beckon');
        return;
      }
      if (s.count > 0) setBadge(n, 'count', s.count > 9 ? '9+' : String(s.count));
      else setBadge(n, s.dot ? 'dot' : '');
      var beckon = deadEnd && (s.count > 0 || s.dot);
      b.classList.toggle('beckon', beckon);
      beckoning = beckoning || beckon;
    });
    // Nothing to do anywhere yet: point at Projects, where progress comes from.
    if (deadEnd && !beckoning && current !== 'projects' && !tabButtons.projects.hidden && cards.length) {
      tabButtons.projects.classList.add('beckon');
    }
  }

  // Quantum computing: the Compute button glows when the chips are bright
  // and goes dashed when computing now would cost ops.
  var qButton = $('btnQcompute');
  (function qGlow() {
    if (onScreen(qButton) && qFlag == 1) {
      var sum = 0;
      var active = 0;
      for (var q = 0; q < qChips.length; q++) {
        if (qChips[q].active) { sum += qChips[q].value; active++; }
      }
      var level = active ? sum / active : 0;
      qButton.style.setProperty('--q', Math.max(0, level).toFixed(2));
      qButton.classList.toggle('cold', active > 0 && level < 0);
      qButton.classList.toggle('hot', level > 0.5);
    }
    requestAnimationFrame(qGlow);
  })();

  // ---------------------------------------------------------------------------
  // Project cards: split out the price, and add a bar for each thing it costs.
  function dressProject(btn) {
    if (btn.dataset.dressed) return;
    btn.dataset.dressed = '1';
    var n = btn.childNodes[1];
    if (!n || n.nodeType !== 3 || !n.nodeValue.trim()) return;
    var price = document.createElement('span');
    price.className = 'cost';
    price.textContent = n.nodeValue.trim();
    btn.replaceChild(price, n);

    var costs = parseCosts(price.textContent);
    if (!costs.length) return;
    var box = document.createElement('span');
    box.className = 'needs';
    box.setAttribute('aria-hidden', 'true');
    costs.forEach(function (c) {
      var label = document.createElement('span');
      label.textContent = c.kind.label;
      c.bar = document.createElement('i');
      box.appendChild(label);
      box.appendChild(c.bar);
    });
    btn.appendChild(box);
    btn._costs = costs;
  }
  projectCards().forEach(dressProject);
  markProjectsSeen();

  // ---------------------------------------------------------------------------
  // Motion.
  // The original makes new projects flicker on and off, strobes the screen for
  // the HypnoDrones, and flashes the tournament grid. Those are replaced here
  // with animations that show what actually happened. Everything is skipped
  // when the phone asks for reduced motion.

  // New project: the card drops onto the page and a paperclip clips it on.
  // (Replaces the engine's blink(), which only ever toggled visibility.)
  var arrivalsThisFrame = 0;
  window.blink = function (el) {
    if (!el || calm()) return;
    el.style.setProperty('--d', Math.min(arrivalsThisFrame, 8) * 70 + 'ms');
    if (arrivalsThisFrame++ === 0) requestAnimationFrame(function () { arrivalsThisFrame = 0; });
    el.classList.add('arriving');
    el.addEventListener('animationend', function done(e) {
      if (e.animationName !== 'clip-on') return;
      el.classList.remove('arriving');
      el.removeEventListener('animationend', done);
    });
  };

  // Finished project: a "Done" stamp lands on it, then it folds away.
  // The engine removes the card instantly, so a stand-in copy plays the exit.
  var lastPicked = { id: null, at: 0 };
  projectList.addEventListener('click', function (e) {
    var b = e.target.closest('.projectButton');
    if (b && !b.disabled) lastPicked = { id: b.id, at: Date.now() };
  }, true);

  function projectLeaves(card, before) {
    if (calm()) return;
    var picked = card.id === lastPicked.id && Date.now() - lastPicked.at < 1500;
    var ghost = card.cloneNode(true);
    ghost.removeAttribute('id');
    ghost.classList.remove('arriving');
    ghost.classList.add('leaving');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.tabIndex = -1;
    ghost.inert = true;
    projectList.insertBefore(ghost, before);

    if (picked) {
      var stamp = document.createElement('span');
      stamp.className = 'stamp';
      stamp.textContent = 'Done';
      ghost.appendChild(stamp);
    }
    var gapSide = ghost.previousElementSibling ? 'marginTop' : 'marginBottom';
    var from = { height: ghost.offsetHeight + 'px', paddingTop: '14px', paddingBottom: '15px', borderWidth: '2.5px', opacity: 1 };
    var to = { height: '0px', paddingTop: '0px', paddingBottom: '0px', borderWidth: '0px', opacity: 0 };
    from[gapSide] = '0px';
    to[gapSide] = '-18px';
    setTimeout(function () {
      ghost.style.overflow = 'hidden';
      ghost.animate([from, to], { duration: 340, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' })
        .onfinish = function () { ghost.remove(); };
    }, picked ? 650 : 0);
  }

  new MutationObserver(function (list) {
    list.forEach(function (m) {
      Array.prototype.forEach.call(m.addedNodes, function (node) {
        if (node.nodeType === 1 && node.classList.contains('projectButton')) dressProject(node);
      });
      Array.prototype.forEach.call(m.removedNodes, function (node) {
        if (node.nodeType !== 1 || !node.classList.contains('projectButton') || node.classList.contains('leaving')) return;
        var before = m.nextSibling && m.nextSibling.parentNode === projectList ? m.nextSibling : null;
        projectLeaves(node, before);
      });
    });
  }).observe(projectList, { childList: true });

  // HypnoDrones: a slow hypnotic spiral with the words arriving one by one.
  // (Replaces the engine's hypnoDroneEvent(), a ~4 second black-and-white strobe.)
  (function drawSpiral() {
    var d = '';
    var turns = 7;
    var steps = turns * 48;
    for (var s = 0; s <= steps; s++) {
      var a = s / steps * turns * 2 * Math.PI;
      var r = 100 * s / steps;
      d += (s ? 'L' : 'M') + (r * Math.cos(a)).toFixed(2) + ' ' + (r * Math.sin(a)).toFixed(2);
    }
    $('ui-spiral').setAttribute('d', d);
  })();
  var hypnoTimers = [];
  window.hypnoDroneEvent = function () {
    var overlay = $('hypnoDroneEventDiv');
    var text = $('hypnoDroneText');
    hypnoTimers.forEach(clearTimeout);
    text.textContent = '';
    ['Release', 'the', 'Hypno', 'Drones'].forEach(function (word) {
      var w = document.createElement('span');
      w.textContent = word;
      text.appendChild(w);
    });
    overlay.classList.remove('leaving', 'playing');
    overlay.style.display = '';
    void overlay.offsetWidth;
    overlay.classList.add('playing');
    if (window.UP) UP.sound('hypno');
    var hold = calm() ? 2200 : 3900;
    hypnoTimers = [
      setTimeout(function () { overlay.classList.add('leaving'); }, hold),
      setTimeout(function () {
        overlay.style.display = 'none';
        overlay.classList.remove('playing', 'leaving');
      }, hold + 700)
    ];
  };

  // Sections that unlock slide into place, and their heading gets a quick
  // highlighter stroke. Unlocks on another tab wait (with a dot on that tab)
  // and play when you open it.
  var WATCH = [
    'businessDiv', 'manufacturingDiv', 'creationDiv', 'wireProductionDiv', 'powerDiv',
    'compDiv', 'projectsDiv', 'investmentEngine', 'investmentEngineUpgrade', 'strategyEngine',
    'spaceDiv', 'probeDesignDiv', 'increaseProbeTrustDiv', 'increaseMaxTrustDiv', 'battleCanvasDiv', 'honorDiv',
    'revPerSecDiv', 'wireBuyerDiv', 'autoClipperDiv', 'megaClipperDiv', 'factoryDiv', 'tothDiv',
    'harvesterDiv', 'wireDroneDiv', 'factoryDivSpace', 'droneDivSpace', 'factoryUpgradeDisplay', 'mdpsDiv',
    'trustDiv', 'swarmGiftDiv', 'processorDisplay', 'swarmEngine', 'swarmSliderDiv', 'qComputing',
    'entertainButtonDiv', 'synchButtonDiv', 'autoTourneyControl', 'drifterDiv', 'combatButtonDiv',
    'hazardBodyCount', 'driftBodyCount', 'combatBodyCount', 'prestigeDiv', 'clipsPerSecDiv', 'wireTransDiv'
  ];
  var wasShown = {};
  var revealsReady = false;
  var pendingReveals = [];

  function reveal(el, delay) {
    if (window.UP && el.matches('.sec, .sub-sec')) UP.emit('unlock', el);
    if (calm()) return;
    el.animate(
      [{ opacity: 0, transform: 'translateY(-10px)' }, { opacity: 1, transform: 'none' }],
      { duration: 520, delay: delay || 0, easing: EASE_OUT, fill: 'backwards' }
    );
    var heading = el.querySelector(':scope > h2, :scope > h3');
    if (heading) {
      heading.classList.remove('marked');
      void heading.offsetWidth;
      heading.classList.add('marked');
    }
  }
  function flushReveals(tab) {
    pendingReveals = pendingReveals.filter(function (el) {
      if (el.closest('.panel').dataset.panel !== tab) return true;
      if (shown(el)) reveal(el, 180);
      return false;
    });
  }
  var unlockWatcher = new MutationObserver(function (records) {
    records.forEach(function (r) {
      var el = r.target;
      var now = shown(el);
      if (now && wasShown[el.id] === false && revealsReady) {
        var panel = el.closest('.panel');
        if (!panel || panel.dataset.panel === current) reveal(el);
        else if (pendingReveals.indexOf(el) < 0) pendingReveals.push(el);
      }
      if (!now) {
        var at = pendingReveals.indexOf(el);
        if (at >= 0) pendingReveals.splice(at, 1);
      }
      wasShown[el.id] = now;
    });
  });
  WATCH.forEach(function (id) {
    var el = $(id);
    el.classList.add('fx');
    wasShown[id] = shown(el);
    unlockWatcher.observe(el, { attributes: true, attributeFilter: ['style'] });
  });

  // Tournament results and grid cross-fade when you tap between them.
  ['tournamentTable', 'tournamentResultsTable'].forEach(function (id) {
    var el = $(id);
    var was = shown(el);
    new MutationObserver(function () {
      var now = shown(el);
      if (now && !was && !calm()) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
      was = now;
    }).observe(el, { attributes: true, attributeFilter: ['style'] });
  });

  // Buying something: the number you just changed gives a little pop.
  function countFor(btn) {
    if (btn.classList.contains('buy')) return btn.querySelector('.buy-count');
    if (btn.classList.contains('chip-btn')) return btn.querySelector('.chip-num');
    if (btn.classList.contains('step')) return btn.parentNode.querySelector('.step-val');
    if (btn.closest('.multi')) {
      var group = btn.closest('.buygroup');
      return group && group.querySelector('.buy-count');
    }
    return null;
  }
  var popWatch = null;
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button');
    var n = b && countFor(b);
    popWatch = n ? { el: n, text: n.textContent } : null;
  }, true);
  document.addEventListener('click', function () {
    if (popWatch && popWatch.el.textContent !== popWatch.text && !calm()) {
      popWatch.el.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.22)', offset: 0.3 }, { transform: 'scale(1)' }],
        { duration: 320, easing: 'ease-out' }
      );
    }
    popWatch = null;
  });

  // Make paperclip: a little paperclip hops up from your finger.
  var dock = $('ui-dock');
  var makeBtn = $('btnMakePaperclip');
  var clipShape = makeBtn.querySelector('svg');
  var flying = 0;
  makeBtn.addEventListener('click', function (e) {
    if (calm() || flying >= 14) return;
    var btnBox = makeBtn.getBoundingClientRect();
    var x = (e.clientX || btnBox.left + btnBox.width / 2) - 12;
    var y = btnBox.top - 4;
    var drift = (Math.random() - 0.5) * 70;
    var spin = (Math.random() - 0.5) * 80;
    var clip = clipShape.cloneNode(true);
    clip.setAttribute('class', 'clip-fly');
    document.body.appendChild(clip);
    flying++;
    clip.animate([
      { transform: 'translate(' + x + 'px,' + y + 'px) scale(.5)', opacity: 0 },
      { opacity: 1, offset: 0.2 },
      { transform: 'translate(' + (x + drift) + 'px,' + (y - 86) + 'px) rotate(' + spin + 'deg) scale(1.05)', opacity: 0 }
    ], { duration: 720, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = function () {
      clip.remove();
      flying--;
    };
  });

  // ---------------------------------------------------------------------------
  // Message log: tap to show the last five messages. New messages type out.
  var consoleEl = $('consoleDiv');
  var readout = $('readout1');
  var typed = $('ui-typed');
  function toggleConsole() {
    var open = consoleEl.classList.toggle('open');
    consoleEl.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  consoleEl.addEventListener('click', toggleConsole);
  consoleEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleConsole(); }
  });
  var typeFrame = 0;
  function typeOut() {
    var text = readout.textContent;
    cancelAnimationFrame(typeFrame);
    if (calm()) { typed.textContent = text; return; }
    var start = performance.now();
    var perSecond = Math.max(90, text.length / 0.7); // never longer than ~0.7s
    consoleEl.classList.add('typing');
    (function frame(now) {
      var n = Math.min(text.length, Math.floor((now - start) / 1000 * perSecond) + 1);
      typed.textContent = text.slice(0, n);
      if (n < text.length) typeFrame = requestAnimationFrame(frame);
      else consoleEl.classList.remove('typing');
    })(start);
  }
  new MutationObserver(typeOut).observe(readout, { childList: true, characterData: true, subtree: true });
  typeOut();

  // ---------------------------------------------------------------------------
  // The original shows "NaN" revenue for ~10 seconds after every page load.
  // Phones reload a lot, so show "…" instead until the real number arrives.
  ['avgRev', 'avgSales'].forEach(function (id) {
    var el = $(id);
    function clean() { if (el.textContent.indexOf('NaN') >= 0) el.textContent = '…'; }
    new MutationObserver(clean).observe(el, { childList: true, characterData: true, subtree: true });
    clean();
  });

  // ---------------------------------------------------------------------------
  // Tournament: phones have no hover, so tap flips between results and grid.
  var tourney = $('tournamentStuff');
  ['mouseover', 'mouseout'].forEach(function (type) {
    document.addEventListener(type, function (e) {
      if (tourney.contains(e.target)) e.stopPropagation();
    }, true);
  });
  tourney.addEventListener('click', function () {
    if (resultsFlag != 1) return;
    if ($('tournamentTable').style.display === 'none') revealGrid(); else revealResults();
  });
  var engineTourneyReport = window.tourneyReport;
  window.tourneyReport = function (text) {
    return engineTourneyReport(String(text).replace('roll over', 'tap'));
  };

  // ---------------------------------------------------------------------------
  // Investment risk as three big buttons instead of a dropdown.
  var riskSeg = $('ui-risk');
  function paintRisk() {
    Array.prototype.forEach.call(riskSeg.children, function (b) {
      b.setAttribute('aria-checked', b.dataset.risk === riskSelect.value ? 'true' : 'false');
    });
  }
  riskSeg.addEventListener('click', function (e) {
    var b = e.target.closest('[data-risk]');
    if (!b) return;
    riskSelect.value = b.dataset.risk;
    paintRisk();
  });
  paintRisk();

  // ---------------------------------------------------------------------------
  // "Disassemble all": first tap arms the button, second tap does it.
  function disarm(b) {
    clearTimeout(b._disarm);
    b.classList.remove('armed');
    if (b.dataset.label) b.textContent = b.dataset.label;
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-confirm]');
    if (!b || b.disabled) return;
    if (b.classList.contains('armed')) { disarm(b); return; } // let the engine handle it
    e.stopPropagation();
    e.preventDefault();
    b.dataset.label = b.dataset.label || b.textContent;
    b.textContent = 'Tap again to confirm';
    b.classList.add('armed');
    b._disarm = setTimeout(function () { disarm(b); }, 3000);
  }, true);

  // ---------------------------------------------------------------------------
  // Tap and hold a [data-repeat] button to keep pressing it.
  var holdTimer = null;
  var held = null;
  var repeated = false;
  var swallowUntil = 0;

  function stopHold() {
    clearTimeout(holdTimer);
    holdTimer = null;
    if (held) held.classList.remove('is-held');
    if (repeated) swallowUntil = Date.now() + 400;
    held = null;
    repeated = false;
  }
  document.addEventListener('pointerdown', function (e) {
    var b = e.target.closest && e.target.closest('[data-repeat]');
    if (!b || b.disabled || e.button > 0) return;
    stopHold();
    held = b;
    var presses = 0;
    holdTimer = setTimeout(function step() {
      if (!held || held.disabled) { stopHold(); return; }
      held.classList.add('is-held');
      held.click();
      repeated = true;
      presses++;
      holdTimer = setTimeout(step, presses < 6 ? 150 : presses < 20 ? 80 : 45);
    }, 450);
  });
  document.addEventListener('pointerup', stopHold);
  document.addEventListener('pointercancel', stopHold);
  // The finger lifting after a hold would count as one extra tap; ignore it.
  document.addEventListener('click', function (e) {
    if (e.isTrusted && Date.now() < swallowUntil) {
      swallowUntil = 0;
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);
  document.addEventListener('contextmenu', function (e) {
    if (e.target.closest && e.target.closest('button')) e.preventDefault();
  });

  // ---------------------------------------------------------------------------
  // Keep the big clip number on one line for as long as it reasonably can.
  var clipsEl = $('clips');
  var lastClipText = '';
  function fitCount() {
    var text = clipsEl.textContent;
    if (text === lastClipText) return;
    lastClipText = text;
    var digits = text.replace(/[^0-9]/g, '').length;
    var commas = text.length - digits;
    var em = digits * 0.62 + commas * 0.3;
    var size = Math.max(19, Math.min(46, clipsEl.clientWidth / Math.max(em, 1)));
    clipsEl.style.fontSize = Math.floor(size) + 'px';
  }
  window.addEventListener('resize', function () { lastClipText = ''; fitCount(); placePill(); });

  // ---------------------------------------------------------------------------
  // Slim bar at the top once the big clip counter scrolls out of view.
  var mini = $('ui-mini');
  var miniNum = $('ui-mini-num');
  var miniSide = $('ui-mini-side');
  var miniMsg = $('ui-mini-msg');
  var sideNum = $('ui-side-num');
  var sideLabel = $('ui-side-label');
  function updateMini() {
    var full = clipsEl.textContent;
    setText(miniNum, full.length <= 15 ? full : $('clipCountCrunched').textContent.trim());
    setText(miniSide, sideNum.textContent ? sideNum.textContent + (sideLabel.textContent === 'funds' ? '' : ' unused') : '');
    setText(miniMsg, readout.textContent);
  }
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (entries) {
      var off = !entries[0].isIntersecting;
      if (off) updateMini();
      mini.classList.toggle('on', off);
      mini.setAttribute('aria-hidden', off ? 'false' : 'true');
    }).observe(clipsEl);
  }
  mini.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: calm() ? 'auto' : 'smooth' }); });

  // ---------------------------------------------------------------------------
  // Everything that just mirrors engine numbers onto the new layout.
  var topEl = $('ui-top');
  var opsBar = $('ui-ops-bar');
  var storageBar = $('ui-storage-bar');
  var perfBar = $('ui-perf-bar');
  var chipPlus = document.querySelectorAll('.chip-plus');
  var pickWrap = stratPicker.closest('.select');
  var wireBuyerPill = $('wireBuyerStatus');
  var autoTourneyPill = $('autoTourneyStatus');
  var unusedMirror = $('ui-unused-mirror');
  var profitCells = [1, 2, 3, 4, 5].map(function (n) { return $('stock' + n + 'Profit'); });

  function mirror() {
    fitCount();
    topEl.classList.toggle('show-crunched', clips >= 1e6 || milestoneFlag >= 15);

    if (shown($('businessDiv'))) {
      setText(sideNum, '$' + $('funds').textContent);
      setText(sideLabel, 'funds');
    } else if (shown($('creationDiv')) && shown($('tothDiv'))) {
      setText(sideNum, $('unusedClipsDisplay').textContent);
      setText(sideLabel, 'unused clips');
    } else {
      setText(sideNum, '');
    }

    var maxOps = memory * 1000;
    var opsShare = maxOps > 0 ? Math.min(1, Math.max(0, operations / maxOps)) : 0;
    opsBar.style.width = (opsShare * 100).toFixed(1) + '%';
    opsBar.parentNode.classList.toggle('full', opsShare >= 1);

    var cap = batteryLevel * batterySize;
    storageBar.style.width = (cap > 0 ? Math.min(1, storedPower / cap) * 100 : 0).toFixed(1) + '%';

    var machines = factoryLevel + harvesterLevel + wireDroneLevel > 0;
    var perf = machines ? Math.min(1, Math.max(0, powMod)) : 0;
    perfBar.style.width = (perf * 100).toFixed(1) + '%';
    perfBar.parentNode.classList.toggle('low', machines && powMod < 1);

    // Processors/Memory show how many more you can add.
    var canAdd = Math.max(0, Math.floor(trust - processors - memory)) + Math.max(0, Math.floor(swarmGifts));
    Array.prototype.forEach.call(chipPlus, function (el) { setText(el, '+' + Math.max(1, canAdd)); });

    setText(wireBuyerPill, wireBuyerStatus == 1 ? 'ON' : 'OFF');
    wireBuyerPill.classList.toggle('on', wireBuyerStatus == 1);
    setText(autoTourneyPill, autoTourneyStatus == 1 ? 'ON' : 'OFF');
    autoTourneyPill.classList.toggle('on', autoTourneyStatus == 1);

    pickWrap.classList.toggle('needs-pick', stratPicker.value === '10');

    setText(unusedMirror, $('unusedClipsDisplay').textContent);

    profitCells.forEach(function (td) {
      var v = parseFloat(td.textContent);
      td.classList.toggle('up', v > 0);
      td.classList.toggle('down', v < 0);
    });

    if (mini.classList.contains('on')) updateMini();
  }

  function tick() {
    updateTabs();
    updateNudges();
    fillProgress();
    updateBadges();
    mirror();
  }

  // ---------------------------------------------------------------------------
  // Keep page content clear of the bottom dock, whatever its height.
  function measureDock() {
    document.documentElement.style.setProperty('--dock-h', dock.offsetHeight + 'px');
    placePill();
  }
  if (window.ResizeObserver) new ResizeObserver(measureDock).observe(dock);
  measureDock();

  // Let the new features steer the screen.
  if (window.UP) UP.ui = { selectTab: function (n) { selectTab(n); }, current: function () { return current; } };

  // Start on the last tab used, once the engine has shown/hidden its sections.
  setTimeout(function () {
    var vis = visibleTabs();
    var saved = store('up-ui-tab');
    selectTab(vis.indexOf(saved) >= 0 ? saved : (vis[0] || 'make'));
    tick();
    setInterval(tick, 200);
    // From here on, sections the engine hides fade out instead of vanishing,
    // and sections it unlocks slide in.
    setTimeout(function () {
      document.body.classList.add('ui-ready');
      revealsReady = true;
    }, 400);
  }, 30);
})();
