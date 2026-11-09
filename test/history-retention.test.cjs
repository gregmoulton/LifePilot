// PR #101 review follow-up: an ordinary import must not erase Agenda events (including
// completion events) or Execution task records (including results and history), even when
// goals and decisions are unchanged. Replacing history on purpose goes through Restore,
// which keeps the current data as a recovery copy. All data is fictional.
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
    agenda: {
      version: 1,
      events: [
        { type: 'added', task_id: 'ft-1', at: '2026-01-03T15:00:00.000Z' },
        { type: 'completed', task_id: 'ft-1', at: '2026-01-04T16:00:00.000Z' }
      ],
      proposals: [], rejections: []
    },
    execution: {
      programs: [], milestones: [], observations: [], experiments: [], reviews: [],
      tasks: [
        { id: 'ft-1', name: 'Fictional completed task', due: '2026-01-04', status: 'completed', actual_minutes: 30, recorded_at: '2026-01-04T16:00:00.000Z', created_at: '2026-01-03T15:00:00.000Z' },
        { id: 'ft-2', name: 'Fictional planned task', due: '2026-01-10', status: 'planned', created_at: '2026-01-03T15:00:00.000Z',
          history: [{ id: 'ft-2', name: 'Fictional planned task', due: '2026-01-05', status: 'missed', actual_minutes: 0 }] }
      ]
    }
  };
}

test('identical, reordered and superset history keeps every record', () => {
  const current = populated();
  assert.deepEqual(historyProblems(current, clone(current)), []);
  const reordered = clone(current); reordered.execution.tasks.reverse(); reordered.agenda.events.reverse();
  assert.deepEqual(historyProblems(current, reordered), []);
  const superset = clone(current);
  superset.execution.tasks.push({ id: 'ft-3', name: 'Fictional new task', status: 'planned' });
  superset.agenda.events.push({ type: 'added', task_id: 'ft-3', at: '2026-01-05T15:00:00.000Z' });
  assert.deepEqual(historyProblems(current, superset), []);
  assert.deepEqual(historyProblems(null, { goals: [] }), []);
});

test('missing or emptied Agenda events and task records are reported', () => {
  const noAgenda = populated(); delete noAgenda.agenda;
  assert.deepEqual(historyProblems(populated(), noAgenda), ['Agenda event #1 would be removed', 'Agenda event #2 would be removed']);
  const noCompletion = populated(); noCompletion.agenda.events = [noCompletion.agenda.events[0]];
  assert.deepEqual(historyProblems(populated(), noCompletion), ['Agenda event #2 would be removed']);
  const noExecution = populated(); delete noExecution.execution;
  assert.deepEqual(historyProblems(populated(), noExecution), ['Task ft-1 would be removed', 'Task ft-2 would be removed']);
  const emptyTasks = populated(); emptyTasks.execution.tasks = [];
  assert.deepEqual(historyProblems(populated(), emptyTasks), ['Task ft-1 would be removed', 'Task ft-2 would be removed']);
});

test('a changed task result or dropped task history is reported', () => {
  const reverted = populated(); reverted.execution.tasks[0].status = 'planned'; delete reverted.execution.tasks[0].recorded_at;
  assert.deepEqual(historyProblems(populated(), reverted), ['Task ft-1 would be changed']);
  const noHistory = populated(); delete noHistory.execution.tasks[1].history;
  assert.deepEqual(historyProblems(populated(), noHistory), ['Task ft-2 would be changed']);
});

test('the profile in the finding passes the goal and decision checks, so only the history check stops it', () => {
  const incoming = populated(); delete incoming.agenda; delete incoming.execution;
  assert.deepEqual(goalProblems(populated(), incoming), []);
  assert.deepEqual(retentionProblems(populated(), incoming), []);
  assert.notDeepEqual(historyProblems(populated(), incoming), []);
});

// Through the real app: index.html + storage.js + persistence.js transaction layer.
for (const [name, mutate, pattern] of [
  ['missing Agenda completion events', p => { delete p.agenda; }, /Agenda event #1 would be removed; Agenda event #2 would be removed/],
  ['empty Agenda events', p => { p.agenda.events = []; }, /Agenda event #1 would be removed/],
  ['missing task records', p => { delete p.execution; }, /Task ft-1 would be removed; Task ft-2 would be removed/],
  ['completed task reverted to planned', p => { p.execution.tasks[0].status = 'planned'; }, /Task ft-1 would be changed/]
]) {
  test('refused history import leaves every storage key byte-for-byte unchanged: ' + name, async () => {
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
    assert.equal(harness(map).run('JSON.stringify(profile)'), raw, 'a restart reads the same untouched profile');
  });
}

test('an import that keeps all history and adds a task saves through the transaction', async () => {
  const map = new Map([[KEY, JSON.stringify(populated())]]), h = harness(map);
  const incoming = populated(); incoming.execution.tasks.push({ id: 'ft-3', name: 'Fictional new task', status: 'planned' });
  h.context.incoming = JSON.stringify(incoming);
  await h.run('importFile({text:async()=>incoming})');
  assert.equal(h.confirms.length, 1);
  const saved = JSON.parse(map.get(KEY));
  assert.deepEqual(saved.execution.tasks.map(t => t.id), ['ft-1', 'ft-2', 'ft-3']);
  assert.equal(saved.agenda.events.length, 2);
});

test('deliberate history replacement uses Restore and keeps the replaced profile as a recovery copy', async () => {
  const raw = JSON.stringify(populated()), map = new Map([[KEY, raw]]), h = harness(map);
  const other = populated(); delete other.agenda; delete other.execution;
  h.context.other = JSON.stringify(other);
  await h.run('restoreLocalBackup({text:async()=>other})');
  const saved = JSON.parse(map.get(KEY));
  assert.equal(saved.agenda, undefined);
  assert.equal(saved.execution, undefined);
  assert.equal(JSON.parse(map.get(KEY + ':recovery-history')).at(-1).bytes, raw);
});
