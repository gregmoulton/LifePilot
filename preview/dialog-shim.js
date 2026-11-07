/* Preview-only adapter. Not used by the production app.
 * The hosted preview viewer blocks window.alert/confirm/prompt. This replaces them with
 * in-page bars. The first call shows the bar and returns "cancel"; when the tester answers,
 * the original click/submit/change is replayed and the same call returns that answer.
 */
(function () {
  'use strict';
  const answers = new Map();
  let last = null, replaying = false, asked = false;
  const remember = e => { if (!replaying && e.isTrusted) last = { type: e.type, target: e.target }; };
  ['click', 'submit', 'change'].forEach(t => document.addEventListener(t, remember, true));

  function bar() {
    let el = document.getElementById('previewDialog');
    if (!el) {
      el = document.createElement('div');
      el.id = 'previewDialog';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-live', 'assertive');
      document.body.appendChild(el);
    }
    return el;
  }
  function close() { const el = document.getElementById('previewDialog'); if (el) el.hidden = true; }
  function replay() {
    if (!last) return;
    const { type, target } = last;
    replaying = true; asked = false;
    try {
      if (type === 'submit') (target.requestSubmit ? target.requestSubmit() : target.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
      else if (type === 'change') target.dispatchEvent(new Event('change', { bubbles: true }));
      else target.click();
    } finally {
      replaying = false;
      // Chain finished without a new question: never reuse these answers for another action.
      // Delayed so async handlers (file import awaits before confirming) still see the answer.
      setTimeout(() => { if (!asked) answers.clear(); }, 2000);
    }
  }
  const key = (kind, msg) => kind + '\u0000' + String(msg ?? '');
  function show(kind, msg, def) {
    asked = true; const el = bar(); el.hidden = false; el.className = 'pd-' + kind;
    const text = document.createElement('p'); text.textContent = String(msg ?? '');
    el.replaceChildren(text);
    const row = document.createElement('div'); row.className = 'pd-row';
    let input = null;
    if (kind === 'prompt') {
      input = document.createElement('input'); input.id = 'previewDialogInput'; input.value = def ?? ''; input.setAttribute('aria-label', String(msg ?? 'Answer'));
      el.appendChild(input);
    }
    const ok = document.createElement('button'); ok.type = 'button';
    ok.textContent = kind === 'alert' ? 'OK' : kind === 'prompt' ? 'Continue' : 'Confirm';
    ok.onclick = () => {
      close();
      if (kind === 'alert') return;
      answers.set(key(kind, msg), kind === 'prompt' ? input.value : true);
      replay();
    };
    row.appendChild(ok);
    if (kind !== 'alert') {
      const no = document.createElement('button'); no.type = 'button'; no.className = 'secondary'; no.textContent = 'Cancel';
      no.onclick = () => { answers.clear(); close(); };
      row.appendChild(no);
    }
    el.appendChild(row);
    (input || ok).focus();
  }
  window.alert = msg => show('alert', msg);
  window.confirm = msg => {
    const k = key('confirm', msg);
    if (answers.has(k)) return answers.get(k);
    show('confirm', msg); return false;
  };
  window.prompt = (msg, def) => {
    const k = key('prompt', msg);
    if (answers.has(k)) return answers.get(k);
    show('prompt', msg, def); return null;
  };
})();
