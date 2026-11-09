// Loads the real app (index.html inline script + its script files) into a VM with
// synthetic localStorage, serialized Web Locks and recorded dialogs. Fictional data only.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const KEY = 'lifepilot-v02-profile';
function harness(map) {
  const elements = new Map(), alerts = [], confirms = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: '', style: {}, dataset: {}, hidden: false, innerHTML: '', textContent: '', insertAdjacentHTML() {}, append() {}, setAttribute() {}, scrollIntoView() {}, click() {}, classList: { toggle() {} } });
    return elements.get(id);
  };
  let queue = Promise.resolve(), confirmAnswer = true;
  const locks = { request(name, fn) { const result = queue.then(fn); queue = result.catch(() => {}); return result; } };
  const context = vm.createContext({ console, Blob, navigator: { locks }, localStorage: {
    getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k)
  }, document: { getElementById: element, createElement: () => element('anchor'), querySelector: () => element('nav'), querySelectorAll: () => [] },
  URL: { createObjectURL() { return 'blob:synthetic'; }, revokeObjectURL() {} },
  confirm: message => { confirms.push(message); return confirmAnswer; }, prompt: () => null, alert: s => alerts.push(s), setTimeout() {} });
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const script of html.matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g)) {
    vm.runInContext(script[1] ? fs.readFileSync(path.join(root, script[1]), 'utf8') : script[2], context);
  }
  return { map, alerts, confirms, prompts: answers => { context.prompt = () => answers.shift() ?? null; }, element, answer(v) { confirmAnswer = v; }, run: s => vm.runInContext(s, context), context };
}

module.exports = { harness, KEY };
