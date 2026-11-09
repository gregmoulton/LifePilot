// PR #101 review (ChatGPT, Nov 9 2026, at 497e4de): a pending Agenda proposal (proposed,
// deferred, stale) may advance the way agenda-model.js advances it, but an ordinary import
// may not rewrite its identity or content, may not add duplicate proposal IDs, and may not
// settle it without the owner-decision audit records. Fictional data only.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const storage = require('../storage.js');
const agenda = require('../agenda-model.js');
const { harness, KEY } = require('./app-harness.cjs');

const now = new Date('2026-10-24T12:00:00Z'), later = new Date('2026-10-24T13:00:00Z');
const clone = x => JSON.parse(JSON.stringify(x));
const task = (id, extra = {}) => ({ id, name: 'Fictional ' + id, status: 'planned', due: '2026-10-24', ...extra });
// Refresh creates proposal-1 (reschedule a), proposal-2 (unblock b), proposal-3 (unblock c), all pending.
function current() {
  const base = { schema_version: '0.2', product: 'Life Pilot', goals: [{ id: 'fg-1', name: 'Fictional goal', status: 'active', known_context: [], next_actions: [] }], decision_register: [],
    execution: { tasks: [task('a', { due: '2026-10-22' }), task('b', { prerequisite_id: 'c' }), task('c', { prerequisite_id: 'b' })] } };
  return agenda.apply(base, { type: 'refresh' }, now);
}
const all = (cur, inc) => [...storage.retentionProblems(cur, inc), ...storage.goalProblems(cur, inc), ...storage.historyProblems(cur, inc)];
const proposalProblems = (cur, inc) => storage.historyProblems(cur, inc).filter(p => p.startsWith('Agenda proposal'));
const step = (p, command, at = later) => agenda.apply(p, command, at);

test('fixture: refresh produces three pending proposals with full content', () => {
  const p = current();
  assert.deepEqual(p.agenda.proposals.map(x => [x.id, x.type, x.status]), [['proposal-1', 'reschedule', 'proposed'], ['proposal-2', 'unblock', 'proposed'], ['proposal-3', 'unblock', 'proposed']]);
  for (const x of p.agenda.proposals) assert.ok(x.summary && x.before && x.created_at);
});

test('genuine progressions from a newer export are accepted with nothing lost', () => {
  const cur = current();
  const deferred = step(cur, { type: 'defer', proposal_id: 'proposal-1' });
  assert.deepEqual(all(cur, deferred), [], 'proposed -> deferred');
  const resumed = step(deferred, { type: 'resume', proposal_id: 'proposal-1' }, new Date('2026-10-24T14:00:00Z'));
  assert.deepEqual(all(cur, resumed), [], 'proposed -> deferred -> proposed');
  assert.deepEqual(all(deferred, resumed), [], 'deferred -> proposed');
  const redeferred = step(resumed, { type: 'defer', proposal_id: 'proposal-1' }, new Date('2026-10-24T15:00:00Z'));
  assert.deepEqual(all(deferred, redeferred), [], 'deferred again: updated deferred_at is legitimate');
  const rejected = step(cur, { type: 'reject', proposal_id: 'proposal-1' });
  assert.deepEqual(all(cur, rejected), [], 'proposed -> rejected');
  const applied = step(cur, { type: 'approve', proposal_id: 'proposal-2', approved: true });
  assert.deepEqual(all(cur, applied), [], 'proposed -> applied (unblock leaves the task unchanged)');
  const deferThenReject = step(step(deferred, { type: 'resume', proposal_id: 'proposal-1' }), { type: 'reject', proposal_id: 'proposal-1' });
  assert.deepEqual(all(deferred, deferThenReject), [], 'deferred -> rejected');
});

test('stale transition keeps proposal content; stale is final', () => {
  const cur = current();
  // Refresh marks a proposal stale only after its task changed; the task change itself is
  // judged separately by the task rule, so only the proposal problems are checked here.
  const changed = clone(cur); changed.execution.tasks[0].name = 'Fictional revised a';
  const stale = agenda.apply(changed, { type: 'refresh' }, later);
  assert.equal(stale.agenda.proposals[0].status, 'stale');
  assert.deepEqual(proposalProblems(cur, stale), []);
  const revived = clone(stale); revived.agenda.proposals[0].status = 'proposed';
  assert.deepEqual(proposalProblems(stale, revived), ['Agenda proposal proposal-1 would be changed']);
});

const REWRITES = [
  ['summary', x => { x.summary = 'Fictional rewritten summary'; }],
  ['task_id', x => { x.task_id = 'c'; }],
  ['type', x => { x.type = 'prioritize'; }],
  ['before snapshot', x => { x.before.due = '2026-12-01'; }],
  ['created_at', x => { x.created_at = '2026-01-01T00:00:00.000Z'; }],
  ['requires_approval', x => { x.requires_approval = false; }],
  ['extra field', x => { x.injected = 'fictional'; }],
  ['removed field', x => { delete x.before; }],
  ['unknown status', x => { x.status = 'mystery'; }],
  ['status rewrite with summary change', x => { x.status = 'deferred'; x.deferred_at = later.toISOString(); x.summary = 'Fictional other'; }]
];
for (const [label, rewrite] of REWRITES) {
  test('same proposal ID with changed content is refused: ' + label, () => {
    const cur = current(), incoming = clone(cur); rewrite(incoming.agenda.proposals[0]);
    assert.deepEqual(storage.historyProblems(cur, incoming), ['Agenda proposal proposal-1 would be changed']);
  });
}

test('status timestamps may be added or updated but not dropped or blanked', () => {
  const cur = current(), deferred = step(cur, { type: 'defer', proposal_id: 'proposal-1' });
  const dropped = clone(deferred); delete dropped.agenda.proposals[0].deferred_at; dropped.agenda.proposals[0].status = 'proposed';
  assert.deepEqual(proposalProblems(deferred, dropped), ['Agenda proposal proposal-1 would be changed']);
  const blank = clone(deferred); blank.agenda.proposals[0].deferred_at = '';
  assert.deepEqual(proposalProblems(cur, blank), ['Agenda proposal proposal-1 would be changed']);
  const noStamp = clone(cur); noStamp.agenda.proposals[0].status = 'deferred';
  noStamp.agenda.events.push({ type: 'proposal_deferred', task_id: 'a', proposal_id: 'proposal-1', at: later.toISOString() });
  assert.deepEqual(proposalProblems(cur, noStamp), ['Agenda proposal proposal-1 would be changed']);
});

test('settling or deferring requires the audit records agenda-model writes', () => {
  const cur = current();
  const rejected = step(cur, { type: 'reject', proposal_id: 'proposal-1' });
  const noRejection = clone(rejected); noRejection.agenda.rejections = [];
  assert.deepEqual(proposalProblems(cur, noRejection), ['Agenda proposal proposal-1 would be marked rejected without its owner rejection record']);
  const noRejectEvent = clone(rejected); noRejectEvent.agenda.events = noRejectEvent.agenda.events.filter(e => e.type !== 'proposal_rejected');
  assert.deepEqual(proposalProblems(cur, noRejectEvent), ['Agenda proposal proposal-1 would be marked rejected without its owner rejection record']);
  const applied = step(cur, { type: 'approve', proposal_id: 'proposal-2', approved: true });
  const noDecision = clone(applied); noDecision.decision_register = [];
  assert.deepEqual(proposalProblems(cur, noDecision), ['Agenda proposal proposal-2 would be marked applied without its owner approval record']);
  const noApplyEvent = clone(applied); noApplyEvent.agenda.events = noApplyEvent.agenda.events.filter(e => e.proposal_id !== 'proposal-2');
  assert.deepEqual(proposalProblems(cur, noApplyEvent), ['Agenda proposal proposal-2 would be marked applied without its owner approval record']);
  const bare = clone(cur); Object.assign(bare.agenda.proposals[1], { status: 'applied', approved_at: later.toISOString(), applied_at: later.toISOString() });
  assert.deepEqual(proposalProblems(cur, bare), ['Agenda proposal proposal-2 would be marked applied without its owner approval record']);
  const noStamps = clone(applied); delete noStamps.agenda.proposals[1].applied_at;
  assert.deepEqual(proposalProblems(cur, noStamps), ['Agenda proposal proposal-2 would be changed']);
  const deferred = step(cur, { type: 'defer', proposal_id: 'proposal-1' });
  const noDeferEvent = clone(deferred); noDeferEvent.agenda.events = noDeferEvent.agenda.events.filter(e => e.type !== 'proposal_deferred');
  assert.deepEqual(proposalProblems(cur, noDeferEvent), ['Agenda proposal proposal-1 would be marked deferred without its Agenda event']);
  const resumed = step(deferred, { type: 'resume', proposal_id: 'proposal-1' });
  const noResumeEvent = clone(resumed); noResumeEvent.agenda.events = noResumeEvent.agenda.events.filter(e => e.type !== 'proposal_resumed');
  assert.deepEqual(proposalProblems(deferred, noResumeEvent), ['Agenda proposal proposal-1 would be resumed without its Agenda event']);
});

test('duplicate proposal IDs in an import are refused; existing duplicates each need a match', () => {
  const cur = current();
  const dup = clone(cur); dup.agenda.proposals.push(clone(dup.agenda.proposals[0]));
  assert.deepEqual(storage.historyProblems(cur, dup), ['Agenda proposal proposal-1 appears more than once']);
  const dupChanged = clone(cur); dupChanged.agenda.proposals.push({ ...clone(dupChanged.agenda.proposals[0]), summary: 'Fictional twin' });
  assert.deepEqual(storage.historyProblems(cur, dupChanged), ['Agenda proposal proposal-1 appears more than once']);
  const dupNew = clone(cur); dupNew.agenda.proposals.push({ id: 'proposal-9', status: 'proposed', task_id: 'a' }, { id: 'proposal-9', status: 'proposed', task_id: 'b' });
  assert.deepEqual(storage.historyProblems(cur, dupNew), ['Agenda proposal proposal-9 appears more than once']);
  // A profile that already holds two records under one ID keeps both, not just one.
  const twin = clone(cur); twin.agenda.proposals.push({ ...clone(twin.agenda.proposals[0]), summary: 'Fictional existing twin' });
  assert.deepEqual(storage.historyProblems(twin, clone(twin)), []);
  const collapsed = clone(twin); collapsed.agenda.proposals.pop();
  assert.deepEqual(storage.historyProblems(twin, collapsed), ['Agenda proposal proposal-1 would be changed']);
  const vanished = clone(twin); vanished.agenda.proposals.splice(0, 1);
  assert.deepEqual(storage.historyProblems(twin, vanished), ['Agenda proposal proposal-1 would be changed']);
});

// Through the real app: index.html + storage.js + persistence.js transaction layer.
const APP_REFUSALS = [
  ['changed summary', p => { p.agenda.proposals[0].summary = 'Fictional rewritten summary'; }, /Agenda proposal proposal-1 would be changed/],
  ['changed task_id', p => { p.agenda.proposals[0].task_id = 'c'; }, /Agenda proposal proposal-1 would be changed/],
  ['changed before snapshot', p => { p.agenda.proposals[0].before.name = 'Fictional other'; }, /Agenda proposal proposal-1 would be changed/],
  ['duplicate pending ID', p => { p.agenda.proposals.push(clone(p.agenda.proposals[0])); }, /Agenda proposal proposal-1 appears more than once/],
  ['settled without decision record', p => { Object.assign(p.agenda.proposals[1], { status: 'applied', approved_at: later.toISOString(), applied_at: later.toISOString() }); }, /Agenda proposal proposal-2 would be marked applied without its owner approval record/]
];
for (const [label, edit, message] of APP_REFUSALS) {
  test('app refuses before confirmation and leaves storage byte-for-byte unchanged: ' + label, async () => {
    const raw = JSON.stringify(current());
    const map = new Map([[KEY, raw], [KEY + ':last-good', '{"goals":[],"note":"fictional older backup"}']]);
    const before = new Map(map), h = harness(map);
    const incoming = current(); edit(incoming);
    h.context.incoming = JSON.stringify(incoming);
    await h.run('importFile({text:async()=>incoming})');
    assert.deepEqual([...map], [...before], 'no storage write');
    assert.equal(h.confirms.length, 0, 'refused before the replace confirmation');
    assert.match(h.alerts.join(' '), message);
    assert.match(h.alerts.join(' '), /Nothing was changed.*Restore from a backup file/);
    assert.equal(harness(map).run('JSON.stringify(profile)'), raw, 'a restart reads the same untouched profile');
  });
}

test('app accepts a genuine deferred/resumed/settled progression and keeps its history', async () => {
  const cur = current();
  let next = step(cur, { type: 'defer', proposal_id: 'proposal-1' });
  next = step(next, { type: 'resume', proposal_id: 'proposal-1' }, new Date('2026-10-24T14:00:00Z'));
  next = step(next, { type: 'reject', proposal_id: 'proposal-1' }, new Date('2026-10-24T15:00:00Z'));
  next = step(next, { type: 'approve', proposal_id: 'proposal-2', approved: true }, new Date('2026-10-24T16:00:00Z'));
  next = step(next, { type: 'defer', proposal_id: 'proposal-3' }, new Date('2026-10-24T17:00:00Z'));
  const map = new Map([[KEY, JSON.stringify(cur)]]), h = harness(map);
  h.context.incoming = JSON.stringify(next);
  await h.run('importFile({text:async()=>incoming})');
  assert.deepEqual(h.alerts, []);
  assert.equal(h.confirms.length, 1);
  const saved = JSON.parse(map.get(KEY));
  assert.deepEqual(saved.agenda.proposals.map(x => x.status), ['rejected', 'applied', 'deferred']);
  assert.deepEqual(saved.agenda.events.map(e => e.type), ['refreshed', 'proposal_deferred', 'proposal_resumed', 'proposal_rejected', 'prerequisite_reviewed', 'proposal_deferred']);
  assert.equal(saved.agenda.rejections.length, 1);
  assert.equal(saved.decision_register[0].proposal_id, 'proposal-2');
  for (const [i, x] of saved.agenda.proposals.entries()) assert.deepEqual(x.before, cur.agenda.proposals[i].before, 'proposal content kept');
  assert.equal(harness(map).run('profile.agenda.proposals.length'), 3, 'survives a restart');
});

test('deliberate replacement of proposals uses Restore and keeps a recovery copy', async () => {
  const raw = JSON.stringify(current()), map = new Map([[KEY, raw]]), h = harness(map);
  const other = current(); other.agenda.proposals[0].summary = 'Fictional replacement summary';
  h.context.other = JSON.stringify(other);
  await h.run('restoreLocalBackup({text:async()=>other})');
  assert.equal(JSON.parse(map.get(KEY)).agenda.proposals[0].summary, 'Fictional replacement summary');
  assert.equal(JSON.parse(map.get(KEY + ':recovery-history')).at(-1).bytes, raw);
  harness(map).run('profile');
  assert.equal(JSON.parse(map.get(KEY + ':recovery-history')).at(-1).bytes, raw, 'recovery copy survives a restart');
});
