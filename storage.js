/* Local-only profile storage. No network requests or profile-format migration. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LifePilotStorage = api;
})(globalThis, function () {
  'use strict';
  const failure = message => Object.assign(new Error(message), { name: 'LifePilotStorageError' });
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const collection = value => Array.isArray(value) && value.every(object);
  const copy = value => value === null ? null : JSON.parse(JSON.stringify(value));
  const MAX_RECOVERY = 5;
  function validProfile(value) {
    if (!object(value) || !collection(value.goals)) return false;
    for (const goal of value.goals) for (const key of ['known_context', 'next_actions']) {
      if (goal[key] !== undefined && !Array.isArray(goal[key])) return false;
    }
    for (const key of ['decision_register', 'system_improvement_log']) {
      if (value[key] !== undefined && !collection(value[key])) return false;
    }
    if (value.agenda !== undefined && (!object(value.agenda) || value.agenda.version !== 1 || !['events', 'proposals', 'rejections'].every(key => collection(value.agenda[key])))) return false;
    if (value.commitments !== undefined && (!object(value.commitments) || value.commitments.version !== 1 || !['items', 'evaluations', 'exceptions', 'events'].every(key => collection(value.commitments[key])))) return false;
    if (value.execution !== undefined) {
      if (!object(value.execution)) return false;
      for (const key of ['programs', 'milestones', 'tasks', 'observations', 'experiments', 'reviews']) {
        if (value.execution[key] !== undefined && !collection(value.execution[key])) return false;
      }
    }
    return true;
  }
  // Key-order-insensitive JSON, so a re-exported record compares equal to its original.
  function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (object(value)) return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
    return JSON.stringify(value === undefined ? null : value);
  }
  const SETTLED_PROPOSALS = ['applied', 'rejected'];
  // Owner decisions that an ordinary import must carry over unchanged: the decision
  // register, Agenda rejections, and Agenda proposals the owner already approved or rejected.
  // Returns a list of human-readable problems; empty means nothing would be lost.
  // Shared comparison helpers. Each checker collects human-readable problems.
  function checker() {
    const problems = [];
    const list = (value, name) => {
      if (value === undefined) return [];
      if (!Array.isArray(value)) { problems.push(name + ' is not a list'); return []; }
      return value;
    };
    const label = (record, fallback) => object(record) && typeof record.id === 'string' && record.id ? record.id : fallback;
    const counts = (records, keyOf) => records.reduce((map, record) => map.set(keyOf(record), (map.get(keyOf(record)) || 0) + 1), new Map());
    // Every existing record must appear in the incoming list with identical content.
    function keepAll(existing, arriving, name, byId) {
      const remaining = counts(arriving, canonical);
      const arrivingIds = counts(arriving.filter(r => object(r) && typeof r.id === 'string'), r => r.id);
      const existingIds = counts(existing.filter(r => object(r) && typeof r.id === 'string'), r => r.id);
      for (const [id, n] of arrivingIds) if (n > 1 && n > (existingIds.get(id) || 0)) problems.push(name + ' ' + id + ' appears more than once');
      existing.forEach((record, index) => {
        const text = canonical(record), left = remaining.get(text) || 0;
        if (left) { remaining.set(text, left - 1); return; }
        const id = label(record, null);
        if (byId && id !== null && arrivingIds.has(id)) problems.push(name + ' ' + id + ' would be changed');
        else problems.push(name + ' ' + (id ?? '#' + (index + 1)) + ' would be removed');
      });
    }
    return { problems, list, keepAll };
  }
  function retentionProblems(current, incoming) {
    if (!object(current)) return [];
    const { problems, list, keepAll } = checker();
    keepAll(list(current.decision_register, 'Existing decisions'), list(incoming?.decision_register, 'Imported decision register'), 'Decision', true);
    const agenda = object(current.agenda) ? current.agenda : {}, nextAgenda = object(incoming?.agenda) ? incoming.agenda : {};
    keepAll(list(agenda.rejections, 'Existing Agenda rejections'), list(nextAgenda.rejections, 'Imported Agenda rejections'), 'Agenda rejection', false);
    const settled = list(agenda.proposals, 'Existing Agenda proposals').filter(p => object(p) && SETTLED_PROPOSALS.includes(p.status));
    const arrivingSettled = list(nextAgenda.proposals, 'Imported Agenda proposals').filter(p => object(p) && SETTLED_PROPOSALS.includes(p.status));
    keepAll(settled, arrivingSettled, 'Agenda decision', true);
    return problems;
  }
  // The same shape the app stores after an import, so a re-exported goal compares equal.
  const normalGoal = goal => object(goal) ? { ...goal, status: goal.status || 'active', known_context: Array.isArray(goal.known_context) ? goal.known_context : [], next_actions: Array.isArray(goal.next_actions) ? goal.next_actions : [] } : goal;
  // An ordinary import must carry over every existing goal unchanged (same ID and content).
  // It may add new goals. Replacing goals on purpose goes through Restore from a backup.
  function goalProblems(current, incoming) {
    if (!object(current)) return [];
    const { problems, list, keepAll } = checker();
    const existing = list(current.goals, 'Existing goals').map(normalGoal);
    const arriving = list(incoming?.goals, 'Imported goals').map(normalGoal);
    keepAll(existing, arriving, 'Goal', true);
    return problems;
  }
  // Commitments (#95) are an audit record: an ordinary import must keep every commitment,
  // evaluation, exception and audit event unchanged. Deliberate replacement uses Restore.
  function commitmentProblems(current, incoming) {
    if (!object(current) || current.commitments === undefined) return [];
    const { problems, list, keepAll } = checker();
    const now = object(current.commitments) ? current.commitments : {}, next = object(incoming?.commitments) ? incoming.commitments : {};
    keepAll(list(now.items, 'Existing commitments'), list(next.items, 'Imported commitments'), 'Commitment', true);
    keepAll(list(now.evaluations, 'Existing commitment scores'), list(next.evaluations, 'Imported commitment scores'), 'Commitment score', true);
    keepAll(list(now.exceptions, 'Existing commitment exceptions'), list(next.exceptions, 'Imported commitment exceptions'), 'Commitment exception', true);
    keepAll(list(now.events, 'Existing commitment history'), list(next.events, 'Imported commitment history'), 'Commitment history entry', false);
    return problems;
  }
  function open({ storage, key, locks }) {
    let expected, value = null, blocked = false, reason = '';
    const lockReason = 'Safe saving requires a browser with Web Locks, such as current Chrome, on HTTPS or localhost. You can still export the displayed profile.';
    try {
      expected = storage.getItem(key);
      if (expected !== null) {
        value = JSON.parse(expected);
        if (!validProfile(value)) throw Error('Invalid profile');
      }
    } catch (_) {
      blocked = true; value = null;
      reason = 'The stored profile could not be read safely. It has not been replaced. Download the stored data, then explicitly restore a validated backup.';
    }
    const hasLocks = () => locks && typeof locks.request === 'function';
    const encode = candidate => {
      const next = candidate === null ? null : JSON.stringify(candidate);
      if (candidate !== null && !validProfile(JSON.parse(next))) throw failure('The changed profile is invalid. Nothing was saved.');
      return next;
    };
    function assertCurrent() {
      // Undefined means the initial read failed: never overwrite an unseen value.
      if (expected === undefined || storage.getItem(key) !== expected) throw failure('Another tab changed this profile or storage is unreadable. Nothing was applied. Export your changes, then reload the saved profile.');
    }
    function write(next) {
      if (next === null) storage.removeItem(key); else storage.setItem(key, next);
      let actual;
      try { actual = storage.getItem(key); } catch (_) { actual = undefined; }
      if (actual !== next) {
        blocked = true;
        reason = 'Save verification failed. The storage outcome is uncertain. Download your unsaved changes and reload before editing.';
        throw failure(reason);
      }
      expected = next; value = next === null ? null : JSON.parse(next);
      return copy(value);
    }
    // Firefox publishes localStorage snapshots at browser task boundaries.
    // A Promise/microtask boundary alone can release a Web Lock before another
    // tab sees the write. Keep the lock across a posted task before and after
    // the critical section; no arbitrary sleep or unlocked fallback.
    function storageCheckpoint() {
      if (typeof document === 'undefined' || typeof MessageChannel !== 'function') return Promise.resolve();
      return new Promise(resolve => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => {
          channel.port1.close(); channel.port2.close(); resolve();
        };
        channel.port2.postMessage(null);
      });
    }
    function withStorageLock(operation) {
      return locks.request('life-pilot-storage:' + key, async () => {
        await storageCheckpoint();
        try { return operation(); }
        finally { await storageCheckpoint(); }
      });
    }
    async function commit(candidate) {
      if (blocked) throw failure(reason);
      if (!hasLocks()) throw failure(lockReason);
      const next = encode(candidate);
      return withStorageLock(() => {
        assertCurrent();
        if (expected !== null) {
          storage.setItem(key + ':last-good', expected);
          if (storage.getItem(key + ':last-good') !== expected) throw failure('Could not verify the previous backup. Nothing was applied.');
        }
        return write(next);
      });
    }
    // Recovery history: every profile replaced by a recovery is kept, oldest first,
    // up to MAX_RECOVERY copies. Copies are never overwritten or removed silently.
    // ':recovery-original' (the earlier single slot) mirrors the newest copy so older
    // builds still find it; anything already in it is carried into the history first.
    const HISTORY = key + ':recovery-history', LEGACY = key + ':recovery-original';
    function readHistory() {
      const raw = storage.getItem(HISTORY), legacy = storage.getItem(LEGACY);
      let list = [];
      if (raw !== null) {
        try { list = JSON.parse(raw); } catch (_) { list = null; }
        if (!Array.isArray(list) || !list.every(entry => object(entry) && typeof entry.bytes === 'string')) {
          throw failure('Recovery history could not be read. It has not been changed. Download the recovery archive before continuing.');
        }
      }
      if (legacy !== null && !list.some(entry => entry.bytes === legacy)) list = [{ at: null, bytes: legacy }, ...list];
      return list;
    }
    function putVerified(itemKey, text) {
      try { storage.setItem(itemKey, text); } catch (error) {
        const quota = /quota/i.test(String(error && (error.name + ' ' + error.message)));
        throw failure(quota
          ? 'Not enough browser storage to keep another recovery copy. Download the recovery archive, then remove older copies. Nothing was changed.'
          : 'Could not preserve the original data. Nothing was changed.');
      }
      let actual; try { actual = storage.getItem(itemKey); } catch (_) { actual = undefined; }
      if (actual !== text) throw failure('Could not verify the recovery copy. Nothing was changed.');
    }
    function putBack(itemKey, previous) {
      try { if (previous === null) storage.removeItem(itemKey); else storage.setItem(itemKey, previous); } catch (_) { /* original profile is still untouched */ }
    }
    function saveHistory(list) {
      const previousHistory = storage.getItem(HISTORY), previousLegacy = storage.getItem(LEGACY);
      try {
        putVerified(HISTORY, JSON.stringify(list));
        if (list.length) putVerified(LEGACY, list[list.length - 1].bytes);
      } catch (error) {
        putBack(HISTORY, previousHistory); putBack(LEGACY, previousLegacy);
        throw error;
      }
    }
    // Called only after a separate, explicit recovery confirmation in the UI.
    async function restore(candidate, backupSource) {
      if (!hasLocks()) throw failure(lockReason);
      if (candidate === null) throw failure('Choose a valid profile backup.');
      const next = encode(candidate);
      return withStorageLock(() => {
        assertCurrent();
        if (backupSource !== undefined && storage.getItem(key + ':last-good') !== backupSource) throw failure('The previous backup changed. Reload before restoring.');
        // Preserve the exact replaced bytes before replacing anything.
        // Failed preservation means no profile replacement.
        if (expected !== null) {
          const history = readHistory();
          if (!history.some(entry => entry.bytes === expected)) {
            if (history.length >= MAX_RECOVERY) throw failure('Recovery history is full (' + MAX_RECOVERY + ' copies). Download the recovery archive, then confirm removing older copies. Nothing was restored.');
            saveHistory([...history, { at: new Date().toISOString(), bytes: expected }]);
          }
        }
        const result = write(next);
        blocked = false; reason = '';
        return result;
      });
    }
    // Removes all but the newest recovery copy. The caller must pass the history
    // fingerprint taken when the archive was downloaded; any change since then refuses.
    async function pruneRecovery(archivedFingerprint) {
      if (!hasLocks()) throw failure(lockReason);
      return withStorageLock(() => {
        const history = readHistory();
        if (typeof archivedFingerprint !== 'string' || JSON.stringify(history) !== archivedFingerprint) {
          throw failure('Recovery copies changed since the archive was downloaded. Download the recovery archive again. Nothing was removed.');
        }
        if (history.length <= 1) return history.length;
        saveHistory(history.slice(-1));
        return 1;
      });
    }
    function recoveryArchive() {
      let copies, unreadable = null;
      try { copies = readHistory(); } catch (_) { copies = []; unreadable = storage.getItem(HISTORY); }
      return {
        fingerprint: unreadable === null ? JSON.stringify(copies) : null,
        text: JSON.stringify({ product: 'Life Pilot', kind: 'recovery-archive', exported_at: new Date().toISOString(), copies, unreadable_history: unreadable }, null, 2)
      };
    }
    return {
      get value() { return copy(value); },
      get blocked() { return blocked; },
      get writable() { return !blocked && !!hasLocks(); },
      get reason() { return reason || (!hasLocks() ? lockReason : ''); },
      commit, restore, pruneRecovery, recoveryArchive,
      raw() { return storage.getItem(key); },
      backup() { return storage.getItem(key + ':last-good'); },
      recoveryOriginal() { return storage.getItem(LEGACY); },
      recoveryCount() { try { return readHistory().length; } catch (_) { return null; } }
    };
  }
  return { open, validProfile, retentionProblems, goalProblems, commitmentProblems, canonical, MAX_RECOVERY };
});

