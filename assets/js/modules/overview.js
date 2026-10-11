/* Overview dashboard; independent from videos editor. */
(()=>{const A=window.FFAdmin;
 A.modules.overview={render(){const all=A.state.lessons,pub=all.filter(x=>x.status==='published'),draft=all.filter(x=>x.status!=='published');
  A.$('#metric-all').textContent=all.length;A.$('#metric-published').textContent=pub.length;A.$('#metric-drafts').textContent=draft.length;
  A.$('#recent-list').innerHTML=all.length?all.slice(0,5).map(x=>`<div class="recent-row"><span class="recent-icon">▶</span><div><strong>${A.escape(x.title)}</strong><small>${A.escape(A.categoryLabel(x.categoryId))}</small></div><span class="status-chip ${x.status==='published'?'published':'draft'}">${x.status==='published'?'Опубликовано':'Черновик'}</span></div>`).join(''):
  '<div class="empty-state compact"><strong>Уроков пока нет</strong><p>Создай первый урок через ссылку YouTube.</p></div>';
 }};
})();
