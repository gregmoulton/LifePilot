'use strict';

const { createHash } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const [bundlePath, outputDirectory] = process.argv.slice(2);
if (!bundlePath || !outputDirectory) {
  throw new Error('Usage: node scripts/prepare-pure-local-voice.cjs VOSK_JS OUTPUT_DIRECTORY');
}

const bundle = readFileSync(bundlePath);
const expected = '9eac98f1c9477fddee0581648240024a1313baf137539ef25d225a7f45acf9783372851ee8e07fd4188e7c7a8a3967a0';
if (createHash('sha384').update(bundle).digest('hex') !== expected) {
  throw new Error('Expected the pinned vosk-browser@0.0.8 distribution bundle.');
}

// Emscripten requires dynamic evaluation inside the recognizer. Keep it in a
// separate worker file so the workout document can retain its strict script CSP.
const workerDefinition = /var WorkerFactory = createBase64WorkerFactory\('([A-Za-z0-9+/=]+)'[^\n]*\);/;
const source = bundle.toString('utf8');
const worker = workerDefinition.exec(source);
if (!worker) throw new Error('Embedded Vosk worker was not found.');
writeFileSync(join(outputDirectory, 'voice-music-vosk-worker.js'), Buffer.from(worker[1], 'base64'));
writeFileSync(join(outputDirectory, 'voice-music-vosk.js'), source.replace(worker[0],
  "function WorkerFactory() { return new Worker('voice-music-vosk-worker.js'); }"));
