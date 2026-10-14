// Run with: node --test
const test = require('node:test');
const assert = require('node:assert');
const { AWARDS, validateBallot, tally, nomineeLabel } = require('../rules.js');

const TODAY = '2026-12-01';
const everyone = (first, initial) => Object.fromEntries(AWARDS.map(a => [a.id, { first, initial }]));
const ballot = (votes, voter = { first: 'Jane', last: 'Doe' }) => validateBallot({ ...voter, votes }, TODAY);

test('accepts a full ballot and tidies names', () => {
  const r = ballot(everyone('  mary  ann ', 's.'));
  assert.ok(r.ok, r.error);
  assert.strictEqual(r.ballot.picks.length, AWARDS.length);
  assert.strictEqual(r.ballot.picks[0].nominee, 'Mary ann S.');
  assert.strictEqual(nomineeLabel('josé', 'r'), 'José R.');
});

test('requires a vote in every award', () => {
  const votes = everyone('Sam', 'K');
  delete votes[AWARDS[2].id];
  const r = ballot(votes);
  assert.ok(!r.ok);
  assert.strictEqual(r.award, AWARDS[2].id);
  assert.match(r.error, /Vote for someone/);

  votes[AWARDS[2].id] = { first: 'Sam', initial: '' };
  assert.strictEqual(ballot(votes).award, AWARDS[2].id);
});

test('blocks voting for yourself, ignoring case, accents and the period', () => {
  const votes = everyone('Sam', 'K');
  votes[AWARDS[1].id] = { first: 'JOSE', initial: 'm.' };
  const r = ballot(votes, { first: 'José', last: 'Martinez' });
  assert.ok(!r.ok);
  assert.strictEqual(r.award, AWARDS[1].id);
  assert.match(r.error, /yourself/);

  // Same first name, different last initial is a teammate, not you.
  votes[AWARDS[1].id] = { first: 'Jose', initial: 'R' };
  assert.ok(ballot(votes, { first: 'José', last: 'Martinez' }).ok);
});

test('rejects bad voter names, bad initials and formula tricks', () => {
  assert.ok(!ballot(everyone('Sam', 'K'), { first: ' ', last: 'Doe' }).ok);
  assert.ok(!ballot(everyone('Sam', 'K'), { first: '=HYPERLINK("x")', last: 'Doe' }).ok);
  assert.match(ballot(everyone('Sam', 'Ko')).error, /first letter/);
  assert.match(ballot(everyone('Sam', '1')).error, /first letter/);
  assert.match(ballot(everyone('=SUM(A1)', 'K')).error, /first name/);
});

test('tally merges spellings, sorts by votes and shares rank on ties', () => {
  const id = AWARDS[0].id;
  const b = (name) => ({ picks: { [id]: name } });
  const [first] = tally([b('Sam K.'), b('sam k'), b('SAM K.'), b('Ana P.'), b('Lee T.'), b('Lee T.'), b('Ana P.')]);
  assert.deepStrictEqual(first.results.map(r => [r.nominee, r.votes, r.rank]), [
    ['Sam K.', 3, 1], ['Ana P.', 2, 2], ['Lee T.', 2, 2]
  ]);
  assert.deepStrictEqual(tally([])[1].results, []);
});
