(() => {
  const transliterationLine = document.querySelector("#transliterationLine");
  const slowVerseButton = document.querySelector("#slowVerseButton");
  const repeatVerseButton = document.querySelector("#repeatVerseButton");
  const practiceVerseButton = document.querySelector("#practiceVerseButton");
  const practicePanel = document.querySelector("#practicePanel");
  const selectedMemoryClue = document.querySelector("#selectedMemoryClue");
  const reader = document.querySelector(".bible-reader-home");
  const verseCard = document.querySelector(".bible-verse-card");

  const practiceState = {
    open: false,
    hideEnglish: false,
    hideTransliteration: false,
    activePhraseIndex: 0,
    activeReference: ""
  };

  function activeVerse() {
    return verses[activeVerseIndex];
  }

  function activeWord() {
    return activeVerse()?.words?.[activeWordIndex];
  }

  function verseTransliteration(verse) {
    return (verse?.words || [])
      .map((word) => word.transliteration || "")
      .filter(Boolean)
      .join(" ");
  }

  function practiceKey(verse) {
    return `hebrew-reader-practiced:${verse?.reference || "unknown"}`;
  }

  function phrasePracticeKey(verse) {
    return `hebrew-reader-phrases-spoken:${verse?.reference || "unknown"}`;
  }

  function isPracticed(verse) {
    try {
      return localStorage.getItem(practiceKey(verse)) === "true";
    } catch {
      return false;
    }
  }

  function setPracticed(verse) {
    try {
      localStorage.setItem(practiceKey(verse), "true");
    } catch {
      // Local storage can fail in private browser modes. The UI still continues.
    }
  }

  function readSpokenPhraseIndexes(verse) {
    try {
      const saved = JSON.parse(localStorage.getItem(phrasePracticeKey(verse)) || "[]");
      return new Set(Array.isArray(saved) ? saved.filter(Number.isInteger) : []);
    } catch {
      return new Set();
    }
  }

  function writeSpokenPhraseIndexes(verse, spokenIndexes) {
    try {
      localStorage.setItem(phrasePracticeKey(verse), JSON.stringify([...spokenIndexes].sort((a, b) => a - b)));
    } catch {
      // Local storage can fail in private browser modes. Phrase practice still works for this session.
    }
  }

  function createPhraseChunks(verse) {
    const words = verse?.words || [];
    if (!words.length) return [];

    const chunkSize = words.length <= 4 ? words.length : words.length <= 8 ? 2 : 3;
    const chunks = [];

    for (let start = 0; start < words.length; start += chunkSize) {
      const end = Math.min(start + chunkSize, words.length);
      chunks.push({ start, end, words: words.slice(start, end) });
    }

    const lastChunk = chunks.at(-1);
    const previousChunk = chunks.at(-2);
    if (lastChunk && previousChunk && lastChunk.words.length === 1) {
      previousChunk.end = lastChunk.end;
      previousChunk.words = words.slice(previousChunk.start, previousChunk.end);
      chunks.pop();
    }

    return chunks.map((chunk, index) => ({
      ...chunk,
      index,
      hebrew: chunk.words.map((word) => word.hebrew || "").filter(Boolean).join(" "),
      transliteration: chunk.words.map((word) => word.transliteration || "").filter(Boolean).join(" "),
      english: chunk.words.map((word) => word.gloss || "").filter(Boolean).join(" · ") || "Meaning coming soon."
    }));
  }

  function getActivePhrases() {
    const phrases = createPhraseChunks(activeVerse());
    if (practiceState.activePhraseIndex >= phrases.length) {
      practiceState.activePhraseIndex = Math.max(0, phrases.length - 1);
    }
    return phrases;
  }

  function activePhrase() {
    return getActivePhrases()[practiceState.activePhraseIndex];
  }

  function ensurePracticeReference() {
    const reference = activeVerse()?.reference || "Genesis 1";
    if (practiceState.activeReference !== reference) {
      practiceState.activeReference = reference;
      practiceState.activePhraseIndex = 0;
    }
  }

  function ensurePracticePanelStructure() {
    if (!practicePanel || practicePanel.querySelector("#practicePhraseHebrew")) return;

    practicePanel.innerHTML = `
      <div class="practice-copy">
        <p class="eyebrow">Practice Mode</p>
        <h2 id="practiceVerseReference">Genesis 1:1</h2>
        <p id="practiceStatus">Listen once, read out loud, then repeat slowly.</p>
      </div>
      <div class="practice-phrase-card" aria-live="polite">
        <div class="practice-phrase-meta">
          <span id="practicePhraseNumber">Phrase 1 of 1</span>
          <span id="practicePhraseSpokenState">Not spoken yet</span>
        </div>
        <p class="line-label">Hebrew phrase</p>
        <div class="practice-phrase-hebrew" id="practicePhraseHebrew" dir="rtl" lang="he"></div>
        <p class="line-label practice-transliteration-label">Transliteration</p>
        <p class="practice-phrase-transliteration" id="practicePhraseTransliteration"></p>
        <p class="line-label practice-english-label">English phrase meaning</p>
        <p class="practice-phrase-english" id="practicePhraseEnglish"></p>
      </div>
      <div class="practice-actions phrase-actions" aria-label="Phrase practice controls">
        <button class="source-toggle-button" id="previousPhraseButton" type="button" data-practice-action="previous">Previous Phrase</button>
        <button class="verse-audio-button" id="playPhraseButton" type="button" data-practice-action="play">Play Phrase</button>
        <button class="source-toggle-button" id="slowPhraseButton" type="button" data-practice-action="slow">Slow Phrase</button>
        <button class="source-toggle-button" id="repeatPhraseButton" type="button" data-practice-action="repeat">Repeat Phrase</button>
        <button class="verse-audio-button" id="markPhraseSpokenButton" type="button" data-practice-action="mark">Mark Phrase Spoken</button>
        <button class="source-toggle-button" id="nextPhraseButton" type="button" data-practice-action="next">Next Phrase</button>
      </div>
      <div class="practice-actions visibility-actions" aria-label="Practice visibility controls">
        <button class="source-toggle-button" id="hideTransliterationButton" type="button" data-practice-action="hide-transliteration" aria-pressed="false">Hide Transliteration</button>
        <button class="source-toggle-button" id="hideEnglishButton" type="button" data-practice-action="hide-english" aria-pressed="false">Hide English</button>
        <button class="source-toggle-button" id="markPracticedButton" type="button" data-practice-action="mark-verse">Mark Verse Practiced</button>
      </div>
    `;
  }

  function practiceElement(id) {
    return practicePanel?.querySelector(`#${id}`);
  }

  function setPhraseSpoken(verse, phraseIndex) {
    const phrases = getActivePhrases();
    const spokenIndexes = readSpokenPhraseIndexes(verse);
    spokenIndexes.add(phraseIndex);
    writeSpokenPhraseIndexes(verse, spokenIndexes);

    if (phrases.length && spokenIndexes.size >= phrases.length) {
      setPracticed(verse);
    }
  }

  function markActivePhraseInVerse(phrases, spokenIndexes) {
    const phrase = phrases[practiceState.activePhraseIndex];
    const tokens = [...document.querySelectorAll("#hebrewLine .word-token")];

    tokens.forEach((token, index) => {
      const isActivePhraseWord = Boolean(phrase && index >= phrase.start && index < phrase.end);
      const isSpokenPhraseWord = phrases.some((candidate) => {
        return spokenIndexes.has(candidate.index) && index >= candidate.start && index < candidate.end;
      });

      token.classList.toggle("phrase-active", practiceState.open && isActivePhraseWord);
      token.classList.toggle("phrase-spoken", isSpokenPhraseWord);
      if (practiceState.open && isActivePhraseWord) {
        token.setAttribute("aria-current", "true");
      } else {
        token.removeAttribute("aria-current");
      }
    });
  }

  function updatePracticeUi() {
    ensurePracticePanelStructure();
    ensurePracticeReference();

    const verse = activeVerse();
    const reference = verse?.reference || "Genesis 1";
    const phrases = getActivePhrases();
    const phrase = phrases[practiceState.activePhraseIndex];
    const spokenIndexes = readSpokenPhraseIndexes(verse);
    const practiced = isPracticed(verse);
    const phraseIsSpoken = spokenIndexes.has(practiceState.activePhraseIndex);

    const practiceVerseReference = practiceElement("practiceVerseReference");
    const practiceStatus = practiceElement("practiceStatus");
    const practicePhraseNumber = practiceElement("practicePhraseNumber");
    const practicePhraseSpokenState = practiceElement("practicePhraseSpokenState");
    const practicePhraseHebrew = practiceElement("practicePhraseHebrew");
    const practicePhraseTransliteration = practiceElement("practicePhraseTransliteration");
    const practicePhraseEnglish = practiceElement("practicePhraseEnglish");
    const previousPhraseButton = practiceElement("previousPhraseButton");
    const nextPhraseButton = practiceElement("nextPhraseButton");
    const playPhraseButton = practiceElement("playPhraseButton");
    const slowPhraseButton = practiceElement("slowPhraseButton");
    const repeatPhraseControlButton = practiceElement("repeatPhraseButton");
    const markPhraseSpokenButton = practiceElement("markPhraseSpokenButton");
    const hideTransliterationButton = practiceElement("hideTransliterationButton");
    const hideEnglishButton = practiceElement("hideEnglishButton");
    const markPracticedButton = practiceElement("markPracticedButton");

    if (practiceVerseReference) practiceVerseReference.textContent = reference;
    if (practicePhraseNumber) {
      practicePhraseNumber.textContent = phrases.length
        ? `Phrase ${practiceState.activePhraseIndex + 1} of ${phrases.length}`
        : "No phrases ready";
    }
    if (practicePhraseSpokenState) {
      practicePhraseSpokenState.textContent = practiced
        ? "Verse practiced"
        : phraseIsSpoken
          ? "Phrase spoken"
          : "Not spoken yet";
    }
    if (practicePhraseHebrew) practicePhraseHebrew.textContent = phrase?.hebrew || "Phrase coming soon.";
    if (practicePhraseTransliteration) practicePhraseTransliteration.textContent = phrase?.transliteration || "Transliteration coming soon.";
    if (practicePhraseEnglish) practicePhraseEnglish.textContent = phrase?.english || "Meaning coming soon.";

    if (practiceStatus) {
      if (practiced) {
        practiceStatus.textContent = `${reference} is marked practiced on this device. Strong work. Keep your ear sharp.`;
      } else if (phraseIsSpoken) {
        practiceStatus.textContent = `Phrase ${practiceState.activePhraseIndex + 1} is marked spoken. Move to the next phrase when you are ready.`;
      } else {
        practiceStatus.textContent = `Listen to phrase ${practiceState.activePhraseIndex + 1}, speak it out loud, then mark it spoken.`;
      }
    }

    if (previousPhraseButton) previousPhraseButton.disabled = practiceState.activePhraseIndex <= 0;
    if (nextPhraseButton) nextPhraseButton.disabled = practiceState.activePhraseIndex >= phrases.length - 1;
    [playPhraseButton, slowPhraseButton, repeatPhraseControlButton, markPhraseSpokenButton].forEach((button) => {
      if (button) button.disabled = !phrase;
    });

    if (markPhraseSpokenButton) {
      markPhraseSpokenButton.textContent = phraseIsSpoken ? "Phrase Spoken" : "Mark Phrase Spoken";
      markPhraseSpokenButton.setAttribute("aria-pressed", String(phraseIsSpoken));
    }
    if (hideTransliterationButton) {
      hideTransliterationButton.textContent = practiceState.hideTransliteration ? "Show Transliteration" : "Hide Transliteration";
      hideTransliterationButton.setAttribute("aria-pressed", String(practiceState.hideTransliteration));
    }
    if (hideEnglishButton) {
      hideEnglishButton.textContent = practiceState.hideEnglish ? "Show English" : "Hide English";
      hideEnglishButton.setAttribute("aria-pressed", String(practiceState.hideEnglish));
    }
    if (markPracticedButton) {
      markPracticedButton.textContent = practiced ? "Verse Practiced" : "Mark Verse Practiced";
      markPracticedButton.setAttribute("aria-pressed", String(practiced));
    }

    if (practiceVerseButton) practiceVerseButton.setAttribute("aria-expanded", String(practiceState.open));
    if (practicePanel) practicePanel.hidden = !practiceState.open;
    verseCard?.classList.toggle("is-practiced", practiced);
    reader?.classList.toggle("hide-english", practiceState.hideEnglish);
    reader?.classList.toggle("hide-transliteration", practiceState.hideTransliteration);
    markActivePhraseInVerse(phrases, spokenIndexes);
  }

  function updateReaderLines() {
    const verse = activeVerse();
    if (transliterationLine) {
      transliterationLine.textContent = verseTransliteration(verse) || "Transliteration coming soon.";
    }
    updatePracticeUi();
  }

  function memoryClueFor(word) {
    if (!word) return "Tap a Hebrew word to see a simple memory clue.";

    const sound = word.transliteration ? `${word.hebrew} sounds like ${word.transliteration}. ` : "";
    const meaning = word.gloss ? `It means ${word.gloss}. ` : "";
    const picture = word.rootMeaning || word.lexiconNote || word.context || "Let the word add one clear picture to the verse.";
    return `${sound}${meaning}${picture}`.trim();
  }

  function updateWordStudy() {
    if (selectedMemoryClue) selectedMemoryClue.textContent = memoryClueFor(activeWord());
  }

  function speakHebrewText(text, { rate = 0.9, repeat = 1, label = "Playing Hebrew" } = {}) {
    const fallbackUrl = getGoogleTranslateUrl(text);

    if (!text) return;

    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      audioHelperNote.textContent = "Browser audio is not available here. Opening the Hebrew audio helper.";
      openAudioFallback(fallbackUrl);
      return;
    }

    const voice = getHebrewVoice();
    if (!voice) {
      audioHelperNote.textContent = "No browser Hebrew voice was found. Opening Google Translate as the backup audio helper.";
      openAudioFallback(fallbackUrl);
      return;
    }

    let count = 0;
    window.speechSynthesis.cancel();

    const playNext = () => {
      count += 1;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = voice.lang || "he-IL";
      utterance.voice = voice;
      utterance.rate = rate;
      utterance.onend = () => {
        if (count < repeat) window.setTimeout(playNext, 450);
      };
      utterance.onerror = () => {
        audioHelperNote.textContent = "Browser audio could not play this Hebrew text. Opening Google Translate as the backup audio helper.";
        openAudioFallback(fallbackUrl);
      };

      audioHelperNote.textContent = repeat > 1 ? `${label}: repeat ${count} of ${repeat}.` : `${label}.`;
      window.speechSynthesis.speak(utterance);
      window.speechSynthesis.resume?.();
    };

    playNext();
  }

  function speakReaderVerse({ rate = 0.9, repeat = 1, label = "Playing Hebrew" } = {}) {
    const verse = activeVerse();
    speakHebrewText(getHebrewVerse(verse), { rate, repeat, label });
  }

  function speakActivePhrase(options = {}) {
    const phrase = activePhrase();
    if (!phrase?.hebrew) return;
    speakHebrewText(phrase.hebrew, options);
  }

  function moveToPhrase(nextIndex) {
    const phrases = getActivePhrases();
    if (!phrases.length) return;

    practiceState.activePhraseIndex = Math.min(Math.max(nextIndex, 0), phrases.length - 1);
    const phrase = phrases[practiceState.activePhraseIndex];
    if (phrase) activeWordIndex = phrase.start;
    renderVerse();
    renderWord();
  }

  const originalRenderVerse = renderVerse;
  renderVerse = function renderVerseWithBibleReader() {
    originalRenderVerse();
    updateReaderLines();
  };

  const originalRenderWord = renderWord;
  renderWord = function renderWordWithMemoryClue() {
    originalRenderWord();
    updateWordStudy();
  };

  slowVerseButton?.addEventListener("click", () => speakReaderVerse({ rate: 0.68, label: "Playing slowly" }));
  repeatVerseButton?.addEventListener("click", () => speakReaderVerse({ rate: 0.82, repeat: 2, label: "Repeating Hebrew" }));

  practiceVerseButton?.addEventListener("click", () => {
    practiceState.open = !practiceState.open;
    ensurePracticeReference();
    updatePracticeUi();
  });

  practicePanel?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-practice-action]");
    if (!button) return;

    const action = button.dataset.practiceAction;
    if (action === "previous") moveToPhrase(practiceState.activePhraseIndex - 1);
    if (action === "next") moveToPhrase(practiceState.activePhraseIndex + 1);
    if (action === "play") speakActivePhrase({ rate: 0.9, label: "Playing phrase" });
    if (action === "slow") speakActivePhrase({ rate: 0.64, label: "Playing phrase slowly" });
    if (action === "repeat") speakActivePhrase({ rate: 0.82, repeat: 2, label: "Repeating phrase" });
    if (action === "mark") {
      setPhraseSpoken(activeVerse(), practiceState.activePhraseIndex);
      updatePracticeUi();
    }
    if (action === "mark-verse") {
      setPracticed(activeVerse());
      updatePracticeUi();
    }
    if (action === "hide-transliteration") {
      practiceState.hideTransliteration = !practiceState.hideTransliteration;
      updatePracticeUi();
    }
    if (action === "hide-english") {
      practiceState.hideEnglish = !practiceState.hideEnglish;
      updatePracticeUi();
    }
  });

  render();
})();
