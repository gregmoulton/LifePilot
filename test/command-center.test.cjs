const {test}=require('node:test');
const assert=require('node:assert/strict');
const ui=require('../command-center.js');
const profile=()=>({
  goals:[{id:'g1',name:'Fictional launch <script>',status:'active'},{id:'g2',name:'Later',status:'paused'}],
  decision_register:[{id:'one',status:'proposed'},{id:'two',status:'approved'}],
  execution:{tasks:[{id:'today',name:'Owner review',status:'planned'},{id:'done',name:'Complete',status:'completed'}]},
  agenda:{proposals:[{status:'proposed'},{status:'rejected'}]}
});
const view={today:[{id:'today',name:'Review <b>proposal</b>',overdue:true}],upcoming:[],hold:[],review:[],completed:[{id:'done'}]};
test('dashboard numbers use saved local records, not invented sample values',()=>{
  const s=ui.summarize(profile(),view);
  assert.equal(s.activeGoals,1);assert.equal(s.goals,2);assert.equal(s.today,1);
  assert.equal(s.completed,1);assert.equal(s.completion,50);
  assert.equal(s.proposedAgenda,1);assert.equal(s.proposedDecisions,1);
  const result=ui.dashboardHtml(s,'Oct 24');
  assert.match(result,/AI staff/);assert.match(result,/Not connected/);
  assert.match(result,/Owner approvals/);
  assert.doesNotMatch(result,/\$482|218\.8|1000/);
});
test('sanitizes all profile-controlled labels in dashboard',()=>{
  const result=ui.dashboardHtml(ui.summarize(profile(),view),'Saturday <svg>');
  assert.match(result,/Fictional launch &lt;script&gt;/);
  assert.match(result,/Review &lt;b&gt;proposal&lt;\/b&gt;/);
  assert.match(result,/Saturday &lt;svg&gt;/);
  assert.doesNotMatch(result,/<script>/);
});
test('legacy profile without agenda displays unavailable, not zero',()=>{
  const p={goals:[],execution:{tasks:[]}};
  const s=ui.summarize(p,null);
  assert.equal(s.today,null);assert.equal(s.completion,null);
  assert.match(ui.dashboardHtml(s,'Today'),/Not available/);
});
test('rendering and summarizing do not mutate source profile',()=>{
  const p=profile(),before=JSON.stringify(p);
  ui.dashboardHtml(ui.summarize(p,view),'Today');
  assert.equal(JSON.stringify(p),before);
});
test('no approval or task changes are performed in pure model',()=>{
  const p=profile();
  const s=ui.summarize(p,view);
  assert.equal(s.proposedAgenda,1);
  assert.equal(p.agenda.proposals[0].status,'proposed');
  assert.equal(p.execution.tasks[0].status,'planned');
});
