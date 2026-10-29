(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.FFVideoSources=factory();})(typeof window==='object'?window:globalThis,()=>{
 const hosts=['disk.yandex.ru','disk.yandex.com','disk.360.yandex.ru','yadi.sk'];
 function yandex(raw){const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.port||!hosts.includes(u.hostname)||!/^\/(d|i)\/[A-Za-z0-9_-]+\/?$/.test(u.pathname))throw Error('Нужна публичная ссылка Яндекс Диска на один MP4-файл');return u.origin+u.pathname.replace(/\/$/,'');}
 function provider(row){return row?.videoProvider||'youtube';}
 return Object.freeze({yandex,provider,isYandex:row=>provider(row)==='yandex_disk'});
});
