import { randomUUID } from 'node:crypto';
import { getSupabaseAdminClient } from './supabase-client.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return UUID_PATTERN.test(String(value || ''));
}

export function slugify(value) {
  const slug = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
  return slug || 'hebrew-bible-study';
}

export function publicOrigin(request) {
  const protocol = String(request.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(request.headers['x-forwarded-host'] || request.headers.host || '').split(',')[0].trim();
  const incoming = host ? `${protocol}://${host}` : '';
  const configured = String(process.env.PUBLIC_SITE_URL || '').replace(/\/$/, '');
  if (process.env.VERCEL_ENV === 'preview' && incoming) return incoming;
  return configured || incoming;
}

export function shareUrlFor(request, share) {
  return `${publicOrigin(request)}/listen/${encodeURIComponent(share.share_token)}/${encodeURIComponent(share.slug || 'hebrew-bible-study')}`;
}

function client(options = {}) {
  return options.supabase || getSupabaseAdminClient(options.env || process.env);
}

function databaseError(error, fallback) {
  const wrapped = new Error(error?.message || fallback);
  wrapped.status = 500;
  return wrapped;
}

async function publishedTrack(supabase, trackId) {
  const { data, error } = await supabase
    .from('hebrew_audio_tracks')
    .select('id,verse_id,verse_reference,track_title,status,is_published')
    .eq('id', trackId)
    .eq('status', 'ready')
    .eq('is_published', true)
    .maybeSingle();
  if (error) throw databaseError(error, 'Could not verify the episode.');
  return data || null;
}

async function shareByTrack(supabase, trackId) {
  const { data, error } = await supabase
    .from('hebrew_episode_shares')
    .select('*')
    .eq('track_id', trackId)
    .maybeSingle();
  if (error) throw databaseError(error, 'Could not read the episode share.');
  return data || null;
}

async function shareByToken(supabase, token) {
  const { data, error } = await supabase
    .from('hebrew_episode_shares')
    .select('*')
    .eq('share_token', token)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw databaseError(error, 'Could not read the shared episode.');
  return data || null;
}

function expired(share) {
  return Boolean(share?.expires_at && new Date(share.expires_at).getTime() <= Date.now());
}

export async function getOrCreateEpisodeShare(trackId, options = {}) {
  if (!isUuid(trackId)) {
    const error = new Error('A valid audio track id is required.');
    error.status = 400;
    throw error;
  }

  const supabase = client(options);
  const track = await publishedTrack(supabase, trackId);
  if (!track) {
    const error = new Error('That episode is not available for sharing.');
    error.status = 404;
    throw error;
  }

  const slug = slugify(`${track.verse_reference}-${track.track_title}`);
  const existing = await shareByTrack(supabase, track.id);
  if (existing?.is_active && !expired(existing)) {
    if (existing.slug === slug) return { share: existing, track };
    const { data, error } = await supabase
      .from('hebrew_episode_shares')
      .update({ slug, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw databaseError(error, 'Could not update the share link.');
    return { share: data, track };
  }

  if (existing) {
    const { data, error } = await supabase
      .from('hebrew_episode_shares')
      .update({
        share_token: randomUUID(),
        slug,
        is_active: true,
        expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw databaseError(error, 'Could not refresh the share link.');
    return { share: data, track };
  }

  const { data, error } = await supabase
    .from('hebrew_episode_shares')
    .insert({ track_id: track.id, slug, is_active: true })
    .select('*')
    .single();
  if (error) {
    if (error.code === '23505') {
      const raced = await shareByTrack(supabase, track.id);
      if (raced) return { share: raced, track };
    }
    throw databaseError(error, 'Could not create the share link.');
  }
  return { share: data, track };
}

function publicMediaUrl(supabase, path) {
  if (!path) return '';
  return supabase.storage.from('hebrew-media').getPublicUrl(path).data.publicUrl || '';
}

export async function getSharedEpisode(token, options = {}) {
  if (!isUuid(token)) {
    const error = new Error('This shared episode link is invalid.');
    error.status = 404;
    throw error;
  }

  const supabase = client(options);
  const share = await shareByToken(supabase, token);
  if (!share || expired(share)) {
    const error = new Error('This shared episode is no longer available.');
    error.status = 404;
    throw error;
  }

  const track = await publishedTrack(supabase, share.track_id);
  if (!track) {
    const error = new Error('This episode has been unpublished.');
    error.status = 404;
    throw error;
  }

  const { data: segments, error: segmentError } = await supabase
    .from('hebrew_audio_segments')
    .select('id,track_id,sort_order,segment_type,label,audio_path,duration_seconds,display_transcript,spoken_text,status')
    .eq('track_id', track.id)
    .eq('status', 'ready')
    .not('audio_path', 'is', null)
    .order('sort_order', { ascending: true });
  if (segmentError) throw databaseError(segmentError, 'Could not load the episode audio.');
  if (!segments?.length) {
    const error = new Error("This episode's audio is still being prepared.");
    error.status = 404;
    throw error;
  }

  const book = String(track.verse_reference || '').split(/\s+/)[0].toLowerCase();
  const { data: album } = await supabase
    .from('hebrew_book_albums')
    .select('artwork_path')
    .eq('book_key', book)
    .eq('is_visible', true)
    .maybeSingle();

  return {
    id: track.id,
    reference: track.verse_reference,
    title: track.track_title,
    slug: share.slug,
    artworkUrl: publicMediaUrl(supabase, album?.artwork_path),
    segments: segments.map((segment) => ({
      id: segment.id,
      order: Number(segment.sort_order) || 0,
      type: segment.segment_type || 'section',
      label: segment.label || `Section ${segment.sort_order}`,
      audioUrl: publicMediaUrl(supabase, segment.audio_path),
      durationSeconds: Number(segment.duration_seconds) || 0,
      transcript: segment.display_transcript || segment.spoken_text || '',
    })),
  };
}

export function setCommonSecurityHeaders(response, { cache = false } = {}) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader('Cache-Control', cache ? 'public, max-age=60, stale-while-revalidate=300' : 'no-store');
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);
}
