// Verified-owner boundary for the shared profile API. The public route uses it exclusively (lib/profile-route.mjs).
// Identity comes only from a bearer ID token checked by an injected verifier. Client-supplied
// oai-authenticated-* headers are never used for authorization. The token itself is checked by the
// injected verifier (lib/google-id-token.mjs in production; see lib/profile-route.mjs).
import {profileForOwner,response} from './shared-profile.mjs';

const IDENTITY_HEADER=/^oai-authenticated-/i;

// verifyIdToken(token) must resolve to verified claims ({sub, exp, ...}) or throw.
// ownerSubs is the server-side allowlist of Google `sub` values. Neither is ever sent to the browser.
export function verifiedOwnerProfile({verifyIdToken,ownerSubs}={}){
 const allow=new Set(Array.isArray(ownerSubs)?ownerSubs.filter(s=>typeof s==='string'&&s):[]);
 const configured=typeof verifyIdToken==='function'&&allow.size>0;
 return async function handle(request,db,validProfile){
  // Fail closed before touching storage when the boundary is not configured.
  if(!configured)return response(503,{error:'Sign-in verification unavailable; local data unchanged'});
  const match=/^Bearer ([A-Za-z0-9._~+/=-]+)$/.exec(request.headers.get('authorization')||'');
  if(!match)return response(401,{error:'Owner sign-in required'});
  let claims;
  try{claims=await verifyIdToken(match[1]);}catch(e){
   // Google's keys unreachable: not the owner's fault, so do not ask them to sign in again.
   if(e?.unavailable)return response(503,{error:'Sign-in could not be checked right now; local data unchanged'});
   return response(401,{error:'Owner sign-in required'});
  }
  const sub=claims?.sub;
  if(typeof sub!=='string'||!sub)return response(401,{error:'Owner sign-in required'});
  if(claims.exp!==undefined&&!(Number(claims.exp)*1000>Date.now()))return response(401,{error:'Owner sign-in required'});
  if(!allow.has(sub))return response(403,{error:'This account cannot use this profile'});
  return profileForOwner(stripIdentityHeaders(request),db,validProfile,'google:'+sub);
 };
}

// Rebuild the request without any oai-authenticated-* header so nothing downstream can read them.
export function stripIdentityHeaders(request){
 const headers=new Headers();
 for(const [k,v] of request.headers)if(!IDENTITY_HEADER.test(k))headers.set(k,v);
 const init={method:request.method,headers};
 if(request.body){init.body=request.body;init.duplex='half';}
 return new Request(request.url,init);
}
