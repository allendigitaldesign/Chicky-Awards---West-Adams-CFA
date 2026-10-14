/*
 * Chicky Awards ballot rules. This one file is shared by the web page (index.html)
 * and the Google Apps Script backend (paste it into Apps Script as Rules.gs),
 * so the awards and rules only ever need to be changed here.
 *
 * To change the awards: edit AWARDS below, then re-paste into Apps Script and
 * deploy a new version (see README). Keep each id the same once voting starts.
 */

// pair: true means voters name two people for that award (for example a duo who are never apart).
var AWARDS = [
  { id: 'perfect-attendance', name: 'Perfect Attendance', description: '' },
  { id: 'best-dressed', name: 'Best Dressed', description: 'Always in complete uniform.' },
  { id: 'sunshine', name: 'Sunshine Award', description: 'Can brighten anyone’s day.' },
  { id: 'nuggets-of-positivity', name: 'Nuggets of Positivity Award', description: 'Always positive.' },
  { id: 'energizer-bunny', name: 'Energizer Bunny', description: 'Drinks the most caffeine.' },
  { id: 'stuck-like-glue', name: 'Stuck Like Glue Award', description: 'Two people who are never apart.', pair: true },
  { id: 'fastest-breader', name: 'Fastest Breader', description: '' },
  { id: 'fastest-bagger', name: 'Fastest and Most Accurate Bagger', description: 'Must be both fast and accurate.' },
  { id: 'moment-maker', name: 'Moment Maker', description: 'Gets along with anyone and everyone.' },
  { id: 'et', name: 'ET Award', description: 'Volunteers to go home the most.' }
];

// Last day to vote, as 'YYYY-MM-DD'. Leave empty to keep voting open until you turn it off.
var VOTING_CLOSES = '';

function findAward(id) {
  for (var i = 0; i < AWARDS.length; i++) {
    if (AWARDS[i].id === id) return AWARDS[i];
  }
  return null;
}

function cleanName(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

// Lowercase with accents removed, so "José" and "jose" match.
function plain(value) {
  return cleanName(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Used to spot a second ballot from the same voter.
function nameKey(first, last) {
  return plain(first) + ' ' + plain(last);
}

// Used to count "Jane D", "jane d." and "JANE D" as the same nominee.
function nomineeKey(first, initial) {
  return plain(first) + ' ' + plain(initial).charAt(0);
}

// "jane", "d" -> "Jane D."
function nomineeLabel(first, initial) {
  var f = cleanName(first);
  return f.charAt(0).toUpperCase() + f.slice(1) + ' ' + cleanName(initial).charAt(0).toUpperCase() + '.';
}

// ['Sam K.', 'Ana P.'] -> 'Ana P. + Sam K.' (sorted, so a duo is counted the same either way round)
function pairLabel(names) {
  return names.slice().sort(function (a, b) { return a.toLowerCase().localeCompare(b.toLowerCase()); }).join(' + ');
}

// 'Jane D.' -> 'jane d', 'Sam K. + ana p' -> 'ana p + sam k'
function labelKey(label) {
  return String(label).split('+').map(function (part) {
    var m = cleanName(part).match(/^(.*\S)\s+(\S)\.?$/);
    return m ? nomineeKey(m[1], m[2]) : plain(part);
  }).sort().join(' + ');
}

// Letters, spaces, apostrophes, hyphens and periods; must start with a letter.
var NAME_PATTERN = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ' .-]{0,39}$/;
var INITIAL_PATTERN = /^[A-Za-zÀ-ÖØ-öø-ÿ]\.?$/;

function votingClosed(todayIso) {
  return !!(VOTING_CLOSES && todayIso && todayIso > VOTING_CLOSES);
}

/*
 * Checks one ballot against every rule except "one ballot per voter",
 * which needs the sheet and is checked by the backend.
 *
 * input:    { first, last, votes: { <award id>: { first, initial }, ... } }
 *           pair awards also take first2 and initial2.
 * todayIso: today's date as 'YYYY-MM-DD' (used for VOTING_CLOSES)
 * returns:  { ok: true, ballot } or { ok: false, error, award }
 *           award is the id of the award the error is about, if any.
 */
function validateBallot(input, todayIso) {
  input = input || {};
  if (votingClosed(todayIso)) return fail('Voting for the Chicky Awards has closed.');

  var first = cleanName(input.first);
  var last = cleanName(input.last);
  if (!first || !last) return fail('Enter your first and last name.');
  if (!NAME_PATTERN.test(first) || !NAME_PATTERN.test(last)) {
    return fail('Names can only use letters, spaces, hyphens, apostrophes and periods.');
  }
  var selfKey = nomineeKey(first, last);

  var votes = input.votes || {};
  var picks = [];
  for (var i = 0; i < AWARDS.length; i++) {
    var award = AWARDS[i];
    var v = votes[award.id] || {};
    var people = award.pair
      ? [{ first: v.first, initial: v.initial, which: 'the first person' }, { first: v.first2, initial: v.initial2, which: 'the second person' }]
      : [{ first: v.first, initial: v.initial, which: 'them' }];
    var names = [];
    var keys = [];

    for (var j = 0; j < people.length; j++) {
      var nf = cleanName(people[j].first);
      var ni = cleanName(people[j].initial);
      var who = award.pair ? ' for ' + people[j].which : '';
      if (!nf || !ni) {
        return fail(award.pair
          ? 'Vote for two people for ' + award.name + ': enter the first name and last initial' + who + '.'
          : 'Vote for someone for ' + award.name + ': enter their first name and last initial.', award.id);
      }
      if (!NAME_PATTERN.test(nf)) return fail('Check the first name' + who + ' for ' + award.name + '. Use letters only.', award.id);
      if (!INITIAL_PATTERN.test(ni)) return fail('For ' + award.name + ', enter just the first letter of the last name' + who + '.', award.id);
      if (nomineeKey(nf, ni) === selfKey) return fail('You can’t vote for yourself for ' + award.name + '. Pick a teammate.', award.id);
      names.push(nomineeLabel(nf, ni));
      keys.push(nomineeKey(nf, ni));
    }
    if (keys.length === 2 && keys[0] === keys[1]) return fail('Pick two different people for ' + award.name + '.', award.id);

    picks.push({ award: award.id, awardName: award.name, nominee: pairLabel(names) });
  }

  return { ok: true, ballot: { first: first, last: last, picks: picks } };

  function fail(message, awardId) { return { ok: false, error: message, award: awardId || null }; }
}

/*
 * Counts votes per award.
 * ballots: [{ picks: { <award id>: 'Jane D.' } }, ...]
 * returns: [{ award, awardName, results: [{ nominee, votes, rank }] }] with
 *          results sorted most votes first; ties share a rank.
 */
function tally(ballots) {
  return AWARDS.map(function (award) {
    var counts = {};
    var order = [];
    ballots.forEach(function (b) {
      var label = b.picks && b.picks[award.id];
      if (!label) return;
      var key = labelKey(label);
      if (!counts[key]) { counts[key] = { nominee: String(label), votes: 0 }; order.push(key); }
      counts[key].votes++;
    });
    var results = order.map(function (k) { return counts[k]; });
    results.sort(function (a, b) { return b.votes - a.votes || a.nominee.localeCompare(b.nominee); });
    results.forEach(function (r, i) {
      r.rank = i > 0 && results[i - 1].votes === r.votes ? results[i - 1].rank : i + 1;
    });
    return { award: award.id, awardName: award.name, results: results };
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AWARDS: AWARDS, findAward: findAward, nameKey: nameKey, nomineeKey: nomineeKey,
    nomineeLabel: nomineeLabel, pairLabel: pairLabel, validateBallot: validateBallot, tally: tally,
    votingClosed: votingClosed
  };
}
