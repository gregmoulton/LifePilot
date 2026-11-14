// Heart-rate measurements (owner-approved #115). Fictional data only.
const {test}=require('node:test'),a=require('node:assert/strict'),H=require('../dist/hrmetrics.js');
const t0=Date.parse('2026-11-13T15:00:00Z');
const s=(sec,bpm,phase='exercise',source='bluetooth')=>({timestamp:new Date(t0+sec*1000).toISOString(),bpm,phase,source});

test('max HR starts at 220 − age and switches to the user\'s own measured max only when it is higher',()=>{
 a.equal(H.maxHr({}),null,'no age, nothing measured: no estimate is invented');
 a.deepEqual(H.maxHr({age:50}),{bpm:170,source:'age',label:'estimated from age (220 − 50)'});
 a.equal(H.maxHr({age:50,hrMaxObserved:{bpm:165}}).bpm,170,'lower measured value does not replace the estimate');
 a.deepEqual(H.maxHr({age:50,hrMaxObserved:{bpm:178}}),{bpm:178,source:'measured',label:'measured in your workouts'});
 a.equal(H.maxHr({age:7}),null);a.equal(H.maxHr({age:'50'}),null);
});

test('sustained peak ignores a single glitch spike and needs about 5 seconds of readings',()=>{
 const hr=[s(0,150),s(1,151),s(2,199),s(3,152),s(4,153),s(5,154),s(6,150)];
 a.equal(H.sustainedPeak(hr),151,'the 199 spike is not a max');
 a.equal(H.sustainedPeak([s(0,170),s(1,171)]),null,'too short to count');
 a.equal(H.sustainedPeak([s(0,170,'exercise','manual'),s(1,170,'exercise','manual'),s(2,170,'exercise','manual'),s(3,170,'exercise','manual'),s(5,170,'exercise','manual')]),null,'manual entries are not measurements');
});

test('zones and % of max',()=>{a.deepEqual(H.zone(153,170),{pct:90,zone:5});a.deepEqual(H.zone(119,170),{pct:70,zone:3});a.deepEqual(H.zone(80,170),{pct:47,zone:0});a.equal(H.zone(120,null),null)});

test('pre-workout baseline is the median of the last 30 s of live readings before Start; too few readings means none',()=>{
 const buf=[s(-60,95),s(-25,72),s(-20,74),s(-15,70),s(-10,76),s(-5,73)];
 a.deepEqual(H.baseline(buf,t0),{bpm:73,samples:5,seconds:25,sampledAt:new Date(t0).toISOString(),label:'pre-workout baseline'});
 a.equal(H.baseline(buf.slice(0,3),t0),null);
});

test('recovery: HR at start, 60/120-second drops and time to 110; gaps stay missing',()=>{
 const rec={started:new Date(t0+100000).toISOString(),ended:new Date(t0+260000).toISOString()};
 const hr=[s(100,150,'recovery'),s(130,135,'recovery'),s(160,124,'recovery'),s(190,112,'recovery'),s(205,109,'recovery'),s(240,104,'recovery')];
 const r=H.recovery(hr,rec);a.equal(r.startBpm,150);a.equal(r.drop60,26);a.equal(r.at120,null,'no reading near 120 s: missing, not guessed');a.equal(r.drop120,null);a.equal(r.secondsTo110,105);
 a.deepEqual(H.recovery([],rec),{measured:false});
});

test('workout summary and comparison with the previous workout',()=>{
 const mk=(id,day,drop)=>({id,status:'complete',started:new Date(t0+day*864e5).toISOString(),hrBaseline:{bpm:70},thresholdBpm:110,
  hr:[s(day*86400+10,150),s(day*86400+11,160),s(day*86400+400,150,'recovery'),s(day*86400+460,150-drop,'recovery')],
  recoveries:[{kind:'post-workout',started:new Date(t0+(day*86400+400)*1000).toISOString(),ended:new Date(t0+(day*86400+700)*1000).toISOString()}]});
 const w1=mk('a',0,20),w2=mk('b',1,30);
 const sm=H.summary(w2,{age:50});a.equal(sm.peak,160);a.equal(sm.delta,90);a.equal(sm.peakPct,94);a.equal(sm.cooldown.drop60,30);
 a.equal(H.compare([w1,w2],w2,{age:50}).drop60,10,'10 BPM better 1-minute drop than last time');
 a.equal(H.summary({hr:[],recoveries:[]},{}).measured,false);
});
