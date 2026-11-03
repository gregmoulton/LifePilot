'use strict';
(()=>{
 const names={today:'Overview',workout:'Workout',history:'History',body:'Body & tests',backup:'Backup',more:'More'};
 function route(){const key=location.hash.slice(1);const view=Object.hasOwn(names,key)?key:'workout';document.body.classList.toggle('workout-mode',view==='workout');document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('hidden',el.dataset.view!==view));document.querySelectorAll('#nav a').forEach(a=>{const active=a.hash==='#'+view;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});document.querySelectorAll('#phoneTabs a').forEach(a=>{const active=a.dataset.tab===(['today','body'].includes(view)?'more':view);a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});document.getElementById('page-label').textContent=names[view];window.scrollTo({top:0,behavior:'instant'});}
 addEventListener('hashchange',route);route();
})();
