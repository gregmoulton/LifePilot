// #92: a blank actual-minutes entry is not a zero. Fictional data only.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, KEY } = require('./app-harness.cjs');

function profileWithTask() {
  return { schema_version: '0.2', goals: [{ id: 'fg-1', name: 'Fictional goal', status: 'active' }], decision_register: [],
    execution: { tasks: [{ id: 'ft-1', goal_id: 'fg-1', name: 'Fictional task', status: 'planned', due: '2020-01-01', planned_minutes: 15 }] } };
}

for (const blank of ['', '   ']) {
  test('Execution result with blank minutes ' + JSON.stringify(blank) + ' saves nothing', async () => {
    const raw = JSON.stringify(profileWithTask()), map = new Map([[KEY, raw]]), h = harness(map);
    h.prompts(['completed', blank]);
    await h.run("taskResult('ft-1')");
    assert.equal(map.get(KEY), raw);
    assert.equal(map.has(KEY + ':last-good'), false, 'no save transaction committed');
    assert.match(h.alerts.join(' '), /Enter actual minutes, or 0 if none/);
    assert.equal(h.run('profile.execution.tasks[0].status'), 'planned');
  });
  test('Agenda completion with blank minutes ' + JSON.stringify(blank) + ' saves nothing', async () => {
    const raw = JSON.stringify(profileWithTask()), map = new Map([[KEY, raw]]), h = harness(map);
    h.prompts([blank]);
    await h.run("agendaAction('complete','ft-1')");
    assert.equal(map.get(KEY), raw);
    assert.match(h.element('storageMessage').textContent, /Enter actual minutes/);
  });
}

test('explicit zero minutes is still recorded, in both paths', async () => {
  const map = new Map([[KEY, JSON.stringify(profileWithTask())]]), h = harness(map);
  h.prompts(['completed', '0']);
  await h.run("taskResult('ft-1')");
  const saved = JSON.parse(map.get(KEY)).execution.tasks[0];
  assert.equal(saved.status, 'completed');
  assert.equal(saved.actual_minutes, 0);
  const map2 = new Map([[KEY, JSON.stringify(profileWithTask())]]), h2 = harness(map2);
  h2.prompts(['0']);
  await h2.run("agendaAction('complete','ft-1')");
  assert.equal(JSON.parse(map2.get(KEY)).execution.tasks[0].actual_minutes, 0);
});

test('non-numeric minutes are refused without saving', async () => {
  const raw = JSON.stringify(profileWithTask()), map = new Map([[KEY, raw]]), h = harness(map);
  h.prompts(['completed', 'about ten']);
  await h.run("taskResult('ft-1')");
  assert.equal(map.get(KEY), raw);
  assert.match(h.alerts.join(' '), /Invalid task result/);
});
