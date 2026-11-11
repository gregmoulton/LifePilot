// Real-Chromium end-to-end check of the owner-approved Android UI at Samsung phone size. Fictional data only.
// Run from this prototype directory: node tests/browser/e2e.browser.cjs
// Serves dist/ on a private localhost port; external network is blocked; no deployment.
'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,devices}=require('playwright');
const root=path.resolve(__dirname,'../../dist');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json'};
const server=http.createServer((q,s)=>{let f=path.join(root,decodeURIComponent(new URL(q.url,'http://x').pathname));if(f.endsWith(path.sep))f=path.join(f,'index.html');if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);s.end();return}s.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s)});
const KEY='the-pure-hit-field-test-v2';
const step=async(name,fn)=>{try{await fn();console.log('ok   '+name)}catch(e){console.log('FAIL '+name+': '+e.message.slice(0,1200));process.exitCode=1}};
const shotDir=process.env.PURE_SCREENSHOTS||null;
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port+'/';
 const browser=await browser_();async function browser_(){return chromium.launch()}
 const errors=[];
 async function page(seed){
  const ctx=await browser.newContext({...devices['Galaxy S9+'],acceptDownloads:true});
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
  const p=await ctx.newPage();await p.clock.install();
  // The offline voice model download is blocked here on purpose; its worker error is expected.
  p.on('pageerror',e=>{if(!/voice-music-vosk/.test(e.stack||''))errors.push(e.message)});p.on('dialog',d=>d.accept());
  if(seed)await p.addInitScript(([k,v])=>{if(!localStorage.getItem(k))localStorage.setItem(k,v)},[KEY,JSON.stringify(seed)]);
  await p.goto(base+'#workout');await p.waitForTimeout(300);return {ctx,p};
 }
 const db=p=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY);
 const status=(p,re)=>p.waitForFunction(s=>new RegExp(s).test(document.getElementById('status').textContent),re.source,{timeout:12000});
 const enter=async(p,i,n)=>{await p.waitForFunction(i=>!document.getElementById('stationValue'+i+'main').disabled,i,{timeout:12000});for(let k=0;k<n;k++)await p.click('#stationPlus'+i+'main');await p.click('#record');await p.clock.runFor(5200)};
 const start=async p=>{await p.click(await p.isVisible('#start')?'#start':'#newWorkout');await p.click('#hrGateProceed');await p.clock.runFor(5200);await status(p,/Maximum-effort round/)};

 let {ctx,p}=await page();
 await step('opens on the approved WORKOUT READY screen (HIT 1.6 · TWO ROUNDS) with Start Workout',async()=>{const t=await p.innerText('body');assert.match(t,/WORKOUT READY/i);assert.match(t,/TWO ROUNDS/i);assert(await p.isVisible('#start'));if(shotDir)await p.screenshot({path:shotDir+'/ready.png'})});
 await step('start without a monitor needs an explicit choice',async()=>{await start(p)});
 await step('Round 1 reps save and recovery waits for the approved 120-second no-HRM fallback',async()=>{for(const [i,n] of [[0,10],[1,10],[2,4]])await enter(p,i,n);assert.equal(await p.isDisabled('#recover'),true);await p.clock.runFor(121000);await p.waitForFunction(()=>!document.getElementById('recover').disabled,null,{timeout:5000});const a=(await db(p)).active;assert.equal(a.round,0,'conditioning does not start by itself')});
 await step('reload mid-conditioning restores the same round and reps',async()=>{await p.click('#recover');await p.clock.runFor(5200);await enter(p,0,6);const before=(await db(p)).active;await p.reload();await p.waitForTimeout(300);const after=(await db(p)).active;assert.equal(after.paused,true);assert.equal(after.round,1);assert.deepEqual(after.records.map(r=>r.reps),before.records.map(r=>r.reps));assert.equal(after.recoveries[0].qualification,'120-second-no-hrm-fallback');assert.equal(after.hr.length,0)});
 await step('End saves the workout as calibration 1 and Finish cooldown finalizes it once',async()=>{await p.click('#resume');await p.clock.runFor(5200);await enter(p,1,7);await enter(p,2,3);await p.click('#end');let d=await db(p);assert.equal(d.history.length,1);assert.equal(d.history[0].status,'complete');assert.equal(d.history[0].calibrationNumber,1);await p.click('#finishCooldown');d=await db(p);assert.equal(d.active,null);assert.equal(d.history.length,1)});
 await step('Save backup downloads history',async()=>{await p.goto(base+'#backup');const [dl]=await Promise.all([p.waitForEvent('download'),p.click('#exportAll')]);const b=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));assert.equal(b.schema,'the-pure-backup-v2');assert.equal(b.history.length,1)});
 await step('phone V2 export imports only after review and keeps HIT history unchanged',async()=>{const exp={app:'The Pure — approved phone test V2',version:2,phase:'ready',history:[{startedAt:Date.parse('2026-10-28T15:00:00Z'),finishedAt:Date.parse('2026-10-28T15:20:00Z'),outcome:'complete',counts:[{push:20,legs:30,pull:12},{push:15,legs:22,pull:9},{}]}]};await p.setInputFiles('#importFile',{name:'fictional-phone-v2.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exp))});await p.waitForSelector('#importReview:not(.hidden)');assert.equal((await db(p)).legacyHistory,undefined);await p.click('#mergeImport');const d=await db(p);assert.equal(d.legacyHistory.length,1);assert.equal(d.history.length,1)});
 await ctx.close();

 await step('after 3 calibration workouts, Round 2 shows the historical maximum and floor; a miss changes nothing else',async()=>{const cal=i=>({schema:'the-pure-hit-v2',id:'fictional-cal-'+i,started:'2026-11-0'+(i+1)+'T15:00:00.000Z',ended:'2026-11-0'+(i+1)+'T15:20:00.000Z',status:'complete',records:[['Push','Push-ups','Standard',10-i],['Squat','Jump Squats','Bodyweight',8],['Pull','Inverted rows','',4]].map(([exercise,exerciseName,variation,reps])=>({round:'maximum',exercise,exerciseName,variation,reps}))});
  ({ctx,p}=await page({schema:'the-pure-store-v2',revision:1,active:null,history:[0,1,2].map(cal)}));await start(p);for(const [i,n] of [[0,7],[1,10],[2,4]])await enter(p,i,n);await p.clock.runFor(121000);await p.waitForFunction(()=>!document.getElementById('recover').disabled,null,{timeout:5000});await p.click('#recover');await p.clock.runFor(5200);
  await p.waitForFunction(()=>/Max\s10 · Floor\s7/.test(document.getElementById('stationPrevious0').textContent),null,{timeout:5000});assert.match(await p.textContent('#stationPrevious1'),/Max\s10\s\(new\) · Floor\s7/);assert.match(await p.textContent('#stationPrevious2'),/Max\s4 · Floor\s3/);if(shotDir)await p.screenshot({path:shotDir+'/round2-floor.png'});
  for(const [i,n] of [[0,6],[1,7],[2,3]])await enter(p,i,n);const a=(await db(p)).active;assert.deepEqual(a.records.map(r=>r.reps),[7,10,4,6,7,3]);assert.deepEqual(a.records.slice(3).map(r=>r.metFloor),[false,true,true]);assert.equal(a.awaitingFinish,true);assert.equal(a.finishers,undefined);await ctx.close()});

 for(const [w,h] of [[360,780],[384,832],[412,915],[360,648],[412,648]])await step('Workout Ready at '+w+'x'+h+': all 3 exercises and Start fit above the tab bar with 44px touch targets',async()=>{const c=await browser.newContext({viewport:{width:w,height:h},isMobile:true,hasTouch:true,deviceScaleFactor:3});await c.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());const q=await c.newPage();await q.goto(base+'#workout');await q.waitForTimeout(300);const m=await q.evaluate(()=>{const b=id=>document.getElementById(id).getBoundingClientRect();return {tabs:b('phoneTabs').top,start:b('start'),rows:[0,1,2].map(i=>b('station'+i)),buttons:[...document.querySelectorAll('#stationRows button:not(.hidden),#connectHr,#start')].filter(e=>e.offsetParent).map(e=>e.getBoundingClientRect().height),scroll:document.documentElement.scrollWidth}});assert(m.start.bottom<=m.tabs,'Start bottom '+m.start.bottom+' > tab bar '+m.tabs);for(const r of m.rows)assert(r.top>=0&&r.bottom<=m.tabs);assert(Math.min(...m.buttons)>=44,'touch target below 44px');assert.equal(m.scroll,w,'no horizontal scroll');if(shotDir&&w===360)await q.screenshot({path:shotDir+'/ready-360.png'});await c.close()});
 await step('Chrome reports the app installable with the same id "/" and the PURE icons',async()=>{const c=await browser.newContext({...devices['Galaxy S9+']});await c.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());const q=await c.newPage();await q.goto(base+'#workout');await q.evaluate(()=>navigator.serviceWorker.ready);const cdp=await c.newCDPSession(q);const {installabilityErrors}=await cdp.send('Page.getInstallabilityErrors');assert.deepEqual(installabilityErrors,[]);const m=await cdp.send('Page.getAppManifest');assert.deepEqual(m.errors,[]);const man=JSON.parse(m.data);assert.equal(man.id,'/');assert.equal(new URL(man.icons.find(i=>i.purpose==='maskable'&&i.sizes==='512x512').src,m.url).pathname,'/icons/pure-v1-maskable-512.png');await c.close()});
 await step('no page errors',async()=>{assert.deepEqual(errors,[])});
 await browser.close();server.close();
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
