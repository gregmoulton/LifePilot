'use strict';
// The Pure — body metrics. Pure functions only: no storage, no network, no device access.
// Sync routes (Web Bluetooth, Health Connect bridge, cloud API) hand readings to syncedReading();
// everything downstream (weight status, FFM, FFMI) is identical regardless of route.
const PureBody=(()=>{
 const LB=0.45359237;
 const RECENT_DAYS=7; // a synced reading older than this is shown as "saved", not "recent synced"
 const round1=n=>Math.round(n*10)/10;
 const finite=n=>typeof n==='number'&&Number.isFinite(n);

 // Fat-free mass (kg) = weight × (1 − body fat fraction). Requires a body-fat reading.
 function fatFreeMassKg(weightKg,bodyFatPercent){
  if(!finite(weightKg)||weightKg<=0||weightKg>180)return null;
  if(!finite(bodyFatPercent)||bodyFatPercent<=0||bodyFatPercent>=80)return null;
  return weightKg*(1-bodyFatPercent/100);
 }
 // FFMI = FFM (kg) / height (m)². Normalized FFMI adjusts to a 1.80 m reference: + 6.1 × (1.8 − height m).
 function ffmi(ffmKg,heightCm){
  if(!finite(ffmKg)||ffmKg<=0||!finite(heightCm)||heightCm<100||heightCm>250)return null;
  const h=heightCm/100,raw=ffmKg/(h*h);
  return {ffmi:round1(raw),normalizedFfmi:round1(raw+6.1*(1.8-h))};
 }
 // Full derived set for one measurement row. Every derived value says what it was computed from.
 function derive(row,heightCm){
  if(!row||!finite(row.weightKg))return null;
  const fat=finite(row.bodyFatPercent)?row.bodyFatPercent:null,ffm=fatFreeMassKg(row.weightKg,fat),idx=ffmi(ffm,heightCm);
  return {
   weightKg:round1(row.weightKg),weightLb:round1(row.weightKg/LB),
   bodyFatPercent:fat,
   fatMassKg:ffm===null?null:round1(row.weightKg-ffm),
   fatFreeMassKg:ffm===null?null:round1(ffm),fatFreeMassLb:ffm===null?null:round1(ffm/LB),
   ffmi:idx?idx.ffmi:null,normalizedFfmi:idx?idx.normalizedFfmi:null,
   missing:[fat===null?'body fat %':null,!finite(heightCm)?'height':null].filter(Boolean),
   bodyFatIsEstimate:true // scale bioimpedance is an estimate; never present as measured
  };
 }

 // Workout Ready weight status: recent verified synced reading, else latest saved reading, else none.
 // Absence never blocks a workout.
 function weightStatus(measurements,now=Date.now()){
  const rows=(measurements||[]).filter(r=>r&&finite(r.weightKg)&&Number.isFinite(Date.parse(r.timestamp))&&Date.parse(r.timestamp)<=now+60000)
   .sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp));
  const ageDays=r=>Math.max(0,(now-Date.parse(r.timestamp))/86400000);
  const synced=rows.find(r=>r.source==='scale-sync'&&r.verified===true&&ageDays(r)<=RECENT_DAYS);
  if(synced)return {kind:'synced',row:synced,ageDays:ageDays(synced),label:'Synced from scale'};
  if(rows[0])return {kind:'saved',row:rows[0],ageDays:ageDays(rows[0]),label:rows[0].source==='scale-sync'?'Last synced reading':'Saved weight'};
  return {kind:'none',row:null,ageDays:null,label:'No weight yet · optional'};
 }

 // Body composition comes from ONE official scale only. Owner (Nov 11 2026): the white EFS-C671 is official;
 // the black ESF-551 agrees on weight but reads body fat ~5–6 points lower, so mixing them would fake a trend.
 const OFFICIAL_DEVICE='Etekcity EFS-C671-WUST (white, USB-C)';
 function compositionReadings(measurements,officialDevice=OFFICIAL_DEVICE){
  return (measurements||[]).filter(r=>r&&r.device===officialDevice&&finite(r.weightKg)&&finite(r.bodyFatPercent)&&Number.isFinite(Date.parse(r.timestamp)))
   .sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp));
 }
 function latestComposition(measurements,heightCm,officialDevice=OFFICIAL_DEVICE){
  const row=compositionReadings(measurements,officialDevice)[0];
  if(!row)return {row:null,metrics:null,note:'No body-fat reading from the official scale yet.'};
  return {row,metrics:derive(row,heightCm),note:'Body fat, FFM and FFMI use the official scale only.'};
 }

 // Normalize one reading from ANY sync route into a measurement row the existing journal accepts.
 // provider: 'web-bluetooth' | 'health-connect' | 'samsung-health' | 'google-health' | 'test'
 // externalId must be stable per reading so re-syncs never duplicate.
 const PROVIDERS=['web-bluetooth','health-connect','samsung-health','google-health','test'];
 function syncedReading({provider,externalId,measuredAt,weightKg,bodyFatPercent=null,device,impedanceOhms=null,verified=false}){
  if(!PROVIDERS.includes(provider))throw Error('Unknown sync provider.');
  if(typeof externalId!=='string'||!externalId||externalId.length>200)throw Error('Synced reading needs a stable ID.');
  if(!Number.isFinite(Date.parse(measuredAt)))throw Error('Synced reading needs a measurement time.');
  if(!finite(weightKg)||weightKg<=0||weightKg>180)throw Error('Synced weight out of range.');
  if(bodyFatPercent!==null&&(!finite(bodyFatPercent)||bodyFatPercent<=0||bodyFatPercent>80))throw Error('Synced body fat out of range.');
  if(typeof device!=='string'||!device)throw Error('Synced reading needs a device name.');
  return {id:'sync:'+provider+':'+externalId,timestamp:new Date(measuredAt).toISOString(),weight:round1(weightKg/LB),unit:'lb',weightKg,
   bodyFatPercent,device,source:'scale-sync',provider,externalId,impedanceOhms:finite(impedanceOhms)?impedanceOhms:null,
   verified:verified===true,bodyFatIsEstimate:true};
 }
 // Add synced rows without duplicating; never edits or removes manual rows. Returns {measurements, added}.
 function mergeSynced(measurements,rows){
  const next=(measurements||[]).slice(),ids=new Set(next.map(r=>r.id));let added=0;
  for(const r of rows){if(ids.has(r.id))continue;next.push(r);ids.add(r.id);added++}
  return {measurements:next,added};
 }
 function heightCm({value,unit}){
  const s=String(value??'').trim();if(!/^\d+(\.\d+)?$/.test(s))throw Error('Enter height as a number.');
  const n=Number(s),cm=unit==='in'?n*2.54:n;if(cm<100||cm>250)throw Error('Height must be between 100–250 cm (39–98 in).');
  return round1(cm);
 }
 return {RECENT_DAYS,OFFICIAL_DEVICE,compositionReadings,latestComposition,fatFreeMassKg,ffmi,derive,weightStatus,syncedReading,mergeSynced,heightCm};
})();
if(typeof module!=='undefined')module.exports=PureBody;
