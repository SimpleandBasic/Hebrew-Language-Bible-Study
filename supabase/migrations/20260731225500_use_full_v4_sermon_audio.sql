-- Preserve the complete V4 spoken sermon in audio instead of rebuilding the
-- episode from short metadata summaries. Long transcripts are split on word
-- boundaries so each TTS request remains safely sized.

create or replace function public.split_hebrew_audio_text(
  p_text text,
  p_max_chars integer default 3600
)
returns table(chunk_order integer, chunk_text text)
language plpgsql
immutable
set search_path = public
as $function$
declare
  remaining_text text := regexp_replace(trim(coalesce(p_text, '')), '[[:space:]]+', ' ', 'g');
  next_chunk text;
  chunk_number integer := 1;
  safe_limit integer := greatest(500, least(coalesce(p_max_chars, 3600), 3900));
begin
  while length(remaining_text) > safe_limit loop
    next_chunk := substring(
      remaining_text
      from ('^(.{1,' || safe_limit::text || '})(?:[[:space:]]|$)')
    );

    if nullif(trim(next_chunk), '') is null then
      next_chunk := left(remaining_text, safe_limit);
    end if;

    chunk_order := chunk_number;
    chunk_text := trim(next_chunk);
    return next;

    remaining_text := ltrim(substr(remaining_text, length(next_chunk) + 1));
    chunk_number := chunk_number + 1;
  end loop;

  if nullif(trim(remaining_text), '') is not null then
    chunk_order := chunk_number;
    chunk_text := trim(remaining_text);
    return next;
  end if;
end;
$function$;

create or replace function public.prepare_hebrew_audio_track_from_private_lesson(p_lesson_order integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  lesson_row public.hebrew_lessons%rowtype;
  verse_row public.hebrew_verses%rowtype;
  content_json jsonb;
  root_json jsonb;
  lesson_json jsonb;
  reference_text text;
  title_text text;
  english_text text;
  hebrew_text text;
  transliteration_text text;
  transcript_text text;
  existing_sermon_text text;
  prepared_track_id uuid;
  existing_segment_count integer := 0;
  v_was_published boolean;
begin
  select * into lesson_row
  from public.hebrew_lessons
  where lesson_order = p_lesson_order
  order by updated_at desc
  limit 1;

  if not found then
    raise exception 'Hebrew lesson % was not found', p_lesson_order;
  end if;

  content_json := coalesce(lesson_row.content, '{}'::jsonb);
  if jsonb_typeof(content_json #> '{lesson,lesson}') = 'object' then
    root_json := content_json -> 'lesson';
    lesson_json := root_json -> 'lesson';
  else
    root_json := content_json;
    lesson_json := coalesce(content_json -> 'lesson', '{}'::jsonb);
  end if;

  transcript_text := nullif(trim(lesson_json ->> 'transcript'), '');

  if transcript_text is null then
    v_was_published := lesson_row.is_published;
    if not v_was_published then
      update public.hebrew_lessons
      set is_published = true,
          updated_at = now()
      where id = lesson_row.id;
    end if;

    prepared_track_id := public.prepare_hebrew_audio_track_from_lesson(p_lesson_order);

    if not v_was_published then
      update public.hebrew_lessons
      set is_published = false,
          updated_at = now()
      where id = lesson_row.id;
    end if;

    return prepared_track_id;
  end if;

  reference_text := coalesce(
    nullif(root_json ->> 'referenceRange', ''),
    nullif(content_json ->> 'referenceRange', ''),
    nullif(lesson_json ->> 'reference', ''),
    substring(lesson_row.title from 'Genesis [0-9]+:[0-9]+'),
    'Genesis 1:' || p_lesson_order::text
  );

  select * into verse_row
  from public.hebrew_verses
  where reference = reference_text
  limit 1;

  if not found then
    raise exception '% is missing from hebrew_verses', reference_text;
  end if;

  title_text := coalesce(
    nullif(lesson_json ->> 'sermon_title', ''),
    nullif(lesson_json ->> 'title', ''),
    lesson_row.title,
    reference_text || ' Hebrew Sermon'
  );
  english_text := coalesce(
    nullif(lesson_json ->> 'english_kjv', ''),
    nullif(lesson_json ->> 'english', ''),
    verse_row.english_text
  );
  hebrew_text := coalesce(nullif(lesson_json ->> 'hebrew', ''), verse_row.hebrew_text);
  transliteration_text := coalesce(nullif(lesson_json ->> 'transliteration', ''), '');

  select id into prepared_track_id
  from public.hebrew_audio_tracks
  where verse_reference = reference_text
  order by updated_at desc
  limit 1;

  if prepared_track_id is null then
    insert into public.hebrew_audio_tracks (
      verse_id, lesson_id, verse_reference, track_title, status, script_version,
      total_duration_seconds, is_published, published_at, updated_at
    ) values (
      verse_row.id, lesson_row.id, reference_text, lesson_row.title, 'ready_to_generate',
      'v4-full-sermon-audio-v1', null, false, null, now()
    ) returning id into prepared_track_id;
  else
    select
      count(*),
      regexp_replace(
        coalesce(
          string_agg(spoken_text, ' ' order by sort_order)
            filter (where segment_type like 'sermon-part-%'),
          ''
        ),
        '[[:space:]]+',
        ' ',
        'g'
      )
      into existing_segment_count, existing_sermon_text
    from public.hebrew_audio_segments
    where track_id = prepared_track_id;

    if existing_segment_count > 0
       and (select script_version from public.hebrew_audio_tracks where id = prepared_track_id) = 'v4-full-sermon-audio-v1'
       and trim(existing_sermon_text) = regexp_replace(trim(transcript_text), '[[:space:]]+', ' ', 'g') then
      update public.hebrew_audio_tracks
      set lesson_id = lesson_row.id,
          track_title = lesson_row.title,
          updated_at = now()
      where id = prepared_track_id;
      return prepared_track_id;
    end if;

    delete from public.hebrew_audio_segments where track_id = prepared_track_id;

    update public.hebrew_audio_tracks
    set verse_id = verse_row.id,
        lesson_id = lesson_row.id,
        track_title = lesson_row.title,
        status = 'ready_to_generate',
        script_version = 'v4-full-sermon-audio-v1',
        total_duration_seconds = null,
        is_published = false,
        published_at = null,
        updated_at = now()
    where id = prepared_track_id;
  end if;

  insert into public.hebrew_audio_segments (
    track_id, sort_order, segment_type, label, spoken_text, display_transcript,
    voice_profile, voice_instructions, speech_settings, status, updated_at
  )
  select
    prepared_track_id,
    chunk_order * 10,
    'sermon-part-' || chunk_order::text,
    case
      when chunk_order = 1 then 'Sermon Episode'
      else 'Sermon Episode, Part ' || chunk_order::text
    end,
    chunk_text,
    chunk_text,
    'cedar',
    'Speak as one continuous, warm, reverent, emotionally alive sermon. Keep the same voice, pace, and energy across every part. Use natural pauses, gentle humor, fifth-grade clarity, and sincere worship. Do not announce that this is a separate part.',
    '{"speed":0.98}'::jsonb,
    'pending',
    now()
  from public.split_hebrew_audio_text(transcript_text, 3600);

  insert into public.hebrew_audio_segments (
    track_id, sort_order, segment_type, label, spoken_text, display_transcript,
    voice_profile, voice_instructions, speech_settings, status, updated_at
  )
  select
    prepared_track_id,
    v.sort_order,
    v.segment_type,
    v.label,
    v.spoken_text,
    v.display_transcript,
    'cedar',
    v.voice_instructions,
    v.speech_settings,
    'pending',
    now()
  from (values
    (500, 'kjv', 'KJV Reading',
      concat_ws(' ', reference_text || ', King James Version.', english_text),
      english_text,
      'Read Scripture slowly, clearly, and reverently.',
      '{"speed":0.95}'::jsonb),
    (510, 'hebrew-natural', 'Hebrew Natural Reading',
      hebrew_text,
      concat_ws(' ', hebrew_text, transliteration_text),
      'Read the Hebrew naturally and carefully. Do not translate or add commentary.',
      '{"speed":0.92}'::jsonb),
    (520, 'hebrew-slow', 'Hebrew Slow Reading',
      hebrew_text,
      concat_ws(' ', hebrew_text, transliteration_text),
      'Read the Hebrew very slowly with clean pauses between phrases for a learner to follow.',
      '{"speed":0.72}'::jsonb),
    (530, 'repeat-after-me', 'Repeat After Me',
      concat_ws(
        ' ',
        'Repeat after me.',
        coalesce(nullif(transliteration_text, ''), hebrew_text),
        'Again.',
        coalesce(nullif(transliteration_text, ''), hebrew_text)
      ),
      concat_ws(' ', hebrew_text, transliteration_text),
      'Use short learner-friendly phrases with generous pauses. Pronounce Hebrew carefully.',
      '{"speed":0.78}'::jsonb),
    (540, 'final-hebrew', 'Final Hebrew Reading',
      concat_ws(' ', 'One final natural Hebrew reading.', hebrew_text),
      concat_ws(' ', hebrew_text, transliteration_text),
      'Say the introduction in English, then read only the Hebrew naturally and clearly.',
      '{"speed":0.9}'::jsonb)
  ) as v(
    sort_order,
    segment_type,
    label,
    spoken_text,
    display_transcript,
    voice_instructions,
    speech_settings
  )
  where nullif(trim(v.spoken_text), '') is not null;

  update public.hebrew_audio_tracks
  set lesson_id = lesson_row.id,
      track_title = lesson_row.title,
      status = 'ready_to_generate',
      script_version = 'v4-full-sermon-audio-v1',
      total_duration_seconds = null,
      is_published = false,
      published_at = null,
      updated_at = now()
  where id = prepared_track_id;

  return prepared_track_id;
end;
$function$;
