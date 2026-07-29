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
const RECOVERABLE_REVISION_STATUSES = ['failed', 'producing_audio', 'producing_visuals', 'verifying', 'ready_for_release'];
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function send(res, status, body) {
  res.statusCode = status;
  for (const [key, value] of Object.entries(JSON_HEADERS)) res.setHeader(key, value);
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

export function nextReference(chapter, verse) {
  const maxVerse = GENESIS_VERSE_COUNTS[chapter];
  if (!maxVerse) throw new Error(`Unsupported Genesis chapter ${chapter}.`);
  if (verse < maxVerse) return { book: 'Genesis', chapter, verse: verse + 1, reference: `Genesis ${chapter}:${verse + 1}` };
  if (chapter >= 50) throw new Error('Genesis is complete.');
  return { book: 'Genesis', chapter: chapter + 1, verse: 1, reference: `Genesis ${chapter + 1}:1` };
}

export function parseReference(reference) {
  const match = String(reference || '').trim().match(/^Genesis\s+(\d+):(\d+)$/i);
  if (!match) return null;
  const chapter = Number(match[1]);
  const verse = Number(match[2]);
  const maxVerse = GENESIS_VERSE_COUNTS[chapter];
  if (!maxVerse || verse < 1 || verse > maxVerse) return null;
  return { book: 'Genesis', chapter, verse, reference: `Genesis ${chapter}:${verse}` };
}

function lessonOrderForTarget(target) {
  return target.chapter === 1
    ? target.verse
    : Number(`${target.chapter}${String(target.verse).padStart(3, '0')}`);
}

async function resolveTarget(client, requestedReference) {
  const { data: expectedReference, error } = await client.rpc('next_hebrew_v4_reference');
  if (error) throw error;
  const expected = parseReference(expectedReference);
  if (!expected) throw new Error(`The next atomic Genesis reference is invalid: ${expectedReference || 'empty'}.`);

  const requested = String(requestedReference || '').trim();
  if (requested && requested.toLowerCase() !== expected.reference.toLowerCase()) {
    const stale = new Error(`This job requested ${requested}, but the next incomplete episode is ${expected.reference}.`);
    stale.statusCode = 409;
    throw stale;
  }
  return expected;
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
  const lessonOrder = lessonOrderForTarget(target);
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
    generatedAt: new Date().toISOString(),
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
    is_published: false,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { data: updated, error: updateError } = await client
      .from('hebrew_lessons')
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (updateError) throw updateError;
    return updated;
  }

  const { data, error } = await client
    .from('hebrew_lessons')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function findRecoverableRevision(client, reference) {
  const { data: episode, error: episodeError } = await client
    .from('hebrew_episodes')
    .select('*')
    .eq('reference', reference)
    .maybeSingle();
  if (episodeError) throw episodeError;
  if (!episode) return null;

  const { data: revisions, error: revisionError } = await client
    .from('hebrew_episode_revisions')
    .select('*')
    .eq('episode_id', episode.id)
    .eq('release_state', 'private')
    .in('status', RECOVERABLE_REVISION_STATUSES)
    .not('approved_sermon_draft_id', 'is', null)
    .not('research_dossier_id', 'is', null)
    .order('revision_number', { ascending: false })
    .limit(1);
  if (revisionError) throw revisionError;
  const revision = revisions?.[0];
  if (!revision) return null;

  const [{ data: pipelineRun, error: runError }, { data: draft, error: draftError }] = await Promise.all([
    client.from('hebrew_pipeline_runs').select('*').eq('revision_id', revision.id).maybeSingle(),
    client.from('hebrew_sermon_drafts').select('*').eq('id', revision.approved_sermon_draft_id).maybeSingle(),
  ]);
  if (runError) throw runError;
  if (draftError) throw draftError;
  if (!pipelineRun || !draft || draft.status !== 'approved') return null;

  const { data: evaluations, error: evaluationError } = await client
    .from('hebrew_sermon_evaluations')
    .select('*')
    .eq('sermon_draft_id', draft.id)
    .eq('passed', true)
    .order('created_at', { ascending: false })
    .limit(1);
  if (evaluationError) throw evaluationError;
  const evaluation = evaluations?.[0];
  if (!evaluation) return null;

  return { episode, revision, pipelineRun, draft, evaluation };
}

async function reopenRecoverableRevision(client, recovery) {
  const timestamp = new Date().toISOString();
  const { error: revisionError } = await client
    .from('hebrew_episode_revisions')
    .update({
      status: 'producing_audio',
      release_state: 'private',
      failure_reason: null,
      verified_at: null,
      published_at: null,
      updated_at: timestamp,
    })
    .eq('id', recovery.revision.id);
  if (revisionError) throw revisionError;

  const { error: runError } = await client
    .from('hebrew_pipeline_runs')
    .update({
      status: 'running',
      current_stage: 'audio_generate',
      error_information: null,
      finished_at: null,
      started_at: recovery.pipelineRun.started_at || timestamp,
      updated_at: timestamp,
    })
    .eq('id', recovery.pipelineRun.id);
  if (runError) throw runError;

  return {
    revisionId: recovery.revision.id,
    pipelineRunId: recovery.pipelineRun.id,
    resumed: true,
  };
}

function recoveredGenerationMetadata(recovery) {
  const metadata = recovery.draft.generation_metadata || {};
  const spoken = recovery.evaluation.hard_gate_results?.mechanical_spoken_check
    || recovery.draft.lesson_payload?.experience_quality?.spoken
    || {};
  const scores = {
    conversational_flow: Number(recovery.evaluation.conversational_flow) || 0,
    storytelling: Number(recovery.evaluation.storytelling) || 0,
    curiosity: Number(recovery.evaluation.curiosity) || 0,
    hebrew_integration: Number(recovery.evaluation.hebrew_integration) || 0,
    biblical_faithfulness: Number(recovery.evaluation.biblical_faithfulness) || 0,
    christ_centeredness: Number(recovery.evaluation.christ_centeredness) || 0,
    emotional_movement: Number(recovery.evaluation.emotional_movement) || 0,
    educational_value: Number(recovery.evaluation.educational_value) || 0,
    spoken_naturalness: Number(recovery.evaluation.spoken_naturalness) || 0,
    listener_engagement: Number(recovery.evaluation.listener_engagement) || 0,
  };
  return {
    lesson: recovery.draft.lesson_payload,
    wordCount: Number(recovery.draft.word_count) || 0,
    repairCount: Number(metadata.repair_count) || 0,
    evaluation: {
      weightedScore: Number(recovery.evaluation.weighted_score) || 0,
      scores,
    },
    spoken,
    model: recovery.draft.model,
    researchModel: metadata.research_model || null,
    evaluationModel: metadata.evaluation_model || null,
  };
}

async function finishAudio(client, lessonOrder, target, env) {
  const { data: trackId, error: prepareError } = await client.rpc(
    'prepare_hebrew_audio_track_from_private_lesson',
    { p_lesson_order: lessonOrder },
  );
  if (prepareError) throw prepareError;

  const supabaseUrl = env.HEBREW_SUPABASE_URL || env.SUPABASE_URL;
  const serviceKey = env.HEBREW_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error('Supabase audio credentials are missing.');

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const [{ data: track, error: trackError }, { data: segments, error: segmentError }] = await Promise.all([
      client.from('hebrew_audio_tracks').select('*').eq('id', trackId).single(),
      client.from('hebrew_audio_segments').select('*').eq('track_id', trackId).order('sort_order'),
    ]);
    if (trackError) throw trackError;
    if (segmentError) throw segmentError;

    const audioReady = segments.length > 0 && segments.every((segment) => (
      segment.status === 'ready'
      && String(segment.audio_path || '').trim()
      && Number(segment.duration_seconds) > 0
      && String(segment.checksum || '').trim()
    ));

    if (track.status === 'ready' && audioReady) {
      const { data: privateTrack, error: privateError } = await client
        .from('hebrew_audio_tracks')
        .update({ is_published: false, published_at: null, updated_at: new Date().toISOString() })
        .eq('id', trackId)
        .select('*')
        .single();
      if (privateError) throw privateError;
      return { track: privateTrack, segments };
    }

    if (track.status === 'generating') {
      await sleep(3500);
      continue;
    }

    try {
      const audioResponse = await fetch(`${supabaseUrl}/functions/v1/hebrew-daily-audio`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ trackId }),
        signal: AbortSignal.timeout(55000),
      });
      if (!audioResponse.ok) {
        const details = await audioResponse.text().catch(() => '');
        if ([408, 409, 429, 504].includes(audioResponse.status)) {
          await sleep(5000);
          continue;
        }
        throw new Error(`Cedar audio generation failed (${audioResponse.status}): ${details.slice(0, 240)}`);
      }
    } catch (error) {
      if (error?.name === 'AbortError' || error?.name === 'TimeoutError' || /aborted due to timeout/i.test(error?.message || '')) {
        await sleep(5000);
        continue;
      }
      throw error;
    }
  }

  throw new Error(`${target.reference} audio did not finish within the generation window.`);
}

async function assertNoDifferentActiveTrack(client, target) {
  const { data: active, error } = await client
    .from('hebrew_audio_tracks')
    .select('id,verse_reference,status')
    .in('status', ['generating', 'ready_to_generate']);
  if (error) throw error;
  const different = (active || []).find((track) => String(track.verse_reference).toLowerCase() !== target.reference.toLowerCase());
  if (different) {
    const conflict = new Error(`${different.verse_reference} is already being generated.`);
    conflict.statusCode = 409;
    throw conflict;
  }
}

function responsePayload({ target, lesson, audio, context, generated, resumed }) {
  return {
    ok: true,
    reference: target.reference,
    title: lesson.title,
    revision_id: context.revisionId,
    pipeline_version: V4_PIPELINE_VERSION,
    transcript_word_count: generated.wordCount,
    producer_quality_gate: 'passed',
    producer_weighted_score: generated.evaluation.weightedScore,
    producer_scores: generated.evaluation.scores,
    transcript_repair_count: generated.repairCount,
    spoken_readability: generated.spoken,
    progression_source: 'latest_complete_atomic_episode',
    resumed_incomplete_episode: Boolean(resumed),
    segment_count: audio.segments.length,
    total_duration_seconds: Number(audio.track.total_duration_seconds) || 0,
    model: generated.model,
    research_model: generated.researchModel,
    evaluation_model: generated.evaluationModel,
    status: audio.track.status,
    published: false,
    v4_next_stage: 'visual_plan',
  };
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
    const target = await resolveTarget(client, req.body?.requested_reference);
    await assertNoDifferentActiveTrack(client, target);

    const canonical = await fetchCanonicalVerse(target.reference);
    await ensureVerse(client, target, canonical);

    const recovery = await findRecoverableRevision(client, target.reference);
    if (recovery) {
      v4Context = await reopenRecoverableRevision(client, recovery);
      const generated = recoveredGenerationMetadata(recovery);
      const lesson = await ensureLesson(client, target, canonical, generated.lesson);
      const audio = await finishAudio(client, lesson.lesson_order, target, process.env);
      await linkV4PublishedAssets(client, v4Context, lesson, audio);
      return send(res, 200, responsePayload({
        target,
        lesson,
        audio,
        context: v4Context,
        generated,
        resumed: true,
      }));
    }

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

    return send(res, 200, responsePayload({
      target,
      lesson,
      audio,
      context: v4Context,
      generated,
      resumed: false,
    }));
  } catch (error) {
    console.error('V4 Hebrew generation failed.', error);
    try {
      await failV4Revision(client, v4Context, error);
    } catch (failureUpdateError) {
      console.error('Could not mark V4 revision failed.', failureUpdateError);
    }
    return send(res, Number(error?.statusCode) || 500, {
      ok: false,
      revision_id: v4Context?.revisionId || null,
      error: error?.message || 'V4 generation failed.',
    });
  }
}
