'use strict';
// The Pure — heart-rate measurements (owner-approved 3-screen UX, #115 6866888034; HR-max method 6868110715).
// Pure functions over recorded samples. Only fresh Bluetooth readings count as measurements; anything missing is
// reported as missing (null) and never filled in.
const PureHR=(()=>{
 const ZONES=[[90,5],[80,4],[70,3],[60,2],[50,1]];
 const isLive=s=>s&&s.source==='bluetooth'&&Number.isFinite(s.bpm)&&s.bpm>=30&&s.bpm<=240;
 const t=s=>Date.parse(s.timestamp);
 const live=samples=>(samples||[]).filter(isLive).map(s=>({at:t(s),bpm:s.bpm,phase:s.phase,round:s.round})).filter(s=>Number.isFinite(s.at)).sort((a,b)=>a.at-b.at);
 const validAge=age=>Number.isInteger(age)&&age>=10&&age<=100;
 // Max HR: 220 − age to start; replaced by the user's own sustained maximum once one is measured higher.
 function maxHr(settings={}){const est=validAge(settings.age)?220-settings.age:null,obs=Number.isInteger(settings.hrMaxObserved?.bpm)?settings.hrMaxObserved.bpm:null;
  if(obs!==null&&(est===null||obs>est))return {bpm:obs,source:'measured',label:'measured in your workouts'};
  if(est!==null)return {bpm:est,source:'age',label:'estimated from age (220 − '+settings.age+')'};return null}
 function zone(bpm,max){if(!Number.isFinite(bpm)||!max)return null;const pct=Math.round(bpm/max*100);const z=ZONES.find(([p])=>pct>=p);return {pct,zone:z?z[1]:0}}
 // Highest heart rate held for windowMs (every sample in the window at or above it), so one glitchy spike never counts.
 const readings=w=>w?.hr||w?.heartRateReadings||[];
 function sustainedPeak(samples,windowMs=5000){const s=live(samples);let best=null;
  for(let i=0;i<s.length;i++){let min=Infinity,n=0,j=i;for(;j<s.length&&s[j].at-s[i].at<windowMs;j++){min=Math.min(min,s[j].bpm);n++}
   if(n>=4&&s[j-1].at-s[i].at>=windowMs-1500&&(best===null||min>best))best=min}
  return best}
 // Pre-workout baseline: median of fresh readings in the 30 s before Start. It is a baseline, not a true resting HR.
 function baseline(buffer,startAt,windowMs=30000){const s=live(buffer).filter(x=>x.at<=startAt&&startAt-x.at<=windowMs);if(s.length<5)return null;
  const v=s.map(x=>x.bpm).sort((a,b)=>a-b),m=v.length>>1;return {bpm:v.length%2?v[m]:Math.round((v[m-1]+v[m])/2),samples:v.length,seconds:Math.round((startAt-s[0].at)/1000),sampledAt:new Date(startAt).toISOString(),label:'pre-workout baseline'}}
 const near=(s,at,tol=3000)=>{let best=null;for(const x of s){const d=Math.abs(x.at-at);if(d<=tol&&(best===null||d<Math.abs(best.at-at)))best=x}return best};
 // Recovery measurements from one recovery window: HR at the start, 60/120-second drops, and time to the threshold.
 function recovery(samples,rec,threshold=110){if(!rec?.started)return null;const start=Date.parse(rec.started),end=rec.ended?Date.parse(rec.ended):Infinity;
  const s=live(samples).filter(x=>x.at>=start-3000&&x.at<=end);if(!s.length)return {measured:false};
  const first=near(s,start),at60=near(s,start+60000),at120=near(s,start+120000),hit=s.find(x=>x.at>=start&&x.bpm<=threshold);
  return {measured:true,startBpm:first?.bpm??null,at60:at60?.bpm??null,at120:at120?.bpm??null,drop60:first&&at60?first.bpm-at60.bpm:null,drop120:first&&at120?first.bpm-at120.bpm:null,
   secondsTo110:hit?Math.round((hit.at-start)/1000):null,samples:s.length,curve:s.map(x=>({s:Math.round((x.at-start)/1000),bpm:x.bpm}))}}
 function summary(w,settings={}){if(!w)return null;const hr=readings(w),s=live(hr);const base=w.hrBaseline?.bpm??null;
  const work=s.filter(x=>x.phase==='exercise'||x.phase==='transition'),peak=work.length?Math.max(...work.map(x=>x.bpm)):(s.length?Math.max(...s.map(x=>x.bpm)):null),max=maxHr(settings);
  const between=(w.recoveries||[]).find(r=>r.kind==='between-rounds'),final=(w.recoveries||[]).find(r=>r.kind==='post-workout'||r.kind==='final');
  return {measured:s.length>0,baseline:base,peak,delta:base!==null&&peak!==null?peak-base:null,peakPct:peak!==null&&max?Math.round(peak/max.bpm*100):null,max,
   betweenRounds:recovery(hr,between,w.thresholdBpm||110),cooldown:recovery(hr,final,w.thresholdBpm||110)}}
 // Comparison with the most recent earlier workout that has the same measurement.
 function compare(history,w,settings={}){const cur=summary(w,settings);if(!cur)return null;const prev=(history||[]).filter(x=>x.id!==w.id&&x.status==='complete'&&!x.practice&&Date.parse(x.started)<Date.parse(w.started)).sort((a,b)=>Date.parse(b.started)-Date.parse(a.started));
  const pick=f=>{for(const p of prev){const v=f(summary(p,settings));if(Number.isFinite(v))return v}return null};
  const d=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)?a-b:null;
  return {drop60:d(cur.cooldown?.drop60,pick(x=>x.cooldown?.drop60)),secondsTo110:d(cur.betweenRounds?.secondsTo110,pick(x=>x.betweenRounds?.secondsTo110))}}
 return {maxHr,zone,sustainedPeak,baseline,recovery,summary,compare,validAge,readings};
})();
if(typeof module!=='undefined')module.exports=PureHR;
