/* Agenda projection and commands; the existing profile stays authoritative. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./forward-radar.js'):root.ForwardRadar);if(typeof module==='object'&&module.exports)module.exports=api;else root.LifePilotAgenda=api;})(globalThis,function(engine){
'use strict';
const copy=x=>JSON.parse(JSON.stringify(x));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function tasks(profile){return profile.execution?.tasks||[];}
function state(task){if(task.status==='completed'||task.status==='done')return 'completed';if(task.agenda_hold||['hold','HOLD','waiting','on_hold'].includes(task.status))return 'hold';if(['missed','partial'].includes(task.status))return 'review';if(!['planned','active','today',undefined].includes(task.status))return 'review';return 'open';}
function taskContext(profile,task){
 const issues=[],result={goal:null,program:null,milestone:null,issues};
 const collections={goal:profile.goals||[],program:profile.execution?.programs||[],milestone:profile.execution?.milestones||[]};
 const labels={goal:'Goal',program:'Program',milestone:'Milestone'};
 const linked=Object.keys(collections).some(kind=>task[kind+'_id']!==undefined&&task[kind+'_id']!==null&&task[kind+'_id']!=='');
 if(!linked)return null;
 for(const kind of Object.keys(collections)){
  const id=task[kind+'_id'];if(id===undefined||id===null||id==='')continue;
  const matches=collections[kind].filter(x=>x&&x.id===id);
  if(matches.length!==1){issues.push(labels[kind]+(matches.length?' link is ambiguous':' link not found'));continue;}
  result[kind]={id:matches[0].id,name:matches[0].name||'Unnamed '+kind};
 }
 if((task.program_id||task.milestone_id)&&!task.goal_id)issues.push('Task has no goal link');
 if(task.milestone_id&&!task.program_id)issues.push('Task has no program link');
 const program=collections.program.find(x=>x?.id===result.program?.id),milestone=collections.milestone.find(x=>x?.id===result.milestone?.id);
 if(program&&task.goal_id&&program.goal_id!==task.goal_id)issues.push('Program does not match the linked goal');
 if(milestone&&task.goal_id&&milestone.goal_id!==task.goal_id)issues.push('Milestone does not match the linked goal');
 if(milestone&&task.program_id&&milestone.program_id!==task.program_id)issues.push('Milestone does not match the linked program');
 return result;
}
function projection(profile,now=new Date()){
 const result={today:[],unscheduled:[],upcoming:[],hold:[],completed:[],review:[]};const list=tasks(profile);const ids=new Set();
 for(const t of list){if(!t||!t.id||ids.has(t.id))throw Error('Invalid or duplicate task ID');ids.add(t.id);}
 const byId=new Map(list.map(t=>[t.id,t]));
 for(const t of list){const s=state(t),days=t.due?engine.daysUntil(t.due,new Date(now)):0;const blocked=!!t.prerequisite_id&&state(byId.get(t.prerequisite_id)||{status:'missing'})!=='completed';const item={...copy(t),blocked,overdue:s==='open'&&days<0,agenda_context:taskContext(profile,t)};
 if(s==='completed')result.completed.push(item);else if(s==='hold'||blocked)result.hold.push(item);else if(s==='review'||!Number.isFinite(days))result.review.push(item);else if(!t.due)result.unscheduled.push(item);else result[days<=0?'today':'upcoming'].push(item);}
 for(const key of ['today','upcoming','unscheduled'])result[key].sort((a,b)=>Number(!!b.agenda_priority)-Number(!!a.agenda_priority)||({high:3,normal:2,low:1}[b.agenda_importance]||2)-({high:3,normal:2,low:1}[a.agenda_importance]||2));
 return result;
}
function apply(profile,command,now=new Date()){
 const p=copy(profile);p.execution=p.execution||{};p.execution.tasks=p.execution.tasks||[];p.agenda=p.agenda||{version:1,events:[],proposals:[],rejections:[]};
 const a=p.agenda;if(a.version!==1||!['events','proposals','rejections'].every(k=>Array.isArray(a[k])))throw Error('Unsupported Agenda metadata; no data changed');
 const list=p.execution.tasks;projection(p,now);const stamp=new Date(now).toISOString();const t=list.find(t=>t.id===command.task_id);
 const event=(type,extra={})=>a.events.push({type,task_id:command.task_id||null,at:stamp,...extra});
 if(command.type==='add-many'){
  if(command.approved!==true)throw Error('Review the task list before adding');
  if(!Array.isArray(command.tasks)||command.tasks.length<1||command.tasks.length>20)throw Error('Add 1 to 20 tasks at a time');
  return command.tasks.reduce((next,task)=>apply(next,{type:'add',task},now),p);
 }else if(command.type==='add'){
  if(!command.task||typeof command.task.id!=='string'||!command.task.id||typeof command.task.name!=='string'||!command.task.name.trim()||command.task.name.trim().length>200||list.some(t=>t.id===command.task.id))throw Error('Choose a task name and unique ID');
  if(command.task.due&&!Number.isFinite(engine.daysUntil(command.task.due,new Date(now))))throw Error('Choose a valid date');
  const importance=command.task.agenda_importance||'normal';
  if(!['high','normal','low'].includes(importance))throw Error('Choose High, Normal or Low priority');
  list.push({agenda_importance:importance,importance:{high:3,normal:1,low:0.5}[importance],id:command.task.id,name:command.task.name.trim(),due:command.task.due||'',status:'planned',created_at:stamp});event('added',{task_id:command.task.id});
 }else if(command.type==='refresh'){
  const normalized=list.map(t=>({...t,status:state(t)==='open'?'planned':state(t)==='completed'?'completed':state(t)==='hold'?'hold':'review'}));
  const report=engine.forwardRadar({tasks:normalized,rejections:a.rejections,now});
  for(const old of a.proposals){const current=list.find(t=>t.id===old.task_id);if(['proposed','deferred'].includes(old.status)&&(!current||!same(old.before,current)))old.status='stale';}
  for(const proposal of report.recommendations){const target=list.find(t=>t.id===proposal.task_id);if(proposal.type==='prioritize'&&target.agenda_priority)continue;
   if(a.proposals.some(x=>x.task_id===target.id&&x.type===proposal.type&&same(x.before,target)&&x.status!=='stale'))continue;
   a.proposals.push({id:'proposal-'+(a.proposals.length+1),...copy(proposal),before:copy(target),status:'proposed',created_at:stamp});}
  // carried_tasks are explanatory copies, never written back by Refresh.
  event('refreshed');
 }else if(['reject','approve','defer','resume'].includes(command.type)){
  const proposal=a.proposals.find(x=>x.id===command.proposal_id);if(!proposal||proposal.status!==(command.type==='resume'?'deferred':'proposed'))throw Error('Proposal is not awaiting this action');
  const target=list.find(t=>t.id===proposal.task_id);if(!target||!same(target,proposal.before))throw Error('Task changed. Refresh and review a new proposal');
  if(command.type==='defer'){proposal.status='deferred';proposal.deferred_at=stamp;event('proposal_deferred',{proposal_id:proposal.id});}
  else if(command.type==='resume'){proposal.status='proposed';proposal.resumed_at=stamp;event('proposal_resumed',{proposal_id:proposal.id});}
  else if(command.type==='reject'){proposal.status='rejected';a.rejections.push({task_id:target.id,action_type:proposal.type,rejected_at:stamp});event('proposal_rejected',{proposal_id:proposal.id});}
  else{
   if(command.approved!==true)throw Error('Owner approval required');
   if(proposal.type==='reschedule'){
    if(!command.due||!Number.isFinite(engine.daysUntil(command.due,new Date(now))))throw Error('Choose a valid new date');
    const before=target.due;target.due=command.due;event('rescheduled',{task_id:target.id,previous_due:before,due:target.due,proposal_id:proposal.id});
   }else if(proposal.type==='prioritize'){target.agenda_priority=true;event('prioritized',{task_id:target.id,proposal_id:proposal.id});}
   else if(proposal.type==='unblock'){event('prerequisite_reviewed',{task_id:target.id,proposal_id:proposal.id});}
   else throw Error('Unknown proposal action');
   proposal.status='applied';proposal.approved_at=stamp;proposal.applied_at=stamp;
   p.decision_register=p.decision_register||[];p.decision_register.push({id:'RADAR-'+proposal.id,decision:proposal.summary,status:'approved',date:stamp,proposal_id:proposal.id});
  }
 }else{
  if(!t)throw Error('Task not found');
  if(command.type==='plan-today'){
   if(state(t)!=='open'||t.due||projection(p,now).hold.some(x=>x.id===t.id))throw Error('Only an available undated task can be planned for Today');
   const date=new Date(now),due=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
   const previous=t.due??null;t.due=due;event('planned_today',{previous_due:previous,due});
  }else if(command.type==='complete'){
   if(state(t)==='completed')return p;
   if(state(t)!=='open'||projection(p,now).hold.some(x=>x.id===t.id))throw Error('Release HOLD and complete prerequisites before recording completion');
   if(!Number.isFinite(command.minutes)||command.minutes<0)throw Error('Enter actual minutes');
   const before=copy(t);t.status='completed';t.actual_minutes=command.minutes;t.recorded_at=stamp;event('completed',{before});
  }else if(command.type==='hold'||command.type==='release'){
   if(state(t)==='completed')throw Error('Completed tasks stay completed');
   if(command.type==='release'&&['hold','HOLD','waiting','on_hold'].includes(t.status))throw Error('Legacy held status needs reviewed migration before release');
   t.agenda_hold=command.type==='hold';event(command.type);
  }else throw Error('Unknown command');
 }
 return p;
}
return {projection,apply,state,taskContext};
});

