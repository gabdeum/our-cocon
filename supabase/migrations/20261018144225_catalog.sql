-- Spec 031: the ingredient catalog. One read-only global catalog (loaded from
-- data/catalog/ingredients.json by the generated `*_catalog_data` migrations, `pnpm catalog`),
-- per-family corrections, and the matcher the app and MCP server share. Limits match
-- packages/schemas/catalog.ts.

create extension if not exists pg_trgm with schema extensions;

-- Where a family shops (spec 021 adds the family setting).
create type public.store_profile as enum ('us', 'eu');

-- Global facts, the same for every family. Not family tables: every signed-in person reads them,
-- nobody writes them (only migrations, through _load_catalog).
create table public.catalog_ingredients (
  key text primary key check (key ~ '^[a-z0-9_]{1,60}$'),
  -- Per language (FR-008): {"en": {"singular": "Onion", "plural": "Onions"}}.
  names jsonb not null check (jsonb_typeof(names -> 'en') = 'object'),
  synonyms jsonb not null default '{}' check (jsonb_typeof(synonyms) = 'object'),
  aisle public.aisle not null,
  density_g_per_ml numeric check (density_g_per_ml > 0 and density_g_per_ml <= 25),
  size_small_g numeric check (size_small_g > 0 and size_small_g < 100000),
  size_medium_g numeric check (size_medium_g > 0 and size_medium_g < 100000),
  size_large_g numeric check (size_large_g > 0 and size_large_g < 100000),
  default_size public.size_word,
  noun_singular text check (char_length(noun_singular) between 1 and 80),
  noun_plural text check (char_length(noun_plural) between 1 and 80),
  -- Rounded to whole pieces when scaling (eggs).
  whole_only boolean not null default false,
  diet text[] not null default '{}' check (diet <@ array['meat', 'fish', 'dairy', 'gluten']),
  updated_at timestamptz not null default now(),
  -- SC-002: anything with sizes has a medium one, and the default is one of them.
  check ((size_small_g is null and size_large_g is null) or size_medium_g is not null),
  check ((default_size is null) = (size_medium_g is null))
);

create table public.catalog_packs (
  ingredient_key text not null references public.catalog_ingredients (key) on delete cascade,
  profile public.store_profile not null,
  position integer not null check (position >= 0),
  size numeric not null check (size > 0 and size < 100000),
  unit public.unit not null,
  label text not null check (char_length(label) between 1 and 40),
  loose boolean not null,
  primary key (ingredient_key, profile, position)
);

-- Every name, plural and synonym, normalised by packages/schemas/ingredient-text.ts when the
-- data migration is generated, so matching here never re-implements normalising.
create table public.catalog_names (
  lang text not null check (lang in ('en')),
  name_norm text not null check (char_length(name_norm) between 1 and 80),
  ingredient_key text not null references public.catalog_ingredients (key) on delete cascade,
  kind text not null check (kind in ('name', 'plural', 'synonym')),
  primary key (lang, name_norm)
);
create index catalog_names_key on public.catalog_names (ingredient_key);
create index catalog_names_trgm on public.catalog_names using gin (name_norm extensions.gin_trgm_ops);

do $$
declare
  t text;
begin
  foreach t in array array['catalog_ingredients', 'catalog_packs', 'catalog_names'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy "signed-in people read the catalog" on public.%I for select to authenticated using (true)', t);
  end loop;
end;
$$;

-- Loads the whole catalog, as built by `pnpm catalog`. Keys are permanent: recipes and grocery
-- items point at them, so a key missing from the new data stops the migration (rename by adding a
-- synonym instead). Internal: migrations only.
create function public._load_catalog(data jsonb) returns void
language plpgsql set search_path = '' as $$
declare
  missing text;
begin
  select string_agg(c.key, ', ' order by c.key) into missing
  from public.catalog_ingredients c
  where not exists (select 1 from jsonb_array_elements(data -> 'ingredients') e where e ->> 'key' = c.key);
  if missing is not null then
    raise exception 'Catalog keys are permanent, but these are missing from the new data: %', missing;
  end if;

  insert into public.catalog_ingredients as c (key, names, synonyms, aisle, density_g_per_ml, size_small_g, size_medium_g,
    size_large_g, default_size, noun_singular, noun_plural, whole_only, diet)
  select e.key, e.names, coalesce(e.synonyms, '{}'), e.aisle, e.density_g_per_ml, e.size_small_g, e.size_medium_g,
    e.size_large_g, e.default_size, e.noun_singular, e.noun_plural, coalesce(e.whole_only, false), coalesce(e.diet, '{}')
  from jsonb_to_recordset(data -> 'ingredients') as e (key text, names jsonb, synonyms jsonb, aisle public.aisle,
    density_g_per_ml numeric, size_small_g numeric, size_medium_g numeric, size_large_g numeric, default_size public.size_word,
    noun_singular text, noun_plural text, whole_only boolean, diet text[])
  on conflict (key) do update set
    names = excluded.names, synonyms = excluded.synonyms, aisle = excluded.aisle, density_g_per_ml = excluded.density_g_per_ml,
    size_small_g = excluded.size_small_g, size_medium_g = excluded.size_medium_g, size_large_g = excluded.size_large_g,
    default_size = excluded.default_size, noun_singular = excluded.noun_singular, noun_plural = excluded.noun_plural,
    whole_only = excluded.whole_only, diet = excluded.diet, updated_at = now();

  delete from public.catalog_packs;
  insert into public.catalog_packs (ingredient_key, profile, position, size, unit, label, loose)
  select i ->> 'key', p.profile, p.position, p.size, p.unit, p.label, p.loose
  from jsonb_array_elements(data -> 'ingredients') i,
    jsonb_to_recordset(coalesce(i -> 'packs', '[]')) as p (profile public.store_profile, position integer, size numeric,
      unit public.unit, label text, loose boolean);

  delete from public.catalog_names;
  insert into public.catalog_names (lang, name_norm, ingredient_key, kind)
  select n.lang, n.name_norm, i ->> 'key', n.kind
  from jsonb_array_elements(data -> 'ingredients') i,
    jsonb_to_recordset(i -> 'match') as n (lang text, name_norm text, kind text);
end;
$$;

-- Recipes and grocery items name catalog entries by key (spec 004 left these for 031).
alter table public.recipe_ingredients
  add foreign key (catalog_key) references public.catalog_ingredients (key);
alter table public.grocery_items
  add foreign key (catalog_key) references public.catalog_ingredients (key);

-- A family's packs, shaped like PackSize in packages/schemas/catalog.ts.
create function public._valid_packs(p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'array' and jsonb_array_length(p) <= 20 and not exists (
    select 1 from jsonb_array_elements(p) e
    where case
      when jsonb_typeof(e) <> 'object' or (select count(*) from jsonb_object_keys(e)) <> 4 then true
      when jsonb_typeof(e -> 'size') <> 'number' or jsonb_typeof(e -> 'label') <> 'string'
        or jsonb_typeof(e -> 'loose') <> 'boolean' or jsonb_typeof(e -> 'unit') <> 'string' then true
      else not ((e ->> 'size')::numeric > 0 and (e ->> 'size')::numeric < 100000
        and char_length(e ->> 'label') between 1 and 40
        and (e ->> 'unit') = any (enum_range(null::public.unit)::text[]))
    end);
$$;
-- The packs check runs as the person writing, so they need it. It reads nothing.
grant execute on function public._valid_packs(jsonb) to authenticated;

-- FR-004: what a family corrects for itself (aisle, piece weights, packs), or an ingredient the
-- catalog doesn't have. Exactly one of catalog_key or custom_name. name_norm is the custom name
-- normalised by packages/schemas (familyIngredientRow), so the matcher finds it next time.
create table public.family_ingredients (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  catalog_key text references public.catalog_ingredients (key),
  custom_name text check (char_length(custom_name) between 1 and 80 and custom_name = btrim(custom_name)),
  name_norm text check (name_norm ~ '^[a-z0-9]+( [a-z0-9]+)*$' and char_length(name_norm) <= 80),
  aisle public.aisle,
  size_small_g numeric check (size_small_g > 0 and size_small_g < 100000),
  size_medium_g numeric check (size_medium_g > 0 and size_medium_g < 100000),
  size_large_g numeric check (size_large_g > 0 and size_large_g < 100000),
  -- Replaces the catalog's packs for this family, whatever the store profile.
  packs jsonb check (packs is null or public._valid_packs(packs)),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  source public.write_source not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((catalog_key is null) <> (custom_name is null)),
  check ((custom_name is null) = (name_norm is null)),
  unique (family_id, catalog_key),
  unique (family_id, name_norm)
);
select public._family_table('public.family_ingredients', live => false);

-- The one place the rule lives (spec 020 FR-001): the family's correction, then the catalog,
-- then Other. One row per catalog entry and per custom ingredient of the caller's family.
create view public.ingredient_facts with (security_invoker = true) as
select
  c.key as catalog_key,
  f.id as family_ingredient_id,
  c.names -> 'en' ->> 'singular' as name,
  c.names -> 'en' ->> 'plural' as plural,
  coalesce(f.aisle, c.aisle) as aisle,
  c.density_g_per_ml,
  coalesce(f.size_small_g, c.size_small_g) as size_small_g,
  coalesce(f.size_medium_g, c.size_medium_g) as size_medium_g,
  coalesce(f.size_large_g, c.size_large_g) as size_large_g,
  coalesce(c.default_size, case when f.size_medium_g is not null then 'medium'::public.size_word end) as default_size,
  c.noun_singular,
  c.noun_plural,
  c.whole_only,
  c.diet
from public.catalog_ingredients c
left join public.family_ingredients f on f.catalog_key = c.key and f.family_id = public.my_family_id()
union all
select
  null, f.id, f.custom_name, f.custom_name, coalesce(f.aisle, 'other'), null,
  f.size_small_g, f.size_medium_g, f.size_large_g,
  case when f.size_medium_g is not null then 'medium'::public.size_word end,
  null, null, false, '{}'
from public.family_ingredients f
where f.custom_name is not null and f.family_id = public.my_family_id();

-- Packs to pick from (spec 021): the family's own packs replace the catalog's.
create view public.ingredient_packs with (security_invoker = true) as
select p.ingredient_key as catalog_key, null::uuid as family_ingredient_id, p.profile, p.position, p.size, p.unit, p.label, p.loose
from public.catalog_packs p
where not exists (
  select 1 from public.family_ingredients f
  where f.catalog_key = p.ingredient_key and f.packs is not null and f.family_id = public.my_family_id())
union all
select f.catalog_key, f.id, prof.profile, (e.ord - 1)::integer, (e.value ->> 'size')::numeric, (e.value ->> 'unit')::public.unit,
  e.value ->> 'label', (e.value ->> 'loose')::boolean
from public.family_ingredients f
cross join unnest(enum_range(null::public.store_profile)) as prof (profile)
cross join jsonb_array_elements(f.packs) with ordinality as e (value, ord)
where f.packs is not null and f.family_id = public.my_family_id();

revoke all on public.ingredient_facts, public.ingredient_packs from anon, authenticated;
grant select on public.ingredient_facts, public.ingredient_packs to authenticated;

-- FR-005: matches ingredient lines to the catalog and the family's own ingredients. Each query is
-- {full, core} from parseIngredientText (packages/schemas): exact on full, exact on core, then
-- pg_trgm similarity ≥ 0.6 on core. One row per query, in order; unmatched rows have how 'none'
-- and aisle Other. Reads only; runs as the caller, so RLS applies.
create function public.match_ingredients(queries jsonb)
returns table (
  idx integer, how text, catalog_key text, family_ingredient_id uuid, name text, plural text, aisle public.aisle,
  density_g_per_ml numeric, size_small_g numeric, size_medium_g numeric, size_large_g numeric,
  default_size public.size_word, noun_singular text, noun_plural text, whole_only boolean, diet text[]
)
language plpgsql stable security invoker set search_path = '' as $$
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
    where f.name_norm is not null and f.family_id = public.my_family_id()
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
  left join public.ingredient_facts f
    on (h.key is not null and f.catalog_key = h.key) or (h.fid is not null and f.catalog_key is null and f.family_ingredient_id = h.fid)
  order by q.idx;
end;
$$;

-- Typeahead for the ingredient field (spec 015): `q` is normaliseName(what was typed). Exact name
-- first, then names starting with it, then a word starting with it, then close spellings.
create function public.suggest_ingredients(q text, lim integer default 8)
returns setof public.ingredient_facts
language sql stable security invoker set search_path = '' as $$
  with t as (select regexp_replace(left(coalesce(q, ''), 80), '[^a-z0-9 ]', '', 'g') as q),
  known as (
    select n.name_norm, n.ingredient_key as key, null::uuid as fid, n.kind from public.catalog_names n where n.lang = 'en'
    union all
    select f.name_norm, null, f.id, 'name' from public.family_ingredients f
    where f.name_norm is not null and f.family_id = public.my_family_id()
  ),
  scored as (
    select k.key, k.fid,
      min(case
        when k.name_norm = t.q then 0
        when k.name_norm like t.q || '%' then 1
        when k.name_norm like '% ' || t.q || '%' then 2
        else 3 end) as rank,
      max(extensions.similarity(k.name_norm, t.q)) as sim,
      min(case when k.kind = 'name' then 0 else 1 end) as by_name
    from known k, t
    where t.q <> '' and (k.name_norm like t.q || '%' or k.name_norm like '% ' || t.q || '%'
      or extensions.similarity(k.name_norm, t.q) >= 0.3)
    group by k.key, k.fid
  )
  select f.* from scored s
  join public.ingredient_facts f
    on (s.key is not null and f.catalog_key = s.key) or (s.fid is not null and f.catalog_key is null and f.family_ingredient_id = s.fid)
  order by s.rank, s.by_name, s.sim desc, char_length(f.name), f.name
  limit least(greatest(coalesce(lim, 8), 1), 20);
$$;

grant execute on function public.match_ingredients(jsonb) to authenticated;
grant execute on function public.suggest_ingredients(text, integer) to authenticated;
