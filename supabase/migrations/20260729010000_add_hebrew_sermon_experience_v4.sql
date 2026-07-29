-- Hebrew Language Bible Study V4: episode revision and atomic release foundation
-- Additive migration. Existing public records remain untouched until a V4 revision is published.

create extension if not exists pgcrypto;

create table if not exists public.hebrew_episodes (
  id uuid primary key default gen_random_uuid(),
  verse_id uuid not null unique references public.hebrew_verses(id) on delete restrict,
  reference text not null unique,
  canonical_slug text not null unique,
  current_published_revision_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hebrew_episode_revisions (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.hebrew_episodes(id) on delete cascade,
  revision_number integer not null check (revision_number > 0),
  pipeline_version text not null default 'sermon-experience-v4',
  status text not null default 'planning' check (status in (
    'planning','researching','writing','evaluating','rewriting','producing_visuals',
    'producing_artwork','producing_audio','verifying','ready_for_release',
    'published','failed','cancelled','superseded'
  )),
  release_state text not null default 'private' check (release_state in ('private','ready','published','rolled_back')),
  research_dossier_id uuid,
  approved_sermon_draft_id uuid,
  lesson_id uuid references public.hebrew_lessons(id) on delete set null,
  audio_track_id uuid references public.hebrew_audio_tracks(id) on delete set null,
  visual_feed_id uuid references public.hebrew_visual_feeds(id) on delete set null,
  album_art_asset_id uuid references public.hebrew_visual_assets(id) on delete set null,
  quality_score numeric,
  release_checksum text,
  failure_reason text,
  verified_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(episode_id, revision_number)
);

alter table public.hebrew_episodes
  add constraint hebrew_episodes_current_revision_fk
  foreign key (current_published_revision_id)
  references public.hebrew_episode_revisions(id)
  on delete set null;

create table if not exists public.hebrew_research_dossiers (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null unique references public.hebrew_episode_revisions(id) on delete cascade,
  dossier_version text not null default 'v1',
  verse_text jsonb not null default '{}'::jsonb,
  literary_context jsonb not null default '{}'::jsonb,
  hebrew_observations jsonb not null default '[]'::jsonb,
  cross_references jsonb not null default '[]'::jsonb,
  historical_background jsonb not null default '[]'::jsonb,
  archaeology jsonb not null default '[]'::jsonb,
  geography jsonb not null default '[]'::jsonb,
  biblical_theology jsonb not null default '[]'::jsonb,
  christological_pathways jsonb not null default '[]'::jsonb,
  unsupported_connections jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  claims jsonb not null default '[]'::jsonb,
  content_hash text,
  status text not null default 'draft' check (status in ('draft','verified','failed')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hebrew_sermon_drafts (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.hebrew_episode_revisions(id) on delete cascade,
  draft_number integer not null check (draft_number > 0),
  parent_draft_id uuid references public.hebrew_sermon_drafts(id) on delete set null,
  transcript text not null,
  lesson_payload jsonb not null default '{}'::jsonb,
  word_count integer not null check (word_count > 0),
  prompt_version text not null,
  model text not null,
  generation_metadata jsonb not null default '{}'::jsonb,
  content_hash text not null,
  status text not null default 'candidate' check (status in ('candidate','approved','rejected','superseded')),
  created_at timestamptz not null default now(),
  unique(revision_id, draft_number)
);

create table if not exists public.hebrew_sermon_evaluations (
  id uuid primary key default gen_random_uuid(),
  sermon_draft_id uuid not null references public.hebrew_sermon_drafts(id) on delete cascade,
  evaluator_version text not null,
  conversational_flow numeric not null,
  storytelling numeric not null,
  curiosity numeric not null,
  hebrew_integration numeric not null,
  biblical_faithfulness numeric not null,
  christ_centeredness numeric not null,
  emotional_movement numeric not null,
  educational_value numeric not null,
  spoken_naturalness numeric not null,
  listener_engagement numeric not null,
  weighted_score numeric not null,
  hard_gate_results jsonb not null default '{}'::jsonb,
  evidence_spans jsonb not null default '[]'::jsonb,
  strengths jsonb not null default '[]'::jsonb,
  rewrite_directives jsonb not null default '[]'::jsonb,
  passed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.hebrew_pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null unique references public.hebrew_episode_revisions(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled')),
  current_stage text not null default 'create_revision',
  requested_by text not null default 'mission_control',
  started_at timestamptz,
  finished_at timestamptz,
  error_information text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hebrew_stage_runs (
  id uuid primary key default gen_random_uuid(),
  pipeline_run_id uuid not null references public.hebrew_pipeline_runs(id) on delete cascade,
  revision_id uuid not null references public.hebrew_episode_revisions(id) on delete cascade,
  stage_type text not null check (stage_type in (
    'research','research_verify','narrative_map','sermon_write','sermon_evaluate','sermon_rewrite',
    'visual_plan','visual_generate','visual_verify','album_art_generate','album_art_verify',
    'audio_plan','audio_generate','audio_verify','database_verify','release_verify','publish'
  )),
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled','blocked')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 4 check (max_attempts > 0),
  lease_owner text,
  lease_expires_at timestamptz,
  input_hash text,
  output_hash text,
  started_at timestamptz,
  finished_at timestamptz,
  error_information text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hebrew_release_verifications (
  id bigint generated always as identity primary key,
  revision_id uuid not null references public.hebrew_episode_revisions(id) on delete cascade,
  check_name text not null,
  category text not null,
  passed boolean not null,
  required boolean not null default true,
  details jsonb not null default '{}'::jsonb,
  verified_at timestamptz not null default now(),
  unique(revision_id, check_name)
);

create table if not exists public.hebrew_episode_publications (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.hebrew_episodes(id) on delete cascade,
  revision_id uuid not null references public.hebrew_episode_revisions(id) on delete restrict,
  previous_revision_id uuid references public.hebrew_episode_revisions(id) on delete set null,
  action text not null check (action in ('publish','rollback')),
  release_checksum text not null,
  published_by text not null default 'release_manager',
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists hebrew_episode_revisions_status_idx on public.hebrew_episode_revisions(status, release_state, created_at);
create index if not exists hebrew_sermon_drafts_revision_idx on public.hebrew_sermon_drafts(revision_id, draft_number);
create index if not exists hebrew_sermon_evaluations_draft_idx on public.hebrew_sermon_evaluations(sermon_draft_id, created_at);
create index if not exists hebrew_stage_runs_queue_idx on public.hebrew_stage_runs(status, lease_expires_at, created_at);
create index if not exists hebrew_release_verifications_revision_idx on public.hebrew_release_verifications(revision_id, required, passed);
create index if not exists hebrew_episode_publications_episode_idx on public.hebrew_episode_publications(episode_id, created_at desc);

create or replace function public.touch_hebrew_v4_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_hebrew_episodes_updated_at before update on public.hebrew_episodes for each row execute function public.touch_hebrew_v4_updated_at();
create trigger touch_hebrew_episode_revisions_updated_at before update on public.hebrew_episode_revisions for each row execute function public.touch_hebrew_v4_updated_at();
create trigger touch_hebrew_research_dossiers_updated_at before update on public.hebrew_research_dossiers for each row execute function public.touch_hebrew_v4_updated_at();
create trigger touch_hebrew_pipeline_runs_updated_at before update on public.hebrew_pipeline_runs for each row execute function public.touch_hebrew_v4_updated_at();
create trigger touch_hebrew_stage_runs_updated_at before update on public.hebrew_stage_runs for each row execute function public.touch_hebrew_v4_updated_at();

create or replace function public.create_hebrew_episode_revision(
  p_reference text,
  p_requested_by text default 'mission_control'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_verse public.hebrew_verses;
  v_episode_id uuid;
  v_revision_id uuid;
  v_revision_number integer;
begin
  select * into v_verse from public.hebrew_verses where lower(reference) = lower(trim(p_reference)) limit 1;
  if v_verse.id is null then raise exception 'Canonical verse % does not exist', p_reference; end if;

  insert into public.hebrew_episodes(verse_id, reference, canonical_slug)
  values (v_verse.id, v_verse.reference, lower(regexp_replace(v_verse.reference, '[^a-zA-Z0-9]+', '-', 'g')))
  on conflict (verse_id) do update set reference = excluded.reference, updated_at = now()
  returning id into v_episode_id;

  perform pg_advisory_xact_lock(hashtextextended(v_episode_id::text, 0));
  select coalesce(max(revision_number), 0) + 1 into v_revision_number
  from public.hebrew_episode_revisions where episode_id = v_episode_id;

  insert into public.hebrew_episode_revisions(episode_id, revision_number)
  values (v_episode_id, v_revision_number)
  returning id into v_revision_id;

  insert into public.hebrew_pipeline_runs(revision_id, requested_by)
  values (v_revision_id, coalesce(nullif(trim(p_requested_by), ''), 'mission_control'));

  return v_revision_id;
end;
$$;

create or replace function public.publish_hebrew_episode_revision(
  p_revision_id uuid,
  p_published_by text default 'release_manager',
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revision public.hebrew_episode_revisions;
  v_episode public.hebrew_episodes;
  v_required_failures integer;
  v_audio_segments integer;
  v_ready_audio_segments integer;
  v_visual_cards integer;
  v_ready_visual_cards integer;
  v_previous uuid;
  v_checksum text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_revision_id::text, 0));
  select * into v_revision from public.hebrew_episode_revisions where id = p_revision_id for update;
  if v_revision.id is null then raise exception 'Revision not found'; end if;
  if v_revision.status <> 'ready_for_release' or v_revision.release_state <> 'ready' then
    raise exception 'Revision is not ready for release';
  end if;
  if v_revision.approved_sermon_draft_id is null or v_revision.lesson_id is null or v_revision.audio_track_id is null or v_revision.visual_feed_id is null or v_revision.album_art_asset_id is null then
    raise exception 'Revision is missing required release relationships';
  end if;

  select count(*) into v_required_failures
  from public.hebrew_release_verifications
  where revision_id = p_revision_id and required and not passed;
  if v_required_failures > 0 then raise exception 'Revision has % failed required verifications', v_required_failures; end if;

  if not exists (select 1 from public.hebrew_release_verifications where revision_id = p_revision_id and check_name = 'release_integrity' and passed) then
    raise exception 'Final release integrity verification is missing';
  end if;
  if not exists (select 1 from public.hebrew_sermon_drafts where id = v_revision.approved_sermon_draft_id and revision_id = p_revision_id and status = 'approved') then
    raise exception 'Approved sermon draft is invalid';
  end if;
  if not exists (select 1 from public.hebrew_sermon_evaluations where sermon_draft_id = v_revision.approved_sermon_draft_id and passed) then
    raise exception 'Approved sermon has no passing evaluation';
  end if;

  select count(*), count(*) filter (where status = 'ready' and audio_path is not null and duration_seconds > 0 and checksum is not null)
    into v_audio_segments, v_ready_audio_segments
  from public.hebrew_audio_segments where track_id = v_revision.audio_track_id;
  if v_audio_segments = 0 or v_audio_segments <> v_ready_audio_segments then raise exception 'Audio segments are incomplete'; end if;

  select count(*), count(*) filter (where status = 'ready')
    into v_visual_cards, v_ready_visual_cards
  from public.hebrew_visual_cards where feed_id = v_revision.visual_feed_id;
  if v_visual_cards = 0 or v_visual_cards <> v_ready_visual_cards then raise exception 'Visual cards are incomplete'; end if;

  if not exists (select 1 from public.hebrew_visual_assets where id = v_revision.album_art_asset_id and status = 'ready' and checksum is not null) then
    raise exception 'Album art is incomplete';
  end if;

  select * into v_episode from public.hebrew_episodes where id = v_revision.episode_id for update;
  v_previous := v_episode.current_published_revision_id;
  v_checksum := encode(digest(concat_ws('|', v_revision.id::text, v_revision.approved_sermon_draft_id::text, v_revision.audio_track_id::text, v_revision.visual_feed_id::text, v_revision.album_art_asset_id::text), 'sha256'), 'hex');

  -- Components become public only inside this transaction.
  update public.hebrew_lessons set is_published = true, updated_at = now() where id = v_revision.lesson_id;
  update public.hebrew_audio_tracks set status = 'ready', is_published = true, published_at = coalesce(published_at, now()), updated_at = now() where id = v_revision.audio_track_id;
  update public.hebrew_visual_feeds set status = 'published', is_published = true, published_at = coalesce(published_at, now()), updated_at = now() where id = v_revision.visual_feed_id;
  update public.hebrew_lesson_manifests set status = 'published', published_at = coalesce(published_at, now()), updated_at = now() where id = (select manifest_id from public.hebrew_visual_feeds where id = v_revision.visual_feed_id);

  if v_previous is not null and v_previous <> p_revision_id then
    update public.hebrew_episode_revisions set status = 'superseded', release_state = 'rolled_back' where id = v_previous;
  end if;

  update public.hebrew_episode_revisions
  set status = 'published', release_state = 'published', release_checksum = v_checksum, published_at = now()
  where id = p_revision_id;
  update public.hebrew_episodes set current_published_revision_id = p_revision_id where id = v_revision.episode_id;

  insert into public.hebrew_episode_publications(episode_id, revision_id, previous_revision_id, action, release_checksum, published_by, reason)
  values (v_revision.episode_id, p_revision_id, v_previous, 'publish', v_checksum, coalesce(nullif(trim(p_published_by), ''), 'release_manager'), p_reason);

  return jsonb_build_object('ok', true, 'episode_id', v_revision.episode_id, 'revision_id', p_revision_id, 'previous_revision_id', v_previous, 'release_checksum', v_checksum);
end;
$$;

create or replace view public.hebrew_published_episode_revisions as
select
  e.id as episode_id,
  e.reference,
  e.canonical_slug,
  r.id as revision_id,
  r.revision_number,
  r.pipeline_version,
  r.release_checksum,
  r.published_at,
  r.lesson_id,
  r.audio_track_id,
  r.visual_feed_id,
  r.album_art_asset_id,
  r.approved_sermon_draft_id
from public.hebrew_episodes e
join public.hebrew_episode_revisions r on r.id = e.current_published_revision_id
where r.status = 'published' and r.release_state = 'published';

alter table public.hebrew_episodes enable row level security;
alter table public.hebrew_episode_revisions enable row level security;
alter table public.hebrew_research_dossiers enable row level security;
alter table public.hebrew_sermon_drafts enable row level security;
alter table public.hebrew_sermon_evaluations enable row level security;
alter table public.hebrew_pipeline_runs enable row level security;
alter table public.hebrew_stage_runs enable row level security;
alter table public.hebrew_release_verifications enable row level security;
alter table public.hebrew_episode_publications enable row level security;

revoke all on public.hebrew_episodes, public.hebrew_episode_revisions, public.hebrew_research_dossiers, public.hebrew_sermon_drafts, public.hebrew_sermon_evaluations, public.hebrew_pipeline_runs, public.hebrew_stage_runs, public.hebrew_release_verifications, public.hebrew_episode_publications from public, anon, authenticated;
grant all on public.hebrew_episodes, public.hebrew_episode_revisions, public.hebrew_research_dossiers, public.hebrew_sermon_drafts, public.hebrew_sermon_evaluations, public.hebrew_pipeline_runs, public.hebrew_stage_runs, public.hebrew_release_verifications, public.hebrew_episode_publications to service_role;
grant select on public.hebrew_published_episode_revisions to anon, authenticated;
revoke all on function public.create_hebrew_episode_revision(text,text) from public, anon, authenticated;
revoke all on function public.publish_hebrew_episode_revision(uuid,text,text) from public, anon, authenticated;
grant execute on function public.create_hebrew_episode_revision(text,text) to service_role;
grant execute on function public.publish_hebrew_episode_revision(uuid,text,text) to service_role;
