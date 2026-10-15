import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,scryptSync} from 'node:crypto';
import {readFile,mkdtemp,writeFile,rename,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {createApp,validProposal} from './server.mjs';
import {loadConfig,issueSession} from './security.mjs';
import {RedisQuota,RESERVE_SCRIPT} from './quota.mjs';
// Random test-only fixtures. Never printed, deployed, or saved in the repository.
const password=randomBytes(32).toString('hex'),salt=randomBytes(16).toString('hex');
const config=loadConfig({PUBLIC_ORIGIN:'https://owner.example',OWNER_PASSWORD_HASH:`scrypt$${salt}$${scryptSync(password,Buffer.from(salt,'hex'),64).toString('hex')}`,SESSION_SECRET:randomBytes(32).toString('hex'),OPENAI_API_KEY:randomBytes(32).toString('hex'),UPSTASH_REDIS_REST_URL:'https://quota.example',UPSTASH_REDIS_REST_TOKEN:randomBytes(32).toString('hex')});
const proposal={action:'add',task_id:null,name:'TEST ONLY fictional plant',status:'today',due:null,goal:null,notes:null,priority:false,message:'Review this fictional task.'};
const body={command:'Add a fictional plant task',current_date:'2026-10-15',tasks:[]};
class QuotaFixture{
 constructor(){this.requests=0;this.tokens=0;this.leases=new Set();this.minute=0;this.logins=0;this.unavailable=false}
 async allowLogin(){if(this.unavailable)throw Error();return ++this.logins<=20}
 async reserve(c,n,id){if(this.unavailable)throw Error();if(this.leases.size>=c.concurrency)return 'busy';if(this.minute>=c.perMinute)return 'rate';if(this.requests>=c.dailyRequests)return 'daily';if(this.tokens+n>c.dailyTokens)return 'tokens';this.requests++;this.tokens+=n;this.minute++;this.leases.add(id);return 'ok'}
 async release(id){this.leases.delete(id)}
}
async function start(options={}){
 const quota=options.quota||new QuotaFixture();let calls=0,last;
 const server=createApp({config,quota,fetchImpl:async(u,i)=>{calls++;last=JSON.parse(i.body);return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(proposal)}}]})},...options});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,s=issueSession(config.sessionSecret);
 const headers={origin:config.origin,'content-type':'application/json',cookie:s.cookie.split(';')[0],'x-csrf-token':s.csrf};
 return {quota,base,headers,get calls(){return calls},get last(){return last},post:(b=body,h=headers)=>fetch(base+'/api/copilot',{method:'POST',headers:h,body:JSON.stringify(b)}),close:()=>new Promise(r=>{server.close(r);server.closeAllConnections()})};
}
test('absent, forged and expired owner sessions cannot reach quota or AI',async()=>{
 const a=await start();try{for(const h of [{},{origin:config.origin},{origin:config.origin,cookie:'__Host-lp_owner=forged'},{origin:config.origin,cookie:issueSession(config.sessionSecret,Date.now()-3700000).cookie.split(';')[0]}])assert.equal((await a.post(body,h)).status,401);assert.equal(a.calls,0);assert.equal(a.quota.requests,0)}finally{await a.close()}
});
test('CSRF, missing/foreign Origin and content type blocked',async()=>{
 const a=await start();try{for(const h of [{origin:''},{origin:'https://attacker.example'},{'x-csrf-token':'wrong'}])assert.equal((await a.post(body,{...a.headers,...h})).status,403);assert.equal((await a.post(body,{...a.headers,'content-type':'text/plain'})).status,415);assert.equal(a.calls,0)}finally{await a.close()}
});
test('owner login, secure cookie, restoration, throttle and logout',async()=>{
 const a=await start();try{
  const login=p=>fetch(a.base+'/api/login',{method:'POST',headers:{origin:config.origin,'content-type':'application/json'},body:JSON.stringify({password:p})});
  assert.equal((await login('invalid')).status,401);const r=await login(password);assert.equal(r.status,200);const cookie=r.headers.get('set-cookie');for(const flag of ['Secure','HttpOnly','SameSite=Strict','Path=/','Max-Age=3600'])assert(cookie.includes(flag));const s=await r.json();assert(s.csrf);assert(!JSON.stringify(s).includes(password));
  const h={...a.headers,cookie:cookie.split(';')[0],'x-csrf-token':s.csrf};assert.equal((await a.post(body,h)).status,200);assert.equal((await(await fetch(a.base+'/api/session',{headers:{cookie:h.cookie}})).json()).csrf,s.csrf);
  const out=await fetch(a.base+'/api/logout',{method:'POST',headers:h,body:'{}'});assert(out.headers.get('set-cookie').includes('Max-Age=0'));a.quota.logins=20;assert.equal((await login(password)).status,429);
 }finally{await a.close()}
});
test('missing config, missing key and unavailable quota fail closed; manual page stays available',async()=>{
 for(const c of [{...config,authReady:false},{...config,storeReady:false},{...config,key:''}]){const a=await start({config:c});try{assert.equal((await a.post()).status,503);assert.equal(a.calls,0);assert.equal((await fetch(a.base+'/')).status,200);assert.deepEqual(await(await fetch(a.base+'/health')).json(),{ok:true})}finally{await a.close()}}
 const quota=new QuotaFixture();quota.unavailable=true;const a=await start({quota});try{assert.equal((await a.post()).status,503);assert.equal(a.calls,0)}finally{await a.close()}assert.throws(()=>loadConfig({AI_MAX_OUTPUT_TOKENS:'999999'}));
});
test('fixed model/output cap and daily request/token/minute allowances',async()=>{
 const a=await start({config:{...config,dailyRequests:1}});try{assert.equal((await a.post()).status,200);assert.equal(a.last.max_completion_tokens,256);assert.equal(a.last.model,'gpt-4.1-mini');assert.equal((await a.post()).status,429);assert.equal(a.calls,1)}finally{await a.close()}
 for(const limits of [{dailyTokens:1},{perMinute:1}]){const b=await start({config:{...config,...limits}});try{if(limits.perMinute)assert.equal((await b.post()).status,200);assert.equal((await b.post()).status,429);assert.equal(b.calls,limits.perMinute?1:0)}finally{await b.close()}}
});
test('concurrent requests authorize only one upstream call',async()=>{
 let release,entered;const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r);let calls=0;
 const a=await start({fetchImpl:async()=>{calls++;entered();await gate;return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(proposal)}}]})}});
 try{const first=a.post();await started;assert.equal((await a.post()).status,429);assert.equal(calls,1);release();assert.equal((await first).status,200)}finally{release();await a.close()}
});
test('upstream failures consume allowance and never expose provider errors',async()=>{
 const a=await start({config:{...config,dailyRequests:1},fetchImpl:async()=>Response.json({error:config.key},{status:500})});try{const r=await a.post();assert.equal(r.status,502);assert(!(await r.text()).includes(config.key));assert.equal((await a.post()).status,429);assert.equal(a.quota.leases.size,1)}finally{await a.close()}
});
test('input/output validation: size, duplicate IDs, invalid dates and incomplete responses',async()=>{
 const a=await start();try{for(const b of [{...body,command:''},{...body,current_date:'2026-02-30'},{...body,tasks:[{id:'x',name:'x',status:'today'},{id:'x',name:'x',status:'today'}]}])assert.equal((await a.post(b)).status,400);assert.equal((await a.post({...body,command:'x'.repeat(13000)})).status,413);assert.equal(a.calls,0)}finally{await a.close()}
 assert(!validProposal({...proposal,due:'2026-02-30'},[]));assert(!validProposal({...proposal,action:'update',task_id:'unknown'},[]));assert(!validProposal({...proposal,unexpected:true},[]));
 const b=await start({fetchImpl:async()=>Response.json({choices:[{finish_reason:'length',message:{content:JSON.stringify(proposal)}}]})});try{assert.equal((await b.post()).status,502)}finally{await b.close()}
});
test('Redis REST adapter uses atomic EVAL and rejects unexpected/error results',async()=>{
 let cmd;const q=new RedisQuota({url:'https://quota.example',token:config.redisToken,fetchImpl:async(u,i)=>{cmd=JSON.parse(i.body);return Response.json({result:'ok'})}});assert.equal(await q.reserve(config,100,'fixture-id'),'ok');assert.equal(cmd[0],'EVAL');assert.equal(cmd[1],RESERVE_SCRIPT);assert.equal(cmd[3],'lifepilot:security:v1');assert(cmd[1].includes("redis.call('TIME')"));
 for(const response of [Response.json({error:'failure'}),Response.json({result:'unexpected'}),new Response('failure',{status:503})]){const bad=new RedisQuota({url:'https://quota.example',token:config.redisToken,fetchImpl:async()=>response});await assert.rejects(bad.reserve(config,1,'id'))}
});
test('daily allowance survives app/store restart using external persistent fixture',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'lp-quota-')),file=path.join(dir,'state.json');
 class PersistentFixture extends QuotaFixture{async reserve(c,n,id){try{Object.assign(this,JSON.parse(await readFile(file,'utf8')),{leases:new Set()})}catch{}const r=await super.reserve(c,n,id);await writeFile(file+'.tmp',JSON.stringify({requests:this.requests,tokens:this.tokens,minute:this.minute}));await rename(file+'.tmp',file);return r}}
 try{const a=await start({quota:new PersistentFixture(),config:{...config,dailyRequests:1}});assert.equal((await a.post()).status,200);await a.close();const b=await start({quota:new PersistentFixture(),config:{...config,dailyRequests:1}});try{assert.equal((await b.post()).status,429);assert.equal(b.calls,0)}finally{await b.close()}}finally{await rm(dir,{recursive:true,force:true})}
});
function browserHarness(html){
 class Element{constructor(){this.value='';this.hidden=false;this.children=[];this.dataset={};this.classList={toggle(){}}}setAttribute(){}append(...x){this.children.push(...x)}replaceChildren(...x){this.children=x}addEventListener(n,f){this['on'+n]=f}click(){return this.onclick?.()}focus(){}}
 const elements=new Map(),storage=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)};
 const context=vm.createContext({console,Date,JSON,Math,Number,String,Boolean,Object,Array,Set,Map,Promise,RegExp,crypto:{randomUUID:()=>randomBytes(8).toString('hex')},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{getElementById:get,createElement:()=>new Element(),querySelectorAll:()=>[]},prompt:()=>null,confirm:()=>true,setTimeout,fetch:async()=>Response.json({authenticated:false})});
 vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);return {context,get,storage,run:s=>vm.runInContext(s,context)};
}
test('actual frontend: offline signed out, AI pending/confirm/cancel and stale proposal protection',async()=>{
 const b=browserHarness(await readFile(new URL('./index.html',import.meta.url),'utf8'));await new Promise(r=>setTimeout(r,0));b.get('command').value='add task TEST ONLY offline';b.get('apply').onclick();assert.equal(b.run('data.tasks.length'),0);b.get('confirm-action').onclick();assert.equal(b.run('data.tasks.length'),1);
 b.get('command').value='Add fictional task';await b.get('ai-ask').onclick();assert(b.get('note').textContent.includes('Sign in'));assert.equal(b.run('data.tasks.length'),1);
 b.context.fetch=async()=>Response.json({proposal});b.run("ownerState(true,'fixture-csrf')");await b.get('ai-ask').onclick();assert.equal(b.run('data.tasks.length'),1);assert.equal(b.get('pending').hidden,false);b.get('cancel-action').onclick();assert.equal(b.run('data.tasks.length'),1);
 await b.get('ai-ask').onclick();b.run('revision++');b.get('confirm-action').onclick();assert.equal(b.run('data.tasks.length'),1);assert(b.get('note').textContent.includes('Data changed'));
 await b.get('ai-ask').onclick();b.get('confirm-action').onclick();assert.equal(b.run('data.tasks.length'),2);assert(![...b.storage.values()].some(x=>x.includes('fixture-csrf')));
 b.get('command').value='Another fictional request';b.context.fetch=async()=>Response.json({error:'Owner sign-in required'},{status:401});await b.get('ai-ask').onclick();assert.equal(b.run('ownerCsrf'),'');
});
test('offline owner helper produces compatible private settings and rejects malformed hashes',async()=>{
 const {webcrypto,pbkdf2Sync}=await import('node:crypto');
 const {verifyPassword}=await import('./security.mjs');
 const html=await readFile(new URL('./tools/owner-setup.html',import.meta.url),'utf8');
 const elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,{value:'',hidden:true,addEventListener(){}});return elements.get(id)};
 const context=vm.createContext({crypto:webcrypto,TextEncoder,Uint8Array,document:{getElementById:element,querySelectorAll:()=>[]},addEventListener(){}});
 vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);
 const p=randomBytes(32).toString('hex');context.testPassword=p;
 const settings=await vm.runInContext('makeSettings(testPassword)',context);
 assert.match(settings.hash,/^pbkdf2\$600000\$[a-f0-9]{32}\$[a-f0-9]{64}$/);
 assert.equal(await verifyPassword(p,settings.hash),true);assert.equal(await verifyPassword(p+'x',settings.hash),false);
 const parts=settings.hash.split('$');assert.equal(pbkdf2Sync(p,Buffer.from(parts[2],'hex'),600000,32,'sha256').toString('hex'),parts[3]);
 assert.equal(loadConfig({PUBLIC_ORIGIN:'https://owner.example',OWNER_PASSWORD_HASH:settings.hash,SESSION_SECRET:settings.session}).authReady,true);
 for(const bad of ['pbkdf2$1$'+parts[2]+'$'+parts[3],settings.hash+'x','invalid','scrypt$bad$bad'])assert.equal(await verifyPassword(p,bad),false);
 assert.match(settings.session,/^[a-f0-9]{64}$/);
 const next=await vm.runInContext('makeSettings(testPassword)',context);assert.notEqual(next.hash,settings.hash);assert.notEqual(next.session,settings.session);
 assert(html.includes("connect-src 'none'"));assert(html.includes("form-action 'none'"));assert(!/fetch\(|localStorage|sessionStorage|XMLHttpRequest|sendBeacon/.test(html));
});
