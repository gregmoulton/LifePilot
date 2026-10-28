/* Minimal Agenda UI layered onto the existing v0.4 shell. */
'use strict';
const priorAgendaRender=render;
tab='agenda';
render=function(){
 priorAgendaRender();if(!profile)return;
 const nav=document.querySelector('nav');nav?.insertAdjacentHTML('afterbegin',`<button onclick="showTab('agenda')" class="${tab==='agenda'?'active':''}">Today's Agenda</button>`);
 if(tab!=='agenda')return;
 let view;try{view=LifePilotAgenda.projection(profile);}catch(_){$('app').insertAdjacentHTML('beforeend','<p class="note">Agenda data needs review. Export a backup before editing.</p>');return;}
 const rows=(items,section)=>items.map(t=>`<article class="line"><b>${esc(t.name)}</b> ${t.agenda_priority?'<span class="tag">Prioritized</span>':''}${t.agenda_importance&&t.agenda_importance!=='normal'?'<span class="tag">'+esc(t.agenda_importance==='high'?'High priority':'Low priority')+'</span>':''}${t.overdue?'<span class="tag warn">Carryover</span>':''}${t.blocked?'<span class="tag warn">Prerequisite incomplete</span>':''}<p class="mini">${esc(t.due||'Unscheduled')} · ${esc(t.status)}${t.actual_minutes!==undefined?' · '+esc(t.actual_minutes)+' actual min':''}</p><div class="row">${section==='today'||section==='upcoming'?`<button data-action="complete" data-id="${esc(t.id)}">Complete</button><button class="secondary" data-action="hold" data-id="${esc(t.id)}">HOLD</button>`:section==='hold'&&t.agenda_hold?`<button data-action="release" data-id="${esc(t.id)}">Release HOLD</button>`:''}</div></article>`).join('')||'<p class="muted">None</p>';
 const proposals=profile.agenda?.proposals||[];
 const html=`<section id="agendaWorkspace"><div class="panel"><h2>Today's Agenda</h2><p class="mini">Saved on this device. Carryover keeps the original date; Refresh proposes changes for your review.</p><form onsubmit="agendaAdd(event)"><label for="agendaName">New task</label><input id="agendaName" required maxlength="200"><label for="agendaDue">Due date (optional)</label><div class="row"><input id="agendaDue" type="date" style="flex:0 1 180px;width:180px;min-width:0"><button type="button" class="secondary" onclick="agendaSetToday()">Today</button></div><fieldset style="border:0;padding:0;margin:12px 0"><legend>Priority</legend><div class="row">${['high','normal','low'].map(level=>`<label style="display:inline-flex;align-items:center;gap:6px;margin:0;padding:8px"><input type="radio" name="agendaImportance" value="${level}" ${level==='normal'?'checked':''} style="width:auto">${level[0].toUpperCase()+level.slice(1)}</label>`).join('')}</div></fieldset><p><button>Add task</button></p></form><button data-action="refresh">Refresh proposals</button></div>${[['today','Active / Today'],['upcoming','Upcoming'],['hold','HOLD / waiting'],['review','Needs review'],['completed','Completed']].map(([key,title])=>`<div class="panel"><h3>${title} (${view[key].length})</h3>${rows(view[key],key)}</div>`).join('')}<div class="panel"><h3>Refresh proposals</h3>${proposals.filter(p=>p.status==='proposed').map(p=>`<article class="line"><p>${esc(p.summary)}</p><p class="mini">Proposal only. ${p.type==='unblock'?'Acknowledging this does not complete the prerequisite.':''}</p><div class="row"><button data-action="approve" data-id="${esc(p.id)}">${p.type==='unblock'?'Acknowledge prerequisite':'Review & approve'}</button><button class="secondary" data-action="defer" data-id="${esc(p.id)}">Later</button><button class="secondary" data-action="reject" data-id="${esc(p.id)}">Reject</button></div></article>`).join('')||'<p>No pending proposals.</p>'}</div>${proposals.some(p=>p.status==='deferred')?`<div class="panel"><h3>Recommendations for later</h3><p class="mini">Tasks stay active. Bring a recommendation back when you want to review it.</p>${proposals.filter(p=>p.status==='deferred').map(p=>`<article class="line"><p>${esc(p.summary)}</p><button class="secondary" data-action="resume" data-id="${esc(p.id)}">Review again</button></article>`).join('')}</div>`:''}</section>`;
 $('app').insertAdjacentHTML('beforeend',html);
 $('agendaWorkspace').addEventListener?.('click',event=>{const b=event.target.closest('button[data-action]');if(b)agendaAction(b.dataset.action,b.dataset.id);});
};
function agendaAdd(event){event.preventDefault();profile=LifePilotAgenda.apply(profile,{type:'add',task:{id:'agenda-'+uid(),name:$('agendaName').value,due:$('agendaDue').value,agenda_importance:document.querySelector('input[name=agendaImportance]:checked')?.value||'normal'}});save();render();notify('Task saved');}
function agendaAction(type,id){
 const command={type};
 if(['approve','reject','defer','resume'].includes(type))command.proposal_id=id;else command.task_id=id;
 if(type==='complete'){const value=prompt('Actual minutes invested (0 if none)','0');if(value===null)return;if(!value.trim())throw Error('Enter actual minutes');command.minutes=Number(value);}
 if(type==='approve'){
  const p=profile.agenda?.proposals.find(p=>p.id===id);if(!p)throw Error('Proposal not found');
  if(p.type==='reschedule'){const due=prompt('New due date: YYYY-MM-DD',p.before.due?.slice(0,10)||'');if(due===null)return;command.due=due;}
  if(!confirm(p.summary+'\nApply this approved action'+(command.due?' for '+command.due:'')+'?'))return;command.approved=true;
 }
 profile=LifePilotAgenda.apply(profile,command);save();render();notify(type==='refresh'?'Proposals saved for review':'Change saved');
}


function agendaSetToday(now=new Date()){
 $('agendaDue').value=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
}
