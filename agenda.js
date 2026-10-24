/* Minimal Agenda UI layered onto the existing v0.4 shell. */
'use strict';
const priorAgendaRender=render;
tab='agenda';
render=function(){
 priorAgendaRender();if(!profile)return;
 const nav=document.querySelector('nav');nav?.insertAdjacentHTML('afterbegin',`<button onclick="showTab('agenda')" class="${tab==='agenda'?'active':''}">Today's Agenda</button>`);
 if(tab!=='agenda')return;
 let view;try{view=LifePilotAgenda.projection(profile);}catch(_){$('app').insertAdjacentHTML('beforeend','<p class="note">Agenda data needs review. Export a backup before editing.</p>');return;}
 const rows=(items,section)=>items.map(t=>`<article class="line"><b>${esc(t.name)}</b> ${t.agenda_priority?'<span class="tag">Prioritized</span>':''}${t.overdue?'<span class="tag warn">Carryover</span>':''}${t.blocked?'<span class="tag warn">Prerequisite incomplete</span>':''}<p class="mini">${esc(t.due||'Unscheduled')} · ${esc(t.status)}${t.actual_minutes!==undefined?' · '+esc(t.actual_minutes)+' actual min':''}</p><div class="row">${section==='today'||section==='upcoming'?`<button data-action="complete" data-id="${esc(t.id)}">Complete</button><button class="secondary" data-action="hold" data-id="${esc(t.id)}">HOLD</button>`:section==='hold'&&t.agenda_hold?`<button data-action="release" data-id="${esc(t.id)}">Release HOLD</button>`:''}</div></article>`).join('')||'<p class="muted">None</p>';
 const proposals=profile.agenda?.proposals||[];
 const html=`<section id="agendaWorkspace"><div class="panel"><h2>Today's Agenda</h2><p class="mini">Saved on this device. Carryover keeps the original date; Refresh proposes changes for your review.</p><form onsubmit="agendaAdd(event)"><label for="agendaName">New task</label><input id="agendaName" required maxlength="200"><label for="agendaDue">Due date (optional)</label><input id="agendaDue" type="date"><p><button>Add task</button></p></form><button data-action="refresh">Refresh proposals</button></div>${[['today','Active / Today'],['upcoming','Upcoming'],['hold','HOLD / waiting'],['review','Needs review'],['completed','Completed']].map(([key,title])=>`<div class="panel"><h3>${title} (${view[key].length})</h3>${rows(view[key],key)}</div>`).join('')}<div class="panel"><h3>Refresh proposals</h3>${proposals.filter(p=>p.status==='proposed').map(p=>`<article class="line"><p>${esc(p.summary)}</p><p class="mini">Proposal only. ${p.type==='unblock'?'Acknowledging this does not complete the prerequisite.':''}</p><div class="row"><button data-action="approve" data-id="${esc(p.id)}">${p.type==='unblock'?'Acknowledge prerequisite':'Review & approve'}</button><button class="secondary" data-action="reject" data-id="${esc(p.id)}">Reject</button></div></article>`).join('')||'<p>No pending proposals.</p>'}</div></section>`;
 $('app').insertAdjacentHTML('beforeend',html);
 $('agendaWorkspace').addEventListener?.('click',event=>{const b=event.target.closest('button[data-action]');if(b)agendaAction(b.dataset.action,b.dataset.id);});
};
function agendaAdd(event){event.preventDefault();profile=LifePilotAgenda.apply(profile,{type:'add',task:{id:'agenda-'+uid(),name:$('agendaName').value,due:$('agendaDue').value}});save();render();notify('Task saved');}
function agendaAction(type,id){
 const command={type};
 if(type==='approve'||type==='reject')command.proposal_id=id;else command.task_id=id;
 if(type==='complete'){const value=prompt('Actual minutes invested (0 if none)','0');if(value===null)return;if(!value.trim())throw Error('Enter actual minutes');command.minutes=Number(value);}
 if(type==='approve'){
  const p=profile.agenda?.proposals.find(p=>p.id===id);if(!p)throw Error('Proposal not found');
  if(p.type==='reschedule'){const due=prompt('New due date: YYYY-MM-DD',p.before.due?.slice(0,10)||'');if(due===null)return;command.due=due;}
  if(!confirm(p.summary+'\nApply this approved action'+(command.due?' for '+command.due:'')+'?'))return;command.approved=true;
 }
 profile=LifePilotAgenda.apply(profile,command);save();render();notify(type==='refresh'?'Proposals saved for review':'Change saved');
}
