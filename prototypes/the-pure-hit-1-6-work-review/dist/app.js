'use strict';
// One atomic localStorage envelope prevents partial archive/active-session writes.
const Pure = (() => {
 const KEY='the-pure-hit-field-test-v2', LEGACY='the-pure-hit-field-test-v1';
 const EX=['Push','Squat','Pull'];
 // No-HRM exception: explicit timed recovery, default 2:00, adjustable in 15 s steps.
 const TIMED_DEFAULT=120,TIMED_MIN=30,TIMED_MAX=600,TIMED_STEP=15,CALIBRATION_WORKOUTS=3,FLOOR_PERCENT=70;
 const copy=x=>JSON.parse(JSON.stringify(x)), stamp=n=>new Date(n).toISOString();
 function fresh(){return {schema:'the-pure-store-v2',revision:0,active:null,history:[]}}
 function validPlan(plan){return Array.isArray(plan)&&plan.length===3&&new Set(plan.map(x=>x.category)).size===3&&plan.every(x=>EX.includes(x.category)&&typeof x.name==='string'&&x.name.trim().length>0&&x.name.length<=60&&typeof x.variant==='string'&&x.variant.length<=60&&typeof x.unilateral==='boolean')}
 function previousWorkout(history,move){
  const key=x=>String(x||'').trim().toLowerCase().replace(/\s+/g,' ');
  let latest=null,latestTime=-Infinity;
  for(const w of history||[]){if(w.practice||w.status!=='complete')continue;
   const rounds={maximum:null,conditioning:null};
   for(const r of w.records||[]){if(!Object.hasOwn(rounds,r.round)||r.exercise!==move.category)continue;
    const saved=w.exercisePlan?.find(x=>x.category===r.exercise);
    const name=r.exerciseName||saved?.name,variant=r.variation??saved?.variant;
    if(!name||variant===undefined||key(name)!==key(move.name)||key(variant)!==key(move.variant)||!!r.sideReps!==!!move.unilateral)continue;
    if(!Number.isSafeInteger(r.reps)||r.reps<0||r.reps>10000)continue;
    if(move.unilateral&&(!['left','right'].every(k=>Number.isSafeInteger(r.sideReps[k])&&r.sideReps[k]>=0&&r.sideReps[k]<=10000)||r.reps!==Math.min(r.sideReps.left,r.sideReps.right)))continue;
    rounds[r.round]=copy(r);
   }
   if(!rounds.maximum&&!rounds.conditioning)continue;
   const parsed=Date.parse(w.ended||w.started),time=Number.isFinite(parsed)?parsed:-Infinity;
   if(!latest||time>=latestTime){latest={...rounds,sessionId:w.id||null};latestTime=time;}
  }
  return latest;
 }
 function workoutReference(history,move,round=null){
  const last=previousWorkout(history,move);
  const count=r=>!r?'—':r.sideReps?'L '+r.sideReps.left+' / R '+r.sideReps.right:String(r.reps);
  if(last)return round?'Last: '+count(last[round]):'Last workout · R1: '+count(last.maximum)+' · R2: '+count(last.conditioning);
  const split=move.category==='Squat'&&move.unilateral&&/^split squats?$/i.test(move.name.trim());
  if(split)return round==='conditioning'?'NEW · —':round==='maximum'?'NEW · 10/leg':'NEW · R1 trial: 10 / leg · R2: —';
  return round?'Last: —':'No matching last workout';
 }
 function sequence(a){return a?.exercisePlan?.map(x=>x.category)||EX}
 function current(a){return a.exercisePlan?.[a.ex]||{category:EX[a.ex],name:EX[a.ex],variant:'',unilateral:false}}
 function validRecords(records,plan){const order=plan?.map(x=>x.category)||EX;return records.length<=6&&records.every((r,i)=>r.exercise===order[i%3]&&r.round===(i<3?'maximum':'conditioning')&&Number.isSafeInteger(r.reps)&&r.reps>=0&&r.reps<=10000&&(!r.sideReps||['left','right'].every(k=>Number.isSafeInteger(r.sideReps[k])&&r.sideReps[k]>=0&&r.sideReps[k]<=10000)&&r.reps===Math.min(r.sideReps.left,r.sideReps.right)))}
 function validActive(a){return a&&typeof a.id==='string'&&Number.isFinite(a.lastTickAt)&&[0,1].includes(a.round)&&Number.isInteger(a.ex)&&a.ex>=0&&a.ex<3&&['exercise','recovery'].includes(a.phase)&&Array.isArray(a.records)&&(!a.exercisePlan||validPlan(a.exercisePlan))&&validRecords(a.records,a.exercisePlan)&&Array.isArray(a.hr)&&Array.isArray(a.recoveries)&&Array.isArray(a.events)&&Number.isFinite(a.activeMs)&&Number.isFinite(a.recoveryMs)&&typeof a.paused==='boolean'&&(!a.pendingSide||current(a).unilateral&&Number.isSafeInteger(a.pendingSide.reps)&&a.pendingSide.reps>=0&&a.pendingSide.reps<=10000&&Number.isFinite(Date.parse(a.pendingSide.timestamp)))&&a.draft&&typeof a.draft.reps==='string'&&typeof a.draft.hr==='string'&&(!a.timedRecovery||typeof a.timedRecovery.started==='string'&&Number.isInteger(a.timedRecovery.plannedSeconds)&&a.timedRecovery.plannedSeconds>=TIMED_MIN&&a.timedRecovery.plannedSeconds<=TIMED_MAX)}
 function migrate(old,history,now){
  const db=fresh();if(!Array.isArray(history))throw Error('Invalid legacy history');db.history=history;
  if(old){if(!Array.isArray(old.records)||!Array.isArray(old.hr)||![0,1].includes(old.round)||!Number.isInteger(old.ex)||old.ex<0||old.ex>2||!['exercise','recovery'].includes(old.phase))throw Error('Invalid legacy session');
   const resumes=old.records.filter(x=>x.event),records=old.records.filter(x=>x.exercise);
   // Old checkpoint preceded step advancement. Derive the next step from durable reps.
   const max=records.filter(x=>x.round==='maximum').length,cond=records.filter(x=>x.round==='conditioning').length;
   const round=max>=3&&cond>0?1:old.round,phase=max>=3&&round===0?'recovery':'exercise',ex=round===1?Math.min(cond,2):Math.min(max,2);
   db.active={id:'legacy-'+old.started,started:old.started,round,ex,phase,records,hr:old.hr,recoveries:old.recoveries||[],events:[...resumes,{event:'legacy-restored',timestamp:stamp(now),timingUncertain:true}],paused:true,pauseStarted:stamp(now),lastTickAt:now,activeMs:0,recoveryMs:0,recoveryStarted:old.recoveryStarted||null,draft:{reps:'',hr:''},legacyTimingUncertain:true};
  }return db;
 }
 function load(storage,now){let raw=storage.getItem(KEY),db;
  if(raw!==null){db=JSON.parse(raw);if(db.schema!=='the-pure-store-v2'||!Number.isInteger(db.revision)||(!Array.isArray(db.history)||!db.history.every(x=>x&&Array.isArray(x.records)))||(db.active!==null&&!validActive(db.active)))throw Error('Invalid saved workout storage')}
  else {const h=JSON.parse(storage.getItem(LEGACY)||'[]'),a=JSON.parse(storage.getItem(LEGACY+'-active')||'null');db=migrate(a,h,now)}
  if(typeof PureJournal!=='undefined')PureJournal.validateExtras(db);
  if(db.active){const a=db.active;a.events.push({event:'interrupted-restored',timestamp:stamp(now),lastCheckpoint:stamp(a.lastTickAt),unobservedGapSeconds:Math.max(0,(now-a.lastTickAt)/1000)});if(a.countdownUntil)a.countdownRemainingMs=Math.max(0,a.countdownUntil-a.lastTickAt);delete a.recoveryWindow;a.paused=true;delete a.countdownUntil;a.pauseStarted=stamp(now);a.lastTickAt=now}
  return db;
 }
 function advance(a,now){const ms=Math.max(0,now-a.lastTickAt);if(!a.paused){if(!a.workoutEndedAt&&!['start','conditioning'].includes(a.countdownKind))a.activeMs+=ms;if(a.phase==='recovery')a.recoveryMs+=ms;if(a.countdownKind==='transition'&&a.countdownUntil)a.transitions.at(-1).activeMs+=ms}a.lastTickAt=now}
 function startHandsFree(now,id,settings={}){return {...startGuided(now,id),flowVersion:3,transitionSeconds:[3,5].includes(+settings.transitionSeconds)?+settings.transitionSeconds:5,thresholdBpm:Number.isFinite(+settings.thresholdBpm)&&+settings.thresholdBpm>=90&&+settings.thresholdBpm<=140?+settings.thresholdBpm:110,transitions:[],...(settings.exercisePlan?{exercisePlan:validPlan(settings.exercisePlan)?copy(settings.exercisePlan):(()=>{throw Error('Invalid exercise plan')})()}:{} )}}
 function beginCountdown(a,now,kind,seconds){a.countdownKind=kind;a.countdownRemainingMs=seconds*1000;a.countdownUntil=now+seconds*1000;a.lastTickAt=now}
 function endWorkout(a,now){advance(a,now);if(a.workoutEndedAt)return;if(a.phase==='recovery'&&!a.finalRecovery)a.recoveries.push({kind:'between-rounds',started:a.recoveryStarted,ended:stamp(now),durationSeconds:Math.round(a.recoveryMs/1000),manualOverride:true,overrideReason:'workout-ended-early',thresholdBpm:a.thresholdBpm||110});a.workoutEndedAt=stamp(now);const last=a.hr.at(-1);a.postExerciseHr=last&&now-Date.parse(last.timestamp)<=15000?copy(last):null;if(a.countdownKind==='transition'){Object.assign(a.transitions.at(-1),{abortedAt:stamp(now),status:'ended-early'})}delete a.countdownUntil;delete a.countdownRemainingMs;delete a.countdownKind;if(a.paused){a.events.push({event:'resume-for-cooldown',timestamp:stamp(now),pauseDurationSeconds:Math.max(0,(now-Date.parse(a.pauseStarted))/1000)});a.paused=false}a.phase='recovery';a.finalRecovery=true;a.recoveryStarted=stamp(now);a.recoveryMs=0;delete a.recoveryCheckpoint;a.events.push({event:'workout-ended-cooldown-started',timestamp:stamp(now)})}
 function startGuided(now,id){return {...start(now,id),flowVersion:2}}
 function countdown(a,now){if(a.flowVersion===3){beginCountdown(a,now,'start',5);return}pause(a,now,'start-countdown');a.countdownUntil=now+5000}
 function tickCountdown(a,now){if(a.flowVersion===3&&a.countdownUntil&&now>=a.countdownUntil){advance(a,now);if(a.countdownKind==='transition'){const t=a.transitions.at(-1);t.nextExerciseStarted=stamp(now);t.wallDurationSeconds=(now-Date.parse(t.exerciseCompleted))/1000;t.durationSeconds=t.activeMs/1000;t.interruptionSeconds=Math.max(0,t.wallDurationSeconds-t.durationSeconds)}a.events.push({event:'exercise-started',exercise:sequence(a)[a.ex],round:a.round,timestamp:stamp(now),countdownKind:a.countdownKind});delete a.countdownUntil;delete a.countdownRemainingMs;delete a.countdownKind;return true}if(a.countdownUntil&&now>=a.countdownUntil){delete a.countdownUntil;resume(a,now);return true}return false}
 function checkpoint(a,bpm,now){if(a.phase==='recovery'&&!a.paused&&bpm<=(a.thresholdBpm||110)&&!a.recoveryCheckpoint)a.recoveryCheckpoint={timestamp:stamp(now),bpm,elapsedMs:a.recoveryMs,measurementBasis:'first-observed-at-or-below-threshold'}}
 function sampleHr(a,value,now,source='bluetooth'){if(!/^\d+$/.test(value)||+value<30||+value>240)throw Error('Enter BPM from 30 to 240.');advance(a,now);a.hr.push({timestamp:stamp(now),bpm:+value,phase:a.paused?'paused':a.countdownKind==='transition'?'transition':a.phase,transitionIndex:a.countdownKind==='transition'?a.transitions.length-1:null,round:a.round===0?'maximum':'conditioning',recoveryStarted:a.phase==='recovery'?a.recoveryStarted:null,source});checkpoint(a,+value,now);}
 function project(a,now){const b=copy(a);advance(b,now);return b}
 function start(now,id){return {id,started:stamp(now),round:0,ex:0,phase:'exercise',records:[],hr:[],recoveries:[],events:[],paused:false,lastTickAt:now,activeMs:0,recoveryMs:0,recoveryStarted:null,draft:{reps:'',hr:''}}}
 function reps(a,value,now){if(a.records.length>=6)throw Error('All six exercises are recorded. End and save this workout.');if(a.paused||a.phase!=='exercise'||a.countdownUntil||a.countdownRemainingMs)throw Error('Resume the exercise first.');if(!/^\d+$/.test(value)||!Number.isSafeInteger(+value)||+value>10000)throw Error('Enter whole-number reps from 0 to 10000.');advance(a,now);const move=current(a);if(move.unilateral&&!a.pendingSide){a.pendingSide={reps:+value,timestamp:stamp(now),completionHr:a.hr.at(-1)?copy(a.hr.at(-1)):null};a.draft.reps='';return false}const sides=move.unilateral?{left:a.pendingSide.reps,right:+value}:null;a.records.push({...(a.exercisePlan?{exerciseName:move.name,variation:move.variant,repBasis:sides?'per-leg-minimum':'bilateral',...(sides?{sideReps:sides,leftCompleted:a.pendingSide.timestamp,leftCompletionHr:a.pendingSide.completionHr}:{})}:{}),round:a.round===0?'maximum':'conditioning',exercise:sequence(a)[a.ex],reps:sides?Math.min(sides.left,sides.right):+value,timestamp:stamp(now),completionHr:a.hr.at(-1)&&now-Date.parse(a.hr.at(-1).timestamp)<=15000?copy(a.hr.at(-1)):null});if(a.round===1){const f=a.floors?.find(x=>x.exercise===sequence(a)[a.ex]);if(f)Object.assign(a.records.at(-1),{floor:f.floor,maximumReps:f.maximumReps,metFloor:a.records.at(-1).reps>=f.floor})}delete a.pendingSide;a.draft.reps='';if(a.ex<2){const previous=sequence(a)[a.ex];a.ex++;if(a.flowVersion===3){a.transitions.push({round:a.round,from:previous,to:sequence(a)[a.ex],exerciseCompleted:stamp(now),completionTimeBasis:'rep-entry',nextStartBasis:'app-begin-cue-not-observed-motion',completionHr:copy(a.records.at(-1).completionHr),plannedSeconds:a.transitionSeconds,activeMs:0});beginCountdown(a,now,'transition',a.transitionSeconds)}}else if(a.round===0){a.phase='recovery';a.recoveryStarted=stamp(now);a.recoveryMs=0;delete a.recoveryCheckpoint;const floors=floorsFor(a);if(floors)a.floors=floors}else if(a.flowVersion>=2){if(a.flowVersion===3)endWorkout(a,now);else{a.phase='recovery';a.finalRecovery=true;a.recoveryStarted=stamp(now);a.recoveryMs=0}}else return true;return false}
 function hr(a,value,now){if(a.paused||a.phase!=='recovery')throw Error('Resume recovery first.');if(!/^\d+$/.test(value)||+value<30||+value>240)throw Error('Enter whole-number BPM from 30 to 240.');advance(a,now);a.hr.push({timestamp:stamp(now),bpm:+value,phase:'recovery',source:'manual',recoveryStarted:a.recoveryStarted});checkpoint(a,+value,now);a.draft.hr=''}
 // Between rounds only. Require observed BLE packets, never elapsed wall time alone.
 function observeRecovery(a,bpm,now){
  if(!a?.stableRecovery||a.phase!=='recovery'||a.finalRecovery||a.readyRecovery?.started===a.recoveryStarted)return;
  if(a.paused||!Number.isFinite(now)||!Number.isInteger(bpm)||bpm<30||bpm>=113){delete a.recoveryWindow;return;}
  let w=a.recoveryWindow;
  // At most two seconds between packets: one nominal one-second sample can be missed.
  if(w&&(now<=w.last||now-w.last>2000)){delete a.recoveryWindow;w=null;}
  if(!w){if(bpm<=110)a.recoveryWindow={first:now,last:now};return;}
  w.last=now;
  if(now-w.first>=5000){a.readyRecovery={started:a.recoveryStarted,timestamp:stamp(now),bpm};delete a.recoveryWindow;}
 }
 function timedInfo(a,now){const t=a.timedRecovery;if(!t||a.finalRecovery||a.phase!=='recovery'||t.started!==a.recoveryStarted)return null;const elapsed=a.recoveryMs+(a.paused?0:Math.max(0,now-a.lastTickAt));return {plannedSeconds:t.plannedSeconds,elapsedMs:elapsed,remainingMs:Math.max(0,t.plannedSeconds*1000-elapsed),ready:elapsed>=t.plannedSeconds*1000}}
 function recoveryInfo(a,now){const last=a.hr.filter(x=>x.recoveryStarted===a.recoveryStarted&&x.phase!=='paused').at(-1);const stale=!last||now-Date.parse(last.timestamp)>(a.flowVersion>=2?15000:60000)||now<Date.parse(last.timestamp);const hrOverride=a.stableRecovery&&!a.finalRecovery?a.readyRecovery?.started!==a.recoveryStarted:stale||last.bpm>(a.thresholdBpm||110);const timed=timedInfo(a,now);return {last,override:hrOverride&&!timed?.ready,stale,timed,basis:!hrOverride?'live-hr':timed?.ready?'timed-no-hrm':'manual-override'}}
 // Counts from the start of this recovery and excludes paused time. Never creates an HR reading.
 function startTimedRecovery(a,now,seconds=TIMED_DEFAULT){if(a.paused||a.phase!=='recovery'||a.finalRecovery)throw Error('Timed recovery is only available between rounds.');if(!Number.isInteger(seconds)||seconds<TIMED_MIN||seconds>TIMED_MAX)throw Error('Choose a timed recovery from '+TIMED_MIN+' to '+TIMED_MAX+' seconds.');if(a.timedRecovery?.started===a.recoveryStarted)return;advance(a,now);a.timedRecovery={started:a.recoveryStarted,plannedSeconds:seconds};a.events.push({event:'timed-recovery-started',timestamp:stamp(now),plannedSeconds:seconds,basis:'no-hrm-exception',elapsedRecoverySeconds:Math.round(a.recoveryMs/1000)})}
 function adjustTimedRecovery(a,now,delta){const t=a.timedRecovery;if(!t||t.started!==a.recoveryStarted||a.phase!=='recovery'||a.finalRecovery)throw Error('Timed recovery is not active.');if(![TIMED_STEP,-TIMED_STEP].includes(delta))throw Error('Adjust in '+TIMED_STEP+'-second steps.');const next=Math.min(TIMED_MAX,Math.max(TIMED_MIN,t.plannedSeconds+delta));if(next===t.plannedSeconds)return;advance(a,now);a.events.push({event:'timed-recovery-adjusted',timestamp:stamp(now),from:t.plannedSeconds,to:next});t.plannedSeconds=next}
 function recover(a,now,options={}){if(a.paused||a.phase!=='recovery')throw Error('Recovery is not active.');const info=recoveryInfo(a,now);if(a.flowVersion>=2&&info.override&&(!options.override||!options.reason))throw Error('Wait for a fresh HR at 110 BPM or lower, or use Monitor problem.');advance(a,now);a.recoveries.push({...(a.recoveryCheckpoint?{checkpoint:copy(a.recoveryCheckpoint)}:{}),started:a.recoveryStarted,ended:stamp(now),durationSeconds:Math.round(a.recoveryMs/1000),wallDurationSeconds:Math.max(0,Math.round((now-Date.parse(a.recoveryStarted))/1000)),kind:a.finalRecovery?'post-workout':'between-rounds',thresholdBpm:a.thresholdBpm||110,overrideReason:info.override?(options.reason||'legacy override'):null,manualOverride:info.override,lastRecordedBpm:info.last?.bpm??null,lastReadingTimestamp:info.last?.timestamp??null,readingStale:info.stale,...(a.finalRecovery?{}:{basis:info.basis}),...(info.timed?{timedRecovery:{plannedSeconds:info.timed.plannedSeconds,completed:info.timed.ready,hrMeasured:false}}:{}),...(a.stableRecovery&&!a.finalRecovery&&a.readyRecovery?.started===a.recoveryStarted?{ready:copy(a.readyRecovery)}:{})});if(a.finalRecovery){a.finalRecoveryFinished=true;return true}delete a.timedRecovery;a.round=1;a.ex=0;a.phase='exercise';a.draft.hr='';if(a.flowVersion===3)beginCountdown(a,now,'conditioning',(a.stableRecovery?3:a.transitionSeconds));return false}
 function pause(a,now,reason='manual'){if(a.paused)return;advance(a,now);if(a.countdownUntil){a.countdownRemainingMs=Math.max(0,a.countdownUntil-now);delete a.countdownUntil}delete a.recoveryWindow;a.paused=true;a.pauseStarted=stamp(now);a.events.push({event:'pause',reason,timestamp:stamp(now)})}
 function resume(a,now){if(!a.paused)return;a.events.push({event:'resume',timestamp:stamp(now),pauseDurationSeconds:Math.max(0,Math.round((now-Date.parse(a.pauseStarted))/1000))});a.paused=false;if(a.countdownKind)a.countdownUntil=now+(a.countdownRemainingMs||0);a.lastTickAt=now}
 function archive(db,now){const a=db.active;advance(a,now);const out={schema:'the-pure-hit-v2',...(a.exercisePlan?{exercisePlan:copy(a.exercisePlan)}:{}),...(a.pendingSide?{pendingSide:copy(a.pendingSide)}:{}),id:a.id,started:a.started,ended:stamp(now),status:a.records.length===6?'complete':'partial',durationSeconds:Math.round(a.activeMs/1000),wallDurationSeconds:Math.max(0,Math.round((now-Date.parse(a.started))/1000)),records:a.records,heartRateReadings:a.hr,recoveries:a.recoveries,events:a.events,draft:a.draft,...calibrationFor(db.history,a),transitions:a.transitions||[],floors:a.floors||null,...(a.floorRule?{floorRule:copy(a.floorRule)}:{}),workoutEndedAt:a.workoutEndedAt||null,cooldownDurationSeconds:a.finalRecovery?Math.round(a.recoveryMs/1000):null,postExerciseHr:a.postExerciseHr||null,peakHrScope:'all-recorded-session-readings',cooldownPeakHr:a.finalRecovery?a.hr.filter(r=>r.recoveryStarted===a.recoveryStarted).reduce((peak,r)=>Math.max(peak||0,r.bpm),null):null,peakHr:a.hr.length?a.hr.reduce((peak,r)=>Math.max(peak,r.bpm),0):null,legacyTimingUncertain:!!a.legacyTimingUncertain,userNotes:a.userNotes||'',notes:(calibrationFor(db.history,a).calibration?'Calibration workout: maximum effort, no conditioning floor computed.':(a.floors?'Post-calibration workout: Round 2 floor = 70% of this workout\'s Round 1 maximum, rounded up.':'Post-calibration workout: Round 1 incomplete, no floor computed.'))+' Duration excludes pauses and unobserved interruption gaps.'};
  if(a.phase==='recovery'&&!a.finalRecoveryFinished)out.incompleteRecovery={started:a.recoveryStarted,ended:stamp(now),durationSeconds:Math.round(a.recoveryMs/1000)};
  if(a.practice)db.practiceReceipt={...out,practice:true};else if(!db.history.some(x=>x.id===out.id))db.history.push(out);db.active=null;return out;
 }
 // Locked owner rule (Nov 11, 2026): after three calibration workouts, each exercise's Round 1 reps are
 // its established maximum; Round 2 floor = ceil(70% of it). Integer math avoids 10*0.7 rounding to 8.
 function floorFor(max){return Math.ceil(max*FLOOR_PERCENT/100)}
 function floorRuleFor(history,a){const c=calibrationFor(history,a);return {floorRule:{calibration:c.calibration,calibrationNumber:c.calibrationNumber,percent:FLOOR_PERCENT,maximumBasis:'this-workout-round-1'}}}
 function floorsFor(a){if(!a.floorRule||a.floorRule.calibration)return null;const max=a.records.filter(r=>r.round==='maximum');if(max.length!==3)return null;return max.map(r=>({exercise:r.exercise,exerciseName:r.exerciseName||r.exercise,maximumReps:r.reps,floor:floorFor(r.reps)}))}
 // Calibration = the first three completed, non-practice workouts. Partial and practice sessions do not count.
 function calibrationFor(history,a){if(a.floorRule)return {calibration:a.floorRule.calibration,calibrationNumber:a.floorRule.calibrationNumber};const prior=(history||[]).filter(w=>!w.practice&&w.status==='complete'&&w.id!==a.id).length;return prior<CALIBRATION_WORKOUTS?{calibration:true,calibrationNumber:prior+1}:{calibration:false,calibrationNumber:null}}
 function restoreActive(db,active,now){if(db.active)throw Error('Save or discard the current session before restoring another.');if(!active||db.history.some(w=>w.id===active.id))throw Error('Cannot restore a missing or already archived session.');const next=copy(db);next.active=copy(active);return load({getItem:key=>key===KEY?JSON.stringify(next):null},now)}
 return {KEY,LEGACY,EX,previousWorkout,workoutReference,validPlan,sequence,current,copy,fresh,load,start,project,reps,hr,recoveryInfo,recover,pause,resume,archive,advance,restoreActive,calibrationFor,floorFor,floorRuleFor,floorsFor,FLOOR_PERCENT,timedInfo,startTimedRecovery,adjustTimedRecovery,TIMED_DEFAULT,TIMED_MIN,TIMED_MAX,TIMED_STEP,CALIBRATION_WORKOUTS,startGuided,sampleHr,countdown,tickCountdown,startHandsFree,endWorkout,observeRecovery};
})();
if(typeof module!=='undefined')module.exports=Pure;
if(typeof document!=='undefined'){
 const $=id=>document.getElementById(id);let monitorReading=()=>null,voiceActive=false,voiceWanted=false,speechHooks={},speechSerial=0,localVoiceSelected=false,lastCountdownCue='',lastRecoveryCue='',audio,db,blocked=false,dirty=false,message='',verifiedRaw=null;
 const uid=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
 const duration=ms=>Math.floor(ms/60000)+':'+String(Math.floor(ms/1000)%60).padStart(2,'0');
 const now=()=>Date.now(), download=(obj,name)=>{const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}));a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000)};
 function unlockAudio(){
  try{
   const Context=globalThis.AudioContext||globalThis.webkitAudioContext;
   if(!Context)return;
   audio??=new Context();
   if(audio.state==='suspended')audio.resume().catch(()=>{});
  }catch{ /* The visual countdown remains available. */ }
 }
 function tone(kind){
  if(audio?.state!=='running'||document.hidden)return;
  try{
   const [frequency,duration]=kind==='go'?[1047,.18]:kind==='rep'?[587,.10]:kind==='ready'?[784,.14]:kind==='pause'?[392,.075]:kind==='resume'?[659,.075]:[523,.075];
   const at=audio.currentTime,oscillator=audio.createOscillator(),gain=audio.createGain();
   if(release&&(kind==='go'||kind==='rep'))oscillator.type='triangle';
   oscillator.frequency.value=frequency;
   gain.gain.setValueAtTime(.0001,at);
   gain.gain.exponentialRampToValueAtTime(.09,at+.012);
   gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
   oscillator.connect(gain);
   gain.connect(audio.destination);
   oscillator.start(at);
   oscillator.stop(at+duration);
  }catch{ /* The visual countdown remains available. */ }
 }
 function savedCue(){tone('rep')}
 function entryPhase(a){return a?.phase==='exercise'}
 function repEntryOpen(a=db.active){return !!a&&!a.paused&&entryPhase(a)&&!a.countdownKind}
 const release=document.body.dataset?.defaultSquat==='jump';
 function announce(text,queue=false){if(release||localVoiceSelected)return;try{if(typeof speechSynthesis==='undefined'||typeof SpeechSynthesisUtterance==='undefined')return;const serial=++speechSerial;if(!queue)speechSynthesis.cancel();const prompt=new SpeechSynthesisUtterance(text);prompt.lang='en-US';prompt.rate=1;prompt.onend=()=>{if(serial===speechSerial)speechHooks.resume?.()};prompt.onerror=prompt.onend;speechSynthesis.speak(prompt)}catch{ /* Visual state remains authoritative if device audio is unavailable. */ }}
 // Compare the exact previous verified bytes, not just a revision number. An
 // unverified write must never be presented as a saved workout or overwrite
 // another tab's update. No storage keys or schema are changed by this repair.
 function persist(){
  if(blocked)return false;
  try{
   const current=localStorage.getItem(Pure.KEY);
   if(current!==verifiedRaw){
    blocked=true;dirty=true;
    message='Saved data changed in another tab or could not be verified. This tab did NOT overwrite it. Export the unsaved workout and storage recovery copies.';
    return false;
   }
   const next=Pure.copy(db);next.revision++;
   const payload=JSON.stringify(next);
   localStorage.setItem(Pure.KEY,payload);
   const readBack=localStorage.getItem(Pure.KEY);
   if(readBack!==payload){
    dirty=true;
    if(readBack!==verifiedRaw){
     blocked=true;
     message='Storage returned different data after saving. No further writes will be attempted. Export the unsaved workout and raw storage recovery copies.';
    }else{
     message='Save NOT verified: the browser did not retain the change. Keep this page open, retry save or export your workout.';
    }
    return false;
   }
   verifiedRaw=payload;db=next;dirty=false;
   message='Saved on this device. Verified read-back.';
   return true;
  }catch{
   dirty=true;
   message='Local save failed. Keep this page open. Retry save or export your active workout.';
   return false;
  }
 }
 function render(){const a=db?.active,active=!!a;$('moreSessionNotice').textContent=a?'Your session is paused when you open these tools. Return to Workout to resume.':'Setup and tools, away from your workout.';const stage=!a?(db.history.length||db.practiceReceipt?'saved':'ready'):a.paused?'paused':a.countdownKind?'countdown':a.phase==='recovery'?(a.finalRecovery?'cooldown':'recovery'):'exercise';$('focusTitle').textContent=!a?(db.history.length?'Session saved':'THE PURE'):a.paused?'Paused':a.phase==='recovery'?(a.finalRecovery?'Cool down':'Recover'):Pure.current(a).name;$('focusRound').textContent=!a?'HIT 1.6 · REVIEW':a.finalRecovery?'COOLDOWN':a.round===0?'MAXIMUM EFFORT · 1 / 2':'CONDITIONING · 2 / 2';if(a?.round===1&&a.floorRule?.calibration&&a.phase==='exercise')$('focusRound').textContent+=' · CALIBRATION '+a.floorRule.calibrationNumber+' / 3 · NO FLOOR';if(a?.practice)$('focusRound').textContent='PRACTICE · '+$('focusRound').textContent;$('focusCount').textContent=a?.countdownUntil&&!a.paused?String(Math.max(1,Math.ceil((a.countdownUntil-now())/1000))):'';$('focusCount').classList.toggle('hidden',!a?.countdownUntil||a.paused);$('focusRound').parentElement?.setAttribute('data-stage',stage);$('focusTitle').parentElement?.setAttribute('data-stage',stage); for(const [id,hide] of [['start',active],['controls',!active],['pause',!active||a?.paused],['resume',!active||!a?.paused],['entry',!active||a?.paused||!entryPhase(a)||!!a?.countdownKind],['recovery',!active||a?.paused||a?.phase!=='recovery'],['retry',!dirty||blocked],['exportRaw',!blocked]])$(id).classList.toggle('hidden',hide);
  $('notice').classList.toggle('quiet',!dirty&&!blocked&&message==='Saved on this device. Verified read-back.');$('notice').textContent=message;for(const id of ['start','record','loghr','recover','pause','resume','end','discard','saveNow'])$(id).disabled=blocked||dirty||(id==='record'&&(a?.records.length>=6||a?.paused||!!a?.countdownKind));
  $('status').textContent=!active?'Ready':a.paused?'PAUSED — timer stopped':a.phase==='recovery'?'Recovery':a.round===0?'Maximum-effort round':'Conditioning round';
  $('instruction').textContent=!active?'Anything else is just a workout.':a.paused?'Timer stopped. Your records are kept.':a.phase==='recovery'?'Log a current HR reading, then continue at 110 BPM or lower, or explicitly override.':'To technical failure. Then report your reps.';
  if(a?.phase==='recovery'&&!a.paused){const info=Pure.recoveryInfo(a,now());$('status').textContent=a.finalRecovery?'Cooldown — HR recording continues':info.override?'Recovering — wait for '+(a.thresholdBpm||110)+' BPM':'Ready — start conditioning';$('instruction').textContent=a.finalRecovery?'Workout finished. Keep your monitor on.':info.override?'Rest until live HR reaches 110 BPM, then stays at or below 112 for 5 seconds.': 'Recovery complete. Next: '+(a.exercisePlan?.[0]?.name||'Push-ups')+'. Start when ready.';const timed=info.timed;if(!a.finalRecovery&&timed){$('status').textContent=timed.ready?'READY — timed recovery complete':'Timed recovery · '+duration(timed.remainingMs+999)+' left';$('instruction').textContent=timed.ready?'Timed recovery complete (no heart rate measured). Start conditioning when ready.':'No monitor: rest for the timed recovery. Adjust if needed.'}$('timedRecoveryPanel').classList.toggle('hidden',!!a.finalRecovery||info.basis==='live-hr'&&!timed||!timed&&!!monitorReading());$('timedRecoveryStart').classList.toggle('hidden',!!timed);$('timedRecoveryControls').classList.toggle('hidden',!timed);$('timedRecoveryRemaining').textContent=timed?(timed.ready?'READY':duration(timed.remainingMs+999))+' of '+duration(timed.plannedSeconds*1000):'';for(const id of ['timedRecoveryStart','timedMinus','timedPlus'])$(id).disabled=dirty||blocked;$('recover').textContent='Start conditioning';$('recover').disabled=dirty||blocked||info.override;$('recover').classList.toggle('hidden',!!a.finalRecovery)}
  else {$('recover').classList.remove('hidden');$('timedRecoveryPanel').classList.add('hidden')}
  if(a?.countdownUntil&&!a.paused){const name=Pure.current(a).name;$('status').textContent=(a.countdownKind==='conditioning'?'Round two · '+name+' in ':a.countdownKind==='transition'?'Next: '+name+' in ':'Starting in ')+Math.max(1,Math.ceil((a.countdownUntil-now())/1000));$('instruction').textContent='Prepare for '+name+'. Begin on the higher tone.';$('resume').classList.add('hidden');$('pause').classList.remove('hidden')}
  $('thresholdLabel').textContent=String(a?.thresholdBpm||db.settings?.thresholdBpm||110);$('repReceipt').textContent=a?.pendingSide?(dirty?'NOT SAVED: ':'Saved: ')+a.pendingSide.reps+' left · '+Pure.current(a).name:a?.records.length?(dirty?'NOT SAVED — ':'Saved: ')+(a.records.at(-1).sideReps?'L '+a.records.at(-1).sideReps.left+' / R '+a.records.at(-1).sideReps.right:a.records.at(-1).reps)+' '+(a.records.at(-1).exerciseName||a.records.at(-1).exercise)+' reps':'';
  $('finishCooldown').classList.toggle('hidden',!a?.finalRecovery);$('end').classList.toggle('hidden',!!a?.workoutEndedAt);
  $('recoveryTime').classList.toggle('hidden',!!a?.finalRecovery);
  $('cooldownTime').textContent=a?.finalRecovery?duration(Pure.project(a,now()).recoveryMs):'';
  $('status').classList.toggle('paused-state',!!a?.paused);
  $('sessionTimer').textContent=a?'Workout time '+Math.floor(Pure.project(a,now()).activeMs/60000)+':'+String(Math.floor(Pure.project(a,now()).activeMs/1000)%60).padStart(2,'0')+(a.paused?' · paused':''):'';
  const lastSaved=db.practiceReceipt||db.history.at(-1);if(!a&&lastSaved?.practice)$('practiceMode').checked=false;$('savedReceipt').classList.toggle('hidden',active||!lastSaved);$('savedTitle').textContent=dirty?'Workout is NOT SAVED — keep this page open':lastSaved?.practice?'Practice complete — excluded from history':lastSaved?.status==='complete'?'Workout complete — saved on this device':'Partial workout — saved on this device';$('savedDetails').textContent=lastSaved?lastSaved.records.length+' exercise entries · '+(lastSaved.heartRateReadings||[]).length+' HR readings · '+(lastSaved.recoveries||[]).length+' recovery records':'';if(typeof PureSummary!=='undefined')PureSummary.render($('premiumSummary'),dirty||blocked?null:lastSaved);$('summaryExport').disabled=dirty||blocked||!lastSaved;if(lastSaved){$('workoutReview').textContent=lastSaved.records.map(r=>(r.round==='maximum'?'Maximum':'Conditioning')+' · '+(r.exerciseName||r.exercise)+(r.variation?' ('+r.variation+')':'')+' · '+(r.sideReps?'L '+r.sideReps.left+' / R '+r.sideReps.right:r.reps)+' reps'+(Number.isInteger(r.floor)?' (floor '+r.floor+(r.metFloor?' met)':' missed)'):'')).join('\n')+'\n\n'+(lastSaved.recoveries||[]).map(r=>(r.kind==='post-workout'?'Cooldown':'Between rounds')+' · '+duration(r.checkpoint?.elapsedMs??r.durationSeconds*1000)+(r.checkpoint?' to observed checkpoint':'')+(r.manualOverride?' · exception recorded':' · '+r.lastRecordedBpm+' BPM')).join('\n')}
  const pauseEvent=a?.paused?a.events.findLast(event=>event.event==='pause'||event.event==='interrupted-restored'):null;
  $('resumeNotice').textContent=!a?.paused?'':pauseEvent?.reason==='page-hidden'?
   'Paused when Chrome went out of view. Tap Resume workout to continue.':pauseEvent?.event==='interrupted-restored'?
   'Saved session restored after Chrome reloaded. Tap Resume workout to continue.':'Session: '+new Date(a.started).toLocaleString();
  $('exercise').textContent=active&&a.phase==='exercise'?'Exercise: '+Pure.EX[a.ex]:'';
  if(a){$('reps').value=a.draft.reps;$('hr').value=a.draft.hr;$('sessionNotes').value=a.userNotes||''}else $('sessionNotes').value='';
  $('sessionNotes').disabled=!active||blocked||dirty;
  const last=a?.phase==='recovery'?a.hr.filter(r=>r.recoveryStarted===a.recoveryStarted).at(-1):a?.hr.at(-1);$('hrConfirm').textContent=last?'Recorded HR: '+last.bpm+' BPM'+(dirty?' · NOT SAVED':now()-Date.parse(last.timestamp)>15000?' · stale':' · saved'):'';
  $('recoveryTime').textContent=a?.phase==='recovery'?duration(Pure.project(a,now()).recoveryMs):'';
  $('summary').textContent=a?JSON.stringify({round:a.round===0?'Maximum effort':'Conditioning',exercise:Pure.EX[a.ex],phase:a.phase,records:a.records,heartRateReadings:a.hr,recoveries:a.recoveries,events:a.events,started:a.started,draft:a.draft},null,2):'No active workout.';
  $('workoutProgress').textContent=a?a.records.length+' of 6 exercises recorded':'No active workout.';
  $('repLedger').textContent=a?a.records.map(r=>(r.round==='maximum'?'Max':'Conditioning')+' · '+r.exercise+' · '+r.reps+' reps').join('\n'):'';
  $('history').textContent=db.history.map(x=>x.started+' · '+x.status+' · '+x.records.filter(r=>r.exercise).length+' exercises').join('\n')||'No archived sessions.';
  const entryOpen=repEntryOpen(a)&&!dirty&&!blocked;
  if(!entryOpen&&(!release||!a||a.paused||dirty||blocked))speechHooks.stop?.();
  $('entry').classList.toggle('hidden',!entryOpen);
  $('voicePanel').classList.toggle('hidden',!entryOpen);
  $('stopTalk').classList.toggle('hidden',!entryOpen||!voiceWanted);
  $('hrPreflight').classList.toggle('hidden',active);
  if(a?.phase==='recovery'&&!a.finalRecovery&&!a.paused&&!dirty&&!blocked&&
     !Pure.recoveryInfo(a,now()).override&&lastRecoveryCue!==a.recoveryStarted){
   lastRecoveryCue=a.recoveryStarted;
   tone('ready');
  }
  renderStationRows();if(typeof PureJournal!=='undefined')renderJournal();
 }
 function change(fn){if(blocked||dirty)return;try{const activeId=db.active?.id;fn();const saved=persist();if(!saved&&db.active?.flowVersion===3)Pure.pause(db.active,now(),'save-failed');render();if(release&&saved&&activeId&&!db.active&&(db.history.at(-1)?.id===activeId||db.practiceReceipt?.id===activeId))savedCue()}catch(e){message=e.message;render()}}
 function end(){if(!db.active)return;if(db.active.flowVersion===3){change(()=>Pure.endWorkout(db.active,now()));announce('Workout finished. Cooldown recording continues.')}else{Pure.archive(db,now());persist();render()}}
 $('start').onclick=()=>change(()=>{if(db.active)return;delete db.practiceReceipt;db.active=Pure.startHandsFree(now(),Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join(''),{...db.settings,exercisePlan:plan()});if(release){db.active.stableRecovery=true;db.active.thresholdBpm=110;}db.active.practice=!!$('practiceMode').checked;Object.assign(db.active,Pure.floorRuleFor(db.history,db.active));Pure.countdown(db.active,now())});

  const startWorkout=$('start').onclick;
  const closeHrGate=()=>{$('hrStartGate').classList.add('hidden')};
  const startWithHrDecision=(reading,explicitWithoutHr=false)=>{
   if(db.active||dirty||blocked||(!reading&&!explicitWithoutHr))return;
   unlockAudio();closeHrGate();startWorkout();
   if(db.active&&!dirty){
    change(()=>db.active.events.push({event:reading?'started-with-live-hr':'started-without-hr-confirmed',timestamp:new Date(now()).toISOString(),...(reading?{bpm:reading.bpm}:{}),confirmation:reading?'live-monitor':'explicit-user-override'}));
    speechHooks.arm?.();cueCountdown();
   }
  };
  $('start').onclick=()=>{
   if(db.active||dirty||blocked)return;
   const reading=monitorReading();
   if(!reading){
    $('hrStartGate').classList.remove('hidden');
    $('hrGateDesc').textContent='The monitor is not connected or not sending a current BPM. Connect your MOOFIT and wait for a live reading. Continuing without it is an exception.';
    $('hrPreflight').textContent='Start blocked: no live BPM. Connect your monitor or explicitly continue without it.';
    return;
   }
   startWithHrDecision(reading);
  };
  $('hrGateProceed').onclick=()=>startWithHrDecision(monitorReading(),true);
  $('hrGateCancel').onclick=()=>{closeHrGate();$('hrPreflight').textContent='Workout not started. Connect HRM for a normal start.'};
  // Rebound with the actual Bluetooth click handler below so the chooser opens in the user's tap.
 $('newWorkout').onclick=()=>$('start').click();
 $('summaryExport').onclick=()=>{const w=db.practiceReceipt||db.history.at(-1);if(!db.active&&!dirty&&!blocked&&w)download(w,'the-pure-workout-results.json')};
 function cueCountdown(){
  const a=db.active;
  if(dirty||blocked||!a||a.paused||!a.countdownUntil)return;
  const seconds=Math.ceil((a.countdownUntil-now())/1000);
  if(seconds<1||seconds>3)return;
  const key=[a.id,a.countdownKind,a.records.length,seconds].join(':');
  if(key===lastCountdownCue)return;
  lastCountdownCue=key;
  if(!release)tone('tick');
 }

 $('record').onclick=()=>change(()=>{const done=Pure.reps(db.active,$('reps').value,now());if(done)Pure.archive(db,now())});
 const recordReps=$('record').onclick;$('record').onclick=()=>{const before=db.active?.records.length,side=!!db.active?.pendingSide;recordReps();if(db.active&&(db.active.records.length>before||!side&&db.active.pendingSide)){if(dirty||blocked){announce('Save failed. Workout paused. Keep this page open.');return}if(release)savedCue();if(db.active.pendingSide)announce('Right leg next.');cueCountdown()}};

 $('loghr').onclick=()=>{let archived=false;change(()=>{Pure.hr(db.active,$('hr').value,now());archived=finishRecoveryIfReady()});if(archived&&!dirty&&!blocked)announce('Cooldown complete. Workout saved.')};
 function finishRecoveryIfReady(){const a=db.active;if(a?.flowVersion>=2&&a.finalRecovery&&!a.paused&&!Pure.recoveryInfo(a,now()).override){Pure.recover(a,now());Pure.archive(db,now());return true}}
 $('recover').onclick=()=>{change(()=>{const a=db.active;if(!a||a.paused||a.finalRecovery)return;unlockAudio();if(Pure.recover(a,now()))Pure.archive(db,now())});cueCountdown()};
 $('overrideRecovery').onclick=()=>{const a=db.active;if(!a||a.paused||dirty||blocked)return;const reason=$('overrideReason').value;if(!reason){$('exceptionNotice').textContent='Choose why you are ending recovery early.';return}if(!confirm((a.finalRecovery?'End post-workout recovery and save?':'Start conditioning before the recorded recovery target?')+' This records an exception; it does not switch off the monitor.'))return;unlockAudio();change(()=>{if(Pure.recover(a,now(),{override:true,reason}))Pure.archive(db,now())});cueCountdown()};
 $('timedRecoveryStart').onclick=()=>{const a=db.active;if(!a||a.paused||a.phase!=='recovery'||a.finalRecovery||dirty||blocked)return;unlockAudio();change(()=>Pure.startTimedRecovery(a,now()))};
 for(const [id,delta] of [['timedMinus',-Pure.TIMED_STEP],['timedPlus',Pure.TIMED_STEP]])$(id).onclick=()=>{const a=db.active;if(!a?.timedRecovery||a.paused||dirty||blocked)return;change(()=>Pure.adjustTimedRecovery(a,now(),delta))};
 $('pause').onclick=()=>{if(!db.active||blocked||dirty||db.active.paused&&!db.active.countdownUntil)return;change(()=>{if(db.active.flowVersion!==3)delete db.active.countdownUntil;Pure.pause(db.active,now())});if(release&&!dirty&&!blocked)tone('pause')};$('resume').onclick=()=>{if(!db.active||!db.active.paused||blocked||dirty)return;unlockAudio();change(()=>Pure.resume(db.active,now()));speechHooks.continue?.();if(release&&!dirty&&!blocked)tone('resume');cueCountdown()};
 $('end').onclick=()=>{if(!blocked&&!dirty&&db.active&&confirm('End workout and start cooldown? Reps are kept, the workout timer stops, and heart-rate recording continues.'))end()};
 $('finishCooldown').onclick=()=>{if(!db.active?.finalRecovery||dirty||blocked)return;const info=Pure.recoveryInfo(db.active,now());if(info.override){finishAndSave();return}change(()=>{Pure.recover(db.active,now());Pure.archive(db,now())})};
 function finishAndSave(ask=true){if(!db.active||blocked||dirty)return;if(ask&&!confirm('Finish and save this session now? All recorded reps and HR are kept. Recovery may be incomplete.'))return;change(()=>{const a=db.active;Pure.endWorkout(a,now());a.events.push({event:'cooldown-ended-by-user',timestamp:new Date(now()).toISOString(),reason:'save-now'});if(a.paused)Pure.resume(a,now());Pure.recover(a,now(),{override:true,reason:'user-finished-cooldown'});Pure.archive(db,now())});if(!dirty)announce('Workout saved.')}
 $('saveNow').onclick=()=>finishAndSave();
 $('discard').onclick=()=>{if(!blocked&&!dirty&&db.active&&confirm('Discard this test? It will not enter workout history.'))change(()=>{db.active=null;message='Test discarded.'})};
 for(const [id,field] of [['reps','reps'],['hr','hr']])$(id).addEventListener('input',()=>{if(db.active&&!blocked&&!dirty){db.active.draft[field]=$(id).value;Pure.advance(db.active,now());persist();$('notice').textContent=message;$('retry').classList.toggle('hidden',!dirty)}});
 $('sessionNotes').addEventListener('input',()=>{if(db.active&&!blocked&&!dirty){db.active.userNotes=$('sessionNotes').value.slice(0,2000);persist();$('notice').textContent=message}});
 $('retry').onclick=()=>{persist();render()};
 $('export').onclick=()=>{if(db.active)download({...Pure.copy(db.active),schema:'the-pure-active-v2',exportedAt:new Date().toISOString(),unsaved:dirty||blocked},'the-pure-active-session.json');else if(db.history.length)download(db.history.at(-1),'the-pure-latest-workout.json');else{message='No workout to export.';render()}};
 $('exportLast').onclick=()=>{if(db.history.length)download(db.history.at(-1),'the-pure-latest-workout.json');else{message='No saved workout yet.';render()}};
 $('exportAll').onclick=()=>{download({schema:'the-pure-backup-v2',exportedAt:new Date().toISOString(),history:db.history,settings:db.settings||{},measurements:db.measurements||[],assessments:db.assessments||[],legacyHistory:db.legacyHistory||[],active:db.active,unsaved:dirty||blocked},'the-pure-local-history.json');$('backupNotice').textContent='Backup download requested. Check your device Downloads for the-pure-local-history.json. Your local records are unchanged.'};
 $('exportRaw').onclick=()=>{const raw={};for(const key of [Pure.KEY,Pure.LEGACY,Pure.LEGACY+'-active']){try{raw[key]=localStorage.getItem(key)}catch{raw[key]='Storage unavailable'}}download(raw,'the-pure-storage-recovery.json')};
 try{verifiedRaw=localStorage.getItem(Pure.KEY);db=Pure.load(localStorage,now());if(db.active){lastRecoveryCue=db.active.readyRecovery?.started||'';message='Interrupted workout recovered.';const notice=message;persist();if(!dirty)message=notice}}catch{db=Pure.fresh();blocked=true;message='Saved storage could not be read. Nothing was overwritten. Export storage recovery backup before repair.'}
 $('transitionSeconds').value=String(db.settings?.transitionSeconds||5);$('thresholdSetting').value=String(db.settings?.thresholdBpm||110);
 $('saveSettings').onclick=()=>{if(db.active){$('settingsNotice').textContent='Finish the current session before changing its timing settings.';return}const threshold=+$('thresholdSetting').value,seconds=+$('transitionSeconds').value;if(!Number.isInteger(threshold)||threshold<90||threshold>140||![3,5].includes(seconds)){$('settingsNotice').textContent='Choose 3 or 5 seconds and a threshold from 90 to 140 BPM.';return}change(()=>{db.settings={...db.settings,transitionSeconds:seconds,thresholdBpm:threshold}});$('settingsNotice').textContent=dirty?'Settings not saved.':'Settings saved for your next workout.'};
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&db.active&&!blocked&&!dirty){if(db.active.flowVersion!==3)delete db.active.countdownUntil;Pure.pause(db.active,now(),'page-hidden');persist();render()}});
 addEventListener('pagehide',()=>{if(db.active&&!blocked&&!dirty){if(db.active.flowVersion!==3)delete db.active.countdownUntil;Pure.pause(db.active,now(),'page-exit');persist()}});
 addEventListener('storage',e=>{if(e.key===Pure.KEY){blocked=true;message='Workout data changed in another tab. Export any unsaved work, then reload. This tab cannot overwrite it.';render()}});
 setInterval(()=>{if(db.active?.countdownUntil&&!dirty&&!blocked){const began=Pure.tickCountdown(db.active,now());persist();render();if(began&&!dirty&&!blocked){tone('go');speechHooks.resume?.()}else cueCountdown()}if(db.active&&!db.active.paused&&!dirty&&!blocked){Pure.advance(db.active,now());persist();$('notice').textContent=message;$('retry').classList.toggle('hidden',!dirty);if(dirty)render();else render()}},100);


 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const displayDate=v=>Number.isFinite(Date.parse(v))?new Date(v).toLocaleString():'Unknown date';
 function historyResults(w){const moves=w.exercisePlan||Pure.EX.map(category=>({category,name:category}));return moves.map(m=>{const rows=w.records.filter(r=>r.exercise===m.category);return '<p><span class="record-label">'+esc(m.name)+'</span>'+(rows.length?rows.map(r=>'<span class="record-value">'+(r.sideReps?'L '+r.sideReps.left+' / R '+r.sideReps.right:r.reps+' reps')+'</span><span class="record-label">'+esc(r.round)+(r.variation?' · '+esc(r.variation):'')+(Number.isInteger(r.floor)?' · floor '+r.floor+(r.metFloor?' met':' missed'):'')+'</span>').join(''):'<span class="record-value">— unrecorded</span>')+'</p>'}).join('')}
 function renderJournal(){
  const complete=db.history.filter(w=>w.status==='complete'),a=db.active,latest=db.history.at(-1),weights=db.measurements||[],tests=db.assessments||[];
  $('completeCount').textContent=String(complete.length);$('calibrationCount').textContent=Math.min(3,complete.length)+' / 3';$('calibrationNote').textContent=complete.length>=3?'Data collected · floor decision pending':'Data collection, not a computed floor';$('orbitCount').textContent=(a?.records.length||0)+' / 6';
  if($('sessionOrbit').style)$('sessionOrbit').style.setProperty('--pct',((a?.records.length||0)/6*100)+'%');
  $('overviewAction').textContent=a?'Resume your session':'Open workout';
  const latestWeight=weights.slice().sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp))[0];$('latestWeight').textContent=latestWeight?latestWeight.weight+' '+latestWeight.unit:'—';$('latestWeightDate').textContent=latestWeight?displayDate(latestWeight.timestamp):'No measurement recorded';
  $('latestSession').textContent=latest?displayDate(latest.started)+' · '+latest.status+' · '+latest.records.length+' exercises':'Your first session starts here.';
  $('historyCards').innerHTML=db.history.slice().reverse().map(w=>'<article class="panel form-panel"><div class="result-head"><h2>'+esc(displayDate(w.started))+'</h2><span class="badge">'+esc(w.status)+'</span></div><p class="lead">'+esc(w.durationSeconds??'—')+' seconds active · '+w.records.length+' exercises</p><div class="history-result">'+historyResults(w)+'</div><p class="lead">'+esc(w.userNotes||'')+'</p><details><summary>Reps, HR, recovery and timing details</summary><pre>'+esc(JSON.stringify(w,null,2))+'</pre></details></article>').join('')||'<div class="panel empty"><strong>Your history starts with one session.</strong><p>No demo records have been added.</p></div>';
  $('legacyCards').innerHTML=(db.legacyHistory||[]).length?'<h2 class="spaced">Imported original Pure records</h2>'+(db.legacyHistory||[]).map(r=>'<article class="panel spaced"><h3>'+esc(displayDate(PureJournal.legacyDate(r)))+'</h3><p class="lead">'+(r.source==='the-pure-phone-v2'?'Phone V2 '+(r.unfinishedAtExport?'session unfinished at export':'workout')+' preserved; ':'Original workout preserved; ')+'excluded from HIT calibration.</p><details><summary>Original record</summary><pre>'+esc(JSON.stringify(r.originalWorkout,null,2))+'</pre></details></article>').join(''):'';
  $('measurementList').innerHTML=weights.slice().sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp)).map(w=>'<div class="journal-item"><strong>'+esc(w.weight)+' '+esc(w.unit)+(w.bodyFatPercent!==null?' · '+esc(w.bodyFatPercent)+'% estimated body fat':'')+'</strong><p>'+esc(displayDate(w.timestamp))+' · '+esc(w.device)+'</p></div>').join('');
  $('assessmentList').innerHTML=tests.slice().sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp)).map(t=>{const baseline=tests.filter(b=>b.kind===t.kind&&b.stage==='baseline'&&(t.kind==='one-mile-run'||b.exercise.toLowerCase()===t.exercise.toLowerCase()&&b.unit===t.unit)&&Date.parse(b.timestamp)<=Date.parse(t.timestamp)).sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp))[0];let delta='';if(t.stage==='follow-up'&&baseline){const diff=t.kind==='one-mile-run'?t.timeSeconds-baseline.timeSeconds:t.load-baseline.load;delta='<p class="test-comparison">Change from baseline: '+(diff>0?'+':'')+diff+' '+(t.kind==='one-mile-run'?'seconds':esc(t.unit))+' · '+Math.round((Date.parse(t.timestamp)-Date.parse(baseline.timestamp))/86400000)+' days later</p>';}return '<div class="journal-item"><strong>'+esc(t.kind==='one-mile-run'?'1-mile run · '+Math.floor(t.timeSeconds/60)+':'+String(t.timeSeconds%60).padStart(2,'0'):t.exercise+' · '+t.load+' '+t.unit+' × 1 rep')+'</strong><p>'+esc(t.stage)+' · '+esc(displayDate(t.timestamp))+'</p><p>'+esc(t.notes)+'</p>'+delta+'</div>'}).join('');
 }
 if(typeof PureJournal!=='undefined'){
  for(const id of ['weightDate','testDate']){const d=new Date();$(id).value=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
  $('weightDevice').value=PureJournal.WHITE;
  $('saveWeight').onclick=()=>{if(blocked||dirty){$('weightMessage').textContent='Resolve the local save warning before adding measurements.';return}try{const row=PureJournal.weight({value:$('weightValue').value,unit:$('weightUnit').value,fat:$('weightFat').value,date:$('weightDate').value,device:$('weightDevice').value},uid());db.measurements??=[];db.measurements.push(row);persist();render();$('weightMessage').textContent=dirty?'Measurement is NOT SAVED. Retry save or export your backup.':'Body measurement saved on this device.'}catch(e){$('weightMessage').textContent=e.message}};
  $('saveTest').onclick=()=>{if(blocked||dirty){$('testMessage').textContent='Resolve the local save warning before adding tests.';return}try{const row=PureJournal.assessment({kind:$('testKind').value,exercise:$('testExercise').value,value:$('testValue').value,unit:$('testUnit').value,date:$('testDate').value,stage:$('testStage').value,notes:$('testNotes').value},uid());db.assessments??=[];db.assessments.push(row);persist();render();$('testMessage').textContent=dirty?'Test is NOT SAVED. Retry save or export your backup.':'Performance test saved on this device.'}catch(e){$('testMessage').textContent=e.message}};
  let imported=null;
  $('importFile').addEventListener('change',async()=>{try{const file=$('importFile').files?.[0];if(!file)return;if(file.size>5000000)throw Error('Backup exceeds the 5 MB import limit.');imported=PureJournal.parseBackup(await file.text());$('restoreImport').disabled=!imported.active||!!db.active;
  $('importCounts').textContent=imported.history.length+' HIT workouts · '+imported.measurements.length+' body measurements · '+imported.assessments.length+' performance tests · '+imported.legacyHistory.length+' original or phone V2 Pure workouts. '+(imported.active?'An active session is present. History merge leaves it untouched; use the separate restore button only when no current session is active.':'');$('importReview').classList.remove('hidden');$('importMessage').textContent='Review the counts, then confirm. Nothing has been changed.'}catch(e){imported=null;$('importReview').classList.add('hidden');$('importMessage').textContent=e.message}});
  $('cancelImport').onclick=()=>{imported=null;$('importReview').classList.add('hidden');$('importMessage').textContent='Import cancelled. Nothing changed.'};
  $('restoreImport').onclick=()=>{if(!imported?.active||blocked||dirty)return;try{db=Pure.restoreActive(db,imported.active,now());persist();render();$('importMessage').textContent=dirty?'Restored session is NOT SAVED. Retry or export.':'Unfinished session restored paused. Open Workout to review and resume.'}catch(e){$('importMessage').textContent=e.message}};
  $('mergeImport').onclick=()=>{if(!imported)return;if(blocked||dirty){$('importMessage').textContent='Resolve the local save warning first.';return}try{db=PureJournal.merge(db,imported);persist();render();if(!dirty){imported=null;$('importReview').classList.add('hidden')}$('importMessage').textContent=dirty?'Import is NOT SAVED. Retry save or export your backup.':'History merged. Existing records and active session retained.'}catch(e){$('importMessage').textContent=e.message}};
 }

 // Device adapters use the same guarded model mutations and atomic save path.
 if(typeof PureDevices!=='undefined'){
  let handsFree=false,micOptOut=false,proposal=null,lastMonitorLog=0,connecting=false,monitorSignalSeen=false,monitorLossAnnounced=false;
  const context=()=>JSON.stringify([db.active?.id,db.active?.records.length,db.active?.phase,db.active?.paused,!!db.active?.countdownKind]);
  const sayStatus=s=>{voiceActive=voice.listening;voiceWanted=voice.wanted;$('stopTalk').classList.toggle('hidden',!voice.wanted);$('voiceStatus').classList.toggle('muted-voice',s.startsWith('Listening —'));$('voiceStatus').textContent=s;$('talk').textContent=voice.listening?'Listening':voice.wanted?'Connecting voice…':'Enable voice'};
  const voiceCallbacks={onState:sayStatus,onError:sayStatus,onText:text=>{
   const parsed=PureDevices.command(text);if(parsed?.type==='confirm'){$('voiceApply').click();return}if(parsed?.type==='cancel'){$('voiceCancel').click();return}if(!parsed){sayStatus('Heard: “'+text+'”. Command not recognized; nothing changed.');return}
   if(parsed.type==='reps'){const a=db.active;if(!a||a.paused||a.countdownKind||!entryPhase(a)||dirty||blocked){sayStatus('Not accepting reps during transition or recovery.');return}$('reps').value=String(parsed.value);a.draft.reps=String(parsed.value);$('record').click();return}
   if(parsed.type==='correct'){const a=db.active,r=a?.records.at(-1);if(!r||dirty||blocked||a.paused){sayStatus('No recent reps to correct.');return}if(r.sideReps){sayStatus('Use the left or right field to correct split squat reps.');return}correctRecord(a.records.length-1,parsed.value);return}
   proposal={...parsed,context:context()};$('heard').textContent=(parsed.type==='reps'?parsed.value+' reps for '+(db.active?Pure.EX[db.active.ex]:'this exercise')+'?':'Confirm '+parsed.type+'?')+(parsed.type==='recover'&&db.active?.phase==='recovery'&&Pure.recoveryInfo(db.active,now()).override?' Wait for the recovery target; exceptions are available under Monitor problem.':'')+' Say “confirm” or “cancel”.';$('voiceProposal').classList.remove('hidden');
  }};
  let voice=release&&typeof PureLocalVoiceEngine!=='undefined'?new PureLocalVoiceEngine.Voice(voiceCallbacks):release?{start(){sayStatus('Local voice unavailable. Enter reps on screen.')},stop(){},preload:async()=>{}}:new PureDevices.Voice({...voiceCallbacks,recognition:globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition});
  const localVoiceButton=$('localVoice');
  if(release){localVoiceSelected=true;voice.preload().catch(()=>{});$('voicePrivacy').textContent='Local voice processes audio on this device.';}
  if(!release&&typeof PureLocalVoice!=='undefined'){
   localVoiceButton.classList.remove('hidden');
   localVoiceButton.onclick=async()=>{
    if(db.active)return;
    if(!localVoiceSelected){
     voice.stop();
     voice=new PureLocalVoice(voiceCallbacks);
     localVoiceSelected=true;
     $('voicePrivacy').textContent='Local voice processes audio on this device.';
    }
    localVoiceButton.disabled=true;
    $('localVoiceSetup').textContent='Loading English model (about 40 MB). Microphone off.';
    try{
     await voice.prepare();
     $('localVoiceSetup').textContent='Local voice ready. Start your workout with music playing.';
     localVoiceButton.textContent='Local voice ready';
    }catch(error){
     $('localVoiceSetup').textContent=error.message+' Retry or enter reps on screen.';
     localVoiceButton.disabled=false;
    }
   };
  }
  const tryVoice=(gesture=false)=>{if(handsFree&&!document.hidden&&(repEntryOpen()||release&&!!db.active&&!db.active.paused)&&!dirty&&!blocked){try{voice.start({gesture})}catch(e){sayStatus(e.message)}}};
  speechHooks={arm:()=>{handsFree=!micOptOut;if(release)tryVoice(true)},stop:()=>{if(voice.running||voice.wanted||proposal)stopVoice(false)},resume:()=>tryVoice(),continue:()=>{handsFree=!micOptOut;tryVoice()}};
  $('talk').onclick=()=>{if(release)unlockAudio();micOptOut=false;handsFree=true;tryVoice(true)};
  $('stopTalk').onclick=()=>{micOptOut=true;handsFree=false;voice.stop()};
  $('voiceCancel').onclick=()=>{proposal=null;$('voiceProposal').classList.add('hidden');sayStatus('Command cancelled. Nothing changed.')};
  $('voiceApply').onclick=()=>{
   const p=proposal;proposal=null;$('voiceProposal').classList.add('hidden');if(!p)return;if(p.context!==context()){sayStatus('Workout changed since that command. Please say it again. Nothing changed.');return}
   const id={start:'start',pause:'pause',resume:'resume',recover:'recover',end:'end',save:'saveNow',discard:'discard',reps:'record'}[p.type];
   const a=db.active;const allowed=!blocked&&!dirty&&(p.type==='start'?!a:!!a)&&(p.type!=='reps'||(!a.paused&&!a.countdownKind&&entryPhase(a)))&&(p.type!=='recover'||(!a.paused&&a.phase==='recovery'));
   if(!allowed||$(id).disabled){sayStatus('That command cannot be applied in the current workout state. Nothing changed.');return}
   if(p.type==='reps'){$('reps').value=String(p.value);db.active.draft.reps=String(p.value)}
   if(p.type==='end')end();else if(p.type==='save')finishAndSave(false);else if(p.type==='discard')change(()=>{db.active=null});else if(p.type==='recover')$('recover').click();else $(id).click();if(repEntryOpen())sayStatus('Command processed. Check the workout status above.');
  };
  // A live reading is a Bluetooth notification, not a saved/manual sample.
  // BPM can stay unchanged: time-since-update resets on each real packet.
  const refreshHrSignal=()=>{
   const reading=monitorReading(),last=monitor.latest;
   const age=last?Math.max(0,Math.floor((now()-last.timestamp)/1000)):null;
   const signal=reading?'live':last?'stale':'offline';
   $('hrLiveCard').setAttribute?.('data-signal',signal);
   $('hrLiveValue').textContent=reading?String(reading.bpm):'—';
   $('hrSignalAge').textContent=reading?(age===0?'New reading received just now':'Last update '+age+'s ago'):
     last?'SIGNAL STALE · last update '+age+'s ago':'Waiting for live heart-rate data';
   $('liveBpm').textContent=reading?reading.bpm+' BPM':'— BPM';
   $('liveBpm').setAttribute?.('aria-label',reading?'Current Bluetooth heart rate '+reading.bpm+' BPM':'No current Bluetooth heart-rate reading');
  };
  const flashHrSample=()=>{
   const icon=$('hrPulseIcon');
   icon.classList.remove('hr-reading-pulse');
   // Restart animation only on receipt of an actual Bluetooth sample.
   void icon.offsetWidth;
   icon.classList.add('hr-reading-pulse');
  };
  const setMonitorCompact=live=>{$('monitorDetails').classList.toggle('hr-live',live);if(!live)$('monitorDetails').open=true;else if(!$('monitorDetails').classList.contains?.('hr-live-seen')){$('monitorDetails').open=false;$('monitorDetails').classList.add('hr-live-seen')}};
  const monitor=new PureDevices.Monitor({bluetooth:globalThis.navigator?.bluetooth,onState:s=>{Pure.observeRecovery(db.active,null,now());setMonitorCompact(false);$('monitorDetails').classList.remove('hr-live-seen');$('monitorStatus').textContent=s;refreshHrSignal();$('hrPreflight').textContent='Not ready · '+s;if(!$('hrStartGate').classList.contains?.('hidden'))$('hrGateDesc').textContent=s+' Waiting for a live BPM before starting.'},onReading:r=>{
   if(!dirty&&!blocked&&!document.hidden)Pure.observeRecovery(db.active,r.bpm,r.timestamp);
   setMonitorCompact(true);refreshHrSignal();flashHrSample();$('monitorStatus').textContent='Live reading · '+new Date(r.timestamp).toLocaleTimeString();$('hrPreflight').textContent='READY · Live heart rate '+r.bpm+' BPM. Start Workout is ready.';closeHrGate();$('hrGateDesc').textContent='The monitor is not connected or not sending a current BPM. Connect your MOOFIT before starting.';monitorSignalSeen=true;if(monitorLossAnnounced){monitorLossAnnounced=false;if(db.active&&!dirty&&!blocked){change(()=>db.active.events.push({event:'hr-signal-restored',timestamp:new Date(r.timestamp).toISOString()}));announce('Heart-rate signal restored.')}}
   if(db.active&&!dirty&&!blocked&&r.timestamp-lastMonitorLog>=1000){
    lastMonitorLog=r.timestamp;let archived=false;change(()=>{Pure.sampleHr(db.active,String(r.bpm),r.timestamp);archived=finishRecoveryIfReady()});if(archived&&!dirty&&!blocked)announce('Cooldown complete. Workout saved.')
   }
  }});
  monitorReading=()=>monitor.device?.gatt?.connected?monitor.fresh():null;
  const connectMonitor=async(broadScan=false,previouslyAllowed=false)=>{
    if(connecting)return;
    connecting=true;
    $('monitorDetails').open=true;
    $('connectHr').disabled=true;
    $('hrGateConnect').disabled=true;$('hrGateWideScan').disabled=true;$('wideScan').disabled=true;$('retryAllowedHr').disabled=true;$('hrGateRetryAllowed').disabled=true;
    $('connectHr').textContent='Connecting…';
    $('hrGateConnect').textContent='Connecting…';
    $('disconnectHr').disabled=true;
    try{
     $('monitorStatus').textContent=previouslyAllowed?'Looking for a monitor already authorized for this site…':broadScan?'Choose MOOFIT, then tap Pair/Connect in the Bluetooth list.':'Choose MOOFIT, then tap Pair/Connect in Chrome.';
     $('hrGateDesc').textContent=previouslyAllowed?'Trying a monitor already permitted in this browser. Wait for a live BPM.':'Choose MOOFIT, tap Pair/Connect, and wait for live BPM. If Chrome does not return to the page, an error will appear after a timeout.';
     await monitor.connect({broadScan,previouslyAllowed});
    }catch(e){
     const message='Could not connect: '+e.message+'. Retry or explicitly continue without HRM.';
     $('monitorStatus').textContent=message;
     $('hrPreflight').textContent='HRM NOT READY · '+e.message;
     $('hrGateDesc').textContent=message;
    }finally{
     connecting=false;
     $('connectHr').disabled=false;
     $('hrGateConnect').disabled=false;$('hrGateWideScan').disabled=false;$('wideScan').disabled=false;$('retryAllowedHr').disabled=false;$('hrGateRetryAllowed').disabled=false;
     $('connectHr').textContent=monitor.device?.gatt?.connected?'Reconnect HR monitor':'Connect HR monitor';
     $('hrGateConnect').textContent='Connect HRM';
     $('disconnectHr').disabled=false;
    }
   };
   $('connectHr').onclick=()=>connectMonitor(false);$('wideScan').onclick=()=>connectMonitor(true);$('hrGateWideScan').onclick=()=>connectMonitor(true);$('retryAllowedHr').onclick=()=>connectMonitor(false,true);$('hrGateRetryAllowed').onclick=()=>connectMonitor(false,true);
   // Both buttons invoke this handler *directly* on a trusted user tap.
   // Do not close the warning until an actual Bluetooth BPM packet arrives.
   $('hrGateConnect').onclick=()=>connectMonitor(false);
  $('disconnectHr').onclick=()=>{monitor.disconnect();Pure.observeRecovery(db.active,null,now());setMonitorCompact(false);$('monitorDetails').classList.remove('hr-live-seen');$('monitorStatus').textContent='Monitor disconnected. Manual HR remains available.';refreshHrSignal();$('hrPreflight').textContent='HRM not connected. Reconnect before starting.'};
  setInterval(()=>{if(db.active&&monitorSignalSeen&&!monitor.fresh()&&!monitorLossAnnounced&&!dirty&&!blocked){monitorLossAnnounced=true;setMonitorCompact(false);$('monitorDetails').classList.remove('hr-live-seen');change(()=>db.active.events.push({event:'hr-signal-unavailable',timestamp:new Date(now()).toISOString(),reason:'no-fresh-monitor-reading'}));$('monitorStatus').textContent='HR signal lost — reconnect monitor. Workout recording continues.';announce('Heart-rate signal lost. Reconnect your monitor. Workout recording continues.')}
   if(!db.active&&!connecting){const current=monitorReading();
    if(!current&&monitor.latest&&$('monitorDetails').classList.contains('hr-live')){
     setMonitorCompact(false);$('monitorDetails').classList.remove('hr-live-seen');
    }
    $('hrPreflight').textContent=current?'READY · Live heart rate '+current.bpm+' BPM. Start Workout is ready.':monitor.latest?'SIGNAL STALE · No recent BPM. Reconnect the HR monitor before starting.':monitor.device?.gatt?.connected?'Monitor selected, but no current BPM. Wait for a reading or reconnect.':'Connect HRM and wait for a live BPM reading before starting.';}refreshHrSignal()},1000);
  refreshHrSignal();
  const stopVoice=(forget=true)=>{if(forget)handsFree=false;voice.stop();proposal=null;$('voiceProposal').classList.add('hidden')};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopVoice(false);else speechHooks.resume?.()});
  addEventListener('hashchange',()=>{if(globalThis.location?.hash!=='#workout'){stopVoice();if(db.active&&!db.active.paused&&!dirty&&!blocked)change(()=>Pure.pause(db.active,now(),'dashboard-opened'))}});
 }

 const defaultPlan=[{category:'Push',name:'Push-ups',variant:'Standard',unilateral:false},{category:'Squat',name:'Squats',variant:'Bodyweight',unilateral:false},{category:'Pull',name:'Inverted rows',variant:'',unilateral:false}];
 function splitSquatPlan(moves){return moves.map(move=>move.category==='Squat'?{...move,name:'Split squat',variant:'Bodyweight',unilateral:true}:move)}
 const reviewPlan=release?defaultPlan.map(m=>m.category==='Squat'?{...m,name:'Jump Squats',variant:'Bodyweight'}:m):document.body.dataset?.defaultSquat==='split'?splitSquatPlan(defaultPlan):defaultPlan;
 function plan(){return db.active?(db.active.exercisePlan||defaultPlan):db.settings?.exercisePlan||reviewPlan}
 function correctRecord(index,value,side){if(!/^\d+$/.test(String(value))||+value>10000)return;change(()=>{const a=db.active,r=a.records[index],old=Pure.copy(r);if(side){r.sideReps[side]=+value;r.reps=Math.min(r.sideReps.left,r.sideReps.right)}else r.reps=+value;a.events.push({event:'rep-correction',timestamp:new Date(now()).toISOString(),recordIndex:index,before:old,after:Pure.copy(r)})});announce(String(value)+' corrected.')}
 function renderStationRows(){const a=db.active,moves=plan();$('stationRows').classList.toggle('hidden',false);$('workoutPlan').classList.toggle('hidden',!!a);$('practiceOption').classList.toggle('hidden',!!a);for(let i=0;i<3;i++){const m=moves[i],r=a?.records.find(x=>x.round===(a.round===0?'maximum':'conditioning')&&x.exercise===m.category),current=!!a&&a.ex===i&&entryPhase(a),ready=current&&!a.paused&&!a.countdownKind,unilateral=!!m.unilateral,floor=a?.round===1?a.floors?.find(x=>x.exercise===m.category):null;
 $('station'+i).classList.toggle('current',current);$('station'+i).classList.toggle('completed',!!r);$('stationName'+i).textContent=m.name;$('stationPrevious'+i).textContent=Pure.workoutReference(db.history,m,a?(a.round===0?'maximum':'conditioning'):null)+(floor?' · Max '+floor.maximumReps+' · Floor '+floor.floor+(r&&Number.isInteger(r.floor)?(r.metFloor?' · floor met':' · floor missed'):''):'');$('stationVariant'+i).textContent=(a?.round===1?'Conditioning ': 'Max ')+m.category+(m.variant?' · '+m.variant:'');$('stationState'+i).textContent=r?'Saved':current?(a.paused?'Paused':a.countdownKind?'Get ready · '+Math.max(1,Math.ceil((a.countdownUntil-now())/1000))+'s':unilateral?(a.pendingSide?'Right leg':'Left leg'):'Your turn'):!a?'Not started':'Up next';
 for(const side of ['main','left','right']){const id='stationValue'+i+side,el=$(id),show=unilateral?side!=='main':side==='main';$('stationField'+i+side).classList.toggle('hidden',!show);const val=r?(side==='main'?r.reps??'':r.sideReps?.[side]??''):current?(side==='main'?a.draft.reps:side==='left'?(a.pendingSide?.reps??a.draft.reps):a.pendingSide?a.draft.reps:''):'';if(el.value!==String(val))el.value=String(val);el.disabled=blocked||dirty||!a||a.paused||(!r&&(!ready||unilateral&&side==='right'&&!a.pendingSide));for(const d of ['Minus','Plus'])$('station'+d+i+side).disabled=el.disabled;}
 }
 $('record').classList.toggle('hidden',!a||a.draft.reps==='');$('record').textContent=a&&Pure.current(a).unilateral?'Save '+(a.pendingSide?'right':'left')+' reps':'Save reps';$('record').disabled=blocked||dirty||!a||a.paused||!entryPhase(a)||!!a.countdownKind;$('focusTitle').textContent=!a?(db.history.length?'Session saved':'THE PURE'):a.paused?'Paused':a.phase==='recovery'?(a.finalRecovery?'Workout complete':'Round complete'):a.countdownKind?'Get ready: '+Pure.current(a).name:'Keep nothing back.';
 $('recoverySignal').textContent=a?.phase==='recovery'?(Pure.recoveryInfo(a,now()).override?(Pure.recoveryInfo(a,now()).stale?'No current HR · ':'Recovering · ')+(a.thresholdBpm||110)+' BPM target':'READY · Next: '+(a.exercisePlan?.[0]?.name||'Push-ups')):'';$('recovery').classList.toggle('reached',!!a&&a.phase==='recovery'&&!Pure.recoveryInfo(a,now()).override);
 }
 for(let i=0;i<3;i++)for(const side of ['main','left','right']){const field=$('stationValue'+i+side);const update=v=>{const a=db.active;if(!a||field.disabled)return;const r=a.records.findIndex(x=>x.round===(a.round===0?'maximum':'conditioning')&&x.exercise===plan()[i].category);if(r>=0)correctRecord(r,v,side==='main'?null:side);else if(side==='left'&&a.pendingSide){if(/^\d+$/.test(String(v))&&+v<=10000)change(()=>{a.events.push({event:'left-rep-correction',before:a.pendingSide.reps,after:+v,timestamp:new Date(now()).toISOString()});a.pendingSide.reps=+v})}else{field.value=String(v);$('reps').value=String(v);a.draft.reps=String(v);persist()}};field.addEventListener('input',()=>update(field.value));$('stationMinus'+i+side).onclick=()=>update(Math.max(0,(+field.value||0)-1));$('stationPlus'+i+side).onclick=()=>update((+field.value||0)+1);}
 function showPlan(){const moves=plan();$('chooseSplit').classList.toggle('hidden',moves.some(m=>m.category==='Squat'&&m.name==='Split squat'&&m.unilateral));for(let i=0;i<3;i++){ $('planName'+i).value=moves[i].name;$('planVariant'+i).value=moves[i].variant;$('planSide'+i).value=String(moves[i].unilateral);$('planCategory'+i).textContent=moves[i].category;$('planUp'+i).disabled=i===0;$('planDown'+i).disabled=i===2;}}
 function savePlan(){if(db.active)return;const moves=plan().map((m,i)=>({...m,name:$('planName'+i).value.trim(),variant:$('planVariant'+i).value.trim(),unilateral:$('planSide'+i).value==='true'}));if(!Pure.validPlan(moves)){$('planNotice').textContent='Enter an exercise name for each category.';return false}change(()=>{db.settings={...db.settings,exercisePlan:moves}});$('planNotice').textContent=dirty?'Plan not saved.':'Exercise plan saved.';showPlan()}
 $('savePlan').onclick=savePlan;
 $('chooseSplit').onclick=()=>{if(db.active||dirty||blocked)return;change(()=>{db.settings={...db.settings,exercisePlan:splitSquatPlan(plan())}});showPlan()};
 for(let i=0;i<3;i++)for(const [dir,step] of [['Up',-1],['Down',1]])$('plan'+dir+i).onclick=()=>{if(db.active)return;if(savePlan()===false)return;const moves=Pure.copy(plan()),j=i+step;if(j<0||j>2)return;[moves[i],moves[j]]=[moves[j],moves[i]];change(()=>{db.settings={...db.settings,exercisePlan:moves}});showPlan()};
 showPlan();

 render();
}
