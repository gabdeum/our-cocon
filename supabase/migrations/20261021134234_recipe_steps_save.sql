-- Spec 016: the recipe form saves a recipe's whole step list at once, like its ingredients (015).
-- Rows keep their ids, take their position from their order, and rows left out are removed. Runs
-- as the caller, so RLS decides what they can read and write; the table's checks validate each
-- field. One call is one transaction: all of it saves, or none.

-- 032-later L23: at most 100 steps a recipe. Positions are unique per recipe, so 0–99 caps it.
alter table public.recipe_steps add constraint recipe_steps_position_max check (position < 100);

create function public.save_recipe_steps(p_recipe_id uuid, p_steps jsonb)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  fam uuid;
  ids uuid[];
  written integer;
begin
  if jsonb_typeof(p_steps) is distinct from 'array' or jsonb_array_length(p_steps) > 100 then
    raise exception 'steps must be an array of at most 100 items' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_steps) e where jsonb_typeof(e) <> 'object' or e ->> 'id' is null) then
    raise exception 'every step needs an id' using errcode = '22023';
  end if;

  select r.family_id into fam from public.recipes r where r.id = p_recipe_id and r.deleted_at is null;
  if fam is null then
    raise exception 'recipe not found' using errcode = 'P0002';
  end if;

  ids := array(select (e ->> 'id')::uuid from jsonb_array_elements(p_steps) e);
  if exists (select 1 from public.recipe_steps s where s.id = any(ids) and s.recipe_id <> p_recipe_id) then
    raise exception 'a step belongs to another recipe' using errcode = '22023';
  end if;

  delete from public.recipe_steps s where s.recipe_id = p_recipe_id and s.id <> all(ids);

  -- Positions are unique per recipe but checked at commit, so rows can swap here.
  insert into public.recipe_steps as t (id, family_id, recipe_id, position, name, body, timer_seconds, timer_label,
    temp_check_c, temp_check_text, tip, photo_path)
  select x.id, fam, p_recipe_id, (e.ord - 1)::integer, x.name, x.body, x.timer_seconds, x.timer_label,
    x.temp_check_c, x.temp_check_text, x.tip, x.photo_path
  from jsonb_array_elements(p_steps) with ordinality as e (value, ord)
  cross join lateral jsonb_to_record(e.value) as x (id uuid, name text, body text, timer_seconds integer, timer_label text,
    temp_check_c numeric, temp_check_text text, tip text, photo_path text)
  on conflict (id) do update set
    position = excluded.position, name = excluded.name, body = excluded.body, timer_seconds = excluded.timer_seconds,
    timer_label = excluded.timer_label, temp_check_c = excluded.temp_check_c, temp_check_text = excluded.temp_check_text,
    tip = excluded.tip, photo_path = excluded.photo_path
  where t.recipe_id = p_recipe_id;
  -- A row skipped by the conflict rule is an id this recipe can't use (another family's, say).
  get diagnostics written = row_count;
  if written <> jsonb_array_length(p_steps) then
    raise exception 'a step belongs to another recipe' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.save_recipe_steps(uuid, jsonb) from public, anon;
grant execute on function public.save_recipe_steps(uuid, jsonb) to authenticated;
