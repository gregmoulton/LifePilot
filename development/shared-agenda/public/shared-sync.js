/* Shared agenda: explicit enrollment, revision checks, retained local backups. */
'use strict';
let sharedRevision=null,sharedPending=null,sharedConflict=false,sharedSending=false,sharedApplying=false,sharedBaseline=null,sharedRemote=null;
const sharedEndpoint=document.querySelector('meta[name=lifepilot-sandbox]')?.content==='1'?'/api/profile?sandbox=1':'/api/profile';
const sharedNotice=document.createElement('section');sharedNotice.className='panel';sharedNotice.style='margin:12px auto;max-width:1068px;padding:14px';
sharedNotice.innerHTML='<b>Shared agenda</b><p id="sharedStatus" role="status">Local copy · connect to share across devices.</p><div class="row"><button id="sharedConnect">Connect shared agenda</button><button id="sharedRetry" class="secondary" hidden>Retry sync</button></div><div id="sharedConflictReview" hidden></div><details><summary>Recovery copies</summary><button id="sharedArchiveExport" class="secondary">Download saved conflict copies</button></details>';
(document.querySelector('main')||document.body).prepend(sharedNotice);
const sharedJournalKey=KEY+':shared-sync';
function sharedStatus(message){$('sharedStatus').textContent=message;}
function sharedRemember(value,revision){
 sharedBaseline=JSON.stringify(value);sharedRevision=revision;
 const text=JSON.stringify({version:1,revision,baseline:sharedBaseline});
 try{localStorage.setItem(sharedJournalKey,text);if(localStorage.getItem(sharedJournalKey)!==text)throw Error();return true;}catch{sharedStatus('Saved for this session. Automatic reconnection could not be recorded; your local profile is retained.');return false;}
}
function sharedSynced(value,revision){$('sharedConnect').textContent='Check sync';const remembered=sharedRemember(value,revision);if(remembered)sharedStatus('Synced · revision '+revision);$('sharedRetry').hidden=true;}
function sharedConflictView(data){
 sharedConflict=true;sharedRemote={...data,local:JSON.stringify(profile)};
 const box=$('sharedConflictReview');box.hidden=false;
 const describe=p=>(p?.execution?.tasks||[]).map(t=>'<li>'+esc(t.name||'Unnamed task')+' · '+esc(t.agenda_hold?'HOLD':t.status||'planned')+' · '+esc(t.due||'Unscheduled')+'</li>').join('')||'<li>No tasks</li>';
 box.innerHTML='<h3>Two agenda copies need review</h3><p>Each copy includes goals, task history, and settings. Both are preserved in recovery storage before applying your choice.</p><details><summary>This device</summary><ul>'+describe(profile)+'</ul></details><details><summary>Shared agenda</summary><ul>'+describe(data.profile)+'</ul></details><div class="row"><button id="sharedUseCloud">Use shared copy</button><button id="sharedUseLocal" class="secondary">Keep this device’s copy</button><button id="sharedExportBoth" class="secondary">Download both copies</button></div>';
 $('sharedUseCloud').onclick=()=>sharedResolve('cloud');$('sharedUseLocal').onclick=()=>sharedResolve('local');$('sharedExportBoth').onclick=()=>downloadLocalData(JSON.stringify({local:profile,shared:data.profile,revision:data.revision},null,2),'LifePilot_Conflict_Copies.json');
 sharedStatus('Both copies are safe · review which agenda to use.');
}
function sharedPreserveConflict(data){
 const key=KEY+':shared-conflicts',old=localStorage.getItem(key),history=old===null?[]:JSON.parse(old);
 if(!Array.isArray(history)||history.length>=20)throw Error('Recovery storage needs review. Download both copies before continuing.');
 history.push({at:new Date().toISOString(),local:JSON.parse(JSON.stringify(profile)),shared:data.profile,revision:data.revision});
 const text=JSON.stringify(history);localStorage.setItem(key,text);if(localStorage.getItem(key)!==text)throw Error('Could not preserve both copies. No agenda was replaced.');
}
async function sharedResolve(choice){
 try{
  if(!sharedRemote||sharedSending||transactionRunning||sharedHasDraft()||unsavedProfile!==null)throw Error('Finish or cancel local changes before resolving the copies.');
  const reviewed=sharedRemote,data=await sharedRead();
  if(data.revision!==reviewed.revision||JSON.stringify(profile)!==reviewed.local){sharedConflictView(data);return;}
  if(data.profile===null)throw Error('Shared copy is missing. Your local copy has not changed.');
  sharedPreserveConflict(data);
  if(choice==='cloud')await sharedAdopt(data,reviewed.local,true);
  else if(choice==='local'){sharedRemember(data.profile,data.revision);sharedConflict=false;sharedPending=JSON.parse(JSON.stringify(profile));await sharedFlush();}
  if(!sharedConflict){$('sharedConflictReview').hidden=true;sharedRemote=null;}
 }catch(e){sharedStatus(e.message||'Could not resolve copies. Both agendas remain available.');}
}
async function sharedCheck(){
 if(sharedRevision===null||sharedSending||transactionRunning||unsavedProfile!==null)return;
 if(sharedHasDraft()){sharedStatus('Draft preserved · finish or clear your request to refresh shared changes.');return;}
 try{
  const expected=JSON.stringify(profile),revision=sharedRevision,data=await sharedRead();
  if(transactionRunning||sharedRevision!==revision||JSON.stringify(profile)!==expected)return;
  if(JSON.stringify(data.profile)===expected){sharedPending=null;sharedConflict=false;sharedSynced(data.profile,data.revision);$('sharedConflictReview').hidden=true;return;}
  if(data.revision===revision&&!sharedConflict&&(JSON.stringify(data.profile)===sharedBaseline||revision===0&&data.profile===null)){if(sharedPending)await sharedFlush();return;}
  if(sharedPending||sharedConflict||data.profile===null){sharedConflictView(data);return;}
  await sharedAdopt(data,expected);
 }catch{sharedStatus('Saved locally · shared connection unavailable. Changes will be checked again when online.');$('sharedRetry').hidden=false;}
}
async function sharedResume(){
 try{
  const raw=localStorage.getItem(sharedJournalKey);if(raw===null)return;
  const state=JSON.parse(raw);
  if(state.version!==1||!Number.isSafeInteger(state.revision)||state.revision<0||typeof state.baseline!=='string'||!LifePilotStorage.validProfile(JSON.parse(state.baseline)))throw Error();
  if(!profile||profileStore.writable===false)return;
  sharedRevision=state.revision;sharedBaseline=state.baseline;
  sharedPending=state.revision===0||JSON.stringify(profile)!==sharedBaseline?JSON.parse(JSON.stringify(profile)):null;
  sharedStatus('Reconnecting shared agenda…');await sharedCheck();
 }catch{sharedStatus('Reconnection record needs review. Local data is unchanged; Connect can establish a new reviewed connection.');}
}
async function sharedRead(){const r=await fetch(sharedEndpoint,{cache:'no-store'});if(!r.ok)throw Error(r.status===401?'Sign in to this private site with your owner account.':'Shared storage unavailable. Local data stays on this device.');const data=await r.json();if(data.profile!==null&&!LifePilotStorage.validProfile(data.profile))throw Error('Shared profile needs review. Local data unchanged.');return data;}
function sharedHasDraft(){return (typeof captureCommandDraft!=='undefined'&&!!captureCommandDraft)||(typeof agendaBatchDraft!=='undefined'&&!!agendaBatchDraft)||['agendaName','captureRequest','agendaBatchText'].some(id=>!!$(id)?.value?.trim());}
async function sharedAdopt(data,expected=JSON.stringify(profile),resolved=false){
 const run=async()=>{
  if(transactionRunning||unsavedProfile!==null||(!resolved&&sharedPending)||sharedHasDraft()||JSON.stringify(profile)!==expected)throw Error('Finish or recover local changes before loading another copy.');
  transactionRunning=true;sharedApplying=true;
  try{await profileStore.commit(data.profile);profile=profileStore.value;sharedRevision=data.revision;sharedPending=null;sharedConflict=false;sharedSynced(data.profile,data.revision);}finally{sharedApplying=false;transactionRunning=false;render();}
 };
 const operation=transactionQueue.then(run);transactionQueue=operation.catch(()=>{});return operation;
}
async function sharedConnect(){
 try{
  const expected=JSON.stringify(profile),data=await sharedRead();
  if(JSON.stringify(profile)!==expected||transactionRunning)throw Error('Local agenda changed. Connect again after the save finishes.');
  if(data.profile===null){if(!profile){sharedStatus('Create or import your profile first, then connect.');return;}if(!confirm('Use this device’s profile as your shared agenda? Other devices will be able to load it. Your local copy stays saved.'))return;sharedRemember(profile,0);sharedPending=JSON.parse(JSON.stringify(profile));sharedConflict=false;await sharedFlush();}
  else if(JSON.stringify(data.profile)===JSON.stringify(profile)){sharedPending=null;sharedConflict=false;sharedSynced(data.profile,data.revision);}
  else if(profile===null){if(!confirm('Load your shared agenda on this device?'))return;await sharedAdopt(data,expected);}else sharedConflictView(data);
 }catch(e){sharedStatus(e.message);}
}
async function sharedFlush(){
 if(sharedSending||sharedConflict||sharedPending===null||sharedRevision===null)return;
 sharedSending=true;const snapshot=sharedPending,revision=sharedRevision;sharedStatus('Saved locally · syncing…');
 try{
  const r=await fetch(sharedEndpoint,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,profile:snapshot})});
  if(r.status===409){sharedConflict=true;sharedStatus('Saved locally · another device changed the agenda.');try{sharedConflictView(await sharedRead());}catch{$('sharedRetry').hidden=false;}return;}
  if(!r.ok)throw Error();const receipt=await r.json();if(receipt.revision!==revision+1)throw Error();if(sharedRevision!==revision)return;const remembered=sharedRemember(snapshot,receipt.revision);
  if(sharedPending===snapshot)sharedPending=null;
  sharedStatus(sharedPending?'Saved locally · more changes waiting':(remembered?'Synced · revision '+sharedRevision:'Synced · reconnect setup could not be saved'));$('sharedRetry').hidden=sharedPending===null;
 }catch{sharedStatus('Saved locally · sync not confirmed. Keep this device’s copy; Retry sync checks for conflicts.');$('sharedRetry').hidden=false;}
 finally{sharedSending=false;}
 if(sharedPending&&!sharedConflict&&sharedRevision!==revision)await sharedFlush();
}
const sharedOriginalCommit=profileStore.commit;
profileStore.commit=async function(candidate){const result=await sharedOriginalCommit(candidate);if(!sharedApplying&&sharedRevision!==null){if(candidate===null){sharedRevision=null;sharedPending=null;try{localStorage.removeItem(sharedJournalKey);}catch{}sharedStatus('Disconnected · shared agenda was not deleted.');}else{sharedPending=JSON.parse(JSON.stringify(candidate));queueMicrotask(sharedFlush);}}return result;};
const sharedOriginalRestore=profileStore.restore;
profileStore.restore=async function(...args){const result=await sharedOriginalRestore(...args);if(sharedRevision!==null){sharedPending=JSON.parse(JSON.stringify(result));queueMicrotask(sharedFlush);}return result;};
$('sharedArchiveExport').onclick=()=>{try{downloadLocalData(localStorage.getItem(KEY+':shared-conflicts'),'LifePilot_Saved_Conflict_Copies.json');}catch{sharedStatus('Recovery storage is unavailable. Keep this page open.');}};
$('sharedConnect').onclick=sharedConnect;$('sharedRetry').onclick=sharedCheck;
setInterval(sharedCheck,20000);
window.addEventListener('online',sharedCheck);
queueMicrotask(sharedResume);
