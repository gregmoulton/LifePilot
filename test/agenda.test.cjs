const {test}=require('node:test');const assert=require('node:assert/strict');
const radar=require('../forward-radar.js'),agenda=require('../agenda-model.js');
const now=new Date('2026-10-24T12:00:00Z');
const task=(id,extra={})=>({id,name:'Fictional '+id,status:'planned',due:'2026-10-24',...extra});
const profile=(list=[])=>({goals:[{id:'goal',name:'Fictional goal',unknown:'retain'}],execution:{tasks:list},system_improvement_log:[{id:'log',details:'Fictional evidence'}],unknown_top:{keep:true}});
test('date-only local day is correct across Phoenix and UTC',()=>{for(const tz of ['America/Phoenix','UTC']){const old=process.env.TZ;process.env.TZ=tz;try{assert.equal(radar.daysUntil('2026-10-24',now),0);assert.equal(radar.daysUntil('2026-02-30',now),Infinity);}finally{if(old===undefined)delete process.env.TZ;else process.env.TZ=old;}}});
test('same-day carryover rerun is idempotent and does not mutate source',()=>{const t=task('a',{due:'2026-10-22'}),before=JSON.stringify(t);const a=radar.carryForward([t],now);const b=radar.carryForward(a,now);assert.deepEqual(a,b);assert.equal(JSON.stringify(t),before);assert.equal(radar.carryForward(b,new Date('2026-10-25T12:00Z'))[0].carryover_count,2);});
test('horizon is honored as N calendar days including today',()=>{const list=[task('a'),task('b',{due:'2026-10-25'}),task('c',{due:'2026-10-31'})];assert.deepEqual(radar.forwardRadar({tasks:list,now,horizonDays:1}).items.map(t=>t.id),['a']);assert.equal(radar.forwardRadar({tasks:list,now,horizonDays:7}).summary.horizon_days,7);assert.equal(radar.forwardRadar({tasks:list,now,horizonDays:7}).items.length,2);assert.throws(()=>radar.forwardRadar({tasks:list,horizonDays:0}));});
test('done/waiting and unknown statuses cannot become executable recommendations',()=>{const r=radar.forwardRadar({tasks:[task('a',{status:'done'}),task('b',{status:'waiting'}),task('c',{status:'mystery'})],now});assert.equal(r.recommendations.length,0);assert(!r.items.some(t=>t.id==='a'));assert.equal(r.items.find(t=>t.id==='b').hold,true);});
test('duplicate IDs fail closed instead of resurrecting a completed duplicate',()=>assert.throws(()=>radar.forwardRadar({tasks:[task('a',{status:'completed'}),task('a')],now}),/duplicate/));
test('dependency cycle stays blocked; every proposal requires approval',()=>{const r=radar.forwardRadar({tasks:[task('a',{prerequisite_id:'b'}),task('b',{prerequisite_id:'a'})],now});assert(r.items.every(t=>t.blocked));assert(r.recommendations.every(p=>p.type==='unblock'&&p.requires_approval));});
test('Agenda separates future/HOLD/completed, results needing review and carryover',()=>{const p=profile([task('today'),task('old',{due:'2026-10-22'}),task('future',{due:'2026-10-28'}),task('hold',{agenda_hold:true}),task('done',{status:'completed'}),task('partial',{status:'partial',actual_minutes:3}),task('invalid',{due:'bad'}),task('blocked',{prerequisite_id:'missing'})]);const v=agenda.projection(p,now);assert.equal(v.today.length,2);assert.equal(v.upcoming.length,1);assert.equal(v.hold.length,2);assert.equal(v.completed.length,1);assert.equal(v.review.length,2);assert.equal(v.today.find(t=>t.id==='old').due,'2026-10-22');});
test('Refresh is proposal-only and never persists carried task copies',()=>{const p=profile([task('a',{due:'2026-10-22',actual_minutes:5,history:[{type:'result'}]})]);const before=JSON.stringify(p.execution.tasks);const a=agenda.apply(p,{type:'refresh'},now);const b=agenda.apply(a,{type:'refresh'},now);assert.equal(JSON.stringify(b.execution.tasks),before);assert.equal(b.agenda.proposals.length,1);assert.deepEqual(p.unknown_top,{keep:true});assert.equal(p.agenda,undefined);});
test('approval requires explicit owner decision and matching task snapshot',()=>{let p=agenda.apply(profile([task('a',{due:'2026-10-22'})]),{type:'refresh'},now);const id=p.agenda.proposals[0].id;assert.throws(()=>agenda.apply(p,{type:'approve',proposal_id:id,due:'2026-10-26'},now),/approval/);const approved=agenda.apply(p,{type:'approve',proposal_id:id,due:'2026-10-26',approved:true},now);assert.equal(approved.execution.tasks[0].due,'2026-10-26');assert.equal(approved.agenda.proposals[0].status,'applied');p.execution.tasks[0].name='Changed';assert.throws(()=>agenda.apply(p,{type:'approve',proposal_id:id,due:'2026-10-26',approved:true},now),/Task changed/);});
test('rejection memory suppresses repeat proposal after JSON restart',()=>{let p=agenda.apply(profile([task('a')]),{type:'refresh'},now);p=agenda.apply(p,{type:'reject',proposal_id:p.agenda.proposals[0].id},now);p=agenda.apply(JSON.parse(JSON.stringify(p)),{type:'refresh'},now);assert.equal(p.agenda.proposals.length,1);assert.equal(p.agenda.proposals[0].status,'rejected');assert.equal(p.agenda.rejections.length,1);});
test('completion is durable/idempotent and preserves legacy fields and logs',()=>{let p=profile([task('a',{goal_id:'goal',program_id:'program',milestone_id:'milestone',custom:'keep'})]);p=agenda.apply(p,{type:'complete',task_id:'a',minutes:7},now);p=agenda.apply(p,{type:'complete',task_id:'a',minutes:7},now);assert.equal(p.agenda.events.filter(e=>e.type==='completed').length,1);assert.equal(p.execution.tasks[0].custom,'keep');assert.equal(p.execution.tasks[0].actual_minutes,7);assert.equal(p.execution.tasks[0].goal_id,'goal');assert.equal(p.system_improvement_log.length,1);assert.equal(agenda.projection(p,now).today.length,0);});
test('HOLD and prerequisites cannot be bypassed by completion',()=>{const p=profile([task('a',{agenda_hold:true}),task('b',{prerequisite_id:'a'})]);assert.throws(()=>agenda.apply(p,{type:'complete',task_id:'a',minutes:0},now));assert.throws(()=>agenda.apply(p,{type:'complete',task_id:'b',minutes:0},now));const r=agenda.apply(p,{type:'release',task_id:'a'},now);assert.equal(agenda.projection(r,now).today.length,1);});
test('Refresh retires stale proposals without applying them',()=>{let p=agenda.apply(profile([task('a')]),{type:'refresh'},now);p.execution.tasks[0].name='Fictional revised name';p=agenda.apply(p,{type:'refresh'},now);assert.equal(p.agenda.proposals[0].status,'stale');assert.equal(p.agenda.proposals[1].status,'proposed');assert.equal(p.execution.tasks[0].status,'planned');});

test('approved priority changes visible ordering and records an owner decision',()=>{let p=profile([task('a'),task('b')]);p=agenda.apply(p,{type:'refresh'},now);const id=p.agenda.proposals.find(x=>x.task_id==='b').id;p=agenda.apply(p,{type:'approve',proposal_id:id,approved:true},now);assert.equal(agenda.projection(p,now).today[0].id,'b');assert.equal(p.decision_register[0].status,'approved');});


test('owner importance survives restart, orders active tasks and leaves feasibility/date separate',()=>{
 let p=profile([]);
 for(const [id,level] of [['low','low'],['normal','normal'],['high','high']])p=agenda.apply(p,{type:'add',task:{id,name:'Fictional '+id,due:'2026-10-24',agenda_importance:level}},now);
 p=JSON.parse(JSON.stringify(p));assert.deepEqual(agenda.projection(p,now).today.map(t=>t.id),['high','normal','low']);
 assert.equal(p.execution.tasks.find(t=>t.id==='high').importance,3);
 assert(p.execution.tasks.every(t=>t.due==='2026-10-24'&&t.status==='planned'&&!t.agenda_hold));
 assert.throws(()=>agenda.apply(p,{type:'add',task:{id:'bad',name:'Fictional invalid',agenda_importance:'urgent'}},now),/priority/);
});

test('Later survives restart and Refresh without changing tasks or rejecting the recommendation',()=>{
 const original=profile([task('a',{due:'2026-10-22',history:[{keep:true}]})]);
 let p=agenda.apply(original,{type:'refresh'},now);const id=p.agenda.proposals[0].id;
 p=agenda.apply(p,{type:'defer',proposal_id:id},now);
 p=agenda.apply(JSON.parse(JSON.stringify(p)),{type:'refresh'},new Date('2026-10-25T12:00Z'));
 assert.equal(p.agenda.proposals.length,1);assert.equal(p.agenda.proposals[0].status,'deferred');
 assert.equal(p.agenda.rejections.length,0);assert.deepEqual(p.execution,original.execution);
 assert.equal(agenda.projection(p,now).today[0].overdue,true);
 assert.equal(p.agenda.events.filter(x=>x.type==='proposal_deferred').length,1);
});
test('Review again restores the same proposal without applying it; explicit approval still required',()=>{
 let p=agenda.apply(profile([task('a')]),{type:'refresh'},now);const id=p.agenda.proposals[0].id;
 p=agenda.apply(p,{type:'defer',proposal_id:id},now);
 assert.throws(()=>agenda.apply(p,{type:'approve',proposal_id:id,approved:true},now),/awaiting/);
 p=agenda.apply(p,{type:'resume',proposal_id:id},now);
 assert.equal(p.agenda.proposals[0].status,'proposed');assert.equal(p.execution.tasks[0].agenda_priority,undefined);
 assert.throws(()=>agenda.apply(p,{type:'approve',proposal_id:id},now),/approval/);
 p=agenda.apply(p,{type:'approve',proposal_id:id,approved:true},now);assert.equal(p.execution.tasks[0].agenda_priority,true);
});
test('changed or completed task invalidates deferred advice; old advice cannot resume',()=>{
 for(const edit of [t=>t.name='Revised',t=>t.status='completed']){
  let p=agenda.apply(profile([task('a')]),{type:'refresh'},now);const id=p.agenda.proposals[0].id;
  p=agenda.apply(p,{type:'defer',proposal_id:id},now);edit(p.execution.tasks[0]);
  const before=JSON.stringify(p);
  assert.throws(()=>agenda.apply(p,{type:'resume',proposal_id:id},now),/Task changed/);assert.equal(JSON.stringify(p),before);
  p=agenda.apply(p,{type:'refresh'},now);assert.equal(p.agenda.proposals[0].status,'stale');
  assert.throws(()=>agenda.apply(p,{type:'resume',proposal_id:id},now),/awaiting/);
 }
});
test('duplicate Later and missing proposal fail without mutating source',()=>{
 let p=agenda.apply(profile([task('a')]),{type:'refresh'},now);const id=p.agenda.proposals[0].id;
 p=agenda.apply(p,{type:'defer',proposal_id:id},now);const before=JSON.stringify(p);
 assert.throws(()=>agenda.apply(p,{type:'defer',proposal_id:id},now),/awaiting/);
 assert.throws(()=>agenda.apply(p,{type:'resume',proposal_id:'missing'},now),/awaiting/);
 assert.equal(JSON.stringify(p),before);
});

test('reviewed task batch preserves per-task dates/priorities and legacy data across restart',()=>{
 const original=profile([task('existing',{custom:'retain'})]),before=JSON.stringify(original);
 const tasks=[{id:'one',name:' Fictional errand ',due:'2026-10-24',agenda_importance:'high'},{id:'two',name:'Fictional pickup',due:'2026-10-25',agenda_importance:'normal'},{id:'three',name:'Fictional online task',due:'',agenda_importance:'low'}];
 const p=agenda.apply(original,{type:'add-many',tasks,approved:true},now),restart=JSON.parse(JSON.stringify(p));
 assert.equal(JSON.stringify(original),before);assert.equal(restart.execution.tasks.length,4);assert.equal(restart.execution.tasks[1].name,'Fictional errand');
 assert.equal(restart.execution.tasks[2].due,'2026-10-25');assert.equal(restart.execution.tasks[3].due,'');assert.equal(restart.execution.tasks[3].agenda_importance,'low');
 assert.deepEqual(restart.goals,original.goals);assert.deepEqual(restart.execution.tasks[0],original.execution.tasks[0]);assert.equal(restart.agenda.events.filter(e=>e.type==='added').length,3);
});
test('batch validation is all-or-nothing, requires review and rejects repeated IDs',()=>{
 const p=profile([task('old')]),before=JSON.stringify(p),good={id:'new',name:'Fictional valid'};
 for(const tasks of [[good,{id:'bad',name:''}],[good,{id:'new',name:'Duplicate'}],[good,{id:'old',name:'Existing collision'}],[good,{id:'bad',name:'Invalid date',due:'2026-02-30'}],[good,{id:'bad',name:42}]]){
  assert.throws(()=>agenda.apply(p,{type:'add-many',tasks,approved:true},now));assert.equal(JSON.stringify(p),before);
 }
 assert.throws(()=>agenda.apply(p,{type:'add-many',tasks:[good]},now),/Review/);
 assert.throws(()=>agenda.apply(p,{type:'add-many',tasks:[],approved:true},now),/20/);
 assert.throws(()=>agenda.apply(p,{type:'add-many',tasks:Array(21).fill(good),approved:true},now),/20/);
});

test('Today and Unscheduled are disjoint projections with original carryover dates preserved',()=>{
 const p=profile([task('old',{due:'2020-01-01'}),task('today'),task('undated',{due:''}),task('missing-date',{due:undefined}),task('held',{due:'',agenda_hold:true}),task('blocked',{due:'',prerequisite_id:'missing'}),task('done',{due:'',status:'completed'})]);
 const before=JSON.stringify(p),v=agenda.projection(p,now);assert.deepEqual(v.today.map(t=>t.id),['old','today']);assert.deepEqual(v.unscheduled.map(t=>t.id),['undated','missing-date']);
 assert.equal(v.today[0].due,'2020-01-01');assert.equal(v.today[0].overdue,true);assert.equal(v.hold.length,2);assert.equal(v.completed.length,1);
 assert.equal(JSON.stringify(p),before);
});
test('Plan today uses local date, keeps original fields and survives Refresh/restart/day rollover',()=>{
 const old=process.env.TZ;process.env.TZ='America/Phoenix';try{
 const p=profile([task('undated',{due:'',notes:'retain',goal_id:'goal'}),task('old',{due:'2020-01-01'})]),before=JSON.stringify(p);
 let r=agenda.apply(p,{type:'plan-today',task_id:'undated'},new Date('2026-10-28T02:00:00Z'));
 assert.equal(r.execution.tasks[0].due,'2026-10-27');assert.equal(r.execution.tasks[0].notes,'retain');assert.equal(r.execution.tasks[0].goal_id,'goal');
 assert.equal(r.agenda.events[0].type,'planned_today');assert.equal(r.agenda.events[0].previous_due,'');assert.equal(JSON.stringify(p),before);
 r=agenda.apply(JSON.parse(JSON.stringify(r)),{type:'refresh'},new Date('2026-10-29T02:00:00Z'));
 assert.equal(r.execution.tasks[0].due,'2026-10-27');assert.equal(r.execution.tasks[1].due,'2020-01-01');assert.equal(agenda.projection(r,new Date('2026-10-29T02:00:00Z')).today[0].overdue,true);
 }finally{if(old===undefined)delete process.env.TZ;else process.env.TZ=old;}
});
test('Plan today cannot overwrite dates, complete tasks, release HOLD or bypass prerequisites',()=>{
 for(const t of [task('a'),task('a',{due:'',status:'completed'}),task('a',{due:'',agenda_hold:true}),task('a',{due:'',prerequisite_id:'missing'})]){
  const p=profile([t]),before=JSON.stringify(p);assert.throws(()=>agenda.apply(p,{type:'plan-today',task_id:'a'},now),/undated/);assert.equal(JSON.stringify(p),before);
 }
 const p=agenda.apply(profile([task('a',{due:''})]),{type:'plan-today',task_id:'a'},now),before=JSON.stringify(p);
 assert.throws(()=>agenda.apply(p,{type:'plan-today',task_id:'a'},now));assert.equal(JSON.stringify(p),before);
});
