// Ladder v1.0 rules (owner-approved Nov 12, 2026, GitHub #115). Fictional data only.
const {test}=require('node:test'),a=require('node:assert/strict'),L=require('../dist/ladder.js');
const t0=Date.parse('2026-11-12T15:00:00Z');
const w=(id,cat,exerciseId,reps,extra={})=>({id,status:'complete',started:new Date(t0).toISOString(),exercisePlan:[L.moveFor(exerciseId,L.fresh(t0))],records:[{exercise:cat,round:'maximum',reps,exerciseId,...extra}],...extra.workout});

test('three ladders of six rungs plus one ELITE each, with permanent unique IDs',()=>{
 for(const c of L.CATEGORIES){const r=L.rungs(c);a.equal(r.length,7);a.deepEqual(r.map(x=>x.rung),[1,2,3,4,5,6,'ELITE'])}
 a.equal(new Set(L.EXERCISES.map(x=>x.id)).size,21);
 a.deepEqual(L.rungs('Push').map(x=>x.name),['Knee/incline push-ups','Push-ups','Decline push-ups','Ring push-ups','Parallel-bar dips','Ring dips','Weighted ring dips']);
 a.deepEqual(L.rungs('Squat').map(x=>x.name),['Chair squats','Squats','Jump Squats','Step-ups','Bulgarian split squats','Pistol squats','Weighted pistol squats']);
 a.deepEqual(L.rungs('Pull').map(x=>x.name+(x.variant?' '+x.variant:'')),['Inverted rows Bent-knee','Inverted rows Straight-leg','Assisted pull-ups','Pull-ups','Ring pull-ups','Assisted archer pull-ups','Bar muscle-ups Strict']);
});

test('approved thresholds: push/pull 15, two-leg squats 30 (incl. jump squats), one-leg 15 per side',()=>{
 for(const x of L.EXERCISES.filter(x=>!x.elite)){
  if(x.category==='Squat')a.equal(x.graduate,x.unilateral?15:30,x.id);else a.equal(x.graduate,15,x.id);
 }
 a.equal(L.byId('squat-3-jump').graduate,30);a.deepEqual(L.byId('squat-3-jump').entry,[15,20]);
 a.equal(L.byId('squat-4-step-up').unilateral,true);a.equal(L.byId('pull-6-assisted-archer').unilateral,true);a.equal(L.byId('pull-6-assisted-archer').side,'arm');
 a.equal(L.goalText(L.byId('squat-4-step-up')),'15 per leg clean reps');a.equal(L.entryText(L.byId('push-4-ring')),'8–10');
});

test('existing rung names match the names already in history, so prior bests carry over',()=>{
 a.deepEqual([L.byId('push-2-standard').name,L.byId('push-2-standard').variant],['Push-ups','Standard']);
 a.deepEqual([L.byId('squat-2-bodyweight').name,L.byId('squat-2-bodyweight').variant],['Squats','Bodyweight']);
 a.deepEqual([L.byId('squat-3-jump').name,L.byId('squat-3-jump').variant],['Jump Squats','Bodyweight']);
});

test('fresh state starts at the owner position and unlocks the rungs below it',()=>{
 const s=L.fresh(t0);a.ok(L.valid(s));a.deepEqual(s.current,{Push:'push-3-decline',Squat:'squat-3-jump',Pull:'pull-1-inverted-bent'});
 for(const id of ['push-1-knee-incline','push-2-standard','push-3-decline','squat-3-jump','pull-1-inverted-bent'])a.ok(s.unlocked.includes(id));
 a.ok(!s.unlocked.includes('push-4-ring'));
 a.deepEqual(L.planFor(s).map(m=>m.category),['Push','Squat','Pull']);
});

test('setup is part of the variant, so each box height, assistance and load keeps its own best',()=>{
 let s=L.fresh(t0);a.equal(L.variantFor(L.byId('squat-4-step-up'),s),'12-in box');
 s=L.setConfig(s,'squat-4-step-up',{boxIn:16},t0);a.equal(L.moveFor('squat-4-step-up',s).variant,'16-in box');
 a.throws(()=>L.setConfig(s,'squat-4-step-up',{boxIn:18},t0));
 s=L.setConfig(s,'pull-3-assisted',{assist:'green band'},t0);a.equal(L.moveFor('pull-3-assisted',s).variant,'Assist: green band');
 s=L.setConfig(s,'push-elite-weighted-ring-dips',{loadLb:10},t0);a.equal(L.moveFor('push-elite-weighted-ring-dips',s).variant,'+10 lb');
 a.equal(L.moveFor('pull-elite-muscle-up',s).variant,'Strict · +0 lb');
 a.throws(()=>L.setConfig(s,'push-2-standard',{boxIn:12},t0));
 a.equal(s.events.filter(e=>e.type==='setup-changed').length,3);
});

test('graduating Round 1 unlocks the next rung for the NEXT workout and records an event',()=>{
 let s=L.fresh(t0);const r=L.sync(s,[w('w1','Push','push-3-decline',15)],t0+1);
 a.equal(r.graduations.length,1);a.equal(r.state.current.Push,'push-4-ring');a.ok(r.state.unlocked.includes('push-4-ring'));
 a.equal(r.state.events.at(-1).type,'graduated');a.equal(r.state.events.at(-1).workoutId,'w1');a.deepEqual(r.state.celebration.items[0],{from:'push-3-decline',to:'push-4-ring',reps:15});
 const again=L.sync(r.state,[w('w1','Push','push-3-decline',15)],t0+2);a.equal(again.graduations.length,0,'a workout is processed once');
});

test('no graduation below threshold, for practice, for Round 2, or for an old rung',()=>{
 const s=L.fresh(t0);
 a.equal(L.sync(s,[w('a','Push','push-3-decline',14)],t0).graduations.length,0);
 a.equal(L.sync(s,[w('b','Push','push-3-decline',20,{workout:{practice:true}})],t0).graduations.length,0);
 const r2={id:'c',status:'complete',records:[{exercise:'Push',round:'conditioning',reps:30,exerciseId:'push-3-decline'}]};
 a.equal(L.sync(s,[r2],t0).graduations.length,0);
 a.equal(L.sync(s,[w('d','Push','push-2-standard',40)],t0).graduations.length,0,'only the current rung can graduate');
 a.equal(L.sync(s,[{id:'old',status:'complete',records:[{exercise:'Push',round:'maximum',reps:40}]}],t0).graduations.length,0,'untagged old records never graduate');
});

test('two-leg squats need 30; one-leg step-ups need 15 on the weaker side',()=>{
 let s=L.fresh(t0);
 a.equal(L.sync(s,[w('j1','Squat','squat-3-jump',29)],t0).graduations.length,0);
 s=L.sync(s,[w('j2','Squat','squat-3-jump',30)],t0).state;a.equal(s.current.Squat,'squat-4-step-up');
 const step=(id,l,r)=>({id,status:'complete',exercisePlan:[L.moveFor('squat-4-step-up',s)],records:[{exercise:'Squat',round:'maximum',reps:Math.min(l,r),sideReps:{left:l,right:r},exerciseId:'squat-4-step-up'}]});
 a.equal(L.sync(s,[step('s1',20,14)],t0).graduations.length,0,'weaker side governs');
 a.equal(L.sync(s,[step('s2',15,16)],t0).state.current.Squat,'squat-5-bulgarian');
});

test('rung 6 unlocks ELITE; ELITE has no further rung; muscle-up is a separate owner-confirmed achievement',()=>{
 let s=L.setCurrent(L.fresh(t0),'pull-6-assisted-archer',t0);
 a.throws(()=>L.confirmAchievement(s,'first-clean-muscle-up',t0),/Graduate Pull rung 6/);
 const r=L.sync(s,[w('p6','Pull','pull-6-assisted-archer',15,{sideReps:{left:15,right:16}})],t0);
 a.equal(r.state.current.Pull,'pull-elite-muscle-up');a.equal(r.state.events.at(-1).type,'elite-unlocked');
 a.equal(r.state.achievements.length,0,'unlocking ELITE does not award the muscle-up');
 a.equal(L.next('pull-elite-muscle-up'),null);
 s=L.confirmAchievement(r.state,'first-clean-muscle-up',t0);a.equal(s.achievements[0].confirmedBy,'owner');
 a.equal(L.confirmAchievement(s,'first-clean-muscle-up',t0).achievements.length,1,'awarded once');
});

test('archive, never delete: owner rung changes and graduations only ever add history',()=>{
 let s=L.fresh(t0);const before=s.events.length;
 s=L.setCurrent(s,'push-2-standard',t0);a.equal(s.current.Push,'push-2-standard');a.ok(s.unlocked.includes('push-3-decline'),'going back keeps later unlocks');
 s=L.setCurrent(s,'push-3-decline',t0);a.equal(s.events.length,before+2);
 s=L.sync(s,[w('g','Push','push-3-decline',16)],t0).state;
 const n=s.events.length,u=s.unlocked.length;s=L.setCurrent(s,'push-1-knee-incline',t0);
 a.ok(s.events.length>n&&s.unlocked.length===u);a.ok(s.unlocked.includes('push-4-ring'));
});

test('invalid saved state is replaced by a fresh one instead of throwing; art falls back',()=>{
 a.ok(L.valid(L.ensure({version:'0.9'},t0)));a.ok(L.valid(L.ensure(null,t0)));
 a.equal(L.art('push-4-ring'),null,'no rung art committed yet: movement picture is used');
});

test('backup carries ladder progress; restore adopts it only when the device has none, never overwrites',()=>{
 globalThis.PureLadder=L;const J=require('../dist/journal.js');
 let s=L.sync(L.fresh(t0),[w('g1','Push','push-3-decline',15)],t0).state;
 const backup={schema:'the-pure-backup-v2',history:[{id:'g1',started:new Date(t0).toISOString(),status:'complete',records:[{exercise:'Push',round:'maximum',reps:15,exerciseId:'push-3-decline'}]}],settings:{ladder:s}};
 const parsed=J.parseBackup(JSON.stringify(backup));a.equal(parsed.ladder.current.Push,'push-4-ring');
 const empty={schema:'the-pure-store-v2',revision:0,active:null,history:[]};
 const merged=J.merge(empty,parsed);a.equal(merged.settings.ladder.current.Push,'push-4-ring');a.equal(merged.history.length,1);
 const mine=L.setCurrent(L.fresh(t0),'push-2-standard',t0),kept=J.merge({...empty,settings:{ladder:mine}},parsed);
 a.equal(kept.settings.ladder.current.Push,'push-2-standard','existing ladder on this device is never overwritten');
 a.equal(J.merge(empty,J.parseBackup(JSON.stringify({...backup,settings:{}}))).settings,undefined,'old backups without a ladder change nothing');
});
test('temporary Purist art exists only for exact rung matches, and every listed file is precached',()=>{
 const fs=require('fs'),sw=fs.readFileSync(__dirname+'/../dist/sw.js','utf8');
 for(const x of L.EXERCISES){const a=L.art(x.id);if(!a)continue;a.length;require('node:assert').ok(fs.existsSync(__dirname+'/../dist/'+a),a);require('node:assert').ok(sw.includes("'./"+a+"'"),a+' precached')}
 a.equal(L.art('pull-1-inverted-bent'),'exercises/pull-1-inverted-bent.webp','bent-knee row from Chat\'s Nov 13 Purist set');a.equal(L.art('push-4-ring'),null,'no exact panel: silhouette stays');a.equal(L.art('push-3-decline'),'exercises/push-3-decline.webp');
});
