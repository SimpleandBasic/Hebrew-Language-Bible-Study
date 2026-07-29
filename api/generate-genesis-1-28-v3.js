import { getSupabaseAdminClient } from '../src/supabase-client.js';
import { EXPERIENCE_FORMAT_VERSION, MAX_STYLE_REWRITES, normalizeStyleEvaluation, spokenReadabilityReport } from '../src/hebrew-sermon-quality.js';

export const maxDuration = 300;
const REF = 'Genesis 1:28';
const ORDER = 28;
const MIN_WORDS = 1100;
const TARGET = '1,500 to 1,700';

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

function countWords(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}

async function ask(apiKey, model, messages, temperature = 0.7) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, temperature, max_tokens: 8000, response_format: { type: 'json_object' }, messages }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `OpenAI request failed (${response.status}).`);
  return JSON.parse(payload?.choices?.[0]?.message?.content || '{}');
}

function validateStructure(lesson) {
  const required = ['title','sermon_title','description','transliteration','opening_hook','central_truth','big_idea','simple_summary','transcript','practical_reflection','closing_invitation','prayer','memory_phrase'];
  const missing = required.filter((key) => !String(lesson?.[key] || '').trim());
  if (missing.length) throw new Error(`Missing fields: ${missing.join(', ')}.`);
  if (!Array.isArray(lesson.key_words) || lesson.key_words.length < 4) throw new Error('At least four Hebrew key words are required.');
  if (!Array.isArray(lesson.strongs_word_stories) || lesson.strongs_word_stories.length < 3) throw new Error('At least three Strong’s word stories are required.');
  if (!Array.isArray(lesson.cross_references) || lesson.cross_references.length < 4) throw new Error('At least four cross references are required.');
  if (!lesson.did_you_know_see_jesus_here?.did_you_know || !lesson.did_you_know_see_jesus_here?.see_jesus_here || !lesson.did_you_know_see_jesus_here?.guardrail) throw new Error('Did You Know, Jesus connection, and guardrail are required.');
  if (!lesson.series_connection?.previous || !lesson.series_connection?.next) throw new Error('Previous and next verse connections are required.');
}

async function ensureLength(lesson, apiKey, model) {
  let candidate = lesson;
  for (let attempt = 0; attempt < 4 && countWords(candidate.transcript) < MIN_WORDS; attempt += 1) {
    const current = countWords(candidate.transcript);
    candidate = await ask(apiKey, model, [
      { role: 'system', content: 'You are a careful Christian Hebrew sermon editor. Return valid JSON only and preserve every field.' },
      { role: 'user', content: `The Genesis 1:28 transcript is ${current} words. Rewrite the complete lesson so the transcript alone is ${TARGET} words and never below ${MIN_WORDS}. Preserve Scripture, Hebrew facts, theology, central truth, applications, prayer, Jesus guardrail, and all JSON fields. Add meaningful story movement, discoveries, Hebrew explanation, everyday application, and natural transitions without padding. Return the full lesson JSON.\n\n${JSON.stringify(candidate)}` },
    ]);
    candidate.format_version = EXPERIENCE_FORMAT_VERSION;
  }
  if (countWords(candidate.transcript) < MIN_WORDS) throw new Error(`Transcript remained too short (${countWords(candidate.transcript)} words).`);
  return candidate;
}

function judgePrompt(lesson, readability) {
  return `Evaluate this Genesis 1:28 Christian Hebrew audio sermon as a strict executive producer. Return JSON only. Provide scores from 0 to 10 for opening_hook, storytelling, entertainment, wonder, natural_humor, clarity, emotional_movement, hebrew_integration, spoken_flow, jesus_connection, and memorable_ending, plus strengths, required_changes, and verdict. A publishable sermon needs an immediate cold open, one story thread, at least four real discoveries, natural Hebrew teaching, one to three gentle observational humor moments, fifth-grade clarity, emotional movement, an everyday human moment, a concrete action, a responsible named Jesus connection type, prayer, memory line, and next-verse anticipation. An 8 means genuinely publishable.\nReadability: ${JSON.stringify(readability)}\nLesson: ${JSON.stringify(lesson)}`;
}

async function gateStyle(lesson, apiKey, model) {
  let candidate = lesson;
  let evaluation;
  let readability;
  for (let attempt = 0; attempt <= MAX_STYLE_REWRITES; attempt += 1) {
    candidate = await ensureLength(candidate, apiKey, model);
    validateStructure(candidate);
    readability = spokenReadabilityReport(candidate.transcript);
    evaluation = normalizeStyleEvaluation(await ask(apiKey, model, [
      { role: 'system', content: 'You are a strict sermon and audio-program evaluator. Return valid JSON only.' },
      { role: 'user', content: judgePrompt(candidate, readability) },
    ], 0.1));
    if (evaluation.passed && readability.passed) {
      candidate.experience_quality = { ...evaluation, readability, rewrite_count: attempt, evaluated_at: new Date().toISOString() };
      candidate.format_version = EXPERIENCE_FORMAT_VERSION;
      return { lesson: candidate, evaluation, readability, rewriteCount: attempt };
    }
    if (attempt < MAX_STYLE_REWRITES) {
      candidate = await ask(apiKey, model, [
        { role: 'system', content: 'You are a careful Christian Hebrew sermon editor and engaging audio storyteller. Return valid JSON only.' },
        { role: 'user', content: `Rewrite this complete Genesis 1:28 lesson to correct these producer findings: ${JSON.stringify({ evaluation, readability })}. Keep the transcript at ${TARGET} words and never below ${MIN_WORDS}. Make it one continuous sermon with a vivid cold open, one controlling truth, at least four discoveries, Hebrew woven into scenes, one to three gentle observational humor moments, fifth-grade clarity, emotional movement, an everyday human moment, concrete action, responsible Jesus bridge, prayer, memory phrase, and Genesis 1:29 anticipation. Preserve Scripture and accurate theology. Return every JSON field.\n\n${JSON.stringify(candidate)}` },
      ]);
      candidate.format_version = EXPERIENCE_FORMAT_VERSION;
    }
  }
  throw new Error(`Experience gate failed: average ${evaluation?.average || 0}; weak categories ${(evaluation?.failed_categories || []).join(', ')}; readability ${JSON.stringify(readability)}.`);
}

async function canonical() {
  const sefaria = await fetch('https://www.sefaria.org/api/texts/Genesis.1.28?context=0&commentary=0');
  if (!sefaria.ok) throw new Error(`Hebrew lookup failed (${sefaria.status}).`);
  const s = await sefaria.json();
  const hebrew = String(Array.isArray(s.he) ? s.he[0] : s.he || '').replace(/<[^>]+>/g, '');
  const kjv = await fetch('https://bible-api.com/Genesis%201%3A28?translation=kjv');
  if (!kjv.ok) throw new Error(`KJV lookup failed (${kjv.status}).`);
  const k = await kjv.json();
  return { hebrew, english: String(k.text || '').trim() };
}

async function finishAudio(client, env) {
  const { data: trackId, error } = await client.rpc('prepare_hebrew_audio_track_from_lesson', { p_lesson_order: ORDER });
  if (error) throw error;
  const url = env.HEBREW_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.HEBREW_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  for (let i = 0; i < 16; i += 1) {
    const { data: track, error: trackError } = await client.from('hebrew_audio_tracks').select('*').eq('id', trackId).single();
    if (trackError) throw trackError;
    if (track.status === 'ready' && track.is_published) {
      const { data: segments, error: segmentError } = await client.from('hebrew_audio_segments').select('*').eq('track_id', trackId).order('sort_order');
      if (segmentError) throw segmentError;
      return { track, segments };
    }
    const response = await fetch(`${url}/functions/v1/hebrew-daily-audio`, { method: 'POST', headers: { authorization: `Bearer ${key}`, apikey: key, 'content-type': 'application/json' }, body: '{}' });
    if (!response.ok) throw new Error(`Audio generation failed (${response.status}).`);
  }
  throw new Error('Genesis 1:28 audio did not finish in the generation window.');
}

export default async function handler(req, res) {
  if (!['GET','POST'].includes(req.method)) return send(res, 405, { ok: false, error: 'Method not allowed.' });
  try {
    const client = getSupabaseAdminClient(process.env);
    const { data: existing } = await client.from('hebrew_lessons').select('*').eq('lesson_order', ORDER).maybeSingle();
    const existingLesson = existing?.content?.lesson;
    if (existing?.is_published && existingLesson?.format_version === EXPERIENCE_FORMAT_VERSION && existingLesson?.experience_quality?.passed) {
      const audio = await finishAudio(client, process.env);
      return send(res, 200, { ok: true, reference: REF, reused: true, title: existing.title, transcript_word_count: countWords(existingLesson.transcript), experience_quality: existingLesson.experience_quality, segment_count: audio.segments.length, status: audio.track.status, published: audio.track.is_published });
    }

    const texts = await canonical();
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is missing.');
    const model = process.env.HEBREW_GENERATION_MODEL || 'gpt-4.1-mini';
    let lesson = await ask(apiKey, model, [
      { role: 'system', content: 'You are a careful Christian Hebrew Bible teacher, cohesive storyteller, and entertaining educational sermon writer. Return valid JSON only. Never trade accuracy or reverence for entertainment.' },
      { role: 'user', content: `Create a complete Genesis 1:28 Hebrew Bible audio sermon. KJV: ${texts.english}\nHebrew: ${texts.hebrew}\nWrite the transcript at ${TARGET} words, never below ${MIN_WORDS}. Use fifth-grade language with deep insight. Make it one continuous story-driven sermon with a cinematic cold open, one controlling truth, at least four genuine discoveries, four to six Hebrew key words taught naturally with pronunciation, meaning, grammar, root, Strong's number and recurring scenes, one to three gentle observational humor moments, emotional movement from wonder to worship, an everyday human moment, a concrete action, a responsible Jesus bridge that names its connection type, prayer, memory line, connection to Genesis 1:27, and anticipation for Genesis 1:29. Avoid lecture headings, information dumps, fake archaeology, forced symbolism, and repetitive AI phrasing. Return JSON with title, sermon_title, description, transliteration, opening_hook, central_truth, big_idea, simple_summary, transcript, key_words, strongs_word_stories, cross_references, strongs_cross_references, did_you_know_see_jesus_here, practical_reflection, closing_invitation, prayer, memory_phrase, series_connection, format_version. Include at least three Strong's word stories and four cross references. did_you_know_see_jesus_here must include did_you_know, see_jesus_here, guardrail, references. series_connection must include previous and next. format_version must equal ${EXPERIENCE_FORMAT_VERSION}. Never alter the supplied verse text.` },
    ]);
    lesson.format_version = EXPERIENCE_FORMAT_VERSION;
    const gated = await gateStyle(lesson, apiKey, model);
    lesson = gated.lesson;

    const { data: verse } = await client.from('hebrew_verses').select('*').eq('reference', REF).maybeSingle();
    if (!verse) {
      const { error } = await client.from('hebrew_verses').insert({ book: 'Genesis', chapter: 1, verse_number: 28, reference: REF, hebrew_text: texts.hebrew, english_text: texts.english, context_note: 'Generated through the Genesis 1:28 v3 recovery pipeline.' });
      if (error) throw error;
    }
    const slug = `genesis-1-28-${String(lesson.title || 'blessing-and-mission').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
    const content = { book: 'Genesis', chapter: 1, verseStart: 28, verseEnd: 28, referenceRange: REF, schemaVersion: EXPERIENCE_FORMAT_VERSION, lesson: { ...lesson, reference: REF, english_kjv: texts.english, hebrew: texts.hebrew }, verses: [{ book: 'Genesis', chapter: 1, verseNumber: 28, reference: REF, hebrewText: texts.hebrew, englishText: texts.english }], publishedAt: new Date().toISOString() };
    let saved;
    if (existing) {
      const result = await client.from('hebrew_lessons').update({ slug, title: `${REF} — ${lesson.title}`, description: lesson.description || lesson.big_idea, content, is_published: true, updated_at: new Date().toISOString() }).eq('id', existing.id).select('*').single();
      if (result.error) throw result.error;
      saved = result.data;
    } else {
      const result = await client.from('hebrew_lessons').insert({ slug, title: `${REF} — ${lesson.title}`, description: lesson.description || lesson.big_idea, lesson_order: ORDER, content, is_published: true }).select('*').single();
      if (result.error) throw result.error;
      saved = result.data;
    }
    const audio = await finishAudio(client, process.env);
    return send(res, 200, { ok: true, reference: REF, title: saved.title, transcript_word_count: countWords(lesson.transcript), format_version: EXPERIENCE_FORMAT_VERSION, content_quality_gate: 'passed', entertainment_quality_gate: 'passed', experience_average: gated.evaluation.average, experience_scores: gated.evaluation.scores, rewrite_count: gated.rewriteCount, readability: gated.readability, segment_count: audio.segments.length, total_duration_seconds: Number(audio.track.total_duration_seconds) || 0, model, status: audio.track.status, published: Boolean(audio.track.is_published) });
  } catch (error) {
    console.error('Genesis 1:28 v3 generation failed.', error);
    return send(res, 500, { ok: false, error: error?.message || 'Generation failed.' });
  }
}
