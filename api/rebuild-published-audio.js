import { getSupabaseAdminClient } from '../src/supabase-client.js';

export const maxDuration = 300;

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function send(res, status, body) {
  res.statusCode = status;
  for (const [key, value] of Object.entries(JSON_HEADERS)) res.setHeader(key, value);
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

function parseGenesisReference(reference) {
  const match = String(reference || '').trim().match(/^Genesis\s+(\d+):(\d+)$/i);
  if (!match) return null;
  const chapter = Number(match[1]);
  const verse = Number(match[2]);
  if (!Number.isInteger(chapter) || !Number.isInteger(verse) || chapter < 1 || verse < 1) return null;
  return { chapter, verse, reference: `Genesis ${chapter}:${verse}` };
}

function lessonOrderFor(reference) {
  return reference.chapter === 1
    ? reference.verse
    : Number(`${reference.chapter}${String(reference.verse).padStart(3, '0')}`);
}

async function addEvent(client, jobId, stage, status, message, details = {}) {
  const { error } = await client.from('hebrew_generation_job_events').insert({
    job_id: jobId,
    stage,
    status,
    message,
    details,
  });
  if (error) throw error;
}

async function updateJob(client, jobId, patch) {
  const { data, error } = await client
    .from('hebrew_generation_jobs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function generatePreparedTrack(origin, trackId, serviceRoleKey) {
  const attempts = [];

  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const response = await fetch(`${origin}/api/hebrew-audio-service`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${serviceRoleKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ operation: 'generate-next', trackId }),
      signal: AbortSignal.timeout(110000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result?.error || `Audio generator failed (${response.status}).`);
    attempts.push(result);
    if (result.ready) return { ready: true, attempts };
    await sleep(350);
  }

  return { ready: false, attempts };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed.' });

  const client = getSupabaseAdminClient(process.env);
  const jobId = String(req.query?.job_id || req.body?.job_id || '').trim();
  if (!jobId) return send(res, 400, { ok: false, error: 'job_id is required.' });

  try {
    const { data: job, error: jobError } = await client
      .from('hebrew_generation_jobs')
      .select('*')
      .eq('id', jobId)
      .single();
    if (jobError) throw jobError;
    if (job.mode !== 'audio_rebuild') {
      return send(res, 409, { ok: false, error: `Job mode ${job.mode} cannot rebuild published audio.` });
    }
    if (!['queued', 'failed'].includes(job.status)) {
      return send(res, 409, { ok: false, error: `Job is ${job.status}.`, job });
    }
    if (job.attempt_count >= job.max_attempts) {
      return send(res, 409, { ok: false, error: 'Maximum attempts reached.', job });
    }

    const target = parseGenesisReference(job.requested_reference);
    if (!target) throw new Error(`Invalid Genesis reference: ${job.requested_reference || 'empty'}.`);
    const lessonOrder = lessonOrderFor(target);

    await updateJob(client, jobId, {
      status: 'running',
      current_stage: 'prepare_full_sermon_audio',
      attempt_count: job.attempt_count + 1,
      started_at: new Date().toISOString(),
      finished_at: null,
      error_message: null,
    });
    await addEvent(
      client,
      jobId,
      'prepare_full_sermon_audio',
      'started',
      `${target.reference} full sermon audio rebuild started.`,
      { lesson_order: lessonOrder },
    );

    const { data: trackId, error: prepareError } = await client.rpc(
      'prepare_hebrew_audio_track_from_private_lesson',
      { p_lesson_order: lessonOrder },
    );
    if (prepareError) throw prepareError;
    if (!trackId) throw new Error('Audio preparation returned no track ID.');

    const serviceRoleKey = process.env.HEBREW_SUPABASE_SERVICE_ROLE_KEY
      || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) throw new Error('Supabase service role key is missing from Vercel.');

    const origin = `https://${req.headers.host}`;
    const generation = await generatePreparedTrack(origin, trackId, serviceRoleKey);
    if (!generation.ready) throw new Error('The full sermon audio did not finish within the rebuild run.');

    const timestamp = new Date().toISOString();
    const { data: track, error: trackError } = await client
      .from('hebrew_audio_tracks')
      .update({
        status: 'ready',
        is_published: true,
        published_at: timestamp,
        updated_at: timestamp,
      })
      .eq('id', trackId)
      .select('*')
      .single();
    if (trackError) throw trackError;

    const { error: lessonError } = await client
      .from('hebrew_lessons')
      .update({ is_published: true, updated_at: timestamp })
      .eq('id', track.lesson_id);
    if (lessonError) throw lessonError;

    const { data: segments, error: segmentError } = await client
      .from('hebrew_audio_segments')
      .select('id,segment_type,sort_order,status,audio_path,duration_seconds,checksum')
      .eq('track_id', trackId)
      .order('sort_order');
    if (segmentError) throw segmentError;

    const readySegments = (segments || []).filter((segment) => (
      segment.status === 'ready'
      && String(segment.audio_path || '').trim()
      && Number(segment.duration_seconds) > 0
      && String(segment.checksum || '').trim()
    ));
    if (!segments?.length || readySegments.length !== segments.length) {
      throw new Error('The rebuilt audio failed final segment verification.');
    }

    const result = {
      ok: true,
      reference: target.reference,
      lesson_order: lessonOrder,
      track_id: trackId,
      script_version: track.script_version,
      segment_count: segments.length,
      sermon_segment_count: segments.filter((segment) => segment.segment_type.startsWith('sermon-part-')).length,
      total_duration_seconds: Number(track.total_duration_seconds) || 0,
      generation_attempts: generation.attempts.length,
    };

    const completed = await updateJob(client, jobId, {
      status: 'succeeded',
      current_stage: 'published_audio_rebuilt',
      resolved_reference: target.reference,
      expected_segment_count: segments.length,
      ready_segment_count: readySegments.length,
      result,
      error_message: null,
      finished_at: timestamp,
    });
    await addEvent(
      client,
      jobId,
      'published_audio_rebuilt',
      'completed',
      `${target.reference} now uses the complete V4 sermon transcript in Cedar audio.`,
      result,
    );

    return send(res, 200, { ok: true, job: completed, result });
  } catch (error) {
    const message = error?.message || 'Published audio rebuild failed.';
    try {
      await updateJob(client, jobId, {
        status: 'failed',
        current_stage: 'audio_rebuild_failed',
        error_message: message,
        finished_at: new Date().toISOString(),
      });
      await addEvent(client, jobId, 'audio_rebuild_failed', 'failed', message);
    } catch (loggingError) {
      console.error('Could not record audio rebuild failure.', loggingError);
    }
    console.error('Published audio rebuild failed.', error);
    return send(res, 500, { ok: false, job_id: jobId, error: message });
  }
}
