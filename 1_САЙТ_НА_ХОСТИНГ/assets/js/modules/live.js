/* CMS10: independent YouTube live schedule and recordings editor. */
(()=>{
 'use strict';const A=window.FFAdmin;let rows=[],editing=null,busy=false,loading=false,loaded=false;
 const $=s=>A.$(s);
 const val=id=>$('#live-'+id).value.trim();
 const escape=A.escape;
 const text=(row)=>[row.title,row.host||'Без ведущего',row.phase==='live'?'В эфире':row.phase==='recorded'?'Запись':'Запланирован',row.status==='published'?'Опубликовано':'Черновик',String(row.language||'ru').toUpperCase()].filter(Boolean).join(' · ');
 const dateText=(ms)=>Number.isFinite(ms)&&ms>0?new Date(ms).toLocaleString('ru-RU'):'Время не указано';
 function renderList(message){const list=$('#live-list');if(!list)return;
  if(message){list.innerHTML=`<div class="content-list-status">${escape(message)}</div>`;return;}
  if(!loaded){renderList('Загрузка эфиров…');return;}
  if(!rows.length){renderList('Эфиров пока нет. Добавь ссылку на YouTube выше.');return;}
  list.innerHTML=rows.map(x=>`<div class="content-record" data-id="${escape(x.id)}"><div class="content-record-main"><strong>${escape(x.title)}</strong><small>${escape(text(x))}<br>${escape(dateText(x.scheduledAtMs||0))}</small></div><div class="content-record-actions"><a class="small-button" href="${escape(A.youtubeLink(x.youtubeId))}" target="_blank" rel="noopener noreferrer">YouTube ↗</a><button class="small-button" data-action="edit" type="button">Изменить</button><button class="small-button" data-action="delete" type="button">Удалить</button></div></div>`).join('');
 }
 async function refresh(){if(A.state.mode!=='firebase'||!A.state.currentUser)return;if(loading)return;loading=true;renderList('Загрузка эфиров…');try{rows=await A.firebase.listContent('liveStreams');rows.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));loaded=true;renderList();}catch(e){loaded=false;renderList('Не удалось загрузить эфиры: '+e.message);A.notify('Ошибка загрузки эфиров: '+e.message,'error');}finally{loading=false;}}
 function reset(){editing=null;$('#live-form').reset();$('#live-form-title').textContent='Добавить эфир';$('#live-cancel').hidden=true;}
 function edit(x){editing=x.id;$('#live-title').value=x.title||'';$('#live-url').value=A.youtubeLink(x.youtubeId);$('#live-host').value=x.host||'';$('#live-lang').value=x.language||'ru';$('#live-phase').value=x.phase||'scheduled';$('#live-status').value=x.status||'draft';$('#live-description').value=x.description||'';$('#live-date').value=x.scheduledAtMs?new Date(x.scheduledAtMs-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16):'';$('#live-form-title').textContent='Редактировать эфир';$('#live-cancel').hidden=false;$('#live-form').scrollIntoView({block:'start',behavior:'smooth'});}
 async function save(ev){ev.preventDefault();if(busy)return;const youtubeId=A.youtubeId(val('url'));if(!youtubeId){A.notify('Укажи правильную ссылку YouTube','error');return;}let scheduledAtMs=0;
  if($('#live-date').value){scheduledAtMs=new Date($('#live-date').value).getTime();if(!Number.isFinite(scheduledAtMs)||scheduledAtMs<0){A.notify('Проверь дату эфира','error');return;}}
  const payload={title:val('title'),youtubeId,host:val('host'),description:val('description'),language:val('lang'),phase:val('phase'),status:val('status'),scheduledAtMs};
  if(!payload.title){A.notify('Название эфира обязательно','error');return;}
  const source=editing?rows.find(x=>x.id===editing):null;if(editing&&!source){A.notify('Обнови список эфиров перед редактированием','error');return;}
  busy=true;$('#live-save').disabled=true;
  try{await A.firebase.saveContent('liveStreams',payload,editing,source?.revision);reset();A.notify('Эфир сохранён');await refresh();}
  catch(e){A.notify('Ошибка сохранения эфира: '+e.message,'error');}
  finally{busy=false;$('#live-save').disabled=false;}
 }
 async function click(ev){const btn=ev.target.closest('button[data-action]');if(!btn||busy)return;const item=rows.find(x=>x.id===btn.closest('[data-id]')?.dataset.id);if(!item)return;
  if(btn.dataset.action==='edit'){edit(item);return;}
  if(btn.dataset.action==='delete'){
   if(!window.confirm(`Удалить эфир «${item.title}»?`))return;
   busy=true;try{await A.firebase.deleteContent('liveStreams',item.id,item.revision);if(editing===item.id)reset();A.notify('Эфир удалён');await refresh();}catch(e){A.notify('Ошибка удаления: '+e.message,'error');}finally{busy=false;}
  }
 }
 A.modules.live={init(){A.$on($('#live-form'),'submit',save);A.$on($('#live-cancel'),'click',reset);A.$on($('#live-new'),'click',reset);A.$on($('#live-refresh'),'click',refresh);A.$on($('#live-list'),'click',click);},render(){if(!loaded&&!loading)refresh();else renderList();},refresh};
})();
