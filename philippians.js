(() => {
  "use strict";

  const config = window.HEBREW_SUPABASE_CONFIG || {};
  const SUPABASE_URL = String(config.url || "").replace(/\/$/, "");
  const PUBLIC_KEY = String(config.publicKey || "");
  const state = { series: null, lessons: [], albumCard: null };

  const CARD_TOOL_SELECTOR = ".kjv-source-card, .greek-source-card, .study-section-card, .greek-word-card";
  const CARD_NOTE_PREFIX = "philippians-card-note-v1:";
  const speechState = { button: null, chunks: [], index: 0, lang: "en-US" };

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

  function lessonCards() {
    const shell = document.querySelector(".greek-study-shell");
    return shell ? Array.from(shell.querySelectorAll(CARD_TOOL_SELECTOR)) : [];
  }

  function cardText(card) {
    const clone = card.cloneNode(true);
    clone.querySelectorAll(".philippians-card-tools, .philippians-paste-note").forEach((node) => node.remove());
    return String(clone.textContent || "").replace(/\s+/g, " ").trim();
  }

  function cardNoteKey(card) {
    const reference = document.querySelector("#philippiansLessonReference")?.textContent?.trim() || "philippians";
    const cards = lessonCards();
    const index = Math.max(0, cards.indexOf(card));
    const label = card.querySelector("h3, h4, .greek-word")?.textContent?.trim() || "card";
    return CARD_NOTE_PREFIX + reference + ":" + index + ":" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function ensurePasteArea(card) {
    let area = card.querySelector(":scope > .philippians-paste-note");
    if (area) return area;
    area = document.createElement("textarea");
    area.className = "philippians-paste-note";
    area.setAttribute("aria-label", "Pasted notes for this study card");
    area.placeholder = "Paste a note here…";
    area.hidden = true;
    area.addEventListener("input", () => {
      try { localStorage.setItem(cardNoteKey(card), area.value); } catch { /* Local notes are best effort. */ }
    });
    card.append(area);
    return area;
  }

  function syncPasteArea(card) {
    const area = card.querySelector(":scope > .philippians-paste-note");
    if (!area) return;
    let saved = "";
    try { saved = localStorage.getItem(cardNoteKey(card)) || ""; } catch { saved = ""; }
    area.value = saved;
    area.hidden = !saved;
  }

  function flashButtonLabel(button, label, fallback) {
    const original = fallback || button.dataset.defaultLabel || button.textContent;
    button.textContent = label;
    window.setTimeout(() => {
      if (button === speechState.button) return;
      button.textContent = original;
    }, 1100);
  }

  async function copyCard(card, button) {
    const text = cardText(card);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const fallback = document.createElement("textarea");
      fallback.value = text;
      fallback.setAttribute("readonly", "");
      fallback.style.position = "fixed";
      fallback.style.opacity = "0";
      document.body.append(fallback);
      fallback.select();
      document.execCommand("copy");
      fallback.remove();
    }
    flashButtonLabel(button, "Copied ✓", "Copy");
  }

  async function pasteIntoCard(card, button) {
    const area = ensurePasteArea(card);
    let pasted = "";
    try {
      if (navigator.clipboard?.readText) pasted = await navigator.clipboard.readText();
    } catch {
      pasted = "";
    }

    area.hidden = false;
    if (pasted) {
      area.value = area.value ? area.value + "\n" + pasted : pasted;
      area.dispatchEvent(new Event("input", { bubbles: true }));
      flashButtonLabel(button, "Pasted ✓", "Paste");
      return;
    }

    area.placeholder = "Tap here, then use Paste from the iOS menu.";
    area.focus();
    flashButtonLabel(button, "Paste here", "Paste");
  }

  function splitSpeechText(text) {
    const pieces = String(text || "").match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
    const chunks = [];
    let current = "";
    pieces.forEach((piece) => {
      const next = (current + " " + piece.trim()).trim();
      if (next.length > 240 && current) {
        chunks.push(current);
        current = piece.trim();
      } else {
        current = next;
      }
    });
    if (current) chunks.push(current);
    return chunks.length ? chunks : [String(text || "").trim()];
  }

  function resetSpeechButton() {
    if (speechState.button) {
      speechState.button.textContent = speechState.button.dataset.defaultLabel || "Listen";
      speechState.button.classList.remove("is-speaking");
      speechState.button.setAttribute("aria-pressed", "false");
    }
    speechState.button = null;
    speechState.chunks = [];
    speechState.index = 0;
  }

  function stopSpeech() {
    try { window.speechSynthesis?.cancel(); } catch { /* Best effort. */ }
    resetSpeechButton();
  }

  function speakNextChunk() {
    if (!speechState.button || speechState.index >= speechState.chunks.length) {
      resetSpeechButton();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(speechState.chunks[speechState.index]);
    utterance.lang = speechState.lang;
    utterance.rate = speechState.lang.startsWith("el") ? 0.82 : 0.94;
    const voices = window.speechSynthesis?.getVoices?.() || [];
    const prefix = speechState.lang.split("-")[0].toLowerCase();
    const voice = voices.find((item) => String(item.lang || "").toLowerCase().startsWith(prefix));
    if (voice) utterance.voice = voice;
    utterance.onend = () => {
      speechState.index += 1;
      speakNextChunk();
    };
    utterance.onerror = () => resetSpeechButton();
    window.speechSynthesis.speak(utterance);
  }

  function listenToCard(card, button) {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      flashButtonLabel(button, "Unavailable", "Listen");
      return;
    }
    if (speechState.button === button) {
      stopSpeech();
      return;
    }

    stopSpeech();
    const text = cardText(card);
    if (!text) return;
    speechState.button = button;
    speechState.chunks = splitSpeechText(text);
    speechState.index = 0;
    speechState.lang = card.querySelector('[lang="grc"], .greek-word') ? "el-GR" : "en-US";
    button.textContent = "Stop";
    button.classList.add("is-speaking");
    button.setAttribute("aria-pressed", "true");
    speakNextChunk();
  }

  function decorateLessonCards() {
    lessonCards().forEach((card) => {
      let toolbar = card.querySelector(":scope > .philippians-card-tools");
      if (!toolbar) {
        toolbar = document.createElement("div");
        toolbar.className = "philippians-card-tools";
        toolbar.setAttribute("aria-label", "Study card tools");
        toolbar.innerHTML = [
          '<button class="philippians-card-tool" type="button" data-card-action="copy">Copy</button>',
          '<button class="philippians-card-tool" type="button" data-card-action="paste">Paste</button>',
          '<button class="philippians-card-tool" type="button" data-card-action="listen" aria-pressed="false">Listen</button>'
        ].join("");

        toolbar.querySelectorAll("button").forEach((button) => {
          button.dataset.defaultLabel = button.textContent;
        });
        toolbar.querySelector('[data-card-action="copy"]').addEventListener("click", () => copyCard(card, toolbar.querySelector('[data-card-action="copy"]')));
        toolbar.querySelector('[data-card-action="paste"]').addEventListener("click", () => pasteIntoCard(card, toolbar.querySelector('[data-card-action="paste"]')));
        toolbar.querySelector('[data-card-action="listen"]').addEventListener("click", () => listenToCard(card, toolbar.querySelector('[data-card-action="listen"]')));
        card.append(toolbar);
      }
      syncPasteArea(card);
    });
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
    stopSpeech();
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
    decorateLessonCards();
    showScreen("philippians-lesson");
  }

  function openBook() {
    stopSpeech();
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