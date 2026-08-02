import { randomUUID } from "node:crypto";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return UUID_PATTERN.test(String(value || ""));
}

export function slugify(value) {
  const slug = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return slug || "hebrew-bible-study";
}

export function publicOrigin(request) {
  const configured = String(process.env.PUBLIC_SITE_URL || "").replace(/\/$/, "");
  if (configured) return configured;
  const protocol = String(request.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = String(request.headers["x-forwarded-host"] || request.headers.host || "").split(",")[0].trim();
  return host ? `${protocol}://${host}` : "";
}

export function shareUrlFor(request, share) {
  const origin = publicOrigin(request);
  const token = encodeURIComponent(share.share_token);
  const slug = encodeURIComponent(share.slug || "hebrew-bible-study");
  return `${origin}/listen/${token}/${slug}`;
}

function requireEnvironment() {
  const url = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!url || !serviceRoleKey) {
    throw new Error("Server sharing configuration is missing.");
  }
  return { url, serviceRoleKey };
}

function restHeaders(serviceRoleKey, extra = {}) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function supabaseRequest(path, options = {}) {
  const { url, serviceRoleKey } = requireEnvironment();
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: restHeaders(serviceRoleKey, options.headers),
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  if (!response.ok) {
    const message = body?.message || body?.error || `Supabase request failed (${response.status}).`;
    const error = new Error(message);
    error.status = response.status;
    error.details = body;
    throw error;
  }
  return body;
}

function encodeStoragePath(path) {
  return String(path || "").split("/").map(encodeURIComponent).join("/");
}

function publicStorageUrl(path) {
  if (!path) return "";
  const { url } = requireEnvironment();
  return `${url}/storage/v1/object/public/hebrew-media/${encodeStoragePath(path)}`;
}

async function getPublishedTrack(trackId) {
  const query = new URLSearchParams({
    select: "id,verse_id,verse_reference,track_title,status,is_published",
    id: `eq.${trackId}`,
    status: "eq.ready",
    is_published: "eq.true",
    limit: "1",
  });
  const rows = await supabaseRequest(`/rest/v1/hebrew_audio_tracks?${query}`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function findShareByTrack(trackId) {
  const query = new URLSearchParams({
    select: "id,track_id,share_token,slug,is_active,expires_at,created_at,updated_at",
    track_id: `eq.${trackId}`,
    limit: "1",
  });
  const rows = await supabaseRequest(`/rest/v1/hebrew_episode_shares?${query}`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function findShareByToken(token) {
  const query = new URLSearchParams({
    select: "id,track_id,share_token,slug,is_active,expires_at,created_at,updated_at",
    share_token: `eq.${token}`,
    is_active: "eq.true",
    limit: "1",
  });
  const rows = await supabaseRequest(`/rest/v1/hebrew_episode_shares?${query}`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

function isExpired(share) {
  return Boolean(share?.expires_at && new Date(share.expires_at).getTime() <= Date.now());
}

async function createShare(track, slug) {
  const payload = {
    track_id: track.id,
    slug,
    is_active: true,
  };
  const rows = await supabaseRequest("/rest/v1/hebrew_episode_shares", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function refreshShare(share, slug) {
  const query = new URLSearchParams({ id: `eq.${share.id}` });
  const payload = {
    share_token: randomUUID(),
    slug,
    is_active: true,
    expires_at: null,
    updated_at: new Date().toISOString(),
  };
  const rows = await supabaseRequest(`/rest/v1/hebrew_episode_shares?${query}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  return Array.isArray(rows) ? rows[0] || null : null;
}

export async function getOrCreateEpisodeShare(trackId) {
  if (!isUuid(trackId)) {
    const error = new Error("A valid audio track id is required.");
    error.status = 400;
    throw error;
  }

  const track = await getPublishedTrack(trackId);
  if (!track) {
    const error = new Error("That episode is not available for sharing.");
    error.status = 404;
    throw error;
  }

  const slug = slugify(`${track.verse_reference}-${track.track_title}`);
  const existing = await findShareByTrack(track.id);
  if (existing && existing.is_active && !isExpired(existing)) {
    if (existing.slug === slug) return { share: existing, track };
    const query = new URLSearchParams({ id: `eq.${existing.id}` });
    const rows = await supabaseRequest(`/rest/v1/hebrew_episode_shares?${query}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ slug, updated_at: new Date().toISOString() }),
    });
    return { share: Array.isArray(rows) ? rows[0] : existing, track };
  }

  if (existing) return { share: await refreshShare(existing, slug), track };

  try {
    return { share: await createShare(track, slug), track };
  } catch (error) {
    // A simultaneous first share can race the unique(track_id) constraint.
    if (error.status !== 409) throw error;
    const racedShare = await findShareByTrack(track.id);
    if (!racedShare) throw error;
    return { share: racedShare, track };
  }
}

async function getSegments(trackId) {
  const query = new URLSearchParams({
    select: "id,track_id,sort_order,segment_type,label,audio_path,duration_seconds,display_transcript,spoken_text,status",
    track_id: `eq.${trackId}`,
    status: "eq.ready",
    audio_path: "not.is.null",
    order: "sort_order.asc",
  });
  const rows = await supabaseRequest(`/rest/v1/hebrew_audio_segments?${query}`);
  return Array.isArray(rows) ? rows : [];
}

async function getArtwork(reference) {
  const book = String(reference || "").split(/\s+/)[0].toLowerCase();
  if (!book) return "";
  const query = new URLSearchParams({
    select: "artwork_path",
    book_key: `eq.${book}`,
    is_visible: "eq.true",
    limit: "1",
  });
  try {
    const rows = await supabaseRequest(`/rest/v1/hebrew_book_albums?${query}`);
    return publicStorageUrl(Array.isArray(rows) ? rows[0]?.artwork_path : "");
  } catch {
    return "";
  }
}

export async function getSharedEpisode(token) {
  if (!isUuid(token)) {
    const error = new Error("This shared episode link is invalid.");
    error.status = 404;
    throw error;
  }

  const share = await findShareByToken(token);
  if (!share || isExpired(share)) {
    const error = new Error("This shared episode is no longer available.");
    error.status = 404;
    throw error;
  }

  const track = await getPublishedTrack(share.track_id);
  if (!track) {
    const error = new Error("This episode has been unpublished.");
    error.status = 404;
    throw error;
  }

  const segments = await getSegments(track.id);
  if (!segments.length) {
    const error = new Error("This episode's audio is still being prepared.");
    error.status = 404;
    throw error;
  }

  return {
    id: track.id,
    reference: track.verse_reference,
    title: track.track_title,
    slug: share.slug,
    artworkUrl: await getArtwork(track.verse_reference),
    segments: segments.map((segment) => ({
      id: segment.id,
      order: Number(segment.sort_order) || 0,
      type: segment.segment_type || "section",
      label: segment.label || `Section ${segment.sort_order}`,
      audioUrl: publicStorageUrl(segment.audio_path),
      durationSeconds: Number(segment.duration_seconds) || 0,
      transcript: segment.display_transcript || segment.spoken_text || "",
    })),
  };
}

export function setCommonSecurityHeaders(response, { cache = false } = {}) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("Cache-Control", cache ? "public, max-age=60, stale-while-revalidate=300" : "no-store");
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}
