create table if not exists public.scripture_devotional_series (
  id uuid primary key default gen_random_uuid(),
  book_key text not null unique,
  title text not null,
  subtitle text,
  source_language text not null check (source_language in ('Hebrew','Greek')),
  testament text not null check (testament in ('Old Testament','New Testament')),
  display_order integer not null default 0,
  artwork_path text,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scripture_devotional_lessons (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.scripture_devotional_series(id) on delete cascade,
  reference text not null unique,
  book_key text not null,
  chapter integer not null check (chapter > 0),
  verse_number integer not null check (verse_number > 0),
  source_language text not null check (source_language in ('Hebrew','Greek')),
  source_text text not null,
  source_text_attribution text,
  english_translation text not null default 'KJV',
  english_text text not null,
  transliteration text,
  title text not null,
  description text,
  sermon_transcript text not null,
  lesson_payload jsonb not null default '{}'::jsonb,
  research_dossier jsonb not null default '{}'::jsonb,
  evaluation jsonb not null default '{}'::jsonb,
  pipeline_version text not null,
  generated_by text,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (book_key, chapter, verse_number)
);

create index if not exists scripture_devotional_lessons_series_order_idx
  on public.scripture_devotional_lessons(series_id, chapter, verse_number);

create index if not exists scripture_devotional_lessons_published_idx
  on public.scripture_devotional_lessons(is_published, book_key, chapter, verse_number);

alter table public.scripture_devotional_series enable row level security;
alter table public.scripture_devotional_lessons enable row level security;

drop policy if exists "Public can read visible scripture devotional series" on public.scripture_devotional_series;
create policy "Public can read visible scripture devotional series"
  on public.scripture_devotional_series
  for select
  to anon, authenticated
  using (is_visible = true);

drop policy if exists "Public can read published scripture devotional lessons" on public.scripture_devotional_lessons;
create policy "Public can read published scripture devotional lessons"
  on public.scripture_devotional_lessons
  for select
  to anon, authenticated
  using (is_published = true);

grant select on public.scripture_devotional_series to anon, authenticated;
grant select on public.scripture_devotional_lessons to anon, authenticated;
grant all on public.scripture_devotional_series to service_role;
grant all on public.scripture_devotional_lessons to service_role;

insert into public.scripture_devotional_series
  (book_key, title, subtitle, source_language, testament, display_order, is_visible)
values
  ('philippians', 'Philippians', 'Joy, partnership, humility, and life in Christ — studied through the Greek New Testament.', 'Greek', 'New Testament', 2, true)
on conflict (book_key) do update set
  title = excluded.title,
  subtitle = excluded.subtitle,
  source_language = excluded.source_language,
  testament = excluded.testament,
  display_order = excluded.display_order,
  is_visible = excluded.is_visible,
  updated_at = now();
