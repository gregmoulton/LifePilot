'use strict';
// Registers the network-only service worker on HTTPS (or localhost). Failure never affects the workout.
if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1')){
 addEventListener('load',()=>{navigator.serviceWorker.register('sw.js',{scope:'./'}).catch(()=>{})});
}
