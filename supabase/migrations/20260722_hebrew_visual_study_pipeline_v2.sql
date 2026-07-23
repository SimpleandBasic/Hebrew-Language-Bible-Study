-- Daily Hebrew Visual Study Pipeline v2
-- Additive only. Preserves the existing Hebrew reader and audio library.

create extension if not exists pgcrypto;

create table if not exists public.hebrew_lesson_manifests (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null unique references public.hebrew_lessons(id) on delete cascade,
  verse_id uuid not null unique references public.hebrew_verses(id) on delete restrict,
  audio_track_id uuid unique references public.hebrew_audio_tracks(id) on delete set null,
  schema_version text not null default 'visual-study-v2',
  sermon_title text not null default '',
  central_truth text not null default '',
  status text not null default 'draft' check (status in ('draft','preparing','ready','published','failed')),
  required_card_count integer not null default 3 check (required_card_count >= 0),
  target_card_count integer not null default 6 check (target_card_count >= required_card_count),
  content_hash text,
  error_information text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hebrew_visual_assets (
  id uuid primary key default gen_random_uuid(),
  asset_key text not null unique,
  asset_type text not null check (asset_type in ('ai_illustration','template_render','source_image','existing_artwork','icon')),
  title text not null default '',
  storage_path text,
  alt_text text not null default '',
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  mime_type text,
  status text not null default 'draft' check (status in ('draft','generating','ready','failed','retired')),
  evidence_level text not null default 'artistic_illustration' check (evidence_level in (
    'scripture_direct','historical_background','archaeological_finding',
    'probable_reconstruction','scholarly_debate','artistic_illustration'
  )),
  prompt_text text,
  prompt_version text,
  generation_model text,
  checksum text,
  reuse_tags text[] not null default '{}',
  source_credit text,
  source_url text,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hebrew_visual_feeds (
  id uuid primary key default gen_random_uuid(),
  manifest_id uuid not null references public.hebrew_lesson_manifests(id) on delete cascade,
  lesson_id uuid not null references public.hebrew_lessons(id) on delete cascade,
  verse_id uuid not null references public.hebrew_verses(id) on delete restrict,
  audio_track_id uuid references public.hebrew_audio_tracks(id) on delete set null,
  title text not null,
  subtitle text not null default '',
  version text not null default 'v1',
  content_hash text,
  status text not null default 'draft' check (status in ('draft','preparing','ready','published','failed')),
  card_count integer not null default 0 check (card_count >= 0),
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(manifest_id, version),
  unique(lesson_id, version)
);

create table if not exists public.hebrew_visual_cards (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid not null references public.hebrew_visual_feeds(id) on delete cascade,
  sort_order integer not null check (sort_order > 0),
  card_type text not null check (card_type in (
    'hero','hebrew_word','context','map','timeline','family_tree','archaeology',
    'cultural_custom','daily_life','scripture_connection','diagram'
  )),
  eyebrow text not null default '',
  title text not null,
  summary text not null default '',
  why_it_matters text not null default '',
  body text not null default '',
  evidence_level text not null default 'scripture_direct' check (evidence_level in (
    'scripture_direct','historical_background','archaeological_finding',
    'probable_reconstruction','scholarly_debate','artistic_illustration'
  )),
  primary_asset_id uuid references public.hebrew_visual_assets(id) on delete set null,
  structured_data jsonb not null default '{}'::jsonb,
  source_summary text not null default '',
  content_version integer not null default 1 check (content_version > 0),
  content_hash text,
  is_required boolean not null default false,
  status text not null default 'draft' check (status in ('draft','preparing','ready','failed','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(feed_id, sort_order),
  constraint hebrew_visual_cards_structured_data_object check (jsonb_typeof(structured_data) = 'object')
);

create table if not exists public.hebrew_visual_sources (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.hebrew_visual_cards(id) on delete cascade,
  sort_order integer not null default 1 check (sort_order > 0),
  citation_label text not null default '',
  source_title text not null,
  source_author text,
  source_publisher text,
  source_year integer,
  source_url text,
  source_note text not null default '',
  created_at timestamptz not null default now(),
  unique(card_id, sort_order)
);

create table if not exists public.hebrew_visual_jobs (
  id uuid primary key default gen_random_uuid(),
  manifest_id uuid not null references public.hebrew_lesson_manifests(id) on delete cascade,
  card_id uuid references public.hebrew_visual_cards(id) on delete cascade,
  job_type text not null check (job_type in ('plan','reuse_search','template_render','image_generate','verify','publish')),
  status text not null default 'queued' check (status in ('queued','running','ready','failed','cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts > 0),
  input_hash text,
  output_hash text,
  locked_until timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  cost_cents numeric not null default 0 check (cost_cents >= 0),
  error_information text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hebrew_visual_jobs_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists hebrew_lesson_manifests_status_idx on public.hebrew_lesson_manifests(status, updated_at);
create index if not exists hebrew_visual_feeds_audio_track_idx on public.hebrew_visual_feeds(audio_track_id, is_published);
create index if not exists hebrew_visual_cards_feed_order_idx on public.hebrew_visual_cards(feed_id, sort_order);
create index if not exists hebrew_visual_cards_status_idx on public.hebrew_visual_cards(status, is_required);
create index if not exists hebrew_visual_assets_status_tags_idx on public.hebrew_visual_assets(status) include (reuse_tags);
create index if not exists hebrew_visual_sources_card_idx on public.hebrew_visual_sources(card_id, sort_order);
create index if not exists hebrew_visual_jobs_queue_idx on public.hebrew_visual_jobs(status, locked_until, created_at);

alter table public.hebrew_lesson_manifests enable row level security;
alter table public.hebrew_visual_assets enable row level security;
alter table public.hebrew_visual_feeds enable row level security;
alter table public.hebrew_visual_cards enable row level security;
alter table public.hebrew_visual_sources enable row level security;
alter table public.hebrew_visual_jobs enable row level security;

-- Public browser access is read-only and limited to published/ready visual study content.
drop policy if exists "Published Hebrew manifests are publicly readable" on public.hebrew_lesson_manifests;
create policy "Published Hebrew manifests are publicly readable"
on public.hebrew_lesson_manifests for select to anon, authenticated
using (status = 'published');

drop policy if exists "Published Hebrew visual feeds are publicly readable" on public.hebrew_visual_feeds;
create policy "Published Hebrew visual feeds are publicly readable"
on public.hebrew_visual_feeds for select to anon, authenticated
using (is_published and status = 'published');

drop policy if exists "Published Hebrew visual cards are publicly readable" on public.hebrew_visual_cards;
create policy "Published Hebrew visual cards are publicly readable"
on public.hebrew_visual_cards for select to anon, authenticated
using (
  status = 'ready' and exists (
    select 1 from public.hebrew_visual_feeds f
    where f.id = feed_id and f.is_published and f.status = 'published'
  )
);

drop policy if exists "Published Hebrew visual assets are publicly readable" on public.hebrew_visual_assets;
create policy "Published Hebrew visual assets are publicly readable"
on public.hebrew_visual_assets for select to anon, authenticated
using (
  status = 'ready' and exists (
    select 1
    from public.hebrew_visual_cards c
    join public.hebrew_visual_feeds f on f.id = c.feed_id
    where c.primary_asset_id = hebrew_visual_assets.id
      and c.status = 'ready'
      and f.is_published
      and f.status = 'published'
  )
);

drop policy if exists "Published Hebrew visual sources are publicly readable" on public.hebrew_visual_sources;
create policy "Published Hebrew visual sources are publicly readable"
on public.hebrew_visual_sources for select to anon, authenticated
using (
  exists (
    select 1
    from public.hebrew_visual_cards c
    join public.hebrew_visual_feeds f on f.id = c.feed_id
    where c.id = card_id
      and c.status = 'ready'
      and f.is_published
      and f.status = 'published'
  )
);

-- Jobs are intentionally never publicly readable.

revoke all on table public.hebrew_lesson_manifests from public, anon, authenticated;
revoke all on table public.hebrew_visual_assets from public, anon, authenticated;
revoke all on table public.hebrew_visual_feeds from public, anon, authenticated;
revoke all on table public.hebrew_visual_cards from public, anon, authenticated;
revoke all on table public.hebrew_visual_sources from public, anon, authenticated;
revoke all on table public.hebrew_visual_jobs from public, anon, authenticated;

grant select on public.hebrew_lesson_manifests to anon, authenticated;
grant select on public.hebrew_visual_assets to anon, authenticated;
grant select on public.hebrew_visual_feeds to anon, authenticated;
grant select on public.hebrew_visual_cards to anon, authenticated;
grant select on public.hebrew_visual_sources to anon, authenticated;

grant all on public.hebrew_lesson_manifests to service_role;
grant all on public.hebrew_visual_assets to service_role;
grant all on public.hebrew_visual_feeds to service_role;
grant all on public.hebrew_visual_cards to service_role;
grant all on public.hebrew_visual_sources to service_role;
grant all on public.hebrew_visual_jobs to service_role;

-- Genesis 1:14 pilot manifest and feed. Reuses the approved Genesis album artwork,
-- then renders all educational labels as accessible HTML instead of baking words into images.
with target as (
  select
    l.id as lesson_id,
    v.id as verse_id,
    t.id as audio_track_id,
    l.title as lesson_title
  from public.hebrew_verses v
  join public.hebrew_audio_tracks t
    on t.verse_id = v.id
   and t.status = 'ready'
   and t.is_published
  join public.hebrew_lessons l on l.id = t.lesson_id
  where v.book = 'Genesis'
    and v.chapter = 1
    and v.verse_number = 14
  order by t.updated_at desc
  limit 1
), manifest as (
  insert into public.hebrew_lesson_manifests (
    lesson_id, verse_id, audio_track_id, sermon_title, central_truth,
    status, required_card_count, target_card_count, content_hash, published_at
  )
  select
    lesson_id,
    verse_id,
    audio_track_id,
    'The Creator Owns the Clock',
    'Our Father gives created lights their place and purpose; time is a servant, not a master.',
    'published',
    3,
    5,
    encode(digest('genesis-1-14-manifest-visual-study-v2', 'sha256'), 'hex'),
    now()
  from target
  on conflict (lesson_id) do update set
    verse_id = excluded.verse_id,
    audio_track_id = excluded.audio_track_id,
    sermon_title = excluded.sermon_title,
    central_truth = excluded.central_truth,
    status = excluded.status,
    required_card_count = excluded.required_card_count,
    target_card_count = excluded.target_card_count,
    content_hash = excluded.content_hash,
    published_at = coalesce(public.hebrew_lesson_manifests.published_at, excluded.published_at),
    updated_at = now()
  returning *
), hero_asset as (
  insert into public.hebrew_visual_assets (
    asset_key, asset_type, title, source_url, alt_text, status,
    evidence_level, checksum, reuse_tags, generated_at
  ) values (
    'genesis-approved-album-art-v1',
    'existing_artwork',
    'Genesis creation artwork',
    'assets/genesis-cover.svg?v=20260718-1',
    'The approved Genesis album artwork, an artistic creation scene presented as an illustration rather than an archaeological image.',
    'ready',
    'artistic_illustration',
    encode(digest('assets/genesis-cover.svg?v=20260718-1', 'sha256'), 'hex'),
    array['genesis','creation','light','book-cover','approved','reusable'],
    now()
  )
  on conflict (asset_key) do update set
    source_url = excluded.source_url,
    alt_text = excluded.alt_text,
    status = 'ready',
    evidence_level = excluded.evidence_level,
    checksum = excluded.checksum,
    reuse_tags = excluded.reuse_tags,
    updated_at = now()
  returning id
), feed as (
  insert into public.hebrew_visual_feeds (
    manifest_id, lesson_id, verse_id, audio_track_id, title, subtitle,
    version, content_hash, status, card_count, is_published, published_at
  )
  select
    m.id,
    m.lesson_id,
    m.verse_id,
    m.audio_track_id,
    'Explore Genesis 1:14',
    'See how light, time, Hebrew, the ancient world, and the rest of Scripture connect.',
    'v1',
    encode(digest('genesis-1-14-feed-v1-five-card-pilot', 'sha256'), 'hex'),
    'published',
    5,
    true,
    now()
  from manifest m
  on conflict (manifest_id, version) do update set
    audio_track_id = excluded.audio_track_id,
    title = excluded.title,
    subtitle = excluded.subtitle,
    version = excluded.version,
    content_hash = excluded.content_hash,
    status = excluded.status,
    card_count = excluded.card_count,
    is_published = excluded.is_published,
    published_at = coalesce(public.hebrew_visual_feeds.published_at, excluded.published_at),
    updated_at = now()
  returning id
)
insert into public.hebrew_visual_cards (
  feed_id, sort_order, card_type, eyebrow, title, summary, why_it_matters,
  body, evidence_level, primary_asset_id, structured_data, source_summary,
  content_version, content_hash, is_required, status
)
select f.id, c.sort_order, c.card_type, c.eyebrow, c.title, c.summary, c.why_it_matters,
       c.body, c.evidence_level, c.primary_asset_id, c.structured_data, c.source_summary,
       1, encode(digest(concat_ws('|', c.sort_order::text, c.title, c.summary, c.body, c.why_it_matters), 'sha256'), 'hex'),
       c.is_required, 'ready'
from feed f
cross join hero_asset a
cross join lateral (
  values
  (
    1,
    'hero'::text,
    'Central Truth'::text,
    'The Creator Owns the Clock'::text,
    'The lights are powerful, but they are still created servants. Our Father gives them a place, a job, and boundaries.'::text,
    'Time can feel like a boss chasing us. Genesis begins by showing that time itself lives under our Father’s authority.'::text,
    'The approved artwork is an artistic doorway into the lesson. The teaching comes from Genesis 1:14–18.'::text,
    'artistic_illustration'::text,
    a.id,
    '{"layout":"hero"}'::jsonb,
    'Genesis 1:14–18'::text,
    true
  ),
  (
    2,
    'hebrew_word'::text,
    'Hebrew Word'::text,
    'מוֹעֲדִים · Mo’adim'::text,
    'This word means appointed times, meetings, or seasons fixed for a purpose.'::text,
    'The verse is not merely saying the sky helps us notice weather. It says our Father built order into time so life can gather, worship, work, and remember.'::text,
    'The singular form is מוֹעֵד, moed. In Genesis 1:14 the plural form appears with a prefix: וּלְמוֹעֲדִים, “and for appointed times.”'::text,
    'scripture_direct'::text,
    null::uuid,
    '{"hebrew":"מוֹעֲדִים","transliteration":"mo’adim","root":"יעד","strongs":"H4150","gloss":"appointed times","layout":"hebrew_word"}'::jsonb,
    'Genesis 1:14; Leviticus 23:2'::text,
    true
  ),
  (
    3,
    'timeline'::text,
    'Creation Pattern'::text,
    'Day One and Day Four Mirror Each Other'::text,
    'On day one, our Father separates light from darkness. On day four, He appoints the lights that govern those spaces and mark time.'::text,
    'The chapter is not a pile of random events. It is built with order: spaces are formed, then those spaces are filled and given function.'::text,
    'Day one establishes light and darkness. Day four appoints the greater light, lesser light, and stars. The pattern helps us see the careful architecture of Genesis 1.'::text,
    'scripture_direct'::text,
    null::uuid,
    '{"layout":"timeline","items":[{"label":"Day 1","title":"Light and darkness separated"},{"label":"Day 4","title":"Lights appointed to govern and mark time"}]}'::jsonb,
    'Genesis 1:3–5; Genesis 1:14–18'::text,
    true
  ),
  (
    4,
    'scripture_connection'::text,
    'Bible Connection'::text,
    'The Same Word Becomes Worship Time'::text,
    'Later, Leviticus uses the same word family for the LORD’s appointed feasts.'::text,
    'Genesis gives the heavenly clock. Leviticus shows what Israel does with appointed time: they stop, gather, remember, and worship.'::text,
    'The lights mark appointed times in Genesis. In Leviticus 23, those appointed times become holy gatherings woven into Israel’s year.'::text,
    'scripture_direct'::text,
    null::uuid,
    '{"layout":"connection","from":"Genesis 1:14","to":"Leviticus 23:2","keyword":"מוֹעֵד · moed"}'::jsonb,
    'Genesis 1:14; Leviticus 23:2'::text,
    false
  ),
  (
    5,
    'context'::text,
    'Ancient World Comparison'::text,
    'The Lights Are Servants, Not Gods'::text,
    'Across the ancient Near East, heavenly bodies could carry divine names and roles. Genesis presents the sun, moon, and stars as created lights assigned work by God.'::text,
    'The sky is impressive, but it is not a rival throne. Genesis redirects worship from creation to the Creator.'::text,
    'This comparison describes a broad historical background, not one identical belief held by every ancient culture. Genesis itself calls the sun and moon the greater and lesser lights and gives them tasks under God.'::text,
    'historical_background'::text,
    null::uuid,
    '{"layout":"comparison","left":{"label":"Ancient Near Eastern setting","role":"Celestial bodies could be linked with divine identity and power"},"right":{"label":"Genesis 1","role":"Created lights receive boundaries and jobs from God"}}'::jsonb,
    'Genesis 1:16; Deuteronomy 4:19; ancient Near Eastern background'::text,
    false
  )
) as c(sort_order, card_type, eyebrow, title, summary, why_it_matters, body, evidence_level, primary_asset_id, structured_data, source_summary, is_required)
on conflict (feed_id, sort_order) do update set
  card_type = excluded.card_type,
  eyebrow = excluded.eyebrow,
  title = excluded.title,
  summary = excluded.summary,
  why_it_matters = excluded.why_it_matters,
  body = excluded.body,
  evidence_level = excluded.evidence_level,
  primary_asset_id = excluded.primary_asset_id,
  structured_data = excluded.structured_data,
  source_summary = excluded.source_summary,
  content_version = excluded.content_version,
  content_hash = excluded.content_hash,
  is_required = excluded.is_required,
  status = 'ready',
  updated_at = now();

-- Primary Scripture sources for every pilot card.
insert into public.hebrew_visual_sources (card_id, sort_order, citation_label, source_title, source_publisher, source_note)
select c.id, 1, c.source_summary, 'The Holy Bible, King James Version', 'Scripture', 'Primary Scripture source for this educational card.'
from public.hebrew_visual_cards c
join public.hebrew_visual_feeds f on f.id = c.feed_id
join public.hebrew_verses v on v.id = f.verse_id
where v.book = 'Genesis' and v.chapter = 1 and v.verse_number = 14
on conflict (card_id, sort_order) do update set
  citation_label = excluded.citation_label,
  source_title = excluded.source_title,
  source_publisher = excluded.source_publisher,
  source_note = excluded.source_note;

-- Lexical source for the Hebrew word card.
insert into public.hebrew_visual_sources (
  card_id, sort_order, citation_label, source_title, source_author, source_publisher, source_year, source_note
)
select c.id, 2, 'מוֹעֵד · appointed time',
       'A Hebrew and English Lexicon of the Old Testament',
       'Francis Brown, S. R. Driver, and Charles A. Briggs',
       'Clarendon Press', 1906,
       'Lexical background for מוֹעֵד and its range of appointed-time meanings.'
from public.hebrew_visual_cards c
join public.hebrew_visual_feeds f on f.id = c.feed_id
join public.hebrew_verses v on v.id = f.verse_id
where v.book = 'Genesis' and v.chapter = 1 and v.verse_number = 14 and c.sort_order = 2
on conflict (card_id, sort_order) do update set
  citation_label = excluded.citation_label,
  source_title = excluded.source_title,
  source_author = excluded.source_author,
  source_publisher = excluded.source_publisher,
  source_year = excluded.source_year,
  source_note = excluded.source_note;

-- Scholarly background for the ancient-world comparison card.
insert into public.hebrew_visual_sources (
  card_id, sort_order, citation_label, source_title, source_author, source_publisher, source_year, source_note
)
select c.id, 2, 'Ancient Near Eastern religious and cosmic background',
       'Ancient Near Eastern Thought and the Old Testament, Second Edition',
       'John H. Walton', 'Baker Academic', 2018,
       'Comparative cultural background. The card intentionally avoids claiming that every ancient culture held one identical view.'
from public.hebrew_visual_cards c
join public.hebrew_visual_feeds f on f.id = c.feed_id
join public.hebrew_verses v on v.id = f.verse_id
where v.book = 'Genesis' and v.chapter = 1 and v.verse_number = 14 and c.sort_order = 5
on conflict (card_id, sort_order) do update set
  citation_label = excluded.citation_label,
  source_title = excluded.source_title,
  source_author = excluded.source_author,
  source_publisher = excluded.source_publisher,
  source_year = excluded.source_year,
  source_note = excluded.source_note;
