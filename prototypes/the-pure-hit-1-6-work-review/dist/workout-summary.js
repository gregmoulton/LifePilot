'use strict';

const PureSummary=(()=>{
 const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const time=s=>Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
 const data=w=>{
  const start=Date.parse(w.started);
  const readings=(w.heartRateReadings||[]).map(r=>({t:Date.parse(r.timestamp),bpm:r.bpm})).filter(r=>Number.isFinite(r.t)&&Number.isFinite(r.bpm)&&r.bpm>=30&&r.bpm<=240).sort((a,b)=>a.t-b.t);
  const round=r=>w.records.filter(x=>x.round===r);
  const total=r=>r.length?r.reduce((n,x)=>n+(x.sideReps?x.sideReps.left+x.sideReps.right:x.reps),0):null;
  const first=round('maximum'),second=round('conditioning');
  const recovery=w.recoveries?.filter(r=>r.kind==='post-workout'&&!r.manualOverride&&!r.readingStale&&Number.isFinite(r.checkpoint?.elapsedMs)).at(-1);
  const peak=readings.length?Math.max(...readings.map(r=>r.bpm)):null;
  const avg=readings.length?Math.round(readings.reduce((n,r)=>n+r.bpm,0)/readings.length):null;
  return {start,readings,rounds:[total(first),total(second),total(w.records)],peak,avg,recovery:recovery?time(Math.round(recovery.checkpoint.elapsedMs/1000)):null};
 };
 function graph({start,readings}){
  if(!readings.length)return '<p class="summary-muted">No heart-rate readings recorded.</p>';
  const base=Number.isFinite(start)?Math.min(start,readings[0].t):readings[0].t;
  const duration=Math.max(1000,readings.at(-1).t-base);
  const low=Math.max(0,Math.floor(Math.min(...readings.map(r=>r.bpm))/20)*20-10),high=Math.ceil(Math.max(...readings.map(r=>r.bpm))/20)*20+10;
  const points=readings.map(r=>[27+281*(r.t-base)/duration,83-67*(r.bpm-low)/(high-low)]);
  const line=points.map(p=>p.map(n=>n.toFixed(1)).join(',')).join(' ');
  return '<svg class="summary-chart" viewBox="0 0 316 105" role="img" aria-label="Recorded heart rate from '+readings[0].bpm+' to '+readings.at(-1).bpm+' BPM"><defs><linearGradient id="summaryTraceFill" x2="0" y2="1"><stop stop-color="#00acff" stop-opacity=".58"/><stop offset="1" stop-color="#00acff" stop-opacity=".06"/></linearGradient></defs><path d="M27 16H308 M27 50H308 M27 83H308 M27 16V83 M97 16V83 M167 16V83 M237 16V83 M308 16V83" fill="none" stroke="#214765" stroke-width=".6"/><polygon points="'+points[0][0]+',83 '+line+' '+points.at(-1)[0]+',83" fill="url(#summaryTraceFill)"/><polyline points="'+line+'" fill="none" stroke="#00c7ff" stroke-width="1.7"/><circle cx="'+points.at(-1)[0]+'" cy="'+points.at(-1)[1]+'" r="2" fill="#00c7ff"/><g fill="#bad7f0" font-size="9"><text x="2" y="20">'+high+'</text><text x="2" y="86">'+low+'</text><text x="27" y="98">0:00</text><text x="308" y="98" text-anchor="end">'+time(Math.round(duration/1000))+'</text></g></svg>';
 }
 function render(el,w){
  if(!w){el.summaryRecord=null;el.innerHTML='';return;}
  if(el.summaryRecord===w)return;el.summaryRecord=w;
  const d=data(w), names=['Round 1','Round 2','Total'];
  const tiles=d.rounds.map((n,i)=>'<div class="summary-tile"><span>'+names[i]+'</span><strong>'+(n??'—')+'</strong><small>reps</small></div>').join('');
  const byMove=new Map();for(const r of w.records){const key=r.exercise;const row=byMove.get(key)||{label:r.exerciseName||key,max:'—',cond:'—'};row[r.round==='maximum'?'max':'cond']=r.sideReps?'L '+r.sideReps.left+' / R '+r.sideReps.right:r.reps;byMove.set(key,row);}
  const rows=[...byMove.values()].map(r=>'<tr><th scope="row">'+safe(r.label)+'</th><td>'+safe(r.max)+'</td><td>'+safe(r.cond)+'</td></tr>').join('');
  const metric=(label,v,unit)=>'<div><span>'+label+'</span><strong>'+(v??'—')+'</strong>'+(v!==null&&unit?' <small>'+unit+'</small>':'')+'</div>';
  el.innerHTML='<div class="summary-tiles">'+tiles+'</div><section class="summary-card"><h3><span aria-hidden="true">▥</span> Exercise Performance</h3>'+(rows?'<table><thead><tr><th>Exercise</th><th>Round 1</th><th>Round 2</th></tr></thead><tbody>'+rows+'</tbody></table>':'<p class="summary-muted">No exercise reps recorded.</p>')+'</section><section class="summary-card summary-grade"><h3><span aria-hidden="true">✦</span> AI Performance Grade</h3><div><strong>—</strong><p>Not graded <small>No scoring rubric is configured.</small></p></div></section><section class="summary-card"><h3><span class="summary-heart" aria-hidden="true">♥</span> Heart Rate &amp; Recovery</h3><div class="summary-hr">'+metric('Peak HR',d.peak,'BPM')+metric('Avg recorded HR',d.avg,'BPM')+metric('Cooldown to target',d.recovery,'')+'</div>'+graph(d)+'</section><section class="summary-card"><h3><span class="summary-energy" aria-hidden="true">◆</span> Estimated Energy</h3><p class="summary-muted">Calories unavailable · no estimate configured.</p></section><p class="summary-note">Reps are self-reported. Left and right reps both count toward totals.</p>';
 }
 return {data,render};
})();
if(typeof module!=='undefined')module.exports=PureSummary;
