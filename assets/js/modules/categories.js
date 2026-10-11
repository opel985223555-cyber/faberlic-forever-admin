/* Categories module: read-only approved taxonomy. */
(()=>{const A=window.FFAdmin;
A.modules.categories={render(){A.$('#categories-list').innerHTML=A.categories.map(([id,label],i)=>`<div class="catalog-item"><div class="number-icon">${String(i+1).padStart(2,'0')}</div><div><strong>${A.escape(label)}</strong><small>${id==='ranks'?'7 ступеней развития':id==='social'?'5 направлений продвижения':'Категория для обучения'}</small></div><span class="muted-arrow">↗</span></div>`).join('');}};
})();
