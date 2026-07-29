-- Harden the V4 atomic release function and normalize research context payloads.
-- Additive and idempotent.

alter function public.publish_hebrew_episode_revision(uuid, text, text)
  set search_path = public, extensions;

create or replace function public.normalize_hebrew_research_literary_context()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_summary text;
begin
  if new.literary_context is null then
    new.literary_context := '{}'::jsonb;
    return new;
  end if;

  if jsonb_typeof(new.literary_context) = 'string' then
    new.literary_context := jsonb_build_object(
      'summary', new.literary_context #>> '{}'
    );
    return new;
  end if;

  -- Older V4 writers spread a plain string into numeric character keys.
  -- Reassemble that text while preserving the separately stored narrative map.
  if jsonb_typeof(new.literary_context) = 'object'
     and new.literary_context ? '0' then
    select string_agg(value #>> '{}', '' order by key::integer)
      into v_summary
    from jsonb_each(new.literary_context)
    where key ~ '^[0-9]+$';

    new.literary_context := jsonb_strip_nulls(jsonb_build_object(
      'summary', nullif(trim(v_summary), ''),
      'narrative_map', new.literary_context->'narrative_map'
    ));
  end if;

  return new;
end;
$$;

drop trigger if exists normalize_hebrew_research_literary_context
  on public.hebrew_research_dossiers;

create trigger normalize_hebrew_research_literary_context
before insert or update of literary_context
on public.hebrew_research_dossiers
for each row
execute function public.normalize_hebrew_research_literary_context();

with repaired as (
  select
    id,
    jsonb_strip_nulls(jsonb_build_object(
      'summary', nullif(trim((
        select string_agg(value #>> '{}', '' order by key::integer)
        from jsonb_each(d.literary_context)
        where key ~ '^[0-9]+$'
      )), ''),
      'narrative_map', d.literary_context->'narrative_map'
    )) as normalized_context
  from public.hebrew_research_dossiers d
  where jsonb_typeof(d.literary_context) = 'object'
    and d.literary_context ? '0'
)
update public.hebrew_research_dossiers d
set literary_context = repaired.normalized_context,
    updated_at = now()
from repaired
where d.id = repaired.id;
