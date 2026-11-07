// #76 follow-up: an ordinary import must keep every existing goal (same ID and content).
// It may add goals. Replacing goals on purpose goes through Restore. All data is fictional.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { goalProblems, retentionProblems } = require('../storage.js');
const { harness, KEY } = require('./app-harness.cjs');

const goal = (id, name) => ({ id, name, status: 'active', known_context: [], next_actions: [] });
function populated() {
  return {
    schema_version: '0.2', product: 'Life Pilot',
    goals: [goal('fg-A', 'Fictional goal A'), goal('fg-B', 'Fictional goal B')],
    decision_register: [{ id: 'LP-001', decision: 'Fictional approved direction', status: 'approved', date: '2026-01-02' }]
  };
}
const clone = x => JSON.parse(JSON.stringify(x));

test('identical, reordered and superset goal sets keep every goal', () => {
  const current = populated();
  assert.deepEqual(goalProblems(current, clone(current)), []);
  const reordered = clone(current); reordered.goals.reverse();
  assert.deepEqual(goalProblems(current, reordered), []);
  const superset = clone(current); superset.goals.push(goal('fg-C', 'Fictional goal C'));
  assert.deepEqual(goalProblems(current, superset), []);
});

test('a re-exported goal missing app defaults still matches its stored form', () => {
  const incoming = clone(populated());
  incoming.goals = [{ id: 'fg-A', name: 'Fictional goal A' }, { id: 'fg-B', name: 'Fictional goal B', status: 'active' }];
  assert.deepEqual(goalProblems(populated(), incoming), []);
});

test('a different nonempty goal set is reported per lost goal', () => {
  const incoming = populated(); incoming.goals = [goal('fg-C', 'Fictional goal C')];
  assert.deepEqual(goalProblems(populated(), incoming), ['Goal fg-A would be removed', 'Goal fg-B would be removed']);
  const partial = populated(); partial.goals = [goal('fg-A', 'Fictional goal A')];
  assert.deepEqual(goalProblems(populated(), partial), ['Goal fg-B would be removed']);
});

test('changed goal content and duplicate goal IDs are refused', () => {
  const renamed = populated(); renamed.goals[1].name = 'Fictional renamed goal';
  assert.deepEqual(goalProblems(populated(), renamed), ['Goal fg-B would be changed']);
  const lostAction = populated(); lostAction.goals[0].next_actions = [];
  const withAction = populated(); withAction.goals[0].next_actions = ['Fictional next step'];
  assert.deepEqual(goalProblems(withAction, lostAction), ['Goal fg-A would be changed']);
  const dup = populated(); dup.goals.push({ ...dup.goals[0], name: 'Fictional twin' });
  assert.deepEqual(goalProblems(populated(), dup), ['Goal fg-A appears more than once']);
});

test('no current profile means no goal to protect; decision checks are unaffected', () => {
  assert.deepEqual(goalProblems(null, { goals: [goal('fg-C', 'C')] }), []);
  const incoming = populated(); incoming.goals = [goal('fg-C', 'Fictional goal C')];
  assert.deepEqual(retentionProblems(populated(), incoming), [], 'goal checks stay separate from the decision preview');
});

// Through the real app: index.html + storage.js + persistence.js transaction layer.
for (const [name, mutate, pattern] of [
  ['entirely different goal set [A,B] -> [C]', p => { p.goals = [goal('fg-C', 'Fictional goal C')]; }, /Goal fg-A would be removed; Goal fg-B would be removed/],
  ['partial goal set [A,B] -> [A]', p => { p.goals = [p.goals[0]]; }, /Goal fg-B would be removed/],
  ['changed goal content', p => { p.goals[0].name = 'Fictional rewritten goal'; }, /Goal fg-A would be changed/],
  ['duplicate goal IDs', p => { p.goals.push({ ...p.goals[1], name: 'Fictional twin' }); }, /Goal fg-B appears more than once/]
]) {
  test('refused goal import leaves every storage key byte-for-byte unchanged: ' + name, async () => {
    const raw = JSON.stringify(populated());
    const map = new Map([[KEY, raw], [KEY + ':last-good', '{"goals":[],"note":"fictional older backup"}']]);
    const before = new Map(map), h = harness(map);
    const incoming = populated(); mutate(incoming);
    h.context.incoming = JSON.stringify(incoming);
    await h.run('importFile({text:async()=>incoming})');
    assert.deepEqual([...map], [...before], 'no storage write before or after refusal');
    assert.equal(h.confirms.length, 0, 'refusal happens before the replace confirmation');
    assert.match(h.alerts.join(' '), pattern);
    assert.match(h.alerts.join(' '), /Nothing was changed.*Restore from a backup file/);
    assert.deepEqual(JSON.parse(h.run('JSON.stringify(profile.goals.map(g=>g.id))')), ['fg-A', 'fg-B'], 'displayed profile is unchanged');
    assert.equal(harness(map).run('JSON.stringify(profile)'), raw, 'a restart reads the same untouched profile');
  });
}

test('an import that keeps every goal and adds one saves through the transaction', async () => {
  const map = new Map([[KEY, JSON.stringify(populated())]]), h = harness(map);
  const incoming = populated(); incoming.goals.push(goal('fg-C', 'Fictional goal C'));
  h.context.incoming = JSON.stringify(incoming);
  await h.run('importFile({text:async()=>incoming})');
  assert.equal(h.confirms.length, 1);
  assert.deepEqual(JSON.parse(map.get(KEY)).goals.map(g => g.id), ['fg-A', 'fg-B', 'fg-C']);
});

test('deliberate goal replacement uses Restore and keeps the replaced profile as a recovery copy', async () => {
  const raw = JSON.stringify(populated()), map = new Map([[KEY, raw]]), h = harness(map);
  const other = populated(); other.goals = [goal('fg-C', 'Fictional goal C')];
  h.context.other = JSON.stringify(other);
  await h.run('restoreLocalBackup({text:async()=>other})');
  assert.deepEqual(JSON.parse(map.get(KEY)).goals.map(g => g.id), ['fg-C']);
  assert.equal(JSON.parse(map.get(KEY + ':recovery-history')).at(-1).bytes, raw);
});
