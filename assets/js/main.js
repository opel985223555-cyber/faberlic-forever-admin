/* Faberlic Forever Admin — production bootstrap. Firebase auth only. */
(()=>{
 const A=window.FFAdmin;
 const boot=async()=>{
  A.modules.videos.init();A.modules.categories.init();A.modules.materials.init();A.modules.promocodes.init();
  A.$$('.nav-button').forEach(btn=>A.$on(btn,'click',()=>A.navigate(btn.dataset.page)));
  A.$on(A.$('#open-sidebar'),'click',()=>A.$('#sidebar').classList.toggle('open'));
  A.$on(A.$('#log-out'),'click',async()=>{try{await A.firebase.signOut();}finally{await A.setMode('');}});
  A.$on(A.$('#login-form'),'submit',async(e)=>{
   e.preventDefault();
   if(!A.firebaseReady()){A.notify('Подключение Firebase ещё не настроено','error');return;}
   const submit=A.$('#sign-in');submit.disabled=true;submit.textContent='Входим…';
   try{await A.firebase.signIn(A.$('#login-email').value.trim(),A.$('#login-password').value)}
   catch(err){A.notify('Вход не выполнен: '+err.message,'error')}
   finally{submit.disabled=false;submit.textContent='Войти в админ-панель'};
  });
  const enabled=A.firebaseReady();
  A.$('#auth-info').textContent=enabled?'Войдите с учётной записью администратора.':'Подключение к Firebase ещё не настроено. Доступ закрыт.';
  await A.setMode('');
  if(enabled){
   const started=await A.firebase.init(user=>{if(user)A.setMode('firebase',user);else if(A.state.mode==='firebase')A.setMode('');});
   if(!started)A.notify('Не удалось запустить Firebase. Проверьте настройки подключения.','error');
  }
 };
 document.addEventListener('DOMContentLoaded',boot);
})();
