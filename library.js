(() => {
  "use strict";

  const config = window.HEBREW_SUPABASE_CONFIG || {};
  const SUPABASE_URL = String(config.url || "").replace(/\/$/, "");
  const PUBLIC_KEY = String(config.publicKey || "");
  const PROGRESS_KEY = "hebrew-audio-progress-v1";
  const SPEED_KEY = "hebrew-audio-speed-v1";

  const state = {
    albums: [],
    verses: [],
    lessons: [],
    tracks: [],
    segments: [],
    currentTrack: null,
    currentSegments: [],
    segmentIndex: 0,
    segmentDurations: [],
    seeking: false,
  };

  const elements = {
    screens: Array.from(document.querySelectorAll("[data-screen]")),
    navLibrary: document.querySelector('.bottom-nav [data-go="library"]'),
    status: document.querySelector("#statusCard"),
    albumGrid: document.querySelector("#albumGrid"),
    libraryCounts: document.querySelector("#libraryCounts"),
    continueSection: document.querySelector("#continueSection"),
    continueTitle: document.querySelector("#continueTitle"),
    continueMeta: document.querySelector("#continueMeta"),
    continueButton: document.querySelector("#continueButton"),
    genesisSubtitle: document.querySelector("#genesisSubtitle"),
    genesisStats: document.querySelector("#genesisStats"),
    chapterList: document.querySelector("#chapterList"),
    playerReference: document.querySelector("#playerReference"),
    playerTitle: document.querySelector("#playerTitle"),
    currentSectionLabel: document.querySelector("#currentSectionLabel"),
    previousSegment: document.querySelector("#previousSegment"),
    playPause: document.querySelector("#playPause"),
    nextSegment: document.querySelector("#nextSegment"),
    seek: document.querySelector("#seekControl"),
    elapsed: document.querySelector("#elapsedTime"),
    total: document.querySelector("#totalTime"),
    speed: document.querySelector("#speedControl"),
    segmentCounter: document.querySelector("#segmentCounter"),
    audio: document.querySelector("#audioElement"),
    transcript: document.querySelector("#fullTranscript"),
    jesusTranscript: document.querySelector("#jesusTranscript"),
    openReader: document.querySelector("#openReaderButton"),
  };

  function headers() {
    const result = { apikey: PUBLIC_KEY };
    if (PUBLIC_KEY.startsWith("eyJ")) result.Authorization = `Bearer ${PUBLIC_KEY}`;
    return result;
  }

  async function fetchRows(table, query) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: headers() });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.message || `${table} request failed (${response.status})`);
    return Array.isArray(body) ? body : [];
  }

  function storageUrl(path) {
    if (!path) return "";
    const safePath = String(path).split("/").map(encodeURIComponent).join("/");
    return `${SUPABASE_URL}/storage/v1/object/public/hebrew-media/${safePath}`;
  }

  function setStatus(message, type = "loading") {
    elements.status.textContent = message;
    elements.status.dataset.state = type;
  }

  function showScreen(name, { updateHash = true } = {}) {
    for (const screen of elements.screens) {
      const active = screen.dataset.screen === name;
      screen.hidden = !active;
      screen.classList.toggle("is-active", active);
    }
    elements.navLibrary?.classList.toggle("is-active", name === "library");
    if (updateHash) history.replaceState(null, "", name === "library" ? "#library" : `#${name}`);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function normalizeReference(reference) {
    return String(reference || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function lessonForVerse(verse) {
    const reference = normalizeReference(verse.reference);
    return state.lessons.find((lesson) => {
      const contentReference = normalizeReference(lesson.content?.lesson?.reference || lesson.content?.referenceRange);
      return contentReference === reference || normalizeReference(lesson.title).startsWith(reference);
    }) || null;
  }

  function trackForVerse(verse) {
    const reference = normalizeReference(verse.reference);
    return state.tracks.find((track) => normalizeReference(track.verse_reference) === reference) || null;
  }

  function statusForVerse(verse) {
    const track = trackForVerse(verse);
    if (track?.status === "ready" && track.is_published) return "Listen";
    if (lessonForVerse(verse)) return "Study";
    return "Read";
  }

  function trackTitleForVerse(verse) {
    return trackForVerse(verse)?.track_title || lessonForVerse(verse)?.title || verse.reference;
  }

  function readProgress() {
    try {
      const value = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "null");
      return value && typeof value === "object" ? value : null;
    } catch {
      return null;
    }
  }

  function saveProgress() {
    const track = state.currentTrack;
    const audio = elements.audio;
    if (!track || !state.currentSegments.length) return;
    const payload = {
      trackId: track.id,
      verseReference: track.verse_reference,
      trackTitle: track.track_title,
      segmentIndex: state.segmentIndex,
      position: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
      updatedAt: new Date().toISOString(),
    };
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(payload)); } catch { /* Local progress is best effort. */ }
    renderContinueListening();
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Math.round(Number(seconds) || 0));
    const minutes = Math.floor(safe / 60);
    return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
  }

  function totalDuration() {
    return state.segmentDurations.reduce((total, duration) => total + (Number(duration) || 0), 0);
  }

  function elapsedBeforeCurrent() {
    return state.segmentDurations.slice(0, state.segmentIndex).reduce((total, duration) => total + (Number(duration) || 0), 0);
  }

  function updateSeekUi() {
    if (!state.currentSegments.length || state.seeking) return;
    const current = elapsedBeforeCurrent() + (Number(elements.audio.currentTime) || 0);
    const total = totalDuration();
    elements.seek.max = String(Math.max(total, 1));
    elements.seek.value = String(Math.min(current, Math.max(total, 1)));
    elements.elapsed.textContent = formatTime(current);
    elements.total.textContent = formatTime(total);
  }

  function renderContinueListening() {
    const progress = readProgress();
    const track = progress && state.tracks.find((item) => item.id === progress.trackId && item.status === "ready");
    elements.continueSection.hidden = !track;
    if (!track) return;
    elements.continueTitle.textContent = track.track_title;
    elements.continueMeta.textContent = `${track.verse_reference} · Section ${(progress.segmentIndex || 0) + 1}`;
    elements.continueButton.onclick = () => openTrack(track, progress);
  }

  function renderLibrary() {
    const availableVerses = state.verses.length;
    const readyTracks = state.tracks.filter((track) => track.status === "ready" && track.is_published).length;
    elements.libraryCounts.textContent = `${availableVerses} verses · ${readyTracks} audio lesson${readyTracks === 1 ? "" : "s"}`;
    elements.albumGrid.innerHTML = "";

    const visibleAlbums = state.albums.filter((album) => album.is_visible).sort((a, b) => a.display_order - b.display_order);
    for (const album of visibleAlbums) {
      const card = document.createElement("article");
      card.className = "album-card";
      const artwork = album.artwork_path ? storageUrl(album.artwork_path) : "assets/genesis-cover.webp";
      card.innerHTML = `
        <button type="button" aria-label="Open ${escapeHtml(album.title)}">
          <img src="${escapeAttribute(artwork)}" onerror="this.src='assets/genesis-cover.webp'" alt="${escapeAttribute(album.title)} artwork" />
          <span class="album-card-copy">
            <span class="eyebrow">Bible Album</span>
            <h3>${escapeHtml(album.title)}</h3>
            <p>${escapeHtml(album.subtitle || "")}</p>
            <span class="album-meta">${availableVerses} verses · ${readyTracks} ready</span>
          </span>
        </button>`;
      card.querySelector("button").addEventListener("click", () => {
        renderGenesis(album);
        showScreen("genesis");
      });
      elements.albumGrid.append(card);
    }
    renderContinueListening();
  }

  function renderGenesis(album = state.albums.find((item) => item.book_key === "genesis")) {
    if (album?.subtitle) elements.genesisSubtitle.textContent = album.subtitle;
    const readyTracks = state.tracks.filter((track) => track.status === "ready" && track.is_published).length;
    elements.genesisStats.textContent = `${state.verses.length} available verses · ${readyTracks} audio lesson${readyTracks === 1 ? "" : "s"}`;
    elements.chapterList.innerHTML = "";

    const chapters = new Map();
    for (const verse of state.verses) {
      if (!chapters.has(verse.chapter)) chapters.set(verse.chapter, []);
      chapters.get(verse.chapter).push(verse);
    }

    for (const [chapter, verses] of [...chapters.entries()].sort((a, b) => a[0] - b[0])) {
      const card = document.createElement("section");
      card.className = "chapter-card";
      card.innerHTML = `<h3>Chapter ${chapter}</h3><div class="track-list"></div>`;
      const list = card.querySelector(".track-list");
      verses.sort((a, b) => a.verse_number - b.verse_number).forEach((verse) => {
        const track = trackForVerse(verse);
        const status = statusForVerse(verse);
        const row = document.createElement("article");
        row.className = "track-row";
        row.innerHTML = `
          <span class="track-number">${verse.verse_number}</span>
          <div>
            <h4>${escapeHtml(trackTitleForVerse(verse))}</h4>
            <p>${escapeHtml(verse.reference)}</p>
          </div>
          <button class="track-action ${status.toLowerCase()}" type="button">${status}</button>`;
        row.querySelector("button").addEventListener("click", () => {
          if (status === "Listen" && track) return openTrack(track);
          const index = Math.max(0, state.verses.findIndex((item) => item.id === verse.id));
          window.location.href = `index.html?verse=${index + 1}`;
        });
        list.append(row);
      });
      elements.chapterList.append(card);
    }
  }

  function renderTranscript() {
    elements.transcript.innerHTML = "";
    const jesusSegment = state.currentSegments.find((segment) => segment.segment_type === "see_jesus");
    elements.jesusTranscript.textContent = jesusSegment?.display_transcript || "This section will appear when the audio lesson is ready.";

    state.currentSegments.forEach((segment, index) => {
      const article = document.createElement("article");
      article.className = `transcript-segment${index === state.segmentIndex ? " is-current" : ""}`;
      article.dataset.segmentIndex = String(index);
      const transcript = segment.display_transcript || segment.spoken_text || "";
      const hebrewClass = segment.segment_type.includes("hebrew") ? "hebrew-display" : "";
      article.innerHTML = `<h4>${escapeHtml(segment.label)}</h4><p class="${hebrewClass}">${escapeHtml(transcript)}</p>`;
      article.addEventListener("click", () => loadSegment(index, { autoplay: true }));
      elements.transcript.append(article);
    });
  }

  function updateCurrentSegmentUi() {
    const segment = state.currentSegments[state.segmentIndex];
    if (!segment) return;
    elements.currentSectionLabel.textContent = segment.label;
    elements.segmentCounter.textContent = `Section ${state.segmentIndex + 1} of ${state.currentSegments.length}`;
    elements.previousSegment.disabled = state.segmentIndex === 0;
    elements.nextSegment.disabled = state.segmentIndex >= state.currentSegments.length - 1;
    document.querySelectorAll(".transcript-segment").forEach((item, index) => item.classList.toggle("is-current", index === state.segmentIndex));
  }

  async function loadSegment(index, { autoplay = false, position = 0 } = {}) {
    const segment = state.currentSegments[index];
    if (!segment?.audio_path) return;
    const wasPlaying = !elements.audio.paused;
    state.segmentIndex = index;
    elements.audio.src = storageUrl(segment.audio_path);
    elements.audio.playbackRate = Number(elements.speed.value) || 1;
    elements.audio.load();
    elements.audio.addEventListener("loadedmetadata", () => {
      if (Number.isFinite(elements.audio.duration)) state.segmentDurations[index] = elements.audio.duration;
      elements.audio.currentTime = Math.min(Number(position) || 0, Math.max(0, (elements.audio.duration || 0) - .1));
      updateSeekUi();
    }, { once: true });
    updateCurrentSegmentUi();
    saveProgress();
    if (autoplay || wasPlaying) {
      try { await elements.audio.play(); } catch { /* User gesture may be required. */ }
    }
  }

  async function openTrack(track, progress = null) {
    const segments = state.segments
      .filter((segment) => segment.track_id === track.id && segment.status === "ready" && segment.audio_path)
      .sort((a, b) => a.sort_order - b.sort_order);
    if (!segments.length) {
      setStatus("The lesson record is ready, but its audio files are still being prepared.", "error");
      return;
    }
    state.currentTrack = track;
    state.currentSegments = segments;
    state.segmentIndex = Math.min(Math.max(Number(progress?.segmentIndex) || 0, 0), segments.length - 1);
    state.segmentDurations = segments.map((segment) => Number(segment.duration_seconds) || 0);
    elements.playerReference.textContent = track.verse_reference;
    elements.playerTitle.textContent = track.track_title.replace(/^Genesis\s+\d+:\d+\s*[—-]\s*/i, "");
    elements.openReader.href = `index.html?verse=${Math.max(1, Number(track.verse_reference.split(":")[1]) || 1)}`;
    renderTranscript();
    showScreen("player");
    await loadSegment(state.segmentIndex, { position: progress?.position || 0 });
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  }
  function escapeAttribute(value) { return escapeHtml(value); }

  async function loadLibrary() {
    if (!SUPABASE_URL || !PUBLIC_KEY) throw new Error("Supabase browser configuration is missing.");
    const [albums, verses, lessons, tracks, segments] = await Promise.all([
      fetchRows("hebrew_book_albums", "select=*&is_visible=eq.true&order=display_order.asc"),
      fetchRows("hebrew_verses", "select=id,book,chapter,verse_number,reference,hebrew_text,english_text,context_note&book=eq.Genesis&order=chapter.asc,verse_number.asc"),
      fetchRows("hebrew_lessons", "select=id,slug,title,description,lesson_order,content,is_published&is_published=eq.true&order=lesson_order.asc"),
      fetchRows("hebrew_audio_tracks", "select=*&is_published=eq.true&order=verse_reference.asc"),
      fetchRows("hebrew_audio_segments", "select=*&status=eq.ready&order=track_id.asc,sort_order.asc"),
    ]);
    state.albums = albums;
    state.verses = verses;
    state.lessons = lessons;
    state.tracks = tracks;
    state.segments = segments;
    renderLibrary();
    setStatus("Hebrew library connected.", "ready");

    const hash = location.hash.replace("#", "");
    if (hash === "genesis") {
      renderGenesis();
      showScreen("genesis", { updateHash: false });
    } else {
      showScreen("library", { updateHash: false });
    }
  }

  document.addEventListener("click", (event) => {
    const control = event.target.closest("[data-go]");
    if (!control) return;
    const destination = control.dataset.go;
    if (destination === "genesis") renderGenesis();
    showScreen(destination);
  });

  elements.playPause.addEventListener("click", async () => {
    if (!elements.audio.src) return;
    if (elements.audio.paused) {
      try { await elements.audio.play(); } catch { /* Browser blocked playback. */ }
    } else {
      elements.audio.pause();
    }
  });
  elements.previousSegment.addEventListener("click", () => loadSegment(Math.max(0, state.segmentIndex - 1), { autoplay: true }));
  elements.nextSegment.addEventListener("click", () => loadSegment(Math.min(state.currentSegments.length - 1, state.segmentIndex + 1), { autoplay: true }));
  elements.audio.addEventListener("play", () => { elements.playPause.textContent = "❚❚"; elements.playPause.setAttribute("aria-label", "Pause"); });
  elements.audio.addEventListener("pause", () => { elements.playPause.textContent = "▶"; elements.playPause.setAttribute("aria-label", "Play"); saveProgress(); });
  elements.audio.addEventListener("timeupdate", () => { updateSeekUi(); if (Math.floor(elements.audio.currentTime) % 5 === 0) saveProgress(); });
  elements.audio.addEventListener("ended", () => {
    if (state.segmentIndex < state.currentSegments.length - 1) loadSegment(state.segmentIndex + 1, { autoplay: true });
    else saveProgress();
  });
  elements.audio.addEventListener("error", () => setStatus("This audio section could not be loaded. Try the next section or refresh.", "error"));
  elements.speed.value = localStorage.getItem(SPEED_KEY) || "1";
  elements.speed.addEventListener("change", () => {
    elements.audio.playbackRate = Number(elements.speed.value) || 1;
    try { localStorage.setItem(SPEED_KEY, elements.speed.value); } catch { /* Best effort. */ }
  });
  elements.seek.addEventListener("pointerdown", () => { state.seeking = true; });
  elements.seek.addEventListener("input", () => {
    elements.elapsed.textContent = formatTime(elements.seek.value);
  });
  elements.seek.addEventListener("change", () => {
    const target = Number(elements.seek.value) || 0;
    let running = 0;
    for (let index = 0; index < state.segmentDurations.length; index += 1) {
      const duration = Number(state.segmentDurations[index]) || 0;
      if (target <= running + duration || index === state.segmentDurations.length - 1) {
        const position = Math.max(0, target - running);
        state.seeking = false;
        loadSegment(index, { autoplay: !elements.audio.paused, position });
        return;
      }
      running += duration;
    }
    state.seeking = false;
  });

  loadLibrary().catch((error) => {
    console.error("Hebrew library failed to load.", error);
    setStatus(`The audio library could not connect: ${error.message}`, "error");
  });
})();
