-- Spec 072: the family's grocery list shared by link, `/g/<token>`, for a while. One active link
-- per family (FR-001), with an optional end (FR-002) and "Let people edit it". Guests read and
-- write only through the share endpoint (service role, FR-003), and every change to the list or the
-- link pings a public topic named after the token, so their page refetches (FR-006).

create table public.grocery_share_links (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  -- 32 random bytes, base64url (256 bits), as spec 019's: the sheet shows the same link again.
  token text not null unique check (token ~ '^[A-Za-z0-9_-]{43}$'),
  -- The "How long" pill it was set with; the end itself is `expires_at`, null for "Until I stop".
  duration text not null default 'today' check (duration in ('1h', 'today', 'week', 'none')),
  expires_at timestamptz,
  can_edit boolean not null default true,
  stopped_at timestamptz,
  stopped_by uuid references auth.users (id) on delete set null,
  stopped_source public.write_source,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  source public.write_source not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((duration = 'none') = (expires_at is null))
);
create unique index grocery_share_links_one_active on public.grocery_share_links (family_id) where stopped_at is null;

select public._family_table('public.grocery_share_links', live => false);
-- As spec 019: stopping is the only way to end a link, so it's always recorded.
drop policy "members remove their family's rows" on public.grocery_share_links;
revoke delete on public.grocery_share_links from authenticated;

-- The database makes the token; a link only goes from shared to stopped; an end is in the next
-- 8 days (FR-002: at most "This week" from a Monday morning, with room for the device's clock).
create function public._stamp_grocery_share_link() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
      new.stopped_at := null;
      new.stopped_by := null;
      new.stopped_source := null;
    end if;
  else
    new.token := old.token;
    new.stopped_source := old.stopped_source;
    if old.stopped_at is not null then
      raise exception 'link_stopped' using errcode = 'P0001';
    end if;
    if new.stopped_at is not null then
      new.stopped_at := now();
      new.stopped_by := auth.uid();
      new.stopped_source := public._request_source();
      -- Stopping an ended link keeps its end as it was.
      return new;
    end if;
  end if;
  if new.expires_at is not null and (tg_op = 'INSERT' or new.expires_at is distinct from old.expires_at)
    and (new.expires_at <= now() or new.expires_at > now() + interval '8 days') then
    raise exception 'bad_expiry' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger grocery_share_links_rules before insert or update on public.grocery_share_links
  for each row execute function public._stamp_grocery_share_link();

-- "Create link": the family's live link, or a new one with these settings. A link whose time has
-- passed is stopped first, so a new one can be made. `created` tells the app to send
-- `grocery_share_created`; two members creating at once get the same link.
create function public.share_groceries(p_duration text, p_expires_at timestamptz, p_can_edit boolean)
returns table (token text, duration text, expires_at timestamptz, can_edit boolean, created_at timestamptz, created boolean)
language plpgsql security invoker set search_path = '' as $$
declare
  link public.grocery_share_links;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  select * into link from public.grocery_share_links s where s.stopped_at is null;
  if link.id is not null and (link.expires_at is null or link.expires_at > now()) then
    return query select link.token, link.duration, link.expires_at, link.can_edit, link.created_at, false;
    return;
  end if;
  if link.id is not null then
    update public.grocery_share_links s set stopped_at = now() where s.id = link.id;
  end if;
  begin
    insert into public.grocery_share_links (family_id, token, duration, expires_at, can_edit)
      values (public.my_family_id(), repeat('x', 43), p_duration, p_expires_at, p_can_edit)
      returning * into link;
  exception when unique_violation then
    select * into link from public.grocery_share_links s where s.stopped_at is null;
    return query select link.token, link.duration, link.expires_at, link.can_edit, link.created_at, false;
    return;
  end;
  return query select link.token, link.duration, link.expires_at, link.can_edit, link.created_at, true;
end;
$$;
grant execute on function public.share_groceries(text, timestamptz, boolean) to authenticated;

-- What came through a link: the rows a guest added (FR-004's cap counts them) and the ones a guest
-- cleared (FR-005: only those can come back through it). `source` reads 'link' on a guest's rows.
alter table public.grocery_items
  add column share_link_id uuid references public.grocery_share_links (id) on delete set null,
  add column deleted_share_link_id uuid references public.grocery_share_links (id) on delete set null;

-- Only the endpoint sets them: a member's add has none, and a member's clear or restore is theirs.
create function public._keep_grocery_share_link() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.share_link_id := null;
    new.deleted_share_link_id := null;
  else
    new.share_link_id := old.share_link_id;
    new.deleted_share_link_id := case when new.deleted_at is distinct from old.deleted_at then null else old.deleted_share_link_id end;
  end if;
  return new;
end;
$$;
create trigger grocery_items_share_link before insert or update on public.grocery_items
  for each row execute function public._keep_grocery_share_link();

-- FR-006: a content-free ping on the public topic `grocery-share:<token>` while the family has a
-- live link. The topic is as unguessable as the token, and the guest refetches through the endpoint.
-- Once per statement and family, not per row: clearing 15 items is one refetch on each guest's page.
create function public._grocery_share_ping() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  t text;
begin
  for t in
    select s.token from public.grocery_share_links s
    where s.family_id in (select distinct c.family_id from changed c)
      and s.stopped_at is null and (s.expires_at is null or s.expires_at > now())
  loop
    perform realtime.send(jsonb_build_object('table', 'grocery_items'), 'change', 'grocery-share:' || t, false);
  end loop;
  return null;
end;
$$;
-- A trigger with a transition table takes one event, so one each, all naming the rows `changed`.
create trigger grocery_items_share_ping_insert after insert on public.grocery_items
  referencing new table as changed for each statement execute function public._grocery_share_ping();
create trigger grocery_items_share_ping_update after update on public.grocery_items
  referencing new table as changed for each statement execute function public._grocery_share_ping();
create trigger grocery_items_share_ping_delete after delete on public.grocery_items
  referencing old table as changed for each statement execute function public._grocery_share_ping();

-- The link itself changed (stopped, its time, editing): its page finds out at once.
create function public._grocery_share_link_ping() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(jsonb_build_object('table', 'grocery_share_links'), 'change', 'grocery-share:' || new.token, false);
  return null;
end;
$$;
create trigger grocery_share_links_ping after update on public.grocery_share_links
  for each row execute function public._grocery_share_link_ping();

-- The packs a family sees (spec 021), its own sizes replacing the catalog's: what `ingredient_packs`
-- shows a member, and what a shared list shows for that family. The rule lives here once.
create function public._ingredient_packs(fam uuid) returns table (
  catalog_key text, family_ingredient_id uuid, profile public.store_profile, "position" integer,
  size numeric, unit public.unit, label text, loose boolean)
language sql stable set search_path = '' as $$
  select p.ingredient_key, null::uuid, p.profile, p.position, p.size, p.unit, p.label, p.loose
  from public.catalog_packs p
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
revoke execute on function public._ingredient_packs(uuid) from public, anon;
grant execute on function public._ingredient_packs(uuid) to authenticated, cocon_assistant;

-- The link behind a token, live: not stopped and not ended. Null when there's none; for a write,
-- `read_only` when editing is off (FR-003).
create function public._grocery_share_link(p_token text, p_write boolean) returns public.grocery_share_links
language plpgsql stable security definer set search_path = '' as $$
declare
  link public.grocery_share_links;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then
    return null;
  end if;
  select * into link from public.grocery_share_links s
  where s.token = p_token and s.stopped_at is null and (s.expires_at is null or s.expires_at > now());
  if link.id is null then
    if p_write then
      raise exception 'not_shared' using errcode = 'P0001';
    end if;
    return null;
  end if;
  if p_write and not link.can_edit then
    raise exception 'read_only' using errcode = 'P0001';
  end if;
  return link;
end;
$$;

-- What a shared list shows (FR-003), for the share endpoint only (service role). Null when the
-- token isn't live. Never who added or ticked anything, recipe names, members, or ids other than
-- the items' own (the page ticks and removes by them).
create function public.shared_groceries(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  link public.grocery_share_links := public._grocery_share_link(p_token, false);
  items jsonb;
  keys text[];
begin
  if link.id is null then
    return null;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', i.id, 'name', i.name, 'catalog_key', i.catalog_key, 'quantity', i.quantity, 'unit', i.unit,
      'aisle', i.aisle, 'checked', i.checked, 'recipe_detail', i.recipe_detail) order by i.created_at, i.id), '[]'),
    array_agg(distinct i.catalog_key) filter (where i.catalog_key is not null)
    into items, keys
  from public.grocery_items i where i.family_id = link.family_id and i.deleted_at is null;

  return jsonb_build_object(
    'family_name', (select f.name from public.families f where f.id = link.family_id),
    'can_edit', link.can_edit,
    'expires_at', link.expires_at,
    'settings', (select jsonb_build_object(
        'store_profile', coalesce(s.store_profile, 'us'),
        'round_to_packs', coalesce(s.round_to_packs, true),
        'units', coalesce(s.units, 'metric'))
      from (select 1) one left join public.family_settings s on s.family_id = link.family_id),
    'items', items,
    -- As `loadPacks` (packages/data/groceries.ts) reads them for a member.
    'packs', (select coalesce(jsonb_object_agg(f.catalog_key, jsonb_build_object(
        'facts', jsonb_build_object('name', f.name, 'density_g_per_ml', f.density_g_per_ml,
          'size_small_g', f.size_small_g, 'size_medium_g', f.size_medium_g, 'size_large_g', f.size_large_g,
          'default_size', f.default_size),
        'packs', jsonb_build_object(
          'us', (select coalesce(jsonb_agg(jsonb_build_object('size', p.size, 'unit', p.unit, 'label', p.label, 'loose', p.loose) order by p.position), '[]')
            from public._ingredient_packs(link.family_id) p where p.catalog_key = f.catalog_key and p.profile = 'us'),
          'eu', (select coalesce(jsonb_agg(jsonb_build_object('size', p.size, 'unit', p.unit, 'label', p.label, 'loose', p.loose) order by p.position), '[]')
            from public._ingredient_packs(link.family_id) p where p.catalog_key = f.catalog_key and p.profile = 'eu')))), '{}')
      from public._ingredient_facts(link.family_id) f where f.catalog_key = any (coalesce(keys, '{}')))
  );
end;
$$;

-- FR-004: a guest's add, read on the page with the app's quick-add (`parseGroceryLine`) and the
-- matcher's query (`parseIngredientText`), matched here for the family. Always a new row: the list
-- shows it combined with the same thing already there (spec 022). The table's checks hold the rest.
create function public.shared_grocery_add(p_token text, p_name text, p_quantity numeric, p_unit text, p_full text, p_core text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  link public.grocery_share_links := public._grocery_share_link(p_token, true);
  key text;
  row_id uuid;
begin
  -- One add at a time per link, so parallel requests can't each pass the cap.
  perform pg_advisory_xact_lock(hashtext(link.id::text));
  if (select count(*) from public.grocery_items i where i.share_link_id = link.id and i.created_at > now() - interval '1 hour') >= 60
    or (select count(*) from public.grocery_items i where i.family_id = link.family_id and i.deleted_at is null) >= 300 then
    raise exception 'too_many' using errcode = 'P0001';
  end if;
  select m.catalog_key into key
  from public._match_ingredients(link.family_id, jsonb_build_array(jsonb_build_object('full', coalesce(p_full, ''), 'core', coalesce(p_core, '')))) m
  where m.how <> 'none';
  insert into public.grocery_items (family_id, name, catalog_key, quantity, unit, source, share_link_id)
    values (link.family_id, btrim(p_name), key, p_quantity, p_unit::public.unit, 'link', link.id)
    returning id into row_id;
  return jsonb_build_object('id', row_id, 'matched', key is not null);
end;
$$;

-- FR-005: tick or untick, and remove (cleared, kept a day), only the family's current items.
create function public.shared_grocery_check(p_token text, p_ids uuid[], p_checked boolean) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  link public.grocery_share_links := public._grocery_share_link(p_token, true);
  n integer;
begin
  if cardinality(p_ids) > 500 then
    raise exception 'too_many' using errcode = 'P0001';
  end if;
  update public.grocery_items i set checked = p_checked, updated_by = null
  where i.id = any (p_ids) and i.family_id = link.family_id and i.deleted_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

create function public.shared_grocery_clear(p_token text, p_ids uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  link public.grocery_share_links := public._grocery_share_link(p_token, true);
  n integer;
begin
  if cardinality(p_ids) > 500 then
    raise exception 'too_many' using errcode = 'P0001';
  end if;
  update public.grocery_items i set deleted_at = now(), deleted_share_link_id = link.id, updated_by = null
  where i.id = any (p_ids) and i.family_id = link.family_id and i.deleted_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Undo brings back only what this link cleared, within the list's day (spec 020).
create function public.shared_grocery_restore(p_token text, p_ids uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  link public.grocery_share_links := public._grocery_share_link(p_token, true);
  n integer;
begin
  if cardinality(p_ids) > 500 then
    raise exception 'too_many' using errcode = 'P0001';
  end if;
  update public.grocery_items i set deleted_at = null, deleted_share_link_id = null, updated_by = null
  where i.id = any (p_ids) and i.family_id = link.family_id and i.deleted_share_link_id = link.id
    and i.deleted_at > now() - interval '1 day';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public._grocery_share_link(text, boolean) from public, anon, authenticated;
revoke execute on function public.shared_groceries(text), public.shared_grocery_add(text, text, numeric, text, text, text),
  public.shared_grocery_check(text, uuid[], boolean), public.shared_grocery_clear(text, uuid[]),
  public.shared_grocery_restore(text, uuid[]) from public, anon, authenticated;
grant execute on function public.shared_groceries(text), public.shared_grocery_add(text, text, numeric, text, text, text),
  public.shared_grocery_check(text, uuid[], boolean), public.shared_grocery_clear(text, uuid[]),
  public.shared_grocery_restore(text, uuid[]) to service_role;
