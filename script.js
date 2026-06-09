const defaultPrompt =
  "Compare the Hebrew form with the English translation and ask what had to be added, compressed, or left untranslated.";

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
        pronunciation: "buh-ray-SHEET",
        root: "רֹאשׁ",
        rootTransliteration: "rosh",
        rootMeaning: "head, beginning, first part",
        strongs: "H7225",
        form: "Preposition בְּ + feminine noun רֵאשִׁית",
        grammar: "Construct-like opening phrase; no explicit definite article.",
        lexiconNote:
          "רֵאשִׁית can describe the first, beginning, or choicest part of something.",
        context:
          "The phrase does not include the normal Hebrew word for 'the.' English translations usually supply 'the beginning' because the sentence functions as the Bible's opening reference point.",
        themeTags: ["beginning", "creation", "time"],
        prompt:
          "Notice how Hebrew can express a definite idea without using the article when the larger sentence makes the reference clear."
      },
      {
        hebrew: "בָּרָא",
        transliteration: "bara",
        gloss: "he created",
        pronunciation: "bah-RAH",
        root: "ברא",
        rootTransliteration: "b-r-a",
        rootMeaning: "create, shape, bring into being",
        strongs: "H1254",
        form: "Qal perfect, 3rd person masculine singular",
        grammar: "Finite verb with God as the subject.",
        lexiconNote:
          "In the Hebrew Bible, ברא is strongly associated with divine creative action.",
        context:
          "This verb does not by itself explain the mechanics of creation; it emphasizes God's agency.",
        themeTags: ["creation", "divine action"],
        prompt: "Ask what the verse wants to foreground: process, timeline, or the identity of the creator?"
      },
      {
        hebrew: "אֱלֹהִים",
        transliteration: "elohim",
        gloss: "God",
        pronunciation: "eh-loh-HEEM",
        root: "אלהים",
        rootTransliteration: "elohim",
        rootMeaning: "God, deity, mighty one",
        strongs: "H430",
        form: "Masculine plural form used here with singular meaning",
        grammar: "Subject of the singular verb בָּרָא.",
        lexiconNote:
          "The form is grammatically plural, but singular verbs and context often show when it refers to Israel's God.",
        context:
          "Although the form looks plural, the singular verb shows that it refers here to Israel's God. Hebrew often lets grammar and context settle meaning.",
        themeTags: ["God", "grammar", "subject"],
        prompt: "Watch how verb agreement helps interpret a noun that could otherwise look ambiguous."
      },
      {
        hebrew: "אֵת",
        transliteration: "et",
        gloss: "direct-object marker",
        pronunciation: "ayt",
        root: "",
        rootTransliteration: "",
        rootMeaning: "grammatical marker rather than a normal lexical root",
        strongs: "H853",
        form: "Object marker particle",
        grammar: "Marks the following definite object.",
        lexiconNote:
          "This particle is usually not translated into English, but it is important for Hebrew syntax.",
        context:
          "This word tells the Hebrew reader that the next phrase is the object of the verb.",
        themeTags: ["syntax", "object marker"],
        prompt:
          "This is a great example of a word that matters grammatically even when it disappears in English."
      },
      {
        hebrew: "הַשָּׁמַיִם",
        transliteration: "hashamayim",
        gloss: "the heavens, the sky",
        pronunciation: "hah-shah-MAH-yeem",
        root: "שׁמים",
        rootTransliteration: "shamayim",
        rootMeaning: "heavens, sky",
        strongs: "H8064",
        form: "Definite plural-like noun with הַ",
        grammar: "Direct object marked by אֵת.",
        lexiconNote:
          "שָׁמַיִם can refer to sky, heavens, or the upper realm depending on context.",
        context:
          "In this pair with 'earth,' it means the whole ordered cosmos.",
        themeTags: ["heavens", "cosmos", "creation"],
        prompt: "Read 'heavens and earth' as a totalizing pair: everything above and below."
      },
      {
        hebrew: "וְאֵת",
        transliteration: "ve'et",
        gloss: "and [the object marker]",
        pronunciation: "veh-AYT",
        root: "ו + את",
        rootTransliteration: "vav + et",
        rootMeaning: "and + direct-object marker",
        strongs: "H853",
        form: "Conjunction וְ + object marker",
        grammar: "Introduces the second definite object.",
        lexiconNote:
          "Hebrew often attaches conjunctions and other small function words as prefixes.",
        context:
          "The prefixed vav links the two objects: the heavens and the earth.",
        themeTags: ["syntax", "conjunction", "object marker"],
        prompt: "Notice that Hebrew prefixes can carry words English writes separately."
      },
      {
        hebrew: "הָאָרֶץ",
        transliteration: "ha'aretz",
        gloss: "the earth, the land",
        pronunciation: "hah-AH-rets",
        root: "ארץ",
        rootTransliteration: "erets",
        rootMeaning: "earth, land, ground, territory",
        strongs: "H776",
        form: "Definite feminine noun with הָ",
        grammar: "Second direct object of בָּרָא.",
        lexiconNote:
          "אֶרֶץ can mean the whole earth or a specific land, depending on context.",
        context:
          "Here it pairs with the heavens and points to the lower created realm.",
        themeTags: ["earth", "land", "cosmos"],
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
      {
        hebrew: "וְהָאָרֶץ",
        transliteration: "veha'aretz",
        gloss: "and the earth",
        pronunciation: "veh-hah-AH-rets",
        root: "ארץ",
        rootTransliteration: "erets",
        rootMeaning: "earth, land, ground, territory",
        strongs: "H776",
        form: "Conjunction + definite noun",
        grammar: "וְ joins the sentence; ה marks the noun as definite.",
        lexiconNote:
          "The same word from Genesis 1:1 now becomes the focus of the description.",
        context: "The focus narrows from the whole cosmos to the earth.",
        themeTags: ["earth", "creation setting"],
        prompt: defaultPrompt
      },
      {
        hebrew: "הָיְתָה",
        transliteration: "hayetah",
        gloss: "was",
        pronunciation: "hai-TAH",
        root: "היה",
        rootTransliteration: "hayah",
        rootMeaning: "be, become, happen",
        strongs: "H1961",
        form: "Qal perfect, 3rd feminine singular",
        grammar: "The feminine verb agrees with הָאָרֶץ.",
        lexiconNote:
          "היה is the basic Hebrew verb for being, becoming, or coming to pass.",
        context: "The verb introduces the earth's condition before the ordering acts.",
        themeTags: ["state", "grammar"],
        prompt: defaultPrompt
      },
      {
        hebrew: "תֹהוּ",
        transliteration: "tohu",
        gloss: "formlessness",
        pronunciation: "TOH-hoo",
        root: "תהו",
        rootTransliteration: "tohu",
        rootMeaning: "waste, emptiness, formlessness",
        strongs: "H8414",
        form: "Noun",
        grammar: "First noun in a paired description.",
        lexiconNote:
          "תֹהוּ can describe desolation, emptiness, or an unproductive waste.",
        context: "A state of waste, emptiness, or unformedness.",
        themeTags: ["formlessness", "disorder"],
        prompt: defaultPrompt
      },
      {
        hebrew: "וָבֹהוּ",
        transliteration: "vavohu",
        gloss: "and emptiness",
        pronunciation: "vah-VOH-hoo",
        root: "בהו",
        rootTransliteration: "bohu",
        rootMeaning: "emptiness, void",
        strongs: "H922",
        form: "Conjunction + noun",
        grammar: "Paired with תֹהוּ as a rhymed expression.",
        lexiconNote:
          "בֹהוּ appears rarely and is most recognizable in the phrase תֹהוּ וָבֹהוּ.",
        context: "A rhymed pair with תֹהוּ, emphasizing disorder and vacancy.",
        themeTags: ["emptiness", "disorder"],
        prompt: defaultPrompt
      },
      {
        hebrew: "וְחֹשֶׁךְ",
        transliteration: "vechoshekh",
        gloss: "and darkness",
        pronunciation: "veh-KHOH-shekh",
        root: "חשׁך",
        rootTransliteration: "choshekh",
        rootMeaning: "darkness",
        strongs: "H2822",
        form: "Conjunction + noun",
        grammar: "Adds another feature of the pre-ordered scene.",
        lexiconNote:
          "חֹשֶׁךְ can describe physical darkness and, in some contexts, figurative gloom.",
        context: "Darkness is part of the scene that God will begin to order.",
        themeTags: ["darkness", "pre-creation scene"],
        prompt: defaultPrompt
      },
      {
        hebrew: "עַל־פְּנֵי",
        transliteration: "al-penei",
        gloss: "over the face of",
        pronunciation: "ahl-peh-NAY",
        root: "פנה",
        rootTransliteration: "panah / panim",
        rootMeaning: "face, surface, presence",
        strongs: "H6440",
        form: "Preposition + plural construct noun",
        grammar: "Construct phrase joined by maqqef.",
        lexiconNote:
          "פָּנִים is plural in form and often means face, presence, or surface.",
        context: "A Hebrew idiom for being over or upon the surface of something.",
        themeTags: ["space", "surface", "idiom"],
        prompt: defaultPrompt
      },
      {
        hebrew: "תְהוֹם",
        transliteration: "tehom",
        gloss: "the deep",
        pronunciation: "teh-HOME",
        root: "תהום",
        rootTransliteration: "tehom",
        rootMeaning: "deep, watery depth",
        strongs: "H8415",
        form: "Noun",
        grammar: "Object of the preceding construct phrase.",
        lexiconNote:
          "תְהוֹם pictures a vast depth, often associated with waters.",
        context: "The watery deep, pictured as a vast primeval depth.",
        themeTags: ["waters", "deep", "creation setting"],
        prompt: defaultPrompt
      },
      {
        hebrew: "וְרוּחַ",
        transliteration: "veruach",
        gloss: "and spirit / wind / breath",
        pronunciation: "veh-ROO-akh",
        root: "רוח",
        rootTransliteration: "ruach",
        rootMeaning: "spirit, wind, breath",
        strongs: "H7307",
        form: "Conjunction + noun",
        grammar: "רוּחַ is grammatically feminine.",
        lexiconNote:
          "רוּחַ has a wide semantic range: spirit, wind, breath, or life-giving force.",
        context: "Ruach can mean spirit, wind, or breath; context guides the choice.",
        themeTags: ["Spirit", "wind", "ambiguity"],
        prompt: defaultPrompt
      },
      {
        hebrew: "אֱלֹהִים",
        transliteration: "elohim",
        gloss: "God",
        pronunciation: "eh-loh-HEEM",
        root: "אלהים",
        rootTransliteration: "elohim",
        rootMeaning: "God, deity, mighty one",
        strongs: "H430",
        form: "Noun",
        grammar: "Forms the phrase רוּחַ אֱלֹהִים.",
        lexiconNote:
          "In construct-like phrases, אֱלֹהִים can identify possession, source, or divine association.",
        context: "Here it forms 'Spirit of God' or possibly 'wind of God.'",
        themeTags: ["God", "Spirit", "interpretation"],
        prompt: defaultPrompt
      },
      {
        hebrew: "מְרַחֶפֶת",
        transliteration: "merachefet",
        gloss: "hovering",
        pronunciation: "meh-rah-KHEH-fet",
        root: "רחף",
        rootTransliteration: "rachaf",
        rootMeaning: "hover, flutter, move over",
        strongs: "H7363",
        form: "Piel participle, feminine singular",
        grammar: "The participle agrees with רוּחַ, a grammatically feminine noun.",
        lexiconNote:
          "The verb suggests hovering, fluttering, or moving over something.",
        context: "The participle agrees with רוּחַ, a grammatically feminine noun.",
        themeTags: ["Spirit", "movement", "waters"],
        prompt: defaultPrompt
      },
      {
        hebrew: "עַל־פְּנֵי",
        transliteration: "al-penei",
        gloss: "over the face of",
        pronunciation: "ahl-peh-NAY",
        root: "פנה",
        rootTransliteration: "panah / panim",
        rootMeaning: "face, surface, presence",
        strongs: "H6440",
        form: "Repeated prepositional phrase",
        grammar: "Repeats the earlier spatial phrase.",
        lexiconNote:
          "The repeated phrase gives the verse a balanced visual structure.",
        context: "The repetition mirrors the earlier phrase over the deep.",
        themeTags: ["space", "repetition", "surface"],
        prompt: defaultPrompt
      },
      {
        hebrew: "הַמָּיִם",
        transliteration: "hamayim",
        gloss: "the waters",
        pronunciation: "hah-MAH-yeem",
        root: "מים",
        rootTransliteration: "mayim",
        rootMeaning: "water, waters",
        strongs: "H4325",
        form: "Definite plural noun",
        grammar: "Definite object of the repeated spatial phrase.",
        lexiconNote:
          "מַיִם is plural in form and commonly translated as water or waters.",
        context: "Waters are central in the early creation ordering sequence.",
        themeTags: ["waters", "creation setting"],
        prompt: defaultPrompt
      }
    ]
  },
  {
    reference: "Genesis 1:3",
    english: "And God said, 'Let there be light,' and there was light.",
    context:
      "Creation begins through divine speech. The short command and immediate result give the verse its force.",
    words: [
      {
        hebrew: "וַיֹּאמֶר",
        transliteration: "vayomer",
        gloss: "and he said",
        pronunciation: "vah-YOH-mer",
        root: "אמר",
        rootTransliteration: "amar",
        rootMeaning: "say, speak",
        strongs: "H559",
        form: "Wayyiqtol verb",
        grammar: "A standard Hebrew narrative form that moves the story forward.",
        lexiconNote:
          "אמר is the ordinary verb for speaking, but in Genesis 1 divine speech creates and orders.",
        context: "A standard Hebrew narrative form that moves the story forward.",
        themeTags: ["speech", "creation", "narrative"],
        prompt: defaultPrompt
      },
      {
        hebrew: "אֱלֹהִים",
        transliteration: "elohim",
        gloss: "God",
        pronunciation: "eh-loh-HEEM",
        root: "אלהים",
        rootTransliteration: "elohim",
        rootMeaning: "God, deity, mighty one",
        strongs: "H430",
        form: "Noun",
        grammar: "Subject of וַיֹּאמֶר.",
        lexiconNote:
          "The speaker is the creator introduced in Genesis 1:1.",
        context: "The speaker is the same God who created in verse 1.",
        themeTags: ["God", "speech"],
        prompt: defaultPrompt
      },
      {
        hebrew: "יְהִי",
        transliteration: "yehi",
        gloss: "let there be",
        pronunciation: "yeh-HEE",
        root: "היה",
        rootTransliteration: "hayah",
        rootMeaning: "be, become, happen",
        strongs: "H1961",
        form: "Jussive-like Qal form",
        grammar: "A command or volitive expression calling something into existence.",
        lexiconNote:
          "The form expresses a desired or commanded state: 'let it be.'",
        context: "A command or volitive expression calling something into existence.",
        themeTags: ["command", "creation", "being"],
        prompt: defaultPrompt
      },
      {
        hebrew: "אוֹר",
        transliteration: "or",
        gloss: "light",
        pronunciation: "ohr",
        root: "אור",
        rootTransliteration: "or",
        rootMeaning: "light",
        strongs: "H216",
        form: "Noun",
        grammar: "Object or result named in the command.",
        lexiconNote:
          "אוֹר is light as illumination; later Genesis 1 distinguishes light-bearing bodies.",
        context: "Light appears before sun and moon, so the focus is order, visibility, and separation.",
        themeTags: ["light", "order", "creation"],
        prompt: defaultPrompt
      },
      {
        hebrew: "וַיְהִי־אוֹר",
        transliteration: "vayehi-or",
        gloss: "and there was light",
        pronunciation: "vah-yeh-HEE ohr",
        root: "היה / אור",
        rootTransliteration: "hayah / or",
        rootMeaning: "be / light",
        strongs: "H1961 / H216",
        form: "Verb + noun joined by maqqef",
        grammar: "The result echoes the command almost exactly.",
        lexiconNote:
          "The repeated היה + אור pattern highlights immediate fulfillment.",
        context: "The result echoes the command almost exactly.",
        themeTags: ["fulfillment", "light", "creation"],
        prompt: defaultPrompt
      }
    ]
  },
  {
    reference: "Genesis 1:4",
    english: "And God saw the light, that it was good; and God separated between the light and between the darkness.",
    context:
      "God evaluates and separates. These two actions become a pattern in the chapter: naming, distinguishing, and ordering.",
    words: [
      {
        hebrew: "וַיַּרְא",
        transliteration: "vayyar",
        gloss: "and he saw",
        pronunciation: "vah-YAHR",
        root: "ראה",
        rootTransliteration: "ra'ah",
        rootMeaning: "see, perceive, look",
        strongs: "H7200",
        form: "Wayyiqtol verb",
        grammar: "A narrative verb introducing God's evaluation.",
        lexiconNote:
          "ראה can mean physical seeing or evaluative perception.",
        context: "A narrative verb introducing God's evaluation.",
        themeTags: ["seeing", "evaluation"],
        prompt: defaultPrompt
      },
      {
        hebrew: "אֱלֹהִים",
        transliteration: "elohim",
        gloss: "God",
        pronunciation: "eh-loh-HEEM",
        root: "אלהים",
        rootTransliteration: "elohim",
        rootMeaning: "God, deity, mighty one",
        strongs: "H430",
        form: "Noun",
        grammar: "Subject of the evaluative verb.",
        lexiconNote:
          "God is the evaluator of creation's goodness.",
        context: "God is the evaluator of creation's goodness.",
        themeTags: ["God", "evaluation"],
        prompt: defaultPrompt
      },
      {
        hebrew: "אֶת־הָאוֹר",
        transliteration: "et-ha'or",
        gloss: "the light",
        pronunciation: "et-hah-OHR",
        root: "אור",
        rootTransliteration: "or",
        rootMeaning: "light",
        strongs: "H853 / H216",
        form: "Object marker + definite noun",
        grammar: "The object marker is joined to the noun by maqqef.",
        lexiconNote:
          "The אֶת marker identifies the definite direct object.",
        context: "The object marker is joined to the noun by maqqef.",
        themeTags: ["light", "syntax"],
        prompt: defaultPrompt
      },
      {
        hebrew: "כִּי־טוֹב",
        transliteration: "ki-tov",
        gloss: "that it was good",
        pronunciation: "kee-TOHV",
        root: "טוב",
        rootTransliteration: "tov",
        rootMeaning: "good, pleasant, fitting",
        strongs: "H3588 / H2896",
        form: "Particle + adjective",
        grammar: "Evaluation clause introduced by כִּי.",
        lexiconNote:
          "טוֹב can refer to goodness, beauty, usefulness, or fittingness.",
        context: "Good here means fitting, beneficial, or rightly ordered.",
        themeTags: ["goodness", "evaluation", "order"],
        prompt: defaultPrompt
      },
      {
        hebrew: "וַיַּבְדֵּל",
        transliteration: "vayyavdel",
        gloss: "and he separated",
        pronunciation: "vah-yav-DALE",
        root: "בדל",
        rootTransliteration: "badal",
        rootMeaning: "separate, divide, distinguish",
        strongs: "H914",
        form: "Hiphil wayyiqtol verb",
        grammar: "Causative stem: he caused separation or made a distinction.",
        lexiconNote:
          "בדל is a key ordering verb in Genesis 1.",
        context: "God creates order by making meaningful distinctions.",
        themeTags: ["separation", "order", "creation"],
        prompt: defaultPrompt
      },
      {
        hebrew: "אֱלֹהִים",
        transliteration: "elohim",
        gloss: "God",
        pronunciation: "eh-loh-HEEM",
        root: "אלהים",
        rootTransliteration: "elohim",
        rootMeaning: "God, deity, mighty one",
        strongs: "H430",
        form: "Noun",
        grammar: "Repeated subject after the verb.",
        lexiconNote:
          "The repeated subject slows the line and emphasizes divine action.",
        context: "The repeated subject slows the line and emphasizes divine action.",
        themeTags: ["God", "separation"],
        prompt: defaultPrompt
      },
      {
        hebrew: "בֵּין",
        transliteration: "bein",
        gloss: "between",
        pronunciation: "bayn",
        root: "בין",
        rootTransliteration: "bein",
        rootMeaning: "between, among",
        strongs: "H996",
        form: "Preposition",
        grammar: "Often paired with a second בֵּין or וּבֵין.",
        lexiconNote:
          "The repeated 'between...and between...' construction is normal Hebrew style.",
        context: "Often paired with a second בֵּין or וּבֵין.",
        themeTags: ["separation", "syntax"],
        prompt: defaultPrompt
      },
      {
        hebrew: "הָאוֹר",
        transliteration: "ha'or",
        gloss: "the light",
        pronunciation: "hah-OHR",
        root: "אור",
        rootTransliteration: "or",
        rootMeaning: "light",
        strongs: "H216",
        form: "Definite noun",
        grammar: "One side of the separation.",
        lexiconNote:
          "The article ה marks the noun as definite: the light already created.",
        context: "One side of the separation.",
        themeTags: ["light", "separation"],
        prompt: defaultPrompt
      },
      {
        hebrew: "וּבֵין",
        transliteration: "uvein",
        gloss: "and between",
        pronunciation: "oo-VAYN",
        root: "בין",
        rootTransliteration: "bein",
        rootMeaning: "between, among",
        strongs: "H996",
        form: "Conjunction + preposition",
        grammar: "Completes the Hebrew 'between X and between Y' construction.",
        lexiconNote:
          "The prefixed ו joins the second half of the separation formula.",
        context: "Completes the Hebrew 'between X and between Y' construction.",
        themeTags: ["separation", "syntax"],
        prompt: defaultPrompt
      },
      {
        hebrew: "הַחֹשֶׁךְ",
        transliteration: "hachoshekh",
        gloss: "the darkness",
        pronunciation: "hah-KHOH-shekh",
        root: "חשׁך",
        rootTransliteration: "choshekh",
        rootMeaning: "darkness",
        strongs: "H2822",
        form: "Definite noun",
        grammar: "The other side of the separation.",
        lexiconNote:
          "The article ה marks the darkness as the counterpart to the light.",
        context: "The other side of the separation.",
        themeTags: ["darkness", "separation"],
        prompt: defaultPrompt
      }
    ]
  },
  {
    reference: "Genesis 1:5",
    english:
      "And God called the light Day, and the darkness he called Night. And there was evening and there was morning, one day.",
    context:
      "Naming completes the first ordering act. The evening-morning formula marks the first day in the chapter's repeated structure.",
    words: [
      {
        hebrew: "וַיִּקְרָא",
        transliteration: "vayyiqra",
        gloss: "and he called",
        pronunciation: "vah-yeek-RAH",
        root: "קרא",
        rootTransliteration: "qara",
        rootMeaning: "call, name, proclaim",
        strongs: "H7121",
        form: "Wayyiqtol verb",
        grammar: "Narrative verb introducing the naming act.",
        lexiconNote:
          "קרא can mean call out, summon, read, or name depending on context.",
        context: "Naming is an act of authority and classification.",
        themeTags: ["naming", "authority", "order"],
        prompt: defaultPrompt
      },
      {
        hebrew: "אֱלֹהִים",
        transliteration: "elohim",
        gloss: "God",
        pronunciation: "eh-loh-HEEM",
        root: "אלהים",
        rootTransliteration: "elohim",
        rootMeaning: "God, deity, mighty one",
        strongs: "H430",
        form: "Noun",
        grammar: "Subject of the naming verb.",
        lexiconNote:
          "God names what God has separated.",
        context: "God names what God has separated.",
        themeTags: ["God", "naming"],
        prompt: defaultPrompt
      },
      {
        hebrew: "לָאוֹר",
        transliteration: "la'or",
        gloss: "to the light",
        pronunciation: "lah-OHR",
        root: "אור",
        rootTransliteration: "or",
        rootMeaning: "light",
        strongs: "H216",
        form: "Preposition לְ + definite noun",
        grammar: "Hebrew says 'called to the light Day,' an idiom for naming.",
        lexiconNote:
          "The preposition ל can introduce the thing being named.",
        context: "Hebrew says 'called to the light Day,' an idiom for naming.",
        themeTags: ["light", "naming", "idiom"],
        prompt: defaultPrompt
      },
      {
        hebrew: "יוֹם",
        transliteration: "yom",
        gloss: "day",
        pronunciation: "yohm",
        root: "יום",
        rootTransliteration: "yom",
        rootMeaning: "day, daytime",
        strongs: "H3117",
        form: "Noun",
        grammar: "Name assigned to the light.",
        lexiconNote:
          "יוֹם can mean daylight period or a full day depending on context.",
        context: "Can mean daylight period or a full day depending on context.",
        themeTags: ["day", "time", "naming"],
        prompt: defaultPrompt
      },
      {
        hebrew: "וְלַחֹשֶׁךְ",
        transliteration: "velachoshekh",
        gloss: "and to the darkness",
        pronunciation: "veh-lah-KHOH-shekh",
        root: "חשׁך",
        rootTransliteration: "choshekh",
        rootMeaning: "darkness",
        strongs: "H2822",
        form: "Conjunction + preposition + definite noun",
        grammar: "The second named realm.",
        lexiconNote:
          "The prefixed ו links the second naming action to the first.",
        context: "The second named realm.",
        themeTags: ["darkness", "naming"],
        prompt: defaultPrompt
      },
      {
        hebrew: "קָרָא",
        transliteration: "qara",
        gloss: "he called",
        pronunciation: "kah-RAH",
        root: "קרא",
        rootTransliteration: "qara",
        rootMeaning: "call, name, proclaim",
        strongs: "H7121",
        form: "Qal perfect, 3rd masculine singular",
        grammar: "The verb order shifts, but God remains the implied subject.",
        lexiconNote:
          "The repeated naming verb balances the first half of the sentence.",
        context: "The verb order shifts, but God remains the implied subject.",
        themeTags: ["naming", "grammar"],
        prompt: defaultPrompt
      },
      {
        hebrew: "לָיְלָה",
        transliteration: "laylah",
        gloss: "night",
        pronunciation: "LAI-lah",
        root: "ליל",
        rootTransliteration: "layil",
        rootMeaning: "night",
        strongs: "H3915",
        form: "Noun",
        grammar: "Name assigned to the darkness.",
        lexiconNote:
          "לַיְלָה names the dark period in contrast with יוֹם.",
        context: "The named counterpart to day.",
        themeTags: ["night", "time", "naming"],
        prompt: defaultPrompt
      },
      {
        hebrew: "וַיְהִי־עֶרֶב",
        transliteration: "vayehi-erev",
        gloss: "and there was evening",
        pronunciation: "vah-yeh-HEE EH-rev",
        root: "היה / ערב",
        rootTransliteration: "hayah / erev",
        rootMeaning: "be / evening",
        strongs: "H1961 / H6153",
        form: "Verb + noun",
        grammar: "The first half of the day-closing formula.",
        lexiconNote:
          "עֶרֶב refers to evening, the transition into darkness.",
        context: "The first half of the day-closing formula.",
        themeTags: ["evening", "time", "day formula"],
        prompt: defaultPrompt
      },
      {
        hebrew: "וַיְהִי־בֹקֶר",
        transliteration: "vayehi-voqer",
        gloss: "and there was morning",
        pronunciation: "vah-yeh-HEE VOH-ker",
        root: "היה / בקר",
        rootTransliteration: "hayah / boqer",
        rootMeaning: "be / morning",
        strongs: "H1961 / H1242",
        form: "Verb + noun",
        grammar: "The second half of the day-closing formula.",
        lexiconNote:
          "בֹּקֶר refers to morning, the transition into daylight.",
        context: "The second half of the formula.",
        themeTags: ["morning", "time", "day formula"],
        prompt: defaultPrompt
      },
      {
        hebrew: "יוֹם",
        transliteration: "yom",
        gloss: "day",
        pronunciation: "yohm",
        root: "יום",
        rootTransliteration: "yom",
        rootMeaning: "day, daytime",
        strongs: "H3117",
        form: "Noun",
        grammar: "The unit being counted.",
        lexiconNote:
          "The meaning of יוֹם is guided by its immediate phrase and larger context.",
        context: "The unit being counted.",
        themeTags: ["day", "time", "counting"],
        prompt: defaultPrompt
      },
      {
        hebrew: "אֶחָד",
        transliteration: "echad",
        gloss: "one",
        pronunciation: "eh-KHAHD",
        root: "אחד",
        rootTransliteration: "echad",
        rootMeaning: "one, single, first in count",
        strongs: "H259",
        form: "Cardinal number",
        grammar: "Counts the first day.",
        lexiconNote:
          "אֶחָד is the basic Hebrew cardinal number 'one.'",
        context: "The first counted day; later verses use ordinal-style phrasing.",
        themeTags: ["counting", "day", "time"],
        prompt: defaultPrompt
      }
    ]
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
const selectedPronunciation = document.querySelector("#selectedPronunciation");
const selectedRoot = document.querySelector("#selectedRoot");
const selectedStrongs = document.querySelector("#selectedStrongs");
const selectedForm = document.querySelector("#selectedForm");
const selectedGrammar = document.querySelector("#selectedGrammar");
const selectedContext = document.querySelector("#selectedContext");
const selectedPrompt = document.querySelector("#selectedPrompt");
const blueLetterBibleButton = document.querySelector("#blueLetterBibleButton");
const googleTranslateButton = document.querySelector("#googleTranslateButton");
const hearWholeVerseButton = document.querySelector("#hearWholeVerseButton");
const aboutSourcesButton = document.querySelector("#aboutSourcesButton");
const aboutSourcesPanel = document.querySelector("#aboutSourcesPanel");

function displayValue(value, fallback = "Not added yet") {
  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : fallback;
  }

  return value || fallback;
}

function formatRoot(word) {
  const rootParts = [
    word.root,
    word.rootTransliteration ? `(${word.rootTransliteration})` : "",
    word.rootMeaning ? `- ${word.rootMeaning}` : ""
  ].filter(Boolean);

  return rootParts.length ? rootParts.join(" ") : "Not added yet";
}

function getPrimaryStrongs(strongs) {
  return strongs?.match(/[HG]\d+/i)?.[0] || "";
}

function getBlueLetterBibleUrl(strongs) {
  const primaryStrongs = getPrimaryStrongs(strongs);
  return primaryStrongs
    ? `https://www.blueletterbible.org/lexicon/${primaryStrongs.toLowerCase()}/kjv/wlc/0-1/`
    : "";
}

function getGoogleTranslateUrl(hebrew) {
  return `https://translate.google.com/?sl=iw&tl=en&text=${encodeURIComponent(hebrew)}&op=translate`;
}

function getHebrewVerse(verse) {
  return verse.words.map((word) => word.hebrew).join(" ");
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
  hearWholeVerseButton.dataset.url = getGoogleTranslateUrl(getHebrewVerse(verse));
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
  const contextParts = [
    word.lexiconNote ? `Lexicon: ${word.lexiconNote}` : "",
    word.context,
    word.themeTags?.length ? `Themes: ${word.themeTags.join(", ")}` : ""
  ].filter(Boolean);

  selectedHebrew.textContent = displayValue(word.hebrew);
  selectedTransliteration.textContent = displayValue(word.transliteration, "");
  selectedGloss.textContent = displayValue(word.gloss);
  selectedPronunciation.textContent = displayValue(word.pronunciation, "Pronunciation coming soon");
  selectedRoot.textContent = formatRoot(word);
  selectedStrongs.textContent = displayValue(word.strongs);
  selectedForm.textContent = displayValue(word.form);
  selectedGrammar.textContent = displayValue(word.grammar);
  selectedContext.textContent = displayValue(contextParts.join(" "));
  selectedPrompt.textContent = displayValue(word.prompt, defaultPrompt);

  const blueLetterBibleUrl = getBlueLetterBibleUrl(word.strongs);
  blueLetterBibleButton.disabled = !blueLetterBibleUrl;
  blueLetterBibleButton.dataset.url = blueLetterBibleUrl;
  blueLetterBibleButton.textContent = blueLetterBibleUrl
    ? "Open in Blue Letter Bible"
    : "No Blue Letter Bible link yet";

  googleTranslateButton.dataset.url = getGoogleTranslateUrl(word.hebrew);
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

blueLetterBibleButton.addEventListener("click", () => {
  const url = blueLetterBibleButton.dataset.url;
  if (url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
});

googleTranslateButton.addEventListener("click", () => {
  const url = googleTranslateButton.dataset.url;
  if (url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
});

hearWholeVerseButton.addEventListener("click", () => {
  const url = hearWholeVerseButton.dataset.url;
  if (url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
});

aboutSourcesButton.addEventListener("click", () => {
  const isOpen = !aboutSourcesPanel.hidden;
  aboutSourcesPanel.hidden = isOpen;
  aboutSourcesButton.classList.toggle("active", !isOpen);
  aboutSourcesButton.setAttribute("aria-expanded", String(!isOpen));
});

render();
