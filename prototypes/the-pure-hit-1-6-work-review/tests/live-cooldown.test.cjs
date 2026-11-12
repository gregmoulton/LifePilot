const test=require('node:test');
const assert=require('node:assert/strict');
const P=require('../dist/app.js');
const t=Date.UTC(2026,10,9);
function workout(practice=false){
 const db=P.fresh();
 db.active=P.startHandsFree(t,'cooldown');
 Object.assign(db.active,{stableRecovery:true,liveCooldown:true,practice});
 P.endWorkout(db.active,t);
 return db;
}
test('a saved partial workout survives reload, keeps recording, and finalizes one history record',()=>{
 let db=workout();
 P.sampleHr(db.active,'120',t+1000);
 P.archive(db,t+1000,{keepMonitoring:true});
 P.sampleHr(db.active,'110',t+2000);
 assert.equal(db.history[0].heartRateReadings.length,1);
 db=P.load({getItem:()=>JSON.stringify(db)},t+9000);
 assert.equal(db.active.paused,true);
 assert.equal(db.history[0].cooldownPending,true);
 P.resume(db.active,t+9000);
 for(let i=0;i<=5;i++){
  P.observeRecovery(db.active,i===0?110:112,t+9000+i*1000);
  P.sampleHr(db.active,String(i===0?110:112),t+9000+i*1000);
 }
 assert.equal(P.recoveryInfo(db.active,t+14000).override,false);
 P.recover(db.active,t+14000);
 P.archive(db,t+14000);
 assert.equal(db.active,null);
 assert.equal(db.history.length,1);
 assert.equal(db.history[0].status,'partial');
 assert.equal(db.history[0].cooldownPending,undefined);
 assert.equal(db.history[0].heartRateReadings.length,8);
 assert.equal(db.history[0].recoveries[0].kind,'post-workout');
});
test('manual HR and gaps cannot qualify practice cooldown; saving stays out of history',()=>{
 const db=workout(true),a=db.active;
 P.archive(db,t,{keepMonitoring:true});
 P.hr(a,'102',t+1000);
 assert.equal(P.recoveryInfo(a,t+1000).override,true);
 P.observeRecovery(a,110,t+2000);
 P.observeRecovery(a,112,t+7000);
 assert.equal(P.recoveryInfo(a,t+7000).override,true);
 P.recover(a,t+7000,{override:true,reason:'user-finished-cooldown'});
 P.archive(db,t+7000);
 assert.deepEqual(db.history,[]);
 assert.equal(db.practiceReceipt.recoveries[0].manualOverride,true);
});
test('no-monitor recovery enables manual conditioning at 120 seconds, never sooner',()=>{
 const db=P.fresh(),a=P.startHandsFree(t,'timed');
 Object.assign(a,{phase:'recovery',recoveryStarted:new Date(t).toISOString(),stableRecovery:true,liveCooldown:true});
 db.active=a;
 assert.equal(P.recoveryInfo(a,t+119999).override,true);
 assert.equal(P.recoveryInfo(a,t+120000).override,false);
 assert.equal(a.round,0);
 P.recover(a,t+120000);
 assert.equal(a.round,1);
 assert.equal(a.recoveries[0].qualification,'120-second-no-hrm-fallback');
 assert.equal(a.recoveries[0].lastRecordedBpm,null);
});
test('one-tap save commits partial results and finalizes the same record after five minutes',()=>{
 const db=P.fresh();
 db.active=P.startHandsFree(t,'five-minute');
 Object.assign(db.active,{stableRecovery:true,liveCooldown:true});
 P.sampleHr(db.active,'143',t);
 P.saveAndMonitor(db,t+1000);
 assert.equal(db.history[0].status,'partial');
 assert.equal(db.history[0].cooldownPending,true);
 for(let second=1;second<=300;second++){
  if(second===120||second===119||second===118)continue;
  P.sampleHr(db.active,'110',t+1000+second*1000);
 }
 P.archive(db,t+301000,{keepMonitoring:true});
 assert.equal(db.history.length,1);
 assert.equal(P.finishMonitoredCooldown(db,t+300999),false);
 assert.equal(P.finishMonitoredCooldown(db,t+301000),true);
 assert.equal(db.active,null);
 assert.equal(db.history.length,1);
 assert.equal(db.history[0].cooldownPending,undefined);
 assert.equal(db.history[0].recoveries[0].declines[1].drop,33);
 assert.equal(db.history[0].recoveries[0].declines[2],undefined);
 assert.equal(db.history[0].recoveries[0].declines[5].bpm,110);
});
test('an interrupted cooldown retains the saved workout without fabricating readings',()=>{
 const db=workout();
 P.saveAndMonitor(db,t);
 P.pause(db.active,t+1000);
 assert.equal(P.finishMonitoredCooldown(db,t+300000),true);
 assert.equal(db.history.length,1);
 assert.equal(db.history[0].recoveries[0].incomplete,true);
 assert.deepEqual(db.history[0].recoveries[0].declines,{});
 assert.ok(db.history[0].incompleteRecovery);
});
test('reopen after one-tap save resumes only passive cooldown, retaining the original end timestamp',()=>{
 let db=P.fresh();
 db.active=P.startHandsFree(t,'reopened');
 Object.assign(db.active,{stableRecovery:true,liveCooldown:true});
 P.saveAndMonitor(db,t+1000);
 const workoutEnd=db.history[0].ended;
 db=P.load({getItem:()=>JSON.stringify(db)},t+20000);
 assert.equal(db.active.paused,false);
 assert.equal(db.active.phase,'recovery');
 P.sampleHr(db.active,'115',t+21000);
 P.archive(db,t+21000,{keepMonitoring:true});
 assert.equal(db.history.length,1);
 assert.equal(db.history[0].ended,workoutEnd);
 assert.equal(db.history[0].heartRateReadings.length,1);
 P.finishMonitoredCooldown(db,t+301000);
 assert.equal(db.history[0].ended,workoutEnd);
 assert.equal(db.history[0].recoveries[0].incomplete,true);
});
