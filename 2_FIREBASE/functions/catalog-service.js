/* CMS-11: the only writer of taxonomy/catalog. Injected dependencies permit offline tests. */
'use strict';
const {catalog,leaf}=require('./data-guard');
const seed=require('./catalog-seed.json');
module.exports=({db,timestamp,error})=>async request=>{
 const reject=(code,message)=>{throw error(code,message);};
 if(!request.auth?.uid)reject('unauthenticated','Требуется авторизация администратора');
 const input=request.data;
 if(!input||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||typeof input.hadCatalog!=='boolean')reject('invalid-argument','Некорректная редакция каталога');
 try{catalog(input.items);}catch(e){reject('invalid-argument',e.message);}
 const ref=db.doc('taxonomy/catalog'),lock=db.doc('catalogGuards/membership');
 return db.runTransaction(async tx=>{
  const admin=await tx.get(db.doc('admins/'+request.auth.uid));
  if(!admin.exists||admin.data().active!==true)reject('permission-denied','Учётная запись не имеет прав администратора');
  const snap=await tx.get(ref),guard=await tx.get(lock);
  const old=snap.exists?snap.data():null,revision=old?.revision??0;
  if(revision!==input.expectedRevision||snap.exists!==input.hadCatalog)reject('aborted','Каталог изменён или категория уже удалена. Обновите список и повторите действие.');
  if(!Number.isSafeInteger(revision)||revision>=Number.MAX_SAFE_INTEGER)reject('failed-precondition','Некорректная редакция каталога');
  const before=old?.items||seed;try{catalog(before);}catch(e){reject('failed-precondition',e.message);}
  const next=input.items,nodes=new Map(next.map(x=>[x.id,x]));
  const removed=before.filter(x=>!nodes.has(x.id));
  for(const x of removed)if(before.some(y=>y.parentId===x.id))reject('failed-precondition','У категории «'+x.name.ru+'» есть вложенные категории. Сначала перенесите или удалите их.');
  // All languages, statuses and legacy category/topic links, read on the server.
  const lessons=await tx.get(db.collection('lessons'));
  const roots={};for(const x of next){let r=x;while(r.parentId)r=nodes.get(r.parentId);roots[x.id]=r.id;}
  for(const row of lessons.docs){const v=row.data(),id=leaf(v);
   if(removed.some(x=>x.id===id||x.id===v.categoryId))reject('failed-precondition','Категория содержит видео. Сначала перенесите или удалите видео вручную.');
   if(!nodes.has(id)||roots[id]!==v.categoryId)reject('failed-precondition','Изменение нарушает привязку видео '+row.id+'. Сначала перенесите видео.');
  }
  const guardRevision=guard.exists?guard.data().revision:0;
  if(!Number.isSafeInteger(guardRevision)||guardRevision<0||guardRevision>=Number.MAX_SAFE_INTEGER)reject('failed-precondition','Некорректная блокировка каталога');
  // Shared write with lesson creation/moves closes the empty-query race.
  tx.set(lock,{revision:guardRevision+1,updatedAt:timestamp()});
  tx.set(ref,{...old,items:next,roots,revision:revision+1,version:1,updatedAt:timestamp()});
  return {revision:revision+1};
 });
};
