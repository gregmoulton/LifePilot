// Isolated Pure session store — save reliability fixes for issue #57
// Arizona time: 2026-10-31
'use strict';

const KEY = 'the_pure_mobile_proto_v1';

function createStore(storage) {
  const store = storage || {
    _data: {},
    getItem(k) { return this._data[k] ?? null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; }
  };

  function load() {
    try {
      const raw = store.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.v === 1) return parsed;
      return null;
    } catch (e) {
      return null;
    }
  }

  function save(state) {
    try {
      store.setItem(KEY, JSON.stringify(state));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  function archivePartial(state, now = Date.now()) {
    const entry = {
      sessionId: state.sessionId || crypto.randomUUID(),
      startedAt: state.startedAt,
      endedAt: now,
      endedEarly: true,
      outcome: 'partial',
      counts: JSON.parse(JSON.stringify(state.counts || [])),
      orders: JSON.parse(JSON.stringify(state.roundOrders || [])),
      roundEnds: JSON.parse(JSON.stringify(state.roundEnds || [])),
      restEnds: JSON.parse(JSON.stringify(state.restEnds || [])),
      pausedMs: state.pausedMs || 0,
      phaseAtEnd: state.phase
    };
    state.history = [...(state.history || []), entry].slice(-20);
    state.phase = 'complete';
    state.endedAt = now;
    state.endedEarly = true;
    return save(state);
  }

  function archiveCompleted(state, now = Date.now()) {
    const entry = {
      sessionId: state.sessionId || crypto.randomUUID(),
      startedAt: state.startedAt,
      endedAt: now,
      endedEarly: false,
      outcome: 'completed',
      counts: JSON.parse(JSON.stringify(state.counts || [])),
      orders: JSON.parse(JSON.stringify(state.roundOrders || [])),
      roundEnds: JSON.parse(JSON.stringify(state.roundEnds || [])),
      restEnds: JSON.parse(JSON.stringify(state.restEnds || [])),
      pausedMs: state.pausedMs || 0
    };
    state.history = [...(state.history || []), entry].slice(-20);
    state.phase = 'complete';
    state.endedAt = now;
    state.endedEarly = false;
    return save(state);
  }

  function restore(state) {
    if (!state) return null;
    return {
      ...state,
      history: state.history || [],
      phase: state.phase || 'welcome'
    };
  }

  return { load, save, archivePartial, archiveCompleted, restore };
}

module.exports = { createStore, KEY };
