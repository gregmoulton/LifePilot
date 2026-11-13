/* The Pure review-only offline shell. Never skipWaiting or claim cloud backup. */
const CACHE='the-pure-shell-canonical-ring-2-pure-icon-ladder-v1-modes';
const FILES=['./','./style.css','./hit.css','./focus.css','./workout-summary.css','./compact.css','./workout-summary.js','./summary-brand.webp','./ready-athlete.webp','./ready-push.webp','./ready-squat.webp','./ready-pull.webp','./ready-wordmark.webp','./local-voice.js','./provenance.js','./journal.js','./devices.js','./ladder.js','./grade.js','./ladder.css','./app.js','./navigation.js','./pwa.js','./voice-local.js','./voice-music-vosk.js','./voice-music-vosk-worker.js','./voice-music-worklet.js','./icon.svg','./icons/pure-v1-favicon-48.png','./icons/pure-v1-apple-touch-180.png','./icons/pure-v1-192.png','./icons/pure-v1-512.png','./icons/pure-v1-maskable-192.png','./icons/pure-v1-maskable-512.png','./manifest.webmanifest'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('the-pure-shell-')&&k!==CACHE).map(k=>caches.delete(k)))));
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
 if(request.mode==='navigate'){
  event.respondWith(caches.open(CACHE).then(cache=>cache.match('./')).then(html=>html||fetch(request)));
  return;
 }
 event.respondWith(caches.open(CACHE).then(cache=>cache.match(request)).then(cached=>cached||fetch(request)));
});
