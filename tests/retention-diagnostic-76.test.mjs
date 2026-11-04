import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyProfileBytes as classify } from './retention-diagnostic-76.mjs';

test('absent, corrupt and malformed profiles are distinct', () => {
  assert.deepEqual(classify(null), {status:'absent'});
  assert.deepEqual(classify('{broken'), {status:'invalid-json'});
  assert.deepEqual(classify('null'), {status:'invalid-shape'});
  assert.deepEqual(classify('{"goals":{}}'), {status:'invalid-shape'});
  assert.deepEqual(classify('{"goals":[],"decision_register":{}}'), {status:'invalid-shape'});
});
test('fictional empty and populated profiles retain distinct counts', () => {
  assert.deepEqual(classify('{"goals":[]}'), {status:'empty',goalCount:0,decisionCount:0});
  assert.deepEqual(classify(JSON.stringify({
    goals:[{id:'fictional-1',name:'Fictional goal'}],
    decision_register:[{id:'fictional-decision'}]
  })), {status:'populated',goalCount:1,decisionCount:1});
});
test('classification never mutates caller-provided bytes', () => {
  const raw='{"goals":[{"id":"fictional-1"}]}';
  classify(raw);
  assert.equal(raw,'{"goals":[{"id":"fictional-1"}]}');
});
