import crypto from 'node:crypto';
import { getSupabaseAdminClient } from '../src/supabase-client.js';
import {
  GREEK_PIPELINE_VERSION,
  fetchPhilippiansCanonical,
  generateGreekPhilippiansEpisode,
  nextPhilippiansReference,
  parsePhilippiansReference,
} from '../src/greek/philippians-sermon-engine.js';

export const maxDuration = 300;

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

function send(res, status, body) {
  res.statusCode = status;
  for (const [key, value] of Object.entries(JSON_HEADERS)) res.setHeader(key, value);
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function resolveExpectedTarget(client) {
  const { data, error } = await client
    .from('scripture_devotional_lessons')
    .select('reference,chapter,verse_number,is_published')
    .eq('book_key', 'philippians')
    .eq('is_published', true)
    .order('chapter', { ascending: false })
    .order('verse_number', { ascending: false })
    .limit(1);
  if (error) throw error;

  if (!data?.length) {
    return { book: 'Philippians', bookKey: 'philippians', chapter: 1, verse: 1, reference: 'Philippians 1:1' };
  }
  return nextPhilippiansReference(Number(data[0].chapter), Number(data[0].verse_number));
}

async function resolveTarget(client, requestedReference) {
  const expected = await resolveExpectedTarget(client);
  const requested = String(requestedReference || '').trim();
  if (!requested) return expected;

  const parsed = parsePhilippiansReference(requested);
  if (!parsed) throw new Error('Invalid requested Philippians reference: ' + requested + '.');
  if (parsed.reference.toLowerCase() !== expected.reference.toLowerCase()) {
    const error = new Error('This request asked for ' + parsed.reference + ', but the next unpublished verse is ' + expected.reference + '.');
    error.statusCode = 409;
    throw error;
  }
  return parsed;
}

async function persistLesson(client, target, canonical, generated) {
  const { data: series, error: seriesError } = await client
    .from('scripture_devotional_series')
    .select('id')
    .eq('book_key', 'philippians')
    .single();
  if (seriesError) throw seriesError;

  const lessonPayload = {
    ...generated.lesson,
    reference: target.reference,
    source_language: 'Greek',
    greek: canonical.greek,
    english_kjv: canonical.english,
    greek_source: canonical.greek_source,
    narrative_map: generated.narrativeMap,
    generation: {
      pipeline_version: GREEK_PIPELINE_VERSION,
      content_hash: generated.contentHash,
      model: generated.model,
      research_model: generated.researchModel,
      evaluation_model: generated.evaluationModel,
      repair_count: generated.repairCount,
      generated_at: new Date().toISOString(),
    },
  };

  const payload = {
    series_id: series.id,
    reference: target.reference,
    book_key: 'philippians',
    chapter: target.chapter,
    verse_number: target.verse,
    source_language: 'Greek',
    source_text: canonical.greek,
    source_text_attribution: canonical.greek_source,
    english_translation: 'KJV',
    english_text: canonical.english,
    transliteration: generated.lesson.transliteration,
    title: generated.lesson.title,
    description: generated.lesson.description || generated.lesson.big_idea,
    sermon_transcript: generated.lesson.transcript,
    lesson_payload: lessonPayload,
    research_dossier: {
      ...generated.dossier,
      narrative_map: generated.narrativeMap,
      source_attribution: {
        greek: canonical.greek_source,
        greek_url: canonical.greek_source_url,
        english: 'King James Version',
      },
    },
    evaluation: {
      passed: true,
      weighted_score: generated.evaluation.weightedScore,
      scores: generated.evaluation.scores,
      hard_gate_results: generated.evaluation.hardGateResults,
      spoken: generated.spoken,
      strengths: generated.evaluation.strengths,
      evidence_spans: generated.evaluation.evidenceSpans,
      evaluator_version: GREEK_PIPELINE_VERSION,
      evaluated_at: new Date().toISOString(),
    },
    pipeline_version: GREEK_PIPELINE_VERSION,
    generated_by: 'greek_philippians_engine_v1',
    is_published: true,
    published_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from('scripture_devotional_lessons')
    .upsert(payload, { onConflict: 'reference' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed.' });

  const expectedAdminKey = process.env.SCRIPTURE_ADMIN_KEY || process.env.HEBREW_AUDIO_ADMIN_KEY || '';
  const suppliedAdminKey = req.headers['x-scripture-admin-key'] || req.headers['x-hebrew-admin-key'] || '';
  if (!safeEqual(suppliedAdminKey, expectedAdminKey)) {
    return send(res, 401, { ok: false, error: 'Greek devotional generation requires an admin credential.' });
  }

  const fetchSite = String(req.headers['sec-fetch-site'] || '');
  if (fetchSite && fetchSite !== 'same-origin') {
    return send(res, 403, { ok: false, error: 'Same-origin request required.' });
  }

  const client = getSupabaseAdminClient(process.env);

  try {
    const target = await resolveTarget(client, req.body?.requested_reference);
    const canonical = await fetchPhilippiansCanonical(target.reference);
    const generated = await generateGreekPhilippiansEpisode(target.reference, canonical, process.env);
    const lesson = await persistLesson(client, target, canonical, generated);

    return send(res, 200, {
      ok: true,
      reference: lesson.reference,
      lesson_id: lesson.id,
      title: lesson.title,
      pipeline_version: lesson.pipeline_version,
      transcript_word_count: generated.wordCount,
      weighted_score: generated.evaluation.weightedScore,
      repair_count: generated.repairCount,
      source_language: 'Greek',
      english_translation: 'KJV',
      published: lesson.is_published,
      next_reference: (() => {
        try { return nextPhilippiansReference(target.chapter, target.verse).reference; } catch { return null; }
      })(),
    });
  } catch (error) {
    console.error('Philippians Greek generation failed.', error);
    return send(res, Number(error?.statusCode) || 500, {
      ok: false,
      error: error?.message || 'Philippians Greek generation failed.',
    });
  }
}
