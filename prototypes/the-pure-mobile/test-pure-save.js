// Regression tests for Pure save reliability — issue #57
// Cases: completed, partial, interrupted, recovered
'use strict';

const { createStore } = require('./pure-session-store.js');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; console.log('  PASS:', msg); }
  else { failed++; console.log('  FAIL:', msg); }
}

function run() {
  console.log('Pure save reliability tests — 2026-10-31');

  // Case 1: completed session archives with outcome completed
  {
    const { load, save, archiveCompleted } = createStore();
    let s = { v: 1, phase: 'active', sessionId: 'sess-1', startedAt: 1000, counts: [{ push: 10 }, {}, {}], history: [] };
    save(s);
    archiveCompleted(s, 5000);
    const loaded = load();
    assert(loaded.history.length === 1, 'completed: history length 1');
    assert(loaded.history[0].outcome === 'completed', 'completed: outcome completed');
    assert(loaded.history[0].sessionId === 'sess-1', 'completed: sessionId preserved');
  }

  // Case 2: partial / early end archives as partial
  {
    const { load, archivePartial } = createStore();
    let s = { v: 1, phase: 'rest', sessionId: 'sess-2', startedAt: 2000, counts: [{ push: 8, pull: 6 }, {}, {}], history: [] };
    archivePartial(s, 4000);
    const loaded = load();
    assert(loaded.history[0].outcome === 'partial', 'partial: outcome partial');
    assert(loaded.history[0].endedEarly === true, 'partial: endedEarly true');
    assert(loaded.phase === 'complete', 'partial: phase complete');
  }

  // Case 3: interrupted (save during active) then recovered
  {
    const store = {};
    const mem = {
      getItem(k) { return store[k] ?? null; },
      setItem(k, v) { store[k] = String(v); }
    };
    const { save, load, restore } = createStore(mem);
    let s = { v: 1, phase: 'active', sessionId: 'sess-3', startedAt: 3000, counts: [{ push: 5 }, {}, {}], round: 1, history: [] };
    const res = save(s);
    assert(res.ok === true, 'interrupted: save ok');
    const loaded = load();
    const restored = restore(loaded);
    assert(restored.phase === 'active', 'recovered: phase active');
    assert(restored.counts[0].push === 5, 'recovered: reps preserved');
    assert(restored.sessionId === 'sess-3', 'recovered: sessionId preserved');
  }

  // Case 4: storage failure returns ok:false
  {
    const bad = {
      getItem() { return null; },
      setItem() { throw new Error('QuotaExceeded'); }
    };
    const { save } = createStore(bad);
    const res = save({ v: 1 });
    assert(res.ok === false, 'storage failure: returns ok false');
    assert(res.error.includes('Quota'), 'storage failure: error message');
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
