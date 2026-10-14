/*
 * Chicky Awards ballot rules. This one file is shared by the web page (index.html)
 * and the Google Apps Script backend (paste it into Apps Script as Rules.gs),
 * so the awards and rules only ever need to be changed here.
 *
 * To change the awards: edit AWARDS below, then re-paste into Apps Script and
 * deploy a new version (see README). Keep each id the same once voting starts.
 */

var AWARDS = [
  { id: 'my-pleasure', name: 'My Pleasure Award', description: 'Always goes the second mile for our guests.' },
  { id: 'team-player', name: 'Team Player', description: 'First to jump in and help wherever they are needed.' },
  { id: 'positive-attitude', name: 'Most Positive Attitude', description: 'Brings the good vibes every single shift.' },
  { id: 'hardest-worker', name: 'Hardest Worker', description: 'Never stops moving, never cuts corners.' },
  { id: 'rookie', name: 'Rookie of the Year', description: 'Newer team member who has already made a big impact.' },
  { id: 'funniest', name: 'Funniest Team Member', description: 'Keeps everyone laughing, even during the rush.' }
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
    var nf = cleanName(v.first);
    var ni = cleanName(v.initial);

    if (!nf || !ni) return fail('Vote for someone for ' + award.name + ': enter their first name and last initial.', award.id);
    if (!NAME_PATTERN.test(nf)) return fail('Check the first name for ' + award.name + '. Use letters only.', award.id);
    if (!INITIAL_PATTERN.test(ni)) return fail('For ' + award.name + ', enter just the first letter of their last name.', award.id);
    if (nomineeKey(nf, ni) === selfKey) return fail('You can’t vote for yourself for ' + award.name + '. Pick a teammate.', award.id);

    picks.push({ award: award.id, awardName: award.name, nominee: nomineeLabel(nf, ni), key: nomineeKey(nf, ni) });
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
      var m = String(label).match(/^(.*\S)\s+(\S)\.?$/);
      var key = m ? nomineeKey(m[1], m[2]) : plain(label);
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
    nomineeLabel: nomineeLabel, validateBallot: validateBallot, tally: tally,
    votingClosed: votingClosed
  };
}
