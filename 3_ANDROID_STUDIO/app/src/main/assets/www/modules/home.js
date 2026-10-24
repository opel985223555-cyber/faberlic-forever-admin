function getActiveBanners(){return data.banners.filter(b=>b.active)}
function changeBanner(step){
 const arr=getActiveBanners(); if(arr.length<2)return;
 bannerIndex=(bannerIndex+step+arr.length)%arr.length; renderBanners(); restartBannerTimer()
}
function restartBannerTimer(){
 clearInterval(bannerTimer); const arr=getActiveBanners();
 if(arr.length>1)bannerTimer=setInterval(()=>changeBanner(1),3800)
}
function renderBanners(){
 const arr=getActiveBanners(),wrap=$('#heroWrap');
 if(!arr.length){wrap.innerHTML='';return}
 bannerIndex=Math.min(bannerIndex,arr.length-1);
 const b=arr[bannerIndex],text=CONTENT.banners[b.id]?.[currentLang]||CONTENT.banners[b.id]?.ru||[b.label,b.title,b.text];
 wrap.innerHTML=`
 <div class="hero ${FFCovers.url(data.videos.find(v=>v.id===b.videoId),true)?'hasCover':''}" id="heroBox">
   ${FFCovers.image(data.videos.find(v=>v.id===b.videoId),'bannerThumbnail',true)}
   ${arr.length>1?'<button class="bannerArrow" aria-label="Следующий баннер" onclick="event.stopPropagation();changeBanner(1)"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>':''}
   <span class="badge">${esc(text[0])}</span>
   <h1>${esc(text[1])}</h1>
   <p>${esc(text[2])}</p>
   <button class="cta" onclick="openVideo('${b.videoId}')">
     <span>${esc(t().watch)}</span>
     <svg viewBox="0 0 24 24"><path d="M9 5.5 15.5 12 9 18.5"/></svg>
   </button>
 </div>
 <div class="dots">${arr.map((_,i)=>`<button class="dot ${i===bannerIndex?'active':''}" onclick="bannerIndex=${i};renderBanners();restartBannerTimer()"></button>`).join('')}</div>`;
 bindBannerSwipe()
}
function bindBannerSwipe(){
 const hero=$('#heroBox'); if(!hero)return; let sx=0,sy=0;
 hero.addEventListener('touchstart',e=>{const p=e.changedTouches[0];sx=p.clientX;sy=p.clientY},{passive:true});
 hero.addEventListener('touchend',e=>{const p=e.changedTouches[0],dx=p.clientX-sx,dy=p.clientY-sy;if(Math.abs(dx)>42&&Math.abs(dx)>Math.abs(dy))changeBanner(dx<0?1:-1)},{passive:true})
}

function renderChips(){
 $('#chips').innerHTML=`<button class="chip ${activeCategory==='all'?'active':''}" onclick="setCat('all')">${esc(t().all)}</button>`+
 data.categories.filter(c=>data.videos.some(v=>v.category===c.id&&(!v.language||v.language===currentLang))).slice(0,6).map(c=>`<button class="chip ${activeCategory===c.id?'active':''}" onclick="setCat('${c.id}')">${esc(catName(c.id))}</button>`).join('')
}
function setCat(id){activeCategory=id;renderChips();renderVideos()}
function renderVideos(){
 const q=($('#search')?.value||'').toLowerCase().trim();
 const arr=data.videos.filter(v=>{
   const title=videoTitle(v.id).toLowerCase(),cat=catName(v.category).toLowerCase();
   return (activeCategory==='all'||v.category===activeCategory)&&(!q||title.includes(q)||cat.includes(q))
 }).slice(0,8);
 $('#videoGrid').innerHTML=arr.map(v=>`
 <article class="videoCard" onclick="openVideo('${v.id}')">
   <div class="cover">${FFCovers.image(v,'youtubeThumb')}${v.isNew?`<span class="new">${esc(t().newBadge)}</span>`:''}<span class="playmini">▶</span>${v.duration?`<span class="time">${esc(v.duration)}</span>`:''}</div>
   <div class="videoInfo"><span class="kicker">${esc(catName(v.category))}</span><b>${esc(videoTitle(v.id))}</b><small>${v.orientation==='vertical'?esc(t().vertical):esc(t().horizontal)}</small></div>
 </article>`).join('')||`<div class="empty">${esc(t().noSaved)}</div>`
}
