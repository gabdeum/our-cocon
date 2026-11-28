-- Spec 078: the catalog in French and Spanish. Names, plurals and synonyms are matched in every
-- language; what the catalog shows (names, piece nouns, pack labels) is in the person's language,
-- the one the app keeps in their account (spec 076, `lang`), English otherwise. The data comes with
-- the next `*_catalog_data` migration (`pnpm catalog`).

alter table public.catalog_names drop constraint catalog_names_lang_check;
alter table public.catalog_names add constraint catalog_names_lang_check check (lang in ('en', 'fr', 'es'));

-- {"fr": {"singular": "gousse d’ail", "plural": "gousses d’ail"}, "es": …}; `noun_singular` stays English.
alter table public.catalog_ingredients add column noun_names jsonb not null default '{}' check (jsonb_typeof(noun_names) = 'object');
-- {"fr": "filet de 1 kg", "es": "malla de 1 kg"}; `label` stays English.
alter table public.catalog_packs add column labels jsonb not null default '{}' check (jsonb_typeof(labels) = 'object');

-- The caller's language, from their account; English for anyone else: the share endpoints, the
-- backfill, and AI assistants (MCP tool text stays English, constitution). Security definer: people
-- can't read auth.users.
create function public._lang() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select x.l from (select u.raw_user_meta_data ->> 'lang' as l from auth.users u where u.id = auth.uid()) x
    where x.l in ('en', 'fr', 'es') and auth.role() is distinct from 'cocon_assistant'), 'en');
$$;
revoke execute on function public._lang() from public, anon;
grant execute on function public._lang() to authenticated, cocon_assistant;

create or replace function public._load_catalog(data jsonb) returns void
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
    size_large_g, default_size, noun_singular, noun_plural, noun_names, whole_only, diet)
  select e.key, e.names, coalesce(e.synonyms, '{}'), e.aisle, e.density_g_per_ml, e.size_small_g, e.size_medium_g,
    e.size_large_g, e.default_size, e.noun_singular, e.noun_plural, coalesce(e.noun_names, '{}'), coalesce(e.whole_only, false), coalesce(e.diet, '{}')
  from jsonb_to_recordset(data -> 'ingredients') as e (key text, names jsonb, synonyms jsonb, aisle public.aisle,
    density_g_per_ml numeric, size_small_g numeric, size_medium_g numeric, size_large_g numeric, default_size public.size_word,
    noun_singular text, noun_plural text, noun_names jsonb, whole_only boolean, diet text[])
  on conflict (key) do update set
    names = excluded.names, synonyms = excluded.synonyms, aisle = excluded.aisle, density_g_per_ml = excluded.density_g_per_ml,
    size_small_g = excluded.size_small_g, size_medium_g = excluded.size_medium_g, size_large_g = excluded.size_large_g,
    default_size = excluded.default_size, noun_singular = excluded.noun_singular, noun_plural = excluded.noun_plural, noun_names = excluded.noun_names,
    whole_only = excluded.whole_only, diet = excluded.diet, updated_at = now();

  delete from public.catalog_packs;
  insert into public.catalog_packs (ingredient_key, profile, position, size, unit, label, labels, loose)
  select i ->> 'key', p.profile, p.position, p.size, p.unit, p.label, coalesce(p.labels, '{}'), p.loose
  from jsonb_array_elements(data -> 'ingredients') i,
    jsonb_to_recordset(coalesce(i -> 'packs', '[]')) as p (profile public.store_profile, position integer, size numeric,
      unit public.unit, label text, labels jsonb, loose boolean);

  delete from public.catalog_names;
  insert into public.catalog_names (lang, name_norm, ingredient_key, kind)
  select n.lang, n.name_norm, i ->> 'key', n.kind
  from jsonb_array_elements(data -> 'ingredients') i,
    jsonb_to_recordset(i -> 'match') as n (lang text, name_norm text, kind text);
end;
$$;

create or replace function public._ingredient_facts(fam uuid) returns table (
  catalog_key text, family_ingredient_id uuid, name text, plural text, aisle public.aisle,
  density_g_per_ml numeric, size_small_g numeric, size_medium_g numeric, size_large_g numeric,
  default_size public.size_word, noun_singular text, noun_plural text, whole_only boolean, diet text[])
language sql stable set search_path = '' as $$
  select
    c.key, f.id, coalesce(c.names -> l.lang, c.names -> 'en') ->> 'singular', coalesce(c.names -> l.lang, c.names -> 'en') ->> 'plural',
    coalesce(f.aisle, c.aisle), c.density_g_per_ml,
    coalesce(f.size_small_g, c.size_small_g), coalesce(f.size_medium_g, c.size_medium_g), coalesce(f.size_large_g, c.size_large_g),
    coalesce(c.default_size, case when f.size_medium_g is not null then 'medium'::public.size_word end),
    coalesce(c.noun_names -> l.lang ->> 'singular', c.noun_singular), coalesce(c.noun_names -> l.lang ->> 'plural', c.noun_plural), c.whole_only, c.diet
  from public.catalog_ingredients c
  cross join (select public._lang() as lang) l
  left join public.family_ingredients f on f.catalog_key = c.key and f.family_id = fam
  union all
  select
    null, f.id, f.custom_name, f.custom_name, coalesce(f.aisle, 'other'), null,
    f.size_small_g, f.size_medium_g, f.size_large_g,
    case when f.size_medium_g is not null then 'medium'::public.size_word end,
    null, null, false, '{}'
  from public.family_ingredients f
  where f.custom_name is not null and f.family_id = fam;
$$;

create or replace function public._match_ingredients(fam uuid, queries jsonb)
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
    select n.name_norm, n.ingredient_key as key, null::uuid as fid from public.catalog_names n
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

create or replace function public.suggest_ingredients(q text, lim integer default 8)
returns setof public.ingredient_facts
language sql stable security invoker set search_path = '' as $$
  with t as (select regexp_replace(left(coalesce(q, ''), 80), '[^a-z0-9 ]', '', 'g') as q),
  known as (
    select n.name_norm, n.ingredient_key as key, null::uuid as fid, n.kind from public.catalog_names n
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

-- The packs a family sees (spec 021), with the catalog's labels in the person's language.
create or replace function public._ingredient_packs(fam uuid) returns table (
  catalog_key text, family_ingredient_id uuid, profile public.store_profile, "position" integer,
  size numeric, unit public.unit, label text, loose boolean)
language sql stable set search_path = '' as $$
  select p.ingredient_key, null::uuid, p.profile, p.position, p.size, p.unit, coalesce(p.labels ->> l.lang, p.label), p.loose
  from public.catalog_packs p
  cross join (select public._lang() as lang) l
  where not exists (
    select 1 from public.family_ingredients f
    where f.catalog_key = p.ingredient_key and f.packs is not null and f.family_id = fam)
  union all
  select f.catalog_key, f.id, prof.profile, (e.ord - 1)::integer, (e.value ->> 'size')::numeric, (e.value ->> 'unit')::public.unit,
    e.value ->> 'label', (e.value ->> 'loose')::boolean
  from public.family_ingredients f
  cross join unnest(enum_range(null::public.store_profile)) as prof (profile)
  cross join jsonb_array_elements(f.packs) with ordinality as e (value, ord)
  where f.packs is not null and f.family_id = fam;
$$;
create or replace view public.ingredient_packs with (security_invoker = true) as
select * from public._ingredient_packs(public.my_family_id());
