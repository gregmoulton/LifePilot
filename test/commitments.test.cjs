// Commitment Contracts v1, Slice 1 engine (#95). Fictional data only.
// Phoenix is UTC-7 all year, so local midnight is 07:00Z. Wed 2027-03-03; Mondays 03-08, 03-15, 03-22, 03-29.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { apply, scorecard, COOLING_OFF_MS } = require('../commitments.js');
const { commitmentProblems, validProfile } = require('../storage.js');
const { harness, KEY } = require('./app-harness.cjs');

const at = s => new Date(s);
const WED = at('2027-03-03T19:00:00Z'); // Wed noon Phoenix
const terms = (extra = {}) => ({ goal_id: 'fg-1', target: { kind: 'tasks_completed', count: 2 }, timezone: 'America/Phoenix', starts_on: '2027-03-03', reward: 'Fictional: a film night', consequence: 'Fictional: no dessert Sunday', cap: 'Fictional: one dessert skipped per week', ...extra });
const base = () => ({ schema_version: '0.2', product: 'Life Pilot', goals: [{ id: 'fg-1', name: 'Fictional goal', status: 'active', known_context: [], next_actions: [] }], decision_register: [], execution: { programs: [], milestones: [], tasks: [], observations: [], experiments: [], reviews: [] } });
const task = (id, extra) => ({ id, name: 'Fictional ' + id, goal_id: 'fg-1', status: 'planned', ...extra });
const done = (id, recorded_at, minutes = 30) => task(id, { status: 'completed', recorded_at, actual_minutes: minutes });
function active(extra) {
  let p = apply(base(), { type: 'create', commitment_id: 'c1', terms: terms(extra) }, WED);
  return apply(p, { type: 'approve', commitment_id: 'c1', approved: true }, WED);
}
const statusOf = (p, week) => scorecard(p, 'c1').find(e => e.week_start === week)?.status;

test('create makes a draft; nothing is scored before approval', () => {
  const p = apply(base(), { type: 'create', commitment_id: 'c1', terms: terms() }, WED);
  assert.equal(p.commitments.items[0].status, 'draft');
  assert.equal(p.commitments.items[0].versions[0].effective_from, null);
  assert.throws(() => apply(p, { type: 'evaluate', commitment_id: 'c1' }, at('2027-04-01T00:00:00Z')), /Only an approved commitment/);
  assert.ok(validProfile(p));
});

test('create validates terms and never changes the input profile', () => {
  const p = base(), before = JSON.stringify(p);
  for (const bad of [{ goal_id: 'nope' }, { target: { kind: 'money', count: 1 } }, { target: { kind: 'tasks_completed', count: 0 } }, { target: { kind: 'tasks_completed', count: 1.5 } }, { timezone: 'Europe/Paris' }, { starts_on: '2027-02-30' }, { reward: '  ' }, { consequence: '' }, { cap: 'x'.repeat(201) }]) {
    assert.throws(() => apply(p, { type: 'create', commitment_id: 'c1', terms: terms(bad) }, WED));
  }
  assert.equal(JSON.stringify(p), before);
  const one = apply(p, { type: 'create', commitment_id: 'c1', terms: terms() }, WED);
  assert.throws(() => apply(one, { type: 'create', commitment_id: 'c1', terms: terms() }, WED), /unique/);
});

test('approval needs explicit consent and the first scored week starts after approval (no backdating)', () => {
  const p = apply(base(), { type: 'create', commitment_id: 'c1', terms: terms({ starts_on: '2027-01-01' }) }, WED);
  assert.throws(() => apply(p, { type: 'approve', commitment_id: 'c1' }, WED), /Owner approval required/);
  const a = apply(p, { type: 'approve', commitment_id: 'c1', approved: true }, WED);
  assert.equal(a.commitments.items[0].status, 'active');
  assert.equal(a.commitments.items[0].versions[0].effective_from, '2027-03-08T07:00:00.000Z');
  // A later chosen start is respected.
  const later = apply(apply(base(), { type: 'create', commitment_id: 'c1', terms: terms({ starts_on: '2027-03-20' }) }, WED), { type: 'approve', commitment_id: 'c1', approved: true }, WED);
  assert.equal(later.commitments.items[0].versions[0].effective_from, '2027-03-22T07:00:00.000Z');
  // Approving at Monday 00:00 still waits for the next full week.
  const monday = apply(apply(base(), { type: 'create', commitment_id: 'c1', terms: terms() }, WED), { type: 'approve', commitment_id: 'c1', approved: true }, at('2027-03-08T07:00:00Z'));
  assert.equal(monday.commitments.items[0].versions[0].effective_from, '2027-03-15T07:00:00.000Z');
});

test('weekly scoring: met = verified, unmet with work due = missed, no evidence = unverified', () => {
  let p = active();
  p.execution.tasks.push(done('t1', '2027-03-09T16:00:00Z'), done('t2', '2027-03-12T16:00:00Z')); // week of 03-08: 2 done
  p.execution.tasks.push(task('t3', { due: '2027-03-17' }), done('t4', '2027-03-18T16:00:00Z')); // week of 03-15: 1 of 2, work was due
  // week of 03-22: nothing due, nothing logged
  p = apply(p, { type: 'evaluate', commitment_id: 'c1' }, at('2027-03-29T08:00:00Z'));
  assert.equal(statusOf(p, '2027-03-08'), 'verified');
  assert.equal(statusOf(p, '2027-03-15'), 'missed');
  assert.equal(statusOf(p, '2027-03-22'), 'unverified');
  assert.equal(scorecard(p, 'c1').length, 3);
  assert.equal(scorecard(p, 'c1')[1].measured, 1);
});

test('week boundaries use Phoenix local time', () => {
  let p = active();
  // Sunday 23:30 Phoenix = Monday 06:30Z: belongs to the week of 03-08, not 03-15.
  p.execution.tasks.push(done('t1', '2027-03-15T06:30:00Z'), done('t2', '2027-03-15T06:59:59Z'));
  p = apply(p, { type: 'evaluate', commitment_id: 'c1' }, at('2027-03-15T07:00:00Z'));
  assert.equal(statusOf(p, '2027-03-08'), 'verified');
  assert.equal(scorecard(p, 'c1').length, 1, 'a week is scored only once it has ended');
});

test('ambiguous evidence is unverified, never missed', () => {
  let p = active();
  p.execution.tasks.push(task('t1', { due: '2027-03-10' }), task('t2', { status: 'completed', actual_minutes: 30 })); // no recorded_at
  p = apply(p, { type: 'evaluate', commitment_id: 'c1' }, at('2027-03-16T00:00:00Z'));
  assert.equal(statusOf(p, '2027-03-08'), 'unverified');
  let m = active({ target: { kind: 'minutes', count: 60 } });
  m.execution.tasks.push(task('t1', { due: '2027-03-10' }), task('t2', { status: 'completed', recorded_at: '2027-03-10T16:00:00Z' })); // minutes missing
  m = apply(m, { type: 'evaluate', commitment_id: 'c1' }, at('2027-03-16T00:00:00Z'));
  assert.equal(statusOf(m, '2027-03-08'), 'unverified');
});

test('minutes targets add actual minutes; other goals do not count', () => {
  let p = active({ target: { kind: 'minutes', count: 60 } });
  p.execution.tasks.push(done('t1', '2027-03-09T16:00:00Z', 40), done('t2', '2027-03-10T16:00:00Z', 25), { ...done('t3', '2027-03-10T16:00:00Z', 500), goal_id: 'other' });
  p = apply(p, { type: 'evaluate', commitment_id: 'c1' }, at('2027-03-16T00:00:00Z'));
  assert.equal(statusOf(p, '2027-03-08'), 'verified');
  assert.equal(scorecard(p, 'c1')[0].measured, 65);
});

test('evaluation is idempotent; later native evidence appends a superseding entry, never a rewrite', () => {
  let p = active();
  p = apply(p, { type: 'evaluate', commitment_id: 'c1' }, at('2027-03-23T00:00:00Z'));
  const once = JSON.stringify(p.commitments.evaluations);
  p = apply(p, { type: 'evaluate', commitment_id: 'c1' }, at('2027-03-23T00:00:00Z'));
  assert.equal(JSON.stringify(p.commitments.evaluations), once, 'no new evidence: nothing added');
  p.execution.tasks.push(done('late', '2027-03-10T16:00:00Z'), done('late2', '2027-03-11T16:00:00Z'));
  p = apply(p, { type: 'evaluate', commitment_id: 'c1' }, at('2027-03-23T00:00:00Z'));
  assert.ok(p.commitments.evaluations.slice(0, 2).every((e, i) => JSON.stringify(e) === JSON.stringify(JSON.parse(once)[i])), 'original entries untouched');
  const w8 = p.commitments.evaluations.filter(e => e.week_start === '2027-03-08');
  assert.deepEqual(w8.map(e => e.status), ['unverified', 'verified']);
  assert.equal(w8[1].supersedes, w8[0].id); assert.equal(w8[1].reason, 'later_native_evidence');
  const after = JSON.stringify(p.commitments.evaluations);
  p = apply(p, { type: 'evaluate', commitment_id: 'c1' }, at('2027-03-24T00:00:00Z'));
  assert.equal(JSON.stringify(p.commitments.evaluations), after, 'reconciliation is idempotent too');
  assert.deepEqual(p.commitments.events.map(e => e.type).filter(t => t !== 'created' && t !== 'approved'), ['evaluated', 'reconciled']);
});

test('no command can mark a week verified by hand', () => {
  const p = active();
  assert.throws(() => apply(p, { type: 'verify', commitment_id: 'c1', week_start: '2027-03-08' }, WED), /Unknown commitment command/);
  assert.throws(() => apply(p, { type: 'edit-draft', commitment_id: 'c1', terms: terms() }, WED), /Only a draft/);
});

test('revisions to an active commitment wait 48 hours and start at a week boundary', () => {
  let p = active();
  // Sat 2027-03-13 12:00 Phoenix: +48h = Mon 03-15 12:00, so the revision starts Mon 03-22.
  p = apply(p, { type: 'propose-edit', commitment_id: 'c1', terms: { target: { kind: 'tasks_completed', count: 1 } }, reason: 'Fictional: too ambitious' }, at('2027-03-13T19:00:00Z'));
  const v2 = p.commitments.items[0].versions[1];
  assert.equal(v2.effective_from, '2027-03-22T07:00:00.000Z');
  assert.ok(Date.parse(v2.effective_from) - Date.parse('2027-03-13T19:00:00Z') >= COOLING_OFF_MS);
  assert.throws(() => apply(p, { type: 'propose-edit', commitment_id: 'c1', terms: {}, reason: 'again' }, at('2027-03-14T00:00:00Z')), /already waiting/);
  assert.throws(() => apply(p, { type: 'propose-edit', commitment_id: 'c1', terms: { goal_id: 'other' }, reason: 'x' }, at('2027-03-14T00:00:00Z')));
  p.execution.tasks.push(done('a', '2027-03-16T16:00:00Z'), task('b', { due: '2027-03-17' }), done('c', '2027-03-23T16:00:00Z'), task('d', { due: '2027-03-24' }));
  p = apply(p, { type: 'evaluate', commitment_id: 'c1' }, at('2027-03-30T00:00:00Z'));
  const [w8, w15, w22] = scorecard(p, 'c1');
  assert.equal(w15.version, 1); assert.equal(w15.status, 'missed'); // old target (2) still applied
  assert.equal(w22.version, 2); assert.equal(w22.status, 'verified'); // new target (1)
  assert.equal(w8.status, 'unverified');
  assert.equal(p.commitments.items[0].goal_id, 'fg-1');
});

test('a waiting revision can be cancelled before it takes effect, and the cancellation is logged', () => {
  let p = active();
  p = apply(p, { type: 'propose-edit', commitment_id: 'c1', terms: { reward: 'Fictional: other reward' }, reason: 'Fictional' }, at('2027-03-13T19:00:00Z'));
  p = apply(p, { type: 'cancel-edit', commitment_id: 'c1' }, at('2027-03-14T19:00:00Z'));
  assert.equal(p.commitments.items[0].versions.length, 1);
  const ev = p.commitments.events.find(e => e.type === 'revision_cancelled');
  assert.equal(ev.cancelled_terms.reward, 'Fictional: other reward');
  assert.throws(() => apply(p, { type: 'cancel-edit', commitment_id: 'c1' }, at('2027-03-14T19:00:00Z')), /No revision/);
});

test('ending an active commitment also waits 48 hours; weeks before the end are still scored', () => {
  let p = active();
  p = apply(p, { type: 'end', commitment_id: 'c1', reason: 'Fictional: goal abandoned' }, at('2027-03-13T19:00:00Z'));
  assert.equal(p.commitments.items[0].ends_from, '2027-03-22T07:00:00.000Z');
  assert.equal(p.commitments.items[0].status, 'active');
  p = apply(p, { type: 'evaluate', commitment_id: 'c1' }, at('2027-04-06T00:00:00Z'));
  assert.deepEqual(scorecard(p, 'c1').map(e => e.week_start), ['2027-03-08', '2027-03-15']);
  assert.equal(p.commitments.items[0].status, 'ended');
  const done1 = JSON.stringify(p.commitments);
  p = apply(p, { type: 'evaluate', commitment_id: 'c1' }, at('2027-04-06T00:00:00Z'));
  assert.equal(JSON.stringify(p.commitments), done1, 'scoring an ended commitment again adds nothing');
});

test('self-reported excused weeks are labeled unreviewed, before or after scoring', () => {
  let p = active();
  p.execution.tasks.push(task('t1', { due: '2027-03-10' }), task('t2', { due: '2027-03-17' }));
  // Excused before scoring.
  p = apply(p, { type: 'excuse', commitment_id: 'c1', week_start: '2027-03-08', reason: 'Fictional: flu' }, at('2027-03-10T19:00:00Z'));
  p = apply(p, { type: 'evaluate', commitment_id: 'c1' }, at('2027-03-23T00:00:00Z'));
  const w8 = scorecard(p, 'c1')[0];
  assert.equal(w8.status, 'excused'); assert.equal(w8.reviewed, false);
  assert.equal(statusOf(p, '2027-03-15'), 'missed');
  // Excused after scoring: the miss stays in the record and a new entry supersedes it.
  p = apply(p, { type: 'excuse', commitment_id: 'c1', week_start: '2027-03-15', reason: 'Fictional: travel' }, at('2027-03-23T01:00:00Z'));
  const all15 = p.commitments.evaluations.filter(e => e.week_start === '2027-03-15');
  assert.deepEqual(all15.map(e => e.status), ['missed', 'excused']);
  assert.equal(all15[1].supersedes, all15[0].id);
  const ex = p.commitments.exceptions;
  assert.ok(ex.every(x => x.self_reported === true && x.reviewed === false));
  assert.throws(() => apply(p, { type: 'excuse', commitment_id: 'c1', week_start: '2027-03-15', reason: 'again' }, at('2027-03-23T02:00:00Z')), /already has an exception/);
  assert.throws(() => apply(p, { type: 'excuse', commitment_id: 'c1', week_start: '2027-03-29', reason: 'future' }, at('2027-03-23T02:00:00Z')), /once it has started/);
  assert.throws(() => apply(p, { type: 'excuse', commitment_id: 'c1', week_start: '2027-03-01', reason: 'before start' }, at('2027-03-23T02:00:00Z')), /not part/);
  assert.throws(() => apply(p, { type: 'excuse', commitment_id: 'c1', week_start: '2027-03-16', reason: 'not monday' }, at('2027-03-23T02:00:00Z')), /Monday/);
});

test('a verified week cannot be excused', () => {
  let p = active();
  p.execution.tasks.push(done('t1', '2027-03-09T16:00:00Z'), done('t2', '2027-03-10T16:00:00Z'));
  p = apply(p, { type: 'evaluate', commitment_id: 'c1' }, at('2027-03-16T00:00:00Z'));
  assert.throws(() => apply(p, { type: 'excuse', commitment_id: 'c1', week_start: '2027-03-08', reason: 'x' }, at('2027-03-16T01:00:00Z')), /verified week/);
});

test('every command is in the audit history', () => {
  let p = active();
  p = apply(p, { type: 'propose-edit', commitment_id: 'c1', terms: {}, reason: 'Fictional' }, at('2027-03-13T19:00:00Z'));
  p = apply(p, { type: 'cancel-edit', commitment_id: 'c1' }, at('2027-03-13T20:00:00Z'));
  p = apply(p, { type: 'end', commitment_id: 'c1', reason: 'Fictional' }, at('2027-03-13T21:00:00Z'));
  assert.deepEqual(p.commitments.events.map(e => e.type), ['created', 'approved', 'revision_proposed', 'revision_cancelled', 'end_scheduled']);
});

test('unsupported commitment data is refused without changes', () => {
  const p = base(); p.commitments = { version: 2, items: [] };
  assert.throws(() => apply(p, { type: 'create', commitment_id: 'c1', terms: terms() }, WED), /Unsupported/);
  assert.equal(validProfile(p), false);
});

// Retention (import/restore protection).
test('an ordinary import must keep every commitment record unchanged', () => {
  let current = active();
  current = apply(current, { type: 'evaluate', commitment_id: 'c1' }, at('2027-03-16T00:00:00Z'));
  const clone = x => JSON.parse(JSON.stringify(x));
  assert.deepEqual(commitmentProblems(current, clone(current)), []);
  assert.deepEqual(commitmentProblems(base(), current), [], 'adding commitments is fine');
  const dropped = clone(current); delete dropped.commitments;
  assert.ok(commitmentProblems(current, dropped).some(s => /Commitment c1 would be removed/.test(s)));
  const changed = clone(current); changed.commitments.evaluations[0].status = 'verified';
  assert.ok(commitmentProblems(current, changed).some(s => /Commitment score .* would be changed/.test(s)));
  const history = clone(current); history.commitments.events.pop();
  assert.ok(commitmentProblems(current, history).some(s => /Commitment history entry/.test(s)));
});

test('in the app: commitmentAction saves through the transaction; an import that drops commitments is refused before any write', async () => {
  const map = new Map([[KEY, JSON.stringify(base())]]);
  const h = harness(map);
  await h.run(`commitmentAction({ type: 'create', commitment_id: 'c1', terms: ${JSON.stringify(terms())} })`);
  await h.run(`commitmentAction({ type: 'approve', commitment_id: 'c1', approved: true })`);
  const saved = JSON.parse(map.get(KEY));
  assert.equal(saved.commitments.items[0].status, 'active');
  assert.equal(JSON.parse(map.get(KEY + ':last-good')).commitments.items[0].status, 'draft');
  // A failing command leaves storage unchanged.
  const before = map.get(KEY);
  await h.run(`commitmentAction({ type: 'approve', commitment_id: 'c1', approved: true })`);
  assert.equal(map.get(KEY), before);
  // Ordinary import without commitments: refused, nothing written, no confirm shown.
  const incoming = { ...base(), goals: saved.goals };
  h.context.__file = { text: async () => JSON.stringify(incoming) };
  await h.run('importFile(__file)');
  assert.equal(map.get(KEY), before);
  assert.equal(h.confirms.length, 0);
  assert.match(h.alerts.at(-1), /Commitment c1 would be removed/);
});

// --- Review fixes (ChatGPT, PR #103 comment 6729689628): history edits, late evidence, final scoring.

test('a week where work was only logged (nothing planned) is unverified, not missed', () => {
  let p = active();
  p.execution.tasks.push(done('t1', '2027-03-09T16:00:00Z'));
  p = apply(p, { type: 'evaluate', commitment_id: 'c1' }, at('2027-03-16T00:00:00Z'));
  assert.equal(statusOf(p, '2027-03-08'), 'unverified');
});

test('doubtful logs make a short week unverified: task on HOLD, unknown status, duplicate IDs', () => {
  for (const extra of [[task('t1', { due: '2027-03-10', agenda_hold: true })], [task('t1', { due: '2027-03-10', status: 'someday' })], [task('t1', { due: '2027-03-10' }), task('t1', { due: '2027-03-11' })]]) {
    let p = active();
    p.execution.tasks.push(...extra);
    p = apply(p, { type: 'evaluate', commitment_id: 'c1' }, at('2027-03-16T00:00:00Z'));
    assert.equal(statusOf(p, '2027-03-08'), 'unverified', JSON.stringify(extra));
    assert.ok(scorecard(p, 'c1')[0].doubts.length > 0);
  }
});

test('evidence snapshotted in a score survives later edits to the task record', () => {
  let p = active();
  p.execution.tasks.push(done('t1', '2027-03-09T16:00:00Z'), done('t2', '2027-03-10T16:00:00Z'));
  p = apply(p, { type: 'evaluate', commitment_id: 'c1' }, at('2027-03-16T00:00:00Z'));
  assert.equal(statusOf(p, '2027-03-08'), 'verified');
  assert.deepEqual(scorecard(p, 'c1')[0].evidence.map(e => e.task_id), ['t1', 't2']);
  // The records are later reset and the timestamps deleted: the score and its evidence stand.
  for (const t of p.execution.tasks) { t.status = 'planned'; delete t.recorded_at; t.actual_minutes = 0; }
  const before = JSON.stringify(p.commitments.evaluations);
  p = apply(p, { type: 'evaluate', commitment_id: 'c1' }, at('2027-03-17T00:00:00Z'));
  assert.equal(JSON.stringify(p.commitments.evaluations), before);
});

test('completion evidence is recovered from task history snapshots and Agenda completed events', () => {
  let p = active();
  // t1: reset by a review; the pre-reset snapshot (completed) is in its history.
  p.execution.tasks.push(task('t1', { due: '2027-03-30', history: [{ ...done('t1', '2027-03-09T16:00:00Z'), due: '2027-03-09' }] }));
  // t2: completed through the Agenda; the record later lost its timestamp, the event did not.
  p.execution.tasks.push(task('t2', { status: 'planned' }));
  p.agenda = { version: 1, events: [{ type: 'completed', task_id: 't2', at: '2027-03-11T16:00:00.000Z', actual_minutes: 15 }], proposals: [], rejections: [] };
  p = apply(p, { type: 'evaluate', commitment_id: 'c1' }, at('2027-03-16T00:00:00Z'));
  const w = scorecard(p, 'c1')[0];
  assert.equal(w.status, 'verified');
  assert.deepEqual(w.evidence.map(e => [e.task_id, e.sources[0]]), [['t1', 'task_history'], ['t2', 'agenda_event']]);
});

test('the same completion seen in several places counts once', () => {
  let p = active();
  const t1 = done('t1', '2027-03-09T16:00:00.000Z');
  p.execution.tasks.push(t1);
  p.agenda = { version: 1, events: [{ type: 'completed', task_id: 't1', at: '2027-03-09T16:00:00.000Z', actual_minutes: 30 }], proposals: [], rejections: [] };
  p = apply(p, { type: 'evaluate', commitment_id: 'c1' }, at('2027-03-16T00:00:00Z'));
  const w = scorecard(p, 'c1')[0];
  assert.equal(w.measured, 1);
  assert.deepEqual(w.evidence[0].sources, ['task', 'agenda_event']);
});

test('late evidence: completion time and entry time are kept apart, and a correction is audited', () => {
  let p = active();
  p.execution.tasks.push(task('t1', { due: '2027-03-10' }), done('t2', '2027-03-10T16:00:00Z'));
  p = apply(p, { type: 'evaluate', commitment_id: 'c1' }, at('2027-03-16T00:00:00Z'));
  assert.equal(statusOf(p, '2027-03-08'), 'missed');
  // Native proof entered after the week was scored, for a completion inside that week.
  Object.assign(p.execution.tasks[0], { status: 'completed', completed_at: '2027-03-12T16:00:00Z', recorded_at: '2027-03-17T16:00:00Z', actual_minutes: 30 });
  p = apply(p, { type: 'evaluate', commitment_id: 'c1' }, at('2027-03-18T00:00:00Z'));
  const all = p.commitments.evaluations.filter(e => e.week_start === '2027-03-08');
  assert.deepEqual(all.map(e => e.status), ['missed', 'verified']);
  assert.equal(all[1].late_evidence, true);
  const late = all[1].evidence.find(e => e.task_id === 't1');
  assert.deepEqual([late.completed_at, late.entered_at, late.late], ['2027-03-12T16:00:00.000Z', '2027-03-17T16:00:00.000Z', true]);
  assert.ok(p.commitments.events.some(e => e.type === 'reconciled'));
});

test('a schedule review through the real app keeps the week unverified, not missed, and loses no history', async () => {
  const profile = base();
  profile.execution.programs.push({ id: 'pg', goal_id: 'fg-1', name: 'Fictional program' });
  profile.execution.milestones.push({ id: 'ms', goal_id: 'fg-1', program_id: 'pg', name: 'Fictional milestone', target: 'x' });
  profile.execution.tasks.push(...['t1', 't2'].map(id => ({ id, goal_id: 'fg-1', program_id: 'pg', milestone_id: 'ms', name: 'Fictional ' + id, due: '2027-03-10T09:00', planned_minutes: 30, prerequisite_id: null, status: 'planned' })));
  let p = active(); p.execution = profile.execution;
  const map = new Map([[KEY, JSON.stringify(p)]]), h = harness(map);
  await h.run("completeTask('t1','missed',0)"); await h.run("completeTask('t2','missed',0)");
  const review = await h.run("proposeReview('fg-1','Fictional: busy week','schedule')");
  await h.run(`approveAdjustment(${JSON.stringify(review.id)},'2027-03-16','2027-03-23','2027-03-30T09:00')`);
  const saved = JSON.parse(map.get(KEY));
  assert.ok(saved.execution.tasks.every(t => t.status === 'planned' && t.recorded_at === undefined && t.history.length === 1), 'the real review path resets the records');
  const scored = apply(saved, { type: 'evaluate', commitment_id: 'c1' }, at('2027-03-16T00:00:00Z'));
  const w = scorecard(scored, 'c1')[0];
  assert.equal(w.status, 'unverified');
  assert.ok(w.doubts.some(d => /reset or rescheduled/.test(d.reason)));
});

test('final reconciliation still runs after the commitment has ended', () => {
  let p = active();
  p = apply(p, { type: 'end', commitment_id: 'c1', reason: 'Fictional' }, at('2027-03-13T19:00:00Z'));
  p.execution.tasks.push(task('t1', { due: '2027-03-17' }), task('t2', { due: '2027-03-18' }));
  p = apply(p, { type: 'evaluate', commitment_id: 'c1' }, at('2027-03-30T00:00:00Z'));
  assert.equal(p.commitments.items[0].status, 'ended');
  assert.deepEqual(scorecard(p, 'c1').map(e => [e.week_start, e.status]), [['2027-03-08', 'unverified'], ['2027-03-15', 'missed']]);
  Object.assign(p.execution.tasks[0], { status: 'completed', completed_at: '2027-03-17T16:00:00Z', recorded_at: '2027-03-31T16:00:00Z' });
  Object.assign(p.execution.tasks[1], { status: 'completed', completed_at: '2027-03-18T16:00:00Z', recorded_at: '2027-03-31T16:00:00Z' });
  p = apply(p, { type: 'evaluate', commitment_id: 'c1' }, at('2027-04-01T00:00:00Z'));
  assert.equal(statusOf(p, '2027-03-15'), 'verified');
  assert.equal(p.commitments.evaluations.length, 3);
  // A week of an ended commitment can still be excused; a discarded draft can never be scored.
  const d = apply(apply(base(), { type: 'create', commitment_id: 'c1', terms: terms() }, WED), { type: 'discard-draft', commitment_id: 'c1' }, WED);
  assert.equal(d.commitments.items[0].status, 'discarded');
  assert.throws(() => apply(d, { type: 'evaluate', commitment_id: 'c1' }, at('2027-04-01T00:00:00Z')), /Only an approved/);
});

test('reconciliation adds new evidence to what is already on record, even if the record was later erased', () => {
  let p = active();
  p.execution.tasks.push(done('t1', '2027-03-09T16:00:00Z'));
  p = apply(p, { type: 'evaluate', commitment_id: 'c1' }, at('2027-03-16T00:00:00Z'));
  assert.equal(scorecard(p, 'c1')[0].measured, 1);
  Object.assign(p.execution.tasks[0], { status: 'planned' }); delete p.execution.tasks[0].recorded_at; // evidence erased
  p.execution.tasks.push(task('t2', { status: 'completed', completed_at: '2027-03-11T16:00:00Z', recorded_at: '2027-03-17T16:00:00Z', actual_minutes: 10 }));
  p = apply(p, { type: 'evaluate', commitment_id: 'c1' }, at('2027-03-18T00:00:00Z'));
  const w = scorecard(p, 'c1')[0];
  assert.equal(w.status, 'verified');
  assert.deepEqual(w.evidence.map(e => e.task_id).sort(), ['t1', 't2']);
});
