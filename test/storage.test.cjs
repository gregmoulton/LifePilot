const { test } = require('node:test');
const assert = require('node:assert/strict');
const { open } = require('../storage.js');
const key = 'lifepilot-v02-profile';
function fixture() {
  const map = new Map(); let failKey;
  const storage = { getItem: k => map.get(k) ?? null, setItem(k, v) { if (k === failKey) throw Error('Quota'); map.set(k, v); }, removeItem(k) { if (k === failKey) throw Error('Denied'); map.delete(k); } };
  let queue = Promise.resolve();
  const locks = { request(name, fn) { const result = queue.then(fn); queue = result.catch(() => {}); return result; } };
  return { map, storage, locks, fail(k) { failKey = k; }, open() { return open({ storage, locks, key }); } };
}
const profile = label => ({ goals: [{ id: 'fictional', name: label }], unknown: { keep: true } });
test('legacy profile shape and unknown fields survive save and restart', async () => {
  const f = fixture(), p = profile('one'); f.map.set(key, JSON.stringify(p));
  const store = f.open(); await store.commit({ ...store.value, profile_label: 'two' });
  assert.deepEqual(f.open().value.unknown, { keep: true });
  assert.equal(f.open().value.goals[0].name, 'one');
  assert.equal(f.open().backup(), JSON.stringify(p));
});
test('unreadable JSON and invalid collections are quarantined without overwriting', async () => {
  for (const raw of ['BROKEN-FICTIONAL', '{"goals":{}}', '{"goals":[],"execution":{"tasks":{}}}', '{"goals":[null]}']) {
    const f = fixture(); f.map.set(key, raw); const store = f.open();
    assert.equal(store.blocked, true); await assert.rejects(store.commit(profile('new')));
    assert.equal(f.map.get(key), raw);
  }
});
test('inaccessible storage fails closed', async () => {
  const store = open({ key, storage: { getItem() { throw Error('Denied'); } } });
  assert.equal(store.blocked, true); await assert.rejects(store.commit(profile('new')));
});
test('missing Web Locks never falls back to an unsafe write', async () => {
  const f = fixture(); const store = open({ key, storage: f.storage });
  await assert.rejects(store.commit(profile('new')), /Web Locks/); assert.equal(f.map.size, 0);
});
test('backup failure and primary write failure retain the previous profile', async () => {
  for (const failKey of [key, key + ':last-good']) {
    const f = fixture(); const raw = JSON.stringify(profile('old')); f.map.set(key, raw);
    const store = f.open(); f.fail(failKey); await assert.rejects(store.commit(profile('new')));
    assert.equal(f.map.get(key), raw); assert.equal(store.value.goals[0].name, 'old');
  }
});
test('simultaneous stale-tab commits cannot overwrite the winning save', async () => {
  const f = fixture(), a = f.open(), b = f.open();
  const outcomes = await Promise.allSettled([a.commit(profile('a')), b.commit(profile('b'))]);
  assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1);
  assert.match(outcomes.find(r => r.status === 'rejected').reason.message, /Another tab/);
  assert.equal(f.open().value.goals[0].name, 'a');
});
test('reset keeps a recoverable backup and is subject to stale-write checks', async () => {
  const f = fixture(); const old = JSON.stringify(profile('old')); f.map.set(key, old);
  const a = f.open(), b = f.open(); await a.commit(null);
  assert.equal(f.map.has(key), false); assert.equal(a.backup(), old);
  await assert.rejects(b.commit(null), /Another tab/);
});
test('candidate is snapshotted before waiting on a lock', async () => {
  const f = fixture(), candidate = profile('before');
  const operation = f.open().commit(candidate); candidate.goals[0].name = 'after'; await operation;
  assert.equal(f.open().value.goals[0].name, 'before');
});
module.exports = { fixture, key };
