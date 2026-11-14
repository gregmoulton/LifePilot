'use strict';
/* Updates: when a new version is ready and NO workout is in progress, switch to it and reload once (owner Nov 13:
   stale copies kept showing old screens). During a workout or cooldown it still waits and only shows a notice. */
(()=>{
 if(!('serviceWorker' in navigator)||!isSecureContext)return;
 const busy=()=>{try{return !!JSON.parse(localStorage.getItem('the-pure-hit-field-test-v2')||'{}').active}catch{return true}};
 const notice=()=>{
  if(document.getElementById('pure-update-notice'))return;
  const banner=document.createElement('aside');
  banner.id='pure-update-notice';
  banner.setAttribute('role','status');
  banner.textContent='The Pure update is ready. It installs automatically after your workout is saved.';
  document.body.appendChild(banner);
 };
 let reloading=false,waiting=null;
 const apply=()=>{if(!waiting)return;if(busy()){notice();return}waiting.postMessage({type:'SKIP_WAITING'})};
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)return;reloading=true;location.reload()});
 addEventListener('load',()=>{
  navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>{
   const take=w=>{if(w&&navigator.serviceWorker.controller){waiting=w;apply()}};
   take(reg.waiting);
   reg.addEventListener('updatefound',()=>{
    const worker=reg.installing;
    if(!worker)return;
    worker.addEventListener('statechange',()=>{if(worker.state==='installed')take(worker)});
   });
   // Check for a newer version whenever the app comes back to the screen, and re-try a held update once idle.
   document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){reg.update().catch(()=>{});apply()}});
   setInterval(apply,30000);
  }).catch(()=>{/* app remains usable online without service worker */});
 });
})();
