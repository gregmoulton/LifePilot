import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(Boolean);
const execution = readFileSync(new URL('../execution.js', import.meta.url), 'utf8');
const KEY = 'lifepilot-v02-profile';
assert.equal(scripts.length, 2, 'exercise the two actual inline app scripts');

function boot(initial) {
  const data = new Map(initial === null ? [] : [[KEY, initial]]);
  const alerts = [], downloads = [];
  const nodes = new Map();
  const document = {
    querySelector: () => null,
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, {innerHTML:'', textContent:'', style:{}});
      return nodes.get(id);
    },
    createElement(tag) {
      assert.equal(tag, 'a');
      return {click() { downloads.push(this.download); }};
    }
  };
  const context = vm.createContext({
    document, console, Blob, Date, Math,
    localStorage: {
      getItem: key => data.has(key) ? data.get(key) : null,
      setItem: (key, value) => data.set(key, value),
      removeItem: key => data.delete(key)
    },
    URL: {createObjectURL: () => 'blob:fictional', revokeObjectURL() {}},
    setTimeout() {},
    alert: message => alerts.push(message),
    confirm: () => true
  });
  vm.runInContext(scripts[0], context);
  vm.runInContext(execution, context);
  vm.runInContext(scripts[1], context);
  return {context, data, alerts, downloads, html: () => nodes.get('app').innerHTML};
}

test('invalid JSON survives boot, backup request, blocked reset and import, and reload', async () => {
  const raw = '{broken fictional data';
  const app = boot(raw);
  assert.match(app.html(), /Saved profile needs attention/);
  vm.runInContext('downloadUnrecognizedProfile()', app.context);
  assert.equal(app.downloads.length, 1);
  vm.runInContext('fresh()', app.context);
  await vm.runInContext('importFile({text: async () => JSON.stringify({goals:[]})})', app.context);
  assert.equal(app.data.get(KEY), raw);
  assert.match(app.alerts.join(' '), /protected|before replacing|before importing/i);
  const reload = boot(app.data.get(KEY));
  assert.match(reload.html(), /Saved profile needs attention/);
  assert.equal(reload.data.get(KEY), raw);
});

test('structurally invalid profile is protected without normalizing bytes', () => {
  const raw = JSON.stringify({goals:{id:'fictional'}, decision_register:[{id:'fictional-d'}]});
  const app = boot(raw);
  assert.match(app.html(), /Saved profile needs attention/);
  vm.runInContext('fresh()', app.context);
  assert.equal(app.data.get(KEY), raw);
});

test('fictional goal IDs and decision IDs survive real app reload and status update', () => {
  const raw = JSON.stringify({
    schema_version:'0.2', goals:[{id:'fixture-goal-1',name:'Fixture Goal',status:'active',next_actions:[]}],
    decision_register:[{id:'fixture-decision-1',decision:'Fixture decision',status:'approved'}]
  });
  const app = boot(raw);
  assert.match(app.html(), /Fixture Goal/);
  vm.runInContext("setStatus('fixture-goal-1','paused')", app.context);
  const persisted = JSON.parse(app.data.get(KEY));
  assert.equal(persisted.goals[0].id, 'fixture-goal-1');
  assert.equal(persisted.goals[0].status, 'paused');
  assert.equal(persisted.decision_register[0].id, 'fixture-decision-1');
  const reload = boot(app.data.get(KEY));
  assert.match(reload.html(), /Fixture Goal/);
  assert.equal(JSON.parse(reload.data.get(KEY)).decision_register[0].id, 'fixture-decision-1');
});
