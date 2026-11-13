const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{webcrypto}=require('node:crypto');
const code=fs.readFileSync('dist/app.js','utf8'),original=fs.readFileSync('tests/fixtures/original.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
function runtime({data=new Map(),source=code,fail=false,devices=false,journal=false,bluetooth,autoCountdown=true,autoHrGate=true,splitDefault=false,release=false}={}){
 const nodes=new Map(),spoken=[],tones=[],downloads=[],events={},docEvents={};let t=Date.parse('2026-10-21T20:00:00Z'),failed=fail,confirmation=true,writeFault='normal';const intervals=[],timeouts=new Map();let nextTimeout=0;
 const html=fs.readFileSync(source===code?'dist/index.html':'tests/fixtures/original.html','utf8');
 const node=id=>{if(!id.startsWith('download')&&!html.includes('id="'+id+'"'))throw Error('Missing real DOM element: '+id);if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',disabled:false,classList:{toggle(name,on){this[name]=on},add(name){this[name]=true},remove(name){this[name]=false},contains(name){return !!this[name]}},addEventListener(n,f){this[n]=f},remove(){},click(){if(this.download)downloads.push(this.href);else if(!this.disabled)this.onclick?.()}});return nodes.get(id)};
 const document={hidden:false,getElementById:node,createElement:()=>node('download'+downloads.length),body:{dataset:{defaultSquat:release?'jump':splitDefault?'split':''},append(){}},addEventListener:(n,f)=>{(docEvents[n]??=[]).push(f)}};
 const store={getItem:k=>data.get(k)??null,setItem:(k,v)=>{if(failed)throw Error('simulated quota');if(writeFault==='drop')return;if(writeFault==='corrupt'){data.set(k,'simulated unexpected storage bytes');return}data.set(k,v)},removeItem:k=>data.delete(k)};
 let blobs=new Map(),id=0,recognition;const recognitionResults=new WeakMap();
 class Recognition{constructor(){recognition=this}start(){this.onstart?.()}abort(){this.onend?.()}}
 class AudioContext{
  state='running';currentTime=0;
  createOscillator(){return {frequency:{},connect(){},start(){tones.push(this.frequency.value)},stop(){}}}
  createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}}
 }
 const context=vm.createContext({AudioContext,speechSynthesis:{cancel(){},speak(p){spoken.push(p.text)}},SpeechSynthesisUtterance:class{constructor(text){this.text=text}},DataView,Date:class extends Date{constructor(...a){super(...(a.length?a:[t]))}static now(){return t}},document,navigator:{bluetooth},SpeechRecognition:Recognition,localStorage:store,crypto:{getRandomValues:webcrypto.getRandomValues.bind(webcrypto)},Blob,URL:{createObjectURL:b=>{const key='blob:'+id++;blobs.set(key,b);return key},revokeObjectURL(){}},setInterval(f){intervals.push(f)},setTimeout(f,ms){const k=++nextTimeout;timeouts.set(k,{f,at:t+ms});return k},clearTimeout(k){timeouts.delete(k)},addEventListener:(n,f)=>events[n]=f,alert(){},confirm:()=>confirmation});
 if(journal)vm.runInContext(fs.readFileSync('dist/journal.js','utf8'),context);
 if(devices)vm.runInContext(fs.readFileSync('dist/devices.js','utf8'),context);
 vm.runInContext(source===code?source.replace('\n render();\n}', '\n globalThis.__readForTest=expression=>eval(expression);\n render();\n}'):source,context);
 return {voiceEnd(){recognition.onend()},voiceError(error){recognition.onerror({error});recognition.onend()},hidden(v){document.hidden=v;docEvents.visibilitychange?.forEach(handler=>handler())},data,node,context,spoken,tones,downloads,blobs,events,docEvents,writeFault:mode=>{writeFault=mode},hears(text){assert(recognition,'Microphone was not started');assert(this.read('voiceActive'),'Microphone stopped');const results=recognitionResults.get(recognition)||[];results.push(Object.assign([{transcript:text}],{isFinal:true}));recognitionResults.set(recognition,results);recognition.onresult({resultIndex:results.length-1,results})},speech(text){this.click('talk');recognition.onresult({resultIndex:0,results:[Object.assign([{transcript:text}],{isFinal:true})]});recognition.onend();if(autoCountdown&&source===code&&this.read('!!db.active?.countdownUntil')){t+=5000;intervals.forEach(f=>f())}},time(ms){t+=ms},fail(v){failed=v},confirm(v){confirmation=v},tick(){for(const [k,x] of timeouts)if(x.at<=t){timeouts.delete(k);x.f()}intervals.forEach(f=>f())},click(id){node(id).onclick();if(id==='start'&&autoHrGate&&source===code&&!this.read('!!db.active'))node('hrGateProceed').onclick();if(autoCountdown&&source===code&&this.read('!!db.active?.countdownUntil')){t+=5000;intervals.forEach(f=>f())}},input(id,v){node(id).value=v;node(id).input?.()},read(expression){return JSON.parse(vm.runInContext('JSON.stringify(__readForTest('+JSON.stringify(expression)+'))',context))}};
}
test('baseline crash checkpoint reproduces stale step; fixed checkpoint restores next step',()=>{let r=runtime({source:original});r.click('start');r.input('reps','12');r.click('record');let saved=JSON.parse(r.data.get('the-pure-hit-field-test-v1-active'));assert.equal(saved.ex,0);assert.equal(saved.records.length,1);r=runtime();r.click('start');r.input('reps','12');r.click('record');const restarted=runtime({data:r.data});assert.equal(restarted.node('status').textContent,'PAUSED — timer stopped');assert.equal(restarted.node('exercise').textContent,'Exercise: Squat')});
test('actual UI persists unsubmitted reps and HR draft on every input',()=>{let r=runtime();r.click('start');r.input('reps','14');let restart=runtime({data:r.data});assert.equal(restart.node('reps').value,'14');restart.click('resume');restart.click('record');for(const n of ['20','11']){restart.input('reps',n);restart.click('record')}restart.input('hr','108');r=runtime({data:restart.data});assert.equal(r.node('hr').value,'108');assert.equal(r.node('status').textContent,'PAUSED — timer stopped')});
test('actual UI complete save/export schema contains all six records and HR',async()=>{const r=runtime();r.click('start');for(const n of ['12','20','10']){r.input('reps',n);r.time(1000);r.click('record')}r.input('hr','106');r.click('loghr');r.click('recover');for(const n of ['8','15','7']){r.input('reps',n);r.time(1000);r.click('record')}assert.equal(r.read('db.active.finalRecovery'),true);r.input('hr','110');r.click('loghr');assert.equal(r.read('db.history.length'),1);assert.equal(r.read('db.active'),null);r.click('export');const result=JSON.parse(await r.blobs.get(r.downloads[0]).text());assert.equal(result.status,'complete');assert.equal(result.records.length,6);assert.equal(result.transitions.length,4);assert.equal(result.cooldownDurationSeconds,0);assert(result.workoutEndedAt);assert.equal(result.heartRateReadings[0].bpm,106);const restarted=runtime({data:r.data});assert.equal(restarted.read('db.history.length'),1);assert.equal(restarted.read('db.active'),null)});
test('actual UI pause/resume records separate events; cancel override makes no change',()=>{const r=runtime();r.click('start');for(let i=0;i<3;i++){r.input('reps','10');r.click('record')}r.time(5000);r.click('pause');r.time(50000);r.click('resume');r.node('overrideReason').value='monitor-error';r.confirm(false);r.click('overrideRecovery');assert.equal(r.read('db.active.phase'),'recovery');assert.equal(r.read('db.active.recoveries.length'),0);r.confirm(true);r.time(5000);r.click('overrideRecovery');assert.equal(r.read('db.active.recoveries[0].durationSeconds'),10);assert.equal(r.read('db.active.recoveries[0].manualOverride'),true);assert.equal(r.read('db.active.records.length'),3)});
test('actual UI failure on final archive retains all reps in memory and durable previous checkpoint; retry atomic',()=>{const r=runtime();r.click('start');for(let i=0;i<3;i++){r.input('reps','10');r.click('record')}r.input('hr','110');r.click('loghr');r.click('recover');for(let i=0;i<2;i++){r.input('reps','5');r.click('record')}r.input('reps','7');r.click('record');r.input('hr','110');const before=r.data.get('the-pure-hit-field-test-v2');r.fail(true);r.click('loghr');assert.equal(r.read('dirty'),true);assert.equal(r.read('db.history[0].records.length'),6);assert.equal(r.data.get('the-pure-hit-field-test-v2'),before);assert.match(r.node('notice').textContent,/failed/);r.fail(false);r.click('retry');const restart=runtime({data:r.data});assert.equal(restart.read('db.history.length'),1);assert.equal(restart.read('db.active'),null);assert.equal(restart.read('db.history[0].records.length'),6)});
test('actual UI discard does not archive/export; partial archive preserves prior history',()=>{const r=runtime();r.click('start');r.input('reps','5');r.click('record');r.click('end');r.input('hr','110');r.click('loghr');assert.equal(r.read('db.history[0].status'),'partial');r.click('start');r.input('reps','9');r.click('record');r.confirm(false);r.click('discard');assert(r.read('db.active'));r.confirm(true);r.click('discard');assert.equal(r.read('db.active'),null);assert.equal(r.read('db.history.length'),1);assert.equal(r.downloads.length,0);const restart=runtime({data:r.data});assert.equal(restart.read('db.active'),null);assert.equal(restart.read('db.history.length'),1)});
test('actual UI hidden-page interruption pauses and reload does not inflate durations',()=>{const r=runtime();r.click('start');r.time(5000);r.events.pagehide();r.time(60000);const restarted=runtime({data:r.data});assert.equal(restarted.read('db.active.activeMs'),5000);assert.equal(restarted.read('db.active.paused'),true)});
test('actual UI malformed storage cannot be overwritten by Start; raw backup remains available',()=>{const data=new Map([['the-pure-hit-field-test-v2','corrupt-test-fixture']]),r=runtime({data});r.click('start');assert.equal(data.get('the-pure-hit-field-test-v2'),'corrupt-test-fixture');assert.equal(r.node('start').disabled,true);r.click('exportRaw');assert.equal(r.downloads.length,1)});
test('actual UI stale second tab cannot overwrite more recent session',()=>{const data=new Map(),a=runtime({data}),b=runtime({data});a.click('start');const good=data.get('the-pure-hit-field-test-v2');b.click('start');assert.equal(data.get('the-pure-hit-field-test-v2'),good);assert.equal(b.read('blocked'),true);assert.match(b.node('notice').textContent,/another tab/)});

test("actual UI starts without secure-context randomUUID API",()=>{const r=runtime();r.click("start");assert.equal(r.node("status").textContent,"Maximum-effort round");assert.equal(r.read("db.active.id.length"),32)});

test('clear voice reps save once, populate the row and support explicit correction',()=>{const r=runtime({devices:true});r.click('start');r.speech('twelve reps');assert.equal(r.read('db.active.records[0].reps'),12);assert.equal(r.node('stationValue0main').value,'12');r.click('voiceApply');assert.equal(r.read('db.active.records.length'),1);r.speech('correction ten reps');assert.equal(r.read('db.active.records[0].reps'),10);assert.equal(r.node('stationValue0main').value,'10');assert.equal(r.read('db.active.events.at(-1).event'),'rep-correction')});
test('consequential voice commands retain confirm/cancel while clear reps need no confirm',()=>{const r=runtime({devices:true});r.click('start');r.speech('ten reps');assert.equal(r.read('db.active.records.length'),1);r.speech('pause workout');r.speech('cancel');assert.equal(r.read('db.active.paused'),false);r.speech('pause workout');r.speech('confirm');assert.equal(r.read('db.active.paused'),true)});
test('integrated Bluetooth records recovery readings with source, throttles updates, leaves recovery under user control',async()=>{let packet,disconnect;
const characteristic={addEventListener(n,f){packet=f},removeEventListener(){},async startNotifications(){}},device={addEventListener(n,f){disconnect=f},removeEventListener(){},gatt:{connected:true,disconnect(){},async connect(){return {async getPrimaryService(){return {async getCharacteristic(){return characteristic}}}}}}};
const r=runtime({devices:true,bluetooth:{async requestDevice(){return device}}});r.click('start');for(let i=0;i<3;i++){r.input('reps','10');r.click('record')};await r.node('connectHr').onclick();const reading=n=>packet({target:{value:new DataView(Uint8Array.from([0,n]).buffer)}});reading(108);assert.equal(r.read('db.active.hr.length'),1);assert.equal(r.read('db.active.hr[0].source'),'bluetooth');reading(107);assert.equal(r.read('db.active.hr.length'),1);assert.equal(r.read('db.active.phase'),'recovery');r.time(5001);reading(106);assert.equal(r.read('db.active.hr.length'),2);disconnect();assert.match(r.node('monitorStatus').textContent,/disconnected/);r.input('hr','105');r.click('loghr');assert.equal(r.read('db.active.hr.at(-1).bpm'),105);r.click('recover');assert.equal(r.read('db.active.phase'),'exercise')});

test('journal UI saves weight and baseline tests, survives reload, and exports them with workout history',async()=>{const r=runtime({journal:true});r.node('weightValue').value='180';r.node('weightUnit').value='lb';r.node('weightFat').value='20';r.node('weightDate').value='2026-10-22T08:00';r.click('saveWeight');assert.equal(r.read('db.measurements.length'),1);assert.match(r.node('weightMessage').textContent,/saved/);r.node('testKind').value='one-mile-run';r.node('testStage').value='baseline';r.node('testDate').value='2026-10-22T08:00';r.node('testValue').value='9:35';r.click('saveTest');assert.equal(r.read('db.assessments[0].timeSeconds'),575);const restart=runtime({journal:true,data:r.data});assert.equal(restart.read('db.measurements.length'),1);assert.equal(restart.read('db.assessments.length'),1);restart.click('exportAll');const out=JSON.parse(await restart.blobs.get(restart.downloads[0]).text());assert.equal(out.measurements.length,1);assert.equal(out.assessments.length,1)});
test('journal UI imports only after review and keeps active workout unchanged',async()=>{const r=runtime({journal:true});r.click('start');const id=r.read('db.active.id');const backup={schema:'the-pure-backup-v2',history:[],measurements:[{id:'weight-import',timestamp:'2026-10-22T08:00:00Z',weightKg:80,weight:80,unit:'kg',device:'fictional scale',bodyFatPercent:null}],assessments:[]};r.node('importFile').files=[{size:1000,async text(){return JSON.stringify(backup)}}];await r.node('importFile').change();assert.equal(r.read('db.measurements||null'),null);r.click('mergeImport');assert.equal(r.read('db.measurements.length'),1);assert.equal(r.read('db.active.id'),id)});

test('leaving workout navigation stops voice and cancels a pending command',()=>{const r=runtime({devices:true});r.click('start');r.speech('pause workout');r.events.hashchange();r.click('voiceApply');assert.equal(r.read('db.active.records.length'),0)});

test('partial history distinguishes explicit zero from an unrecorded exercise',()=>{const r=runtime({journal:true});r.click('start');r.input('reps','0');r.click('record');r.click('end');r.input('hr','110');r.click('loghr');const cards=r.node('historyCards').innerHTML;assert.match(cards,/Push[\s\S]*0 reps/);assert.match(cards,/Squat[\s\S]*— unrecorded/);assert.match(cards,/Inverted rows[\s\S]*— unrecorded/)});

 test('five-second countdown blocks reps, survives interruption safely, and excludes preparation time',()=>{const r=runtime({autoCountdown:false});r.click('start');assert.match(r.node('status').textContent,/Starting in 5/);r.input('reps','10');r.click('record');assert.equal(r.read('db.active.records.length'),0);r.time(4999);r.tick();assert.equal(r.read('!!db.active.countdownUntil'),true);r.time(1);r.tick();assert.equal(r.read('db.active.paused'),false);assert.equal(r.read('db.active.activeMs'),0);r.time(3000);r.click('pause');r.time(60000);r.click('resume');assert.equal(r.read('db.active.activeMs'),3000);const restarted=runtime({data:r.data,autoCountdown:false});assert.equal(restarted.read('db.active.paused'),true);assert.equal(restarted.read('db.active.activeMs'),3000)});
 test('final recovery survives restart, cannot advance with missing or stale HR, then saves both recoveries once',()=>{let r=runtime();r.click('start');for(let i=0;i<3;i++){r.input('reps','10');r.click('record')}r.click('recover');assert.equal(r.read('db.active.round'),0);r.input('hr','110');r.click('loghr');r.time(16000);r.click('recover');assert.equal(r.read('db.active.round'),0);r.input('hr','109');r.click('loghr');r.click('recover');for(let i=0;i<3;i++){r.input('reps','7');r.click('record')}assert.equal(r.read('db.history.length'),0);r=runtime({data:r.data});assert.equal(r.read('db.active.records.length'),6);assert.equal(r.read('db.active.paused'),true);r.click('resume');r.input('hr','125');r.click('loghr');assert.equal(r.read('db.history.length'),0);r.time(30000);r.input('hr','110');r.click('loghr');assert.equal(r.read('db.history.length'),1);assert.equal(r.read('db.history[0].recoveries.length'),2);assert.equal(r.read('db.history[0].recoveries[1].kind'),'post-workout');assert.equal(r.read('db.history[0].incompleteRecovery||null'),null);assert.match(r.node('savedTitle').textContent,/complete — saved/);r.tick();assert.equal(r.read('db.history.length'),1)});

test('pause freezes displayed time and resume excludes interrupted minutes',()=>{const r=runtime();r.click('start');r.time(12000);r.tick();r.click('pause');const shown=r.node('sessionTimer').textContent;assert.match(r.node('status').textContent,/PAUSED — timer stopped/);r.time(120000);r.tick();assert.equal(r.node('sessionTimer').textContent,shown);r.click('pause');r.click('resume');r.time(3000);r.tick();assert.equal(r.read('db.active.activeMs'),15000)});
test('countdown tones replace speech and transitions block duplicate rep entries',()=>{const r=runtime({autoCountdown:false});r.node('transitionSeconds').value='3';r.node('thresholdSetting').value='110';r.click('saveSettings');r.click('start');assert.deepEqual(r.tones,[]);for(let i=0;i<5;i++){r.time(1000);r.tick();r.tick()}assert.deepEqual(r.tones,[523,523,523,1047]);assert.deepEqual(r.spoken,[]);r.input('reps','12');r.click('record');assert.equal(r.read('db.active.records.length'),1);assert.deepEqual(r.spoken,[]);r.click('record');assert.equal(r.read('db.active.records.length'),1);r.time(1000);r.tick();r.click('pause');r.time(60000);r.tick();assert.equal(r.read('db.active.countdownRemainingMs'),2000);r.click('resume');r.time(2000);r.tick();assert.equal(r.tones.at(-1),1047);assert.equal(r.read('db.active.transitions[0].interruptionSeconds'),60)});
test('End confirmation preserves session, then cooldown keeps HR and stops workout clock',()=>{const r=runtime();r.click('start');r.input('reps','8');r.click('record');r.confirm(false);r.click('end');assert.equal(r.read('db.active.workoutEndedAt||null'),null);r.confirm(true);r.click('end');const frozen=r.read('db.active.activeMs');r.time(30000);r.tick();assert.equal(r.read('db.active.activeMs'),frozen);assert.match(r.node('status').textContent,/Cooldown/);r.input('hr','140');r.click('loghr');assert.equal(r.read('db.history.length'),0);r.input('hr','110');r.click('loghr');assert.equal(r.read('db.history[0].status'),'partial');assert.equal(r.read('db.history[0].recoveries.length'),1)});
test('rep-save failure freezes countdown and never announces accepted data',()=>{const r=runtime({autoCountdown:false});r.click('start');r.time(5000);r.tick();r.input('reps','12');r.fail(true);r.click('record');assert.equal(r.read('dirty'),true);assert.equal(r.read('db.active.paused'),true);assert.equal(r.read('!!db.active.countdownUntil'),false);assert.match(r.spoken.at(-1),/Save failed/);assert.equal(r.spoken.some(s=>s.startsWith('Saved:')),false);r.time(60000);r.tick();assert.equal(r.read('db.active.records.length'),1);r.fail(false);r.click('retry');r.click('resume');r.time(5000);r.tick();assert.equal(r.read('db.active.ex'),1);assert.equal(r.read('db.active.transitions[0].durationSeconds'),5)});
test('focus screen keeps exercise, phase and transition count tied to the durable state',()=>{const r=runtime({autoCountdown:false});r.click('start');assert.equal(r.node('stationName0').textContent,'Push-ups');assert.equal(r.node('focusCount').textContent,'5');r.time(5000);r.tick();assert.equal(r.node('focusCount').textContent,'');r.input('reps','12');r.click('record');assert.equal(r.node('stationName1').textContent,'Squats');assert.equal(r.node('focusCount').textContent,'5');assert.equal(r.node('repReceipt').textContent,'Saved: 12 Push-ups reps');r.click('pause');assert.equal(r.node('focusTitle').textContent,'Paused');r.click('resume');r.time(5000);r.tick();assert.equal(r.node('stationName1').textContent,'Squats')});
test('dashboard exit pauses the workout without changing saved reps',()=>{const r=runtime({devices:true});r.click('start');r.input('reps','10');r.click('record');r.events.hashchange();assert.equal(r.read('db.active.paused'),true);assert.equal(r.read('db.active.records.length'),1);assert.equal(r.read('db.active.events.at(-1).reason'),'dashboard-opened')});
test('new workout after a saved session retains the completed archive',()=>{const r=runtime();r.click('start');r.input('reps','7');r.click('record');r.click('end');r.input('hr','110');r.click('loghr');assert.equal(r.read('db.history.length'),1);r.click('newWorkout');assert.equal(r.read('db.active'),null,'new workout waits for HRM decision');r.click('hrGateProceed');assert.equal(r.read('db.history.length'),1);assert.equal(r.read('db.active.records.length'),0);assert.equal(r.node('stationName0').textContent,'Push-ups')});

test('plan order and actual exercise names survive a full workout, export and reload',async()=>{let r=runtime();r.node('planName1').value='Split squats';r.node('planVariant1').value='Supported';r.node('planSide1').value='true';r.click('savePlan');r.click('planUp1');r.click('start');assert.equal(r.read('db.active.exercisePlan[0].category'),'Squat');r.input('stationValue0left','9');r.click('record');assert.equal(r.read('db.active.records.length'),0);assert.equal(r.read('db.active.pendingSide.reps'),9);r=runtime({data:r.data});assert.equal(r.node('stationValue0left').value,'9');r.click('resume');r.input('stationValue0right','8');r.click('record');assert.deepEqual(r.read('db.active.records[0].sideReps'),{left:9,right:8});assert.equal(r.read('db.active.records[0].exerciseName'),'Split squats');assert.equal(r.read('db.active.records[0].repBasis'),'per-leg-minimum');assert.equal(r.read('db.active.records[0].reps'),8);for(const n of ['12','10']){r.input('reps',n);r.click('record')}r.input('hr','110');r.click('loghr');r.click('recover');for(const n of ['7','6','8','7']){r.input('reps',n);r.click('record')}r.input('hr','110');r.click('loghr');assert.equal(r.read('db.history[0].records.length'),6);r.click('exportAll');const b=JSON.parse(await r.blobs.get(r.downloads[0]).text());assert.equal(b.history[0].exercisePlan[0].name,'Split squats');const restarted=runtime({data:r.data});assert.equal(restarted.read('db.history[0].records[0].sideReps.right'),8)});
test('visible manual controls preserve blank versus zero and audit completed-row corrections',()=>{const r=runtime();r.click('start');assert.equal(r.node('stationValue0main').value,'');assert.equal(r.node('stationValue1main').value,'');r.click('stationPlus0main');assert.equal(r.read('db.active.draft.reps'),'1');r.click('stationMinus0main');r.click('record');assert.equal(r.read('db.active.records[0].reps'),0);r.click('stationPlus0main');assert.equal(r.read('db.active.records[0].reps'),1);assert.equal(r.read('db.active.events.at(-1).event'),'rep-correction');assert.equal(r.read('db.active.records.length'),1)});
test('no voice reps are accepted during five real seconds of transition, even with duplicate results',()=>{const r=runtime({devices:true,autoCountdown:false});r.click('start');r.time(5000);r.tick();r.speech('ten reps');assert.equal(r.read('db.active.records.length'),1);r.speech('ten reps');assert.equal(r.read('db.active.records.length'),1);r.time(4999);r.tick();assert.equal(r.read('!!db.active.countdownUntil'),true);r.time(1);r.tick();assert.equal(r.read('!!db.active.countdownUntil'),false);r.speech('eight reps');assert.equal(r.read('db.active.records.length'),2)});

test('split-squat partial save keeps one completed leg without inventing the other',()=>{const r=runtime();r.node('planName1').value='Split squats';r.node('planSide1').value='true';r.click('savePlan');r.click('start');r.input('reps','12');r.click('record');r.input('reps','9');r.click('record');assert.equal(r.read('db.active.pendingSide.reps'),9);r.click('end');r.input('hr','110');r.click('loghr');assert.equal(r.read('db.history[0].status'),'partial');assert.equal(r.read('db.history[0].records.length'),1);assert.equal(r.read('db.history[0].pendingSide.reps'),9)});
test('invalid restored side counts are rejected without overwriting the backup',()=>{const r=runtime();r.node('planSide1').value='true';r.click('savePlan');r.click('start');r.input('reps','12');r.click('record');r.input('reps','9');r.click('record');const k='the-pure-hit-field-test-v2',broken=JSON.parse(r.data.get(k));broken.active.pendingSide.reps=-1;r.data.set(k,JSON.stringify(broken));const restart=runtime({data:r.data});assert.equal(restart.read('blocked'),true);assert.equal(JSON.parse(r.data.get(k)).active.pendingSide.reps,-1)});
test('first observed HR checkpoint is separate from waiting before starting conditioning',()=>{const r=runtime();r.click('start');for(let i=0;i<3;i++){r.input('reps','10');r.click('record')}r.time(10000);r.input('hr','109');r.click('loghr');r.time(5000);r.click('recover');assert.equal(r.read('db.active.recoveries[0].durationSeconds'),15);assert.equal(r.read('db.active.recoveries[0].checkpoint.elapsedMs'),10000);for(let i=0;i<3;i++){r.input('reps','7');r.click('record')}assert.equal(r.read('db.active.recoveryCheckpoint||null'),null)});
test('practice completion stays out of history, calibration and regular backup',async()=>{const r=runtime();r.node('practiceMode').checked=true;r.click('start');for(let i=0;i<3;i++){r.input('reps','10');r.click('record')}r.input('hr','110');r.click('loghr');r.click('recover');for(let i=0;i<3;i++){r.input('reps','7');r.click('record')}r.input('hr','110');r.click('loghr');assert.equal(r.read('db.history.length'),0);assert.equal(r.read('db.practiceReceipt.records.length'),6);assert.match(r.node('savedTitle').textContent,/Practice complete/);r.click('exportAll');const b=JSON.parse(await r.blobs.get(r.downloads[0]).text());assert.equal(b.history.length,0);assert.equal(b.practiceReceipt,undefined);const restart=runtime({data:r.data});assert.match(restart.node('savedTitle').textContent,/Practice complete/)});

test('split preset is explicit, persists and leaves both leg counts blank with NEW reference',()=>{
 const r=runtime();const before=r.read('db.history');r.click('chooseSplit');
 assert.deepEqual(r.read('db.history'),before);assert.equal(r.read('plan()[1].name'),'Split squat');assert.equal(r.read('plan()[1].unilateral'),true);
 assert.equal(r.node('stationPrevious1').textContent,'NEW · R1 trial: 10 / leg · R2: —');
 const restart=runtime({data:r.data});restart.click('start');assert.equal(restart.read('db.active.exercisePlan[1].name'),'Split squat');
 assert.equal(restart.node('stationValue1left').value,'');assert.equal(restart.node('stationValue1right').value,'');assert.equal(restart.read('db.active.records.length'),0);
});
test('historical max references match exact exercise and variation, not conditioning or incomplete sessions',()=>{
 const r=runtime();const move={category:'Squat',name:'Split squat',variant:'Bodyweight',unilateral:true};
 const row=(name,reps,extra={})=>({round:'maximum',exercise:'Squat',exerciseName:name,variation:'Bodyweight',reps,...extra});
 const h=[{status:'complete',records:[row('Squats',31),row('Split squat',8,{sideReps:{left:8,right:10}}),row('Split squat',14,{round:'conditioning',sideReps:{left:14,right:15}})]},{status:'partial',records:[row('Split squat',20,{sideReps:{left:20,right:20}})]},{status:'complete',practice:true,records:[row('Split squat',30,{sideReps:{left:30,right:30}})]}];
 r.context.maxFixture=h;r.context.moveFixture=move;
 assert.equal(r.read('Pure.previousWorkout(maxFixture,moveFixture).maximum.reps'),8);
 assert.equal(r.read("Pure.previousWorkout(maxFixture,{...moveFixture,variant:'Supported'})"),null);
 assert.equal(r.read("Pure.previousWorkout([{status:'complete',records:[{exercise:'Squat',round:'maximum',reps:31}]}],moveFixture)"),null);
});
test('prior max is reference only; new rep fields stay blank and history stays byte-identical',()=>{
 const r=runtime();r.click('start');for(let i=0;i<3;i++){r.input('reps','12');r.click('record')}r.input('hr','110');r.click('loghr');r.click('recover');for(let i=0;i<3;i++){r.input('reps','8');r.click('record')}r.input('hr','110');r.click('loghr');
 const before=JSON.stringify(r.read('db.history'));r.click('chooseSplit');r.click('start');
 assert.equal(r.node('stationPrevious0').textContent,'Last: 12');assert.equal(r.node('stationPrevious1').textContent,'NEW · 10/leg');
 assert.equal(r.node('stationValue0main').value,'');assert.equal(r.node('stationValue1left').value,'');assert.equal(r.node('stationValue1right').value,'');
 assert.equal(JSON.stringify(r.read('db.history')),before);
});

test('round references use the latest matching workout, not personal bests or mixed sessions',()=>{
 const r=runtime();r.context.moveFixture={category:'Push',name:'Push-ups',variant:'Standard',unilateral:false};
 const w=(id,date,one,two)=>({id,status:'complete',ended:date,records:[{exercise:'Push',exerciseName:'Push-ups',variation:'Standard',round:'maximum',reps:one},...(two===null?[]:[{exercise:'Push',exerciseName:'Push-ups',variation:'Standard',round:'conditioning',reps:two}])]});
 r.context.historyFixture=[w('latest','2026-10-27T10:00Z',10,7),w('older','2026-10-25T10:00Z',20,15)];
 assert.equal(r.read("Pure.workoutReference(historyFixture,moveFixture)"),'Last workout · R1: 10 · R2: 7');
 assert.equal(r.read("Pure.workoutReference(historyFixture,moveFixture,'conditioning')"),'Last: 7');
 r.context.historyFixture.push(w('missing-round','2026-10-28T10:00Z',9,null));
 assert.equal(r.read("Pure.workoutReference(historyFixture,moveFixture)"),'Last workout · R1: 9 · R2: —');
});
test('new split trial reference switches by round without creating reps or a progression gate',()=>{
 const r=runtime();r.click('chooseSplit');r.click('start');assert.equal(r.node('stationPrevious1').textContent,'NEW · 10/leg');
 for(const n of ['10','4','3','6']){r.input('reps',n);r.click('record')}
 r.input('hr','110');r.click('loghr');r.click('recover');
 assert.equal(r.node('stationPrevious1').textContent,'NEW · — · No floor yet (new exercise)','owner rule Nov 12: a new exercise says it has no baseline');assert.equal(r.node('stationValue1left').value,'');assert.equal(r.node('stationValue1right').value,'');
 assert.equal(r.read('db.active.records[1].sideReps.left'),4);assert.equal(r.read('db.active.records[1].sideReps.right'),3);
});
test('matching-round UI references survive reload while today counts and history remain independent',()=>{
 const r=runtime();r.click('start');for(const n of ['11','30','9']){r.input('reps',n);r.click('record')}r.input('hr','110');r.click('loghr');r.click('recover');for(const n of ['8','21','6']){r.input('reps',n);r.click('record')}r.input('hr','110');r.click('loghr');
 const history=JSON.stringify(r.read('db.history')),restarted=runtime({data:r.data});
 assert.equal(restarted.node('stationPrevious0').textContent,'Last workout · R1: 11 · R2: 8');
 restarted.click('start');assert.equal(restarted.node('stationValue0main').value,'');assert.equal(restarted.node('stationPrevious0').textContent,'Last: 11');
 for(const n of ['5','10','4']){restarted.input('reps',n);restarted.click('record')}restarted.input('hr','110');restarted.click('loghr');restarted.click('recover');
 assert.equal(restarted.node('stationPrevious0').textContent,'Last: 8 · Max\u00a011 · Floor\u00a08','owner rule Nov 12: floor shows as soon as a Round 1 exists');assert.equal(restarted.node('stationValue0main').value,'');
 assert.equal(JSON.stringify(restarted.read('db.history')),history);
});

test('workout monitor control connects during exercise without navigation and retains reps through reconnect',async()=>{
 const html=fs.readFileSync('dist/index.html','utf8'),workout=html.slice(html.indexOf('<section data-view="workout"'),html.indexOf('<section data-view="more"'));
 assert.match(workout, /id="connectHr"/);assert.match(workout,/id="monitorStatus"/);assert.equal((html.match(/id="connectHr"/g)||[]).length,1);
 let packet,connections=0;const characteristic={addEventListener(n,f){packet=f},removeEventListener(){},async startNotifications(){}};
 const device={addEventListener(){},removeEventListener(){},gatt:{connected:false,disconnect(){this.connected=false},async connect(){connections++;this.connected=true;return {async getPrimaryService(){return {async getCharacteristic(){return characteristic}}}}}}};
 const r=runtime({devices:true,bluetooth:{async requestDevice(){return device}}});r.click('start');r.input('reps','10');r.click('record');const before=r.read('db.active.records');
 await r.node('connectHr').onclick();assert.equal(r.node('connectHr').textContent,'Reconnect HR monitor');
 packet({target:{value:new DataView(Uint8Array.from([0,140]).buffer)}});assert.equal(r.read('db.active.hr.at(-1).bpm'),140);
 await r.node('connectHr').onclick();assert.equal(connections,2);assert.deepEqual(r.read('db.active.records'),before);assert.equal(r.read('db.active.paused'),false);assert.equal(r.read('db.active.hr.length'),1);
});

test('finish and save now archives a paused transition without HR and survives reload',()=>{const r=runtime();r.click('start');r.input('reps','10');r.click('record');r.click('pause');r.click('saveNow');assert.equal(r.read('db.active'),null);assert.equal(r.read('db.history[0].status'),'partial');assert.equal(r.read('db.history[0].records[0].reps'),10);assert.equal(r.read('db.history[0].recoveries[0].manualOverride'),true);const restarted=runtime({data:r.data});assert.equal(restarted.read('db.history.length'),1)});
test('finish and save now preserves data on failed save and retry',()=>{const r=runtime();r.click('start');r.input('reps','7');r.click('record');r.fail(true);r.click('saveNow');assert.equal(r.read('dirty'),true);assert.equal(r.read('db.history[0].records[0].reps'),7);r.fail(false);r.click('retry');assert.equal(runtime({data:r.data}).read('db.history[0].records[0].reps'),7)});

test('missing HR requires an explicit visible choice every workout; cancel leaves timer and voice off',()=>{
 const r=runtime({devices:true,autoHrGate:false});
 r.click('start');
 assert.equal(r.read('db.active'),null,'no session until user explicitly chooses');
 assert.match(r.node('hrPreflight').textContent,/Start blocked/);
 assert.equal(r.read('voiceActive'),false);
 r.click('hrGateCancel');
 assert.equal(r.read('db.active'),null);
 r.click('start');r.click('hrGateProceed');
 assert.equal(r.read('db.active.events.some(e=>e.event==="started-without-hr-confirmed"&&e.confirmation==="explicit-user-override")'),true);
 r.click('saveNow');r.click('start');assert.equal(r.read('db.active'),null,'previous consent is not reused');
});
test('paired but unreadable monitor does not bypass gate; live BPM enables instant start',async()=>{
 let packet;
 const characteristic={addEventListener(n,f){packet=f},removeEventListener(){},async startNotifications(){}};
 const device={addEventListener(){},removeEventListener(){},gatt:{connected:false,disconnect(){this.connected=false},async connect(){this.connected=true;return {async getPrimaryService(){return {async getCharacteristic(){return characteristic}}}}}}};
 const r=runtime({devices:true,bluetooth:{async requestDevice(){return device}},autoHrGate:false});
 await r.node('connectHr').onclick();
 r.click('start');assert.equal(r.read('db.active'),null,'GATT subscribed is not live HR');
 packet({target:{value:new DataView(Uint8Array.from([0,88]).buffer)}});
 assert.match(r.node('hrPreflight').textContent,/READY.*88 BPM/);
 r.click('start');
 assert.equal(r.read('db.active.events.some(e=>e.event==="started-with-live-hr"&&e.bpm===88)'),true);
});
test('stale BPM cannot silently authorize another workout start',async()=>{
 let packet;
 const characteristic={addEventListener(n,f){packet=f},removeEventListener(){},async startNotifications(){}};
 const device={addEventListener(){},removeEventListener(){},gatt:{connected:true,disconnect(){},async connect(){return {async getPrimaryService(){return {async getCharacteristic(){return characteristic}}}}}}};
 const r=runtime({devices:true,bluetooth:{async requestDevice(){return device}},autoHrGate:false});
 await r.node('connectHr').onclick();
 packet({target:{value:new DataView(Uint8Array.from([0,90]).buffer)}});
 r.time(15001);r.tick();r.click('start');
 assert.equal(r.read('db.active'),null,'expired BPM is not live');
 assert.match(r.node('hrPreflight').textContent,/Start blocked/);
});

test('mic rests in recovery and countdown, then resumes for conditioning reps',()=>{
 const r=runtime({devices:true,autoCountdown:false});r.click('start');r.time(5000);r.tick();
 r.hears('10 reps');assert.equal(r.read('voiceActive'),false);
 r.time(5000);r.tick();r.hears('20 reps');r.time(5000);r.tick();r.hears('8 reps');
 assert.equal(r.read('db.active.phase'),'recovery');assert.equal(r.read('voiceActive'),false);
 r.click('pause');r.time(10000);r.click('resume');assert.equal(r.read('voiceActive'),false);
 r.input('hr','108');r.click('loghr');r.tick();assert.equal(r.tones.filter(t=>t===784).length,1);
 r.click('recover');assert.equal(r.read('db.active.round'),1);
 assert.equal(r.read('db.active.countdownKind'),'conditioning');assert.equal(r.read('voiceActive'),false);
 assert.match(r.node('status').textContent,/Round two.*Push-ups/);
 r.time(5000);r.tick();assert.equal(r.tones.at(-1),1047);
 r.hears('9 reps');r.time(5000);r.tick();r.hears('14 reps');r.time(5000);r.tick();r.hears('6 reps');
 assert.equal(r.read('db.active.finalRecovery'),true);assert.equal(r.read('voiceActive'),false);
 r.input('hr','109');r.click('loghr');assert.equal(r.read('db.active'),null);assert.equal(r.read('db.history[0].records.length'),6);
});
test('conditioning pause and reload resume retain round, next exercise, reps and transition remainder',()=>{
 let r=runtime({devices:true,autoCountdown:false});r.click('start');r.time(5000);r.tick();for(const n of ['10','20','8']){r.input('reps',n);r.click('record');r.time(5000);r.tick()}r.input('hr','108');r.click('loghr');r.click('recover');r.time(5000);r.tick();r.input('reps','9');r.click('record');r.time(2000);r.tick();r.click('pause');const records=r.read('db.active.records');r=runtime({data:r.data,devices:true,autoCountdown:false});assert.equal(r.read('db.active.round'),1);assert.equal(r.read('db.active.ex'),1);r.click('resume');r.time(2999);r.tick();assert.equal(r.read('!!db.active.countdownUntil'),true);r.time(1);r.tick();assert.equal(r.read('!!db.active.countdownUntil'),false);assert.deepEqual(r.read('db.active.records'),records);r.input('reps','13');r.click('record');assert.equal(r.read('db.active.records[4].round'),'conditioning');assert.equal(r.read('db.active.records[4].exercise'),'Squat');
});

test('voice save requires confirmation and archives partial session without HR',()=>{const r=runtime({devices:true});r.click('start');r.hears('10 reps');r.time(5000);r.tick();r.hears('save workout');assert(r.read('db.active'));r.hears('cancel');assert(r.read('db.active'));r.hears('finish and save');r.hears('confirm');assert.equal(r.read('db.active'),null);assert.equal(r.read('db.history[0].records[0].reps'),10);assert.equal(r.read('db.history[0].recoveries[0].manualOverride'),true)});
test('voice pause rejects reps and resumes the same conditioning station without altering earlier reps',()=>{const r=runtime({devices:true});r.click('start');for(const n of ['10','20','8']){r.input('reps',n);r.click('record')}r.input('hr','108');r.click('loghr');r.click('recover');r.hears('9 reps');r.time(5000);r.tick();const before=r.read('db.active.records');r.hears('pause workout');r.hears('confirm');assert.equal(r.read('voiceActive'),false);assert.deepEqual(r.read('db.active.records'),before);r.click('resume');assert.equal(r.read('db.active.round'),1);assert.equal(r.read('db.active.ex'),1);r.hears('13 reps');assert.deepEqual(r.read('db.active.records.slice(0,4)'),before);assert.equal(r.read('db.active.records[4].reps'),13)});

test('monitor gap warns once, preserves workout and logs restoration without fabricating HR',async()=>{let packet;const characteristic={addEventListener(n,f){packet=f},removeEventListener(){},async startNotifications(){}};const device={addEventListener(){},removeEventListener(){},gatt:{connected:true,disconnect(){},async connect(){return {async getPrimaryService(){return {async getCharacteristic(){return characteristic}}}}}}};const r=runtime({devices:true,bluetooth:{async requestDevice(){return device}}});await r.node('connectHr').onclick();const reading=n=>packet({target:{value:new DataView(Uint8Array.from([0,n]).buffer)}});reading(85);r.click('start');reading(130);const samples=r.read('db.active.hr.length');r.time(16000);r.tick();r.tick();assert.equal(r.read('db.active.hr.length'),samples);assert.equal(r.read('db.active.events.filter(e=>e.event==="hr-signal-unavailable").length'),1);assert.equal(r.read('db.active.paused'),false);assert.match(r.spoken.at(-1),/signal lost/);reading(125);assert.equal(r.read('db.active.events.filter(e=>e.event==="hr-signal-restored").length'),1);assert.equal(r.read('db.active.hr.at(-1).bpm'),125)});

test('visible finish cooldown button saves without requiring HR or a buried recovery reason',()=>{const r=runtime();r.click('start');r.input('reps','10');r.click('record');r.click('end');r.confirm(false);r.click('finishCooldown');assert(r.read('db.active'));r.confirm(true);r.click('finishCooldown');assert.equal(r.read('db.active'),null);assert.equal(r.read('db.history[0].records[0].reps'),10);assert.equal(r.read('db.history[0].recoveries[0].manualOverride'),true)});

// Verified-save regression tests added during the Work HIT 1.6 source integration.
test('verified-save detects a silently ignored write and retries the exact unsaved draft',()=>{
 const r=runtime();r.click('start');
 const key='the-pure-hit-field-test-v2',good=r.data.get(key),previousRevision=JSON.parse(good).revision;
 r.writeFault('drop');r.input('reps','12');
 assert.equal(r.read('dirty'),true);
 assert.match(r.node('notice').textContent,/NOT verified/i);
 assert.equal(r.data.get(key),good,'last verified data remains intact');
 assert.equal(r.read('db.active.draft.reps'),'12','unsaved draft stays in memory');
 r.writeFault('normal');r.click('retry');
 assert.equal(r.read('dirty'),false);
 assert.match(r.node('notice').textContent,/Verified read-back/);
 assert.equal(JSON.parse(r.data.get(key)).revision,previousRevision+1);
 assert.equal(runtime({data:r.data}).node('reps').value,'12','restarted tab reads exact draft');
});
test('verified-save refuses corrupted read-back without overwriting it on retry',()=>{
 const r=runtime();r.click('start');const key='the-pure-hit-field-test-v2';
 r.writeFault('corrupt');r.input('reps','9');
 assert.equal(r.read('dirty'),true);assert.equal(r.read('blocked'),true);
 assert.equal(r.data.get(key),'simulated unexpected storage bytes');
 r.writeFault('normal');r.click('retry');
 assert.equal(r.data.get(key),'simulated unexpected storage bytes');
 assert.equal(r.read('db.active.draft.reps'),'9');
 r.click('exportRaw');assert.equal(r.downloads.length,1,'raw recovery remains available');
});
test('verified-save blocks same-revision external modifications, not only newer revisions',()=>{
 const r=runtime();r.click('start');const key='the-pure-hit-field-test-v2';
 const original=JSON.parse(r.data.get(key));
 const modified={...original,history:[{id:'other-tab-revision-collision',records:[]}]};
 r.data.set(key,JSON.stringify(modified));
 r.input('reps','8');
 assert.equal(r.read('blocked'),true);
 assert.deepEqual(JSON.parse(r.data.get(key)).history,modified.history);
 assert.equal(r.read('db.active.draft.reps'),'8');
});


test('large countdown labels current exercise and plays the distinct go tone',()=>{
 const r=runtime({devices:true,autoCountdown:false});
 const css=fs.readFileSync('dist/focus.css','utf8');
 assert.match(css,/\.workout-panel\[data-stage="countdown"\] #focusCount\{display:block;font-size:clamp\(88px,28vw,148px\)/);
 r.click('start');assert.match(r.node('focusTitle').textContent,/Get ready: Push-ups/);
 r.time(5000);r.tick();assert.equal(r.tones.at(-1),1047);
 r.input('reps','4');r.click('record');assert.match(r.node('focusTitle').textContent,/Get ready: Squats/);
 assert.equal(r.read('db.active.countdownKind'),'transition');
 r.time(2000);r.tick();assert.equal(r.tones.at(-1),523);
 r.time(3000);r.tick();assert.equal(r.tones.at(-1),1047);
 assert.equal(r.read('!!db.active.countdownKind'),false);
});

test('Start arms voice and opens the mic only when rep entry starts',()=>{
 const r=runtime({devices:true,autoCountdown:false});r.click('start');assert.equal(r.read('voiceActive'),false);
 r.time(5000);r.tick();r.hears('10 reps');assert.equal(r.read('db.active.records[0].reps'),10);
});
test('conditioning resumes voice after recognition interruption without a new Connect Voice tap',()=>{
 const r=runtime({devices:true,autoCountdown:false});r.click('start');
 for(const n of [10,11,12]){r.time(5000);r.tick();r.hears(n+' reps')}
 r.input('hr','108');r.click('loghr');assert.equal(r.read('voiceActive'),false);
 r.click('recover');r.time(5000);r.tick();assert.equal(r.read('voiceActive'),true);
 r.hears('8 reps');assert.equal(r.read('db.active.records[3].reps'),8);
});
test('permission failure stays disconnected across transitions until a deliberate retry',()=>{
 const r=runtime({devices:true});r.click('start');r.voiceError('not-allowed');assert.equal(r.read('voiceActive'),false);
 r.click('pause');r.click('resume');assert.equal(r.read('voiceActive'),false);
 r.click('talk');assert.equal(r.read('voiceActive'),true);
});
test('return from a hidden page explains the pause and preserves deliberate mic off',()=>{
 const r=runtime({devices:true});r.click('start');r.hidden(true);assert.equal(r.read('voiceActive'),false);
 r.hidden(false);assert.equal(r.read('voiceActive'),false);assert.match(r.node('resumeNotice').textContent,/Paused when the app went out of view/);r.click('resume');assert.equal(r.read('voiceActive'),true);r.click('stopTalk');r.hidden(true);r.hidden(false);
 r.click('pause');r.click('resume');assert.equal(r.read('voiceActive'),false);
});
test('cooldown does not announce saved when the archive write was silently dropped',()=>{
 const r=runtime();r.click('start');r.input('reps','8');r.click('record');r.click('end');
 r.input('hr','106');r.writeFault('drop');r.click('loghr');
 assert.match(r.node('notice').textContent,/NOT verified/);assert(!r.spoken.includes('Cooldown complete. Workout saved.'));
});


test('warning Connect HRM directly launches Bluetooth selection and accepts live BPM before Start',async()=>{
 let packet,picked=0;
 const characteristic={addEventListener(n,f){packet=f},removeEventListener(){},async startNotifications(){}};
 const device={addEventListener(){},removeEventListener(){},gatt:{connected:false,disconnect(){this.connected=false},async connect(){this.connected=true;return {getPrimaryService:async()=>({getCharacteristic:async()=>characteristic})}}}};
 const r=runtime({devices:true,autoHrGate:false,bluetooth:{requestDevice:async()=>{picked++;return device}}});
 r.click('start');
 assert.equal(r.read('db.active'),null);
 await r.node('hrGateConnect').onclick();
 assert.equal(picked,1,'tap should launch actual device picker, not just dismiss the warning');
 assert.match(r.node('monitorStatus').textContent,/Waiting for first live BPM/);
 assert.equal(r.read('db.active'),null,'pairing alone never starts workout');
 packet({target:{value:new DataView(Uint8Array.from([0,113]).buffer)}});
 assert.match(r.node('hrPreflight').textContent,/READY.*113 BPM/);
 r.click('start');
 assert.equal(r.read('db.active.events.some(e=>e.event==="started-with-live-hr"&&e.bpm===113)'),true);
});


test('heart icon shows fresh Bluetooth samples, age resets even at unchanged BPM, and stale values vanish',async()=>{
 let packet;
 const characteristic={addEventListener(n,f){packet=f},removeEventListener(){},async startNotifications(){}};
 const device={name:'MOOFIT',addEventListener(){},removeEventListener(){},gatt:{connected:false,disconnect(){this.connected=false},async connect(){this.connected=true;return {getPrimaryService:async()=>({getCharacteristic:async()=>characteristic})}}}};
 const r=runtime({devices:true,bluetooth:{requestDevice:async()=>device},autoHrGate:false});
 assert.equal(r.node('hrLiveValue').textContent,'—');
 await r.node('connectHr').onclick();
 assert.equal(r.node('hrLiveValue').textContent,'—','pairing must not imply a live heart rate');
 const reading=n=>packet({target:{value:new DataView(Uint8Array.from([0,n]).buffer)}});
 reading(92);
 assert.equal(r.node('hrLiveValue').textContent,'92');
 assert.equal(r.node('hrSignalAge').textContent,'New reading received just now');
 r.time(6000);r.tick();
 assert.equal(r.node('hrLiveValue').textContent,'92');
 assert.match(r.node('hrSignalAge').textContent,/6s ago/);
 reading(92);
 assert.equal(r.node('hrSignalAge').textContent,'New reading received just now','unchanged BPM still resets update age on new packet');
 r.time(16000);r.tick();
 assert.equal(r.node('hrLiveValue').textContent,'—','stale BPM cannot look live');
 assert.equal(r.node('liveBpm').textContent,'— BPM');
 assert.match(r.node('hrSignalAge').textContent,/SIGNAL STALE.*16s/);
 assert.equal(r.node('connectHr').classList.contains('hidden'),false,'show the compact connect control when the preflight signal expires');
 r.click('start');
 assert.equal(r.read('db.active'),null,'stale reading must not pass start gate');
});
test('manual or archived HR readings do not impersonate a live Bluetooth pulse',()=>{
 const r=runtime({devices:true,autoHrGate:false});
 assert.equal(r.node('hrLiveValue').textContent,'—');
 r.click('start');r.click('hrGateProceed');
 r.input('hr','104');r.click('loghr');
 assert.equal(r.node('hrLiveValue').textContent,'—');
 r.tick();assert.equal(r.node('liveBpm').textContent,'— BPM');
 assert.match(r.node('hrSignalAge').textContent,/Waiting for live/);
});


test('review defaults to split squat while an explicit plan or active session is preserved',()=>{
 const r=runtime({splitDefault:true});
 assert.equal(r.node('stationName1').textContent,'Split squat');
 r.click('start');r.input('reps','5');r.click('record');
 r.input('reps','10');r.click('record');r.input('reps','12');r.click('record');
 assert.deepEqual(r.read('db.active.records[1].sideReps'),{left:10,right:12});

 const custom=runtime();
 custom.click('savePlan');
 const restored=runtime({data:custom.data,splitDefault:true});
 assert.equal(restored.node('stationName1').textContent,'Squats');
 custom.click('start');
 const active=runtime({data:custom.data,splitDefault:true});
 assert.equal(active.read('db.active.exercisePlan[1].unilateral'),false);
});

test('release Bluetooth recovery arms at 110, resets at 113, latches one cue and permits manual conditioning',async()=>{
 let packet;const ch={addEventListener(n,f){packet=f},removeEventListener(){},async startNotifications(){}};
 const device={addEventListener(){},removeEventListener(){},gatt:{connected:true,disconnect(){},async connect(){return {async getPrimaryService(){return {async getCharacteristic(){return ch}}}}}}};
 const r=runtime({release:true,devices:true,bluetooth:{async requestDevice(){return device}}});r.read("(setSound('voice',1),1)");
 await r.node('connectHr').onclick();
 const feed=(bpm,ms=1000)=>{r.time(ms);packet({target:{value:new DataView(Uint8Array.from([0,bpm]).buffer)}});r.tick()};
 feed(120);r.click('start');
 for(const n of ['10','20','8']){r.input('reps',n);r.click('record')}
 assert.equal(r.read('db.active.records[1].exerciseName'),'Jump Squats');
 assert.equal(r.read('db.active.records[2].exerciseName'),'Inverted rows');
 assert.equal(r.node('recover').disabled,true);
 feed(110);feed(112);feed(113);
 for(let i=0;i<7;i++)feed(112);
 assert.equal(r.node('recover').disabled,true);
 feed(110);feed(112,3000);for(let i=0;i<5;i++)feed(112);
 assert.equal(r.node('recover').disabled,true);
 r.input('hr','105');r.click('loghr');assert.equal(r.node('recover').disabled,true);
 feed(110);for(let i=0;i<4;i++)feed(112);
 assert.equal(r.node('recover').disabled,true);
 feed(111);assert.equal(r.node('recover').disabled,false);
 assert.equal(r.read('db.active.round'),0);
 assert.equal(r.tones.filter(n=>n===784).length,1);
 for(let i=0;i<45;i++)feed(112);
 assert.equal(r.tones.filter(n=>n===784).length,1);
 assert.equal(r.node('recover').disabled,false);
 const reload=runtime({release:true,data:r.data});reload.click('resume');
 assert.equal(reload.node('recover').disabled,false);
 assert.equal(reload.tones.filter(n=>n===784).length,0);
 r.click('recover');
 assert.equal(r.read('db.active.round'),1);
 assert.equal(r.read('db.active.ex'),0);
 assert.equal(r.read('db.active.recoveries[0].manualOverride'),false);
 assert.deepEqual(r.spoken,['Repetitions recorded. 10. Next: Jump Squats.','Repetitions recorded. 20. Next: Inverted rows.','Repetitions recorded. 8.','Recovery threshold reached. Prepare for the next round.'],'AI Coach speaks each verified save once and the recovery line once');
});

test('release go cue, single verified rep/final-save cues, and the calm AI Coach lines (owner #115)',()=>{
 const r=runtime({release:true});r.read("(setSound('voice',1),1)");r.click('start');
 assert.equal(r.tones.filter(n=>n===1047).length,1);
 r.input('reps','10');r.click('record');
 assert.equal(r.tones.filter(n=>n===1320).length,1);
 r.click('saveNow');
 assert.equal(r.tones.filter(n=>n===1320).length,1);assert.equal(r.tones.filter(n=>n===2637).length,1,'owner Nov 12: workout saved = cha-ching (C)');
 const resumed=runtime({release:true,data:r.data});
 assert.equal(resumed.read('db.history[0].records[0].reps'),10);
 assert.deepEqual(r.spoken,['Repetitions recorded. 10. Next: Jump Squats.','Workout saved.']);
});
test('release makes no rep or final-save cue when storage rejects the write',()=>{
 for(const action of ['record','saveNow']){
  const r=runtime({release:true});r.click('start');r.input('reps','10');r.writeFault('drop');r.click(action);
  assert.equal(r.read('dirty'),true);assert(!r.tones.includes(587));assert(r.spoken.every(t=>!/recorded|saved/i.test(t)),'never announces data that did not save');
 }
});

test('Android release flow saves both rounds without export and discards only an unfinished session',()=>{
 const r=runtime({release:true,devices:true});
 const rep=(target,n)=>{target.input('reps',String(n));target.click('record')};
 r.click('start');
 rep(r,10);r.hidden(true);r.hidden(false);
 assert.equal(r.read('db.active.paused'),true);
 assert.equal(r.node('discardLive').classList.contains('hidden'),false,'Discard Workout stays available while paused');
 r.click('resume');rep(r,9);rep(r,8);
 assert.equal(r.read('db.active.round'),0);
 assert.equal(r.node('recover').disabled,true);
 r.time(120000);r.tick();assert.equal(r.node('recover').disabled,false);r.click('recover');
 for(const n of [7,6,5])rep(r,n);
 r.click('end');
 assert.equal(r.read('db.history[0].status'),'complete');
 assert.deepEqual(r.read('db.history[0].records.map(x=>x.reps)'),[10,9,8,7,6,5]);
 assert.equal(r.downloads.length,0);
 r.click('discard');assert.ok(r.read('db.active.cooldownDeadline'));
 const reopened=runtime({release:true,devices:true,data:r.data});
 assert.equal(reopened.read('db.active.paused'),false);
 reopened.click('finishCooldown');
 reopened.click('start');rep(reopened,3);reopened.click('pause');
 reopened.confirm(false);reopened.click('discardPaused');assert.ok(reopened.read('db.active'));
 reopened.confirm(true);reopened.click('discardPaused');assert.equal(reopened.read('db.active'),null);
 assert.equal(reopened.read('db.history.length'),1);
});


// ---- Integrated on the owner-approved Android UI (Nov 11 2026). Fictional data only. ----
// No-HRM path uses the approved build's own 120-second fallback; End saves, Finish cooldown finalizes.
function r1(r,reps){r.click('start');for(const n of reps){r.input('reps',String(n));r.time(1000);r.click('record')}return r.read('db.active.floors??null')}
function r2(r,reps){r.time(120000);r.tick();r.click('recover');for(const n of reps){r.input('reps',String(n));r.time(1000);r.click('record')}}
function finish(r){if(r.read('db.active?.awaitingFinish??false'))r.click('end');if(r.read('db.active'))r.click('finishCooldown');return r.read('db.history.at(-1)')}
function workout(r,a,b){r1(r,a);r2(r,b);return finish(r)}
function calibrated(opts={release:true}){const r=runtime(opts);for(let i=0;i<3;i++)workout(r,[10,10,10],[1,1,1]);return r}
test('floor is 70% of the established maximum, rounded up with exact integer math',()=>{const P=require('../dist/app.js');assert.deepEqual([0,1,10,14,20,27,30,33].map(P.floorFor),[0,1,7,10,14,19,21,24])});
test('owner rule Nov 12: no 3-workout calibration; the floor uses any recorded Round 1 of the exact exercise, a new one has no baseline',()=>{const r=runtime({release:true});r.click('start');r.input('reps','40');r.click('record');r.click('end');if(r.read('db.active'))r.click('finishCooldown');assert.equal(r.read('db.history.at(-1).status'),'partial');assert.equal(r.read('Pure.CALIBRATION_WORKOUTS'),0);const f=r1(r,[20,30,10]);assert.equal(f[0].maximumReps,40,'partial Round 1 counts as recorded performance');assert.equal(f[0].floor,28);assert.ok(!Number.isInteger(f[1].floor)&&!Number.isInteger(f[2].floor),'no invented floor for exercises without a baseline');assert.doesNotMatch(r.node('focusRound').textContent,/CALIBRATION/);r2(r,[28,1,1]);const w=finish(r);assert.equal(w.calibration,false);assert.deepEqual(w.records.slice(3).map(x=>x.floor),[28,undefined,undefined])});
test('maximum is the highest Round 1 across the three calibration workouts, not the current workout',()=>{const r=runtime({release:true});for(const a of [[12,25,9],[15,20,11],[10,28,8]])workout(r,a,[1,1,1]);const f=r1(r,[10,20,8]);assert.deepEqual(f.map(x=>[x.exercise,x.maximumReps,x.floor,x.raisedToday]),[['Push',15,11,false],['Squat',28,20,false],['Pull',11,8,false]]);r2(r,[11,19,8]);assert.match(r.node('stationPrevious0').textContent,/ · Max\s15 · Floor\s11 · floor met$/);assert.match(r.node('stationPrevious1').textContent,/ · Max\s28 · Floor\s20 · floor missed$/);const w=finish(r);assert.deepEqual(w.records.slice(3).map(x=>[x.floor,x.maximumReps,x.metFloor]),[[11,15,true],[20,28,false],[8,11,true]]);assert.deepEqual(w.records.map(x=>x.reps),[10,20,8,11,19,8],'stored results unchanged')});
test('a missed floor adds no exercise and leaves the approved save and cooldown flow unchanged',()=>{const r=calibrated();r1(r,[20,30,10]);r2(r,[5,5,5]);assert.equal(r.read('db.active.records.length'),6);assert.equal(r.read('db.active.awaitingFinish'),true,'same End/Save step as the approved build');assert.equal(r.read('db.active.phase'),'exercise');r.click('end');assert.equal(r.read('db.history.at(-1).status'),'complete');assert.ok(r.read('db.active.cooldownDeadline'));r.click('finishCooldown');const w=r.read('db.history.at(-1)');assert.deepEqual(w.records.slice(3).map(x=>x.metFloor),[false,false,false]);assert.equal(w.finishers,undefined)});
test('a later stronger Round 1 raises the maximum; a weaker workout never lowers it',()=>{const r=calibrated();let f=r1(r,[16,10,10]);assert.deepEqual(f[0],{exercise:'Push',exerciseName:'Push-ups',maximumReps:16,previousMaximum:10,raisedToday:true,floor:12});r2(r,[12,7,7]);assert.match(r.node('stationPrevious0').textContent,/Max\s16\s\(new\) · Floor\s12/);finish(r);f=r1(r,[9,9,9]);assert.deepEqual(f.map(x=>[x.maximumReps,x.floor]),[[16,12],[10,7],[10,7]])});
test('practice uses but never raises the maximum; reload keeps the floor rule fixed at start',()=>{let r=calibrated({release:true,journal:true});r.node('practiceMode').checked=true;let f=r1(r,[30,30,30]);assert.deepEqual(f.map(x=>[x.maximumReps,x.raisedToday]),[[10,false],[10,false],[10,false]]);r2(r,[7,7,7]);finish(r);r.node('practiceMode').checked=false;r1(r,[9,9,9]);r=runtime({release:true,journal:true,data:r.data});assert.equal(r.read('db.active.floorRule.calibration'),false);assert.deepEqual(r.read('db.active.floors.map(x=>x.maximumReps)'),[10,10,10]);r.click('resume');r2(r,[7,6,7]);const w=finish(r);assert.match(r.node('historyCards').innerHTML,/6 reps<\/span><span class="record-label">conditioning · Bodyweight · floor 7 missed/)});
test('a partial non-practice workout after calibration can raise the maximum',()=>{const r=calibrated();r.click('start');for(const n of [18,10,10]){r.input('reps',String(n));r.time(1000);r.click('record')}r.click('end');if(r.read('db.active'))r.click('finishCooldown');assert.equal(r.read('db.history.at(-1).status'),'partial');const f=r1(r,[9,9,9]);assert.equal(f[0].maximumReps,18);assert.equal(f[0].floor,13)});
test('split squat maximum uses the lower of left and right; inconsistent stored counts are ignored',()=>{const P=require('../dist/app.js');const move={category:'Squat',name:'Split squat',variant:'Bodyweight',unilateral:true};const rec=(l,rr)=>({round:'maximum',exercise:'Squat',exerciseName:'Split squat',variation:'Bodyweight',sideReps:{left:l,right:rr},reps:Math.min(l,rr)});const h=[0,1,2].map(i=>({id:'c'+i,started:'2026-11-0'+(i+1)+'T15:00:00.000Z',status:'complete',records:[rec(12+i,9)]}));assert.equal(P.historicalMaximum(h,move).maximumReps,9);h.push({id:'bad',started:'2026-11-05T15:00:00.000Z',status:'complete',records:[{...rec(20,20),sideReps:{left:20,right:3}}]});assert.equal(P.historicalMaximum(h,move).maximumReps,9)});
test('phone V2 export imports as preserved original records, outside HIT history and calibration',async()=>{const r=runtime({journal:true});const exp={app:'The Pure — approved phone test V2',exportedAt:'2026-11-01T01:00:00Z',version:2,phase:'active',startedAt:Date.parse('2026-10-30T15:00:00Z'),counts:[{push:9},{},{}],roundOrders:[null,null,null],recoveries:[null,null,null],roundEnds:[null,null,null],history:[{startedAt:Date.parse('2026-10-28T15:00:00Z'),finishedAt:Date.parse('2026-10-28T15:20:00Z'),endedEarly:false,outcome:'complete',counts:[{push:20,legs:30,pull:12},{push:15,legs:22,pull:9},{}],roundOrders:[null,null,null],recoveries:[null,null,null],roundEnds:[null,null,null]},{startedAt:Date.parse('2026-10-29T15:00:00Z'),finishedAt:Date.parse('2026-10-29T15:10:00Z'),counts:[{push:18},{},{}],roundOrders:[null,null,null],recoveries:null}]};r.node('importFile').files=[{size:2000,async text(){return JSON.stringify(exp)}}];await r.node('importFile').change();assert.match(r.node('importCounts').textContent,/0 HIT workouts .* 3 original or phone V2 Pure workouts/);assert.equal(r.read('db.legacyHistory||null'),null,'nothing changes before confirmation');r.click('mergeImport');assert.equal(r.read('db.legacyHistory.length'),3);assert.equal(r.read('db.history.length'),0);assert.deepEqual(r.read('db.legacyHistory[0].originalWorkout'),exp.history[0]);assert.equal(r.read('db.legacyHistory[2].unfinishedAtExport'),true);assert.match(r.node('legacyCards').innerHTML,/Phone V2 session unfinished at export preserved/);const again=runtime({journal:true,data:r.data});again.node('importFile').files=[{size:2000,async text(){return JSON.stringify(exp)}}];await again.node('importFile').change();again.click('mergeImport');assert.equal(again.read('db.legacyHistory.length'),3,'re-import is idempotent');again.click('exportAll');const backup=JSON.parse(await again.blobs.get(again.downloads[0]).text());const round=runtime({journal:true});round.node('importFile').files=[{size:5000,async text(){return JSON.stringify(backup)}}];await round.node('importFile').change();round.click('mergeImport');assert.deepEqual(round.read('db.legacyHistory'),again.read('db.legacyHistory'),'full backup round-trips phone V2 records')});
test('malformed phone V2 exports are rejected before any change',async()=>{const r=runtime({journal:true});const base={app:'The Pure — approved phone test V2',version:2,phase:'ready',history:[]};const before=r.data.get('the-pure-hit-field-test-v2')??null;for(const bad of [{...base,version:3},{...base,history:'x'},{...base,history:[{startedAt:'yesterday',counts:[]}]},{...base,history:[{startedAt:1,counts:[{push:-1}]}]},{...base,history:[{startedAt:1,counts:[{push:1.5}]}]},{...base,history:[{startedAt:5,counts:[]},{startedAt:5,counts:[]}]}]){r.node('importFile').files=[{size:500,async text(){return JSON.stringify(bad)}}];await r.node('importFile').change();assert.equal(r.node('importReview').hidden??r.node('importReview').classList.hidden,true);assert.match(r.node('importMessage').textContent,/Invalid|Unsupported|Duplicate/)}assert.equal(r.data.get('the-pure-hit-field-test-v2')??null,before)});

test('issue #118: correcting a Round 1 count recomputes the 70% goal (10 -> 11 moves 7 -> 8) and re-evaluates Round 2',()=>{const r=calibrated();let f=r1(r,[10,10,10]);assert.equal(f[0].floor,7);assert.equal(r.read('db.active.phase'),'recovery');r.input('stationValue0main','11');assert.equal(r.read('db.active.records[0].reps'),11);assert.equal(r.read('db.active.floors[0].maximumReps'),11);assert.equal(r.read('db.active.floors[0].floor'),8);assert.equal(r.read('db.active.floors[1].floor'),7,'other exercises unchanged');r2(r,[7,7,7]);assert.equal(r.read('db.active.records[3].metFloor'),false,'7 is under the corrected goal of 8');r.input('stationValue0main','8');assert.equal(r.read('db.active.records[3].reps'),8);assert.equal(r.read('db.active.records[3].metFloor'),true);assert.equal(r.read('db.active.records[3].floor'),8);const w=finish(r);assert.deepEqual(w.records.slice(3).map(x=>[x.floor,x.metFloor]),[[8,true],[7,true],[7,true]]);assert.ok(w.events.filter(e=>e.event==='rep-correction').length>=2,'corrections stay audited')});
test('owner #115 audio: chimes default to half, coach voice adjustable and silenced at 0, levels saved on the device',()=>{
 const r=runtime({release:true});
 assert.deepEqual(r.read('sound()'),{chime:.5,voice:0,voiceName:''},'owner Nov 12: coach voice off by default, chimes carry the workout');
 r.read("(setSound('voice',0),1)");r.read("(setSound('chime',.3),1)");
 assert.deepEqual(runtime({release:true,data:r.data}).read('sound()'),{chime:.3,voice:0,voiceName:''},'levels survive reload');
 r.read("(db.settings.sound={chime:.5,voice:1},1)");assert.equal(r.read('sound().voice'),0,'a voice level saved before the Off default is reset once');r.read("(setSound('voice',.8),1)");assert.equal(r.read('sound().voice'),.8,'turning it on again sticks');r.read("(setSound('voice',0),1)");
 r.click('start');r.input('reps','10');r.click('record');
 assert.equal(r.read('db.active.records[0].reps'),10);assert.deepEqual(r.spoken,[],'voice at 0 means no coach speech');
 r.read("(setSound('voice',2),1)");assert.equal(r.read('sound().voice'),0,'out-of-range level falls back to the default (off)');
});
test('owner #115 audio: the microphone is ignored while the AI Coach is speaking, so the coach is never counted as reps',()=>{
 const r=runtime({release:true});r.read("(setSound('voice',1),1)");r.click('start');
 assert.equal(r.read('coachBusy()'),false);
 r.input('reps','10');r.click('record');
 assert.deepEqual(r.spoken,['Repetitions recorded. 10. Next: Jump Squats.']);
 assert.equal(r.read('coachBusy()'),true,'busy while speaking');
 r.time(10000);assert.equal(r.read('coachBusy()'),false,'quiet window ends even if the speech engine never reports the end');
});
test('owner #115: the chosen coach voice is saved on the device and used when speaking',()=>{
 const r=runtime({release:true});
 r.context.speechSynthesis.getVoices=()=>[{name:'Old robot',lang:'en-US',localService:true},{name:'Natural US',lang:'en-US',localService:false},{name:'French',lang:'fr-FR',localService:true}];
 assert.deepEqual(r.read('englishVoices().map(v=>v.name)'),['Natural US','Old robot'],'English voices only');
 r.read("(setSound('voiceName','Natural US'),coachVoice=null,pickVoice(),1)");
 assert.equal(r.read('coachVoice.name'),'Natural US');
 assert.equal(runtime({release:true,data:r.data}).read('sound().voiceName'),'Natural US','choice survives reload');
});
test('owner Nov 12: automatic voice prefers the most natural US English voice; offline falls back to an on-device voice',()=>{
 const r=runtime({release:true});
 r.context.speechSynthesis.getVoices=()=>[{name:'English (United States) compact',lang:'en-US',localService:true},{name:'English United States',lang:'en-US',localService:true},{name:'Google English (US) network',lang:'en-US',localService:false},{name:'Google UK English',lang:'en-GB',localService:false}];
 r.read('(coachVoice=null,pickVoice(),1)');assert.equal(r.read('coachVoice.name'),'Google English (US) network');
 assert.equal(r.read('offlineVoice().name'),'English United States');
});
test('owner Nov 12: male voice preferred when the phone offers one',()=>{
 const r=runtime({release:true});
 r.context.speechSynthesis.getVoices=()=>[{name:'en-us-x-sfg-network',lang:'en-US',localService:false},{name:'en-us-x-iom-network',lang:'en-US',localService:false},{name:'en-us-x-tpf-local',lang:'en-US',localService:true},{name:'en-us-x-iol-local',lang:'en-US',localService:true}];
 r.read('(coachVoice=null,pickVoice(),1)');assert.equal(r.read('coachVoice.name'),'en-us-x-iom-network');assert.equal(r.read('offlineVoice().name'),'en-us-x-iol-local');
});
test('owner #115 practice guardrails: explicit Practice/Live choice, clear labels, practice never touches real data, mode survives reload',()=>{
 const r=runtime({release:true});
 r.confirm(false);r.click('start');assert.equal(r.read('!!db.active'),false,'cancelling the Live question starts nothing');
 r.confirm(true);r.node('practiceMode').checked=true;r.click('start');
 assert.equal(r.read('db.active.practice'),true);assert.equal(r.read('db.active.events.find(e=>/^started/.test(e.event)).mode'),'practice');
 assert.equal(r.node('modeBanner').textContent,'PRACTICE — NOT RECORDED');assert.equal(r.node('end').textContent,'End Practice');assert.equal(r.node('discardLive').textContent,'Discard Practice');
 assert.notEqual(r.node('end').textContent,'End Workout & Save');
 const again=runtime({release:true,data:r.data});assert.equal(again.read('db.active.practice'),true,'mode is fixed across reload');
 again.node('practiceMode').checked=false;again.read('(render(),1)');assert.equal(again.read('db.active.practice'),true,'unticking the box mid-session cannot switch to live');
 for(const n of [12,25,9])again.input('reps',String(n)),again.click('record');
 again.time(120000);again.tick();again.click('recover');for(const n of [8,17,6])again.input('reps',String(n)),again.click('record');
 again.click('end');again.click('saveNow');
 assert.equal(again.read('db.history.length'),0,'practice never writes history');assert.equal(again.read('db.active'),null);
 assert.equal(again.read('JSON.stringify(db.settings?.ladder?.events||[]).includes("graduated")'),false,'25 jump squats in practice never graduates the ladder');
});
test('owner #115 Discard Workout: live session shows it beside Finish & Save; discard writes nothing and keeps earlier history',()=>{
 const r=runtime({release:true});
 r.click('start');for(const n of [10,20,8])r.input('reps',String(n)),r.click('record');r.time(120000);r.tick();r.click('recover');for(const n of [7,14,6])r.input('reps',String(n)),r.click('record');r.click('end');r.click('saveNow');
 assert.equal(r.read('db.history.length'),1);const saved=JSON.stringify(r.read('db.history'));
 r.click('start');assert.equal(r.node('modeBanner').textContent,'LIVE WORKOUT — RECORDED');assert.equal(r.node('end').textContent,'Finish & Save Workout');
 assert.equal(r.node('discardLive').classList.contains('hidden'),false);
 r.input('reps','30');r.click('record');
 r.confirm(false);r.node('discardLive').onclick();assert.equal(r.read('!!db.active'),true,'cancel keeps the session');
 r.confirm(true);r.node('discardLive').onclick();
 assert.equal(r.read('db.active'),null);assert.equal(JSON.stringify(r.read('db.history')),saved,'earlier workout untouched, nothing new saved');
 assert.equal(runtime({release:true,data:r.data}).read('db.history.length'),1,'no ghost write after reload');
});
test('owner #115 transitions: green check + saved reps, CURRENT highlight, 3-second trial transition, early Ready, no rep capture in between',()=>{
 const r=runtime({release:true,autoCountdown:false});
 r.click('start');r.time(3000);r.tick();
 assert.equal(r.node('stationState0').textContent,'CURRENT · Go');assert.equal(r.node('stationState1').textContent,'Up next');
 assert.equal(r.node('station1').classList.contains('pending'),true);
 r.input('reps','12');r.click('record');
 assert.equal(r.node('stationState0').textContent,'✓ 12 reps saved');assert.equal(r.node('station0').classList.contains('completed'),true);
 assert.equal(r.node('stationState1').textContent,'CURRENT · Get set');assert.equal(r.read('db.active.transitionSeconds'),3);
 assert.match(r.node('status').textContent,/^Next: .* in 3$/,'owner Nov 12 11:10 PM: visible 3-2-1 countdown restored');assert.equal(r.node('focusCount').classList.contains('hidden'),false);
 assert.throws(()=>r.read('Pure.reps(db.active,"9",Date.now())'),/Resume the exercise first/,'no rep capture during the transition');
 assert.equal(r.node('readyNow').classList.contains('hidden'),true,'owner 11:14 PM: no Ready button');
 const go=r.tones.filter(n=>n===1047).length;r.node('readyNow').onclick();
 assert.equal(r.read('!!db.active.countdownUntil'),false);assert.equal(r.tones.filter(n=>n===1047).length,go+1,'distinct start cue on early Ready');
 assert.equal(r.read('db.active.events.some(e=>e.event==="ready-early")'),true);assert.equal(r.node('stationState1').textContent,'CURRENT · Go');
 const again=runtime({release:true,data:r.data,autoCountdown:false});assert.equal(again.node('stationState0').textContent,'✓ 12 reps saved','highlight survives reload');
});
test('owner Nov 12 sounds: ding (A) for each save, cha-ching (C) for a new personal best; practice never earns a best',()=>{
 const r=runtime({release:true});r.click('start');for(const n of [10,20,8])r.input('reps',String(n)),r.click('record');r.time(120000);r.tick();r.click('recover');for(const n of [7,14,6])r.input('reps',String(n)),r.click('record');r.click('end');r.click('saveNow');
 r.click('start');const t0=r.tones.length;r.input('reps','11');r.click('record');
 assert.deepEqual(r.tones.slice(t0).filter(n=>[1320,2637].includes(n)),[2637],'11 beats the best of 10: cha-ching');
 const t1=r.tones.length;r.input('reps','19');r.click('record');assert.deepEqual(r.tones.slice(t1).filter(n=>[1320,2637].includes(n)),[1320],'19 under 20: ding');
});
test('owner Nov 12 11:14 PM: silent start countdown then the start chime; coach voice is an optional on/off switch, off by default',()=>{
 const r=runtime({release:true,autoCountdown:false});
 assert.equal(r.node('coachVoiceOn').checked,false);
 r.click('start');const before=r.tones.length;r.time(1000);r.tick();r.time(1000);r.tick();
 assert.equal(r.tones.length,before,'no ticks during the countdown');r.time(1500);r.tick();
 assert.equal(r.tones.slice(before).filter(n=>n===1047).length,1,'one start chime');assert.deepEqual(r.spoken,[]);
 r.node('coachVoiceOn').checked=true;r.node('coachVoiceOn').onchange();assert.equal(r.read('sound().voice'),1);
 r.input('reps','10');r.click('record');assert.ok(r.spoken.some(t=>/Repetitions recorded\. 10/.test(t)),'switch on: coach speaks');
});
test('#118 finding: a renamed display label keeps the baseline when both rows carry the same stable exercise ID; legacy name fallback stays',()=>{
 const r=runtime({release:true});
 const w={id:'h1',started:'2026-10-20T10:00:00Z',status:'complete',exercisePlan:[{category:'Push',name:'Old label',variant:'',exerciseId:'push-3-decline'}],records:[{round:'maximum',exercise:'Push',reps:12,exerciseId:'push-3-decline',exerciseName:'Old label',variation:''}]};
 r.read('(db.history.push('+JSON.stringify(w)+'),1)');
 assert.equal(r.read('Pure.historicalMaximum(db.history,{category:"Push",name:"Decline push-ups",variant:"",exerciseId:"push-3-decline"})?.maximumReps'),12,'same ID, renamed label');
 assert.equal(r.read('Pure.historicalMaximum(db.history,{category:"Push",name:"Old label",variant:"",exerciseId:"push-4-ring"})'),null,'different ID never matches, even with the same name');
 assert.equal(r.read('Pure.historicalMaximum(db.history,{category:"Push",name:"Old label",variant:""})?.maximumReps'),12,'legacy name match when the move has no ID');
});
test('#118 finding: an accepted correction plays the audible success cue only after verified persistence',()=>{
 const r=runtime({release:true});r.click('start');r.input('reps','10');r.click('record');
 const t=r.tones.length;r.read('(correctRecord(0,"11"),1)');assert.equal(r.read('db.active.records[0].reps'),11);
 assert.ok(r.tones.slice(t).includes(1320),'ding after a saved correction');
 r.writeFault('drop');const t2=r.tones.length;r.read('(correctRecord(0,"12"),1)');assert.ok(!r.tones.slice(t2).includes(1320),'no success cue when the write fails');
});
