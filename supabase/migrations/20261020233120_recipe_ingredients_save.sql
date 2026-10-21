-- Spec 015: the recipe form saves a recipe's whole ingredient list at once. Rows keep their ids,
-- take their position from their order, and rows left out are removed; a removed ingredient's
-- `{ing:<id>}` tokens are taken out of the recipe's steps ("We'll take it out of that step too",
-- OC-EditIngredients). Runs as the caller, so RLS decides what they can read and write; the
-- table's checks validate each field. One call is one transaction: all of it saves, or none.
create function public.save_recipe_ingredients(p_recipe_id uuid, p_ingredients jsonb)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  fam uuid;
  ids uuid[];
  gone uuid[];
  tokens text;
  written integer;
begin
  if jsonb_typeof(p_ingredients) is distinct from 'array' or jsonb_array_length(p_ingredients) > 100 then
    raise exception 'ingredients must be an array of at most 100 items' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_ingredients) e where jsonb_typeof(e) <> 'object' or e ->> 'id' is null) then
    raise exception 'every ingredient needs an id' using errcode = '22023';
  end if;

  select r.family_id into fam from public.recipes r where r.id = p_recipe_id and r.deleted_at is null;
  if fam is null then
    raise exception 'recipe not found' using errcode = 'P0002';
  end if;

  ids := array(select (e ->> 'id')::uuid from jsonb_array_elements(p_ingredients) e);
  if exists (select 1 from public.recipe_ingredients i where i.id = any(ids) and i.recipe_id <> p_recipe_id) then
    raise exception 'an ingredient belongs to another recipe' using errcode = '22023';
  end if;

  gone := array(select i.id from public.recipe_ingredients i where i.recipe_id = p_recipe_id and i.id <> all(ids));
  delete from public.recipe_ingredients i where i.recipe_id = p_recipe_id and i.id = any(gone);

  -- Positions are unique per recipe but checked at commit, so rows can swap here.
  insert into public.recipe_ingredients as t (id, family_id, recipe_id, position, name, catalog_key, quantity, unit,
    size_word, weight_per_piece_g, piece_noun_singular, piece_noun_plural, prep_note)
  select x.id, fam, p_recipe_id, (e.ord - 1)::integer, x.name, x.catalog_key, x.quantity, x.unit,
    x.size_word, x.weight_per_piece_g, x.piece_noun_singular, x.piece_noun_plural, x.prep_note
  from jsonb_array_elements(p_ingredients) with ordinality as e (value, ord)
  cross join lateral jsonb_to_record(e.value) as x (id uuid, name text, catalog_key text, quantity numeric, unit public.unit,
    size_word public.size_word, weight_per_piece_g numeric, piece_noun_singular text, piece_noun_plural text, prep_note text)
  on conflict (id) do update set
    position = excluded.position, name = excluded.name, catalog_key = excluded.catalog_key, quantity = excluded.quantity,
    unit = excluded.unit, size_word = excluded.size_word, weight_per_piece_g = excluded.weight_per_piece_g,
    piece_noun_singular = excluded.piece_noun_singular, piece_noun_plural = excluded.piece_noun_plural,
    prep_note = excluded.prep_note
  where t.recipe_id = p_recipe_id;
  -- A row skipped by the conflict rule is an id this recipe can't use (another family's, say).
  get diagnostics written = row_count;
  if written <> jsonb_array_length(p_ingredients) then
    raise exception 'an ingredient belongs to another recipe' using errcode = '22023';
  end if;

  if cardinality(gone) > 0 then
    -- Ids are uuids (hex and dashes), so they are safe inside the pattern.
    tokens := '\{ing:(' || array_to_string(gone, '|') || ')\}';
    update public.recipe_steps s set body = c.body
    from (
      select s2.id, btrim(regexp_replace(regexp_replace(regexp_replace(s2.body, tokens, '', 'g'), '[ \t]{2,}', ' ', 'g'), ' ([.,;:!?])', '\1', 'g')) as body
      from public.recipe_steps s2
      where s2.recipe_id = p_recipe_id and s2.body ~ tokens
    ) c
    -- A step that was only the ingredient keeps its text (it shows as missing until it's edited).
    where s.id = c.id and c.body <> '';
  end if;
end;
$$;

grant execute on function public.save_recipe_ingredients(uuid, jsonb) to authenticated;
