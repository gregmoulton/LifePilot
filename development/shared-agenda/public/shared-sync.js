/* Shared agenda: explicit enrollment, revision checks, retained local backups. */
'use strict';
let sharedRevision=null,sharedPending=null,sharedConflict=false,sharedSending=false,sharedApplying=false;
const sharedEndpoint=document.querySelector('meta[name=lifepilot-sandbox]')?.content==='1'?'/api/profile?sandbox=1':'/api/profile';
const sharedNotice=document.createElement('section');sharedNotice.className='panel';sharedNotice.style='margin:12px auto;max-width:1068px;padding:14px';
sharedNotice.innerHTML='<b>Shared agenda</b><p id="sharedStatus" role="status">Local copy · connect to share across devices.</p><div class="row"><button id="sharedConnect">Connect shared agenda</button><button id="sharedRetry" class="secondary" hidden>Retry sync</button></div>';
(document.querySelector('main')||document.body).prepend(sharedNotice);
function sharedStatus(message){$('sharedStatus').textContent=message;}
async function sharedRead(){const r=await fetch(sharedEndpoint,{cache:'no-store'});if(!r.ok)throw Error(r.status===401?'Sign in to this private site with your owner account.':'Shared storage unavailable. Local data stays on this device.');const data=await r.json();if(data.profile!==null&&!LifePilotStorage.validProfile(data.profile))throw Error('Shared profile needs review. Local data unchanged.');return data;}
function sharedHasDraft(){return (typeof agendaBatchDraft!=='undefined'&&!!agendaBatchDraft)||['agendaName','captureRequest','agendaBatchText'].some(id=>!!$(id)?.value?.trim());}
async function sharedAdopt(data,expected=JSON.stringify(profile)){
 const run=async()=>{
  if(transactionRunning||unsavedProfile!==null||sharedPending||sharedHasDraft()||JSON.stringify(profile)!==expected)throw Error('Finish or recover local changes before loading another copy.');
  transactionRunning=true;sharedApplying=true;
  try{await profileStore.commit(data.profile);profile=profileStore.value;sharedRevision=data.revision;sharedPending=null;sharedConflict=false;sharedStatus('Synced · revision '+sharedRevision);$('sharedRetry').hidden=true;}finally{sharedApplying=false;transactionRunning=false;render();}
 };
 const operation=transactionQueue.then(run);transactionQueue=operation.catch(()=>{});return operation;
}
async function sharedConnect(){
 try{
  const expected=JSON.stringify(profile),data=await sharedRead();
  if(JSON.stringify(profile)!==expected||transactionRunning)throw Error('Local agenda changed. Connect again after the save finishes.');
  if(data.profile===null){if(!profile){sharedStatus('Create or import your profile first, then connect.');return;}if(!confirm('Use this device’s profile as your shared agenda? Other devices will be able to load it. Your local copy stays saved.'))return;sharedRevision=0;sharedPending=JSON.parse(JSON.stringify(profile));sharedConflict=false;await sharedFlush();}
  else if(JSON.stringify(data.profile)===JSON.stringify(profile)){sharedRevision=data.revision;sharedPending=null;sharedConflict=false;sharedStatus('Synced · revision '+sharedRevision);}
  else{if(!confirm('Load the shared agenda on this device? This device’s current profile will remain in its local last-good backup. Cancel keeps both copies unchanged.'))return;await sharedAdopt(data,expected);}
 }catch(e){sharedStatus(e.message);}
}
async function sharedFlush(){
 if(sharedSending||sharedConflict||sharedPending===null||sharedRevision===null)return;
 sharedSending=true;const snapshot=sharedPending,revision=sharedRevision;sharedStatus('Saved locally · syncing…');
 try{
  const r=await fetch(sharedEndpoint,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,profile:snapshot})});
  if(r.status===409){sharedConflict=true;sharedStatus('Saved locally · another device changed the agenda. Export this local copy, reload, then Connect to review the shared copy.');return;}
  if(!r.ok)throw Error();const receipt=await r.json();if(receipt.revision!==revision+1)throw Error();sharedRevision=receipt.revision;
  if(sharedPending===snapshot)sharedPending=null;
  sharedStatus(sharedPending?'Saved locally · more changes waiting':'Synced · revision '+sharedRevision);$('sharedRetry').hidden=sharedPending===null;
 }catch{sharedStatus('Saved locally · sync not confirmed. Keep this device’s copy; Retry sync checks for conflicts.');$('sharedRetry').hidden=false;}
 finally{sharedSending=false;}
 if(sharedPending&&!sharedConflict&&sharedRevision!==revision)await sharedFlush();
}
const sharedOriginalCommit=profileStore.commit;
profileStore.commit=async function(candidate){const result=await sharedOriginalCommit(candidate);if(!sharedApplying&&sharedRevision!==null){if(candidate===null){sharedRevision=null;sharedPending=null;sharedStatus('Disconnected · shared agenda was not deleted.');}else{sharedPending=JSON.parse(JSON.stringify(candidate));queueMicrotask(sharedFlush);}}return result;};
const sharedOriginalRestore=profileStore.restore;
profileStore.restore=async function(...args){const result=await sharedOriginalRestore(...args);if(sharedRevision!==null){sharedPending=JSON.parse(JSON.stringify(result));queueMicrotask(sharedFlush);}return result;};
$('sharedConnect').onclick=sharedConnect;$('sharedRetry').onclick=sharedFlush;
setInterval(async()=>{
 if(sharedRevision===null||sharedPending||sharedSending||sharedConflict||transactionRunning||unsavedProfile!==null||sharedHasDraft())return;
 try{const expected=JSON.stringify(profile),revision=sharedRevision,data=await sharedRead();if(sharedPending||transactionRunning||sharedRevision!==revision||JSON.stringify(profile)!==expected)return;if(data.revision!==sharedRevision){if(data.profile===null)throw Error();await sharedAdopt(data,expected);}}catch{sharedStatus('Local copy available · unable to check shared changes.');}
},20000);
window.addEventListener('online',()=>{if(sharedPending)sharedFlush();});
