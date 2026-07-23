(() => {
  "use strict";

  const config = window.HEBREW_SUPABASE_CONFIG || {};
  const SUPABASE_URL = String(config.url || "").replace(/\/$/, "");
  const PUBLIC_KEY = String(config.publicKey || "");

  const elements = {
    playerScreen: document.querySelector('#playerScreen'),
    playerReference: document.querySelector('#playerReference'),
    playerTitle: document.querySelector('#playerTitle'),
    currentSection: document.querySelector('#currentSectionLabel'),
    audio: document.querySelector('#audioElement'),
    fullPrevious: document.querySelector('#previousSegment'),
    fullPlayPause: document.querySelector('#playPause'),
    fullNext: document.querySelector('#nextSegment'),
    exploreButton: document.querySelector('#exploreVerseButton'),
    exploreMeta: document.querySelector('#exploreVerseMeta'),
    feedTitle: document.querySelector('#visualFeedTitle'),
    feedSubtitle: document.querySelector('#visualFeedSubtitle'),
    feedList: document.querySelector('#visualFeedList'),
    feedEmpty: document.querySelector('#visualFeedEmpty'),
    miniPrevious: document.querySelector('#explorePreviousSegment'),
    miniPlayPause: document.querySelector('#explorePlayPause'),
    miniNext: document.querySelector('#exploreNextSegment'),
    miniTitle: document.querySelector('#exploreNowTitle'),
    miniSection: document.querySelector('#exploreNowSection'),
  };

  if (!elements.audio || !elements.exploreButton || !elements.feedList) return;

  const state = {
    loaded: false,
    loading: null,
    feeds: [],
    cards: [],
    assets: [],
    sources: [],
    tracks: [],
  };

  function headers() {
    const result = { apikey: PUBLIC_KEY };
    if (PUBLIC_KEY.startsWith('eyJ')) result.Authorization = `Bearer ${PUBLIC_KEY}`;
    return result;
  }

  async function fetchRowsOptional(table, query) {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: headers() });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message || `${table} request failed (${response.status})`);
      return Array.isArray(body) ? body : [];
    } catch (error) {
      console.warn(`Optional visual table ${table} is unavailable. Audio remains active.`, error);
      return [];
    }
  }

  function storageUrl(path) {
    if (!path) return '';
    const safePath = String(path).split('/').map(encodeURIComponent).join('/');
    return `${SUPABASE_URL}/storage/v1/object/public/hebrew-media/${safePath}`;
  }

  function assetUrl(asset) {
    if (!asset) return '';
    if (asset.storage_path) return storageUrl(asset.storage_path);
    const appPath = String(asset.app_path || '');
    if (appPath && !appPath.includes('..') && !appPath.startsWith('//')) return appPath;
    const external = String(asset.source_url || '');
    return external.startsWith('https://') ? external : '';
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    })[character]);
  }

  function evidenceLabel(value) {
    return ({
      scripture_direct: 'Directly stated in Scripture',
      historical_background: 'Established historical background',
      archaeological_finding: 'Archaeological finding',
      probable_reconstruction: 'Probable reconstruction',
      scholarly_debate: 'Scholars disagree',
      artistic_illustration: 'Artistic illustration',
    })[value] || 'Artistic illustration';
  }

  function currentReference() {
    return String(elements.playerReference?.textContent || '').trim();
  }

  function currentTrack() {
    const reference = currentReference().toLowerCase();
    return state.tracks.find((track) => String(track.verse_reference || '').trim().toLowerCase() === reference) || null;
  }

  function feedForTrack(track) {
    if (!track) return null;
    return state.feeds.find((feed) => feed.audio_track_id === track.id) ||
      state.feeds.find((feed) => feed.verse_id === track.verse_id) || null;
  }

  function cardsForFeed(feed) {
    if (!feed) return [];
    return state.cards
      .filter((card) => card.feed_id === feed.id && card.status === 'ready')
      .sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
  }

  function assetForCard(card) {
    return state.assets.find((asset) => asset.id === card.primary_asset_id) || null;
  }

  function sourcesForCard(card) {
    return state.sources
      .filter((source) => source.card_id === card.id)
      .sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
  }

  async function loadVisualData() {
    if (state.loaded) return;
    if (state.loading) return state.loading;
    state.loading = Promise.all([
      fetchRowsOptional('hebrew_visual_feeds', 'select=*&is_published=eq.true&status=eq.published&order=published_at.desc'),
      fetchRowsOptional('hebrew_visual_cards', 'select=*&status=eq.ready&order=feed_id.asc,sort_order.asc'),
      fetchRowsOptional('hebrew_visual_assets', 'select=*&status=eq.ready'),
      fetchRowsOptional('hebrew_visual_sources', 'select=*&order=card_id.asc,sort_order.asc'),
      fetchRowsOptional('hebrew_audio_tracks', 'select=id,verse_id,verse_reference,track_title&is_published=eq.true'),
    ]).then(([feeds, cards, assets, sources, tracks]) => {
      Object.assign(state, { feeds, cards, assets, sources, tracks, loaded: true });
    }).finally(() => { state.loading = null; });
    return state.loading;
  }

  function renderHebrewWord(data) {
    return `<div class="structured-visual hebrew-word-visual">
      <div><div class="hebrew" lang="he" dir="rtl">${escapeHtml(data.hebrew || '')}</div>
      <div class="transliteration">${escapeHtml(data.transliteration || '')}</div></div>
      <div class="hebrew-word-grid">
        <div><small>Meaning</small>${escapeHtml(data.meaning || '')}</div>
        <div><small>Strong's</small>${escapeHtml(data.strongs || '')}</div>
        <div><small>Picture</small>${escapeHtml(data.paradigm || '')}</div>
      </div></div>`;
  }

  function renderTimeline(data) {
    const items = Array.isArray(data.items) ? data.items : [];
    return `<div class="structured-visual"><div class="timeline-visual">${items.map((item) => `
      <div class="timeline-item"><div class="timeline-label">${escapeHtml(item.label)}</div>
      <div class="timeline-title">${escapeHtml(item.title)}</div></div>`).join('')}</div></div>`;
  }

  function renderConnection(data) {
    return `<div class="structured-visual"><div class="connection-visual">
      <div class="connection-node">${escapeHtml(data.from || '')}</div><div class="connection-arrow">→</div>
      <div class="connection-node">${escapeHtml(data.to || '')}</div>
      <div class="connection-keyword">${escapeHtml(data.keyword || '')}</div></div></div>`;
  }

  function renderComparison(data) {
    return `<div class="structured-visual"><div class="comparison-visual">
      <div class="comparison-panel"><strong>${escapeHtml(data.left_title || '')}</strong><span>${escapeHtml(data.left_text || '')}</span></div>
      <div class="comparison-panel"><strong>${escapeHtml(data.right_title || '')}</strong><span>${escapeHtml(data.right_text || '')}</span></div>
      </div></div>`;
  }

  function renderStructuredVisual(card) {
    const data = card.visual_data && typeof card.visual_data === 'object' ? card.visual_data : {};
    if (card.card_type === 'hebrew_word') return renderHebrewWord(data);
    if (card.card_type === 'timeline') return renderTimeline(data);
    if (card.card_type === 'scripture_connection') return renderConnection(data);
    if (card.card_type === 'context' || card.card_type === 'comparison') return renderComparison(data);
    return `<div class="structured-visual"><strong>${escapeHtml(card.headline || 'Visual study')}</strong></div>`;
  }

  function renderDetails(card, sources) {
    const sourceItems = sources.map((source) => `<li>${escapeHtml(source.citation_label || source.title || '')}${source.publisher ? ` · ${escapeHtml(source.publisher)}` : ''}</li>`).join('');
    return `<details class="visual-card-details"><summary>Open deeper details</summary>
      <p>${escapeHtml(card.explanation || card.body || card.summary || '')}</p>
      ${sourceItems ? `<ul class="visual-source-list">${sourceItems}</ul>` : ''}
    </details>`;
  }

  function renderVisualFeed(feed) {
    const cards = cardsForFeed(feed);
    elements.feedList.innerHTML = '';
    elements.feedEmpty.hidden = cards.length > 0;
    elements.feedTitle.textContent = feed?.title || `${currentReference() || 'This verse'} visual study`;
    elements.feedSubtitle.textContent = feed?.subtitle || 'The visual study is being prepared. The audio lesson remains available.';

    for (const card of cards) {
      const asset = assetForCard(card);
      const mediaUrl = assetUrl(asset);
      const sources = sourcesForCard(card);
      const article = document.createElement('article');
      article.className = `visual-card visual-card-${card.card_type}`;
      const media = mediaUrl
        ? `<div class="visual-card-media"><img src="${escapeHtml(mediaUrl)}" alt="${escapeHtml(asset?.alt_text || card.alt_text || card.headline || '')}" loading="lazy" decoding="async" /></div>`
        : `<div class="visual-card-media">${renderStructuredVisual(card)}</div>`;
      article.innerHTML = `${media}<div class="visual-card-copy">
        <p class="eyebrow">${escapeHtml(card.category_label || 'Visual study')}</p>
        <h3>${escapeHtml(card.headline || '')}</h3>
        <p class="visual-card-summary">${escapeHtml(card.summary || '')}</p>
        ${card.body ? `<p class="visual-card-body">${escapeHtml(card.body)}</p>` : ''}
        ${card.why_it_matters ? `<div class="why-it-matters"><strong>Why this matters</strong><p>${escapeHtml(card.why_it_matters)}</p></div>` : ''}
        ${renderDetails(card, sources)}
        <footer class="visual-card-footer"><span class="evidence-badge">${escapeHtml(evidenceLabel(card.evidence_level))}</span>
        <span class="source-summary">${escapeHtml(sources[0]?.citation_label || card.source_summary || '')}</span></footer></div>`;
      const image = article.querySelector('img');
      image?.addEventListener('error', () => {
        const mediaContainer = image.closest('.visual-card-media');
        if (mediaContainer) mediaContainer.innerHTML = `<div class="visual-media-fallback">${renderStructuredVisual(card)}</div>`;
      }, { once: true });
      elements.feedList.append(article);
    }
  }

  function showExploreScreen() {
    document.querySelectorAll('[data-screen]').forEach((screen) => {
      const active = screen.dataset.screen === 'explore';
      screen.hidden = !active;
      screen.classList.toggle('is-active', active);
    });
    document.querySelector('.bottom-nav [data-go="library"]')?.classList.remove('is-active');
    history.replaceState(null, '', '#explore');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function updateMiniPlayer() {
    const section = String(elements.currentSection?.textContent || 'Current section').trim();
    const title = String(elements.playerTitle?.textContent || 'Audio lesson').trim();
    elements.miniTitle.textContent = currentReference() ? `${currentReference()} · ${title}` : title;
    elements.miniSection.textContent = section;
    elements.miniPlayPause.textContent = elements.audio.paused ? '▶' : '❚❚';
    elements.miniPlayPause.setAttribute('aria-label', elements.audio.paused ? 'Play' : 'Pause');
    elements.miniPrevious.disabled = Boolean(elements.fullPrevious?.disabled);
    elements.miniNext.disabled = Boolean(elements.fullNext?.disabled);
  }

  async function updateExploreAvailability() {
    if (elements.playerScreen?.hidden || !currentReference()) return;
    elements.exploreButton.hidden = false;
    elements.exploreButton.disabled = false;
    elements.exploreMeta.textContent = 'Audio keeps playing · loading visual study';
    await loadVisualData();
    const cards = cardsForFeed(feedForTrack(currentTrack()));
    elements.exploreMeta.textContent = cards.length
      ? `${cards.length} visual card${cards.length === 1 ? '' : 's'} · audio keeps playing`
      : 'Audio keeps playing · visual study is being prepared';
  }

  async function openExplore() {
    const audioElementBefore = elements.audio;
    await loadVisualData();
    renderVisualFeed(feedForTrack(currentTrack()));
    updateMiniPlayer();
    showExploreScreen();
    if (document.querySelector('#audioElement') !== audioElementBefore) {
      throw new Error('Explore must reuse the existing audio element.');
    }
  }

  async function toggleAudio() {
    if (!elements.audio.src) return;
    if (elements.audio.paused) {
      try { await elements.audio.play(); } catch { /* iOS may require a user gesture */ }
    } else {
      elements.audio.pause();
    }
  }

  elements.exploreButton.addEventListener('click', openExplore);
  elements.miniPlayPause.addEventListener('click', toggleAudio);
  elements.miniPrevious.addEventListener('click', () => elements.fullPrevious?.click());
  elements.miniNext.addEventListener('click', () => elements.fullNext?.click());
  elements.audio.addEventListener('play', updateMiniPlayer);
  elements.audio.addEventListener('pause', updateMiniPlayer);
  elements.audio.addEventListener('ended', updateMiniPlayer);
  elements.currentSection && new MutationObserver(updateMiniPlayer).observe(elements.currentSection, { childList: true, subtree: true });
  elements.playerReference && new MutationObserver(() => { void updateExploreAvailability(); updateMiniPlayer(); }).observe(elements.playerReference, { childList: true, subtree: true });
  elements.playerScreen && new MutationObserver(() => { void updateExploreAvailability(); }).observe(elements.playerScreen, { attributes: true, attributeFilter: ['hidden'] });

  void updateExploreAvailability();
})();
