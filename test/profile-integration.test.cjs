const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const KEY = 'lifepilot-v02-profile';
function harness(map = new Map(), sharedLocks) {
  const elements = new Map(), blobs = [], alerts = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: '', style: {}, dataset: {}, hidden: false, innerHTML: '', textContent: '', insertAdjacentHTML() {}, append() {}, setAttribute() {}, scrollIntoView() {}, click() {}, classList: { toggle() {} } });
    return elements.get(id);
  };
  let fail = false, queue = Promise.resolve();
  const locks = sharedLocks || { request(name, fn) { const result = queue.then(fn); queue = result.catch(() => {}); return result; } };
  const context = vm.createContext({ console, Blob, navigator: { locks }, localStorage: {
    getItem: k => map.get(k) ?? null,
    setItem(k, v) { if (fail) throw Error('Synthetic storage failure'); map.set(k, v); },
    removeItem(k) { if (fail) throw Error('Synthetic storage failure'); map.delete(k); }
  }, document: { getElementById: element, createElement: () => element('anchor'), querySelector: () => element('nav'), querySelectorAll: () => [] },
  URL: { createObjectURL(blob) { blobs.push(blob); return 'blob:synthetic'; }, revokeObjectURL() {} },
  confirm: () => true, prompt: () => null, alert: s => alerts.push(s), setTimeout() {} });
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const script of html.matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g)) {
    vm.runInContext(script[1] ? fs.readFileSync(path.join(root, script[1]), 'utf8') : script[2], context);
  }
  return { map, element, blobs, alerts, context, fail(value = true) { fail = value; }, run(s) { return vm.runInContext(s, context); } };
}
function legacy() { return { schema_version: '0.1', goals: Array.from({ length: 8 }, (_, i) => ({ id: 'g' + i, name: 'Synthetic goal ' + i, status: 'active', custom: 'retain' })), decision_register: [], custom_top: { keep: true } }; }
const event = '{preventDefault(){}}';
test('eight-goal legacy import, execution, approval, improvement log and export survive restart', async () => {
  const h = harness(); h.context.fixture = legacy();
  await h.run('importFile({text:async()=>JSON.stringify(fixture)})');
  for (const [id, value] of Object.entries({ structureGoal: 'g0', programName: 'Synthetic program', milestoneName: 'Synthetic milestone', milestoneTarget: '10 points' })) h.element(id).value = value;
  await h.run('createStructure(' + event + ')');
  h.element('taskMilestone').value = h.run('records().milestones[0].id');
  h.element('taskName').value = 'Synthetic task'; h.element('taskDue').value = '2026-10-20T10:00'; h.element('taskMinutes').value = '10'; h.element('taskPrerequisite').value = '';
  await h.run('createTask(' + event + ')');
  await h.run("completeTask(records().tasks[0].id,'completed',12)");
  assert.equal(h.run('records().tasks[0].actual_minutes'), 12);
  const proposed = await h.run("proposeReview('g0','Synthetic scheduling conflict','schedule')");
  assert.equal(proposed.status, 'proposed');
  assert.equal(h.run('records().tasks[0].due'), '2026-10-20T10:00');
  await h.run("approveAdjustment(records().reviews[0].id,'2026-10-23','2026-10-30','2026-10-24T10:00')");
  assert.equal(h.run('records().reviews[0].status'), 'approved');
  for (const type of h.run('Object.keys(IMPROVEMENT_TYPES)')) await h.run(`recordImprovement({type:${JSON.stringify(type)},summary:'Synthetic outcome',details:'Synthetic evidence'})`);
  h.run('exportProfile()'); const exported = JSON.parse(await h.blobs.at(-1).text());
  assert.equal(exported.goals.length, 8); assert.equal(exported.system_improvement_log.length, 4);
  assert.equal(exported.custom_top.keep, true); assert.equal(exported.goals[0].custom, 'retain');
  const restart = harness(h.map);
  assert.deepEqual(JSON.parse(restart.run('JSON.stringify(profile)')), exported);
});
test('failed goal update rolls back and never announces success; attempted data can be downloaded', async () => {
  const map = new Map([[KEY, JSON.stringify(legacy())]]), h = harness(map); h.fail();
  await h.run("setStatus('g0','completed')");
  assert.equal(h.run('profile.goals[0].status'), 'active');
  assert.notEqual(h.element('toast').textContent, 'Goal updated');
  assert.equal(h.element('storageWarning').hidden, false);
  h.run("exportRecovery('unsaved')");
  assert.equal(JSON.parse(await h.blobs.at(-1).text()).goals[0].status, 'completed');
  assert.equal(JSON.parse(map.get(KEY)).goals[0].status, 'active');
  h.fail(false); await h.run("setStatus('g1','paused')");
  h.run("exportRecovery('unsaved')");
  assert.equal(JSON.parse(await h.blobs.at(-1).text()).goals[0].status, 'completed');
  assert.equal(JSON.parse(map.get(KEY)).goals[1].status, 'active');
});
test('corrupt profile blocks fresh and import without replacing the original', async () => {
  const map = new Map([[KEY, 'SYNTHETIC-BROKEN']]), h = harness(map);
  await h.run('fresh()'); h.context.fixture = legacy(); await h.run('importFile({text:async()=>JSON.stringify(fixture)})');
  assert.equal(map.get(KEY), 'SYNTHETIC-BROKEN'); assert.equal(h.element('storageWarning').hidden, false);
});
test('two tab editing detects a stale save and retains the first tab data', async () => {
  let queue = Promise.resolve(); const locks = { request(name, fn) { const r = queue.then(fn); queue = r.catch(() => {}); return r; } };
  const map = new Map([[KEY, JSON.stringify(legacy())]]), a = harness(map, locks), b = harness(map, locks);
  await Promise.all([a.run("setStatus('g0','completed')"), b.run("setStatus('g1','paused')")]);
  const saved = JSON.parse(map.get(KEY)); assert.equal(saved.goals[0].status, 'completed'); assert.equal(saved.goals[1].status, 'active');
  assert.equal(b.element('storageWarning').hidden, false); assert.notEqual(b.element('toast').textContent, 'Goal updated');
});
test('reset preserves a downloadable previous profile', async () => {
  const raw = JSON.stringify(legacy()), map = new Map([[KEY, raw]]), h = harness(map);
  await h.run('switchProfile()'); assert.equal(map.has(KEY), false);
  h.run("exportRecovery('backup')"); assert.equal(await h.blobs.at(-1).text(), raw);
});
test('failed approval save cannot leave the plan approved or change task dates', async () => {
  const p = legacy();
  p.execution = { programs: [], milestones: [], observations: [], experiments: [], reviews: [{ id: 'review', goal_id: 'g0', status: 'proposed', recommendation: 'Synthetic adjustment' }], tasks: [{ id: 'task', goal_id: 'g0', status: 'missed', due: '2026-10-20T10:00', planned_minutes: 10 }] };
  const map = new Map([[KEY, JSON.stringify(p)]]), h = harness(map); h.fail();
  await h.run("approveAdjustment('review','2026-10-23','2026-10-30','2026-10-24T10:00')");
  assert.equal(h.run('records().reviews[0].status'), 'proposed');
  assert.equal(h.run('records().tasks[0].due'), '2026-10-20T10:00');
  assert.equal(JSON.parse(map.get(KEY)).execution.reviews[0].status, 'proposed');
});
test('invalid import preserves the existing saved profile', async () => {
  const raw = JSON.stringify(legacy()), map = new Map([[KEY, raw]]), h = harness(map);
  await h.run('importFile({text:async()=>JSON.stringify({goals:[],execution:{tasks:{}}})})');
  assert.equal(map.get(KEY), raw); assert.equal(h.run('profile.goals.length'), 8);
  assert.equal(h.element('toast').textContent, '');
});
