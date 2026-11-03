import test from 'node:test';
import assert from 'node:assert/strict';
import {runSyntheticConnectorProbe, PROBE_ENDPOINT, EXPECTED_CODE} from './runner-openrouter-connector.mjs';

const base = {approved: true, apiKey: 'synthetic-secret', fetchImpl: async () => ({
  ok: true,
  json: async () => ({model: 'some-free-model', choices: [{message: {content: EXPECTED_CODE}}], usage: {total_tokens: 34}}),
})};

test('blocks by default, before any network call', async () => {
  let calls = 0;
  const opts = {...base, fetchImpl: async () => { calls++; throw Error('called'); }};
  assert.equal((await runSyntheticConnectorProbe({...opts, approved: false})).status, 'blocked');
  assert.equal((await runSyntheticConnectorProbe({...opts, apiKey: ''})).status, 'blocked');
  assert.equal((await runSyntheticConnectorProbe({...opts, model: 'openai/some-paid-model'})).status, 'blocked');
  assert.equal((await runSyntheticConnectorProbe({...opts, maxSpendUsd: 0.01})).status, 'blocked');
  assert.equal(calls, 0);
});

test('sends one fixed fictional free-model request; hides API key and full model output', async () => {
  let calls = 0;
  const result = await runSyntheticConnectorProbe({...base, fetchImpl: async (url, init) => {
    calls++;
    assert.equal(url, PROBE_ENDPOINT);
    assert.equal(init.method, 'POST');
    assert.equal(init.headers.Authorization, 'Bearer synthetic-secret');
    const payload = JSON.parse(init.body);
    assert.equal(payload.model, 'openrouter/free');
    assert.equal(payload.messages.length, 2);
    assert.match(payload.messages[1].content, /fictional snippet/);
    assert.equal(payload.max_completion_tokens, 96);
    assert.equal(payload.stream, false);
    return base.fetchImpl();
  }});
  assert.equal(calls, 1);
  assert.deepEqual(result, {status: 'response-received', exactMatch: true, reportedModel: 'some-free-model', tokens: 34});
  assert.doesNotMatch(JSON.stringify(result), /synthetic-secret/);
});

test('handles incorrect answer, HTTP errors, invalid responses and transport failures without retries', async () => {
  const cases = [
    [async () => ({ok: true, json: async () => ({choices: [{message: {content: 'No'}}]})}), 'response-received'],
    [async () => ({ok: false, status: 429}), 'api-error'],
    [async () => ({ok: true, json: async () => ({choices: []})}), 'invalid-response'],
    [async () => {throw Error('offline');}, 'transport-error'],
  ];
  for (const [fetchImpl, expected] of cases) {
    let calls = 0;
    const result = await runSyntheticConnectorProbe({...base, fetchImpl: async (...args) => { calls++; return fetchImpl(...args); }});
    assert.equal(result.status, expected);
    if (expected === 'response-received') assert.equal(result.exactMatch, false);
    assert.equal(calls, 1);
  }
});

test('stops hung calls by abort signal and reports timeout', async () => {
  const fetchImpl = async (_url, {signal}) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), {name: 'AbortError'})), {once: true});
  });
  assert.equal((await runSyntheticConnectorProbe({...base, fetchImpl, timeoutMs: 100})).status, 'timeout');
});
