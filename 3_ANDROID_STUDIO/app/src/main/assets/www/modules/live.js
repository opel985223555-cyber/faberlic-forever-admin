/* CMS10: published YouTube live events, sourced exclusively from Firestore. */
(function(){
 'use strict';let items=null,error='';
 const language=(code)=>({ru:'RU',tj:'TJ',uz:'UZ'}[code]||'RU');
 const phaseLabel=(x)=>x.phase==='live'?'● ПРЯМОЙ ЭФИР':x.phase==='recorded'?'Запись эфира':'Запланирован';
 const localTime=(ms)=>Number(ms)>0?new Date(ms).toLocaleString(currentLang==='tj'?'tg-TJ':currentLang==='uz'?'uz-UZ':'ru-RU') :'';
 function renderLive(){const target=$('#liveList');if(!target)return;
  if(items===null){target.innerHTML=`<div class="empty">${esc(error||'Загрузка эфиров…')}</div>`;return;}
  const filtered=items.filter(x=>x.language===currentLang).slice().sort((a,b)=>(a.phase==='live'?0:a.phase==='scheduled'?1:2)-(b.phase==='live'?0:b.phase==='scheduled'?1:2) || (a.scheduledAtMs||0)-(b.scheduledAtMs||0));
  if(!filtered.length){target.innerHTML='<div class="empty">Эфиры на этом языке пока не опубликованы.</div>';return;}
  target.innerHTML=filtered.map(x=>`<button class="item ffContentRow" data-stream="${esc(x.id)}"><div class="itemIcon">▶</div><div><b>${esc(x.title)}</b><small>${esc(phaseLabel(x))} · ${esc(language(x.language))}${x.host?' · '+esc(x.host):''}${x.scheduledAtMs?' · '+esc(localTime(x.scheduledAtMs)):''}</small></div><span class="arrow">›</span></button>`).join('');
  target.querySelectorAll('[data-stream]').forEach(btn=>btn.addEventListener('click',()=>openLiveStream(btn.dataset.stream)));
 }
 function openLiveStream(id){const row=items?.find(x=>x.id===id);if(!row||!row.youtubeId)return;
  currentVideoId=null;
  $('#lessonHeader').textContent=currentLang==='tj'?'Эфир':currentLang==='uz'?'Эфир':'Эфир';
  $('#favoriteBtn').hidden=true;
  $('#lessonTitle').textContent=row.title;
  $('#lessonCat').textContent=phaseLabel(row)+' · '+language(row.language);
  $('#lessonDesc').textContent=[row.host,row.description].filter(Boolean).join(' · ');
  const p=$('#player');p.className='player horizontal';p.innerHTML=`<iframe src="https://tj.faberlic.forever/assets/www/player/index.html?v=${encodeURIComponent(row.youtubeId)}" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
  $('#lessonOverlay').classList.add('show');
 }
 window.FFContentModules=window.FFContentModules||{};
 window.FFContentModules.receiveLive=(json)=>{try{const raw=JSON.parse(json);items=Array.isArray(raw)?raw.filter(x=>/^[A-Za-z0-9_-]{11}$/.test(x.youtubeId)&&['ru','tj','uz'].includes(x.language)&&/^[A-Za-z0-9_-]+$/.test(x.id)):[];error='';renderLive();}catch(e){error='Ошибка данных эфиров';items=null;renderLive();}};
 window.FFContentModules.errorLive=(msg)=>{items=null;error=String(msg||'Ошибка Firebase');renderLive();};
 window.renderLive=renderLive;
})();
