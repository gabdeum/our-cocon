-- Spec 026: the activity log as people see it, and Undo. An entry is one assistant tool call: every
-- row the database logged with the same call id (FR-001; a write made without the MCP server's
-- label is an entry of its own). Undo runs as the member, in one transaction, through RLS and the
-- tables' own checks: positions of steps, ingredients and variants are only checked at commit, so
-- putting them back can't be split over several requests. It writes its own entry ('undo', or
-- 'restore' for an AI delete), which is never offered for undo (FR-003).

-- The order rows were logged in, within one call (rows of one statement share a time).
alter table public.activity add column seq bigint generated always as identity;

-- The entry a logged row belongs to. Only a well-formed id groups rows, so a stray label can't
-- break the list.
create function public._activity_key(payload jsonb, id uuid) returns uuid
language sql immutable set search_path = '' as $$
  select case
    when payload ->> 'call_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (payload ->> 'call_id')::uuid
    else id
  end;
$$;
create index activity_entry on public.activity (family_id, public._activity_key(payload, id));
create index activity_undone on public.activity (target_id) where action in ('undo', 'restore');

-- What a row is, leaving out who touched it last and when, so Undo can tell whether anyone changed
-- it since. A recipe that only had its updated_at touched by its own steps keeps its fingerprint.
create function public._row_fingerprint(r jsonb) returns text
language sql immutable set search_path = '' as $$
  select md5((r - 'updated_at' - 'updated_by')::text);
$$;

-- As in spec 024, plus each row's fingerprint after the write (`after_hash`).
create or replace function public._log_assistant_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  was jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  headers jsonb;
  call_id text;
  tool text;
  payload jsonb;
begin
  if auth.jwt() ->> 'client_id' is null then
    return null;
  end if;
  if tg_op = 'UPDATE' and (r - 'updated_at' - 'updated_by') = (was - 'updated_at' - 'updated_by') then
    return null;
  end if;
  begin
    headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    headers := null;
  end;
  call_id := headers ->> 'x-cocon-call';
  tool := headers ->> 'x-cocon-tool';
  -- The labels come from whoever holds the token, which can call the API directly. A call id only
  -- groups rows of one fresh call by this person and assistant, never undone: otherwise the row is
  -- an entry of its own, so nobody can hide a write in an undone or week-old entry, or another's.
  if call_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and exists (
    select 1 from public.activity a
    where a.family_id = (r ->> 'family_id')::uuid
      and (a.target_id = call_id::uuid and a.action in ('undo', 'restore')
        or public._activity_key(a.payload, a.id) = call_id::uuid
          and (a.actor_id is distinct from auth.uid() or a.source <> public._request_source() or a.created_at < now() - interval '10 minutes'))
  ) then
    call_id := null;
  end if;
  -- Empty labels are left out; `before` keeps its empty fields (Undo puts them back too).
  select coalesce(jsonb_object_agg(k, v), '{}') into payload
  from jsonb_each(jsonb_build_object(
    'recipe_id', coalesce(r ->> 'recipe_id', case when tg_table_name = 'recipes' then r ->> 'id' end),
    'call_id', case when call_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then call_id end,
    'tool', case when tool ~ '^[a-z][a-z_]{0,39}$' then tool end,
    'name', case when tg_table_name in ('recipes', 'grocery_items') then r ->> 'name' end,
    'after_hash', case when tg_op <> 'DELETE' then public._row_fingerprint(r) end,
    -- A recipe going to Recently deleted: what makes an entry a delete (Restore), not its label.
    'deleted', case when tg_table_name = 'recipes' and tg_op = 'UPDATE' and was ->> 'deleted_at' is null and r ->> 'deleted_at' is not null then true end,
    'before', was)) as e (k, v)
  where v <> 'null'::jsonb;
  -- The log keeps payloads under 64 KB. A change it couldn't undo (a variant's long change list) is
  -- refused rather than made without its `before`; the tool says it couldn't save.
  if octet_length(payload::text) > 60000 then
    raise exception 'too big to log for undo' using errcode = '54000';
  end if;
  insert into public.activity (family_id, actor_id, action, target_kind, target_id, payload)
  values ((r ->> 'family_id')::uuid, auth.uid(), lower(tg_op), tg_table_name, (r ->> 'id')::uuid, payload);
  return null;
end;
$$;

-- People add only undo and restore entries (the database writes the AI ones). The person and the
-- source are still the database's (_stamp_activity).
alter policy "members add to their family's activity" on public.activity
  with check (
    family_id = public.my_family_id() and actor_id = auth.uid() and action in ('undo', 'restore') and target_kind = 'activity'
    and exists (
      select 1 from public.activity a
      where a.family_id = public.my_family_id() and a.action in ('insert', 'update', 'delete') and a.source <> 'app'
        and public._activity_key(a.payload, a.id) = activity.target_id));
-- One undo per entry, whoever presses it first.
create unique index activity_one_undo on public.activity (family_id, target_id) where action in ('undo', 'restore');

-- What an entry did, for its title and the undo event (spec 026 Tracking): from the tool's label,
-- checked against the rows, so a delete is only a delete when every row is a recipe going to
-- Recently deleted.
create function public._activity_kind(p_key uuid) returns text
language sql stable security invoker set search_path = '' as $$
  with logged as (
    select * from public.activity a
    where public._activity_key(a.payload, a.id) = p_key and a.action in ('insert', 'update', 'delete')
  )
  select case (select payload ->> 'tool' from logged order by seq limit 1)
    when 'create_recipe' then 'recipe_created'
    when 'update_recipe' then 'recipe_edited'
    when 'delete_recipe' then
      case when (select bool_and(target_kind = 'recipes' and action = 'update' and coalesce((payload ->> 'deleted')::boolean, false)) from logged)
        then 'recipe_deleted' else 'other' end
    when 'add_groceries' then 'groceries_added'
    when 'add_recipe_to_groceries' then 'groceries_added'
    when 'check_grocery' then
      case when (select bool_and((payload -> 'before' ->> 'checked')::boolean) from logged where target_kind = 'grocery_items')
        then 'groceries_unticked' else 'groceries_ticked' end
    when 'remove_grocery' then 'groceries_removed'
    when 'clear_done_groceries' then 'groceries_cleared'
    else 'other'
  end;
$$;

-- Home and the activity list (FR-002): the family's AI entries, newest first, with who undid each.
-- Undo lasts 7 days; an AI delete offers Restore while its recipe is in Recently deleted (30 days).
create function public.activity_entries(
  p_limit int default 20,
  p_before timestamptz default null,
  p_actor uuid default null,
  p_source text default null
) returns table (
  key uuid,
  actor_id uuid,
  source text,
  kind text,
  created_at timestamptz,
  count int,
  names text[],
  recipe_id uuid,
  recipe_name text,
  undone_by uuid,
  undone_at timestamptz,
  undo_action text,
  can_undo boolean,
  can_restore boolean
)
language sql stable security invoker set search_path = '' as $$
  with logged as (
    select a.*, public._activity_key(a.payload, a.id) as k
    from public.activity a
    where a.action in ('insert', 'update', 'delete') and a.source <> 'app'
  ),
  entries as (
    select
      k,
      (array_agg(r.actor_id order by r.seq))[1] as actor_id,
      (array_agg(r.source::text order by r.seq))[1] as source,
      min(r.created_at) as created_at,
      count(distinct r.target_id) filter (where r.target_kind <> 'grocery_items') as others,
      count(distinct r.payload ->> 'name') filter (where r.target_kind = 'grocery_items') as items,
      (array_agg(distinct r.payload ->> 'name') filter (where r.target_kind = 'grocery_items'))[1:3] as names,
      (array_agg((r.payload ->> 'recipe_id')::uuid order by r.seq) filter (where r.target_kind = 'recipes'))[1] as recipe_id,
      (array_agg(r.payload ->> 'name' order by r.seq desc) filter (where r.target_kind = 'recipes'))[1] as logged_name
    from logged r
    group by k
    having (p_actor is null or (array_agg(r.actor_id order by r.seq))[1] = p_actor)
      -- 'other': any assistant the app can't name (OC-Activity's "Other" pill).
      and (p_source is null or (array_agg(r.source::text order by r.seq))[1] = p_source
        or (p_source = 'other' and (array_agg(r.source::text order by r.seq))[1] not in ('claude', 'chatgpt', 'gemini')))
  ),
  page as (
    select * from entries e
    where p_before is null or e.created_at < p_before
    order by e.created_at desc
    limit least(greatest(coalesce(p_limit, 20), 1), 100)
  )
  select
    p.k,
    p.actor_id,
    p.source,
    kind.v,
    p.created_at,
    case when p.items > 0 then p.items else p.others end::int,
    coalesce(p.names, '{}'),
    p.recipe_id,
    coalesce(rec.name, p.logged_name),
    u.actor_id,
    u.created_at,
    u.action,
    u.id is null and kind.v <> 'recipe_deleted' and p.created_at > now() - interval '7 days',
    u.id is null and kind.v = 'recipe_deleted' and rec.deleted_at is not null and rec.deleted_at > now() - interval '30 days'
  from page p
  cross join lateral (select public._activity_kind(p.k) as v) kind
  left join public.recipes rec on rec.id = p.recipe_id
  left join lateral (
    select a.id, a.actor_id, a.created_at, a.action from public.activity a
    where a.target_id = p.k and a.action in ('undo', 'restore')
    order by a.seq limit 1
  ) u on true
  order by p.created_at desc;
$$;
grant execute on function public.activity_entries(int, timestamptz, uuid, text) to authenticated;

-- Who and which assistants have entries, for the activity list's filters.
create function public.activity_filters() returns table (actor_id uuid, source text)
language sql stable security invoker set search_path = '' as $$
  select distinct a.actor_id, a.source::text from public.activity a
  where a.action in ('insert', 'update', 'delete') and a.source <> 'app';
$$;
grant execute on function public.activity_filters() to authenticated;

-- Undo (or Restore) one entry, as the member. Each row the call touched goes back to how it was
-- before the call. A row someone changed since (its fingerprint differs) is a conflict: without
-- p_skip_changed nothing changes and the conflicts come back, grouped by who and what ("Mia ticked
-- 2 of these items"); with it, only the rest is undone. A recipe the call added goes to Recently
-- deleted with its rows, and grocery items are cleared, as people can't remove either for good.
create function public.undo_ai_change(p_key uuid, p_skip_changed boolean default false) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  stamps constant text[] := array['id', 'family_id', 'created_by', 'created_at', 'source', 'updated_at', 'updated_by'];
  tables constant text[] := array['recipes', 'recipe_ingredients', 'recipe_steps', 'recipe_variants', 'grocery_items', 'grocery_recipes'];
  kind text;
  started timestamptz;
  lasts interval;
  changed boolean;
  t record;
  cur jsonb;
  conflict jsonb;
  conflicts jsonb := '[]';
  safe jsonb := '[]';
  dropped uuid[] := '{}';
  cols text;
  done int := 0;
  s jsonb;
begin
  -- Two people pressing Undo at once: the second waits, then finds it undone.
  perform pg_advisory_xact_lock(hashtextextended(p_key::text, 0));
  select min(a.created_at) into started from public.activity a
    where public._activity_key(a.payload, a.id) = p_key and a.action in ('insert', 'update', 'delete') and a.source <> 'app';
  if started is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.activity a where a.target_id = p_key and a.action in ('undo', 'restore')) then
    raise exception 'already_undone' using errcode = '22023';
  end if;
  kind := public._activity_kind(p_key);
  lasts := case when kind = 'recipe_deleted' then interval '30 days' else interval '7 days' end;
  if started < now() - lasts then
    raise exception 'expired' using errcode = '22023';
  end if;

  -- Each row once: how it was before the call’s first write, what the call left it as.
  for t in
    select a.target_kind as tbl, a.target_id as id,
      (array_agg(a.action order by a.seq))[1] as first_op,
      (array_agg(a.payload -> 'before' order by a.seq))[1] as before,
      (array_agg(a.action order by a.seq desc))[1] as last_op,
      (array_agg(a.payload ->> 'after_hash' order by a.seq desc))[1] as after_hash,
      max(a.created_at) as at
    from public.activity a
    where public._activity_key(a.payload, a.id) = p_key and a.action in ('insert', 'update', 'delete') and a.source <> 'app'
      and a.target_id is not null
    group by a.target_kind, a.target_id
  loop
    continue when not (t.tbl = any (tables));
    -- Added then removed in the same call: nothing to put back.
    continue when t.first_op = 'insert' and t.last_op = 'delete';
    execute format('select to_jsonb(r) from public.%I r where r.id = $1', t.tbl) into cur using t.id;
    -- Older entries (before this migration) have no fingerprint: changed if touched after the call.
    changed := cur is not null and coalesce(public._row_fingerprint(cur) <> t.after_hash, (cur ->> 'updated_at')::timestamptz > t.at);
    conflict := null;
    if t.last_op = 'delete' then
      if cur is not null then
        conflict := jsonb_build_object('kind', 'edited', 'by', cur ->> 'updated_by');
      end if;
    elsif cur is null then
      conflict := jsonb_build_object('kind', 'gone', 'by', null);
    elsif changed then
      conflict := case
        when t.tbl = 'grocery_items' and cur ->> 'deleted_at' is not null and (cur ->> 'deleted_at')::timestamptz > t.at
          then jsonb_build_object('kind', 'cleared', 'by', cur ->> 'deleted_by')
        when t.tbl = 'grocery_items' and (cur ->> 'checked')::boolean and (cur ->> 'checked_at')::timestamptz > t.at
          then jsonb_build_object('kind', 'ticked', 'by', cur ->> 'checked_by')
        else jsonb_build_object('kind', 'edited', 'by', cur ->> 'updated_by')
      end;
    elsif t.tbl = 'grocery_items' and t.before is not null and t.before ->> 'deleted_at' is null
      and cur ->> 'deleted_at' is not null and (cur ->> 'deleted_at')::timestamptz < now() - interval '1 day' then
      -- Cleared over a day ago: the nightly purge is about to take it (spec 020), so it stays cleared.
      conflict := jsonb_build_object('kind', 'gone', 'by', null);
    end if;
    if conflict is not null then
      conflicts := conflicts || jsonb_build_array(conflict);
    else
      safe := safe || jsonb_build_array(jsonb_build_object('tbl', t.tbl, 'id', t.id, 'first_op', t.first_op, 'before', t.before, 'exists', cur is not null,
        'recipe_id', cur ->> 'recipe_id'));
      if t.tbl = 'recipes' and t.first_op = 'insert' then
        dropped := dropped || t.id;
      end if;
    end if;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object('kind', c.kind, 'by', c.by, 'count', c.n) order by c.n desc), '[]') into conflicts
  from (select x ->> 'kind' as kind, x ->> 'by' as by, count(*) as n from jsonb_array_elements(conflicts) x group by 1, 2) c;

  if jsonb_array_length(safe) = 0 or (jsonb_array_length(conflicts) > 0 and not p_skip_changed) then
    -- `left`: what Undo the rest would still do (0: nothing, everything changed since).
    return jsonb_build_object('applied', false, 'kind', kind, 'done', 0, 'left', jsonb_array_length(safe), 'conflicts', conflicts);
  end if;

  for s in select * from jsonb_array_elements(safe) loop
    if s ->> 'first_op' = 'insert' then
      -- What the call added goes. A new recipe’s own rows stay with it in Recently deleted.
      if s ->> 'tbl' in ('recipes', 'grocery_items') then
        execute format('update public.%I set deleted_at = now() where id = $1 and deleted_at is null', s ->> 'tbl') using (s ->> 'id')::uuid;
      elsif s ->> 'tbl' = 'grocery_recipes' then
        -- Never removed by people (spec 022): it waits, unused, until the recipe is added again.
        continue;
      elsif (s ->> 'recipe_id')::uuid = any (dropped) then
        continue;
      else
        execute format('delete from public.%I where id = $1', s ->> 'tbl') using (s ->> 'id')::uuid;
      end if;
    elsif (s ->> 'exists')::boolean then
      -- Changed: every field back as it was (who and when are stamped as this member).
      select string_agg(format('%I', attname), ', ' order by attnum) into cols
      from pg_attribute
      where attrelid = format('public.%I', s ->> 'tbl')::regclass and attnum > 0 and not attisdropped
        and attgenerated = '' and not (attname = any (stamps)) and (s -> 'before') ? attname;
      execute format('update public.%I t set (%s) = (select %s from jsonb_populate_record(null::public.%I, $1) p) where t.id = $2',
        s ->> 'tbl', cols, cols, s ->> 'tbl') using s -> 'before', (s ->> 'id')::uuid;
    else
      -- Removed (a step or variant a save left out, L37): back with its own id.
      select string_agg(format('%I', attname), ', ' order by attnum) into cols
      from pg_attribute
      where attrelid = format('public.%I', s ->> 'tbl')::regclass and attnum > 0 and not attisdropped
        and attgenerated = '' and (s -> 'before') ? attname;
      execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1)',
        s ->> 'tbl', cols, cols, s ->> 'tbl') using s -> 'before';
    end if;
    done := done + 1;
  end loop;

  insert into public.activity (family_id, actor_id, action, target_kind, target_id, payload)
  values (public.my_family_id(), auth.uid(), case when kind = 'recipe_deleted' then 'restore' else 'undo' end, 'activity', p_key,
    jsonb_build_object('kind', kind, 'skipped', (select coalesce(sum((c ->> 'count')::int), 0) from jsonb_array_elements(conflicts) c)));
  return jsonb_build_object('applied', true, 'kind', kind, 'done', done, 'conflicts', conflicts);
end;
$$;
grant execute on function public.undo_ai_change(uuid, boolean) to authenticated;

-- The helpers the functions above call as the member (they only read through RLS).
grant execute on function public._activity_key(jsonb, uuid), public._row_fingerprint(jsonb), public._activity_kind(uuid) to authenticated;
