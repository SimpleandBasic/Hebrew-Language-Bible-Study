-- Hebrew Visual Study Pipeline v2 hardening
-- Explicit browser denial for internal generation jobs and covering foreign-key indexes.

create index if not exists hebrew_visual_cards_primary_asset_idx
  on public.hebrew_visual_cards(primary_asset_id)
  where primary_asset_id is not null;

create index if not exists hebrew_visual_feeds_verse_idx
  on public.hebrew_visual_feeds(verse_id);

create index if not exists hebrew_visual_jobs_manifest_idx
  on public.hebrew_visual_jobs(manifest_id);

create index if not exists hebrew_visual_jobs_card_idx
  on public.hebrew_visual_jobs(card_id)
  where card_id is not null;

drop policy if exists "Browser users cannot access Hebrew visual jobs" on public.hebrew_visual_jobs;
create policy "Browser users cannot access Hebrew visual jobs"
on public.hebrew_visual_jobs
as restrictive
for all
to anon, authenticated
using (false)
with check (false);
