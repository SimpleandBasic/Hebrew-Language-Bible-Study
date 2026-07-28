import { getSupabaseAdminClient } from '../src/supabase-client.js';

export const maxDuration = 300;

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
const GENESIS_VERSE_COUNTS = [0,31,25,24,26,32,22,24,22,29,32,32,20,18,24,21,16,27,33,38,18,34,24,20,67,34,35,46,22,35,43,55,32,20,31,29,43,36,30,23,23,57,38,34,34,28,34,31,22,33,26];

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

async function generateLesson(reference, hebrew, english, env) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing from the Vercel project.');
  const model = env.HEBREW_GENERATION_MODEL || 'gpt-4.1-mini';
  const prompt = `Create a warm, accurate educational sermon lesson for ${reference}.\n\nKJV: ${english}\nHebrew: ${hebrew}\n\nUse fifth-grade language with deep insight. Preserve reverence. Include gentle memorable humor, Hebrew transliteration, 4-6 key Hebrew words with Strong's numbers and grammar, responsible cross references, an explicitly careful Jesus connection, practical reflection, prayer, and a memorable closing line. Never invent a Hebrew spelling or change the supplied verse text. Return JSON only with these keys: title, description, transliteration, opening_hook, big_idea, simple_summary, transcript, key_words, cross_references, strongs_cross_references, did_you_know_see_jesus_here, practical_reflection, prayer, memory_phrase. key_words must be an array of objects with hebrew, transliteration, meaning, strongs_number, grammar. cross_references must be an array of objects with reference and connection. strongs_cross_references must be an array of objects with strongs_number and explanation. did_you_know_see_jesus_here must be an object with did_you_know and see_jesus_here.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0.5,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a careful Christian Hebrew Bible teacher. Output valid JSON only.' },
        { role: 'user', content: prompt },
      ],
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `Lesson generation failed (${response.status}).`);
  const raw = payload?.choices?.[0]?.message?.content;
  if (!raw) throw new Error('Lesson generation returned no content.');
  return { lesson: JSON.parse(raw), model };
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
  };
  const content = {
    book: 'Genesis', chapter: target.chapter, verseStart: target.verse, verseEnd: target.verse,
    referenceRange: target.reference, schemaVersion: 'manual-canonical-sermon-v1',
    lesson: lessonPayload,
    verses: [{ book: 'Genesis', chapter: target.chapter, verseNumber: target.verse, reference: target.reference, hebrewText: canonical.hebrew, englishText: canonical.english }],
    publishedAt: new Date().toISOString(),
  };
  const { data: existing, error: selectError } = await client.from('hebrew_lessons').select('*').eq('lesson_order', lessonOrder).maybeSingle();
  if (selectError) throw selectError;
  if (existing) return existing;
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

    const { data: tracks, error: tracksError } = await client.from('hebrew_audio_tracks')
      .select('verse_reference,status,is_published').eq('is_published', true).eq('status', 'ready');
    if (tracksError) throw tracksError;
    const parsed = (tracks || []).map((item) => ({ ...item, parsed: parseReference(item.verse_reference) })).filter((item) => item.parsed)
      .sort((a, b) => a.parsed.chapter - b.parsed.chapter || a.parsed.verse - b.parsed.verse);
    const latest = parsed.at(-1)?.parsed || { chapter: 1, verse: 0 };
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
