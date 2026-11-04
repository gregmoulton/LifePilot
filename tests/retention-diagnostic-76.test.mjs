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

test('v0.4 startup never silently discards unrecognized saved bytes', async () => {
  const {readFileSync} = await import('node:fs');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /storageProblem='invalid-json'/);
  assert.match(html, /storageProblem='invalid-shape'/);
  assert.match(html, /Download original backup/);
  assert.match(html, /new Blob\(\[raw\]/);
  assert.doesNotMatch(html, /storageProblem=null;render\(\);alert\('Original backup download requested/);
  assert.match(html, /Saved profile remains protected/);
  assert.match(html, /if\(storageProblem\)\{alert\('Download the original saved profile before replacing it/);
  assert.match(html, /if\(storageProblem\)\{alert\('Download the original saved profile before importing/);
  const scripts = [...html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  assert.ok(scripts.length >= 2);
  for (const script of scripts) new Function(script);
});
