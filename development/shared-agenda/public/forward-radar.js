/**
 * Forward Radar Engine — Life Pilot
 * Standalone, deterministic seven-day planning and prioritization module.
 *
 * Does not depend on or modify the main Life Pilot application.
 * Consumes plain task objects (compatible with existing execution.tasks shape).
 *
 * Status model (normalized):
 *   - active:    planned, partial, missed (still actionable)
 *   - hold:      explicit HOLD (user or system paused)
 *   - completed: completed
 *
 * Recommendations are proposals only. Owner approval is external.
 * Rejection memory prevents re-proposing identical actions.
 */

'use strict';

const DAY_MS = 24 * 60 * 60 * 1000;
const HORIZON_DAYS = 7;

/**
 * @typedef {Object} Task
 * @property {string} id
 * @property {string} [goal_id]
 * @property {string} [name]
 * @property {string} due          - ISO or datetime-local string
 * @property {string} status       - 'planned'|'partial'|'missed'|'completed'|'hold'|'HOLD'
 * @property {string|null} [prerequisite_id]
 * @property {number} [planned_minutes]
 * @property {number} [importance] - optional 1-5 or 0-1; default 1
 * @property {string} [created_at]
 * @property {Array}  [history]    - optional carryover/history log
 * @property {number} [carryover_count]
 */

/**
 * @typedef {Object} Rejection
 * @property {string} task_id
 * @property {string} action_type  - e.g. 'prioritize', 'reschedule', 'unblock'
 * @property {string} [reason]
 * @property {string} rejected_at
 */

/**
 * Normalize a task status into active | hold | completed.
 */
function normalizeStatus(status) {
  if (!status) return 'active';
  const s = String(status).toLowerCase();
  if (s === 'completed' || s === 'done') return 'completed';
  if (s === 'hold' || s === 'on_hold' || s === 'waiting') return 'hold';
  return ['active', 'planned', 'today', 'partial', 'missed'].includes(s) ? 'active' : 'review';
}

/**
 * Parse due date safely. Returns Date or null.
 */
function parseDue(due) {
  if (!due) return null;
  const match = typeof due === 'string' && due.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const d = match ? new Date(+match[1], +match[2] - 1, +match[3]) : new Date(due);
  if (match && (d.getFullYear() !== +match[1] || d.getMonth() !== +match[2] - 1 || d.getDate() !== +match[3])) return null;
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Days from now until due (negative = overdue).
 * Uses local midnight boundaries for day counting when possible.
 */
function daysUntil(due, now = new Date()) {
  const d = parseDue(due);
  if (!d) return Infinity;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(0, 0, 0, 0);
  return Math.round((end - start) / DAY_MS);
}

/**
 * Build dependency graph and detect blocked tasks.
 * A task is blocked if it has a prerequisite that is not completed.
 */
function analyzeDependencies(tasks) {
  const byId = new Map(tasks.map(t => [t.id, t]));
  const blocked = new Set();
  const dependents = new Map(); // id -> Set of tasks that depend on it

  for (const t of tasks) {
    if (t.prerequisite_id) {
      if (!dependents.has(t.prerequisite_id)) dependents.set(t.prerequisite_id, new Set());
      dependents.get(t.prerequisite_id).add(t.id);

      const prereq = byId.get(t.prerequisite_id);
      const prereqDone = prereq && normalizeStatus(prereq.status) === 'completed';
      if (!prereqDone) blocked.add(t.id);
    }
  }

  return { byId, blocked, dependents };
}

/**
 * Carry incomplete (active) tasks forward.
 * Does not mutate original history; returns enriched copies.
 * Increments carryover_count and appends to history.
 */
function carryForward(tasks, now = new Date()) {
  return tasks.map(t => {
    const status = normalizeStatus(t.status);
    if (status !== 'active') return { ...t };

    const dueDays = daysUntil(t.due, now);
    if (dueDays >= 0) return { ...t }; // still upcoming or today

    // Overdue active task — carry forward
    const history = Array.isArray(t.history) ? [...t.history] : [];
    if (history.some(e => e && e.type === 'carryover' && daysUntil(e.carried_at, now) === 0)) return { ...t, history };
    history.push({
      type: 'carryover',
      previous_due: t.due,
      carried_at: now.toISOString(),
      reason: 'overdue_incomplete'
    });

    return {
      ...t,
      carryover_count: (t.carryover_count || 0) + 1,
      history,
      // Keep original due for urgency calculation; do not silently change it
      // Caller may later propose a new due via recommendation
    };
  });
}

/**
 * Score a task for prioritization.
 * Higher score = higher priority.
 * Deterministic and transparent.
 */
function scoreTask(task, ctx) {
  const { now, blocked, horizonDays = HORIZON_DAYS } = ctx;
  const status = normalizeStatus(task.status);
  const days = daysUntil(task.due, now);
  const importance = Number(task.importance) || 1;
  const isBlocked = blocked.has(task.id);
  const carryovers = task.carryover_count || 0;

  // Non-actionable statuses get a sentinel low score but still return full analysis
  if (status !== 'active') {
    return {
      score: -Infinity,
      urgency: 0,
      dependencyBonus: 0,
      carryoverBonus: 0,
      importanceFactor: 1,
      days,
      isBlocked,
      status,
      overdue: days < 0
    };
  }

  // Urgency: overdue heavily weighted, then near-term
  let urgency = 0;
  if (days < 0) {
    urgency = 100 + Math.min(50, -days * 5); // overdue
  } else if (days < horizonDays) {
    urgency = 80 - days * 8; // today = 80, day 7 = 24
  } else {
    urgency = 10; // beyond horizon, low
  }

  // Dependency: unblocked tasks preferred; blocked get penalty but still visible
  const dependencyBonus = isBlocked ? -30 : 20;

  // Carryover pressure
  const carryoverBonus = Math.min(30, carryovers * 8);

  // Importance multiplier (1-5 typical)
  const importanceFactor = Math.max(0.5, Math.min(3, importance));

  const score = (urgency + dependencyBonus + carryoverBonus) * importanceFactor;

  return {
    score,
    urgency,
    dependencyBonus,
    carryoverBonus,
    importanceFactor,
    days,
    isBlocked,
    status,
    overdue: days < 0
  };
}

/**
 * Main Forward Radar function.
 *
 * @param {Object} input
 * @param {Task[]} input.tasks
 * @param {Rejection[]} [input.rejections]
 * @param {Date|string} [input.now]
 * @param {number} [input.horizonDays=7]
 * @returns {Object} radar report
 */
function forwardRadar(input = {}) {
  const now = input.now ? new Date(input.now) : new Date();
  if (isNaN(now.getTime())) throw new Error('Invalid now timestamp');

  const horizonDays = input.horizonDays ?? HORIZON_DAYS;
  if (!Number.isInteger(horizonDays) || horizonDays < 1 || horizonDays > 31) throw Error('Invalid horizon');
  const rawTasks = Array.isArray(input.tasks) ? input.tasks : [];
  const ids = new Set();
  for (const task of rawTasks) {
    if (!task || typeof task.id !== 'string' || !task.id || ids.has(task.id)) throw Error('Invalid or duplicate task ID');
    ids.add(task.id);
  }
  const rejections = Array.isArray(input.rejections) ? input.rejections : [];

  // Normalize and carry forward
  const carried = carryForward(rawTasks, now);
  const { byId, blocked } = analyzeDependencies(carried);

  const scored = carried.map(task => {
    const analysis = scoreTask(task, { now, blocked, horizonDays });
    return { task, analysis };
  });

  // Filter to relevant (non-completed, within broad window or overdue)
  const relevant = scored.filter(({ task, analysis }) => {
    if (analysis.status === 'completed') return false;
    const days = analysis.days;
    return days < horizonDays || days < 0 || analysis.isBlocked;
  });

  // Sort by score descending, then by due ascending (stable)
  relevant.sort((a, b) => {
    if (b.analysis.score !== a.analysis.score) return b.analysis.score - a.analysis.score;
    const da = parseDue(a.task.due)?.getTime() || 0;
    const db = parseDue(b.task.due)?.getTime() || 0;
    return da - db;
  });

  // Build rejection set for quick lookup
  const rejectedKeys = new Set(
    rejections.map(r => `${r.task_id}::${r.action_type || 'prioritize'}`)
  );

  const recommendations = [];
  const radarItems = relevant.map(({ task, analysis }, rank) => {
    const item = {
      rank: rank + 1,
      id: task.id,
      name: task.name || '(unnamed)',
      goal_id: task.goal_id || null,
      due: task.due,
      status: analysis.status,
      days_until: analysis.days,
      overdue: analysis.days < 0,
      blocked: analysis.isBlocked,
      hold: analysis.status === 'hold',
      carryover_count: task.carryover_count || 0,
      score: Math.round(analysis.score * 10) / 10,
      reasons: []
    };

    if (analysis.overdue) item.reasons.push('overdue');
    if (analysis.isBlocked) item.reasons.push('blocked_by_prerequisite');
    if (item.carryover_count > 0) item.reasons.push(`carried_forward_${item.carryover_count}`);
    if (analysis.days >= 0 && analysis.days <= 2) item.reasons.push('imminent');
    if ((task.importance || 1) >= 3) item.reasons.push('high_importance');

    // Generate recommendation only if not previously rejected
    const actionType = analysis.isBlocked ? 'unblock' : (analysis.days < 0 ? 'reschedule' : 'prioritize');
    const rejectKey = `${task.id}::${actionType}`;
    if (!rejectedKeys.has(rejectKey) && analysis.status === 'active') {
      let proposal = null;
      if (analysis.isBlocked) {
        proposal = {
          type: 'unblock',
          summary: `Complete prerequisite for "${item.name}" before this can proceed`,
          requires_approval: true
        };
      } else if (analysis.days < 0) {
        proposal = {
          type: 'reschedule',
          summary: `"${item.name}" is overdue; consider rescheduling or completing soon`,
          requires_approval: true
        };
      } else if (analysis.days < horizonDays) {
        proposal = {
          type: 'prioritize',
          summary: `Focus on "${item.name}" within the next ${analysis.days === 0 ? 'day' : analysis.days + ' days'}`,
          requires_approval: true
        };
      }
      if (proposal) {
        item.recommendation = proposal;
        recommendations.push({ task_id: task.id, ...proposal });
      }
    } else if (rejectedKeys.has(rejectKey)) {
      item.reasons.push('previously_rejected');
    }

    return item;
  });

  const summary = {
    generated_at: now.toISOString(),
    horizon_days: horizonDays,
    total_tasks: rawTasks.length,
    active: radarItems.filter(i => i.status === 'active').length,
    hold: radarItems.filter(i => i.hold).length,
    overdue: radarItems.filter(i => i.overdue).length,
    blocked: radarItems.filter(i => i.blocked).length,
    recommendations: recommendations.length
  };

  return {
    summary,
    items: radarItems,
    recommendations, // proposals only — never auto-applied
    carried_tasks: carried.filter(t => (t.carryover_count || 0) > 0)
  };
}

// Export for Node / browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    forwardRadar,
    normalizeStatus,
    daysUntil,
    analyzeDependencies,
    carryForward,
    scoreTask
  };
}
if (typeof module === 'undefined' || !module.exports) {
  globalThis.ForwardRadar = {
    forwardRadar,
    normalizeStatus,
    daysUntil,
    analyzeDependencies,
    carryForward,
    scoreTask
  };
}
