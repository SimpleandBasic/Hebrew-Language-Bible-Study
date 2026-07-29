-- Keep chapter transitions atomic, resumable, and private until every V4 asset is ready.

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
  with candidates as (
    -- Permanent source of truth: only atomically published V4 revisions advance the sequence.
    select reference
    from public.hebrew_published_episode_revisions

    union all

    -- One-time migration bridge for complete lessons published before atomic V4 release existed.
    select coalesce(
      nullif(trim(l.content->>'referenceRange'), ''),
      nullif(trim(l.content #>> '{lesson,reference}'), ''),
      substring(l.title from '(Genesis [0-9]+:[0-9]+)')
    ) as reference
    from public.hebrew_lessons l
    join public.hebrew_audio_tracks t on t.lesson_id = l.id
    where l.created_at < timestamptz '2026-07-29 21:50:00+00'
      and l.is_published = true
      and t.status = 'ready'
      and t.is_published = true
      and exists (
        select 1 from public.hebrew_audio_segments s where s.track_id = t.id
      )
      and not exists (
        select 1
        from public.hebrew_audio_segments s
        where s.track_id = t.id
          and (
            s.status <> 'ready'
            or s.audio_path is null
            or coalesce(s.duration_seconds, 0) <= 0
            or s.checksum is null
          )
      )
  ), parsed as (
    select reference, regexp_match(reference, '^Genesis\s+([0-9]+):([0-9]+)$', 'i') as match
    from candidates
    where reference is not null
  )
  select reference
    into v_latest
  from parsed
  where match is not null
  order by (match[1])::integer desc, (match[2])::integer desc
  limit 1;

  if v_latest is null then
    return 'Genesis 1:1';
  end if;

  v_match := regexp_match(v_latest, '^Genesis\s+([0-9]+):([0-9]+)$', 'i');
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

-- The original preparer expects a published lesson. This wrapper temporarily exposes
-- the row only inside the current transaction, prepares the track, and restores privacy
-- before commit. Other sessions never see the temporary state.
create or replace function public.prepare_hebrew_audio_track_from_private_lesson(
  p_lesson_order integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lesson_id uuid;
  v_was_published boolean;
  v_track_id uuid;
begin
  select id, is_published
    into v_lesson_id, v_was_published
  from public.hebrew_lessons
  where lesson_order = p_lesson_order
  order by updated_at desc
  limit 1;

  if v_lesson_id is null then
    raise exception 'Hebrew lesson % was not found', p_lesson_order;
  end if;

  if not v_was_published then
    update public.hebrew_lessons
    set is_published = true,
        updated_at = now()
    where id = v_lesson_id;
  end if;

  v_track_id := public.prepare_hebrew_audio_track_from_lesson(p_lesson_order);

  if not v_was_published then
    update public.hebrew_lessons
    set is_published = false,
        updated_at = now()
    where id = v_lesson_id;
  end if;

  return v_track_id;
end;
$$;

revoke all on function public.prepare_hebrew_audio_track_from_private_lesson(integer)
  from public, anon, authenticated;
grant execute on function public.prepare_hebrew_audio_track_from_private_lesson(integer)
  to service_role;

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
begin
  if not p_force and extract(hour from v_local_now) <> 5 then
    return null;
  end if;

  select *
    into v_existing
  from public.hebrew_generation_jobs
  where requested_by = 'daily_v4_5am_pacific'
    and (created_at at time zone 'America/Los_Angeles')::date = v_local_now::date
  order by created_at desc
  limit 1;

  if v_existing.id is not null then
    -- Retry transient failures during the same 5 AM hour. The generation route resumes
    -- the existing incomplete revision instead of advancing or rewriting from scratch.
    if v_existing.status = 'failed'
       and v_existing.attempt_count < v_existing.max_attempts
       and coalesce(v_existing.finished_at, v_existing.updated_at) <= now() - interval '2 minutes'
       and not exists (
         select 1
         from public.hebrew_generation_jobs
         where status in ('queued', 'running')
           and id <> v_existing.id
       ) then
      v_job_id := v_existing.id;

      update public.hebrew_generation_jobs
      set status = 'queued',
          current_stage = 'queued_for_retry',
          error_message = null,
          finished_at = null,
          result = result || jsonb_build_object(
            'scheduler_retry_queued_at', now(),
            'scheduler_retry_attempt', attempt_count + 1
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
    3,
    'daily_v4_5am_pacific',
    jsonb_build_object(
      'scheduler', 'pg_cron',
      'scheduled_local_date', v_local_now::date,
      'scheduled_local_hour', 5,
      'timezone', 'America/Los_Angeles',
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

-- Remove the partial Genesis 2:1 lesson from public visibility. The recovery run will
-- reuse its approved sermon and publish it only after audio, visuals, artwork, and release checks pass.
update public.hebrew_lessons l
set is_published = false,
    content = coalesce(l.content, '{}'::jsonb) - 'publishedAt',
    updated_at = now()
where coalesce(
  nullif(trim(l.content->>'referenceRange'), ''),
  nullif(trim(l.content #>> '{lesson,reference}'), ''),
  substring(l.title from '(Genesis [0-9]+:[0-9]+)')
) = 'Genesis 2:1'
  and not exists (
    select 1
    from public.hebrew_published_episode_revisions p
    where p.reference = 'Genesis 2:1'
  );

update public.hebrew_audio_tracks
set is_published = false,
    published_at = null,
    updated_at = now()
where verse_reference = 'Genesis 2:1'
  and not exists (
    select 1
    from public.hebrew_published_episode_revisions p
    where p.reference = 'Genesis 2:1'
  );
