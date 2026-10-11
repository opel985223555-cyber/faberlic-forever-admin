
(() => {
 'use strict';
 const stage=document.getElementById('stage');
 const button=document.getElementById('replay');
 const status=document.getElementById('status');
 const setStatus=text=>{if(status) status.textContent=text;};
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 let sequence=0;
 const duration=6300;
 function replay() {
   sequence++;
   stage.classList.remove('running');
   // A single layout read restarts CSS animations, never a per-frame JS loop.
   void stage.offsetWidth;
   setStatus((reduced.matches ? 'Уменьшенное движение' : 'Предпросмотр')+' · 6,3 с · название видно 3,5 с');
   stage.classList.add('running');
 }
 stage.querySelector('.composition').addEventListener('animationend',event => {
   if(event.target!==stage.querySelector('.composition')) return;
   setStatus('Просмотр завершён · приложение не подключено');
   window.dispatchEvent(new CustomEvent('faberlic:splash-complete',{detail:{duration,sequence}}));
 });
 if(button) button.addEventListener('click',replay);
 window.FaberlicSplash=Object.freeze({replay,duration});
 // Start immediately: no black pre-roll and no second bitmap preload gate.
 document.getElementById('original').addEventListener('error',()=>setStatus('Не удалось загрузить встроенный логотип'));
 replay();
})();
