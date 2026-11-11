// Before/after evidence: same fictional steps on the recovered approved build and on PR #113.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const [beforeDir,afterDir,out]=process.argv.slice(2);
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const serve=root=>new Promise(r=>{const s=http.createServer((q,res)=>{let f=path.join(root,decodeURIComponent(new URL(q.url,'http://x').pathname));if(f.endsWith('/'))f+='index.html';if(!fs.existsSync(f)){res.writeHead(404);res.end();return}res.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res)});s.listen(0,'127.0.0.1',()=>r(s))});
const KEY='the-pure-hit-field-test-v2';
const cal=i=>({schema:'the-pure-hit-v2',id:'fictional-cal-'+i,started:'2026-11-0'+(i+1)+'T15:00:00.000Z',ended:'2026-11-0'+(i+1)+'T15:20:00.000Z',status:'complete',records:[['Push','Push-ups','Standard',20],['Squat','Jump Squats','Bodyweight',30],['Pull','Inverted rows','',10]].map(([exercise,exerciseName,variation,reps])=>({round:'maximum',exercise,exerciseName,variation,reps}))});
const seed=JSON.stringify({schema:'the-pure-store-v2',revision:1,active:null,history:[0,1,2].map(cal)});
(async()=>{const b=await chromium.launch();
 for(const [label,dir] of [['before',beforeDir],['after',afterDir]]){const srv=await serve(dir);const base='http://127.0.0.1:'+srv.address().port+'/';
  for(const [w,h] of [[360,780],[384,832],[412,915]]){
   for(const seeded of [false,true]){
   const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:2,isMobile:true,hasTouch:true});await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
   const p=await ctx.newPage();await p.clock.install();p.on('dialog',d=>d.accept());
   if(seeded)await p.addInitScript(([k,v])=>{if(!localStorage.getItem(k))localStorage.setItem(k,v)},[KEY,seed]);
   await p.goto(base+'#workout');await p.waitForTimeout(400);
   const shot=async name=>{await p.evaluate(()=>scrollTo(0,0));await p.waitForTimeout(150);await p.screenshot({path:path.join(out,`${name}-${w}x${h}-${label}.png`)})};
   const enter=async(i,n)=>{await p.waitForFunction(i=>!document.getElementById('stationValue'+i+'main').disabled,i,{timeout:12000});for(let k=0;k<n;k++)await p.click('#stationPlus'+i+'main');await p.click('#record');await p.clock.runFor(5200)};
   if(!seeded)await shot('1-workout-ready');
   await p.click(await p.isVisible('#start')?'#start':'#newWorkout');await p.click('#hrGateProceed');await p.clock.runFor(5200);
   await enter(0,18);if(!seeded)await shot('2-round1-active');
   await enter(1,24);await enter(2,9);await p.clock.runFor(30000);if(!seeded)await shot('3-recovery-no-hrm-timer');
   await p.clock.runFor(91000);await p.waitForFunction(()=>!document.getElementById('recover').disabled,null,{timeout:5000});await p.click('#recover');await p.clock.runFor(5200);
   await shot(seeded?'5-round2-post-calibration-floor':'4-round2-calibration');
   if(seeded){await enter(0,13);await enter(1,22);await enter(2,7);await shot('6-round2-done-floor-met-missed')}
   await ctx.close();}
  }
  srv.close()}
 await b.close()})().catch(e=>{console.error(e);process.exit(1)});
