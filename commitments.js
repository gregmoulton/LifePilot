/* Commitment Contracts v1, Slice 1: engine only (issue #95). Local scorekeeping; no payments,
 * referees, notifications or network. Commands return a changed copy; the profile stays authoritative.
 *
 * profile.commitments = { version: 1, items: [], evaluations: [], exceptions: [], events: [] }
 * - item: { id, goal_id, status: draft|active|ended|discarded, created_at, approved_at, ends_from, versions: [] }
 * - version: { version, created_at, effective_from, target: { kind, count }, timezone,
 *              evidence: 'life_pilot_task_logs', reward, consequence, cap, starts_on }
 * - evaluation (append-only): { id, commitment_id, week_start, week_end, version, status,
 *              measured, target, evaluated_at, evidence: [snapshot], doubts: [], supersedes?,
 *              reason?, late_evidence?, exception_id?, reviewed? }
 * - exception (append-only): { id, commitment_id, week_start, reason, recorded_at,
 *              self_reported: true, reviewed: false }
 * Rules: activation needs explicit approval; the first scored week starts after approval;
 * edits and ending an active commitment take effect at the first week boundary at least
 * 48 hours away, never retroactively; no command can mark a week verified by hand;
 * missing, ambiguous or doubtful evidence is 'unverified', never 'missed'. Evaluations are
 * append-only; later native evidence can only add a superseding entry.
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
    for (const item of c.items) {
      if (typeof item.id !== 'string' || !item.id || ids.has(item.id)) fail('Invalid or duplicate commitment ID; no data changed');
      if (!Array.isArray(item.versions) || !item.versions.length || !item.versions.every(object)) fail('Commitment ' + item.id + ' has no terms; no data changed');
      ids.add(item.id);
    }
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

  // Native completion evidence for a goal. Task records are mutable (a schedule review can
  // reset a task and delete recorded_at), so evidence is gathered from every native trace:
  // the current record, the task's own history snapshots, and Agenda 'completed' events.
  // An Agenda event's goal comes from its own pre-completion snapshot (`before.goal_id`), so it
  // still counts if the task record is later removed or relinked. Each item keeps the completion
  // time and the time it was entered, separately.
  const DONE = ['completed', 'done'];
  function evidenceFor(profile, goalId) {
    const all = (profile.execution?.tasks || []).filter(object);
    const tasks = all.filter(t => t.goal_id === goalId);
    const items = new Map(), undated = [];
    const add = (taskId, rec, source) => {
      const status = rec.status;
      if (!DONE.includes(status) && status !== 'partial') return;
      const entered = Date.parse(rec.recorded_at ?? rec.at);
      const completed = rec.completed_at !== undefined ? Date.parse(rec.completed_at) : entered;
      if (!Number.isFinite(entered) || !Number.isFinite(completed)) { undated.push({ task_id: taskId, source }); return; }
      const minutes = Number.isFinite(rec.actual_minutes) && rec.actual_minutes >= 0 ? rec.actual_minutes : null;
      const key = taskId + '@' + completed;
      const prev = items.get(key);
      if (prev) { if (prev.minutes === null && minutes !== null) prev.minutes = minutes; prev.sources.push(source); return; }
      items.set(key, { key, task_id: taskId, status: DONE.includes(status) ? 'completed' : 'partial', completed_at: new Date(completed).toISOString(), entered_at: new Date(entered).toISOString(), minutes, sources: [source] });
    };
    for (const t of tasks) {
      add(t.id, t, 'task');
      for (const h of snapshots(t)) add(t.id, h, 'task_history');
    }
    for (const e of profile.agenda?.events || []) {
      if (!object(e) || e.type !== 'completed') continue;
      const t = all.find(x => x.id === e.task_id);
      const goal = object(e.before) && e.before.goal_id !== undefined ? e.before.goal_id : t?.goal_id;
      if (goal !== goalId) continue;
      const minutes = Number.isFinite(e.actual_minutes) ? e.actual_minutes : (t && t.recorded_at === e.at ? t.actual_minutes : undefined);
      add(e.task_id, { status: 'completed', recorded_at: e.at, actual_minutes: minutes }, 'agenda_event');
    }
    return { tasks, items: [...items.values()], undated };
  }
  // Doubts that make a task's own completions unreliable (as opposed to doubts that only make a miss unreliable).
  const EVIDENCE_DOUBTS = ['duplicate task ID', 'actual minutes missing'];
  const doubtfulIds = doubts => new Set(doubts.filter(d => d.task_id !== null && EVIDENCE_DOUBTS.includes(d.reason)).map(d => d.task_id));
  const total = (evidence, target) => target.kind === 'tasks_completed' ? evidence.filter(e => e.status === 'completed').length : evidence.reduce((sum, e) => sum + (e.minutes || 0), 0);
  const snapshots = t => Array.isArray(t.history) ? t.history.filter(h => object(h) && h.type === undefined) : [];
  const OPEN = ['planned', 'active', 'today', undefined];
  const dueMs = (due, tz) => validDate(due) ? localMidnight(due, tz) + 12 * 3600000 : Date.parse(due);
  // Score one week. Verified = the target is met by native Life Pilot logs (not an independent
  // referee). Missed needs a reliable record: work for the goal was planned (due) in the week,
  // and nothing about THIS week's records is doubtful. Otherwise the week is unverified.
  // A doubtful record affects only the weeks it can be placed in (a readable due date or
  // completion time). A problem that cannot be placed in any week is listed under `notes` on
  // every score instead; it never turns other, well-documented weeks unverified.
  function measure(profile, item, version, startMs, endMs) {
    const { tasks, items, undated } = evidenceFor(profile, item.goal_id);
    const tz = version.timezone, inWeek = ms => ms >= startMs && ms < endMs;
    const evidence = items.filter(e => inWeek(Date.parse(e.completed_at)) && (version.target.kind === 'minutes' || e.status === 'completed'));
    const doubts = [], notes = [];
    // Where a task can be placed in time: its readable due dates and dated completions.
    const anchors = id => {
      const dues = tasks.filter(t => t.id === id).flatMap(t => [t.due, ...snapshots(t).map(h => h.due)]).filter(d => typeof d === 'string' && d).map(d => dueMs(d, tz)).filter(Number.isFinite);
      return [...dues, ...items.filter(e => e.task_id === id).map(e => Date.parse(e.completed_at))];
    };
    const place = (id, reason) => {
      const where = anchors(id);
      if (where.some(inWeek)) doubts.push({ task_id: id, reason });
      else if (!where.length) notes.push({ task_id: id, reason: reason + ' (timing unknown; not used to score any week)' });
    };
    let planned = false, measured = 0;
    for (const e of evidence) {
      if (version.target.kind === 'tasks_completed') measured += 1;
      else if (e.minutes === null) doubts.push({ task_id: e.task_id, reason: 'actual minutes missing' });
      else measured += e.minutes;
    }
    for (const u of undated) place(u.task_id, 'completion time missing or unreadable');
    const counts = tasks.reduce((m, t) => m.set(t.id, (m.get(t.id) || 0) + 1), new Map());
    for (const [id, n] of counts) if (n > 1) place(id, 'duplicate task ID');
    for (const t of tasks) {
      const dues = [t.due, ...snapshots(t).map(h => h.due)].filter(d => typeof d === 'string' && d);
      if (dues.some(d => !Number.isFinite(dueMs(d, tz)))) place(t.id, 'due date unreadable');
      if (!dues.some(d => inWeek(dueMs(d, tz)))) continue;
      planned = true;
      if (t.agenda_hold || ['hold', 'HOLD', 'waiting', 'on_hold'].includes(t.status)) doubts.push({ task_id: t.id, reason: 'task on hold' });
      else if (![...OPEN, ...DONE, 'missed', 'partial'].includes(t.status)) doubts.push({ task_id: t.id, reason: 'task status not recognised' });
      if (snapshots(t).length) doubts.push({ task_id: t.id, reason: 'task was reset or rescheduled after review' });
    }
    const unique = list => [...new Map(list.map(d => [d.task_id + '|' + d.reason, d])).values()];
    const snapshot = evidence.map(e => ({ task_id: e.task_id, status: e.status, completed_at: e.completed_at, entered_at: e.entered_at, minutes: e.minutes, late: Date.parse(e.entered_at) >= endMs, sources: e.sources }));
    const weekDoubts = unique(doubts);
    // Verified needs the target met by reliable evidence alone: completions of a task whose
    // identity or record is doubtful this week (duplicate ID, missing minutes) are kept in the
    // snapshot, marked doubtful, but not counted.
    const shaky = doubtfulIds(weekDoubts);
    for (const e of snapshot) if (shaky.has(e.task_id)) e.doubtful = true;
    const counted = total(snapshot.filter(e => !e.doubtful), version.target);
    const status = counted >= version.target.count ? 'verified'
      : measured >= version.target.count ? 'unverified' // met only with doubtful records
      : planned && !weekDoubts.length ? 'missed' : 'unverified';
    if (status === 'unverified' && measured >= version.target.count) notes.push({ task_id: null, reason: 'target reached only by counting doubtful records' });
    return { status, measured: counted, evidence: snapshot, doubts: weekDoubts, notes: unique(notes) };
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
      item.status = 'discarded'; item.ends_from = stamp;
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
      if (!['active', 'ended'].includes(item.status)) fail('Only an approved commitment can have an excused week');
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
      // Scores each finished in-scope week once, then reconciles: if later native evidence
      // shows a scored week met its target, a superseding entry is appended (never a rewrite).
      // Evidence already snapshotted in an earlier entry is kept, so edits cannot erase it.
      // Runs after the commitment has ended too, so its final weeks are scored and reconciled.
      if (!['active', 'ended'].includes(item.status)) fail('Only an approved commitment is scored');
      const v0 = item.versions[0];
      let week = localDate(Date.parse(v0.effective_from), v0.timezone), added = 0, reconciled = 0;
      for (;;) {
        const startMs = localMidnight(week, v0.timezone), endMs = localMidnight(addDays(week, 7), v0.timezone);
        if (endMs > nowMs || (item.ends_from && startMs >= Date.parse(item.ends_from))) break;
        const v = versionAt(item, startMs), exception = c.exceptions.find(x => x.commitment_id === item.id && x.week_start === week);
        const result = measure(p, item, v, startMs, endMs), prior = latestEvaluation(c, item.id, week);
        const n = c.evaluations.filter(e => e.commitment_id === item.id && e.week_start === week).length + 1;
        const entry = extra => ({ id: item.id + ':' + week + ':' + n, commitment_id: item.id, week_start: week, week_end: addDays(week, 7), version: v.version, target: copy(v.target), evaluated_at: stamp, verified_against: 'life_pilot_task_logs', ...extra });
        if (!prior) {
          const status = exception && result.status !== 'verified' ? 'excused' : result.status;
          c.evaluations.push(entry({ status, measured: result.measured, evidence: result.evidence, doubts: result.doubts, notes: result.notes, ...(status === 'excused' ? { exception_id: exception.id, reviewed: false } : {}) }));
          added++;
        } else if (prior.status !== 'verified') {
          // Union of evidence already on record and evidence found now; nothing on record is dropped.
          const seen = new Map();
          for (const e of [...c.evaluations.filter(x => x.commitment_id === item.id && x.week_start === week).flatMap(x => x.evidence || []), ...result.evidence]) seen.set(e.task_id + '@' + e.completed_at, e);
          // Evidence doubtful now or in any earlier entry for this week is never counted.
          const shaky = doubtfulIds([...result.doubts, ...c.evaluations.filter(x => x.commitment_id === item.id && x.week_start === week).flatMap(x => x.doubts || [])]);
          const union = [...seen.values()].map(e => shaky.has(e.task_id) || e.doubtful ? { ...e, doubtful: true } : e);
          const counted = total(union.filter(e => !e.doubtful), v.target);
          if (counted >= v.target.count) {
            c.evaluations.push(entry({ status: 'verified', measured: counted, evidence: union, doubts: result.doubts, supersedes: prior.id, reason: 'later_native_evidence', late_evidence: union.some(e => e.late && !e.doubtful) }));
            reconciled++;
          }
        }
        week = addDays(week, 7);
      }
      if (item.status === 'active' && item.ends_from && Date.parse(item.ends_from) <= nowMs) { item.status = 'ended'; event('ended', { ends_from: item.ends_from }); }
      if (added) event('evaluated', { weeks: added });
      if (reconciled) event('reconciled', { weeks: reconciled });
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
  // --- Read-only helpers for the screens (Slice 2). None of these write.
  const iso = ms => new Date(ms).toISOString();
  // When an action taken now would take effect, so the owner sees it before confirming.
  function effectiveDates(item, now = new Date()) {
    const nowMs = new Date(now).getTime(), v = item.versions.at(-1), tz = v.timezone;
    const firstWeek = [nextMondayAfter(nowMs, tz), mondayAtOrAfter(localMidnight(v.starts_on, tz), tz)].sort().at(-1);
    const boundary = localDate(localMidnight(mondayAtOrAfter(nowMs + COOLING_OFF_MS, tz), tz), tz);
    return { approve_first_week: firstWeek, revision_or_end_from: boundary };
  }
  // The current week's progress against the version in force, from native logs (no write).
  function progress(profile, id, now = new Date()) {
    const item = profile?.commitments?.items?.find(x => x.id === id);
    if (!item || item.status !== 'active') return null;
    const nowMs = new Date(now).getTime(), v0 = item.versions[0], tz = v0.timezone;
    if (nowMs < Date.parse(v0.effective_from) || (item.ends_from && nowMs >= Date.parse(item.ends_from))) return null;
    let week = localDate(nowMs, tz);
    while (weekday(week) !== 1) week = addDays(week, -1);
    const startMs = localMidnight(week, tz), endMs = localMidnight(addDays(week, 7), tz), v = versionAt(item, startMs);
    const result = measure(profile, item, v, startMs, endMs);
    const daysLeft = Math.ceil((endMs - nowMs) / 86400000);
    return { week_start: week, measured: result.measured, target: copy(v.target), met: result.measured >= v.target.count, days_left: daysLeft, ends_at: iso(endMs) };
  }
  // Started weeks in scope that can still be excused (not verified, no exception yet).
  function excusableWeeks(profile, id, now = new Date()) {
    const c = profile?.commitments, item = c?.items?.find(x => x.id === id);
    if (!item || !['active', 'ended'].includes(item.status)) return [];
    const nowMs = new Date(now).getTime(), v0 = item.versions[0], tz = v0.timezone, out = [];
    for (let week = localDate(Date.parse(v0.effective_from), tz); ; week = addDays(week, 7)) {
      const startMs = localMidnight(week, tz);
      if (startMs > nowMs || (item.ends_from && startMs >= Date.parse(item.ends_from))) break;
      const last = latestEvaluation(c, id, week);
      if (last?.status === 'verified' || c.exceptions.some(x => x.commitment_id === id && x.week_start === week)) continue;
      out.push(week);
    }
    return out;
  }
  return { apply, scorecard, effectiveDates, progress, excusableWeeks, COOLING_OFF_MS, WEEK_MS, localMidnight, localDate };
});

// Browser entry point; wrapped in a save transaction by persistence.js. Slice 2 adds the screens.
if (typeof document !== 'undefined' && typeof module === 'undefined') {
  globalThis.commitmentAction = function (command) { profile = LifePilotCommitments.apply(profile, command); save(); render(); };
}
