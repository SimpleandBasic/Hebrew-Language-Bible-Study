(() => {
  'use strict';

  const config = window.HEBREW_SUPABASE_CONFIG || {};
  const supabaseUrl = String(config.url || '').replace(/\/$/, '');
  const publicKey = String(config.publicKey || '');
  const deepLinkReference = new URLSearchParams(window.location.search).get('listen');

  function headers() {
    const result = { apikey: publicKey };
    if (publicKey.startsWith('eyJ')) result.Authorization = `Bearer ${publicKey}`;
    return result;
  }

  function normalize(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    })[character]);
  }

  function waitFor(getValue, timeoutMs = 9000) {
    const started = Date.now();
    return new Promise((resolve, reject) => {
      const check = () => {
        const value = getValue();
        if (value) return resolve(value);
        if (Date.now() - started > timeoutMs) return reject(new Error('The devotional library took too long to open.'));
        window.setTimeout(check, 90);
      };
      check();
    });
  }

  function copyText(value) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value).then(() => true).catch(() => false);
    const field = document.createElement('textarea');
    field.value = value;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.append(field);
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    return Promise.resolve(copied);
  }

  async function shareLibrary(statusElement) {
    const url = `${window.location.origin}/`;
    const payload = {
      title: 'Hebrew Scripture Devotional',
      text: 'Free Hebrew Bible audio devotionals for listening slowly and studying deeply.',
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(payload);
        if (statusElement) statusElement.textContent = 'Share sheet opened.';
      } else if (await copyText(url)) {
        if (statusElement) statusElement.textContent = 'Library link copied.';
      } else {
        window.prompt('Copy this devotional link:', url);
      }
    } catch (error) {
      if (error?.name !== 'AbortError' && statusElement) statusElement.textContent = 'The share link could not be opened.';
    }
  }

  async function openReference(reference, { updateUrl = true } = {}) {
    const target = normalize(reference);
    if (!target) return false;

    const albumButton = await waitFor(() => document.querySelector('#albumGrid article button'));
    albumButton.click();

    const rows = await waitFor(() => {
      const items = Array.from(document.querySelectorAll('#chapterList .track-row'));
      return items.length ? items : null;
    });
    const row = rows.find((item) => normalize(item.querySelector('p')?.textContent) === target);
    if (!row) throw new Error(`${reference} is not in the public library yet.`);
    const action = row.querySelector('button');
    if (!action || normalize(action.textContent) !== 'listen') throw new Error(`${reference} is not ready to listen to yet.`);
    action.click();

    if (updateUrl) {
      window.setTimeout(() => {
        const url = new URL('/library.html', window.location.origin);
        url.searchParams.set('listen', reference);
        url.hash = 'player';
        history.replaceState(null, '', url);
      }, 120);
    }
    return true;
  }

  async function loadLatestTrack() {
    if (!supabaseUrl || !publicKey) return null;
    const query = new URLSearchParams({
      select: 'id,verse_reference,track_title,total_duration_seconds,published_at',
      status: 'eq.ready',
      is_published: 'eq.true',
      order: 'published_at.desc',
      limit: '1',
    });
    const response = await fetch(`${supabaseUrl}/rest/v1/hebrew_audio_tracks?${query}`, { headers: headers() });
    if (!response.ok) return null;
    const rows = await response.json().catch(() => []);
    return Array.isArray(rows) ? rows[0] || null : null;
  }

  function formatDuration(seconds) {
    const minutes = Math.max(1, Math.round((Number(seconds) || 0) / 60));
    return `${minutes} min`;
  }

  function installTopActions() {
    const topbar = document.querySelector('.topbar');
    if (!topbar || document.querySelector('.listener-top-actions')) return;
    const readLink = topbar.querySelector('.read-link');
    const actions = document.createElement('div');
    actions.className = 'listener-top-actions';

    const share = document.createElement('button');
    share.type = 'button';
    share.className = 'listener-top-button';
    share.textContent = 'Share';
    const shareStatus = document.createElement('span');
    shareStatus.className = 'sr-only';
    shareStatus.setAttribute('role', 'status');
    share.addEventListener('click', () => shareLibrary(shareStatus));

    const support = document.createElement('a');
    support.className = 'listener-top-button listener-support-link';
    support.href = '/support.html';
    support.textContent = 'Support';

    if (readLink) actions.append(readLink);
    actions.append(share, support, shareStatus);
    topbar.append(actions);
  }

  async function installLatestCard() {
    const library = document.querySelector('#libraryScreen');
    if (!library || document.querySelector('#latestDevotional')) return;
    const latest = await loadLatestTrack();
    if (!latest) return;

    const card = document.createElement('section');
    card.id = 'latestDevotional';
    card.className = 'latest-devotional-card';
    card.innerHTML = `
      <div>
        <p class="eyebrow">Latest Devotional</p>
        <h3>${escapeHtml(latest.track_title.replace(/^Genesis\s+\d+:\d+\s*[—-]\s*/i, ''))}</h3>
        <p>${escapeHtml(latest.verse_reference)} · ${formatDuration(latest.total_duration_seconds)}</p>
      </div>
      <button type="button" class="latest-listen-button" aria-label="Listen to ${escapeHtml(latest.verse_reference)}">▶ Listen</button>`;
    card.querySelector('button').addEventListener('click', () => openReference(latest.verse_reference).catch((error) => console.error(error)));

    const continueCard = document.querySelector('#continueSection');
    if (continueCard) continueCard.insertAdjacentElement('afterend', card);
    else library.querySelector('.hero-copy')?.insertAdjacentElement('afterend', card);
  }

  function installSupportCard() {
    const library = document.querySelector('#libraryScreen');
    if (!library || document.querySelector('#supportFreeDevotional')) return;
    const card = document.createElement('section');
    card.id = 'supportFreeDevotional';
    card.className = 'support-devotional-card';
    card.innerHTML = `
      <p class="eyebrow">Keep It Free</p>
      <h3>Support this devotional</h3>
      <p>Every sermon is free. If these resources help you grow in your faith, you can help support the work of creating more.</p>
      <a href="/support.html">Support the work</a>`;
    library.append(card);
  }

  function findNextRow(reference) {
    const rows = Array.from(document.querySelectorAll('#chapterList .track-row'));
    const currentIndex = rows.findIndex((row) => normalize(row.querySelector('p')?.textContent) === normalize(reference));
    if (currentIndex < 0) return null;
    return rows.slice(currentIndex + 1).find((row) => normalize(row.querySelector('button')?.textContent) === 'listen') || null;
  }

  function installNextDevotional() {
    const player = document.querySelector('#playerScreen .player-shell');
    if (!player || document.querySelector('#nextDevotionalButton')) return;
    const button = document.createElement('button');
    button.id = 'nextDevotionalButton';
    button.type = 'button';
    button.className = 'next-devotional-button';
    button.hidden = true;
    button.textContent = 'Next devotional →';

    const shareRow = document.querySelector('.episode-share-row');
    if (shareRow) shareRow.insertAdjacentElement('afterend', button);
    else document.querySelector('#audioElement')?.insertAdjacentElement('afterend', button);

    const refresh = () => {
      const reference = document.querySelector('#playerReference')?.textContent || '';
      const nextRow = findNextRow(reference);
      button.hidden = !nextRow;
      button.dataset.nextReference = nextRow?.querySelector('p')?.textContent?.trim() || '';
    };

    button.addEventListener('click', () => {
      const nextReference = button.dataset.nextReference;
      if (!nextReference) return;
      openReference(nextReference).catch((error) => console.error(error));
    });

    document.addEventListener('click', (event) => {
      if (event.target.closest('.track-action')) window.setTimeout(refresh, 180);
    });
    const playerReference = document.querySelector('#playerReference');
    if (playerReference) new MutationObserver(refresh).observe(playerReference, { childList: true, subtree: true, characterData: true });
    refresh();
  }

  function installSharedContinuationNote() {
    const player = document.querySelector('#playerScreen .player-shell');
    if (!player || document.querySelector('#playerSupportLink')) return;
    const link = document.createElement('a');
    link.id = 'playerSupportLink';
    link.className = 'player-support-link';
    link.href = '/support.html';
    link.textContent = 'This devotional stays free · Support the work';
    const reader = document.querySelector('#openReaderButton');
    if (reader) reader.insertAdjacentElement('afterend', link);
    else player.append(link);
  }

  async function openDeepLink() {
    if (!deepLinkReference) return;
    try {
      await openReference(deepLinkReference, { updateUrl: true });
    } catch (error) {
      console.error('Deep-linked devotional could not open.', error);
    }
  }

  function install() {
    installTopActions();
    installSupportCard();
    installNextDevotional();
    installSharedContinuationNote();
    installLatestCard().catch((error) => console.error('Latest devotional card failed.', error));
    openDeepLink();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
