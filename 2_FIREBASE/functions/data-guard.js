'use strict';
const availability=require('./category-availability');
const fail=message=>{throw new Error(message);};
 const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const key=v=>typeof v==='string'&&v.length>0&&v.length<=512&&new TextEncoder().encode(v).length<=1000&&!v.includes('/')&&v!=='.'&&v!=='..'&&!/^__.*__$/.test(v);
 const orderValue=v=>(typeof v==='number'||typeof v==='string'&&/^\d+$/.test(v))&&Number.isSafeInteger(Number(v))&&Number(v)>=0;
 const revision=v=>{if(v===undefined)return 0;if(!Number.isSafeInteger(v)||v<0)fail('Некорректная редакция документа');return v;};
 const leaf=v=>v.leafCategoryId||((v.topicId&&['social','ranks'].includes(v.categoryId))?v.categoryId+'__'+v.topicId:v.categoryId);
 const scopeId=v=>leaf(v)+'~'+(v.language||'ru');
 function catalog(items){
  if(!Array.isArray(items)||items.length>1000)fail('Каталог должен быть массивом не более 1000 разделов');
  const nodes=new Map();
  for(const x of items){
   if(!object(x)||!key(x.id)||nodes.has(x.id))fail('Некорректный или повторяющийся ID раздела');
   if(x.parentId!==undefined&&x.parentId!==null&&!key(x.parentId))fail('Некорректный родитель раздела '+x.id);
   if(!object(x.name)||typeof x.name.ru!=='string'||!x.name.ru.trim())fail('Нет русского названия раздела '+x.id);
   for(const field of ['name','description'])if(x[field]!==undefined){if(!object(x[field]))fail('Некорректный перевод '+x.id);for(const lang of ['ru','tj','uz'])if(x[field][lang]!==undefined&&typeof x[field][lang]!=='string')fail('Некорректный перевод '+x.id);}
   if(!['active','soon','hidden'].includes(x.status))fail('Некорректный статус раздела '+x.id);
   if(x.order!==undefined&&!orderValue(x.order))fail('Некорректный порядок раздела '+x.id);
   availability.validate(x);
   nodes.set(x.id,x);
  }
  for(const x of items){const seen=new Set();let cur=x,depth=0;while(cur){if(seen.has(cur.id))fail('Цикл в структуре категорий');seen.add(cur.id);if(depth++>20)fail('Максимальная глубина: 20 вложенных уровней');if(!cur.parentId)break;cur=nodes.get(cur.parentId);if(!cur)fail('Не найден родитель раздела '+x.id);}}
  return items;
 }
 function lesson(v,write=false){
  if(!object(v)||!key(v.id)||typeof v.title!=='string'||!v.title.trim()||typeof v.youtubeId!=='string'||!/^[-\w]{11}$/.test(v.youtubeId)||!key(v.categoryId)||!key(leaf(v)))fail('Некорректный урок '+(v?.id||''));
  if(!['published','draft'].includes(v.status)||(v.language!==undefined&&!['ru','tj','uz'].includes(v.language)))fail('Некорректный язык или статус урока '+v.id);
  if(v.youtubeUrl!==undefined&&typeof v.youtubeUrl!=='string')fail('Некорректная ссылка урока '+v.id);
  if(v.groupId!==undefined&&v.groupId!==null&&typeof v.groupId!=='string')fail('Некорректная группа урока '+v.id);
  if(v.topicId!==undefined&&v.topicId!==null&&typeof v.topicId!=='string'&&!Number.isSafeInteger(v.topicId))fail('Некорректная тема урока '+v.id);
  if(v.description!==undefined&&typeof v.description!=='string')fail('Некорректное описание урока '+v.id);
  if(v.orientation!==undefined&&!['vertical','horizontal'].includes(v.orientation))fail('Некорректный формат урока '+v.id);
  if(v.order!==undefined&&!orderValue(v.order))fail('Некорректный порядок урока '+v.id);
  revision(v.revision);if(v.orderRevision!==undefined)revision(v.orderRevision);
  if(v.orderScopeId!==undefined&&v.orderScopeId!==scopeId(v))fail('Некорректная область порядка урока '+v.id);
  if(write&&(v.title.length>160||(v.description||'').length>1200||!['ru','tj','uz'].includes(v.language)))fail('Поля урока не соответствуют форме');
  return v;
 }

module.exports={catalog,leaf};
