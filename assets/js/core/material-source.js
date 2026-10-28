/* Official public-file APIs only. No scraping or expiring URLs in Firestore. */
(function(root){'use strict';
 const mime={pdf:'application/pdf',jpg:'image/jpeg',png:'image/png',ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
 function parse(raw){let u;try{u=new URL(raw);}catch{throw Error('Нужна публичная ссылка на один файл');}if(u.protocol!=='https:'||u.username||u.password||u.port||raw.length>2000)throw Error('Нужна безопасная HTTPS-ссылка');
  if(u.hostname==='drive.google.com'){const match=u.pathname.match(/^\/file\/d\/([\w-]+)(?:\/view|\/preview)?\/?$/),id=match?.[1]||(u.pathname==='/open'?u.searchParams.get('id'):null);if(!id||!/^[-\w]{10,200}$/.test(id))throw Error('Google: укажите ссылку на один файл, не папку');return {provider:'google_drive',id,resourceKey:u.searchParams.get('resourcekey')||'',url:u.href};}
  if(['disk.yandex.ru','disk.yandex.com','disk.360.yandex.ru','yadi.sk'].includes(u.hostname)&&/^\/(d|i)\/[\w-]+\/?$/.test(u.pathname))return {provider:'yandex_disk',url:u.href};
  throw Error('Поддерживаются публичные файлы Google Диска и Яндекс Диска');
 }
 async function json(url,options={}){const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,20000);options.signal?.addEventListener('abort',abort,{once:true});if(options.signal?.aborted)abort();try{let r;try{r=await fetch(url,{...options,signal:controller.signal,credentials:'omit',redirect:'error'});}catch{throw Error('Нет соединения с API диска или превышено время ожидания. Проверьте сеть и разрешения API');}if(!r.ok)throw Error(r.status===403?'Диск запретил доступ: проверьте публичность файла и настройки API':r.status===404?'Файл не найден или закрыт':r.status===429?'Лимит диска исчерпан. Повторите позже':'Ошибка API диска: '+r.status);return await r.json();}finally{clearTimeout(timer);options.signal?.removeEventListener('abort',abort);}}

 async function inspect(raw,{key=root.FF_MATERIALS_CONFIG?.googleApiKey||root.FF_FIREBASE_CONFIG?.apiKey||'',signal}={}){const source=parse(raw);let d;
  if(source.provider==='google_drive'){if(!key)throw Error('Для Google Диска настройте публичный ключ Drive API');d=await json('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(source.id)+'?fields=id,name,mimeType,size,capabilities(canDownload)&key='+encodeURIComponent(key),{signal,headers:source.resourceKey?{'X-Goog-Drive-Resource-Keys':source.id+'/'+source.resourceKey}:{}});if(d.capabilities?.canDownload!==true)throw Error('Владелец файла запретил скачивание');}
  else {const y=await json('https://cloud-api.yandex.net/v1/disk/public/resources?public_key='+encodeURIComponent(source.url),{signal});if(y.type!=='file')throw Error('Укажите отдельный файл, не папку');d={name:y.name,mimeType:y.mime_type,size:y.size};}
  const fileType=Object.keys(mime).find(k=>mime[k]===d.mimeType);if(!fileType)throw Error('Неподдерживаемый фактический тип файла: '+String(d.mimeType||'неизвестен'));const size=Number(d.size);if(!Number.isSafeInteger(size)||size<1||size>100*1024*1024)throw Error('Размер файла должен быть от 1 байта до 100 МБ');return {...source,fileType,mime:d.mimeType,name:String(d.name||'document').slice(0,180),size};
 }
 const translate=(map,lang,fallback='')=>map?.[lang]?.trim()||map?.ru?.trim()||fallback;
 root.FFMaterialSource=Object.freeze({parse,inspect,mime,translate,maxBytes:100*1024*1024});
})(globalThis);
