-- Spoken Hebrew audio learning v1 hardening.
-- Adds foreign-key coverage and avoids per-row auth.uid() evaluation in RLS.

create index if not exists hebrew_spoken_item_progress_item_idx on public.hebrew_spoken_item_progress(item_id);
create index if not exists hebrew_spoken_lesson_progress_lesson_idx on public.hebrew_spoken_lesson_progress(lesson_id);
create index if not exists hebrew_spoken_segments_item_idx on public.hebrew_spoken_segments(item_id);
create index if not exists hebrew_spoken_sessions_lesson_idx on public.hebrew_spoken_sessions(lesson_id);
create index if not exists hebrew_spoken_settings_track_idx on public.hebrew_spoken_settings(track_id);
create index if not exists hebrew_spoken_settings_current_lesson_idx on public.hebrew_spoken_settings(current_lesson_id);

drop policy if exists "Users manage own spoken Hebrew settings" on public.hebrew_spoken_settings;
create policy "Users manage own spoken Hebrew settings" on public.hebrew_spoken_settings
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Users manage own spoken Hebrew lesson progress" on public.hebrew_spoken_lesson_progress;
create policy "Users manage own spoken Hebrew lesson progress" on public.hebrew_spoken_lesson_progress
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Users manage own spoken Hebrew item progress" on public.hebrew_spoken_item_progress;
create policy "Users manage own spoken Hebrew item progress" on public.hebrew_spoken_item_progress
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Users manage own spoken Hebrew sessions" on public.hebrew_spoken_sessions;
create policy "Users manage own spoken Hebrew sessions" on public.hebrew_spoken_sessions
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
