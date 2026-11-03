import test from 'node:test';
import assert from 'node:assert/strict';
import { selectTask } from './runner-task-selector.mjs';
const base={number:76,title:'Synthetic persistence regression',state:'open',approved_for_agent:true,risk:'synthetic-only',requires_spend:false,requires_deploy:false,requires_profile_access:false};
test('only explicitly approved and allowlisted synthetic work is selected',()=>{
 assert.deepEqual(selectTask([{...base}, {...base,number:99}], [76]), {number:76,title:base.title});
 assert.equal(selectTask([{...base,number:99}],[76]),null);
});
test('rejects money, deploy, profile access, unapproved and closed work',()=>{
 for(const change of [{requires_spend:true},{requires_deploy:true},{requires_profile_access:true},{approved_for_agent:false},{state:'closed'},{risk:'production'},{type:'pull_request'}]){
   assert.equal(selectTask([{...base,...change}],[76]),null);
 }
});
test('empty and malformed tasks cannot run',()=>{
 assert.equal(selectTask([], [76]),null);
 assert.equal(selectTask([{...base,number:'76'}],[76]),null);
 assert.throws(()=>selectTask(null,[76]),TypeError);
});
