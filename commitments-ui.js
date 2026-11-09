/* Commitment Contracts v1, Slice 2: screens (#95). Local-only: no payments, referees or
 * notifications. Every change goes through commitmentAction (one save transaction each).
 * Rendering never writes; scoring runs only when the owner presses "Score finished weeks". */
'use strict';
const priorCommitmentRender = render;
let commitmentForm = null; // { mode: 'create' | 'edit-draft' | 'revise', id }
const C_STATUS = {
  verified: ['Verified by your logs', 'Target met, checked against your Life Pilot logs (not an independent referee).', ''],
  missed: ['Missed', 'Work was planned that week, the logs are clear, and the target was not met.', 'warn'],
  unverified: ['Unverified', 'Not enough reliable evidence to call it met or missed.', 'warn'],
  excused: ['Excused: self-reported, unreviewed', 'You excused this week. Nobody has reviewed it.', 'warn']
};
const cDate = d => { try { return new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); } catch (_) { return d; } };
const cLocal = iso => iso ? cDate(LifePilotCommitments.localDate(Date.parse(iso), 'America/Phoenix')) : '';
const cTarget = t => t.kind === 'minutes' ? t.count + ' minutes a week' : t.count + ' completed task' + (t.count === 1 ? '' : 's') + ' a week';
const cGoal = id => profile.goals.find(g => g.id === id)?.name || 'Goal ' + id;
const cItems = () => profile?.commitments?.items || [];
// The terms in force now (a waiting revision is shown separately).
const cCurrent = i => i.versions.filter(v => v.effective_from && Date.parse(v.effective_from) <= Date.now()).at(-1) || i.versions[0];

render = function () {
  priorCommitmentRender(); if (!profile) return;
  document.querySelector('nav')?.insertAdjacentHTML('beforeend', `<button onclick="showTab('commitments')" class="${tab === 'commitments' ? 'active' : ''}">Commitments</button>`);
  if (tab === 'dashboard') $('app').insertAdjacentHTML('beforeend', commitmentScorecardPanel());
  if (tab === 'agenda') $('agendaWorkspace')?.insertAdjacentHTML('afterbegin', commitmentWarnings());
  if (tab === 'commitments') { $('app').insertAdjacentHTML('beforeend', commitmentWorkspace()); $('commitmentsWorkspace')?.addEventListener?.('click', commitmentClick); }
};

function commitmentBadge(status) {
  const [label, help, cls] = C_STATUS[status] || [status, '', 'warn'];
  return `<span class="tag ${cls}" title="${esc(help)}">${esc(label)}</span>`;
}
function commitmentWeeks(id, limit) {
  const rows = LifePilotCommitments.scorecard(profile, id);
  return (limit ? rows.slice(-limit) : rows);
}
// Overview: one line per active or ended commitment with its recent weeks.
function commitmentScorecardPanel() {
  const items = cItems().filter(i => i.status === 'active' || i.status === 'ended');
  if (!items.length) return '';
  return `<div class="panel"><h3>Commitments scorecard</h3>${items.map(i => {
    const weeks = commitmentWeeks(i.id, 4), v = cCurrent(i);
    return `<div class="line"><b>${esc(cGoal(i.goal_id))}</b> · ${esc(cTarget(v.target))}${i.status === 'ended' ? ' <span class="tag">Ended</span>' : ''}<p class="mini">${weeks.length ? weeks.map(w => esc(cDate(w.week_start).replace(/, \d{4}$/, '')) + ' ' + commitmentBadge(w.status)).join(' ') : 'No finished weeks scored yet.'}</p></div>`;
  }).join('')}<p class="mini muted">Scores come only from your Life Pilot task logs. Open Commitments to score finished weeks.</p></div>`;
}
// Today: a warning when a commitment's week ends within two days and is not yet met.
function commitmentWarnings() {
  const notes = cItems().filter(i => i.status === 'active').map(i => ({ i, p: LifePilotCommitments.progress(profile, i.id) })).filter(x => x.p && !x.p.met && x.p.days_left <= 2);
  if (!notes.length) return '';
  return `<div class="panel warn" role="status"><h3>Commitment deadline</h3>${notes.map(({ i, p }) => `<p><b>${esc(cGoal(i.goal_id))}</b>: ${esc(p.measured)} of ${esc(cTarget(p.target))}. This week ends in ${p.days_left} day${p.days_left === 1 ? '' : 's'}.</p>`).join('')}<p class="mini">Tasks count when they are linked to the goal and recorded as complete.</p></div>`;
}

function commitmentWorkspace() {
  const items = cItems();
  const active = items.filter(i => i.status === 'active'), drafts = items.filter(i => i.status === 'draft'), ended = items.filter(i => i.status === 'ended');
  return `<section id="commitmentsWorkspace"><div class="panel"><h2>Commitments</h2><p>Pick a goal and a weekly target, and write down your own reward and consequence. Nothing starts until you approve it.</p><p class="note mini">Life Pilot only keeps score from your own task logs. It never takes payments, contacts anyone, or enforces a consequence. Changes to an active commitment wait 48 hours and start at the next week. Weeks run Monday to Sunday, Phoenix time.</p>${commitmentFormHtml()}</div>
  ${drafts.map(commitmentDraftCard).join('')}${active.map(commitmentActiveCard).join('')}${ended.length ? '<h3>Ended</h3>' + ended.map(commitmentActiveCard).join('') : ''}</section>`;
}

function commitmentFormHtml() {
  const f = commitmentForm, goals = profile.goals.filter(g => g.status !== 'completed');
  const item = f && cItems().find(i => i.id === f.id); let v = item ? item.versions.at(-1) : null;
  if (!f && !goals.length) return '<p>Add a goal first. A commitment is always tied to one goal.</p>';
  if (!f) return '<p><button data-action="new">New commitment</button></p>';
  const typed = f.values || {};
  const t = typed.target || v?.target || { kind: 'tasks_completed', count: 3 };
  v = { ...(v || {}), ...typed };
  const today = new Date(), start = v?.starts_on || [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
  const revise = f.mode === 'revise';
  return `<form onsubmit="commitmentSubmit(event)" id="commitmentForm"><h3>${revise ? 'Revise commitment' : f.mode === 'edit-draft' ? 'Edit draft' : 'New commitment'}</h3>
  <label for="cGoal">Goal</label><select id="cGoal" ${item ? 'disabled' : ''}>${(item ? profile.goals : goals).map(g => `<option value="${esc(g.id)}" ${(item?.goal_id ?? typed.goal_id) === g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select>
  <div class="grid"><div><label for="cKind">Weekly target</label><select id="cKind"><option value="tasks_completed" ${t.kind === 'tasks_completed' ? 'selected' : ''}>Completed tasks</option><option value="minutes" ${t.kind === 'minutes' ? 'selected' : ''}>Minutes of work</option></select></div>
  <div><label for="cCount">How many each week</label><input id="cCount" type="number" min="1" max="10080" step="1" required value="${esc(t.count)}"></div>
  ${revise ? '' : `<div><label for="cStart">Earliest start</label><input id="cStart" type="date" required value="${esc(start)}"></div>`}</div>
  <label for="cReward">Reward when the week is met</label><textarea id="cReward" required maxlength="500">${esc(v?.reward || '')}</textarea>
  <label for="cConsequence">Consequence when the week is missed (your own choice; nothing is enforced)</label><textarea id="cConsequence" required maxlength="500">${esc(v?.consequence || '')}</textarea>
  <label for="cCap">Hard limit on consequences</label><input id="cCap" required maxlength="200" value="${esc(v?.cap || '')}">
  ${revise ? `<label for="cReason">Why are you changing it?</label><textarea id="cReason" required maxlength="500">${esc(typed.reason || '')}</textarea>` : ''}
  <p class="row"><button type="submit">${revise ? 'Schedule revision' : 'Save draft'}</button><button type="button" class="secondary" data-action="close-form">Cancel</button></p></form>`;
}

function commitmentDraftCard(i) {
  const v = i.versions[0], d = LifePilotCommitments.effectiveDates(i);
  return `<div class="panel"><span class="tag warn">Draft</span><h3>${esc(cGoal(i.goal_id))}</h3>${commitmentTerms(v)}<p class="mini">If you approve now, the first scored week starts <b>${esc(cDate(d.approve_first_week))}</b>.</p><div class="row"><button data-action="approve" data-id="${esc(i.id)}">Approve and start</button><button class="secondary" data-action="edit" data-id="${esc(i.id)}">Edit draft</button><button class="secondary" data-action="discard" data-id="${esc(i.id)}">Discard draft</button></div></div>`;
}
function commitmentTerms(v) {
  return `<p><b>${esc(cTarget(v.target))}</b></p><p class="mini"><b>Reward:</b> ${esc(v.reward)}<br><b>Consequence:</b> ${esc(v.consequence)}<br><b>Hard limit:</b> ${esc(v.cap)}</p>`;
}
function commitmentActiveCard(i) {
  const v0 = i.versions[0], now = Date.now();
  const current = cCurrent(i);
  const waiting = i.versions.filter(v => v.version > 1 && Date.parse(v.effective_from) > now).at(-1);
  const prog = LifePilotCommitments.progress(profile, i.id), weeks = commitmentWeeks(i.id), excusable = LifePilotCommitments.excusableWeeks(profile, i.id);
  const history = (profile.commitments.evaluations || []).filter(e => e.commitment_id === i.id);
  return `<div class="panel"><span class="tag">${i.status === 'ended' ? 'Ended' : 'Active'}</span> <span class="mini muted">version ${esc(current.version)}</span><h3>${esc(cGoal(i.goal_id))}</h3>${commitmentTerms(current)}
  <p class="mini">First scored week started <b>${esc(cLocal(v0.effective_from))}</b>.${i.ends_from ? ` ${Date.parse(i.ends_from) > now ? 'Ends' : 'Ended'} before the week of <b>${esc(cLocal(i.ends_from))}</b>.` : ''}</p>
  ${waiting ? `<p class="note mini">Revision waiting: <b>${esc(cTarget(waiting.target))}</b> from <b>${esc(cLocal(waiting.effective_from))}</b>. ${i.status === 'active' ? `<button class="secondary" data-action="cancel-edit" data-id="${esc(i.id)}">Cancel revision</button>` : ''}</p>` : ''}
  ${prog ? `<p>This week: <b>${esc(prog.measured)}</b> of ${esc(cTarget(prog.target))} · ${prog.met ? 'met' : prog.days_left + ' day' + (prog.days_left === 1 ? '' : 's') + ' left'}</p>` : ''}
  <h4>Finished weeks</h4>${weeks.length ? `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;text-align:left" cellpadding="6"><thead><tr><th>Week of</th><th>Result</th><th>Counted</th></tr></thead><tbody>${weeks.map(w => `<tr><td>${esc(cDate(w.week_start))}</td><td>${commitmentBadge(w.status)}${w.late_evidence ? ' <span class="tag">Late evidence</span>' : ''}${w.supersedes ? ` <span class="mini muted">${w.reason === 'later_native_evidence' ? 'updated with later evidence' : 'updated'}</span>` : ''}${w.doubts?.length ? `<br><span class="mini muted">${w.doubts.map(d => esc(d.reason)).join('; ')}</span>` : ''}</td><td>${esc(w.measured)} / ${esc(w.target.count)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="mini">No finished weeks scored yet.</p>'}
  ${history.length > weeks.length ? `<details><summary class="mini">Full score history (${history.length} entries)</summary>${history.map(e => `<p class="mini">${esc(cDate(e.week_start))}: ${esc(e.status)}${e.supersedes ? ' (replaces ' + esc(e.supersedes) + ')' : ''} · ${esc(e.evaluated_at)}</p>`).join('')}</details>` : ''}
  <div class="row"><button data-action="evaluate" data-id="${esc(i.id)}">Score finished weeks</button>${i.status === 'active' && !i.ends_from ? `${waiting ? '' : `<button class="secondary" data-action="revise" data-id="${esc(i.id)}">Revise</button>`}<button class="secondary" data-action="end" data-id="${esc(i.id)}">End commitment</button>` : ''}${excusable.length ? `<label class="mini" style="margin:0">Week<select id="cExcuse-${esc(i.id)}">${excusable.map(w => `<option value="${esc(w)}">${esc(cDate(w))}</option>`).join('')}</select></label><button class="secondary" data-action="excuse" data-id="${esc(i.id)}">Excuse week</button>` : ''}</div></div>`;
}

function commitmentClick(event) {
  const b = event.target.closest('button[data-action]'); if (!b) return;
  const { action, id } = b.dataset;
  const item = cItems().find(i => i.id === id);
  if (action === 'new') { commitmentForm = { mode: 'create' }; render(); return; }
  if (action === 'close-form') { commitmentForm = null; render(); return; }
  if (action === 'edit') { commitmentForm = { mode: 'edit-draft', id }; render(); return; }
  if (action === 'revise') { commitmentForm = { mode: 'revise', id }; render(); return; }
  if (action === 'approve') {
    const d = LifePilotCommitments.effectiveDates(item), v = item.versions[0];
    if (!confirm('Approve this commitment?\n\n' + cGoal(item.goal_id) + ': ' + cTarget(v.target) + '\nReward: ' + v.reward + '\nConsequence: ' + v.consequence + '\nHard limit: ' + v.cap + '\n\nThe first scored week starts ' + cDate(d.approve_first_week) + '. After that, changes wait 48 hours.')) return;
    commitmentAction({ type: 'approve', commitment_id: id, approved: true }); return;
  }
  if (action === 'discard') { if (!confirm('Discard this draft? It stays in the history as discarded.')) return; commitmentAction({ type: 'discard-draft', commitment_id: id }); return; }
  if (action === 'cancel-edit') { if (!confirm('Cancel the waiting revision? The current terms stay in force.')) return; commitmentAction({ type: 'cancel-edit', commitment_id: id }); return; }
  if (action === 'evaluate') { commitmentAction({ type: 'evaluate', commitment_id: id }); return; }
  if (action === 'end') {
    const d = LifePilotCommitments.effectiveDates(item);
    const reason = prompt('Why are you ending this commitment? It ends before the week of ' + cDate(d.revision_or_end_from) + '; earlier weeks are still scored.', '');
    if (reason === null) return;
    commitmentAction({ type: 'end', commitment_id: id, reason }); return;
  }
  if (action === 'excuse') {
    const week = $('cExcuse-' + id)?.value;
    const reason = prompt('Why should the week of ' + cDate(week) + ' be excused? It will be shown as self-reported and unreviewed.', '');
    if (reason === null) return;
    commitmentAction({ type: 'excuse', commitment_id: id, week_start: week, reason });
  }
}

function commitmentSubmit(event) {
  event.preventDefault();
  const f = commitmentForm; if (!f) return;
  const terms = { target: { kind: $('cKind').value, count: Number($('cCount').value) }, reward: $('cReward').value, consequence: $('cConsequence').value, cap: $('cCap').value };
  if (f.mode === 'revise') {
    const item = cItems().find(i => i.id === f.id), d = LifePilotCommitments.effectiveDates(item);
    if (!confirm('Schedule this revision? It takes effect from the week of ' + cDate(d.revision_or_end_from) + ' (at least 48 hours away). Earlier weeks keep the current terms.')) return;
    return commitmentSave(f, { type: 'propose-edit', commitment_id: f.id, terms, reason: $('cReason').value }, { ...terms, reason: $('cReason').value });
  }
  Object.assign(terms, { goal_id: $('cGoal').value, timezone: 'America/Phoenix', starts_on: $('cStart').value });
  const command = f.mode === 'edit-draft' ? { type: 'edit-draft', commitment_id: f.id, terms } : { type: 'create', commitment_id: 'commitment-' + uid(), terms };
  return commitmentSave(f, command, terms);
}
// Close the form only once the change is saved; on a refused change keep what was typed.
function commitmentSave(form, command, typed) {
  form.values = typed;
  const before = JSON.stringify(profile.commitments ?? null);
  return Promise.resolve(commitmentAction(command)).then(() => {
    if (JSON.stringify(profile.commitments ?? null) !== before && commitmentForm === form) { commitmentForm = null; render(); }
  });
}
