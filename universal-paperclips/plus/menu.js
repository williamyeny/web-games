// Mobile edition additions: the menu sheet (What's new, trophies, stats, settings).
// Other features add their own pages with UP.menuPage().
(function () {
  'use strict';
  var UP = window.UP;
  var log = window.CHANGELOG || [];

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  UP.el = el;

  // ---------------------------------------------------------------------------
  // Pages. Each: { id, label, render(body), badge() }.
  var pages = [];
  UP.menuPage = function (page) {
    pages.push(page);
    pages.sort(function (a, b) { return (a.order || 50) - (b.order || 50); });
    renderTabs();
  };

  // ---------------------------------------------------------------------------
  // The sheet.
  var backdrop = el('div', 'sheet-backdrop');
  backdrop.hidden = true;
  var sheet = el('section', 'sheet');
  sheet.hidden = true;
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', 'Menu');
  var head = el('div', 'sheet-head');
  var tabs = el('nav', 'sheet-tabs');
  var close = el('button', 'sheet-close');
  close.setAttribute('aria-label', 'Close menu');
  close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  head.appendChild(tabs);
  head.appendChild(close);
  var body = el('div', 'sheet-body');
  sheet.appendChild(el('div', 'sheet-grip'));
  sheet.appendChild(head);
  sheet.appendChild(body);
  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);

  var current = 'news';
  function renderTabs() {
    tabs.textContent = '';
    pages.forEach(function (p) {
      if (p.hidden && p.hidden()) return;
      var b = el('button', 'sheet-tab', p.label);
      b.dataset.page = p.id;
      b.setAttribute('aria-selected', p.id === current ? 'true' : 'false');
      if (p.badge && p.badge()) b.appendChild(el('i', 'dot'));
      tabs.appendChild(b);
    });
  }
  function show(id) {
    current = id;
    var page = pages.filter(function (p) { return p.id === id; })[0] || pages[0];
    body.textContent = '';
    page.render(body);
    body.scrollTop = 0;
    renderTabs();
    updateMenuBadge();
  }
  UP.openMenu = function (id) {
    backdrop.hidden = false;
    sheet.hidden = false;
    show(id || current);
    document.documentElement.classList.add('sheet-open');
    if (!UP.calm()) {
      sheet.animate([{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
      backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240 });
    }
    UP.sound('whoosh');
  };
  UP.closeMenu = function () {
    if (sheet.hidden) return;
    function done() {
      sheet.hidden = true;
      backdrop.hidden = true;
      document.documentElement.classList.remove('sheet-open');
    }
    if (UP.calm()) return done();
    sheet.animate([{ transform: 'none' }, { transform: 'translateY(100%)' }], { duration: 240, easing: 'ease-in' }).onfinish = done;
    backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240 });
  };
  UP.refreshMenu = function () { if (!sheet.hidden) show(current); else updateMenuBadge(); };
  tabs.addEventListener('click', function (e) {
    var b = e.target.closest('[data-page]');
    if (b) { show(b.dataset.page); UP.sound('tab'); }
  });
  close.addEventListener('click', UP.closeMenu);
  backdrop.addEventListener('click', UP.closeMenu);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') UP.closeMenu(); });

  // The menu button in the header wears a dot when something inside is new.
  var menuBtn = document.getElementById('ui-menu');
  var menuDot = menuBtn.querySelector('.dot');
  function updateMenuBadge() {
    var any = pages.some(function (p) { return p.badge && p.badge() && !(p.hidden && p.hidden()); });
    menuDot.hidden = !any;
  }
  UP.updateMenuBadge = updateMenuBadge;
  menuBtn.addEventListener('click', function () {
    var withNews = pages.filter(function (p) { return p.badge && p.badge(); })[0];
    UP.openMenu(withNews ? withNews.id : current);
  });
  UP.on('second', updateMenuBadge);

  // ---------------------------------------------------------------------------
  // What's new.
  function unseenNews() { return log.length && UP.data.seenLog !== log[0].id; }
  UP.menuPage({
    id: 'news', label: 'What’s new', order: 10,
    badge: unseenNews,
    render: function (box) {
      var seen = UP.data.seenLog;
      var reachedSeen = false;
      log.forEach(function (entry) {
        if (entry.id === seen) reachedSeen = true;
        var card = el('article', 'news' + (!reachedSeen && seen !== undefined ? ' fresh' : ''));
        var top = el('div', 'news-top');
        top.appendChild(el('h3', null, entry.title));
        top.appendChild(el('span', 'news-date', entry.date));
        card.appendChild(top);
        var list = el('ul');
        entry.items.forEach(function (item) { list.appendChild(el('li', null, item)); });
        card.appendChild(list);
        box.appendChild(card);
      });
      if (log.length) { UP.data.seenLog = log[0].id; UP.save(); }
    }
  });

  // ---------------------------------------------------------------------------
  // Stats.
  function statRows(box, title, rows) {
    box.appendChild(el('h3', 'sheet-h', title));
    var dl = el('dl', 'stats');
    rows.forEach(function (r) {
      dl.appendChild(el('dt', null, r[0]));
      dl.appendChild(el('dd', null, r[1]));
    });
    box.appendChild(dl);
  }
  UP.menuPage({
    id: 'stats', label: 'Stats', order: 30,
    render: function (box) {
      var run = UP.data.run;
      var all = UP.data.stats;
      var fact = UP.funFact && UP.funFact();
      if (fact) box.appendChild(el('p', 'sheet-fact', fact.text));
      statRows(box, UP.data.universe > 1 ? 'This universe' : 'This game', [
        ['Time played', UP.duration(run.playSeconds)],
        ['Paperclips', UP.fmt(clips)],
        ['Made by hand', UP.fmt(run.handClips)],
        ['Projects finished', UP.fmt(run.projects)]
      ]);
      statRows(box, 'All time', [
        ['Time played', UP.duration(all.playSeconds)],
        ['Made by hand', UP.fmt(all.handClips)],
        ['Projects finished', UP.fmt(all.projects)],
        ['Universes finished', UP.fmt(all.universes)]
      ].concat(all.fastestUniverse ? [['Fastest universe', UP.duration(all.fastestUniverse)]] : []));
    }
  });

  // ---------------------------------------------------------------------------
  // Settings.
  var SAVE_KEYS = ['saveGame', 'saveProjectsUses', 'saveProjectsFlags', 'saveProjectsActive', 'saveStratsActive', 'savePrestige', 'up-plus'];
  function saveCode() {
    save();
    var data = {};
    SAVE_KEYS.forEach(function (k) { var v = localStorage.getItem(k); if (v !== null) data[k] = v; });
    return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  }
  function loadCode(code) {
    var data = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    if (!data || !data.saveGame) throw new Error('not a save');
    UP.skipSaveOnExit = true;
    SAVE_KEYS.forEach(function (k) {
      if (data[k] !== undefined) localStorage.setItem(k, data[k]); else localStorage.removeItem(k);
    });
    location.reload();
  }

  function toggleRow(box, label, hint, key) {
    var row = el('button', 'setting');
    row.setAttribute('role', 'switch');
    var text = el('span', 'setting-text');
    text.appendChild(el('b', null, label));
    text.appendChild(el('small', null, hint));
    row.appendChild(text);
    var pill = el('span', 'pill');
    row.appendChild(pill);
    function paint() {
      var on = UP.data.settings[key];
      row.setAttribute('aria-checked', on ? 'true' : 'false');
      pill.textContent = on ? 'ON' : 'OFF';
      pill.classList.toggle('on', on);
    }
    row.addEventListener('click', function () {
      UP.data.settings[key] = !UP.data.settings[key];
      UP.save();
      paint();
      if (key === 'sound') UP.sound('buy');
      if (key === 'haptics') UP.haptic('medium');
    });
    paint();
    box.appendChild(row);
  }

  function armedButton(label, armedLabel, action) {
    var b = el('button', 'btn ghost wide', label);
    var armed = false;
    var timer = null;
    b.addEventListener('click', function () {
      if (!armed) {
        armed = true;
        b.textContent = armedLabel;
        b.classList.add('armed');
        timer = setTimeout(function () { armed = false; b.textContent = label; b.classList.remove('armed'); }, 3500);
        return;
      }
      clearTimeout(timer);
      action();
    });
    return b;
  }

  UP.menuPage({
    id: 'settings', label: 'Settings', order: 40,
    render: function (box) {
      toggleRow(box, 'Sound', 'Clicks and tones', 'sound');
      toggleRow(box, 'Vibration', 'A tiny buzz when you tap (on phones that can)', 'haptics');

      box.appendChild(el('h3', 'sheet-h', 'Move your game to another phone'));
      box.appendChild(el('p', 'sheet-p', 'Copy your save code, send it to yourself, then paste it here on the other phone.'));
      var copy = el('button', 'btn wide', 'Copy save code');
      var area = el('textarea', 'code');
      area.setAttribute('aria-label', 'Save code');
      area.placeholder = 'Paste a save code here';
      area.rows = 3;
      copy.addEventListener('click', function () {
        var code = saveCode();
        area.value = code;
        var done = function () { copy.textContent = 'Copied!'; setTimeout(function () { copy.textContent = 'Copy save code'; }, 2000); };
        if (navigator.clipboard) navigator.clipboard.writeText(code).then(done, function () { area.select(); });
        else { area.select(); document.execCommand('copy'); done(); }
      });
      var load = armedButton('Load this save code', 'Tap again to replace your game', function () {
        try { loadCode(area.value); }
        catch (e) { load.textContent = 'That code didn’t work'; }
      });
      box.appendChild(copy);
      box.appendChild(area);
      box.appendChild(load);

      box.appendChild(el('h3', 'sheet-h', 'Start over'));
      box.appendChild(el('p', 'sheet-p', 'Restart this universe from the first paperclip. Trophies' +
        (UP.data.universe > 1 ? ', Stardust and blueprints' : '') + ' are kept.'));
      box.appendChild(armedButton('Restart this universe', 'Tap again to restart', function () {
        UP.data.run = UP.freshRun();
        UP.save();
        reset();
      }));
    }
  });

  // After an update, the menu button wears a dot until What's new is opened.
  setTimeout(updateMenuBadge, 1500);
  if (UP.isNewPlayer && log.length) { UP.data.seenLog = log[0].id; UP.save(); }
})();
