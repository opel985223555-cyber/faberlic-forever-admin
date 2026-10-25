/* Real complete CMS in two browser sessions; fake modular SDK + shared MVCC store.
   No production requests. This is NOT a Firestore Security Rules emulator.
   Run: NODE_PATH=<existing packages> node tests/test_p0_p1.cjs
   Optional: FF_BROWSER_PATH, FF_TEST_OUTPUT, FF_PLAYWRIGHT_MODULE. */
const fs=require('fs'),path=require('path'),assert=require('assert');
const {chromium}=require(process.env.FF_PLAYWRIGHT_MODULE||'playwright');
const requestedSdk=[];
const root=path.resolve(__dirname,'..'),results=[],errors=[];
let windowFiveIds=[];const docs=new Map(),versions=new Map();let serial=0,clock=1000;
const controls={readFail:null,beforeCommit:false,afterCommit:false};
const clone=v=>structuredClone(v);
const put=(p,v)=>{docs.set(p,clone(v));versions.set(p,(versions.get(p)||0)+1);};
const initialLesson={title:'Реклама',youtubeId:'dQw4w9WgXcQ',youtubeUrl:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',categoryId:'newbie',language:'ru',status:'published',order:1,orientation:'vertical',description:'',createdAt:1,legacyField:'preserve'};
put('lessons/advert',initialLesson);put('admins/adminA',{active:true});put('admins/adminB',{active:true});
function resolve(v){if(v&&v.__timestamp)return ++clock;if(Array.isArray(v))return v.map(resolve);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,resolve(x)]));return v;}
function rpc({op,p,reads,writes}){
 if(op==='id')return 'id'+(++serial);
 if(op==='read'){if(controls.readFail===p){controls.readFail=null;return {error:'unavailable'};}return {id:p.split('/').at(-1),data:clone(docs.get(p)),version:versions.get(p)||0};}
 if(op==='query'){if(controls.readFail===p){controls.readFail=null;return {error:'permission-denied'};}return [...docs].filter(([k])=>k.startsWith(p+'/')&&k.split('/').length===2).map(([k,v])=>({id:k.split('/')[1],data:clone(v)}));}
 if(op==='begin')return {docs:Object.fromEntries([...docs].map(([k,v])=>[k,clone(v)])),versions:Object.fromEntries(versions)};
 if(op==='commit'){
  if(controls.beforeCommit){controls.beforeCommit=false;return {error:'unavailable'};}
  if(Object.entries(reads).some(([k,v])=>(versions.get(k)||0)!==v))return {retry:true};
  const changed=new Map();for(const w of writes){if(w.kind==='delete')changed.set(w.p,null);else {if(w.kind==='update'&&!docs.has(w.p))return {error:'not-found'};changed.set(w.p,resolve(w.kind==='update'||w.merge?{...docs.get(w.p),...w.data}:w.data));}}
  for(const [k,v] of changed){if(v===null){docs.delete(k);versions.set(k,(versions.get(k)||0)+1);}else put(k,v);}
  if(controls.afterCommit){controls.afterCommit=false;return {error:'unavailable'};}return {ok:true};
 }
 throw Error('Unknown RPC '+op);
}
const mockStore=`
 const call=async q=>{const r=await window.__rpc(q);if(r?.error){const e=new Error(r.error);e.code=r.error;throw e;}return r;};
 const snap=(ref,data)=>({id:ref.p.split('/').at(-1),exists:()=>data!==undefined,data:()=>structuredClone(data)});
 export const getFirestore=()=>({});export const collection=(_,p)=>({p});
 export const doc=(base,...parts)=>{const p=parts.length?parts.join('/'):base.p+'/'+window.__newIds.shift();return {p,id:p.split('/').at(-1)};};
 export const serverTimestamp=()=>({__timestamp:true});
 export const getDoc=async ref=>snap(ref,(await call({op:'read',p:ref.p})).data);
 export const getDocFromServer=getDoc;
 export const getDocsFromServer=async ref=>({docs:(await call({op:'query',p:ref.p})).map(x=>snap({p:ref.p+'/'+x.id},x.data))});
 export const runTransaction=async(_,fn)=>{for(let n=0;n<5;n++){const s=await call({op:'begin'}),reads={},writes=[];let writing=false;
  const tx={get:async ref=>{if(writing)throw Error('Reads must precede writes');reads[ref.p]=s.versions[ref.p]||0;return snap(ref,s.docs[ref.p]);},set:(ref,data,opt)=>{writing=true;writes.push({kind:'set',p:ref.p,data,merge:!!opt?.merge});},update:(ref,data)=>{writing=true;writes.push({kind:'update',p:ref.p,data});},delete:ref=>{writing=true;writes.push({kind:'delete',p:ref.p});}};
  const value=await fn(tx);if(!writes.length)return value;const result=await call({op:'commit',reads,writes});if(!result.retry)return value;
 }throw Error('aborted');};
`;
async function confirmPromo(page,selector,accept=true){await page.locator(selector).click();await page.locator('#admin-confirm').waitFor({state:'visible'});await page.locator(accept?'#admin-confirm-accept':'#admin-confirm-cancel').click();}
async function check(name,fn){try{await fn();results.push({name,result:'PASS'});}catch(e){results.push({name,result:'FAIL',error:e.stack});console.error(name,e);}}
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.FF_BROWSER_PATH?{executablePath:process.env.FF_BROWSER_PATH}:process.platform==='win32'?{channel:'msedge'}:{})});
 const sessions=[];
 async function session(uid){const context=await browser.newContext({viewport:{width:1200,height:840}});const page=await context.newPage();
  await page.exposeFunction('__rpc',rpc);page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({uid})=>{window.__uid=uid;window.__newIds=Array.from({length:200},(_,i)=>uid+'-'+Date.now().toString(36)+'-'+i+'-'+Math.random().toString(36).slice(2));},{uid});
  await page.route('**/*',async r=>{const url=new URL(r.request().url());
   if(url.hostname==='www.gstatic.com'){requestedSdk.push(url.pathname);
    const src=url.pathname.endsWith('firebase-app.js')?'export const initializeApp=cfg=>cfg;':url.pathname.endsWith('firebase-auth.js')?`export const getAuth=()=>({});export const onAuthStateChanged=(_,fn)=>queueMicrotask(()=>fn({uid:window.__uid,email:window.__uid+'@example.invalid'}));export const signOut=async()=>{};export const signInWithEmailAndPassword=async()=>{};`:mockStore;
    return r.fulfill({body:src,contentType:'application/javascript',headers:{'Access-Control-Allow-Origin':'*'}});
   }
   if(url.hostname!=='cms.test')return r.abort();
   if(url.pathname==='/config/firebase-config.js')return r.fulfill({body:'window.FF_FIREBASE_CONFIG={apiKey:"fake",projectId:"demo-local",appId:"fake",authDomain:"example.invalid"};',contentType:'application/javascript'});
   const file=path.join(root,decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return r.fulfill({status:404,body:'missing'});
   const ext=path.extname(file);return r.fulfill({body:fs.readFileSync(file),contentType:({'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png'})[ext]||'text/plain'});
  });
  await page.goto('https://cms.test/index.html');await page.waitForFunction(()=>window.FFAdmin?.state.dataReady);sessions.push(context);return page;
 }
 const a=await session('adminA'),b=await session('adminB');
 const refresh=async p=>p.evaluate(()=>FFAdmin.refreshAll());
 const payload=(title,category='newbie',language='ru')=>({title,youtubeId:'dQw4w9WgXcQ',youtubeUrl:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',categoryId:category,leafCategoryId:category,groupId:null,topicId:null,description:'',language,orientation:'vertical',status:'draft',order:1});
 const save=(p,data,id)=>p.evaluate(async({data,id})=>{try{return {id:await FFAdmin.repo.save(data,id)};}catch(e){return {error:e.code||e.message};}},{data,id});
 const catSave=(p,items)=>p.evaluate(async items=>{try{await FFAdmin.repo.saveCatalog(items);return 'ok';}catch(e){return e.code||e.message;}},items);
 const reorder=(p,ids)=>p.evaluate(async ids=>{try{await FFAdmin.repo.reorder(ids);return 'ok';}catch(e){return e.code||e.message;}},ids);
 const catalog=async p=>p.evaluate(()=>structuredClone(FFAdmin.catalog.items()));
 await check('Full CMS startup and Advertising legacy document',async()=>{assert.equal(await a.locator('#metric-published').textContent(),'1');await a.evaluate(()=>FFAdmin.navigate('categories'));assert(!(await a.locator('#categories-list .catalog-item').first().textContent()).includes('нет опубликованных'));});
 await check('Seed creation race: exactly one transaction accepted',async()=>{const [x,y]=await Promise.all([catSave(a,await catalog(a)),catSave(b,await catalog(b))]);assert.deepEqual([x,y].sort(),['cms/conflict','ok']);assert.equal(docs.get('taxonomy/catalog').revision,1);});
 await Promise.all([refresh(a),refresh(b)]);
 await check('Stale category save cannot remove concurrent new category',async()=>{const newItems=await catalog(b);newItems.push({id:'remote',parentId:null,name:{ru:'Remote'},description:{ru:''},status:'active',order:22});assert.equal(await catSave(b,newItems),'ok');const stale=await catalog(a);stale[0].name.ru='Stale rename';assert.equal(await catSave(a,stale),'cms/conflict');assert(docs.get('taxonomy/catalog').items.some(x=>x.id==='remote'));});
 await Promise.all([refresh(a),refresh(b)]);
 await check('Catalog update preserves unrelated metadata and all original IDs',async()=>{put('taxonomy/catalog',{...docs.get('taxonomy/catalog'),customMetadata:'keep'});const items=await catalog(a);items[0].name.ru='Новичку';assert.equal(await catSave(a,items),'ok');assert.equal(docs.get('taxonomy/catalog').customMetadata,'keep');assert.equal(docs.get('taxonomy/catalog').items.length,22);});
 await Promise.all([refresh(a),refresh(b)]);
 await check('Concurrent creates: conflict rejected, refreshed retry appends uniquely',async()=>{const dataA=payload('Parallel A'),dataB=payload('Parallel B');const out=await Promise.all([save(a,dataA),save(b,dataB)]);assert.equal(out.filter(x=>x.id).length,1);assert.equal(out.filter(x=>x.error==='cms/conflict').length,1);const loser=out[0].error?a:b,data=out[0].error?dataA:dataB;await refresh(loser);assert((await save(loser,data)).id);const rows=[...docs].filter(([k,v])=>k.startsWith('lessons/')&&v.categoryId==='newbie').map(([,v])=>v.order);assert.deepEqual(rows.sort((x,y)=>x-y),[1,2,3]);});
 await Promise.all([refresh(a),refresh(b)]);
 await check('Independent categories/languages allow concurrent creates',async()=>{const [x,y]=await Promise.all([save(a,payload('Sales','sales')),save(b,payload('TJ','newbie','tj'))]);assert(x.id&&y.id);assert.equal(docs.get('lessons/'+x.id).order,1);assert.equal(docs.get('lessons/'+y.id).order,1);});
 await Promise.all([refresh(a),refresh(b)]);
 let group=await a.evaluate(()=>FFAdmin.state.lessons.filter(v=>FFAdmin.dataGuard.scopeId(v)==='newbie~ru').map(v=>v.id));
 await check('Concurrent reorder transactions: one conflict, no partial order',async()=>{const out=await Promise.all([reorder(a,[...group].reverse()),reorder(b,[group[1],group[0],group[2]])]);assert.deepEqual(out.sort(),['cms/conflict','ok']);assert.deepEqual(group.map(id=>docs.get('lessons/'+id).order).sort(),[1,2,3]);});
 await Promise.all([refresh(a),refresh(b)]);
 await check('Add/reorder race cannot omit the added lesson',async()=>{const out=await Promise.all([save(a,payload('During reorder')),reorder(b,group)]);assert.equal(out.filter(x=>x==='ok'||x.id).length,1);assert(out.some(x=>typeof x==='string'&&x!=='ok'||x.error));if(out[0].error){await refresh(a);assert((await save(a,payload('During reorder'))).id);}else {await refresh(b);group=await b.evaluate(()=>FFAdmin.state.lessons.filter(v=>FFAdmin.dataGuard.scopeId(v)==='newbie~ru').map(v=>v.id));assert.equal(await reorder(b,group),'ok');}const orders=[...docs].filter(([k,v])=>k.startsWith('lessons/')&&v.categoryId==='newbie'&&v.language==='ru').map(([,v])=>v.order);assert.equal(new Set(orders).size,orders.length);});
 await Promise.all([refresh(a),refresh(b)]);
 await check('Stale lesson editor cannot overwrite concurrent edit',async()=>{assert((await save(b,payload('Changed remotely'),'advert')).id);const before=clone(docs.get('lessons/advert'));assert.equal((await save(a,payload('Stale title'),'advert')).error,'cms/conflict');assert.deepEqual(docs.get('lessons/advert'),before);assert.equal(before.legacyField,'preserve');});
 await Promise.all([refresh(a),refresh(b)]);
 await check('Move between scopes locks source and destination, appends',async()=>{const before=docs.get('lessonOrderScopes/newbie~ru').revision;const out=await save(a,payload('Moved','sales'),'advert');assert(out.id);assert.equal(docs.get('lessons/advert').order,2);assert.equal(docs.get('lessonOrderScopes/newbie~ru').revision,before+1);});
 await Promise.all([refresh(a),refresh(b)]);
 await check('Cross-scope and partial reorder rejected without any commit',async()=>{const before=JSON.stringify([...docs]);assert.equal(await reorder(a,['advert',group.find(x=>x!=='advert')]),'cms/invalid-data');assert.equal(await reorder(a,['advert']),'cms/invalid-data');assert.equal(JSON.stringify([...docs]),before);});
 await check('Offline failure before commit retains request ID; retry creates once',async()=>{controls.beforeCommit=true;assert.equal((await save(a,payload('Offline retry'))).error,'unavailable');assert(![...docs.values()].some(v=>v.title==='Offline retry'));assert((await save(a,payload('Offline retry'))).id);assert.equal([...docs.values()].filter(v=>v.title==='Offline retry').length,1);});
 await Promise.all([refresh(a),refresh(b)]);
 await check('Lost commit acknowledgement: refresh and repeat return same ID, one document',async()=>{controls.afterCommit=true;assert.equal((await save(a,payload('Lost ack'))).error,'unavailable');const id=[...docs].find(([,v])=>v.title==='Lost ack')[0].split('/')[1];await refresh(a);assert.equal((await save(a,payload('Lost ack'))).id,id);assert.equal([...docs.values()].filter(v=>v.title==='Lost ack').length,1);});
 await Promise.all([refresh(a),refresh(b)]);
 await check('Pending create ID survives page reload after lost acknowledgement',async()=>{controls.afterCommit=true;assert.equal((await save(a,payload('Reload ack'))).error,'unavailable');const id=[...docs].find(([,v])=>v.title==='Reload ack')[0].split('/')[1];await a.reload();await a.waitForFunction(()=>FFAdmin.state.dataReady);assert.equal((await save(a,payload('Reload ack'))).id,id);assert.equal([...docs.values()].filter(v=>v.title==='Reload ack').length,1);});
 await Promise.all([refresh(a),refresh(b)]);
 await check('Successful UI save followed by read failure cannot duplicate on repeat',async()=>{await a.evaluate(()=>{FFAdmin.navigate('videos');FFAdmin.modules.videos.clearForm();});await a.locator('#lesson-title').fill('UI saved');await a.locator('#lesson-url').fill('https://youtu.be/dQw4w9WgXcQ');controls.readFail='lessonOrderScopes';await a.locator('#lesson-form').evaluate(f=>f.requestSubmit());await a.waitForFunction(()=>!FFAdmin.state.busy);assert.equal(await a.locator('#lesson-title').inputValue(),'');assert((await a.locator('#toast').textContent()).includes('Урок сохранён, но список не обновлён'));assert.equal([...docs.values()].filter(v=>v.title==='UI saved').length,1);await a.locator('#lesson-form').evaluate(f=>f.requestSubmit());assert.equal([...docs.values()].filter(v=>v.title==='UI saved').length,1);assert.equal(await a.evaluate(()=>FFAdmin.state.dataReady),false);});
 await refresh(a);
 await check('Corrupted catalog never replaces loaded snapshot; writes blocked',async()=>{const old=clone(docs.get('taxonomy/catalog')),before=await a.evaluate(()=>JSON.stringify(FFAdmin.state.catalog));put('taxonomy/catalog',{...old,items:{bad:true}});await assert.rejects(refresh(a));assert.equal(await a.evaluate(()=>JSON.stringify(FFAdmin.state.catalog)),before);assert.equal(await a.evaluate(()=>FFAdmin.state.dataReady),false);assert((await save(a,payload('blocked'))).error);assert.equal(typeof docs.get('taxonomy/catalog').items,'object');put('taxonomy/catalog',old);await refresh(a);});
 await check('Permission-denied catalog read never becomes missing/seed',async()=>{controls.readFail='taxonomy/catalog';await assert.rejects(refresh(a));assert.equal(await a.evaluate(()=>FFAdmin.state.dataReady),false);const before=JSON.stringify(docs.get('taxonomy/catalog'));assert.notEqual(await catSave(a,await catalog(a)),'ok');assert.equal(JSON.stringify(docs.get('taxonomy/catalog')),before);await refresh(a);});
 await check('Corrupted lesson is not partially loaded or silently discarded',async()=>{const before=await a.evaluate(()=>JSON.stringify(FFAdmin.state.lessons));put('lessons/bad',{...initialLesson,title:42});await assert.rejects(refresh(a));assert.equal(await a.evaluate(()=>JSON.stringify(FFAdmin.state.lessons)),before);assert.equal(await a.evaluate(()=>FFAdmin.state.dataReady),false);docs.delete('lessons/bad');versions.set('lessons/bad',1);await refresh(a);});
 await check('Actual Firestore ID overrides legacy data.id',async()=>{put('lessons/advert',{...docs.get('lessons/advert'),id:'wrong-id'});await refresh(a);assert.equal(await a.evaluate(()=>FFAdmin.state.lessons.find(v=>v.title==='Moved').id),'advert');});
 await check('Duplicate IDs, orphan parent, cycles, and wrong catalog types rejected',async()=>{const tests=await a.evaluate(()=>{const good=FFAdmin.catalog.seed();return [()=>FFAdmin.dataGuard.catalog({}),()=>FFAdmin.dataGuard.catalog([good[0],good[0]]),()=>FFAdmin.dataGuard.catalog([{...good[0],parentId:'missing'}]),()=>FFAdmin.dataGuard.catalog([{...good[0],parentId:'sales'},{...good[1],parentId:'newbie'}])].map(fn=>{try{fn();return false;}catch{return true;}});});assert.deepEqual(tests,[true,true,true,true]);});
 await check('Depth 20 accepted; depth 21 and moved deep subtree rejected',async()=>{const result=await a.evaluate(()=>{const chain=Array.from({length:21},(_,i)=>({id:'n'+i,parentId:i?'n'+(i-1):null,name:{ru:'Node'},status:'active',order:1}));FFAdmin.dataGuard.catalog(chain);chain.push({id:'n21',parentId:'n20',name:{ru:'Deep'},status:'active',order:1});try{FFAdmin.dataGuard.catalog(chain);return false;}catch{return true;}});assert(result);});
 await check('UI cannot save a category below depth 20',async()=>{const before=JSON.stringify(docs.get('taxonomy/catalog'));await a.evaluate(()=>{FFAdmin.state.catalog=Array.from({length:21},(_,i)=>({id:'n'+i,parentId:i?'n'+(i-1):null,name:{ru:'Node'},status:'active',order:1}));FFAdmin.navigate('categories');});await a.locator('#category-new').click();await a.locator('#category-parent').selectOption('n20');await a.locator('#category-name-ru').fill('Too deep');await a.locator('#category-form').evaluate(f=>f.requestSubmit());assert((await a.locator('#toast').textContent()).includes('Максимальная глубина'));assert.equal(JSON.stringify(docs.get('taxonomy/catalog')),before);await refresh(a);});
 await check('Removing an existing category rejected transactionally',async()=>{const before=JSON.stringify(docs.get('taxonomy/catalog'));assert.notEqual(await catSave(a,(await catalog(a)).slice(1)),'ok');assert.equal(JSON.stringify(docs.get('taxonomy/catalog')),before);});
 await Promise.all([refresh(a),refresh(b)]);
 await check('Populated category reparent rejected by adapter',async()=>{const items=await catalog(a);items.find(x=>x.id==='sales').parentId='newbie';assert.notEqual(await catSave(a,items),'ok');});
 await check('Concurrent add vs empty-category move cannot orphan lesson',async()=>{const items=await catalog(b);items.find(x=>x.id==='remote').parentId='sales';const out=await Promise.all([save(a,payload('In remote','remote')),catSave(b,items)]);assert.equal(out.filter(x=>x==='ok'||x.id).length,1);assert(out.some(x=>typeof x==='string'&&x!=='ok'||x.error));assert(![...docs.values()].some(v=>v.title==='In remote')||!docs.get('taxonomy/catalog').items.find(x=>x.id==='remote').parentId);});
 await Promise.all([refresh(a),refresh(b)]);
 await check('Delete serializes order and blocks stale reorder',async()=>{const rows=await a.evaluate(()=>FFAdmin.state.lessons.filter(v=>FFAdmin.dataGuard.scopeId(v)==='sales~ru').map(v=>v.id));await a.evaluate(id=>FFAdmin.repo.remove(id),rows.find(x=>x!=='advert'));assert.equal(await reorder(b,rows),'cms/conflict');assert(docs.has('lessons/advert'));});
 await Promise.all([refresh(a),refresh(b)]);
 await check('Real YouTube parser: watch/Shorts/live/embed/unlisted-style URLs and negatives',async()=>{const values=await a.evaluate(()=>{const id='dQw4w9WgXcQ';return {valid:[`https://youtu.be/${id}`,`https://www.youtube.com/watch?v=${id}&feature=share`,`https://www.youtube.com/shorts/${id}`,`https://www.youtube.com/live/${id}`,`https://www.youtube-nocookie.com/embed/${id}`].map(FFAdmin.youtubeId),invalid:['javascript:alert(1)','https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ','https://unsafe.example/dQw4w9WgXcQ','https://youtu.be/short',''].map(FFAdmin.youtubeId)};});assert(values.valid.every(x=>x==='dQw4w9WgXcQ'));assert(values.invalid.every(x=>x===null));});
 await check('UI creates a nested translated category and preserves existing taxonomy',async()=>{await a.evaluate(()=>FFAdmin.navigate('categories'));const size=docs.get('taxonomy/catalog').items.length;await a.locator('#category-new').click();await a.locator('#category-parent').selectOption('social');await a.locator('#category-name-ru').fill('Новый подраздел');await a.locator('#category-name-tj').fill('Бахши нав');await a.locator('#category-name-uz').fill('Янги бўлим');await a.locator('#category-form').evaluate(f=>f.requestSubmit());await a.waitForFunction(()=>!FFAdmin.state.busy);const rows=docs.get('taxonomy/catalog').items;assert.equal(rows.length,size+1);const x=rows.find(v=>v.name.ru==='Новый подраздел');assert.equal(x.parentId,'social');assert.equal(x.name.tj,'Бахши нав');assert.equal(x.name.uz,'Янги бўлим');});
 await check('Draft, hidden category, filters, arrow UI and mobile navigation regression',async()=>{
  await a.evaluate(()=>FFAdmin.navigate('categories'));await a.locator('[data-category-edit="newbie"]').click();await a.locator('#category-status').selectOption('hidden');await a.locator('#category-form').evaluate(f=>f.requestSubmit());await a.waitForFunction(()=>!FFAdmin.state.busy);assert.equal(docs.get('taxonomy/catalog').items.find(x=>x.id==='newbie').status,'hidden');
  await a.evaluate(()=>FFAdmin.navigate('videos'));const rows=await a.evaluate(()=>FFAdmin.state.lessons.filter(v=>FFAdmin.dataGuard.scopeId(v)==='newbie~ru').sort((x,y)=>x.order-y.order).map(v=>v.id));await a.locator(`[data-edit="${rows[0]}"]`).click();assert((await a.locator('#lesson-category option:checked').textContent()).includes('Скрыт'));await a.locator('#lesson-status').selectOption('published');await a.locator('#lesson-form').evaluate(f=>f.requestSubmit());await a.waitForFunction(()=>!FFAdmin.state.busy);assert.equal(docs.get('lessons/'+rows[0]).status,'published');
  await a.locator(`[data-move="${rows.at(-1)}"][data-delta="-1"]`).click();await a.waitForFunction(()=>!FFAdmin.state.busy);assert.equal(docs.get('lessons/'+rows.at(-1)).order,rows.length-1);
  await a.locator('#filter-lang').selectOption('tj');assert.equal(await a.locator('.lesson-row').count(),1);await a.locator('#filter-lang').selectOption('all');await a.setViewportSize({width:390,height:844});await a.locator('#open-sidebar').click();assert((await a.locator('#sidebar').getAttribute('class')).includes('open'));await a.locator('.nav-button[data-page="overview"]').click();assert(!(await a.locator('#sidebar').getAttribute('class')).includes('open'));
 });
 await a.setViewportSize({width:1200,height:840});await refresh(a);
 await check('UI deletes an old empty category with named confirmation',async()=>{
  await a.evaluate(()=>FFAdmin.navigate('categories'));let message='';a.once('dialog',async d=>{message=d.message();await d.accept();});
  await a.locator('[data-category-delete="health"]').click();await a.waitForFunction(()=>!FFAdmin.state.busy);
  assert(message.includes('Здоровье'));assert(!docs.get('taxonomy/catalog').items.some(x=>x.id==='health'));assert.equal(await a.locator('[data-category-delete="health"]').count(),0);
 });
 await check('UI prevents populated and parent category deletion',async()=>{
  const before=JSON.stringify(docs.get('taxonomy/catalog'));await a.locator('[data-category-delete="newbie"]').click();assert((await a.locator('#toast').textContent()).includes('видео'));
  await a.locator('[data-category-delete="social"]').click();assert((await a.locator('#toast').textContent()).includes('вложенные'));assert.equal(JSON.stringify(docs.get('taxonomy/catalog')),before);
 });
 await check('UI cancellation keeps category; deletes new translated child and clears editor',async()=>{
  const child=docs.get('taxonomy/catalog').items.find(x=>x.name.ru==='Новый подраздел');
  a.once('dialog',d=>d.dismiss());await a.locator(`[data-category-delete="${child.id}"]`).click();assert(docs.get('taxonomy/catalog').items.some(x=>x.id===child.id));
  await a.locator(`[data-category-edit="${child.id}"]`).click();a.once('dialog',d=>d.accept());await a.locator(`[data-category-delete="${child.id}"]`).click();await a.waitForFunction(()=>!FFAdmin.state.busy);
  assert(!docs.get('taxonomy/catalog').items.some(x=>x.id===child.id));assert.equal(await a.locator('#category-edit-id').inputValue(),'');
 });
 await check('Repeat deletion with stale revision rejected',async()=>{const old=await catalog(b);assert.notEqual(await catSave(b,old.filter(x=>x.id!=='health')),'ok');assert(!docs.get('taxonomy/catalog').items.some(x=>x.id==='health'));});
 await check('Quick Hide / Close / Open preserves all videos and category content',async()=>{
  await a.evaluate(()=>FFAdmin.navigate('categories'));const lessons=JSON.stringify([...docs].filter(([k])=>k.startsWith('lessons/'))),before=clone(docs.get('taxonomy/catalog').items.find(x=>x.id==='sales'));
  a.once('dialog',d=>d.accept());await a.locator('[data-category-access="sales"][data-access-mode="hidden"]').click();await a.waitForFunction(()=>!FFAdmin.state.busy);
  let row=docs.get('taxonomy/catalog').items.find(x=>x.id==='sales');assert.equal(row.status,'hidden');assert(await a.locator('[data-category-edit="sales"]').locator('../..').evaluate(el=>el.classList.contains('is-restricted')));assert.equal(await a.locator('[data-category-edit="sales"]').locator('../..').locator('.category-state-badge').textContent(),'Скрыта');assert(['rgb(81, 42, 42)','rgb(107, 50, 50)'].includes(await a.locator('[data-category-access="sales"][data-access-mode="active"]').evaluate(el=>getComputedStyle(el).backgroundColor)));assert.equal(await a.locator('[data-category-access="sales"][data-access-mode="active"]').count(),1);
  a.once('dialog',d=>d.accept());await a.locator('[data-category-access="sales"][data-access-mode="maintenance"]').click();await a.waitForFunction(()=>!FFAdmin.state.busy);
  row=docs.get('taxonomy/catalog').items.find(x=>x.id==='sales');assert.equal(row.status,'soon');assert.equal(row.closureReason,'maintenance');assert.equal(await a.locator('[data-category-edit="sales"]').locator('../..').locator('.category-state-badge').textContent(),'Закрыта');assert.equal(row.availabilityMessage.ru,'Закрыто на техническое обслуживание');assert(row.availabilityMessage.tj&&row.availabilityMessage.uz);
  assert((await a.locator('[data-category-edit="sales"]').locator('../..').textContent()).includes('Закрыто на техническое обслуживание'));
  await a.locator('[data-category-edit="sales"]').click();assert.equal(await a.locator('#category-status').inputValue(),'maintenance');
  await a.locator('[data-category-access="sales"][data-access-mode="active"]').click();await a.waitForFunction(()=>!FFAdmin.state.busy);
  row=docs.get('taxonomy/catalog').items.find(x=>x.id==='sales');assert.equal(row.status,'active');assert(!(await a.locator('[data-category-edit="sales"]').locator('../..').evaluate(el=>el.classList.contains('is-restricted'))));assert.equal(await a.locator('[data-category-edit="sales"]').locator('../..').locator('.category-state-badge').count(),0);assert(!('closureReason' in row));assert(!('availabilityMessage' in row));assert.deepEqual(row.name,before.name);assert.deepEqual(row.description,before.description);assert.equal(JSON.stringify([...docs].filter(([k])=>k.startsWith('lessons/'))),lessons);
 });
 await check('Quick close cancellation and duplicate click guard',async()=>{
  const revision=docs.get('taxonomy/catalog').revision;a.once('dialog',d=>d.dismiss());await a.locator('[data-category-access="sales"][data-access-mode="maintenance"]').click();assert.equal(docs.get('taxonomy/catalog').revision,revision);
  let dialogs=0;const accept=d=>{dialogs++;return d.accept();};a.on('dialog',accept);
  await a.evaluate(()=>{const b=document.querySelector('[data-category-access="sales"][data-access-mode="maintenance"]');b.click();b.click();});await a.waitForFunction(()=>!FFAdmin.state.busy);a.off('dialog',accept);assert.equal(dialogs,1);assert.equal(docs.get('taxonomy/catalog').revision,revision+1);
 });
 await check('Maintenance form save, reopen and parent restrictions',async()=>{
  await a.locator('[data-category-edit="sales"]').click();await a.locator('#category-name-tj').fill('Фурӯш');await a.locator('#category-form').evaluate(f=>f.requestSubmit());await a.waitForFunction(()=>!FFAdmin.state.busy);
  assert.equal(docs.get('taxonomy/catalog').items.find(x=>x.id==='sales').closureReason,'maintenance');
  const childrenBefore=clone(docs.get('taxonomy/catalog').items.filter(x=>x.parentId==='social'));
  a.once('dialog',d=>d.accept());await a.locator('[data-category-access="social"][data-access-mode="maintenance"]').click();await a.waitForFunction(()=>!FFAdmin.state.busy);
  assert.deepEqual(docs.get('taxonomy/catalog').items.filter(x=>x.parentId==='social'),childrenBefore);
  const child=childrenBefore[0].id;assert.equal(await a.evaluate(id=>FFAdmin.categoryAvailability.effective(FFAdmin.catalog.items(),id).canEnter,child),false);
  await a.locator('[data-category-access="social"][data-access-mode="active"]').click();await a.waitForFunction(()=>!FFAdmin.state.busy);
  assert.equal(await a.evaluate(id=>FFAdmin.categoryAvailability.effective(FFAdmin.catalog.items(),id).canEnter,child),true);
 });
 await check('Stale availability edit rejected without overwriting latest status',async()=>{
  await refresh(b);const stale=await catalog(b);await refresh(a);
  await a.locator('[data-category-access="sales"][data-access-mode="active"]').click();await a.waitForFunction(()=>!FFAdmin.state.busy);
  const index=stale.findIndex(x=>x.id==='sales');stale[index]=require('../assets/js/core/category-availability').apply(stale[index],'hidden');assert.equal(await catSave(b,stale),'cms/conflict');assert.equal(docs.get('taxonomy/catalog').items.find(x=>x.id==='sales').status,'active');
 });
 await check('Category controls stay within the mobile viewport',async()=>{
  await a.setViewportSize({width:390,height:844});await a.evaluate(()=>FFAdmin.navigate('categories'));
  const box=await a.locator('[data-category-access="sales"][data-access-mode="maintenance"]').boundingBox();assert(box&&box.x>=0&&box.x+box.width<=390);
  assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 });
 await check('Spark build never imports the Cloud Functions SDK',async()=>assert(!requestedSdk.some(x=>x.includes('firebase-functions'))));
 await check('Firestore map key order does not turn one status change into many changes',async()=>{
  await a.setViewportSize({width:1200,height:840});await refresh(a);await a.evaluate(()=>FFAdmin.navigate('categories'));
  const before=clone(docs.get('taxonomy/catalog'));
  function reverseKeys(v){if(Array.isArray(v))return v.map(reverseKeys);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).reverse().map(([k,x])=>[k,reverseKeys(x)]));return v;}
  put('taxonomy/catalog',{...before,items:before.items.map(reverseKeys)});
  a.once('dialog',d=>d.accept());await a.locator('[data-category-access="sales"][data-access-mode="hidden"]').click();await a.waitForFunction(()=>!FFAdmin.state.busy);
  assert.equal(docs.get('taxonomy/catalog').items.find(x=>x.id==='sales').status,'hidden',await a.locator('#toast').textContent());
  assert.equal(docs.get('taxonomy/catalog').revision,before.revision+1);
  for(const x of before.items)if(x.id!=='sales')assert.deepEqual(docs.get('taxonomy/catalog').items.find(v=>v.id===x.id),x);
 });
 await check('Promocodes UI generates only after confirmation, filters, exports and rotates universal code',async()=>{
  await a.setViewportSize({width:1280,height:900});await a.evaluate(()=>FFAdmin.navigate('promocodes'));await a.waitForFunction(()=>document.querySelector('#promo-count').textContent.includes('Всего:'));
  assert.equal([...docs.keys()].filter(k=>k.startsWith('promoCodes/')).length,0);
  await a.locator('#promo-amount').fill('3');await confirmPromo(a,'#promo-generate');await a.waitForFunction(()=>document.querySelector('#promo-count').textContent.includes('Всего: 3'));
  assert.equal([...docs.keys()].filter(k=>k.startsWith('promoCodes/')).length,3);const secret=[...docs].find(([k])=>k.startsWith('promoSecrets/'))[1].code;await a.locator('#promo-search').fill(secret);assert.equal(await a.locator('#promo-list .catalog-item').count(),1);await a.locator('#promo-search').fill('');
  const download=a.waitForEvent('download');await a.locator('#promo-export').click();const file=await download;const csv=fs.readFileSync(await file.path(),'utf8');assert(csv.includes(secret));assert(csv.includes('Код'));
  await confirmPromo(a,'#universal-create');await a.waitForFunction(()=>document.querySelector('#universal-code').textContent.startsWith('FF-'));const old=docs.get('accessConfig/universal').codeHash;
  await confirmPromo(a,'#universal-create');await a.waitForFunction(old=>window.FFAdmin&&document.querySelector('#universal-code').textContent!==old,await a.locator('#universal-code').textContent());
  assert.equal(docs.get('promoCodes/'+old).enabled,false);assert.notEqual(docs.get('accessConfig/universal').codeHash,old);
 });
 await check('Centered in-page generation dialog supports cancel and Escape without writing codes',async()=>{
  const before=[...docs.keys()].filter(x=>x.startsWith('promoCodes/')).length;await a.locator('#promo-amount').fill('2');await a.locator('#promo-generate').click();assert(await a.locator('#admin-confirm').isVisible());assert((await a.locator('#admin-confirm-message').textContent()).includes('2'));assert(!(await a.locator('#admin-confirm-message').textContent()).includes('@'));const r=await a.locator('#admin-confirm').boundingBox(),v=a.viewportSize();assert(Math.abs(r.x+r.width/2-v.width/2)<2);assert(Math.abs(r.y+r.height/2-v.height/2)<2);await a.keyboard.press('Escape');assert(await a.locator('#admin-confirm').isHidden());assert.equal([...docs.keys()].filter(x=>x.startsWith('promoCodes/')).length,before);
 });
 await check('Copy single and universal codes uses exact plaintext and preserves code state',async()=>{
  await a.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.__copied=value;}}}));const first=a.locator('[data-promo-copy]').first(),hash=await first.getAttribute('data-promo-copy'),before=clone(docs.get('promoCodes/'+hash));await first.click();await a.waitForFunction(()=>document.querySelector('#toast').textContent==='Код скопирован');assert.equal(await a.evaluate(()=>window.__copied),docs.get('promoSecrets/'+hash).code);assert.deepEqual(docs.get('promoCodes/'+hash),before);await a.locator('#universal-copy').click();assert.equal(await a.evaluate(()=>window.__copied),docs.get('promoSecrets/'+docs.get('accessConfig/universal').codeHash).code);
 });
 await check('Copy falls back on denied clipboard permission and reports only successful copy',async()=>{
  await a.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw Error('denied')};window.__exec=document.execCommand;document.execCommand=command=>{window.__fallbackCopied=document.activeElement.value;return command==='copy';};});const first=a.locator('[data-promo-copy]').first(),hash=await first.getAttribute('data-promo-copy');await first.click();await a.waitForFunction(()=>!!window.__fallbackCopied);assert.equal(await a.evaluate(()=>window.__fallbackCopied),docs.get('promoSecrets/'+hash).code);await a.evaluate(()=>{document.execCommand=window.__exec;navigator.clipboard.writeText=async value=>{window.__copied=value;};});
 });
 await check('Admin can cancel or reset an installation without resetting its consumed code',async()=>{
  const item=[...docs.entries()].find(([key,value])=>key.startsWith('promoCodes/')&&value.kind==='single');const hash=item[0].split('/')[1];put(item[0],{...item[1],state:'used'});put('installations/resetDevice',{codeHash:hash,platform:'android',enabled:true});put('promoClaims/'+hash,{uid:'resetDevice'});
  await a.locator('#promo-refresh').click();await a.waitForSelector('[data-install-reset="resetDevice"]');await confirmPromo(a,'[data-install-reset="resetDevice"]',false);assert(docs.has('installations/resetDevice'));
  await confirmPromo(a,'[data-install-reset="resetDevice"]');await a.waitForFunction(()=>!document.querySelector('[data-install-reset="resetDevice"]'));assert(!docs.has('installations/resetDevice'));assert(!docs.has('promoClaims/'+hash));assert.equal(docs.get(item[0]).state,'used');
 });
 await check('Reset of a universal installation preserves other installations and current universal code',async()=>{
  const hash=docs.get('accessConfig/universal').codeHash;put('installations/universalReset',{codeHash:hash,platform:'ios',enabled:true});put('installations/universalKeep',{codeHash:hash,platform:'android',enabled:true});await a.evaluate(()=>FFAdmin.promoRepo.resetInstallation('universalReset'));assert(!docs.has('installations/universalReset'));assert(docs.has('installations/universalKeep'));assert.equal(docs.get('promoCodes/'+hash).enabled,true);assert.equal(docs.get('accessConfig/universal').codeHash,hash);
 });
 await check('Interrupted generation resumes the same code batch without duplicates',async()=>{
  const before=[...docs.keys()].filter(x=>x.startsWith('promoCodes/')).length;await a.locator('#promo-amount').fill('250');controls.afterCommit=true;await confirmPromo(a,'#promo-generate');await a.waitForFunction(()=>document.querySelector('#toast').textContent.includes('При сбое генерации'));
  assert.equal([...docs.keys()].filter(x=>x.startsWith('promoCodes/')).length,before+200);assert.equal(await a.evaluate(()=>FFAdmin.promoRepo.pendingCount()),250);
  await confirmPromo(a,'#promo-generate');await a.waitForFunction(()=>FFAdmin.promoRepo.pendingCount()===0);assert.equal([...docs.keys()].filter(x=>x.startsWith('promoCodes/')).length,before+250);
 });
 await check('Actual admin repository generates 5000 unique codes in bounded transactions on fake backend',async()=>{
  const before=[...docs.keys()].filter(x=>x.startsWith('promoCodes/')).length;await a.locator('#promo-amount').fill('5000');await confirmPromo(a,'#promo-generate');await a.waitForFunction(()=>document.querySelector('#promo-progress').textContent==='Создано 5000 из 5000'&&FFAdmin.promoRepo.pendingCount()===0,{},{timeout:90000});assert.equal([...docs.keys()].filter(x=>x.startsWith('promoCodes/')).length,before+5000);assert.equal(new Set([...docs.keys()].filter(x=>x.startsWith('promoCodes/'))).size,before+5000);
 });
 await check('Five new codes are automatically selected, issued atomically and copied as five separate lines',async()=>{
  await a.evaluate(()=>FFAdmin.navigate('promocodes'));await a.waitForFunction(()=>!!document.querySelector('#promo-metrics').textContent);await a.locator('#promo-amount').fill('5');await confirmPromo(a,'#promo-generate');await a.waitForFunction(()=>document.querySelector('#promo-issue-selected').textContent.includes(': 5')&&!document.querySelector('#promo-issue-selected').disabled);
  const ids=await a.evaluate(()=>FFAdmin.promoRepo.lastGeneratedIds.slice());const before=[...docs.keys()].filter(x=>x.startsWith('promoDistribution/')).length;await confirmPromo(a,'#promo-issue-selected');await a.waitForFunction(()=>document.querySelector('#toast').textContent==='Выдано и скопировано кодов: 5');await a.waitForFunction(()=>document.querySelector('#promo-issue-selected').textContent.endsWith(': 0'));assert.equal([...docs.keys()].filter(x=>x.startsWith('promoDistribution/')).length,before+5);
  const lines=(await a.evaluate(()=>window.__copied)).split('\n');assert.equal(lines.length,5);assert.equal(new Set(lines).size,5);assert.deepEqual(new Set(lines),new Set(ids.map(id=>docs.get('promoSecrets/'+id).code)));assert.equal(new Set(ids.map(id=>docs.get('promoDistribution/'+id).groupId)).size,1);for(const id of ids)assert.equal(docs.get('promoCodes/'+id).state,'free');
  windowFiveIds=ids;
 });
 await check('Counters distinguish issued, remaining and activated; repeat group copy does not double count',async()=>{
  const group=docs.get('promoDistribution/'+windowFiveIds[0]).groupId,before=[...docs.keys()].filter(x=>x.startsWith('promoDistribution/')).length;await a.locator('[data-promo-group-copy="'+group+'"]').click();assert.equal((await a.evaluate(()=>window.__copied)).split('\n').length,5);assert.equal([...docs.keys()].filter(x=>x.startsWith('promoDistribution/')).length,before);
  const activated=windowFiveIds[0];put('promoCodes/'+activated,{...docs.get('promoCodes/'+activated),state:'used'});await a.locator('#promo-refresh').click();await a.waitForFunction(()=>document.querySelector('#promo-groups').textContent.includes('Активировано: 1'));const state=await a.evaluate(async()=>{const c=await FFAdmin.promoRepo.list();return FFAdmin.promoDistribution.stats(c.codes,c.distribution);});assert.equal(state.issued,[...docs.entries()].filter(([key,v])=>key.startsWith('promoCodes/')&&v.kind==='single'&&(v.state==='used'||docs.has('promoDistribution/'+key.split('/')[1]))).length);assert.equal(state.activated,[...docs.entries()].filter(([key,v])=>key.startsWith('promoCodes/')&&v.kind==='single'&&v.state==='used').length);assert.equal(state.total,[...docs.entries()].filter(([key,v])=>key.startsWith('promoCodes/')&&v.kind==='single').length);
  await b.evaluate(()=>FFAdmin.navigate('promocodes'));await b.waitForFunction(()=>!!document.querySelector('#promo-metrics').textContent);assert.equal(await b.locator('#promo-metrics').textContent(),await a.locator('#promo-metrics').textContent());
 });
 await check('Two admins cannot issue the same code twice; disabled and activated codes are rejected',async()=>{
  await a.evaluate(()=>FFAdmin.promoRepo.generate(1));const id=await a.evaluate(()=>FFAdmin.promoRepo.lastGeneratedIds[0]);const r=await Promise.allSettled([a.evaluate(id=>FFAdmin.promoRepo.issue([id]),id),b.evaluate(id=>FFAdmin.promoRepo.issue([id]),id)]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert(docs.has('promoDistribution/'+id));assert.equal(docs.get('promoCodes/'+id).state,'free');
  await a.evaluate(()=>FFAdmin.promoRepo.generate(2));const ids=await a.evaluate(()=>FFAdmin.promoRepo.lastGeneratedIds);put('promoCodes/'+ids[0],{...docs.get('promoCodes/'+ids[0]),enabled:false});put('promoCodes/'+ids[1],{...docs.get('promoCodes/'+ids[1]),state:'used'});for(const id of ids)await assert.rejects(a.evaluate(id=>FFAdmin.promoRepo.issue([id]),id));assert(!docs.has('promoDistribution/'+ids[0]));assert(!docs.has('promoDistribution/'+ids[1]));
 });
 await check('Failed clipboard keeps issued group recoverable without issuing again',async()=>{
  await a.locator('#promo-amount').fill('2');await confirmPromo(a,'#promo-generate');await a.waitForFunction(()=>document.querySelector('#promo-issue-selected').textContent.endsWith(': 2')&&!document.querySelector('#promo-issue-selected').disabled);const ids=await a.evaluate(()=>FFAdmin.promoRepo.lastGeneratedIds.slice());await a.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw Error('denied')};document.execCommand=()=>false;});await confirmPromo(a,'#promo-issue-selected');await a.waitForFunction(()=>document.querySelector('#toast').textContent.includes('Выдача сохранена'));await a.waitForFunction(()=>!document.querySelector('#promo-issue-selected').textContent.endsWith(': 2'));for(const id of ids)assert(docs.has('promoDistribution/'+id));const group=docs.get('promoDistribution/'+ids[0]).groupId,before=[...docs.keys()].filter(x=>x.startsWith('promoDistribution/')).length;await a.evaluate(()=>{document.execCommand=window.__exec;navigator.clipboard.writeText=async value=>{window.__copied=value;};});await a.locator('[data-promo-group-copy="'+group+'"]').click();assert.equal((await a.evaluate(()=>window.__copied)).split('\n').length,2);assert.equal([...docs.keys()].filter(x=>x.startsWith('promoDistribution/')).length,before);
 });
 await check('Phone navigation, forms, code actions and centered dialog fit 390 and 320 pixel widths',async()=>{
  for(const width of [390,320]){await a.setViewportSize({width,height:844});await a.evaluate(()=>FFAdmin.navigate('promocodes'));await a.waitForFunction(()=>document.querySelector('#promo-count').textContent.includes('Всего:'));await a.locator('#open-sidebar').click();assert(await a.locator('#sidebar-backdrop').isVisible());assert.equal(await a.locator('#open-sidebar').getAttribute('aria-expanded'),'true');await a.locator('#sidebar .nav-button[data-page="videos"]').click();assert(await a.locator('#sidebar-backdrop').isHidden());assert.equal(await a.locator('#page-title').textContent(),'Видеоуроки');await a.locator('#open-sidebar').click();await a.locator('#close-sidebar').click();assert(await a.locator('#sidebar-backdrop').isHidden());
   for(const section of ['overview','videos','categories','ranks','materials','promocodes','settings']){await a.evaluate(id=>FFAdmin.navigate(id),section);assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,section+' at '+width+' '+JSON.stringify(await a.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.right>innerWidth+1}).map(el=>({tag:el.tagName,id:el.id,cls:el.className,right:el.getBoundingClientRect().right})).slice(0,15))));}
   await a.evaluate(()=>FFAdmin.navigate('promocodes'));await a.locator('#promo-amount').fill('2');await a.locator('#promo-generate').click();const r=await a.locator('#admin-confirm').boundingBox();assert(r.x>=0&&r.x+r.width<=width);assert(Math.abs(r.x+r.width/2-width/2)<2);await a.locator('#admin-confirm-cancel').click();await a.screenshot({path:path.join(__dirname,'../admin-mobile-'+width+'.png'),fullPage:false});
  }await a.setViewportSize({width:1280,height:900});
 });
 await check('No unexpected JavaScript page errors',async()=>assert.deepEqual(errors,[]));
 await a.setViewportSize({width:1280,height:900});await a.evaluate(()=>{FFAdmin.navigate('categories');document.querySelector('#categories-list').scrollIntoView({block:'start'});});await a.screenshot({path:path.join(__dirname,'../admin-categories-preview.png')});
 await browser.close();const out=process.env.FF_TEST_OUTPUT||path.join(__dirname,'ADMIN_BROWSER_RESULTS.json');fs.writeFileSync(out,JSON.stringify({environment:'Complete project, Edge/Chromium, two independent browser contexts, shared MVCC SDK test double; no live Firebase or Rules execution',results,errors},null,2));console.log(`${results.filter(x=>x.result==='PASS').length}/${results.length} checks passed`);if(results.some(x=>x.result==='FAIL'))process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});
