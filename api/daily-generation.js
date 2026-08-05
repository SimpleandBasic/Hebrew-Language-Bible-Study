import crypto from 'node:crypto';
import { getSupabaseAdminClient } from '../src/supabase-client.js';

export const maxDuration = 300;

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
const ACTIVE_STATUSES = ['queued', 'running'];

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

function losAngelesDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

async function findTodayJob(client, releaseDay) {
  const { data, error } = await client
    .from('hebrew_generation_jobs')
    .select('*')
    .eq('requested_by', 'overnight_cron_v4')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data || []).find((job) => job?.result?.release_day === releaseDay) || null;
}

async function createDailyJob(client, releaseDay) {
  const { data: reference, error: referenceError } = await client.rpc('next_hebrew_v4_reference');
  if (referenceError) throw referenceError;
  if (!reference) throw new Error('The next Genesis reference could not be resolved.');

  const { data: job, error } = await client
    .from('hebrew_generation_jobs')
    .insert({
      requested_reference: reference,
      mode: 'publish',
      environment: 'production',
      status: 'queued',
      current_stage: 'queued',
      attempt_count: 0,
      max_attempts: 3,
      requested_by: 'overnight_cron_v4',
      result: {
        source: 'vercel_cron',
        release_day: releaseDay,
        requested_at: new Date().toISOString(),
        complete_release_required: true,
      },
    })
    .select('*')
    .single();
  if (error) throw error;
  return job;
}

async function runJob(req, job) {
  const origin = `https://${req.headers.host}`;
  const response = await fetch(`${origin}/api/run-generation-job?job_id=${encodeURIComponent(job.id)}`, {
    method: 'GET',
    headers: { 'x-hebrew-cron-dispatch': 'overnight-v4' },
    signal: AbortSignal.timeout(295000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) {
    throw new Error(payload?.error || `Overnight generation failed (${response.status}).`);
  }
  return payload;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'Method not allowed.' });

  const secret = process.env.CRON_SECRET || '';
  const authorization = req.headers.authorization || '';
  if (!safeEqual(authorization, `Bearer ${secret}`)) {
    return send(res, 401, { ok: false, error: 'Invalid cron credential.' });
  }

  const client = getSupabaseAdminClient(process.env);
  const releaseDay = losAngelesDay();

  try {
    let job = await findTodayJob(client, releaseDay);

    if (job?.status === 'succeeded') {
      return send(res, 200, {
        ok: true,
        skipped: true,
        reason: 'Today’s complete Hebrew episode is already published.',
        release_day: releaseDay,
        job_id: job.id,
        reference: job.resolved_reference || job.requested_reference,
      });
    }

    if (job && ACTIVE_STATUSES.includes(job.status)) {
      return send(res, 202, {
        ok: true,
        skipped: true,
        reason: `Today’s Hebrew episode is already ${job.status}.`,
        release_day: releaseDay,
        job_id: job.id,
        reference: job.requested_reference,
      });
    }

    if (!job || (job.status === 'failed' && job.attempt_count >= job.max_attempts)) {
      job = await createDailyJob(client, releaseDay);
    }

    const result = await runJob(req, job);
    return send(res, 200, {
      ok: true,
      release_day: releaseDay,
      job_id: job.id,
      reference: result?.result?.reference || job.requested_reference,
      published: Boolean(result?.result?.published),
      result: result.result,
    });
  } catch (error) {
    console.error('Overnight Hebrew generation failed.', error);
    return send(res, 500, {
      ok: false,
      release_day: releaseDay,
      error: error?.message || 'Overnight Hebrew generation failed.',
    });
  }
}
