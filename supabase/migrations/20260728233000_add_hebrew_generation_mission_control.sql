create extension if not exists pgcrypto;

create table if not exists public.hebrew_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  requested_reference text,
  resolved_reference text,
  mode text not null default 'publish' check (mode in ('preview','test','publish','verify')),
  environment text not null default 'production' check (environment in ('test','staging','production')),
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled')),
  current_stage text not null default 'queued',
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  lesson_id uuid,
  track_id uuid,
  transcript_word_count integer,
  expected_segment_count integer,
  ready_segment_count integer,
  result jsonb not null default '{}'::jsonb,
  error_message text,
  requested_by text not null default 'mission_control',
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hebrew_generation_job_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.hebrew_generation_jobs(id) on delete cascade,
  stage text not null,
  status text not null check (status in ('started','completed','failed','info')),
  message text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists hebrew_generation_jobs_status_created_idx on public.hebrew_generation_jobs(status, created_at);
create index if not exists hebrew_generation_job_events_job_created_idx on public.hebrew_generation_job_events(job_id, created_at);

create or replace function public.touch_hebrew_generation_job_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_hebrew_generation_job_updated_at on public.hebrew_generation_jobs;
create trigger touch_hebrew_generation_job_updated_at
before update on public.hebrew_generation_jobs
for each row execute function public.touch_hebrew_generation_job_updated_at();

create or replace function public.enqueue_hebrew_generation_job(
  p_requested_reference text default null,
  p_mode text default 'publish',
  p_environment text default 'production',
  p_requested_by text default 'mission_control'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.hebrew_generation_jobs(requested_reference, mode, environment, requested_by)
  values (nullif(trim(p_requested_reference), ''), p_mode, p_environment, p_requested_by)
  returning id into v_id;

  insert into public.hebrew_generation_job_events(job_id, stage, status, message)
  values (v_id, 'queued', 'completed', 'Generation job queued.');

  return v_id;
end;
$$;

alter table public.hebrew_generation_jobs enable row level security;
alter table public.hebrew_generation_job_events enable row level security;
revoke all on public.hebrew_generation_jobs from anon, authenticated;
revoke all on public.hebrew_generation_job_events from anon, authenticated;
revoke all on function public.enqueue_hebrew_generation_job(text,text,text,text) from anon, authenticated;
grant execute on function public.enqueue_hebrew_generation_job(text,text,text,text) to service_role;
