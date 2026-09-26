// Mobile edition additions: the Make paperclip button steps aside.
// Early on, tapping is the whole game, so the button sits big at the bottom.
// Once machines out-produce any finger (or the HypnoDrones take over), it
// moves to the top of the Clips tab as a small button, and once the drones
// take over it goes away. In the very end, when the last paperclips are made
// by hand again, it comes back.
(function () {
  'use strict';
  var UP = window.UP;
  var D = UP.data;
  var button = document.getElementById('btnMakePaperclip');
  var dock = document.getElementById('ui-dock');
  var slot = document.getElementById('ui-make-slot');
  if (!button || !dock || !slot) return;

  function machineRate() {
    // Clips per second from AutoClippers and MegaClippers (the engine ticks 100 times a second).
    return (clipperBoost * clipmakerLevel + megaClipperBoost * megaClipperLevel * 500) * perk.clipper;
  }

  function wantsHero() {
    if (dismantle >= 4) return true;                 // the ending: make the last clips by hand
    if (D.run.makeRetired || humanFlag == 0) return false;
    return machineRate() < 20;
  }

  var hero = null;
  var tabbar = document.getElementById('ui-tabbar');
  function place(first) {
    var h = wantsHero();
    // Once the drones take over, one clip per tap means nothing: tuck it away
    // until the ending, when it's needed again.
    var away = !h && humanFlag == 0;
    if (slot.hidden !== (h || away)) slot.hidden = h || away;
    // Nothing left in the dock (no button, no tabs yet): hide it.
    dock.classList.toggle('empty', !h && tabbar.hidden);
    if (h === hero) return;
    var wasHero = hero;
    hero = h;
    button.classList.toggle('compact', !h);
    if (h) dock.insertBefore(button, dock.firstChild);
    else slot.appendChild(button);
    if (first) return;
    if (!UP.calm()) button.animate([{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,1.3,.4,1)' });
    if (!h && wasHero && !D.run.makeRetired) {
      D.run.makeRetired = true;
      UP.save();
    }
    if (h && dismantle >= 4) UP.sound('unlock');
  }
  if (!wantsHero() && humanFlag == 1) D.run.makeRetired = true;
  place(true);
  UP.on('second', function () { place(false); });
})();
