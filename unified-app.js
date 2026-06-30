(() => {
  const navButtons = Array.from(document.querySelectorAll(".unified-nav-button[data-section]"));
  const panels = Array.from(document.querySelectorAll("[data-section-panel]"));
  let lessonsLoaded = false;

  function setActiveSection(sectionName, updateHash = true) {
    const targetName = sectionName || "study";

    navButtons.forEach((button) => {
      const isActive = button.dataset.section === targetName;
      button.classList.toggle("is-active", isActive);
      if (isActive) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });

    panels.forEach((panel) => {
      const isActive = panel.dataset.sectionPanel === targetName;
      panel.hidden = !isActive;
      panel.classList.toggle("is-active", isActive);
    });

    if (targetName === "lessons") {
      loadLessonsOnce();
    }

    if (updateHash) {
      history.replaceState(null, "", `#${targetName}`);
    }
  }

  navButtons.forEach((button) => {
    button.addEventListener("click", () => setActiveSection(button.dataset.section));
  });

  const initialSection = window.location.hash.replace("#", "");
  if (["study", "flashcards", "listen", "lessons"].includes(initialSection)) {
    setActiveSection(initialSection, false);
  }

  function getHeaders(publicKey) {
    const headers = { apikey: publicKey };
    if (publicKey.startsWith("eyJ") || publicKey.startsWith("sb_")) {
      headers.Authorization = `Bearer ${publicKey}`;
    }
    return headers;
  }

  async function readJson(url, headers) {
    const response = await fetch(url, { headers });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const message = body?.message || body?.hint || response.statusText;
      throw new Error(`${response.status}: ${message}`);
    }
    return body;
  }

  function parseMaybeJson(value) {
    if (!value) return null;
    if (typeof value === "object") return value;
    if (typeof value !== "string") return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function buildReference(lesson, lessonJson) {
    if (lesson.reference) return lesson.reference;
    if (lessonJson?.reference) return lessonJson.reference;
    const book = lesson.book || lessonJson?.book;
    const chapter = lesson.chapter || lessonJson?.chapter;
    const verseStart = lesson.verse_start || lessonJson?.verse_start;
    const verseEnd = lesson.verse_end || lessonJson?.verse_end;

    if (book && chapter && verseStart && verseEnd && verseStart !== verseEnd) {
      return `${book} ${chapter}:${verseStart}-${verseEnd}`;
    }
    if (book && chapter && verseStart) {
      return `${book} ${chapter}:${verseStart}`;
    }
    if (book && chapter) {
      return `${book} ${chapter}`;
    }
    return "Hebrew Lesson";
  }

  function pickSummary(lessonJson) {
    if (!lessonJson) return "Open this lesson from the connector workflow to review the full teaching bundle.";
    return (
      lessonJson.summary ||
      lessonJson.main_idea ||
      lessonJson.big_idea ||
      lessonJson.what_this_means ||
      lessonJson.lesson_summary ||
      lessonJson.lesson?.summary ||
      lessonJson.lesson?.main_idea ||
      "This lesson is published and ready for review."
    );
  }

  function countItems(value) {
    const parsed = parseMaybeJson(value) || value;
    if (Array.isArray(parsed)) return parsed.length;
    if (parsed && typeof parsed === "object") {
      if (Array.isArray(parsed.cards)) return parsed.cards.length;
      if (Array.isArray(parsed.flashcards)) return parsed.flashcards.length;
      if (Array.isArray(parsed.items)) return parsed.items.length;
    }
    return 0;
  }

  function renderLessons(lessons) {
    const grid = document.querySelector("#lessonsGrid");
    if (!grid) return;

    if (!lessons.length) {
      grid.innerHTML = `<div class="lesson-empty-state">No published lessons are available yet. When you approve a connector-created lesson, it will appear here.</div>`;
      return;
    }

    grid.innerHTML = lessons.map((lesson) => {
      const lessonJson = parseMaybeJson(lesson.lesson_json);
      const flashcardCount = countItems(lesson.flashcards_json || lessonJson?.flashcards);
      const verseCount = countItems(lesson.verses || lessonJson?.verses);
      const reference = buildReference(lesson, lessonJson);
      const summary = pickSummary(lessonJson);
      const updated = lesson.updated_at ? new Date(lesson.updated_at).toLocaleDateString() : "Recently updated";

      return `
        <article class="lesson-card">
          <p class="lesson-reference">${escapeHtml(reference)}</p>
          <h3>${escapeHtml(lesson.title || lessonJson?.title || "Untitled Hebrew Lesson")}</h3>
          <p class="lesson-summary">${escapeHtml(summary)}</p>
          <ul class="lesson-meta-list" aria-label="Lesson details">
            <li>${flashcardCount} flashcards</li>
            <li>${verseCount} verses</li>
            <li>${escapeHtml(updated)}</li>
          </ul>
        </article>
      `;
    }).join("");
  }

  async function loadLessonsOnce() {
    if (lessonsLoaded) return;
    lessonsLoaded = true;

    const status = document.querySelector("#lessonStatus");
    const config = window.HEBREW_SUPABASE_CONFIG || {};
    const baseUrl = String(config.url || "").replace(/\/$/, "");
    const publicKey = String(config.publicKey || "");

    if (!baseUrl || !publicKey) {
      if (status) status.textContent = "Lessons need the Supabase browser config before they can load.";
      renderLessons([]);
      return;
    }

    if (status) status.textContent = "Connecting to the lesson library...";

    try {
      const headers = getHeaders(publicKey);
      const select = "*";
      const url = `${baseUrl}/rest/v1/hebrew_lessons?select=${encodeURIComponent(select)}&is_published=eq.true&order=updated_at.desc&limit=20`;
      const rows = await readJson(url, headers);
      renderLessons(Array.isArray(rows) ? rows : []);
      if (status) status.textContent = `Loaded ${Array.isArray(rows) ? rows.length : 0} published lessons.`;
    } catch (error) {
      console.warn("Hebrew lessons load failed.", error?.message || error);
      if (status) status.textContent = "The lesson library is connected, but published lessons could not load in the browser yet.";
      renderLessons([]);
    }
  }
})();
