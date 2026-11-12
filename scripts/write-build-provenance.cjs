'use strict';

const { execFileSync } = require('node:child_process');
const { readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { validate } = require('../prototypes/the-pure-hit-1-6-work-review/dist/provenance.js');

const [configPath, outputPath] = process.argv.slice(2);
if (!configPath || !outputPath) {
  throw new Error('Usage: node scripts/write-build-provenance.cjs CONFIG OUTPUT');
}
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const git = (...args) => execFileSync('git', args, {
  cwd: resolve(__dirname, '..'), encoding: 'utf8'
}).trim();
const commit = git('rev-parse', '--verify', (config.commit || 'HEAD') + '^{commit}');
const manifest = validate({
  ...config,
  commit,
  createdAt: config.createdAt ?? null,
  updatedAt: new Date(git('show', '-s', '--format=%cI', commit)).toISOString(),
  builtAt: config.builtAt || new Date().toISOString(),
  origin: config.origin ?? null,
  automatedTest: config.automatedTest ?? null,
  deployed: config.deployed ?? null,
  androidTest: config.androidTest ?? null,
  ownerAccepted: config.ownerAccepted ?? null
});
writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + '\n');
