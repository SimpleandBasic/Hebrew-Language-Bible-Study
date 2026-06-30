(() => {
  const transliterationLine = document.querySelector("#transliterationLine");
  const slowVerseButton = document.querySelector("#slowVerseButton");
  const repeatVerseButton = document.querySelector("#repeatVerseButton");
  const practiceVerseButton = document.querySelector("#practiceVerseButton");
  const practicePanel = document.querySelector("#practicePanel");
  const practiceVerseReference = document.querySelector("#practiceVerseReference");
  const practiceStatus = document.querySelector("#practiceStatus");
  const hideTransliterationButton = document.querySelector("#hideTransliterationButton");
  const hideEnglishButton = document.querySelector("#hideEnglishButton");
  const markPracticedButton = document.querySelector("#markPracticedButton");
  const selectedMemoryClue = document.querySelector("#selectedMemoryClue");
  const reader = document.querySelector(".bible-reader-home");
  const verseCard = document.querySelector(".bible-verse-card");

  const practiceState = {
    open: false,
    hideEnglish: false,
    hideTransliteration: false
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

  function updatePracticeUi() {
    const verse = activeVerse();
    const reference = verse?.reference || "Genesis 1";
    const practiced = isPracticed(verse);

    if (practiceVerseReference) practiceVerseReference.textContent = reference;
    if (practiceStatus) {
      practiceStatus.textContent = practiced
        ? `${reference} is marked practiced on this device. Play it again and keep sharpening your ear.`
        : `Listen to ${reference}, read it out loud, then repeat slowly.`;
    }
    if (markPracticedButton) {
      markPracticedButton.textContent = practiced ? "Practiced" : "Mark Practiced";
      markPracticedButton.setAttribute("aria-pressed", String(practiced));
    }
    if (practiceVerseButton) practiceVerseButton.setAttribute("aria-expanded", String(practiceState.open));
    if (practicePanel) practicePanel.hidden = !practiceState.open;
    verseCard?.classList.toggle("is-practiced", practiced);
    reader?.classList.toggle("hide-english", practiceState.hideEnglish);
    reader?.classList.toggle("hide-transliteration", practiceState.hideTransliteration);
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

  function speakReaderVerse({ rate = 0.9, repeat = 1, label = "Playing Hebrew" } = {}) {
    const verse = activeVerse();
    const text = getHebrewVerse(verse);
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
    updatePracticeUi();
  });

  hideTransliterationButton?.addEventListener("click", () => {
    practiceState.hideTransliteration = !practiceState.hideTransliteration;
    hideTransliterationButton.setAttribute("aria-pressed", String(practiceState.hideTransliteration));
    hideTransliterationButton.textContent = practiceState.hideTransliteration ? "Show Transliteration" : "Hide Transliteration";
    updatePracticeUi();
  });

  hideEnglishButton?.addEventListener("click", () => {
    practiceState.hideEnglish = !practiceState.hideEnglish;
    hideEnglishButton.setAttribute("aria-pressed", String(practiceState.hideEnglish));
    hideEnglishButton.textContent = practiceState.hideEnglish ? "Show English" : "Hide English";
    updatePracticeUi();
  });

  markPracticedButton?.addEventListener("click", () => {
    setPracticed(activeVerse());
    updatePracticeUi();
  });

  render();
})();
