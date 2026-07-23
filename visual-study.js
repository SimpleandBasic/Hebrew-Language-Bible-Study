(() => {
  "use strict";

  const config = window.HEBREW_SUPABASE_CONFIG || {};
  const baseUrl = String(config.url || "").replace(/\/$/, "");
  const publicKey = String(config.publicKey || "");
  const evidenceLabels = Object.freeze({
    scripture_direct: "Directly stated in Scripture",
    historical_background: "Established historical background",
    archaeological_finding: "Archaeological finding",
    probable_reconstruction: "Probable reconstruction",
    scholarly_debate: "Scholars disagree",
    artistic_illustration: "Artistic illustration",
  });

  const state = { feeds: [], cards: [], assets: [], sources: [], verses: [], loadError: false };
  const $ = (selector) => document.querySelector(selector);
  const el = {
    audio: $("#audioElement"),
    exploreButton: $("#exploreVerseButton"),
    exploreMeta: $("#exploreVerseMeta"),
    playerReference: $("#playerReference"),
    playerTitle: $("#playerTitle"),
    sectionLabel: $("#currentSectionLabel"),
    segmentCounter: $("#segmentCounter"),
    previous: $("#previousSegment"),
    playPause: $("#playPause"),
    next: $("#nextSegment"),
    title: $("#visualFeedTitle"),
    subtitle: $("#visualFeedSubtitle"),
    list: $("#visualFeedList"),
    loading: $("#visualFeedLoading"),
    empty: $("#visualFeedEmpty"),
    emptyTitle: $("#visualFeedEmptyTitle"),
    emptyMessage: $("#visualFeedEmptyMessage"),
    error: $("#visualFeedError"),
    miniPrevious: $("#explorePreviousSegment"),
    miniPlay: $("#explorePlayPause"),
    miniNext: $("#exploreNextSegment"),
    miniTitle: $("#exploreNowTitle"),
    miniSection: $("#exploreNowSection"),
    dialog: $("#visualCardDialog"),
    dialogClose: $("#visualCardDialogClose"),
    dialogMedia: $("#visualCardDialogMedia"),
    dialogEyebrow: $("#visualCardDialogEyebrow"),
    dialogTitle: $("#visualCardDialogTitle"),
    dialogSummary: $("#visualCardDialogSummary"),
    dialogBody: $("#visualCardDialogBody"),
    dialogWhy: $("#visualCardDialogWhy"),
    dialogEvidence: $("#visualCardDialogEvidence"),
    dialogRequirement: $("#visualCardDialogRequirement"),
    dialogSources: $("#visualCardDialogSources"),
  };

  if (!el.audio || !el.exploreButton) return;

  function headers() {
    const result = { apikey: publicKey };
    if (publicKey.startsWith("eyJ")) result.Authorization = `Bearer ${publicKey}`;
    return result;
  }

  async function rows(table, query) {
    const response = await fetch(`${baseUrl}/rest/v1/${table}?${query}`, { headers: headers() });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.message || `${table} failed (${response.status})`);
    return Array.isArray(body) ? body : [];
  }

  async function loadVisualData() {
    if (!baseUrl || !publicKey) throw new Error("Supabase browser configuration is missing.");
    try {
      const [feeds, cards, assets, sources, verses] = await Promise.all([
        rows("hebrew_visual_feeds", "select=*&is_published=eq.true&status=eq.published&order=published_at.desc"),
        rows("hebrew_visual_cards", "select=*&status=eq.ready&order=feed_id.asc,sort_order.asc"),
        rows("hebrew_visual_assets", "select=*&status=eq.ready"),
        rows("hebrew_visual_sources", "select=*&order=card_id.asc,sort_order.asc"),
        rows("hebrew_verses", "select=id,reference"),
      ]);
      Object.assign(state, { feeds, cards, assets, sources, verses });
    } catch (error) {
      state.loadError = true;
      console.warn("Visual study tables are unavailable. Audio remains active.", error);
    }
    updateExploreButton();
  }

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[char]);

  function normalizeReference(value) {
    return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function currentReference() {
    return String(el.playerReference?.textContent || "").trim();
  }

  function feedForCurrentVerse() {
    const wanted = normalizeReference(currentReference());
    const verse = state.verses.find((item) => normalizeReference(item.reference) === wanted);
    return verse ? state.feeds.find((feed) => feed.verse_id === verse.id) || null : null;
  }

  function cardsFor(feed) {
    return feed ? state.cards.filter((card) => card.feed_id === feed.id).sort((a, b) => a.sort_order - b.sort_order) : [];
  }

  function assetFor(card) {
    return card.primary_asset_id ? state.assets.find((asset) => asset.id === card.primary_asset_id) || null : null;
  }

  function sourcesFor(card) {
    return state.sources.filter((source) => source.card_id === card.id).sort((a, b) => a.sort_order - b.sort_order);
  }

  function storageUrl(path) {
    const safe = String(path || "").split("/").map(encodeURIComponent).join("/");
    return safe ? `${baseUrl}/storage/v1/object/public/hebrew-media/${safe}` : "";
  }

  function assetUrl(asset) {
    if (asset?.storage_path) return storageUrl(asset.storage_path);
    const source = String(asset?.source_url || "").trim();
    return /^(assets\/|\/|https:\/\/)/.test(source) ? source : "";
  }

  function evidenceLabel(value) {
    return evidenceLabels[value] || evidenceLabels.probable_reconstruction;
  }

  function structuredVisual(card) {
    const data = card.structured_data || {};
    if (data.layout === "hebrew_word") return `<div class="structured-visual hebrew-word-visual"><div><div class="hebrew">${escapeHtml(data.hebrew)}</div><div class="transliteration">${escapeHtml(data.transliteration)}</div><div class="hebrew-word-grid"><div><small>Meaning</small>${escapeHtml(data.gloss)}</div><div><small>Root</small>${escapeHtml(data.root)}</div><div><small>Strong's</small>${escapeHtml(data.strongs)}</div></div></div></div>`;
    if (data.layout === "timeline") return `<div class="structured-visual"><div class="timeline-visual">${(data.items || []).map((item) => `<div class="timeline-item"><span class="timeline-label">${escapeHtml(item.label)}</span><span class="timeline-title">${escapeHtml(item.title)}</span></div>`).join("")}</div></div>`;
    if (data.layout === "connection") return `<div class="structured-visual"><div class="connection-visual"><div class="connection-node">${escapeHtml(data.from)}</div><div class="connection-arrow">→</div><div class="connection-node">${escapeHtml(data.to)}</div><div class="connection-keyword">${escapeHtml(data.keyword)}</div></div></div>`;
    if (data.layout === "comparison") return `<div class="structured-visual"><div class="comparison-visual"><div class="comparison-panel"><strong>${escapeHtml(data.left?.label)}</strong><span>${escapeHtml(data.left?.role)}</span></div><div class="comparison-panel"><strong>${escapeHtml(data.right?.label)}</strong><span>${escapeHtml(data.right?.role)}</span></div></div></div>`;
    const items = data.places || data.people || data.items || [];
    const extraClass = data.layout === "map" ? " map-template" : data.layout === "family_tree" ? " family-tree-template" : "";
    if (["map", "family_tree", "diagram"].includes(data.layout)) return `<div class="structured-visual"><div class="diagram-template${extraClass}">${items.map((item) => `<div class="diagram-node"><small>${escapeHtml(item.region || item.generation || item.label)}</small><strong>${escapeHtml(item.name || item.title || item.label)}</strong><span>${escapeHtml(item.relationship || "")}</span></div>`).join("")}</div></div>`;
    return `<div class="structured-visual"><span class="eyebrow">Visual study card</span></div>`;
  }

  function media(card, asset, dialog = false) {
    const url = assetUrl(asset);
    const className = dialog ? "dialog-media-inner" : "visual-card-media";
    if (url) return `<div class="${className}"><img loading="lazy" decoding="async" src="${escapeHtml(url)}" alt="${escapeHtml(asset?.alt_text || card.title)}" /></div>`;
    return `<div class="${className}">${structuredVisual(card)}</div>`;
  }

  function setVisualState(name) {
    el.loading.hidden = name !== "loading";
    el.list.hidden = name !== "ready";
    el.empty.hidden = name !== "empty";
    el.error.hidden = name !== "error";
  }

  function showScreen(name) {
    document.querySelectorAll("[data-screen]").forEach((screen) => {
      const active = screen.dataset.screen === name;
      screen.hidden = !active;
      screen.classList.toggle("is-active", active);
    });
    history.replaceState(null, "", `#${name}`);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function updateMiniPlayer() {
    el.miniTitle.textContent = `${currentReference()} · ${el.playerTitle?.textContent || "Audio lesson"}`;
    el.miniSection.textContent = `${el.sectionLabel?.textContent || "Current section"}${el.segmentCounter?.textContent ? ` · ${el.segmentCounter.textContent}` : ""}`;
    el.miniPrevious.disabled = Boolean(el.previous?.disabled);
    el.miniNext.disabled = Boolean(el.next?.disabled);
    el.miniPlay.textContent = el.audio.paused ? "▶" : "❚❚";
    el.miniPlay.setAttribute("aria-label", el.audio.paused ? "Play" : "Pause");
  }

  function updateExploreButton() {
    const feed = feedForCurrentVerse();
    const count = cardsFor(feed).length;
    el.exploreButton.hidden = false;
    el.exploreMeta.textContent = feed ? `${count} visual card${count === 1 ? "" : "s"} · audio keeps playing` : state.loadError ? "Visual study unavailable · audio remains active" : "Visual study is being prepared · audio keeps playing";
  }

  function renderFeed() {
    const feed = feedForCurrentVerse();
    const cards = cardsFor(feed);
    el.title.textContent = feed?.title || `Explore ${currentReference()}`;
    el.subtitle.textContent = feed?.subtitle || "The visual study is built separately so the audio lesson never has to wait.";
    el.list.innerHTML = "";
    if (!feed || !cards.length) {
      if (state.loadError) setVisualState("error");
      else {
        el.emptyTitle.textContent = `${currentReference() || "This verse"} is next in the visual workshop.`;
        el.emptyMessage.textContent = "The audio lesson is complete. The visual cards have not been published yet.";
        setVisualState("empty");
      }
      return;
    }
    cards.forEach((card) => {
      const asset = assetFor(card);
      const sources = sourcesFor(card);
      const article = document.createElement("article");
      article.className = `visual-card visual-card-${card.card_type}`;
      article.innerHTML = `${media(card, asset)}<div class="visual-card-copy"><p class="eyebrow">${escapeHtml(card.eyebrow || card.card_type)}</p><h3>${escapeHtml(card.title)}</h3><p class="visual-card-summary">${escapeHtml(card.summary)}</p>${card.body ? `<p class="visual-card-body">${escapeHtml(card.body)}</p>` : ""}${card.why_it_matters ? `<div class="why-it-matters"><strong>Why this matters</strong><p>${escapeHtml(card.why_it_matters)}</p></div>` : ""}<footer class="visual-card-footer"><span class="evidence-badge">${escapeHtml(evidenceLabel(card.evidence_level))}</span><span class="source-summary">${escapeHtml(sources[0]?.citation_label || card.source_summary || "")}</span></footer><button class="visual-card-details" type="button">Open deeper details</button></div>`;
      article.querySelector(".visual-card-details").addEventListener("click", () => openDetails(card));
      el.list.append(article);
    });
    setVisualState("ready");
  }

  function openDetails(card) {
    const sources = sourcesFor(card);
    el.dialogMedia.innerHTML = media(card, assetFor(card), true);
    el.dialogEyebrow.textContent = card.eyebrow || card.card_type.replaceAll("_", " ");
    el.dialogTitle.textContent = card.title;
    el.dialogSummary.textContent = card.summary || "";
    el.dialogBody.textContent = card.body || "";
    el.dialogBody.hidden = !card.body;
    el.dialogWhy.innerHTML = card.why_it_matters ? `<strong>Why this matters</strong><p>${escapeHtml(card.why_it_matters)}</p>` : "";
    el.dialogWhy.hidden = !card.why_it_matters;
    el.dialogEvidence.textContent = evidenceLabel(card.evidence_level);
    el.dialogRequirement.textContent = card.is_required ? "Required foundation card" : "Enhancement card";
    el.dialogSources.innerHTML = sources.length ? `<h3>Sources</h3>${sources.map((source) => `<div class="dialog-source"><strong>${escapeHtml(source.source_title)}</strong><span>${escapeHtml([source.source_author, source.source_publisher, source.source_year].filter(Boolean).join(" · "))}</span>${source.citation_label ? `<span>${escapeHtml(source.citation_label)}</span>` : ""}${source.source_note ? `<span>${escapeHtml(source.source_note)}</span>` : ""}</div>`).join("")}` : "";
    el.dialogSources.hidden = !sources.length;
    if (typeof el.dialog.showModal === "function") el.dialog.showModal();
    else el.dialog.setAttribute("open", "");
  }

  function closeDetails() {
    if (typeof el.dialog.close === "function") el.dialog.close();
    else el.dialog.removeAttribute("open");
  }

  el.exploreButton.addEventListener("click", () => {
    updateMiniPlayer();
    setVisualState("loading");
    showScreen("explore");
    requestAnimationFrame(renderFeed);
  });
  el.miniPrevious.addEventListener("click", () => el.previous.click());
  el.miniNext.addEventListener("click", () => el.next.click());
  el.miniPlay.addEventListener("click", () => el.playPause.click());
  el.audio.addEventListener("play", updateMiniPlayer);
  el.audio.addEventListener("pause", updateMiniPlayer);
  el.audio.addEventListener("ended", updateMiniPlayer);
  el.dialogClose.addEventListener("click", closeDetails);
  el.dialog.addEventListener("click", (event) => { if (event.target === el.dialog) closeDetails(); });

  new MutationObserver(() => { updateExploreButton(); updateMiniPlayer(); }).observe(document.body, {
    subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["disabled", "hidden"],
  });

  updateExploreButton();
  updateMiniPlayer();
  loadVisualData();
})();
