// Google OpenID Connect ID-token verifier (RS256), using only WebCrypto. No paid dependency, no credentials:
// it needs the public OAuth client ID and Google's published signing keys (JWKS).
// Checks: compact JWS shape, alg RS256, kid present in the JWKS, signature, exact `aud`, Google `iss`,
// `exp` (with small clock skew), `iat` not in the future, non-empty `sub`, and `nonce` when a checker is set.
export const GOOGLE_JWKS_URL='https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS=new Set(['accounts.google.com','https://accounts.google.com']),SKEW=60;

const b64=s=>{if(!/^[A-Za-z0-9_-]+$/.test(s))throw new Error('bad encoding');s=s.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(s+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));};
const json=s=>{const v=JSON.parse(new TextDecoder().decode(b64(s)));if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('bad json');return v;};

// Default JWKS fetcher; honors Cache-Control max-age. Tests inject their own.
export async function fetchGoogleJwks(){
 const r=await fetch(GOOGLE_JWKS_URL);if(!r.ok)throw new Error('jwks unavailable');
 const age=Number(/max-age=(\d+)/.exec(r.headers.get('cache-control')||'')?.[1]||0);
 return {keys:(await r.json()).keys,maxAge:Math.min(age,86400)};
}

export function createGoogleIdTokenVerifier({clientId,fetchJwks=fetchGoogleJwks,now=()=>Date.now(),checkNonce}={}){
 if(typeof clientId!=='string'||!clientId)return undefined; // fail closed: no verifier without a configured audience
 let cache={keys:new Map(),until:0};
 async function load(force){
  if(!force&&now()<cache.until)return cache.keys;
  let got;try{got=await fetchJwks();}catch{throw Object.assign(new Error('signing keys unavailable'),{unavailable:true});}
  const {keys,maxAge=0}=got||{},map=new Map();
  for(const k of Array.isArray(keys)?keys:[])if(k&&k.kty==='RSA'&&typeof k.kid==='string'&&(!k.alg||k.alg==='RS256')&&(!k.use||k.use==='sig'))
   map.set(k.kid,await crypto.subtle.importKey('jwk',{kty:'RSA',n:k.n,e:k.e,alg:'RS256',ext:true},{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']));
  cache={keys:map,until:now()+Math.max(0,Number(maxAge)||0)*1000};return map;
 }
 return async function verifyIdToken(token){
  const parts=typeof token==='string'?token.split('.'):[];
  if(parts.length!==3)throw new Error('malformed token');
  const header=json(parts[0]),claims=json(parts[1]),sig=b64(parts[2]);
  if(header.alg!=='RS256'||typeof header.kid!=='string')throw new Error('unsupported token');
  let key=(await load(false)).get(header.kid);
  if(!key)key=(await load(true)).get(header.kid); // key rotation: refetch once for an unknown kid
  if(!key)throw new Error('unknown signing key');
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,sig,new TextEncoder().encode(parts[0]+'.'+parts[1])))throw new Error('bad signature');
  const t=now()/1000;
  if(claims.aud!==clientId)throw new Error('wrong audience');
  if(!ISSUERS.has(claims.iss))throw new Error('wrong issuer');
  if(!Number.isFinite(claims.exp)||claims.exp+SKEW<=t)throw new Error('expired');
  if(claims.iat!==undefined&&(!Number.isFinite(claims.iat)||claims.iat-SKEW>t))throw new Error('issued in the future');
  if(typeof claims.sub!=='string'||!claims.sub)throw new Error('no subject');
  if(checkNonce&&!await checkNonce(claims.nonce))throw new Error('bad nonce');
  return claims;
 };
}
