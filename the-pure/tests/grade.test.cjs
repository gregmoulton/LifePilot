// Workout Grade architecture + the synthetic examples posted for approval (#115 comment 6841249672).
const {test}=require('node:test'),a=require('node:assert/strict'),G=require('../dist/grade.js');
const plan=[{category:'Push',name:'Decline push-ups',variant:'',exerciseId:'push-3-decline'},{category:'Squat',name:'Jump Squats',variant:'Bodyweight',exerciseId:'squat-3-jump'},{category:'Pull',name:'Inverted rows',variant:'Bent-knee',exerciseId:'pull-1-inverted-bent'}];
const bests={Push:10,Squat:20,Pull:10},floors={Push:7,Squat:14,Pull:7};
const w=(r1,r2,extra={})=>({id:'w',exercisePlan:plan,records:[...plan.map((m,i)=>({round:'maximum',exercise:m.category,reps:r1[i]})),...plan.map((m,i)=>({round:'conditioning',exercise:m.category,reps:r2[i],floor:floors[m.category]}))],...extra});
const opts={bestBefore:m=>bests[m.category],eligibleBefore:3};

test('synthetic examples from the proposal',()=>{
 const g=(r1,r2,o=opts)=>G.workoutGrade(w(r1,r2),o);
 a.deepEqual([g([10,20,10],[7,14,7]).score,g([10,20,10],[7,14,7]).letter],[105,'A']);
 a.deepEqual([g([9,18,9],[6,13,6]).score,g([9,18,9],[6,13,6]).letter],[94,'B']);
 a.deepEqual([g([7,15,7],[5,10,5]).score,g([7,15,7],[5,10,5]).letter],[76,'D']);
 a.deepEqual([g([12,20,10],[8,14,7]).score,g([12,20,10],[8,14,7]).letter],[107,'A']);
 const newRung=g([10,20,10],[7,14,7],{bestBefore:m=>m.category==='Push'?null:bests[m.category],eligibleBefore:3});
 a.equal(newRung.components[0].status,'new-baseline');a.equal(newRung.gradable,2);a.deepEqual([newRung.score,newRung.letter],[105,'A']);
});

test('the letter is a draft until the owner approves the rules',()=>{
 const r=G.workoutGrade(w([10,20,10],[7,14,7]),opts);a.equal(G.ACTIVE,false);a.equal(r.status,'pending-approval');a.match(r.label,/draft — rules pending owner approval/);a.equal(r.version,'pure-grade-v1');
});

test('heart rate never changes the grade; cardio is reported separately',()=>{
 const noHr=G.workoutGrade(w([9,18,9],[6,13,6]),opts),withHr=G.workoutGrade(w([9,18,9],[6,13,6],{heartRateReadings:[{bpm:150},{bpm:100}]}),opts);
 a.deepEqual([noHr.score,noHr.letter],[withHr.score,withHr.letter]);
 a.equal(G.cardio(w([1,1,1],[1,1,1])).status,'not-assessed');a.match(G.cardio({}).label,/Not assessed — no heart-rate data/);
 a.equal(G.cardio({heartRateReadings:[{bpm:120}]}).status,'baseline-building');
});

test('provisional, practice, new baselines: never a penalty and never an invented benchmark',()=>{
 a.equal(G.workoutGrade(w([10,20,10],[7,14,7]),{...opts,eligibleBefore:2}).status,'provisional');
 a.equal(G.workoutGrade(w([10,20,10],[7,14,7]),{bestBefore:()=>null,eligibleBefore:9}).status,'provisional');
 const p=G.workoutGrade(w([10,20,10],[7,14,7],{practice:true}),opts);a.equal(p.status,'practice');a.equal(p.letter,undefined);a.match(p.label,/Practice — not graded/);
 const one=G.workoutGrade(w([10,20,10],[7,14,7]),{bestBefore:m=>m.category==='Pull'?10:null,eligibleBefore:9});a.equal(one.status,'provisional','only 1 of 3 gradable');
});

test('component text explains measured reps only; cutoffs are A>=100 B>=90 C>=80 D>=70',()=>{
 const r=G.workoutGrade(w([12,20,10],[8,14,7]),opts);a.equal(r.components[0].text,'Push: R1 12 vs best 10 (new best) · R2 8 vs goal 7');
 for(const c of r.components)a.doesNotMatch(c.text,/form|effort|failure|slack/i);
 a.deepEqual([100,99,90,89,80,79,70,69].map(G.letter),['A','B','B','C','C','D','D','F']);
});
