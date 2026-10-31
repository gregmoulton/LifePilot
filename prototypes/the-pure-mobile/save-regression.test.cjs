'use strict';
// Regression tests against the actual workout HTML, rather than the isolated handoff module.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
function appCase(options = {}) {
  const db = {};
  if (options.existing !== undefined) db.the_pure_mobile_proto_v1 = options.existing;
  const handlers = {}, alerts = [];
  let writes = 0;
  const app = {
    innerHTML: '',
    querySelector(id) { return { addEventListener(_event, fn) { handlers[id] = fn; }, textContent: '' }; },
    querySelectorAll() { return []; }
  };
  const storage = {
    getItem(key) {
      if (options.readFail) throw new Error('read denied');
      return db[key] ?? null;
    },
    setItem(key, value) {
      writes += 1;
      if (options.failAt === writes) throw new Error('quota');
      db[key] = String(value);
      if (options.corruptAt === writes) db[key] = 'corrupted';
    }
  };
  vm.runInNewContext(script, {
    document: { getElementById() { return app; } }, localStorage: storage,
    setInterval() {}, alert(message) { alerts.push(message); },
    confirm() { return true; }, navigator: {}, window: { addEventListener() {} },
    Date, Set, Number, String, Object, Array, JSON, Math, Error
  });
  return {
    click(id) { assert.ok(handlers[id], 'missing handler ' + id); handlers[id](); },
    data() { return db.the_pure_mobile_proto_v1 && JSON.parse(db.the_pure_mobile_proto_v1); },
    get writes() { return writes; }, alerts
  };
}
test('start saves a verified active workout', () => {
  const a = appCase();
  a.click('#start');
  assert.equal(a.data().phase, 'active');
});
test('ending early archives a partial workout', () => {
  const a = appCase();
  a.click('#start');
  a.click('#earlyEnd');
  assert.equal(a.data().phase, 'complete');
  assert.equal(a.data().history.length, 1);
  assert.equal(a.data().history[0].endedEarly, true);
});
test('failed end save rolls back completed state and preserves prior history', () => {
  const a = appCase({ failAt: 2 });
  a.click('#start');
  a.click('#earlyEnd');
  assert.equal(a.data().phase, 'active');
  assert.equal(a.data().history.length, 0);
  assert.equal(a.alerts.length, 1);
});
test('failed first save warns without false persistence', () => {
  const a = appCase({ failAt: 1 });
  a.click('#start');
  assert.equal(a.data(), undefined);
  assert.equal(a.alerts.length, 1);
});
test('invalid pre-existing data is not overwritten', () => {
  const a = appCase({ existing: '{bad json' });
  a.click('#start');
  assert.equal(a.writes, 0);
  assert.equal(a.alerts.length, 1);
});
test('read-back mismatch warns user', () => {
  const a = appCase({ corruptAt: 1 });
  a.click('#start');
  assert.equal(a.alerts.length, 1);
});
