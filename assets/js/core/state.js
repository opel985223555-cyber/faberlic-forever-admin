/* Faberlic Forever Admin | shared state and utilities. Stable module; change by approval only. */
window.FFAdmin = window.FFAdmin || {};
(() => {
 const A=window.FFAdmin;
 A.state={mode:'',currentUser:null,lessons:[],section:'overview',editingId:null,filter:'all',search:'',busy:false};
 A.$ = selector=>document.querySelector(selector);
 A.$$=selector=>[...document.querySelectorAll(selector)];
 A.escape = (value) => String(value??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 A.notify=(msg,kind='success')=>{const n=A.$('#toast'); if(!n)return; n.textContent=msg;n.className='toast show '+kind;clearTimeout(A.toastTimer);A.toastTimer=setTimeout(()=>{n.className='toast';},4500)};

 A.youtubeId=(raw)=>{try {const u=new URL(String(raw||'').trim());const host=u.hostname.toLowerCase();const allowed=['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','www.youtube-nocookie.com','youtube-nocookie.com','youtu.be','www.youtu.be'];if(!allowed.includes(host)||!['http:','https:'].includes(u.protocol))return null;let id=host.includes('youtu.be')?u.pathname.split('/')[1]:(u.searchParams.get('v')||(/^\/(?:shorts|embed|live)\/([\w-]{11})(?:\/|$)/.exec(u.pathname)||[])[1]);return /^[\w-]{11}$/.test(id||'')?id:null;}catch{return null;}};
 A.youtubeLink=(id)=>`https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
 A.topics={
   social:[['accounts','Работа в социальных сетях'],['target','Таргетированная реклама'],['editing','Монтаж видео'],['design','Оформление и дизайн'],['content','Контент и публикации']],
   ranks:[['3','3% — Консультант'],['6','6% — Старший консультант'],['9','9% — Лидер'],['12','12% — Старший лидер'],['15','15% — Вице-директор'],['19','19% — Старший вице-директор'],['23','23% — Директор']]
 };
 A.categories=[['newbie','Новичку'],['sales','Продажи'],['recruit','Рекрутинг'],['product','Продукция'],['health','Здоровье'],['cabinet','Личный кабинет'],['team','Работа с командой'],['social','Соцсети и продвижение'],['ranks','Обучение по статусам']];
 A.categoryLabel=(id)=>A.categories.find(x=>x[0]===id)?.[1] || 'Без категории';
 A.topicLabel=(group,id)=>A.topics[group]?.find(x=>x[0]===String(id))?.[1]||'';
})();
