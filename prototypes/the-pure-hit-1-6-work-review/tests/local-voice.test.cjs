'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

const source = readFileSync('dist/local-voice.js', 'utf8');

function harness(getUserMedia) {
  const state = { stops: 0, removes: 0, closes: 0, texts: [] };
  const stream = { getTracks: () => [{ stop: () => state.stops++ }] };
  const LocalVoice = vm.runInNewContext(source + '\nPureLocalVoice', {
    AudioContext: class {
      sampleRate = 16000;
      audioWorklet = { addModule: async () => {} };
      resume = async () => {};
      close = async () => { state.closes++; };
      createMediaStreamSource() { return { connect: capture => capture }; }
    },
    AudioWorkletNode: class { port = {}; connect() {} },
    navigator: { mediaDevices: { getUserMedia: () => getUserMedia(stream) } }
  });
  const voice = new LocalVoice({
    onState() {},
    onError: message => { throw Error(message); },
    onText: text => state.texts.push(text)
  });
  voice.model = {
    KaldiRecognizer: class {
      on(event, callback) { if (event === 'result') state.result = callback; }
      remove() { state.removes++; }
    }
  };
  return { state, stream, voice };
}

test('local voice delivers recognized rep phrases, discards unknowns and releases the mic', async () => {
  const { state, voice } = harness(async stream => stream);
  await voice.start();
  assert.equal(voice.listening, true);
  state.result({ result: { text: 'five reps' } });
  state.result({ result: { text: '[unk]' } });
  voice.stop();
  state.result({ result: { text: 'ten reps' } });
  assert.deepEqual(state.texts, ['five reps']);
  assert.equal(voice.listening, false);
  assert.equal(state.stops, 1);
  assert.equal(state.removes, 1);
  assert.equal(state.closes, 1);
});

test('stopping during the permission prompt releases a late microphone stream', async () => {
  let resolve;
  const { state, stream, voice } = harness(() => new Promise(done => { resolve = done; }));
  const starting = voice.start();
  voice.stop();
  resolve(stream);
  await starting;
  assert.equal(voice.listening, false);
  assert.equal(state.stops, 1);
  assert.equal(state.removes, 0);
});
