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

test('startup never silently discards unrecognized saved bytes (integrated storage.js)', async () => {
  const {readFileSync} = await import('node:fs');
  const {createRequire} = await import('node:module');
  const Storage = createRequire(import.meta.url)('../storage.js');
  for (const raw of ['{not json', '{"goals":"wrong-shape"}', '[1,2,3]']) {
    let value = raw, writes = 0;
    const storage = {getItem: () => value, setItem: v => { writes++; value = v; }, removeItem: () => { writes++; value = null; }};
    const handle = Storage.open({storage, key: 'lifepilot-v02-profile', locks: {request: (n, f) => f()}});
    assert.equal(writes, 0, 'opening must not write');
    assert.equal(value, raw, 'original bytes preserved: ' + raw);
    assert.equal(handle.blocked, true, 'unreadable profile must block saving');
    assert.equal(handle.writable, false);
  }
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /exportRecovery\('stored'\)/);
  const scripts = [...html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  assert.ok(scripts.length >= 2);
  for (const script of scripts) new Function(script);
});

test('import rejects unstable goal IDs and missing decision register before replacement', async () => {
  const {readFileSync} = await import('node:fs');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /Import refused: every goal must have a stable string ID/);
  assert.match(html, /Import refused: existing decisions would be lost/);
  assert.match(html, /Import refused: invalid decision register/);
  assert.ok(html.indexOf('Import refused: every goal') < html.indexOf('Replace the current local profile?'));
});
