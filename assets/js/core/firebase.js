/* CMS-08 P0/P1: validated snapshots and optimistic Firestore transactions. */
(() => {
 const A=window.FFAdmin;
 let sdk=null,auth=null,db=null,functions=null,pendingCreate=null;
 const cfg=window.FF_FIREBASE_CONFIG||{};
 const fail=(message,code='cms/invalid-data')=>{const e=new Error(message);e.code=code;throw e;};
 const conflict=()=>fail('Данные изменены другим администратором. Обновите страницу и повторите действие.','cms/conflict');
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
   A.categoryAvailability.validate(x);
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
 function catalogDoc(snap){if(!snap.exists())return {items:null,revision:0};const data=snap.data();if(!object(data)||(data.version!==undefined&&data.version!==1))fail('Неизвестная схема каталога');return {items:catalog(data.items),revision:revision(data.revision),catalogReady:object(data.roots)};}
 const readLesson=s=>s.exists()?lesson({...s.data(),id:s.id}):null;
 const timestamp=()=>sdk.db.serverTimestamp();
 const scopeRef=id=>sdk.db.doc(db,'lessonOrderScopes',id);
 function scopeDoc(s,id){if(!s.exists())return 0;const d=s.data();if(!object(d)||!key(d.leafCategoryId)||!['ru','tj','uz'].includes(d.language)||scopeId(d)!==id||revision(d.revision)<1)fail('Повреждена область порядка '+id);return revision(d.revision);}
 function expectScope(s,id,baseline){const rev=scopeDoc(s,id);if(rev!==(baseline.orderRevisions[id]||0))conflict();if(rev>=Number.MAX_SAFE_INTEGER)fail('Редакция области достигла безопасного предела');return rev;}
 function bump(tx,id,v,rev){tx.set(scopeRef(id),{leafCategoryId:leaf(v),language:v.language||'ru',revision:rev+1,updatedAt:timestamp()},{merge:true});}
 function checkLesson(current,old){if(!current||!old||revision(current.revision)!==revision(old.revision)||scopeId(current)!==scopeId(old))conflict();if(revision(current.revision)>=Number.MAX_SAFE_INTEGER)fail('Редакция урока достигла безопасного предела');}
 function checkCatalog(s,baseline){const c=catalogDoc(s);if(c.revision!==baseline.catalogRevision||Boolean(c.items)!==Boolean(baseline.catalog))conflict();return c.items||A.catalog.seed();}
 function pendingKey(){return 'ff-cms08-pending:'+cfg.projectId+':'+A.state.currentUser?.uid;}
 function loadPending(){try{return JSON.parse(sessionStorage.getItem(pendingKey())||'null');}catch{return null;}}
 function storePending(value){pendingCreate=value;try{if(value)sessionStorage.setItem(pendingKey(),JSON.stringify(value));else sessionStorage.removeItem(pendingKey());}catch{/* Memory fallback without session storage. */}}
 function prepareCreate(data){
  const {order,...content}=data;const fingerprint=JSON.stringify(content);pendingCreate=pendingCreate||loadPending();
  if(pendingCreate&&pendingCreate.fingerprint!==fingerprint)fail('Результат предыдущего создания ещё не подтверждён. Повторите исходное сохранение или откройте созданный урок для редактирования.','cms/pending-create');
  if(!pendingCreate){const ref=sdk.db.doc(sdk.db.collection(db,'lessons'));storePending({id:ref.id,token:ref.id,fingerprint});}
  return pendingCreate;
 }
 A.dataGuard={catalog,lesson,revision,leaf,scopeId,maxDepth:20};
 A.firebaseReady=()=>Boolean(cfg.apiKey&&cfg.projectId&&cfg.appId&&cfg.authDomain);
 A.firebase={
  async init(onChange){
   if(!A.firebaseReady())return false;
   try{
    const v='12.19.0';const [core,authSdk,storeSdk,functionsSdk]=await Promise.all([import(`https://www.gstatic.com/firebasejs/${v}/firebase-app.js`),import(`https://www.gstatic.com/firebasejs/${v}/firebase-auth.js`),import(`https://www.gstatic.com/firebasejs/${v}/firebase-firestore.js`),import(`https://www.gstatic.com/firebasejs/${v}/firebase-functions.js`)]);
    sdk={auth:authSdk,db:storeSdk};const app=core.initializeApp(cfg);auth=authSdk.getAuth(app);db=storeSdk.getFirestore(app);functions={sdk:functionsSdk,instance:functionsSdk.getFunctions(app,cfg.functionsRegion||'us-central1')};
    authSdk.onAuthStateChanged(auth,async user=>{
     if(!user){pendingCreate=null;onChange(null);return;}
     try{const admin=await storeSdk.getDoc(storeSdk.doc(db,'admins',user.uid));if(admin.exists()&&admin.data()?.active===true){onChange(user);}else{await authSdk.signOut(auth);onChange(null);A.notify('Учётная запись не имеет прав администратора.','error');}}
     catch(e){await authSdk.signOut(auth);onChange(null);A.notify('Не удалось проверить права администратора: '+e.message,'error');}
    });return true;
   }catch(e){A.notify('Ошибка соединения с Firebase: '+e.message,'error');return false;}
  },
  async signIn(email,password){if(!sdk)throw Error('Firebase ещё не настроен');await sdk.auth.signInWithEmailAndPassword(auth,email,password);},
  async signOut(){if(auth)await sdk.auth.signOut(auth);},
  // CMS10: independent collections. No change to lessons/taxonomy transactions.
  async listContent(collectionName){
   if(!['materials','liveStreams'].includes(collectionName))throw Error('Неизвестная коллекция');
   if(!db||!A.state.currentUser)throw Error('Нет авторизации');
   const snapshot=await sdk.db.getDocsFromServer(sdk.db.collection(db,collectionName));
   return snapshot.docs.map(s=>({...s.data(),id:s.id}));
  },
  async saveContent(collectionName,payload,id,expectedRevision){
   if(!['materials','liveStreams'].includes(collectionName))throw Error('Неизвестная коллекция');
   if(!db||!A.state.currentUser)throw Error('Нет авторизации');
   const col=sdk.db.collection(db,collectionName);
   if(!id){
    const ref=sdk.db.doc(col);
    await sdk.db.setDoc(ref,{...payload,revision:1,createdAt:sdk.db.serverTimestamp(),updatedAt:sdk.db.serverTimestamp()});
    return ref.id;
   }
   const ref=sdk.db.doc(db,collectionName,id);
   await sdk.db.runTransaction(db,async tx=>{
    const snap=await tx.get(ref);
    if(!snap.exists()||snap.data().revision!==expectedRevision)throw Error('Эта запись изменилась. Обнови список и повтори.');
    tx.update(ref,{...payload,revision:expectedRevision+1,updatedAt:sdk.db.serverTimestamp()});
   });
   return id;
  },
  async deleteContent(collectionName,id,expectedRevision){
   if(!['materials','liveStreams'].includes(collectionName))throw Error('Неизвестная коллекция');
   if(!db||!A.state.currentUser)throw Error('Нет авторизации');
   const ref=sdk.db.doc(db,collectionName,id);
   await sdk.db.runTransaction(db,async tx=>{
    const snap=await tx.get(ref);
    if(!snap.exists()||snap.data().revision!==expectedRevision)throw Error('Запись изменилась или удалена. Обнови список.');
    tx.delete(ref);
   });
  },
  async listLessons(){const s=await sdk.db.getDocsFromServer(sdk.db.collection(db,'lessons'));return s.docs.map(readLesson);},
  async listCatalog(){return catalogDoc(await sdk.db.getDocFromServer(sdk.db.doc(db,'taxonomy','catalog'))).items;},
  async readSnapshot(){
   // Locks precede lessons: a concurrent change leaves an older token and the
   // next transaction rejects it instead of merging an inconsistent snapshot.
   // Diagnose the collection responsible for initial-load failures. Without the
   // lessonOrderScopes read permission the older UI only showed a generic form error.
   const scopes=await sdk.db.getDocsFromServer(sdk.db.collection(db,'lessonOrderScopes'))
    .catch(e=>{throw new Error('lessonOrderScopes: '+(e.code||e.message)+'. Проверь правила Firestore CMS10.');});
   const orderRevisions={};for(const s of scopes.docs)orderRevisions[s.id]=scopeDoc(s,s.id);
   const c=catalogDoc(await sdk.db.getDocFromServer(sdk.db.doc(db,'taxonomy','catalog')));
   const lessons=await A.firebase.listLessons();
   const ids=new Set();for(const v of lessons){lesson(v);if(ids.has(v.id))fail('Повторяющийся ID урока');ids.add(v.id);}
   const tree=c.items||A.catalog.seed();catalog(tree);
   for(const v of lessons){let node=tree.find(x=>x.id===leaf(v));if(!node)fail('Категория урока '+v.id+' отсутствует в каталоге');while(node.parentId)node=tree.find(x=>x.id===node.parentId);if(node.id!==v.categoryId)fail('Привязка урока '+v.id+' не соответствует дереву');}
   return {lessons,catalog:c.items,catalogRevision:c.revision,catalogReady:Boolean(c.catalogReady),orderRevisions};
  },
  async upsertLesson(data,id,baseline){
   if(data.id!==undefined)fail('ID урока передаётся отдельно');lesson({...data,id:id||'pending'},true);
   const pending=id?null:prepareCreate(data);const targetId=id||pending.id;
   const old=id?baseline.lessons.find(v=>v.id===id):null;
   const targetScope=scopeId(data),oldScope=old?scopeId(old):null;
   const affected=[...new Set([targetScope,oldScope].filter(Boolean))];
   const members=baseline.lessons.filter(v=>affected.includes(scopeId(v)));
   if(members.length>400)fail('В области более 400 уроков. Операция остановлена без изменений.');
   const result=await sdk.db.runTransaction(db,async tx=>{
    const ref=sdk.db.doc(db,'lessons',targetId);const existing=readLesson(await tx.get(ref));
    if(pending&&existing){if(existing.clientRequestId===pending.token){for(const [k,v] of Object.entries(data))if(k!=='order'&&existing[k]!==v)conflict();return targetId;}conflict();}
    const cat=checkCatalog(await tx.get(sdk.db.doc(db,'taxonomy','catalog')),baseline);
    const category=cat.find(x=>x.id===leaf(data));if(!category)fail('Категория урока отсутствует');
    let root=category;while(root.parentId)root=cat.find(x=>x.id===root.parentId);
    if(root.id!==data.categoryId)fail('Категория урока не соответствует дереву');
    const guardRef=sdk.db.doc(db,'catalogGuards','membership');
    const guard=await tx.get(guardRef);const guardRevision=revision(guard.exists()?guard.data().revision:0);
    if(guardRevision>=Number.MAX_SAFE_INTEGER)fail('Редакция блокировки достигла безопасного предела');
    const revisions={};for(const s of affected)revisions[s]=expectScope(await tx.get(scopeRef(s)),s,baseline);
    const current=[];for(const v of members){const now=v.id===targetId?existing:readLesson(await tx.get(sdk.db.doc(db,'lessons',v.id)));checkLesson(now,v);current.push(now);}
    if(id)checkLesson(existing,old);
    const siblings=current.filter(v=>v.id!==targetId&&scopeId(v)===targetScope);
    const order=old&&oldScope===targetScope?Math.max(1,Number(existing.order)||1):Math.max(0,...siblings.map(v=>Number(v.order)||0))+1;
    if(!Number.isSafeInteger(order))fail('Порядок уроков достиг безопасного предела');
    const patch={...data,order,revision:revision(existing?.revision)+1,orderScopeId:targetScope,orderRevision:revisions[targetScope]+1,updatedAt:timestamp()};
    tx.set(guardRef,{revision:guardRevision+1,updatedAt:timestamp()});
    for(const s of affected)bump(tx,s,s===targetScope?data:old,revisions[s]);
    if(id)tx.update(ref,patch);else tx.set(ref,{...patch,clientRequestId:pending.token,createdAt:timestamp()});
    return targetId;
   });
   if(pending||(pendingCreate||loadPending())?.id===id)storePending(null);return result;
  },
  async deleteLesson(id,baseline){
   const old=baseline.lessons.find(v=>v.id===id);if(!old)conflict();const s=scopeId(old);
   await sdk.db.runTransaction(db,async tx=>{const ref=sdk.db.doc(db,'lessons',id),current=readLesson(await tx.get(ref));checkLesson(current,old);const rev=expectScope(await tx.get(scopeRef(s)),s,baseline);bump(tx,s,old,rev);tx.delete(ref);});
  },
  async reorderLessons(ids,baseline){
   if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.length>400)fail('Некорректный список перестановки (максимум 400 уроков)');
   const first=baseline.lessons.find(v=>v.id===ids[0]);if(!first)conflict();const s=scopeId(first),members=baseline.lessons.filter(v=>scopeId(v)===s);
   if(members.length!==ids.length||members.some(v=>!ids.includes(v.id)))fail('Перестановка должна включать один полный раздел и язык');
   await sdk.db.runTransaction(db,async tx=>{
    const rev=expectScope(await tx.get(scopeRef(s)),s,baseline);
    for(const v of members)checkLesson(readLesson(await tx.get(sdk.db.doc(db,'lessons',v.id))),v);
    bump(tx,s,first,rev);ids.forEach((id,i)=>{const old=members.find(v=>v.id===id);tx.update(sdk.db.doc(db,'lessons',id),{order:i+1,language:old.language||'ru',leafCategoryId:leaf(old),revision:revision(old.revision)+1,orderScopeId:s,orderRevision:rev+1,updatedAt:timestamp()});});
   });
  },
  async putCatalog(items,baseline){
   catalog(items);
   if(!functions)fail('Сервер категорий не подключён');
   try{return (await functions.sdk.httpsCallable(functions.instance,'cms11Catalog')({items,expectedRevision:baseline.catalogRevision,hadCatalog:Boolean(baseline.catalog)})).data;}
   catch(e){if(e.code==='functions/aborted')conflict();throw e;}
  }
 };
})();
