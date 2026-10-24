const fs=require('fs');const vm=require('vm');const root=require('path').join(__dirname,'app/src/main/assets/www/modules')+'/';
const panels={liveList:{innerHTML:''},materialList:{innerHTML:''},lessonOverlay:{classList:{add(){}},},lessonHeader:{},favoriteBtn:{},lessonTitle:{},lessonCat:{},lessonDesc:{},player:{},};
for(const key in panels){panels[key].querySelectorAll=()=>[];}
let currentLang='ru';
const context={window:{},currentLang,data:{},currentVideoId:null,document:{querySelector(sel){return panels[sel.slice(1)];}},$:sel=>panels[sel.slice(1)],esc:(s)=>String(s??'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c])),console,URL};
vm.createContext(context);
for(const mod of ['live','materials'])vm.runInContext(fs.readFileSync(root+mod+'.js','utf8'),context,{filename:mod});
context.window.FFContentModules.receiveLive(JSON.stringify([{id:'a',youtubeId:'AbCdEfGhI_1',phase:'recorded',language:'ru',title:'Обучение <test>',host:'Лидер',scheduledAtMs:0}]));
if(!panels.liveList.innerHTML.includes('Обучение &lt;test&gt;'))throw Error('Live escaping failed');
if(!panels.liveList.innerHTML.includes('Запись эфира'))throw Error('Live rendering failed');
context.window.FFContentModules.receiveMaterials(JSON.stringify([{id:'b',url:'https://disk.yandex.ru/i/x',type:'pdf',language:'ru',title:'Чек-лист',description:'Описание'}]));
if(!panels.materialList.innerHTML.includes('Чек-лист'))throw Error('Materials rendering failed');
context.window.FFContentModules.receiveMaterials(JSON.stringify([{id:'x',url:'javascript:alert(1)',type:'pdf',language:'ru',title:'Attack'}]));
if(panels.materialList.innerHTML.includes('Attack'))throw Error('Invalid URL accepted');
context.currentLang='tj';context.window.renderLive();if(panels.liveList.innerHTML.includes('Обучение'))throw Error('Language filtering failed');
console.log('PASS: mobile module rendering, XSS escaping, HTTPS restriction, language filtering, record states');
