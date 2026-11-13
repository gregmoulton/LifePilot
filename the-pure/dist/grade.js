'use strict';
// The Pure — Workout Grade + Cardio Assessment (architecture per owner spec, #115 comment 6840120211).
// Pure, deterministic, versioned. Computed from the saved source reps; never stored over them, never
// backfilled. Heart rate is NEVER an input to the Workout Grade.
// The formula below is the PROPOSAL "pure-grade-v1" (#115 comment 6841249672). Until the owner approves
// it, ACTIVE is false and the letter is reported as pending approval.
const PureGrade=(()=>{
 const VERSION='pure-grade-v1',ACTIVE=false,CAP=1.10,R1_SHARE=.9,MIN_GRADABLE=2,MIN_ELIGIBLE=3;
 const CUTOFFS=[[100,'A'],[90,'B'],[80,'C'],[70,'D'],[-Infinity,'F']];
 const same=(m,r)=>r.exerciseId?r.exerciseId===m.exerciseId&&(r.variation??'')===(m.variant??''):r.exerciseName===m.name&&(r.variation??'')===(m.variant??'');
 const letter=s=>CUTOFFS.find(([c])=>s>=c)[1];
 // bestBefore(move) must return the best comparable Round 1 recorded BEFORE this workout, or null.
 function workoutGrade(w,{bestBefore,eligibleBefore=0}={}){
  if(!w)return null;
  if(w.practice)return {version:VERSION,status:'practice',label:'Practice — not graded / not saved',components:[]};
  const plan=w.exercisePlan||[],components=[];
  for(const m of plan){const r1=(w.records||[]).find(r=>r.round==='maximum'&&r.exercise===m.category),r2=(w.records||[]).find(r=>r.round==='conditioning'&&r.exercise===m.category);
   const best=bestBefore?bestBefore(m):null,c={category:m.category,name:m.name,variant:m.variant||'',exerciseId:m.exerciseId||null,r1:r1?.reps??null,r2:r2?.reps??null,best,floor:Number.isInteger(r2?.floor)?r2.floor:null};
   if(!Number.isInteger(best)||best<=0){c.status='new-baseline';c.text=m.category+': new baseline · not graded';components.push(c);continue}
   const parts=[];if(Number.isInteger(c.r1))parts.push(Math.min(CAP,c.r1/(R1_SHARE*best)));if(Number.isInteger(c.r2)&&Number.isInteger(c.floor)&&c.floor>0)parts.push(Math.min(CAP,c.r2/c.floor));
   if(!parts.length){c.status='no-data';c.text=m.category+': not recorded · not graded';components.push(c);continue}
   c.status='graded';c.ratio=parts.reduce((x,y)=>x+y,0)/parts.length;
   c.text=m.category+': R1 '+c.r1+' vs best '+best+(c.r1>best?' (new best)':'')+(Number.isInteger(c.floor)&&Number.isInteger(c.r2)?' · R2 '+c.r2+' vs goal '+c.floor:'');components.push(c)}
  const graded=components.filter(c=>c.status==='graded');
  if(graded.length<MIN_GRADABLE||eligibleBefore<MIN_ELIGIBLE)return {version:VERSION,status:'provisional',label:'Provisional — not enough comparable workouts yet',components,gradable:graded.length,eligibleBefore};
  const score=Math.round(100*graded.reduce((x,c)=>x+c.ratio,0)/graded.length),l=letter(score);
  return {version:VERSION,status:ACTIVE?'graded':'pending-approval',score,letter:l,label:ACTIVE?'Workout Grade: '+l:'Workout Grade: '+l+' (draft — rules pending owner approval)',components,gradable:graded.length,eligibleBefore};
 }
 // Cardio Assessment is separate and never affects the grade.
 function cardio(w){const hr=(w?.heartRateReadings||[]).filter(r=>r&&Number.isFinite(r.bpm));
  if(!hr.length)return {status:'not-assessed',label:'Cardio Assessment: Not assessed — no heart-rate data.',note:'Connect a compatible HRM next time to unlock recovery tracking and cardiovascular trend analysis.'};
  return {status:'baseline-building',label:'Cardio Assessment: Baseline building — '+hr.length+' heart-rate readings captured.',note:'Trends appear only after enough like-for-like sessions; one session is not evidence of change.'}}
 return {VERSION,ACTIVE,CUTOFFS,letter,workoutGrade,cardio,same};
})();
if(typeof module!=='undefined')module.exports=PureGrade;
