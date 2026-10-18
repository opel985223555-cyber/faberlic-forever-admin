const fs=require('fs'),vm=require('vm');const root=require('path').join(__dirname,'../assets/js/modules')+'/';
const els=new Map(),db={materials:[],liveStreams:[]},logs=[];
class Element{constructor(id){this.id=id;this.value='';this.innerHTML='';this.hidden=false;this.disabled=false;this.handlers={};}
 addEventListener(type,fn){this.handlers[type]=fn;}reset(){}scrollIntoView(){}closest(){return null;}}
const $=selector=>{if(!els.has(selector))els.set(selector,new Element(selector));return els.get(selector);};
let idseq=0;
const A={state:{mode:'firebase',currentUser:{uid:'tester'}},modules:{},$: $, $on:(el,type,fn)=>el?.addEventListener(type,fn),escape:x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),youtubeId:raw=>/^[A-Za-z0-9_-]{11}$/.test((raw.split('v=')[1]||''))?(raw.split('v=')[1]):null,youtubeLink:id=>'https://www.youtube.com/watch?v='+id,notify:(msg,kind)=>logs.push({msg,kind}),firebase:{
 async listContent(col){return db[col].map(x=>({...x}));},
 async saveContent(col,payload,id,revision){if(id){const rec=db[col].find(x=>x.id===id);if(!rec||revision!==rec.revision)throw Error('conflict');Object.assign(rec,payload);rec.revision++;return id;}let ref=String(++idseq);db[col].push({...payload,id:ref,revision:1});return ref;},
 async deleteContent(col,id,rev){const row=db[col].find(x=>x.id===id);if(!row||row.revision!==rev)throw Error('conflict');db[col]=db[col].filter(x=>x.id!==id);}
}};
const ctx={window:{FFAdmin:A,confirm:()=>true},document:{},URL,console,Date};vm.createContext(ctx);
for(let mod of ['live','materials'])vm.runInContext(fs.readFileSync(root+mod+'.js','utf8'),ctx);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 A.modules.live.init();A.modules.materials.init();A.modules.live.render();A.modules.materials.render();await tick();
 $('#live-title').value='Запланированное обучение';$('#live-url').value='https://youtube.com/watch?v=AbCdEfGhI_1';$('#live-lang').value='ru';$('#live-phase').value='scheduled';$('#live-status').value='published';$('#live-host').value='Лидер';
 await $('#live-form').handlers.submit({preventDefault(){}});
 if(db.liveStreams.length!==1||db.liveStreams[0].youtubeId!=='AbCdEfGhI_1')throw Error('Live create failed');
 $('#material-title').value='Чек-лист';$('#material-url').value='javascript:alert(1)';$('#material-lang').value='ru';$('#material-type').value='checklist';$('#material-status').value='published';
 await $('#material-form').handlers.submit({preventDefault(){}});
 if(db.materials.length!==0)throw Error('Invalid URL was allowed');
 $('#material-url').value='https://disk.yandex.ru/i/file';
 await $('#material-form').handlers.submit({preventDefault(){}});
 if(db.materials.length!==1||!db.materials[0].url.startsWith('https:'))throw Error('Material create failed');
 if(!$('#live-list').innerHTML.includes('Запланированное обучение'))throw Error('Live list failed');
 if(!$('#material-list').innerHTML.includes('Чек-лист'))throw Error('Material list failed');
 console.log('PASS: admin module forms, create, YouTube validation, HTTPS restriction, list refresh');
})().catch(e=>{console.error(e);process.exitCode=1});
