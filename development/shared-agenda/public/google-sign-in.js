/* Google sign-in adapter for shared sync (Google Identity Services).
 * - Loads Google's script only from GIS_SRC, and only when the page carries a configured client ID.
 * - The ID token lives in this closure's memory only: never localStorage/sessionStorage/cookies, never logged.
 * - The token is attached only to same-origin requests for PROFILE_PATH; any other URL is refused before fetch.
 * - Tokens within 60 s of expiry are treated as expired; a 401 from the server clears the token.
 * - One sign-in attempt at a time: concurrent callers share it (one prompt). A Google callback that arrives
 *   when no attempt is waiting (for example after a timeout) is ignored, never stored.
 * Callers get errors with .authRequired=true when the owner must sign in (again). Local data is never touched here. */
'use strict';
(function(){
 const GIS_SRC='https://accounts.google.com/gsi/client',PROFILE_PATH='/api/profile',SKEW=60;
 let token=null,exp=0,initialized=false,loading=null,attempt=null,inflight=null;
 const now=()=>Date.now()/1000;
 const authError=message=>Object.assign(new Error(message),{authRequired:true});
 const clientId=()=>{const v=document.querySelector('meta[name=lifepilot-google-client-id]')?.content||'';return /^[A-Za-z0-9._-]+$/.test(v)?v:'';};
 function expiry(t){try{const p=JSON.parse(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return Number.isFinite(p.exp)?p.exp:0;}catch{return 0;}}
 function current(){if(token&&exp-SKEW>now())return token;token=null;exp=0;return null;}
 function finish(t){const a=attempt;if(!a)return;attempt=null;clearTimeout(a.timer);a.resolve(t);}
 function accept(response){
  if(!attempt)return; // late or unsolicited callback: no attempt is waiting, so nothing is accepted
  const t=response?.credential;const e=typeof t==='string'&&t.split('.').length===3?expiry(t):0;
  if(e-SKEW>now()){token=t;exp=e;finish(t);}else finish(null);
 }
 function load(){
  if(globalThis.google?.accounts?.id)return Promise.resolve();
  return loading??=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=GIS_SRC;s.async=true;s.onload=resolve;s.onerror=()=>{loading=null;reject(authError('Google sign-in could not load. Local data stays on this device.'));};document.head.appendChild(s);});
 }
 async function ready(){
  const id=clientId();if(!id)throw authError('Google sign-in is not set up for this site yet. Local data stays on this device.');
  await load();
  if(!initialized){google.accounts.id.initialize({client_id:id,callback:accept,auto_select:true,cancel_on_tap_outside:false,use_fedcm_for_prompt:true});initialized=true;}
 }
 async function attemptSignIn(interactive,timeoutMs){
  await ready();
  const box=document.getElementById('sharedSignIn');
  const result=new Promise(resolve=>{attempt={resolve,timer:setTimeout(()=>finish(null),timeoutMs)};});
  if(interactive&&box){box.hidden=false;google.accounts.id.renderButton(box,{type:'standard',text:'signin_with'});}
  google.accounts.id.prompt();
  const t=await result;
  if(!t)throw authError('Sign in with Google to sync. Local data stays on this device.');
  if(box)box.hidden=true;
  return t;
 }
 function signIn({interactive=true,timeoutMs=interactive?120000:8000}={}){
  const have=current();if(have)return Promise.resolve(have);
  return inflight??=attemptSignIn(interactive,timeoutMs).finally(()=>{inflight=null;});
 }
 function profileUrl(url){
  let u;try{u=new URL(String(url),location.href);}catch{return null;}
  return u.origin===location.origin&&u.pathname===PROFILE_PATH&&!u.username&&!u.password?u.href:null;
 }
 async function authFetch(url,init={}){
  const target=profileUrl(url);if(!target)throw new Error('Refused: sign-in is only sent to this site’s profile API.');
  const t=current();if(!t)throw authError('Sign in with Google to sync. Local data stays on this device.');
  const headers=new Headers(init.headers||{});headers.set('Authorization','Bearer '+t);
  const r=await fetch(target,{...init,headers,credentials:'same-origin',redirect:'error'});
  if(r.status===401){token=null;exp=0;throw authError('Google sign-in expired. Sign in again to sync; local data is kept.');}
  return r;
 }
 function signOut(){token=null;exp=0;finish(null);try{globalThis.google?.accounts?.id?.disableAutoSelect();}catch{}}
 globalThis.LifePilotAuth=Object.freeze({signIn,fetch:authFetch,signOut,signedIn:()=>current()!==null});
})();
