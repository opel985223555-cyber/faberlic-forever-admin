/* CMS-07 dynamic training directory. Self-contained and safe fallbacks for absent taxonomy. */
(function(){
 'use strict';
 const availability=window.FFCategoryAvailability;
 const initialCategories=data.categories.slice();
 const priorCatName=catName;
 let catalog=null;
 let stack=[];
 const validNode=x=>x&&typeof x.id==='string'&&/^[\w-]{1,100}$/.test(x.id)&&(!x.parentId||/^[\w-]{1,100}$/.test(x.parentId))&&x.name&&typeof x.name.ru==='string'&&['active','soon','hidden'].includes(x.status);
 function defaults(){const rows=[];
  initialCategories.forEach((c,i)=>{const names={},descs={};for(const l of ['ru','tj','uz']){names[l]=CONTENT.categories[c.id]?.[l]?.[0]||c.name;descs[l]=CONTENT.categories[c.id]?.[l]?.[1]||c.subtitle||'';}rows.push({id:c.id,parentId:null,name:names,description:descs,icon:c.icon,status:'active',order:i+1});});
  for(const [group,path] of Object.entries(window.FF_LEARNING_PATHS||{}))path.topics.forEach((x,i)=>rows.push({id:group+'__'+x.id,parentId:group,name:x.name||{ru:x.id},description:{ru:'',tj:'',uz:''},status:'active',order:i+1,legacyTopicId:x.id}));
  return rows;
 }
 function nodes(){return catalog||defaults();}
 function lookup(id){return nodes().find(x=>x.id===id);}
 function getName(x){if(!x)return '';return (x.name&&((x.name[currentLang]||'').trim()||(x.name.ru||'').trim()))||x.id;}
 function getDesc(x){return (x.description&&((x.description[currentLang]||'').trim()||(x.description.ru||'').trim()))||'';}
 function kids(id){return nodes().filter(x=>(x.parentId||null)===(id||null)&&access(x.id).visible).sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0));}
 function belongs(nodeId,rootId){if(nodeId===rootId)return true;let id=nodeId,depth=0;while(id&&depth++<25){const item=lookup(id);if(!item?.parentId)return false;if(item.parentId===rootId)return true;id=item.parentId;}return false;}
 function rowLeaf(v){if(v.leafCategoryId)return v.leafCategoryId;if(v.learningPath?.group&&v.learningPath?.topic)return v.learningPath.group+'__'+v.learningPath.topic;return v.category;}
 function rowsIn(id){return data.videos.filter(v=>(!v.language||v.language===currentLang)&&belongs(rowLeaf(v),id));}
 function access(id){return availability.effective(nodes(),id,currentLang);}
 function isAllowed(id){if(!catalog)return true;return access(id).canEnter;}
 function isLessonAllowed(v){return isAllowed(rowLeaf(v));}
 function available(x){return isAllowed(x.id)&&(rowsIn(x.id).length>0||kids(x.id).length>0);}
 function soonText(){return ({ru:'Скоро',tj:'Ба наздикӣ',uz:'Тез кунда'})[currentLang]||'Скоро';}
 function descText(){return ({ru:'Уроки появятся позже',tj:'Дарсҳо баъдтар мешаванд',uz:'Дарслар кейин қўшилади'})[currentLang]||'Уроки появятся позже';}
 function createRow(x,kind){const state=access(x.id),enabled=available(x),maintenance=state.mode==='maintenance';
  const status=enabled?'<span class="arrow">›</span>':maintenance?'':`<span class="soonTag">${esc(soonText())}</span>`;
  const method=kind==='root'?'openCategory':'openLearningTopic';
  let label=kind==='root'?`<div class="itemIcon">${svgIcon(x.icon||'screen')}</div>`:`<div class="itemIcon directoryBadge">${esc(x.legacyTopicId||'▦')}</div>`;
  return `<button type="button" class="item ${enabled?'':'ffSoon'}" ${enabled?`onclick="${method}('${x.id}')"`:'disabled'}>${label}<div><b>${esc(getName(x))}</b>${getDesc(x)?`<small>${esc(getDesc(x))}</small>`:''}${maintenance?`<small class="maintenanceMessage" role="status">${esc(state.message)}</small>`:''}</div>${status}</button>`;
 }
 function categoryRoot(){const holder=$('#categoryList');if(!holder)return;holder.innerHTML=kids(null).map(x=>createRow(x,'root')).join('');directory();}
 function open(id){const node=lookup(id);if(!node||!available(node))return;stack.push(id);learningGroup=stack[0]||null;learningTopic=stack.length>1?stack[stack.length-1]:null;directory();$('#scrollArea').scrollTo({top:0,behavior:'auto'});}
 function directory(){const list=$('#categoryList'),host=$('#learningDirectory');if(!list||!host)return;
  list.hidden=stack.length>0;host.hidden=stack.length===0;if(!stack.length){host.innerHTML='';return;}
  const x=lookup(stack[stack.length-1]);if(!x||!isAllowed(x.id)){stack=[];learningGroup=null;learningTopic=null;categoryRoot();return;}
  let markup=`<button class="directoryBack" onclick="learningBack()"><span aria-hidden="true">‹</span> ${esc((UI[currentLang]?.directory?.back)||'Назад')}</button><h2 class="directoryTitle">${esc(getName(x))}</h2>`;
  if(getDesc(x))markup+=`<p class="directorySubtitle">${esc(getDesc(x))}</p>`;
  const sub=kids(x.id);if(sub.length)markup+=`<div class="list">${sub.map(child=>createRow(child,'sub')).join('')}</div>`;
  const videos=data.videos.filter(v=>rowLeaf(v)===x.id&&(!v.language||v.language===currentLang)).sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0)||(Number(a.createdAt)||0)-(Number(b.createdAt)||0));
  if(videos.length)markup+=`<div class="list">${videos.map(v=>`<button class="item" onclick="openVideo('${v.id}')"><div class="itemIcon lessonListThumb">${FFCovers.image(v,'itemThumb')||'▶'}</div><div><b>${esc(videoTitle(v.id))}</b>${v.duration?`<small>${esc(v.duration)}</small>`:''}</div><span class="arrow">›</span></button>`).join('')}</div>`;
  if(!sub.length&&!videos.length)markup+=`<div class="empty">${esc(descText())}</div>`;
  host.innerHTML=markup;
 }
 function back(){stack.pop();learningGroup=stack[0]||null;learningTopic=stack.length>1?stack[stack.length-1]:null;directory();$('#scrollArea').scrollTo({top:0,behavior:'auto'});return true;}
 function reset(){stack=[];learningGroup=null;learningTopic=null;directory();}
 window.renderCategories=categoryRoot;
 window.openCategory=open;
 window.openLearningTopic=open;
 window.renderLearningDirectory=directory;
 window.learningBack=back;
 window.resetLearningDirectory=reset;
 window.catName=function(id){const x=lookup(id);return x?getName(x):priorCatName(id);};
 window.FFCategoryCMS={isAllowed,isLessonAllowed,access,receive(raw){try{const parsed=JSON.parse(raw);if(!Array.isArray(parsed)||parsed.length>1000||!parsed.every(validNode))return;
    const found=new Set(parsed.map(x=>x.id));if(found.size!==parsed.length)return;
    if(parsed.some(x=>x.parentId&&!found.has(x.parentId)))return;
    try{for(const x of parsed){availability.validate(x);const result=availability.effective(parsed,x.id);if(result.mode==='invalid')return;}}catch{return;}
    catalog=parsed;
    const playing=data.videos.find(v=>v.id===currentVideoId);
    if(currentVideoId&&(!playing||!isLessonAllowed(playing))){if(typeof exitLessonFullscreen==='function')exitLessonFullscreen();closeLesson();}
    const iconMap=new Map(initialCategories.map(x=>[x.id,x.icon]));
    data.categories=kids(null).map(x=>({id:x.id,name:getName(x),subtitle:getDesc(x),icon:x.icon||iconMap.get(x.id)||'screen'}));
    if(stack.some(id=>!lookup(id)||!isAllowed(id)))reset();
    if(window.FFRemoteLessons?.afterCatalogChange)window.FFRemoteLessons.afterCatalogChange();
    else {renderChips();renderVideos();renderSaved();}
    categoryRoot();
  }catch(err){console.warn('Catalog was not applied',err);}},render(){categoryRoot();}};
})();
