'use strict';
// The signed-in shared app must run the same strict import retention guards as the root app.
// Drift check (source parity) + behaviour check on a fictional populated legacy profile.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repo = path.resolve(__dirname, '..', '..', '..');
const read = rel => fs.readFileSync(path.join(repo, rel), 'utf8');
const fixture = () => JSON.parse(read('development/shared-agenda/test/fixtures/fictional-legacy-v04.json'));
const shared = require(path.join(repo, 'development/shared-agenda/public/storage.js'));

function rootGuardBlock() {
  const src = read('storage.js');
  return src.slice(src.indexOf('  // Key-order-insensitive JSON'), src.indexOf('  function open({ storage, key, locks })'));
}
function sharedGuardBlock() {
  const src = read('development/shared-agenda/public/storage.js');
  const begin = src.indexOf('  // BEGIN retention guards');
  const end = src.indexOf('  // END retention guards');
  assert.ok(begin >= 0 && end > begin, 'shared storage.js must carry the marked retention guard block');
  return src.slice(src.indexOf('\n', begin) + 1, end);
}
function importGuards(file) {
  const src = read(file);
  const start = src.indexOf("throw Error('Missing goals array');");
  const end = src.indexOf("if(profile&&!confirm('Replace the current local profile?");
  assert.ok(start >= 0 && end > start, file + ': importFile shape changed');
  return src.slice(start, end);
}

test('parity: shared storage.js retention guards are identical to root storage.js', () => {
  const root = rootGuardBlock();
  assert.ok(root.includes('function historyProblems'), 'root guard block located');
  assert.equal(sharedGuardBlock(), root);
});

test('parity: shared importFile runs the same guard sequence as root importFile', () => {
  const guards = importGuards('development/shared-agenda/app/legacy.html');
  for (const call of ['retentionProblems', 'goalProblems', 'historyProblems', 'Blank import refused', 'stable string ID', 'existing decisions would be lost']) {
    assert.ok(guards.includes(call), 'shared importFile is missing: ' + call);
  }
  assert.equal(guards, importGuards('index.html'));
});

test('parity: shared persistence keeps its extra transactional wrappers', () => {
  const src = read('development/shared-agenda/public/persistence.js');
  for (const name of ['agendaSaveEdit', 'captureSaveReview', 'importFile']) assert.ok(src.includes("'" + name + "'"), name + ' still wrapped');
});

test('shared guards: an identical or additive import of the populated fictional profile is accepted', () => {
  const current = fixture();
  assert.ok(shared.validProfile(current));
  const additive = fixture();
  additive.goals.push({ id: 'fx-goal-4', name: 'Fictional new goal', status: 'active', known_context: [], next_actions: [] });
  additive.decision_register.push({ id: 'LP-004', decision: 'Fictional new decision', status: 'proposed', date: '2026-11-12' });
  for (const incoming of [fixture(), additive]) {
    assert.deepEqual(shared.goalProblems(current, incoming), []);
    assert.deepEqual(shared.retentionProblems(current, incoming), []);
    assert.deepEqual(shared.historyProblems(current, incoming), []);
  }
});

test('shared guards: destructive imports of the populated fictional profile are refused', () => {
  const current = fixture();
  const all = incoming => [...shared.retentionProblems(current, incoming), ...shared.goalProblems(current, incoming), ...shared.historyProblems(current, incoming)];
  const cases = {
    'goal removed': d => { d.goals.pop(); },
    'goal content changed': d => { d.goals[0].name = 'Fictional overwritten'; },
    'duplicate goal ID': d => { d.goals.push({ ...d.goals[0], name: 'Fictional twin' }); },
    'decision removed': d => { d.decision_register.shift(); },
    'decision changed': d => { d.decision_register[1].status = 'approved'; },
    'task history removed': d => { d.execution.tasks = d.execution.tasks.slice(0, 2); },
    'completion result changed': d => { d.execution.tasks[3].result.actual_minutes = 1; },
    'agenda event removed': d => { d.agenda.events = []; },
    'improvement log removed': d => { delete d.system_improvement_log; },
  };
  for (const [name, mutate] of Object.entries(cases)) {
    const incoming = fixture();
    mutate(incoming);
    assert.ok(all(incoming).length > 0, name + ' must be refused');
  }
});
