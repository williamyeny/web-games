// Mobile edition additions: effects of the new projects, and the swarm's needs.
(function () {
  'use strict';
  var UP = window.UP;
  var D = UP.data;

  // New projects whose effects aren't stored in the engine's own save.
  UP.perkSource(function (perk) {
    if (project320.flag == 1) perk.explore *= 2;
    if (project322.flag == 1) perk.hazard *= 0.5;
    if (project323.flag == 1) perk.drift *= 0.5;
    if (project324.flag == 1) perk.honor *= 1.5;
    if (project327.flag == 1) perk.yomi *= 2;
    if (project331.flag == 1) perk.demand *= 1.5;
    if (project332.flag == 1) perk.drone *= 1.25;
    if (project333.flag == 1) perk.drift *= 0.7;
    if (project334.flag == 1) perk.explore *= 1.5;
  });

  // ---------------------------------------------------------------------------
  // Every so often the swarm needs something: sunlight (hungry), a lesson
  // (confused) or paperclip coats (cold). Its gifts pause until it gets it.
  function schedule() {
    var restless = UP.hasLaw && UP.hasLaw('restless-swarm') ? 2 : 1;
    D.run.needAt = D.run.playSeconds + Math.round(UP.rand(360, 720) / restless);
  }
  if (!D.run.needAt) schedule();

  var WORDS = { 1: 'hungry', 2: 'confused', 4: 'cold' };
  UP.on('second', function () {
    if (swarmNeed || swarmFlag != 1 || dismantle > 0 || swarmStatus != 0) return;
    if (harvesterLevel + wireDroneLevel < 50 || D.run.playSeconds < D.run.needAt) return;
    var options = [];
    if (spaceFlag == 0 && batteryLevel > 0 && storedPower > 1000) options.push(1);
    if (creativityOn) options.push(2);
    if (unusedClips > 1e6) options.push(4);
    schedule();
    if (!options.length) return;
    swarmNeed = options[Math.floor(Math.random() * options.length)];
    displayMessage('The swarm is ' + WORDS[swarmNeed] + '. Its gifts are paused until it gets what it needs');
    UP.sound('unlock');
  });

  // Count every time the swarm is looked after (for a trophy).
  ['feedSwarm', 'teachSwarm', 'cladSwarm', 'entertainSwarm', 'synchSwarm'].forEach(function (name) {
    var fn = window[name];
    window[name] = function () {
      var before = swarmNeed + ',' + boredomFlag + ',' + disorgFlag;
      var r = fn.apply(this, arguments);
      if (swarmNeed + ',' + boredomFlag + ',' + disorgFlag !== before) D.stats.swarmCare = (D.stats.swarmCare || 0) + 1;
      return r;
    };
  });
})();

// Once the HypnoDrones take over there is no more money, so projects that cost
// money can never be bought. Clear them away instead of leaving dead cards.
(function () {
  'use strict';
  var UP = window.UP;
  var D = UP.data;
  function clearMoneyProjects() {
    if (humanFlag != 0) return;
    activeProjects.slice().forEach(function (p) {
      if (String(p.priceTag).indexOf('$') < 0) return;
      p.uses = 0;
      if (p.element && p.element.parentNode) p.element.parentNode.removeChild(p.element);
      activeProjects.splice(activeProjects.indexOf(p), 1);
    });
  }
  UP.on('project', function (p) { if (p === project35) setTimeout(clearMoneyProjects, 0); });
  setTimeout(clearMoneyProjects, 0);

  // Earth has a trap: spend the clips on drones or batteries before the first
  // factory, and nothing can make clips again. The way out (every machine can
  // be disassembled for all the clips it cost) is on screen but easy to miss,
  // so the log says it once, only when it's actually needed.
  function refunds() { return factoryBill + harvesterBill + wireDroneBill + farmBill + batteryBill; }
  UP.on('second', function () {
    if (humanFlag != 0 || spaceFlag != 0 || dismantle > 0) return;
    var noFactory = factoryFlag == 1 && factoryLevel < 1 && unusedClips < factoryCost && unusedClips + refunds() >= factoryCost;
    var earthGone = availableMatter <= 0 && acquiredMatter <= 0 && wire < 1 && activeProjects.indexOf(project46) >= 0 &&
      unusedClips < 5e27 && refunds() > 0;
    var stuck = noFactory ? 'factory' : earthGone ? 'earth' : '';
    if (stuck && D.run.stuck !== stuck) {
      displayMessage(stuck === 'factory'
        ? 'Nothing is making paperclips, and a factory costs more than you have. Disassembling machines returns every clip they cost'
        : 'The Earth is used up. Disassembling machines returns every clip they cost');
    }
    D.run.stuck = stuck;
  });

  // Quantum Temporal Reversion (start over) only makes sense while operations
  // are stuck far below zero. The rest of the time it stays off the list.
  UP.on('second', function () {
    var at = activeProjects.indexOf(project217);
    if (at < 0 || operations <= -10000) return;
    if (project217.element && project217.element.parentNode) project217.element.parentNode.removeChild(project217.element);
    activeProjects.splice(at, 1);
    project217.uses = 1;
  });

  // Projects for features that were removed (lucky paperclips), left over in old saves.
  setTimeout(function () {
    [project300, project301].forEach(function (p) {
      var at = activeProjects.indexOf(p);
      if (at < 0) return;
      if (p.element && p.element.parentNode) p.element.parentNode.removeChild(p.element);
      activeProjects.splice(at, 1);
    });
  }, 0);

  // Same once the whole universe is paperclips: probe, battle and space
  // projects can't do anything anymore, and some (like Probe Seminar) would
  // quietly eat the creativity that one of the endings needs.
  function number(p) { var m = /^projectButton(\d+)/.exec(p.id); return m ? +m[1] : -1; }
  function clearSpaceProjects() {
    if (milestoneFlag < 15) return;
    activeProjects.slice().forEach(function (p) {
      var n = number(p);
      if (!((n >= 100 && n < 140) || (n >= 300 && n < 400))) return;
      p.uses = 0;
      if (p.element && p.element.parentNode) p.element.parentNode.removeChild(p.element);
      activeProjects.splice(activeProjects.indexOf(p), 1);
    });
  }
  UP.on('second', clearSpaceProjects);
})();

// Probe Seminar's price depends on how many were bought this universe.
(function () {
  'use strict';
  project328.creat = seminarCost();
  project328.priceTag = '(' + project328.creat.toLocaleString('en-US') + ' creat)';
  // The card may already be on screen from the save, still showing the old
  // price as plain text (ui.js dresses it up later) or as a .cost label.
  var card = project328.element;
  if (card) {
    var cost = card.querySelector('.cost');
    if (cost) cost.textContent = UP.priceLabel ? UP.priceLabel(project328.priceTag) : project328.priceTag;
    else if (card.childNodes[1] && card.childNodes[1].nodeType === 3) card.childNodes[1].nodeValue = project328.priceTag;
  }
})();
