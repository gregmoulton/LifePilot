'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const app = require('../dist/app.js');
const ladder = require('../dist/ladder.js');
const journal = require('../dist/journal.js');
const previous = require('../../recovery/the-pure-android-chatgpt-site/source/dist/app.js');

globalThis.PureLadder = ladder; // The browser loads ladder.js before journal.js.
const at = Date.parse('2026-01-01T00:00:00Z');
const stamp = new Date(at).toISOString();
const stepUp = 'squat-4-step-up';
const muscleUp = 'pull-elite-muscle-up';

function workout(id, status, setup) {
  const move = ladder.moveFor(stepUp, setup);
  return {
    schema: 'the-pure-hit-v2', id, status, started: stamp, ended: stamp,
    exercisePlan: ladder.planFor(setup),
    records: [{
      exercise: move.category, exerciseName: move.name, exerciseId: move.exerciseId,
      variation: move.variant, rung: move.rung, ladderVersion: move.ladderVersion,
      round: 'maximum', reps: 14, sideReps: { left: 15, right: 14 }, timestamp: stamp
    }],
    heartRateReadings: [{ timestamp: stamp, bpm: 110 }],
    recoveries: [{ durationSeconds: 37, lastRecordedBpm: 110 }]
  };
}

function backup(db) {
  return JSON.stringify({
    schema: 'the-pure-backup-v2', history: db.history, active: db.active,
    settings: db.settings, legacyHistory: db.legacyHistory || []
  });
}

function read(store, engine) {
  return engine.load({ getItem: key => key === engine.KEY ? JSON.stringify(store) : null }, at);
}

test('independent catalog check covers 18 ordered IDs and three separate ELITE tracks', () => {
  const expected = {
    Push: ['push-1-knee-incline', 'push-2-standard', 'push-3-decline', 'push-4-ring', 'push-5-bar-dips', 'push-6-ring-dips', 'push-elite-weighted-ring-dips'],
    Squat: ['squat-1-chair', 'squat-2-bodyweight', 'squat-3-jump', 'squat-4-step-up', 'squat-5-bulgarian', 'squat-6-pistol', 'squat-elite-weighted-pistol'],
    Pull: ['pull-1-inverted-bent', 'pull-2-inverted-straight', 'pull-3-assisted', 'pull-4-pullup', 'pull-5-ring-pullup', 'pull-6-assisted-archer', muscleUp]
  };
  for (const [category, ids] of Object.entries(expected)) {
    const moves = ladder.rungs(category);
    assert.deepEqual(moves.map(move => move.id), ids);
    assert.deepEqual(moves.map(move => move.graduate), category === 'Squat'
      ? [30, 30, 30, 15, 15, 15, null] : [15, 15, 15, 15, 15, 15, null]);
    assert.equal(ladder.next(ids[5]).id, ids[6]);
    assert.equal(ladder.next(ids[6]), null);
  }
});

test('synthetic HIT export and restore preserve rows, setup, inactive rung and achievement through a rollback read', () => {
  let state = ladder.setCurrent(ladder.fresh(at), stepUp, at);
  state = ladder.setConfig(state, stepUp, { boxIn: 14 }, at);
  const historicalSetup = state;
  state = ladder.setCurrent(state, 'squat-3-jump', at);
  state = ladder.setCurrent(state, muscleUp, at);
  state = ladder.confirmAchievement(state, 'first-clean-muscle-up', at);
  const source = {
    ...app.fresh(), settings: { ladder: state },
    history: [workout('synthetic-complete', 'complete', historicalSetup), workout('synthetic-partial', 'partial', historicalSetup)]
  };
  const parsed = journal.parseBackup(backup(source));
  const restored = journal.merge(app.fresh(), parsed);
  assert.deepEqual(restored.history, source.history);
  assert.deepEqual(restored.settings.ladder, state);
  assert.deepEqual(journal.merge(restored, parsed), restored);
  assert.equal(restored.history[0].records[0].variation, '14-in box');
  assert.notEqual(restored.settings.ladder.current.Squat, stepUp);

  assert.equal(app.KEY, previous.KEY);
  const rolledBack = read(restored, previous);
  assert.deepEqual(rolledBack.history, source.history);
  assert.deepEqual(rolledBack.settings.ladder, state);
  assert.deepEqual(read(rolledBack, app).history, source.history);
});

test('checkpoint merge is separate from restore and restores paused without duplicate history', () => {
  const active = app.startHandsFree(at, 'synthetic-active', { exercisePlan: ladder.planFor(ladder.fresh(at)) });
  const store = { ...app.fresh(), active };
  const parsed = journal.parseBackup(backup(store));
  const merged = journal.merge(app.fresh(), parsed);
  assert.equal(merged.active, null);
  const restored = app.restoreActive(merged, parsed.active, at + 10000);
  assert.equal(restored.active.id, active.id);
  assert.equal(restored.active.paused, true);
  assert.deepEqual(restored.active.exercisePlan, active.exercisePlan);
  assert.equal(restored.history.length, 0);
  assert.throws(() => app.restoreActive(restored, active, at), /current session/);
});

test('original Phone V2 complete and unfinished rows stay outside HIT and repeat without duplicates', () => {
  const original = { startedAt: at, finishedAt: at + 5000, outcome: 'complete', counts: [{ push: 12 }] };
  const parsed = journal.parseBackup(JSON.stringify({
    app: journal.PHONE_V2_APP, version: 2, phase: 'exercise',
    startedAt: at + 6000, counts: [{ legs: 14 }], history: [original]
  }));
  const restored = journal.merge(app.fresh(), parsed);
  assert.equal(restored.history.length, 0);
  assert.equal(restored.active, null);
  assert.equal(restored.legacyHistory.length, 2);
  assert.deepEqual(restored.legacyHistory[0].originalWorkout, original);
  assert.equal(restored.legacyHistory[1].unfinishedAtExport, true);
  assert.deepEqual(journal.merge(restored, parsed), restored);
});

test('conflicting IDs reject the whole merge and leave the destination intact', () => {
  const state = ladder.fresh(at);
  const row = workout('synthetic-conflict', 'complete', state);
  const dest = { ...app.fresh(), history: [row] };
  const before = backup(dest);
  const conflicting = { ...row, status: 'partial' };
  const parsed = journal.parseBackup(backup({
    ...dest, history: [workout('synthetic-new', 'partial', state), conflicting]
  }));
  assert.throws(() => journal.merge(dest, parsed), /Conflicting record ID/);
  assert.equal(backup(dest), before);
});
