(() => {
  const chapterReaderStyles = `
    body.chapter-reader-app-style {
      background: #242b2b;
      color: #e8eceb;
    }

    body.chapter-reader-app-style .reader-focus-topbar {
      width: min(100%, 920px);
      margin: 0 auto;
      padding: 14px 18px 10px;
      border: 0;
      border-radius: 0;
      background: rgba(36, 43, 43, 0.94);
      box-shadow: none;
    }

    body.chapter-reader-app-style .reader-focus-topbar .eyebrow {
      color: #9da7a6;
      font-size: 0.7rem;
      letter-spacing: 0.08em;
    }

    body.chapter-reader-app-style .reader-focus-topbar h1 {
      color: #f1f4f3;
      font-size: clamp(1.18rem, 4vw, 1.8rem);
      letter-spacing: -0.03em;
    }

    body.chapter-reader-app-style .reader-menu-button {
      min-height: 38px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
      color: #f1f4f3;
    }

    body.chapter-reader-app-style .unified-main {
      min-height: 100vh;
      background: #242b2b;
    }

    body.chapter-reader-app-style .reader-shell {
      width: min(100%, 920px);
      min-height: calc(100vh - 70px);
      margin: 0 auto;
      gap: 0;
    }

    body.chapter-reader-app-style .reader {
      min-height: calc(100vh - 70px);
      border: 0;
      background: transparent;
      box-shadow: none;
    }

    body.chapter-reader-app-style .reader-focus-header,
    body.chapter-reader-app-style .verse-tabs,
    body.chapter-reader-app-style .reader-status,
    body.chapter-reader-app-style .notes-band,
    .chapter-scroll-mode .reader-lines {
      display: none !important;
    }

    .bible-verse-card.chapter-scroll-mode {
      min-height: auto;
      padding: 0 18px 72px;
      align-content: start;
      border: 0;
      background: transparent;
      box-shadow: none;
    }

    .chapter-scroll-mode .verse-meta {
      display: none;
    }

    .chapter-reader {
      width: 100%;
      display: grid;
      gap: 34px;
    }

    .chapter-reader-toolbar {
      position: sticky;
      top: 69px;
      z-index: 12;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 10px;
      padding: 12px 0 18px;
      background: linear-gradient(180deg, #242b2b 74%, rgba(36, 43, 43, 0));
    }

    .chapter-reader-tabs {
      display: inline-flex;
      max-width: 100%;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
    }

    .chapter-reader-tab {
      min-height: 38px;
      display: inline-flex;
      align-items: center;
      padding: 0 18px;
      color: #e8eceb;
      font-weight: 850;
      white-space: nowrap;
    }

    .chapter-reader-tab + .chapter-reader-tab {
      border-inline-start: 1px solid rgba(255, 255, 255, 0.12);
    }

    .chapter-reader-tools {
      display: inline-flex;
      gap: 10px;
      align-items: center;
      color: #c1c8c7;
      font-size: 0.92rem;
      font-weight: 750;
    }

    .chapter-reader-note {
      width: 100%;
      margin: 0;
      color: #9da7a6;
      font-size: 0.9rem;
      line-height: 1.45;
    }

    .chapter-verse-list {
      display: grid;
      gap: clamp(32px, 7vw, 54px);
    }

    .chapter-verse {
      display: grid;
      gap: 10px;
      padding: 4px 0 6px;
      border-radius: 20px;
      scroll-margin-top: 138px;
    }

    .chapter-verse.is-active {
      background: radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.07), transparent 62%);
    }

    .chapter-interlinear-line {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-start;
      align-items: flex-start;
      gap: clamp(12px, 3.3vw, 22px) clamp(8px, 2vw, 16px);
      direction: rtl;
      color: #e8eceb;
      font-family: "SBL Hebrew", "Ezra SIL", "Noto Sans Hebrew", "Times New Roman", serif;
      text-align: right;
    }

    .chapter-verse-number {
      align-self: flex-start;
      margin: 0 0.1em 0.35em;
      color: #d7dddc;
      font-family: "Segoe UI", Arial, sans-serif;
      font-size: clamp(0.88rem, 2.3vw, 1.08rem);
      font-weight: 850;
      line-height: 1;
      opacity: 0.9;
    }

    .chapter-word-token {
      min-width: max-content;
      max-width: min(44vw, 220px);
      display: inline-grid;
      justify-items: center;
      align-content: start;
      gap: 2px;
      padding: 0 2px 5px;
      border: 0;
      border-bottom: 2px solid transparent;
      border-radius: 8px;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font-family: inherit;
      transition:
        background 160ms ease,
        border-color 160ms ease,
        transform 160ms ease;
    }

    .chapter-word-token:hover,
    .chapter-word-token:focus-visible {
      background: rgba(255, 255, 255, 0.07);
      border-bottom-color: rgba(255, 255, 255, 0.38);
      outline: none;
      transform: translateY(-1px);
    }

    .chapter-word-token.active {
      background: rgba(255, 255, 255, 0.09);
      border-bottom-color: #f1f4f3;
    }

    .chapter-word-hebrew {
      direction: rtl;
      color: #e8eceb;
      font-size: clamp(2.15rem, 8.6vw, 4.6rem);
      font-weight: 500;
      line-height: 1.04;
      letter-spacing: 0.01em;
    }

    .chapter-word-transliteration,
    .chapter-word-gloss {
      max-width: 100%;
      font-family: "Segoe UI", Arial, sans-serif;
      text-align: center;
      overflow-wrap: anywhere;
    }

    .chapter-word-transliteration {
      color: #b9c2c1;
      font-size: clamp(0.72rem, 2.4vw, 0.98rem);
      font-weight: 800;
      line-height: 1.08;
    }

    .chapter-word-gloss {
      color: #8f9998;
      font-size: clamp(0.66rem, 2.1vw, 0.86rem);
      font-weight: 700;
      line-height: 1.12;
    }

    .chapter-verse-summary {
      margin: 8px 0 0;
      color: #aeb7b6;
      font-size: clamp(0.88rem, 2.5vw, 1rem);
      font-weight: 650;
      line-height: 1.5;
      text-align: left;
    }

    .bible-reader-home.hide-transliteration .chapter-word-transliteration,
    .bible-reader-home.hide-english .chapter-word-gloss,
    .bible-reader-home.hide-english .chapter-verse-summary {
      display: none;
    }

    body.chapter-reader-app-style .word-study-panel,
    body.chapter-reader-app-style .practice-panel {
      border-color: rgba(255, 255, 255, 0.18);
      background: rgba(255, 253, 250, 0.98);
    }

    @media (max-width: 720px) {
      body.chapter-reader-app-style .reader-focus-topbar {
        padding-left: 14px;
        padding-right: 14px;
      }

      .bible-verse-card.chapter-scroll-mode {
        padding-left: 14px;
        padding-right: 14px;
      }

      .chapter-reader-toolbar {
        top: 63px;
      }

      .chapter-reader-tab {
        padding: 0 14px;
      }

      .chapter-reader-tools {
        width: 100%;
        justify-content: space-between;
      }

      .chapter-interlinear-line {
        gap: 14px 10px;
      }
    }

    @media (max-width: 420px) {
      .chapter-word-token {
        max-width: 46vw;
      }

      .chapter-word-hebrew {
        font-size: clamp(2.05rem, 11.5vw, 3.45rem);
      }
    }
  `;

  function installStyles() {
    if (document.querySelector("#chapterReaderV2Styles")) return;
    const style = document.createElement("style");
    style.id = "chapterReaderV2Styles";
    style.textContent = chapterReaderStyles;
    document.head.append(style);
  }

  function getChapterRangeLabel() {
    if (!Array.isArray(verses) || !verses.length) return "Genesis 1";
    const first = verses[0]?.reference || "Genesis 1:1";
    const last = verses[verses.length - 1]?.reference || first;
    return first === last ? first : `${first} through ${last}`;
  }

  function getChapterTitle() {
    const first = verses?.[0]?.reference || "Genesis 1:1";
    return first.split(":").at(0) || "Genesis 1";
  }

  function getVerseNumber(verse, fallback) {
    const reference = verse?.reference || "";
    return reference.includes(":") ? reference.split(":").at(-1) : String(fallback + 1);
  }

  function getTotalWordCount() {
    return (verses || []).reduce((total, verse) => total + (verse.words?.length || 0), 0);
  }

  function openWordStudyOverlay() {
    const panel = document.querySelector("#wordStudyPanel");
    const scrim = document.querySelector("#wordStudyScrim");
    if (panel) panel.hidden = false;
    if (scrim) scrim.hidden = false;
    document.body.classList.add("word-study-open");
  }

  function createWordToken(word, verseIndex, wordIndex) {
    const button = document.createElement("button");
    const isActiveWord = verseIndex === activeVerseIndex && wordIndex === activeWordIndex;
    button.type = "button";
    button.className = `chapter-word-token${isActiveWord ? " active" : ""}`;
    button.setAttribute("aria-label", `${word.hebrew || "Hebrew word"}, ${word.transliteration || "transliteration coming soon"}, ${word.gloss || "meaning coming soon"}`);
    button.dataset.verseIndex = String(verseIndex);
    button.dataset.wordIndex = String(wordIndex);

    const hebrew = document.createElement("span");
    hebrew.className = "chapter-word-hebrew";
    hebrew.dir = "rtl";
    hebrew.lang = "he";
    hebrew.textContent = word.hebrew || "?";

    const transliteration = document.createElement("span");
    transliteration.className = "chapter-word-transliteration";
    transliteration.textContent = word.transliteration || "…";

    const gloss = document.createElement("span");
    gloss.className = "chapter-word-gloss";
    gloss.textContent = word.gloss || "meaning soon";

    button.append(hebrew, transliteration, gloss);
    return button;
  }

  function createVerseBlock(verse, verseIndex) {
    const article = document.createElement("article");
    article.className = `chapter-verse${verseIndex === activeVerseIndex ? " is-active" : ""}`;
    article.id = `chapterVerse-${verseIndex}`;
    article.setAttribute("aria-label", verse.reference || `Verse ${verseIndex + 1}`);

    const line = document.createElement("div");
    line.className = "chapter-interlinear-line";
    line.dir = "rtl";
    line.lang = "he";
    line.setAttribute("aria-label", `${verse.reference || "Verse"} Hebrew with transliteration and English between lines`);

    const verseNumber = document.createElement("span");
    verseNumber.className = "chapter-verse-number";
    verseNumber.textContent = getVerseNumber(verse, verseIndex);
    line.append(verseNumber);

    (verse.words || []).forEach((word, wordIndex) => {
      line.append(createWordToken(word, verseIndex, wordIndex));
    });

    const summary = document.createElement("p");
    summary.className = "chapter-verse-summary";
    summary.textContent = verse.english || "English meaning coming soon.";

    article.append(line, summary);
    return article;
  }

  function ensureChapterReader() {
    const verseCard = document.querySelector(".bible-verse-card");
    if (!verseCard) return null;

    document.body.classList.add("chapter-reader-app-style");
    verseCard.classList.add("chapter-scroll-mode");

    let chapterReader = document.querySelector("#chapterReader");
    if (chapterReader) return chapterReader;

    chapterReader = document.createElement("section");
    chapterReader.id = "chapterReader";
    chapterReader.className = "chapter-reader";
    chapterReader.setAttribute("aria-label", "Scrollable interlinear Genesis chapter reader");
    verseCard.append(chapterReader);
    return chapterReader;
  }

  function createToolbar(rangeLabel, totalWordCount) {
    const toolbar = document.createElement("header");
    toolbar.className = "chapter-reader-toolbar";

    const tabs = document.createElement("div");
    tabs.className = "chapter-reader-tabs";
    tabs.setAttribute("aria-label", "Current book and chapter");

    const bookTab = document.createElement("span");
    bookTab.className = "chapter-reader-tab";
    bookTab.textContent = "בראשית";

    const chapterTab = document.createElement("span");
    chapterTab.className = "chapter-reader-tab";
    chapterTab.textContent = getChapterTitle();

    tabs.append(bookTab, chapterTab);

    const tools = document.createElement("div");
    tools.className = "chapter-reader-tools";
    tools.innerHTML = `<span>${verses.length} verses</span><span>${totalWordCount} words</span>`;

    const note = document.createElement("p");
    note.className = "chapter-reader-note";
    note.textContent = `${rangeLabel}. Hebrew is primary. Transliteration and English sit underneath so your eye can read, pronounce, and understand in one flow.`;

    toolbar.append(tabs, tools, note);
    return toolbar;
  }

  function renderChapterReader() {
    installStyles();

    const chapterReader = ensureChapterReader();
    if (!chapterReader || !Array.isArray(verses) || !verses.length) return;

    const rangeLabel = getChapterRangeLabel();
    const totalWordCount = getTotalWordCount();
    const verseReference = document.querySelector("#verseReference");
    const wordCount = document.querySelector("#wordCount");

    if (verseReference) verseReference.textContent = rangeLabel;
    if (wordCount) wordCount.textContent = `${verses.length} verses · ${totalWordCount} Hebrew words`;

    chapterReader.innerHTML = "";

    const list = document.createElement("div");
    list.className = "chapter-verse-list";
    verses.forEach((verse, verseIndex) => list.append(createVerseBlock(verse, verseIndex)));

    chapterReader.append(createToolbar(rangeLabel, totalWordCount), list);
  }

  function selectChapterWord(event) {
    const token = event.target.closest(".chapter-word-token");
    if (!token) return;

    const verseIndex = Number(token.dataset.verseIndex);
    const wordIndex = Number(token.dataset.wordIndex);
    if (!Number.isInteger(verseIndex) || !Number.isInteger(wordIndex)) return;

    activeVerseIndex = verseIndex;
    activeWordIndex = wordIndex;
    renderVerse();
    renderWord();
    window.requestAnimationFrame(openWordStudyOverlay);
  }

  const originalRenderVerse = renderVerse;
  renderVerse = function renderVerseWithChapterReader() {
    originalRenderVerse();
    renderChapterReader();
  };

  document.addEventListener("click", selectChapterWord);
  render();
})();
