/* Deterministic local topic icons. No network, thumbnail changes or content writes. */
(function(root){'use strict';
 const norm=x=>String(x||'').toLocaleLowerCase('ru').replace(/ё/g,'е');
 const topics=[
  ['brand:instagram',/instagram|инстаграм/],['brand:telegram',/telegram|телеграм/],['brand:tiktok',/tik\s?tok|тикток/],['brand:whatsapp',/whats\s?app|ватсап/],['brand:youtube',/youtube|ютуб/],['brand:facebook',/facebook|фейсбук/],
  ['lucide:clapperboard',/capcut|капкат|монтаж|видеоредакт|таҳрири видео|видеони таҳрир/],
  ['lucide:user-plus',/регистрац|зарегистр|нович|бақайдгир|сабти ном|навкор|рўйхат|рӯйхат|янги ҳамкор/],
  ['lucide:shopping-cart',/заказ|корзин|фармоиш|сабад|буюртма|сават/],
  ['lucide:wallet',/баланс|кошел|ҳамён|тавозун|ҳамен|ҳисоб|тўлов/],
  ['lucide:users',/приглас|партнер|команд|даъват|шарик|даста|ҳамкор|жамоа/],
  ['lucide:brain',/(?:^|[^\p{L}\p{N}])(?:ai|ии)(?=$|[^\p{L}\p{N}])|искусственн.*интеллект|нейросет|зеҳни сунъӣ|сунъий интеллект/iu],
  ['lucide:megaphone',/продаж|маркетинг|фурӯш|сотув|реклам/],['heart',/здоров|саломат|соғлиқ/]
 ];
 function resolve(lesson,nodes=[]){const registry=root.FFIcons;
  if(lesson.iconMode==='manual'&&registry.has(lesson.iconId))return {id:lesson.iconId,source:'manual'};
  for(const field of ['title','description']){const text=norm(lesson[field]);for(const [id,re] of topics)if(registry.has(id)&&re.test(text))return {id,source:field};}
  const id=lesson.leafCategoryId||(lesson.learningPath?.group&&lesson.learningPath?.topic?lesson.learningPath.group+'__'+lesson.learningPath.topic:null)||lesson.categoryId||lesson.category;let node=nodes.find(n=>n.id===id),seen=new Set();
  while(node&&!seen.has(node.id)){seen.add(node.id);if(registry.has(node.icon))return {id:node.icon,source:'category'};node=nodes.find(n=>n.id===node.parentId);}
  return {id:registry.has('lucide:video')?'lucide:video':registry.defaultId,source:'default'};
 }
 root.FFLessonIcons=Object.freeze({resolve});
})(globalThis);
