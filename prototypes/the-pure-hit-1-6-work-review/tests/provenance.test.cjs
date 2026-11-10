'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { formatTime, validate, checkLocation } = require('../dist/provenance.js');

const commit = 'a'.repeat(40);
const origin = 'https://preview.example.com';
const build = {
  project: 'The Pure',
  version: 'HIT 1.6',
  branch: 'fix/example',
  repository: 'owner/repo',
  review: 'https://github.com/owner/repo/pull/1',
  environment: 'Android review',
  status: 'active',
  nextStep: 'Run physical Android acceptance.',
  origin,
  commit,
  createdAt: null,
  updatedAt: '2026-11-06T19:00:00.000Z',
  builtAt: '2026-11-07T01:00:00.000Z',
  automatedTest: null,
  deployed: null,
  androidTest: null,
  ownerAccepted: null
};

test('UTC date rollover and summer dates display in Phoenix MST', () => {
  assert.match(formatTime('2026-11-07T01:00:00.000Z'), /Nov 6, 2026.*6:00:00 PM MST/);
  assert.match(formatTime('2026-07-01T06:00:00.000Z'), /Jun 30, 2026.*11:00:00 PM MST/);
  assert.equal(formatTime('2026-02-30T01:00:00.000Z'), 'Unknown');
  assert.equal(formatTime(null), 'Unknown');
});

test('a stale or conflicting URL cannot claim current preview identity', () => {
  assert.equal(checkLocation(build, origin + '/?build=' + commit), null);
  assert.match(checkLocation(build, origin + '/?build=' + 'b'.repeat(40)), /different commit/);
  assert.match(checkLocation(build, 'https://old.example.com/'), /different origin/);
  assert.throws(() => validate({...build, commit: 'abc'}), /invalid/);
});

test('automated, deployment, physical and acceptance evidence stay distinct', () => {
  const evidence = {at: '2026-11-07T02:00:00.000Z', commit, origin, reference: 'test receipt'};
  assert.doesNotThrow(() => validate({...build, automatedTest: evidence}));
  assert.throws(() => validate({...build, status: 'verified', automatedTest: evidence}), /owner acceptance/);
  assert.throws(() => validate({...build, status: 'deployed'}), /Deployment evidence/);
  assert.throws(() => validate({...build, ownerAccepted: evidence}), /physical test/);
  assert.throws(() => validate({...build, androidTest: {...evidence, origin: 'https://old.example.com'}}), /origin/);
  assert.throws(() => validate({...build, androidTest: {...evidence, commit: 'b'.repeat(40)}}), /conflicting/);
  assert.doesNotThrow(() => validate({...build, status: 'verified', androidTest: evidence, ownerAccepted: evidence}));
});
