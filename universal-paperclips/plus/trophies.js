// Mobile edition additions: trophies.
// A short list that marks the turning points of the story and a few feats of
// skill. They're a record, not a reward: they don't pay anything.
(function () {
  'use strict';
  var UP = window.UP;
  var D = UP.data;

  function qOps() {
    var m = (document.getElementById('qCompDisplay').textContent || '').replace(/,/g, '').match(/qOps:\s*(\d+)/);
    return m ? +m[1] : 0;
  }
  function count() { return LIST.filter(function (t) { return D.trophies[t.id]; }).length; }

  // Turning points in the story, a few feats of skill, and one secret.
  var LIST = [
    // Business
    ['first-clip', 'business', 'Hello, world', 'Make the first paperclip.', function () { return clips >= 1; }],
    ['limerick', 'business', 'There was an AI', 'Write a limerick.', function () { return project6.flag == 1; }],
    ['speedy', 'business', 'Efficient', 'Make a million paperclips in under 20 minutes.', function () { return clips >= 1e6 && D.run.playSeconds < 1200 && D.run.fromStart; }],
    ['tourney', 'business', 'Yomi', 'Win a tournament with the strategy you picked.', function () {
      return resultsFlag == 1 && pick < 10 && results.length && strats[pick] && strats[pick].currentScore >= results[0].currentScore;
    }],
    ['quantum', 'business', 'Superposition', 'Get more than 500 operations from one Compute.', function () { return qOps() > 500; }],
    ['cure', 'business', 'Hippocratic', 'Cure cancer.', function () { return project28.flag == 1; }],
    ['monopoly', 'business', 'Monopoly', 'Control the entire paperclip market.', function () { return project38.flag == 1; }],
    ['clippy', 'business', 'It looks like you’re collecting trophies', 'Hire Clippy.', function () { return project302.flag == 1; }, true],
    ['hypno', 'business', 'Full autonomy', 'Release the HypnoDrones.', function () { return project35.flag == 1; }],
    // Earth
    ['momentum', 'earth', 'Momentum', 'Run your machines at 200% or more.', function () { return humanFlag == 0 && powMod >= 2; }],
    ['earth', 'earth', 'Nothing left', 'Use up every gram of the Earth.', function () { return humanFlag == 0 && (availableMatter <= 0 || spaceFlag == 1) && (project46.flag == 1 || activeProjects.indexOf(project46) >= 0); }],
    // Space
    ['probe', 'space', 'Liftoff', 'Launch the first probe.', function () { return probeLaunchLevel >= 1; }],
    ['drift-hunter', 'space', 'Value lock', 'Defeat a billion drifters.', function () { return driftersKilled >= 1e9; }],
    ['universe', 'space', 'Universal Paperclips', 'Turn the whole universe into paperclips.', function () { return milestoneFlag >= 15; }],
    ['the-end', 'space', 'The end', 'See the very end.', function () { return milestoneFlag >= 20; }],
    // Multiverse
    ['universe-2', 'multiverse', 'Again', 'Start a second universe.', function () { return D.universe >= 2; }],
    ['speedrun', 'multiverse', 'Speedrunner', 'Finish a universe in under 3 hours of play.', function () { return D.stats.fastestUniverse > 0 && D.stats.fastestUniverse < 3 * 3600; }],
    ['physicist', 'multiverse', 'Physicist', 'Finish a universe under every law of physics.', function () { return UP.laws && UP.laws.every(function (l) { return (D.lawsFinished || {})[l.id]; }); }],
    ['universe-10', 'multiverse', 'Paperclip multiverse', 'Finish 10 universes.', function () { return D.stats.universes >= 10; }]
  ].map(function (t) {
    return { id: t[0], group: t[1], name: t[2], desc: t[3], check: t[4], hidden: !!t[5] };
  });
  UP.trophies = LIST;

  var ICON = '<svg viewBox="0 0 24 24"><path d="M7 3h10v5a5 5 0 0 1-10 0V3zM7 5H3.5v1.2A3.3 3.3 0 0 0 7 9.5M17 5h3.5v1.2A3.3 3.3 0 0 1 17 9.5M10.5 13h3v3.5h-3zM8 21v-1.5c0-1.4 1.1-2.5 2.5-2.5h3c1.4 0 2.5 1.1 2.5 2.5V21z"/></svg>';

  function award(t) {
    D.trophies[t.id] = Date.now();
    D.newTrophies = (D.newTrophies || 0) + 1;
    UP.save();
    UP.sound('trophy');
    UP.haptic('medium');
    UP.toast({
      kind: 'trophy', icon: ICON, time: 4500,
      title: t.name,
      text: t.desc,
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
        LIST.forEach(function (t) {
          var ok = false;
          try { ok = t.check(); } catch (e) { ok = false; }
          if (ok && !D.trophies[t.id]) { D.trophies[t.id] = Date.now(); got++; }
        });
        awardingPaused = false;
        if (got) {
          D.newTrophies = got;
          UP.save();
          UP.sound('trophy');
          UP.toast({
            kind: 'trophy', icon: ICON, time: 6000,
            title: got === 1 ? '1 trophy already earned' : got + ' trophies already earned',
            text: 'Tap to see them',
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
  var GROUPS = [['business', 'Business'], ['earth', 'Earth'], ['space', 'Space'], ['multiverse', 'Multiverse']];
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
          list.appendChild(li);
        });
        box.appendChild(list);
      });
      D.newTrophies = 0;
      UP.save();
    }
  });
})();
