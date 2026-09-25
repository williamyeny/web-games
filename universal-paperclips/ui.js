// Mobile layer for the original Universal Paperclips engine (engine/*.js).
// Game rules live entirely in the engine, which is unmodified. This file only
// arranges the screen for phones and adds touch conveniences:
//   - bottom tabs that appear as each part of the game unlocks
//   - saving whenever the phone switches away from the game
//   - tap-and-hold to repeat on +/- and buy buttons
//   - tap twice to confirm "Disassemble all"
//   - tap (instead of mouse hover) to flip between tournament results and grid
//   - restoring the slider, risk and strategy pickers after a reload
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function shown(el) { return el && el.style.display !== 'none'; }

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { return null; }
  }

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
    if (resetting) return;
    try { save(); } catch (e) { /* storage full or blocked; the engine's autosave will retry */ }
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') saveNow();
  });
  window.addEventListener('pagehide', saveNow);

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
    if (current) scrollPos[current] = window.scrollY;
    current = name;
    ORDER.forEach(function (n) {
      panels[n].classList.toggle('on', n === name);
      tabButtons[n].setAttribute('aria-selected', n === name ? 'true' : 'false');
    });
    window.scrollTo(0, scrollPos[name] || 0);
    if (!seenTabs[name]) {
      seenTabs[name] = true;
      store('up-ui-seen-tabs', JSON.stringify(seenTabs));
    }
    store('up-ui-tab', name);
    if (name === 'projects') markProjectsSeen();
    updateBadges();
  }

  tabbar.addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]');
    if (!b) return;
    if (b.dataset.tab === current) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      selectTab(b.dataset.tab);
    }
  });

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
  // Project cards: split out the price so it can be styled, and badge the tab.
  var projectList = $('projectListTop');
  function dressProject(btn) {
    if (btn.dataset.dressed) return;
    btn.dataset.dressed = '1';
    var n = btn.childNodes[1];
    if (n && n.nodeType === 3 && n.nodeValue.trim()) {
      var s = document.createElement('span');
      s.className = 'cost';
      s.textContent = n.nodeValue.trim();
      btn.replaceChild(s, n);
    }
  }
  Array.prototype.forEach.call(projectList.children, dressProject);
  new MutationObserver(function (list) {
    list.forEach(function (m) {
      Array.prototype.forEach.call(m.addedNodes, function (node) {
        if (node.nodeType === 1 && node.classList.contains('projectButton')) dressProject(node);
      });
    });
  }).observe(projectList, { childList: true });

  var seenProjects = {};
  function markProjectsSeen() {
    Array.prototype.forEach.call(projectList.children, function (b) { seenProjects[b.id] = true; });
  }
  markProjectsSeen();

  function setBadge(name, kind, text) {
    var badge = tabButtons[name].querySelector('.badge');
    badge.className = 'badge' + (kind ? ' ' + kind : '');
    badge.textContent = text || '';
  }

  function updateBadges() {
    var buttons = projectList.children;
    var ready = 0;
    var fresh = false;
    for (var i = 0; i < buttons.length; i++) {
      if (!buttons[i].disabled) ready++;
      if (!seenProjects[buttons[i].id]) fresh = true;
    }
    if (current === 'projects') {
      markProjectsSeen();
      setBadge('projects', '');
    } else if (ready > 0) {
      setBadge('projects', 'count', ready > 9 ? '9+' : String(ready));
    } else {
      setBadge('projects', fresh ? 'dot' : '');
    }
    // Brand new tabs get a dot until they're opened.
    ['make', 'strategy', 'space'].forEach(function (n) {
      setBadge(n, (!seenTabs[n] && n !== current && !tabButtons[n].hidden) ? 'dot' : '');
    });
    if (!seenTabs.projects && current !== 'projects' && !tabButtons.projects.hidden && ready === 0) {
      setBadge('projects', 'dot');
    }
  }

  // ---------------------------------------------------------------------------
  // Message log: tap to show the last five messages; flash on new ones.
  var consoleEl = $('consoleDiv');
  function toggleConsole() {
    var open = consoleEl.classList.toggle('open');
    consoleEl.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  consoleEl.addEventListener('click', toggleConsole);
  consoleEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleConsole(); }
  });
  new MutationObserver(function () {
    consoleEl.classList.remove('flash');
    void consoleEl.offsetWidth;
    consoleEl.classList.add('flash');
  }).observe($('readout1'), { childList: true, characterData: true, subtree: true });

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
  window.addEventListener('resize', function () { lastClipText = ''; fitCount(); });

  // ---------------------------------------------------------------------------
  // Slim bar at the top once the big clip counter scrolls out of view.
  var mini = $('ui-mini');
  var miniNum = $('ui-mini-num');
  var miniSide = $('ui-mini-side');
  var miniMsg = $('ui-mini-msg');
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (entries) {
      var off = !entries[0].isIntersecting;
      if (off) updateMini();
      mini.classList.toggle('on', off);
      mini.setAttribute('aria-hidden', off ? 'false' : 'true');
    }).observe(clipsEl);
  }
  mini.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

  function updateMini() {
    var full = clipsEl.textContent;
    setText(miniNum, full.length <= 15 ? full : $('clipCountCrunched').textContent.trim());
    setText(miniSide, sideNum.textContent ? sideNum.textContent + (sideLabel.textContent === 'funds' ? '' : ' unused') : '');
    setText(miniMsg, $('readout1').textContent);
  }

  // ---------------------------------------------------------------------------
  // Everything that just mirrors engine numbers onto the new layout.
  var sideNum = $('ui-side-num');
  var sideLabel = $('ui-side-label');
  var topEl = $('ui-top');
  var opsBar = $('ui-ops-bar');
  var storageBar = $('ui-storage-bar');
  var spare = $('ui-spare');
  var pickWrap = stratPicker.closest('.select');
  var wireBuyerPill = $('wireBuyerStatus');
  var autoTourneyPill = $('autoTourneyStatus');
  var unusedMirror = $('ui-unused-mirror');
  var profitCells = [1, 2, 3, 4, 5].map(function (n) { return $('stock' + n + 'Profit'); });

  function setText(el, text) {
    if (el.textContent !== text) el.textContent = text;
  }

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

    var canAdd = Math.max(0, Math.floor(trust - processors - memory)) + Math.max(0, Math.floor(swarmGifts));
    setText(spare, (shown($('processorDisplay')) && !$('btnAddProc').disabled && canAdd > 0)
      ? 'You can add ' + canAdd + ' more.' : '');

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
    updateBadges();
    mirror();
  }

  // ---------------------------------------------------------------------------
  // Keep page content clear of the bottom dock, whatever its height.
  var dock = $('ui-dock');
  function measureDock() {
    document.documentElement.style.setProperty('--dock-h', dock.offsetHeight + 'px');
  }
  if (window.ResizeObserver) new ResizeObserver(measureDock).observe(dock);
  measureDock();

  // Start on the last tab used, once the engine has shown/hidden its sections.
  setTimeout(function () {
    var vis = visibleTabs();
    var saved = store('up-ui-tab');
    selectTab(vis.indexOf(saved) >= 0 ? saved : (vis[0] || 'make'));
    tick();
    setInterval(tick, 200);
  }, 30);
})();
