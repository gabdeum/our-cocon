-- Spec 017: the recipe form saves a recipe's whole variant list at once, like its steps (016).
-- Rows keep their ids, take their position from their order, and rows left out are removed. Runs
-- as the caller, so RLS decides what they can read and write. One call is one transaction: all of
-- it saves, or none. The full shape of each change is checked by the shared Zod schema
-- (VariantChange in packages/schemas/recipes.ts) in the app and the MCP server; the database keeps
-- the outline: at most 50 changes and 256 KB, each change an object of a known type.

create function public._variant_changes_ok(changes jsonb)
returns boolean
language sql immutable set search_path = '' as $$
  -- CASE, so a non-array is refused (false) rather than raising in jsonb_array_length.
  select case when jsonb_typeof(changes) is distinct from 'array' then false else
    jsonb_array_length(changes) <= 50
    -- Every family member downloads it on each recipe open: 256 KB is far more than 50 changes need.
    and pg_column_size(changes) <= 262144
    and not exists (
      select 1 from jsonb_array_elements(changes) c
      where jsonb_typeof(c) <> 'object'
        or coalesce(c ->> 'type', '') not in
          ('swap_ingredient', 'add_ingredient', 'remove_ingredient', 'add_step', 'change_step', 'remove_step')
    )
  end;
$$;

-- The check runs as whoever writes the row, so members (and the MCP server, as them) need it.
revoke execute on function public._variant_changes_ok(jsonb) from public, anon;
grant execute on function public._variant_changes_ok(jsonb) to authenticated, service_role;

alter table public.recipe_variants drop constraint recipe_variants_changes_check;
alter table public.recipe_variants add constraint recipe_variants_changes_ok check (public._variant_changes_ok(changes));

-- At most 20 variants a recipe (MAX_VARIANTS). Positions are unique per recipe, so 0–19 caps it.
alter table public.recipe_variants add constraint recipe_variants_position_max check (position < 20);

create function public.save_recipe_variants(p_recipe_id uuid, p_variants jsonb)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  fam uuid;
  ids uuid[];
  written integer;
begin
  if jsonb_typeof(p_variants) is distinct from 'array' or jsonb_array_length(p_variants) > 20 then
    raise exception 'variants must be an array of at most 20 items' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_variants) e where jsonb_typeof(e) <> 'object' or e ->> 'id' is null) then
    raise exception 'every variant needs an id' using errcode = '22023';
  end if;

  select r.family_id into fam from public.recipes r where r.id = p_recipe_id and r.deleted_at is null;
  if fam is null then
    raise exception 'recipe not found' using errcode = 'P0002';
  end if;

  ids := array(select (e ->> 'id')::uuid from jsonb_array_elements(p_variants) e);
  if exists (select 1 from public.recipe_variants v where v.id = any(ids) and v.recipe_id <> p_recipe_id) then
    raise exception 'a variant belongs to another recipe' using errcode = '22023';
  end if;

  delete from public.recipe_variants v where v.recipe_id = p_recipe_id and v.id <> all(ids);

  -- Positions are unique per recipe but checked at commit, so rows can swap here.
  insert into public.recipe_variants as t (id, family_id, recipe_id, position, name, kind, changes)
  select x.id, fam, p_recipe_id, (e.ord - 1)::integer, x.name, x.kind, coalesce(x.changes, '[]')
  from jsonb_array_elements(p_variants) with ordinality as e (value, ord)
  cross join lateral jsonb_to_record(e.value) as x (id uuid, name text, kind public.variant_kind, changes jsonb)
  on conflict (id) do update set
    position = excluded.position, name = excluded.name, kind = excluded.kind, changes = excluded.changes
  where t.recipe_id = p_recipe_id;
  -- A row skipped by the conflict rule is an id this recipe can't use (another family's, say).
  get diagnostics written = row_count;
  if written <> jsonb_array_length(p_variants) then
    raise exception 'a variant belongs to another recipe' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.save_recipe_variants(uuid, jsonb) from public, anon;
grant execute on function public.save_recipe_variants(uuid, jsonb) to authenticated;
