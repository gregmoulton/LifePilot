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
test('corrupt data can be explicitly restored while retaining exact original bytes', async () => {
  const f = fixture(); f.map.set(key, 'SYNTHETIC-BROKEN');
  const store = f.open(); await store.restore(profile('recovered'));
  assert.equal(store.blocked, false); assert.equal(store.recoveryOriginal(), 'SYNTHETIC-BROKEN');
  assert.equal(f.open().value.goals[0].name, 'recovered');
  await store.commit(profile('next')); assert.equal(f.open().value.goals[0].name, 'next');
});
test('restore rejects invalid data and preserves an earlier recovery copy', async () => {
  const f = fixture(); f.map.set(key, 'BROKEN'); const store = f.open();
  await assert.rejects(store.restore({ goals: [null] })); assert.equal(f.map.get(key), 'BROKEN');
  f.map.set(key + ':recovery-original', 'EARLIER-RECOVERY');
  await assert.rejects(store.restore(profile('new')), /earlier recovery/);
  assert.equal(f.map.get(key), 'BROKEN'); assert.equal(store.recoveryOriginal(), 'EARLIER-RECOVERY');
});
test('restore failure at preservation or main write keeps original and previous backup', async () => {
  for (const failKey of [key + ':recovery-original', key]) {
    const f = fixture(); f.map.set(key, 'BROKEN'); const backup = JSON.stringify(profile('good')); f.map.set(key + ':last-good', backup);
    const store = f.open(); f.fail(failKey); await assert.rejects(store.restore(profile('good'), backup));
    assert.equal(f.map.get(key), 'BROKEN'); assert.equal(store.backup(), backup); assert.equal(store.blocked, true);
  }
});
test('stale recovery and changed backup are rejected', async () => {
  const f = fixture(); f.map.set(key, 'BROKEN'); const store = f.open();
  await f.open().restore(profile('other'));
  await assert.rejects(store.restore(profile('stale')), /Another tab/);
  const current = f.open(); f.map.set(key + ':last-good', JSON.stringify(profile('changed')));
  await assert.rejects(current.restore(profile('stale'), 'old backup'), /backup changed/);
  assert.equal(f.open().value.goals[0].name, 'other');
});
test('commit and restore receipts cannot mutate the internal checkpoint', async () => {
  const f = fixture(), store = f.open(), receipt = await store.commit(profile('saved'));
  receipt.goals[0].name = 'tampered'; assert.equal(store.value.goals[0].name, 'saved');
  const restored = await store.restore(profile('restored')); restored.goals.length = 0;
  assert.equal(store.value.goals.length, 1);
});
test('invalid goal and record collection shapes fail closed instead of crashing rendering', () => {
  for (const p of [{ goals: [{ next_actions: 'bad' }] }, { goals: [], execution: { tasks: [null] } }, { goals: [], system_improvement_log: [null] }]) {
    const f = fixture(); f.map.set(key, JSON.stringify(p)); assert.equal(f.open().blocked, true);
  }
});

test('silent backup-write failure blocks the main write', async () => {
  const f = fixture(), raw = JSON.stringify(profile('old')); f.map.set(key, raw);
  const original = f.storage.setItem; f.storage.setItem = (k, v) => { if (k !== key + ':last-good') original(k, v); };
  await assert.rejects(f.open().commit(profile('new')), /verify the previous backup/);
  assert.equal(f.map.get(key), raw);
});
test('uncertain main readback blocks further writes until reload', async () => {
  const f = fixture(), store = f.open(), original = f.storage.setItem;
  f.storage.setItem = (k, v) => { if (k !== key) original(k, v); };
  await assert.rejects(store.commit(profile('new')), /outcome is uncertain/);
  assert.equal(store.blocked, true); await assert.rejects(store.commit(profile('retry')));
  assert.equal(f.map.has(key), false);
});
