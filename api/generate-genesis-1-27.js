import { getSupabaseAdminClient } from '../src/supabase-client.js';

export const maxDuration = 300;

const REFERENCE = 'Genesis 1:27';
const LESSON_ORDER = 27;
const FORMAT_VERSION = 'holy-curiosity-symbiotic-sermon-v2';
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

function send(res, status, body) {
  res.statusCode = status;
  for (const [key, value] of Object.entries(JSON_HEADERS)) res.setHeader(key, value);
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function validateLesson(lesson) {
  const required = ['title','sermon_title','description','transliteration','opening_hook','central_truth','big_idea','simple_summary','transcript','practical_reflection','closing_invitation','prayer','memory_phrase'];
  const missing = required.filter((key) => !String(lesson?.[key] || '').trim());
  if (missing.length) throw new Error(`Missing required fields: ${missing.join(', ')}.`);
  const count = wordCount(lesson.transcript);
  if (count < 1100) throw new Error(`Generated transcript is too short (${count} words; minimum 1100).`);
  if (!Array.isArray(lesson.key_words) || lesson.key_words.length < 4) throw new Error('At least four Hebrew key words are required.');
  if (!Array.isArray(lesson.strongs_word_stories) || lesson.strongs_word_stories.length < 3) throw new Error('At least three Strong’s word stories are required.');
  if (!Array.isArray(lesson.cross_references) || lesson.cross_references.length < 4) throw new Error('At least four cross references are required.');
  if (!lesson.did_you_know_see_jesus_here?.did_you_know || !lesson.did_you_know_see_jesus_here?.see_jesus_here || !lesson.did_you_know_see_jesus_here?.guardrail) throw new Error('Did You Know, See Jesus Here, and guardrail are required.');
  if (!lesson.series_connection?.previous || !lesson.series_connection?.next) throw new Error('Previous and next verse connections are required.');
  return count;
}

async function fetchCanonicalVerse() {
  const sefaria = await fetch('https://www.sefaria.org/api/texts/Genesis.1.27?context=0&commentary=0', { headers: { accept: 'application/json' } });
  if (!sefaria.ok) throw new Error(`Canonical Hebrew lookup failed (${sefaria.status}).`);
  const sefariaData = await sefaria.json();
  const rawHebrew = Array.isArray(sefariaData.he) ? sefariaData.he[0] : sefariaData.he;
  const hebrew = String(rawHebrew || '').replace(/<[^>]+>/g, '').trim();
  if (!hebrew) throw new Error('Canonical Hebrew text was empty.');

  const kjv = await fetch('https://bible-api.com/Genesis%201%3A27?translation=kjv', { headers: { accept: 'application/json' } });
  if (!kjv.ok) throw new Error(`KJV lookup failed (${kjv.status}).`);
  const kjvData = await kjv.json();
  const english = String(kjvData.text || '').trim();
  if (!english) throw new Error('KJV text was empty.');
  return { hebrew, english };
}

async function generateLesson(canonical, env) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing.');
  const model = env.HEBREW_GENERATION_MODEL || 'gpt-4.1-mini';
  const prompt = `Create a complete publishable Hebrew Bible teaching episode for Genesis 1:27.\n\nKJV: ${canonical.english}\nHebrew: ${canonical.hebrew}\n\nWrite one cohesive, story-driven educational sermon in fifth-grade language with deep Hebrew, biblical, theological, historical, and practical insight. The transcript field alone MUST contain 1,500 to 1,800 words. Do not count the other JSON fields toward that target. Before returning JSON, silently count the transcript words and expand it until it contains at least 1,500 words.\n\nUse Holy Curiosity: open with a vivid curiosity gap, read the full supplied Scripture, place the listener inside the scene, teach Hebrew naturally, build around one central truth, include gentle Michael-style observational humor where reverent, connect responsibly to Jesus with an explicit interpretive guardrail, apply the verse naturally to Ace's work, parenting, faith, nervous system, stewardship, relationships, and daily life, and end with one question, one action, prayer, and a short memory phrase. Connect Genesis 1:26 behind it and Genesis 1:28 ahead of it. Never alter the supplied Hebrew or KJV text.\n\nReturn valid JSON only with these keys: title, sermon_title, description, transliteration, opening_hook, central_truth, big_idea, simple_summary, transcript, key_words, strongs_word_stories, cross_references, strongs_cross_references, did_you_know_see_jesus_here, practical_reflection, closing_invitation, prayer, memory_phrase, series_connection, format_version.\n\nRequirements: format_version must be ${FORMAT_VERSION}; key_words must contain 4-6 objects with hebrew, transliteration, meaning, strongs_number, grammar, root, story_connection; strongs_word_stories must contain at least 3 objects; cross_references at least 4 objects; did_you_know_see_jesus_here must include did_you_know, see_jesus_here, guardrail, references; series_connection must include previous and next.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0.65,
      max_tokens: 12000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a careful Christian Hebrew Bible teacher and cohesive sermon writer. Output valid JSON only. The transcript word-count requirement is mandatory.' },
        { role: 'user', content: prompt },
      ],
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `Lesson generation failed (${response.status}).`);
  const raw = payload?.choices?.[0]?.message?.content;
  if (!raw) throw new Error('Lesson generation returned no content.');
  const lesson = JSON.parse(raw);
  lesson.format_version = FORMAT_VERSION;
  const transcriptWordCount = validateLesson(lesson);
  return { lesson, transcriptWordCount, model };
}

async function saveLesson(client, canonical, generated) {
  const slug = `genesis-1-27-${String(generated.lesson.title || 'image-of-god').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
  const lessonPayload = { ...generated.lesson, reference: REFERENCE, english_kjv: canonical.english, hebrew: canonical.hebrew, format_version: FORMAT_VERSION };
  const content = {
    book: 'Genesis', chapter: 1, verseStart: 27, verseEnd: 27, referenceRange: REFERENCE, schemaVersion: FORMAT_VERSION,
    lesson: lessonPayload,
    verses: [{ book: 'Genesis', chapter: 1, verseNumber: 27, reference: REFERENCE, hebrewText: canonical.hebrew, englishText: canonical.english }],
    publishedAt: new Date().toISOString(),
  };

  const { data: existing, error: selectError } = await client.from('hebrew_lessons').select('*').eq('lesson_order', LESSON_ORDER).maybeSingle();
  if (selectError) throw selectError;
  if (existing) {
    const { data, error } = await client.from('hebrew_lessons').update({ slug, title: `${REFERENCE} — ${generated.lesson.title}`, description: generated.lesson.description || generated.lesson.big_idea, content, is_published: true, updated_at: new Date().toISOString() }).eq('id', existing.id).select('*').single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await client.from('hebrew_lessons').insert({ slug, title: `${REFERENCE} — ${generated.lesson.title}`, description: generated.lesson.description || generated.lesson.big_idea, lesson_order: LESSON_ORDER, content, is_published: true }).select('*').single();
  if (error) throw error;
  return data;
}

async function ensureVerse(client, canonical) {
  const { data: existing, error: selectError } = await client.from('hebrew_verses').select('*').eq('reference', REFERENCE).maybeSingle();
  if (selectError) throw selectError;
  if (existing) return existing;
  const { data, error } = await client.from('hebrew_verses').insert({ book: 'Genesis', chapter: 1, verse_number: 27, reference: REFERENCE, hebrew_text: canonical.hebrew, english_text: canonical.english, context_note: 'Generated through the Genesis 1:27 Mission Control production pipeline.' }).select('*').single();
  if (error) throw error;
  return data;
}

async function finishAudio(client, env) {
  const { data: trackId, error: prepareError } = await client.rpc('prepare_hebrew_audio_track_from_lesson', { p_lesson_order: LESSON_ORDER });
  if (prepareError) throw prepareError;
  const supabaseUrl = env.HEBREW_SUPABASE_URL || env.SUPABASE_URL;
  const serviceKey = env.HEBREW_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  for (let attempt = 0; attempt < 18; attempt += 1) {
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
  throw new Error('Genesis 1:27 audio did not finish within the generation window.');
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return send(res, 405, { ok: false, error: 'Method not allowed.' });
  try {
    const client = getSupabaseAdminClient(process.env);
    const { data: existingLesson } = await client.from('hebrew_lessons').select('*').eq('lesson_order', LESSON_ORDER).maybeSingle();
    if (existingLesson) {
      const existingTranscript = existingLesson?.content?.lesson?.transcript;
      if (wordCount(existingTranscript) >= 1100 && existingLesson.is_published) {
        const { data: existingTrack } = await client.from('hebrew_audio_tracks').select('*').eq('lesson_id', existingLesson.id).maybeSingle();
        if (existingTrack?.status === 'ready' && existingTrack.is_published) {
          const { data: segments } = await client.from('hebrew_audio_segments').select('*').eq('track_id', existingTrack.id).order('sort_order');
          return send(res, 200, { ok: true, reference: REFERENCE, title: existingLesson.title, transcript_word_count: wordCount(existingTranscript), segment_count: segments?.length || 0, total_duration_seconds: Number(existingTrack.total_duration_seconds) || 0, status: existingTrack.status, published: true, reused_existing: true });
        }
      }
    }

    const canonical = await fetchCanonicalVerse();
    const generated = await generateLesson(canonical, process.env);
    await ensureVerse(client, canonical);
    const lesson = await saveLesson(client, canonical, generated);
    const audio = await finishAudio(client, process.env);
    return send(res, 200, { ok: true, reference: REFERENCE, title: lesson.title, transcript_word_count: generated.transcriptWordCount, content_quality_gate: 'passed', format_version: FORMAT_VERSION, segment_count: audio.segments.length, total_duration_seconds: Number(audio.track.total_duration_seconds) || 0, model: generated.model, status: audio.track.status, published: Boolean(audio.track.is_published) });
  } catch (error) {
    console.error('Genesis 1:27 generation failed.', error);
    return send(res, 500, { ok: false, reference: REFERENCE, error: error?.message || 'Genesis 1:27 generation failed.' });
  }
}
