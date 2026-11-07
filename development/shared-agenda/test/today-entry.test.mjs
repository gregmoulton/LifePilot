import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/agenda.js', import.meta.url), 'utf8');

test('Today has a visible new-goal shortcut that reuses the existing goal editor', () => {
  assert.match(source, /onclick="showTab\('goals'\);openGoalForm\(\)">\+ New Goal<\/button>/);
});

test('quick task entry defaults to the local calendar day, with explicit unscheduled choice', () => {
  assert.match(source, /id="agendaDue" type="date" value="\$\{agendaTodayDate\(\)\}"/);
  assert.match(source, /onclick="document\.getElementById\('agendaDue'\)\.value=''">Unscheduled/);
  const helper = source.match(/function agendaTodayDate\(now=new Date\(\)\)\{[^\n]+\}/);
  assert.ok(helper, 'today date helper exists');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(helper[0] + ';globalThis.result=agendaTodayDate(new Date(2026,9,30,23,59));', ctx);
  assert.equal(ctx.result, '2026-10-30');
});
