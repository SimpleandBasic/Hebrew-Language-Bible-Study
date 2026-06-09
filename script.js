const verses = [
  {
    reference: "Genesis 1:1",
    english: "In the beginning God created the heavens and the earth.",
    context:
      "The opening line presents creation as God's ordered act. Hebrew narrative often carries weight through simple words, so even short particles like 'et' and prefixed 'the' matter.",
    words: [
      {
        hebrew: "בְּרֵאשִׁית",
        transliteration: "bereshit",
        gloss: "in beginning, at first",
        root: "רֹאשׁ (rosh), head / beginning",
        form: "Preposition בְּ + feminine noun רֵאשִׁית",
        grammar: "Construct-like opening phrase; no explicit definite article.",
        context:
          "The phrase does not include the normal Hebrew word for 'the.' English translations usually supply 'the beginning' because the sentence functions as the Bible's opening reference point.",
        prompt: "Notice how Hebrew can express a definite idea without using the article when the larger sentence makes the reference clear."
      },
      {
        hebrew: "בָּרָא",
        transliteration: "bara",
        gloss: "he created",
        root: "ברא (b-r-ʾ), create",
        form: "Qal perfect, 3rd person masculine singular",
        grammar: "Finite verb with God as the subject.",
        context:
          "This verb is strongly associated with divine creative action in the Hebrew Bible. It does not by itself explain the mechanics of creation; it emphasizes God's agency.",
        prompt: "Ask what the verse wants to foreground: process, timeline, or the identity of the creator?"
      },
      {
        hebrew: "אֱלֹהִים",
        transliteration: "elohim",
        gloss: "God",
        root: "אל / אלה, God or mighty one",
        form: "Masculine plural form used here with singular meaning",
        grammar: "Subject of the singular verb בָּרָא.",
        context:
          "Although the form looks plural, the singular verb shows that it refers here to Israel's God. Hebrew often lets grammar and context settle meaning.",
        prompt: "Watch how verb agreement helps interpret a noun that could otherwise look ambiguous."
      },
      {
        hebrew: "אֵת",
        transliteration: "et",
        gloss: "direct-object marker",
        root: "None as a normal lexical root in this use",
        form: "Object marker particle",
        grammar: "Marks the following definite object.",
        context:
          "This word is usually untranslated. It tells the Hebrew reader that the next phrase is the object of the verb.",
        prompt: "This is a great example of a word that matters grammatically even when it disappears in English."
      },
      {
        hebrew: "הַשָּׁמַיִם",
        transliteration: "hashamayim",
        gloss: "the heavens, the sky",
        root: "שׁמים (sh-m-y-m), heavens / sky",
        form: "Definite plural-like noun with הַ",
        grammar: "Direct object marked by אֵת.",
        context:
          "The word can refer to sky, heavens, or the upper realm. In this pair with 'earth,' it means the whole ordered cosmos.",
        prompt: "Read 'heavens and earth' as a totalizing pair: everything above and below."
      },
      {
        hebrew: "וְאֵת",
        transliteration: "ve'et",
        gloss: "and [the object marker]",
        root: "ו + אֵת",
        form: "Conjunction וְ + object marker",
        grammar: "Introduces the second definite object.",
        context:
          "The prefixed vav links the two objects: the heavens and the earth. Hebrew commonly attaches small function words directly to the following word.",
        prompt: "Notice that Hebrew prefixes can carry words English writes separately."
      },
      {
        hebrew: "הָאָרֶץ",
        transliteration: "ha'aretz",
        gloss: "the earth, the land",
        root: "ארץ (ʾ-r-ts), earth / land",
        form: "Definite feminine noun with הָ",
        grammar: "Second direct object of בָּרָא.",
        context:
          "Depending on context, this word can mean the whole earth or a specific land. Here it pairs with the heavens and points to the lower created realm.",
        prompt: "Keep a flexible mental range: 'earth' and 'land' are both live possibilities in Hebrew."
      }
    ]
  },
  {
    reference: "Genesis 1:2",
    english:
      "Now the earth was formless and empty, darkness was over the face of the deep, and the Spirit of God was hovering over the face of the waters.",
    context:
      "Verse 2 describes the unformed condition before God's ordering speech begins. The repeated phrase 'over the face of' creates a vivid spatial picture.",
    words: [
      ["וְהָאָרֶץ", "veha'aretz", "and the earth", "ארץ", "Conjunction + definite noun", "The focus narrows from the whole cosmos to the earth."],
      ["הָיְתָה", "hayetah", "was", "היה", "Qal perfect, 3rd feminine singular", "The feminine verb agrees with הָאָרֶץ."],
      ["תֹהוּ", "tohu", "formlessness", "תהו", "Noun", "A state of waste, emptiness, or unformedness."],
      ["וָבֹהוּ", "vavohu", "and emptiness", "בהו", "Conjunction + noun", "A rhymed pair with תֹהוּ, emphasizing disorder and vacancy."],
      ["וְחֹשֶׁךְ", "vechoshekh", "and darkness", "חשׁך", "Conjunction + noun", "Darkness is part of the scene that God will begin to order."],
      ["עַל־פְּנֵי", "al-penei", "over the face of", "פנה", "Preposition + plural construct noun", "A Hebrew idiom for being over or upon the surface of something."],
      ["תְהוֹם", "tehom", "the deep", "תהום", "Noun", "The watery deep, pictured as a vast primeval depth."],
      ["וְרוּחַ", "veruach", "and spirit / wind / breath", "רוח", "Conjunction + noun", "Ruach can mean spirit, wind, or breath; context guides the choice."],
      ["אֱלֹהִים", "elohim", "God", "אלהים", "Noun", "Here it forms 'Spirit of God' or possibly 'wind of God.'"],
      ["מְרַחֶפֶת", "merachefet", "hovering", "רחף", "Piel participle, feminine singular", "The participle agrees with רוּחַ, a grammatically feminine noun."],
      ["עַל־פְּנֵי", "al-penei", "over the face of", "פנה", "Repeated prepositional phrase", "The repetition mirrors the earlier phrase over the deep."],
      ["הַמָּיִם", "hamayim", "the waters", "מים", "Definite plural noun", "Waters are central in the early creation ordering sequence."]
    ].map(makeWord)
  },
  {
    reference: "Genesis 1:3",
    english: "And God said, 'Let there be light,' and there was light.",
    context:
      "Creation begins through divine speech. The short command and immediate result give the verse its force.",
    words: [
      ["וַיֹּאמֶר", "vayomer", "and he said", "אמר", "Wayyiqtol verb", "A standard Hebrew narrative form that moves the story forward."],
      ["אֱלֹהִים", "elohim", "God", "אלהים", "Noun", "The speaker is the same God who created in verse 1."],
      ["יְהִי", "yehi", "let there be", "היה", "Jussive-like Qal form", "A command or volitive expression calling something into existence."],
      ["אוֹר", "or", "light", "אור", "Noun", "Light appears before sun and moon, so the focus is order, visibility, and separation."],
      ["וַיְהִי־אוֹר", "vayehi-or", "and there was light", "היה / אור", "Verb + noun joined by maqqef", "The result echoes the command almost exactly."]
    ].map(makeWord)
  },
  {
    reference: "Genesis 1:4",
    english: "And God saw the light, that it was good; and God separated between the light and between the darkness.",
    context:
      "God evaluates and separates. These two actions become a pattern in the chapter: naming, distinguishing, and ordering.",
    words: [
      ["וַיַּרְא", "vayyar", "and he saw", "ראה", "Wayyiqtol verb", "A narrative verb introducing God's evaluation."],
      ["אֱלֹהִים", "elohim", "God", "אלהים", "Noun", "God is the evaluator of creation's goodness."],
      ["אֶת־הָאוֹר", "et-ha'or", "the light", "אור", "Object marker + definite noun", "The object marker is joined to the noun by maqqef."],
      ["כִּי־טוֹב", "ki-tov", "that it was good", "טוב", "Particle + adjective", "Good here means fitting, beneficial, or rightly ordered."],
      ["וַיַּבְדֵּל", "vayyavdel", "and he separated", "בדל", "Hiphil wayyiqtol verb", "God creates order by making meaningful distinctions."],
      ["אֱלֹהִים", "elohim", "God", "אלהים", "Noun", "The repeated subject slows the line and emphasizes divine action."],
      ["בֵּין", "bein", "between", "בין", "Preposition", "Often paired with a second בֵּין or וּבֵין."],
      ["הָאוֹר", "ha'or", "the light", "אור", "Definite noun", "One side of the separation."],
      ["וּבֵין", "uvein", "and between", "בין", "Conjunction + preposition", "Completes the Hebrew 'between X and between Y' construction."],
      ["הַחֹשֶׁךְ", "hachoshekh", "the darkness", "חשׁך", "Definite noun", "The other side of the separation."]
    ].map(makeWord)
  },
  {
    reference: "Genesis 1:5",
    english:
      "And God called the light Day, and the darkness he called Night. And there was evening and there was morning, one day.",
    context:
      "Naming completes the first ordering act. The evening-morning formula marks the first day in the chapter's repeated structure.",
    words: [
      ["וַיִּקְרָא", "vayyiqra", "and he called", "קרא", "Wayyiqtol verb", "Naming is an act of authority and classification."],
      ["אֱלֹהִים", "elohim", "God", "אלהים", "Noun", "God names what God has separated."],
      ["לָאוֹר", "la'or", "to the light", "אור", "Preposition לְ + definite noun", "Hebrew says 'called to the light Day,' an idiom for naming."],
      ["יוֹם", "yom", "day", "יום", "Noun", "Can mean daylight period or a full day depending on context."],
      ["וְלַחֹשֶׁךְ", "velachoshekh", "and to the darkness", "חשׁך", "Conjunction + preposition + definite noun", "The second named realm."],
      ["קָרָא", "qara", "he called", "קרא", "Qal perfect, 3rd masculine singular", "The verb order shifts, but God remains the implied subject."],
      ["לָיְלָה", "laylah", "night", "ליל", "Noun", "The named counterpart to day."],
      ["וַיְהִי־עֶרֶב", "vayehi-erev", "and there was evening", "היה / ערב", "Verb + noun", "The first half of the day-closing formula."],
      ["וַיְהִי־בֹקֶר", "vayehi-voqer", "and there was morning", "היה / בקר", "Verb + noun", "The second half of the formula."],
      ["יוֹם", "yom", "day", "יום", "Noun", "The unit being counted."],
      ["אֶחָד", "echad", "one", "אחד", "Cardinal number", "The first counted day; later verses use ordinal-style phrasing."]
    ].map(makeWord)
  }
];

let activeVerseIndex = 0;
let activeWordIndex = 0;
let hebrewScale = 1;

const verseTabs = document.querySelector("#verseTabs");
const hebrewLine = document.querySelector("#hebrewLine");
const englishLine = document.querySelector("#englishLine");
const verseReference = document.querySelector("#verseReference");
const wordCount = document.querySelector("#wordCount");
const verseContext = document.querySelector("#verseContext");
const selectedHebrew = document.querySelector("#selectedHebrew");
const selectedTransliteration = document.querySelector("#selectedTransliteration");
const selectedGloss = document.querySelector("#selectedGloss");
const selectedRoot = document.querySelector("#selectedRoot");
const selectedForm = document.querySelector("#selectedForm");
const selectedGrammar = document.querySelector("#selectedGrammar");
const selectedContext = document.querySelector("#selectedContext");
const selectedPrompt = document.querySelector("#selectedPrompt");

function makeWord([hebrew, transliteration, gloss, root, form, context]) {
  return {
    hebrew,
    transliteration,
    gloss,
    root,
    form,
    grammar: form,
    context,
    prompt: "Compare the Hebrew form with the English translation and ask what had to be added, compressed, or left untranslated."
  };
}

function renderTabs() {
  verseTabs.innerHTML = "";
  verses.forEach((verse, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `verse-tab${index === activeVerseIndex ? " active" : ""}`;
    button.textContent = verse.reference.split(":").at(-1);
    button.setAttribute("aria-label", verse.reference);
    button.addEventListener("click", () => {
      activeVerseIndex = index;
      activeWordIndex = 0;
      render();
    });
    verseTabs.append(button);
  });
}

function renderVerse() {
  const verse = verses[activeVerseIndex];
  verseReference.textContent = verse.reference;
  wordCount.textContent = `${verse.words.length} Hebrew words`;
  englishLine.textContent = verse.english;
  verseContext.textContent = verse.context;
  hebrewLine.innerHTML = "";

  verse.words.forEach((word, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `word-token${index === activeWordIndex ? " active" : ""}`;
    button.textContent = word.hebrew;
    button.setAttribute("aria-label", `${word.hebrew}, ${word.transliteration}, ${word.gloss}`);
    button.addEventListener("click", () => {
      activeWordIndex = index;
      renderVerse();
      renderWord();
    });
    hebrewLine.append(button);
  });
}

function renderWord() {
  const word = verses[activeVerseIndex].words[activeWordIndex];
  selectedHebrew.textContent = word.hebrew;
  selectedTransliteration.textContent = word.transliteration;
  selectedGloss.textContent = word.gloss;
  selectedRoot.textContent = word.root;
  selectedForm.textContent = word.form;
  selectedGrammar.textContent = word.grammar;
  selectedContext.textContent = word.context;
  selectedPrompt.textContent = word.prompt;
}

function render() {
  renderTabs();
  renderVerse();
  renderWord();
}

document.querySelector("#increaseText").addEventListener("click", () => {
  hebrewScale = Math.min(1.35, hebrewScale + 0.1);
  document.documentElement.style.setProperty("--hebrew-size", `${2.65 * hebrewScale}rem`);
});

document.querySelector("#decreaseText").addEventListener("click", () => {
  hebrewScale = Math.max(0.78, hebrewScale - 0.1);
  document.documentElement.style.setProperty("--hebrew-size", `${2.65 * hebrewScale}rem`);
});

document.querySelector("#copyWord").addEventListener("click", async () => {
  const word = verses[activeVerseIndex].words[activeWordIndex];
  const text = `${word.hebrew} (${word.transliteration}) - ${word.gloss}`;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    selectedPrompt.textContent = text;
  }
});

render();
