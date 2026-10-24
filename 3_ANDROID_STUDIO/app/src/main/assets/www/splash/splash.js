(() => {
  'use strict';
  // Codex replacement supplied by the user, 6.3s including final hold/fade.
  const stage = document.getElementById('stage');
  const composition = stage.querySelector('.composition');
  const duration = 6300;
  let started = false, finished = false;
  let watchdog;
  function complete() {
    if (finished) return;
    finished = true;
    clearTimeout(watchdog);
    window.dispatchEvent(new CustomEvent('faberlic:splash-complete', {
      detail: {duration, sequence: 1}
    }));
    try {
      if (window.FaberlicSplashAndroid?.finishSplash) {
        window.FaberlicSplashAndroid.finishSplash();
      }
    } catch (_error) {}
    // Standalone HTML test uses an isolated iframe, not an Android bridge.
    if (window.parent !== window) {
      try { window.parent.postMessage('faberlic:splash-complete', '*'); } catch (_error) {}
    }
  }
  function begin() {
    if (started) return;
    started = true;
    stage.classList.add('running');
    watchdog = setTimeout(complete, 8000);
  }
  composition.addEventListener('animationend', event => {
    if (event.target === composition &&
        (event.animationName === 'exit' || event.animationName === 'reduced-exit')) complete();
  });
  // Wait for the local image so letter/frame do not animate before it is ready.
  const image = new Image();
  image.onload = begin;
  image.onerror = begin;
  image.src = document.getElementById('original').getAttribute('href');
  setTimeout(begin, 1500); // Never block app launch on a corrupt image.
})();
