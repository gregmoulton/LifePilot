import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = html.match(/async function importFile\(file\)\{[\s\S]*?\}function switchProfile\(/)?.[0]?.replace(/function switchProfile\($/, '');
assert.ok(source, 'import function must be present');

async function attempt(incoming) {
  const original = {goals:[{id:'fictional-goal'}],decision_register:[{id:'fictional-decision'}]};
  const events = {saved:0,confirmed:0,alerts:[]};
  const context = vm.createContext({
    profile:structuredClone(original), storageProblem:null, tab:'dashboard',
    file:{text:async()=>JSON.stringify(incoming)},
    alert:s=>events.alerts.push(s),
    confirm:()=>{events.confirmed++;return true},
    save:()=>events.saved++, render:()=>{}, notify:()=>{}, uid:()=> 'fake-id'
  });
  vm.runInContext(source,context);
  await vm.runInContext('importFile(file)',context);
  return {original,after:JSON.parse(vm.runInContext('JSON.stringify(profile)',context)),events};
}

test('populated decisions survive import containing goals but empty decisions', async()=>{
  const {original,after,events}=await attempt({goals:[{id:'fictional-other'}],decision_register:[]});
  assert.deepEqual(after,original);
  assert.equal(events.saved,0);
  assert.equal(events.confirmed,0);
  assert.match(events.alerts.join(' '),/existing decisions would be lost/);
});

test('populated decisions survive missing decision register', async()=>{
  const {original,after,events}=await attempt({goals:[{id:'fictional-other'}]});
  assert.deepEqual(after,original);
  assert.equal(events.saved,0);
});

test('nonempty imported decisions can replace only after confirmation', async()=>{
  const {after,events}=await attempt({goals:[{id:'fictional-other'}],decision_register:[{id:'fictional-new-decision'}]});
  assert.equal(after.decision_register[0].id,'fictional-new-decision');
  assert.equal(events.confirmed,1);
  assert.equal(events.saved,1);
});
