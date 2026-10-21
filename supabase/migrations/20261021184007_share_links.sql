-- Spec 019: a recipe shared as a view-only link `/r/<token>`. One active link per recipe (FR-001);
-- stopping it ends it for good, and sharing again makes a new one. Links never expire (FR-006).

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  recipe_id uuid not null,
  -- 32 random bytes, base64url (256 bits). Kept as is, not hashed like invites: the share sheet
  -- shows the same link again. Only the family can read it, and it opens only this recipe.
  token text not null unique check (token ~ '^[A-Za-z0-9_-]{43}$'),
  include_variants boolean not null default true,
  include_tips boolean not null default true,
  stopped_at timestamptz,
  stopped_by uuid references auth.users (id) on delete set null,
  -- What stopped it: 'app' or the assistant's name (constitution VI).
  stopped_source public.write_source,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  source public.write_source not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A deleted-for-good recipe takes its links with it.
  foreign key (recipe_id, family_id) references public.recipes (id, family_id) on delete cascade
);
create unique index share_links_one_active on public.share_links (recipe_id) where stopped_at is null;

select public._family_table('public.share_links', live => false);
-- Stopping is the only way to end a link, so it's always recorded; purging a recipe still removes
-- its links (on delete cascade).
drop policy "members remove their family's rows" on public.share_links;
revoke delete on public.share_links from authenticated;

-- The database makes the token, so nobody can pick an easy one, and a link only ever goes from
-- shared to stopped. Members can't share a deleted recipe.
create function public._stamp_share_link() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      if exists (select 1 from public.recipes r where r.id = new.recipe_id and r.deleted_at is not null) then
        raise exception 'recipe_deleted' using errcode = 'P0001';
      end if;
      new.token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
      new.stopped_at := null;
      new.stopped_by := null;
      new.stopped_source := null;
    end if;
    return new;
  end if;
  new.token := old.token;
  new.recipe_id := old.recipe_id;
  new.stopped_source := old.stopped_source;
  if old.stopped_at is not null then
    raise exception 'link_stopped' using errcode = 'P0001';
  end if;
  if new.stopped_at is not null then
    new.stopped_at := now();
    new.stopped_by := auth.uid();
    new.stopped_source := public._request_source();
  end if;
  return new;
end;
$$;
create trigger share_links_rules before insert or update on public.share_links
  for each row execute function public._stamp_share_link();

-- The sheet's link (FR-001): the recipe's active link, or a new one. `created` tells the app to
-- send `share_link_created`. Two members opening the sheet at once get the same link.
create function public.share_recipe(p_recipe_id uuid) returns table (token text, include_variants boolean, include_tips boolean, created_at timestamptz, created boolean)
language plpgsql security invoker set search_path = '' as $$
declare
  link public.share_links;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  select * into link from public.share_links s where s.recipe_id = p_recipe_id and s.stopped_at is null;
  if link.id is not null then
    return query select link.token, link.include_variants, link.include_tips, link.created_at, false;
    return;
  end if;
  if not exists (select 1 from public.recipes r where r.id = p_recipe_id) then
    raise exception 'recipe_not_found' using errcode = 'P0001';
  end if;
  begin
    insert into public.share_links (recipe_id, family_id, token) values (p_recipe_id, public.my_family_id(), repeat('x', 43))
      returning * into link;
  exception when unique_violation then
    select * into link from public.share_links s where s.recipe_id = p_recipe_id and s.stopped_at is null;
    return query select link.token, link.include_variants, link.include_tips, link.created_at, false;
    return;
  end;
  return query select link.token, link.include_variants, link.include_tips, link.created_at, true;
end;
$$;

-- The catalog facts with one family's corrections: what `ingredient_facts` shows a member, and
-- what a shared page shows for that family's recipe. The rule lives here once (spec 020 FR-001).
create function public._ingredient_facts(fam uuid) returns table (
  catalog_key text, family_ingredient_id uuid, name text, plural text, aisle public.aisle,
  density_g_per_ml numeric, size_small_g numeric, size_medium_g numeric, size_large_g numeric,
  default_size public.size_word, noun_singular text, noun_plural text, whole_only boolean, diet text[])
language sql stable set search_path = '' as $$
  select
    c.key, f.id, c.names -> 'en' ->> 'singular', c.names -> 'en' ->> 'plural',
    coalesce(f.aisle, c.aisle), c.density_g_per_ml,
    coalesce(f.size_small_g, c.size_small_g), coalesce(f.size_medium_g, c.size_medium_g), coalesce(f.size_large_g, c.size_large_g),
    coalesce(c.default_size, case when f.size_medium_g is not null then 'medium'::public.size_word end),
    c.noun_singular, c.noun_plural, c.whole_only, c.diet
  from public.catalog_ingredients c
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

create or replace view public.ingredient_facts with (security_invoker = true) as
select * from public._ingredient_facts(public.my_family_id());
-- Security invoker: RLS on family_ingredients keeps another family's corrections out.
revoke execute on function public._ingredient_facts(uuid) from public, anon;
grant execute on function public._ingredient_facts(uuid) to authenticated;

-- What a shared page shows (FR-002), for the share endpoint only (service role). Null for a
-- token that's unknown, stopped, or whose recipe is deleted (032-later L38). `recipe` holds only
-- the shared fields: no member ids, and the family and recipe ids only inside photo paths (a
-- photo's storage path, which its signed link carries anyway). `photo_prefix` stays on the server:
-- the endpoint signs only photos under it (032-later L26).
create function public.shared_recipe(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  link public.share_links;
  r public.recipes;
  keys text[];
  steps jsonb;
  variants jsonb;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then
    return null;
  end if;
  select * into link from public.share_links s where s.token = p_token and s.stopped_at is null;
  if link.id is null then
    return null;
  end if;
  select * into r from public.recipes x where x.id = link.recipe_id and x.deleted_at is null;
  if r.id is null then
    return null;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', s.name, 'body', s.body, 'timer_seconds', s.timer_seconds, 'timer_label', s.timer_label,
      'temp_check_c', s.temp_check_c, 'temp_check_text', s.temp_check_text,
      'tip', case when link.include_tips then s.tip end, 'photo_path', s.photo_path) order by s.position), '[]')
    into steps from public.recipe_steps s where s.recipe_id = r.id;

  -- Without tips, a variant's added steps lose theirs too.
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', v.id, 'name', v.name, 'kind', v.kind,
      'changes', case when link.include_tips then v.changes else (
        select coalesce(jsonb_agg(case when c ->> 'type' = 'add_step' then jsonb_set(c, '{step}', (c -> 'step') - 'tip') else c end order by o), '[]')
        from jsonb_array_elements(v.changes) with ordinality as e (c, o)) end) order by v.position), '[]')
    into variants from public.recipe_variants v where v.recipe_id = r.id and link.include_variants;

  select array_agg(distinct k) into keys from (
    select i.catalog_key as k from public.recipe_ingredients i where i.recipe_id = r.id and i.catalog_key is not null
    union all
    select coalesce(w ->> 'catalog_key', c -> 'ingredient' ->> 'catalog_key')
    from jsonb_array_elements(variants) v,
      jsonb_array_elements(v -> 'changes') c
      left join lateral jsonb_array_elements(case when c ->> 'type' = 'swap_ingredient' then c -> 'with' else '[]' end) w on true
  ) found where k is not null;

  return jsonb_build_object(
    'photo_prefix', r.family_id || '/' || r.id || '/',
    'recipe', jsonb_build_object(
      'name', r.name,
      'description', r.description,
      'serves', r.serves,
      'total_minutes', r.total_minutes,
      'prep_minutes', r.prep_minutes,
      'cuisine', r.cuisine,
      'best_months', to_jsonb(r.best_months),
      'photo_path', r.photo_path,
      'shared_by', (select m.display_name from public.members m where m.user_id = link.created_by and m.family_id = r.family_id),
      'ingredients', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', i.id, 'name', i.name, 'catalog_key', i.catalog_key, 'quantity', i.quantity, 'unit', i.unit,
          'size_word', i.size_word, 'weight_per_piece_g', i.weight_per_piece_g,
          'piece_noun_singular', i.piece_noun_singular, 'piece_noun_plural', i.piece_noun_plural,
          'prep_note', i.prep_note) order by i.position), '[]')
        from public.recipe_ingredients i where i.recipe_id = r.id),
      'steps', steps,
      'variants', variants,
      'facts', (select coalesce(jsonb_object_agg(f.catalog_key, jsonb_build_object(
          'name', f.name, 'plural', f.plural, 'density_g_per_ml', f.density_g_per_ml,
          'size_small_g', f.size_small_g, 'size_medium_g', f.size_medium_g, 'size_large_g', f.size_large_g,
          'default_size', f.default_size, 'noun_singular', f.noun_singular, 'noun_plural', f.noun_plural,
          'whole_only', f.whole_only)), '{}')
        from public._ingredient_facts(r.family_id) f where f.catalog_key = any (coalesce(keys, '{}')))
    )
  );
end;
$$;

grant execute on function public.share_recipe(uuid) to authenticated;
revoke execute on function public.shared_recipe(text) from public, anon, authenticated;
grant execute on function public.shared_recipe(text) to service_role;
