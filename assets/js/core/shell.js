/* Shell, navigation and permissions. Do not modify individual modules from here. */
(() => {
 const A=window.FFAdmin;
 A.setMode=async(mode,user=null)=>{
   A.state.mode=mode;A.state.currentUser=user;
   A.$('#login-screen').hidden=!!mode;A.$('#admin-shell').hidden=!mode;
   A.$('#mode-pill').textContent='Firebase · защищённый доступ';
   A.$('#operator').textContent=user?.email||'—';
   if(mode){try{await A.repo.refresh();A.navigate('overview')}catch(e){A.notify('Ошибка загрузки уроков: '+e.message,'error')}}
 };
 A.navigate=(section)=>{
   A.state.section=section;
   A.$$('.nav-button').forEach(btn=>btn.classList.toggle('active',btn.dataset.page===section));
   A.$$('.module-view').forEach(el=>el.hidden=el.dataset.module!==section);
   const headings={overview:'Обзор',videos:'Видеоуроки',categories:'Категории',ranks:'Обучение по статусам',live:'Эфиры',materials:'Материалы',settings:'Настройки'};
   A.$('#page-title').textContent=headings[section]||'Админ-панель';
   A.$('#sidebar').classList.remove('open');
   if(A.modules[section]?.render)A.modules[section].render();
 };
 A.modules={};
 A.refreshAll=async()=>{await A.repo.refresh();A.modules.overview?.render();A.modules.videos?.render();};
 A.$on=(el,type,handler)=>el?.addEventListener(type,handler);
})();
