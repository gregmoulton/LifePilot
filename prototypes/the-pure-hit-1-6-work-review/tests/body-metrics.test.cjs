// Fictional values only. Run from the prototype directory: node --test tests/*.test.cjs
const {test}=require('node:test'),a=require('node:assert/strict'),B=require('../dist/body-metrics.js'),J=require('../dist/journal.js');
const now=Date.parse('2026-11-11T14:00:00Z'),day=86400000,iso=t=>new Date(t).toISOString();
const sync=(o={})=>B.syncedReading({provider:'test',externalId:'r1',measuredAt:iso(now-3600000),weightKg:90,bodyFatPercent:20,device:B.OFFICIAL_DEVICE,verified:true,...o});

test('official device is the white scale the journal already uses',()=>{a.equal(B.OFFICIAL_DEVICE,J.WHITE)});

test('FFM and FFMI math',()=>{
 a.equal(B.fatFreeMassKg(100,20),80);
 const r=B.ffmi(80,180);a.equal(r.ffmi,24.7);a.equal(r.normalizedFfmi,24.7);
 const s=B.ffmi(70,170);a.equal(s.ffmi,24.2);a.equal(s.normalizedFfmi,24.8);
 for(const bad of [[0,20],[100,0],[100,80],[NaN,20],[200,20]])a.equal(B.fatFreeMassKg(...bad),null);
 a.equal(B.ffmi(80,undefined),null);a.equal(B.ffmi(80,90),null);
});

test('derive reports what is missing instead of guessing',()=>{
 const d=B.derive({weightKg:90,bodyFatPercent:null},undefined);a.equal(d.fatFreeMassKg,null);a.equal(d.ffmi,null);a.deepEqual(d.missing,['body fat %','height']);
 const e=B.derive({weightKg:90,bodyFatPercent:20},180);a.equal(e.fatFreeMassKg,72);a.equal(e.fatMassKg,18);a.equal(e.ffmi,22.2);a.deepEqual(e.missing,[]);a.equal(e.bodyFatIsEstimate,true);
});

test('weight status: recent verified sync, else saved, else none — never blocks',()=>{
 a.equal(B.weightStatus([],now).kind,'none');
 const manual=J.weight({value:'200',unit:'lb',fat:'',date:iso(now-day)},'m');
 a.equal(B.weightStatus([manual],now).kind,'saved');
 a.equal(B.weightStatus([manual,sync()],now).kind,'synced');
 a.equal(B.weightStatus([manual,sync({verified:false})],now).kind,'saved');
 const old=sync({externalId:'old',measuredAt:iso(now-10*day)});a.equal(B.weightStatus([old],now).kind,'saved');a.equal(B.weightStatus([old],now).label,'Last synced reading');
 const future=sync({externalId:'f',measuredAt:iso(now+day)});a.equal(B.weightStatus([future],now).kind,'none');
});

test('body composition never mixes the black scale into the trend',()=>{
 const white=J.weight({value:'200',unit:'lb',fat:'24',date:iso(now-2*day)},'w');
 const black=J.weight({value:'200',unit:'lb',fat:'18.5',date:iso(now-day),device:J.BLACK},'b');
 const c=B.latestComposition([white,black],180);a.equal(c.row.id,'w');a.equal(c.metrics.bodyFatPercent,24);
 a.equal(B.latestComposition([black],180).row,null);
 // weight itself may still come from the black scale (they agree on weight)
 a.equal(B.weightStatus([white,black],now).row.id,'b');
});

test('synced readings validate, pass the existing backup validator, and never duplicate',()=>{
 const r=sync();a.equal(r.id,'sync:test:r1');a.equal(r.source,'scale-sync');a.equal(r.bodyFatIsEstimate,true);
 a.doesNotThrow(()=>J.validateExtras({measurements:[r],assessments:[],legacyHistory:[]}));
 const once=B.mergeSynced([],[r]),twice=B.mergeSynced(once.measurements,[r,r]);a.equal(once.added,1);a.equal(twice.added,0);a.equal(twice.measurements.length,1);
 for(const bad of [{provider:'vesync-cloud'},{externalId:''},{measuredAt:'nope'},{weightKg:0},{weightKg:181},{bodyFatPercent:90},{device:''}])a.throws(()=>sync(bad));
});

test('height accepts inches or cm within human range',()=>{
 a.equal(B.heightCm({value:'70',unit:'in'}),177.8);a.equal(B.heightCm({value:'180',unit:'cm'}),180);
 for(const v of ['','abc','10','300'])a.throws(()=>B.heightCm({value:v,unit:'cm'}));
});
