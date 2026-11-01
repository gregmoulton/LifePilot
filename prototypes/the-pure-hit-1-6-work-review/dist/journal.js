'use strict';
const PureJournal=(()=>{
 const WHITE='Etekcity EFS-C671-WUST (white, USB-C)', BLACK='Etekcity ESF-551 (black)';
 const number=(s,min,max,label)=>{if(typeof s!=='string'||!/^\d+(\.\d+)?$/.test(s.trim()))throw Error('Enter '+label+' as a number.');const n=Number(s);if(!Number.isFinite(n)||n<min||n>max)throw Error(label+' must be between '+min+' and '+max+'.');return n};
 function weight({value,unit,fat,date,device=WHITE},id){if(!['lb','kg'].includes(unit)||![WHITE,BLACK].includes(device))throw Error('Choose the scale and weight unit.');const n=number(value,0.1,unit==='lb'?400:180,'weight'),bodyFat=fat.trim()===''?null:number(fat,0.1,80,'body fat');if(!date||!Number.isFinite(Date.parse(date)))throw Error('Choose a measurement date.');return {id,timestamp:new Date(date).toISOString(),weight:n,unit,weightKg:unit==='kg'?n:n*0.45359237,bodyFatPercent:bodyFat,device,source:'manual-from-scale',bodyFatIsEstimate:true}}
 function assessment({kind,exercise,value,unit,date,stage,notes=''},id){if(!['one-rep-max','one-mile-run'].includes(kind)||!['baseline','follow-up'].includes(stage))throw Error('Choose the test and stage.');if(!date||!Number.isFinite(Date.parse(date)))throw Error('Choose a test date.');if(notes.length>2000)throw Error('Keep notes under 2000 characters.');let result;
 if(kind==='one-rep-max'){if(!exercise.trim()||exercise.length>100||!['lb','kg'].includes(unit))throw Error('Enter the exercise and load unit.');result={load:number(value,0.1,3000,'load'),unit,exercise:exercise.trim(),reps:1}}
 else{if(!/^\d{1,3}:[0-5]\d$/.test(value.trim()))throw Error('Enter mile time as minutes:seconds, for example 9:35.');const [m,s]=value.split(':').map(Number);if(m*60+s<1)throw Error('Enter a positive run time.');result={distanceMiles:1,timeSeconds:m*60+s}}
 return {id,timestamp:new Date(date).toISOString(),kind,stage,...result,notes:notes.trim(),source:'manual-performance-test'};
 }
 function validateExtras(b){
 const validLegacy=w=>w&&typeof w.id==='string'&&Number.isFinite(Date.parse(w.date))&&Array.isArray(w.results)&&w.results.length>0&&w.results.every(r=>r&&typeof r.name==='string'&&Array.isArray(r.reps)&&r.reps.every(n=>n===null||Number.isInteger(n)&&n>=0));
 for(const key of ['measurements','assessments','legacyHistory'])if(b[key]!==undefined&&(!Array.isArray(b[key])||b[key].length>20000||b[key].some(r=>!r||typeof r.id!=='string'||!r.id)))throw Error('Invalid '+key+' records.');
 if((b.measurements||[]).some(r=>!Number.isFinite(r.weightKg)||r.weightKg<=0||r.weightKg>180||!Number.isFinite(r.weight)||r.weight<=0||!['lb','kg'].includes(r.unit)||typeof r.device!=='string'||!Number.isFinite(Date.parse(r.timestamp))||(r.bodyFatPercent!==null&&(!Number.isFinite(r.bodyFatPercent)||r.bodyFatPercent<=0||r.bodyFatPercent>80))))throw Error('Invalid body measurements.');
 if((b.assessments||[]).some(r=>!['one-mile-run','one-rep-max'].includes(r.kind)||!['baseline','follow-up'].includes(r.stage)||!Number.isFinite(Date.parse(r.timestamp))||(r.kind==='one-mile-run'?!(r.timeSeconds>0):!(r.load>0)||!['lb','kg'].includes(r.unit)||typeof r.exercise!=='string'||!r.exercise)))throw Error('Invalid performance tests.');
 if((b.legacyHistory||[]).some(r=>!validLegacy(r.originalWorkout)))throw Error('Invalid original Pure records.');
 return b;
 }
 function parseBackup(text){if(text.length>5000000)throw Error('Backup exceeds the 5 MB import limit.');const b=JSON.parse(text);if(b.schema==='the-pure-v1'&&b.version===1){if(!Array.isArray(b.workouts))throw Error('Invalid original Pure workout list.');for(const w of b.workouts){if(!w||typeof w.id!=='string'||!Number.isFinite(Date.parse(w.date))||!Array.isArray(w.results)||!w.results.length||w.results.some(r=>!r||typeof r.name!=='string'||!Array.isArray(r.reps)||r.reps.some(n=>n!==null&&(!Number.isInteger(n)||n<0))))throw Error('Invalid original Pure workout.')}return {history:[],measurements:[],assessments:[],legacyHistory:b.workouts.map(w=>({id:'original-pure:'+w.id,source:'the-pure-v1',originalWorkout:w})),active:null}}
 if(b.schema!=='the-pure-backup-v2'||!Array.isArray(b.history)||b.history.some(w=>!w||typeof w.id!=='string'||!Number.isFinite(Date.parse(w.started))||!['complete','partial'].includes(w.status)||!Array.isArray(w.records)||w.records.some(r=>typeof r.exercise!=='string'||!Number.isInteger(r.reps)||r.reps<0)))throw Error('Choose a complete Pure history backup.');
 const arrays={history:b.history,measurements:b.measurements||[],assessments:b.assessments||[],legacyHistory:b.legacyHistory||[]};
 for(const [key,rows] of Object.entries(arrays)){if(!Array.isArray(rows)||rows.length>20000||rows.some(r=>!r||typeof r.id!=='string'||!r.id)||new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Invalid or duplicate '+key+' records.');}
 validateExtras(arrays);
 return {...arrays,active:b.active||null};
 }
 function merge(db,b){if(db.active&&b.history.some(w=>w.id===db.active.id))throw Error('Imported history conflicts with the active session. Save the current session first.');const next=JSON.parse(JSON.stringify(db));for(const key of ['history','measurements','assessments','legacyHistory']){next[key]??=[];for(const r of b[key]){const old=next[key].find(x=>x.id===r.id);if(old&&JSON.stringify(old)!==JSON.stringify(r))throw Error('Conflicting record ID. Current records were not changed.');if(!old)next[key].push(r)}}return next}
 return {WHITE,BLACK,weight,assessment,parseBackup,merge,validateExtras};
})();
if(typeof module!=='undefined')module.exports=PureJournal;
