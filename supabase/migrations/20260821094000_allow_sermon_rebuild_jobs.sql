alter table public.hebrew_generation_jobs
  drop constraint if exists hebrew_generation_jobs_mode_check;

alter table public.hebrew_generation_jobs
  add constraint hebrew_generation_jobs_mode_check
  check (mode = any (array[
    'preview'::text,
    'test'::text,
    'publish'::text,
    'verify'::text,
    'audio_rebuild'::text,
    'sermon_rebuild'::text
  ]));
