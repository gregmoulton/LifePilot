'use strict';
// The Pure — Ladder v1.0 (owner-approved Nov 12, 2026; GitHub #115).
// Pure functions only. State lives in db.settings.ladder, so it is saved atomically with the
// workout store and included in every full backup. ARCHIVE, NEVER DELETE: nothing here removes
// an exercise, an unlock, an event or any workout record. Exercise IDs are permanent.
const PureLadder=(()=>{
 const VERSION='1.0';
 const CATEGORIES=['Push','Squat','Pull'];
 // name+variant are the keys the app already uses for "best" and the 70% floor, so existing rungs
 // reuse the exact names in older history (Push-ups/Standard, Squats/Bodyweight, Jump Squats/Bodyweight).
 // Equipment/assistance/load is appended to the variant so each setup keeps its own best.
 const D=(id,category,rung,name,variant,o={})=>Object.freeze({id,category,rung,name,variant,short:o.short||name,
  unilateral:!!o.unilateral,side:category==='Pull'?'arm':'leg',graduate:o.graduate??null,entry:o.entry??null,
  config:o.config||null,provisional:!!o.provisional,elite:rung==='ELITE',art:id+'.webp',
  equipment:Object.freeze(o.eq||[]),equipmentPending:o.eqPending||null});
 const P={graduate:15,entry:[8,10]},S2={graduate:30,entry:[15,20]},S1={graduate:15,entry:[8,10],unilateral:true};
 const EXERCISES=Object.freeze([
  D('push-1-knee-incline','Push',1,'Knee/incline push-ups','',{...P,short:'Knee push-ups',eq:['Bench or box (incline version)']}),
  D('push-2-standard','Push',2,'Push-ups','Standard',{...P,eq:[]}),
  D('push-3-decline','Push',3,'Decline push-ups','',{...P,eq:['Plyo box (feet)']}),
  D('push-4-ring','Push',4,'Ring push-ups','',{...P,eq:['Gymnastic rings']}),
  D('push-5-bar-dips','Push',5,'Parallel-bar dips','',{...P,short:'Bar dips',eq:['Parallel bars']}),
  D('push-6-ring-dips','Push',6,'Ring dips','',{...P,eq:['Gymnastic rings']}),
  D('push-elite-weighted-ring-dips','Push','ELITE','Weighted ring dips','',{config:'load',short:'Weighted dips',eq:['Gymnastic rings','Weight vest']}),
  D('squat-1-chair','Squat',1,'Chair squats','',{...S2,eq:['Chair']}),
  D('squat-2-bodyweight','Squat',2,'Squats','Bodyweight',{...S2,eq:[]}),
  D('squat-3-jump','Squat',3,'Jump Squats','Bodyweight',{...S2,short:'Jump squats',eq:[]}),
  D('squat-4-step-up','Squat',4,'Step-ups','',{...S1,config:'box',eq:['Plyo box']}),
  D('squat-5-bulgarian','Squat',5,'Bulgarian split squats','',{...S1,provisional:true,short:'Bulgarian squats',eq:['Bench or box (rear foot)']}),
  D('squat-6-pistol','Squat',6,'Pistol squats','',{...S1,provisional:true,short:'Pistols',eq:[]}),
  D('squat-elite-weighted-pistol','Squat','ELITE','Weighted pistol squats','',{unilateral:true,config:'load',provisional:true,short:'Weighted pistols',eq:['Added weight'],eqPending:'Type of weight not yet chosen by the owner'}),
  D('pull-1-inverted-bent','Pull',1,'Inverted rows','Bent-knee',{...P,short:'Bent-knee rows',eq:['Waist-height bar or rings'],eqPending:'Owner to confirm: bar or rings'}),
  D('pull-2-inverted-straight','Pull',2,'Inverted rows','Straight-leg',{...P,short:'Straight-leg rows',eq:['Waist-height bar or rings'],eqPending:'Owner to confirm: bar or rings'}),
  D('pull-3-assisted','Pull',3,'Assisted pull-ups','',{...P,config:'assist',eq:['Pull-up bar','Assistance (band)'],eqPending:'Assistance type is recorded per workout'}),
  D('pull-4-pullup','Pull',4,'Pull-ups','',{...P,eq:['Pull-up bar']}),
  D('pull-5-ring-pullup','Pull',5,'Ring pull-ups','',{...P,provisional:true,eq:['Gymnastic rings']}),
  D('pull-6-assisted-archer','Pull',6,'Assisted archer pull-ups','',{...P,unilateral:true,config:'assist',provisional:true,short:'Archer pull-ups',eq:['Pull-up bar','Assistance (band)']}),
  D('pull-elite-muscle-up','Pull','ELITE','Bar muscle-ups','Strict',{config:'load',short:'Muscle-ups',eq:['Pull-up bar']})
 ]);
 const BY_ID=Object.freeze(Object.fromEntries(EXERCISES.map(x=>[x.id,x])));
 // Owner's starting position (Nov 11–12): decline push-ups and jump squats; pull rung is owner-set.
 const START={Push:'push-3-decline',Squat:'squat-3-jump',Pull:'pull-1-inverted-bent'};
 const ACHIEVEMENTS=Object.freeze({'first-clean-muscle-up':'First clean bar muscle-up'});
 const BOX=[12,14,16];
 // Filled in when approved rung art is committed to dist/exercises/. Missing art = movement fallback.
 // Temporary Purist art (owner Nov 13): cropped from the owner-approved Purist concept sheet; only panels that match the exact rung.
 const ART=new Set(["push-1-knee-incline", "push-2-standard", "push-3-decline", "push-5-bar-dips", "squat-2-bodyweight", "squat-3-jump", "squat-4-step-up", "squat-5-bulgarian", "squat-6-pistol", "pull-1-inverted-bent","pull-2-inverted-straight", "pull-4-pullup"]);
 const copy=x=>JSON.parse(JSON.stringify(x));
 const stamp=n=>new Date(n).toISOString();

 function byId(id){return BY_ID[id]||null}
 function rungs(category){return EXERCISES.filter(x=>x.category===category)}
 function next(id){const x=byId(id);if(!x||x.elite)return null;return rungs(x.category).find(y=>y.rung===(x.rung===6?'ELITE':x.rung+1))||null}
 function upTo(id){const x=byId(id);if(!x)return[];return rungs(x.category).filter(y=>x.elite||(!y.elite&&y.rung<=x.rung)).map(y=>y.id)}
 function fresh(now){const unlocked=CATEGORIES.flatMap(c=>upTo(START[c]));return {version:VERSION,created:stamp(now),current:{...START},config:{},unlocked,processed:[],events:[{type:'ladder-started',at:stamp(now),current:{...START}}],achievements:[],celebration:null}}
 function valid(s){return !!s&&s.version===VERSION&&CATEGORIES.every(c=>byId(s.current?.[c])?.category===c)&&Array.isArray(s.unlocked)&&s.unlocked.every(byId)&&Array.isArray(s.processed)&&Array.isArray(s.events)&&Array.isArray(s.achievements)&&typeof s.config==='object'&&s.config!==null}
 function ensure(s,now){return valid(s)?s:fresh(now)}

 function variantFor(x,s){const c=s?.config?.[x.id]||{},parts=[x.variant].filter(Boolean);
  if(x.config==='box')parts.push((BOX.includes(c.boxIn)?c.boxIn:12)+'-in box');
  if(x.config==='assist')parts.push('Assist: '+(typeof c.assist==='string'&&c.assist.trim()?c.assist.trim().slice(0,30):'not set'));
  if(x.config==='load')parts.push('+'+(Number.isFinite(c.loadLb)&&c.loadLb>=0&&c.loadLb<=300?c.loadLb:0)+' lb');
  return parts.join(' · ')}
 function moveFor(id,s){const x=byId(id);return {category:x.category,name:x.name,variant:variantFor(x,s),unilateral:x.unilateral,exerciseId:x.id,rung:x.rung,ladderVersion:VERSION}}
 function planFor(s){return CATEGORIES.map(c=>moveFor(s.current[c],s))}
 function art(id){return ART.has(id)?'exercises/'+byId(id).art:null}
 // Art status for the #121 manifest: final = owner-approved master; temporary = concept-sheet crop; missing = movement fallback.
 const FINAL=new Set(['push-3-decline','squat-3-jump','pull-1-inverted-bent']);
 function artStatus(id){return FINAL.has(id)?'final-approved':ART.has(id)?'temporary':'missing'}
 // Equipment line for the current setup (box height, assistance, load come from recorded setup, never assumed).
 function equipmentFor(id,s){const x=byId(id);if(!x)return [];const c=s?.config?.[id]||{};return x.equipment.map(e=>e.startsWith('Plyo box')&&BOX.includes(c.boxIn)?e.replace('Plyo box','Plyo box '+c.boxIn+'-in'):e)}
 // NEW: reached by a graduation or owner change and not yet done in a real (non-practice) workout. Clears itself after the first one.
 function isNew(id,s,history){const reached=(s?.events||[]).some(e=>(e.type==='graduated'||e.type==='elite-unlocked'||e.type==='owner-set-rung')&&e.to===id);if(!reached)return false;
  return !(history||[]).some(w=>!w.practice&&w.status==='complete'&&(w.records||[]).some(r=>(r.exerciseId||(w.exercisePlan||[]).find(m=>m.category===r.exercise)?.exerciseId)===id))}
 function goalText(x){return x.graduate?x.graduate+(x.unilateral?' per '+x.side:'')+' clean reps':'add load when ready'}
 function entryText(x){return x.entry?x.entry[0]+'–'+x.entry[1]+(x.unilateral?' per '+x.side:''):''}

 // Round-1 graduation for a saved, non-practice workout. Only ladder-tagged records count, and only
 // for the rung that was current when the workout was done. Unilateral reps are already the weaker side.
 function graduationsIn(s,w){const out=[];if(!w||w.practice||!Array.isArray(w.records))return out;
  for(const r of w.records){if(r.round!=='maximum')continue;
   const planned=(w.exercisePlan||[]).find(m=>m.category===r.exercise),id=r.exerciseId||planned?.exerciseId,x=byId(id);
   if(!x||!x.graduate||s.current[x.category]!==id||!Number.isSafeInteger(r.reps)||r.reps<x.graduate)continue;
   const n=next(id);if(!n||s.unlocked.includes(n.id))continue;out.push({from:id,to:n.id,reps:r.reps,sideReps:r.sideReps||null})}
  return out}
 // Applies new graduations; the new rung takes effect from the NEXT workout (this one is already saved).
 function sync(s,history,now){const st=copy(ensure(s,now));let changed=!valid(s);const won=[];
  for(const w of history||[]){if(!w?.id||st.processed.includes(w.id))continue;
   for(const g of graduationsIn(st,w)){st.unlocked.push(g.to);st.current[byId(g.to).category]=g.to;
    st.events.push({type:byId(g.to).elite?'elite-unlocked':'graduated',from:g.from,to:g.to,reps:g.reps,...(g.sideReps?{sideReps:g.sideReps}:{}),workoutId:w.id,at:stamp(now)});won.push(g)}
   st.processed.push(w.id);changed=true}
  if(won.length)st.celebration={at:stamp(now),items:won.map(g=>({from:g.from,to:g.to,reps:g.reps}))};
  return {state:st,changed,graduations:won}}
 function setCurrent(s,id,now){const x=byId(id);if(!x)throw Error('Unknown exercise.');const st=copy(s);
  for(const u of upTo(id))if(!st.unlocked.includes(u))st.unlocked.push(u);
  st.events.push({type:'owner-set-rung',from:st.current[x.category],to:id,at:stamp(now)});st.current[x.category]=id;return st}
 function setConfig(s,id,cfg,now){const x=byId(id);if(!x?.config)throw Error('This exercise has no setup to record.');const st=copy(s),c={...(st.config[id]||{})};
  if(x.config==='box'){if(!BOX.includes(+cfg.boxIn))throw Error('Choose a 12, 14 or 16 inch box.');c.boxIn=+cfg.boxIn}
  if(x.config==='assist'){const t=String(cfg.assist||'').trim();if(!t||t.length>30)throw Error('Describe the assistance in up to 30 characters.');c.assist=t}
  if(x.config==='load'){const n=+cfg.loadLb;if(!Number.isFinite(n)||n<0||n>300||Math.round(n*2)!==n*2)throw Error('Enter added load from 0 to 300 lb (half pounds allowed).');c.loadLb=n}
  st.config[id]=c;st.events.push({type:'setup-changed',exerciseId:id,setup:copy(c),at:stamp(now)});return st}
 function confirmAchievement(s,key,now){if(!ACHIEVEMENTS[key])throw Error('Unknown achievement.');if(key==='first-clean-muscle-up'&&!s.unlocked.includes('pull-elite-muscle-up'))throw Error('Graduate Pull rung 6 first.');
  if(s.achievements.some(a=>a.key===key))return s;const st=copy(s);st.achievements.push({key,title:ACHIEVEMENTS[key],at:stamp(now),confirmedBy:'owner'});st.events.push({type:'achievement',key,at:stamp(now)});return st}
 function dismissCelebration(s){if(!s?.celebration)return s;const st=copy(s);st.celebration=null;return st}
 return {VERSION,CATEGORIES,EXERCISES,START,ACHIEVEMENTS,BOX,byId,rungs,next,upTo,fresh,valid,ensure,variantFor,moveFor,planFor,art,artStatus,equipmentFor,isNew,goalText,entryText,graduationsIn,sync,setCurrent,setConfig,confirmAchievement,dismissCelebration};
})();
if(typeof module!=='undefined')module.exports=PureLadder;
