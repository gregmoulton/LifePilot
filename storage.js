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
  function validProfile(value) {
    if (!object(value) || !collection(value.goals)) return false;
    for (const goal of value.goals) for (const key of ['known_context', 'next_actions']) {
      if (goal[key] !== undefined && !Array.isArray(goal[key])) return false;
    }
    for (const key of ['decision_register', 'system_improvement_log']) {
      if (value[key] !== undefined && !collection(value[key])) return false;
    }
    if (value.agenda !== undefined && (!object(value.agenda) || value.agenda.version !== 1 || !['events', 'proposals', 'rejections'].every(key => collection(value.agenda[key])))) return false;
    if (value.execution !== undefined) {
      if (!object(value.execution)) return false;
      for (const key of ['programs', 'milestones', 'tasks', 'observations', 'experiments', 'reviews']) {
        if (value.execution[key] !== undefined && !collection(value.execution[key])) return false;
      }
    }
    return true;
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
    async function commit(candidate) {
      if (blocked) throw failure(reason);
      if (!hasLocks()) throw failure(lockReason);
      const next = encode(candidate);
      return locks.request('life-pilot-storage:' + key, () => {
        assertCurrent();
        if (expected !== null) {
          storage.setItem(key + ':last-good', expected);
          if (storage.getItem(key + ':last-good') !== expected) throw failure('Could not verify the previous backup. Nothing was applied.');
        }
        return write(next);
      });
    }
    // Called only after a separate, explicit recovery confirmation in the UI.
    async function restore(candidate, backupSource) {
      if (!hasLocks()) throw failure(lockReason);
      if (candidate === null) throw failure('Choose a valid profile backup.');
      const next = encode(candidate);
      return locks.request('life-pilot-storage:' + key, () => {
        assertCurrent();
        if (backupSource !== undefined && storage.getItem(key + ':last-good') !== backupSource) throw failure('The previous backup changed. Reload before restoring.');
        // Preserve the exact replaced bytes in a separate slot, never overwrite an
        // earlier recovery copy. Failed preservation means no profile replacement.
        if (expected !== null) {
          const prior = storage.getItem(key + ':recovery-original');
          if (prior !== null && prior !== expected) throw failure('An earlier recovery copy already exists. Download it and the current data before requesting further recovery.');
          storage.setItem(key + ':recovery-original', expected);
          if (storage.getItem(key + ':recovery-original') !== expected) throw failure('Could not preserve the original data. Nothing was restored.');
        }
        const result = write(next);
        blocked = false; reason = '';
        return result;
      });
    }
    return {
      get value() { return copy(value); },
      get blocked() { return blocked; },
      get writable() { return !blocked && !!hasLocks(); },
      get reason() { return reason || (!hasLocks() ? lockReason : ''); },
      commit, restore,
      raw() { return storage.getItem(key); },
      backup() { return storage.getItem(key + ':last-good'); },
      recoveryOriginal() { return storage.getItem(key + ':recovery-original'); }
    };
  }
  return { open, validProfile };
});
