-- Hebrew Production V2
-- Durable recovery, dependency blocking, Genesis 1 V4.2 completeness,
-- permanent backfill scheduling, and one production health contract.

alter table public.hebrew_generation_jobs
  add column if not exists production_lane text not null default 'manual',
  add column if not exists failure_class text,
  add column if not exists retry_not_before timestamptz,
  add column if not exists dependency_name text,
  add column if not exists heartbeat_at timestamptz,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists recovery_count integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'hebrew_generation_jobs_production_lane_check'
      and conrelid = 'public.hebrew_generation_jobs'::regclass
  ) then
    alter table public.hebrew_generation_jobs
      add constraint hebrew_generation_jobs_production_lane_check
      check (production_lane in ('forward','backfill','repair','manual','test'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'hebrew_generation_jobs_failure_class_check'
      and conrelid = 'public.hebrew_generation_jobs'::regclass
  ) then
    alter table public.hebrew_generation_jobs
      add constraint hebrew_generation_jobs_failure_class_check
      check (failure_class is null or failure_class in (
        'dependency_blocked','transient','quality_gate','conflict','data_error','unknown'
      ));
  end if;
end;
$$;

create index if not exists hebrew_generation_jobs_lane_status_created_idx
  on public.hebrew_generation_jobs(production_lane, status, created_at desc);
create index if not exists hebrew_generation_jobs_retry_not_before_idx
  on public.hebrew_generation_jobs(retry_not_before)
  where status = 'failed';
create index if not exists hebrew_generation_jobs_heartbeat_idx
  on public.hebrew_generation_jobs(status, heartbeat_at, updated_at)
  where status in ('queued','running');

update public.hebrew_generation_jobs
set production_lane = case
  when requested_by = 'daily_v4_5am_pacific' then 'forward'
  when requested_by in ('overnight_genesis1_backfill','production_v2_genesis1_backfill') then 'backfill'
  when mode in ('audio_rebuild','sermon_rebuild') then 'repair'
  when environment = 'test' or mode = 'test' then 'test'
  else production_lane
end;

create table if not exists public.hebrew_production_dependencies (
  dependency_key text primary key,
  status text not null default 'unknown' check (status in ('healthy','blocked','unknown')),
  reason text,
  blocked_until timestamptz,
  observed_at timestamptz not null default now(),
  last_success_at timestamptz,
  details jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.hebrew_production_dependencies enable row level security;
revoke all on public.hebrew_production_dependencies from anon, authenticated;
grant select, insert, update on public.hebrew_production_dependencies to service_role;

create or replace function public.hebrew_classify_generation_failure(p_message text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when coalesce(p_message, '') ~* '(no credits remaining|insufficient[_ ]quota|billing|quota[^a-z]+exceeded|missing server environment|credentials are missing|api key is missing)'
      then 'dependency_blocked'
    when coalesce(p_message, '') ~* '(timeout|timed out|aborted due to timeout|rate limit|429|502|503|504|temporar|network|fetch failed|socket|econnreset|generation window)'
      then 'transient'
    when coalesce(p_message, '') ~* '(producer gate|spoken gate|quality gate|transcript[^.]*words|required range|evidence coverage|rewrite directive|sermon is missing|required fields)'
      then 'quality_gate'
    when coalesce(p_message, '') ~* '(already being generated|already .*running|requested .* but the next incomplete|conflict|\b409\b)'
      then 'conflict'
    when coalesce(p_message, '') ~* '(canonical text lookup|kjv text was not returned|hebrew text was not returned|invalid genesis|unsupported genesis|lesson .* was not found|track .* not found)'
      then 'data_error'
    else 'unknown'
  end;
$$;

create or replace function public.hebrew_failure_dependency(p_message text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when coalesce(p_message, '') ~* '(no credits remaining|insufficient[_ ]quota|billing|quota[^a-z]+exceeded|openai|api key is missing)'
      then 'openai_api'
    when coalesce(p_message, '') ~* '(supabase.*credentials|service role|storage upload)'
      then 'supabase_runtime'
    when coalesce(p_message, '') ~* '(missing server environment|credentials are missing)'
      then 'runtime_configuration'
    else null
  end;
$$;

create or replace function public.hebrew_retry_delay(
  p_failure_class text,
  p_attempt_count integer default 0
)
returns interval
language sql
immutable
set search_path = public
as $$
  select case
    when p_failure_class = 'dependency_blocked' then interval '2 hours'
    when p_failure_class = 'quality_gate' then interval '1 hour'
    when p_failure_class = 'conflict' then interval '10 minutes'
    when p_failure_class = 'data_error' then interval '24 hours'
    when p_failure_class = 'transient' and coalesce(p_attempt_count,0) < 3 then interval '5 minutes'
    when p_failure_class = 'transient' and coalesce(p_attempt_count,0) < 6 then interval '30 minutes'
    when p_failure_class = 'transient' and coalesce(p_attempt_count,0) < 9 then interval '1 hour'
    when p_failure_class = 'transient' then interval '2 hours'
    else interval '30 minutes'
  end;
$$;

create or replace function public.hebrew_prepare_generation_job_state()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_class text;
  v_dependency text;
begin
  if new.status = 'running' then
    new.heartbeat_at := now();
    new.lease_expires_at := now() + interval '12 minutes';
    new.retry_not_before := null;
  elsif new.status = 'succeeded' then
    new.heartbeat_at := now();
    new.lease_expires_at := null;
    new.retry_not_before := null;
    new.failure_class := null;
    new.dependency_name := null;
  elsif new.status = 'failed' and nullif(trim(coalesce(new.error_message,'')), '') is not null then
    v_class := public.hebrew_classify_generation_failure(new.error_message);
    v_dependency := public.hebrew_failure_dependency(new.error_message);
    new.failure_class := v_class;
    new.dependency_name := v_dependency;
    new.lease_expires_at := null;
    if new.retry_not_before is null or new.retry_not_before <= now() then
      new.retry_not_before := now() + public.hebrew_retry_delay(v_class, new.attempt_count);
    end if;
  elsif new.status in ('queued','cancelled') then
    new.lease_expires_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists hebrew_prepare_generation_job_state on public.hebrew_generation_jobs;
create trigger hebrew_prepare_generation_job_state
before insert or update of status, error_message, attempt_count
on public.hebrew_generation_jobs
for each row execute function public.hebrew_prepare_generation_job_state();

create or replace function public.hebrew_sync_production_dependency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'failed'
     and new.failure_class = 'dependency_blocked'
     and new.dependency_name is not null then
    insert into public.hebrew_production_dependencies(
      dependency_key, status, reason, blocked_until, observed_at, details, updated_at
    ) values (
      new.dependency_name,
      'blocked',
      new.error_message,
      greatest(coalesce(new.retry_not_before, now() + interval '2 hours'), now() + interval '2 hours'),
      now(),
      jsonb_build_object('job_id', new.id, 'reference', new.requested_reference),
      now()
    )
    on conflict (dependency_key) do update
    set status = 'blocked',
        reason = excluded.reason,
        blocked_until = greatest(
          coalesce(public.hebrew_production_dependencies.blocked_until, excluded.blocked_until),
          excluded.blocked_until
        ),
        observed_at = excluded.observed_at,
        details = excluded.details,
        updated_at = now();
  elsif new.status = 'succeeded' then
    update public.hebrew_production_dependencies
    set status = 'healthy',
        reason = null,
        blocked_until = null,
        last_success_at = now(),
        observed_at = now(),
        details = jsonb_build_object('job_id', new.id, 'reference', new.resolved_reference),
        updated_at = now()
    where dependency_key = 'openai_api';
  end if;
  return null;
end;
$$;

drop trigger if exists hebrew_sync_production_dependency on public.hebrew_generation_jobs;
create trigger hebrew_sync_production_dependency
after insert or update of status, failure_class, dependency_name
on public.hebrew_generation_jobs
for each row execute function public.hebrew_sync_production_dependency();

create or replace function public.hebrew_dependency_is_blocked(p_dependency_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select status = 'blocked' and blocked_until is not null and blocked_until > now()
    from public.hebrew_production_dependencies
    where dependency_key = p_dependency_key
  ), false);
$$;

create or replace function public.hebrew_refresh_failure_metadata()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  update public.hebrew_generation_jobs
  set failure_class = public.hebrew_classify_generation_failure(error_message),
      dependency_name = public.hebrew_failure_dependency(error_message),
      retry_not_before = coalesce(
        retry_not_before,
        coalesce(finished_at, updated_at, now())
          + public.hebrew_retry_delay(public.hebrew_classify_generation_failure(error_message), attempt_count)
      ),
      updated_at = now()
  where status = 'failed'
    and nullif(trim(coalesce(error_message,'')), '') is not null
    and (failure_class is null or retry_not_before is null);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.hebrew_recover_stale_generation_jobs(
  p_queue_age interval default interval '10 minutes',
  p_running_age interval default interval '12 minutes'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  with recovered as (
    update public.hebrew_generation_jobs j
    set status = 'failed',
        current_stage = case when j.status = 'queued' then 'stale_queue_recovered' else 'stale_worker_recovered' end,
        error_message = case
          when j.status = 'queued'
            then 'Production V2 recovered a queued Hebrew job that did not start before its lease window expired.'
          else 'Production V2 recovered a running Hebrew job whose worker lease expired before reaching a terminal state.'
        end,
        finished_at = now(),
        recovery_count = coalesce(j.recovery_count,0) + 1,
        updated_at = now()
    where (
      j.status = 'queued'
      and coalesce(j.updated_at, j.created_at) <= now() - p_queue_age
    ) or (
      j.status = 'running'
      and coalesce(j.heartbeat_at, j.updated_at, j.started_at, j.created_at) <= now() - p_running_age
    )
    returning j.id, j.requested_reference, j.current_stage
  ), logged as (
    insert into public.hebrew_generation_job_events(job_id, stage, status, message, details)
    select id,
           current_stage,
           'failed',
           'Production V2 recovered a stale generation job.',
           jsonb_build_object('reference', requested_reference, 'recovered_at', now())
    from recovered
    returning 1
  )
  select count(*) into v_count from recovered;
  return v_count;
end;
$$;

create or replace function public.hebrew_pipeline_meets_genesis1_rebuild(p_pipeline_version text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_match text[];
  v_major integer;
  v_minor integer;
begin
  v_match := regexp_match(coalesce(p_pipeline_version,''), '^sermon-experience-v([0-9]+)\.([0-9]+)');
  if v_match is null then return false; end if;
  v_major := v_match[1]::integer;
  v_minor := v_match[2]::integer;
  return v_major > 4 or (v_major = 4 and v_minor >= 2);
end;
$$;

create or replace function public.hebrew_genesis1_v42_integrity()
returns table(
  verse_number integer,
  reference text,
  is_complete boolean,
  pipeline_version text,
  published_at timestamptz,
  latest_job_id uuid,
  latest_job_status text,
  latest_job_stage text,
  latest_job_failure_class text,
  latest_job_error text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.verse_number,
    format('Genesis 1:%s', v.verse_number) as reference,
    (published.revision_id is not null) as is_complete,
    published.pipeline_version,
    published.published_at,
    latest_job.id,
    latest_job.status,
    latest_job.current_stage,
    latest_job.failure_class,
    latest_job.error_message
  from generate_series(1,31) as v(verse_number)
  left join lateral (
    select p.revision_id, p.pipeline_version, p.published_at
    from public.hebrew_published_episode_revisions p
    where p.reference = format('Genesis 1:%s', v.verse_number)
      and public.hebrew_pipeline_meets_genesis1_rebuild(p.pipeline_version)
    order by p.published_at desc
    limit 1
  ) published on true
  left join lateral (
    select j.id, j.status, j.current_stage, j.failure_class, j.error_message
    from public.hebrew_generation_jobs j
    where j.requested_reference = format('Genesis 1:%s', v.verse_number)
      and j.mode = 'sermon_rebuild'
    order by j.created_at desc
    limit 1
  ) latest_job on true
  order by v.verse_number;
$$;

create or replace function public.next_hebrew_genesis1_backfill_reference()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select reference
  from public.hebrew_genesis1_v42_integrity()
  where not is_complete
  order by verse_number
  limit 1;
$$;

create or replace function public.hebrew_production_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_genesis1_complete integer;
  v_next_backfill text;
  v_forward_next text;
  v_legacy_audio_ready integer;
  v_active jsonb;
  v_dependency jsonb;
  v_last_success jsonb;
begin
  select count(*) filter (where is_complete),
         min(reference) filter (where not is_complete)
    into v_genesis1_complete, v_next_backfill
  from public.hebrew_genesis1_v42_integrity();

  v_next_backfill := public.next_hebrew_genesis1_backfill_reference();
  v_forward_next := public.next_hebrew_v4_reference();

  select count(*) into v_legacy_audio_ready
  from public.hebrew_audio_tracks
  where verse_reference ~ '^Genesis 1:[0-9]+$'
    and status = 'ready'
    and is_published = true;

  select to_jsonb(x) into v_active
  from (
    select id, requested_reference, production_lane, mode, status, current_stage,
           attempt_count, max_attempts, heartbeat_at, lease_expires_at, created_at, updated_at
    from public.hebrew_generation_jobs
    where status in ('queued','running')
    order by created_at desc
    limit 1
  ) x;

  select to_jsonb(d) into v_dependency
  from (
    select dependency_key, status, reason, blocked_until, observed_at, last_success_at
    from public.hebrew_production_dependencies
    where dependency_key = 'openai_api'
  ) d;

  select to_jsonb(s) into v_last_success
  from (
    select id, resolved_reference, requested_reference, production_lane, finished_at, attempt_count
    from public.hebrew_generation_jobs
    where status = 'succeeded'
    order by finished_at desc nulls last, created_at desc
    limit 1
  ) s;

  return jsonb_build_object(
    'status', case
      when coalesce(v_dependency->>'status','') = 'blocked'
       and nullif(v_dependency->>'blocked_until','')::timestamptz > now() then 'blocked'
      when v_active is not null then 'working'
      else 'ready'
    end,
    'forward_next_reference', v_forward_next,
    'genesis1', jsonb_build_object(
      'required_pipeline', 'sermon-experience-v4.2+',
      'complete', coalesce(v_genesis1_complete,0),
      'total', 31,
      'remaining', 31 - coalesce(v_genesis1_complete,0),
      'next_backfill_reference', v_next_backfill,
      'legacy_audio_ready', coalesce(v_legacy_audio_ready,0)
    ),
    'active_job', v_active,
    'dependency', v_dependency,
    'last_success', v_last_success,
    'checked_at', now()
  );
end;
$$;

create or replace function public.invoke_hebrew_genesis1_backfill(p_force boolean default false)
returns bigint
language plpgsql
security definer
set search_path = public, net
as $$
declare
  v_local_now timestamp without time zone := timezone('America/Los_Angeles', now());
  v_reference text;
  v_slot text;
  v_job_id uuid;
  v_request_id bigint;
  v_existing public.hebrew_generation_jobs%rowtype;
begin
  perform public.hebrew_refresh_failure_metadata();
  perform public.hebrew_recover_stale_generation_jobs();

  if not p_force and extract(hour from v_local_now)::integer not between 3 and 8 then
    return null;
  end if;

  if not p_force and public.hebrew_dependency_is_blocked('openai_api') then
    return null;
  end if;

  if exists (
    select 1 from public.hebrew_generation_jobs
    where status in ('queued','running')
  ) then
    return null;
  end if;

  v_reference := public.next_hebrew_genesis1_backfill_reference();
  if v_reference is null then return null; end if;

  v_slot := to_char(v_local_now, 'YYYY-MM-DD"T"HH24');

  select * into v_existing
  from public.hebrew_generation_jobs
  where requested_by = 'production_v2_genesis1_backfill'
    and coalesce(result->>'scheduled_local_slot','') = v_slot
  order by created_at desc
  limit 1;

  if v_existing.id is not null then
    if v_existing.status = 'succeeded' then return null; end if;
    if v_existing.status = 'failed'
       and v_existing.attempt_count < v_existing.max_attempts
       and (p_force or coalesce(v_existing.retry_not_before, now()) <= now())
       and (p_force or not public.hebrew_dependency_is_blocked('openai_api')) then
      v_job_id := v_existing.id;
      update public.hebrew_generation_jobs
      set status = 'queued',
          current_stage = 'queued_for_backfill_retry',
          error_message = null,
          failure_class = null,
          dependency_name = null,
          retry_not_before = null,
          finished_at = null,
          production_lane = 'backfill',
          result = coalesce(result,'{}'::jsonb) || jsonb_build_object(
            'production_v2_retry_queued_at', now(),
            'production_v2_retry_attempt', attempt_count + 1
          ),
          updated_at = now()
      where id = v_job_id;

      v_request_id := net.http_post(
        url := 'https://hebrew-developer-mcp.vercel.app/api/run-generation-job',
        body := jsonb_build_object('job_id', v_job_id),
        headers := '{"Content-Type":"application/json"}'::jsonb,
        timeout_milliseconds := 300000
      );
      update public.hebrew_generation_jobs
      set result = result || jsonb_build_object('production_v2_retry_request_id', v_request_id),
          updated_at = now()
      where id = v_job_id;
      return v_request_id;
    end if;
    return null;
  end if;

  insert into public.hebrew_generation_jobs(
    requested_reference, mode, environment, status, current_stage,
    attempt_count, max_attempts, requested_by, production_lane, result
  ) values (
    v_reference, 'sermon_rebuild', 'production', 'queued', 'queued',
    0, 6, 'production_v2_genesis1_backfill', 'backfill',
    jsonb_build_object(
      'scheduler', 'pg_cron',
      'production_engine', 'hebrew-production-v2',
      'scheduled_local_slot', v_slot,
      'timezone', 'America/Los_Angeles',
      'required_pipeline', 'sermon-experience-v4.2+',
      'complete_release_required', true
    )
  ) returning id into v_job_id;

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
          current_stage = 'backfill_scheduler_failed',
          error_message = sqlerrm,
          finished_at = now(),
          updated_at = now()
      where id = v_job_id;
    end if;
    raise;
end;
$$;

create or replace function public.invoke_hebrew_v4_daily_episode(p_force boolean default false)
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
  v_existing public.hebrew_generation_jobs%rowtype;
  v_retry_delay interval;
begin
  perform public.hebrew_refresh_failure_metadata();
  perform public.hebrew_recover_stale_generation_jobs();

  if not p_force and public.hebrew_dependency_is_blocked('openai_api') then
    return null;
  end if;

  select * into v_existing
  from public.hebrew_generation_jobs
  where requested_by = 'daily_v4_5am_pacific'
    and coalesce(result->>'scheduled_local_date','') = to_char(v_local_now::date,'YYYY-MM-DD')
  order by created_at desc
  limit 1;

  if v_existing.id is not null then
    if v_existing.status = 'succeeded' then return null; end if;

    if v_existing.status = 'failed' then
      if not p_force and v_existing.retry_not_before is not null and v_existing.retry_not_before > now() then
        return null;
      end if;

      if p_force and v_existing.attempt_count >= v_existing.max_attempts then
        update public.hebrew_generation_jobs
        set max_attempts = least(greatest(max_attempts + 1, attempt_count + 1), 20),
            updated_at = now()
        where id = v_existing.id
        returning * into v_existing;
      elsif v_existing.failure_class = 'transient'
         and v_existing.attempt_count >= v_existing.max_attempts
         and v_existing.max_attempts < 12 then
        update public.hebrew_generation_jobs
        set max_attempts = 12,
            result = coalesce(result,'{}'::jsonb) || jsonb_build_object(
              'scheduler_recovery_ceiling_extended_at', now(),
              'scheduler_recovery_reason', 'transient_infrastructure_failure'
            ),
            updated_at = now()
        where id = v_existing.id
        returning * into v_existing;
      end if;

      if p_force then
        v_retry_delay := interval '0 minutes';
      else
        v_retry_delay := public.hebrew_retry_delay(coalesce(v_existing.failure_class,'unknown'), v_existing.attempt_count);
      end if;

      if v_existing.attempt_count < v_existing.max_attempts
         and coalesce(v_existing.finished_at, v_existing.updated_at) <= now() - v_retry_delay
         and not exists (
           select 1 from public.hebrew_generation_jobs
           where status in ('queued','running') and id <> v_existing.id
         ) then
        v_job_id := v_existing.id;

        update public.hebrew_pipeline_runs p
        set status = 'failed',
            current_stage = 'failed',
            finished_at = coalesce(p.finished_at, now()),
            error_information = coalesce(p.error_information, 'Production V2 closed a stale pre-audio run before retry.'),
            updated_at = now()
        from public.hebrew_episode_revisions r
        join public.hebrew_episodes e on e.id = r.episode_id
        where p.revision_id = r.id
          and e.reference = v_existing.requested_reference
          and r.release_state = 'private'
          and r.status in ('researching','drafting','evaluating')
          and p.status = 'running'
          and p.updated_at <= now() - interval '2 minutes';

        update public.hebrew_episode_revisions r
        set status = 'failed',
            failure_reason = coalesce(r.failure_reason, 'Production V2 closed a stale revision before retry.'),
            updated_at = now()
        from public.hebrew_episodes e
        where e.id = r.episode_id
          and e.reference = v_existing.requested_reference
          and r.release_state = 'private'
          and r.status in ('researching','drafting','evaluating')
          and r.updated_at <= now() - interval '2 minutes';

        update public.hebrew_generation_jobs
        set status = 'queued',
            current_stage = 'queued_for_retry',
            error_message = null,
            failure_class = null,
            dependency_name = null,
            retry_not_before = null,
            finished_at = null,
            production_lane = 'forward',
            result = coalesce(result,'{}'::jsonb) || jsonb_build_object(
              'scheduler_retry_queued_at', now(),
              'scheduler_retry_attempt', attempt_count + 1,
              'scheduler_retry_delay_seconds', extract(epoch from v_retry_delay),
              'production_engine', 'hebrew-production-v2'
            ),
            updated_at = now()
        where id = v_job_id;

        v_request_id := net.http_post(
          url := 'https://hebrew-developer-mcp.vercel.app/api/run-generation-job',
          body := jsonb_build_object('job_id', v_job_id),
          headers := '{"Content-Type":"application/json"}'::jsonb,
          timeout_milliseconds := 300000
        );
        update public.hebrew_generation_jobs
        set result = result || jsonb_build_object('scheduler_retry_request_id', v_request_id),
            updated_at = now()
        where id = v_job_id;
        return v_request_id;
      end if;
    end if;
    return null;
  end if;

  if not p_force and extract(hour from v_local_now) <> 5 then return null; end if;
  if exists (select 1 from public.hebrew_generation_jobs where status in ('queued','running')) then return null; end if;

  v_reference := public.next_hebrew_v4_reference();
  insert into public.hebrew_generation_jobs(
    requested_reference, mode, environment, status, current_stage,
    attempt_count, max_attempts, requested_by, production_lane, result
  ) values (
    v_reference, 'publish', 'production', 'queued', 'queued',
    0, 6, 'daily_v4_5am_pacific', 'forward',
    jsonb_build_object(
      'scheduler', 'pg_cron',
      'scheduled_local_date', v_local_now::date,
      'scheduled_local_hour', 5,
      'timezone', 'America/Los_Angeles',
      'complete_release_required', true,
      'recovery_policy', 'production_v2_failure_aware',
      'production_engine', 'hebrew-production-v2'
    )
  ) returning id into v_job_id;

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

create or replace function public.hebrew_production_v2_tick()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recovered integer := 0;
  v_classified integer := 0;
  v_daily bigint;
  v_backfill bigint;
begin
  v_recovered := public.hebrew_recover_stale_generation_jobs();
  v_classified := public.hebrew_refresh_failure_metadata();

  begin
    v_daily := public.invoke_hebrew_v4_daily_episode(false);
  exception when others then
    v_daily := null;
  end;

  begin
    v_backfill := public.invoke_hebrew_genesis1_backfill(false);
  exception when others then
    v_backfill := null;
  end;

  return jsonb_build_object(
    'recovered_jobs', v_recovered,
    'classified_failures', v_classified,
    'daily_request_id', v_daily,
    'backfill_request_id', v_backfill,
    'health', public.hebrew_production_health()
  );
end;
$$;

revoke all on function public.hebrew_classify_generation_failure(text) from public, anon, authenticated;
revoke all on function public.hebrew_failure_dependency(text) from public, anon, authenticated;
revoke all on function public.hebrew_retry_delay(text,integer) from public, anon, authenticated;
revoke all on function public.hebrew_dependency_is_blocked(text) from public, anon, authenticated;
revoke all on function public.hebrew_refresh_failure_metadata() from public, anon, authenticated;
revoke all on function public.hebrew_recover_stale_generation_jobs(interval,interval) from public, anon, authenticated;
revoke all on function public.hebrew_pipeline_meets_genesis1_rebuild(text) from public, anon, authenticated;
revoke all on function public.hebrew_genesis1_v42_integrity() from public, anon, authenticated;
revoke all on function public.next_hebrew_genesis1_backfill_reference() from public, anon, authenticated;
revoke all on function public.hebrew_production_health() from public, anon, authenticated;
revoke all on function public.invoke_hebrew_genesis1_backfill(boolean) from public, anon, authenticated;
revoke all on function public.hebrew_production_v2_tick() from public, anon, authenticated;

grant execute on function public.hebrew_classify_generation_failure(text) to service_role;
grant execute on function public.hebrew_failure_dependency(text) to service_role;
grant execute on function public.hebrew_retry_delay(text,integer) to service_role;
grant execute on function public.hebrew_dependency_is_blocked(text) to service_role;
grant execute on function public.hebrew_refresh_failure_metadata() to service_role;
grant execute on function public.hebrew_recover_stale_generation_jobs(interval,interval) to service_role;
grant execute on function public.hebrew_pipeline_meets_genesis1_rebuild(text) to service_role;
grant execute on function public.hebrew_genesis1_v42_integrity() to service_role;
grant execute on function public.next_hebrew_genesis1_backfill_reference() to service_role;
grant execute on function public.hebrew_production_health() to service_role;
grant execute on function public.invoke_hebrew_genesis1_backfill(boolean) to service_role;
grant execute on function public.invoke_hebrew_v4_daily_episode(boolean) to service_role;
grant execute on function public.hebrew_production_v2_tick() to service_role;

-- Classify pre-existing failures so the current dependency state becomes truthful immediately.
perform public.hebrew_refresh_failure_metadata();

insert into public.hebrew_production_dependencies(
  dependency_key, status, reason, blocked_until, observed_at, details, updated_at
)
select
  'openai_api',
  'blocked',
  j.error_message,
  greatest(coalesce(j.retry_not_before, now() + interval '2 hours'), now() + interval '2 hours'),
  now(),
  jsonb_build_object('job_id', j.id, 'reference', j.requested_reference, 'seeded_by', 'hebrew-production-v2'),
  now()
from public.hebrew_generation_jobs j
where j.status = 'failed'
  and j.failure_class = 'dependency_blocked'
  and j.dependency_name = 'openai_api'
order by coalesce(j.finished_at, j.updated_at) desc
limit 1
on conflict (dependency_key) do update
set status = excluded.status,
    reason = excluded.reason,
    blocked_until = greatest(coalesce(public.hebrew_production_dependencies.blocked_until, excluded.blocked_until), excluded.blocked_until),
    observed_at = excluded.observed_at,
    details = excluded.details,
    updated_at = now();

-- Replace the single-purpose daily poller with one production tick.
do $$
declare
  v_job record;
begin
  for v_job in
    select jobid from cron.job
    where jobname in ('hebrew-v4-daily-5am-pacific','hebrew-production-v2-every-five-minutes')
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;

  perform cron.schedule(
    'hebrew-production-v2-every-five-minutes',
    '*/5 * * * *',
    'select public.hebrew_production_v2_tick();'
  );
end;
$$;
