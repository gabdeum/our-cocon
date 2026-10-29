-- Spec 044: AI assistants add and change events, within what each member allows them.
--   - A new per-member permission, "Add & change events" (`events`), Allowed until changed, checked
--     by the database on every assistant write to the calendar's tables (as spec 024's are).
--   - The assistant role (spec 023) gets what the calendar tools need: saving, splitting, cancelling
--     a date and deleting, through the same policies as the member's own session, so a private event
--     or a surprise hidden from the member can't be changed by their assistant either. The tables
--     only return the rows the member sees in full; the tools still read through `events_visible`.
--   - Every assistant event write is logged for spec 026 (activity and Undo). The log keeps the
--     rows as they were, so an event's entries are read only by the people who may see that event
--     (032-later L83): never by the person a surprise is kept from, nor a private event's by others.

-- --- Permission (FR-003) ----------------------------------------------------------------------------

alter table public.ai_permissions add column events boolean not null default true;

create or replace function public.ai_allowed(permission text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when permission is null or permission not in ('recipes_edit', 'groceries', 'events', 'recipes_delete') then false
    when auth.jwt() ->> 'client_id' is null then true
    else coalesce((
      select case permission
        when 'recipes_edit' then p.recipes_edit
        when 'groceries' then p.groceries
        when 'events' then p.events
        else p.recipes_delete
      end
      from public.ai_permissions p where p.user_id = auth.uid()), true)
  end;
$$;

-- As in spec 024, plus the calendar's tables: any change to an event, who it's for, its dates,
-- checklist or surprise needs `events` (deleting one too: there's no separate switch for it).
create or replace function public._check_ai_permission() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ignored text[] := array['updated_at', 'updated_by', 'deleted_at', 'deleted_by'];
  edited boolean;
begin
  if auth.jwt() ->> 'client_id' is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_table_name in ('grocery_items', 'grocery_recipes') then
    if not public.ai_allowed('groceries') then
      raise exception 'groceries' using errcode = '42501', hint = 'ai_not_allowed';
    end if;
  elsif tg_table_name in ('events', 'event_members', 'event_exceptions', 'event_checklist_items', 'event_surprise') then
    if not public.ai_allowed('events') then
      raise exception 'events' using errcode = '42501', hint = 'ai_not_allowed';
    end if;
  elsif tg_table_name = 'recipes' and tg_op = 'UPDATE' then
    if new.deleted_at is distinct from old.deleted_at and not public.ai_allowed('recipes_delete') then
      raise exception 'recipes_delete' using errcode = '42501', hint = 'ai_not_allowed';
    end if;
    -- A recipe's updated_at, touched when its rows change, is part of that change, not an edit.
    edited := (to_jsonb(new) - ignored) <> (to_jsonb(old) - ignored);
    if edited and not public.ai_allowed('recipes_edit') then
      raise exception 'recipes_edit' using errcode = '42501', hint = 'ai_not_allowed';
    end if;
  elsif not public.ai_allowed('recipes_edit') then
    raise exception 'recipes_edit' using errcode = '42501', hint = 'ai_not_allowed';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['events', 'event_members', 'event_exceptions', 'event_checklist_items', 'event_surprise'] loop
    execute format('create trigger a_ai_permission before insert or update or delete on public.%I for each row execute function public._check_ai_permission()', t);
  end loop;
end;
$$;

-- --- The calendar tools ---------------------------------------------------------------------------

-- Events: add, change, split, and delete by setting deleted_at (Recently deleted). No DELETE: only
-- a member removes an event for good. `select` covers what save_event and split_event read back.
grant select,
  insert (title, category, location, notes, starts_on, ends_on, time_type, slots, start_time, end_time, recurrence, reminder, responsible_member_id, visibility),
  update (title, category, location, notes, starts_on, ends_on, time_type, slots, start_time, end_time, recurrence, reminder, responsible_member_id, visibility, deleted_at)
  on public.events to cocon_assistant;
-- Who it's for (saving replaces the list), a date cancelled or changed, the checklist (saving and
-- splitting a series write it), the surprise.
grant select, insert, delete on public.event_members to cocon_assistant;
grant select, insert, update, delete on public.event_exceptions to cocon_assistant;
grant select, insert, update, delete on public.event_checklist_items to cocon_assistant;
grant select, insert, update, delete on public.event_surprise to cocon_assistant;
-- As spec 041 wrote it, but asking whether the caller created the event through `_created_event`:
-- assistants can't use the `auth` schema.
create or replace function public.split_event(p_id uuid, p_from date, p_before jsonb, p_event jsonb, p_members jsonb,
  p_surprise jsonb default null, p_checklist jsonb default null)
returns uuid
language plpgsql set search_path = '' as $$
declare
  old public.events;
  eid uuid;
begin
  select * into old from public.events
    where id = p_id and deleted_at is null and recurrence is not null and starts_on < p_from
    for update;
  if old.id is null then
    raise exception 'event_not_found' using errcode = 'P0002';
  end if;
  if not public._created_event(old.id)
    and (old.visibility <> 'family' or coalesce(p_event ->> 'visibility', 'family') <> 'family') then
    raise exception 'only_creator_changes_visibility' using errcode = '42501';
  end if;
  -- The old series must end before the new one starts, or the two would overlap.
  if p_before #>> '{ends,type}' is distinct from 'on' or (p_before #>> '{ends,date}')::date >= p_from then
    raise exception 'split_overlaps' using errcode = '22023';
  end if;
  update public.events set recurrence = p_before where id = old.id;
  eid := public.save_event(p_event, p_members, null, p_surprise,
    (select coalesce(jsonb_agg(jsonb_build_object('label', x ->> 'label')), '[]') from jsonb_array_elements(coalesce(p_checklist, '[]')) x));
  update public.event_exceptions set event_id = eid where event_id = old.id and occurrence_date >= p_from;
  return eid;
end;
$$;

grant execute on function public.save_event(jsonb, jsonb, uuid, jsonb, jsonb) to cocon_assistant;
grant execute on function public.split_event(uuid, date, jsonb, jsonb, jsonb, jsonb, jsonb) to cocon_assistant;
-- The visibility helpers the policies call, and the check on what a date's change may replace.
grant execute on function public._my_member_id(), public._sees_event(text, uuid, uuid), public._sees_event(uuid), public._created_event(uuid),
  public._override_keys_ok(jsonb) to cocon_assistant;

-- The member's own rules (spec 035, 043), for their assistant too.
alter policy "members read the events they may see" on public.events to authenticated, cocon_assistant;
alter policy "members add to their family" on public.events to authenticated, cocon_assistant;
alter policy "members change the events they may see" on public.events to authenticated, cocon_assistant;
alter policy "members read their family's rows" on public.event_members to authenticated, cocon_assistant;
alter policy "members add who the events they may see are for" on public.event_members to authenticated, cocon_assistant;
alter policy "members remove who the events they may see are for" on public.event_members to authenticated, cocon_assistant;
alter policy "members read details of the events they may see" on public.event_exceptions to authenticated, cocon_assistant;
alter policy "members add details to the events they may see" on public.event_exceptions to authenticated, cocon_assistant;
alter policy "members change details of the events they may see" on public.event_exceptions to authenticated, cocon_assistant;
alter policy "members remove details of the events they may see" on public.event_exceptions to authenticated, cocon_assistant;
alter policy "members read details of the events they may see" on public.event_checklist_items to authenticated, cocon_assistant;
alter policy "members add details to the events they may see" on public.event_checklist_items to authenticated, cocon_assistant;
alter policy "members change details of the events they may see" on public.event_checklist_items to authenticated, cocon_assistant;
alter policy "members remove details of the events they may see" on public.event_checklist_items to authenticated, cocon_assistant;
alter policy "members read the surprises they're in on" on public.event_surprise to authenticated, cocon_assistant;
alter policy "creators set up their surprise" on public.event_surprise to authenticated, cocon_assistant;
alter policy "creators change their surprise" on public.event_surprise to authenticated, cocon_assistant;
alter policy "creators remove their surprise" on public.event_surprise to authenticated, cocon_assistant;

-- --- The activity log (FR-004) --------------------------------------------------------------------

-- As in spec 026, plus for the calendar's rows: the event they belong to (`event_id`), an event's
-- title (`name`), and `secret` when the event is private or a surprise as it's logged.
create or replace function public._log_assistant_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  was jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  headers jsonb;
  call_id text;
  tool text;
  payload jsonb;
  event_id uuid;
  secret boolean;
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
  if tg_table_name in ('events', 'event_members', 'event_exceptions', 'event_checklist_items', 'event_surprise') then
    event_id := coalesce(r ->> 'event_id', r ->> 'id')::uuid;
    secret := case when tg_table_name = 'events' then r ->> 'visibility' <> 'family' or was ->> 'visibility' <> 'family'
      else coalesce((select e.visibility <> 'family' from public.events e where e.id = event_id), true) end;
  end if;
  -- One entry never mixes rows people read under different rules (a private event's with a family
  -- event's, or an event's with a recipe's), so nobody undoes a part they can't see.
  if call_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and exists (
    select 1 from public.activity a
    where a.family_id = (r ->> 'family_id')::uuid and public._activity_key(a.payload, a.id) = call_id::uuid
      and ((a.payload ? 'event_id') <> (event_id is not null) or coalesce((a.payload ->> 'secret')::boolean, false) <> coalesce(secret, false))
  ) then
    call_id := null;
  end if;
  -- Empty labels are left out; `before` keeps its empty fields (Undo puts them back too).
  select coalesce(jsonb_object_agg(k, v), '{}') into payload
  from jsonb_each(jsonb_build_object(
    'recipe_id', coalesce(r ->> 'recipe_id', case when tg_table_name = 'recipes' then r ->> 'id' end),
    'event_id', event_id,
    'secret', case when secret then true end,
    'call_id', case when call_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then call_id end,
    'tool', case when tool ~ '^[a-z][a-z_]{0,39}$' then tool end,
    'name', case when tg_table_name in ('recipes', 'grocery_items') then r ->> 'name' when tg_table_name = 'events' then r ->> 'title' end,
    'after_hash', case when tg_op <> 'DELETE' then public._row_fingerprint(r) end,
    -- A recipe or an event going to Recently deleted: what makes an entry a delete (Restore), not its label.
    'deleted', case when tg_table_name in ('recipes', 'events') and tg_op = 'UPDATE' and was ->> 'deleted_at' is null and r ->> 'deleted_at' is not null then true end,
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

do $$
declare
  t text;
begin
  foreach t in array array['events', 'event_members', 'event_exceptions', 'event_checklist_items', 'event_surprise'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public._log_assistant_write()', t || '_log_assistant', t);
  end loop;
end;
$$;

-- Whether the caller may read a logged event row (L83). Only while they may see the event now (so
-- it follows a later change to private, or a surprise). A row logged while the event was private or
-- a surprise (`secret`) stays with the person whose assistant made the change and the event's
-- creator, even once it's back to family: its `before` can hold who a surprise was kept from. Once
-- the event is gone for good, a secret row stays with that person only.
create function public._sees_logged_event(eid uuid, secret boolean, actor uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from public.events e where e.id = eid and e.family_id = public.my_family_id())
      then public._sees_event(eid) and (not coalesce(secret, false) or actor = auth.uid() or public._created_event(eid))
    else not coalesce(secret, false) or actor = auth.uid()
  end;
$$;
revoke all on function public._sees_logged_event(uuid, boolean, uuid) from public, anon;
grant execute on function public._sees_logged_event(uuid, boolean, uuid) to authenticated;

-- Only the rows the database logged carry an event (people add only undo and restore rows); a
-- malformed value is never cast, so no row can break everyone's reads.
alter policy "members read their family's activity" on public.activity
  using (family_id = public.my_family_id() and (action not in ('insert', 'update', 'delete') or payload ->> 'event_id' is null
    or (payload ->> 'event_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and public._sees_logged_event((payload ->> 'event_id')::uuid, payload -> 'secret' = 'true'::jsonb, actor_id))));

-- What an entry did: spec 026's kinds, plus the calendar tools'. A delete that sent an event to
-- Recently deleted (the whole event, or its dates from one on) is restored like a recipe; one date
-- cancelled is undone.
create or replace function public._activity_kind(p_key uuid) returns text
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
    when 'create_event' then 'event_created'
    when 'update_event' then 'event_edited'
    when 'delete_event' then
      case when exists (select 1 from logged where target_kind = 'events' and coalesce((payload ->> 'deleted')::boolean, false))
        then 'event_deleted' else 'event_date_deleted' end
    else 'other'
  end;
$$;

-- As in spec 026, plus the event an entry changed and its title (as the caller sees it now, else
-- as it was logged), and Restore for an event an assistant sent to Recently deleted, while it's
-- there (30 days), as for a recipe. The return type changes, so it's made again.
drop function public.activity_entries(int, timestamptz, uuid, text);
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
  event_id uuid,
  event_name text,
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
      (array_agg(r.payload ->> 'name' order by r.seq desc) filter (where r.target_kind = 'recipes'))[1] as logged_name,
      (array_agg((r.payload ->> 'event_id')::uuid order by r.seq) filter (where r.payload ? 'event_id'))[1] as event_id,
      (array_agg(r.payload ->> 'name' order by r.seq) filter (where r.target_kind = 'events'))[1] as logged_event_name,
      (array_agg(r.target_id order by r.seq) filter (where r.target_kind = 'events' and coalesce((r.payload ->> 'deleted')::boolean, false)))[1] as deleted_event
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
    p.event_id,
    coalesce(ev.title, p.logged_event_name),
    u.actor_id,
    u.created_at,
    u.action,
    u.id is null and kind.v not in ('recipe_deleted', 'event_deleted') and p.created_at > now() - interval '7 days',
    u.id is null and (kind.v = 'recipe_deleted' and rec.deleted_at is not null and rec.deleted_at > now() - interval '30 days'
      or kind.v = 'event_deleted' and dev.deleted_at is not null and dev.deleted_at > now() - interval '30 days')
  from page p
  cross join lateral (select public._activity_kind(p.k) as v) kind
  left join public.recipes rec on rec.id = p.recipe_id
  left join public.events ev on ev.id = p.event_id
  left join public.events dev on dev.id = p.deleted_event
  left join lateral (
    select a.id, a.actor_id, a.created_at, a.action from public.activity a
    where a.target_id = p.k and a.action in ('undo', 'restore')
    order by a.seq limit 1
  ) u on true
  order by p.created_at desc;
$$;
grant execute on function public.activity_entries(int, timestamptz, uuid, text) to authenticated;

-- Whether anything of an event the call `p_key` added was changed outside it since `at`: who it's
-- for, a date, its checklist, its surprise or a share link that isn't the call's own row, or one
-- changed later. Undo would remove all of it with the event. Reads past the caller's view of the
-- details (a share link), so it runs with the database's rights and only answers for their family.
-- Returns who changed it last (`by`, maybe null), or null when nothing did.
create function public._event_changed_outside(eid uuid, p_key uuid, at timestamptz) returns jsonb
language sql stable security definer set search_path = '' as $$
  with mine as (
    select a.target_id from public.activity a
    where a.family_id = public.my_family_id() and public._activity_key(a.payload, a.id) = p_key
  ),
  rows as (
    select id, updated_at, updated_by from public.event_members where event_id = eid
    union all select id, updated_at, updated_by from public.event_exceptions where event_id = eid
    union all select id, updated_at, updated_by from public.event_checklist_items where event_id = eid
    union all select id, updated_at, updated_by from public.event_surprise where event_id = eid
    union all select id, updated_at, updated_by from public.event_share_links where event_id = eid
  )
  select jsonb_build_object('by', r.updated_by)
  from rows r
  where exists (select 1 from public.events e where e.id = eid and e.family_id = public.my_family_id())
    and (r.updated_at > at or r.id not in (select target_id from mine where target_id is not null))
  order by r.updated_at desc
  limit 1;
$$;
revoke all on function public._event_changed_outside(uuid, uuid, timestamptz) from public, anon;
grant execute on function public._event_changed_outside(uuid, uuid, timestamptz) to authenticated;

-- As in spec 026, plus the calendar's tables. An event the call added is removed for good, as the
-- app's Undo right after adding does (spec 041 FR-009), with its rows: nothing to restore later
-- that would repeat dates the series has again. Rows are put back in an order that keeps the
-- tables' rules: what the call added goes first (a member taken off and put back on an event has a
-- new row), then changes, then removed rows come back, and the events the call added go last
-- (removing them takes their dates with them).
create or replace function public.undo_ai_change(p_key uuid, p_skip_changed boolean default false) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  stamps constant text[] := array['id', 'family_id', 'created_by', 'created_at', 'source', 'updated_at', 'updated_by'];
  tables constant text[] := array['recipes', 'recipe_ingredients', 'recipe_steps', 'recipe_variants', 'grocery_items', 'grocery_recipes',
    'events', 'event_members', 'event_exceptions', 'event_checklist_items', 'event_surprise'];
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
  lasts := case when kind in ('recipe_deleted', 'event_deleted') then interval '30 days' else interval '7 days' end;
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
      max(a.created_at) as at,
      min(a.seq) as seq
    from public.activity a
    where public._activity_key(a.payload, a.id) = p_key and a.action in ('insert', 'update', 'delete') and a.source <> 'app'
      and a.target_id is not null
    group by a.target_kind, a.target_id
    order by min(a.seq)
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
    elsif t.tbl = 'events' and t.first_op = 'insert' and public._event_changed_outside(t.id, p_key, t.at) is not null then
      -- Someone added to it since (a date, a checklist item, a share link): it stays.
      conflict := jsonb_build_object('kind', 'edited', 'by', public._event_changed_outside(t.id, p_key, t.at) ->> 'by');
    elsif t.tbl = 'grocery_items' and t.before is not null and t.before ->> 'deleted_at' is null
      and cur ->> 'deleted_at' is not null and (cur ->> 'deleted_at')::timestamptz < now() - interval '1 day' then
      -- Cleared over a day ago: the nightly purge is about to take it (spec 020), so it stays cleared.
      conflict := jsonb_build_object('kind', 'gone', 'by', null);
    end if;
    if conflict is not null then
      conflicts := conflicts || jsonb_build_array(conflict);
    else
      safe := safe || jsonb_build_array(jsonb_build_object('tbl', t.tbl, 'id', t.id, 'first_op', t.first_op, 'before', t.before, 'exists', cur is not null,
        'parent', coalesce(cur ->> 'recipe_id', cur ->> 'event_id'), 'seq', t.seq,
        'step', case when t.first_op = 'insert' and t.tbl = 'events' then 3 when t.first_op = 'insert' then 0 when cur is not null then 1 else 2 end));
      if t.tbl in ('recipes', 'events') and t.first_op = 'insert' then
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

  for s in select x from jsonb_array_elements(safe) x order by (x ->> 'step')::int, (x ->> 'seq')::bigint loop
    if s ->> 'first_op' = 'insert' then
      -- What the call added goes. A new recipe’s own rows stay with it in Recently deleted; a new
      -- event goes for good, with its rows.
      if s ->> 'tbl' in ('recipes', 'grocery_items') then
        execute format('update public.%I set deleted_at = now() where id = $1 and deleted_at is null', s ->> 'tbl') using (s ->> 'id')::uuid;
      elsif s ->> 'tbl' = 'events' then
        update public.events set deleted_at = now() where id = (s ->> 'id')::uuid and deleted_at is null;
        delete from public.events where id = (s ->> 'id')::uuid and deleted_at is not null;
      elsif s ->> 'tbl' = 'grocery_recipes' then
        -- Never removed by people (spec 022): it waits, unused, until the recipe is added again.
        continue;
      elsif (s ->> 'parent')::uuid = any (dropped) then
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
      -- Removed (a step or variant a save left out, L37; who an event was for): back with its own id.
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
  values (public.my_family_id(), auth.uid(), case when kind in ('recipe_deleted', 'event_deleted') then 'restore' else 'undo' end, 'activity', p_key,
    jsonb_build_object('kind', kind, 'skipped', (select coalesce(sum((c ->> 'count')::int), 0) from jsonb_array_elements(conflicts) c)));
  return jsonb_build_object('applied', true, 'kind', kind, 'done', done, 'conflicts', conflicts);
end;
$$;
