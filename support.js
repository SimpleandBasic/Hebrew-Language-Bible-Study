(() => {
  'use strict';
  const config = window.HEBREW_SUPPORT_CONFIG || {};
  const link = document.querySelector('#donationLink');
  const pending = document.querySelector('#donationPending');
  if (!link || !pending) return;

  const url = String(config.donationUrl || '').trim();
  let validUrl = false;
  try {
    validUrl = new URL(url).protocol === 'https:';
  } catch {
    validUrl = false;
  }

  if (!validUrl) return;
  link.href = url;
  link.textContent = String(config.donationLabel || 'Give to support this work');
  link.hidden = false;
  pending.hidden = true;
})();
