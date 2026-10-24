/* CMS10: published reference links; never execute remote HTML in the trusted app WebView. */
(function(){
 'use strict';let items=null,error='';
 const labels={checklist:'ЧЕК',pdf:'PDF',presentation:'PPT',instruction:'DOC',link:'↗'};
 function validUrl(raw){try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&Boolean(u.hostname);}catch{return false;}}
 function renderMaterials(){const target=$('#materialList');if(!target)return;
  if(items===null){target.innerHTML=`<div class="empty">${esc(error||'Загрузка материалов…')}</div>`;return;}
  const filtered=items.filter(x=>x.language===currentLang);
  if(!filtered.length){target.innerHTML='<div class="empty">Материалы на этом языке пока не опубликованы.</div>';return;}
  target.innerHTML=filtered.map(x=>`<button class="item ffContentRow" data-material="${esc(x.id)}"><div class="itemIcon">${esc(labels[x.type]||'PDF')}</div><div><b>${esc(x.title)}</b><small>${esc(x.description||'Открыть материал')}</small></div><span class="arrow">↗</span></button>`).join('');
  target.querySelectorAll('[data-material]').forEach(btn=>btn.addEventListener('click',()=>{const x=items.find(r=>r.id===btn.dataset.material);if(x&&validUrl(x.url))window.location.href=x.url;}));
 }
 window.FFContentModules=window.FFContentModules||{};
 window.FFContentModules.receiveMaterials=(json)=>{try{const raw=JSON.parse(json);items=Array.isArray(raw)?raw.filter(x=>validUrl(x.url)&&['ru','tj','uz'].includes(x.language)&&/^[A-Za-z0-9_-]+$/.test(x.id)):[];error='';renderMaterials();}catch(e){items=null;error='Ошибка данных материалов';renderMaterials();}};
 window.FFContentModules.errorMaterials=(msg)=>{items=null;error=String(msg||'Ошибка Firebase');renderMaterials();};
 window.renderMaterials=renderMaterials;
})();
