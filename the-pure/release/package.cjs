'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { validate } = require('../dist/provenance.js');

function stampRelease(directory, build) {
  validate(build);
  const worker = path.join(directory, 'sw.js');
  let source = fs.readFileSync(worker, 'utf8');
  const cache = /^const CACHE='the-pure-shell-[^']+';$/gm;
  const shell = /^const FILES=\[/gm;
  if ([...source.matchAll(cache)].length !== 1 || [...source.matchAll(shell)].length !== 1) {
    throw new Error('Unexpected service worker declarations');
  }
  source = source.replace(cache, "const CACHE='the-pure-shell-release-" + build.commit + "';")
    .replace(shell, "const FILES=['./build-info.json',");
  fs.writeFileSync(path.join(directory, 'build-info.json'), JSON.stringify(build, null, 2) + '\n');
  fs.writeFileSync(worker, source);
}

function packageRelease(output, commit, origin) {
  if (!output || !/^[a-f0-9]{40}$/.test(commit || '')) throw new Error('Provide output and full approved commit SHA');
  if (new URL(origin).protocol !== 'https:' || new URL(origin).origin !== origin) {
    throw new Error('Provide the exact HTTPS release origin');
  }
  const root = path.resolve(__dirname, '../..');
  const git = (...args) => execFileSync('git', args, { cwd: root });
  if (git('rev-parse', 'HEAD').toString().trim() !== commit) throw new Error('Checkout differs from the approved commit');
  const builtAt = new Date().toISOString();
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'pure-release-'));
  try {
    const archive = path.join(scratch, 'dist.tar');
    git('archive', '--output=' + archive, commit, 'the-pure/dist');
    fs.mkdirSync(output);
    execFileSync('tar', ['-xf', archive, '-C', output, '--strip-components=2']);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  stampRelease(output, {
    project: 'The Pure', version: 'HIT', branch: 'pure/live', repository: 'gregmoulton/LifePilot',
    review: 'GitHub issue #115', environment: 'Release', status: 'candidate', origin, commit,
    nextStep: 'Verify release and installed app', builtAt, updatedAt: builtAt, createdAt: null,
    automatedTest: null, deployed: null, androidTest: null, ownerAccepted: null
  });
}

if (require.main === module) packageRelease(...process.argv.slice(2));
module.exports = { stampRelease };
