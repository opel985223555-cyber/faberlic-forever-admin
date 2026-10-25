/* Local UI helpers: no browser-origin dialogs and no Firebase operations. */
(()=>{const A=window.FFAdmin;let pending=null;
 A.confirmAction=({title='Подтверждение',message,accept='Подтвердить'})=>{
  if(pending)return Promise.resolve(false);
  const dialog=A.$('#admin-confirm'),previous=document.activeElement;
  A.$('#admin-confirm-title').textContent=title;A.$('#admin-confirm-message').textContent=message;A.$('#admin-confirm-accept').textContent=accept;
  return new Promise(resolve=>{pending=value=>{pending=null;dialog.close();previous?.focus();resolve(value);};dialog.showModal();A.$('#admin-confirm-cancel').focus();});
 };
 A.copyText=async text=>{if(!text)throw Error('Код недоступен');
  try{if(!navigator.clipboard?.writeText)throw Error('clipboard');await navigator.clipboard.writeText(text);}
  catch{const input=document.createElement('textarea');input.value=text;input.readOnly=true;input.style.cssText='position:fixed;top:0;left:0;opacity:0';document.body.append(input);const previous=document.activeElement;try{input.focus();input.select();if(!document.execCommand('copy'))throw Error('Не удалось скопировать. Выделите код и скопируйте вручную.');}finally{input.remove();previous?.focus();}}
 };
 document.addEventListener('DOMContentLoaded',()=>{
  A.$('#admin-confirm-cancel').onclick=()=>pending?.(false);A.$('#admin-confirm-accept').onclick=()=>pending?.(true);
  A.$('#admin-confirm').addEventListener('cancel',e=>{e.preventDefault();pending?.(false);});
  A.$('#admin-confirm').addEventListener('click',e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)pending?.(false);}});
  A.$('#close-sidebar').onclick=()=>A.setSidebar(false);A.$('#sidebar-backdrop').onclick=()=>A.setSidebar(false);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')A.setSidebar(false);});
  window.matchMedia('(max-width:760px)').addEventListener('change',()=>A.setSidebar(false));
 });
})();
