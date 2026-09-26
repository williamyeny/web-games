// Mobile edition additions: fun facts.
// Big numbers mean little on their own ("3.2 sextillion"), so the paperclip
// count is turned into something you can picture: a line of clips reaching
// the Moon, or a pile weighing as much as the Earth. The latest comparison
// is written under the picture of your clips (plus/scene.js) and on Stats.
(function () {
  'use strict';
  var UP = window.UP;

  var CLIP_LENGTH = 0.033; // meters, end to end
  var CLIP_MASS = 1;       // grams (the game counts one clip per gram of matter too)

  function times(n) { return n < 2 ? '' : ' ' + UP.fmt(n) + ' times'; }
  function many(n, one, lots) { return n < 2 ? one : UP.fmt(n) + ' ' + lots; }

  // Lined up end to end. [meters, sentence ending]
  var LENGTHS = [
    [0.19, function (n) { return 'be as long as ' + many(n, 'a pencil', 'pencils'); }],
    [2, function (n) { return 'be as long as ' + many(n, 'a bed', 'beds'); }],
    [12, function (n) { return 'be as long as ' + many(n, 'a school bus', 'school buses'); }],
    [30, function (n) { return 'be as long as ' + many(n, 'a blue whale', 'blue whales'); }],
    [105, function (n) { return 'stretch across ' + many(n, 'a soccer field', 'soccer fields'); }],
    [330, function (n) { return 'reach the top of the Eiffel Tower' + times(n); }],
    [8849, function (n) { return 'reach the top of Mount Everest' + times(n); }],
    [4.5e6, function (n) { return 'stretch all the way across the USA' + times(n); }],
    [4.0075e7, function (n) { return 'wrap around the Earth' + times(n); }],
    [3.844e8, function (n) { return 'reach the Moon' + times(n); }],
    [1.496e11, function (n) { return 'reach the Sun' + times(n); }],
    [4.5e12, function (n) { return 'reach Neptune' + times(n); }],
    [4.0e16, function (n) { return 'reach the nearest star' + times(n); }]
  ];
  // All in one pile. [grams, sentence ending]
  var MASSES = [
    [5e14, function (n) { return n < 2 ? 'all the people on Earth put together' : 'all the people on Earth, ' + UP.fmt(n) + ' times over'; }],
    [1.4e24, function (n) { return n < 2 ? 'all the water in the oceans' : 'all the water in the oceans, ' + UP.fmt(n) + ' times over'; }],
    [7.35e25, function (n) { return many(n, 'the Moon', 'Moons'); }],
    [5.97e27, function (n) { return many(n, 'the Earth', 'Earths'); }],
    [1.9e30, function (n) { return many(n, 'Jupiter', 'Jupiters'); }],
    [1.99e33, function (n) { return many(n, 'the Sun', 'Suns'); }],
    [3e45, function (n) { return many(n, 'the whole Milky Way', 'Milky Ways'); }]
  ];

  // The biggest comparison the clips have passed: { tier, text }.
  function fact(count) {
    count = Math.floor(count || 0);
    if (count < 3e18) {
      var len = count * CLIP_LENGTH;
      for (var i = LENGTHS.length - 1; i >= 0; i--) {
        if (len >= LENGTHS[i][0]) {
          return { tier: i + 1, text: 'Lined up end to end, your paperclips would ' + LENGTHS[i][1](Math.floor(len / LENGTHS[i][0])) + '.' };
        }
      }
      return null;
    }
    var mass = count * CLIP_MASS;
    for (var j = MASSES.length - 1; j >= 0; j--) {
      if (mass >= MASSES[j][0]) {
        return { tier: LENGTHS.length + j + 1, text: 'All together, your paperclips weigh as much as ' + MASSES[j][1](Math.floor(mass / MASSES[j][0])) + '.' };
      }
    }
    return null;
  }
  UP.funFact = function () { return fact(clips); };
})();
