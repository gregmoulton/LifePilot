/* Commitment Contracts v1, Slice 1: engine only (issue #95). Local scorekeeping; no payments,
 * referees, notifications or network. Commands return a changed copy; the profile stays authoritative.
 *
 * profile.commitments = { version: 1, items: [], evaluations: [], exceptions: [], events: [] }
 * - item: { id, goal_id, status: draft|active|ended, created_at, approved_at, ends_from, versions: [] }
 * - version: { version, created_at, effective_from, target: { kind, count }, timezone,
 *              evidence: 'life_pilot_task_logs', reward, consequence, cap, starts_on }
 * - evaluation (append-only): { id, commitment_id, week_start, week_end, version, status,
 *              measured, target, evaluated_at, supersedes?, exception_id?, reviewed? }
 * - exception (append-only): { id, commitment_id, week_start, reason, recorded_at,
 *              self_reported: true, reviewed: false }
 * Rules: activation needs explicit approval; the first scored week starts after approval;
 * edits and ending an active commitment take effect at the first week boundary at least
 * 48 hours away, never retroactively; no command can mark a week verified by hand;
 * missing or ambiguous evidence is 'unverified', never 'missed'.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LifePilotCommitments = api;
})(globalThis, function () {
  'use strict';
  const COOLING_OFF_MS = 48 * 60 * 60 * 1000;
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const TIMEZONES = ['America/Phoenix'];
  const KINDS = ['tasks_completed', 'minutes'];
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const copy = v => JSON.parse(JSON.stringify(v));
  const fail = message => { throw Error(message); };
  const text = (value, name, max) => {
    const s = typeof value === 'string' ? value.trim() : '';
    if (!s || s.length > max) fail('Enter ' + name + ' (1 to ' + max + ' characters)');
    return s;
  };

  // Offset (ms) of a time zone at an instant, from Intl. Phoenix is fixed, but this stays correct elsewhere.
  function offsetAt(ms, timeZone) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(ms)).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
    return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - Math.floor(ms / 1000) * 1000;
  }
  // UTC instant of local midnight on a YYYY-MM-DD date in timeZone.
  function localMidnight(date, timeZone) {
    const [y, m, d] = date.split('-').map(Number);
    const guess = Date.UTC(y, m - 1, d);
    let t = guess - offsetAt(guess, timeZone);
    t = guess - offsetAt(t, timeZone);
    return t;
  }
  function localDate(ms, timeZone) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date(ms)).filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
    return p.year + '-' + p.month + '-' + p.day;
  }
  const addDays = (date, n) => new Date(Date.UTC(...date.split('-').map((v, i) => Number(v) - (i === 1 ? 1 : 0))) + n * 86400000).toISOString().slice(0, 10);
  const weekday = date => new Date(date + 'T00:00:00Z').getUTCDay(); // 0 = Sunday
  // First Monday 00:00 (local) strictly after the instant, as a YYYY-MM-DD date.
  function nextMondayAfter(ms, timeZone) {
    let date = localDate(ms, timeZone);
    do date = addDays(date, 1); while (weekday(date) !== 1);
    return date;
  }
  // First Monday 00:00 (local) at or after the instant.
  function mondayAtOrAfter(ms, timeZone) {
    const date = localDate(ms, timeZone);
    return weekday(date) === 1 && localMidnight(date, timeZone) === ms ? date : nextMondayAfter(ms, timeZone);
  }
  const validDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;

  function store(p) {
    if (p.commitments === undefined) p.commitments = { version: 1, items: [], evaluations: [], exceptions: [], events: [] };
    const c = p.commitments;
    if (!object(c) || c.version !== 1 || !['items', 'evaluations', 'exceptions', 'events'].every(k => Array.isArray(c[k]) && c[k].every(object))) fail('Unsupported commitment data; no data changed');
    const ids = new Set();
    for (const item of c.items) { if (typeof item.id !== 'string' || !item.id || ids.has(item.id)) fail('Invalid or duplicate commitment ID; no data changed'); ids.add(item.id); }
    return c;
  }
  function terms(input, goals, existing) {
    if (!object(input)) fail('Enter the commitment terms');
    const t = { ...(existing || {}), ...input };
    if (!goals.some(g => g && g.id === t.goal_id)) fail('Choose an existing goal');
    if (!object(t.target) || !KINDS.includes(t.target.kind)) fail('Choose a target: completed tasks or minutes');
    const count = t.target.count;
    if (!Number.isInteger(count) || count < 1 || count > (t.target.kind === 'minutes' ? 10080 : 1000)) fail('Enter a whole-number weekly target');
    if (!TIMEZONES.includes(t.timezone)) fail('Only America/Phoenix is supported in v1');
    if (!validDate(t.starts_on)) fail('Choose a valid start date');
    return {
      goal_id: t.goal_id, target: { kind: t.target.kind, count }, timezone: t.timezone, starts_on: t.starts_on,
      evidence: 'life_pilot_task_logs', reward: text(t.reward, 'a reward', 500),
      consequence: text(t.consequence, 'a consequence', 500), cap: text(t.cap, 'a hard limit', 200)
    };
  }
  const versionAt = (item, weekStartMs) => item.versions.filter(v => Date.parse(v.effective_from) <= weekStartMs).sort((a, b) => b.version - a.version)[0] || null;
  const latestEvaluation = (c, id, week) => c.evaluations.filter(e => e.commitment_id === id && e.week_start === week).at(-1) || null;

  // Evidence for one week, from native task logs only.
  function measure(profile, item, version, startMs, endMs) {
    const tasks = (profile.execution?.tasks || []).filter(t => object(t) && t.goal_id === item.goal_id);
    let measured = 0, ambiguous = false, touched = false;
    for (const t of tasks) {
      const done = t.status === 'completed' || t.status === 'done';
      if (typeof t.due === 'string' && t.due) {
        const due = validDate(t.due) ? localMidnight(t.due, version.timezone) + 12 * 3600000 : Date.parse(t.due);
        if (!Number.isFinite(due)) ambiguous = true;
        else if (due >= startMs && due < endMs) touched = true; // work was due this week
      }
      if (!done) continue;
      const at = Date.parse(t.recorded_at);
      if (!Number.isFinite(at)) { ambiguous = true; continue; }
      if (at < startMs || at >= endMs) continue;
      touched = true;
      if (version.target.kind === 'tasks_completed') measured += 1;
      else if (Number.isFinite(t.actual_minutes) && t.actual_minutes >= 0) measured += t.actual_minutes;
      else ambiguous = true;
    }
    if (measured >= version.target.count) return { status: 'verified', measured };
    // A miss needs positive evidence: this goal had work due or logged in the week, and nothing is unclear.
    if (!touched || ambiguous) return { status: 'unverified', measured };
    return { status: 'missed', measured };
  }

  function apply(profile, command, now = new Date()) {
    if (!object(profile)) fail('Start or import a profile first');
    const p = copy(profile), c = store(p), nowMs = new Date(now).getTime(), stamp = new Date(nowMs).toISOString();
    if (!Number.isFinite(nowMs)) fail('Invalid time');
    const item = c.items.find(x => x.id === command.commitment_id);
    const event = (type, extra = {}) => c.events.push({ type, commitment_id: command.commitment_id || null, at: stamp, ...extra });
    const pending = it => it.versions.filter(v => v.version > 1 && Date.parse(v.effective_from) > nowMs);

    if (command.type === 'create') {
      if (typeof command.commitment_id !== 'string' || !command.commitment_id || item) fail('Choose a unique commitment ID');
      const t = terms(command.terms, p.goals || []);
      c.items.push({ id: command.commitment_id, goal_id: t.goal_id, status: 'draft', created_at: stamp, approved_at: null, ends_from: null, versions: [{ version: 1, created_at: stamp, effective_from: null, ...t }] });
      event('created');
    } else if (!item) fail('Commitment not found');
    else if (command.type === 'edit-draft') {
      if (item.status !== 'draft') fail('Only a draft can be edited directly');
      const t = terms(command.terms, p.goals || [], item.versions[0]);
      if (t.goal_id !== item.goal_id) fail('The goal cannot change; create a new commitment instead');
      item.versions[0] = { ...item.versions[0], ...t, created_at: stamp };
      event('draft_edited');
    } else if (command.type === 'approve') {
      if (item.status !== 'draft') fail('Commitment is not awaiting approval');
      if (command.approved !== true) fail('Owner approval required');
      const v = item.versions[0];
      // Never backdated: the first scored week starts after approval, or later if the owner chose so.
      const first = [nextMondayAfter(nowMs, v.timezone), mondayAtOrAfter(localMidnight(v.starts_on, v.timezone), v.timezone)].sort().at(-1);
      v.effective_from = new Date(localMidnight(first, v.timezone)).toISOString();
      item.status = 'active'; item.approved_at = stamp;
      event('approved', { effective_from: v.effective_from });
    } else if (command.type === 'discard-draft') {
      if (item.status !== 'draft') fail('Only a draft can be discarded');
      item.status = 'ended'; item.ends_from = stamp;
      event('draft_discarded');
    } else if (command.type === 'propose-edit') {
      if (item.status !== 'active' || item.ends_from) fail('Only an active commitment can be revised');
      if (pending(item).length) fail('A revision is already waiting for its cooling-off period; cancel it first');
      const latest = item.versions.at(-1);
      const t = terms({ ...command.terms, starts_on: latest.starts_on, goal_id: latest.goal_id, timezone: latest.timezone }, p.goals || [], latest);
      const effective = new Date(localMidnight(mondayAtOrAfter(nowMs + COOLING_OFF_MS, latest.timezone), latest.timezone)).toISOString();
      item.versions.push({ version: latest.version + 1, created_at: stamp, effective_from: effective, ...t });
      event('revision_proposed', { version: latest.version + 1, effective_from: effective, reason: text(command.reason, 'a reason for the change', 500) });
    } else if (command.type === 'cancel-edit') {
      const waiting = pending(item);
      if (item.status !== 'active' || !waiting.length) fail('No revision is waiting');
      item.versions = item.versions.filter(v => !waiting.includes(v));
      event('revision_cancelled', { version: waiting[0].version, cancelled_terms: copy(waiting[0]) });
    } else if (command.type === 'end') {
      if (item.status !== 'active' || item.ends_from) fail('Only an active commitment can be ended');
      const v = item.versions.at(-1);
      item.ends_from = new Date(localMidnight(mondayAtOrAfter(nowMs + COOLING_OFF_MS, v.timezone), v.timezone)).toISOString();
      event('end_scheduled', { ends_from: item.ends_from, reason: text(command.reason, 'a reason for ending', 500) });
    } else if (command.type === 'excuse') {
      if (item.status !== 'active') fail('Only an active commitment can have an excused week');
      const v0 = item.versions[0], week = command.week_start;
      if (!validDate(week) || weekday(week) !== 1) fail('Choose the Monday that starts the week');
      const startMs = localMidnight(week, v0.timezone);
      if (startMs < Date.parse(v0.effective_from) || (item.ends_from && startMs >= Date.parse(item.ends_from))) fail('That week is not part of this commitment');
      if (startMs > nowMs) fail('A week can be excused once it has started');
      if (c.exceptions.some(x => x.commitment_id === item.id && x.week_start === week)) fail('That week already has an exception');
      const prior = latestEvaluation(c, item.id, week);
      if (prior && prior.status === 'verified') fail('A verified week does not need an exception');
      const exception = { id: item.id + ':exception:' + week, commitment_id: item.id, week_start: week, reason: text(command.reason, 'a reason', 500), recorded_at: stamp, self_reported: true, reviewed: false };
      c.exceptions.push(exception);
      if (prior) c.evaluations.push({ ...prior, id: item.id + ':' + week + ':' + (c.evaluations.filter(e => e.commitment_id === item.id && e.week_start === week).length + 1), status: 'excused', exception_id: exception.id, reviewed: false, supersedes: prior.id, evaluated_at: stamp });
      event('week_excused', { week_start: week, exception_id: exception.id });
    } else if (command.type === 'evaluate') {
      // Idempotent: scores each finished week once; later calls add nothing new.
      if (item.status !== 'active') fail('Only an active commitment is scored');
      const v0 = item.versions[0];
      let week = localDate(Date.parse(v0.effective_from), v0.timezone), added = 0;
      for (;;) {
        const startMs = localMidnight(week, v0.timezone), endMs = localMidnight(addDays(week, 7), v0.timezone);
        if (endMs > nowMs || (item.ends_from && startMs >= Date.parse(item.ends_from))) break;
        if (!latestEvaluation(c, item.id, week)) {
          const v = versionAt(item, startMs), exception = c.exceptions.find(x => x.commitment_id === item.id && x.week_start === week);
          const result = measure(p, item, v, startMs, endMs);
          const status = exception && result.status !== 'verified' ? 'excused' : result.status;
          c.evaluations.push({ id: item.id + ':' + week + ':1', commitment_id: item.id, week_start: week, week_end: addDays(week, 7), version: v.version, status, measured: result.measured, target: copy(v.target), evaluated_at: stamp, ...(status === 'excused' ? { exception_id: exception.id, reviewed: false } : {}) });
          added++;
        }
        week = addDays(week, 7);
      }
      if (item.ends_from && Date.parse(item.ends_from) <= nowMs) { item.status = 'ended'; event('ended', { ends_from: item.ends_from }); }
      if (added) event('evaluated', { weeks: added });
    } else fail('Unknown commitment command');
    return p;
  }

  // Read-only view for the scorecard: latest status per scored week.
  function scorecard(profile, id) {
    const c = profile?.commitments;
    if (!object(c) || !Array.isArray(c.evaluations)) return [];
    const weeks = new Map();
    for (const e of c.evaluations) if (e.commitment_id === id) weeks.set(e.week_start, e);
    return [...weeks.values()].sort((a, b) => a.week_start.localeCompare(b.week_start));
  }
  return { apply, scorecard, COOLING_OFF_MS, WEEK_MS, localMidnight, localDate };
});

// Browser entry point; wrapped in a save transaction by persistence.js. Slice 2 adds the screens.
if (typeof document !== 'undefined' && typeof module === 'undefined') {
  globalThis.commitmentAction = function (command) { profile = LifePilotCommitments.apply(profile, command); save(); render(); };
}
