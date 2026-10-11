/* Editable content taxonomy: isolated CMS module. Persisted to taxonomy/catalog. */
(()=>{
 const A=window.FFAdmin;
 const seed=()=>{if(Array.isArray(window.FF_CATALOG_DEFAULTS))return structuredClone(window.FF_CATALOG_DEFAULTS);
  const out=A.categories.map(([id,title],i)=>({id,parentId:null,name:{ru:title,tj:title,uz:title},description:{ru:'',tj:'',uz:''},status:'active',order:i+1}));
  for(const [parent,items] of Object.entries(A.topics))items.forEach(([id,title],i)=>out.push({id:parent+'__'+id,parentId:parent,name:{ru:title,tj:title,uz:title},description:{ru:'',tj:'',uz:''},status:'active',order:i+1,legacyTopicId:id}));
  return out;
 };
 const items=()=>A.state.catalog||seed();
 const node=id=>items().find(x=>x.id===id);
 const children=id=>items().filter(x=>(x.parentId||null)===(id||null)).sort((a,b)=>(a.order||0)-(b.order||0));
 const ancestor=id=>{let cur=node(id),n=0;while(cur?.parentId&&n++<20)cur=node(cur.parentId);return cur?.id||id;};
 const isChild=(id,parentId)=>{let cur=node(id),n=0;while(cur?.parentId&&n++<20){if(cur.parentId===parentId)return true;cur=node(cur.parentId);}return false;};
 const label=(id,lang='ru')=>node(id)?.name?.[lang]||node(id)?.name?.ru||A.categoryLabel(id)||id;
 const breadcrumb=id=>{const path=[];let c=node(id),i=0;while(c&&i++<20){path.unshift(label(c.id));c=node(c.parentId)}return path.join(' / ')};
 const ensure=async()=>{if(A.state.catalog)return;await A.repo.saveCatalog(seed());await A.refreshAll();};
 function listOptions(){return items().filter(x=>x.status!=='hidden').map(x=>[x.id,breadcrumb(x.id)]);}
 function selectHTML(selected='newbie'){
  return listOptions().map(([id,l])=>`<option value="${A.escape(id)}" ${selected===id?'selected':''}>${A.escape(l)}</option>`).join('');
 }
 function edit(id){const x=node(id);if(!x)return;A.$('#category-edit-id').value=x.id;A.$('#category-parent').value=x.parentId||'';for(const lang of ['ru','tj','uz']){A.$('#category-name-'+lang).value=x.name?.[lang]||'';A.$('#category-desc-'+lang).value=x.description?.[lang]||'';}A.$('#category-status').value=x.status||'active';A.$('#category-form-title').textContent='Редактировать раздел';A.$('#category-save').textContent='Сохранить изменения';A.$('#category-form').scrollIntoView({behavior:'smooth',block:'start'})}
 function clear(){A.$('#category-form').reset();A.$('#category-edit-id').value='';A.$('#category-form-title').textContent='Добавить раздел';A.$('#category-save').textContent='Добавить раздел';}
 function render(){const holder=A.$('#categories-list');if(!holder)return;
  const current=items(),initialized=Boolean(A.state.catalog);
  A.$('#category-parent').innerHTML='<option value="">Главная категория</option>'+current.map(x=>`<option value="${A.escape(x.id)}">${A.escape(breadcrumb(x.id))}</option>`).join('');
  A.$('#catalog-init-note').hidden=initialized;
  const ordered=[];const visit=(parent,depth=0)=>{if(depth>20)return;children(parent).forEach(x=>{ordered.push({...x,_depth:depth});visit(x.id,depth+1);});};visit(null);
  holder.innerHTML=ordered.map(x=>`<div class="catalog-item" style="gap:12px;padding-left:${Math.min(x._depth,6)*16}px"><div class="number-icon">${x.parentId?'↳':'▦'}</div><div><strong>${A.escape(breadcrumb(x.id))}</strong><small>${A.escape(x.description?.ru||'Без описания')} · ${x.status==='soon'?'Скоро':x.status==='hidden'?'Скрыт':'Открыт'}</small></div><button type="button" class="small-button" data-category-edit="${A.escape(x.id)}">Изменить</button><button type="button" class="small-button" data-category-shift="${A.escape(x.id)}" data-step="-1" aria-label="Выше">↑</button><button type="button" class="small-button" data-category-shift="${A.escape(x.id)}" data-step="1" aria-label="Ниже">↓</button></div>`).join('');
  A.modules.videos?.refreshCategoryOptions?.();
 }
 async function save(e){e.preventDefault();const id=A.$('#category-edit-id').value;const parent=A.$('#category-parent').value||null;
  const existing=node(id);if(id&&(id===parent||isChild(parent,id))){A.notify('Нельзя переместить раздел внутрь самого себя','error');return;}
  const name={},description={};for(const lang of ['ru','tj','uz']){name[lang]=A.$('#category-name-'+lang).value.trim();description[lang]=A.$('#category-desc-'+lang).value.trim();}
  if(!name.ru){A.notify('Укажи название на русском','error');return;}
  const fresh=items().map(x=>structuredClone(x));const key=id||'section_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6);
  if(!existing && fresh.some(x=>x.id===key)){A.notify('Раздел уже существует','error');return;}
  const next={...existing,id:key,parentId:parent,name,description,status:A.$('#category-status').value,order:existing?.order||children(parent).length+1};
  const idx=fresh.findIndex(x=>x.id===key);if(idx>=0)fresh[idx]=next;else fresh.push(next);
  try{await A.repo.saveCatalog(fresh);await A.refreshAll();clear();A.notify('Раздел сохранён');}catch(err){A.notify('Ошибка: '+err.message,'error')}
 }
 async function shift(id,delta){const x=node(id);if(!x)return;const siblings=children(x.parentId),idx=siblings.findIndex(r=>r.id===id),other=siblings[idx+delta];if(!other)return;
  const all=items().map(x=>structuredClone(x));const orderIds=siblings.map(x=>x.id);[orderIds[idx],orderIds[idx+delta]]=[orderIds[idx+delta],orderIds[idx]];
  orderIds.forEach((id,i)=>all.find(x=>x.id===id).order=i+1);
  try{await A.repo.saveCatalog(all);await A.refreshAll();A.notify('Порядок разделов сохранён');}catch(err){A.notify('Не удалось изменить порядок: '+err.message,'error')}
 }
 function init(){A.$on(A.$('#category-form'),'submit',save);A.$on(A.$('#category-new'),'click',clear);A.$on(A.$('#catalog-init'),'click',async()=>{try{await ensure();A.notify('Структура категорий опубликована')}catch(e){A.notify('Ошибка: '+e.message,'error')}});
  A.$on(A.$('#categories-list'),'click',e=>{const b=e.target.closest('[data-category-edit],[data-category-shift]');if(!b)return;if(b.dataset.categoryEdit)edit(b.dataset.categoryEdit);else if(b.dataset.categoryShift)shift(b.dataset.categoryShift,Number(b.dataset.step))});
 }
 A.catalog={items,node,children,label,ancestor,isChild,breadcrumb,selectHTML,seed};A.modules.categories={init,render};
})();
