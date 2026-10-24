/* CMS-12: availability contract; identical browser/server copies. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.FFCategoryAvailability=factory();})(typeof window==='object'?window:globalThis,()=>{
 const maintenance={ru:'Закрыто на техническое обслуживание',tj:'Барои корҳои техникӣ баста аст',uz:'Техник хизмат кўрсатиш учун ёпилган'};
 const soon={ru:'Скоро',tj:'Ба наздикӣ',uz:'Тез кунда'};
 const mode=x=>x.status==='soon'&&x.closureReason==='maintenance'?'maintenance':x.status;
 function validate(x){
  if(x.closureReason!==undefined&&(x.closureReason!=='maintenance'||x.status!=='soon'))throw Error('Некорректная причина закрытия категории '+x.id);
  if(x.availabilityMessage!==undefined){
   const m=x.availabilityMessage;
   if(!m||typeof m!=='object'||Array.isArray(m)||x.closureReason!=='maintenance')throw Error('Некорректное сообщение категории '+x.id);
   for(const lang of ['ru','tj','uz'])if(typeof m[lang]!=='string'||!m[lang].trim()||m[lang].length>300)throw Error('Некорректный перевод сообщения категории '+x.id);
  }
 }
 function apply(x,value){
  if(!['active','hidden','soon','maintenance'].includes(value))throw Error('Неизвестная доступность категории');
  const next={...x,status:value==='maintenance'?'soon':value};
  delete next.closureReason;delete next.availabilityMessage;
  if(value==='maintenance'){next.closureReason='maintenance';next.availabilityMessage={...maintenance};}
  return next;
 }
 function effective(rows,id,lang='ru'){
  const nodes=new Map(rows.map(x=>[x.id,x])),path=[],seen=new Set();let x=nodes.get(id);
  if(!x)return {visible:false,canEnter:false,mode:'missing',blockedBy:id,message:''};
  while(x){if(seen.has(x.id)||path.length>20)return {visible:false,canEnter:false,mode:'invalid',blockedBy:id,message:''};seen.add(x.id);path.push(x);if(!x.parentId)break;x=nodes.get(x.parentId);if(!x)return {visible:false,canEnter:false,mode:'invalid',blockedBy:id,message:''};}
  const hidden=path.find(n=>n.status==='hidden');if(hidden)return {visible:false,canEnter:false,mode:'hidden',blockedBy:hidden.id,message:''};
  const closed=path.reverse().find(n=>n.status==='soon');
  if(closed){const value=mode(closed),messages=value==='maintenance'?closed.availabilityMessage||maintenance:soon;return {visible:true,canEnter:false,mode:value,blockedBy:closed.id,message:messages[lang]||messages.ru};}
  return {visible:true,canEnter:true,mode:'active',blockedBy:null,message:''};
 }
 return {mode,validate,apply,effective,maintenance};
});
