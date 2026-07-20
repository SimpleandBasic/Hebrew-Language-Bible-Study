import {
  generateNextHebrewAudioSegment,
  getHebrewAudioStatus,
  prepareHebrewAudioTrack,
} from "../src/actions/audio-tools.js";

const VERSE_REFERENCE = "Genesis 1:17";
const LESSON_ID = "514a9fd3-7266-4f01-ac50-b4bb5eef573e";
const HEBREW = "וַיִּתֵּן אֹתָם אֱלֹהִים בִּרְקִיעַ הַשָּׁמָיִם לְהָאִיר עַל־הָאָרֶץ׃";

const SEGMENTS = [
  {
    sort_order: 10,
    segment_type: "opening",
    label: "Opening and welcome",
    spoken_text: "Welcome to Genesis 1:17, Placed to Give Light. Today we will hear the verse, practice its Hebrew, study its key words, trace meaningful Bible connections, see how the theme points us toward Jesus, reflect, and pray.",
    display_transcript: "Welcome to Genesis 1:17 — Placed to Give Light.\n\nWe will hear the verse, practice the Hebrew, study key words, explore biblical cross references, see the whole-Bible connection to Jesus, reflect, and pray.",
    voice_instructions: "Speak warmly, clearly, and reverently.",
    speech_settings: { speed: 0.94 },
  },
  {
    sort_order: 20,
    segment_type: "kjv",
    label: "Genesis 1:17 in the KJV",
    spoken_text: "Genesis chapter one, verse seventeen. And God set them in the firmament of the heaven to give light upon the earth.",
    display_transcript: "Genesis 1:17 KJV\n\nAnd God set them in the firmament of the heaven to give light upon the earth,",
    voice_instructions: "Read clearly and reverently without dramatizing.",
    speech_settings: { speed: 0.94 },
  },
  {
    sort_order: 30,
    segment_type: "hebrew_natural",
    label: "Complete Hebrew verse at natural speed",
    spoken_text: HEBREW,
    display_transcript: HEBREW,
    voice_instructions: "Read only the Hebrew naturally and carefully.",
    speech_settings: { speed: 0.9 },
  },
  {
    sort_order: 40,
    segment_type: "hebrew_slow",
    label: "Complete Hebrew verse slowly by phrase",
    spoken_text: "וַיִּתֵּן אֹתָם אֱלֹהִים. בִּרְקִיעַ הַשָּׁמָיִם. לְהָאִיר עַל־הָאָרֶץ.",
    display_transcript: "וַיִּתֵּן אֹתָם אֱלֹהִים — Vayitten otam Elohim — And God set them.\n\nבִּרְקִיעַ הַשָּׁמָיִם — Birqia hashamayim — In the expanse of the heavens.\n\nלְהָאִיר עַל־הָאָרֶץ — Leha'ir al ha'aretz — To give light upon the earth.",
    voice_instructions: "Read only the Hebrew slowly with natural phrase pauses.",
    speech_settings: { speed: 0.72 },
  },
  {
    sort_order: 50,
    segment_type: "word_study",
    label: "Expanded Hebrew word study",
    spoken_text: "Let us study the key words. Vayitten, וַיִּתֵּן, comes from natan, נתן, Strong's H 5414, meaning to give, put, set, or appoint. Here it is a wayyiqtol verb, third masculine singular: and He set or placed. The same root appears when God gives the rainbow as a covenant sign in Genesis 9:13, when Joseph is given authority in Genesis 41:41, and when the Lord gives wisdom in First Kings 3:12. Context decides whether natan means give, place, appoint, or grant. Otam, אֹתָם, is the direct object marker et, Strong's H 853, with the third masculine plural suffix: them. It identifies the lights as what God placed. Elohim, אֱלֹהִים, Strong's H 430, is God, the mighty Creator. Birqia, בִּרְקִיעַ, contains the preposition be, in, plus raqia, Strong's H 7549, the expanse or firmament. Raqia also appears in Genesis 1:6 through 8 and in Psalm 19:1, where the firmament shows God's handiwork. Hashamayim, הַשָּׁמָיִם, is the heavens, Strong's H 8064. Leha'ir, לְהָאִיר, comes from or, אור, Strong's H 215, to become light or give light. It is a Hiphil infinitive construct, so the idea is to cause light to shine. The same verb describes the pillar of fire giving light in Exodus 13:21, God's face shining upon His people in Numbers 6:25, and the command to arise and shine in Isaiah 60:1. Al, עַל, Strong's H 5921, means upon or over. Ha'aretz, הָאָרֶץ, is the earth or land, Strong's H 776. It appears throughout Genesis and can mean the whole earth or a particular land depending on context. Remember, one Strong's number may cover several forms and shades of meaning. The sentence around the word must guide the best English meaning.",
    display_transcript: "וַיִּתֵּן — Vayitten — and He set or placed. Root נתן, natan. Strong’s H5414.\n\nאֹתָם — Otam — them. Direct object marker אֵת with plural suffix. Strong’s H853.\n\nאֱלֹהִים — Elohim — God. Strong’s H430.\n\nבִּרְקִיעַ — Birqia — in the expanse. רָקִיעַ, raqia. Strong’s H7549.\n\nהַשָּׁמָיִם — Hashamayim — the heavens. Strong’s H8064.\n\nלְהָאִיר — Leha’ir — to cause light to shine. Root אור, or. Strong’s H215.\n\nעַל — Al — upon or over. Strong’s H5921.\n\nהָאָרֶץ — Ha’aretz — the earth or land. Strong’s H776.\n\nOne Strong’s number can include several forms and shades of meaning. Context decides the best English meaning.",
    voice_instructions: "Teach like a patient Hebrew tutor. Pronounce every Hebrew word carefully and clearly distinguish roots, grammar, and examples.",
    speech_settings: { speed: 0.91 },
  },
  {
    sort_order: 60,
    segment_type: "repeat",
    label: "Repeat-after-me practice",
    spoken_text: "Now repeat after me. Vayitten. וַיִּתֵּן. Otam. אֹתָם. Elohim. אֱלֹהִים. Birqia. בִּרְקִיעַ. Hashamayim. הַשָּׁמָיִם. Leha'ir. לְהָאִיר. Al ha'aretz. עַל־הָאָרֶץ. Vayitten otam Elohim. וַיִּתֵּן אֹתָם אֱלֹהִים. Birqia hashamayim. בִּרְקִיעַ הַשָּׁמָיִם. Leha'ir al ha'aretz. לְהָאִיר עַל־הָאָרֶץ.",
    display_transcript: "Repeat aloud:\n\nוַיִּתֵּן — Vayitten\nאֹתָם — Otam\nאֱלֹהִים — Elohim\nבִּרְקִיעַ — Birqia\nהַשָּׁמָיִם — Hashamayim\nלְהָאִיר — Leha’ir\nעַל־הָאָרֶץ — Al ha’aretz\n\nוַיִּתֵּן אֹתָם אֱלֹהִים — Vayitten otam Elohim\nבִּרְקִיעַ הַשָּׁמָיִם — Birqia hashamayim\nלְהָאִיר עַל־הָאָרֶץ — Leha’ir al ha’aretz",
    voice_instructions: "Coach pronunciation and leave natural silence after every item without saying the word pause.",
    speech_settings: { speed: 0.76 },
  },
  {
    sort_order: 70,
    segment_type: "cross_references",
    label: "Biblical cross references",
    spoken_text: "Now let us connect the full verse to other Scriptures. First, Psalm 19:1 says, The heavens declare the glory of God; and the firmament sheweth his handywork. This is a direct thematic connection to the firmament in Genesis. The heavenly lights serve as visible witnesses to their Maker. Second, Psalm 136:7 through 9 praises the One who made great lights, the sun to rule by day, and the moon and stars to rule by night. This closely echoes the creation account and turns creation into worship. Third, Jeremiah 31:35 describes the Lord as the One who gives the sun for a light by day and the ordinances of the moon and stars for a light by night. That passage uses the stable order of creation to assure Israel of God's covenant faithfulness. Fourth, Isaiah 60:19 says the sun shall no more be thy light by day, because the Lord shall be an everlasting light. This is not a denial of Genesis. It shows a later prophetic hope in which God's own glory surpasses created lights. Fifth, Revelation 21:23 says the holy city has no need of the sun or moon, for the glory of God lightens it and the Lamb is its light. This is a broader whole-Bible fulfillment of the light theme. Genesis 1:17 itself is about created lights placed to serve the earth. The later passages show those servants pointing beyond themselves to the Creator's glory.",
    display_transcript: "Biblical Cross References\n\n• Psalm 19:1 — The firmament shows our Father’s handiwork. Direct thematic connection.\n• Psalm 136:7–9 — The great lights become a reason for worship. Close creation echo.\n• Jeremiah 31:35 — The ordered lights picture our Father’s covenant faithfulness. Broader theological use.\n• Isaiah 60:19 — The Lord Himself becomes everlasting light. Prophetic development.\n• Revelation 21:23 — The Lamb is the light of the final city. Whole-Bible fulfillment.\n\nGenesis 1:17 first speaks about created lights serving the earth. Later Scripture develops the theme without changing the verse’s original meaning.",
    voice_instructions: "Teach carefully. Clearly distinguish direct echoes from broader themes and avoid forcing connections.",
    speech_settings: { speed: 0.93 },
  },
  {
    sort_order: 80,
    segment_type: "see_jesus",
    label: "Did You Know? See Jesus Here",
    spoken_text: "Did you know? Genesis 1:17 says that God placed created lights in the heavens so they could give light to the earth. The verse does not hide Jesus in individual Hebrew letters. But the Bible's light story keeps growing. John chapter one says that the true Light was coming into the world, and that the world was made by Him. Jesus says in John 8:12, I am the light of the world. Second Corinthians 4:6 compares the God who commanded light to shine out of darkness with the light of the knowledge of God's glory in the face of Jesus Christ. Genesis gives us lights placed in the heavens to serve the earth. The gospel reveals the Son sent into the world to reveal our Father. Revelation completes the pattern when the Lamb becomes the light of the city. Created light serves. Jesus, the true Light, saves and reveals.",
    display_transcript: "Genesis 1:17 speaks first about created lights serving the earth. It does not hide Jesus inside individual Hebrew letters.\n\nThe whole-Bible theme grows:\n\n• John 1:4–9 — Jesus is the true Light coming into the world.\n• John 8:12 — Jesus says, “I am the light of the world.”\n• 2 Corinthians 4:6 — Creation light becomes a picture of knowing God’s glory in Jesus Christ.\n• Revelation 21:23 — The Lamb lights the final city.\n\nCreated light serves. Jesus, the true Light, saves and reveals.",
    voice_instructions: "Speak with wonder while carefully distinguishing the original meaning of Genesis from later revelation in Jesus.",
    speech_settings: { speed: 0.94 },
  },
  {
    sort_order: 90,
    segment_type: "reflection",
    label: "Practical reflection",
    spoken_text: "Our Father did not merely create the lights. He placed them where their light could serve. Position matters. A gift becomes fruitful when it is placed inside the right assignment. The sun does not chase the moon's job. The moon does not apologize for reflecting light. Each created light faithfully serves from its appointed place. Ace does not need to illuminate every room today. Ask one simple question: Where has our Father placed Ace's light to serve right now? Faithfulness is often less about becoming brighter and more about staying in the place of today's assignment.",
    display_transcript: "Our Father did not merely create the lights. He placed them where their light could serve.\n\nPosition matters. A gift becomes fruitful inside the right assignment.\n\nThe sun does not chase the moon’s job. The moon does not apologize for reflecting light.\n\nAsk: Where has our Father placed Ace’s light to serve today?\n\nFaithfulness is often less about becoming brighter and more about staying in today’s assignment.",
    voice_instructions: "Speak gently, practically, and encouragingly.",
    speech_settings: { speed: 0.94 },
  },
  {
    sort_order: 100,
    segment_type: "prayer",
    label: "Closing prayer",
    spoken_text: "Father, thank You for creating light and placing it with purpose. Thank You that every gift, season, and assignment remains under Your wise hand. Place us where our lives can serve. Keep us from comparing our calling with someone else's. Help us faithfully give the light You have entrusted to us today. Thank You for sending Jesus, the true Light of the world. Let the light of Your glory shine in our hearts through Him. In Jesus' name, amen.",
    display_transcript: "Father, thank You for creating light and placing it with purpose. Place us where our lives can serve. Keep us from comparing our calling with someone else’s. Help us faithfully give the light You have entrusted to us today. Thank You for sending Jesus, the true Light of the world. Let the light of Your glory shine in our hearts through Him. In Jesus’ name, amen.",
    voice_instructions: "Pray warmly and reverently.",
    speech_settings: { speed: 0.92 },
  },
  {
    sort_order: 110,
    segment_type: "final_hebrew",
    label: "Final natural Hebrew reading",
    spoken_text: HEBREW,
    display_transcript: `${HEBREW}\n\nVayitten otam Elohim birqia hashamayim leha'ir al ha'aretz.`,
    voice_instructions: "Read only the Hebrew naturally, carefully, and reverently.",
    speech_settings: { speed: 0.9 },
  },
];

export default async function runGenesis117Proof(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET") {
    return response.status(405).json({ error: "Method not allowed." });
  }

  const options = { env: process.env, fetchFn: fetch };

  try {
    let status;
    try {
      status = await getHebrewAudioStatus({ verse_reference: VERSE_REFERENCE }, options);
    } catch (error) {
      if (!String(error.message || error).includes("not found")) throw error;
      const prepared = await prepareHebrewAudioTrack({
        verse_reference: VERSE_REFERENCE,
        lesson_id: LESSON_ID,
        track_title: "Genesis 1:17 — Placed to Give Light",
        script_version: "v1",
        audio_segments: SEGMENTS,
      }, options);
      status = await getHebrewAudioStatus({ verse_reference: VERSE_REFERENCE }, options);
      return response.status(200).json({ prepared, status });
    }

    if (status.ready) {
      const verified = await getHebrewAudioStatus({ verse_reference: VERSE_REFERENCE, verify_streams: true }, options);
      return response.status(200).json({ complete: verified.ready, status: verified });
    }

    const generation = await generateNextHebrewAudioSegment({ verse_reference: VERSE_REFERENCE }, options);
    return response.status(200).json({ generatedOne: true, generation });
  } catch (error) {
    console.error("Genesis 1:17 proof runner failed.", { message: error.message });
    return response.status(500).json({ error: error.message || String(error) });
  }
}
