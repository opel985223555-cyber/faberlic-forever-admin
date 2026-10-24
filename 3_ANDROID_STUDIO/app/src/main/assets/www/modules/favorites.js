function renderSaved(){
 const target=$('#savedList'); if(!target)return;
 const ids=savedIds(),arr=data.videos.filter(v=>ids.includes(v.id));
 target.innerHTML=arr.length?`<div class="list">${arr.map(v=>`<button class="item" onclick="openVideo('${v.id}')"><div class="itemIcon lessonListThumb">${FFCovers.image(v,'itemThumb')||'▶'}</div><div><b>${esc(videoTitle(v.id))}</b><small>${esc(catName(v.category))}${v.duration?' · '+esc(v.duration):''}</small></div><span class="arrow">›</span></button>`).join('')}</div>`:
 `<div class="empty"><b>${esc(t().noSaved)}</b><br>${esc(t().saveHint)}</div>`
}

function heartIcon(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.15-4.56-9.33-8.24C.46 9.03 3 4.8 6.88 4.8c2.1 0 4 1.03 5.12 2.68 1.12-1.65 3.02-2.68 5.12-2.68 3.88 0 6.42 4.23 4.21 7.96C19.15 16.44 12 21 12 21z"/></svg>'}
function updateFavoriteButton(){
 const saved=savedIds().includes(currentVideoId),btn=$('#favoriteBtn');
 btn.classList.toggle('active',saved);
 btn.innerHTML=heartIcon();
 btn.setAttribute('aria-label',saved?t().favoriteOn:t().favorite);
 btn.setAttribute('title',saved?t().favoriteOn:t().favorite);
 btn.setAttribute('aria-pressed',String(saved));
}
function toggleCurrentFavorite(){if(!currentVideoId)return;let arr=savedIds();arr=arr.includes(currentVideoId)?arr.filter(x=>x!==currentVideoId):[...arr,currentVideoId];setSaved(arr);updateFavoriteButton();renderSaved()}
