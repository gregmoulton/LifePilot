/**
 * Deterministic fixture tests for POE optimizer.
 * Run with: node test-poe-optimizer.js
 * All data is fictional.
 */

const { optimize } = require('./poe-optimizer.js');

const NOW = '2026-10-30';

const goals = [
  { id: 'G15', title: 'Life Pilot prototype', ownerTargetDate: '2027-01-24', priorityWeight: 0.9, currentForecast: '2027-01-24' },
  { id: 'G16', title: 'The Pure prototype', ownerTargetDate: '2027-01-11', priorityWeight: 0.8, currentForecast: '2027-01-11' },
  { id: 'G8', title: 'Dream Loft', ownerTargetDate: '2027-06-01', priorityWeight: 0.6, currentForecast: '2027-06-01' },
  { id: 'G19', title: 'Software literacy course', ownerTargetDate: '2026-11-24', priorityWeight: 0.4, currentForecast: '2026-11-24' }
];

const requirements = [
  { id: 'R15a', goalId: 'G15', description: 'Integrate Agenda + Forward Radar proposals', status: 'open', benefit: 0.8, type: 'next' },
  { id: 'R16a', goalId: 'G16', description: 'Field workout partial-save recovery', status: 'open', benefit: 0.7, type: 'next' },
  { id: 'R8a', goalId: 'G8', description: 'Transferable workstation inventory check', status: 'open', benefit: 0.5, type: 'alternative', impacts: ['G15'] },
  { id: 'R19a', goalId: 'G19', description: 'Start Lesson 1', status: 'open', benefit: 0.4, type: 'next' }
];

const dependencies = [
  { id: 'D1', fromReqId: 'R15a', type: 'hard', status: 'met' },
  { id: 'D2', fromReqId: 'R8a', type: 'resource', status: 'unknown' },
  { id: 'D3', fromReqId: 'R19a', type: 'preference', status: 'open' }
];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
  console.log('PASS:', msg);
}

// Case 1: Cross-goal ranking — prototype work ranks above loft inventory
const case1 = optimize(goals, requirements, dependencies, [], NOW);
assert(case1.recommendations[0].goalId === 'G15' || case1.recommendations[0].goalId === 'G16', 'Case 1: highest-priority open req ranks first');
assert(case1.recommendations.some(r => r.goalId === 'G8'), 'Case 1: alternative for Dream Loft present');
console.log('Case 1 top:', case1.recommendations.slice(0, 3).map(r => `${r.goalId}:${r.rankScore}`).join(', '));

// Case 2: Unknown input + rejection memory
const decisions2 = [
  { recommendationId: 'rec-G8-R8a', goalId: 'G8', action: 'reject', timestamp: '2026-10-20', note: 'Prefer waiting for funding clarity' }
];
const case2 = optimize(goals, requirements, dependencies, decisions2, NOW);
assert(case2.suppressed.includes('rec-G8-R8a'), 'Case 2: rejected recommendation suppressed');
assert(!case2.recommendations.some(r => r.id === 'rec-G8-R8a'), 'Case 2: suppressed item not in ranked list');
console.log('Case 2 suppressed:', case2.suppressed);

// Case 3: Approval triggers forecast revision
const decisions3 = [
  { recommendationId: 'rec-G15-R15a', goalId: 'G15', action: 'approve', timestamp: NOW, note: 'Proceed with integration slice' }
];
const case3 = optimize(goals, requirements, dependencies, decisions3, NOW);
const f15 = case3.forecasts.find(f => f.goalId === 'G15');
assert(f15.newForecast > f15.previousForecast || f15.newForecast !== f15.previousForecast, 'Case 3: approved action revises forecast');
console.log('Case 3 G15 forecast:', f15);

// Case 4: Hard dependency blocks recommendation
const depsBlocked = [...dependencies, { id: 'D4', fromReqId: 'R16a', type: 'hard', status: 'open' }];
const case4 = optimize(goals, requirements, depsBlocked, [], NOW);
assert(!case4.recommendations.some(r => r.requirementId === 'R16a'), 'Case 4: hard unmet dependency suppresses recommendation');
console.log('Case 4 recommendations:', case4.recommendations.map(r => r.requirementId));

console.log('\nAll fixture cases passed.');
console.log('Expected vs actual available in the console output above.');
