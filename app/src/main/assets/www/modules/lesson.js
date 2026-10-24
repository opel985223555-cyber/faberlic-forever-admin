function videoYoutubeId(v){
 if(v.youtubeIds&&v.youtubeIds[currentLang])return v.youtubeIds[currentLang];
 if(currentLang==='ru')return v.youtubeId||'';
 return ''
}
function openVideo(id){
 const v=data.videos.find(x=>x.id===id); if(!v)return;
 if(window.FFCategoryCMS&&!window.FFCategoryCMS.isLessonAllowed(v))return;
 currentVideoId=id;
 $('#lessonTitle').textContent=videoTitle(v.id);
 $('#lessonHeader').textContent=t().lesson;$('#favoriteBtn').hidden=false;
 $('#lessonCat').textContent=`${catName(v.category)} · ${v.duration} · ${t().code}`;
 $('#lessonDesc').textContent=videoDesc(v.id);
 const p=$('#player'); p.className='player '+(v.orientation==='horizontal'?'horizontal':'vertical');
 const yid=videoYoutubeId(v);
 if(yid){
   p.innerHTML=`<iframe src="https://tj.faberlic.forever/assets/www/player/index.html?v=${encodeURIComponent(yid)}" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe>`
 }else{
   p.innerHTML=`<div id="playerContent"><button class="bigPlay" aria-label="Play"><svg viewBox="0 0 24 24"><path d="M9.2 6.8 17 12l-7.8 5.2z"/></svg></button><small>${esc(t().noVideo)}</small></div>`
 }
 updateFavoriteButton();
 $('#lessonOverlay').classList.add('show')
}
function closeLesson(){$('#lessonOverlay').classList.remove('show');$('#player').replaceChildren();currentVideoId=null}

/* CMS10: the app's own fullscreen control is deliberately below the player.
   YouTube's internal Shorts controls are owned by YouTube and cannot be moved. */
function expandLessonVideo(){
 const shell=document.getElementById('lessonPlayerShell');
 if(!shell)return;
 try{
  const request=shell.requestFullscreen||shell.webkitRequestFullscreen;
  if(request){const result=request.call(shell);if(result&&result.catch)result.catch(()=>{});}
 }catch(_){/* YouTube's native control remains available if WebView refuses. */}
}
function exitLessonFullscreen(){
 try{if(document.fullscreenElement)document.exitFullscreen();else if(document.webkitFullscreenElement)document.webkitExitFullscreen?.();}catch(_){}
}
