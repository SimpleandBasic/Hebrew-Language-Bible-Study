import { getSupabaseAdminClient } from '../src/supabase-client.js';

export const maxDuration = 300;

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

function send(res, status, body) {
  res.statusCode = status;
  for (const [key, value] of Object.entries(JSON_HEADERS)) res.setHeader(key, value);
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
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
    .update(patch)
    .eq('id', jobId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    return send(res, 405, { ok: false, error: 'Method not allowed.' });
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
      current_stage: 'pipeline_started',
      attempt_count: job.attempt_count + 1,
      started_at: new Date().toISOString(),
      finished_at: null,
      error_message: null,
    });
    await addEvent(client, jobId, 'pipeline_started', 'started', 'Production generation pipeline started.');

    const origin = `https://${req.headers.host}`;
    const generationResponse = await fetch(`${origin}/api/generate-next-verse`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hebrew-generation-job-id': jobId,
      },
      body: JSON.stringify({ job_id: jobId, mode: job.mode, requested_reference: job.requested_reference }),
    });
    const result = await generationResponse.json().catch(() => ({}));

    if (!generationResponse.ok || !result.ok) {
      throw new Error(result?.error || `Generation pipeline failed (${generationResponse.status}).`);
    }

    const completed = await updateJob(client, jobId, {
      status: 'succeeded',
      current_stage: 'production_verified',
      resolved_reference: result.reference || job.requested_reference,
      transcript_word_count: result.transcript_word_count || null,
      expected_segment_count: result.segment_count || null,
      ready_segment_count: result.segment_count || null,
      result,
      finished_at: new Date().toISOString(),
    });
    await addEvent(client, jobId, 'production_verified', 'completed', `${result.reference} generated and published.`, result);

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
