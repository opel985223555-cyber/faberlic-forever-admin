/* CMS-07-YT: video editing, auto-append order and manual arrows/drag reordering. Thumbnails always come from YouTube. */
(()=>{
 const A=window.FFAdmin;
 const $=A.$;
 const selectOptions=(values,selected)=>values.map(([v,l])=>`<option value="${A.escape(v)}" ${selected===v?'selected':''}>${A.escape(l)}</option>`).join('');
 const getVideo=id=>A.state.lessons.find(v=>v.id===id);
 const leaf=v=>v.leafCategoryId||((v.topicId&&['social','ranks'].includes(v.categoryId))?v.categoryId+'__'+v.topicId:v.categoryId)||'newbie';
 const scope=v=>leaf(v)+'|'+(v.language||'ru');
 const compare=(a,b)=>(Number(a.order)||0)-(Number(b.order)||0)||dateMs(a)-dateMs(b)||a.id.localeCompare(b.id);
 const dateMs=v=>v.createdAt?.toMillis?.()||Number(v.createdAt||0)||0;
 function updateCoverPreview(){const id=A.youtubeId($('#lesson-url').value);const preview=$('#youtube-cover-preview'),img=$('#youtube-cover-preview-img');preview.hidden=!id;if(id)img.src='https://i.ytimg.com/vi/'+id+'/hqdefault.jpg';else img.removeAttribute('src');}
 function refreshCategoryOptions(){const s=$('#lesson-category'),chosen=s?.value||'newbie';if(!s)return;s.innerHTML=A.catalog.selectHTML(chosen);if([...s.options].some(o=>o.value===chosen))s.value=chosen;
  const f=$('#filter-category'),v=f?.value||'all';if(f){f.innerHTML='<option value="all">Все разделы</option>'+A.catalog.selectHTML(v);f.value=[...f.options].some(o=>o.value===v)?v:'all';}
  const current=A.catalog.node(s.value);$('#topic-row').hidden=true;
 }
 function clearForm(){A.state.editingId=null;$('#lesson-form').reset();refreshCategoryOptions();$('#form-heading').textContent='Новый видеоурок';$('#save-lesson').textContent='Сохранить урок';$('#cancel-edit').hidden=true;$('#lesson-status').value='published';$('#lesson-orientation').value='vertical';$('#lesson-lang').value='ru';updateCoverPreview();}
 function edit(id){const v=getVideo(id);if(!v)return;A.navigate('videos');A.state.editingId=v.id;$('#lesson-title').value=v.title||'';$('#lesson-url').value=v.youtubeUrl||A.youtubeLink(v.youtubeId||'');refreshCategoryOptions();$('#lesson-category').value=leaf(v);$('#lesson-description').value=v.description||'';$('#lesson-lang').value=v.language||'ru';$('#lesson-orientation').value=v.orientation||'vertical';$('#lesson-status').value=v.status||'draft';updateCoverPreview();$('#form-heading').textContent='Редактирование урока';$('#save-lesson').textContent='Сохранить изменения';$('#cancel-edit').hidden=false;$('#form-card').scrollIntoView({behavior:'smooth',block:'start'});}
 function categoryPath(id){const x=A.catalog.node(id);if(!x)return {root:id,first:null};let first=null,cur=x,root=x,steps=0;while(cur?.parentId&&steps++<20){first=cur;root=A.catalog.node(cur.parentId);if(!root)break;cur=root;}return {root:root?.id||id,first:first?.id||null};}
 async function save(e){e.preventDefault();if(A.state.busy)return;const title=$('#lesson-title').value.trim(),youtubeId=A.youtubeId($('#lesson-url').value),selected=$('#lesson-category').value,language=$('#lesson-lang').value;const id=A.state.editingId,old=id?getVideo(id):null;
  if(!title){A.notify('Введите название урока','error');return;}if(!youtubeId){A.notify('Укажите корректную ссылку YouTube','error');return;}
  const path=categoryPath(selected),groupId=['social','ranks'].includes(path.root)?path.root:null;
  let topicId=null;if(groupId){const first=A.catalog.node(path.first);topicId=first?.legacyTopicId||first?.id?.replace(groupId+'__','')||null;}
  const targetScope=selected+'|'+language,oldScope=old?scope(old):null;
  const siblings=A.state.lessons.filter(v=>v.id!==id&&scope(v)===targetScope);const max=Math.max(0,...siblings.map(v=>Number(v.order)||0));
  const order=old&&oldScope===targetScope?(Number(old.order)||1):max+1;
  const payload={title,youtubeUrl:A.youtubeLink(youtubeId),youtubeId,categoryId:path.root,leafCategoryId:selected,groupId,topicId,description:$('#lesson-description').value.trim(),language,orientation:$('#lesson-orientation').value,status:$('#lesson-status').value,order};
  A.state.busy=true;$('#save-lesson').disabled=true;
  try{await A.repo.save(payload,id);await A.refreshAll();clearForm();A.notify('Урок сохранён. Порядок выставлен автоматически.');}
  catch(err){A.notify('Ошибка сохранения: '+err.message,'error');}
  finally{A.state.busy=false;$('#save-lesson').disabled=false;}
 }
 async function remove(id){const v=getVideo(id);if(!v||!confirm(`Удалить урок «${v.title}»?`))return;try{await A.repo.remove(id);await A.refreshAll();if(A.state.editingId===id)clearForm();A.notify('Урок удалён');}catch(e){A.notify('Ошибка удаления: '+e.message,'error')}}
 async function reorder(ids){try{await A.repo.reorder(ids);await A.refreshAll();A.notify('Новый порядок сохранён');}catch(err){A.notify('Порядок не сохранён: '+err.message,'error')}}
 async function move(id,delta){const v=getVideo(id);if(!v)return;const siblings=A.state.lessons.filter(x=>scope(x)===scope(v)).sort(compare),pos=siblings.findIndex(x=>x.id===id),to=pos+delta;if(to<0||to>=siblings.length)return;const ids=siblings.map(x=>x.id);[ids[pos],ids[to]]=[ids[to],ids[pos]];await reorder(ids)}
 function card(v){const id=A.escape(v.id),cover=`https://i.ytimg.com/vi/${encodeURIComponent(v.youtubeId)}/hqdefault.jpg`,subtitle=A.catalog.breadcrumb(leaf(v));return `<article class="lesson-row" draggable="true" data-lesson="${id}">
  <img class="lesson-thumb" src="${A.escape(cover)}" alt="Обложка" loading="lazy" onerror="this.style.visibility='hidden'">
  <div class="lesson-info"><strong>${A.escape(v.title)}</strong><span>${A.escape(subtitle)}</span><small>${A.escape((v.language||'ru').toUpperCase())} · ${v.orientation==='vertical'?'9:16':'16:9'} · № ${Number(v.order)||1}</small></div>
  <div class="lesson-actions"><span class="status-chip ${v.status==='published'?'published':'draft'}">${v.status==='published'?'Опубликовано':'Черновик'}</span><div class="mini-actions"><button class="small-button" data-move="${id}" data-delta="-1" aria-label="Переместить вверх">↑</button><button class="small-button" data-move="${id}" data-delta="1" aria-label="Переместить вниз">↓</button><button class="small-button" data-edit="${id}">Изменить</button><a class="small-button" href="${A.youtubeLink(v.youtubeId)}" target="_blank" rel="noopener noreferrer">YouTube ↗</a><button class="small-button danger" data-delete="${id}">Удалить</button></div></div></article>`;}
 function render(){const host=$('#lesson-list');if(!host)return;
  const term=($('#filter-search')?.value||'').trim().toLowerCase(),status=$('#filter-status')?.value||'all',category=$('#filter-category')?.value||'all',lang=$('#filter-lang')?.value||'all';
  const lessons=A.state.lessons.filter(v=>(status==='all'||v.status===status)&&(lang==='all'||v.language===lang)&&(category==='all'||leaf(v)===category||A.catalog.isChild(leaf(v),category))&&(!term||String(v.title||'').toLowerCase().includes(term)||A.catalog.breadcrumb(leaf(v)).toLowerCase().includes(term)))
    .sort((a,b)=>A.catalog.breadcrumb(leaf(a)).localeCompare(A.catalog.breadcrumb(leaf(b)),'ru')||(a.language||'').localeCompare(b.language||'')||compare(a,b));
  $('#lesson-count').textContent=`${lessons.length} из ${A.state.lessons.length}`;host.innerHTML=lessons.length?lessons.map(card).join(''):'<div class="empty-state"><strong>В этом разделе пока нет уроков</strong><p>Добавь первую ссылку YouTube через форму выше.</p></div>';
 }
 function init(){refreshCategoryOptions();clearForm();
  A.$on($('#lesson-form'),'submit',save);A.$on($('#cancel-edit'),'click',clearForm);
  A.$on($('#lesson-url'),'input',e=>{const id=A.youtubeId(e.target.value);$('#youtube-hint').textContent=id?'✓ YouTube-ссылка распознана':'Поддерживаются YouTube, Shorts и youtu.be';updateCoverPreview()});
  for(const id of ['filter-category','filter-lang','filter-search','filter-status'])A.$on($('#'+id),'change',render);
  A.$on($('#filter-search'),'input',render);
  A.$on($('#lesson-list'),'click',e=>{const b=e.target.closest('[data-edit],[data-delete],[data-move]');if(!b)return;if(b.dataset.edit)edit(b.dataset.edit);else if(b.dataset.delete)remove(b.dataset.delete);else if(b.dataset.move)move(b.dataset.move,Number(b.dataset.delta));});
  let dragging='';A.$on($('#lesson-list'),'dragstart',e=>{dragging=e.target.closest('[data-lesson]')?.dataset.lesson||'';});A.$on($('#lesson-list'),'dragover',e=>{const target=e.target.closest('[data-lesson]');if(target&&dragging){e.preventDefault();target.classList.add('dragover')}});A.$on($('#lesson-list'),'dragleave',e=>{e.target.closest('[data-lesson]')?.classList.remove('dragover')});
  A.$on($('#lesson-list'),'drop',e=>{const target=e.target.closest('[data-lesson]');if(!target||!dragging)return;e.preventDefault();const v=getVideo(dragging),w=getVideo(target.dataset.lesson);if(v&&w&&scope(v)===scope(w)&&v.id!==w.id){const siblings=A.state.lessons.filter(x=>scope(x)===scope(v)).sort(compare),ids=siblings.map(x=>x.id),from=ids.indexOf(v.id),to=ids.indexOf(w.id);ids.splice(from,1);ids.splice(to,0,v.id);reorder(ids);}else A.notify('Перемещать уроки можно внутри одного раздела и языка','error');dragging='';render();});
  A.$on($('#new-video'),'click',()=>{A.navigate('videos');clearForm();$('#form-card').scrollIntoView({behavior:'smooth',block:'start'});});
 }
 A.modules.videos={init,render,clearForm,refreshCategoryOptions};
})();
