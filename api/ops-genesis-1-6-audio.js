import { runTool } from '../src/index.js';

const VERSE_REFERENCE = 'Genesis 1:6';
const LESSON_ID = '393a6f90-864d-422a-9b51-1aad64f91100';
const TRACK_TITLE = 'Genesis 1:6 — God Makes Room';

const segments = [
  {
    sort_order: 10,
    segment_type: 'opening',
    label: 'Opening and welcome',
    voice_profile: 'cedar',
    voice_instructions: 'Speak warmly, clearly, reverently, and naturally. Pronounce Hebrew carefully.',
    speech_settings: { speed: 0.94 },
    spoken_text: 'Welcome to Genesis chapter one, verse six, God Makes Room. Today we will hear the King James Bible, listen to the Hebrew naturally and slowly, study important Hebrew words and Strong’s references, practice speaking, connect this verse with the rest of Scripture, see a careful connection to Jesus, reflect, pray, and finish by hearing the Hebrew again.',
    display_transcript: 'Welcome to Genesis 1:6 — God Makes Room. We will listen, study, practice, connect Scripture, reflect, and pray.'
  },
  {
    sort_order: 20,
    segment_type: 'kjv',
    label: 'Genesis 1:6 in the KJV',
    voice_profile: 'cedar',
    voice_instructions: 'Read the King James Bible wording slowly and clearly without adding commentary.',
    speech_settings: { speed: 0.92 },
    spoken_text: 'Genesis chapter one, verse six. And God said, Let there be a firmament in the midst of the waters, and let it divide the waters from the waters.',
    display_transcript: 'Genesis 1:6 KJV\n\n“And God said, Let there be a firmament in the midst of the waters, and let it divide the waters from the waters.”'
  },
  {
    sort_order: 30,
    segment_type: 'hebrew_natural',
    label: 'Complete Hebrew verse at natural speed',
    voice_profile: 'cedar',
    voice_instructions: 'Read only the Biblical Hebrew naturally, confidently, and reverently. Do not translate it.',
    speech_settings: { speed: 0.9 },
    spoken_text: 'וַיֹּאמֶר אֱלֹהִים יְהִי רָקִיעַ בְּתוֹךְ הַמָּיִם וִיהִי מַבְדִּיל בֵּין מַיִם לָמָיִם׃',
    display_transcript: 'וַיֹּאמֶר אֱלֹהִים יְהִי רָקִיעַ בְּתוֹךְ הַמָּיִם וִיהִי מַבְדִּיל בֵּין מַיִם לָמָיִם׃'
  },
  {
    sort_order: 40,
    segment_type: 'hebrew_slow',
    label: 'Hebrew slowly by phrase',
    voice_profile: 'cedar',
    voice_instructions: 'Read only the Biblical Hebrew very slowly by phrase, leaving natural silence between phrases. Do not say the word pause.',
    speech_settings: { speed: 0.72 },
    spoken_text: 'וַיֹּאמֶר אֱלֹהִים. יְהִי רָקִיעַ. בְּתוֹךְ הַמָּיִם. וִיהִי מַבְדִּיל. בֵּין מַיִם לָמָיִם.',
    display_transcript: 'וַיֹּאמֶר אֱלֹהִים — Vayomer Elohim — And God said.\n\nיְהִי רָקִיעַ — Yehi raqia — Let there be an expanse.\n\nבְּתוֹךְ הַמָּיִם — Betokh hammayim — In the midst of the waters.\n\nוִיהִי מַבְדִּיל — Vihi mavdil — And let it be separating.\n\nבֵּין מַיִם לָמָיִם — Bein mayim lamayim — Between waters and waters.'
  },
  {
    sort_order: 50,
    segment_type: 'word_study',
    label: 'Expanded Hebrew word study, part one',
    voice_profile: 'cedar',
    voice_instructions: 'Teach like a patient Hebrew tutor. Clearly pronounce each Hebrew word, root, and Strong’s number.',
    speech_settings: { speed: 0.9 },
    spoken_text: 'The verse begins, Vayomer, וַיֹּאמֶר, and He said. Its root is amar, אָמַר, Strong’s H five fifty nine, meaning to say or speak. Here it is a wayyiqtol narrative verb, third masculine singular. It moves the story forward: and He said. The same root appears throughout Genesis one whenever God speaks creation into order. Psalm thirty three, verse nine says, For he spake, and it was done. The Hebrew uses amar, reminding us that our Father’s speech is effective. Next, Elohim, אֱלֹהִים, Strong’s H four thirty, means God or mighty one. Although the noun has a plural form, it is paired here with singular action and refers to the one Creator. Yehi, יְהִי, comes from hayah, הָיָה, Strong’s H nineteen sixty one, to be, become, or happen. It has command-like jussive force: let there be. Genesis one, verse three uses the same form in Let there be light. Exodus three, verse fourteen uses another form of the same root when God says, I AM THAT I AM. One Strong’s number can cover several forms and shades of meaning, so the sentence and grammar must decide the best English meaning.',
    display_transcript: 'וַיֹּאמֶר — Vayomer — “and He said.” Root אמר, amar. Strong’s H559. Wayyiqtol verb, third masculine singular. Compare Genesis 1 and Psalm 33:9.\n\nאֱלֹהִים — Elohim — “God.” Strong’s H430. Plural-form noun with singular action here.\n\nיְהִי — Yehi — “let there be.” Root היה, hayah. Strong’s H1961. Compare Genesis 1:3 and Exodus 3:14. Context decides the correct shade of meaning.'
  },
  {
    sort_order: 60,
    segment_type: 'word_study',
    label: 'Expanded Hebrew word study, part two',
    voice_profile: 'cedar',
    voice_instructions: 'Teach like a patient Hebrew tutor. Clearly pronounce each Hebrew word, root, and Strong’s number.',
    speech_settings: { speed: 0.9 },
    spoken_text: 'Raqia, רָקִיעַ, Strong’s H seventy five forty nine, means expanse or firmament. It is a masculine singular noun related to the root raqa, רָקַע, to spread out or beat out. Genesis one, verses seven and eight continue the direct description of this expanse. Psalm nineteen, verse one says, The heavens declare the glory of God; and the firmament sheweth his handywork. Ezekiel one, verse twenty two also uses raqia for an awe-inspiring expanse over the living creatures. Betokh, בְּתוֹךְ, means in the midst of. Its noun is tokh, Strong’s H eighty four thirty two, the middle or interior. Exodus fourteen, verse twenty two says Israel went into the midst of the sea. Hammayim and mayim, הַמָּיִם and מַיִם, are forms of mayim, Strong’s H forty three twenty five, waters. The word appears in Genesis one, verse two over the deep, in Exodus fourteen when the sea is divided, and in Isaiah forty three, verse two, When thou passest through the waters, I will be with thee. The same index word can appear with articles and prepositions attached.',
    display_transcript: 'רָקִיעַ — Raqia — expanse or firmament. Strong’s H7549. Compare Genesis 1:7–8, Psalm 19:1, and Ezekiel 1:22.\n\nבְּתוֹךְ — Betokh — in the midst of. Tokh is Strong’s H8432. Compare Exodus 14:22.\n\nמַיִם — Mayim — waters. Strong’s H4325. Compare Genesis 1:2, Exodus 14:21–22, and Isaiah 43:2.'
  },
  {
    sort_order: 70,
    segment_type: 'word_study',
    label: 'Expanded Hebrew word study, part three',
    voice_profile: 'cedar',
    voice_instructions: 'Teach like a patient Hebrew tutor. Clearly pronounce each Hebrew word, root, and Strong’s number.',
    speech_settings: { speed: 0.9 },
    spoken_text: 'Vihi, וִיהִי, also comes from hayah, Strong’s H nineteen sixty one. The conjunction joins the command: and let it be. Mavdil, מַבְדִּיל, comes from badal, בָּדַל, Strong’s H nine fourteen, to separate or distinguish. Mavdil is a Hiphil participle, masculine singular, describing the expanse as causing separation. Genesis one, verse four uses badal when God divides the light from the darkness. Leviticus ten, verse ten uses the same root for distinguishing between holy and unholy. Ezekiel twenty two, verse twenty six warns about failing to distinguish between holy and profane. The root does not automatically mean rejection. It often means making a needed distinction. Bein, בֵּין, Strong’s H nine ninety six, means between or among. It names the relationship between two sides of a boundary. In this verse the phrase is bein mayim lamayim, between waters and waters. Hebrew is showing ordered distinction. Again, Strong’s numbers are indexes, not automatic definitions. Grammar and context decide how each form works.',
    display_transcript: 'וִיהִי — Vihi — “and let it be.” Root היה, hayah. Strong’s H1961.\n\nמַבְדִּיל — Mavdil — separating or causing distinction. Root בדל, badal. Strong’s H914. Compare Genesis 1:4, Leviticus 10:10, and Ezekiel 22:26.\n\nבֵּין — Bein — between. Strong’s H996. It marks the relationship between two sides of a distinction.'
  },
  {
    sort_order: 80,
    segment_type: 'repeat',
    label: 'Repeat-after-me practice',
    voice_profile: 'cedar',
    voice_instructions: 'Coach pronunciation patiently. Leave several seconds of natural silence after every Hebrew word and phrase without announcing the silence.',
    speech_settings: { speed: 0.74 },
    spoken_text: 'Repeat after me. Vayomer. וַיֹּאמֶר. Elohim. אֱלֹהִים. Yehi. יְהִי. Raqia. רָקִיעַ. Betokh. בְּתוֹךְ. Hammayim. הַמָּיִם. Vihi. וִיהִי. Mavdil. מַבְדִּיל. Bein. בֵּין. Mayim. מַיִם. Lamayim. לָמָיִם. Now the phrases. Vayomer Elohim. וַיֹּאמֶר אֱלֹהִים. Yehi raqia. יְהִי רָקִיעַ. Betokh hammayim. בְּתוֹךְ הַמָּיִם. Vihi mavdil. וִיהִי מַבְדִּיל. Bein mayim lamayim. בֵּין מַיִם לָמָיִם.',
    display_transcript: 'Repeat aloud:\n\nוַיֹּאמֶר — Vayomer\nאֱלֹהִים — Elohim\nיְהִי — Yehi\nרָקִיעַ — Raqia\nבְּתוֹךְ — Betokh\nהַמָּיִם — Hammayim\nוִיהִי — Vihi\nמַבְדִּיל — Mavdil\nבֵּין — Bein\nמַיִם — Mayim\nלָמָיִם — Lamayim'
  },
  {
    sort_order: 90,
    segment_type: 'cross_references',
    label: 'Biblical cross references',
    voice_profile: 'cedar',
    voice_instructions: 'Explain Scripture connections carefully. Distinguish direct continuation, repeated vocabulary, and broader themes.',
    speech_settings: { speed: 0.92 },
    spoken_text: 'Biblical cross references. First, Genesis one, verses seven and eight are the direct continuation. God makes the firmament, separates the waters, and names the firmament Heaven. Second, Psalm nineteen, verse one uses the same word raqia and says the firmament shows God’s handiwork. This is a repeated-vocabulary connection. Third, Psalm one hundred forty eight, verse four calls the heavens and the waters above the heavens to praise the Lord. This develops the creation theme. Fourth, First Corinthians fourteen, verses thirty three and forty say that God is not the author of confusion and that all things should be done decently and in order. Paul is not directly interpreting Genesis one, verse six, but the broader biblical theme agrees: our Father brings peaceful order. Fifth, Isaiah forty three, verse two says, When thou passest through the waters, I will be with thee. That passage is not about the creation firmament, yet it shows that the waters remain under our Father’s rule and presence. Direct references and broader themes should not be mixed together as though they were identical.',
    display_transcript: 'Direct continuation: Genesis 1:7–8.\n\nRepeated vocabulary: Psalm 19:1 uses רָקִיעַ, raqia.\n\nCreation theme: Psalm 148:4.\n\nBroader order theme: 1 Corinthians 14:33, 40.\n\nBroader waters-and-presence theme: Isaiah 43:2.\n\nThese connections are meaningful, but they are not all direct interpretations of Genesis 1:6.'
  },
  {
    sort_order: 100,
    segment_type: 'see_jesus',
    label: 'Did You Know? See Jesus Here',
    voice_profile: 'cedar',
    voice_instructions: 'Speak with wonder and theological care. Clearly distinguish the verse’s original meaning from later whole-Bible connections to Jesus.',
    speech_settings: { speed: 0.92 },
    spoken_text: 'Did you know? See Jesus here. Genesis one, verse six is first about our Father creating the expanse and ordering the waters. It is not a direct messianic prophecy, and Jesus is not hidden in a secret code inside the Hebrew letters. Yet the New Testament teaches that creation itself came through the Son. John one, verse three says, All things were made by him; and without him was not any thing made that was made. Colossians one, verses sixteen and seventeen say that all things were created by him and for him, and by him all things consist. So Christians can look at the ordered expanse and worship Jesus as the Son through whom our Father created and sustains all things. There is also a gentle thematic echo in John fourteen, verses two and three, where Jesus says, I go to prepare a place for you. Genesis one shows God making ordered room for creation. John fourteen shows the Son preparing a place for His people. This is a thematic comparison, not the lexical meaning of raqia. The careful pattern is beautiful: the Son through whom space was created is also the Savior who prepares a place for us.',
    display_transcript: 'Genesis 1:6 is not a direct messianic prophecy.\n\nJohn 1:3 and Colossians 1:16–17 teach that creation came through the Son and is sustained by Him.\n\nJohn 14:2–3 offers a broader thematic echo: Jesus prepares a place for His people.\n\nThe Son through whom creation received its ordered space is also the Savior who prepares a place for us.'
  },
  {
    sort_order: 110,
    segment_type: 'reflection',
    label: 'Practical reflection',
    voice_profile: 'cedar',
    voice_instructions: 'Speak gently, simply, and practically.',
    speech_settings: { speed: 0.94 },
    spoken_text: 'Genesis one, verse six shows a simple pattern. Our Father speaks. Space appears. A boundary forms. Order increases. Sometimes peace does not begin by adding more. Sometimes peace begins by making room and distinguishing what belongs where. Work is not rest. Urgency is not calling. Another person’s emotion is not automatically your assignment. A boundary can serve life when it is created in wisdom and love. Ask one simple question today: What space is our Father helping me make so that life can grow there?',
    display_transcript: 'Our Father speaks → space appears → a boundary forms → order increases.\n\nSometimes peace begins by making room, not adding more.\n\nAsk: What space is our Father helping me make so that life can grow there?'
  },
  {
    sort_order: 120,
    segment_type: 'prayer',
    label: 'Closing prayer',
    voice_profile: 'cedar',
    voice_instructions: 'Pray warmly, sincerely, and reverently.',
    speech_settings: { speed: 0.92 },
    spoken_text: 'Father, thank You for speaking order into creation. Thank You for making room, setting wise boundaries, and preparing places where life can grow. Teach us to distinguish what belongs to today from what does not. Give us wisdom to create peaceful space without fear, harshness, or rejection. Thank You for Your Son, through whom all things were made, and for His promise to prepare a place for His people. Help us walk in Your order, love, and peace. In Jesus’ name, amen.',
    display_transcript: 'Father, thank You for making room, setting wise boundaries, and preparing places where life can grow. Help us walk in Your order, love, and peace. In Jesus’ name, amen.'
  },
  {
    sort_order: 130,
    segment_type: 'final_hebrew',
    label: 'Final natural Hebrew reading',
    voice_profile: 'cedar',
    voice_instructions: 'Read only the Biblical Hebrew naturally, confidently, and reverently. Do not translate it.',
    speech_settings: { speed: 0.9 },
    spoken_text: 'וַיֹּאמֶר אֱלֹהִים יְהִי רָקִיעַ בְּתוֹךְ הַמָּיִם וִיהִי מַבְדִּיל בֵּין מַיִם לָמָיִם׃',
    display_transcript: 'וַיֹּאמֶר אֱלֹהִים יְהִי רָקִיעַ בְּתוֹךְ הַמָּיִם וִיהִי מַבְדִּיל בֵּין מַיִם לָמָיִם׃'
  }
];

function send(res, status, payload) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).json(payload);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'Method not allowed.' });

  const action = String(req.query?.action || 'status');
  try {
    if (action === 'prepare') {
      const result = await runTool('prepare_hebrew_audio_track', {
        verse_reference: VERSE_REFERENCE,
        lesson_id: LESSON_ID,
        track_title: TRACK_TITLE,
        script_version: 'v1',
        audio_segments: segments,
      }, { env: process.env, fetchFn: fetch });
      return send(res, 200, result);
    }

    if (action === 'generate') {
      const result = await runTool('generate_next_hebrew_audio_segment', {
        verse_reference: VERSE_REFERENCE,
      }, { env: process.env, fetchFn: fetch });
      return send(res, 200, result);
    }

    if (action === 'status') {
      const result = await runTool('get_hebrew_audio_status', {
        verse_reference: VERSE_REFERENCE,
        verify_streams: String(req.query?.verify || 'false') === 'true',
      }, { env: process.env, fetchFn: fetch });
      return send(res, 200, result);
    }

    return send(res, 400, { ok: false, error: 'Supported actions: prepare, generate, status.' });
  } catch (error) {
    return send(res, 500, { ok: false, action, error: error.message || String(error) });
  }
}
