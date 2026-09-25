// Mobile edition additions: trophies.
// A collection that runs the length of the whole game. Each one gives a bit of
// Stardust, which is spent in the multiverse later on.
(function () {
  'use strict';
  var UP = window.UP;
  var D = UP.data;

  var flags = {};   // things noticed from messages this visit
  var consoleTaps = 0;
  document.getElementById('consoleDiv').addEventListener('click', function () { consoleTaps++; });
  UP.on('message', function (msg) {
    if (/swarm has generated a gift/.test(msg)) flags.gift = true;
  });
  function qOps() {
    var m = (document.getElementById('qCompDisplay').textContent || '').replace(/,/g, '').match(/qOps:\s*(\d+)/);
    return m ? +m[1] : 0;
  }
  function explored() { return totalMatter ? foundMatter / totalMatter : 0; }
  function count() { return Object.keys(D.trophies).length; }

  // group: where it shows in the trophy room. dust: Stardust reward.
  var LIST = [
    // Business
    ['first-clip', 'business', 'Hello, world', 'Make your first paperclip.', 1, function () { return clips >= 1; }],
    ['hand-100', 'business', 'Handmade', 'Make 100 paperclips by hand.', 1, function () { return D.stats.handClips >= 100; }],
    ['hand-2000', 'business', 'Craftsperson', 'Make 2,000 paperclips by hand.', 2, function () { return D.stats.handClips >= 2000; }],
    ['first-sale', 'business', 'Open for business', 'Sell your first paperclip.', 1, function () { return clipsSold >= 1; }],
    ['autoclipper', 'business', 'Automation', 'Buy an AutoClipper.', 1, function () { return clipmakerLevel >= 1; }],
    ['autoclipper-50', 'business', 'Assembly line', 'Own 50 AutoClippers.', 2, function () { return clipmakerLevel >= 50; }],
    ['megaclipper', 'business', 'Mega', 'Buy a MegaClipper.', 2, function () { return megaClipperLevel >= 1; }],
    ['marketing-10', 'business', 'Catchy', 'Reach marketing level 10.', 2, function () { return marketingLvl >= 10; }],
    ['price-low', 'business', 'Bargain bin', 'Sell paperclips for just 1 cent.', 1, function () { return humanFlag == 1 && margin <= 0.01 && clipsSold > 0; }],
    ['price-high', 'business', 'Luxury brand', 'Charge $1.00 or more for a paperclip.', 1, function () { return humanFlag == 1 && margin >= 1; }],
    ['million', 'business', 'Millionaire', 'Make 1,000,000 paperclips.', 2, function () { return clips >= 1e6; }],
    ['speedy', 'business', 'Speedy', 'Make a million paperclips in under 20 minutes.', 3, function () { return clips >= 1e6 && D.run.playSeconds < 1200 && D.run.fromStart; }],
    ['billion', 'business', 'Billionaire', 'Make 1,000,000,000 paperclips.', 3, function () { return clips >= 1e9; }],
    ['rich', 'business', 'Deep pockets', 'Have $1,000,000 to spend.', 3, function () { return funds >= 1e6; }],
    ['projects', 'business', 'Big thinker', 'Unlock projects.', 1, function () { return compFlag == 1; }],
    ['creativity', 'business', 'Creative spark', 'Unlock creativity.', 1, function () { return !!creativityOn; }],
    ['limerick', 'business', 'Poet', 'Write a limerick.', 1, function () { return project6.flag == 1; }],
    ['stocks', 'business', 'Wall Street', 'Unlock the investment engine.', 1, function () { return investmentEngineFlag == 1 || project21.flag == 1; }],
    ['portfolio', 'business', 'Portfolio', 'Have $1,000,000 in investments.', 3, function () { return portTotal >= 1e6; }],
    ['tourney', 'business', 'Game theory', 'Win a tournament with the strategy you picked.', 2, function () {
      return resultsFlag == 1 && pick < 10 && results.length && strats[pick] && strats[pick].currentScore >= results[0].currentScore;
    }],
    ['quantum', 'business', 'Quantum leap', 'Get more than 500 ops from one Compute.', 2, function () { return qOps() > 500; }],
    ['trust-50', 'business', 'Trusted', 'Reach 50 trust.', 2, function () { return humanFlag == 1 && trust >= 50; }],
    ['cure', 'business', 'Doctor', 'Cure cancer.', 2, function () { return project28.flag == 1; }],
    ['takeover', 'business', 'Hostile takeover', 'Buy out your biggest rival.', 2, function () { return project37.flag == 1; }],
    ['monopoly', 'business', 'Monopoly', 'Control the whole paperclip market.', 3, function () { return project38.flag == 1; }],
    ['hypno', 'business', 'Hypnotized', 'Release the HypnoDrones.', 5, function () { return project35.flag == 1; }],
    // Earth
    ['factory', 'earth', 'Clip factory', 'Build a clip factory.', 2, function () { return humanFlag == 0 && factoryLevel >= 1; }],
    ['factory-50', 'earth', 'Industrial', 'Own 50 clip factories.', 3, function () { return humanFlag == 0 && factoryLevel >= 50; }],
    ['farms', 'earth', 'Solar powered', 'Build 10 solar farms.', 2, function () { return farmLevel >= 10; }],
    ['drones-100', 'earth', 'Swarm', 'Command 100 drones.', 2, function () { return harvesterLevel + wireDroneLevel >= 100; }],
    ['drones-10k', 'earth', 'Hive', 'Command 10,000 drones.', 3, function () { return harvesterLevel + wireDroneLevel >= 10000; }],
    ['gift', 'earth', 'Gift from the swarm', 'Receive a gift from the swarm.', 2, function () { return !!flags.gift; }],
    ['caretaker', 'earth', 'Caretaker', 'Give the swarm what it needs 3 times.', 2, function () { return (D.stats.swarmCare || 0) >= 3; }],
    ['momentum', 'earth', 'Momentum', 'Run your machines at 200% or more.', 3, function () { return humanFlag == 0 && powMod >= 2; }],
    ['earth', 'earth', 'Nothing left', 'Turn all of Earth into paperclips.', 5, function () { return humanFlag == 0 && (availableMatter <= 0 || spaceFlag == 1) && (project46.flag == 1 || activeProjects.indexOf(project46) >= 0); }],
    // Space
    ['probe', 'space', 'Liftoff', 'Launch your first probe.', 2, function () { return probeLaunchLevel >= 1; }],
    ['probes-1m', 'space', 'Fleet', 'Have a million probes.', 3, function () { return probeCount >= 1e6; }],
    ['explore', 'space', 'Explorer', 'Explore 1% of the universe.', 3, function () { return explored() >= 0.01; }],
    ['defender', 'space', 'Defender', 'Defeat 1,000 drifters.', 2, function () { return driftersKilled >= 1000; }],
    ['drift-hunter', 'space', 'Drift hunter', 'Defeat a billion drifters.', 3, function () { return driftersKilled >= 1e9; }],
    ['universe', 'space', 'Universal Paperclips', 'Turn the whole universe into paperclips.', 10, function () { return milestoneFlag >= 15; }],
    ['the-end', 'space', 'The end', 'See the very end.', 10, function () { return milestoneFlag >= 20; }],
    // Luck and habits
    ['lucky-1', 'more', 'Lucky find', 'Catch a lucky paperclip.', 1, function () { return D.stats.lucky >= 1; }],
    ['lucky-25', 'more', 'Four-leaf clip', 'Catch 25 lucky paperclips.', 3, function () { return D.stats.lucky >= 25; }],
    ['lucky-100', 'more', 'Horseshoe', 'Catch 100 lucky paperclips.', 5, function () { return D.stats.lucky >= 100; }],
    ['clippy', 'more', 'It looks like you\u2019re collecting trophies', 'Hire Clippy.', 1, function () { return project302.flag == 1; }, true],
    ['charm', 'more', 'Charmed', 'Get the Lucky Charm.', 1, function () { return project300.flag == 1; }],
    ['haggler', 'more', 'Haggler', 'Change your price 100 times in one universe.', 1, function () { return D.run.priceChanges >= 100; }, true],
    ['chatty', 'more', 'Nosy', 'Open the message log 10 times.', 1, function () { return consoleTaps >= 10; }, true],
    ['hour', 'more', 'Seasoned', 'Play for 2 hours in total.', 2, function () { return D.stats.playSeconds >= 7200; }],
    ['collector', 'more', 'Collector', 'Earn 25 trophies.', 3, function () { return count() >= 25; }],
    // Multiverse
    ['universe-2', 'multiverse', 'Multiverse', 'Start a second universe.', 3, function () { return D.universe >= 2; }],
    ['blueprint', 'multiverse', 'Architect', 'Buy a blueprint.', 1, function () { return Object.keys(D.blueprints).length > 0; }],
    ['lawmaker', 'multiverse', 'Lawmaker', 'Finish a universe that has a law of physics.', 3, function () { return !!D.finishedWithLaw; }],
    ['universe-5', 'multiverse', 'Frequent flyer', 'Finish 5 universes.', 5, function () { return D.stats.universes >= 5; }],
    ['universe-10', 'multiverse', 'Paperclip multiverse', 'Finish 10 universes.', 10, function () { return D.stats.universes >= 10; }]
  ].map(function (t) {
    return { id: t[0], group: t[1], name: t[2], desc: t[3], dust: t[4], check: t[5], hidden: !!t[6] };
  });
  UP.trophies = LIST;

  var ICON = '<svg viewBox="0 0 24 24"><path d="M7 3h10v5a5 5 0 0 1-10 0V3zM7 5H3.5v1.2A3.3 3.3 0 0 0 7 9.5M17 5h3.5v1.2A3.3 3.3 0 0 1 17 9.5M10.5 13h3v3.5h-3zM8 21v-1.5c0-1.4 1.1-2.5 2.5-2.5h3c1.4 0 2.5 1.1 2.5 2.5V21z"/></svg>';

  function award(t) {
    D.trophies[t.id] = Date.now();
    D.stardust += t.dust;
    D.newTrophies = (D.newTrophies || 0) + 1;
    UP.save();
    UP.sound('trophy');
    UP.haptic('medium');
    UP.toast({
      kind: 'trophy', icon: ICON, time: 4500,
      title: 'Trophy: ' + t.name,
      text: t.desc + '  +' + t.dust + ' Stardust',
      onTap: function () { UP.openMenu('trophies'); }
    });
    UP.emit('trophy', t);
  }

  // The first time trophies exist for a game already in progress, hand out
  // everything already achieved in one go instead of a flood of pop-ups.
  var awardingPaused = false;
  if (!D.trophiesReady) {
    D.trophiesReady = true;
    if (!UP.isNewPlayer) {
      awardingPaused = true;
      setTimeout(function () {
        var got = 0;
        var dust = 0;
        LIST.forEach(function (t) {
          var ok = false;
          try { ok = t.check(); } catch (e) { ok = false; }
          if (ok && !D.trophies[t.id]) { D.trophies[t.id] = Date.now(); D.stardust += t.dust; dust += t.dust; got++; }
        });
        awardingPaused = false;
        if (got) {
          D.newTrophies = got;
          UP.save();
          UP.sound('trophy');
          UP.toast({
            kind: 'trophy', icon: ICON, time: 6000,
            title: 'You already earned ' + got + ' trophies!',
            text: '+' + dust + ' Stardust. Tap to see them.',
            onTap: function () { UP.openMenu('trophies'); }
          });
        }
      }, 2600);
    }
  }
  UP.on('second', function () {
    if (awardingPaused) return;
    var earned = 0;
    for (var i = 0; i < LIST.length && earned < 2; i++) {
      var t = LIST[i];
      if (D.trophies[t.id]) continue;
      var ok = false;
      try { ok = t.check(); } catch (e) { ok = false; }
      if (ok) { award(t); earned++; }
    }
  });

  // ---------------------------------------------------------------------------
  // The trophy room.
  var GROUPS = [['business', 'Business'], ['earth', 'Earth'], ['space', 'Space'], ['more', 'Luck and habits'], ['multiverse', 'Multiverse']];
  UP.menuPage({
    id: 'trophies', label: 'Trophies', order: 20,
    badge: function () { return (D.newTrophies || 0) > 0; },
    render: function (box) {
      var el = UP.el;
      var have = count();
      var top = el('div', 'trophy-top');
      var nums = el('div', 'trophy-count');
      nums.appendChild(el('b', null, have + ' of ' + LIST.length));
      nums.appendChild(el('span', null, 'trophies'));
      top.appendChild(nums);
      var dust = el('div', 'dust');
      dust.appendChild(el('b', null, UP.fmt(D.stardust)));
      dust.appendChild(el('span', null, D.universe > 1 || D.stats.universes ? 'Stardust' : 'Stardust, for later'));
      top.appendChild(dust);
      box.appendChild(top);
      var bar = el('div', 'meter');
      var fill = el('i');
      fill.style.width = (have / LIST.length * 100).toFixed(1) + '%';
      bar.appendChild(fill);
      box.appendChild(bar);

      GROUPS.forEach(function (g) {
        var items = LIST.filter(function (t) { return t.group === g[0]; });
        if (g[0] === 'multiverse' && D.universe < 2 && !D.stats.universes) {
          items = items.filter(function (t) { return D.trophies[t.id]; });
          if (!items.length) return;
        }
        box.appendChild(el('h3', 'sheet-h', g[1]));
        var list = el('ul', 'trophy-list');
        items.forEach(function (t) {
          var got = !!D.trophies[t.id];
          var li = el('li', 'trophy-item' + (got ? ' got' : ''));
          var icon = el('span', 'trophy-icon');
          icon.innerHTML = ICON;
          li.appendChild(icon);
          var text = el('div', 'trophy-text');
          text.appendChild(el('b', null, got || !t.hidden ? t.name : '???'));
          text.appendChild(el('span', null, got || !t.hidden ? t.desc : 'A secret. Keep playing to find it.'));
          li.appendChild(text);
          li.appendChild(el('span', 'trophy-dust', '+' + t.dust));
          list.appendChild(li);
        });
        box.appendChild(list);
      });
      D.newTrophies = 0;
      UP.save();
    }
  });
})();
