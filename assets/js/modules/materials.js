/* CMS10: published reference materials, HTTPS-only links (no file bytes in Firestore). */
(()=>{
 'use strict';const A=window.FFAdmin;let rows=[],editing=null,busy=false,loading=false,loaded=false;
 const $=s=>A.$(s);const val=id=>$('#material-'+id)?.value.trim()||'';const escape=A.escape;
 const types={checklist:'Чек-лист',pdf:'PDF / документ',presentation:'Презентация',instruction:'Инструкция',link:'Ссылка'};
 function validLink(raw){try{const url=new URL(raw);return url.protocol==='https:'&&Boolean(url.hostname)&&!url.username&&!url.password&&raw.length<=2000;}catch{return false;}}
 function renderList(message){const list=$('#material-list');if(!list)return;
  if(message){list.innerHTML=`<div class="content-list-status">${escape(message)}</div>`;return;}
  if(!loaded){renderList('Загрузка материалов…');return;}
  if(!rows.length){renderList('Материалов пока нет. Добавь ссылку на чек-лист или презентацию выше.');return;}
  list.innerHTML=rows.map(x=>`<div class="content-record" data-id="${escape(x.id)}"><div class="content-record-main"><strong>${escape(x.title)}</strong><small>${escape(types[x.type]||'Материал')} · ${escape(String(x.language||'ru').toUpperCase())} · ${x.status==='published'?'Опубликовано':'Черновик'}</small></div><div class="content-record-actions">${validLink(x.url)?`<a class="small-button" href="${escape(x.url)}" target="_blank" rel="noopener noreferrer">Открыть ↗</a>`:'<span class="small-button">Недействительная ссылка</span>'}<button class="small-button" type="button" data-action="edit">Изменить</button><button class="small-button" type="button" data-action="delete">Удалить</button></div></div>`).join('');
 }
 async function refresh(){if(A.state.mode!=='firebase'||!A.state.currentUser)return;if(loading)return;loading=true;renderList('Загрузка материалов…');try{rows=(await A.firebase.listContent('materials')).filter(x=>x.schemaVersion!==2);rows.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));loaded=true;renderList();}catch(e){loaded=false;renderList('Не удалось загрузить материалы: '+e.message);A.notify('Ошибка загрузки материалов: '+e.message,'error');}finally{loading=false;}}
 function reset(){editing=null;$('#material-form').reset();$('#material-form-title').textContent='Добавить материал';$('#material-cancel').hidden=true;}
 function edit(x){editing=x.id;for(const key of ['title','url','type','language','status','description'])$('#material-'+(key==='language'?'lang':key))&&($('#material-'+(key==='language'?'lang':key)).value=x[key]||'');$('#material-form-title').textContent='Редактировать материал';$('#material-cancel').hidden=false;$('#material-form').scrollIntoView({block:'start',behavior:'smooth'});}
 async function save(ev){ev.preventDefault();if(busy)return;const payload={title:val('title'),url:val('url'),description:rows.find(x=>x.id===editing)?.description||'',type:val('type'),language:val('lang'),status:val('status')};
  if(!payload.title||!validLink(payload.url)){A.notify('Укажи название и корректную HTTPS-ссылку на материал','error');return;}
  const source=editing?rows.find(x=>x.id===editing):null;if(editing&&!source){A.notify('Обнови список материалов','error');return;}
  busy=true;$('#material-save').disabled=true;
  try{await A.firebase.saveContent('materials',payload,editing,source?.revision);reset();A.notify('Материал сохранён');await refresh();}
  catch(e){A.notify('Ошибка сохранения материала: '+e.message,'error');}
  finally{busy=false;$('#material-save').disabled=false;}
 }
 async function click(ev){const btn=ev.target.closest('button[data-action]');if(!btn||busy)return;const item=rows.find(x=>x.id===btn.closest('[data-id]')?.dataset.id);if(!item)return;
  if(btn.dataset.action==='edit'){edit(item);return;}
  if(btn.dataset.action==='delete'){
   if(!window.confirm(`Удалить материал «${item.title}»?`))return;
   busy=true;try{await A.firebase.deleteContent('materials',item.id,item.revision);if(editing===item.id)reset();A.notify('Материал удалён');await refresh();}catch(e){A.notify('Ошибка удаления: '+e.message,'error');}finally{busy=false;}
  }
 }
 A.modules.materials={init(){A.$on($('#material-form'),'submit',save);A.$on($('#material-cancel'),'click',reset);A.$on($('#material-new'),'click',reset);A.$on($('#material-refresh'),'click',refresh);A.$on($('#material-list'),'click',click);},render(){if(!loaded&&!loading)refresh();else renderList();},refresh};
})();
