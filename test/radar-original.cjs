/**
 * Unit tests for Forward Radar Engine
 * Run with: node test-forward-radar.js
 * Uses only Node built-ins. No external test framework required.
 */

'use strict';

const {
  forwardRadar,
  normalizeStatus,
  daysUntil,
  analyzeDependencies,
  carryForward
} = require('../forward-radar.js');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log('  ✓', msg);
  } else {
    failed++;
    console.error('  ✗', msg);
  }
}

function assertEqual(actual, expected, msg) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  assert(ok, msg + (ok ? '' : ` (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`));
}

console.log('Forward Radar — Unit Tests\n');

// --- helpers ---
const NOW = new Date('2026-10-23T12:00:00Z');

function makeTask(overrides = {}) {
  return {
    id: 't1',
    name: 'Test task',
    due: '2026-10-25T09:00',
    status: 'planned',
    prerequisite_id: null,
    importance: 1,
    ...overrides
  };
}

// --- normalizeStatus ---
console.log('normalizeStatus');
assertEqual(normalizeStatus('completed'), 'completed', 'completed');
assertEqual(normalizeStatus('HOLD'), 'hold', 'HOLD → hold');
assertEqual(normalizeStatus('hold'), 'hold', 'hold');
assertEqual(normalizeStatus('planned'), 'active', 'planned → active');
assertEqual(normalizeStatus('partial'), 'active', 'partial → active');
assertEqual(normalizeStatus('missed'), 'active', 'missed → active');

// --- daysUntil ---
console.log('\ndaysUntil');
assertEqual(daysUntil('2026-10-23T15:00', NOW), 0, 'today');
assertEqual(daysUntil('2026-10-22T10:00', NOW), -1, 'yesterday');
assertEqual(daysUntil('2026-10-30T10:00', NOW), 7, '7 days');
assertEqual(daysUntil('invalid', NOW), Infinity, 'invalid date');

// --- dependencies ---
console.log('\nanalyzeDependencies');
{
  const tasks = [
    makeTask({ id: 'a', status: 'completed' }),
    makeTask({ id: 'b', prerequisite_id: 'a' }),
    makeTask({ id: 'c', prerequisite_id: 'b' }),
    makeTask({ id: 'd', prerequisite_id: 'missing' })
  ];
  const { blocked } = analyzeDependencies(tasks);
  assert(blocked.has('c'), 'c blocked by incomplete b');
  assert(blocked.has('d'), 'd blocked by missing prereq');
  assert(!blocked.has('b'), 'b not blocked (a completed)');
  assert(!blocked.has('a'), 'a not blocked');
}

// --- carryForward ---
console.log('\ncarryForward');
{
  const tasks = [
    makeTask({ id: 'over', due: '2026-10-20T09:00', status: 'planned' }),
    makeTask({ id: 'future', due: '2026-10-30T09:00', status: 'planned' }),
    makeTask({ id: 'done', due: '2026-10-20T09:00', status: 'completed' })
  ];
  const carried = carryForward(tasks, NOW);
  const over = carried.find(t => t.id === 'over');
  assert(over.carryover_count === 1, 'overdue active gets carryover_count');
  assert(over.history && over.history.length === 1, 'history appended');
  assert(over.history[0].type === 'carryover', 'history type correct');
  assert(carried.find(t => t.id === 'future').carryover_count === undefined, 'future not carried');
  assert(carried.find(t => t.id === 'done').carryover_count === undefined, 'completed not carried');
}

// --- forwardRadar core scenarios ---
console.log('\nforwardRadar — basic prioritization');
{
  const tasks = [
    makeTask({ id: 'soon', name: 'Due soon', due: '2026-10-24T09:00', importance: 2 }),
    makeTask({ id: 'later', name: 'Later', due: '2026-10-28T09:00', importance: 1 }),
    makeTask({ id: 'over', name: 'Overdue', due: '2026-10-21T09:00', importance: 1 }),
    makeTask({ id: 'done', name: 'Done', due: '2026-10-22T09:00', status: 'completed' }),
    makeTask({ id: 'hold', name: 'On hold', due: '2026-10-24T09:00', status: 'hold' })
  ];
  const result = forwardRadar({ tasks, now: NOW });

  assert(result.summary.overdue >= 1, 'detects overdue');
  assert(result.summary.active >= 2, 'has active items');
  assert(result.items.some(i => i.id === 'over' && i.overdue), 'overdue item present');
  assert(!result.items.some(i => i.id === 'done'), 'completed excluded from radar');
  assert(result.items.some(i => i.id === 'hold' && i.hold), 'hold item distinguished');

  // Overdue should rank higher than later
  const overRank = result.items.find(i => i.id === 'over')?.rank;
  const laterRank = result.items.find(i => i.id === 'later')?.rank;
  assert(overRank < laterRank, 'overdue ranks before later item');
}

console.log('\nforwardRadar — blocked and rejection memory');
{
  const tasks = [
    makeTask({ id: 'prereq', name: 'Prerequisite', due: '2026-10-24T09:00', status: 'planned' }),
    makeTask({ id: 'blocked', name: 'Blocked task', due: '2026-10-25T09:00', prerequisite_id: 'prereq' })
  ];
  const rejections = [
    { task_id: 'blocked', action_type: 'unblock', rejected_at: '2026-10-22T00:00:00Z' }
  ];
  const result = forwardRadar({ tasks, rejections, now: NOW });

  const blockedItem = result.items.find(i => i.id === 'blocked');
  assert(blockedItem && blockedItem.blocked, 'task marked blocked');
  assert(blockedItem.reasons.includes('previously_rejected'), 'rejection memory applied');
  assert(!blockedItem.recommendation, 'no recommendation when rejected');

  const prereqItem = result.items.find(i => i.id === 'prereq');
  assert(prereqItem && prereqItem.recommendation, 'prereq still gets recommendation');
}

console.log('\nforwardRadar — empty and edge cases');
{
  const empty = forwardRadar({ tasks: [], now: NOW });
  assertEqual(empty.summary.total_tasks, 0, 'empty tasks');
  assertEqual(empty.items.length, 0, 'no items');
  assertEqual(empty.recommendations.length, 0, 'no recommendations');

  // Invalid now
  let threw = false;
  try { forwardRadar({ tasks: [], now: 'not-a-date' }); } catch (e) { threw = true; }
  assert(threw, 'throws on invalid now');

  // Missing fields
  const minimal = forwardRadar({
    tasks: [{ id: 'm', due: '2026-10-24T09:00' }],
    now: NOW
  });
  assert(minimal.items.length === 1, 'handles minimal task');
  assert(minimal.items[0].name === '(unnamed)', 'default name');
}

console.log('\nforwardRadar — recommendations require approval');
{
  const tasks = [makeTask({ id: 'r', due: '2026-10-24T09:00' })];
  const result = forwardRadar({ tasks, now: NOW });
  assert(result.recommendations.length > 0, 'produces recommendations');
  assert(result.recommendations.every(r => r.requires_approval === true), 'all require approval');
  assert(result.recommendations[0].type === 'prioritize' || result.recommendations[0].type === 'reschedule', 'sensible type');
}

// --- summary ---
console.log('\n' + '='.repeat(40));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('Some tests failed.');
  process.exit(1);
} else {
  console.log('All tests passed.');
}
