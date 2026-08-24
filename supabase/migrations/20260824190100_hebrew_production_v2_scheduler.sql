-- Hebrew Production V2 — Scheduler and permanent Genesis 1 backfill.

create or replace function public.invoke_hebrew_genesis1_backfill(
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
  v_slot text;
  v_job_id uuid;
  v_request_id bigint;
  v_existing public.hebrew_generation_jobs%rowtype;
begin
  perform public.hebrew_refresh_failure_metadata();
  perform public.hebrew_recover_stale_generation_jobs();

  if not p_force
     and extract(hour from v_local_now)::integer not between 3 and 8 then
    return null;
  end if;

  if not p_force and public.hebrew_dependency_is_blocked('openai_api') then
    return null;
  end if;

  if exists (
    select 1
    from public.hebrew_generation_jobs
    where status in ('queued','running')
  ) then
    return null;
  end if;

  v_reference := public.next_hebrew_genesis1_backfill_reference();
  if v_reference is null then
    return null;
  end if;

  v_slot := to_char(v_local_now, 'YYYY-MM-DD"T"HH24');

  select *
    into v_existing
  from public.hebrew_generation_jobs
  where requested_by = 'production_v2_genesis1_backfill'
    and coalesce(result->>'scheduled_local_slot','') = v_slot
  order by created_at desc
  limit 1;

  if v_existing.id is not null then
    if v_existing.status = 'succeeded' then
      return null;
    end if;

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
          )
      where id = v_job_id;

      v_request_id := net.http_post(
        url := 'https://hebrew-developer-mcp.vercel.app/api/run-generation-job',
        body := jsonb_build_object('job_id', v_job_id),
        headers := '{"Content-Type":"application/json"}'::jsonb,
        timeout_milliseconds := 300000
      );

      update public.hebrew_generation_jobs
      set result = result || jsonb_build_object(
            'production_v2_retry_request_id', v_request_id
          )
      where id = v_job_id;

      return v_request_id;
    end if;

    return null;
  end if;

  insert into public.hebrew_generation_jobs(
    requested_reference,
    mode,
    environment,
    status,
    current_stage,
    attempt_count,
    max_attempts,
    requested_by,
    production_lane,
    result
  ) values (
    v_reference,
    'sermon_rebuild',
    'production',
    'queued',
    'queued',
    0,
    6,
    'production_v2_genesis1_backfill',
    'backfill',
    jsonb_build_object(
      'scheduler', 'pg_cron',
      'production_engine', 'hebrew-production-v2',
      'scheduled_local_slot', v_slot,
      'timezone', 'America/Los_Angeles',
      'required_pipeline', 'sermon-experience-v4.2+',
      'complete_release_required', true
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
  set result = result || jsonb_build_object(
        'scheduler_request_id', v_request_id
      )
  where id = v_job_id;

  return v_request_id;
exception
  when others then
    if v_job_id is not null then
      update public.hebrew_generation_jobs
      set status = 'failed',
          current_stage = 'backfill_scheduler_failed',
          error_message = sqlerrm,
          finished_at = now()
      where id = v_job_id;
    end if;
    raise;
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
  v_existing public.hebrew_generation_jobs%rowtype;
  v_retry_delay interval;
begin
  perform public.hebrew_refresh_failure_metadata();
  perform public.hebrew_recover_stale_generation_jobs();

  if not p_force and public.hebrew_dependency_is_blocked('openai_api') then
    return null;
  end if;

  select *
    into v_existing
  from public.hebrew_generation_jobs
  where requested_by = 'daily_v4_5am_pacific'
    and coalesce(result->>'scheduled_local_date','')
        = to_char(v_local_now::date,'YYYY-MM-DD')
  order by created_at desc
  limit 1;

  if v_existing.id is not null then
    if v_existing.status = 'succeeded' then
      return null;
    end if;

    if v_existing.status = 'failed' then
      if not p_force
         and v_existing.retry_not_before is not null
         and v_existing.retry_not_before > now() then
        return null;
      end if;

      if p_force and v_existing.attempt_count >= v_existing.max_attempts then
        update public.hebrew_generation_jobs
        set max_attempts = least(
              greatest(max_attempts + 1, attempt_count + 1),
              20
            )
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
            )
        where id = v_existing.id
        returning * into v_existing;
      end if;

      if p_force then
        v_retry_delay := interval '0 minutes';
      else
        v_retry_delay := public.hebrew_retry_delay(
          coalesce(v_existing.failure_class,'unknown'),
          v_existing.attempt_count
        );
      end if;

      if v_existing.attempt_count < v_existing.max_attempts
         and coalesce(v_existing.finished_at, v_existing.updated_at)
             <= now() - v_retry_delay
         and not exists (
           select 1
           from public.hebrew_generation_jobs
           where status in ('queued','running')
             and id <> v_existing.id
         ) then
        v_job_id := v_existing.id;

        -- Preserve the proven Aug 8/21 recovery behavior: close stale pre-audio
        -- inner runs before asking the V4 route to retry/resume.
        update public.hebrew_pipeline_runs p
        set status = 'failed',
            current_stage = 'failed',
            finished_at = coalesce(p.finished_at, now()),
            error_information = coalesce(
              p.error_information,
              'Production V2 closed a stale pre-audio run before retry.'
            ),
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
            failure_reason = coalesce(
              r.failure_reason,
              'Production V2 closed a stale revision before retry.'
            ),
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
            )
        where id = v_job_id;

        v_request_id := net.http_post(
          url := 'https://hebrew-developer-mcp.vercel.app/api/run-generation-job',
          body := jsonb_build_object('job_id', v_job_id),
          headers := '{"Content-Type":"application/json"}'::jsonb,
          timeout_milliseconds := 300000
        );

        update public.hebrew_generation_jobs
        set result = result || jsonb_build_object(
              'scheduler_retry_request_id', v_request_id
            )
        where id = v_job_id;

        return v_request_id;
      end if;
    end if;

    return null;
  end if;

  if not p_force and extract(hour from v_local_now) <> 5 then
    return null;
  end if;

  if exists (
    select 1
    from public.hebrew_generation_jobs
    where status in ('queued','running')
  ) then
    return null;
  end if;

  v_reference := public.next_hebrew_v4_reference();

  insert into public.hebrew_generation_jobs(
    requested_reference,
    mode,
    environment,
    status,
    current_stage,
    attempt_count,
    max_attempts,
    requested_by,
    production_lane,
    result
  ) values (
    v_reference,
    'publish',
    'production',
    'queued',
    'queued',
    0,
    6,
    'daily_v4_5am_pacific',
    'forward',
    jsonb_build_object(
      'scheduler', 'pg_cron',
      'scheduled_local_date', v_local_now::date,
      'scheduled_local_hour', 5,
      'timezone', 'America/Los_Angeles',
      'complete_release_required', true,
      'recovery_policy', 'production_v2_failure_aware',
      'production_engine', 'hebrew-production-v2'
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
  set result = result || jsonb_build_object(
        'scheduler_request_id', v_request_id
      )
  where id = v_job_id;

  return v_request_id;
exception
  when others then
    if v_job_id is not null then
      update public.hebrew_generation_jobs
      set status = 'failed',
          current_stage = 'scheduler_failed',
          error_message = sqlerrm,
          finished_at = now()
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
  exception
    when others then
      v_daily := null;
  end;

  begin
    v_backfill := public.invoke_hebrew_genesis1_backfill(false);
  exception
    when others then
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

revoke all on function public.invoke_hebrew_genesis1_backfill(boolean)
  from public, anon, authenticated;
revoke all on function public.hebrew_production_v2_tick()
  from public, anon, authenticated;

grant execute on function public.invoke_hebrew_genesis1_backfill(boolean)
  to service_role;
grant execute on function public.invoke_hebrew_v4_daily_episode(boolean)
  to service_role;
grant execute on function public.hebrew_production_v2_tick()
  to service_role;

-- Replace the single-purpose poller with one production supervisor.
do $$
declare
  v_job record;
begin
  for v_job in
    select jobid
    from cron.job
    where jobname in (
      'hebrew-v4-daily-5am-pacific',
      'hebrew-production-v2-every-five-minutes'
    )
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
