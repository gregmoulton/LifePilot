// Owner decisions survive ordinary imports by identity and content, not just by count.
// All data is fictional.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { retentionProblems } = require('../storage.js');
const root = path.resolve(__dirname, '..');
const KEY = 'lifepilot-v02-profile';

function harness(map) {
  const elements = new Map(), alerts = [], confirms = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: '', style: {}, dataset: {}, hidden: false, innerHTML: '', textContent: '', insertAdjacentHTML() {}, append() {}, setAttribute() {}, scrollIntoView() {}, click() {}, classList: { toggle() {} } });
    return elements.get(id);
  };
  let queue = Promise.resolve(), confirmAnswer = true;
  const locks = { request(name, fn) { const result = queue.then(fn); queue = result.catch(() => {}); return result; } };
  const context = vm.createContext({ console, Blob, navigator: { locks }, localStorage: {
    getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k)
  }, document: { getElementById: element, createElement: () => element('anchor'), querySelector: () => element('nav'), querySelectorAll: () => [] },
  URL: { createObjectURL() { return 'blob:synthetic'; }, revokeObjectURL() {} },
  confirm: message => { confirms.push(message); return confirmAnswer; }, prompt: () => null, alert: s => alerts.push(s), setTimeout() {} });
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const script of html.matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g)) {
    vm.runInContext(script[1] ? fs.readFileSync(path.join(root, script[1]), 'utf8') : script[2], context);
  }
  return { map, alerts, confirms, element, answer(v) { confirmAnswer = v; }, run: s => vm.runInContext(s, context), context };
}

function populated() {
  return {
    schema_version: '0.2', product: 'Life Pilot',
    goals: [{ id: 'fg-1', name: 'Fictional goal', status: 'active' }],
    decision_register: [
      { id: 'LP-001', decision: 'Fictional approved direction', status: 'approved', date: '2026-01-02' },
      { id: 'LP-002', decision: 'Fictional rejected direction', status: 'rejected', date: '2026-01-03' }
    ],
    agenda: { version: 1, events: [],
      proposals: [
        { id: 'proposal-1', task_id: 'ft-1', type: 'reschedule', status: 'rejected', before: { id: 'ft-1' } },
        { id: 'proposal-2', task_id: 'ft-1', type: 'prioritize', status: 'applied', before: { id: 'ft-1' } },
        { id: 'proposal-3', task_id: 'ft-1', type: 'prioritize', status: 'proposed', before: { id: 'ft-1' } }
      ],
      rejections: [{ task_id: 'ft-1', action_type: 'reschedule', rejected_at: '2026-01-04T00:00:00.000Z' }] },
    execution: { tasks: [{ id: 'ft-1', name: 'Fictional task', status: 'planned', due: '' }] }
  };
}
const clone = x => JSON.parse(JSON.stringify(x));

test('identical or superset imports keep every decision', () => {
  const current = populated();
  assert.deepEqual(retentionProblems(current, clone(current)), []);
  const superset = clone(current);
  superset.decision_register.push({ id: 'LP-003', decision: 'Fictional new decision', status: 'proposed' });
  superset.agenda.rejections.push({ task_id: 'ft-9', action_type: 'prioritize', rejected_at: '2026-02-01T00:00:00.000Z' });
  assert.deepEqual(retentionProblems(current, superset), []);
});

test('key order and register order do not matter', () => {
  const current = populated(), reordered = clone(current);
  reordered.decision_register = reordered.decision_register.reverse().map(d => Object.fromEntries(Object.entries(d).reverse()));
  assert.deepEqual(retentionProblems(current, reordered), []);
});

test('replacing a nonempty register with unrelated decisions is reported per lost ID', () => {
  const incoming = clone(populated());
  incoming.decision_register = [{ id: 'LP-900', decision: 'Unrelated fictional decision', status: 'approved' }];
  assert.deepEqual(retentionProblems(populated(), incoming), ['Decision LP-001 would be removed', 'Decision LP-002 would be removed']);
});

test('a modified status or wording is a change, not a match', () => {
  const statusFlip = clone(populated());
  statusFlip.decision_register[1].status = 'approved';
  assert.deepEqual(retentionProblems(populated(), statusFlip), ['Decision LP-002 would be changed']);
  const reworded = clone(populated());
  reworded.decision_register[0].decision += ' (edited)';
  assert.deepEqual(retentionProblems(populated(), reworded), ['Decision LP-001 would be changed']);
});

test('duplicate decision IDs in an import are refused', () => {
  const incoming = clone(populated());
  incoming.decision_register.push({ id: 'LP-001', decision: 'Conflicting fictional copy', status: 'rejected' });
  assert.deepEqual(retentionProblems(populated(), incoming), ['Decision LP-001 appears more than once']);
});

test('decisions without IDs are matched by content', () => {
  const current = { goals: [], decision_register: [{ decision: 'Fictional unnamed decision', status: 'approved' }] };
  assert.deepEqual(retentionProblems(current, clone(current)), []);
  assert.deepEqual(retentionProblems(current, { goals: [], decision_register: [{ decision: 'Other', status: 'approved' }] }), ['Decision #1 would be removed']);
});

test('Agenda rejections and settled Agenda proposals are preserved; open proposals may change', () => {
  const lostRejection = clone(populated()); lostRejection.agenda.rejections = [];
  assert.deepEqual(retentionProblems(populated(), lostRejection), ['Agenda rejection #1 would be removed']);
  const noAgenda = clone(populated()); delete noAgenda.agenda;
  assert.deepEqual(retentionProblems(populated(), noAgenda), ['Agenda rejection #1 would be removed', 'Agenda decision proposal-1 would be removed', 'Agenda decision proposal-2 would be removed']);
  const flipped = clone(populated()); flipped.agenda.proposals[1].type = 'reschedule';
  assert.deepEqual(retentionProblems(populated(), flipped), ['Agenda decision proposal-2 would be changed']);
  const openChanged = clone(populated()); openChanged.agenda.proposals = openChanged.agenda.proposals.slice(0, 2);
  assert.deepEqual(retentionProblems(populated(), openChanged), []);
});

test('no current profile means nothing to protect', () => {
  assert.deepEqual(retentionProblems(null, { goals: [] }), []);
});

// Through the real app: index.html + storage.js + persistence.js transaction layer.
for (const [name, mutate] of [
  ['unrelated replacement register', p => { p.decision_register = [{ id: 'LP-900', decision: 'Unrelated', status: 'approved' }]; }],
  ['modified decision status', p => { p.decision_register[0].status = 'rejected'; }],
  ['duplicate decision IDs', p => { p.decision_register.push({ ...p.decision_register[0], status: 'rejected' }); }],
  ['dropped Agenda rejection', p => { p.agenda.rejections = []; }],
  ['dropped settled Agenda proposal', p => { p.agenda.proposals = p.agenda.proposals.filter(x => x.id !== 'proposal-2'); }]
]) {
  test('refused import leaves every storage key byte-for-byte unchanged: ' + name, async () => {
    const raw = JSON.stringify(populated());
    const map = new Map([[KEY, raw], [KEY + ':last-good', '{"goals":[],"note":"fictional older backup"}']]);
    const before = new Map(map), h = harness(map);
    const incoming = populated(); incoming.goals.push({ id: 'fg-2', name: 'Fictional new goal' }); mutate(incoming);
    h.context.incoming = JSON.stringify(incoming);
    await h.run('importFile({text:async()=>incoming})');
    assert.deepEqual([...map], [...before]);
    assert.equal(h.confirms.length, 0, 'refusal happens before the replace confirmation');
    assert.match(h.alerts.join(' '), /Import refused: .*(would be (removed|changed)|appears more than once)/);
    assert.equal(h.run('profile.goals.length'), 1, 'displayed profile is unchanged');
    // A restart reads the same untouched profile.
    assert.equal(harness(map).run('JSON.stringify(profile)'), raw);
  });
}

test('an import that keeps every decision and adds one saves through the transaction', async () => {
  const map = new Map([[KEY, JSON.stringify(populated())]]), h = harness(map);
  const incoming = populated(); incoming.decision_register.push({ id: 'LP-003', decision: 'Fictional added decision', status: 'proposed' });
  h.context.incoming = JSON.stringify(incoming);
  await h.run('importFile({text:async()=>incoming})');
  assert.equal(h.confirms.length, 1);
  assert.deepEqual(JSON.parse(map.get(KEY)).decision_register.map(d => d.id), ['LP-001', 'LP-002', 'LP-003']);
});

test('deliberate replacement uses Restore: it previews lost decisions and keeps a recovery copy', async () => {
  const raw = JSON.stringify(populated()), map = new Map([[KEY, raw]]), h = harness(map);
  const older = { goals: [{ id: 'fg-1', name: 'Fictional goal' }], decision_register: [{ id: 'LP-001', decision: 'Fictional approved direction', status: 'approved', date: '2026-01-02' }] };
  h.context.older = JSON.stringify(older);
  h.answer(false);
  await h.run('restoreLocalBackup({text:async()=>older})');
  assert.equal(map.get(KEY), raw, 'declining the preview changes nothing');
  assert.match(h.confirms[0], /would remove or change 4 recorded decisions/);
  assert.match(h.confirms[0], /Decision LP-002 would be removed/);
  assert.match(h.confirms[0], /Agenda rejection #1 would be removed/);
  h.answer(true);
  await h.run('restoreLocalBackup({text:async()=>older})');
  assert.deepEqual(JSON.parse(map.get(KEY)), older);
  const history = JSON.parse(map.get(KEY + ':recovery-history'));
  assert.equal(history.at(-1).bytes, raw, 'replaced profile is kept byte-for-byte as a recovery copy');
});

test('Profile tab offers the separate replace-from-backup control', async () => {
  const h = harness(new Map([[KEY, JSON.stringify(populated())]]));
  h.run("showTab('profile')");
  assert.match(h.element('app').innerHTML, /id="replaceBackupFile"[^>]*restoreLocalBackup\(this\.files\[0\]\)/);
});
