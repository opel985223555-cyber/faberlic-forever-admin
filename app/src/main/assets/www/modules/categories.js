function svgIcon(name){
 const icons={
  spark:'<svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>',
  bars:'<svg viewBox="0 0 24 24"><rect x="4" y="14" width="3" height="6" rx="1"/><rect x="10.5" y="9" width="3" height="11" rx="1"/><rect x="17" y="4" width="3" height="16" rx="1"/></svg>',
  users:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="16.5" cy="9" r="2.4"/><path d="M3.5 19c.5-4 2.8-6 5.5-6s5 2 5.5 6zM14 18.8c.4-2.8 1.8-4.4 4-4.4 1.4 0 2.4.7 3 2"/></svg>',
  diamond:'<svg viewBox="0 0 24 24"><path d="M5 5h14l3 5-10 11L2 10z"/><path d="M7.8 5 12 21 16.2 5M2.5 10h19" class="cut"/></svg>',
  heart:'<svg viewBox="0 0 24 24"><path d="M12 20.5S3.5 15.8 3.5 9.8c0-3.3 4.1-5.1 8.5-.8 4.4-4.3 8.5-2.5 8.5.8 0 6-8.5 10.7-8.5 10.7z"/></svg>',
  screen:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="13" rx="2"/><rect x="9" y="19" width="6" height="2" rx="1"/></svg>',
  trophy:'<svg viewBox="0 0 24 24"><path d="M8 4h8v5c0 3-1.8 5-4 5s-4-2-4-5zM10 14h4v4h3v2H7v-2h3z"/><path d="M8 6H4c0 3 1 5 4 5M16 6h4c0 3-1 5-4 5" class="cut"/></svg>',
  team:'<svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2.5 19c.5-4 2.8-6 5.5-6s5 2 5.5 6M10.5 19c.5-4 2.8-6 5.5-6s5 2 5.5 6"/></svg>'
 }; return icons[name]||icons.spark;
}

// The category root stays in the original Categories screen; only the directory drills down.
let learningGroup = null, learningTopic = null;
function pathText(map){return map?.[currentLang]||map?.ru||''}
function renderCategories(){
 const target=$('#categoryList'); if(!target)return;
 target.innerHTML=data.categories.map(c=>`
 <button class="item" onclick="openCategory('${c.id}')">
   <div class="itemIcon">${svgIcon(c.icon)}</div>
   <div><b>${esc(catName(c.id))}</b><small>${esc(content('categories',c.id,1))}</small></div>
   <span class="arrow">›</span>
 </button>`).join('');
 renderLearningDirectory();
}
function openCategory(id){
 // A category always opens inside Categories. Never switch to Home.
 if(!data.categories.some(c=>c.id===id))return;
 learningGroup=id;
 learningTopic=null;
 renderLearningDirectory();
 $('#scrollArea').scrollTo({top:0,behavior:'auto'});
}
function openLearningTopic(topicId){
 if(!learningGroup)return;
 const group=window.FF_LEARNING_PATHS?.[learningGroup];
 if(!group?.topics.some(x=>x.id===topicId))return;
 learningTopic=topicId;renderLearningDirectory();
 $('#scrollArea').scrollTo({top:0,behavior:'auto'});
}
function learningBack(){
 if(learningTopic!==null){learningTopic=null;}
 else{learningGroup=null;}
 renderLearningDirectory();$('#scrollArea').scrollTo({top:0,behavior:'auto'});
 return true;
}
function resetLearningDirectory(){learningGroup=null;learningTopic=null;renderLearningDirectory()}
function renderLearningDirectory(){
 const list=$('#categoryList'),detail=$('#learningDirectory'); if(!list||!detail)return;
 const isLearningPath=Boolean(learningGroup&&window.FF_LEARNING_PATHS?.[learningGroup]);
 const isStandard=Boolean(learningGroup && data.categories.some(c=>c.id===learningGroup) && !isLearningPath);
 const isOpen=isLearningPath||isStandard;
 list.hidden=isOpen;detail.hidden=!isOpen;
 if(!isOpen){detail.innerHTML='';return;}
 const back=(UI[currentLang]?.directory?.back)||'Назад';
 let html=`<button class="directoryBack" onclick="learningBack()"><span aria-hidden="true">‹</span> ${esc(back)}</button>`;
 if(isStandard){
   // Render uploaded lessons locally inside this category; the other screens remain untouched.
   const catId=learningGroup;
   const lessons=data.videos.filter(v=>v.category===catId && (!v.language || v.language===currentLang))
     .sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0) || (Number(a.createdAt)||0)-(Number(b.createdAt)||0));
   html+=`<h2 class="directoryTitle">${esc(catName(catId))}</h2>`;
   html+=`<p class="directorySubtitle">${esc(content('categories',catId,1))}</p>`;
   html+=lessons.length?`<div class="list">${lessons.map(v=>`<button class="item" onclick="openVideo('${v.id}')"><div class="itemIcon lessonListThumb">${FFCovers.image(v,'itemThumb')||'▶'}</div><div><b>${esc(videoTitle(v.id))}</b>${v.duration?`<small>${esc(v.duration)}</small>`:''}</div><span class="arrow">›</span></button>`).join('')}</div>`
     :`<div class="empty">${esc(t().directory.empty)}</div>`;
   detail.innerHTML=html;
   return;
 }
 const group=window.FF_LEARNING_PATHS[learningGroup];
 const topic=group.topics.find(x=>x.id===learningTopic);
 if(!topic){
   html+=`<h2 class="directoryTitle">${esc(pathText(group.titles))}</h2><p class="directorySubtitle">${esc(pathText(group.subtitle))}</p>`;
   html+=`<div class="list">${group.topics.map(item=>`<button class="item" onclick="openLearningTopic('${item.id}')">
    <div class="itemIcon directoryBadge">${learningGroup==='ranks'?esc(item.id)+'%':svgIcon('screen')}</div>
    <div><b>${esc(pathText(item.name))}</b></div><span class="arrow">›</span>
   </button>`).join('')}</div>`;
 }else{
   const title=pathText(topic.name);
   html+=`<h2 class="directoryTitle">${esc(title)}</h2><p class="directorySubtitle">${esc(pathText(group.titles))}</p>`;
   const lessons=data.videos.filter(v=>v.learningPath?.group===learningGroup&&v.learningPath?.topic===learningTopic);
   if(!lessons.length){html+=`<div class="empty">${esc(t().directory.empty)}</div>`;}
   else {html+=`<div class="list">${lessons.map(v=>`<button class="item" onclick="openVideo('${v.id}')"><div class="itemIcon lessonListThumb">${FFCovers.image(v,'itemThumb')||'▶'}</div><div><b>${esc(videoTitle(v.id))}</b>${v.duration?`<small>${esc(v.duration)}</small>`:''}</div><span class="arrow">›</span></button>`).join('')}</div>`;}
 }
 detail.innerHTML=html;
}
