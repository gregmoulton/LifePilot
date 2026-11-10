// Browser sign-in adapter (public/google-sign-in.js) and its use by shared-sync.js. Fictional token stubs only:
// Google Identity Services is replaced by a fake `google.accounts.id`; nothing is loaded from the network.
import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {withGoogleClientId} from '../lib/page-config.mjs';
const adapter=readFileSync(new URL('../public/google-sign-in.js',import.meta.url),'utf8'),sync=readFileSync(new URL('../public/shared-sync.js',import.meta.url),'utf8');
const CLIENT='fictional-client-123.apps.googleusercontent.com';
const jwt=(exp,extra={})=>'eyJhbGciOiJSUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:'fictional-owner-sub-1001',exp,...extra})).toString('base64url')+'.fictional-signature';
const soon=s=>Math.floor(Date.now()/1000)+s;

function boot({client=CLIENT,gis='present',reply,fetchImpl}={}){
 const scripts=[],stored=[],logged=[],calls=[],timers=[];let gisConfig=null,prompts=0,buttons=0,autoOff=0;
 const box={hidden:true};
 const gisApi={initialize(c){gisConfig=c;},prompt(){prompts++;if(reply!==undefined)queueMicrotask(()=>gisConfig.callback(typeof reply==='function'?reply():reply));},renderButton(){buttons++;},disableAutoSelect(){autoOff++;}};
 const ctx={atob,Headers,Response,Promise,JSON,Number,Object,Error,Date,queueMicrotask,URL,String,location:{href:'https://pilot.example.test/app?x=1',origin:'https://pilot.example.test'},
  setTimeout:(f,ms)=>{timers.push(ms);return setTimeout(f,Math.min(ms,20));},clearTimeout,
  console:{log:(...a)=>logged.push(a),warn:(...a)=>logged.push(a),error:(...a)=>logged.push(a),info:(...a)=>logged.push(a)},
  localStorage:{setItem:(k,v)=>stored.push([k,v]),getItem:()=>null,removeItem(){}},
  sessionStorage:{setItem:(k,v)=>stored.push([k,v]),getItem:()=>null,removeItem(){}},
  document:{querySelector:q=>q==='meta[name=lifepilot-google-client-id]'&&client!==null?{content:client}:null,getElementById:id=>id==='sharedSignIn'?box:null,
   createElement:()=>({}),head:{appendChild(s){scripts.push(s.src);queueMicrotask(()=>{if(gis==='loads'){ctx.google={accounts:{id:gisApi}};s.onload();}else s.onerror();});}}},
  fetch:async(url,init)=>{calls.push({url,init});return fetchImpl?fetchImpl(url,init):Response.json({ok:true});},
 };
 if(gis==='present')ctx.google={accounts:{id:gisApi}};
 ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(adapter,ctx);
 return {ctx,auth:ctx.LifePilotAuth,scripts,stored,logged,calls,timers,box,get config(){return gisConfig;},get prompts(){return prompts;},get buttons(){return buttons;},get autoOff(){return autoOff;}};
}
const leaks=(b,t)=>{const all=JSON.stringify([b.stored,b.logged]);assert.ok(!all.includes(t),'token leaked to storage or console');};

test('unconfigured page refuses sign-in without loading Google or calling the server',async()=>{
 for(const client of [null,'','bad id"><script>']){const b=boot({client,gis:'loads'});
  await assert.rejects(b.auth.signIn(),e=>e.authRequired===true&&/not set up/.test(e.message));
  await assert.rejects(b.auth.fetch('/api/profile'),e=>e.authRequired===true);
  assert.deepEqual(b.scripts,[]);assert.equal(b.calls.length,0);}
});
test('Google script is loaded only from the official origin, once',async()=>{
 const t=jwt(soon(3600)),b=boot({gis:'loads',reply:{credential:t}});
 assert.equal(await b.auth.signIn(),t);assert.deepEqual(b.scripts,['https://accounts.google.com/gsi/client']);
 assert.equal(b.config.client_id,CLIENT);assert.equal(b.config.auto_select,true);
 await b.auth.signIn();assert.equal(b.scripts.length,1);
 const f=boot({gis:'fails'});await assert.rejects(f.auth.signIn(),e=>e.authRequired&&/could not load/.test(e.message));
});
test('signed-in fetch sends a bearer token same-origin; token never stored or logged',async()=>{
 const t=jwt(soon(3600)),b=boot({reply:{credential:t}});
 await b.auth.signIn();assert.equal(b.auth.signedIn(),true);assert.equal(b.box.hidden,true);assert.equal(b.buttons,1);
 await b.auth.fetch('/api/profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:'{}'});
 const {url,init}=b.calls[0];assert.equal(url,'https://pilot.example.test/api/profile');assert.equal(init.redirect,'error');assert.equal(init.headers.get('authorization'),'Bearer '+t);assert.equal(init.headers.get('content-type'),'application/json');assert.equal(init.credentials,'same-origin');
 leaks(b,t);assert.deepEqual(b.stored,[]);assert.match(adapter,/never localStorage/);assert.doesNotMatch(adapter.replace(/\/\*[\s\S]*?\*\//,''),/localStorage|sessionStorage|document\.cookie|console\./);
});
test('expired, nearly expired, malformed or missing credentials are refused',async()=>{
 for(const credential of [jwt(soon(-10)),jwt(soon(30)),jwt(undefined),'not.a-jwt','one-part',undefined,7]){
  const b=boot({reply:{credential}});await assert.rejects(b.auth.signIn({timeoutMs:50}),e=>e.authRequired);assert.equal(b.auth.signedIn(),false);}
});
test('token expiry stops sending it; the next sign-in is required',async()=>{
 const b=boot({reply:{credential:jwt(soon(90))}});await b.auth.signIn();assert.equal(b.auth.signedIn(),true);
 const real=Date.now;b.ctx.Date={now:()=>real()+40000};
 try{assert.equal(b.auth.signedIn(),false);await assert.rejects(b.auth.fetch('/api/profile'),e=>e.authRequired);assert.equal(b.calls.length,0);}finally{b.ctx.Date=Date;}
});
test('a 401 from the server clears the token and asks for sign-in again',async()=>{
 const b=boot({reply:{credential:jwt(soon(3600))},fetchImpl:async()=>Response.json({error:'x'},{status:401})});
 await b.auth.signIn();await assert.rejects(b.auth.fetch('/api/profile'),e=>e.authRequired&&/expired/.test(e.message));
 assert.equal(b.auth.signedIn(),false);await assert.rejects(b.auth.fetch('/api/profile'),e=>e.authRequired);assert.equal(b.calls.length,1);
});
test('no Google response times out (silent attempt short, interactive long) and sign-out clears',async()=>{
 const b=boot();await assert.rejects(b.auth.signIn({interactive:false}),e=>e.authRequired);await assert.rejects(b.auth.signIn(),e=>e.authRequired);
 assert.deepEqual(b.timers,[8000,120000]);assert.equal(b.buttons,1);
 const s=boot({reply:{credential:jwt(soon(3600))}});await s.auth.signIn();s.auth.signOut();assert.equal(s.auth.signedIn(),false);assert.equal(s.autoOff,1);
});
test('page config inserts only a strictly formatted public client ID',()=>{
 const page='<html><head><title>x</title></head></html>';
 assert.match(withGoogleClientId(page,CLIENT),/<head><meta name="lifepilot-google-client-id" content="fictional-client-123\.apps\.googleusercontent\.com">/);
 for(const v of [undefined,'','a"b','<x>','a b','x'.repeat(201),7])assert.equal(withGoogleClientId(page,v),page);
 const route=readFileSync(new URL('../app/route.ts',import.meta.url),'utf8'),html=readFileSync(new URL('../app/legacy.html',import.meta.url),'utf8');
 assert.match(route,/withGoogleClientId\(content,/);assert.ok(html.indexOf('google-sign-in.js')>0&&html.indexOf('google-sign-in.js')<html.indexOf('shared-sync.js'));
});

test('bearer token is sent only to this origin\'s /api/profile; every other URL is refused before fetch',async()=>{
 const t=jwt(soon(3600)),b=boot({reply:{credential:t}});await b.auth.signIn();
 for(const url of ['https://evil.example.test/api/profile','//evil.example.test/api/profile','\\\\evil.example.test/api/profile','http://pilot.example.test/api/profile',
  'https://pilot.example.test:8443/api/profile','https://pilot.example.test.evil.example.test/api/profile','https://user:pw@pilot.example.test/api/profile',
  '/api/profile/../steal','/api/profilex','/api/profile/','/other','javascript:alert(1)','data:text/plain,x','',undefined,{toString:()=>'https://evil.example.test/api/profile'}]){
  await assert.rejects(b.auth.fetch(url),e=>!e.authRequired&&/only sent/.test(e.message),String(url));}
 assert.equal(b.calls.length,0);assert.equal(b.auth.signedIn(),true);
 for(const url of ['/api/profile','/api/profile?sandbox=1','https://pilot.example.test/api/profile','api/../api/profile'])await b.auth.fetch(url);
 assert.deepEqual(b.calls.map(c=>c.url),['https://pilot.example.test/api/profile','https://pilot.example.test/api/profile?sandbox=1','https://pilot.example.test/api/profile','https://pilot.example.test/api/profile']);
 assert.ok(b.calls.every(c=>c.init.headers.get('authorization')==='Bearer '+t));leaks(b,t);
});
test('a Google callback after the attempt timed out, or with no attempt waiting, is ignored',async()=>{
 const b=boot();const valid={credential:jwt(soon(3600))};
 await assert.rejects(b.auth.signIn({timeoutMs:30}),e=>e.authRequired);
 b.config.callback(valid);assert.equal(b.auth.signedIn(),false);
 await assert.rejects(b.auth.fetch('/api/profile'),e=>e.authRequired);assert.equal(b.calls.length,0);
 b.config.callback(valid);assert.equal(b.auth.signedIn(),false);
 const p=b.auth.signIn({timeoutMs:5000});await new Promise(r=>setTimeout(r,0));b.config.callback(valid);
 assert.equal(await p,valid.credential);assert.equal(b.auth.signedIn(),true);
});
test('concurrent sign-in calls share one attempt and one prompt',async()=>{
 const b=boot();const t=jwt(soon(3600));
 const calls=[b.auth.signIn(),b.auth.signIn({interactive:false}),b.auth.signIn()];await new Promise(r=>setTimeout(r,0));
 assert.equal(b.prompts,1);b.config.callback({credential:t});b.config.callback({credential:jwt(soon(7200),{sub:'fictional-other-sub'})});
 assert.deepEqual(await Promise.all(calls),[t,t,t]);assert.equal(b.prompts,1);
 await b.auth.fetch('/api/profile');assert.equal(b.calls[0].init.headers.get('authorization'),'Bearer '+t);
 const c=boot();const both=[c.auth.signIn({timeoutMs:30}),c.auth.signIn({timeoutMs:30})];
 for(const r of await Promise.allSettled(both))assert.equal(r.status,'rejected');assert.equal(c.prompts,1);
 c.auth.signIn({timeoutMs:5000}).catch(()=>{});await new Promise(r=>setTimeout(r,0));assert.equal(c.prompts,2);c.auth.signOut();
});

// ---- shared-sync.js with the adapter (stubbed) ----
function bootSync(auth){
 const nodes={},memory=new Map(),calls=[];let stored={goals:[],execution:{tasks:[]}};
 const ctx={KEY:'fictional-profile',localStorage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},esc:String,profile:stored,
  profileStore:{async commit(p){stored=p;return p;},async restore(p){stored=p;return p;},get value(){return stored;}},transactionRunning:false,unsavedProfile:null,transactionQueue:Promise.resolve(),
  LifePilotStorage:{validProfile:p=>Array.isArray(p?.goals)},$:id=>nodes[id]??={},document:{createElement:()=>({}),querySelector:()=>({prepend(){}}),body:{prepend(){}}},
  render(){},confirm:()=>true,setInterval(){},window:{addEventListener(){}},queueMicrotask(){},Response,console,LifePilotAuth:auth,
  fetch:async()=>{calls.push('unauthenticated');return Response.json({});}};
 ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(sync,ctx);return {ctx,nodes,memory,calls,run:c=>vm.runInContext(c,ctx)};
}
const authStub=({signedIn=false,signInOk=true}={})=>{const s={signIns:[],fetches:[],signedIn:()=>signedIn,
 async signIn(o){s.signIns.push(o.interactive);if(!signInOk)throw Object.assign(Error('Sign in with Google to sync. Local data stays on this device.'),{authRequired:true});signedIn=true;},
 async fetch(u,i){s.fetches.push(i?.method||'GET');if(!signedIn)throw Object.assign(Error('expired'),{authRequired:true});return i?.method==='PUT'?Response.json({revision:1}):Response.json({revision:0,profile:null});}};return s;};

test('connect signs in interactively first, then syncs only through the authenticated fetch',async()=>{
 const a=authStub(),b=bootSync(a);await b.ctx.sharedConnect();
 assert.deepEqual(a.signIns,[true]);assert.deepEqual(a.fetches,['GET','PUT']);assert.deepEqual(b.calls,[]);assert.equal(b.run('sharedRevision'),1);
});
test('declined sign-in on connect uploads nothing and explains',async()=>{
 const a=authStub({signInOk:false}),b=bootSync(a);await b.ctx.sharedConnect();
 assert.deepEqual(a.fetches,[]);assert.equal(b.run('sharedRevision'),null);assert.match(b.nodes.sharedStatus.textContent,/Sign in with Google/);
});
test('reopening tries a silent sign-in once; if it fails, local edits stay pending and Retry is offered',async()=>{
 const a=authStub({signInOk:false}),b=bootSync(a);b.ctx.profile={goals:[],custom:'offline'};
 b.memory.set('fictional-profile:shared-sync',JSON.stringify({version:1,revision:3,baseline:JSON.stringify({goals:[]})}));
 await b.ctx.sharedResume();assert.deepEqual(a.signIns,[false]);assert.deepEqual(a.fetches,[]);
 assert.equal(b.run('sharedPending.custom'),'offline');assert.equal(b.nodes.sharedRetry.hidden,false);assert.match(b.nodes.sharedStatus.textContent,/sign in with Google/);
});
test('sign-in expiring mid-session keeps the pending copy and asks to sign in again',async()=>{
 const a=authStub(),b=bootSync(a);b.run('sharedRevision=1;sharedPending={goals:[],custom:9}');
 await b.ctx.sharedFlush();assert.equal(b.run('sharedPending.custom'),9);assert.match(b.nodes.sharedStatus.textContent,/sign in with Google/);assert.equal(b.nodes.sharedRetry.hidden,false);
 b.run('sharedPending={goals:[],custom:10}');await b.ctx.sharedCheck();assert.match(b.nodes.sharedStatus.textContent,/sign in with Google/);assert.equal(b.run('sharedPending.custom'),10);
});
