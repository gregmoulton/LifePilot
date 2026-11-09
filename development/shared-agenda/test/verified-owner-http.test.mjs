// In-process HTTP integration test for the verified-owner boundary. Fictional identities and a fake
// token verifier only; no network, credentials or real profiles. Real Google OIDC is a separate gate.
import {test,before,after} from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';
import {verifiedOwnerProfile,stripIdentityHeaders} from '../lib/verified-owner.mjs';import {validProfile} from '../lib/profile-validator.js';

const OWNER_SUB='fictional-owner-sub-1001',OTHER_SUB='fictional-other-sub-2002',future=()=>Math.floor(Date.now()/1000)+600;
const TOKENS={'tok.owner':()=>({sub:OWNER_SUB,exp:future()}),'tok.other':()=>({sub:OTHER_SUB,exp:future()}),
 'tok.lapsed':()=>({sub:OWNER_SUB,exp:Math.floor(Date.now()/1000)-5}),'tok.nosub':()=>({exp:future()})};
// Fake verifier: an unknown token, or one whose real signature check would fail, throws.
const fakeVerify=async t=>{if(t==='tok.expired')throw new Error('expired');const c=TOKENS[t];if(!c)throw new Error('bad signature');return c();};
const FORGED={'oai-authenticated-user-id':'forged-id','oai-authenticated-user-email':'owner@example.test'};
const profile=n=>({goals:[],execution:{tasks:[{id:'t'+n,name:'Fictional task '+n}]}});

let sql,ops,server,base,handler;
function db(){return {prepare(q){ops.push(q);return {bind(...a){return {async first(){return sql.prepare(q).get(...a)||null;},async run(){return {meta:sql.prepare(q).run(...a)};}};}};}};}
function serve(h){return createServer(async(req,res)=>{
 const chunks=[];for await(const c of req)chunks.push(c);
 const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(typeof v==='string')headers.set(k,v);
 const r=new Request(base+req.url,{method:req.method,headers,...(chunks.length?{body:Buffer.concat(chunks)}:{})});
 const out=await h.current(r,db(),validProfile);
 res.writeHead(out.status,Object.fromEntries(out.headers));res.end(Buffer.from(await out.arrayBuffer()));
});}
const call=(method,headers={},body)=>fetch(base+'/api/profile',{method,headers:{origin:base,'content-type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});
const bearer=t=>({authorization:'Bearer '+t});
const h={current:null};
before(async()=>{server=serve(h);await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;});
after(()=>server.close());
function reset(cfg={verifyIdToken:fakeVerify,ownerSubs:[OWNER_SUB]}){
 sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../drizzle/0000_friendly_hannibal_king.sql',import.meta.url),'utf8'));
 // A row stored under the forged header identity must stay unreachable.
 sql.prepare('INSERT INTO shared_profiles(owner_id,revision,payload,updated_at) VALUES(?,1,?,?)').run('forged-id',JSON.stringify(profile('forged')),'2026-01-01T00:00:00Z');
 ops=[];h.current=verifiedOwnerProfile(cfg);
}
const rows=()=>sql.prepare('SELECT owner_id,revision,payload FROM shared_profiles ORDER BY owner_id').all().map(r=>({...r}));

for(const [name,headers,status] of [
 ['no bearer token with matching forged headers',{...FORGED},401],
 ['malformed bearer token with forged headers',{...FORGED,authorization:'Bearer not a token!'},401],
 ['non-bearer scheme with forged headers',{...FORGED,authorization:'Basic dG9rLm93bmVy'},401],
 ['token with a bad signature with forged headers',{...FORGED,...bearer('tok.forged')},401],
 ['expired token (verifier rejects) with forged headers',{...FORGED,...bearer('tok.expired')},401],
 ['token with past exp (boundary rejects) with forged headers',{...FORGED,...bearer('tok.lapsed')},401],
 ['verified claims without sub',{...FORGED,...bearer('tok.nosub')},401],
 ['valid non-owner token with forged owner headers',{...FORGED,...bearer('tok.other')},403],
])test(name+' => '+status+' on GET and PUT with zero storage access',async()=>{
 reset();const before=rows();
 for(const m of ['GET','PUT']){const r=await call(m,headers,m==='PUT'?{revision:0,profile:profile(1)}:undefined);assert.equal(r.status,status,m);
  assert.equal(r.headers.get('cache-control'),'no-store');const b=await r.json();assert.ok(b.error);assert.equal(b.profile,undefined);}
 assert.deepEqual(ops,[]);assert.deepEqual(rows(),before);
});

test('fails closed (503, zero storage access) when the verifier or owner allowlist is absent',async()=>{
 for(const cfg of [{},{verifyIdToken:fakeVerify},{verifyIdToken:fakeVerify,ownerSubs:[]},{verifyIdToken:fakeVerify,ownerSubs:['']},{ownerSubs:[OWNER_SUB]},{verifyIdToken:'yes',ownerSubs:[OWNER_SUB]}]){
  reset(cfg);const before=rows();
  for(const m of ['GET','PUT']){const r=await call(m,{...FORGED,...bearer('tok.owner')},m==='PUT'?{revision:0,profile:profile(1)}:undefined);assert.equal(r.status,503);}
  assert.deepEqual(ops,[]);assert.deepEqual(rows(),before);
 }
});

test('valid owner token is authorized for GET and PUT, keyed to the verified sub',async()=>{
 reset();
 let r=await call('GET',bearer('tok.owner'));assert.equal(r.status,200);assert.deepEqual(await r.json(),{revision:0,profile:null});
 r=await call('PUT',bearer('tok.owner'),{revision:0,profile:profile(1)});assert.equal(r.status,200);assert.equal((await r.json()).revision,1);
 r=await call('PUT',bearer('tok.owner'),{revision:1,profile:profile(2)});assert.equal(r.status,200);assert.equal((await r.json()).revision,2);
 r=await call('GET',bearer('tok.owner'));const b=await r.json();assert.equal(b.revision,2);assert.deepEqual(b.profile,profile(2));
 assert.deepEqual(rows().map(x=>x.owner_id),['forged-id','google:'+OWNER_SUB]);
 r=await call('PUT',bearer('tok.owner'),{revision:1,profile:profile(3)});assert.equal(r.status,409);
});

test('forged identity headers cannot change the verified principal',async()=>{
 reset();
 let r=await call('PUT',{...FORGED,...bearer('tok.owner')},{revision:0,profile:profile(7)});assert.equal(r.status,200);
 r=await call('GET',{...FORGED,...bearer('tok.owner')});const b=await r.json();assert.deepEqual(b.profile,profile(7));
 const all=rows();assert.equal(all.find(x=>x.owner_id==='forged-id').payload,JSON.stringify(profile('forged')));
 assert.equal(all.find(x=>x.owner_id==='google:'+OWNER_SUB).payload,JSON.stringify(profile(7)));
 assert.equal(all.length,2);
});

test('cross-origin PUT with a valid owner token is still refused before storage',async()=>{
 reset();const before=rows();
 const r=await call('PUT',{...bearer('tok.owner'),origin:'https://elsewhere.example.test'},{revision:0,profile:profile(1)});
 assert.equal(r.status,403);assert.deepEqual(ops,[]);assert.deepEqual(rows(),before);
});

test('stripIdentityHeaders removes every oai-authenticated-* header and keeps the rest',async()=>{
 const r=stripIdentityHeaders(new Request('https://pilot.example.test/api/profile',{method:'PUT',headers:{...FORGED,'OAI-Authenticated-Extra':'x',authorization:'Bearer tok.owner','content-type':'application/json'},body:'{"a":1}'}));
 assert.deepEqual([...r.headers.keys()].sort(),['authorization','content-type']);assert.equal(await r.text(),'{"a":1}');
});
