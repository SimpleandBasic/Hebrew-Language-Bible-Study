import crypto from 'node:crypto';
import { verifyRevision, publishRevision } from '../src/v4/release-manager.js';

export const maxDuration = 300;

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed.' });
  const expected = process.env.HEBREW_AUDIO_ADMIN_KEY || '';
  const supplied = req.headers['x-hebrew-admin-key'] || '';
  if (!safeEqual(supplied, expected)) return send(res, 401, { ok: false, error: 'Invalid admin credential.' });

  const revisionId = String(req.body?.revision_id || '').trim();
  const action = String(req.body?.action || 'verify').trim();
  if (!revisionId) return send(res, 400, { ok: false, error: 'revision_id is required.' });

  try {
    if (action === 'verify') return send(res, 200, await verifyRevision(revisionId));
    if (action === 'publish') return send(res, 200, await publishRevision(revisionId, {
      publishedBy: String(req.body?.published_by || 'release_manager'),
      reason: String(req.body?.reason || 'All V4 release gates passed.'),
    }));
    return send(res, 400, { ok: false, error: 'Supported actions: verify, publish.' });
  } catch (error) {
    console.error('Hebrew V4 release operation failed.', error);
    return send(res, 500, { ok: false, action, revision_id: revisionId, error: error?.message || 'Release operation failed.' });
  }
}
