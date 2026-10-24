/* CMS-11 integration: real local Firestore emulator and security rules only. */
'use strict';
const host=process.env.FIRESTORE_EMULATOR_HOST;
if(!host||!/^127\.0\.0\.1:\d+$/.test(host))throw Error('Local emulator required; production forbidden');
const fs=require('fs'),assert=require('assert'),path=require('path');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const web=require('firebase/firestore');
const {initializeApp,deleteApp}=require('firebase-admin/app');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const projectId='demo-ff-cms11';
const app=initializeApp({projectId},'cms11-test'),db=getFirestore(app);
const error=(code,message)=>Object.assign(Error(message),{code});
const service=require('../functions/catalog-service')({db,timestamp:()=>FieldValue.serverTimestamp(),error});
const category=(id,parentId=null)=>({id,parentId,name:{ru:id,tj:'тоҷикӣ',uz:'ўзбек'},description:{ru:''},status:'active',order:1});
const tree=[category('old'),category('new'),category('parent'),category('child','parent'),category('other')];
const roots=items=>Object.fromEntries(items.map(x=>[x.id,x.parentId||x.id]));
const legacy=(id='old',language='ru')=>({categoryId:id,language,title:'Video',youtubeId:'dQw4w9WgXcQ',status:'draft',order:1});
const vm=require('vm');
const A={state:{currentUser:{uid:'admin'}},catalog:{seed:()=>structuredClone(tree)}};
const sandbox={window:{FFAdmin:A,FF_FIREBASE_CONFIG:{projectId}},TextEncoder,console};vm.createContext(sandbox);
let clientSource=fs.readFileSync(path.join(__dirname,'../assets/js/core/firebase.js'),'utf8');
clientSource=clientSource.replace(' A.firebase={',' A.testConnect=(store,api)=>{db=store;sdk={db:api};}; A.firebase={');
vm.runInContext(clientSource,sandbox);
const payload=categoryId=>({...legacy(categoryId),leafCategoryId:categoryId,description:'',orientation:'vertical'});
let env,count=0;const results=[];
async function test(name,fn){await fn();count++;results.push(name);console.log('PASS',name);}
async function reset(items=tree){await env.clearFirestore();await db.doc('admins/admin').set({active:true});await db.doc('taxonomy/catalog').set({items,roots:roots(items),revision:1,version:1,extra:'keep'});}
const request=(items,revision=1,uid='admin')=>service({auth:uid?{uid}:null,data:{items,expectedRevision:revision,hadCatalog:true}});
async function create(dbClient,id,categoryId){return web.runTransaction(dbClient,async tx=>{
 const catalogRef=web.doc(dbClient,'taxonomy/catalog'),lock=web.doc(dbClient,'catalogGuards/membership'),scope=web.doc(dbClient,'lessonOrderScopes',categoryId+'~ru');
 const cat=await tx.get(catalogRef),guard=await tx.get(lock),scopeSnap=await tx.get(scope);
 if(cat.data().roots[categoryId]!==categoryId)throw Error('Category absent');
 const rev=(scopeSnap.exists()?scopeSnap.data().revision:0)+1;
 tx.set(lock,{revision:(guard.exists()?guard.data().revision:0)+1,updatedAt:web.serverTimestamp()});
 tx.set(scope,{leafCategoryId:categoryId,language:'ru',revision:rev,updatedAt:web.serverTimestamp()});
 tx.set(web.doc(dbClient,'lessons',id),{...legacy(categoryId),leafCategoryId:categoryId,revision:1,orderScopeId:categoryId+'~ru',orderRevision:rev,clientRequestId:id,createdAt:web.serverTimestamp(),updatedAt:web.serverTimestamp()});
 });}
(async()=>{
 const [hostname,port]=host.split(':');env=await initializeTestEnvironment({projectId,firestore:{host:hostname,port:Number(port),rules:fs.readFileSync(path.join(__dirname,'../firestore.rules'),'utf8')}});
 const admin=env.authenticatedContext('admin').firestore(),user=env.authenticatedContext('user').firestore(),publicDB=env.unauthenticatedContext().firestore();
 // VM literals have a different Object.prototype; normalize only test-boundary maps.
 const bridge=v=>Array.isArray(v)?v.map(bridge):v&&v.constructor?.name==='Object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,bridge(x)])):v;
 A.testConnect(admin,{...web,runTransaction:(store,fn)=>web.runTransaction(store,tx=>fn({get:ref=>tx.get(ref),set:(ref,v,opt)=>opt?tx.set(ref,bridge(v),opt):tx.set(ref,bridge(v)),update:(ref,v)=>tx.update(ref,bridge(v)),delete:ref=>tx.delete(ref)}))});
 try{
 await test('Delete old empty category; preserve metadata and translations',async()=>{await reset();await request(tree.filter(x=>x.id!=='old'));const d=(await db.doc('taxonomy/catalog').get()).data();assert.equal(d.revision,2);assert.equal(d.extra,'keep');assert(!d.roots.old);assert.equal(d.items[0].name.tj,'тоҷикӣ');});
 await test('Create then delete new empty category',async()=>{await reset();await request([...tree,category('fresh')]);await request(tree,2);assert(!(await db.doc('taxonomy/catalog').get()).data().roots.fresh);});
 await test('Any language, draft/published and legacy video blocks deletion',async()=>{for(const language of ['ru','tj','uz'])for(const status of ['draft','published']){await reset();await db.doc('lessons/legacy').set({...legacy('old',language),status});await assert.rejects(request(tree.filter(x=>x.id!=='old')),/содержит видео/);assert((await db.doc('lessons/legacy').get()).exists);}});
 await test('Parent deletion, orphan and cycle rejected; child can be deleted',async()=>{await reset();await assert.rejects(request(tree.filter(x=>!['parent','child'].includes(x.id))),/вложенные/);await assert.rejects(request(tree.filter(x=>x.id!=='parent')),/родитель/);await assert.rejects(request(tree.map(x=>x.id==='parent'?{...x,parentId:'child'}:x)),/Цикл/);await request(tree.filter(x=>x.id!=='child'));});
 await test('Nested video bindings preserved; populated subtree cannot move',async()=>{await reset();await db.doc('lessons/nested').set({...legacy('parent'),leafCategoryId:'child'});await assert.rejects(request(tree.map(x=>x.id==='parent'?{...x,parentId:'other'}:x)),/привязку/);await assert.rejects(request(tree.filter(x=>x.id!=='child')),/видео/);});
 await test('Legacy topic binding blocks deletion',async()=>{const items=[category('social'),category('social__ads','social')];await reset(items);await db.doc('lessons/topic').set({...legacy('social'),topicId:'ads'});await assert.rejects(request([items[0]]),/видео/);});
 await test('Stale revision and repeat deletion rejected',async()=>{await reset();const remaining=tree.filter(x=>x.id!=='old');await request(remaining);await assert.rejects(request(remaining),e=>e.code==='aborted');});
 await test('Concurrent category editors: exactly one accepted',async()=>{await reset();const r=await Promise.allSettled([request(tree.filter(x=>x.id!=='old')),request(tree.filter(x=>x.id!=='new'))]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);});
 await test('Unauthenticated and inactive callers denied',async()=>{await reset();await assert.rejects(request(tree,1,null),e=>e.code==='unauthenticated');await assert.rejects(request(tree,1,'user'),e=>e.code==='permission-denied');await assertFails(web.setDoc(web.doc(user,'admins/user'),{active:true}));});
 await test('Direct catalog writes including shrink or same-size replacement denied',async()=>{await reset();for(const items of [[],tree,[category('replacement')]])await assertFails(web.updateDoc(web.doc(admin,'taxonomy/catalog'),{items,revision:2,updatedAt:web.serverTimestamp()}));await assertFails(web.deleteDoc(web.doc(admin,'taxonomy/catalog')));});
 await test('Lesson create + guard succeeds; missing guard and absent category denied',async()=>{await reset();await assertSucceeds(create(admin,'created','old'));const batch=web.writeBatch(admin);batch.set(web.doc(admin,'lessonOrderScopes','new~ru'),{leafCategoryId:'new',language:'ru',revision:1,updatedAt:web.serverTimestamp()});batch.set(web.doc(admin,'lessons','unsafe'),{...legacy('new'),leafCategoryId:'new',revision:1,orderScopeId:'new~ru',orderRevision:1,clientRequestId:'unsafe',createdAt:web.serverTimestamp(),updatedAt:web.serverTimestamp()});await assertFails(batch.commit());await assert.rejects(create(admin,'absent','missing'));});
 await test('Actual firebase.js adapter: create/edit/reorder/move/delete with real rules',async()=>{
  await reset();let baseline=await A.firebase.readSnapshot();const id=await A.firebase.upsertLesson(payload('old'),null,baseline);
  baseline=await A.firebase.readSnapshot();await A.firebase.upsertLesson({...payload('old'),title:'Edited'},id,baseline);
  baseline=await A.firebase.readSnapshot();await A.firebase.reorderLessons([id],baseline);
  baseline=await A.firebase.readSnapshot();await A.firebase.upsertLesson(payload('new'),id,baseline);
  baseline=await A.firebase.readSnapshot();await A.firebase.deleteLesson(id,baseline);assert(!(await db.doc('lessons/'+id).get()).exists);
 });
 await test('Deletion vs concurrent video create never produces orphan (12 races)',async()=>{for(let i=0;i<12;i++){await reset();const baseline=await A.firebase.readSnapshot();const result=await Promise.allSettled([request(tree.filter(x=>x.id!=='old')),A.firebase.upsertLesson(payload('old'),null,baseline)]);assert.equal(result.filter(x=>x.status==='fulfilled').length,1);const cat=(await db.doc('taxonomy/catalog').get()).data(),videos=await db.collection('lessons').get();assert(videos.empty||cat.items.some(x=>x.id==='old'));}});
 await test('Public catalog/published reads preserved; drafts and admin guards hidden',async()=>{await reset();await db.doc('lessons/draft').set(legacy());await db.doc('lessons/published').set({...legacy(),status:'published'});await assertSucceeds(web.getDoc(web.doc(publicDB,'taxonomy/catalog')));await assertSucceeds(web.getDoc(web.doc(publicDB,'lessons/published')));await assertFails(web.getDoc(web.doc(publicDB,'lessons/draft')));await assertFails(web.getDoc(web.doc(publicDB,'catalogGuards/membership')));});
 console.log(count+' integration cases passed');fs.writeFileSync(path.join(__dirname,'CMS11_EMULATOR_RESULTS.json'),JSON.stringify({projectId,environment:'Local Firestore emulator only',passed:count,results},null,2));
 }finally{await env.cleanup();await db.terminate();await deleteApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
