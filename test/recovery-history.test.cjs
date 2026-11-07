// Bounded recovery history (PR #101 decision, Nov 6 2026). Fictional data only.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { open, MAX_RECOVERY } = require('../storage.js');
const key = 'lifepilot-v02-profile', HISTORY = key + ':recovery-history', LEGACY = key + ':recovery-original';
function fixture(map = new Map()) {
  let failKey, quotaBytes = Infinity;
  const used = () => [...map.values()].reduce((n, v) => n + v.length, 0);
  const storage = {
    getItem: k => map.get(k) ?? null,
    setItem(k, v) {
      if (k === failKey) throw Object.assign(Error('The quota has been exceeded.'), { name: 'QuotaExceededError' });
      if (used() - (map.get(k)?.length || 0) + v.length > quotaBytes) throw Object.assign(Error('The quota has been exceeded.'), { name: 'QuotaExceededError' });
      map.set(k, v);
    },
    removeItem(k) { map.delete(k); }
  };
  let queue = Promise.resolve();
  const locks = { request(name, fn) { const r = queue.then(fn); queue = r.catch(() => {}); return r; } };
  return { map, fail(k) { failKey = k; }, quota(n) { quotaBytes = n; }, open() { return open({ storage, locks, key }); } };
}
const profile = label => ({ goals: [{ id: 'fictional-' + label, name: 'Fictional ' + label }] });
const copies = f => JSON.parse(f.map.get(HISTORY) || '[]').map(e => e.bytes);
async function damageAndRecover(f, n) {
  f.map.set(key, 'DAMAGED-' + n);
  return f.open().restore(profile('restored-' + n));
}

test('repeated recoveries keep every replaced copy, oldest first, up to the limit', async () => {
  const f = fixture();
  for (let i = 1; i <= MAX_RECOVERY; i++) await damageAndRecover(f, i);
  assert.equal(MAX_RECOVERY, 5);
  assert.deepEqual(copies(f), [1, 2, 3, 4, 5].map(i => 'DAMAGED-' + i));
  assert.equal(f.map.get(LEGACY), 'DAMAGED-5', 'older builds still find the newest copy');
  assert.equal(f.open().value.goals[0].id, 'fictional-restored-5');
});

test('full history refuses recovery and changes nothing', async () => {
  const f = fixture();
  for (let i = 1; i <= MAX_RECOVERY; i++) await damageAndRecover(f, i);
  f.map.set(key, 'DAMAGED-6'); const before = new Map(f.map);
  await assert.rejects(f.open().restore(profile('six')), /Recovery history is full \(5 copies\)/);
  assert.deepEqual(f.map, before);
});

test('removing older copies needs the fingerprint of a downloaded archive and keeps the newest', async () => {
  const f = fixture();
  for (let i = 1; i <= MAX_RECOVERY; i++) await damageAndRecover(f, i);
  f.map.set(key, 'DAMAGED-6'); const store = f.open();
  await assert.rejects(store.pruneRecovery(undefined), /Download the recovery archive again/);
  await assert.rejects(store.pruneRecovery('[]'), /Download the recovery archive again/);
  assert.equal(copies(f).length, 5, 'nothing removed without a matching archive');
  const archive = store.recoveryArchive();
  const saved = JSON.parse(archive.text);
  assert.equal(saved.kind, 'recovery-archive');
  assert.deepEqual(saved.copies.map(c => c.bytes), [1, 2, 3, 4, 5].map(i => 'DAMAGED-' + i));
  assert.equal(await store.pruneRecovery(archive.fingerprint), 1);
  assert.deepEqual(copies(f), ['DAMAGED-5']);
  await store.restore(profile('six'));
  assert.deepEqual(copies(f), ['DAMAGED-5', 'DAMAGED-6']);
});

test('an archive taken before another recovery cannot be used to prune', async () => {
  const f = fixture();
  for (let i = 1; i <= 3; i++) await damageAndRecover(f, i);
  const stale = f.open().recoveryArchive().fingerprint;
  await damageAndRecover(f, 4);
  await assert.rejects(f.open().pruneRecovery(stale), /changed since the archive/);
  assert.equal(copies(f).length, 4);
});

test('storage quota error while keeping a copy changes nothing and explains next step', async () => {
  for (const mode of ['history', 'mirror', 'total']) {
    const f = fixture(); await damageAndRecover(f, 1);
    f.map.set(key, 'DAMAGED-2'); const before = new Map(f.map);
    if (mode === 'history') f.fail(HISTORY);
    else if (mode === 'mirror') f.fail(LEGACY);
    else f.quota([...f.map.values()].reduce((n, v) => n + v.length, 0) + 5);
    await assert.rejects(f.open().restore(profile('two')), /Not enough browser storage|Nothing was changed/);
    assert.deepEqual(f.map, before, mode + ': profile, backups and history unchanged');
  }
});

test('failure writing the restored profile keeps the damaged copy in history', async () => {
  const f = fixture(); f.map.set(key, 'DAMAGED-1'); f.fail(key);
  await assert.rejects(f.open().restore(profile('one')));
  assert.equal(f.map.get(key), 'DAMAGED-1');
  assert.deepEqual(copies(f), ['DAMAGED-1'], 'extra preserved copy, never a lost one');
  f.fail(undefined);
  await f.open().restore(profile('one'));
  assert.deepEqual(copies(f), ['DAMAGED-1'], 'retry does not duplicate the same copy');
});

test('unreadable recovery history blocks recovery and is never overwritten', async () => {
  const f = fixture(); f.map.set(HISTORY, '{not-a-list'); f.map.set(key, 'DAMAGED');
  const before = new Map(f.map);
  await assert.rejects(f.open().restore(profile('x')), /Recovery history could not be read/);
  assert.deepEqual(f.map, before);
  const archive = f.open().recoveryArchive();
  assert.equal(archive.fingerprint, null, 'cannot prune an unreadable history');
  assert.equal(JSON.parse(archive.text).unreadable_history, '{not-a-list', 'archive still carries the raw bytes');
});

test('history survives reopening (browser reload) and older builds\' single copy is migrated', async () => {
  const map = new Map(); map.set(LEGACY, 'FROM-OLDER-BUILD');
  const f = fixture(map); await damageAndRecover(f, 1);
  const reloaded = fixture(new Map(f.map));
  assert.deepEqual(copies(reloaded), ['FROM-OLDER-BUILD', 'DAMAGED-1']);
  assert.equal(reloaded.open().recoveryCount(), 2);
  await damageAndRecover(reloaded, 2);
  assert.deepEqual(copies(reloaded), ['FROM-OLDER-BUILD', 'DAMAGED-1', 'DAMAGED-2']);
});
