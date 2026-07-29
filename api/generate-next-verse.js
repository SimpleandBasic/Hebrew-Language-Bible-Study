import { getSupabaseAdminClient } from '../src/supabase-client.js';
import {
  EXPERIENCE_FORMAT_VERSION,
  MAX_STYLE_REWRITES,
  assertExperienceQuality,
  normalizeStyleEvaluation,
  spokenReadabilityReport,
} from '../src/hebrew-sermon-quality.js';

export const maxDuration = 300;

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
const GENESIS_VERSE_COUNTS = [0,31,25,24,26,32,22,24,22,29,32,32,20,18,24,21,16,27,33,38,18,34,24,20,67,34,35,46,22,35,43,55,32,20,31,29,43,36,30,23,23,57,38,34,34,28,34,31,22,33,26];
const FORMAT_VERSION = EXPERIENCE_FORMAT_VERSION;
const MIN_TRANSCRIPT_WORDS = 1100;
const TARGET_TRANSCRIPT_WORDS = '1,350 to 1,550';
const MAX_WORD_COUNT_REPAIRS = 3;
const ONE_TIME_TEST_KEY = 'genesis-1-28-v3-final';

function send(res, status, body) {
  res.statusCode = status;
  for (const [key, value] of Object.entries(JSON_HEADERS)) res.setHeader(key, value);
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

function nextReference(chapter, verse) {
  const maxVerse = GENESIS_VERSE_COUNTS[chapter];
  if (!maxVerse) throw new Error(`Unsupported Genesis chapter ${chapter}.`);
  if (verse < maxVerse) return { book: 'Genesis', chapter, verse: verse + 1, reference: `Genesis ${chapter}:${verse + 1}` };
  if (chapter >= 50) throw new Error('Genesis is complete.');
  return { book: 'Genesis', chapter: chapter + 1, verse: 1, reference: `Genesis ${chapter + 1}:1` };
}

function parseReference(reference) {
  const match = String(reference || '').match(/^Genesis\s+(\d+):(\d+)$/i);
  return match ? { chapter: Number(match[1]), verse: Number(match[2]) } : null;
}

function referenceFromLesson(lesson) {
  const candidates = [lesson?.content?.referenceRange, lesson?.content?.lesson?.reference, lesson?.content?.verses?.[0]?.reference, lesson?.title?.match(/Genesis\s+\d+:\d+/i)?.[0]];
  for (const candidate of candidates) {
    const parsed = parseReference(candidate);
    if (parsed) return parsed;
  }
  return null;
}

async function getLatestScriptureReference(client) {
  const { data: lessons, error } = await client.from('hebrew_lessons').select('title,lesson_order,content,is_published').eq('is_published', true).order('lesson_order', { ascending: false }).limit(100);
  if (error) throw error;
  const parsedLessons = (lessons || []).map(referenceFromLesson).filter(Boolean).sort((a, b) => a.chapter - b.chapter || a.verse - b.verse);
  return parsedLessons.at(-1) || { chapter: 1, verse: 0 };
}

async function fetchCanonicalVerse(reference) {
  const sefariaRef = reference.replace('Genesis ', 'Genesis.').replace(':', '.');
  const response = await fetch(`https://www.sefaria.org/api/texts/${encodeURIComponent(sefariaRef)}?context=0&commentary=0`, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Canonical text lookup failed (${response.status}).`);
  const data = await response.json();
  const hebrew = Array.isArray(data.he) ? data.he[0] : data.he;
  if (!hebrew) throw new Error(`Hebrew text was not returned for ${reference}.`);
  const kjvResponse = await fetch(`https://bible-api.com/${encodeURIComponent(reference)}?translation=kjv`, { headers: { accept: 'application/json' } });
  if (!kjvResponse.ok) throw new Error(`KJV text lookup failed (${kjvResponse.status}).`);
  const kjvData = await kjvResponse.json();
  const english = String(kjvData.text || '').trim();
  if (!english) throw new Error(`KJV text was not returned for ${reference}.`);
  return { hebrew: String(hebrew).replace(/<[^>]+>/g, ''), english };
}

function transcriptWordCount(lesson) {
  return String(lesson?.transcript || '').trim().split(/\s+/).filter(Boolean).length;
}

function validateLesson(lesson) {
  const requiredStrings = ['title','sermon_title','description','transliteration','opening_hook','central_truth','big_idea','simple_summary','transcript','practical_reflection','closing_invitation','prayer','memory_phrase'];
  const missing = requiredStrings.filter((key) => !String(lesson?.[key] || '').trim());
  if (missing.length) throw new Error(`Generated lesson failed required fields: ${missing.join(', ')}.`);
  const wordCount = transcriptWordCount(lesson);
  if (wordCount < MIN_TRANSCRIPT_WORDS) throw new Error(`Generated transcript is too short (${wordCount} words; minimum ${MIN_TRANSCRIPT_WORDS}).`);
  if (!Array.isArray(lesson.key_words) || lesson.key_words.length < 4) throw new Error('Generated lesson needs at least four integrated Hebrew key words.');
  if (!Array.isArray(lesson.strongs_word_stories) || lesson.strongs_word_stories.length < 3) throw new Error('Generated lesson needs at least three Strong’s word stories.');
  if (!Array.isArray(lesson.cross_references) || lesson.cross_references.length < 4) throw new Error('Generated lesson needs at least four responsible cross references.');
  if (!lesson.did_you_know_see_jesus_here?.did_you_know || !lesson.did_you_know_see_jesus_here?.see_jesus_here || !lesson.did_you_know_see_jesus_here?.guardrail) throw new Error('Generated lesson needs Did You Know, See Jesus Here, and an explicit interpretive guardrail.');
  if (!lesson.series_connection?.previous || !lesson.series_connection?.next) throw new Error('Generated lesson must connect to the previous verse and anticipate the next verse.');
  return { wordCount };
}

async function requestJson(apiKey, model, messages, temperature = 0.7) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' }, body: JSON.stringify({ model, temperature, max_tokens: 7000, response_format: { type: 'json_object' }, messages }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `Lesson generation failed (${response.status}).`);
  const raw = payload?.choices?.[0]?.message?.content;
  if (!raw) throw new Error('Lesson generation returned no content.');
  return JSON.parse(raw);
}

async function repairShortTranscript(lesson, reference, apiKey, model) {
  let candidate = lesson;
  for (let attempt = 0; attempt < MAX_WORD_COUNT_REPAIRS; attempt += 1) {
    const currentWords = transcriptWordCount(candidate);
    if (currentWords >= MIN_TRANSCRIPT_WORDS) return candidate;
    candidate = await requestJson(apiKey, model, [
      { role: 'system', content: 'You are a careful Christian Hebrew Bible editor. Return valid JSON only. Preserve accuracy, reverence, Scripture, and every field.' },
      { role: 'user', content: `The complete ${reference} lesson transcript is only ${currentWords} words. Rewrite and expand the transcript to 1,450 to 1,600 words, never below ${MIN_TRANSCRIPT_WORDS}. Preserve every JSON field, theology, Hebrew details, Scripture wording, central truth, prayer, applications, entertainment style, and responsible Jesus guardrail. Add meaningful scenes, discoveries, transitions, and application without padding. Silently count the transcript before returning the complete lesson JSON.\n\n${JSON.stringify(candidate)}` },
    ]);
    candidate.format_version = FORMAT_VERSION;
  }
  const finalWords = transcriptWordCount(candidate);
  if (finalWords < MIN_TRANSCRIPT_WORDS) throw new Error(`Generated transcript remained too short after ${MAX_WORD_COUNT_REPAIRS} repairs (${finalWords} words; minimum ${MIN_TRANSCRIPT_WORDS}).`);
  return candidate;
}

function styleJudgePrompt(reference, lesson, readability) {
  return `Evaluate this ${reference} Christian Hebrew audio sermon as a strict executive producer. Score the actual listening experience, not the presence of fields. A publishable lesson must have an immediate cold open, one continuous story-driven sermon, one controlling truth, at least four real curiosity turns, Hebrew taught naturally through images and recurring biblical scenes, one to three gentle observational humor moments, deep ideas in fifth-grade language, emotional movement from wonder to discovery to meaning to personal significance to worship to anticipation, one everyday human moment, one concrete action, a responsible Jesus bridge that names its connection type, and a memorable ending with prayer, memory line, and next-verse anticipation. It must sound natural aloud, not like notes, a lecture, or generic AI writing. Return JSON only with scores from 0 to 10 for opening_hook, storytelling, entertainment, wonder, natural_humor, clarity, emotional_movement, hebrew_integration, spoken_flow, jesus_connection, memorable_ending; plus strengths, required_changes, and verdict. An 8 means genuinely publishable. Readability report: ${JSON.stringify(readability)} Lesson: ${JSON.stringify(lesson)}`;
}

function styleRewritePrompt(reference, lesson, evaluation) {
  return `Rewrite this complete ${reference} lesson so it passes the permanent entertaining-sermon gate. Return the full JSON object with every field. Keep Scripture, Hebrew, theology, and responsible interpretation accurate and reverent. Transcript target is ${TARGET_TRANSCRIPT_WORDS} words and must never be below ${MIN_TRANSCRIPT_WORDS}. Focus hardest on these failed categories: ${(evaluation?.failed_categories || []).join(', ')}. Make the corrections unmistakable while staying natural: open inside a vivid or relatable moment; use one controlling image or truth; include at least four discoveries; weave Hebrew into the story; include one to three gentle observational humor moments; explain deep ideas in fifth-grade language; move through wonder, discovery, meaning, personal significance, worship, and anticipation; include an everyday human moment and concrete action; identify the Jesus connection type; and finish with a memorable line, action, prayer, memory phrase, and next-verse hook. Write for ears, with no lecture transitions, information dump, or repetitive AI phrasing. Producer evaluation: ${JSON.stringify(evaluation)} Lesson to rewrite: ${JSON.stringify(lesson)}`;
}

async function enforceExperienceGate(lesson, reference, apiKey, model) {
  let candidate = lesson;
  let evaluation;
  let readability;
  for (let attempt = 0; attempt <= MAX_STYLE_REWRITES; attempt += 1) {
    candidate = await repairShortTranscript(candidate, reference, apiKey, model);
    validateLesson(candidate);
    readability = spokenReadabilityReport(candidate.transcript);
    const rawEvaluation = await requestJson(apiKey, model, [{ role: 'system', content: 'You are a strict sermon and audio-program quality evaluator. Return valid JSON only.' }, { role: 'user', content: styleJudgePrompt(reference, candidate, readability) }], 0.1);
    evaluation = normalizeStyleEvaluation(rawEvaluation);
    if (evaluation.passed && readability.passed) {
      candidate.experience_quality = { ...evaluation, readability, rewrite_count: attempt, evaluated_at: new Date().toISOString() };
      candidate.format_version = FORMAT_VERSION;
      return { lesson: candidate, evaluation, readability, rewriteCount: attempt };
    }
    if (attempt < MAX_STYLE_REWRITES) {
      candidate = await requestJson(apiKey, model, [{ role: 'system', content: 'You are a careful Christian Hebrew sermon editor and engaging audio storyteller. Return valid JSON only.' }, { role: 'user', content: styleRewritePrompt(reference, candidate, { ...evaluation, readability }) }]);
      candidate.format_version = FORMAT_VERSION;
    }
  }
  assertExperienceQuality(evaluation, readability);
}

async function generateLesson(reference, hebrew, english, env) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing from the Vercel project.');
  const model = env.HEBREW_GENERATION_MODEL || 'gpt-4.1-mini';
  const prompt = `Create a complete, publishable Hebrew Bible teaching episode for ${reference}. KJV: ${english} Hebrew: ${hebrew} PERMANENT STANDARD: HOLY CURIOSITY ENTERTAINING SERMON V3. The result must feel like one compelling educational sermon or excellent podcast episode, not structured notes. Write the transcript at ${TARGET_TRANSCRIPT_WORDS} words and never below ${MIN_TRANSCRIPT_WORDS}. Use fifth-grade language for deep biblical, Hebrew, theological, historical, and systems insight. Begin inside a vivid scene, surprise, tension, mystery, or relatable question. Build everything around one controlling image or central truth. Include at least four meaningful curiosity turns. Read the supplied Scripture and uncover an overlooked detail. Teach Hebrew naturally through pronunciation, meaning, grammar, root, Strong's number, recurring biblical scenes, and why each word matters here. Use one to three gentle observational humor moments when natural. Never joke inside Scripture, sacred claims, or prayer. Move emotionally through wonder, discovery, meaning, personal significance, worship, and anticipation. Include one recognizable everyday human moment and one concrete action. Connect to Jesus responsibly and identify whether the bridge is prophecy, literary pattern, canonical echo, repeated vocabulary, or broader theology. End with a practical question, action, warm prayer, repeatable memory line, and anticipation for the next verse. Write for ears with no academic dump, disconnected headings, lecture transitions, fake archaeology, forced symbolism, or repetitive AI language. Briefly connect the previous verse and next verse. Apply naturally to Ace's work, parenting, faith, nervous system, systems, stewardship, relationships, or daily life only where supported. Return valid JSON only with title, sermon_title, description, transliteration, opening_hook, central_truth, big_idea, simple_summary, transcript, key_words, strongs_word_stories, cross_references, strongs_cross_references, did_you_know_see_jesus_here, practical_reflection, closing_invitation, prayer, memory_phrase, series_connection, format_version. key_words must contain 4-6 objects. strongs_word_stories at least 3. cross_references at least 4. did_you_know_see_jesus_here must contain did_you_know, see_jesus_here, guardrail, references. series_connection must contain previous and next. format_version must equal ${FORMAT_VERSION}. Never alter or invent supplied Hebrew or KJV text.`;
  let lesson = await requestJson(apiKey, model, [{ role: 'system', content: 'You are a careful Christian Hebrew Bible teacher, cohesive storyteller, and engaging educational sermon writer. Return valid JSON only. Never trade accuracy or reverence for entertainment.' }, { role: 'user', content: prompt }]);
  lesson.format_version = FORMAT_VERSION;
  const gated = await enforceExperienceGate(lesson, reference, apiKey, model);
  const quality = validateLesson(gated.lesson);
  return { lesson: gated.lesson, model, quality: { ...quality, experience: gated.evaluation, readability: gated.readability, rewriteCount: gated.rewriteCount } };
}

async function ensureVerse(client, target, canonical) {
  const { data: existing, error: selectError } = await client.from('hebrew_verses').select('*').eq('reference', target.reference).maybeSingle();
  if (selectError) throw selectError;
  if (existing) return existing;
  const { data, error } = await client.from('hebrew_verses').insert({ book: 'Genesis', chapter: target.chapter, verse_number: target.verse, reference: target.reference, hebrew_text: canonical.hebrew, english_text: canonical.english, context_note: 'Generated through the protected manual canonical verse pipeline.' }).select('*').single();
  if (error) throw error;
  return data;
}

async function ensureLesson(client, target, canonical, generated) {
  const lessonOrder = target.chapter === 1 ? target.verse : Number(`${target.chapter}${String(target.verse).padStart(3, '0')}`);
  const slug = `genesis-${target.chapter}-${target.verse}-${String(generated.title || 'hebrew-lesson').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
  const lessonPayload = { ...generated, reference: target.reference, english_kjv: canonical.english, hebrew: canonical.hebrew, format_version: FORMAT_VERSION };
  const content = { book: 'Genesis', chapter: target.chapter, verseStart: target.verse, verseEnd: target.verse, referenceRange: target.reference, schemaVersion: FORMAT_VERSION, lesson: lessonPayload, verses: [{ book: 'Genesis', chapter: target.chapter, verseNumber: target.verse, reference: target.reference, hebrewText: canonical.hebrew, englishText: canonical.english }], publishedAt: new Date().toISOString() };
  const { data: existing, error: selectError } = await client.from('hebrew_lessons').select('*').eq('lesson_order', lessonOrder).maybeSingle();
  if (selectError) throw selectError;
  if (existing) {
    const existingLesson = existing?.content?.lesson || {};
    try { validateLesson(existingLesson); if (existingLesson.format_version === FORMAT_VERSION && existingLesson.experience_quality?.passed) return existing; } catch {}
    const { data: upgraded, error: updateError } = await client.from('hebrew_lessons').update({ slug, title: `${target.reference} — ${generated.title}`, description: generated.description || generated.big_idea || `Hebrew lesson for ${target.reference}.`, content, is_published: true, updated_at: new Date().toISOString() }).eq('id', existing.id).select('*').single();
    if (updateError) throw updateError;
    return upgraded;
  }
  const { data, error } = await client.from('hebrew_lessons').insert({ slug, title: `${target.reference} — ${generated.title}`, description: generated.description || generated.big_idea || `Hebrew lesson for ${target.reference}.`, lesson_order: lessonOrder, content, is_published: true }).select('*').single();
  if (error) throw error;
  return data;
}

async function finishAudio(client, lessonOrder, target, env) {
  const { data: trackId, error: prepareError } = await client.rpc('prepare_hebrew_audio_track_from_lesson', { p_lesson_order: lessonOrder });
  if (prepareError) throw prepareError;
  const supabaseUrl = env.HEBREW_SUPABASE_URL || env.SUPABASE_URL;
  const serviceKey = env.HEBREW_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  for (let attempt = 0; attempt < 14; attempt += 1) {
    const { data: track, error: trackError } = await client.from('hebrew_audio_tracks').select('*').eq('id', trackId).single();
    if (trackError) throw trackError;
    if (track.status === 'ready' && track.is_published) {
      const { data: segments, error: segmentError } = await client.from('hebrew_audio_segments').select('*').eq('track_id', trackId).order('sort_order');
      if (segmentError) throw segmentError;
      return { track, segments };
    }
    const audioResponse = await fetch(`${supabaseUrl}/functions/v1/hebrew-daily-audio`, { method: 'POST', headers: { authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'content-type': 'application/json' }, body: '{}' });
    if (!audioResponse.ok) throw new Error(`Cedar audio generation failed (${audioResponse.status}).`);
  }
  throw new Error(`${target.reference} audio did not finish within the generation window.`);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const oneTimeTest = req.method === 'GET' && String(req.url || '').includes(`test=${ONE_TIME_TEST_KEY}`);
  if (req.method !== 'POST' && !oneTimeTest) return send(res, 405, { ok: false, error: 'Method not allowed.' });
  const fetchSite = String(req.headers['sec-fetch-site'] || '');
  if (!oneTimeTest && fetchSite && fetchSite !== 'same-origin') return send(res, 403, { ok: false, error: 'Same-origin request required.' });
  try {
    const client = getSupabaseAdminClient(process.env);
    const { data: active } = await client.from('hebrew_audio_tracks').select('verse_reference,status').in('status', ['generating','ready_to_generate']).limit(1);
    if (active?.length) return send(res, 409, { ok: false, error: `${active[0].verse_reference} is already being generated.` });
    const latest = await getLatestScriptureReference(client);
    const target = nextReference(latest.chapter, latest.verse);
    if (oneTimeTest && target.reference !== 'Genesis 1:28') return send(res, 409, { ok: false, error: `One-time test expected Genesis 1:28 but next reference is ${target.reference}.` });
    const canonical = await fetchCanonicalVerse(target.reference);
    const generatedResult = await generateLesson(target.reference, canonical.hebrew, canonical.english, process.env);
    await ensureVerse(client, target, canonical);
    const lesson = await ensureLesson(client, target, canonical, generatedResult.lesson);
    const audio = await finishAudio(client, lesson.lesson_order, target, process.env);
    return send(res, 200, { ok: true, reference: target.reference, title: lesson.title, transcript_word_count: generatedResult.quality.wordCount, content_quality_gate: 'passed', entertainment_quality_gate: 'passed', entertainment_average_score: generatedResult.quality.experience.average, entertainment_scores: generatedResult.quality.experience.scores, style_rewrite_count: generatedResult.quality.rewriteCount, spoken_readability: generatedResult.quality.readability, format_version: FORMAT_VERSION, progression_source: 'latest_published_scripture_lesson', segment_count: audio.segments.length, total_duration_seconds: Number(audio.track.total_duration_seconds) || 0, model: generatedResult.model, status: audio.track.status, published: Boolean(audio.track.is_published) });
  } catch (error) {
    console.error('Manual Hebrew generation failed.', error);
    return send(res, 500, { ok: false, error: error?.message || 'Manual generation failed.' });
  }
}
