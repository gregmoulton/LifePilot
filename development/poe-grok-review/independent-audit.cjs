const {test}=require('node:test');
const assert=require('node:assert/strict');
const {optimize}=require('./poe-optimizer.js');
const now='2026-10-30';
const g=[{id:'G',status:'active',ownerTargetDate:'2026-12-01',currentForecast:'2026-12-01'}];
const r=[{id:'R',goalId:'G',description:'Fictional requirement',status:'open'}];
const run=(decisions=[],goals=g,reqs=r)=>optimize(goals,reqs,[],decisions,now);
test('rejection remains suppressed without material new evidence after 14 days',()=>{
 assert.equal(run([{recommendationId:'rec-G-R',action:'reject',timestamp:'2026-10-01'}]).recommendations.length,0);
});
test('deferred proposal stays hidden until defer window expires',()=>{
 assert.equal(run([{recommendationId:'rec-G-R',action:'defer',timestamp:now,deferUntil:'2026-11-05'}]).recommendations.length,0);
});
test('HOLD requirement is not recommended as executable next work',()=>{
 assert.equal(run([],g,[{...r[0],status:'hold'}]).recommendations.filter(x=>x.type==='next').length,0);
});
test('equal ranks use recommendation ID independent of requirement array order',()=>{
 const a=[{...r[0],id:'B'},{...r[0],id:'A'}];
 assert.deepEqual(run([],g,a).recommendations.map(x=>x.id),run([],g,[...a].reverse()).recommendations.map(x=>x.id));
});
test('approval for nonexistent recommendation cannot revise forecast',()=>{
 assert.equal(run([{goalId:'G',recommendationId:'not-real',action:'approve',timestamp:now}]).forecasts[0].newForecast,'2026-12-01');
});
test('duplicate approval does not double-apply forecast revision',()=>{
 const d={goalId:'G',recommendationId:'rec-G-R',action:'approve',timestamp:now};
 assert.deepEqual(run([d]).forecasts,run([d,{...d}]).forecasts);
});
test('missing target does not produce nonfinite ranked score',()=>{
 const x=run([],[{id:'G',status:'active'}]);
 assert.ok(x.recommendations.every(y=>y.rankScore===null||Number.isFinite(y.rankScore)));
});
test('replaying previous approval against returned forecast is idempotent',()=>{
 const d={goalId:'G',recommendationId:'rec-G-R',action:'approve',timestamp:now};
 const first=run([d]).forecasts[0];
 const second=run([d],[{...g[0],currentForecast:first.newForecast}]).forecasts[0];
 assert.equal(second.newForecast,first.newForecast);
});
test('optimizer does not mutate caller records',()=>{
 const input=structuredClone({g,r,d:[]});const before=JSON.stringify(input);
 optimize(input.g,input.r,[],input.d,now);assert.equal(JSON.stringify(input),before);
});
test('owner target remains separate and unchanged',()=>{
 const d={goalId:'G',recommendationId:'rec-G-R',action:'approve',timestamp:now};
 assert.equal(run([d]).forecasts[0].ownerTarget,'2026-12-01');
});
