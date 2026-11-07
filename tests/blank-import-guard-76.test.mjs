import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const LifePilotStorage=createRequire(import.meta.url)('../storage.js');

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('async function importFile(file)');
const end=html.indexOf('function switchProfile()',start);
assert.ok(start>=0&&end>start,'legacy import source exists');
const source=html.slice(start,end);

function fixture(){
  const initial={goals:[{id:'fictional-goal-1',name:'Example'}],decision_register:[{id:'fictional-decision-1'}]};
  let raw=JSON.stringify(initial),writes=0,confirms=0;
  const alerts=[];
  const context={profile:JSON.parse(raw),storageProblem:null,alert:s=>alerts.push(s),confirm:()=>{confirms++;return true;},
    save:()=>{writes++;raw=JSON.stringify(context.profile)},tab:'dashboard',LifePilotStorage,render:()=>{},notify:()=>{},uid:()=> 'synthetic-id'};
  vm.runInNewContext(source,context);
  return {context,alerts,read:()=>raw,writes:()=>writes,confirms:()=>confirms};
}
test('blank fictional import cannot overwrite populated goals or decisions',async()=>{
  const f=fixture(),original=f.read();
  await f.context.importFile({text:async()=>JSON.stringify({goals:[],decision_register:[]})});
  assert.equal(f.read(),original);
  assert.equal(f.writes(),0);
  assert.equal(f.confirms(),0);
  assert.match(f.alerts.join(' '),/Blank import refused/);
});
test('nonblank fictional import that keeps existing decisions requires confirmation and persists',async()=>{
  const f=fixture();
  await f.context.importFile({text:async()=>JSON.stringify({goals:[{id:'fictional-goal-1',name:'Example'},{id:'fictional-goal-2'}],decision_register:[{id:'fictional-decision-1'},{id:'fictional-decision-2'}]})});
  assert.equal(f.confirms(),1);
  assert.equal(f.writes(),1);
  assert.deepEqual(JSON.parse(f.read()).goals.map(g=>g.id),['fictional-goal-1','fictional-goal-2']);
});
test('import with goals but empty decisions cannot erase existing decisions',async()=>{
  const f=fixture(),original=f.read();
  await f.context.importFile({text:async()=>JSON.stringify({goals:[{id:'fictional-goal-2'}],decision_register:[]})});
  assert.equal(f.read(),original);
  assert.equal(f.writes(),0);
  assert.match(f.alerts.join(' '),/existing decisions would be lost/);
});
test('nonblank fictional import replacing a decision with an unrelated one is refused',async()=>{
  const f=fixture(),original=f.read();
  await f.context.importFile({text:async()=>JSON.stringify({goals:[{id:'fictional-goal-2'}],decision_register:[{id:'fictional-decision-2'}]})});
  assert.equal(f.read(),original);
  assert.equal(f.writes(),0);
  assert.equal(f.confirms(),0);
  assert.match(f.alerts.join(' '),/fictional-decision-1 would be removed/);
});
