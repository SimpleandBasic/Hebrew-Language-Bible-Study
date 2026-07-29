import { getSupabaseAdminClient } from '../src/supabase-client.js';
import {
  V4_PIPELINE_VERSION,
  createV4Revision,
  failV4Revision,
  generateV4Episode,
  linkV4PublishedAssets,
  persistV4Generation,
} from '../src/v4/episode-generator.js';

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
  const { data: lessons, error } = await client
    .from('hebrew_lessons')
    .select('title,lesson_order,content,is_published')
    .eq('is_published', true)
    .order('lesson_order', { ascending: false })
    .limit(100);
  if (error) throw error;
  const parsedLessons = (lessons || [])
    .map(referenceFromLesson)
    .filter(Boolean)
    .sort((a, b) => a.chapter - b.chapter || a.verse - b.verse);
  return parsedLessons.at(-1) || { chapter: 1, verse: 0 };
}

async function fetchCanonicalVerse(reference) {
  const sefariaRef = reference.replace('Genesis ', 'Genesis.').replace(':', '.');
  const response = await fetch(
    `https://www.sefaria.org/api/texts/${encodeURIComponent(sefariaRef)}?context=0&commentary=0`,
    { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(20000) },
  );
  if (!response.ok) throw new Error(`Canonical text lookup failed (${response.status}).`);
  const data = await response.json();
  const hebrew = Array.isArray(data.he) ? data.he[0] : data.he;
  if (!hebrew) throw new Error(`Hebrew text was not returned for ${reference}.`);

  const kjvResponse = await fetch(
    `https://bible-api.com/${encodeURIComponent(reference)}?translation=kjv`,
    { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(20000) },
  );
  if (!kjvResponse.ok) throw new Error(`KJV text lookup failed (${kjvResponse.status}).`);
  const kjvData = await kjvResponse.json();
  const english = String(kjvData.text || '').trim();
  if (!english) throw new Error(`KJV text was not returned for ${reference}.`);

  return {
    hebrew: String(hebrew).replace(/<[^>]+>/g, ''),
    english,
  };
}

async function ensureVerse(client, target, canonical) {
  const { data: existing, error: selectError } = await client
    .from('hebrew_verses')
    .select('*')
    .eq('reference', target.reference)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing) return existing;

  const { data, error } = await client
    .from('hebrew_verses')
    .insert({
      book: 'Genesis',
      chapter: target.chapter,
      verse_number: target.verse,
      reference: target.reference,
      hebrew_text: canonical.hebrew,
      english_text: canonical.english,
      context_note: 'Generated through the protected V4 canonical verse pipeline.',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function ensureLesson(client, target, canonical, generated) {
  const lessonOrder = target.chapter === 1
    ? target.verse
    : Number(`${target.chapter}${String(target.verse).padStart(3, '0')}`);
  const slug = `genesis-${target.chapter}-${target.verse}-${String(generated.title || 'hebrew-sermon')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`;
  const lessonPayload = {
    ...generated,
    reference: target.reference,
    english_kjv: canonical.english,
    hebrew: canonical.hebrew,
    format_version: V4_PIPELINE_VERSION,
  };
  const content = {
    book: 'Genesis',
    chapter: target.chapter,
    verseStart: target.verse,
    verseEnd: target.verse,
    referenceRange: target.reference,
    schemaVersion: V4_PIPELINE_VERSION,
    lesson: lessonPayload,
    verses: [{
      book: 'Genesis',
      chapter: target.chapter,
      verseNumber: target.verse,
      reference: target.reference,
      hebrewText: canonical.hebrew,
      englishText: canonical.english,
    }],
    publishedAt: new Date().toISOString(),
  };

  const { data: existing, error: selectError } = await client
    .from('hebrew_lessons')
    .select('*')
    .eq('lesson_order', lessonOrder)
    .maybeSingle();
  if (selectError) throw selectError;

  const payload = {
    slug,
    title: `${target.reference} — ${generated.title}`,
    description: generated.description || generated.big_idea || `Hebrew sermon for ${target.reference}.`,
    lesson_order: lessonOrder,
    content,
    is_published: true,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const existingLesson = existing?.content?.lesson || {};
    if (existingLesson.format_version === V4_PIPELINE_VERSION && existingLesson.experience_quality?.passed) {
      return existing;
    }
    const { data: upgraded, error: updateError } = await client
      .from('hebrew_lessons')
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (updateError) throw updateError;
    return upgraded;
  }

  const { data, error } = await client
    .from('hebrew_lessons')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function finishAudio(client, lessonOrder, target, env) {
  const { data: trackId, error: prepareError } = await client.rpc(
    'prepare_hebrew_audio_track_from_lesson',
    { p_lesson_order: lessonOrder },
  );
  if (prepareError) throw prepareError;

  const supabaseUrl = env.HEBREW_SUPABASE_URL || env.SUPABASE_URL;
  const serviceKey = env.HEBREW_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error('Supabase audio credentials are missing.');

  for (let attempt = 0; attempt < 14; attempt += 1) {
    const { data: track, error: trackError } = await client
      .from('hebrew_audio_tracks')
      .select('*')
      .eq('id', trackId)
      .single();
    if (trackError) throw trackError;

    if (track.status === 'ready' && track.is_published) {
      const { data: segments, error: segmentError } = await client
        .from('hebrew_audio_segments')
        .select('*')
        .eq('track_id', trackId)
        .order('sort_order');
      if (segmentError) throw segmentError;
      return { track, segments };
    }

    const audioResponse = await fetch(`${supabaseUrl}/functions/v1/hebrew-daily-audio`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'content-type': 'application/json',
      },
      body: '{}',
      signal: AbortSignal.timeout(45000),
    });
    if (!audioResponse.ok) {
      const details = await audioResponse.text().catch(() => '');
      throw new Error(`Cedar audio generation failed (${audioResponse.status}): ${details.slice(0, 240)}`);
    }
  }

  throw new Error(`${target.reference} audio did not finish within the generation window.`);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed.' });

  const fetchSite = String(req.headers['sec-fetch-site'] || '');
  if (fetchSite && fetchSite !== 'same-origin') {
    return send(res, 403, { ok: false, error: 'Same-origin request required.' });
  }

  const client = getSupabaseAdminClient(process.env);
  let v4Context = null;

  try {
    const { data: active, error: activeError } = await client
      .from('hebrew_audio_tracks')
      .select('verse_reference,status')
      .in('status', ['generating', 'ready_to_generate'])
      .limit(1);
    if (activeError) throw activeError;
    if (active?.length) {
      return send(res, 409, { ok: false, error: `${active[0].verse_reference} is already being generated.` });
    }

    const latest = await getLatestScriptureReference(client);
    const target = nextReference(latest.chapter, latest.verse);
    const canonical = await fetchCanonicalVerse(target.reference);

    await ensureVerse(client, target, canonical);
    v4Context = await createV4Revision(
      client,
      target.reference,
      String(req.headers['x-hebrew-generation-job-id'] || 'mission_control'),
    );

    const generated = await generateV4Episode(target.reference, canonical, process.env);
    await persistV4Generation(client, v4Context, generated, canonical);

    const lesson = await ensureLesson(client, target, canonical, generated.lesson);
    const audio = await finishAudio(client, lesson.lesson_order, target, process.env);
    await linkV4PublishedAssets(client, v4Context, lesson, audio);

    return send(res, 200, {
      ok: true,
      reference: target.reference,
      title: lesson.title,
      revision_id: v4Context.revisionId,
      pipeline_version: V4_PIPELINE_VERSION,
      transcript_word_count: generated.wordCount,
      producer_quality_gate: 'passed',
      producer_weighted_score: generated.evaluation.weightedScore,
      producer_scores: generated.evaluation.scores,
      transcript_repair_count: generated.repairCount,
      spoken_readability: generated.spoken,
      progression_source: 'latest_published_scripture_lesson',
      segment_count: audio.segments.length,
      total_duration_seconds: Number(audio.track.total_duration_seconds) || 0,
      model: generated.model,
      research_model: generated.researchModel,
      evaluation_model: generated.evaluationModel,
      status: audio.track.status,
      published: Boolean(audio.track.is_published),
      v4_next_stage: 'visual_plan',
    });
  } catch (error) {
    console.error('V4 Hebrew generation failed.', error);
    try {
      await failV4Revision(client, v4Context, error);
    } catch (failureUpdateError) {
      console.error('Could not mark V4 revision failed.', failureUpdateError);
    }
    return send(res, 500, {
      ok: false,
      revision_id: v4Context?.revisionId || null,
      error: error?.message || 'V4 generation failed.',
    });
  }
}
