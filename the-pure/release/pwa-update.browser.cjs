'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const { KEY, fresh } = require('../dist/app.js');

const previous = path.resolve(__dirname, '../../recovery/the-pure-android-chatgpt-site/source/dist');
const candidate = path.resolve(__dirname, '../dist');
const mime = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png',
  '.webp': 'image/webp', '.svg': 'image/svg+xml'
};
const stamp = '2026-01-01T00:00:00.000Z';
const fixture = {
  id: 'synthetic-update-record', started: stamp, ended: stamp, status: 'partial',
  records: [{ exercise: 'Push', exerciseName: 'Decline push-ups', round: 'maximum', reps: 11 }]
};

async function main() {
  let root = previous;
  const server = http.createServer(async (req, res) => {
    const route = new URL(req.url, 'http://localhost').pathname;
    const file = path.join(root, route === '/' ? '/index.html' : route);
    try {
      const bytes = await fs.readFile(file);
      res.writeHead(200, {
        'content-type': mime[path.extname(file)] || 'application/octet-stream',
        'cache-control': 'no-store'
      });
      res.end(bytes);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try {
    browser = await chromium.launch();
    const context = await browser.newContext();
    await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
    const open = async () => {
      const page = await context.newPage();
      await page.goto(origin + '/#history');
      return page;
    };
    let page = await open();
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await page.evaluate(([key, store]) => localStorage.setItem(key, JSON.stringify(store)), [KEY, {
      ...fresh(), history: [fixture]
    }]);
    await page.reload();

    const assertHistory = async () => {
      const history = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).history, KEY);
      assert.deepEqual(history, [fixture]);
    };
    const shell = () => page.evaluate(() => caches.keys().then(keys => keys.filter(key => key.startsWith('the-pure-shell-'))));
    const [originalCache] = await shell();
    assert(originalCache);

    const switchBuild = async nextRoot => {
      root = nextRoot;
      await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
      await page.waitForFunction(async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting));
      await page.locator('#pure-update-notice').waitFor({ state: 'attached' });
      await assertHistory();
      await page.close();
      page = await open();
      await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
      await assertHistory();
      await context.setOffline(true);
      await page.reload();
      await page.locator('#historyCards').waitFor({ state: 'visible' });
      assert.match(await page.locator('#historyCards').innerText(), /11 reps/);
      await context.setOffline(false);
    };

    await switchBuild(candidate);
    assert.equal((await shell()).length, 1);
    assert.notEqual((await shell())[0], originalCache);
    await switchBuild(previous);
    assert.deepEqual(await shell(), [originalCache]);
    console.log('Chromium: same-origin worker waited, updated, reopened offline and rolled back with identical history.');
  } finally {
    await browser?.close();
    server.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
