/* SYNC-06: remote YouTube thumbnails. No images included in APK or saved to Firebase. */
(function(){
  'use strict';
  const validId=/^[A-Za-z0-9_-]{11}$/;
  function url(video,banner=false){
    if(!video)return '';
    const raw=(video.youtubeIds&&video.youtubeIds[currentLang])||video.youtubeId||'';
    const id=String(raw).trim();
    return validId.test(id)?'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg':'';
  }
  function image(video, cssClass, priority){
    const src=url(video,cssClass==='bannerThumbnail');
    if(!src)return '';
    const cls=String(cssClass||'youtubeThumb').replace(/[^a-zA-Z0-9_ -]/g,'');
    const loading=priority?'eager':'lazy';
    // Missing/offline images fall back to the original fixed background of each card.
    return '<img class="'+cls+'" src="'+src+'" alt="" loading="'+loading+'" decoding="async" onerror="this.style.display=\'none\'">';
  }
  window.FFCovers={url,image};
})();
