// PR #101 review (ChatGPT, Nov 9 2026): an ordinary import must not erase or change
// existing programs, milestones, observations, experiments, reviews, System Improvement
// Log entries or pending Agenda proposals. Additions are allowed. Deliberate replacement
// goes through Restore, which keeps the current data in recovery history. Fictional data only.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { historyProblems, retentionProblems, goalProblems } = require('../storage.js');
const { harness, KEY } = require('./app-harness.cjs');

const clone = x => JSON.parse(JSON.stringify(x));
function populated() {
  return {
    schema_version: '0.2', product: 'Life Pilot',
    goals: [{ id: 'fg-A', name: 'Fictional goal A', status: 'active', known_context: [], next_actions: [] }],
    decision_register: [{ id: 'LP-001', decision: 'Fictional approved direction', status: 'approved', date: '2026-01-02' }],
    system_improvement_log: [
      { id: 'fsil-1', type: 'friction', summary: 'Fictional friction note', details: 'Fictional details', goal_id: 'fg-A', created_at: '2026-01-02T10:00:00.000Z' }
    ],
    agenda: {
      version: 1,
      events: [{ type: 'added', task_id: 'ft-1', at: '2026-01-03T15:00:00.000Z' }],
      proposals: [
        { id: 'proposal-1', status: 'proposed', task_id: 'ft-1', date: '2026-01-06' },
        { id: 'proposal-2', status: 'applied', task_id: 'ft-1', date: '2026-01-04' }
      ],
      rejections: []
    },
    execution: {
      programs: [{ id: 'fp-1', goal_id: 'fg-A', name: 'Fictional program', status: 'active' }],
      milestones: [{ id: 'fm-1', program_id: 'fp-1', name: 'Fictional milestone', status: 'done', completed_at: '2026-01-05' }],
      tasks: [{ id: 'ft-1', name: 'Fictional task', status: 'completed', actual_minutes: 20 }],
      observations: [{ id: 'fo-1', goal_id: 'fg-A', note: 'Fictional observation', at: '2026-01-04T09:00:00.000Z' }],
      experiments: [{ id: 'fx-1', goal_id: 'fg-A', hypothesis: 'Fictional hypothesis', result: 'Fictional result', status: 'concluded' }],
      reviews: [{ id: 'fr-1', week: '2026-W01', wins: ['Fictional win'], notes: 'Fictional weekly review' }]
    }
  };
}
const RECORDS = [
  ['programs', 'Program', 'fp-1', p => p.execution.programs, r => { r.status = 'paused'; }],
  ['milestones', 'Milestone', 'fm-1', p => p.execution.milestones, r => { delete r.completed_at; }],
  ['observations', 'Observation', 'fo-1', p => p.execution.observations, r => { r.note = 'Edited'; }],
  ['experiments', 'Experiment', 'fx-1', p => p.execution.experiments, r => { r.result = ''; }],
  ['reviews', 'Review', 'fr-1', p => p.execution.reviews, r => { r.wins = []; }],
  ['improvement log', 'Improvement log entry', 'fsil-1', p => p.system_improvement_log, r => { r.details = 'Edited'; }]
];
const all = (current, incoming) => [...retentionProblems(current, incoming), ...goalProblems(current, incoming), ...historyProblems(current, incoming)];

test('identical, reordered and additive imports keep every record', () => {
  const current = populated();
  assert.deepEqual(all(current, clone(current)), []);
  const reordered = clone(current);
  for (const [, , , get] of RECORDS) get(reordered).reverse();
  reordered.agenda.proposals.reverse();
  assert.deepEqual(all(current, reordered), []);
  const additive = clone(current);
  additive.execution.programs.push({ id: 'fp-2', name: 'Fictional new program' });
  additive.execution.observations.push({ id: 'fo-2', note: 'Fictional new observation' });
  additive.system_improvement_log.push({ id: 'fsil-2', summary: 'Fictional new note' });
  additive.agenda.proposals.push({ id: 'proposal-3', status: 'proposed', task_id: 'ft-1' });
  assert.deepEqual(all(current, additive), []);
});

for (const [label, name, id, get, edit] of RECORDS) {
  test(label + ': removed, edited, emptied and missing collection are each reported', () => {
    const dropped = populated(); get(dropped).length = 0;
    assert.deepEqual(historyProblems(populated(), dropped), [name + ' ' + id + ' would be removed']);
    const edited = populated(); edit(get(edited)[0]);
    assert.deepEqual(historyProblems(populated(), edited), [name + ' ' + id + ' would be changed']);
    const duplicated = populated(); get(duplicated).push(clone(get(duplicated)[0]));
    assert.deepEqual(historyProblems(populated(), duplicated), [name + ' ' + id + ' appears more than once']);
  });
}

test('missing execution object or improvement log reports every record in it', () => {
  const noExecution = populated(); delete noExecution.execution;
  assert.deepEqual(historyProblems(populated(), noExecution).sort(), [
    'Experiment fx-1 would be removed', 'Milestone fm-1 would be removed', 'Observation fo-1 would be removed',
    'Program fp-1 would be removed', 'Review fr-1 would be removed', 'Task ft-1 would be removed'
  ]);
  const noLog = populated(); delete noLog.system_improvement_log;
  assert.deepEqual(historyProblems(populated(), noLog), ['Improvement log entry fsil-1 would be removed']);
});

test('pending Agenda proposals may be settled by a newer export but not dropped; settled ones stay unchanged', () => {
  // A bare status flip is not a settlement: the owner's rejection record and event must come
  // with it (genuine progressions are covered in proposal-integrity.test.cjs).
  const settledLater = populated(); settledLater.agenda.proposals[0].status = 'rejected';
  assert.deepEqual(all(populated(), settledLater), ['Agenda proposal proposal-1 would be marked rejected without its owner rejection record']);
  settledLater.agenda.rejections.push({ task_id: 'ft-1', action_type: undefined, rejected_at: '2026-01-07T10:00:00.000Z' });
  settledLater.agenda.events.push({ type: 'proposal_rejected', task_id: 'ft-1', proposal_id: 'proposal-1', at: '2026-01-07T10:00:00.000Z' });
  assert.deepEqual(all(populated(), settledLater), []);
  const droppedPending = populated(); droppedPending.agenda.proposals = droppedPending.agenda.proposals.slice(1);
  assert.deepEqual(historyProblems(populated(), droppedPending), ['Agenda proposal proposal-1 would be removed']);
  const noAgenda = populated(); delete noAgenda.agenda;
  assert.ok(historyProblems(populated(), noAgenda).includes('Agenda proposal proposal-1 would be removed'));
  // Existing settled-decision logic is unchanged.
  const unsettled = populated(); unsettled.agenda.proposals[1].status = 'proposed';
  assert.deepEqual(retentionProblems(populated(), unsettled), ['Agenda decision proposal-2 would be removed']);
});

test('records already duplicated in the current profile are not blamed on the import', () => {
  const current = populated(); current.execution.reviews.push(clone(current.execution.reviews[0]));
  assert.deepEqual(historyProblems(current, clone(current)), []);
});

// Through the real app: index.html + storage.js + persistence.js transaction layer.
for (const [label, name, id, get, edit] of [...RECORDS, ['pending proposal', 'Agenda proposal', 'proposal-1', p => p.agenda.proposals, null]]) {
  test('refused import leaves storage byte-for-byte unchanged, with no confirmation: ' + label, async () => {
    const raw = JSON.stringify(populated());
    const map = new Map([[KEY, raw], [KEY + ':last-good', '{"goals":[],"note":"fictional older backup"}']]);
    const before = new Map(map), h = harness(map);
    const incoming = populated();
    if (edit) edit(get(incoming)[0]); else get(incoming).splice(0, 1);
    h.context.incoming = JSON.stringify(incoming);
    await h.run('importFile({text:async()=>incoming})');
    assert.deepEqual([...map], [...before], 'no storage write');
    assert.equal(h.confirms.length, 0, 'refused before the replace confirmation');
    assert.match(h.alerts.join(' '), new RegExp(name + ' ' + id + ' would be (changed|removed)'));
    assert.match(h.alerts.join(' '), /Nothing was changed.*Restore from a backup file/);
    assert.equal(harness(map).run('JSON.stringify(profile)'), raw, 'a restart reads the same untouched profile');
  });
}

test('an additive import saves through the transaction and keeps every record', async () => {
  const map = new Map([[KEY, JSON.stringify(populated())]]), h = harness(map);
  const incoming = populated();
  incoming.execution.experiments.push({ id: 'fx-2', hypothesis: 'Fictional second hypothesis' });
  incoming.system_improvement_log.push({ id: 'fsil-2', summary: 'Fictional second note' });
  h.context.incoming = JSON.stringify(incoming);
  await h.run('importFile({text:async()=>incoming})');
  assert.equal(h.confirms.length, 1);
  const saved = JSON.parse(map.get(KEY));
  assert.deepEqual(saved.execution.experiments.map(r => r.id), ['fx-1', 'fx-2']);
  assert.deepEqual(saved.system_improvement_log.map(r => r.id), ['fsil-1', 'fsil-2']);
  for (const [, , id, get] of RECORDS) assert.ok(get(saved).some(r => r.id === id), id + ' kept');
});

test('deliberate replacement uses Restore and keeps the replaced profile in recovery history', async () => {
  const raw = JSON.stringify(populated()), map = new Map([[KEY, raw]]), h = harness(map);
  const other = { goals: [{ id: 'fg-Z', name: 'Fictional other goal' }] };
  h.context.other = JSON.stringify(other);
  await h.run('restoreLocalBackup({text:async()=>other})');
  const saved = JSON.parse(map.get(KEY));
  assert.equal(saved.execution, undefined);
  assert.equal(saved.system_improvement_log, undefined);
  assert.equal(JSON.parse(map.get(KEY + ':recovery-history')).at(-1).bytes, raw);
  harness(map).run('profile');
  assert.equal(JSON.parse(map.get(KEY + ':recovery-history')).at(-1).bytes, raw, 'recovery copy survives a restart');
});
