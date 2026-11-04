import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../execution.js', import.meta.url), 'utf8');
const start = source.indexOf('function taskResult(id)');
const end = source.indexOf('function recordObservation(e)', start);
const handler = source.slice(start, end);

test('task result rejects blank actual-minute input before numeric conversion', () => {
  assert.ok(start >= 0 && end > start, 'real task handler exists');
  assert.match(handler, /raw\.trim\(\)\s*===\s*['"]{2}/);
  assert.ok(handler.indexOf('raw.trim()') < handler.indexOf('Number(raw)'));
});
test('explicit 0 and normal minutes retain numeric conversion', () => {
  assert.match(handler, /Number\(raw\)/);
  assert.match(handler, /completeTask\(id,status,Number\(raw\)\)/);
});
test('canceled input remains rejected', () => {
  assert.match(handler, /raw===null/);
  assert.match(handler, /status===null/);
});
