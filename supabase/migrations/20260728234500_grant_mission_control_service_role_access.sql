grant select, insert, update, delete on table public.hebrew_generation_jobs to service_role;
grant select, insert, update, delete on table public.hebrew_generation_job_events to service_role;
grant usage, select on sequence public.hebrew_generation_job_events_id_seq to service_role;
