(() => {
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "unified-app.css?v=20260630-1";
  document.head.appendChild(css);

  const buttons = Array.from(document.querySelectorAll(".unified-nav-button"));
  const panels = Array.from(document.querySelectorAll("[data-section-panel]"));
  let loadedLessons = false;

  function showSection(name, updateHash = true) {
    const activeName = name || "study";

    buttons.forEach((button) => {
      const active = button.dataset.section === activeName;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });

    panels.forEach((panel) => {
      const active = panel.dataset.sectionPanel === activeName;
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
    });

    if (activeName === "lessons") loadLessons();
    if (updateHash) history.replaceState(null, "", `#${activeName}`);
  }

  buttons.forEach((button) => button.addEventListener("click", () => showSection(button.dataset.section)));

  const initial = window.location.hash.replace("#", "");
  if (["study", "flashcards", "listen", "lessons"].includes(initial)) showSection(initial, false);

  function html(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function parse(value) {
    if (!value) return null;
    if (typeof value === "object") return value;
    try { return JSON.parse(value); } catch { return null; }
  }

  function count(value) {
    const data = parse(value) || value;
    if (Array.isArray(data)) return data.length;
    if (data?.cards) return data.cards.length;
    if (data?.flashcards) return data.flashcards.length;
    if (data?.items) return data.items.length;
    return 0;
  }

  function reference(row, json) {
    if (row.reference || json?.reference) return row.reference || json.reference;
    const book = row.book || json?.book;
    const chapter = row.chapter || json?.chapter;
    const start = row.verse_start || json?.verse_start;
    const end = row.verse_end || json?.verse_end;
    if (book && chapter && start && end && start !== end) return `${book} ${chapter}:${start}-${end}`;
    if (book && chapter && start) return `${book} ${chapter}:${start}`;
    if (book && chapter) return `${book} ${chapter}`;
    return "Hebrew Lesson";
  }

  function render(rows) {
    const grid = document.querySelector("#lessonsGrid");
    if (!grid) return;
    if (!rows.length) {
      grid.innerHTML = '<div class="lesson-empty-state">No published lessons are available yet. When you approve a connector-created lesson, it will appear here.</div>';
      return;
    }

    grid.innerHTML = rows.map((row) => {
      const json = parse(row.lesson_json);
      const summary = json?.summary || json?.main_idea || json?.big_idea || json?.what_this_means || json?.lesson?.summary || "This lesson is published and ready for review.";
      const updated = row.updated_at ? new Date(row.updated_at).toLocaleDateString() : "Recently updated";
      return `<article class="lesson-card"><p class="lesson-reference">${html(reference(row, json))}</p><h3>${html(row.title || json?.title || "Untitled Hebrew Lesson")}</h3><p class="lesson-summary">${html(summary)}</p><ul class="lesson-meta-list"><li>${count(row.flashcards_json || json?.flashcards)} flashcards</li><li>${count(row.verses || json?.verses)} verses</li><li>${html(updated)}</li></ul></article>`;
    }).join("");
  }

  async function loadLessons() {
    if (loadedLessons) return;
    loadedLessons = true;
    const status = document.querySelector("#lessonStatus");
    const config = window.HEBREW_SUPABASE_CONFIG || {};
    const base = String(config.url || "").replace(/\/$/, "");
    const key = String(config.publicKey || "");
    if (!base || !key) {
      if (status) status.textContent = "Lessons need the Supabase browser config before they can load.";
      render([]);
      return;
    }

    if (status) status.textContent = "Connecting to the lesson library...";
    try {
      const headers = { apikey: key, Authorization: `Bearer ${key}` };
      const url = `${base}/rest/v1/hebrew_lessons?select=*&is_published=eq.true&order=updated_at.desc&limit=20`;
      const response = await fetch(url, { headers });
      const rows = await response.json();
      if (!response.ok) throw new Error(rows?.message || response.statusText);
      render(Array.isArray(rows) ? rows : []);
      if (status) status.textContent = `Loaded ${Array.isArray(rows) ? rows.length : 0} published lessons.`;
    } catch (error) {
      console.warn("Hebrew lessons load failed.", error);
      if (status) status.textContent = "The lesson library is connected, but published lessons could not load in the browser yet.";
      render([]);
    }
  }
})();
