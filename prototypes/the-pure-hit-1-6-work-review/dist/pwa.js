'use strict';
/* No automatic activation or forced reload during a workout. */
(()=>{
 if(!('serviceWorker' in navigator)||!isSecureContext)return;
 const notice=()=>{
  if(document.getElementById('pure-update-notice'))return;
  const banner=document.createElement('aside');
  banner.id='pure-update-notice';
  banner.setAttribute('role','status');
  banner.textContent='The Pure update is ready. Finish and save your workout, then close and reopen the app to receive it.';
  document.body.appendChild(banner);
 };
 addEventListener('load',()=>{
  navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>{
   if(reg.waiting&&navigator.serviceWorker.controller)notice();
   reg.addEventListener('updatefound',()=>{
    const worker=reg.installing;
    if(!worker)return;
    worker.addEventListener('statechange',()=>{
     if(worker.state==='installed'&&navigator.serviceWorker.controller)notice();
    });
   });
  }).catch(()=>{/* app remains usable online without service worker */});
 });
})();
