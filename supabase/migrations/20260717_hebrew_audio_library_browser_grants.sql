-- Browser roles must have table privileges before RLS policies can filter rows.
grant select on table public.hebrew_book_albums to anon, authenticated;
grant select on table public.hebrew_audio_tracks to anon, authenticated;
grant select on table public.hebrew_audio_segments to anon, authenticated;
