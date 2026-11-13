const {test}=require('node:test'),a=require('node:assert/strict'),D=require('../dist/devices.js');
test('voice parses explicit reps and commands, rejects ambiguous speech',()=>{for(const [s,n] of [['12 reps',12],['record twenty one reps',21],['zero reps',0]])a.deepEqual(D.command(s),{type:'reps',value:n});a.deepEqual(D.command('pause workout'),{type:'pause'});for(const s of ['maybe twelve','record fifty twenty reps','delete everything','10000 reps'])a.equal(D.command(s),null)});
test('HR parses standard 8 and 16 bit packets and rejects missing contact',()=>{a.equal(D.heartRate(new DataView(Uint8Array.from([0,105]).buffer)),105);a.equal(D.heartRate(new DataView(Uint8Array.from([1,130,0]).buffer)),130);for(const v of [[1,100],[0,0],[4,105]])a.throws(()=>D.heartRate(new DataView(Uint8Array.from(v).buffer)))});
test('voice deduplicates final callbacks and ignores interim speech',()=>{let r,heard=[],states=[];class R{constructor(){r=this}start(){}abort(){this.onend()}}const v=new D.Voice({recognition:R,onText:s=>heard.push(s),onState:s=>states.push(s),onError(){}});v.start();let results=[Object.assign([{transcript:'12 reps'}],{isFinal:false})];r.onresult({resultIndex:0,results});a.equal(heard.length,0);results[0].isFinal=true;r.onresult({resultIndex:0,results});r.onresult({resultIndex:0,results});a.deepEqual(heard,['12 reps']);v.stop();a.equal(v.running,false)});
test('monitor freshness expires; disconnect removes stale reading',()=>{let t=1000;const m=new D.Monitor({clock:()=>t,onReading(){},onState(){}});m.latest={bpm:100,timestamp:t};a.equal(m.fresh().bpm,100);t+=15001;a.equal(m.fresh(),null);m.disconnect();a.equal(m.latest,null)});
test('monitor connects only standard HR service, starts notifications and handles disconnect',async()=>{let handler,deviceHandler,started=false,readings=[],states=[],choice;const characteristic={addEventListener(n,f){handler=f},removeEventListener(){},async startNotifications(){started=true}},device={addEventListener(n,f){deviceHandler=f},removeEventListener(){},gatt:{connected:true,disconnect(){this.connected=false},async connect(){return {async getPrimaryService(n){a.equal(n,'heart_rate');return {async getCharacteristic(n){a.equal(n,'heart_rate_measurement');return characteristic}}}}}}};const m=new D.Monitor({bluetooth:{async requestDevice(o){choice=o;return device}},onReading:r=>readings.push(r),onState:s=>states.push(s)});await m.connect();a.deepEqual(choice,{filters:[{services:['heart_rate']},{namePrefix:'MOOFIT'},{namePrefix:'Moofit'},{namePrefix:'moofit'}],optionalServices:['heart_rate']});a.equal(started,true);handler({target:{value:new DataView(Uint8Array.from([0,108]).buffer)}});a.equal(readings[0].bpm,108);deviceHandler();a.equal(m.fresh(),null);a.match(states.at(-1),/disconnected/)});
test('voice continuous results deduplicate within one recognition session',()=>{let r,heard=[];class R{constructor(){r=this}start(){this.onstart?.()}abort(){this.onend?.()}}const v=new D.Voice({recognition:R,onText:s=>heard.push(s),onState(){},onError(){}});v.start();const results=[Object.assign([{transcript:'10 reps'}],{isFinal:true})];r.onresult({resultIndex:0,results});results.push(Object.assign([{transcript:'8 reps'}],{isFinal:true}));r.onresult({resultIndex:1,results});r.onresult({resultIndex:1,results});a.deepEqual(heard,['10 reps','8 reps']);a.equal(v.running,true)});
test('microphone permission denial disables automatic restart',()=>{let r;class R{constructor(){r=this}start(){}abort(){}}const v=new D.Voice({recognition:R,onText(){},onState(){},onError(){}});v.start();r.onerror({error:'not-allowed'});r.onend();a.equal(v.wanted,false);a.equal(v.running,false)});

test('quiet recognition sessions keep voice enabled beyond three normal endings',()=>{let now=0,current,queue=[],heard=[];class R{constructor(){current=this}start(){this.onstart?.()}abort(){this.onend?.()}}const voice=new D.Voice({recognition:R,clock:()=>now,schedule:fn=>{queue.push(fn);return queue.length},cancel(){},onText:t=>heard.push(t),onState(){},onError(){}});voice.start();for(let i=0;i<8;i++){now+=4000;current.onerror({error:'no-speech'});current.onend();a.equal(voice.wanted,true);a.equal(queue.length,1);queue.shift()();a.equal(voice.running,true)}current.onresult({resultIndex:0,results:[Object.assign([{transcript:'10 reps'}],{isFinal:true})]});a.deepEqual(heard,['10 reps']);voice.stop()});
test('repeated immediate failures stop instead of looping the microphone indefinitely',()=>{let current,queue=[],now=0;class R{constructor(){current=this}start(){}abort(){}}const voice=new D.Voice({recognition:R,clock:()=>now,schedule:fn=>{queue.push(fn);return queue.length},cancel(){},onText(){},onState(){},onError(){}});voice.start();for(let i=0;i<24;i++){now+=500;current.onend();if(queue.length)queue.shift()()}a.equal(voice.running,false);a.equal(voice.wanted,false);a.equal(queue.length,0)});
test('stop cancels a queued restart and stale callbacks cannot restart voice',()=>{let current,queued,cancelled=false,starts=0,now=0;class R{constructor(){current=this}start(){starts++}abort(){this.onend?.()}}const voice=new D.Voice({recognition:R,clock:()=>now,schedule:fn=>{queued=fn;return 1},cancel:()=>{cancelled=true},onText(){},onState(){},onError(){}});voice.start();now=4000;current.onend();voice.stop();queued();a.equal(starts,1);a.equal(cancelled,true);a.equal(voice.wanted,false)});

test('rapid browser endings cannot exhaust listening before ten-second grace window',()=>{let now=0,current,queue=[],heard=[];class R{constructor(){current=this}start(){}abort(){}}const voice=new D.Voice({recognition:R,clock:()=>now,schedule:fn=>{queue.push(fn);return queue.length},cancel(){},onText:s=>heard.push(s),onState(){},onError(){}});voice.start();for(let i=0;i<8;i++){now+=500;current.onend();queue.shift()();a.equal(voice.wanted,true)}current.onresult({resultIndex:0,results:[Object.assign([{transcript:'10 reps'}],{isFinal:true})]});a.deepEqual(heard,['10 reps']);voice.stop()});


test('voice survives a cluster of short normal Chrome endings after the first ten seconds',()=>{
 let now=20000,current,queue=[],heard=[];class R{constructor(){current=this}start(){this.onstart?.()}abort(){}}
 const voice=new D.Voice({recognition:R,clock:()=>now,schedule:fn=>{queue.push(fn);return queue.length},cancel(){},onText:t=>heard.push(t),onState(){},onError(){}});
 voice.start();for(let i=0;i<7;i++){now+=500;current.onend();a.equal(voice.wanted,true,'voice must remain wanted across normal Chrome stops');a.equal(queue.length,1);queue.shift()();a.equal(voice.running,true)}
 current.onresult({resultIndex:0,results:[Object.assign([{transcript:'8 reps'}],{isFinal:true})]});
 a.deepEqual(heard,['8 reps']);voice.stop();
});


test('HRM connection times out instead of remaining Connecting forever; retry works',async()=>{
 let wake,callbacks=[],connectCalls=0;
 const characteristic={addEventListener(){},removeEventListener(){},async startNotifications(){}};
 const device={addEventListener(){},removeEventListener(){},gatt:{connected:false,disconnect(){this.connected=false},connect(){connectCalls++;if(connectCalls===1)return new Promise(()=>{});this.connected=true;return Promise.resolve({getPrimaryService:async()=>({getCharacteristic:async()=>characteristic})})}}};
 const mon=new D.Monitor({bluetooth:{requestDevice:async()=>device},onReading(){},onState:s=>callbacks.push(s),schedule:fn=>{wake=fn;return 100},cancel(){},timeoutMs:15});
 const first=mon.connect();for(let i=0;i<15&&connectCalls<1;i++)await Promise.resolve();
 a.equal(connectCalls,1,'GATT connect must begin after chooser resolves');
 a.equal(typeof wake,'function','GATT timeout must be armed');
 wake();await a.rejects(first,/Bluetooth connection timed out/);
 a.equal(mon.device,null);
 await mon.connect();a.equal(connectCalls,2);
 a.match(callbacks.at(-1),/Waiting for first live BPM/);
});
test('cancelled connection cannot install stale Bluetooth characteristic',async()=>{
 let fulfill;
 const device={addEventListener(){},removeEventListener(){},gatt:{connected:false,disconnect(){},connect(){return new Promise(resolve=>fulfill=resolve)}}};
 const mon=new D.Monitor({bluetooth:{async requestDevice(){return device}},onState(){},onReading(){}});
 const first=mon.connect();for(let i=0;i<15&&typeof fulfill!=='function';i++)await Promise.resolve();a.equal(typeof fulfill,'function');mon.disconnect();
 fulfill({getPrimaryService:async()=>({})});
 await a.rejects(first,/interrupted|superseded/);
 a.equal(mon.device,null);
});


test('paired HRM with no BPM times out visibly and releases GATT for retry',async()=>{
 let selected=0,clock=1000,tasks=[],states=[];
 const characteristic={addEventListener(){},removeEventListener(){},async startNotifications(){}};
 const device={addEventListener(){},removeEventListener(){},gatt:{connected:false,disconnect(){this.connected=false},async connect(){this.connected=true;return {getPrimaryService:async()=>({getCharacteristic:async()=>characteristic})}}}};
 const m=new D.Monitor({bluetooth:{requestDevice:async()=>{selected++;return device}},onReading(){},onState:s=>states.push(s),clock:()=>clock,schedule:fn=>{tasks.push(fn);return tasks.length},cancel(){},timeoutMs:1000});
 await m.connect();
 a.equal(selected,1);
 a.match(states.at(-1),/Waiting for first live BPM/);
 clock+=1001;
 tasks.at(-1)();
 a.equal(m.fresh(),null);
 a.equal(m.device,null,'GATT disconnected so retry can restart cleanly');
 a.equal(device.gatt.connected,false);
 a.match(states.at(-1),/No live BPM received/);
 await m.connect();
 a.equal(selected,2,'user can retry after no-reading timeout');
 m.disconnect();
});

test('expanded scan authorizes HR GATT service even if wearable does not advertise it',async()=>{
 let options,gotService=false;
 const characteristic={addEventListener(){},removeEventListener(){},async startNotifications(){}};
 const device={addEventListener(){},removeEventListener(){},gatt:{connected:true,disconnect(){this.connected=false},async connect(){return {getPrimaryService:async name=>{gotService=name==='heart_rate';return {getCharacteristic:async()=>characteristic}}}}}};
 const m=new D.Monitor({bluetooth:{requestDevice:async o=>{options=o;return device}},onReading(){},onState(){}});
 await m.connect({broadScan:true});
 a.deepEqual(options,{acceptAllDevices:true,optionalServices:['heart_rate']});
 a.equal(gotService,true);
});

test('Chrome chooser handoff timeout reports stage and leaves no false connection',async()=>{
 let timedOut,states=[];
 const mon=new D.Monitor({bluetooth:{requestDevice:()=>new Promise(()=>{})},onState:s=>states.push(s),onReading(){},schedule:fn=>{timedOut=fn;return 123},cancel(){},timeoutMs:20});
 const outcome=mon.connect();
 a.equal(typeof timedOut,'function','requestDevice stage must receive a watchdog immediately');
 timedOut();
 await a.rejects(outcome,/Chrome Bluetooth device selection timed out/);
 a.equal(mon.device,null);
 a.equal(mon.fresh(),null);
 a.match(states.at(-1),/Pair\/Connect/);
});
test('previously authorized MOOFIT bypasses the failed picker and resumes heart-rate notifications',async()=>{
 let pickerCalls=0,selected;
 const characteristic={addEventListener(){},removeEventListener(){},async startNotifications(){selected=true}};
 const device={name:'MOOFIT HRM',addEventListener(){},removeEventListener(){},gatt:{connected:false,disconnect(){this.connected=false},async connect(){this.connected=true;return {getPrimaryService:async()=>({getCharacteristic:async()=>characteristic})}}}};
 const mon=new D.Monitor({bluetooth:{getDevices:async()=>[device],requestDevice:()=>{pickerCalls++;throw Error('Picker should not open')}},onState(){},onReading(){}});
 await mon.connect({previouslyAllowed:true});
 a.equal(pickerCalls,0);a.equal(selected,true);a.equal(mon.device,device);
 mon.disconnect();
});
test('previously authorized retry rejects ambiguous or absent devices instead of connecting a stranger',async()=>{
 let connected=false;
 const bad={name:'Bluetooth keyboard',gatt:{connect(){connected=true}}};
 const mon=new D.Monitor({bluetooth:{getDevices:async()=>[bad]},onState(){},onReading(){}});
 await a.rejects(mon.connect({previouslyAllowed:true}),/No previously authorized MOOFIT/);
 a.equal(connected,false);
});


test('browser-branded timers work for real BLE connect and cancel (regression: Illegal invocation)',async()=>{
 const vm=require('node:vm'),fs=require('node:fs');
 const sandbox={setTimeout:null,clearTimeout:null};
 let timerId=0,scheduled=0,cancelled=0;
 sandbox.setTimeout=function(fn,ms){if(this!==sandbox.windowOwner)throw new TypeError('Illegal invocation');scheduled++;return ++timerId};
 sandbox.clearTimeout=function(id){if(this!==sandbox.windowOwner)throw new TypeError('Illegal invocation');cancelled++};
 vm.createContext(sandbox);
 sandbox.windowOwner=vm.runInContext('globalThis',sandbox);
 const deviceCode=fs.readFileSync(require.resolve('../dist/devices.js'),'utf8');
 const DeviceMonitor=vm.runInContext(deviceCode+'; PureDevices.Monitor',sandbox);
 const characteristic={addEventListener(){},removeEventListener(){},async startNotifications(){}};
 const device={name:'MOOFIT',addEventListener(){},removeEventListener(){},gatt:{connected:false,disconnect(){this.connected=false},async connect(){this.connected=true;return {getPrimaryService:async()=>({getCharacteristic:async()=>characteristic})}}}};
 const monitor=new DeviceMonitor({bluetooth:{async requestDevice(){return device}},onReading(){},onState(){}});
 await monitor.connect();
 a(scheduled>=5,'every browser GATT stage uses a window timer');
 a(cancelled>=4,'stage timeouts are cleared with correct browser context');
 monitor.disconnect();
 a.equal(monitor.device,null);
});
test('browser-branded timer allows voice auto-reconnect without Illegal invocation',()=>{
 const vm=require('node:vm'),fs=require('node:fs');
 const sandbox={setTimeout:null,clearTimeout:null};
 let scheduled=0,cancelled=0;
 sandbox.setTimeout=function(){if(this!==sandbox.windowOwner)throw new TypeError('Illegal invocation');scheduled++;return 1};
 sandbox.clearTimeout=function(){if(this!==sandbox.windowOwner)throw new TypeError('Illegal invocation');cancelled++};
 vm.createContext(sandbox);
 sandbox.windowOwner=vm.runInContext('globalThis',sandbox);
 const Voice=vm.runInContext(fs.readFileSync(require.resolve('../dist/devices.js'),'utf8')+';PureDevices.Voice',sandbox);
 let r;
 class Recognition{constructor(){r=this}start(){}abort(){}}
 const voice=new Voice({recognition:Recognition,onText(){},onState(){},onError(){}});
 voice.start();r.onend();
 a.equal(scheduled,1);voice.stop();a.equal(cancelled,1);
});
test('owner #115: exercise-qualified voice phrases parse to the right exercise',()=>{
 const D=require('../dist/devices.js'),c=D.command,a=require('node:assert/strict');
 a.deepEqual(c('Push done, 10 reps'),{type:'reps',value:10,exercise:'Push'});
 a.deepEqual(c('squats done four reps'),{type:'reps',value:4,exercise:'Squat'});
 a.deepEqual(c('pull eight reps'),{type:'reps',value:8,exercise:'Pull'});
 a.deepEqual(c('correct squats to six'),{type:'correct',value:6,exercise:'Squat'});
 a.deepEqual(c('change push to 10'),{type:'correct',value:10,exercise:'Push'});
 a.deepEqual(c('read back my round'),{type:'readback'});a.deepEqual(c('undo last entry'),{type:'undo'});
 a.deepEqual(c('twelve reps'),{type:'reps',value:12},'unqualified entry unchanged');
 a.equal(c('pull done banana'),null);
});
