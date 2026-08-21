(() => {
  'use strict';

  // The public devotional is for listeners, not production controls.
  document.querySelector('.manual-generate-card')?.setAttribute('hidden', '');

  if (!document.querySelector('link[data-listener-experience]')) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = '/listener-experience.css?v=20260821-1';
    stylesheet.dataset.listenerExperience = 'true';
    document.head.append(stylesheet);
  }

  if (!document.querySelector('script[data-listener-experience]')) {
    const script = document.createElement('script');
    script.src = '/listener-experience.js?v=20260821-1';
    script.defer = true;
    script.dataset.listenerExperience = 'true';
    document.head.append(script);
  }
})();
