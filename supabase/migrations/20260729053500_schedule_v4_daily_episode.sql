-- Replace the legacy audio-only poller with one complete V4 episode each morning.
-- pg_cron evaluates every five minutes, while the function gates execution to the
-- 5 AM hour in America/Los_Angeles and prevents duplicate daily jobs.

create or replace function public.next_hebrew_v4_reference()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_latest text;
  v_match text[];
  v_chapter integer;
  v_verse integer;
  v_counts integer[] := array[
    31,25,24,26,32,22,24,22,29,32,
    32,20,18,24,21,16,27,33,38,18,
    34,24,20,67,34,35,46,22,35,43,
    55,32,20,31,29,43,36,30,23,23,
    57,38,34,34,28,34,31,22,33,26
  ];
begin
  select coalesce(
    nullif(trim(content->>'referenceRange'), ''),
    nullif(trim(content #>> '{lesson,reference}'), ''),
    substring(title from '(Genesis [0-9]+:[0-9]+)')
  )
    into v_latest
  from public.hebrew_lessons
  where is_published = true
  order by lesson_order desc
  limit 1;

  if v_latest is null then
    return 'Genesis 1:1';
  end if;

  v_match := regexp_match(v_latest, '^Genesis\s+([0-9]+):([0-9]+)$', 'i');
  if v_match is null then
    raise exception 'Could not parse latest published Genesis reference: %', v_latest;
  end if;

  v_chapter := v_match[1]::integer;
  v_verse := v_match[2]::integer;

  if v_chapter < 1 or v_chapter > array_length(v_counts, 1) then
    raise exception 'Unsupported Genesis chapter: %', v_chapter;
  end if;

  if v_verse < v_counts[v_chapter] then
    return format('Genesis %s:%s', v_chapter, v_verse + 1);
  end if;

  if v_chapter >= 50 then
    raise exception 'Genesis is complete';
  end if;

  return format('Genesis %s:1', v_chapter + 1);
end;
$$;

create or replace function public.invoke_hebrew_v4_daily_episode(
  p_force boolean default false
)
returns bigint
language plpgsql
security definer
set search_path = public, net
as $$
declare
  v_local_now timestamp without time zone := timezone('America/Los_Angeles', now());
  v_reference text;
  v_job_id uuid;
  v_request_id bigint;
begin
  if not p_force and extract(hour from v_local_now) <> 5 then
    return null;
  end if;

  -- One scheduler-owned job per Pacific calendar day, regardless of retries.
  if exists (
    select 1
    from public.hebrew_generation_jobs
    where requested_by = 'daily_v4_5am_pacific'
      and (created_at at time zone 'America/Los_Angeles')::date = v_local_now::date
  ) then
    return null;
  end if;

  -- Never overlap a queued or running episode with another generation request.
  if exists (
    select 1
    from public.hebrew_generation_jobs
    where status in ('queued', 'running')
  ) then
    return null;
  end if;

  v_reference := public.next_hebrew_v4_reference();

  insert into public.hebrew_generation_jobs (
    requested_reference,
    mode,
    environment,
    status,
    current_stage,
    attempt_count,
    max_attempts,
    requested_by,
    result
  ) values (
    v_reference,
    'publish',
    'production',
    'queued',
    'queued',
    0,
    3,
    'daily_v4_5am_pacific',
    jsonb_build_object(
      'scheduler', 'pg_cron',
      'scheduled_local_date', v_local_now::date,
      'scheduled_local_hour', 5,
      'timezone', 'America/Los_Angeles'
    )
  )
  returning id into v_job_id;

  v_request_id := net.http_post(
    url := 'https://hebrew-developer-mcp.vercel.app/api/run-generation-job',
    body := jsonb_build_object('job_id', v_job_id),
    headers := '{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds := 300000
  );

  update public.hebrew_generation_jobs
  set result = result || jsonb_build_object('scheduler_request_id', v_request_id),
      updated_at = now()
  where id = v_job_id;

  return v_request_id;
exception
  when others then
    if v_job_id is not null then
      update public.hebrew_generation_jobs
      set status = 'failed',
          current_stage = 'scheduler_failed',
          error_message = sqlerrm,
          finished_at = now(),
          updated_at = now()
      where id = v_job_id;
    end if;
    raise;
end;
$$;

revoke all on function public.next_hebrew_v4_reference() from public, anon, authenticated;
revoke all on function public.invoke_hebrew_v4_daily_episode(boolean) from public, anon, authenticated;
grant execute on function public.next_hebrew_v4_reference() to service_role;
grant execute on function public.invoke_hebrew_v4_daily_episode(boolean) to service_role;

do $$
declare
  v_job record;
begin
  for v_job in
    select jobid
    from cron.job
    where jobname in (
      'hebrew-daily-audio-every-five-minutes',
      'hebrew-v4-daily-5am-pacific'
    )
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;

  perform cron.schedule(
    'hebrew-v4-daily-5am-pacific',
    '*/5 * * * *',
    'select public.invoke_hebrew_v4_daily_episode(false);'
  );
end;
$$;
