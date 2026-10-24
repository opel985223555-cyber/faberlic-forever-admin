/* CMS-08: editable content taxonomy. Existing IDs are immutable: lesson references remain intact. */
(()=>{
 const A=window.FFAdmin;
 const availability=A.categoryAvailability;
 let editingRevision;
 const seed=()=>Array.isArray(window.FF_CATALOG_DEFAULTS)
   ? structuredClone(window.FF_CATALOG_DEFAULTS)
   : A.categories.map(([id,title],i)=>({id,parentId:null,name:{ru:title},description:{ru:''},status:'active',order:i+1}));
 const items=()=>A.state.catalog||seed();
 const node=id=>items().find(x=>x.id===id);
 const children=id=>items().filter(x=>(x.parentId||null)===(id||null)).sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0)||a.id.localeCompare(b.id));
 const isChild=(id,parentId)=>{let cur=node(id),n=0;while(cur?.parentId&&n++<20){if(cur.parentId===parentId)return true;cur=node(cur.parentId);}return false;};
 const ancestor=id=>{let cur=node(id),n=0;while(cur?.parentId&&n++<20)cur=node(cur.parentId);return cur?.id||id;};
 const label=(id,lang='ru')=>node(id)?.name?.[lang]||node(id)?.name?.ru||A.categoryLabel(id)||id;
 const breadcrumb=id=>{const path=[],visited=new Set();let cur=node(id);while(cur&&!visited.has(cur.id)&&path.length<21){visited.add(cur.id);path.unshift(label(cur.id));cur=node(cur.parentId)}return path.join(' / ')||id;};
 const leaf=v=>v.leafCategoryId||((v.topicId&&['social','ranks'].includes(v.categoryId))?v.categoryId+'__'+v.topicId:v.categoryId)||'newbie';
 const populated=id=>A.state.lessons.some(v=>leaf(v)===id||isChild(leaf(v),id));
 const published=id=>A.state.lessons.some(v=>v.status==='published'&&(leaf(v)===id||isChild(leaf(v),id)));
 const ensure=async()=>{if(A.state.catalog)return;await A.repo.saveCatalog(seed());await A.refreshAll();};
 // Hidden and 'soon' sections must remain selectable by the administrator, especially when editing an existing lesson.
 function listOptions(){const ordered=[],visited=new Set();function visit(parent,depth=0){if(depth>20)return;for(const x of children(parent)){if(visited.has(x.id))continue;visited.add(x.id);const suffix=x.status==='hidden'?' [Скрыт]':availability.mode(x)==='maintenance'?' [Техническое обслуживание]':x.status==='soon'?' [Скоро]':'';ordered.push([x.id,breadcrumb(x.id)+suffix]);visit(x.id,depth+1);}}visit(null);return ordered;}
 const selectHTML=(selected='newbie')=>listOptions().map(([id,l])=>`<option value="${A.escape(id)}" ${selected===id?'selected':''}>${A.escape(l)}</option>`).join('');
 function edit(id){const x=node(id);if(!x)return;editingRevision=A.state.catalogRevision;A.$('#category-edit-id').value=x.id;A.$('#category-parent').value=x.parentId||'';
   for(const lang of ['ru','tj','uz']){A.$('#category-name-'+lang).value=x.name?.[lang]||'';A.$('#category-desc-'+lang).value=x.description?.[lang]||'';}
   A.$('#category-status').value=availability.mode(x)||'active';A.$('#category-form-title').textContent='Редактировать раздел';A.$('#category-save').textContent='Сохранить изменения';A.$('#category-form').scrollIntoView({behavior:'smooth',block:'start'});
 }
 function clear(){editingRevision=undefined;A.$('#category-form').reset();A.$('#category-edit-id').value='';A.$('#category-form-title').textContent='Добавить раздел';A.$('#category-save').textContent='Добавить раздел';}
 function render(){const holder=A.$('#categories-list');if(!holder)return;
   A.$('#category-parent').innerHTML='<option value="">Главная категория</option>'+listOptions().map(([id,n])=>`<option value="${A.escape(id)}">${A.escape(n)}</option>`).join('');
   A.$('#catalog-init-note').hidden=Boolean(A.state.catalog);
   const ordered=[];const visited=new Set();function visit(parent,depth=0){if(depth>20)return;for(const x of children(parent)){if(visited.has(x.id))continue;visited.add(x.id);ordered.push({...x,_depth:depth});visit(x.id,depth+1);}}visit(null);
   holder.innerHTML=ordered.map(x=>{const mode=availability.mode(x),access=availability.effective(items(),x.id);let status=mode==='maintenance'?'Закрыто на техническое обслуживание':x.status==='soon'?'Скоро':x.status==='hidden'?'Скрыт':'Открыт';
     if(x.status==='active'&&!published(x.id))status='Скоро · нет опубликованных уроков';
     if(access.blockedBy&&access.blockedBy!==x.id)status+=' · '+(access.mode==='hidden'?'Родительский раздел скрыт':'Родительский раздел закрыт');
     const actions=[['active','Открыть'],['hidden','Скрыть'],['maintenance','Закрыть']].filter(([value])=>value!==mode).map(([value,text])=>`<button type="button" class="small-button" data-category-access="${A.escape(x.id)}" data-access-mode="${value}">${text}</button>`).join('');
     return `<div class="catalog-item" style="gap:12px;padding-left:${Math.min(x._depth,6)*16}px"><div class="number-icon">${x.parentId?'↳':'▦'}</div><div><strong>${A.escape(breadcrumb(x.id))}</strong><small>${A.escape(x.description?.ru||'Без описания')} · ${status}</small></div><div class="category-actions"><button type="button" class="small-button" data-category-edit="${A.escape(x.id)}">Изменить</button><button type="button" class="small-button" data-category-delete="${A.escape(x.id)}">Удалить</button>${actions}<button type="button" class="small-button" data-category-shift="${A.escape(x.id)}" data-step="-1" aria-label="Выше">↑</button><button type="button" class="small-button" data-category-shift="${A.escape(x.id)}" data-step="1" aria-label="Ниже">↓</button></div></div>`;}).join('');
   A.modules.videos?.refreshCategoryOptions?.();
 }
 const normalize=(all,parentId)=>{const rows=all.filter(x=>(x.parentId||null)===(parentId||null)).sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0)||a.id.localeCompare(b.id));rows.forEach((x,i)=>{x.order=i+1;});};
 async function save(e){e.preventDefault();if(A.state.busy)return;
   const id=A.$('#category-edit-id').value,parent=A.$('#category-parent').value||null,existing=node(id);
   if(parent&&!node(parent)){A.notify('Родительский раздел не найден','error');return;}
   if(id&&(id===parent||isChild(parent,id))){A.notify('Нельзя переместить раздел внутрь самого себя','error');return;}
   if(existing&&existing.parentId!==parent&&populated(id)){A.notify('У этого раздела есть видео. Чтобы сохранить их привязки, сначала перенеси уроки в другую категорию. Переименование и изменение статуса доступны.','error');return;}
   const name={},description={};for(const lang of ['ru','tj','uz']){name[lang]=A.$('#category-name-'+lang).value.trim();description[lang]=A.$('#category-desc-'+lang).value.trim();}
   if(!name.ru){A.notify('Укажи название на русском','error');return;}
   const fresh=items().map(x=>structuredClone(x));const key=id||'section_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
   if(!existing&&fresh.some(x=>x.id===key)){A.notify('Раздел уже существует','error');return;}
   const moved=Boolean(existing&&existing.parentId!==parent);
   const next=availability.apply({...existing,id:key,parentId:parent,name,description,order:moved||!existing?Math.max(0,...fresh.filter(x=>(x.parentId||null)===parent&&x.id!==key).map(x=>Number(x.order)||0))+1:existing.order},A.$('#category-status').value);
   const index=fresh.findIndex(x=>x.id===key);if(index>=0)fresh[index]=next;else fresh.push(next);

   try{A.dataGuard.catalog(fresh);}catch(err){A.notify(err.message,'error');return;}
   A.state.busy=true;A.$('#category-save').disabled=true;
   try{await A.repo.saveCatalog(fresh,editingRevision);clear();try{await A.refreshAll();A.notify('Раздел сохранён');}catch(err){A.notify('Раздел сохранён, но список не обновлён. Обновите страницу: '+err.message,'error');}}catch(err){A.notify('Ошибка сохранения раздела: '+err.message,'error');}
   finally{A.state.busy=false;A.$('#category-save').disabled=false;}
 }
 async function shift(id,delta){if(A.state.busy)return;const x=node(id);if(!x)return;const siblings=children(x.parentId),index=siblings.findIndex(r=>r.id===id),other=siblings[index+delta];if(!other)return;
   const all=items().map(x=>structuredClone(x));const left=all.find(v=>v.id===id),right=all.find(v=>v.id===other.id);const a=Number(left.order)||0,b=Number(right.order)||0;left.order=b;right.order=a;if(a===b){if(delta<0){left.order=Math.max(0,a-1);right.order=a+1;}else{left.order=a+1;right.order=Math.max(0,a-1);}}
   A.state.busy=true;try{await A.repo.saveCatalog(all);await A.refreshAll();A.notify('Порядок разделов сохранён');}catch(err){A.notify('Не удалось изменить порядок: '+err.message,'error');}finally{A.state.busy=false;}
 }
 async function changeAccess(id,value){
   if(A.state.busy)return;const x=node(id);if(!x||availability.mode(x)===value)return;
   const title=label(id),verb=value==='hidden'?'Скрыть':value==='maintenance'?'Закрыть на техническое обслуживание':'Открыть';
   if(value!=='active'&&!window.confirm(verb+' категорию «'+title+'»? Ограничение распространяется на вложенные категории. Видео сохранятся.'))return;
   const revision=A.state.catalogRevision;
   const fresh=items().map(row=>row.id===id?availability.apply(row,value):structuredClone(row));
   A.state.busy=true;
   try{await A.repo.saveCatalog(fresh,revision);
     try{await A.refreshAll();const access=availability.effective(items(),id);A.notify(value==='active'&&access.blockedBy?'Категория открыта, но доступ ограничен родительской категорией':value==='active'?'Категория открыта':value==='hidden'?'Категория скрыта':'Категория закрыта на техническое обслуживание');}
     catch(err){A.notify('Доступность сохранена, но список не обновлён. Обновите страницу: '+err.message,'error');}
   }catch(err){A.notify('Не удалось изменить доступность: '+err.message,'error');try{await A.refreshAll();}catch{/* Load failure blocks further writes. */}}
   finally{A.state.busy=false;}
 }
 async function remove(id){
   if(A.state.busy)return;const x=node(id);if(!x)return;
   if(populated(id)||A.state.lessons.some(v=>v.categoryId===id)){A.notify('Нельзя удалить категорию «'+label(id)+'»: в ней есть видео. Сначала перенесите или удалите видео вручную.','error');return;}
   if(children(id).length){A.notify('Нельзя удалить категорию «'+label(id)+'»: в ней есть вложенные категории. Сначала перенесите или удалите их.','error');return;}
   if(!window.confirm('Удалить категорию «'+label(id)+'»? Это действие нельзя отменить.'))return;
   const fresh=items().filter(v=>v.id!==id).map(v=>structuredClone(v));
   A.state.busy=true;
   try{await A.repo.saveCatalog(fresh,A.state.catalogRevision);if(A.$('#category-edit-id').value===id)clear();
     try{await A.refreshAll();A.notify('Категория удалена');}catch(err){A.notify('Категория удалена, но список не обновлён. Обновите страницу: '+err.message,'error');}
   }catch(err){A.notify('Не удалось удалить категорию: '+err.message,'error');try{await A.refreshAll();}catch{/* Existing load error blocks further mutations. */}}
   finally{A.state.busy=false;}
 }
 function init(){A.$on(A.$('#category-form'),'submit',save);A.$on(A.$('#category-new'),'click',clear);
   A.$on(A.$('#catalog-init'),'click',async()=>{if(A.state.busy)return;A.state.busy=true;A.$('#catalog-init').disabled=true;try{await ensure();A.notify('Структура категорий опубликована');}catch(e){A.notify('Не удалось опубликовать структуру. Проверь правила Firestore: '+e.message,'error');}finally{A.state.busy=false;A.$('#catalog-init').disabled=false;}});
   A.$on(A.$('#categories-list'),'click',e=>{const b=e.target.closest('[data-category-edit],[data-category-shift],[data-category-delete],[data-category-access]');if(!b||A.state.busy)return;if(b.dataset.categoryAccess)changeAccess(b.dataset.categoryAccess,b.dataset.accessMode);else if(b.dataset.categoryDelete)remove(b.dataset.categoryDelete);else if(b.dataset.categoryEdit)edit(b.dataset.categoryEdit);else if(b.dataset.categoryShift)shift(b.dataset.categoryShift,Number(b.dataset.step));});
 }
 A.catalog={items,node,children,label,ancestor,isChild,breadcrumb,selectHTML,seed};A.modules.categories={init,render};
})();
