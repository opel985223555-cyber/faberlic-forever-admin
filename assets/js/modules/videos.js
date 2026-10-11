/* Video lessons module. Safe to change without changing the other tabs. */
(()=>{
 const A=window.FFAdmin;
 const selectOptions=(values,selected)=>values.map(([v,l])=>`<option value="${A.escape(v)}" ${selected===v?'selected':''}>${A.escape(l)}</option>`).join('');
 const categories=()=>selectOptions(A.categories,A.$('#lesson-category')?.value||'newbie');
 function setTopic(category,chosen=''){
  const topic=A.$('#lesson-topic'),group=A.topics[category];
  A.$('#topic-row').hidden=!group;
  if(group){topic.innerHTML=selectOptions(group,chosen||group[0][0])}else{topic.innerHTML=''}
 }
 function clearForm(){A.state.editingId=null;A.$('#lesson-form').reset();A.$('#lesson-category').innerHTML=selectOptions(A.categories,'newbie');setTopic('newbie');A.$('#form-heading').textContent='Новый видеоурок';A.$('#save-lesson').textContent='Сохранить урок';A.$('#cancel-edit').hidden=true;A.$('#lesson-status').value='draft';A.$('#lesson-orientation').value='vertical';A.$('#lesson-lang').value='ru';A.$('#lesson-order').value='0';}
 function edit(id){const v=A.state.lessons.find(x=>x.id===id);if(!v)return;A.navigate('videos');A.state.editingId=v.id;
  A.$('#lesson-title').value=v.title||'';A.$('#lesson-url').value=v.youtubeUrl||A.youtubeLink(v.youtubeId||'');A.$('#lesson-category').value=v.categoryId||'newbie';setTopic(v.categoryId||'newbie',v.topicId||'');
  A.$('#lesson-description').value=v.description||'';A.$('#lesson-lang').value=v.language||'ru';A.$('#lesson-orientation').value=v.orientation||'vertical';A.$('#lesson-status').value=v.status||'draft';A.$('#lesson-order').value=v.order??0;
  A.$('#form-heading').textContent='Редактирование урока';A.$('#save-lesson').textContent='Сохранить изменения';A.$('#cancel-edit').hidden=false;A.$('#form-card').scrollIntoView({behavior:'smooth',block:'start'});
 }
 const normalize=d=>({title:d.title.trim(),youtubeUrl:A.youtubeLink(d.youtubeId),youtubeId:d.youtubeId,categoryId:d.categoryId,groupId:A.topics[d.categoryId]?d.categoryId:null,topicId:A.topics[d.categoryId]?d.topicId:null,description:d.description.trim(),language:d.language,orientation:d.orientation,status:d.status,order:Number(d.order)||0});
 async function save(e){e.preventDefault();if(A.state.busy)return;
  const raw={title:A.$('#lesson-title').value,youtubeUrl:A.$('#lesson-url').value,categoryId:A.$('#lesson-category').value,topicId:A.$('#lesson-topic').value,description:A.$('#lesson-description').value,language:A.$('#lesson-lang').value,orientation:A.$('#lesson-orientation').value,status:A.$('#lesson-status').value,order:A.$('#lesson-order').value};
  if(!raw.title.trim()){A.notify('Введите название урока','error');return;}
  raw.youtubeId=A.youtubeId(raw.youtubeUrl);
  if(!raw.youtubeId){A.notify('Укажите корректную ссылку на YouTube','error');return;}
  A.state.busy=true;A.$('#save-lesson').disabled=true;
  try{await A.repo.save(normalize(raw),A.state.editingId);await A.refreshAll();clearForm();A.notify('Урок сохранён');}
  catch(e){A.notify('Не удалось сохранить: '+e.message,'error')}
  finally{A.state.busy=false;A.$('#save-lesson').disabled=false;}
 }
 async function remove(id){const v=A.state.lessons.find(x=>x.id===id);if(!v)return;if(!confirm(`Удалить урок «${v.title}»?`))return;
  try{await A.repo.remove(id);await A.refreshAll();if(A.state.editingId===id)clearForm();A.notify('Урок удалён');}
  catch(e){A.notify('Ошибка удаления: '+e.message,'error')}
 }
 const card=(v)=>{const id=A.escape(v.id),title=A.escape(v.title),category=A.escape(A.categoryLabel(v.categoryId)),topic=A.escape(A.topicLabel(v.groupId,v.topicId)),order=Number(v.order)||0;
  return `<article class="lesson-row">
     <img class="lesson-thumb" src="https://img.youtube.com/vi/${encodeURIComponent(v.youtubeId)}/mqdefault.jpg" alt="Обложка урока" loading="lazy" onerror="this.style.visibility='hidden'" />
     <div class="lesson-info"><strong>${title}</strong><span>${category}${topic?' · '+topic:''}</span><small>${A.escape((v.language||'ru').toUpperCase())} · ${v.orientation==='vertical'?'9:16':'16:9'} · порядок ${order}</small></div>
     <div class="lesson-actions"><span class="status-chip ${v.status==='published'?'published':'draft'}">${v.status==='published'?'Опубликовано':'Черновик'}</span><div class="mini-actions">
     <button type="button" class="small-button" data-edit="${id}">Изменить</button><a class="small-button" href="${A.youtubeLink(v.youtubeId)}" target="_blank" rel="noopener noreferrer">YouTube ↗</a><button type="button" class="small-button danger" data-delete="${id}">Удалить</button>
     </div></div></article>`;
 };
 function render(){const host=A.$('#lesson-list');if(!host)return;
  const term=(A.$('#filter-search')?.value||'').trim().toLowerCase();const filter=A.$('#filter-status')?.value||'all';
  const lessons=[...A.state.lessons].filter(v=>(filter==='all'||v.status===filter)&&(!term||String(v.title||'').toLowerCase().includes(term)||A.categoryLabel(v.categoryId).toLowerCase().includes(term))).sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0));
  A.$('#lesson-count').textContent=`${lessons.length} из ${A.state.lessons.length}`;
  host.innerHTML=lessons.length?lessons.map(card).join(''):`<div class="empty-state"><span>▷</span><strong>${term||filter!=='all'?'По фильтру ничего не найдено':'Уроков пока нет'}</strong><p>Добавьте ссылку YouTube через форму выше.</p></div>`;
 }
 function init(){A.$('#lesson-category').innerHTML=selectOptions(A.categories,'newbie');setTopic('newbie');clearForm();
  A.$on(A.$('#lesson-category'),'change',e=>setTopic(e.target.value));A.$on(A.$('#lesson-form'),'submit',save);
  A.$on(A.$('#cancel-edit'),'click',clearForm);
  A.$on(A.$('#lesson-url'),'input',e=>{const id=A.youtubeId(e.target.value);A.$('#youtube-hint').textContent=id?'✓ YouTube-ссылка распознана':'Поддерживается YouTube, Shorts и youtu.be';A.$('#youtube-hint').classList.toggle('valid',!!id)});
  A.$on(A.$('#filter-search'),'input',render);A.$on(A.$('#filter-status'),'change',render);
  A.$on(A.$('#lesson-list'),'click',e=>{const b=e.target.closest('[data-edit],[data-delete]');if(!b)return;if(b.dataset.edit)edit(b.dataset.edit);if(b.dataset.delete)remove(b.dataset.delete)});
  A.$on(A.$('#new-video'),'click',()=>{A.navigate('videos');clearForm();A.$('#form-card').scrollIntoView({behavior:'smooth',block:'start'});});
 }
 A.modules.videos={init,render,clearForm};
})();
