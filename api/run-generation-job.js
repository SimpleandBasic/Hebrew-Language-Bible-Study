import crypto from 'node:crypto';
import { getSupabaseAdminClient } from '../src/supabase-client.js';
import { verifyRevision, publishRevision } from '../src/v4/release-manager.js';

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

async function addEvent(client, jobId, stage, status, message, details = {}) {
  const { error } = await client
    .from('hebrew_generation_job_events')
    .insert({ job_id: jobId, stage, status, message, details });
  if (error) throw error;
}

async function updateJob(client, jobId, patch) {
  const { data, error } = await client
    .from('hebrew_generation_jobs')
    .update(patch)
    .eq('id', jobId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function runGeneration(origin, job, jobId, client) {
  await addEvent(
    client,
    jobId,
    'v4_episode_pipeline',
    'started',
    'V4 research, narrative, sermon, evaluation, and audio pipeline started.',
    { pipeline_version: 'sermon-experience-v4.1' },
  );

  const generationResponse = await fetch(`${origin}/api/generate-next-verse`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-hebrew-generation-job-id': jobId,
    },
    body: JSON.stringify({
      job_id: jobId,
      mode: job.mode,
      requested_reference: job.requested_reference,
    }),
    signal: AbortSignal.timeout(295000),
  });
  const result = await generationResponse.json().catch(() => ({}));

  if (!generationResponse.ok || !result.ok) {
    throw new Error(result?.error || `Generation pipeline failed (${generationResponse.status}).`);
  }

  await addEvent(
    client,
    jobId,
    'v4_episode_pipeline',
    'completed',
    `${result.reference} passed the V4 sermon and audio gates.`,
    {
      revision_id: result.revision_id,
      transcript_word_count: result.transcript_word_count,
      producer_weighted_score: result.producer_weighted_score,
      segment_count: result.segment_count,
      next_stage: result.v4_next_stage,
    },
  );
  return result;
}

async function handleV4ReleaseAction(req, res) {
  const expected = process.env.HEBREW_AUDIO_ADMIN_KEY || '';
  const supplied = req.headers['x-hebrew-admin-key'] || '';
  if (!safeEqual(supplied, expected)) {
    return send(res, 401, { ok: false, error: 'Invalid admin credential.' });
  }

  const revisionId = String(req.query?.revision_id || req.body?.revision_id || '').trim();
  const action = String(req.query?.action || req.body?.action || '').trim();
  if (!revisionId) return send(res, 400, { ok: false, error: 'revision_id is required.' });

  try {
    if (action === 'verify_revision') return send(res, 200, await verifyRevision(revisionId));
    if (action === 'publish_revision') {
      return send(res, 200, await publishRevision(revisionId, {
        publishedBy: String(req.body?.published_by || 'release_manager'),
        reason: String(req.body?.reason || 'All V4 release gates passed.'),
      }));
    }
    return send(res, 400, {
      ok: false,
      error: 'Supported V4 actions: verify_revision, publish_revision.',
    });
  } catch (error) {
    return send(res, 500, {
      ok: false,
      action,
      revision_id: revisionId,
      error: error?.message || 'V4 release action failed.',
    });
  }
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    return send(res, 405, { ok: false, error: 'Method not allowed.' });
  }

  const action = String(req.query?.action || req.body?.action || '').trim();
  if (action === 'verify_revision' || action === 'publish_revision') {
    return handleV4ReleaseAction(req, res);
  }

  const jobId = String(req.query?.job_id || req.body?.job_id || '').trim();
  if (!jobId) return send(res, 400, { ok: false, error: 'job_id is required.' });

  const client = getSupabaseAdminClient(process.env);
  try {
    const { data: job, error: jobError } = await client
      .from('hebrew_generation_jobs')
      .select('*')
      .eq('id', jobId)
      .single();
    if (jobError) throw jobError;
    if (!['queued', 'failed'].includes(job.status)) {
      return send(res, 409, { ok: false, error: `Job is ${job.status}.`, job });
    }
    if (job.attempt_count >= job.max_attempts) {
      return send(res, 409, { ok: false, error: 'Maximum attempts reached.', job });
    }

    await updateJob(client, jobId, {
      status: 'running',
      current_stage: 'v4_episode_pipeline',
      attempt_count: job.attempt_count + 1,
      started_at: new Date().toISOString(),
      finished_at: null,
      error_message: null,
    });
    await addEvent(
      client,
      jobId,
      'pipeline_started',
      'started',
      'Production V4 generation pipeline started.',
    );

    const origin = `https://${req.headers.host}`;
    const result = await runGeneration(origin, job, jobId, client);
    const completed = await updateJob(client, jobId, {
      status: 'succeeded',
      current_stage: result.v4_next_stage || 'production_verified',
      resolved_reference: result.reference || job.requested_reference,
      transcript_word_count: result.transcript_word_count || null,
      expected_segment_count: result.segment_count || null,
      ready_segment_count: result.segment_count || null,
      result,
      error_message: null,
      finished_at: new Date().toISOString(),
    });
    await addEvent(
      client,
      jobId,
      'production_verified',
      'completed',
      `${result.reference} generated with V4 sermon quality and complete audio.`,
      result,
    );
    return send(res, 200, { ok: true, job: completed, result });
  } catch (error) {
    const message = error?.message || 'Mission Control job failed.';
    try {
      await updateJob(client, jobId, {
        status: 'failed',
        current_stage: 'failed',
        error_message: message,
        finished_at: new Date().toISOString(),
      });
      await addEvent(client, jobId, 'failed', 'failed', message);
    } catch (loggingError) {
      console.error('Could not record Mission Control failure.', loggingError);
    }
    console.error('Mission Control job failed.', error);
    return send(res, 500, { ok: false, job_id: jobId, error: message });
  }
}
