/* Video format contract. Duration, URL shape and thumbnail sizes are never used.
   YouTube Embed does not expose intrinsic media dimensions through its supported API. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.FFVideoFormat=factory();})(typeof window==='object'?window:globalThis,()=>{
 const aliases={auto:'auto',portrait:'portrait',landscape:'landscape',square:'square',vertical:'portrait',horizontal:'landscape'};
 const mode=value=>typeof value==='string'&&Object.prototype.hasOwnProperty.call(aliases,value)?aliases[value]:'auto';
 const validRatio=value=>typeof value==='number'&&Number.isFinite(value)&&value>=.1&&value<=10;
 function resolve(video={}){const selected=mode(video.videoOrientation??video.orientation);if(selected!=='auto')return {mode:selected,ratio:({portrait:9/16,landscape:16/9,square:1})[selected],source:'manual'};if(validRatio(video.aspectRatio))return {mode:selected,ratio:video.aspectRatio,source:'saved-ratio'};return {mode:selected,ratio:16/9,source:'fallback'};}
 function label(video,lang='ru'){const value=mode(video?.orientation);return ({ru:{auto:'Автоматически',portrait:'Вертикальное · 9:16',landscape:'Горизонтальное · 16:9',square:'Квадратное · 1:1'},tj:{auto:'Худкор',portrait:'Амудӣ · 9:16',landscape:'Уфуқӣ · 16:9',square:'Мураббаъ · 1:1'},uz:{auto:'Автоматик',portrait:'Вертикал · 9:16',landscape:'Горизонтал · 16:9',square:'Квадрат · 1:1'}}[lang]||{auto:'Auto',portrait:'9:16',landscape:'16:9',square:'1:1'})[value];}
 return Object.freeze({mode,resolve,validRatio,label,values:Object.freeze(Object.keys(aliases))});
});
