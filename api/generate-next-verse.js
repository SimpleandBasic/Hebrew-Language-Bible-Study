import { getSupabaseAdminClient } from '../src/supabase-client.js';

export const maxDuration = 300;

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
const GENESIS_VERSE_COUNTS = [0,31,25,24,26,32,22,24,22,29,32,32,20,18,24,21,16,27,33,38,18,34,24,20,67,34,35,46,22,35,43,55,32,20,31,29,43,36,30,23,23,57,38,34,34,28,34,31,22,33,26];
const FORMAT_VERSION = 'holy-curiosity-symbiotic-sermon-v2';

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
  const candidates = [
    lesson?.content?.referenceRange,
    lesson?.content?.lesson?.reference,
    lesson?.content?.verses?.[0]?.reference,
    lesson?.title?.match(/Genesis\s+\d+:\d+/i)?.[0],
  ];
  for (const candidate of candidates) {
    const parsed = parseReference(candidate);
    if (parsed) return parsed;
  }
  return null;
}

async function getLatestScriptureReference(client) {
  const { data: lessons, error } = await client.from('hebrew_lessons')
    .select('title,lesson_order,content,is_published')
    .eq('is_published', true)
    .order('lesson_order', { ascending: false })
    .limit(100);
  if (error) throw error;

  const parsedLessons = (lessons || [])
    .map((lesson) => referenceFromLesson(lesson))
    .filter(Boolean)
    .sort((a, b) => a.chapter - b.chapter || a.verse - b.verse);

  return parsedLessons.at(-1) || { chapter: 1, verse: 0 };
}

async function fetchCanonicalVerse(reference) {
  const sefariaRef = reference.replace('Genesis ', 'Genesis.').replace(':', '.');
  const response = await fetch(`https://www.sefaria.org/api/texts/${encodeURIComponent(sefariaRef)}?context=0&commentary=0`, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Canonical text lookup failed (${response.status}).`);
  const data = await response.json();
  const hebrew = Array.isArray(data.he) ? data.he[0] : data.he;
  if (!hebrew) throw new Error(`Hebrew text was not returned for ${reference}.`);

  const kjvResponse = await fetch(`https://bible-api.com/${encodeURIComponent(reference)}?translation=kjv`, {
    headers: { accept: 'application/json' },
  });
  if (!kjvResponse.ok) throw new Error(`KJV text lookup failed (${kjvResponse.status}).`);
  const kjvData = await kjvResponse.json();
  const english = String(kjvData.text || '').trim();
  if (!english) throw new Error(`KJV text was not returned for ${reference}.`);
  return { hebrew: String(hebrew).replace(/<[^>]+>/g, ''), english };
}

function validateLesson(lesson) {
  const requiredStrings = [
    'title', 'sermon_title', 'description', 'transliteration', 'opening_hook', 'central_truth',
    'big_idea', 'simple_summary', 'transcript', 'practical_reflection', 'closing_invitation',
    'prayer', 'memory_phrase',
  ];
  const missing = requiredStrings.filter((key) => !String(lesson?.[key] || '').trim());
  if (missing.length) throw new Error(`Generated lesson failed required fields: ${missing.join(', ')}.`);

  const transcript = String(lesson.transcript).trim();
  const wordCount = transcript.split(/\s+/).filter(Boolean).length;
  if (wordCount < 1100) throw new Error(`Generated transcript is too short (${wordCount} words; minimum 1100).`);
  if (!Array.isArray(lesson.key_words) || lesson.key_words.length < 4) throw new Error('Generated lesson needs at least four integrated Hebrew key words.');
  if (!Array.isArray(lesson.strongs_word_stories) || lesson.strongs_word_stories.length < 3) throw new Error('Generated lesson needs at least three Strong’s word stories.');
  if (!Array.isArray(lesson.cross_references) || lesson.cross_references.length < 4) throw new Error('Generated lesson needs at least four responsible cross references.');
  if (!lesson.did_you_know_see_jesus_here?.did_you_know || !lesson.did_you_know_see_jesus_here?.see_jesus_here || !lesson.did_you_know_see_jesus_here?.guardrail) {
    throw new Error('Generated lesson needs Did You Know, See Jesus Here, and an explicit interpretive guardrail.');
  }
  if (!lesson.series_connection?.previous || !lesson.series_connection?.next) throw new Error('Generated lesson must connect to the previous verse and anticipate the next verse.');
  return { wordCount };
}

async function generateLesson(reference, hebrew, english, env) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing from the Vercel project.');
  const model = env.HEBREW_GENERATION_MODEL || 'gpt-4.1-mini';
  const prompt = `Create a complete, publishable Hebrew Bible teaching episode for ${reference}.

KJV: ${english}
Hebrew: ${hebrew}

PERMANENT STANDARD: HOLY CURIOSITY + COHESIVE ENTERTAINING SERMON
Genesis 1:25 is the minimum quality benchmark. Structured notes alone are unacceptable.

Write in fifth-grade language with genuinely deep biblical, Hebrew, theological, historical, and systems insight. Preserve reverence. The full transcript must be at least 1,100 words and feel like one continuous, story-driven sermon or excellent podcast episode.

The transcript must:
- Open with a curiosity gap, cinematic surprise, relatable tension, or vivid scene before explaining the verse.
- Read the full supplied Scripture, then uncover a repeated word, tension, surprise, or overlooked detail.
- Place the listener inside the biblical scene using sights, sounds, movement, scale, and emotion.
- Teach Hebrew naturally inside the story rather than pausing for a detached vocabulary lecture.
- Include Hebrew spelling, transliteration, meaning, grammar, root, Strong's number, recurring biblical scenes, and representative passages for key words.
- Use gentle, memorable, Michael-style observational humor throughout when it helps attention and memory. Never joke inside Scripture wording, sacred claims, or prayer.
- Build everything around one central truth. Every illustration, Hebrew insight, cross-reference, joke, Jesus connection, and application must support that thread.
- Show relationships among language, people, animals, land, culture, creation patterns, Scripture, and daily life only when supported by the verse.
- Include one accurate Did You Know discovery tied directly to the verse.
- Connect to Jesus responsibly. Explicitly distinguish direct prophecy from literary pattern, canonical echo, repeated vocabulary, or broader theology. Never invent hidden symbolism.
- Apply the verse concretely to Ace's work, parenting, faith, nervous system, systems, stewardship, relationships, or daily life only where it naturally fits.
- End with one practical question, one action for today, a warm prayer, and a short repeated memory line.
- Briefly connect to the previous verse and create anticipation for the next verse so Genesis feels like one unfolding journey.

Avoid repetitive AI phrasing, disconnected headings, an information dump, exaggerated claims, fake archaeology, forced symbolism, and shallow motivational language.

Return valid JSON only with these keys:
title, sermon_title, description, transliteration, opening_hook, central_truth, big_idea, simple_summary, transcript, key_words, strongs_word_stories, cross_references, strongs_cross_references, did_you_know_see_jesus_here, practical_reflection, closing_invitation, prayer, memory_phrase, series_connection, format_version.

Requirements:
- format_version must equal "${FORMAT_VERSION}".
- key_words: array of 4-6 objects with hebrew, transliteration, meaning, strongs_number, grammar, root, story_connection.
- strongs_word_stories: array of at least 3 objects with hebrew, transliteration, strongs_number, normal_range, recurring_scenes, meaning_in_this_verse, representative_passages, development_across_scripture.
- cross_references: array of at least 4 objects with reference, connection, connection_type.
- strongs_cross_references: array of objects with strongs_number and explanation.
- did_you_know_see_jesus_here: object with did_you_know, see_jesus_here, guardrail, references.
- series_connection: object with previous and next.

Never alter or invent the supplied Hebrew or KJV verse text.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a careful Christian Hebrew Bible teacher, cohesive storyteller, and engaging educational sermon writer. Output valid JSON only. Never trade accuracy or reverence for entertainment.' },
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
  const quality = validateLesson(lesson);
  return { lesson, model, quality };
}

async function ensureVerse(client, target, canonical) {
  const { data: existing, error: selectError } = await client.from('hebrew_verses').select('*').eq('reference', target.reference).maybeSingle();
  if (selectError) throw selectError;
  if (existing) return existing;
  const { data, error } = await client.from('hebrew_verses').insert({
    book: 'Genesis', chapter: target.chapter, verse_number: target.verse,
    reference: target.reference, hebrew_text: canonical.hebrew, english_text: canonical.english,
    context_note: 'Generated through the protected manual canonical verse pipeline.',
  }).select('*').single();
  if (error) throw error;
  return data;
}

async function ensureLesson(client, target, canonical, generated) {
  const lessonOrder = target.chapter === 1 ? target.verse : Number(`${target.chapter}${String(target.verse).padStart(3, '0')}`);
  const slug = `genesis-${target.chapter}-${target.verse}-${String(generated.title || 'hebrew-lesson').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
  const lessonPayload = {
    ...generated,
    reference: target.reference,
    english_kjv: canonical.english,
    hebrew: canonical.hebrew,
    format_version: FORMAT_VERSION,
  };
  const content = {
    book: 'Genesis', chapter: target.chapter, verseStart: target.verse, verseEnd: target.verse,
    referenceRange: target.reference, schemaVersion: FORMAT_VERSION,
    lesson: lessonPayload,
    verses: [{ book: 'Genesis', chapter: target.chapter, verseNumber: target.verse, reference: target.reference, hebrewText: canonical.hebrew, englishText: canonical.english }],
    publishedAt: new Date().toISOString(),
  };
  const { data: existing, error: selectError } = await client.from('hebrew_lessons').select('*').eq('lesson_order', lessonOrder).maybeSingle();
  if (selectError) throw selectError;
  if (existing) {
    const existingLesson = existing?.content?.lesson || {};
    try {
      validateLesson(existingLesson);
      if (existingLesson.format_version === FORMAT_VERSION) return existing;
    } catch {
      // Upgrade incomplete or older lessons instead of preserving a weak manual result.
    }
    const { data: upgraded, error: updateError } = await client.from('hebrew_lessons').update({
      slug,
      title: `${target.reference} — ${generated.title}`,
      description: generated.description || generated.big_idea || `Hebrew lesson for ${target.reference}.`,
      content,
      is_published: true,
      updated_at: new Date().toISOString(),
    }).eq('id', existing.id).select('*').single();
    if (updateError) throw updateError;
    return upgraded;
  }
  const { data, error } = await client.from('hebrew_lessons').insert({
    slug, title: `${target.reference} — ${generated.title}`,
    description: generated.description || generated.big_idea || `Hebrew lesson for ${target.reference}.`,
    lesson_order: lessonOrder, content, is_published: true,
  }).select('*').single();
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
    const audioResponse = await fetch(`${supabaseUrl}/functions/v1/hebrew-daily-audio`, {
      method: 'POST',
      headers: { authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'content-type': 'application/json' },
      body: '{}',
    });
    if (!audioResponse.ok) throw new Error(`Cedar audio generation failed (${audioResponse.status}).`);
  }
  throw new Error(`${target.reference} audio did not finish within the generation window.`);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed.' });
  const fetchSite = String(req.headers['sec-fetch-site'] || '');
  if (fetchSite && fetchSite !== 'same-origin') return send(res, 403, { ok: false, error: 'Same-origin request required.' });

  try {
    const client = getSupabaseAdminClient(process.env);
    const { data: active } = await client.from('hebrew_audio_tracks').select('verse_reference,status').in('status', ['generating','ready_to_generate']).limit(1);
    if (active?.length) return send(res, 409, { ok: false, error: `${active[0].verse_reference} is already being generated.` });

    // Move forward from the newest published Scripture lesson. Audio completion is
    // intentionally not used as the bookmark, because an old unfinished track must
    // never pull the manual generator backward.
    const latest = await getLatestScriptureReference(client);
    const target = nextReference(latest.chapter, latest.verse);

    const canonical = await fetchCanonicalVerse(target.reference);
    const generatedResult = await generateLesson(target.reference, canonical.hebrew, canonical.english, process.env);
    await ensureVerse(client, target, canonical);
    const lesson = await ensureLesson(client, target, canonical, generatedResult.lesson);
    const lessonOrder = lesson.lesson_order;
    const audio = await finishAudio(client, lessonOrder, target, process.env);

    return send(res, 200, {
      ok: true,
      reference: target.reference,
      title: lesson.title,
      transcript_word_count: generatedResult.quality.wordCount,
      content_quality_gate: 'passed',
      format_version: FORMAT_VERSION,
      progression_source: 'latest_published_scripture_lesson',
      segment_count: audio.segments.length,
      total_duration_seconds: Number(audio.track.total_duration_seconds) || 0,
      model: generatedResult.model,
      status: audio.track.status,
      published: Boolean(audio.track.is_published),
    });
  } catch (error) {
    console.error('Manual Hebrew generation failed.', error);
    return send(res, 500, { ok: false, error: error?.message || 'Manual generation failed.' });
  }
}
