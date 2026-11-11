/* The Pure review-only offline shell. Never skipWaiting or claim cloud backup. */
const CACHE='the-pure-shell-canonical-ring-1';
const FILES=['./','./style.css','./hit.css','./focus.css','./workout-summary.css','./workout-summary.js','./summary-brand.webp','./ready-athlete.webp','./ready-push.webp','./ready-squat.webp','./ready-pull.webp','./ready-wordmark.webp','./local-voice.js','./provenance.js','./journal.js','./devices.js','./app.js','./navigation.js','./pwa.js','./voice-local.js','./voice-music-vosk.js','./voice-music-vosk-worker.js','./voice-music-worklet.js','./icon.svg','./pure-ring-32.png','./pure-ring-180.png','./pure-ring-192.png','./pure-ring-512.png','./pure-ring-maskable.png','./manifest.webmanifest'];
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
