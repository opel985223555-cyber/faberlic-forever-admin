/* Mutations require a complete validated server snapshot for this user. */
(()=>{
 const A=window.FFAdmin;
 A.state.dataReady=false;
 const requireAuth=()=>{if(A.state.mode!=='firebase'||!A.state.currentUser)throw Error('Требуется авторизация администратора');};
 const baseline=()=>{requireAuth();if(!A.state.dataReady||A.state.snapshotUid!==A.state.currentUser.uid)throw Error(A.state.loadError||'Данные ещё не загружены. Дождитесь ответа Firebase.');return {lessons:A.state.lessons,catalog:A.state.catalog,catalogReady:A.state.catalogReady,catalogRevision:A.state.catalogRevision,orderRevisions:A.state.orderRevisions};};
 A.repo={
  async list(){requireAuth();return A.firebase.listLessons();},
  async save(payload,id,expectedRevision){const b=baseline();if(id&&expectedRevision!==undefined){const old=b.lessons.find(v=>v.id===id);if(!old||A.dataGuard.revision(old.revision)!==expectedRevision)throw Error('Урок изменился. Обновите страницу.');}return A.firebase.upsertLesson(payload,id,b);},
  async remove(id){return A.firebase.deleteLesson(id,baseline());},
  async reorder(ids){return A.firebase.reorderLessons(ids,baseline());},
  async saveCatalog(items,expectedRevision){const b=baseline();if(expectedRevision!==undefined&&expectedRevision!==b.catalogRevision)throw Error('Каталог изменился. Обновите страницу.');try{return await A.firebase.putCatalog(items,b);}catch(e){if(e.code==='permission-denied')throw Error('Firebase отклонил запись. Проверьте, что опубликованы правила CMS13 Spark и у вас есть права администратора.');throw e;}},
  async refresh(){
   requireAuth();const uid=A.state.currentUser.uid;A.state.dataReady=false;
   let next;
   try { next=await A.firebase.readSnapshot(); A.state.loadError=''; }
   catch(e){A.state.loadError='Ошибка загрузки Firestore: '+(e.code||e.message);throw e;}
   if(A.state.currentUser?.uid!==uid||A.state.mode!=='firebase')throw Error('Сессия изменилась во время загрузки');
   if(next.catalog!==null)A.dataGuard.catalog(next.catalog);
   for(const lesson of next.lessons)A.dataGuard.lesson(lesson);
   A.dataGuard.revision(next.catalogRevision);
   Object.assign(A.state,next,{snapshotUid:uid,dataReady:true});
  }
 };
})();
