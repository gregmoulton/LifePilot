'use strict';
// Drives the live phone V2 page, not the smaller mobile prototype.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const KEY = 'the-pure-phone-approved-v2';
const dir = __dirname;
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const rollback = fs.readFileSync(path.join(dir, 'rollback', 'index.html'));

function appScript(source) {
  const parts = [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.ok(parts.length >= 1, 'page has no script');
  return parts[parts.length - 1][1];
}

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

function decode(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (all, ent) => {
    if (ent === 'amp') return '&';
    if (ent === 'lt') return '<';
    if (ent === 'gt') return '>';
    if (ent === 'quot') return '"';
    if (ent === 'apos' || ent === '#39') return "'";
    if (ent[0] === '#') {
      const n = ent[1] === 'x' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : all;
    }
    return all;
  });
}

function parseAttrs(text) {
  const attrs = {};
  const re = /([^\s=/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let match;
  while ((match = re.exec(text))) {
    const name = match[1].toLowerCase();
    if (!name || name === '/') continue;
    attrs[name] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attrs;
}

function dataKey(name) {
  return name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function matches(el, selector) {
  const sel = selector.trim();
  if (!sel) return false;
  if (sel.includes(',')) return sel.split(',').some((part) => matches(el, part));
  if (sel.startsWith('#')) return el.id === sel.slice(1);
  const attr = sel.match(/^\[([a-zA-Z0-9_-]+)(?:="([^"]*)")?\]$/);
  if (!attr) return false;
  const name = attr[1].toLowerCase();
  if (name.startsWith('data-')) {
    const key = dataKey(name);
    if (!Object.prototype.hasOwnProperty.call(el.dataset, key)) return false;
    return attr[2] === undefined ? true : el.dataset[key] === attr[2];
  }
  if (!Object.prototype.hasOwnProperty.call(el.attrs, name)) return false;
  return attr[2] === undefined ? true : el.attrs[name] === attr[2];
}

function makeDocument() {
  function walk(node, visit) {
    visit(node);
    for (const child of node.children) walk(child, visit);
  }
  function queryAll(root, selector) {
    const out = [];
    walk(root, (node) => {
      if (node !== root && matches(node, selector)) out.push(node);
    });
    return out;
  }
  function create(tag) {
    const el = {
      tag,
      id: '',
      attrs: {},
      dataset: {},
      children: [],
      parent: null,
      textContent: '',
      value: '',
      disabled: false,
      classList: { add() {}, remove() {}, contains() { return false; }, toggle() { return false; } },
      listeners: {},
      addEventListener(type, fn) {
        (el.listeners[type] || (el.listeners[type] = [])).push(fn);
      },
      focus() {},
      closest() { return null; },
      click() {
        if (el.disabled) return;
        for (const fn of el.listeners.click || []) fn({ button: 0, target: el, preventDefault() {}, stopPropagation() {} });
      }
    };
    el.querySelector = (selector) => queryAll(el, selector)[0] || null;
    el.querySelectorAll = (selector) => queryAll(el, selector);
    Object.defineProperty(el, 'innerHTML', {
      set(value) { setInnerHTML(el, String(value)); },
      get() { return ''; }
    });
    return el;
  }
  function setInnerHTML(el, value) {
    el.children = [];
    const stack = [el];
    let i = 0;
    while (i < value.length) {
      if (value.startsWith('<!--', i)) {
        const end = value.indexOf('-->', i);
        i = end < 0 ? value.length : end + 3;
        continue;
      }
      if (value[i] === '<') {
        if (value[i + 1] === '/') {
          const end = value.indexOf('>', i);
          const tag = value.slice(i + 2, end).trim().toLowerCase();
          for (let s = stack.length - 1; s > 0; s -= 1) {
            if (stack[s].tag === tag) { stack.length = s; break; }
          }
          i = end + 1;
          continue;
        }
        let j = i + 1;
        while (j < value.length && /[a-zA-Z0-9]/.test(value[j])) j += 1;
        const tag = value.slice(i + 1, j).toLowerCase();
        if (!tag) { i += 1; continue; }
        let quote = null;
        let k = j;
        for (; k < value.length; k += 1) {
          const ch = value[k];
          if (quote) { if (ch === quote) quote = null; continue; }
          if (ch === '"' || ch === "'") { quote = ch; continue; }
          if (ch === '>') break;
        }
        const attrText = value.slice(j, k);
        const child = create(tag);
        child.attrs = parseAttrs(attrText);
        child.id = child.attrs.id || '';
        child.value = child.attrs.value || '';
        child.disabled = Object.prototype.hasOwnProperty.call(child.attrs, 'disabled');
        for (const [name, attrValue] of Object.entries(child.attrs)) {
          if (name.startsWith('data-')) child.dataset[dataKey(name)] = attrValue;
        }
        stack[stack.length - 1].children.push(child);
        child.parent = stack[stack.length - 1];
        const self = VOID.has(tag) || /\/\s*$/.test(attrText);
        if (!self) stack.push(child);
        i = k + 1;
        continue;
      }
      const next = value.indexOf('<', i);
      const text = decode(value.slice(i, next < 0 ? value.length : next)).replace(/\s+/g, ' ').trim();
      if (text) {
        const cur = stack[stack.length - 1];
        cur.textContent = cur.textContent ? `${cur.textContent} ${text}` : text;
      }
      i = next < 0 ? value.length : next;
    }
  }
  const body = create('body');
  const app = create('main');
  app.id = 'app';
  body.children.push(app);
  app.parent = body;
  const document = {
    body,
    getElementById(id) {
      let found = null;
      walk(body, (node) => { if (!found && node.id === id) found = node; });
      return found;
    },
    querySelector(selector) { return queryAll(body, selector)[0] || null; },
    querySelectorAll(selector) { return queryAll(body, selector); },
    createElement() { return create('div'); }
  };
  return document;
}

function boot(options = {}) {
  const db = { ...(options.db || {}) };
  const alerts = [];
  let writes = 0;
  const storage = {
    getItem(key) {
      if (options.readFail) throw new Error('read denied');
      return Object.prototype.hasOwnProperty.call(db, key) ? db[key] : null;
    },
    setItem(key, value) {
      writes += 1;
      if (options.failAt === writes) throw new Error('quota');
      if (options.corruptAt === writes) {
        db[key] = '{"not":"verified"}';
        return;
      }
      db[key] = String(value);
    },
    removeItem(key) { delete db[key]; }
  };
  const document = makeDocument();
  const context = {
    document,
    localStorage: storage,
    alert(message) { alerts.push(String(message)); },
    confirm() { return options.confirm !== false; },
    setInterval() { return 0; },
    clearInterval() {},
    setTimeout() { return 0; },
    navigator: { bluetooth: undefined },
    window: { addEventListener() {}, isSecureContext: true },
    console,
    Date, JSON, Math, Number, String, Object, Array, Error, Set, Map, RegExp,
    parseInt, parseFloat, isNaN, isFinite, undefined
  };
  vm.runInNewContext(appScript(html), context, { filename: 'the-pure-phone-v2/index.html' });
  return {
    alerts,
    get writes() { return writes; },
    raw() { return Object.prototype.hasOwnProperty.call(db, KEY) ? db[KEY] : undefined; },
    data() { return this.raw() === undefined ? undefined : JSON.parse(this.raw()); },
    status() { return document.getElementById('status')?.textContent || ''; },
    text(selector) {
      const el = selector.startsWith('#') && !selector.includes('[')
        ? document.getElementById(selector.slice(1))
        : document.querySelector(selector);
      return el ? el.textContent : '';
    },
    click(selector) {
      const el = selector.startsWith('#') && !selector.includes('[')
        ? document.getElementById(selector.slice(1))
        : document.querySelector(selector);
      assert.ok(el, `missing ${selector}`);
      assert.equal(el.disabled, false, `${selector} is disabled`);
      el.click();
    },
    hold(selector) {
      const el = document.querySelector(selector) || document.getElementById(selector.replace('#', ''));
      assert.ok(el, `missing ${selector}`);
      return el;
    },
    db
  };
}

function priorHistory() {
  return {
    version: 2,
    phase: 'ready',
    round: 1,
    order: ['push', 'legs', 'pull'],
    roundOrders: [null, null, null],
    counts: [{}, {}, {}],
    roundEnds: [null, null, null],
    restEnds: [null, null, null],
    recoveries: [null, null, null],
    startedAt: null,
    finishedAt: null,
    restStart: null,
    pausedAt: null,
    pausedTotal: 0,
    samples: [],
    heartPeaks: [],
    threshold: 110,
    voice: false,
    audio: true,
    weightKg: null,
    history: [
      { startedAt: '2026-10-18T15:00:00.000Z', finishedAt: '2026-10-18T15:20:00.000Z', counts: [{ push: 7 }, {}, {}], roundOrders: [null, null, null], recoveries: [null, null, null] },
      { startedAt: '2026-10-20T15:00:00.000Z', finishedAt: '2026-10-20T15:20:00.000Z', counts: [{ push: 8 }, {}, {}], roundOrders: [null, null, null], recoveries: [null, null, null] }
    ]
  };
}

test('page keeps the live phone UI, storage key, and version 2', () => {
  assert.match(html, /<title>The Pure — Strength\. Simplified\.<\/title>/);
  assert.match(html, /const STORE='the-pure-phone-approved-v2'/);
  assert.match(html, /version:2/);
  assert.match(html, /Start Workout/);
  assert.match(html, /MOOFIT HW401/);
  assert.match(html, /Stored workout did not verify on read-back/);
  assert.match(html, /function archiveSession/);
  assert.doesNotMatch(html, /const save=\(\)=>\{try\{localStorage\.setItem\(STORE,JSON\.stringify\(s\)\)\}catch\(_e\)\{\}\}/);
  assert.equal(html.includes('the_pure_mobile_proto_v1'), false);
  const hash = crypto.createHash('sha256').update(rollback).digest('hex');
  assert.equal(hash, '1e84270e7a9550eb4c2298e3ea643eaa036ddc15ecca35387173cd4cdacd76d1');
  assert.notEqual(crypto.createHash('sha256').update(html).digest('hex'), hash);
});

test('starting a workout persists a verified active session', () => {
  const app = boot();
  assert.equal(app.alerts.length, 0);
  assert.match(app.text('#action'), /Start Workout/);
  app.click('#action');
  const data = app.data();
  assert.equal(data.version, 2);
  assert.equal(data.phase, 'active');
  assert.equal(data.history.length, 0);
  assert.deepEqual(data.order, ['push', 'legs', 'pull']);
  assert.equal(app.alerts.length, 0);
  assert.equal(app.raw(), JSON.stringify(data));
});

test('reload restores the active session and its history', () => {
  const seeded = priorHistory();
  const first = boot({ db: { [KEY]: JSON.stringify(seeded) } });
  assert.equal(first.alerts.length, 0);
  first.click('#action');
  const raw = first.raw();
  const started = JSON.parse(raw).startedAt;
  assert.equal(JSON.parse(raw).history.length, 2);
  const reloaded = boot({ db: { [KEY]: raw } });
  assert.equal(reloaded.raw(), raw);
  assert.equal(reloaded.alerts.length, 0);
  reloaded.click('#pause');
  const data = reloaded.data();
  assert.equal(data.phase, 'paused');
  assert.equal(data.startedAt, started);
  assert.equal(data.history.length, 2);
  assert.equal(data.history[0].startedAt, '2026-10-18T15:00:00.000Z');
  assert.equal(data.history[0].counts[0].push, 7);
  assert.equal(data.history[1].counts[0].push, 8);
  assert.equal(data.history[0].endedEarly, undefined);
});

test('ending early archives one partial session without inventing reps', () => {
  const app = boot();
  app.click('#action');
  app.click('[data-plus="push"]');
  app.click('[data-plus="push"]');
  app.click('#pause');
  app.click('#endEarly');
  const data = app.data();
  assert.equal(data.phase, 'complete');
  assert.equal(data.history.length, 1);
  const entry = data.history[0];
  assert.equal(entry.endedEarly, true);
  assert.equal(entry.outcome, 'partial');
  assert.equal(entry.startedAt, data.startedAt);
  assert.equal(entry.counts[0].push, 2);
  assert.equal(entry.counts[0].legs, undefined);
  assert.equal(entry.counts[0].pull, undefined);
  assert.deepEqual(entry.counts[1], {});
  assert.deepEqual(entry.counts[2], {});
  assert.match(app.status(), /Partial session saved on this phone/);
  assert.equal(app.alerts.length, 0);
  const reloaded = boot({ db: { [KEY]: app.raw() } });
  assert.equal(reloaded.raw(), app.raw());
  reloaded.click('#newWorkout');
  assert.equal(reloaded.data().phase, 'ready');
  assert.equal(reloaded.data().history.length, 1);
  assert.equal(reloaded.data().history[0].counts[0].push, 2);
  assert.equal(reloaded.data().history[0].endedEarly, true);
});

test('a failed partial save rolls back and stays visible', () => {
  const app = boot({ failAt: 3 });
  app.click('#action');
  app.click('#pause');
  const verified = app.raw();
  app.click('#endEarly');
  assert.equal(app.raw(), verified);
  assert.equal(app.data().phase, 'paused');
  assert.equal(app.data().history.length, 0);
  assert.equal(app.alerts.length, 1);
  assert.match(app.alerts[0], /WORKOUT NOT SAVED/);
  assert.match(app.status(), /Workout not saved/);
  assert.match(app.text('#resume'), /Resume Round/);
});

test('a read-back mismatch restores the last verified workout', () => {
  const app = boot({ corruptAt: 3 });
  app.click('#action');
  app.click('#pause');
  const verified = app.raw();
  app.click('#endEarly');
  assert.equal(app.raw(), verified);
  assert.equal(app.data().phase, 'paused');
  assert.equal(app.data().history.length, 0);
  assert.match(app.alerts[0], /read-back/);
  assert.match(app.status(), /Workout not saved/);
});

test('malformed storage is not overwritten', () => {
  const bad = '{bad json';
  const app = boot({ db: { [KEY]: bad } });
  assert.equal(app.raw(), bad);
  assert.match(app.alerts[0], /could not be read safely/);
  assert.match(app.status(), /left unchanged/);
  assert.match(app.text('#action'), /Start Workout/);
  app.click('#action');
  assert.equal(app.writes, 0);
  assert.equal(app.raw(), bad);
  assert.equal(app.alerts.length, 2);
});

test('a version-2 record with a broken history is not overwritten', () => {
  const bad = JSON.stringify({ version: 2, order: ['push', 'legs', 'pull'], history: { '0': 1 } });
  const app = boot({ db: { [KEY]: bad } });
  app.click('#action');
  assert.equal(app.writes, 0);
  assert.equal(app.raw(), bad);
  assert.match(app.alerts[0], /could not be read safely/);
});

test('ending early twice archives the session once', () => {
  const seeded = priorHistory();
  const app = boot({ db: { [KEY]: JSON.stringify(seeded) } });
  app.click('#action');
  app.click('#pause');
  const button = app.hold('#endEarly');
  button.click();
  button.click();
  const data = app.data();
  assert.equal(data.history.length, 3);
  const fresh = data.history.filter((entry) => entry.startedAt === data.startedAt);
  assert.equal(fresh.length, 1);
  assert.equal(fresh[0].endedEarly, true);
  assert.equal(data.history[0].startedAt, '2026-10-18T15:00:00.000Z');
  assert.equal(data.history[0].counts[0].push, 7);
  assert.equal(data.history[1].counts[0].push, 8);
  app.click('#newWorkout');
  assert.equal(app.data().history.length, 3);
  assert.equal(app.data().phase, 'ready');
  assert.equal(app.data().startedAt, null);
  app.click('#action');
  app.click('#pause');
  app.click('#endEarly');
  const again = app.data();
  assert.equal(again.history.length, 4);
  const ids = again.history.map((entry) => entry.startedAt);
  assert.equal(new Set(ids).size, 4);
});

test('canceling early end does not archive', () => {
  const app = boot({ confirm: false });
  app.click('#action');
  app.click('#pause');
  app.click('#endEarly');
  assert.equal(app.data().phase, 'paused');
  assert.equal(app.data().history.length, 0);
  assert.equal(app.alerts.length, 0);
});
