import { getSupabaseAdminClient } from '../src/supabase-client.js';

export const maxDuration = 300;
const REFERENCE = 'Genesis 1:27';
const LESSON_ORDER = 27;
const FORMAT_VERSION = 'holy-curiosity-symbiotic-sermon-v2';

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

function countWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

async function canonical() {
  const h = await fetch('https://www.sefaria.org/api/texts/Genesis.1.27?context=0&commentary=0');
  if (!h.ok) throw new Error(`Hebrew lookup failed (${h.status}).`);
  const hd = await h.json();
  const hebrew = String(Array.isArray(hd.he) ? hd.he[0] : hd.he || '').replace(/<[^>]+>/g, '').trim();
  const e = await fetch('https://bible-api.com/Genesis%201%3A27?translation=kjv');
  if (!e.ok) throw new Error(`KJV lookup failed (${e.status}).`);
  const ed = await e.json();
  const english = String(ed.text || '').trim();
  if (!hebrew || !english) throw new Error('Canonical Scripture text was incomplete.');
  return { hebrew, english };
}

async function createLesson(scripture, env) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing.');
  const model = env.HEBREW_GENERATION_MODEL || 'gpt-4.1-mini';
  const prompt = `Create a publishable Hebrew Bible sermon episode for Genesis 1:27.\n\nKJV: ${scripture.english}\nHebrew: ${scripture.hebrew}\n\nUse fifth-grade language with genius-level depth, Holy Curiosity, reverence, natural Hebrew teaching, responsible theology, gentle Michael-style observational humor, and concrete application for Ace. Connect Genesis 1:26 behind it and Genesis 1:28 ahead of it.\n\nIMPORTANT LENGTH METHOD: Return transcript_sections as EXACTLY 8 substantial strings. EACH section must contain 180 to 240 words. Each section must naturally continue the previous one so they form one continuous sermon when joined. Do not summarize. Do not make sections short. Silently count each section before returning.\n\nThe eight movements are: 1 curiosity opening and full Scripture, 2 image of God, 3 Hebrew word tselem, 4 male and female together, 5 dignity and stewardship, 6 Jesus connection with explicit guardrail, 7 practical application to Ace, 8 invitation, action, prayer setup, and anticipation of Genesis 1:28.\n\nReturn valid JSON only with: title, sermon_title, description, transliteration, opening_hook, central_truth, big_idea, simple_summary, transcript_sections, key_words, strongs_word_stories, cross_references, strongs_cross_references, did_you_know_see_jesus_here, practical_reflection, closing_invitation, prayer, memory_phrase, series_connection, format_version.\n\nkey_words: 4-6 objects with hebrew, transliteration, meaning, strongs_number, grammar, root, story_connection. strongs_word_stories: at least 3 objects. cross_references: at least 4 objects. did_you_know_see_jesus_here: did_you_know, see_jesus_here, guardrail, references. series_connection: previous and next. format_version: ${FORMAT_VERSION}. Never alter the supplied Scripture.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      max_tokens: 14000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a careful Christian Hebrew Bible teacher. Output valid JSON only. Exactly eight substantial transcript sections are mandatory.' },
        { role: 'user', content: prompt },
      ],
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `Lesson generation failed (${response.status}).`);
  const raw = payload?.choices?.[0]?.message?.content;
  if (!raw) throw new Error('Lesson generation returned no content.');
  const lesson = JSON.parse(raw);
  if (!Array.isArray(lesson.transcript_sections) || lesson.transcript_sections.length !== 8) throw new Error('Generator did not return exactly eight sermon sections.');
  const sectionCounts = lesson.transcript_sections.map(countWords);
  if (sectionCounts.some((n) => n < 150)) throw new Error(`One or more sermon sections were too short: ${sectionCounts.join(', ')}.`);
  lesson.transcript = lesson.transcript_sections.join('\n\n');
  delete lesson.transcript_sections;
  lesson.format_version = FORMAT_VERSION;
  const transcriptWordCount = countWords(lesson.transcript);
  if (transcriptWordCount < 1100) throw new Error(`Generated transcript is too short (${transcriptWordCount} words; minimum 1100).`);
  if (!Array.isArray(lesson.key_words) || lesson.key_words.length < 4) throw new Error('At least four Hebrew key words are required.');
  if (!Array.isArray(lesson.strongs_word_stories) || lesson.strongs_word_stories.length < 3) throw new Error('At least three Strong’s stories are required.');
  if (!Array.isArray(lesson.cross_references) || lesson.cross_references.length < 4) throw new Error('At least four cross references are required.');
  return { lesson, transcriptWordCount, model, sectionCounts };
}

async function save(client, scripture, generated) {
  const lesson = generated.lesson;
  const slug = `genesis-1-27-${String(lesson.title || 'image-of-god').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
  const payload = { ...lesson, reference: REFERENCE, english_kjv: scripture.english, hebrew: scripture.hebrew, format_version: FORMAT_VERSION };
  const content = {
    book: 'Genesis', chapter: 1, verseStart: 27, verseEnd: 27, referenceRange: REFERENCE, schemaVersion: FORMAT_VERSION,
    lesson: payload,
    verses: [{ book: 'Genesis', chapter: 1, verseNumber: 27, reference: REFERENCE, hebrewText: scripture.hebrew, englishText: scripture.english }],
    publishedAt: new Date().toISOString(),
  };
  const { data: verse } = await client.from('hebrew_verses').select('*').eq('reference', REFERENCE).maybeSingle();
  if (!verse) {
    const { error } = await client.from('hebrew_verses').insert({ book: 'Genesis', chapter: 1, verse_number: 27, reference: REFERENCE, hebrew_text: scripture.hebrew, english_text: scripture.english, context_note: 'Generated through segmented Mission Control.' });
    if (error) throw error;
  }
  const { data: existing, error: findError } = await client.from('hebrew_lessons').select('*').eq('lesson_order', LESSON_ORDER).maybeSingle();
  if (findError) throw findError;
  if (existing) {
    const { data, error } = await client.from('hebrew_lessons').update({ slug, title: `${REFERENCE} — ${lesson.title}`, description: lesson.description || lesson.big_idea, content, is_published: true, updated_at: new Date().toISOString() }).eq('id', existing.id).select('*').single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await client.from('hebrew_lessons').insert({ slug, title: `${REFERENCE} — ${lesson.title}`, description: lesson.description || lesson.big_idea, lesson_order: LESSON_ORDER, content, is_published: true }).select('*').single();
  if (error) throw error;
  return data;
}

async function audio(client, env) {
  const { data: trackId, error } = await client.rpc('prepare_hebrew_audio_track_from_lesson', { p_lesson_order: LESSON_ORDER });
  if (error) throw error;
  const url = env.HEBREW_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.HEBREW_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  for (let i = 0; i < 20; i += 1) {
    const { data: track, error: trackError } = await client.from('hebrew_audio_tracks').select('*').eq('id', trackId).single();
    if (trackError) throw trackError;
    if (track.status === 'ready' && track.is_published) {
      const { data: segments, error: segmentError } = await client.from('hebrew_audio_segments').select('*').eq('track_id', trackId).order('sort_order');
      if (segmentError) throw segmentError;
      return { track, segments };
    }
    const r = await fetch(`${url}/functions/v1/hebrew-daily-audio`, { method: 'POST', headers: { authorization: `Bearer ${key}`, apikey: key, 'content-type': 'application/json' }, body: '{}' });
    if (!r.ok) throw new Error(`Cedar audio generation failed (${r.status}).`);
  }
  throw new Error('Cedar audio did not finish within the generation window.');
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return send(res, 405, { ok: false, error: 'Method not allowed.' });
  try {
    const client = getSupabaseAdminClient(process.env);
    const scripture = await canonical();
    const generated = await createLesson(scripture, process.env);
    const lesson = await save(client, scripture, generated);
    const completedAudio = await audio(client, process.env);
    return send(res, 200, { ok: true, reference: REFERENCE, title: lesson.title, transcript_word_count: generated.transcriptWordCount, section_word_counts: generated.sectionCounts, format_version: FORMAT_VERSION, segment_count: completedAudio.segments.length, total_duration_seconds: Number(completedAudio.track.total_duration_seconds) || 0, status: completedAudio.track.status, published: Boolean(completedAudio.track.is_published), model: generated.model });
  } catch (error) {
    console.error('Segmented Genesis 1:27 generation failed.', error);
    return send(res, 500, { ok: false, reference: REFERENCE, error: error?.message || 'Genesis 1:27 generation failed.' });
  }
}
