-- Hebrew Production V2 — close dependency circuit breakers after a verified success.

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
      dependency_key,
      status,
      reason,
      blocked_until,
      observed_at,
      details,
      updated_at
    ) values (
      new.dependency_name,
      'blocked',
      new.error_message,
      greatest(
        coalesce(new.retry_not_before, now() + interval '2 hours'),
        now() + interval '2 hours'
      ),
      now(),
      jsonb_build_object(
        'job_id', new.id,
        'reference', new.requested_reference,
        'failure_class', new.failure_class
      ),
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

  elsif new.status = 'succeeded'
        and new.environment = 'production'
        and new.mode in ('publish','sermon_rebuild','audio_rebuild') then
    update public.hebrew_production_dependencies
    set status = 'healthy',
        reason = null,
        blocked_until = null,
        observed_at = now(),
        last_success_at = coalesce(new.finished_at, now()),
        details = jsonb_build_object(
          'recovered_by_job_id', new.id,
          'reference', coalesce(new.resolved_reference, new.requested_reference)
        ),
        updated_at = now()
    where dependency_key = 'openai_api'
      and observed_at <= coalesce(new.finished_at, now());
  end if;

  return null;
end;
$$;
