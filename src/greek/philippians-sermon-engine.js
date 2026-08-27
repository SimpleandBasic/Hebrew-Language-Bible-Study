import crypto from 'node:crypto';

export const GREEK_PIPELINE_VERSION = 'greek-sermon-experience-v1';
export const GREEK_PROMPT_VERSION = 'philippians-greek-sermon-v1';
export const MIN_TRANSCRIPT_WORDS = 1100;
export const MAX_TRANSCRIPT_WORDS = 1350;
export const TARGET_TRANSCRIPT_WORDS = '1,180 to 1,300';
export const PHILIPPIANS_VERSE_COUNTS = [0, 30, 30, 21, 23];

const cleanText = (value) => String(value || '').trim();
const asArray = (value) => (Array.isArray(value) ? value : []);
const now = () => new Date().toISOString();
const sha256 = (value) => crypto.createHash('sha256').update(String(value ?? '')).digest('hex');

export function transcriptWordCount(value) {
  return cleanText(value).split(/\s+/).filter(Boolean).length;
}

export function transcriptNeedsRepair(value) {
  const count = typeof value === 'number' ? value : transcriptWordCount(value);
  return count < MIN_TRANSCRIPT_WORDS || count > MAX_TRANSCRIPT_WORDS;
}

export function parsePhilippiansReference(reference) {
  const match = cleanText(reference).match(/^Philippians\s+(\d+):(\d+)$/i);
  if (!match) return null;
  const chapter = Number(match[1]);
  const verse = Number(match[2]);
  const maxVerse = PHILIPPIANS_VERSE_COUNTS[chapter];
  if (!maxVerse || verse < 1 || verse > maxVerse) return null;
  return { book: 'Philippians', bookKey: 'philippians', chapter, verse, reference: 'Philippians ' + chapter + ':' + verse };
}

export function nextPhilippiansReference(chapter, verse) {
  const maxVerse = PHILIPPIANS_VERSE_COUNTS[chapter];
  if (!maxVerse) throw new Error('Unsupported Philippians chapter ' + chapter + '.');
  if (verse < maxVerse) return { book: 'Philippians', bookKey: 'philippians', chapter, verse: verse + 1, reference: 'Philippians ' + chapter + ':' + (verse + 1) };
  if (chapter >= 4) throw new Error('Philippians is complete.');
  return { book: 'Philippians', bookKey: 'philippians', chapter: chapter + 1, verse: 1, reference: 'Philippians ' + (chapter + 1) + ':1' };
}

function parseJsonContent(raw) {
  const value = cleanText(raw).replace(/^\x60\x60\x60(?:json)?\s*/i, '').replace(/\s*\x60\x60\x60$/i, '');
  if (!value) throw new Error('The model returned no JSON content.');
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error('The model returned invalid JSON: ' + error.message);
  }
}

async function requestJson({ apiKey, model, messages, temperature = 0.5, maxTokens = 7500, timeoutMs = 100000 }) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + apiKey, 'content-type': 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || 'OpenAI request failed (' + response.status + ').');
  return parseJsonContent(payload?.choices?.[0]?.message?.content);
}

function stripSblApparatusMarkers(value) {
  return cleanText(value)
    .replace(/[⸀⸁⸂⸃⸄⸅⸆⸇⸈⸉]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function fetchPhilippiansCanonical(reference) {
  const target = parsePhilippiansReference(reference);
  if (!target) throw new Error('Invalid Philippians reference: ' + reference + '.');

  const greekResponse = await fetch(
    'https://raw.githubusercontent.com/Faithlife/SBLGNT/master/data/sblgnt/text/Phil.txt',
    { headers: { accept: 'text/plain' }, signal: AbortSignal.timeout(20000) },
  );
  if (!greekResponse.ok) throw new Error('SBLGNT lookup failed (' + greekResponse.status + ').');
  const greekFile = await greekResponse.text();
  const prefix = 'Phil ' + target.chapter + ':' + target.verse + ' ';
  const line = greekFile.split(/\r?\n/).find((item) => item.startsWith(prefix));
  const greek = stripSblApparatusMarkers(line ? line.slice(prefix.length) : '');
  if (!greek) throw new Error('SBLGNT did not return ' + target.reference + '.');

  const kjvResponse = await fetch(
    'https://bible-api.com/' + encodeURIComponent(target.reference) + '?translation=kjv',
    { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(20000) },
  );
  if (!kjvResponse.ok) throw new Error('KJV lookup failed (' + kjvResponse.status + ').');
  const kjvPayload = await kjvResponse.json();
  const english = cleanText(kjvPayload?.text);
  if (!english) throw new Error('KJV did not return ' + target.reference + '.');

  return {
    greek,
    english,
    greek_source: 'SBL Greek New Testament (SBLGNT), CC BY 4.0',
    greek_source_url: 'https://github.com/Faithlife/SBLGNT',
    english_translation: 'KJV',
  };
}

function normalizeResearch(raw, reference, canonical) {
  const dossier = raw?.research_dossier && typeof raw.research_dossier === 'object'
    ? raw.research_dossier
    : raw;
  const narrativeMap = raw?.narrative_map && typeof raw.narrative_map === 'object'
    ? raw.narrative_map
    : dossier?.narrative_map || {};

  const normalized = {
    verse_text: {
      reference,
      greek_sblgnt: canonical.greek,
      english_kjv: canonical.english,
      ...(dossier?.verse_text || {}),
    },
    literary_context: dossier?.literary_context || {},
    greek_observations: asArray(dossier?.greek_observations),
    cross_references: asArray(dossier?.cross_references),
    historical_background: asArray(dossier?.historical_background),
    textual_notes: asArray(dossier?.textual_notes),
    biblical_theology: asArray(dossier?.biblical_theology),
    christological_pathways: asArray(dossier?.christological_pathways),
    unsupported_connections: asArray(dossier?.unsupported_connections),
    sources: asArray(dossier?.sources),
    claims: asArray(dossier?.claims),
  };

  if (normalized.greek_observations.length < 4) throw new Error('Greek research needs at least four lexical or grammatical observations.');
  if (normalized.cross_references.length < 5) throw new Error('Greek research needs at least five cross references.');
  if (normalized.sources.length < 3) throw new Error('Greek research needs at least three named source categories.');
  if (!cleanText(narrativeMap?.controlling_truth)) throw new Error('Greek narrative map is missing its controlling truth.');
  if (asArray(narrativeMap?.curiosity_turns).length < 4) throw new Error('Greek narrative map needs at least four curiosity turns.');

  return { dossier: normalized, narrativeMap };
}

function normalizeEvaluation(raw) {
  const scoreKeys = [
    'conversational_flow',
    'storytelling',
    'curiosity',
    'greek_integration',
    'biblical_faithfulness',
    'christ_centeredness',
    'emotional_movement',
    'educational_value',
    'spoken_naturalness',
    'listener_engagement',
  ];
  const source = raw?.scores && typeof raw.scores === 'object' ? raw.scores : raw || {};
  const scores = {};
  for (const key of scoreKeys) {
    const value = Number(source?.[key]);
    scores[key] = Number.isFinite(value) ? Math.max(0, Math.min(10, value)) : 0;
  }

  const weights = {
    conversational_flow: 1,
    storytelling: 1,
    curiosity: 1,
    greek_integration: 1.2,
    biblical_faithfulness: 1.4,
    christ_centeredness: 1.1,
    emotional_movement: 1,
    educational_value: 1.1,
    spoken_naturalness: 1.2,
    listener_engagement: 1,
  };
  let weighted = 0;
  let totalWeight = 0;
  for (const key of scoreKeys) {
    weighted += scores[key] * weights[key];
    totalWeight += weights[key];
  }
  const weightedScore = Number((weighted / totalWeight).toFixed(2));
  const hardGateResults = raw?.hard_gate_results && typeof raw.hard_gate_results === 'object'
    ? raw.hard_gate_results
    : {};

  const passed = weightedScore >= 8.5
    && scores.biblical_faithfulness >= 9
    && scores.spoken_naturalness >= 8.5
    && scores.greek_integration >= 8.5
    && hardGateResults.no_invented_greek !== false
    && hardGateResults.christ_connection_guarded !== false;

  return {
    scores,
    weightedScore,
    hardGateResults,
    evidenceSpans: asArray(raw?.evidence_spans),
    strengths: asArray(raw?.strengths).slice(0, 6),
    rewriteDirectives: asArray(raw?.rewrite_directives).slice(0, 10),
    verdict: cleanText(raw?.verdict),
    passed,
  };
}

function spokenLanguageChecks(transcript) {
  const text = cleanText(transcript);
  const words = text.split(/\s+/).filter(Boolean);
  const sentences = text.split(/[.!?]+/).map((item) => item.trim()).filter(Boolean);
  const averageSentenceWords = sentences.length ? words.length / sentences.length : words.length;
  const longSentences = sentences.filter((sentence) => sentence.split(/\s+/).filter(Boolean).length > 34).length;
  const lectureTransitions = (text.match(/\b(now let(?:'s| us)|next we will|in conclusion|the first point|the second point|moving on)\b/gi) || []).length;
  const unexplainedJargon = (text.match(/\b(ontology|epistemology|hermeneutic(?:s|al)?|soteriology|eschatology|teleological|metaphysical)\b/gi) || []).length;
  return {
    word_count: words.length,
    average_sentence_words: Number(averageSentenceWords.toFixed(1)),
    long_sentence_count: longSentences,
    lecture_transition_count: lectureTransitions,
    unexplained_jargon_hits: unexplainedJargon,
    passed: averageSentenceWords <= 25 && longSentences <= 9 && lectureTransitions <= 3 && unexplainedJargon === 0,
  };
}

function validateLesson(lesson) {
  const requiredStrings = [
    'title',
    'sermon_title',
    'description',
    'transliteration',
    'opening_hook',
    'central_truth',
    'big_idea',
    'simple_summary',
    'transcript',
    'practical_reflection',
    'closing_invitation',
    'prayer',
    'memory_phrase',
  ];
  const missing = requiredStrings.filter((key) => !cleanText(lesson?.[key]));
  if (missing.length) throw new Error('Greek sermon is missing required fields: ' + missing.join(', ') + '.');

  const count = transcriptWordCount(lesson.transcript);
  if (transcriptNeedsRepair(count)) {
    throw new Error('Greek transcript is ' + count + ' words; required range is ' + MIN_TRANSCRIPT_WORDS + '-' + MAX_TRANSCRIPT_WORDS + '.');
  }
  if (asArray(lesson.key_words).length < 4) throw new Error('Greek sermon needs at least four key words.');
  if (asArray(lesson.greek_word_stories).length < 3) throw new Error('Greek sermon needs at least three Greek word stories.');
  if (asArray(lesson.cross_references).length < 4) throw new Error('Greek sermon needs at least four cross references.');
  if (!lesson.did_you_know_see_jesus_here?.did_you_know
      || !lesson.did_you_know_see_jesus_here?.see_jesus_here
      || !lesson.did_you_know_see_jesus_here?.guardrail) {
    throw new Error('Greek sermon needs Did You Know, See Jesus Here, and an interpretive guardrail.');
  }
  if (!lesson.series_connection?.previous || !lesson.series_connection?.next) {
    throw new Error('Greek sermon must connect the previous and next verse.');
  }
  return count;
}

async function createResearch(reference, canonical, env) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing from the Vercel project.');
  const model = env.GREEK_RESEARCH_MODEL || env.HEBREW_RESEARCH_MODEL || env.HEBREW_GENERATION_MODEL || 'gpt-4.1';

  const prompt = [
    'Build a verified research dossier and narrative map for a premium Christian Greek New Testament devotional episode on ' + reference + '.',
    '',
    'Canonical KJV:',
    canonical.english,
    '',
    'SBLGNT Greek:',
    canonical.greek,
    '',
    'Return JSON only with two top-level objects: research_dossier and narrative_map.',
    '',
    'research_dossier must include:',
    '- verse_text',
    '- literary_context',
    '- greek_observations: at least 4 items with exact word/form, lemma, transliteration, pronunciation_help, morphology, syntax, Strong\'s number when supportable, semantic range, meaning_here, representative New Testament uses, and confidence',
    '- cross_references: at least 5 items with reference, connection, connection_type, and guardrail',
    '- historical_background',
    '- textual_notes: note meaningful SBLGNT / Textus Receptus wording differences when relevant to the KJV, without exaggerating them',
    '- biblical_theology',
    '- christological_pathways: direct statements, canonical echoes, repeated vocabulary, or broader theology, clearly labeled',
    '- unsupported_connections: tempting claims that should not be used',
    '- sources',
    '- claims: each claim needs claim, support, confidence, and sermon_use',
    '',
    'narrative_map must include:',
    '- cold_open',
    '- controlling_truth',
    '- controlling_image',
    '- curiosity_turns: at least 4 discoveries in listening order',
    '- emotional_movement',
    '- greek_reveals',
    '- everyday_human_moment',
    '- gentle_humor_opportunities',
    '- jesus_bridge',
    '- concrete_action',
    '- closing_memory_line',
    '- next_episode_hook',
    '',
    'Rules:',
    '- Accuracy outranks novelty.',
    '- Never invent Greek meanings, morphology, syntax, Strong\'s numbers, historical facts, textual variants, or quotations.',
    '- Distinguish lexical meaning from application and theology.',
    '- Do not treat an English gloss as the entire meaning of a Greek word.',
    '- If scholarly details are debated, name the uncertainty.',
    '- Use the KJV as the English teaching text while honestly noting material Greek-base differences when relevant.',
    '- Explain with fifth-grade clarity without losing professional depth.',
    '- Humor may observe ordinary human behavior but never joke about Scripture, our Father, Jesus, sacred claims, or prayer.',
  ].join('\n');

  const raw = await requestJson({
    apiKey,
    model,
    temperature: 0.2,
    maxTokens: 6200,
    messages: [
      { role: 'system', content: 'You are a conservative Christian Greek New Testament research editor. Accuracy, context, and lexical discipline outrank novelty. Return valid JSON only.' },
      { role: 'user', content: prompt },
    ],
  });

  return { ...normalizeResearch(raw, reference, canonical), model };
}

async function writeSermon(reference, canonical, research, env) {
  const apiKey = env.OPENAI_API_KEY;
  const model = env.GREEK_SERMON_MODEL || env.HEBREW_SERMON_MODEL || env.HEBREW_GENERATION_MODEL || 'gpt-4.1';

  const prompt = [
    'Write the complete premium daily Greek New Testament teaching episode for ' + reference + ' from the approved research and narrative map below.',
    '',
    'KJV:',
    canonical.english,
    '',
    'SBLGNT Greek:',
    canonical.greek,
    '',
    'Approved research:',
    JSON.stringify(research.dossier),
    '',
    'Approved narrative map:',
    JSON.stringify(research.narrativeMap),
    '',
    'The transcript must be ' + TARGET_TRANSCRIPT_WORDS + ' words and must remain between ' + MIN_TRANSCRIPT_WORDS + ' and ' + MAX_TRANSCRIPT_WORDS + ' words. Silently count before returning.',
    '',
    'Experience contract:',
    '- Sound like one reverent, compelling sermon or premium podcast episode, never a worksheet or lexicon dump.',
    '- Start with the cold open before explaining.',
    '- Read and teach from the KJV faithfully.',
    '- Weave the Greek text into the message naturally: pronunciation, morphology, syntax, lexical range, and why the form matters here.',
    '- Explain Greek technical terms immediately in plain English.',
    '- Distinguish what the Greek text says from interpretation, theology, and practical application.',
    '- Where SBLGNT and the Textus Receptus behind the KJV differ in word order or wording, explain only if it matters and do not manufacture doctrinal drama.',
    '- Carry one controlling truth and image through the whole episode.',
    '- Deliver at least four real discoveries with curiosity and payoff.',
    '- Use one or two gentle everyday observational moments, never jokes inside sacred material.',
    '- Connect to Jesus responsibly and identify whether the connection is direct, literary, canonical, or theological.',
    '- Include one concrete action for today.',
    '- End with a warm landing, prayer, memory phrase, and anticipation for the next verse.',
    '- Do not announce sections, points, or lecture transitions.',
    '',
    'Return JSON only with:',
    'title, sermon_title, description, transliteration, opening_hook, central_truth, big_idea, simple_summary, transcript, key_words, greek_word_stories, cross_references, did_you_know_see_jesus_here, practical_reflection, closing_invitation, prayer, memory_phrase, series_connection, format_version.',
    '',
    'key_words: 4-7 objects with greek, lemma, transliteration, pronunciation, morphology, syntax, strongs when supportable, semantic_range, meaning_here, and note.',
    'greek_word_stories: at least 3.',
    'cross_references: at least 4.',
    'did_you_know_see_jesus_here: did_you_know, see_jesus_here, guardrail, references.',
    'series_connection: previous and next.',
    'format_version: ' + GREEK_PIPELINE_VERSION + '.',
  ].join('\n');

  const lesson = await requestJson({
    apiKey,
    model,
    temperature: 0.68,
    maxTokens: 9000,
    timeoutMs: 115000,
    messages: [
      { role: 'system', content: 'You are a biblically faithful Christian Greek New Testament teacher and exceptional spoken-word storyteller. Return valid JSON only.' },
      { role: 'user', content: prompt },
    ],
  });
  lesson.format_version = GREEK_PIPELINE_VERSION;
  return { lesson, model };
}

async function repairTranscript(reference, lesson, research, env, directives = []) {
  const apiKey = env.OPENAI_API_KEY;
  const model = env.GREEK_SERMON_MODEL || env.HEBREW_SERMON_MODEL || env.HEBREW_GENERATION_MODEL || 'gpt-4.1';
  const currentWords = transcriptWordCount(lesson.transcript);

  const prompt = [
    'Rewrite only the spoken transcript for the ' + reference + ' Greek New Testament episode.',
    '',
    'Current word count: ' + currentWords + '.',
    'Required range: ' + MIN_TRANSCRIPT_WORDS + '-' + MAX_TRANSCRIPT_WORDS + '.',
    'Target: ' + TARGET_TRANSCRIPT_WORDS + '.',
    '',
    'Preserve every approved biblical claim, the KJV wording, supplied Greek forms, lexical and grammatical guardrails, Christological guardrail, prayerful tone, and narrative map.',
    'Keep one continuous sermon. Improve depth by adding meaningful explanation, scenes, application, and transitions rather than padding.',
    'Remove lecture language, repeated conclusions, and overlong sentences.',
    '',
    'Producer directives:',
    JSON.stringify(directives),
    '',
    'Controlling truth:',
    cleanText(research.narrativeMap?.controlling_truth),
    '',
    'Current transcript:',
    lesson.transcript,
    '',
    'Return JSON only as {"transcript":"..."}. Silently count before returning.',
  ].join('\n');

  const repaired = await requestJson({
    apiKey,
    model,
    temperature: 0.5,
    maxTokens: 4500,
    messages: [
      { role: 'system', content: 'You are a precise Christian sermon editor with Greek New Testament literacy. Return valid JSON only.' },
      { role: 'user', content: prompt },
    ],
  });
  const transcript = cleanText(repaired?.transcript);
  if (!transcript) throw new Error('Greek transcript repair returned no transcript.');
  return { ...lesson, transcript };
}

async function evaluateSermon(reference, lesson, research, env) {
  const apiKey = env.OPENAI_API_KEY;
  const model = env.GREEK_EVALUATION_MODEL || env.HEBREW_EVALUATION_MODEL || 'gpt-4.1-mini';
  const spoken = spokenLanguageChecks(lesson.transcript);

  const prompt = [
    'Evaluate this ' + reference + ' Christian Greek New Testament audio sermon as a strict executive producer and Greek accuracy reviewer.',
    '',
    'Score 0-10:',
    'conversational_flow, storytelling, curiosity, greek_integration, biblical_faithfulness, christ_centeredness, emotional_movement, educational_value, spoken_naturalness, listener_engagement.',
    '',
    'Hard gates:',
    '- no invented Greek, morphology, syntax, history, textual variants, quotations, or theology',
    '- biblical_faithfulness at least 9',
    '- spoken_naturalness at least 8.5',
    '- Greek integration at least 8.5 and is explanatory rather than dumped',
    '- lexical meaning is separated from interpretation/application',
    '- any KJV / SBLGNT base-text difference is handled calmly and accurately',
    '- Jesus connection has a responsible guardrail',
    '- transcript is one continuous spoken experience',
    '- ending lands spiritually and creates next-verse anticipation',
    '',
    'Return JSON only with scores, hard_gate_results, evidence_spans, strengths, rewrite_directives, and verdict.',
    'hard_gate_results must explicitly include no_invented_greek and christ_connection_guarded as booleans.',
    '',
    'Approved research:',
    JSON.stringify(research.dossier),
    '',
    'Narrative map:',
    JSON.stringify(research.narrativeMap),
    '',
    'Mechanical spoken report:',
    JSON.stringify(spoken),
    '',
    'Sermon:',
    JSON.stringify(lesson),
  ].join('\n');

  const raw = await requestJson({
    apiKey,
    model,
    temperature: 0.1,
    maxTokens: 3000,
    timeoutMs: 70000,
    messages: [
      { role: 'system', content: 'You are an independent Christian sermon producer and Greek New Testament accuracy reviewer. Return valid JSON only.' },
      { role: 'user', content: prompt },
    ],
  });
  return { evaluation: normalizeEvaluation(raw), spoken, raw, model };
}

export async function generateGreekPhilippiansEpisode(reference, canonical, env = process.env) {
  const target = parsePhilippiansReference(reference);
  if (!target) throw new Error('Invalid Philippians reference: ' + reference + '.');
  if (!canonical?.greek || !canonical?.english) throw new Error('Canonical Greek and KJV text are required.');

  const research = await createResearch(target.reference, canonical, env);
  const written = await writeSermon(target.reference, canonical, research, env);
  let lesson = written.lesson;
  let repairCount = 0;

  if (transcriptNeedsRepair(lesson.transcript)) {
    lesson = await repairTranscript(target.reference, lesson, research, env, [
      'Bring the transcript into the required ' + MIN_TRANSCRIPT_WORDS + '-' + MAX_TRANSCRIPT_WORDS + ' word range.',
    ]);
    repairCount += 1;
  }

  let review = await evaluateSermon(target.reference, lesson, research, env);
  if (!review.evaluation.passed || !review.spoken.passed) {
    const directives = [
      ...review.evaluation.rewriteDirectives,
      ...(!review.spoken.passed ? ['Correct every mechanical spoken-language failure in the supplied report.'] : []),
    ];
    lesson = await repairTranscript(target.reference, lesson, research, env, directives);
    repairCount += 1;
    review = await evaluateSermon(target.reference, lesson, research, env);
  }

  const postReviewCount = transcriptWordCount(lesson.transcript);
  if (transcriptNeedsRepair(postReviewCount)) {
    lesson = await repairTranscript(target.reference, lesson, research, env, [
      'Preserve every approved quality improvement while returning the transcript to the required word-count range.',
    ]);
    repairCount += 1;
    review = await evaluateSermon(target.reference, lesson, research, env);
  }

  const wordCount = validateLesson(lesson);
  if (!review.spoken.passed) throw new Error('Greek spoken-language gate failed: ' + JSON.stringify(review.spoken));
  if (!review.evaluation.passed) {
    throw new Error('Greek producer gate failed at ' + review.evaluation.weightedScore + ': ' + review.evaluation.rewriteDirectives.join('; '));
  }

  lesson.experience_quality = {
    passed: true,
    pipeline_version: GREEK_PIPELINE_VERSION,
    weighted_score: review.evaluation.weightedScore,
    scores: review.evaluation.scores,
    spoken: review.spoken,
    rewrite_count: repairCount,
    evaluated_at: now(),
  };

  return {
    target,
    lesson,
    dossier: research.dossier,
    narrativeMap: research.narrativeMap,
    evaluation: review.evaluation,
    evaluationRaw: review.raw,
    spoken: review.spoken,
    model: written.model,
    researchModel: research.model,
    evaluationModel: review.model,
    wordCount,
    repairCount,
    contentHash: sha256(JSON.stringify({ reference: target.reference, lesson, dossier: research.dossier })),
  };
}
