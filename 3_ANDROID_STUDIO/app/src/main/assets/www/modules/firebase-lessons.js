/* Published lesson synchronizer — isolated, read-only, no changes to approved layout modules. */
(function(){
  'use strict';
  let cloudRows=null;
  let errorMessage='';
  let waitingTimer=null;
  const diagnosticBuild='CMS-07';
  const supportsBridge=()=>Boolean(window.FaberlicLessonsAndroid &&
    typeof window.FaberlicLessonsAndroid.subscribe==='function');
  const cancelWait=()=>{if(waitingTimer){clearTimeout(waitingTimer);waitingTimer=null;}};
  function watchServer(){
    cancelWait();
    waitingTimer=setTimeout(()=>{
      if(cloudRows===null)showMessage('Нет ответа Firebase. Проверь интернет и нажми «Повторить». ('+diagnosticBuild+')',true);
    },15000);
  }
  function reload(){
    errorMessage='';cloudRows=null;
    showMessage('Повторное подключение к Firebase… ('+diagnosticBuild+')');
    watchServer();
    try{window.FaberlicLessonsAndroid.subscribe();}
    catch(e){showMessage('Ошибка подключения к Android: '+String(e.message||e),true);}
  }
  const langName={ru:'Урок',tj:'Дарс',uz:'Дарс'};
  function normalize(row){
    if (!row || !/^[A-Za-z0-9_-]{1,120}$/.test(String(row.id||'')) ||
        !/^[A-Za-z0-9_-]{11}$/.test(String(row.youtubeId||''))) return null;
    if (!['ru','tj','uz'].includes(row.language))return null;
    const group = ['social','ranks'].includes(row.groupId) ? row.groupId : null;
    const topic = group && String(row.topicId||'') ? String(row.topicId) : null;
    return {
      id:'cloud_'+row.id,
      title:String(row.title||'Без названия'),
      description:String(row.description||''),
      category:String(row.categoryId||'newbie'),
      leafCategoryId:String(row.leafCategoryId||''),
      language:row.language,
      duration:'',
      orientation:row.orientation==='horizontal'?'horizontal':'vertical',
      order:Number(row.order)||0,
      createdAt:Number(row.createdAt)||0,
      isNew:true,
      youtubeId:row.youtubeId,
      youtubeIds:{[row.language]:row.youtubeId},
      learningPath:group&&topic?{group,topic}:null
    };
  }
  function sortVideos(a,b){
    return a.order-b.order || a.createdAt-b.createdAt || a.id.localeCompare(b.id);
  }
  function refreshSupplemental(videos){
    const continueCard=document.querySelector('button.continue');
    // Preserve the approved card and layout. Replace its obsolete demonstration
    // title/target with the first real lesson instead of hiding the UI block.
    const title=document.querySelector('#continueVideoTitle');
    const meta=document.querySelector('#continueVideoMeta');
    if(continueCard && title && meta){
      const v=videos[0];
      title.textContent=v?v.title:(currentLang==='ru'?'Уроков пока нет':currentLang==='tj'?'Ҳоло дарс нест':'Ҳозирча дарс йўқ');
      meta.textContent=v?catName(v.category):'';
      continueCard.onclick=v?()=>openVideo(v.id):()=>{};
      continueCard.disabled=!v;
      const preview=continueCard.querySelector('.preview');
      if(preview){
        const previous=preview.querySelector('.continueThumb');
        if(previous)previous.remove();
        if(v){
          const markup=FFCovers.image(v,'continueThumb');
          if(markup)preview.insertAdjacentHTML('afterbegin',markup);
        }
      }
    }
    // Keep the approved carousel layout, but bind it to real published lessons.
    window.FF_DATA.banners=videos.slice(0,3).map((v,i)=>({
      id:'firebase_banner_'+i,active:true,
      label:(langName[currentLang]||langName.ru).toUpperCase(),
      title:v.title,
      text:v.description||catName(v.category),
      videoId:v.id
    }));
    if(!videos.length)window.FF_DATA.banners=[];
  }
  function apply(){
    const source=cloudRows===null?data.videos:cloudRows;
    const videos=source.filter(v=>v.language===currentLang&&(!window.FFCategoryCMS||window.FFCategoryCMS.isLessonAllowed(v))).sort(sortVideos);
    window.FF_DATA.videos=videos;
    // Existing file's `data` points to the same FF_DATA object.
    refreshSupplemental(videos);
    if(activeCategory!=='all'&&window.FFCategoryCMS&&!window.FFCategoryCMS.isAllowed(activeCategory))activeCategory='all';
    renderBanners();restartBannerTimer();renderChips();renderVideos();renderSaved();renderCategories();renderLearningDirectory();
    // A lesson may have been unpublished while its player was open.
    if(currentVideoId && !videos.some(v=>v.id===currentVideoId)){exitLessonFullscreen();closeLesson();}
    if(errorMessage && !videos.length)showMessage(errorMessage,true);
    else if(!videos.length)showMessage({ru:'На этом языке опубликованных уроков пока нет.',tj:'Ба ин забон ҳоло дарс нест.',uz:'Бу тилда ҳозирча дарс йўқ.'}[currentLang]);
  }
  function showMessage(message,retry=false){
    const host=document.querySelector('#videoGrid');
    if(!host)return;
    host.innerHTML='<div class="empty" role="status">'+esc(message)+
      (retry?'<p><button type="button" id="retryFirebaseLessons" style="padding:9px 16px;margin-top:12px;border:1px solid #d4ff39;border-radius:8px;background:#14190f;color:#d4ff39">Повторить</button></p>':'')+'</div>';
    const button=document.getElementById('retryFirebaseLessons');
    if(button)button.addEventListener('click',reload);
  }
  window.FFRemoteLessons={
    receive(json){
      try{
        const raw=JSON.parse(json);
        if(!Array.isArray(raw))throw Error('Invalid lessons payload');
        cancelWait();
        cloudRows=raw.map(normalize).filter(Boolean);
        // Never display the six bundled demonstration videos after real synchronization.
        for(const key of Object.keys(CONTENT.videos)){
          if(key.startsWith('cloud_'))delete CONTENT.videos[key];
        }
        errorMessage='';
        if(raw.length>0 && cloudRows.length===0){
          showMessage('Firebase вернул '+raw.length+' урок(ов), но они не прошли проверку данных. ('+diagnosticBuild+')',true);
          return;
        }
        apply();
      }catch(e){this.failure('Ошибка обработки списка видеоуроков.');}
    },
    failure(message){
      cancelWait();
      errorMessage=String(message||'Не удалось загрузить видеоуроки');
      if(cloudRows===null)showMessage(errorMessage,true);
    },
    status(message){
      if(cloudRows===null)showMessage(String(message||'Подключение к Firebase…'));
    },
    afterLanguageChange(){apply();},
    afterCatalogChange(){apply();}
  };
  document.addEventListener('DOMContentLoaded',()=>{
    if(!window.FaberlicLessonsAndroid ||
       typeof window.FaberlicLessonsAndroid.subscribe!=='function')return;
    // Avoid exposing bundled, fictional example lessons to real app users.
    window.FF_DATA.videos=[];
    window.FF_DATA.banners=[];
    if(activeCategory!=='all'&&window.FFCategoryCMS&&!window.FFCategoryCMS.isAllowed(activeCategory))activeCategory='all';
    renderBanners();restartBannerTimer();renderChips();renderVideos();renderSaved();renderCategories();renderLearningDirectory();
    showMessage('Загрузка видеоуроков… ('+diagnosticBuild+')');
    watchServer();
    try{window.FaberlicLessonsAndroid.subscribe();}
    catch(e){cancelWait();showMessage('Ошибка Android-моста: '+String(e.message||e),true);}
    // Language selection is handled by the frozen navigation module; re-filter afterward.
    document.addEventListener('click',event=>{
      if(event.target.closest('.langOption'))queueMicrotask(()=>window.FFRemoteLessons.afterLanguageChange());
    });
  });
})();
