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
  candidate text;
  next_chunk text;
  last_space_from_end integer;
  split_length integer;
  chunk_number integer := 1;
  safe_limit integer := greatest(500, least(coalesce(p_max_chars, 3600), 3900));
begin
  while length(remaining_text) > safe_limit loop
    candidate := left(remaining_text, safe_limit + 1);
    last_space_from_end := strpos(reverse(candidate), ' ');

    if last_space_from_end > 0 then
      split_length := length(candidate) - last_space_from_end;
    else
      split_length := safe_limit;
    end if;

    if split_length < 1 then
      split_length := safe_limit;
    end if;

    next_chunk := trim(left(remaining_text, split_length));
    if next_chunk = '' then
      next_chunk := left(remaining_text, safe_limit);
      split_length := length(next_chunk);
    end if;

    chunk_order := chunk_number;
    chunk_text := next_chunk;
    return next;

    remaining_text := ltrim(substr(remaining_text, split_length + 1));
    chunk_number := chunk_number + 1;
  end loop;

  if nullif(trim(remaining_text), '') is not null then
    chunk_order := chunk_number;
    chunk_text := trim(remaining_text);
    return next;
  end if;
end;
$function$;
