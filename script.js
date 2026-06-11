const defaultPrompt =
  "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?";

const verses = [
  {
    "reference": "Genesis 1:1",
    "english": "In the beginning God created the heavens and the earth.",
    "context": "Genesis opens with God already present. Before the heavens, before the earth, and before anything we can see, God is the One who begins the story.",
    "words": [
      {
        "hebrew": "בְּרֵאשִׁית",
        "transliteration": "bereshit",
        "gloss": "in beginning, at first",
        "pronunciation": "buh-ray-SHEET",
        "root": "רֹאשׁ",
        "rootTransliteration": "rosh",
        "rootMeaning": "beginning, first place, starting point",
        "strongs": "H7225",
        "form": "Preposition בְּ + feminine noun רֵאשִׁית",
        "grammar": "Hebrew does not use the word 'the' here, but the whole sentence still points us to the beginning.",
        "lexiconNote": "Bereshit means beginning. It points to the first part, the starting place, the moment where the story opens.",
        "context": "Before the heavens, before the earth, before anything we can see, God is already there.",
        "themeTags": [
          "beginning",
          "creation",
          "time"
        ],
        "prompt": "Notice that the Bible begins with God, not with fear, chaos, or accident. What does that show you about the story you are stepping into?"
      },
      {
        "hebrew": "בָּרָא",
        "transliteration": "bara",
        "gloss": "he created",
        "pronunciation": "bah-RAH",
        "root": "ברא",
        "rootTransliteration": "b-r-a",
        "rootMeaning": "create, bring into being, make something real",
        "strongs": "H1254",
        "form": "Qal perfect, 3rd person masculine singular",
        "grammar": "This action belongs to God. He is the One doing the creating.",
        "lexiconNote": "Bara is a creation word. In Genesis 1, it draws our eyes to God's power to bring things into being.",
        "context": "The verse does not pause to explain every detail. It wants us to see who is acting: God creates.",
        "themeTags": [
          "creation",
          "divine action"
        ],
        "prompt": "Let the simple sentence land: God created. What confidence does that give to the rest of the chapter?"
      },
      {
        "hebrew": "אֱלֹהִים",
        "transliteration": "elohim",
        "gloss": "God",
        "pronunciation": "eh-loh-HEEM",
        "root": "אלהים",
        "rootTransliteration": "elohim",
        "rootMeaning": "God, deity, mighty one",
        "strongs": "H430",
        "form": "Masculine plural form used here with singular meaning",
        "grammar": "This is the subject of the sentence. God is the main actor.",
        "lexiconNote": "Elohim can look unusual to beginners because of its form, but here it clearly names the God who creates.",
        "context": "The first Person we meet in Scripture is God. Creation begins with Him, not with a problem that He has to solve.",
        "themeTags": [
          "God",
          "grammar",
          "subject"
        ],
        "prompt": "Notice how Scripture starts by putting God at the center. How does that shape the way you read everything after this?"
      },
      {
        "hebrew": "אֵת",
        "transliteration": "et",
        "gloss": "direct-object marker",
        "pronunciation": "ayt",
        "root": "",
        "rootTransliteration": "",
        "rootMeaning": "a small Hebrew marker that points to the object",
        "strongs": "H853",
        "form": "Object marker particle",
        "grammar": "This little word points to what God created next.",
        "lexiconNote": "Et is usually quiet in English. You may not see it translated, but Hebrew readers feel it guiding the sentence.",
        "context": "It is like a small signpost. It tells us to look ahead to the heavens.",
        "themeTags": [
          "syntax",
          "object marker"
        ],
        "prompt": "Some Hebrew words do quiet work. What does this small word help you follow in the sentence?"
      },
      {
        "hebrew": "הַשָּׁמַיִם",
        "transliteration": "hashamayim",
        "gloss": "the heavens, the sky",
        "pronunciation": "hah-shah-MAH-yeem",
        "root": "שׁמים",
        "rootTransliteration": "shamayim",
        "rootMeaning": "heavens, sky",
        "strongs": "H8064",
        "form": "Definite plural-like noun with הַ",
        "grammar": "This is one of the things God created.",
        "lexiconNote": "Shamayim can point to the sky above us or the heavens beyond us.",
        "context": "Together with earth, this gives a wide picture: everything above and everything below belongs to God's creative work.",
        "themeTags": [
          "heavens",
          "cosmos",
          "creation"
        ],
        "prompt": "Picture the whole scene opening wide. What happens in your heart when the first verse says all of it begins with God?"
      },
      {
        "hebrew": "וְאֵת",
        "transliteration": "ve'et",
        "gloss": "and [the object marker]",
        "pronunciation": "veh-AYT",
        "root": "ו + את",
        "rootTransliteration": "vav + et",
        "rootMeaning": "and, with the same little object marker",
        "strongs": "H853",
        "form": "Conjunction וְ + object marker",
        "grammar": "This connects the next part of what God created.",
        "lexiconNote": "Hebrew often clips small words to the front of other words. One little prefix can carry the idea of 'and.'",
        "context": "This word joins the heavens and the earth together in one sweeping line.",
        "themeTags": [
          "syntax",
          "conjunction",
          "object marker"
        ],
        "prompt": "Notice how Hebrew can say a lot with a small beginning sound. What is being joined together here?"
      },
      {
        "hebrew": "הָאָרֶץ",
        "transliteration": "ha'aretz",
        "gloss": "the earth, the land",
        "pronunciation": "hah-AH-rets",
        "root": "ארץ",
        "rootTransliteration": "erets",
        "rootMeaning": "earth, land, ground, the place beneath us",
        "strongs": "H776",
        "form": "Definite feminine noun with הָ",
        "grammar": "This is the second part named in what God created.",
        "lexiconNote": "Eretz can mean earth, land, or ground. Here it gives us the world below the heavens.",
        "context": "The verse brings the picture down from the heights to the ground. Heaven and earth are both held in God's first act.",
        "themeTags": [
          "earth",
          "land",
          "cosmos"
        ],
        "prompt": "Look at the pair: heavens and earth. What does it tell you about the size of God's creative care?"
      }
    ]
  },
  {
    "reference": "Genesis 1:2",
    "english": "Now the earth was formless and empty, darkness was over the face of the deep, and the Spirit of God was hovering over the face of the waters.",
    "context": "Verse 2 shows the earth before it is shaped and filled. The scene feels dark and empty, but God's Spirit is already near, moving over the waters.",
    "words": [
      {
        "hebrew": "וְהָאָרֶץ",
        "transliteration": "veha'aretz",
        "gloss": "and the earth",
        "pronunciation": "veh-hah-AH-rets",
        "root": "ארץ",
        "rootTransliteration": "erets",
        "rootMeaning": "earth, land, ground, territory",
        "strongs": "H776",
        "form": "Conjunction + definite noun",
        "grammar": "The first sound means 'and,' and the front marker points to 'the earth.'",
        "lexiconNote": "The earth from verse 1 now comes into focus. The camera moves closer.",
        "context": "The focus narrows from the whole cosmos to the earth.",
        "themeTags": [
          "earth",
          "creation setting"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      },
      {
        "hebrew": "הָיְתָה",
        "transliteration": "hayetah",
        "gloss": "was",
        "pronunciation": "hai-TAH",
        "root": "היה",
        "rootTransliteration": "hayah",
        "rootMeaning": "be, become, happen",
        "strongs": "H1961",
        "form": "Qal perfect, 3rd feminine singular",
        "grammar": "The verb matches the Hebrew word for earth.",
        "lexiconNote": "Hayah is a basic word for being or becoming. Here it tells us what the earth was like.",
        "context": "This word opens the description of the earth before God begins filling and shaping it.",
        "themeTags": [
          "state",
          "grammar"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      },
      {
        "hebrew": "תֹהוּ",
        "transliteration": "tohu",
        "gloss": "formlessness",
        "pronunciation": "TOH-hoo",
        "root": "תהו",
        "rootTransliteration": "tohu",
        "rootMeaning": "formless, empty, not yet shaped",
        "strongs": "H8414",
        "form": "Noun",
        "grammar": "This is the first word in a two-word picture.",
        "lexiconNote": "Tohu gives the feeling of a place not yet shaped for life.",
        "context": "The earth is not finished yet. It is waiting for God's forming word.",
        "themeTags": [
          "formlessness",
          "disorder"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      },
      {
        "hebrew": "וָבֹהוּ",
        "transliteration": "vavohu",
        "gloss": "and emptiness",
        "pronunciation": "vah-VOH-hoo",
        "root": "בהו",
        "rootTransliteration": "bohu",
        "rootMeaning": "emptiness, void",
        "strongs": "H922",
        "form": "Conjunction + noun",
        "grammar": "This word pairs with tohu and even sounds like it.",
        "lexiconNote": "Bohu adds to the picture of emptiness. Together, the words feel hollow and unfinished.",
        "context": "The phrase paints a world that is empty, open, and ready for God to fill.",
        "themeTags": [
          "emptiness",
          "disorder"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      },
      {
        "hebrew": "וְחֹשֶׁךְ",
        "transliteration": "vechoshekh",
        "gloss": "and darkness",
        "pronunciation": "veh-KHOH-shekh",
        "root": "חשׁך",
        "rootTransliteration": "choshekh",
        "rootMeaning": "darkness",
        "strongs": "H2822",
        "form": "Conjunction + noun",
        "grammar": "This adds one more piece to the scene.",
        "lexiconNote": "Choshekh means darkness. Here the world is still waiting for God's light.",
        "context": "Darkness covers the scene, but it is not the final word.",
        "themeTags": [
          "darkness",
          "pre-creation scene"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      },
      {
        "hebrew": "עַל־פְּנֵי",
        "transliteration": "al-penei",
        "gloss": "over the face of",
        "pronunciation": "ahl-peh-NAY",
        "root": "פנה",
        "rootTransliteration": "panah / panim",
        "rootMeaning": "face, surface, presence",
        "strongs": "H6440",
        "form": "Preposition + plural construct noun",
        "grammar": "These words are tied together and work like one little phrase.",
        "lexiconNote": "The phrase pictures something spread over the face or surface of the deep.",
        "context": "Hebrew gives us a picture of something resting over the surface.",
        "themeTags": [
          "space",
          "surface",
          "idiom"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      },
      {
        "hebrew": "תְהוֹם",
        "transliteration": "tehom",
        "gloss": "the deep",
        "pronunciation": "teh-HOME",
        "root": "תהום",
        "rootTransliteration": "tehom",
        "rootMeaning": "deep, watery depth",
        "strongs": "H8415",
        "form": "Noun",
        "grammar": "This is the deep surface the darkness is over.",
        "lexiconNote": "Tehom pictures a deep, watery place. It feels wide, dark, and unfinished.",
        "context": "The deep is part of the unformed world God is about to order.",
        "themeTags": [
          "waters",
          "deep",
          "creation setting"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      },
      {
        "hebrew": "וְרוּחַ",
        "transliteration": "veruach",
        "gloss": "and spirit / wind / breath",
        "pronunciation": "veh-ROO-akh",
        "root": "רוח",
        "rootTransliteration": "ruach",
        "rootMeaning": "spirit, wind, breath",
        "strongs": "H7307",
        "form": "Conjunction + noun",
        "grammar": "This Hebrew word can carry more than one picture: spirit, wind, or breath.",
        "lexiconNote": "Ruach can mean spirit, wind, or breath. It is a living, moving word.",
        "context": "This word lets us feel movement and nearness in the middle of the dark scene.",
        "themeTags": [
          "Spirit",
          "wind",
          "ambiguity"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      },
      {
        "hebrew": "אֱלֹהִים",
        "transliteration": "elohim",
        "gloss": "God",
        "pronunciation": "eh-loh-HEEM",
        "root": "אלהים",
        "rootTransliteration": "elohim",
        "rootMeaning": "God, deity, mighty one",
        "strongs": "H430",
        "form": "Noun",
        "grammar": "This word completes the phrase Spirit of God.",
        "lexiconNote": "Here the moving presence is connected to God Himself.",
        "context": "The Spirit of God is near the dark waters before the first light appears.",
        "themeTags": [
          "God",
          "Spirit",
          "interpretation"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      },
      {
        "hebrew": "מְרַחֶפֶת",
        "transliteration": "merachefet",
        "gloss": "hovering",
        "pronunciation": "meh-rah-KHEH-fet",
        "root": "רחף",
        "rootTransliteration": "rachaf",
        "rootMeaning": "hover, flutter, move over",
        "strongs": "H7363",
        "form": "Piel participle, feminine singular",
        "grammar": "The form connects back to ruach, the Spirit or wind of God.",
        "lexiconNote": "This word gives a gentle picture of hovering or moving over something.",
        "context": "The Spirit of God is not far away. He is hovering over the waters.",
        "themeTags": [
          "Spirit",
          "movement",
          "waters"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      },
      {
        "hebrew": "עַל־פְּנֵי",
        "transliteration": "al-penei",
        "gloss": "over the face of",
        "pronunciation": "ahl-peh-NAY",
        "root": "פנה",
        "rootTransliteration": "panah / panim",
        "rootMeaning": "face, surface, presence",
        "strongs": "H6440",
        "form": "Repeated prepositional phrase",
        "grammar": "These words are tied together and work like one little phrase.",
        "lexiconNote": "The phrase pictures something spread over the face or surface of the deep.",
        "context": "Hebrew gives us a picture of something resting over the surface.",
        "themeTags": [
          "space",
          "repetition",
          "surface"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      },
      {
        "hebrew": "הַמָּיִם",
        "transliteration": "hamayim",
        "gloss": "the waters",
        "pronunciation": "hah-MAH-yeem",
        "root": "מים",
        "rootTransliteration": "mayim",
        "rootMeaning": "water, waters",
        "strongs": "H4325",
        "form": "Definite plural noun",
        "grammar": "These are the waters beneath the hovering Spirit.",
        "lexiconNote": "Mayim means water or waters. In this verse, the waters fill the early scene.",
        "context": "The waters are part of the world God will soon separate, name, and fill.",
        "themeTags": [
          "waters",
          "creation setting"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      }
    ]
  },
  {
    "reference": "Genesis 1:3",
    "english": "And God said, 'Let there be light,' and there was light.",
    "context": "God speaks into the darkness, and light comes. The verse is short on purpose: God's word is enough.",
    "words": [
      {
        "hebrew": "וַיֹּאמֶר",
        "transliteration": "vayomer",
        "gloss": "and he said",
        "pronunciation": "vah-YOH-mer",
        "root": "אמר",
        "rootTransliteration": "amar",
        "rootMeaning": "say, speak",
        "strongs": "H559",
        "form": "Wayyiqtol verb",
        "grammar": "This is a storytelling verb. It moves the scene forward.",
        "lexiconNote": "Amar simply means speak or say, but when God speaks here, creation responds.",
        "context": "The story turns when God speaks. His word brings change.",
        "themeTags": [
          "speech",
          "creation",
          "narrative"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      },
      {
        "hebrew": "אֱלֹהִים",
        "transliteration": "elohim",
        "gloss": "God",
        "pronunciation": "eh-loh-HEEM",
        "root": "אלהים",
        "rootTransliteration": "elohim",
        "rootMeaning": "God, deity, mighty one",
        "strongs": "H430",
        "form": "Noun",
        "grammar": "God is the One speaking.",
        "lexiconNote": "The same Creator from verse 1 now speaks into the darkness.",
        "context": "The God who created is also the God who speaks.",
        "themeTags": [
          "God",
          "speech"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      },
      {
        "hebrew": "יְהִי",
        "transliteration": "yehi",
        "gloss": "let there be",
        "pronunciation": "yeh-HEE",
        "root": "היה",
        "rootTransliteration": "hayah",
        "rootMeaning": "be, become, happen",
        "strongs": "H1961",
        "form": "Jussive-like Qal form",
        "grammar": "This is a command-like word: let it be.",
        "lexiconNote": "Yehi is short and strong. It calls something into being.",
        "context": "God does not struggle against the darkness. He speaks light into the scene.",
        "themeTags": [
          "command",
          "creation",
          "being"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      },
      {
        "hebrew": "אוֹר",
        "transliteration": "or",
        "gloss": "light",
        "pronunciation": "ohr",
        "root": "אור",
        "rootTransliteration": "or",
        "rootMeaning": "light",
        "strongs": "H216",
        "form": "Noun",
        "grammar": "This is what God calls into the scene.",
        "lexiconNote": "Or means light. It is the first brightness named in the chapter.",
        "context": "Light appears before sun and moon, so the focus is on God's ordering power.",
        "themeTags": [
          "light",
          "order",
          "creation"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      },
      {
        "hebrew": "וַיְהִי־אוֹר",
        "transliteration": "vayehi-or",
        "gloss": "and there was light",
        "pronunciation": "vah-yeh-HEE ohr",
        "root": "היה / אור",
        "rootTransliteration": "hayah / or",
        "rootMeaning": "be / light",
        "strongs": "H1961 / H216",
        "form": "Verb + noun joined by maqqef",
        "grammar": "The result answers the command with almost the same words.",
        "lexiconNote": "God says, 'Let there be light,' and the verse answers, 'and there was light.'",
        "context": "The light comes because God's word is effective.",
        "themeTags": [
          "fulfillment",
          "light",
          "creation"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      }
    ]
  },
  {
    "reference": "Genesis 1:4",
    "english": "And God saw the light, that it was good; and God separated between the light and between the darkness.",
    "context": "God sees the light and calls it good. Then He begins to give creation shape by separating light from darkness.",
    "words": [
      {
        "hebrew": "וַיַּרְא",
        "transliteration": "vayyar",
        "gloss": "and he saw",
        "pronunciation": "vah-YAHR",
        "root": "ראה",
        "rootTransliteration": "ra'ah",
        "rootMeaning": "see, perceive, look",
        "strongs": "H7200",
        "form": "Wayyiqtol verb",
        "grammar": "This storytelling verb shows God looking at what He has made.",
        "lexiconNote": "Ra'ah means to see. Here it is more than noticing; God is looking with care.",
        "context": "God sees the light, and His seeing leads to His good evaluation.",
        "themeTags": [
          "seeing",
          "evaluation"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      },
      {
        "hebrew": "אֱלֹהִים",
        "transliteration": "elohim",
        "gloss": "God",
        "pronunciation": "eh-loh-HEEM",
        "root": "אלהים",
        "rootTransliteration": "elohim",
        "rootMeaning": "God, deity, mighty one",
        "strongs": "H430",
        "form": "Noun",
        "grammar": "God is the One seeing and judging the work.",
        "lexiconNote": "God is the first One to call creation good.",
        "context": "God looks at what He made with care and calls it good.",
        "themeTags": [
          "God",
          "evaluation"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      },
      {
        "hebrew": "אֶת־הָאוֹר",
        "transliteration": "et-ha'or",
        "gloss": "the light",
        "pronunciation": "et-hah-OHR",
        "root": "אור",
        "rootTransliteration": "or",
        "rootMeaning": "light",
        "strongs": "H853 / H216",
        "form": "Object marker + definite noun",
        "grammar": "The little marker and the word for light are tied together.",
        "lexiconNote": "The phrase points to the light God just made.",
        "context": "The verse focuses our attention on the light.",
        "themeTags": [
          "light",
          "syntax"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      },
      {
        "hebrew": "כִּי־טוֹב",
        "transliteration": "ki-tov",
        "gloss": "that it was good",
        "pronunciation": "kee-TOHV",
        "root": "טוב",
        "rootTransliteration": "tov",
        "rootMeaning": "good, beautiful, fitting, right",
        "strongs": "H3588 / H2896",
        "form": "Particle + adjective",
        "grammar": "This phrase tells us what God saw about the light.",
        "lexiconNote": "Tov is a rich word. It can mean good, beautiful, fitting, and right.",
        "context": "God calls the light good. His creation is not random; it is fitting and beautiful.",
        "themeTags": [
          "goodness",
          "evaluation",
          "order"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      },
      {
        "hebrew": "וַיַּבְדֵּל",
        "transliteration": "vayyavdel",
        "gloss": "and he separated",
        "pronunciation": "vah-yav-DALE",
        "root": "בדל",
        "rootTransliteration": "badal",
        "rootMeaning": "separate, divide, distinguish",
        "strongs": "H914",
        "form": "Hiphil wayyiqtol verb",
        "grammar": "The form shows God causing a separation.",
        "lexiconNote": "Badal means to separate or make a clear difference.",
        "context": "God brings order by making a real difference between light and darkness.",
        "themeTags": [
          "separation",
          "order",
          "creation"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      },
      {
        "hebrew": "אֱלֹהִים",
        "transliteration": "elohim",
        "gloss": "God",
        "pronunciation": "eh-loh-HEEM",
        "root": "אלהים",
        "rootTransliteration": "elohim",
        "rootMeaning": "God, deity, mighty one",
        "strongs": "H430",
        "form": "Noun",
        "grammar": "God is named again, keeping our eyes on Him.",
        "lexiconNote": "The repeated name slows the line down. It reminds us who is bringing order.",
        "context": "Even in the separation, the focus stays on God as the One making order.",
        "themeTags": [
          "God",
          "separation"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      },
      {
        "hebrew": "בֵּין",
        "transliteration": "bein",
        "gloss": "between",
        "pronunciation": "bayn",
        "root": "בין",
        "rootTransliteration": "bein",
        "rootMeaning": "between, among",
        "strongs": "H996",
        "form": "Preposition",
        "grammar": "Hebrew often repeats this word when naming two sides.",
        "lexiconNote": "Bein helps draw a clear line between one thing and another.",
        "context": "This word helps us see two sides being held apart.",
        "themeTags": [
          "separation",
          "syntax"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      },
      {
        "hebrew": "הָאוֹר",
        "transliteration": "ha'or",
        "gloss": "the light",
        "pronunciation": "hah-OHR",
        "root": "אור",
        "rootTransliteration": "or",
        "rootMeaning": "light",
        "strongs": "H216",
        "form": "Definite noun",
        "grammar": "This is one side of what God separates.",
        "lexiconNote": "This is the light God has already spoken into being.",
        "context": "Light stands on one side of God's ordered separation.",
        "themeTags": [
          "light",
          "separation"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      },
      {
        "hebrew": "וּבֵין",
        "transliteration": "uvein",
        "gloss": "and between",
        "pronunciation": "oo-VAYN",
        "root": "בין",
        "rootTransliteration": "bein",
        "rootMeaning": "between, among",
        "strongs": "H996",
        "form": "Conjunction + preposition",
        "grammar": "This introduces the second side of the separation.",
        "lexiconNote": "The front sound means 'and,' tying the two sides together.",
        "context": "Hebrew repeats the between language so the separation feels clear.",
        "themeTags": [
          "separation",
          "syntax"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      },
      {
        "hebrew": "הַחֹשֶׁךְ",
        "transliteration": "hachoshekh",
        "gloss": "the darkness",
        "pronunciation": "hah-KHOH-shekh",
        "root": "חשׁך",
        "rootTransliteration": "choshekh",
        "rootMeaning": "darkness",
        "strongs": "H2822",
        "form": "Definite noun",
        "grammar": "This is the other side of what God separates.",
        "lexiconNote": "The darkness is named as the other side of the light.",
        "context": "Darkness remains present, but it no longer rules the whole scene.",
        "themeTags": [
          "darkness",
          "separation"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      }
    ]
  },
  {
    "reference": "Genesis 1:5",
    "english": "And God called the light Day, and the darkness he called Night. And there was evening and there was morning, one day.",
    "context": "God names the light Day and the darkness Night. The first day closes with evening and morning, showing that God's ordered world has begun.",
    "words": [
      {
        "hebrew": "וַיִּקְרָא",
        "transliteration": "vayyiqra",
        "gloss": "and he called",
        "pronunciation": "vah-yeek-RAH",
        "root": "קרא",
        "rootTransliteration": "qara",
        "rootMeaning": "call, name, proclaim",
        "strongs": "H7121",
        "form": "Wayyiqtol verb",
        "grammar": "This storytelling verb introduces God naming something.",
        "lexiconNote": "Qara can mean call or name. Here God gives names to what He has separated.",
        "context": "Naming shows God's care and authority over what He made.",
        "themeTags": [
          "naming",
          "authority",
          "order"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      },
      {
        "hebrew": "אֱלֹהִים",
        "transliteration": "elohim",
        "gloss": "God",
        "pronunciation": "eh-loh-HEEM",
        "root": "אלהים",
        "rootTransliteration": "elohim",
        "rootMeaning": "God, deity, mighty one",
        "strongs": "H430",
        "form": "Noun",
        "grammar": "God is the One doing the naming.",
        "lexiconNote": "God does not only make things; He also names them.",
        "context": "God gives names to the light and darkness He has separated.",
        "themeTags": [
          "God",
          "naming"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      },
      {
        "hebrew": "לָאוֹר",
        "transliteration": "la'or",
        "gloss": "to the light",
        "pronunciation": "lah-OHR",
        "root": "אור",
        "rootTransliteration": "or",
        "rootMeaning": "light",
        "strongs": "H216",
        "form": "Preposition לְ + definite noun",
        "grammar": "Hebrew says this a little differently than English: God called to the light, Day.",
        "lexiconNote": "The small front sound can point to the thing receiving a name.",
        "context": "The light receives a name from God.",
        "themeTags": [
          "light",
          "naming",
          "idiom"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      },
      {
        "hebrew": "יוֹם",
        "transliteration": "yom",
        "gloss": "day",
        "pronunciation": "yohm",
        "root": "יום",
        "rootTransliteration": "yom",
        "rootMeaning": "day, daytime",
        "strongs": "H3117",
        "form": "Noun",
        "grammar": "This is the name given to the light.",
        "lexiconNote": "Yom can mean daytime or a full day. Here it names the light.",
        "context": "Day is the name God gives to the light.",
        "themeTags": [
          "day",
          "time",
          "naming"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      },
      {
        "hebrew": "וְלַחֹשֶׁךְ",
        "transliteration": "velachoshekh",
        "gloss": "and to the darkness",
        "pronunciation": "veh-lah-KHOH-shekh",
        "root": "חשׁך",
        "rootTransliteration": "choshekh",
        "rootMeaning": "darkness",
        "strongs": "H2822",
        "form": "Conjunction + preposition + definite noun",
        "grammar": "This points to the darkness as the next thing being named.",
        "lexiconNote": "The little front sound means 'and,' connecting this naming to the first one.",
        "context": "The darkness is also brought into God's named order.",
        "themeTags": [
          "darkness",
          "naming"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      },
      {
        "hebrew": "קָרָא",
        "transliteration": "qara",
        "gloss": "he called",
        "pronunciation": "kah-RAH",
        "root": "קרא",
        "rootTransliteration": "qara",
        "rootMeaning": "call, name, proclaim",
        "strongs": "H7121",
        "form": "Qal perfect, 3rd masculine singular",
        "grammar": "The word order changes, but God is still the One calling.",
        "lexiconNote": "The naming word comes back so the sentence feels balanced: light is named, and darkness is named.",
        "context": "God's naming work continues with the darkness.",
        "themeTags": [
          "naming",
          "grammar"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      },
      {
        "hebrew": "לָיְלָה",
        "transliteration": "laylah",
        "gloss": "night",
        "pronunciation": "LAI-lah",
        "root": "ליל",
        "rootTransliteration": "layil",
        "rootMeaning": "night",
        "strongs": "H3915",
        "form": "Noun",
        "grammar": "This is the name given to the darkness.",
        "lexiconNote": "Laylah means night. It stands across from day like the other half of the first rhythm.",
        "context": "Night is not outside God's rule. It has a name and a place.",
        "themeTags": [
          "night",
          "time",
          "naming"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      },
      {
        "hebrew": "וַיְהִי־עֶרֶב",
        "transliteration": "vayehi-erev",
        "gloss": "and there was evening",
        "pronunciation": "vah-yeh-HEE EH-rev",
        "root": "היה / ערב",
        "rootTransliteration": "hayah / erev",
        "rootMeaning": "be / evening",
        "strongs": "H1961 / H6153",
        "form": "Verb + noun",
        "grammar": "This begins the closing rhythm of the day.",
        "lexiconNote": "Erev means evening, the turning toward night.",
        "context": "Evening arrives as part of the first day's rhythm.",
        "themeTags": [
          "evening",
          "time",
          "day formula"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      },
      {
        "hebrew": "וַיְהִי־בֹקֶר",
        "transliteration": "vayehi-voqer",
        "gloss": "and there was morning",
        "pronunciation": "vah-yeh-HEE VOH-ker",
        "root": "היה / בקר",
        "rootTransliteration": "hayah / boqer",
        "rootMeaning": "be / morning",
        "strongs": "H1961 / H1242",
        "form": "Verb + noun",
        "grammar": "This completes the closing rhythm of the day.",
        "lexiconNote": "Boqer means morning, the turning toward daylight.",
        "context": "Morning completes the first evening-to-morning rhythm.",
        "themeTags": [
          "morning",
          "time",
          "day formula"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      },
      {
        "hebrew": "יוֹם",
        "transliteration": "yom",
        "gloss": "day",
        "pronunciation": "yohm",
        "root": "יום",
        "rootTransliteration": "yom",
        "rootMeaning": "day, daytime",
        "strongs": "H3117",
        "form": "Noun",
        "grammar": "This is the name given to the light.",
        "lexiconNote": "Yom can mean daytime or a full day. Here it names the light.",
        "context": "Day is the name God gives to the light.",
        "themeTags": [
          "day",
          "time",
          "counting"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
      },
      {
        "hebrew": "אֶחָד",
        "transliteration": "echad",
        "gloss": "one",
        "pronunciation": "eh-KHAHD",
        "root": "אחד",
        "rootTransliteration": "echad",
        "rootMeaning": "one, single, first counted",
        "strongs": "H259",
        "form": "Cardinal number",
        "grammar": "This marks the day as one.",
        "lexiconNote": "Echad means one. The first day is gathered and counted.",
        "context": "The first day is now complete, named, and counted before God.",
        "themeTags": [
          "counting",
          "day",
          "time"
        ],
        "prompt": "Slow down with this word. What picture does it add to the verse, and what does it help you notice about God's work?"
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
const speakWholeVerseButton = document.querySelector("#speakWholeVerseButton");
const speakSelectedWordButton = document.querySelector("#speakSelectedWordButton");
const audioHelperNote = document.querySelector("#audioHelperNote");
const aboutSourcesButton = document.querySelector("#aboutSourcesButton");
const aboutSourcesPanel = document.querySelector("#aboutSourcesPanel");
const speechSupported = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

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

function getSpeechVoices() {
  if (!speechSupported || typeof window.speechSynthesis.getVoices !== "function") {
    return [];
  }

  return window.speechSynthesis.getVoices();
}

function getHebrewVoice() {
  return getSpeechVoices().find((voice) => {
    const language = voice.lang?.toLowerCase() || "";
    const name = voice.name?.toLowerCase() || "";
    return language.startsWith("he") || name.includes("hebrew");
  });
}

function openAudioFallback(url) {
  if (url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function speakHebrew(text, fallbackUrl = "") {
  if (!speechSupported || !text) {
    audioHelperNote.textContent = "Browser audio is not available here. Google Translate is available as a backup audio helper.";
    openAudioFallback(fallbackUrl);
    return;
  }

  const hebrewVoice = getHebrewVoice();
  if (!hebrewVoice) {
    audioHelperNote.textContent = "No browser Hebrew voice was found. Opening Google Translate as the backup audio helper.";
    openAudioFallback(fallbackUrl);
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = hebrewVoice.lang || "he-IL";
  utterance.voice = hebrewVoice;
  utterance.rate = 0.9;
  utterance.onerror = () => {
    audioHelperNote.textContent = "Browser audio could not play this Hebrew text. Opening Google Translate as the backup audio helper.";
    openAudioFallback(fallbackUrl);
  };

  window.speechSynthesis.speak(utterance);
  window.speechSynthesis.resume?.();
}

function setSpeechAvailability() {
  if (speechSupported) {
    speakWholeVerseButton.disabled = false;
    speakSelectedWordButton.disabled = false;
    audioHelperNote.textContent = getHebrewVoice()
      ? "Audio uses your browser's Hebrew voice. Google Translate is available as a backup audio helper."
      : "No browser Hebrew voice is loaded yet. The speaker buttons will use Google Translate as the backup audio helper.";
    return;
  }

  speakWholeVerseButton.disabled = true;
  speakSelectedWordButton.disabled = true;
  audioHelperNote.textContent = "Browser audio is not available here. Google Translate is available as a backup audio helper.";
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
  speakWholeVerseButton.dataset.text = getHebrewVerse(verse);
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
    word.lexiconNote ? `Word note: ${word.lexiconNote}` : "",
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
  speakSelectedWordButton.dataset.text = word.hebrew;
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

speakWholeVerseButton.addEventListener("click", () => {
  speakHebrew(speakWholeVerseButton.dataset.text, hearWholeVerseButton.dataset.url);
});

speakSelectedWordButton.addEventListener("click", () => {
  speakHebrew(speakSelectedWordButton.dataset.text, googleTranslateButton.dataset.url);
});

aboutSourcesButton.addEventListener("click", () => {
  const isOpen = !aboutSourcesPanel.hidden;
  aboutSourcesPanel.hidden = isOpen;
  aboutSourcesButton.classList.toggle("active", !isOpen);
  aboutSourcesButton.setAttribute("aria-expanded", String(!isOpen));
});

render();
setSpeechAvailability();

if (speechSupported) {
  window.speechSynthesis.addEventListener?.("voiceschanged", setSpeechAvailability);
  window.speechSynthesis.onvoiceschanged = setSpeechAvailability;
}
