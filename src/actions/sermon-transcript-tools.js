import { getSupabaseAdminClient } from '../supabase-client.js';

const clean = (value) => String(value || '').trim();

function normalizeReference(value) {
  const input = clean(value);
  if (!input) return '';
  const match = input.match(/^Genesis\s+(\d+):(\d+)$/i);
  return match ? `Genesis ${Number(match[1])}:${Number(match[2])}` : input;
}

function elevenLabsSafeTranscript(value) {
  return clean(value)
    .replace(/[\u0590-\u05FF]+/g, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/[—–]/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim();
}

async function loadTranscriptRows(supabase, reference = '') {
  let episodeQuery = supabase
    .from('hebrew_episodes')
    .select('id,reference,canonical_slug,current_published_revision_id,created_at,updated_at')
    .order('updated_at', { ascending: false });
  if (reference) episodeQuery = episodeQuery.eq('reference', normalizeReference(reference));

  const { data: episodes, error: episodeError } = await episodeQuery;
  if (episodeError) throw new Error(`Could not load Hebrew episodes: ${episodeError.message}`);
  if (!episodes?.length) return [];

  const episodeIds = episodes.map((episode) => episode.id);
  const { data: revisions, error: revisionError } = await supabase
    .from('hebrew_episode_revisions')
    .select('id,episode_id,revision_number,status,release_state,approved_sermon_draft_id,published_at,created_at,updated_at')
    .in('episode_id', episodeIds)
    .not('approved_sermon_draft_id', 'is', null)
    .order('revision_number', { ascending: false });
  if (revisionError) throw new Error(`Could not load Hebrew revisions: ${revisionError.message}`);
  if (!revisions?.length) return [];

  const draftIds = [...new Set(revisions.map((revision) => revision.approved_sermon_draft_id).filter(Boolean))];
  const { data: drafts, error: draftError } = await supabase
    .from('hebrew_sermon_drafts')
    .select('id,revision_id,draft_number,transcript,lesson_payload,word_count,prompt_version,model,generation_metadata,status,created_at')
    .in('id', draftIds);
  if (draftError) throw new Error(`Could not load Hebrew sermon drafts: ${draftError.message}`);

  const draftById = new Map((drafts || []).map((draft) => [draft.id, draft]));
  const episodeById = new Map(episodes.map((episode) => [episode.id, episode]));

  return revisions
    .map((revision) => {
      const episode = episodeById.get(revision.episode_id);
      const draft = draftById.get(revision.approved_sermon_draft_id);
      if (!episode || !draft || !clean(draft.transcript)) return null;
      const title = clean(draft.lesson_payload?.sermon_title || draft.lesson_payload?.title || episode.reference);
      return {
        reference: episode.reference,
        slug: episode.canonical_slug,
        title,
        transcript: draft.transcript,
        elevenlabs_text: elevenLabsSafeTranscript(draft.transcript),
        word_count: Number(draft.word_count) || null,
        draft_status: draft.status,
        revision_status: revision.status,
        release_state: revision.release_state,
        published: episode.current_published_revision_id === revision.id,
        revision_number: revision.revision_number,
        revision_id: revision.id,
        draft_id: draft.id,
        model: draft.model || null,
        created_at: draft.created_at,
        updated_at: revision.updated_at,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.published !== b.published) return a.published ? -1 : 1;
      if (a.reference === b.reference) return b.revision_number - a.revision_number;
      return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
    });
}

export async function getHebrewSermonTranscript(input = {}, options = {}) {
  const supabase = options.supabase ?? getSupabaseAdminClient(options.env);
  const reference = normalizeReference(input.reference);
  const rows = await loadTranscriptRows(supabase, reference);
  if (!rows.length) {
    throw new Error(reference
      ? `No saved sermon transcript is available for ${reference}.`
      : 'No saved Hebrew sermon transcript is available.');
  }
  const row = rows[0];
  return {
    ok: true,
    source: 'hebrew_sermon_drafts',
    ...row,
    requested_format: clean(input.format) || 'both',
  };
}

export async function listHebrewSermonTranscripts(input = {}, options = {}) {
  const supabase = options.supabase ?? getSupabaseAdminClient(options.env);
  const parsed = Number.parseInt(input.limit, 10);
  const limit = Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, 100)) : 25;
  const rows = await loadTranscriptRows(supabase);
  const seen = new Set();
  const items = [];
  for (const row of rows) {
    if (seen.has(row.reference)) continue;
    seen.add(row.reference);
    items.push({
      reference: row.reference,
      title: row.title,
      word_count: row.word_count,
      published: row.published,
      revision_status: row.revision_status,
      release_state: row.release_state,
      updated_at: row.updated_at,
    });
    if (items.length >= limit) break;
  }
  return { ok: true, count: items.length, sermons: items };
}
