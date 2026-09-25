// Mobile edition additions: lucky paperclips.
// Every few minutes a golden paperclip drifts onto the screen for a little
// while. Tap it for a surprise bonus that suits the stage of the game.
(function () {
  'use strict';
  var UP = window.UP;
  var run = function () { return UP.data.run; };

  var CLIP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 7.5v8.25a2.5 2.5 0 0 1-5 0V5a3.75 3.75 0 0 1 7.5 0v11.5a5 5 0 0 1-10 0V9"/></svg>';
  var GOLD = ['#FFD23F', '#FFE98A', '#F4B400', '#FFF6C7'];
  var STAY = 11;          // seconds on screen
  var current = null;

  function schedule(first) {
    var wait = first ? UP.rand(55, 85) : UP.rand(150, 330) / (perk.lucky || 1);
    run().luckyNext = run().playSeconds + Math.round(wait);
  }
  if (!run().luckyNext) schedule(run().playSeconds < 60);

  function creativityPerSecond() {
    var ss = (creativitySpeed + creativitySpeed * prestigeS / 10) * perk.creat;
    return ss / 4;
  }
  function amount(n) { return n * (perk.luckyReward || 1); }
  function secs(n) { return Math.round(n * Math.sqrt(perk.luckyReward || 1)); }

  // Rewards by stage. `ok` says whether it makes sense right now.
  var brainwave = {
    w: 2, ok: function () { return compFlag == 1 && memory > 0; },
    run: function () {
      standardOps = Math.max(standardOps, memory * 1000);
      var extra = creativityOn ? Math.max(10, creativityPerSecond() * 120) : 0;
      creativity += amount(extra);
      return { title: 'Brainwave!', text: 'Operations full' + (extra ? ' and +' + UP.fmt(amount(extra)) + ' creativity' : '') };
    }
  };
  function surge(mult, seconds) {
    return {
      w: 3, ok: function () { return factoryLevel > 0 || clipmakerLevel + megaClipperLevel > 0; },
      run: function () {
        var s = secs(seconds);
        UP.addBoost('clips', mult, s, 'Clips ×' + mult);
        return { title: 'Clip storm!', text: 'Everything makes ' + mult + '× the clips for ' + s + ' seconds' };
      }
    };
  }
  var REWARDS = {
    1: [
      {
        w: 3, ok: function () { return true; },
        run: function () {
          var rev = isFinite(avgRev) ? avgRev : 0;
          var cash = amount(Math.max(10, rev * 90));
          funds += cash;
          return { title: 'Windfall!', text: '+' + UP.money(cash) };
        }
      },
      {
        w: 2, ok: function () { return unsoldClips > 0 || clipmakerLevel > 0; },
        run: function () {
          var s = secs(30);
          UP.addBoost('demand', 4, s, 'Demand ×4');
          return { title: 'Shopping frenzy!', text: 'Demand is 4× for ' + s + ' seconds' };
        }
      },
      surge(5, 20),
      brainwave,
      {
        w: 1, ok: function () { return true; },
        run: function () {
          var inches = amount(wireSupply * 5 * perk.wire);
          wire += inches;
          return { title: 'Free wire!', text: '+' + UP.fmt(inches) + ' inches of wire' };
        }
      }
    ],
    2: [
      surge(5, 30),
      {
        w: 2, ok: function () { return clipRate > 0; },
        run: function () {
          var n = amount(clipRate * 60);
          clips += n; unusedClips += n;
          return { title: 'Stockpile!', text: '+' + UP.fmt(n) + ' clips' };
        }
      },
      {
        w: 2, ok: function () { return swarmFlag == 1; },
        run: function () {
          var n = Math.round(amount(2));
          swarmGifts += n;
          return { title: 'Swarm gift!', text: '+' + n + ' swarm gifts to spend on processors or memory' };
        }
      },
      {
        w: 1, ok: function () { return batteryLevel > 0 && storedPower < batteryLevel * batterySize; },
        run: function () {
          storedPower = batteryLevel * batterySize;
          return { title: 'Power surge!', text: 'Batteries fully charged' };
        }
      },
      brainwave
    ],
    3: [
      surge(5, 30),
      {
        w: 2, ok: function () { return probeCount >= 1; },
        run: function () {
          var n = Math.max(1, Math.round(amount(probeCount * 0.03)));
          probeCount += n;
          return { title: 'Stowaways!', text: '+' + UP.fmt(n) + ' probes' };
        }
      },
      {
        w: 1, ok: function () { return project121.flag == 1; },
        run: function () {
          var n = Math.round(amount(5000));
          honor += n;
          document.getElementById('honorDisplay').innerHTML = formatWithCommas(Math.round(honor));
          return { title: 'Glory!', text: '+' + UP.fmt(n) + ' honor' };
        }
      },
      {
        w: 1, ok: function () { return strategyEngineFlag == 1; },
        run: function () {
          var n = Math.round(amount(Math.max(1000, yomi * 0.05)));
          yomi += n;
          document.getElementById('yomiDisplay').innerHTML = formatWithCommas(yomi);
          return { title: 'Insight!', text: '+' + UP.fmt(n) + ' yomi' };
        }
      },
      brainwave
    ]
  };

  function spot() {
    var top = Math.max(150, window.innerHeight * 0.36); // below where toasts appear
    var dock = document.getElementById('ui-dock');
    var bottom = window.innerHeight - (dock ? dock.offsetHeight : 120) - 90;
    var x = UP.rand(20, Math.max(40, window.innerWidth - 90));
    var y = UP.rand(top, Math.max(top + 20, bottom));
    // The very first one shows up near the middle so it isn't missed.
    if (!UP.data.stats.lucky) { x = window.innerWidth / 2 - 35; y = (top + bottom) / 2; }
    return { x: x, y: y };
  }

  function appear() {
    var at = spot();
    var b = document.createElement('button');
    b.className = 'lucky-clip';
    b.setAttribute('aria-label', 'Lucky paperclip! Tap it.');
    b.innerHTML = '<span class="lucky-glow"></span>' + CLIP;
    b.style.left = at.x + 'px';
    b.style.top = at.y + 'px';
    document.body.appendChild(b);
    current = { el: b, born: Date.now() };
    UP.sound('luckyAppear');
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      if (b.classList.contains('caught')) return;
      catchIt(b);
    });
    setTimeout(function () { vanish(b); }, STAY * 1000);
  }

  function vanish(b) {
    if (!b.isConnected || b.classList.contains('caught')) return;
    b.classList.add('gone');
    setTimeout(function () { b.remove(); }, 600);
    if (current && current.el === b) current = null;
    schedule(false);
  }

  function catchIt(b) {
    b.classList.add('caught');
    var box = b.getBoundingClientRect();
    var stage = Math.min(3, UP.phase());
    var options = REWARDS[stage].filter(function (r) { return r.ok(); });
    var reward = UP.pick(options).run();
    run().lucky++;
    UP.data.stats.lucky++;
    UP.sound('lucky');
    UP.haptic('medium');
    UP.confetti({ x: box.left + box.width / 2, y: box.top + box.height / 2, count: 36, colors: GOLD });
    UP.toast({ kind: 'lucky', title: reward.title, text: reward.text, icon: '<svg viewBox="0 0 24 24"><path d="M14.5 7.5v8.25a2.5 2.5 0 0 1-5 0V5a3.75 3.75 0 0 1 7.5 0v11.5a5 5 0 0 1-10 0V9" fill="none" stroke="#1C2A66" stroke-width="2.4" stroke-linecap="round"/></svg>' });
    UP.emit('lucky', reward);
    setTimeout(function () { b.remove(); }, 500);
    current = null;
    schedule(false);
    UP.save();
  }

  UP.on('second', function () {
    if (current || UP.busy || UP.phase() >= 4 || dismantle > 0) return;
    if (document.documentElement.classList.contains('sheet-open')) return;
    var overlay = document.getElementById('hypnoDroneEventDiv');
    if (overlay && overlay.style.display !== 'none') return;
    if (run().playSeconds >= run().luckyNext) appear();
  });

  // ---------------------------------------------------------------------------
  // Active bonuses show as little chips under the clip counter.
  var chips = document.createElement('div');
  chips.className = 'boosts';
  chips.setAttribute('aria-live', 'polite');
  var meta = document.querySelector('.count-meta');
  if (meta) meta.parentNode.insertBefore(chips, meta.nextSibling);
  function paint() {
    chips.textContent = '';
    UP.boosts.forEach(function (b) {
      var chip = document.createElement('span');
      chip.className = 'boost';
      chip.textContent = b.label + ' · ' + b.left + 's';
      chip.style.setProperty('--left', (b.left / b.total).toFixed(3));
      chips.appendChild(chip);
    });
  }
  UP.on('boosts', paint);
  UP.on('second', function () { if (UP.boosts.length || chips.firstChild) paint(); });

  UP.lucky = { appear: appear };
})();
