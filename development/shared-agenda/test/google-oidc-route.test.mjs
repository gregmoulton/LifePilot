// Google ID-token verifier and the ACTUAL public route (app/api/profile/route.ts) over in-process HTTP.
// Fictional only: signing keys are generated here, Google's JWKS endpoint is stubbed, subs/client IDs are invented.
import {test,before,after} from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'node:http';
import {register} from 'node:module';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';
import {createGoogleIdTokenVerifier,GOOGLE_JWKS_URL} from '../lib/google-id-token.mjs';

const CLIENT='fictional-client-123.apps.googleusercontent.com',OWNER='fictional-owner-sub-1001',OTHER='fictional-other-sub-2002';
const FORGED={'oai-authenticated-user-id':'forged-id','oai-authenticated-user-email':'owner@example.test'};
const enc=o=>Buffer.from(typeof o==='string'?o:JSON.stringify(o)).toString('base64url');
const gen=()=>crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
let google,attacker,rotated,jwks;
const pub=async(kp,kid)=>({...await crypto.subtle.exportKey('jwk',kp.publicKey),kid,alg:'RS256',use:'sig'});
async function sign(claims={},{key=google,kid='kid-1',header={}}={}){
 const t=Math.floor(Date.now()/1000);
 const h=enc({alg:'RS256',kid,typ:'JWT',...header}),p=enc({iss:'https://accounts.google.com',aud:CLIENT,sub:OWNER,iat:t,exp:t+600,...claims});
 const s=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key.privateKey,new TextEncoder().encode(h+'.'+p));
 return h+'.'+p+'.'+Buffer.from(s).toString('base64url');
}
before(async()=>{[google,attacker,rotated]=await Promise.all([gen(),gen(),gen()]);jwks=[await pub(google,'kid-1')];});

test('verifier accepts a genuine Google-shaped token and returns its claims',async()=>{
 const v=createGoogleIdTokenVerifier({clientId:CLIENT,fetchJwks:async()=>({keys:jwks})});
 assert.equal((await v(await sign())).sub,OWNER);
 assert.equal((await v(await sign({iss:'accounts.google.com'}))).sub,OWNER);
});
test('verifier rejects every invalid token',async()=>{
 const v=createGoogleIdTokenVerifier({clientId:CLIENT,fetchJwks:async()=>({keys:jwks})}),t=Math.floor(Date.now()/1000);
 const good=await sign(),[h,p,s]=good.split('.');
 const bad={
  'wrong audience':await sign({aud:'someone-else.apps.googleusercontent.com'}),'audience array':await sign({aud:[CLIENT]}),
  'wrong issuer':await sign({iss:'https://evil.example.test'}),'expired':await sign({exp:t-120}),'missing exp':await sign({exp:undefined}),
  'issued in the future':await sign({iat:t+3600}),'no sub':await sign({sub:''}),
  'attacker key with Google kid':await sign({},{key:attacker}),'unknown kid':await sign({},{kid:'kid-9'}),
  'header alg not RS256':await sign({},{header:{alg:'RS512'}}),'alg none':enc({alg:'none',kid:'kid-1'})+'.'+p+'.','alg HS256':enc({alg:'HS256',kid:'kid-1'})+'.'+p+'.'+s,
  'tampered payload':h+'.'+enc({...JSON.parse(Buffer.from(p,'base64url')),sub:OTHER})+'.'+s,
  'two parts':h+'.'+p,'bad base64':h+'.'+p+'.%%%','garbage':'not-a-token','empty':'',
 };
 for(const [name,token] of Object.entries(bad))await assert.rejects(v(token),Error,name);
});
test('nonce is enforced when a checker is configured',async()=>{
 const v=createGoogleIdTokenVerifier({clientId:CLIENT,fetchJwks:async()=>({keys:jwks}),checkNonce:n=>n==='fictional-nonce'});
 assert.equal((await v(await sign({nonce:'fictional-nonce'}))).sub,OWNER);
 await assert.rejects(v(await sign({nonce:'replayed'})));await assert.rejects(v(await sign()));
});
test('JWKS is cached for max-age and refetched once for a rotated key',async()=>{
 let calls=0,keys=jwks;const v=createGoogleIdTokenVerifier({clientId:CLIENT,fetchJwks:async()=>{calls++;return {keys,maxAge:3600};}});
 await v(await sign());await v(await sign());assert.equal(calls,1);
 keys=[...jwks,await pub(rotated,'kid-2')];assert.equal((await v(await sign({},{key:rotated,kid:'kid-2'}))).sub,OWNER);assert.equal(calls,2);
 await assert.rejects(v(await sign({},{kid:'kid-3'})));assert.equal(calls,3);
});
test('JWKS outage: marked unavailable (not a bad token); cached keys keep working; unknown kid during outage is unavailable',async()=>{
 let down=true,calls=0;const v=createGoogleIdTokenVerifier({clientId:CLIENT,fetchJwks:async()=>{calls++;if(down)throw new Error('network');return {keys:jwks,maxAge:3600};}});
 await assert.rejects(v(await sign()),e=>e.unavailable===true);
 down=false;assert.equal((await v(await sign())).sub,OWNER);down=true;
 assert.equal((await v(await sign())).sub,OWNER);assert.equal(calls,2);
 await assert.rejects(v(await sign({},{kid:'kid-7'})),e=>e.unavailable===true);
 await assert.rejects(v(await sign({},{key:attacker})),e=>!e.unavailable);
});
test('no verifier exists without a configured client ID',()=>{for(const clientId of [undefined,'',7])assert.equal(createGoogleIdTokenVerifier({clientId}),undefined);});

// ---- actual route over HTTP ----
register('data:text/javascript,'+encodeURIComponent("export async function resolve(s,c,n){if(s==='cloudflare:workers')return {url:'data:text/javascript,export const env=globalThis.__LIFEPILOT_TEST_ENV__;',shortCircuit:true};return n(s,c);}"));
const ENV=globalThis.__LIFEPILOT_TEST_ENV__={};let sql,ops,route,server,base,jwksFetches=0,n=0;const realFetch=globalThis.fetch;
let jwksDown=false;globalThis.fetch=async(u,i)=>{if(String(u)===GOOGLE_JWKS_URL){jwksFetches++;if(jwksDown)return new Response('unavailable',{status:500});return Response.json({keys:jwks},{headers:{'cache-control':'public, max-age=3600'}});}return realFetch(u,i);};
async function load(cfg){
 sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../drizzle/0000_friendly_hannibal_king.sql',import.meta.url),'utf8'));
 sql.prepare('INSERT INTO shared_profiles(owner_id,revision,payload,updated_at) VALUES(?,1,?,?)').run('forged-id','{"goals":[],"note":"header identity row"}','2026-01-01T00:00:00Z');
 ops=[];for(const k of Object.keys(ENV))delete ENV[k];
 Object.assign(ENV,{DB:{prepare(q){ops.push(q);return {bind(...a){return {async first(){return sql.prepare(q).get(...a)||null;},async run(){return {meta:sql.prepare(q).run(...a)};}};}};}}},cfg);
 route=await import('../app/api/profile/route.ts?case='+(n++)); // fresh route instance per configuration
}
before(async()=>{server=createServer(async(req,res)=>{
 const chunks=[];for await(const c of req)chunks.push(c);const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(typeof v==='string')headers.set(k,v);
 const r=new Request(base+req.url,{method:req.method,headers,...(chunks.length?{body:Buffer.concat(chunks)}:{})});
 const out=req.method==='GET'||req.method==='PUT'?await route[req.method](r):await route.GET(r);res.writeHead(out.status,Object.fromEntries(out.headers));res.end(Buffer.from(await out.arrayBuffer()));
});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;});
after(()=>{server.close();globalThis.fetch=realFetch;});
const call=(method,headers={},body)=>realFetch(base+'/api/profile',{method,headers:{origin:base,'content-type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});
const CONFIGURED={GOOGLE_CLIENT_ID:CLIENT,OWNER_GOOGLE_SUBS:' '+OWNER+' , fictional-second-owner '};
const prof=x=>({goals:[],execution:{tasks:[{id:'t',name:'Fictional '+x}]}});
const rows=()=>sql.prepare('SELECT owner_id,payload FROM shared_profiles ORDER BY owner_id').all().map(r=>({...r}));

test('route source has no header-based identity path',()=>{
 const src=readFileSync(new URL('../app/api/profile/route.ts',import.meta.url),'utf8'),lib=readFileSync(new URL('../lib/shared-profile.mjs',import.meta.url),'utf8');
 assert.match(src,/createProfileHandler/);assert.doesNotMatch(src,/sharedProfile|oai-authenticated|headers\.get/);
 assert.doesNotMatch(lib,/oai-authenticated|sharedProfile/);
});
test('actual route: forged identity headers never authenticate (zero storage access)',async()=>{
 await load(CONFIGURED);const before=rows();
 for(const [headers,status] of [[{...FORGED},401],[{...FORGED,authorization:'Bearer '+await sign({},{key:attacker})},401],
  [{...FORGED,authorization:'Bearer '+await sign({aud:'other.apps.googleusercontent.com'})},401],[{...FORGED,authorization:'Bearer '+await sign({exp:Math.floor(Date.now()/1000)-120})},401],
  [{...FORGED,authorization:'Bearer '+await sign({sub:OTHER})},403]])
  for(const m of ['GET','PUT'])assert.equal((await call(m,headers,m==='PUT'?{revision:0,profile:prof(1)}:undefined)).status,status,m+' '+status);
 assert.deepEqual(ops,[]);assert.deepEqual(rows(),before);
});
test('actual route: verified owner token reads and writes only the google:<sub> row; JWKS fetched once',async()=>{
 await load(CONFIGURED);jwksFetches=0;const tok={...FORGED,authorization:'Bearer '+await sign()};
 assert.deepEqual(await (await call('GET',tok)).json(),{revision:0,profile:null});
 assert.equal((await call('PUT',tok,{revision:0,profile:prof(2)})).status,200);
 assert.deepEqual((await (await call('GET',tok)).json()).profile,prof(2));
 assert.deepEqual(rows().map(r=>r.owner_id),['forged-id','google:'+OWNER]);assert.equal(rows()[0].payload,'{"goals":[],"note":"header identity row"}');
 assert.equal(jwksFetches,1);
});
test('actual route fails closed (503, zero storage access) when Google client ID or owner allowlist is unset',async()=>{
 for(const cfg of [{},{GOOGLE_CLIENT_ID:CLIENT},{OWNER_GOOGLE_SUBS:OWNER},{GOOGLE_CLIENT_ID:CLIENT,OWNER_GOOGLE_SUBS:' , '}]){
  await load(cfg);const tok={...FORGED,authorization:'Bearer '+await sign()};
  for(const m of ['GET','PUT'])assert.equal((await call(m,tok,m==='PUT'?{revision:0,profile:prof(3)}:undefined)).status,503);
  assert.deepEqual(ops,[]);
 }
});
test('actual route: CSRF/CORS/origin — only a same-origin Authorization header authenticates; no CORS grant',async()=>{
 await load(CONFIGURED);const token=await sign(),before=rows();
 const raw=(method,headers,body)=>realFetch(base+'/api/profile'+(headers.query||''),{method,headers:Object.fromEntries(Object.entries(headers).filter(([k])=>k!=='query')),...(body?{body:JSON.stringify(body)}:{})});
 const body={revision:0,profile:prof('csrf')};
 for(const [method,headers,status,name] of [
  ['PUT',{'content-type':'application/json',authorization:'Bearer '+token},403,'PUT without Origin'],
  ['PUT',{'content-type':'application/json',authorization:'Bearer '+token,origin:'https://elsewhere.example.test'},403,'cross-origin PUT with a valid token'],
  ['PUT',{'content-type':'text/plain',authorization:'Bearer '+token,origin:base},415,'simple-request content type'],
  ['GET',{query:'?access_token='+token,origin:base},401,'token in query string'],
  ['GET',{cookie:'id_token='+token+'; g_csrf_token=x',origin:base},401,'token in cookie'],
  ['GET',{authorization:token,origin:base},401,'token without Bearer scheme'],
  ['OPTIONS',{origin:'https://elsewhere.example.test','access-control-request-method':'PUT',authorization:'Bearer '+token},405,'preflight'],
 ]){const r=await raw(method,headers,method==='PUT'?body:undefined);assert.equal(r.status,status,name);
  for(const h of ['access-control-allow-origin','access-control-allow-credentials','access-control-allow-headers'])assert.equal(r.headers.get(h),null,name+' '+h);
  assert.equal(r.headers.get('cache-control'),'no-store',name);}
 assert.deepEqual(rows(),before);
});
test('actual route: Google JWKS unreachable => 503 (not 401), zero storage access, recovers when keys return',async()=>{
 await load(CONFIGURED);const before=rows(),tok={...FORGED,authorization:'Bearer '+await sign()};jwksDown=true;
 try{for(const m of ['GET','PUT']){const r=await call(m,tok,m==='PUT'?{revision:0,profile:prof(4)}:undefined);assert.equal(r.status,503,m);assert.match((await r.json()).error,/could not be checked/);}
  assert.deepEqual(ops,[]);assert.deepEqual(rows(),before);
  assert.equal((await call('GET',{...FORGED})).status,401);
 }finally{jwksDown=false;}
 assert.equal((await call('GET',tok)).status,200);
});
