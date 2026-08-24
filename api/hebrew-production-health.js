import crypto from 'node:crypto';
import { getSupabaseAdminClient } from '../src/supabase-client.js';

export const maxDuration = 30;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return send(res, 405, { ok: false, error: 'Method not allowed.' });
  }

  const expected = process.env.HEBREW_AUDIO_ADMIN_KEY || '';
  const supplied = req.headers['x-hebrew-admin-key'] || '';
  if (!safeEqual(supplied, expected)) {
    return send(res, 401, { ok: false, error: 'Invalid admin credential.' });
  }

  try {
    const client = getSupabaseAdminClient(process.env);
    const { data, error } = await client.rpc('hebrew_production_health');
    if (error) throw error;
    return send(res, 200, { ok: true, health: data });
  } catch (error) {
    console.error('Hebrew production health failed.', error);
    return send(res, 500, {
      ok: false,
      error: error?.message || 'Could not read Hebrew production health.',
    });
  }
}
