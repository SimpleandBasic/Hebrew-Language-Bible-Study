(() => {
  "use strict";

  const config = window.HEBREW_SUPABASE_CONFIG || {};
  const SUPABASE_URL = String(config.url || "").replace(/\/$/, "");
  const PUBLIC_KEY = String(config.publicKey || "");
  const state = { series: null, lessons: [], albumCard: null };

  function headers() {
    const result = { apikey: PUBLIC_KEY };
    if (PUBLIC_KEY.startsWith("eyJ")) result.Authorization = "Bearer " + PUBLIC_KEY;
    return result;
  }

  async function fetchRows(table, query) {
    const response = await fetch(SUPABASE_URL + "/rest/v1/" + table + "?" + query, { headers: headers() });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.message || table + " request failed (" + response.status + ")");
    return Array.isArray(body) ? body : [];
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    })[character]);
  }

  function showScreen(name) {
    document.querySelectorAll("[data-screen]").forEach((screen) => {
      const active = screen.dataset.screen === name;
      screen.hidden = !active;
      screen.classList.toggle("is-active", active);
    });
    document.querySelector('.bottom-nav [data-go="library"]')?.classList.toggle("is-active", name === "library");
    history.replaceState(null, "", "#" + name);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function lessonPayload(lesson) {
    return lesson?.lesson_payload && typeof lesson.lesson_payload === "object" ? lesson.lesson_payload : {};
  }

  function updateAlbumMeta() {
    if (!state.albumCard) return;
    const count = state.lessons.length;
    const meta = state.albumCard.querySelector("[data-philippians-meta]");
    if (meta) meta.textContent = count + " Greek lesson" + (count === 1 ? "" : "s") + " · KJV + Greek";
  }

  function appendAlbumCard(container) {
    if (!container || container.querySelector("#philippiansAlbumCard")) return;
    const card = document.createElement("article");
    card.className = "album-card philippians-album-card";
    card.id = "philippiansAlbumCard";
    card.innerHTML = [
      '<button type="button" aria-label="Open Philippians">',
      '<img src="assets/philippians-cover.svg?v=20260827-1" alt="Philippians Greek New Testament study artwork" />',
      '<span class="album-card-copy">',
      '<span class="eyebrow">New Testament · Greek</span>',
      '<h3>Philippians</h3>',
      '<p>Joy, partnership, humility, and life in Christ — studied through the Greek New Testament.</p>',
      '<span class="album-meta" data-philippians-meta>Loading Greek lessons…</span>',
      '</span>',
      '</button>'
    ].join("");
    card.querySelector("button").addEventListener("click", openBook);
    container.append(card);
    state.albumCard = card;
    updateAlbumMeta();
  }

  function renderBook() {
    const subtitle = document.querySelector("#philippiansSubtitle");
    const stats = document.querySelector("#philippiansStats");
    const list = document.querySelector("#philippiansChapterList");
    if (subtitle && state.series?.subtitle) subtitle.textContent = state.series.subtitle;
    if (stats) stats.textContent = state.lessons.length + " published Greek lesson" + (state.lessons.length === 1 ? "" : "s") + " · KJV teaching text";

    if (!list) return;
    list.innerHTML = "";
    if (!state.lessons.length) {
      list.innerHTML = '<section class="chapter-card"><p class="helper-note">The Philippians study lane is connected, but no published lesson is available yet.</p></section>';
      return;
    }

    const chapters = new Map();
    state.lessons.forEach((lesson) => {
      if (!chapters.has(lesson.chapter)) chapters.set(lesson.chapter, []);
      chapters.get(lesson.chapter).push(lesson);
    });

    [...chapters.entries()].sort((a, b) => a[0] - b[0]).forEach(([chapter, lessons]) => {
      const card = document.createElement("section");
      card.className = "chapter-card";
      card.innerHTML = '<h3>Chapter ' + chapter + '</h3><div class="track-list"></div>';
      const trackList = card.querySelector(".track-list");
      lessons.sort((a, b) => a.verse_number - b.verse_number).forEach((lesson) => {
        const row = document.createElement("article");
        row.className = "track-row";
        row.innerHTML = [
          '<span class="track-number">' + lesson.verse_number + '</span>',
          '<div><h4>' + escapeHtml(lesson.title) + '</h4><p>' + escapeHtml(lesson.reference) + '</p></div>',
          '<button class="track-action study" type="button">Study</button>'
        ].join("");
        row.querySelector("button").addEventListener("click", () => openLesson(lesson));
        trackList.append(row);
      });
      list.append(card);
    });
  }

  function renderWords(words) {
    const grid = document.querySelector("#philippiansGreekWords");
    if (!grid) return;
    const items = Array.isArray(words) ? words : [];
    grid.innerHTML = items.map((word) => [
      '<article class="greek-word-card">',
      '<span class="greek-word" lang="grc">' + escapeHtml(word.greek || word.word || "") + '</span>',
      '<span class="greek-translit">' + escapeHtml(word.transliteration || "") + '</span>',
      '<dl>',
      '<div><dt>Meaning here</dt><dd>' + escapeHtml(word.meaning_here || word.semantic_range || "") + '</dd></div>',
      '<div><dt>Form</dt><dd>' + escapeHtml(word.morphology || "") + '</dd></div>',
      '<div><dt>Strong\'s</dt><dd>' + escapeHtml(word.strongs || "—") + '</dd></div>',
      '<div><dt>Why it matters</dt><dd>' + escapeHtml(word.note || word.syntax || "") + '</dd></div>',
      '</dl>',
      '</article>'
    ].join("")).join("");
  }

  function renderContext(research) {
    const host = document.querySelector("#philippiansContext");
    if (!host) return;
    const historical = Array.isArray(research?.historical_background) ? research.historical_background : [];
    const literary = research?.literary_context && typeof research.literary_context === "object" ? research.literary_context : {};
    const items = [];
    Object.entries(literary).forEach(([key, value]) => {
      if (typeof value === "string" && value.trim()) items.push({ title: key.replaceAll("_", " "), text: value });
    });
    historical.forEach((item) => {
      if (typeof item === "string") items.push({ title: "Historical background", text: item });
      else items.push({ title: item.claim || "Historical background", text: item.sermon_use || item.note || "" });
    });
    host.innerHTML = items.slice(0, 8).map((item) =>
      '<div class="context-item"><strong>' + escapeHtml(item.title) + '</strong><span>' + escapeHtml(item.text) + '</span></div>'
    ).join("");
  }

  function renderCrossReferences(references) {
    const host = document.querySelector("#philippiansCrossRefs");
    if (!host) return;
    const items = Array.isArray(references) ? references : [];
    host.innerHTML = items.map((item) => [
      '<div class="crossref-item">',
      '<strong>' + escapeHtml(item.reference || "") + '</strong>',
      '<span>' + escapeHtml(item.connection || "") + '</span>',
      item.guardrail ? '<span class="source-note">Guardrail: ' + escapeHtml(item.guardrail) + '</span>' : "",
      '</div>'
    ].join("")).join("");
  }

  function openLesson(lesson) {
    const payload = lessonPayload(lesson);
    const research = lesson.research_dossier || {};
    document.querySelector("#philippiansLessonReference").textContent = lesson.reference;
    document.querySelector("#philippiansLessonTitle").textContent = lesson.title;
    document.querySelector("#philippiansLessonDescription").textContent = lesson.description || payload.simple_summary || "";
    document.querySelector("#philippiansGreekText").textContent = lesson.source_text;
    document.querySelector("#philippiansTransliteration").textContent = lesson.transliteration || payload.transliteration || "";
    document.querySelector("#philippiansKjvText").textContent = lesson.english_text;
    document.querySelector("#philippiansGreekSource").textContent = lesson.source_text_attribution || "SBL Greek New Testament";
    document.querySelector("#philippiansCentralTruth").textContent = payload.central_truth || payload.big_idea || "";
    document.querySelector("#philippiansSermon").textContent = lesson.sermon_transcript || payload.transcript || "";
    document.querySelector("#philippiansJesus").textContent = payload.did_you_know_see_jesus_here?.see_jesus_here || "";
    document.querySelector("#philippiansJesusGuardrail").textContent = payload.did_you_know_see_jesus_here?.guardrail || "";
    document.querySelector("#philippiansApplication").textContent = payload.practical_reflection || "";
    document.querySelector("#philippiansPrayer").textContent = payload.prayer || "";
    document.querySelector("#philippiansMemoryPhrase").textContent = payload.memory_phrase || "";
    renderWords(payload.key_words || research.greek_observations);
    renderContext(research);
    renderCrossReferences(payload.cross_references || research.cross_references);
    showScreen("philippians-lesson");
  }

  function openBook() {
    renderBook();
    showScreen("philippians");
  }

  async function load() {
    if (!SUPABASE_URL || !PUBLIC_KEY) return;
    try {
      const [seriesRows, lessons] = await Promise.all([
        fetchRows("scripture_devotional_series", "select=*&book_key=eq.philippians&is_visible=eq.true&limit=1"),
        fetchRows("scripture_devotional_lessons", "select=*&book_key=eq.philippians&is_published=eq.true&order=chapter.asc,verse_number.asc"),
      ]);
      state.series = seriesRows[0] || null;
      state.lessons = lessons;
      updateAlbumMeta();
      if (location.hash === "#philippians") openBook();
    } catch (error) {
      console.warn("Philippians study failed to load.", error);
      if (state.albumCard) {
        const meta = state.albumCard.querySelector("[data-philippians-meta]");
        if (meta) meta.textContent = "Greek study temporarily unavailable";
      }
    }
  }

  document.addEventListener("click", (event) => {
    const control = event.target.closest("[data-philippians-go]");
    if (!control) return;
    if (control.dataset.philippiansGo === "book") openBook();
  });

  window.PHILIPPIANS_STUDY = { appendAlbumCard, openBook, openLesson };
  load();
})();