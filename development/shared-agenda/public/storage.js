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
  // BEGIN retention guards — ported verbatim from root storage.js; test/shared-import-parity checks they stay identical.
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
  // Agenda proposals still waiting on the owner (proposed, deferred, stale) may move on in a
  // newer export, but only the way agenda-model.js moves them, and may not disappear:
  //   proposed <-> deferred, proposed/deferred -> stale, applied or rejected; stale is final.
  // Everything else in the proposal (task_id, type, summary, before, created_at, ...) must stay
  // identical. Status timestamps (deferred_at, resumed_at, approved_at, applied_at) may be
  // added or updated but not dropped. A proposal that arrives settled must arrive with its
  // owner-decision audit records. Settled proposals are checked unchanged by retentionProblems.
  const PENDING_FROM = { proposed: ['proposed', 'deferred', 'stale', 'applied', 'rejected'], deferred: ['proposed', 'deferred', 'stale', 'applied', 'rejected'], stale: ['stale'] };
  const PROPOSAL_STAMPS = ['deferred_at', 'resumed_at', 'approved_at', 'applied_at'];
  const MUTABLE_PROPOSAL_KEYS = ['status', ...PROPOSAL_STAMPS];
  const stamp = value => typeof value === 'string' && value.length > 0;
  function proposalFollows(before, after) {
    if (!object(after)) return false;
    if (canonical(before) === canonical(after)) return true;
    const allowed = PENDING_FROM[before.status];
    if (!allowed || !allowed.includes(after.status)) return false;
    const fixed = record => { const rest = { ...record }; MUTABLE_PROPOSAL_KEYS.forEach(k => delete rest[k]); return canonical(rest); };
    if (fixed(before) !== fixed(after)) return false;
    if (PROPOSAL_STAMPS.some(k => (before[k] !== undefined || after[k] !== undefined) && !stamp(after[k]))) return false;
    if (after.status === 'deferred' && before.status !== 'deferred' && !stamp(after.deferred_at)) return false;
    if (after.status === 'proposed' && before.status === 'deferred' && !stamp(after.resumed_at)) return false;
    if (after.status === 'applied' && !(stamp(after.approved_at) && stamp(after.applied_at))) return false;
    return true;
  }
  // The audit trail agenda-model.js writes when a proposal is settled, deferred or resumed.
  function missingAudit(before, after, incoming, list) {
    if (after.status === before.status) return null;
    const nextAgenda = object(incoming?.agenda) ? incoming.agenda : {};
    const events = list(nextAgenda.events, 'Imported Agenda events').filter(e => object(e) && e.proposal_id === before.id);
    const event = types => events.some(e => types.includes(e.type));
    if (after.status === 'applied') {
      const decision = list(incoming?.decision_register, 'Imported decision register').some(d => object(d) && d.proposal_id === before.id && d.status === 'approved');
      if (!decision || !event(['rescheduled', 'prioritized', 'prerequisite_reviewed'])) return 'would be marked applied without its owner approval record';
    } else if (after.status === 'rejected') {
      const rejection = list(nextAgenda.rejections, 'Imported Agenda rejections').some(r => object(r) && r.task_id === before.task_id && r.action_type === before.type);
      if (!rejection || !event(['proposal_rejected'])) return 'would be marked rejected without its owner rejection record';
    } else if (after.status === 'deferred') {
      if (!event(['proposal_deferred'])) return 'would be marked deferred without its Agenda event';
    } else if (after.status === 'proposed') {
      if (!event(['proposal_resumed'])) return 'would be resumed without its Agenda event';
    }
    return null;
  }
  function pendingProposalProblems(agenda, nextAgenda, incoming, problems, list) {
    const existing = list(agenda.proposals, 'Existing Agenda proposals');
    const arriving = list(nextAgenda.proposals, 'Imported Agenda proposals');
    const idCount = records => records.reduce((map, r) => object(r) && typeof r.id === 'string' ? map.set(r.id, (map.get(r.id) || 0) + 1) : map, new Map());
    const existingIds = idCount(existing);
    for (const [id, n] of idCount(arriving)) if (n > 1 && n > (existingIds.get(id) || 0)) problems.push('Agenda proposal ' + id + ' appears more than once');
    const used = new Set();
    const take = (predicate) => { const index = arriving.findIndex((r, i) => !used.has(i) && predicate(r)); if (index >= 0) used.add(index); return index; };
    // Exact copies first, so an unchanged duplicate is never consumed by a changed one.
    const pending = existing.map((proposal, index) => ({ proposal, index })).filter(({ proposal }) => object(proposal) && !SETTLED_PROPOSALS.includes(proposal.status));
    const unmatched = pending.filter(({ proposal }) => take(r => canonical(r) === canonical(proposal)) < 0);
    unmatched.forEach(({ proposal, index }) => {
      const id = typeof proposal.id === 'string' && proposal.id ? proposal.id : null;
      const name = 'Agenda proposal ' + (id ?? '#' + (index + 1));
      if (id === null) { problems.push(name + ' would be removed'); return; }
      const at = take(r => object(r) && r.id === id && proposalFollows(proposal, r));
      if (at < 0) { problems.push(name + (arriving.some(r => object(r) && r.id === id) ? ' would be changed' : ' would be removed')); return; }
      const audit = missingAudit(proposal, arriving[at], incoming, list);
      if (audit) problems.push(name + ' ' + audit);
    });
  }
  // An ordinary import must also keep every other durable record: every Agenda event
  // (including completion events), every pending Agenda proposal, every Execution record
  // (tasks with results and history, programs, milestones, observations, experiments,
  // reviews) and every System Improvement Log entry
  // unchanged. It may add new ones. Replacing records on purpose
  // goes through Restore from a backup, which keeps the current data as a recovery copy.
  function historyProblems(current, incoming) {
    if (!object(current)) return [];
    const { problems, list, keepAll } = checker();
    const agenda = object(current.agenda) ? current.agenda : {}, nextAgenda = object(incoming?.agenda) ? incoming.agenda : {};
    keepAll(list(agenda.events, 'Existing Agenda events'), list(nextAgenda.events, 'Imported Agenda events'), 'Agenda event', false);
    pendingProposalProblems(agenda, nextAgenda, incoming, problems, list);
    const execution = object(current.execution) ? current.execution : {}, nextExecution = object(incoming?.execution) ? incoming.execution : {};
    for (const [key, name] of EXECUTION_RECORDS) {
      keepAll(list(execution[key], 'Existing ' + key), list(nextExecution[key], 'Imported ' + key), name, true);
    }
    keepAll(list(current.system_improvement_log, 'Existing improvement log'), list(incoming?.system_improvement_log, 'Imported improvement log'), 'Improvement log entry', true);
    return problems;
  }
  const EXECUTION_RECORDS = [['tasks', 'Task'], ['programs', 'Program'], ['milestones', 'Milestone'], ['observations', 'Observation'], ['experiments', 'Experiment'], ['reviews', 'Review']];
  // END retention guards
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
    // Called only after a separate, explicit recovery confirmation in the UI.
    async function restore(candidate, backupSource) {
      if (!hasLocks()) throw failure(lockReason);
      if (candidate === null) throw failure('Choose a valid profile backup.');
      const next = encode(candidate);
      return withStorageLock(() => {
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
  return { open, validProfile, retentionProblems, goalProblems, historyProblems, canonical };
});

