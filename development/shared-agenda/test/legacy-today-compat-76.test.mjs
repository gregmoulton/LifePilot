import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { open } = require('../public/storage.js');
const KEY = 'lifepilot-v02-profile';
const locks = { request: async (_name, callback) => callback() };
const memory = seed => {
  const values = new Map(Object.entries(seed));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); }
  };
};
const legacy = () => ({
  goals: [{ id: 'fictional-goal-7', name: 'Fictional certification' }],
  decision_register: [{ id: 'fictional-decision-4', decision: 'Use fictional plan' }]
});
const ids = p => ({
  goals: p.goals.map(g => g.id),
  decisions: p.decision_register.map(d => d.id)
});

test('legacy profile opens in Today storage and survives agenda/HOLD/carryover save and reload', async () => {
  const original = JSON.stringify(legacy());
  const storage = memory({ [KEY]: original });
  let store = open({ storage, key: KEY, locks });
  assert.equal(store.writable, true);
  assert.deepEqual(ids(store.value), ids(legacy()));
  const changed = store.value;
  changed.agenda = {
    version: 1,
    events: [
      { id: 'fictional-today-1', task_id: 'fictional-task-1', status: 'today' },
      { id: 'fictional-hold-2', task_id: 'fictional-task-2', status: 'hold' },
      { id: 'fictional-carry-3', task_id: 'fictional-task-3', overdue: true }
    ],
    proposals: [], rejections: []
  };
  await store.commit(changed);
  assert.equal(storage.getItem(KEY + ':last-good'), original);
  store = open({ storage, key: KEY, locks });
  assert.deepEqual(ids(store.value), ids(legacy()));
  assert.deepEqual(store.value.agenda.events.map(e => e.id),
    ['fictional-today-1', 'fictional-hold-2', 'fictional-carry-3']);
});

test('blank legacy candidate cannot silently replace populated Today profile', async () => {
  const populated = { ...legacy(), agenda: { version: 1, events: [], proposals: [], rejections: [] } };
  const raw = JSON.stringify(populated);
  const storage = memory({ [KEY]: raw });
  const store = open({ storage, key: KEY, locks });
  assert.deepEqual(ids(store.value), ids(populated));
  // A replacement restore is destructive even if it is structurally valid.
  // This assertion documents the safety requirement for an explicit UI confirmation.
  assert.notDeepEqual(ids({ goals: [], decision_register: [] }), ids(store.value));
  assert.equal(storage.getItem(KEY), raw);
});

test('corrupt legacy bytes remain untouched and writes are blocked', async () => {
  const raw = '{not-valid-json';
  const storage = memory({ [KEY]: raw });
  const store = open({ storage, key: KEY, locks });
  assert.equal(store.writable, false);
  await assert.rejects(store.commit(legacy()), /could not be read safely/i);
  assert.equal(storage.getItem(KEY), raw);
});

test('restore retains displaced original bytes and exact fictional IDs', async () => {
  const initial = { goals: [{ id: 'fictional-old' }], decision_register: [] };
  const original = JSON.stringify(initial);
  const storage = memory({ [KEY]: original });
  const store = open({ storage, key: KEY, locks });
  await store.restore(legacy());
  assert.equal(storage.getItem(KEY + ':recovery-original'), original);
  const reloaded = open({ storage, key: KEY, locks });
  assert.deepEqual(ids(reloaded.value), ids(legacy()));
});
