function updateStaticUI(){
 document.documentElement.lang=currentLang==='tj'?'tg':currentLang;
 $('#search').placeholder=t().search;
 $('#continueTitle').textContent=t().continue;
 $('#historyBtn').textContent=t().history;
 $('#newTitle').textContent=t().new;
 $('#allNewBtn').textContent=t().allNew;
 $('#continueVideoTitle').textContent=videoTitle('v2');
 $('#continueVideoMeta').textContent=t().continueMeta;
 $('#materialsSub').textContent=t().sub.materials;
 $('#savedSub').textContent=t().sub.saved;
 $('#lessonHeader').textContent=t().lesson;
 $('#langSheetTitle').textContent=t().languageTitle;
 $('#langSheetSub').textContent=t().languageSub;
 $$('.navLabel').forEach(el=>el.textContent=t().nav[el.dataset.nav]);
 $('#langButtonHome').textContent=t().code;
 $('#langButtonSection').textContent=t().code;
 updateHeader(currentPage);
 $$('.langOption').forEach(el=>el.classList.toggle('active',el.dataset.lang===currentLang))
}
function updateHeader(id){
 const home=id==='home';
 $('#homeHeader').hidden=!home; $('#sectionHeader').hidden=home;
 if(!home)$('#sectionHeaderTitle').textContent=t().page[id]||''
}
function renderAll(){
 updateStaticUI(); renderBanners(); renderChips(); renderVideos(); renderCategories(); renderLive(); renderMaterials(); renderSaved(); restartBannerTimer()
}
function go(id){
 if(id==='categories')resetLearningDirectory();
 currentPage=id;
 $$('.page').forEach(p=>p.classList.remove('active')); $('#'+id).classList.add('active');
 $$('.nav').forEach(n=>n.classList.toggle('active',n.dataset.page===id));
 updateHeader(id); $('#scrollArea').scrollTo({top:0,behavior:'auto'}); if(id==='saved')renderSaved()
}

function openLanguageSheet(){$('#langOverlay').classList.add('show');$$('.langOption').forEach(el=>el.classList.toggle('active',el.dataset.lang===currentLang))}
function closeLanguageSheet(){$('#langOverlay').classList.remove('show')}
function setLanguage(lang){
 currentLang=lang; localStorage.setItem('ff_lang',lang); closeLanguageSheet(); renderAll();
 if($('#lessonOverlay').classList.contains('show')&&currentVideoId)openVideo(currentVideoId)
}

function installScrollGuard(){
 const scroller=$('#scrollArea'); if(!scroller)return; let startY=0;
 scroller.addEventListener('touchstart',e=>{if(e.touches.length)startY=e.touches[0].clientY},{passive:true});
 scroller.addEventListener('touchmove',e=>{
   if(!e.touches.length)return; const y=e.touches[0].clientY,dy=y-startY;
   const atTop=scroller.scrollTop<=0,atBottom=Math.ceil(scroller.scrollTop+scroller.clientHeight)>=scroller.scrollHeight;
   if((atTop&&dy>0)||(atBottom&&dy<0))e.preventDefault()
 },{passive:false})
}

window.ffHandleBack=function(){
 if($('#langOverlay').classList.contains('show')){closeLanguageSheet();return true}
 if($('#lessonOverlay').classList.contains('show')){closeLesson();return true}
 if(currentPage==='categories' && learningGroup){learningBack();return true}
 if(currentPage!=='home'){go('home');return true}
 return false
}

document.addEventListener('DOMContentLoaded',()=>{
 lockViewport(); renderAll(); installScrollGuard(); $('#search').addEventListener('input',renderVideos)
});
window.addEventListener('orientationchange',()=>setTimeout(lockViewport,350));
