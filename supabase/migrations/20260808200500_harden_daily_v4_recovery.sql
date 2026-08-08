-- Harden the canonical 5 AM Pacific Supabase scheduler so transient failures can
-- recover later the same day, even after the original retry ceiling is reached.
-- Also close stale pre-audio V4 runs left behind when the outer Vercel request
-- reaches its orchestration timeout.

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
  v_recoverable_failure boolean := false;
begin
  select *
    into v_existing
  from public.hebrew_generation_jobs
  where requested_by = 'daily_v4_5am_pacific'
    and (created_at at time zone 'America/Los_Angeles')::date = v_local_now::date
  order by created_at desc
  limit 1;

  if v_existing.id is not null then
    if v_existing.status = 'succeeded' then
      return null;
    end if;

    if v_existing.status = 'failed' then
      v_recoverable_failure := coalesce(v_existing.error_message, '') ~* '(no credits remaining|timeout|timed out|aborted due to timeout|rate limit|429|502|503|504|temporar)';

      if p_force and v_existing.attempt_count >= v_existing.max_attempts then
        update public.hebrew_generation_jobs
        set max_attempts = least(greatest(max_attempts + 1, attempt_count + 1), 20),
            updated_at = now()
        where id = v_existing.id
        returning * into v_existing;
      elsif v_recoverable_failure
         and v_existing.attempt_count >= v_existing.max_attempts
         and v_existing.max_attempts < 12 then
        update public.hebrew_generation_jobs
        set max_attempts = 12,
            result = coalesce(result, '{}'::jsonb) || jsonb_build_object(
              'scheduler_recovery_ceiling_extended_at', now(),
              'scheduler_recovery_reason', 'transient_infrastructure_failure'
            ),
            updated_at = now()
        where id = v_existing.id
        returning * into v_existing;
      end if;

      if p_force then
        v_retry_delay := interval '0 minutes';
      elsif v_existing.attempt_count < 3 then
        v_retry_delay := interval '5 minutes';
      elsif v_existing.attempt_count < 6 then
        v_retry_delay := interval '30 minutes';
      elsif v_existing.attempt_count < 9 then
        v_retry_delay := interval '60 minutes';
      else
        v_retry_delay := interval '120 minutes';
      end if;

      if v_existing.attempt_count < v_existing.max_attempts
         and coalesce(v_existing.finished_at, v_existing.updated_at) <= now() - v_retry_delay
         and not exists (
           select 1
           from public.hebrew_generation_jobs
           where status in ('queued', 'running')
             and id <> v_existing.id
         ) then
        v_job_id := v_existing.id;

        update public.hebrew_pipeline_runs p
        set status = 'failed',
            current_stage = 'failed',
            finished_at = coalesce(p.finished_at, now()),
            error_information = coalesce(p.error_information, 'Outer orchestration ended before the V4 run reached a terminal state; scheduler closed the stale run before retry.'),
            updated_at = now()
        from public.hebrew_episode_revisions r
        join public.hebrew_episodes e on e.id = r.episode_id
        where p.revision_id = r.id
          and e.reference = v_existing.requested_reference
          and r.release_state = 'private'
          and r.status in ('researching', 'drafting', 'evaluating')
          and p.status = 'running'
          and p.updated_at <= now() - interval '2 minutes';

        update public.hebrew_episode_revisions r
        set status = 'failed',
            failure_reason = coalesce(r.failure_reason, 'Outer orchestration ended before the V4 run reached a terminal state; scheduler closed the stale revision before retry.'),
            updated_at = now()
        from public.hebrew_episodes e
        where e.id = r.episode_id
          and e.reference = v_existing.requested_reference
          and r.release_state = 'private'
          and r.status in ('researching', 'drafting', 'evaluating')
          and r.updated_at <= now() - interval '2 minutes';

        update public.hebrew_generation_jobs
        set status = 'queued',
            current_stage = 'queued_for_retry',
            error_message = null,
            finished_at = null,
            result = coalesce(result, '{}'::jsonb) || jsonb_build_object(
              'scheduler_retry_queued_at', now(),
              'scheduler_retry_attempt', attempt_count + 1,
              'scheduler_retry_delay_seconds', extract(epoch from v_retry_delay)
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
        set result = coalesce(result, '{}'::jsonb) || jsonb_build_object('scheduler_retry_request_id', v_request_id),
            updated_at = now()
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
    6,
    'daily_v4_5am_pacific',
    jsonb_build_object(
      'scheduler', 'pg_cron',
      'scheduled_local_date', v_local_now::date,
      'scheduled_local_hour', 5,
      'timezone', 'America/Los_Angeles',
      'complete_release_required', true,
      'recovery_policy', 'same_day_backoff_v2'
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
  set result = coalesce(result, '{}'::jsonb) || jsonb_build_object('scheduler_request_id', v_request_id),
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

revoke all on function public.invoke_hebrew_v4_daily_episode(boolean) from public, anon, authenticated;
grant execute on function public.invoke_hebrew_v4_daily_episode(boolean) to service_role;
