import { getSupabaseAdminClient } from '../src/supabase-client.js';

export const maxDuration = 300;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return send(res, 405, { ok: false, error: 'Method not allowed.' });
  try {
    const client = getSupabaseAdminClient(process.env);
    const { data: lesson, error: lessonError } = await client.from('hebrew_lessons').select('*').eq('lesson_order', 27).single();
    if (lessonError) throw lessonError;
    if (!lesson.is_published) throw new Error('Genesis 1:27 lesson is not published.');

    const { data: trackId, error: prepareError } = await client.rpc('prepare_hebrew_audio_track_from_lesson', { p_lesson_order: 27 });
    if (prepareError) throw prepareError;

    const supabaseUrl = process.env.HEBREW_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey = process.env.HEBREW_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    for (let attempt = 0; attempt < 24; attempt += 1) {
      const { data: track, error: trackError } = await client.from('hebrew_audio_tracks').select('*').eq('id', trackId).single();
      if (trackError) throw trackError;
      const { data: segments, error: segmentError } = await client.from('hebrew_audio_segments').select('*').eq('track_id', trackId).order('sort_order');
      if (segmentError) throw segmentError;
      const readySegments = (segments || []).filter((segment) => segment.status === 'ready' && segment.audio_path).length;

      if (track.status === 'ready' && track.is_published && readySegments === (segments || []).length && readySegments > 0) {
        return send(res, 200, {
          ok: true,
          reference: 'Genesis 1:27',
          lesson_id: lesson.id,
          track_id: track.id,
          status: track.status,
          published: Boolean(track.is_published),
          segment_count: segments.length,
          ready_segment_count: readySegments,
          total_duration_seconds: Number(track.total_duration_seconds) || 0,
        });
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/hebrew-daily-audio`, {
        method: 'POST',
        headers: { authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'content-type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Cedar audio generation failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ''}.`);
      }
    }

    throw new Error('Genesis 1:27 audio did not finish within the generation window.');
  } catch (error) {
    console.error('Genesis 1:27 audio publication failed.', error);
    return send(res, 500, { ok: false, reference: 'Genesis 1:27', error: error?.message || 'Audio publication failed.' });
  }
}
