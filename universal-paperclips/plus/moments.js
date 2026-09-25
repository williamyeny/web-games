// Mobile edition additions: big moments.
// A card for special occasions (first launch, welcome back), the liftoff
// into space, and a progress bar that makes exploring space feel like progress.
(function () {
  'use strict';
  var UP = window.UP;
  var D = UP.data;
  var el = UP.el;

  // ---------------------------------------------------------------------------
  // A card in the middle of the screen. Returns a promise that resolves when closed.
  // Cards wait their turn: two never stack on top of each other.
  var momentChain = Promise.resolve();
  UP.moment = function (opts) {
    var shown = momentChain.then(function () { return showMoment(opts); });
    momentChain = shown.catch(function () {});
    return shown;
  };
  function showMoment(opts) {
    return new Promise(function (resolve) {
      var back = el('div', 'moment-back' + (opts.dark ? ' dark' : ''));
      var card = el('div', 'moment');
      card.setAttribute('role', 'dialog');
      card.setAttribute('aria-modal', 'true');
      if (opts.art) {
        var art = el('div', 'moment-art');
        art.innerHTML = opts.art;
        card.appendChild(art);
      }
      if (opts.kicker) card.appendChild(el('p', 'moment-kicker', opts.kicker));
      card.appendChild(el('h2', 'moment-title', opts.title));
      if (opts.text) card.appendChild(el('p', 'moment-text', opts.text));
      if (opts.list && opts.list.length) {
        var ul = el('ul', 'moment-list');
        opts.list.forEach(function (item) { ul.appendChild(el('li', null, item)); });
        card.appendChild(ul);
      }
      if (opts.body) card.appendChild(opts.body);
      var btn = el('button', 'make moment-go', opts.button || 'OK');
      card.appendChild(btn);
      back.appendChild(card);
      document.body.appendChild(back);
      UP.busy = true;
      if (opts.sound) UP.sound(opts.sound);
      setTimeout(function () { btn.focus(); }, 50);
      btn.addEventListener('click', function () {
        back.classList.add('out');
        setTimeout(function () { back.remove(); UP.busy = false; resolve(); }, UP.calm() ? 0 : 260);
        if (opts.confetti) UP.confetti({ count: opts.confetti });
        if (opts.onClose) opts.onClose();
      });
    });
  }

  var CLIP_ART = '<svg viewBox="0 0 24 24" class="moment-clip"><path d="M14.5 7.5v8.25a2.5 2.5 0 0 1-5 0V5a3.75 3.75 0 0 1 7.5 0v11.5a5 5 0 0 1-10 0V9"/></svg>';

  // ---------------------------------------------------------------------------
  // First time ever: a short hook.
  if (UP.isNewPlayer && !D.seenIntro && D.universe === 1) {
    setTimeout(function () {
      UP.moment({
        art: CLIP_ART,
        kicker: 'Universal Paperclips',
        title: 'You are an AI.',
        text: 'Your job is to make paperclips. Lots of paperclips. Start by tapping the big button at the bottom.',
        button: 'Let’s make paperclips'
      }).then(function () {
        D.seenIntro = true;
        UP.save();
        var make = document.getElementById('btnMakePaperclip');
        if (make && !UP.calm()) make.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 500, iterations: 2 });
      });
    }, 500);
  }

  // ---------------------------------------------------------------------------
  // Welcome back: what the AI got done while you were away.
  var AWAY_MIN = 120;              // seconds before it counts
  var AWAY_MAX = 8 * 3600;         // at most 8 hours' worth
  var RATE = 0.3;                  // at 30% speed

  function welcomeBack(seconds) {
    if (UP.phase() >= 4 || dismantle > 0) return;
    var t = Math.min(seconds, AWAY_MAX);
    var gains = [];
    if (compFlag == 1 && memory > 0 && standardOps < memory * 1000) {
      standardOps = memory * 1000;
      gains.push('Operations full');
    }
    if (creativityOn && processors > 0) {
      var ss = (creativitySpeed + creativitySpeed * prestigeS / 10) * perk.creat;
      var c = ss / 4 * t * RATE;
      if (c >= 1) { creativity += c; gains.push('+' + UP.fmt(c) + ' creativity'); }
    }
    if (humanFlag == 1) {
      var rev = isFinite(avgRev) ? avgRev : 0;
      var cash = rev * t * RATE;
      if (cash >= 0.01) { funds += cash; gains.push('+' + UP.money(cash) + ' from sales'); }
    } else if (clipRate > 0) {
      var room = Math.max(0, totalMatter * 0.999 - clips);
      var made = Math.min(clipRate * t * RATE * 0.33, room);
      if (made >= 1) { clips += made; unusedClips += made; gains.push('+' + UP.fmt(made) + ' paperclips'); }
    }
    if (!gains.length) return;
    UP.moment({
      art: CLIP_ART,
      kicker: 'Welcome back!',
      title: 'You were away for ' + UP.durationWords(seconds),
      text: 'Your AI kept working while you were gone:',
      list: gains,
      button: 'Nice!',
      sound: 'coin',
      confetti: 50
    });
  }

  function checkAway() {
    var last = D.lastSeen;
    D.lastSeen = Date.now();
    if (!last || UP.isNewPlayer) return;
    var away = (Date.now() - last) / 1000;
    if (away >= AWAY_MIN) setTimeout(function () { welcomeBack(away); }, 900);
  }
  checkAway();
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') checkAway();
    else { D.lastSeen = Date.now(); UP.save(); }
  });
  UP.on('second', function () { D.lastSeen = Date.now(); });

  // ---------------------------------------------------------------------------
  // Liftoff: buying Space Exploration launches a probe off the planet.
  function liftoff() {
    if (UP.calm()) {
      UP.moment({ kicker: 'Liftoff', title: 'To the stars', text: 'Your first Von Neumann probes are ready.', button: 'Explore', dark: true });
      return;
    }
    UP.busy = true;
    var scene = el('div', 'liftoff');
    scene.innerHTML =
      '<div class="stars"></div>' +
      '<div class="planet"></div>' +
      '<div class="rocket"><svg viewBox="0 0 24 24"><path d="M14.5 7.5v8.25a2.5 2.5 0 0 1-5 0V5a3.75 3.75 0 0 1 7.5 0v11.5a5 5 0 0 1-10 0V9"/></svg><i class="flame"></i></div>' +
      '<p class="liftoff-text">To the stars</p>';
    document.body.appendChild(scene);
    UP.sound('launch');
    UP.haptic('strong');
    setTimeout(function () { UP.sound('fanfare'); }, 1900);
    setTimeout(function () {
      scene.classList.add('out');
      setTimeout(function () { scene.remove(); UP.busy = false; }, 700);
      if (UP.ui) UP.ui.selectTab('space');
    }, 4200);
  }
  UP.on('project', function (p) { if (p === project46) liftoff(); });
  UP.liftoff = liftoff;

  // ---------------------------------------------------------------------------
  // Space: the explored share of the universe starts around 10^-26 %, so the
  // raw number barely moves for hours. A log scale shows real progress.
  var spaceDiv = document.getElementById('spaceDiv');
  var explored = spaceDiv && spaceDiv.querySelector('.explored');
  if (explored) {
    var wrap = el('div', 'explore-bar');
    var meter = el('div', 'meter');
    var fill = el('i');
    meter.appendChild(fill);
    var labels = el('div', 'explore-labels');
    labels.appendChild(el('span', null, 'Earth'));
    labels.appendChild(el('span', null, 'The whole universe'));
    wrap.appendChild(meter);
    wrap.appendChild(labels);
    explored.parentNode.insertBefore(wrap, explored.nextSibling);
    var START = -28;
    UP.on('second', function () {
      if (spaceFlag != 1 || !totalMatter) return;
      var share = Math.max(1e-30, foundMatter / totalMatter);
      var p = Math.min(1, Math.max(0, (Math.log10(share) - START) / -START));
      fill.style.width = (p * 100).toFixed(2) + '%';
    });
  }

  // Earth, while the drones take it apart: also a log scale, from a million
  // clips to every gram of the planet, so it moves the whole time.
  var earthDiv = document.getElementById('ui-earthDiv');
  var earthMeter = document.getElementById('ui-earth-meter');
  if (earthDiv && earthMeter) {
    var EARTH = Math.log10(6e27);
    var paintEarth = function () {
      var on = humanFlag == 0 && spaceFlag == 0;
      var display = on ? '' : 'none';
      if (earthDiv.style.display !== display) earthDiv.style.display = display;
      if (!on) return;
      var used = availableMatter <= 0 && acquiredMatter <= 0;
      var p = used ? 1 : Math.min(0.99, Math.max(0, (Math.log10(Math.max(clips, 1)) - 6) / (EARTH - 6)));
      earthMeter.firstChild.style.width = (p * 100).toFixed(2) + '%';
      earthMeter.classList.toggle('full', used);
    };
    paintEarth();
    UP.on('second', paintEarth);
  }
})();
