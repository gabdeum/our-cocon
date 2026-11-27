-- Spec 075: checklists in notes replace the event's "Bring" checklist (spec 042). Each event's items
-- move into its notes as `- [ ]` / `- [x]` lines, then the table and everything that names it go.
-- Also `set_event_notes`, which saves a tick made in the event page (FR-002, FR-003, FR-008).

-- --- Move the items into the notes (FR-009) -----------------------------------------------------

-- An event's items as checklist lines, in order. A label can't hold a line break, but a stray one
-- would split the item, so it reads as a space.
create function pg_temp.checklist_lines(eid uuid) returns text
language sql stable as $$
  select string_agg('- [' || case when c.done then 'x' else ' ' end || '] ' || regexp_replace(c.label, '\s*[\r\n]+\s*', ' ', 'g'),
    E'\n' order by c.position)
  from public.event_checklist_items c where c.event_id = eid;
$$;

-- The note with the list after a blank line; the list alone when there's no note.
create function pg_temp.with_checklist(notes text, list text) returns text
language sql immutable as $$
  select case when nullif(btrim(notes), '') is null then list else notes || E'\n\n' || list end;
$$;

do $$
declare
  too_long text;
begin
  -- Nothing is dropped silently: a note that would pass the limit (5000) stops the migration.
  select string_agg(distinct x.event_id::text, ', ') into too_long from (
    select e.id as event_id, pg_temp.with_checklist(e.notes, l.list) as notes
      from public.events e cross join lateral (select pg_temp.checklist_lines(e.id) as list) l
      where l.list is not null
    union all
    -- A date with its own notes shows those instead of the series': it gets the list too, so the
    -- items still show on that date, as the "Bring" card did.
    select x.event_id, pg_temp.with_checklist(x.override ->> 'notes', l.list)
      from public.event_exceptions x cross join lateral (select pg_temp.checklist_lines(x.event_id) as list) l
      where l.list is not null and x.override ? 'notes'
  ) x where char_length(x.notes) > 5000;
  if too_long is not null then
    raise exception 'checklist_notes_too_long: %', too_long
      using hint = 'Shorten these events'' notes or checklists, then run the migration again.';
  end if;
end;
$$;

-- Moving data isn't anyone's edit: no activity entry, no "edited by", no permission check.
alter table public.events disable trigger user;
alter table public.event_exceptions disable trigger user;

update public.events e set notes = pg_temp.with_checklist(e.notes, l.list)
  from (select c.event_id, pg_temp.checklist_lines(c.event_id) as list from public.event_checklist_items c group by c.event_id) l
  where l.event_id = e.id;

update public.event_exceptions x set override = jsonb_set(x.override, '{notes}', to_jsonb(pg_temp.with_checklist(x.override ->> 'notes', l.list)))
  from (select c.event_id, pg_temp.checklist_lines(c.event_id) as list from public.event_checklist_items c group by c.event_id) l
  where l.event_id = x.event_id and x.override ? 'notes';

alter table public.events enable trigger user;
alter table public.event_exceptions enable trigger user;

-- --- Remove the checklist ---------------------------------------------------------------------------

-- Takes its policies, triggers (stamp, broadcast, permission, activity) and grants with it.
drop table public.event_checklist_items;
drop function public._stamp_checklist_done();

-- `save_event` and `split_event` without `p_checklist`; otherwise as before.
drop function public.split_event(uuid, date, jsonb, jsonb, jsonb, jsonb, jsonb);
drop function public.save_event(jsonb, jsonb, uuid, jsonb, jsonb);

-- As spec 041 wrote it, without the checklist.
create function public.save_event(p_event jsonb, p_members jsonb, p_id uuid default null, p_surprise jsonb default null)
returns uuid
language plpgsql set search_path = '' as $$
declare
  e public.events := jsonb_populate_record(null::public.events, p_event);
  eid uuid;
begin
  if p_id is null then
    insert into public.events (title, category, location, notes, starts_on, ends_on, time_type, slots, start_time, end_time,
      recurrence, reminder, responsible_member_id, visibility)
    values (e.title, e.category, e.location, e.notes, e.starts_on, e.ends_on, e.time_type, coalesce(e.slots, '{}'), e.start_time, e.end_time,
      e.recurrence, coalesce(e.reminder, 'none'), e.responsible_member_id, coalesce(e.visibility, 'family'))
    returning id into eid;
  else
    update public.events set title = e.title, category = e.category, location = e.location, notes = e.notes,
      starts_on = e.starts_on, ends_on = e.ends_on, time_type = e.time_type, slots = coalesce(e.slots, '{}'),
      start_time = e.start_time, end_time = e.end_time, recurrence = e.recurrence, reminder = coalesce(e.reminder, 'none'),
      responsible_member_id = e.responsible_member_id, visibility = coalesce(e.visibility, 'family')
    where id = p_id and deleted_at is null
    returning id into eid;
    if eid is null then
      raise exception 'event_not_found' using errcode = 'P0002';
    end if;
  end if;

  if jsonb_typeof(p_members) <> 'array' or jsonb_array_length(p_members) = 0 then
    raise exception 'members_needed' using errcode = '22023';
  end if;
  delete from public.event_members m where m.event_id = eid and m.who <> 'removed';
  insert into public.event_members (event_id, who, member_id)
    select eid, case when w in ('everyone', 'others') then w else 'member' end, case when w in ('everyone', 'others') then null else w::uuid end
    from (select distinct jsonb_array_elements_text(p_members) as w) x;

  if coalesce(e.visibility, 'family') <> 'surprise' then
    delete from public.event_surprise s where s.event_id = eid;
  elsif p_surprise is not null and not exists (
    select 1 from public.event_surprise s where s.event_id = eid
      and s.hidden_from = array(select jsonb_array_elements_text(p_surprise -> 'hidden_from')::uuid)
      and s.cover_title = p_surprise ->> 'cover_title' and s.cover_note is not distinct from p_surprise ->> 'cover_note'
  ) then
    insert into public.event_surprise (event_id, hidden_from, cover_title, cover_note)
      values (eid, array(select jsonb_array_elements_text(p_surprise -> 'hidden_from')::uuid), p_surprise ->> 'cover_title', p_surprise ->> 'cover_note')
      on conflict (event_id) do update set hidden_from = excluded.hidden_from, cover_title = excluded.cover_title, cover_note = excluded.cover_note;
  end if;

  return eid;
end;
$$;
revoke all on function public.save_event(jsonb, jsonb, uuid, jsonb) from public, anon;
grant execute on function public.save_event(jsonb, jsonb, uuid, jsonb) to authenticated, cocon_assistant;

-- As spec 044 wrote it, without the checklist. The new series' notes come from the caller, which
-- unticks their checklist (FR-008).
create function public.split_event(p_id uuid, p_from date, p_before jsonb, p_event jsonb, p_members jsonb,
  p_surprise jsonb default null)
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
  eid := public.save_event(p_event, p_members, null, p_surprise);
  update public.event_exceptions set event_id = eid where event_id = old.id and occurrence_date >= p_from;
  return eid;
end;
$$;
revoke all on function public.split_event(uuid, date, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.split_event(uuid, date, jsonb, jsonb, jsonb, jsonb) to authenticated, cocon_assistant;

-- `events_visible` without `checklist` (a view's columns can't change in place).
drop view public.events_visible;
drop function public._events_visible();

-- As spec 043 wrote it, without the checklist.
create function public._events_visible() returns table (
  id uuid, family_id uuid, title text, category text, location text, notes text,
  starts_on date, ends_on date, time_type text, slots text[], start_time text, end_time text,
  recurrence jsonb, reminder text, responsible_member_id uuid, visibility text, creator_member_id uuid,
  members jsonb, removed_members jsonb, exceptions jsonb, surprise jsonb,
  created_by uuid, updated_by uuid, source text, created_at timestamptz, updated_at timestamptz,
  deleted_at timestamptz, deleted_by uuid, view text
)
language sql stable security definer set search_path = '' as $$
  with me as (
    select m.id as member_id, m.family_id from public.members m where m.user_id = auth.uid()
  ),
  seen as (
    select e.*, cm.id as creator_member, s.hidden_from, s.cover_title, s.cover_note,
      case
        when e.visibility = 'family' then 'full'
        -- First, so nothing (not even a creator who left) shows the hidden person it's a surprise.
        when e.visibility = 'surprise' and s.id is not null and me.member_id = any (s.hidden_from) then 'cover'
        when cm.id is null then 'busy'
        when cm.id = me.member_id then 'full'
        when e.visibility = 'surprise' and s.id is not null then 'full'
        else 'busy'
      end as view
    from public.events e
    join me on me.family_id = e.family_id
    left join public.members cm on cm.user_id = e.created_by and cm.family_id = e.family_id
    left join public.event_surprise s on s.event_id = e.id
  )
  select v.id, v.family_id,
    case v.view when 'busy' then 'Busy' when 'cover' then v.cover_title else v.title end,
    case when v.view = 'full' then v.category end,
    case when v.view <> 'busy' then v.location end,
    case v.view when 'full' then v.notes when 'cover' then v.cover_note end,
    v.starts_on, v.ends_on, v.time_type, v.slots, v.start_time, v.end_time,
    case when v.view = 'full' or v.recurrence is null then v.recurrence
      else jsonb_strip_nulls(jsonb_build_object('freq', v.recurrence -> 'freq', 'weekdays', v.recurrence -> 'weekdays',
        'ends', jsonb_strip_nulls(jsonb_build_object('type', v.recurrence #> '{ends,type}', 'date', v.recurrence #> '{ends,date}', 'count', v.recurrence #> '{ends,count}')))) end,
    case v.view when 'full' then v.reminder when 'cover' then 'none' end,
    case when v.view = 'full' then v.responsible_member_id end,
    case when v.view = 'cover' then 'family' else v.visibility end,
    v.creator_member,
    coalesce((select jsonb_agg(case em.who when 'member' then to_jsonb(em.member_id) else to_jsonb(em.who) end order by em.created_at, em.id)
      from public.event_members em where em.event_id = v.id and em.who <> 'removed'), '[]'),
    coalesce((select jsonb_agg(em.removed_name order by em.created_at, em.id)
      from public.event_members em where em.event_id = v.id and em.who = 'removed'), '[]'),
    coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'occurrence_date', x.occurrence_date,
        'cancelled', x.cancelled,
        'override', case when v.view = 'full' or x.override is null then x.override else (
          select coalesce(jsonb_object_agg(o.key, o.value), '{}') from jsonb_each(x.override) o
          where o.key = any (array['starts_on', 'ends_on', 'time_type', 'slots', 'start_time', 'end_time', 'members']
            || case when v.view = 'cover' then array['location'] else array[]::text[] end)
        ) end
      )) order by x.occurrence_date)
      from public.event_exceptions x where x.event_id = v.id), '[]'),
    case when v.view = 'full' and v.visibility = 'surprise' and v.cover_title is not null
      then jsonb_strip_nulls(jsonb_build_object('hidden_from', to_jsonb(v.hidden_from), 'cover_title', v.cover_title, 'cover_note', v.cover_note)) end,
    v.created_by, v.updated_by, v.source::text, v.created_at, v.updated_at, v.deleted_at, v.deleted_by,
    case when v.view = 'cover' and auth.jwt() ->> 'client_id' is not null then 'full' else v.view end
  from seen v;
$$;
create view public.events_visible with (security_invoker = true) as
  select * from public._events_visible();

revoke all on public.events_visible from anon, authenticated;
-- Signed-out callers get no rows anyway; they don't get to call it either.
revoke all on function public._events_visible() from public, anon;
grant select on public.events_visible to authenticated, cocon_assistant;
grant execute on function public._events_visible() to authenticated, cocon_assistant;

-- The activity functions' table lists, without the checklist (as spec 054 and 044 wrote them).
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
  elsif tg_table_name in ('events', 'event_members', 'event_exceptions', 'event_surprise') then
    if not public.ai_allowed('events') then
      raise exception 'events' using errcode = '42501', hint = 'ai_not_allowed';
    end if;
  elsif tg_table_name in ('reminders', 'reminder_occurrences') then
    if not public.ai_allowed('reminders') then
      raise exception 'reminders' using errcode = '42501', hint = 'ai_not_allowed';
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
  if tg_op = 'UPDATE' and (r - 'updated_at' - 'updated_by') = (was - 'updated_at' - 'updated_by') then
    return null;
  end if;
  if auth.jwt() ->> 'client_id' is null then
    if auth.uid() is not null then
      perform public._log_app_write(tg_op, tg_table_name, r, was);
    end if;
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
  if tg_table_name in ('events', 'event_members', 'event_exceptions', 'event_surprise') then
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
    'reminder_id', case when tg_table_name = 'reminders' then r ->> 'id' when tg_table_name = 'reminder_occurrences' then r ->> 'reminder_id' end,
    'secret', case when secret then true end,
    'call_id', case when call_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then call_id end,
    'tool', case when tool ~ '^[a-z][a-z_]{0,39}$' then tool end,
    'name', case when tg_table_name in ('recipes', 'grocery_items') then r ->> 'name' when tg_table_name in ('events', 'reminders') then r ->> 'title' end,
    'after_hash', case when tg_op <> 'DELETE' then public._row_fingerprint(r) end,
    -- Going to Recently deleted: what makes an entry a delete (Restore), not its label.
    'deleted', case when tg_table_name in ('recipes', 'events', 'reminders') and tg_op = 'UPDATE' and was ->> 'deleted_at' is null and r ->> 'deleted_at' is not null then true end,
    -- A reminder ticked off for good (a one-off, or the last date): what makes complete_reminder's entry a tick.
    'completed', case when tg_table_name = 'reminders' and tg_op = 'UPDATE' and was ->> 'completed_at' is null and r ->> 'completed_at' is not null then true end,
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

-- Older entries that wrote checklist items: Undo skips those rows (not in `tables`); the rest of
-- the call is undone as before.
create or replace function public._undo_ai_change(p_key uuid, p_skip_changed boolean default false) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  stamps constant text[] := array['id', 'family_id', 'created_by', 'created_at', 'source', 'updated_at', 'updated_by'];
  tables constant text[] := array['recipes', 'recipe_ingredients', 'recipe_steps', 'recipe_variants', 'grocery_items', 'grocery_recipes',
    'events', 'event_members', 'event_exceptions', 'event_surprise', 'reminders', 'reminder_occurrences'];
  restores constant text[] := array['recipe_deleted', 'event_deleted', 'reminder_deleted'];
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
  lasts := case when kind = any (restores) then interval '30 days' else interval '7 days' end;
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
      -- Someone added to it since (a date, a share link): it stays.
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
        'parent', coalesce(cur ->> 'recipe_id', cur ->> 'event_id', cur ->> 'reminder_id'), 'seq', t.seq,
        'step', case when t.first_op = 'insert' and t.tbl in ('events', 'reminders') then 3 when t.first_op = 'insert' then 0 when cur is not null then 1 else 2 end));
      if t.tbl in ('recipes', 'events', 'reminders') and t.first_op = 'insert' then
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
      -- event or reminder goes for good, with its rows.
      if s ->> 'tbl' in ('recipes', 'grocery_items') then
        execute format('update public.%I set deleted_at = now() where id = $1 and deleted_at is null', s ->> 'tbl') using (s ->> 'id')::uuid;
      elsif s ->> 'tbl' in ('events', 'reminders') then
        execute format('update public.%I set deleted_at = now() where id = $1 and deleted_at is null', s ->> 'tbl') using (s ->> 'id')::uuid;
        execute format('delete from public.%I where id = $1 and deleted_at is not null', s ->> 'tbl') using (s ->> 'id')::uuid;
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
  values (public.my_family_id(), auth.uid(), case when kind = any (restores) then 'restore' else 'undo' end, 'activity', p_key,
    jsonb_build_object('kind', kind, 'skipped', (select coalesce(sum((c ->> 'count')::int), 0) from jsonb_array_elements(conflicts) c)));
  return jsonb_build_object('applied', true, 'kind', kind, 'done', done, 'conflicts', conflicts);
end;
$$;

-- Whether anything of an event the call `p_key` added was changed outside it since `at`: who it's
-- for, a date, its surprise or a share link that isn't the call's own row, or one changed later.
create or replace function public._event_changed_outside(eid uuid, p_key uuid, at timestamptz) returns jsonb
language sql stable security definer set search_path = '' as $$
  with mine as (
    select a.target_id from public.activity a
    where a.family_id = public.my_family_id() and public._activity_key(a.payload, a.id) = p_key
  ),
  rows as (
    select id, updated_at, updated_by from public.event_members where event_id = eid
    union all select id, updated_at, updated_by from public.event_exceptions where event_id = eid
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

-- --- Saving a tick (FR-002, FR-003, FR-005, FR-008) -----------------------------------------------

-- Saves the notes the event shows on `p_date` (its first date for a one-off), only if they are still
-- `p_from`: a tick made on what the person saw never overwrites someone else's edit. That date's
-- own notes when it has some (`event_exceptions.override`), otherwise the series'. Runs as the
-- caller, so the policies (only those who see the event), the activity log and the assistants'
-- switch apply as for any edit. True when saved, false when the notes changed (or the event is gone).
create function public.set_event_notes(p_event uuid, p_date date, p_from text, p_to text) returns boolean
language plpgsql set search_path = '' as $$
declare
  n integer;
begin
  -- A tick never empties a note (and a null would wipe that date's whole override).
  if p_to is null or btrim(p_to) = '' then
    raise exception 'notes_needed' using errcode = '22023';
  end if;
  update public.event_exceptions x set override = jsonb_set(x.override, '{notes}', to_jsonb(p_to))
    where x.event_id = p_event and x.occurrence_date = p_date and x.override ->> 'notes' = p_from;
  get diagnostics n = row_count;
  if n > 0 then
    return true;
  end if;
  if exists (select 1 from public.event_exceptions x where x.event_id = p_event and x.occurrence_date = p_date and x.override ? 'notes') then
    return false;
  end if;
  update public.events e set notes = p_to where e.id = p_event and e.notes = p_from and e.deleted_at is null;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;
revoke all on function public.set_event_notes(uuid, date, text, text) from public, anon;
grant execute on function public.set_event_notes(uuid, date, text, text) to authenticated;
