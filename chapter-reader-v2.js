(() => {
  const chapterReaderStyles = `
    .bible-verse-card.chapter-scroll-mode {
      min-height: auto;
      align-content: start;
      padding-top: 22px;
      padding-bottom: 34px;
    }

    .chapter-scroll-mode .verse-meta {
      margin-bottom: 14px;
    }

    .chapter-scroll-mode .reader-lines {
      display: none;
    }

    .chapter-reader {
      width: 100%;
      display: grid;
      gap: 22px;
    }

    .chapter-reader-heading {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: flex-end;
      padding-bottom: 14px;
      border-bottom: 1px solid rgba(217, 209, 196, 0.84);
    }

    .chapter-reader-heading h3 {
      margin: 0;
      color: var(--ink);
      font-size: clamp(1.25rem, 4vw, 2rem);
      line-height: 1.1;
    }

    .chapter-reader-note {
      max-width: 420px;
      margin: 0;
      color: var(--muted);
      font-size: 0.92rem;
      font-weight: 650;
      line-height: 1.45;
      text-align: right;
    }

    .chapter-verse-list {
      display: grid;
      gap: 20px;
    }

    .chapter-verse {
      display: grid;
      gap: 12px;
      padding: clamp(14px, 3vw, 22px);
      border: 1px solid rgba(217, 209, 196, 0.92);
      border-radius: 24px;
      background: rgba(255, 253, 250, 0.74);
      box-shadow: 0 12px 32px rgba(89, 61, 40, 0.07);
      scroll-margin-top: 120px;
    }

    .chapter-verse.is-active {
      border-color: rgba(47, 118, 109, 0.52);
      background:
        linear-gradient(135deg, rgba(47, 118, 109, 0.08), transparent 46%),
        rgba(255, 253, 250, 0.92);
      box-shadow: 0 16px 40px rgba(47, 118, 109, 0.12);
    }

    .chapter-verse-header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 8px;
      color: var(--accent-strong);
      font-size: 0.86rem;
      font-weight: 850;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }

    .chapter-hebrew-line {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: clamp(8px, 2vw, 16px);
      padding: 4px 0;
      font-family: "SBL Hebrew", "Ezra SIL", "Noto Sans Hebrew", "Times New Roman", serif;
      text-align: center;
    }

    .chapter-word-token {
      min-width: min(126px, 42vw);
      min-height: 116px;
      display: grid;
      align-content: center;
      justify-items: center;
      gap: 3px;
      padding: 10px 8px 12px;
      border: 1px solid transparent;
      border-radius: 18px;
      background: transparent;
      color: var(--ink);
      cursor: pointer;
      font-family: inherit;
      transition:
        background 160ms ease,
        border-color 160ms ease,
        box-shadow 160ms ease,
        transform 160ms ease;
    }

    .chapter-word-token:hover,
    .chapter-word-token:focus-visible {
      border-color: rgba(47, 118, 109, 0.46);
      background: rgba(47, 118, 109, 0.08);
      outline: none;
      transform: translateY(-1px);
    }

    .chapter-word-token.active {
      border-color: var(--accent);
      background: rgba(47, 118, 109, 0.14);
      box-shadow: 0 0 0 3px rgba(47, 118, 109, 0.12);
    }

    .chapter-word-hebrew {
      direction: rtl;
      color: var(--ink);
      font-size: clamp(2rem, 8vw, 4rem);
      font-weight: 850;
      line-height: 1.1;
    }

    .chapter-word-transliteration {
      color: var(--clay);
      font-family: "Segoe UI", Arial, sans-serif;
      font-size: clamp(0.78rem, 2.2vw, 1.02rem);
      font-weight: 850;
      line-height: 1.15;
    }

    .chapter-word-gloss {
      color: var(--muted);
      font-family: "Segoe UI", Arial, sans-serif;
      font-size: clamp(0.72rem, 2vw, 0.92rem);
      font-weight: 700;
      line-height: 1.2;
    }

    .chapter-verse-english {
      margin: 0;
      color: #37332e;
      font-size: clamp(0.95rem, 2.4vw, 1.1rem);
      font-weight: 650;
      line-height: 1.55;
      text-align: center;
    }

    .bible-reader-home.hide-transliteration .chapter-word-transliteration,
    .bible-reader-home.hide-english .chapter-word-gloss,
    .bible-reader-home.hide-english .chapter-verse-english {
      display: none;
    }

    @media (max-width: 720px) {
      .chapter-reader-heading {
        align-items: flex-start;
        flex-direction: column;
      }

      .chapter-reader-note {
        text-align: left;
      }

      .chapter-hebrew-line {
        justify-content: center;
        gap: 8px;
      }

      .chapter-word-token {
        min-width: min(104px, 45vw);
        min-height: 104px;
        padding-left: 6px;
        padding-right: 6px;
      }
    }

    @media (max-width: 420px) {
      .chapter-word-token {
        min-width: min(92px, 45vw);
      }

      .chapter-word-hebrew {
        font-size: clamp(1.85rem, 11vw, 3.2rem);
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

  function createVerseCard(verse, verseIndex) {
    const article = document.createElement("article");
    article.className = `chapter-verse${verseIndex === activeVerseIndex ? " is-active" : ""}`;
    article.id = `chapterVerse-${verseIndex}`;
    article.setAttribute("aria-label", verse.reference || `Verse ${verseIndex + 1}`);

    const header = document.createElement("div");
    header.className = "chapter-verse-header";

    const reference = document.createElement("span");
    reference.textContent = verse.reference || `Verse ${verseIndex + 1}`;

    const count = document.createElement("span");
    count.textContent = `${verse.words?.length || 0} words`;

    header.append(reference, count);

    const line = document.createElement("div");
    line.className = "chapter-hebrew-line";
    line.dir = "rtl";
    line.lang = "he";
    line.setAttribute("aria-label", `${verse.reference || "Verse"} Hebrew words with transliteration and English glosses`);

    (verse.words || []).forEach((word, wordIndex) => {
      line.append(createWordToken(word, verseIndex, wordIndex));
    });

    const english = document.createElement("p");
    english.className = "chapter-verse-english";
    english.textContent = verse.english || "English meaning coming soon.";

    article.append(header, line, english);
    return article;
  }

  function ensureChapterReader() {
    const verseCard = document.querySelector(".bible-verse-card");
    if (!verseCard) return null;

    verseCard.classList.add("chapter-scroll-mode");
    let chapterReader = document.querySelector("#chapterReader");
    if (chapterReader) return chapterReader;

    chapterReader = document.createElement("section");
    chapterReader.id = "chapterReader";
    chapterReader.className = "chapter-reader";
    chapterReader.setAttribute("aria-label", "Scrollable Genesis chapter reader");
    verseCard.append(chapterReader);
    return chapterReader;
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

    const heading = document.createElement("div");
    heading.className = "chapter-reader-heading";

    const headingCopy = document.createElement("div");
    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = "Chapter Reader";

    const title = document.createElement("h3");
    title.textContent = rangeLabel;

    headingCopy.append(eyebrow, title);

    const note = document.createElement("p");
    note.className = "chapter-reader-note";
    note.textContent = "Read straight through. Tap any Hebrew word to open the study card.";

    heading.append(headingCopy, note);

    const list = document.createElement("div");
    list.className = "chapter-verse-list";
    verses.forEach((verse, verseIndex) => list.append(createVerseCard(verse, verseIndex)));

    chapterReader.append(heading, list);
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
