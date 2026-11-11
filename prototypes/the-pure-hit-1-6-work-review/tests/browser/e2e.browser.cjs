// Real-Chromium end-to-end check at Android phone size. Fictional data only.
// Run from this prototype directory: node tests/browser/e2e.browser.cjs
// Serves dist/ on a private localhost port; no network, no deployment.
'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,devices}=require('playwright');
const root=path.resolve(__dirname,'../../dist');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.json':'application/json'};
const server=http.createServer((q,s)=>{const f=path.join(root,decodeURIComponent(new URL(q.url,'http://x').pathname));if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);s.end();return}s.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s)});
const step=async(name,fn)=>{try{await fn();console.log('ok   '+name)}catch(e){console.log('FAIL '+name+': '+e.message);process.exitCode=1}};
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/index.html#workout';
 const browser=await chromium.launch();const ctx=await browser.newContext({...devices['Pixel 7'],acceptDownloads:true});
 await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
 const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
 const status=()=>p.textContent('#status');
 const station=async(i,n)=>{for(let k=0;k<n;k++)await p.click('#stationPlus'+i+'main');await p.click('#record')};
 const waitStatus=async(re,timeout=12000)=>p.waitForFunction(s=>new RegExp(s).test(document.getElementById('status').textContent),re.source,{timeout});
 const round=async n=>{for(let i=0;i<3;i++){await waitStatus(/round|Conditioning|Maximum/i);await p.waitForFunction(i=>!document.getElementById('stationValue'+i+'main').disabled,i,{timeout:12000});await station(i,n)}};
 await p.goto(url);
 await step('workout ready screen shows Start Workout',async()=>{assert(await p.isVisible('#start'))});
 await step('start without HRM requires an explicit choice',async()=>{await p.click('#start');assert(await p.isVisible('#hrGateProceed'));await p.click('#hrGateProceed');await waitStatus(/Maximum-effort round/)});
 await step('round 1 reps save and move to recovery',async()=>{await round(3);await waitStatus(/Recovering|wait for/);assert.equal(await p.isDisabled('#recover'),true)});
 await step('timed recovery adjusts, excludes pause, then waits for tap',async()=>{await p.click('#timedRecoveryStart');for(let i=0;i<6;i++)await p.click('#timedMinus');assert.match(await p.textContent('#timedRecoveryRemaining'),/of 0:30/);await p.click('#pause');await p.waitForTimeout(2000);await p.click('#resume');await p.waitForTimeout(1500);assert.match(await status(),/Timed recovery · 0:\d\d left/);await waitStatus(/READY/,45000);assert.equal(await p.isDisabled('#recover'),false);assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('the-pure-hit-field-test-v2')).active.round),0)});
 await step('reload mid-conditioning restores the same round and reps',async()=>{await p.click('#recover');await round(2);await p.waitForTimeout(300);const before=await p.evaluate(()=>JSON.parse(localStorage.getItem('the-pure-hit-field-test-v2')).active);await p.reload();await p.waitForTimeout(500);const after=await p.evaluate(()=>JSON.parse(localStorage.getItem('the-pure-hit-field-test-v2')).active);assert.equal(after.paused,true);assert.equal(after.round,before.round);assert.deepEqual(after.records.map(r=>r.reps),before.records.map(r=>r.reps));assert.equal(after.recoveries[0].basis,'timed-no-hrm');assert.equal(after.hr.length,0)});
 await step('finish and save stores one complete calibration workout',async()=>{await p.click('#resume');if(await p.isVisible('#saveNow'))await p.click('#saveNow');else await p.click('#finishCooldown');await p.waitForFunction(()=>!JSON.parse(localStorage.getItem('the-pure-hit-field-test-v2')).active,null,{timeout:8000});const db=await p.evaluate(()=>JSON.parse(localStorage.getItem('the-pure-hit-field-test-v2')));assert.equal(db.history.length,1);assert.equal(db.history[0].records.length,6);assert.equal(db.history[0].calibrationNumber,1)});
 await step('Save backup downloads history',async()=>{await p.goto(url.replace('#workout','#backup'));const [d]=await Promise.all([p.waitForEvent('download'),p.click('#exportAll')]);const b=JSON.parse(fs.readFileSync(await d.path(),'utf8'));assert.equal(b.schema,'the-pure-backup-v2');assert.equal(b.history.length,1)});
 await step('phone V2 export imports only after review and keeps HIT history unchanged',async()=>{const exp={app:'The Pure — approved phone test V2',version:2,phase:'ready',history:[{startedAt:Date.parse('2026-10-28T15:00:00Z'),finishedAt:Date.parse('2026-10-28T15:20:00Z'),outcome:'complete',counts:[{push:20,legs:30,pull:12},{push:15,legs:22,pull:9},{}]}]};await p.setInputFiles('#importFile',{name:'fictional-phone-v2.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exp))});await p.waitForSelector('#importReview:not(.hidden)');assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('the-pure-hit-field-test-v2')).legacyHistory),undefined);await p.click('#mergeImport');const db=await p.evaluate(()=>JSON.parse(localStorage.getItem('the-pure-hit-field-test-v2')));assert.equal(db.legacyHistory.length,1);assert.equal(db.history.length,1)});
 await step('after 3 calibration workouts, a Round 2 miss runs one finisher, recorded separately',async()=>{const c2=await browser.newContext({...devices['Pixel 7']});await c2.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());const q=await c2.newPage();q.on('pageerror',e=>errors.push(e.message));q.on('dialog',d=>d.accept());
  const cal=i=>({schema:'the-pure-hit-v2',id:'fictional-cal-'+i,started:'2026-11-0'+(i+1)+'T15:00:00.000Z',ended:'2026-11-0'+(i+1)+'T15:20:00.000Z',status:'complete',records:[],calibration:true,calibrationNumber:i+1});
  await q.addInitScript(h=>{if(!localStorage.getItem('the-pure-hit-field-test-v2'))localStorage.setItem('the-pure-hit-field-test-v2',JSON.stringify({schema:'the-pure-store-v2',revision:1,active:null,history:h}))},[0,1,2].map(cal));
  await q.goto(url);const st=re=>q.waitForFunction(s=>new RegExp(s).test(document.getElementById('status').textContent),re.source,{timeout:45000});
  const enter=async(i,n)=>{await q.waitForFunction(i=>!document.getElementById('stationValue'+i+'main').disabled,i,{timeout:12000});for(let k=0;k<n;k++)await q.click('#stationPlus'+i+'main');await q.click('#record')};
  await q.click('#start');await q.click('#hrGateProceed');await st(/Maximum-effort round/);for(const [i,n] of [[0,10],[1,10],[2,4]])await enter(i,n);
  await q.click('#timedRecoveryStart');for(let i=0;i<6;i++)await q.click('#timedMinus');await st(/READY/);await q.click('#recover');
  assert.match(await q.textContent('#stationPrevious0'),/Max 10 · Floor 7/);assert.match(await q.textContent('#stationPrevious2'),/Max 4 · Floor 3/);
  for(const [i,n] of [[0,6],[1,7],[2,3]])await enter(i,n);await st(/Finisher — Push-ups/);await enter(0,5);
  await q.waitForFunction(()=>JSON.parse(localStorage.getItem('the-pure-hit-field-test-v2')).active?.finalRecovery===true,null,{timeout:8000});
  const a=await q.evaluate(()=>JSON.parse(localStorage.getItem('the-pure-hit-field-test-v2')).active);assert.deepEqual(a.records.map(r=>r.reps),[10,10,4,6,7,3]);assert.deepEqual(a.finishers.map(f=>[f.exercise,f.reps,f.floor]),[['Push',5,7]]);await c2.close()});
 await step('no page errors',async()=>{assert.deepEqual(errors,[])});
 await browser.close();server.close();
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
