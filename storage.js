/* Local-only profile storage. No network requests or profile-format migration. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LifePilotStorage = api;
})(globalThis, function () {
  'use strict';
  const failure = message => Object.assign(new Error(message), { name: 'LifePilotStorageError' });
  function validProfile(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(value.goals)) return false;
    if (value.goals.some(g => !g || typeof g !== 'object' || Array.isArray(g))) return false;
    if (value.decision_register !== undefined && !Array.isArray(value.decision_register)) return false;
    if (value.system_improvement_log !== undefined && !Array.isArray(value.system_improvement_log)) return false;
    if (value.execution !== undefined) {
      if (!value.execution || typeof value.execution !== 'object' || Array.isArray(value.execution)) return false;
      for (const key of ['programs', 'milestones', 'tasks', 'observations', 'experiments', 'reviews']) {
        if (value.execution[key] !== undefined && !Array.isArray(value.execution[key])) return false;
      }
    }
    return true;
  }
  function open({ storage, key, locks }) {
    let expected, value = null, blocked = false, reason = '';
    try {
      expected = storage.getItem(key);
      if (expected !== null) {
        value = JSON.parse(expected);
        if (!validProfile(value)) throw Error('Invalid profile');
      }
    } catch (_) {
      blocked = true;
      value = null;
      reason = 'The stored profile could not be read safely. It has not been replaced. Download the stored data before recovering from a backup.';
    }
    async function commit(candidate) {
      if (blocked) throw failure(reason);
      if (!locks || typeof locks.request !== 'function') throw failure('Safe saving requires a browser with Web Locks, such as current Chrome, on HTTPS or localhost. Export your changes before closing this page.');
      const next = candidate === null ? null : JSON.stringify(candidate);
      if (candidate !== null && !validProfile(JSON.parse(next))) throw failure('The changed profile is invalid. Nothing was saved.');
      return locks.request('life-pilot-storage:' + key, async () => {
        if (storage.getItem(key) !== expected) {
          throw failure('Another tab changed this profile. Your changes were not applied. Export unsaved changes, then reload to use the latest saved profile.');
        }
        // Refuse the write if the previous good version cannot also be retained.
        if (expected !== null) storage.setItem(key + ':last-good', expected);
        if (next === null) storage.removeItem(key);
        else storage.setItem(key, next);
        if (storage.getItem(key) !== next) throw failure('Save verification failed. Download your unsaved changes and reload.');
        expected = next;
        value = next === null ? null : JSON.parse(next);
        return value;
      });
    }
    return {
      get value() { return value === null ? null : JSON.parse(JSON.stringify(value)); },
      get blocked() { return blocked; },
      get reason() { return reason; },
      commit,
      raw() { return storage.getItem(key); },
      backup() { return storage.getItem(key + ':last-good'); }
    };
  }
  return { open, validProfile };
});
