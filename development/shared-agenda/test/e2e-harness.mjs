// Fictional end-to-end harness: serves the REAL page route (app/route.ts) and the REAL profile API
// (app/api/profile/route.ts) with an in-memory D1-shaped SQLite DB, locally generated signing keys and a
// stubbed Google JWKS endpoint. Used by test/shared-signin-e2e.py; never deployed, no network, no real data.
// Usage: node development/shared-agenda/test/e2e-harness.mjs [--unconfigured]   (prints {"port":N} on stdout)
// Test-only control endpoints live under /__test/ in THIS harness only (not in the app).
import {register} from 'node:module';import {createServer} from 'node:http';import {DatabaseSync} from 'node:sqlite';
import {readFileSync,existsSync} from 'node:fs';import {fileURLToPath} from 'node:url';
import {GOOGLE_JWKS_URL} from '../lib/google-id-token.mjs';

const hooks=`
export async function resolve(s,c,n){
 if(s==='cloudflare:workers')return {url:'data:text/javascript,export const env=globalThis.__LIFEPILOT_TEST_ENV__;',shortCircuit:true};
 if(s.endsWith('?raw')){const r=await n(s.slice(0,-4),c);return {url:r.url+'?raw',shortCircuit:true};}
 return n(s,c);}
export async function load(u,c,n){
 if(u.startsWith('file:')&&u.endsWith('?raw')){const {readFileSync}=await import('node:fs');const {fileURLToPath}=await import('node:url');
  return {format:'module',source:'export default '+JSON.stringify(readFileSync(fileURLToPath(u.slice(0,-4)),'utf8')),shortCircuit:true};}
 return n(u,c);}`;
register('data:text/javascript,'+encodeURIComponent(hooks));

const CLIENT='fictional-client-123.apps.googleusercontent.com',OWNER='fictional-owner-sub-1001',OTHER='fictional-other-sub-2002';
const unconfigured=process.argv.includes('--unconfigured');
const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../drizzle/0000_friendly_hannibal_king.sql',import.meta.url),'utf8'));
// A row as the previous (header-identity) build would have stored it; it must stay byte-identical.
sql.prepare('INSERT INTO shared_profiles(owner_id,revision,payload,updated_at) VALUES(?,?,?,?)').run('platform-user-legacy',4,'{"goals":[],"note":"fictional pre-upgrade row"}','2026-01-01T00:00:00Z');
const env=globalThis.__LIFEPILOT_TEST_ENV__={DB:{prepare(q){return {bind(...a){return {async first(){return sql.prepare(q).get(...a)||null;},async run(){return {meta:sql.prepare(q).run(...a)};}};}};}}};
if(!unconfigured)Object.assign(env,{GOOGLE_CLIENT_ID:CLIENT,OWNER_GOOGLE_SUBS:OWNER});

const gen=()=>crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const [google,attacker]=await Promise.all([gen(),gen()]);
const jwks=[{...await crypto.subtle.exportKey('jwk',google.publicKey),kid:'kid-1',alg:'RS256',use:'sig'}];
let jwksDown=false,jwksFetches=0;const realFetch=globalThis.fetch;
globalThis.fetch=async(u,i)=>{if(String(u)===GOOGLE_JWKS_URL){jwksFetches++;return jwksDown?new Response('down',{status:500}):Response.json({keys:jwks},{headers:{'cache-control':'max-age=60'}});}return realFetch(u,i);};
const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
async function mint(mode){
 const t=Math.floor(Date.now()/1000),claims={iss:'https://accounts.google.com',aud:CLIENT,sub:OWNER,iat:t,exp:t+3600};
 if(mode==='other')claims.sub=OTHER;if(mode==='wrong-aud')claims.aud='someone-else.apps.googleusercontent.com';
 // 'rotated': signed by Google's key under a kid not yet in the cached JWKS, forcing a JWKS refetch.
 const key=mode==='attacker'?attacker:google,h=enc({alg:'RS256',kid:mode==='rotated'?'kid-2':'kid-1',typ:'JWT'}),p=enc(claims);
 const s=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key.privateKey,new TextEncoder().encode(h+'.'+p));
 return h+'.'+p+'.'+Buffer.from(s).toString('base64url');
}

const pageRoute=await import('../app/route.ts'),apiRoute=await import('../app/api/profile/route.ts');
const PUBLIC=fileURLToPath(new URL('../public/',import.meta.url));
let mode='owner';const apiLog=[];

const server=createServer(async(req,res)=>{
 try{
  const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks);
  const url=new URL(req.headers['x-test-url']||('http://127.0.0.1'+req.url));
  const send=(status,data,type='application/json')=>{res.writeHead(status,{'content-type':type,'cache-control':'no-store'});res.end(typeof data==='string'?data:JSON.stringify(data));};
  if(url.pathname.startsWith('/__test/')){
   const q=url.searchParams;
   if(url.pathname==='/__test/mode'){mode=q.get('mode')||mode;return send(200,{mode});}
   if(url.pathname==='/__test/mint')return send(200,{credential:mode==='none'?null:await mint(mode)});
   if(url.pathname==='/__test/jwks'){jwksDown=q.get('down')==='1';return send(200,{jwksDown,jwksFetches});}
   if(url.pathname==='/__test/rows')return send(200,sql.prepare('SELECT owner_id,revision,payload,previous_payload,updated_at FROM shared_profiles ORDER BY owner_id').all().map(r=>({...r})));
   if(url.pathname==='/__test/api-log')return send(200,apiLog);
   return send(404,{});
  }
  const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(typeof v==='string'&&k!=='x-test-url')headers.set(k,v);
  const request=new Request(url,{method:req.method,headers,...(body.length&&!['GET','HEAD'].includes(req.method)?{body}:{})});
  let out;
  if(url.pathname==='/api/profile'){
   const handler=apiRoute[req.method];out=handler?await handler(request):new Response(null,{status:405});
   apiLog.push({method:req.method,status:out.status,auth:headers.has('authorization'),forged:[...headers.keys()].some(k=>k.startsWith('oai-authenticated-'))});
  }else if(url.pathname==='/'||url.pathname==='/index.html')out=await pageRoute.GET(request);
  else{const file=PUBLIC+url.pathname.slice(1);if(/^\/[a-z-]+\.js$/.test(url.pathname)&&existsSync(file))out=new Response(readFileSync(file),{headers:{'content-type':'text/javascript'}});else out=new Response('not found',{status:404});}
  res.writeHead(out.status,Object.fromEntries(out.headers));res.end(Buffer.from(await out.arrayBuffer()));
 }catch(e){res.writeHead(500,{'content-type':'text/plain'});res.end('harness error');console.error(e);}
});
server.listen(0,'127.0.0.1',()=>process.stdout.write(JSON.stringify({port:server.address().port})+'\n'));
