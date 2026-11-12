'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const app = path.resolve(__dirname, '../dist');
const recovered = path.resolve(__dirname, '../../recovery/the-pure-android-chatgpt-site/source/dist');
const read = (dir, file) => fs.readFileSync(path.join(dir, file));
const manifest = dir => JSON.parse(read(dir, 'manifest.webmanifest'));
const shell = dir => {
  const worker = vm.createContext({ self: { addEventListener() {} } });
  vm.runInContext(read(dir, 'sw.js').toString(), worker);
  return vm.runInContext('({ name: CACHE, files: FILES })', worker);
};

const candidate = manifest(app);
const baseline = manifest(recovered);
for (const field of ['id', 'scope', 'start_url', 'display', 'name', 'short_name']) {
  assert.equal(candidate[field], baseline[field], 'Identity drift: ' + field);
}
assert.equal(candidate.id, '/');
assert.equal(candidate.scope, './');
assert.equal(candidate.start_url, './#workout');
assert.equal(candidate.display, 'standalone');

const currentShell = shell(app);
assert.notEqual(currentShell.name, shell(recovered).name, 'The updated shell needs a distinct cache');
assert.equal(new Set(currentShell.files).size, currentShell.files.length, 'Duplicate cache entries');
const cached = new Set(currentShell.files.map(file => file.replace(/^\.\//, '')));
for (const file of currentShell.files) {
  assert(fs.statSync(path.join(app, file === './' ? 'index.html' : file)).isFile(), file);
}
const html = read(app, 'index.html').toString();
for (const [, file] of html.matchAll(/(?:src|href)="([^"#]+\.(?:css|js|webmanifest))"/g)) {
  assert(cached.has(file.replace(/^\.\//, '')), 'Offline shell missing ' + file);
}
for (const purpose of ['any', 'maskable']) {
  for (const size of [192, 512]) {
    const icon = candidate.icons.find(entry => entry.purpose === purpose && entry.sizes === size + 'x' + size);
    assert(icon, 'Missing ' + purpose + ' icon at ' + size);
    assert(cached.has(icon.src), 'Offline shell missing ' + icon.src);
    const bytes = read(app, icon.src);
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16), size);
    assert.equal(bytes.readUInt32BE(20), size);
  }
}

console.log('PWA preflight passed: stable identity, distinct complete shell, and four valid PNGs.');
