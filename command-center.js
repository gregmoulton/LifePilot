/* Dashboard-first Life Pilot UI. No AI calls or profile mutation here. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root.document)api.mount(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const e=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const arr=x=>Array.isArray(x)?x:[];
  function summarize(data,view){
    const goals=arr(data?.goals),tasks=arr(data?.execution?.tasks);
    const decisions=arr(data?.decision_register),proposals=arr(data?.agenda?.proposals);
    const completed=tasks.filter(t=>t.status==='completed'||t.status==='done').length;
    const metric=k=>Array.isArray(view?.[k])?view[k].length:null;
    return {
      goals:goals.length,activeGoals:goals.filter(g=>g.status==='active').length,
      goalItems:goals.slice(0,5).map(g=>({name:String(g.name||'Unnamed goal'),status:String(g.status||'unspecified')})),
      taskCount:tasks.length,completed,completion:tasks.length?Math.round(completed*100/tasks.length):null,
      today:metric('today'),upcoming:metric('upcoming'),hold:metric('hold'),review:metric('review'),
      todaysTasks:arr(view?.today).slice(0,6).map(t=>({name:String(t.name||'Unnamed task'),blocked:!!t.blocked,overdue:!!t.overdue})),
      proposedDecisions:decisions.filter(d=>d.status==='proposed').length,
      proposedAgenda:proposals.filter(p=>p.status==='proposed').length
    };
  }
  function metricCard(label,value,note,color){
    return '<div class="lpc-stat lpc-'+color+'"><span>'+e(label)+'</span><strong>'+e(value)+'</strong><small>'+e(note)+'</small></div>';
  }
  function bar(label,count,total,color){
    if(count===null)return '<div class="lpc-bar"><span>'+e(label)+'</span><em>Not available</em></div>';
    const percentage=total>0?Math.max(0,Math.min(100,100*count/total)):0;
    return '<div class="lpc-bar"><span>'+e(label)+'</span><i><b class="lpc-'+color+'" style="width:'+percentage.toFixed(1)+'%"></b></i><strong>'+e(count)+'</strong></div>';
  }
  function dashboardHtml(s,dateLabel){
    const pending=s.proposedAgenda+s.proposedDecisions;
    const available=s.today!==null;
    const total=(s.today||0)+(s.upcoming||0)+(s.hold||0)+(s.review||0)+s.completed;
    const goals=s.goalItems.length?s.goalItems.map(g=>'<div class="lpc-item"><span>'+e(g.name)+'</span><small>'+e(g.status)+'</small></div>').join(''):'<p class="lpc-muted">No goals yet. Add your first goal to begin.</p>';
    const today=s.todaysTasks.length?s.todaysTasks.map(t=>'<div class="lpc-item"><span>'+e(t.name)+'</span><small>'+e(t.blocked?'Blocked':t.overdue?'Carryover':'Active')+'</small></div>').join(''):'<p class="lpc-muted">'+(available?'No active tasks for today.':'Open Agenda to inspect your task records.')+'</p>';
    return '<section class="lpc-dashboard" aria-label="Life Pilot Command Center">' +
      '<div class="lpc-intro"><div><span class="lpc-kicker">LIFE PILOT / COMMAND CENTER</span><h2>Mission Control</h2><p>See what matters. Direct what happens next.</p></div><div class="lpc-intro-right"><small>'+e(dateLabel)+'</small><button type="button" data-lpc-action="open">Open Cockpit</button></div></div>'+
      '<div class="lpc-stats">'+
      metricCard('Today’s actions',s.today===null?'—':s.today,available?'Active and carryover':'Agenda data unavailable','blue')+
      metricCard('Active goals',s.activeGoals,'Of '+s.goals+' saved goals','teal')+
      metricCard('Tasks completed',s.completed,s.completion===null?'No tasks recorded':s.completion+'% of all recorded tasks','violet')+
      metricCard('Owner approvals',pending,s.review===null?'Pending decisions and proposals':s.review+' task(s) also need review','amber')+
      '</div>'+
      '<div class="lpc-grid">'+
      '<article class="lpc-card"><div class="lpc-card-head"><h3>Agenda overview</h3><button class="lpc-link" data-lpc-action="agenda">Open Agenda</button></div><p class="lpc-muted">Actual counts from the local saved profile.</p>'+
      bar('Today',s.today,total,'blue')+bar('Upcoming',s.upcoming,total,'teal')+bar('HOLD',s.hold,total,'amber')+bar('Needs review',s.review,total,'violet')+bar('Completed',s.completed,total,'green')+'</article>'+
      '<article class="lpc-card"><div class="lpc-card-head"><h3>Today’s priorities</h3><button class="lpc-link" data-lpc-action="agenda">Manage</button></div>'+today+'</article>'+
      '<article class="lpc-card"><div class="lpc-card-head"><h3>Goals & projects</h3><button class="lpc-link" data-lpc-action="goals">Goal Stack</button></div>'+goals+'</article>'+
      '<article class="lpc-card"><div class="lpc-card-head"><h3>Decisions & approvals</h3><button class="lpc-link" data-lpc-action="decisions">Review</button></div>'+
      '<p class="lpc-approval">'+e(pending)+' <span>awaiting owner approval</span></p>'+
      '<div class="lpc-item"><span>Agenda proposals</span><strong>'+e(s.proposedAgenda)+'</strong></div>'+
      '<div class="lpc-item"><span>Proposed decisions</span><strong>'+e(s.proposedDecisions)+'</strong></div>'+
      '<p class="lpc-muted">No change is automatically approved.</p></article></div>'+
      '<div class="lpc-integrations"><div><b>AI staff</b><small>Not connected</small></div><div><b>Email & calendar</b><small>Not connected</small></div><div><b>Cross-device sync</b><small>Not available: export backups</small></div></div>'+
      '</section>';
  }
  const CSS=String.raw`body.lpc-dark{background:#101c2e;color:#e4edf7}
body.lpc-dark .panel,body.lpc-dark .lpc-card,body.lpc-dark .lpc-stat,body.lpc-dark .lpc-drawer{background:#1a2b42;color:#e4edf7;border-color:#41536a}
body.lpc-dark input,body.lpc-dark select,body.lpc-dark textarea{background:#23374f;color:#f1f5f9;border-color:#50647d}
body.lpc-dark .lpc-muted,body.lpc-dark .lpc-intro p,body.lpc-dark .lpc-stat small,body.lpc-dark .lpc-integrations small{color:#b5c5d8}
body.lpc-dark .lpc-item,body.lpc-dark .line{border-color:#41536a}
body.lpc-dark nav button,body.lpc-dark button.secondary{background:#2a4058;color:#eef3f9}
.lpc-dashboard{font-size:14px;margin-top:14px}
.lpc-intro{display:flex;justify-content:space-between;align-items:center;gap:16px;margin:20px 0}
.lpc-intro h2{font-size:32px;margin:5px 0;letter-spacing:-.6px}
.lpc-intro p{color:#758999;margin:0}
.lpc-kicker{font-size:10px;letter-spacing:2px;color:#137a9a;font-weight:800}
.lpc-intro-right{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.lpc-intro-right small{color:#718797}
.lpc-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:16px}
.lpc-stat{display:flex;flex-direction:column;background:#fff;padding:16px;border:1px solid #dce6ef;border-top:4px solid #347fd4;border-radius:14px;min-width:0}
.lpc-stat.lpc-teal{border-top-color:#17a28a}.lpc-stat.lpc-violet{border-top-color:#8e69c9}.lpc-stat.lpc-amber{border-top-color:#f4a23e}
.lpc-stat span{font-size:12px;font-weight:750;color:#567189}
.lpc-stat strong{font-size:30px}.lpc-stat small{font-size:11px;color:#7f91a1}
.lpc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}
.lpc-card{background:#fff;border:1px solid #dce6ef;border-radius:14px;padding:19px;min-width:0}
.lpc-card-head{display:flex;justify-content:space-between;align-items:center;gap:10px}
.lpc-card h3{margin:0;font-size:17px}.lpc-muted{color:#8093a1;font-size:12px;line-height:1.5}
button.lpc-link{background:none;color:#167baf;padding:5px;font-size:12px}
.lpc-bar{display:flex;align-items:center;gap:10px;margin:14px 0;font-size:12px}
.lpc-bar span{flex:0 0 90px}.lpc-bar i{height:9px;border-radius:8px;background:#e8eff5;overflow:hidden;flex:1}
.lpc-bar i b{display:block;height:100%;background:#347fd4;border-radius:8px}
.lpc-bar i b.lpc-teal{background:#17a28a}.lpc-bar i b.lpc-violet{background:#8e69c9}.lpc-bar i b.lpc-amber{background:#f4a23e}.lpc-bar i b.lpc-green{background:#49b277}
.lpc-bar strong{min-width:22px;text-align:right}
.lpc-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid #e9eef3}
.lpc-item span{overflow-wrap:anywhere}.lpc-item small{border-radius:20px;background:#e9f0f6;color:#536d83;padding:4px 8px}
.lpc-approval{font-size:32px;font-weight:800;margin:15px 0}.lpc-approval span{font-size:12px;font-weight:400;color:#7a8c9d}
.lpc-integrations{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:15px}
.lpc-integrations>div{border:1px dashed #b9c7d4;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:5px}
.lpc-integrations small{font-size:11px;color:#7c8d9c}
.lpc-launch{position:fixed;bottom:15px;right:15px;z-index:2100;box-shadow:0 5px 25px #09192942;border:2px solid white}
.lpc-shade{position:fixed;inset:0;background:#06132670;z-index:2101;display:none}
.lpc-drawer{position:fixed;right:0;top:0;bottom:0;width:min(390px,100vw);z-index:2102;background:#fff;border-left:1px solid #dce6ef;box-shadow:-9px 0 32px #10263b44;padding:23px;overflow-y:auto;display:none}
.lpc-drawer.lpc-open,.lpc-shade.lpc-open{display:block}
.lpc-drawer-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.lpc-drawer h2{font-size:23px;margin:0}.lpc-drawer section{padding:14px 0;border-top:1px solid #e7edf3}
.lpc-drawer section button{margin:4px 3px 4px 0}.lpc-drawer p{color:#758898;font-size:12px;line-height:1.5}
@media(max-width:850px){.lpc-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.lpc-grid{grid-template-columns:1fr}.lpc-integrations{grid-template-columns:1fr}.lpc-intro{align-items:flex-start;flex-direction:column}}
@media(max-width:450px){.lpc-stat{padding:11px}.lpc-stat strong{font-size:24px}.lpc-bar span{flex-basis:83px}.lpc-intro h2{font-size:25px}}`;
  function mount(root){
    if(root.__lifePilotCommandCenterMounted)return;
    if(typeof root.baseRender!=='function')return;
    // Legacy integration tests use a minimal document stub, not a browser DOM.
    // Do not try to mount visual controls without a real head/body host.
    if(!root.document.head || !root.document.body ||
       typeof root.document.head.appendChild!=='function' ||
       typeof root.document.body.append!=='function')return;
    root.__lifePilotCommandCenterMounted=true;
    const doc=root.document,style=doc.createElement('style');
    style.textContent=CSS;style.id='life-pilot-cockpit-style';doc.head.appendChild(style);
    try{doc.body.classList.toggle('lpc-dark',root.localStorage.getItem('lifepilot-ui-theme-v1')==='dark')}catch(_){}
    const oldBaseRender=root.baseRender;
    root.baseRender=function(){
      oldBaseRender.apply(this,arguments);
      // profile and tab are global lexical bindings from the v0.4 script, not window properties.
      const app=doc.getElementById('app'),nav=app?.querySelector('nav');
      if(profile&&nav&&tab==='dashboard'){
        while(nav.nextElementSibling)nav.nextElementSibling.remove();
        let view=null;
        try{view=root.LifePilotAgenda?.projection(profile)||null}catch(_){}
        const s=summarize(profile,view);
        const date=new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric'}).format(new Date());
        nav.insertAdjacentHTML('afterend',dashboardHtml(s,date));
      }
      updateDrawer();
    };
    const launch=doc.createElement('button');
    launch.type='button';launch.className='lpc-launch';
    launch.textContent='✦ Cockpit';launch.setAttribute('data-lpc-action','open');
    launch.setAttribute('aria-controls','lpc-drawer');launch.setAttribute('aria-expanded','false');
    const shade=doc.createElement('div');shade.className='lpc-shade';shade.setAttribute('data-lpc-action','close');
    const drawer=doc.createElement('aside');drawer.id='lpc-drawer';drawer.className='lpc-drawer';
    drawer.setAttribute('aria-label','Life Pilot owner cockpit');drawer.setAttribute('aria-hidden','true');
    doc.body.append(launch,shade,drawer);
    function updateDrawer(){
      if(!drawer.isConnected)return;
      let view=null;
      try{if(profile)view=root.LifePilotAgenda?.projection(profile)||null}catch(_){}
      const s=summarize(profile,view);
      drawer.innerHTML='<div class="lpc-drawer-head"><h2>✦ Command Cockpit</h2><button class="secondary" data-lpc-action="close">Close</button></div>'+
        '<p>Manual owner controls · No live AI integration</p>'+
        '<section><b>Navigate</b><p><button data-lpc-action="dashboard">Dashboard</button>'+
        '<button data-lpc-action="agenda">Today’s Agenda</button>'+
        '<button data-lpc-action="goals">Goal Stack</button>'+
        '<button data-lpc-action="execution">Execution</button></p></section>'+
        '<section><b>Review and act</b><p><button data-lpc-action="decisions">Decisions ('+s.proposedDecisions+')</button>'+
        '<button data-lpc-action="review-proposals">Agenda proposals ('+s.proposedAgenda+')</button>'+
        '<button data-lpc-action="new-task">Add a task</button></p>'+
        '<p>These buttons open existing screens and preserve the current save / approval rules.</p></section>'+
        '<section><b>Appearance</b><p><button class="secondary" data-lpc-action="theme">'+
        (doc.body.classList.contains('lpc-dark')?'Switch to Light Mode':'Switch to Dark Mode')+
        '</button></p></section>'+
        '<section><b>AI staff</b><p>Planned. No autonomous agents, cloud sync, or external messages run in this version.</p></section>';
    }
    function openDrawer(on){
      drawer.classList.toggle('lpc-open',on);shade.classList.toggle('lpc-open',on);
      drawer.setAttribute('aria-hidden',String(!on));launch.setAttribute('aria-expanded',String(on));
      if(on){updateDrawer();drawer.querySelector('button')?.focus()}else launch.focus();
    }
    doc.addEventListener('click',event=>{
      const el=event.target.closest('[data-lpc-action]');if(!el)return;
      const action=el.getAttribute('data-lpc-action');
      if(action==='open'){openDrawer(true);return}
      if(action==='close'){openDrawer(false);return}
      if(action==='theme'){
        doc.body.classList.toggle('lpc-dark');
        try{root.localStorage.setItem('lifepilot-ui-theme-v1',doc.body.classList.contains('lpc-dark')?'dark':'light')}catch(_){}
        updateDrawer();return;
      }
      const destination=action==='new-task'||action==='review-proposals'?'agenda':action;
      if(!['dashboard','agenda','goals','execution','decisions'].includes(destination)||!profile)return;
      openDrawer(false);
      showTab(destination);
      if(action==='new-task')doc.getElementById('agendaName')?.focus();
      if(action==='review-proposals')doc.getElementById('agendaWorkspace')?.scrollIntoView({block:'start'});
    });
    doc.addEventListener('keydown',event=>{if(event.key==='Escape'&&drawer.classList.contains('lpc-open'))openDrawer(false)});
    render(); // initial persistence render ran before this additive UI script
  }
  return {summarize,dashboardHtml,mount};
});