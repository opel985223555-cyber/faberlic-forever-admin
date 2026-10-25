/* Issuance is separate from device activation. All records are admin-only. */
(()=>{const A=window.FFAdmin;
 const millis=v=>v?.toMillis?.()||Number(v)||0;
 A.promoDistribution={
  millis,
  stats(codes,distribution){const known=new Set(distribution.map(x=>x.id)),single=codes.filter(x=>x.kind==='single');return {total:single.length,issued:single.filter(x=>known.has(x.id)||x.state==='used').length,remaining:single.filter(x=>x.state==='free'&&x.enabled&&!known.has(x.id)).length,activated:single.filter(x=>x.state==='used').length,waiting:single.filter(x=>known.has(x.id)&&x.state==='free').length,blocked:single.filter(x=>!x.enabled).length};},
  groups(distribution){const groups=new Map();for(const row of distribution){if(!groups.has(row.groupId))groups.set(row.groupId,{id:row.groupId,ids:[],at:row.issuedAt});const group=groups.get(row.groupId);group.ids.push(row.id);if(millis(row.issuedAt)<millis(group.at))group.at=row.issuedAt;}return [...groups.values()].sort((a,b)=>millis(b.at)-millis(a.at)||b.id.localeCompare(a.id));},
  text(ids,secrets){const map=new Map(secrets.map(x=>[x.id,x.code]));if(!ids.length||ids.some(id=>!map.has(id)))throw Error('Не все коды доступны для копирования. Обновите список.');return ids.map(id=>map.get(id)).join('\n');}
 };
})();
