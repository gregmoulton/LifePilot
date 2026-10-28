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
  let fail = false, confirmAnswer = true, queue = Promise.resolve();
  const locks = sharedLocks || { request(name, fn) { const result = queue.then(fn); queue = result.catch(() => {}); return result; } };
  const context = vm.createContext({ console, Blob, navigator: { locks }, localStorage: {
    getItem: k => map.get(k) ?? null,
    setItem(k, v) { if (fail) throw Error('Synthetic storage failure'); map.set(k, v); },
    removeItem(k) { if (fail) throw Error('Synthetic storage failure'); map.delete(k); }
  }, document: { getElementById: element, createElement: () => element('anchor'), querySelector: () => element('nav'), querySelectorAll: () => [] },
  URL: { createObjectURL(blob) { blobs.push(blob); return 'blob:synthetic'; }, revokeObjectURL() {} },
  confirm: () => confirmAnswer, prompt: () => null, alert: s => alerts.push(s), setTimeout() {} });
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const script of html.matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g)) {
    vm.runInContext(script[1] ? fs.readFileSync(path.join(root, script[1]), 'utf8') : script[2], context);
  }
  return { map, element, blobs, alerts, context, confirm(value) { confirmAnswer = value; }, fail(value = true) { fail = value; }, run(s) { return vm.runInContext(s, context); } };
}
function legacy() { return { schema_version: '0.1', goals: Array.from({ length: 8 }, (_, i) => ({ id: 'g' + i, name: 'Synthetic goal ' + i, status: 'active', custom: 'retain' })), decision_register: [], custom_top: { keep: true } }; }
function linkedTaskProfile() {
  const p = legacy();
  p.execution = { tasks: [{ id: 'task', name: 'Fictional linked task', goal_id: 'g0', status: 'planned', due: '2020-01-01', planned_minutes: 10 }] };
  return p;
}
test('Execution cannot complete a task placed on HOLD in Agenda', async () => {
  const h = harness(new Map([[KEY, JSON.stringify(linkedTaskProfile())]]));
  await h.run("agendaAction('hold','task')");
  const saved = h.map.get(KEY);
  await h.run("completeTask('task','completed',7)");
  assert.equal(h.map.get(KEY), saved);
  assert.equal(h.run('profile.execution.tasks[0].status'), 'planned');
  assert.match(h.element('storageMessage').textContent, /HOLD/);
  await h.run("agendaAction('release','task')");
  await h.run("completeTask('task','completed',7)");
  assert.equal(harness(h.map).run('profile.execution.tasks[0].actual_minutes'), 7);
});
test('a pending Motivation Lab schedule cannot reopen an Agenda completion', async () => {
  const h = harness(new Map([[KEY, JSON.stringify(linkedTaskProfile())]]));
  await h.run("proposeReview('g0','Fictional scheduling conflict','schedule')");
  h.context.prompt = () => '7';
  await h.run("agendaAction('complete','task')");
  const saved = h.map.get(KEY);
  await h.run("approveAdjustment(records().reviews[0].id,'2026-10-24','2026-10-30','2026-10-26T10:00')");
  assert.equal(h.map.get(KEY), saved);
  assert.equal(h.run('records().tasks[0].status'), 'completed');
  assert.equal(h.run('records().tasks[0].actual_minutes'), 7);
  assert.equal(h.run('records().reviews[0].status'), 'proposed');
  assert.equal(h.run('records().experiments.length'), 0);
});
test('schedule review snapshots survive export/restart and reject changed task data', async () => {
  const h = harness(new Map([[KEY, JSON.stringify(linkedTaskProfile())]]));
  await h.run("proposeReview('g0','Fictional scheduling conflict','schedule')");
  h.run('exportProfile()');
  const exported = await h.blobs.at(-1).text();
  const restart = harness(new Map([[KEY, exported]]));
  // An approved Agenda reschedule changes the same authoritative task.
  await restart.run("agendaAction('refresh')");
  restart.context.prompt = () => '2020-02-01';
  await restart.run("agendaAction('approve',profile.agenda.proposals[0].id)");
  const saved = restart.map.get(KEY);
  await restart.run("approveAdjustment(records().reviews[0].id,'2026-10-24','2026-10-30','2026-10-26T10:00')");
  assert.equal(restart.map.get(KEY), saved);
  assert.equal(restart.run('records().tasks[0].due'), '2020-02-01');
  assert.match(restart.element('storageMessage').textContent, /changed/);
});
test('legacy schedule reviews without snapshots cannot reopen completed or held tasks', async () => {
  for (const change of [{status:'completed',actual_minutes:9}, {agenda_hold:true}, {}]) {
    const p = linkedTaskProfile(); Object.assign(p.execution.tasks[0], change);
    p.execution.reviews = [{id:'old',goal_id:'g0',status:'proposed',reason:'schedule',task_ids:['task']}];
    const raw = JSON.stringify(p), h = harness(new Map([[KEY,raw]]));
    await h.run("approveAdjustment('old','2026-10-24','2026-10-30','2026-10-26T10:00')");
    assert.equal(h.map.get(KEY), raw);
  }
});
test('unchanged schedule snapshot approves after restart and retains previous results in history', async () => {
  const p = linkedTaskProfile(); p.execution.tasks[0].status = 'missed'; p.execution.tasks[0].actual_minutes = 4;
  const h = harness(new Map([[KEY, JSON.stringify(p)]]));
  await h.run("proposeReview('g0','Fictional scheduling conflict','schedule')");
  const restart = harness(h.map);
  await restart.run("approveAdjustment(records().reviews[0].id,'2026-10-24','2026-10-30','2026-10-26T10:00')");
  assert.equal(restart.run('records().reviews[0].status'), 'approved');
  assert.equal(restart.run('records().tasks[0].due'), '2026-10-26T10:00');
  assert.equal(restart.run('records().tasks[0].history[0].actual_minutes'), 4);
  assert.equal(restart.run('profile.custom_top.keep'), true);
  assert.equal(restart.run('records().experiments.length'), 1);
});
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
  Object.assign(p.execution.reviews[0], {reason:'schedule',task_ids:['task'],task_snapshots:JSON.parse(JSON.stringify(p.execution.tasks))});
  const map = new Map([[KEY, JSON.stringify(p)]]), h = harness(map); h.fail();
  await h.run("approveAdjustment('review','2026-10-23','2026-10-30','2026-10-24T10:00')");
  assert.equal(h.run('records().reviews[0].status'), 'proposed');
  assert.equal(h.run('records().tasks[0].due'), '2026-10-20T10:00');
  assert.equal(JSON.parse(map.get(KEY)).execution.reviews[0].status, 'proposed');
  assert.match(h.element('storageMessage').textContent, /Save failed/);
});
test('invalid import preserves the existing saved profile', async () => {
  const raw = JSON.stringify(legacy()), map = new Map([[KEY, raw]]), h = harness(map);
  await h.run('importFile({text:async()=>JSON.stringify({goals:[],execution:{tasks:{}}})})');
  assert.equal(map.get(KEY), raw); assert.equal(h.run('profile.goals.length'), 8);
  assert.equal(h.element('toast').textContent, '');
});

test('guided recovery restores a previous backup, preserves corrupt bytes and survives restart', async () => {
  const raw = JSON.stringify(legacy()), map = new Map([[KEY, 'BROKEN'], [KEY + ':last-good', raw]]), h = harness(map);
  await h.run('restoreLocalBackup()');
  assert.equal(h.run('profile.goals.length'), 8); assert.equal(map.get(KEY + ':recovery-original'), 'BROKEN');
  assert.equal(h.element('toast').textContent, 'Backup restored successfully');
  assert.equal(harness(map).run('profile.custom_top.keep'), true);
});
test('cancelled recovery and invalid file recovery never replace the stored data', async () => {
  const raw = JSON.stringify(legacy()), map = new Map([[KEY, 'BROKEN'], [KEY + ':last-good', raw]]), h = harness(map);
  h.confirm(false); await h.run('restoreLocalBackup()'); assert.equal(map.get(KEY), 'BROKEN');
  h.confirm(true); await h.run('restoreLocalBackup({text:async()=>JSON.stringify({goals:{}})})'); assert.equal(map.get(KEY), 'BROKEN');
});
test('failed recovery never shows a success notice', async () => {
  const map = new Map([[KEY, 'BROKEN'], [KEY + ':last-good', JSON.stringify(legacy())]]), h = harness(map); h.fail();
  await h.run('restoreLocalBackup()'); assert.equal(map.get(KEY), 'BROKEN');
  assert.notEqual(h.element('toast').textContent, 'Backup restored successfully'); assert.equal(h.run('profile'), null);
});
test('legacy caught errors cannot leak partial approval mutations without a save', async () => {
  const p = legacy(); p.execution = { reviews: [{ id: 'review', goal_id: 'g0', status: 'proposed', reason: 'schedule' }], tasks: [{ id: 'task', goal_id: 'g0', status: 'missed', history: {} }] };
  Object.assign(p.execution.reviews[0], {task_ids:['task'],task_snapshots:JSON.parse(JSON.stringify(p.execution.tasks))});
  const map = new Map([[KEY, JSON.stringify(p)]]), h = harness(map);
  h.element('start-review').value = '2026-10-23'; h.element('end-review').value = '2026-10-30'; h.element('due-review').value = '2026-10-24T10:00';
  await h.run("approveReview('review')");
  assert.equal(h.run('records().reviews[0].status'), 'proposed');
  assert.equal(JSON.parse(map.get(KEY)).execution.reviews[0].status, 'proposed'); assert.equal(h.alerts.length, 1);
});
test('reset then guided restore recovers the existing profile without format migration', async () => {
  const raw = JSON.stringify(legacy()), map = new Map([[KEY, raw]]), h = harness(map);
  await h.run('switchProfile()'); await h.run('restoreLocalBackup()');
  assert.equal(map.get(KEY), raw); assert.equal(h.run('profile.custom_top.keep'), true);
});
test('guided valid backup-file recovery preserves unknown fields without ordinary import rewriting', async () => {
  const h = harness(new Map([[KEY, 'BROKEN']])); h.context.fixture = legacy();
  await h.run('restoreLocalBackup({text:async()=>JSON.stringify(fixture)})');
  assert.equal(h.run('profile.schema_version'), '0.1'); assert.equal(h.run('profile.custom_top.keep'), true);
  assert.equal(h.run('profile.goals[0].custom'), 'retain');
});
test('missing previous backup is explained without resetting the current profile', async () => {
  const raw = JSON.stringify(legacy()), map = new Map([[KEY, raw]]), h = harness(map);
  await h.run('restoreLocalBackup()'); assert.equal(map.get(KEY), raw);
  assert.match(h.element('storageMessage').textContent, /No previous backup/);
});
test('Agenda commands use durable storage; completion and rejection survive restart',async()=>{
 const p=legacy();p.execution={tasks:[{id:'task',name:'Fictional task',status:'planned',due:'2026-10-20'}]};
 const h=harness(new Map([[KEY,JSON.stringify(p)]]));await h.run("agendaAction('refresh')");
 assert.equal(h.run('profile.execution.tasks[0].due'),'2026-10-20');
 const id=h.run('profile.agenda.proposals[0].id');await h.run(`agendaAction('reject',${JSON.stringify(id)})`);
 const restarted=harness(h.map);await restarted.run("agendaAction('refresh')");assert.equal(restarted.run('profile.agenda.proposals.length'),1);
 restarted.context.prompt=()=> '7';await restarted.run("agendaAction('complete','task')");
 assert.equal(harness(h.map).run('profile.execution.tasks[0].status'),'completed');
});
test('failed Agenda proposal approval leaves no applied receipt or changed due date',async()=>{
 const p=legacy();p.execution={tasks:[{id:'task',name:'Fictional task',status:'planned',due:'2026-10-20'}]};
 const h=harness(new Map([[KEY,JSON.stringify(p)]]));await h.run("agendaAction('refresh')");
 const id=h.run('profile.agenda.proposals[0].id');h.context.prompt=()=> '2026-10-30';h.fail();
 await h.run(`agendaAction('approve',${JSON.stringify(id)})`);
 assert.equal(h.run('profile.execution.tasks[0].due'),'2026-10-20');assert.equal(h.run('profile.agenda.proposals[0].status'),'proposed');
 assert.notEqual(h.element('toast').textContent,'Change saved');assert.equal(h.element('storageWarning').hidden,false);
});
test('Agenda validation error does not trap the user in unsaved recovery',async()=>{
 const p=legacy();p.execution={tasks:[{id:'task',name:'Fictional task',status:'planned',due:'2026-10-20'}]};const h=harness(new Map([[KEY,JSON.stringify(p)]]));
 h.context.prompt=()=> 'invalid';await h.run("agendaAction('complete','task')");assert.match(h.element('storageMessage').textContent,/not applied/);
 h.context.prompt=()=> '3';await h.run("agendaAction('complete','task')");assert.equal(h.run('profile.execution.tasks[0].status'),'completed');
});


test('Today uses local calendar date and changes only the unsaved form; explicit priority persists',async()=>{
 const h=harness(new Map([[KEY,JSON.stringify(legacy())]])),before=h.map.get(KEY),old=process.env.TZ;
 try{process.env.TZ='America/Phoenix';h.run("agendaSetToday(new Date('2026-10-28T02:30:00Z'))");assert.equal(h.element('agendaDue').value,'2026-10-27');}finally{if(old===undefined)delete process.env.TZ;else process.env.TZ=old;}
 assert.equal(h.map.get(KEY),before);h.element('agendaName').value='Fictional important errand';
 h.run("document.querySelector=selector=>selector.includes('agendaImportance')?{value:'high'}:null");
 await h.run('agendaAdd({preventDefault(){}})');const restarted=harness(h.map);
 assert.equal(restarted.run('profile.execution.tasks[0].agenda_importance'),'high');
 assert.equal(restarted.run('profile.execution.tasks[0].due'),'2026-10-27');
 assert.equal(restarted.run('profile.goals.length'),8);
});

test('Later saves durably, and failed defer/resume restores the last saved recommendation',async()=>{
 const p=legacy();p.execution={tasks:[{id:'task',name:'Fictional task',status:'planned',due:'2026-10-20'}]};
 for(const action of ['defer','resume']){
  const h=harness(new Map([[KEY,JSON.stringify(p)]]));await h.run("agendaAction('refresh')");
  const id=h.run('profile.agenda.proposals[0].id');
  if(action==='resume')await h.run(`agendaAction('defer',${JSON.stringify(id)})`);
  const before=h.map.get(KEY),status=h.run('profile.agenda.proposals[0].status');h.fail();
  await h.run(`agendaAction('${action}',${JSON.stringify(id)})`);
  assert.equal(h.map.get(KEY),before);assert.equal(h.run('profile.agenda.proposals[0].status'),status);
  assert.equal(h.element('storageWarning').hidden,false);assert.notEqual(h.element('toast').textContent,'Change saved');
  assert.equal(harness(h.map).run('profile.agenda.proposals[0].status'),status);
 }
});
