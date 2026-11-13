'use strict';
/* Rotating tongue-in-cheek taglines under "Workout Ready" (owner idea, Nov 11, 2026).
   Add lines to TAGLINES; with more than one, they rotate every 7 seconds with a fade. */
(()=>{
 // Owner Nov 13: 'Strength. Simplified.' now; more lines can rotate later (e.g. 'The Pure. There is no Substitute').
 const TAGLINES=['Strength. Simplified.'];
 const el=document.getElementById('pureTagline');if(!el||!TAGLINES.length)return;
 let i=0;el.textContent=TAGLINES[0];
 if(TAGLINES.length<2||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 setInterval(()=>{if(document.hidden)return;el.classList.add('fading');setTimeout(()=>{i=(i+1)%TAGLINES.length;el.textContent=TAGLINES[i];el.classList.remove('fading')},600)},7000);
})();
