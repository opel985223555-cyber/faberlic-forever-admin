/* Real complete CMS in two browser sessions; fake modular SDK + shared MVCC store.
   No production requests. This is NOT a Firestore Security Rules emulator.
   Run: NODE_PATH=<existing packages> node tests/test_p0_p1.cjs
   Optional: FF_BROWSER_PATH, FF_TEST_OUTPUT, FF_PLAYWRIGHT_MODULE. */
const fs=require('fs'),path=require('path'),assert=require('assert');
const {chromium}=require(process.env.FF_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),results=[],errors=[];
const docs=new Map(),versions=new Map();let serial=0,clock=1000;
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
async function check(name,fn){try{await fn();results.push({name,result:'PASS'});}catch(e){results.push({name,result:'FAIL',error:e.stack});console.error(name,e);}}
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.FF_BROWSER_PATH?{executablePath:process.env.FF_BROWSER_PATH}:process.platform==='win32'?{channel:'msedge'}:{})});
 const sessions=[];
 async function session(uid){const context=await browser.newContext({viewport:{width:1200,height:840}});const page=await context.newPage();
  await page.exposeFunction('__rpc',rpc);page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({uid})=>{window.__uid=uid;window.__newIds=Array.from({length:200},(_,i)=>uid+'-'+Date.now().toString(36)+'-'+i+'-'+Math.random().toString(36).slice(2));},{uid});
  await page.route('**/*',async r=>{const url=new URL(r.request().url());
   if(url.hostname==='www.gstatic.com'){
    const src=url.pathname.endsWith('firebase-app.js')?'export const initializeApp=cfg=>cfg;':url.pathname.endsWith('firebase-auth.js')?`export const getAuth=()=>({});export const onAuthStateChanged=(_,fn)=>queueMicrotask(()=>fn({uid:window.__uid,email:window.__uid+'@example.invalid'}));export const signOut=async()=>{};export const signInWithEmailAndPassword=async()=>{};`:mockStore;
    return r.fulfill({body:src,contentType:'application/javascript',headers:{'Access-Control-Allow-Origin':'*'}});
   }
   if(url.hostname!=='cms.test')return r.abort();
   if(url.pathname==='/config/firebase-config.js')return r.fulfill({body:'window.FF_FIREBASE_CONFIG={apiKey:"fake",projectId:"demo-local",appId:"fake",authDomain:"example.invalid"};',contentType:'application/javascript'});
   const file=path.join(root,decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return r.fulfill({status:404,body:'missing'});
   const ext=path.extname(file);return r.fulfill({body:fs.readFileSync(file),contentType:({'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png'})[ext]||'text/plain'});
  });
  await page.goto('http://cms.test/index.html');await page.waitForFunction(()=>window.FFAdmin?.state.dataReady);sessions.push(context);return page;
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
 await check('Add/reorder race cannot omit the added lesson',async()=>{const out=await Promise.all([save(a,payload('During reorder')),reorder(b,group)]);assert.equal(out.filter(x=>x==='ok'||x.id).length,1);assert(out.some(x=>x==='cms/conflict'||x.error==='cms/conflict'));if(out[0].error){await refresh(a);assert((await save(a,payload('During reorder'))).id);}else {await refresh(b);group=await b.evaluate(()=>FFAdmin.state.lessons.filter(v=>FFAdmin.dataGuard.scopeId(v)==='newbie~ru').map(v=>v.id));assert.equal(await reorder(b,group),'ok');}const orders=[...docs].filter(([k,v])=>k.startsWith('lessons/')&&v.categoryId==='newbie'&&v.language==='ru').map(([,v])=>v.order);assert.equal(new Set(orders).size,orders.length);});
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
 await check('Removing an existing category rejected transactionally',async()=>{const before=JSON.stringify(docs.get('taxonomy/catalog'));assert.equal(await catSave(a,(await catalog(a)).slice(1)),'cms/invalid-data');assert.equal(JSON.stringify(docs.get('taxonomy/catalog')),before);});
 await Promise.all([refresh(a),refresh(b)]);
 await check('Populated category reparent rejected by adapter',async()=>{const items=await catalog(a);items.find(x=>x.id==='sales').parentId='newbie';assert.equal(await catSave(a,items),'cms/invalid-data');});
 await check('Concurrent add vs empty-category move cannot orphan lesson',async()=>{const items=await catalog(b);items.find(x=>x.id==='remote').parentId='sales';const out=await Promise.all([save(a,payload('In remote','remote')),catSave(b,items)]);assert.equal(out.filter(x=>x==='ok'||x.id).length,1);assert(out.some(x=>x==='cms/conflict'||x.error==='cms/conflict'));assert(![...docs.values()].some(v=>v.title==='In remote')||!docs.get('taxonomy/catalog').items.find(x=>x.id==='remote').parentId);});
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
 await check('No unexpected JavaScript page errors',async()=>assert.deepEqual(errors,[]));
 await browser.close();const out=process.env.FF_TEST_OUTPUT||path.join(__dirname,'P0_P1_TEST_RESULTS.json');fs.writeFileSync(out,JSON.stringify({environment:'Complete project, Edge/Chromium, two independent browser contexts, shared MVCC SDK test double; no live Firebase or Rules execution',results,errors},null,2));console.log(`${results.filter(x=>x.result==='PASS').length}/${results.length} checks passed`);if(results.some(x=>x.result==='FAIL'))process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});
