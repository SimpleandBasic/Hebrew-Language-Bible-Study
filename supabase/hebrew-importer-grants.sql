-- Grants required by the protected GitHub Actions importer.
-- The Supabase secret key runs as the service_role database role.

grant select, insert, update, delete
on table
  public.hebrew_verses,
  public.hebrew_words,
  public.hebrew_verse_words
to service_role;
