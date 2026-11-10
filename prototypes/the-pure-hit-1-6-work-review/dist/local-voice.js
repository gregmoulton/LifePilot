'use strict';

const PureLocalVoice = (() => {
  const modelUrl = 'https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-en-us-0.15.tar.gz';
  const units = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const counts = [...units, ...teens, ...tens.flatMap(ten => [ten, ...units.slice(1).map(unit => ten + ' ' + unit)])];
  const grammar = JSON.stringify([
    ...counts.flatMap(count => [count + ' reps', 'correction ' + count + ' reps']),
    'pause workout', 'end workout', 'save workout', 'discard workout', 'confirm', 'cancel', '[unk]'
  ]);

  async function loadModel() {
    if (!globalThis.Vosk) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'voice-music-vosk.js';
        script.onload = resolve;
        script.onerror = () => {
          script.remove();
          reject(new Error('Voice library could not load.'));
        };
        document.head.append(script);
      });
    }

    return new Promise((resolve, reject) => {
      const model = new Vosk.Model(modelUrl, -2);
      let settled = false;
      const timer = setTimeout(() => fail('Voice model load timed out.'), 90000);
      function fail(message) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        model.terminate();
        reject(new Error(message));
      }
      model.on('error', () => fail('Voice model could not load.'));
      model.on('load', event => {
        if (settled) return;
        if (!event.result) {
          fail('Voice model could not load.');
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve(model);
      });
    });
  }

  return class LocalVoice {
    constructor({ onState, onError, onText }) {
      Object.assign(this, { onState, onError, onText });
      this.listening = false;
      this.wanted = false;
      this.running = false;
      this.needsGesture = false;
    }

    async prepare() {
      this.model ??= await loadModel();
    }

    async start({ gesture = false } = {}) {
      if (gesture) this.needsGesture = false;
      if (this.running || this.needsGesture) return;
      if (!this.model) {
        this.onError('Load local voice before starting, or enter reps on screen.');
        return;
      }

      let session;
      try {
        const context = new AudioContext({ sampleRate: 16000 });
        session = { context };
        this.session = session;
        this.running = this.wanted = true;
        this.onState('Opening local microphone…');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (this.session !== session) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        session.stream = stream;
        await context.audioWorklet.addModule('voice-music-worklet.js');
        await context.resume();
        if (this.session !== session) return;

        const recognizer = new this.model.KaldiRecognizer(context.sampleRate, grammar);
        session.recognizer = recognizer;
        recognizer.on('result', ({ result }) => {
          if (this.session === session && result?.text && !result.text.includes('[unk]')) {
            this.onText(result.text);
          }
        });
        recognizer.on('error', () => {
          if (this.session === session) this.fail('Local recognition stopped. Tap Enable voice to retry.');
        });

        const capture = new AudioWorkletNode(context, 'pure-voice-capture');
        capture.port.onmessage = ({ data }) => {
          if (this.session === session) recognizer.acceptWaveformFloat(data, context.sampleRate);
        };
        // The worklet passes samples to the worker and emits silence.
        context.createMediaStreamSource(stream).connect(capture).connect(context.destination);
        this.listening = true;
        this.onState('Local voice listening. Say “five reps”.');
      } catch (error) {
        if (!session || this.session === session) this.fail('Local microphone: ' + error.message);
      }
    }

    fail(message) {
      this.needsGesture = true;
      this.stop();
      this.onError(message);
    }

    stop() {
      const session = this.session;
      this.session = undefined;
      this.listening = this.wanted = this.running = false;
      if (session) {
        session.stream?.getTracks().forEach(track => track.stop());
        session.recognizer?.remove();
        session.context.close().catch(() => {});
      }
      this.onState('Microphone off.');
    }
  };
})();
