(() => {
  const statusElement = document.querySelector("#dataStatus");
  const fallbackMessage = "Using the built-in Genesis 1 practice data while Supabase is unavailable.";

  function setStatus(message, state = "local") {
    if (!statusElement) return;
    statusElement.textContent = message;
    statusElement.dataset.state = state;
  }

  function getHeaders(publicKey) {
    const headers = { apikey: publicKey };
    if (publicKey.startsWith("eyJ")) {
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

  function mapWord(word) {
    return {
      hebrew: word.hebrew_text || "",
      transliteration: word.transliteration || "",
      gloss: word.english_gloss || "",
      pronunciation: word.pronunciation || "",
      root: word.root || "",
      rootTransliteration: word.root_transliteration || "",
      rootMeaning: word.root_meaning || "",
      strongs: word.strongs_number || "",
      form: word.word_form || "",
      grammar: word.grammar_note || "",
      lexiconNote: word.lexicon_note || "",
      context: word.context_note || "",
      themeTags: Array.isArray(word.theme_tags) ? word.theme_tags : [],
      prompt: word.study_prompt || ""
    };
  }

  async function loadSharedData() {
    const config = window.HEBREW_SUPABASE_CONFIG || {};
    const baseUrl = String(config.url || "").replace(/\/$/, "");
    const publicKey = String(config.publicKey || "");
    const minimumVerseCount = Number(config.minimumVerseCount || verses.length || 1);

    if (!baseUrl || !publicKey) {
      setStatus(fallbackMessage);
      return;
    }

    setStatus("Connecting to the Hebrew Bible reader library…", "loading");

    try {
      const headers = getHeaders(publicKey);
      const verseSelect = "id,reference,english_text,context_note,verse_number";
      const verseUrl = `${baseUrl}/rest/v1/hebrew_verses?select=${encodeURIComponent(verseSelect)}&book=eq.Genesis&chapter=eq.1&order=verse_number.asc`;
      const verseRows = await readJson(verseUrl, headers);

      if (!Array.isArray(verseRows) || verseRows.length === 0) {
        setStatus(`The shared library is connected, but no complete verses are ready. ${fallbackMessage}`, "warning");
        return;
      }

      const verseIds = verseRows.map((row) => row.id).join(",");
      const wordSelect = "verse_id,word_position,hebrew_words(hebrew_text,transliteration,pronunciation,english_gloss,root,root_transliteration,root_meaning,strongs_number,word_form,grammar_note,lexicon_note,context_note,study_prompt,theme_tags)";
      const wordUrl = `${baseUrl}/rest/v1/hebrew_verse_words?select=${encodeURIComponent(wordSelect)}&verse_id=in.(${verseIds})&order=word_position.asc`;
      const wordRows = await readJson(wordUrl, headers);

      const wordsByVerse = new Map();
      for (const row of wordRows || []) {
        const list = wordsByVerse.get(row.verse_id) || [];
        if (row.hebrew_words) {
          list.push({ position: row.word_position, word: mapWord(row.hebrew_words) });
        }
        wordsByVerse.set(row.verse_id, list);
      }

      const loadedVerses = verseRows
        .map((row) => ({
          reference: row.reference,
          english: row.english_text || "",
          context: row.context_note || "",
          words: (wordsByVerse.get(row.id) || [])
            .sort((a, b) => a.position - b.position)
            .map((entry) => entry.word)
        }))
        .filter((verse) => verse.words.length > 0);

      if (loadedVerses.length < minimumVerseCount) {
        setStatus(`The shared library is connected, but Genesis 1:1 through 1:${minimumVerseCount} are not all ready yet. ${fallbackMessage}`, "warning");
        return;
      }

      verses.splice(0, verses.length, ...loadedVerses);
      activeVerseIndex = 0;
      activeWordIndex = 0;
      render();
      setStatus(`Connected to Supabase. Loaded ${loadedVerses.length} Genesis verses for Bible Reader practice.`, "connected");
    } catch (error) {
      console.warn("Hebrew Supabase load failed; local data remains active.", error?.message || error);
      setStatus(`The shared library is unavailable right now. ${fallbackMessage}`, "warning");
    }
  }

  loadSharedData();
})();
