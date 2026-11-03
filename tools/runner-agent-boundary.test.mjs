import test from 'node:test';
import assert from 'node:assert/strict';
import {planAgentRun} from './runner-agent-boundary.mjs';
const safe={task:{number:76},modelAccess:{verifiedFree:true,providerApproved:true},budget:{maxChargeUsd:0,enforced:true},permissions:{syntheticOnly:true,draftPrOnly:true,deploy:false,profileAccess:false,merge:false}};
test('fails closed with no verified model entitlement',()=>assert.equal(planAgentRun({...safe,modelAccess:{}}).status,'blocked'));
test('rejects any unbounded spending',()=>assert.equal(planAgentRun({...safe,budget:{maxChargeUsd:1,enforced:true}}).status,'blocked'));
test('rejects deployment and real profile permissions',()=>{
 for(const change of [{deploy:true},{profileAccess:true},{merge:true},{draftPrOnly:false}])
  assert.equal(planAgentRun({...safe,permissions:{...safe.permissions,...change}}).status,'blocked');
});
test('permits only safe reviewed execution planning',()=>assert.deepEqual(planAgentRun(safe),{status:'ready-for-isolated-review',taskNumber:76}));
