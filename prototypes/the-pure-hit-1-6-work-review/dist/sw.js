// The Pure: network-only service worker. It exists so Android Chrome can install the app
// as a standalone PWA. It caches NOTHING, so workout code is never served stale, and it
// never touches localStorage or workout history.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{if(event.request.method==='GET'&&new URL(event.request.url).origin===self.location.origin)event.respondWith(fetch(event.request))});
