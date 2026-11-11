const {test}=require('node:test'),assert=require('node:assert/strict');
const {data,render}=require('../dist/workout-summary');
const start='2026-11-09T20:00:00Z';
test('summary uses saved reps, separate rounds and recorded heart rate',()=>{
 const w={started:start,records:[{round:'maximum',exercise:'Squat',exerciseName:'Jump Squats',reps:12},{round:'conditioning',exercise:'Squat',reps:8}],heartRateReadings:[{timestamp:start,bpm:140},{timestamp:'2026-11-09T20:01:00Z',bpm:110}],recoveries:[{kind:'post-workout',checkpoint:{elapsedMs:61000}}]};
 const d=data(w);assert.deepEqual(d.rounds,[12,8,20]);assert.equal(d.peak,140);assert.equal(d.avg,125);assert.equal(d.recovery,'1:01');
 const el={};render(el,w);assert.match(el.innerHTML,/Jump Squats/);assert.match(el.innerHTML,/<polyline/);assert.match(el.innerHTML,/Workout Summary/);
 render(el,null);assert.equal(el.innerHTML,'');render(el,w);assert.match(el.innerHTML,/Jump Squats/);
});
test('partial summaries leave missing data blank and do not invent grade or calories',()=>{
 const w={started:start,records:[{round:'maximum',exercise:'Squat',exerciseName:'<img>',sideReps:{left:5,right:7}}],recoveries:[{kind:'post-workout',manualOverride:true,checkpoint:{elapsedMs:60000}}]};
 const d=data(w);assert.deepEqual(d.rounds,[12,null,12]);assert.equal(d.recovery,null);
 const el={};render(el,w);assert.match(el.innerHTML,/&lt;img&gt;/);assert.doesNotMatch(el.innerHTML,/Calories|kcal/);assert.doesNotMatch(el.innerHTML,/<polyline/);
});
