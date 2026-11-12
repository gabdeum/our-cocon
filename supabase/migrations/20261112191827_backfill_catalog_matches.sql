-- Spec 052 FR-003: link to catalog version 5 the recipe lines, grocery items and custom ingredients
-- that matched nothing before. The names are read in TypeScript (`parseIngredientText`), so the
-- backfill itself is scripts/backfill-catalog-matches.ts, which scripts/migrate.ts runs right after
-- this migration, in the same transaction (locally: `pnpm db:backfill`).
--
-- Here: the matcher (spec 031 FR-005) for any family, so the backfill uses the same rule as the app
-- instead of a copy. `match_ingredients` keeps its signature and answers for the caller's family only.

create function public._match_ingredients(fam uuid, queries jsonb)
returns table (
  idx integer, how text, catalog_key text, family_ingredient_id uuid, name text, plural text, aisle public.aisle,
  density_g_per_ml numeric, size_small_g numeric, size_medium_g numeric, size_large_g numeric,
  default_size public.size_word, noun_singular text, noun_plural text, whole_only boolean, diet text[]
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if jsonb_typeof(queries) is distinct from 'array' or jsonb_array_length(queries) > 100 then
    raise exception 'queries must be an array of at most 100 items' using errcode = '22023';
  end if;
  return query
  with q as (
    select (e.ord - 1)::integer as idx,
      regexp_replace(left(coalesce(e.value ->> 'full', ''), 80), '[^a-z0-9 ]', '', 'g') as full_text,
      regexp_replace(left(coalesce(e.value ->> 'core', ''), 80), '[^a-z0-9 ]', '', 'g') as core_text
    from jsonb_array_elements(queries) with ordinality as e (value, ord)
  ),
  known as (
    select n.name_norm, n.ingredient_key as key, null::uuid as fid from public.catalog_names n where n.lang = 'en'
    union all
    select f.name_norm, null, f.id from public.family_ingredients f
    where f.name_norm is not null and f.family_id = fam
  ),
  hit as (
    select q.idx, m.how, m.key, m.fid
    from q
    cross join lateral (
      select * from (
        select 'exact' as how, k.key, k.fid, 0 as rank, 1::real as sim from known k where k.name_norm = q.full_text
        union all
        select 'exact', k.key, k.fid, 1, 1::real from known k where k.name_norm = q.core_text
        union all
        select 'fuzzy', k.key, k.fid, 2, extensions.similarity(k.name_norm, q.core_text) from known k
        where q.core_text <> '' and extensions.similarity(k.name_norm, q.core_text) >= 0.6
      ) c
      order by c.rank, c.sim desc, c.key nulls last
      limit 1
    ) m
  )
  select q.idx, coalesce(h.how, 'none'), f.catalog_key, f.family_ingredient_id, f.name, f.plural,
    coalesce(f.aisle, 'other'::public.aisle), f.density_g_per_ml, f.size_small_g, f.size_medium_g, f.size_large_g,
    f.default_size, f.noun_singular, f.noun_plural, coalesce(f.whole_only, false), coalesce(f.diet, '{}')
  from q
  left join hit h on h.idx = q.idx
  left join public._ingredient_facts(fam) f
    on (h.key is not null and f.catalog_key = h.key) or (h.fid is not null and f.catalog_key is null and f.family_ingredient_id = h.fid)
  order by q.idx;
end;
$$;
-- Any family's names: for the database owner only (the backfill). People and assistants go through
-- match_ingredients, which can only pass their own family.
revoke execute on function public._match_ingredients(uuid, jsonb) from public, anon, authenticated;

-- Same answers as before for the signed-in person or assistant (grants are kept). Security definer
-- so it can call the one above; the family is always the caller's, never an argument.
create or replace function public.match_ingredients(queries jsonb)
returns table (
  idx integer, how text, catalog_key text, family_ingredient_id uuid, name text, plural text, aisle public.aisle,
  density_g_per_ml numeric, size_small_g numeric, size_medium_g numeric, size_large_g numeric,
  default_size public.size_word, noun_singular text, noun_plural text, whole_only boolean, diet text[]
)
language sql stable security definer set search_path = '' as $$
  select * from public._match_ingredients(public.my_family_id(), queries);
$$;
