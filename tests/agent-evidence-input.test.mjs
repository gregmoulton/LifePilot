import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Runtime code is the actual Life Pilot application module; no private profile is loaded.
const source = readFileSync(new URL('../execution.js', import.meta.url), 'utf8');
function setup(overrides={}) {
  const values = {
    observationMilestone: 'milestone-1', prediction: '4', observed: '6',
    measure: 'Practice runs', unit: 'sessions', measureType: 'achievement',
    conditions: 'Fictional fixture only', ...overrides,
  };
  const profile = {
    goals: [{id:'goal-1',name:'Fictional goal'}],
    execution: {programs:[],milestones:[{id:'milestone-1',goal_id:'goal-1'}],tasks:[],observations:[],experiments:[],reviews:[]},
  };
  let saves=0;
  const sandbox = {
    profile, uid: () => 'synthetic-id',
    $: id => ({value: values[id] ?? ''}),
    save: () => { saves++; }, render: () => {},
    baseRender: () => {}, document: {querySelector: () => null}, tab: 'dashboard',
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, {filename:'execution.js'});
  sandbox.recordObservation({preventDefault() {}});
  return {profile,saves};
}
test('blank predicted value does not invent a zero observation', () => {
  const {profile,saves} = setup({prediction:''});
  assert.equal(profile.execution.observations.length,0);
  assert.equal(saves,0);
});
test('whitespace observed value does not invent a zero observation', () => {
  const {profile,saves} = setup({observed:'   '});
  assert.equal(profile.execution.observations.length,0);
  assert.equal(saves,0);
});
test('explicit numeric zero remains valid while nonnumeric input is rejected', () => {
  const good=setup({prediction:'0',observed:'0'});
  assert.equal(good.profile.execution.observations.length,1);
  assert.equal(good.profile.execution.observations[0].predicted,0);
  assert.equal(good.profile.execution.observations[0].observed,0);
  assert.equal(good.saves,1);
  const bad=setup({prediction:'invalid'});
  assert.equal(bad.profile.execution.observations.length,0);
  assert.equal(bad.saves,0);
});
