import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Fictional in-memory profile only; execute the actual application module.
const source = readFileSync(new URL('../execution.js', import.meta.url), 'utf8');
function setup(inputs) {
  const profile = {goals:[{id:'g1',name:'Fictional goal'}],execution:{
    programs:[],milestones:[],tasks:[{id:'t1',name:'Fictional task',status:'planned'}],
    observations:[],experiments:[],reviews:[]}};
  const responses = [...inputs];
  let saves=0, renders=0;
  const alerts=[];
  const sandbox={profile, uid:()=> 'synthetic-id', baseRender:()=>{},
    document:{querySelector:()=>null}, tab:'dashboard',
    prompt:()=>responses.shift(), alert:message=>alerts.push(String(message)),
    save:()=>{saves++;}, render:()=>{renders++;}};
  vm.createContext(sandbox);
  vm.runInContext(source,sandbox,{filename:'execution.js'});
  sandbox.taskResult('t1');
  return {task:profile.execution.tasks[0],saves,renders,alerts};
}
test('blank actual minutes must not complete or save a task',()=>{
  const r=setup(['completed','']);
  assert.equal(r.task.status,'planned');
  assert.equal(r.saves,0);
  assert.ok(r.alerts.length>0);
});
test('whitespace actual minutes must not complete or save a task',()=>{
  const r=setup(['completed','   ']);
  assert.equal(r.task.status,'planned');
  assert.equal(r.saves,0);
  assert.ok(r.alerts.length>0);
});
test('typed zero remains valid',()=>{
  const r=setup(['completed','0']);
  assert.equal(r.task.status,'completed');
  assert.equal(r.task.actual_minutes,0);
  assert.equal(r.saves,1);
});
test('positive minutes remain valid',()=>{
  const r=setup(['partial','25']);
  assert.equal(r.task.status,'partial');
  assert.equal(r.task.actual_minutes,25);
  assert.equal(r.saves,1);
});
test('cancel at status or minutes prompt leaves task unchanged',()=>{
  for(const input of [[null],['completed',null]]){
    const r=setup(input);
    assert.equal(r.task.status,'planned');
    assert.equal(r.saves,0);
  }
});
