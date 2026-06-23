-- Hebrew Learning App schema
-- Safe to run in the same Supabase project as Levrynn.
-- This file only creates or updates objects whose names begin with hebrew_.

create extension if not exists pgcrypto;

create table if not exists public.hebrew_verses (
  id uuid primary key default gen_random_uuid(),
  book text not null,
  chapter integer not null check (chapter > 0),
  verse_number integer not null check (verse_number > 0),
  reference text not null,
  hebrew_text text not null default '',
  english_text text not null default '',
  context_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (book, chapter, verse_number)
);

create table if not exists public.hebrew_words (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  hebrew_text text not null,
  transliteration text not null default '',
  pronunciation text not null default '',
  english_gloss text not null default '',
  root text not null default '',
  root_transliteration text not null default '',
  root_meaning text not null default '',
  strongs_number text not null default '',
  word_form text not null default '',
  grammar_note text not null default '',
  lexicon_note text not null default '',
  context_note text not null default '',
  study_prompt text not null default '',
  theme_tags text[] not null default '{}',
  audio_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hebrew_verse_words (
  verse_id uuid not null references public.hebrew_verses(id) on delete cascade,
  word_id uuid not null references public.hebrew_words(id) on delete cascade,
  word_position integer not null check (word_position > 0),
  created_at timestamptz not null default now(),
  primary key (verse_id, word_position)
);

create table if not exists public.hebrew_lessons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  lesson_order integer not null default 0,
  content jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hebrew_user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id uuid not null references public.hebrew_words(id) on delete cascade,
  familiarity_level smallint not null default 0 check (familiarity_level between 0 and 5),
  times_reviewed integer not null default 0 check (times_reviewed >= 0),
  times_correct integer not null default 0 check (times_correct >= 0),
  last_reviewed_at timestamptz,
  next_review_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, word_id)
);

create table if not exists public.hebrew_flashcard_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id uuid not null references public.hebrew_words(id) on delete cascade,
  answer_result text not null check (answer_result in ('again', 'hard', 'good', 'easy', 'correct', 'incorrect')),
  response_time_ms integer check (response_time_ms is null or response_time_ms >= 0),
  reviewed_at timestamptz not null default now()
);

create table if not exists public.hebrew_rpg_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scene_key text not null,
  character_key text,
  completed_dialogues text[] not null default '{}',
  unlocked_words text[] not null default '{}',
  experience_points integer not null default 0 check (experience_points >= 0),
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, scene_key)
);

create index if not exists hebrew_verse_words_word_id_idx
  on public.hebrew_verse_words(word_id);

create index if not exists hebrew_words_hebrew_text_idx
  on public.hebrew_words(hebrew_text);

create index if not exists hebrew_words_strongs_number_idx
  on public.hebrew_words(strongs_number);

create index if not exists hebrew_user_progress_user_next_idx
  on public.hebrew_user_progress(user_id, next_review_at);

create index if not exists hebrew_flashcard_reviews_user_date_idx
  on public.hebrew_flashcard_reviews(user_id, reviewed_at desc);

create or replace function public.hebrew_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists hebrew_verses_set_updated_at on public.hebrew_verses;
create trigger hebrew_verses_set_updated_at
before update on public.hebrew_verses
for each row execute function public.hebrew_set_updated_at();

drop trigger if exists hebrew_words_set_updated_at on public.hebrew_words;
create trigger hebrew_words_set_updated_at
before update on public.hebrew_words
for each row execute function public.hebrew_set_updated_at();

drop trigger if exists hebrew_lessons_set_updated_at on public.hebrew_lessons;
create trigger hebrew_lessons_set_updated_at
before update on public.hebrew_lessons
for each row execute function public.hebrew_set_updated_at();

drop trigger if exists hebrew_user_progress_set_updated_at on public.hebrew_user_progress;
create trigger hebrew_user_progress_set_updated_at
before update on public.hebrew_user_progress
for each row execute function public.hebrew_set_updated_at();

drop trigger if exists hebrew_rpg_progress_set_updated_at on public.hebrew_rpg_progress;
create trigger hebrew_rpg_progress_set_updated_at
before update on public.hebrew_rpg_progress
for each row execute function public.hebrew_set_updated_at();

alter table public.hebrew_verses enable row level security;
alter table public.hebrew_words enable row level security;
alter table public.hebrew_verse_words enable row level security;
alter table public.hebrew_lessons enable row level security;
alter table public.hebrew_user_progress enable row level security;
alter table public.hebrew_flashcard_reviews enable row level security;
alter table public.hebrew_rpg_progress enable row level security;

drop policy if exists "Hebrew verses are publicly readable" on public.hebrew_verses;
create policy "Hebrew verses are publicly readable"
on public.hebrew_verses for select
using (true);

drop policy if exists "Hebrew words are publicly readable" on public.hebrew_words;
create policy "Hebrew words are publicly readable"
on public.hebrew_words for select
using (true);

drop policy if exists "Hebrew verse words are publicly readable" on public.hebrew_verse_words;
create policy "Hebrew verse words are publicly readable"
on public.hebrew_verse_words for select
using (true);

drop policy if exists "Published Hebrew lessons are publicly readable" on public.hebrew_lessons;
create policy "Published Hebrew lessons are publicly readable"
on public.hebrew_lessons for select
using (is_published = true);

drop policy if exists "Users read their Hebrew progress" on public.hebrew_user_progress;
create policy "Users read their Hebrew progress"
on public.hebrew_user_progress for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users create their Hebrew progress" on public.hebrew_user_progress;
create policy "Users create their Hebrew progress"
on public.hebrew_user_progress for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users update their Hebrew progress" on public.hebrew_user_progress;
create policy "Users update their Hebrew progress"
on public.hebrew_user_progress for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users delete their Hebrew progress" on public.hebrew_user_progress;
create policy "Users delete their Hebrew progress"
on public.hebrew_user_progress for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users read their Hebrew reviews" on public.hebrew_flashcard_reviews;
create policy "Users read their Hebrew reviews"
on public.hebrew_flashcard_reviews for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users create their Hebrew reviews" on public.hebrew_flashcard_reviews;
create policy "Users create their Hebrew reviews"
on public.hebrew_flashcard_reviews for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users delete their Hebrew reviews" on public.hebrew_flashcard_reviews;
create policy "Users delete their Hebrew reviews"
on public.hebrew_flashcard_reviews for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users read their Hebrew RPG progress" on public.hebrew_rpg_progress;
create policy "Users read their Hebrew RPG progress"
on public.hebrew_rpg_progress for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users create their Hebrew RPG progress" on public.hebrew_rpg_progress;
create policy "Users create their Hebrew RPG progress"
on public.hebrew_rpg_progress for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users update their Hebrew RPG progress" on public.hebrew_rpg_progress;
create policy "Users update their Hebrew RPG progress"
on public.hebrew_rpg_progress for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users delete their Hebrew RPG progress" on public.hebrew_rpg_progress;
create policy "Users delete their Hebrew RPG progress"
on public.hebrew_rpg_progress for delete
to authenticated
using (auth.uid() = user_id);

revoke all on table public.hebrew_verses from anon, authenticated;
revoke all on table public.hebrew_words from anon, authenticated;
revoke all on table public.hebrew_verse_words from anon, authenticated;
revoke all on table public.hebrew_lessons from anon, authenticated;
revoke all on table public.hebrew_user_progress from anon, authenticated;
revoke all on table public.hebrew_flashcard_reviews from anon, authenticated;
revoke all on table public.hebrew_rpg_progress from anon, authenticated;

grant select on table public.hebrew_verses to anon, authenticated;
grant select on table public.hebrew_words to anon, authenticated;
grant select on table public.hebrew_verse_words to anon, authenticated;
grant select on table public.hebrew_lessons to anon, authenticated;

grant select, insert, update, delete on table public.hebrew_user_progress to authenticated;
grant select, insert, delete on table public.hebrew_flashcard_reviews to authenticated;
grant select, insert, update, delete on table public.hebrew_rpg_progress to authenticated;
