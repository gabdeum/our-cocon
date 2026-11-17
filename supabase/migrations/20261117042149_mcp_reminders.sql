-- Spec 060: AI assistants list, add, change, tick off, snooze and delete reminders, within what each
-- member allows them. Also 032-later L144: the family's own reminder changes in the activity log.
--   - A new per-member permission, "Add & change reminders" (`reminders`), Allowed until changed,
--     checked by the database on every assistant write to the reminders' tables (as spec 044's).
--   - The assistant role gets what the reminder tools need, through the member's own policies. It
--     never removes a reminder for good: only a member does, from Recently deleted.
--   - Every assistant write is logged for spec 026 (activity and Undo); a reminder an assistant
--     deleted is restored like an event, for 30 days.
--   - The app's own reminder writes are logged too (spec 028 FR-009): added, edited, ticked off,
--     reopened (the tick's Undo), snoozed, deleted and restored. Closing what was missed (catch-up)
--     isn't anyone's action and isn't logged.
--   - `reminders_section` can keep one person's reminders (`p_assignee`), for list_reminders.

-- --- Permission (FR-002) ----------------------------------------------------------------------------

alter table public.ai_permissions add column reminders boolean not null default true;

create or replace function public.ai_allowed(permission text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when permission is null or permission not in ('recipes_edit', 'groceries', 'events', 'reminders', 'recipes_delete') then false
    when auth.jwt() ->> 'client_id' is null then true
    else coalesce((
      select case permission
        when 'recipes_edit' then p.recipes_edit
        when 'groceries' then p.groceries
        when 'events' then p.events
        when 'reminders' then p.reminders
        else p.recipes_delete
      end
      from public.ai_permissions p where p.user_id = auth.uid()), true)
  end;
$$;

-- As in spec 044, plus the reminders' tables: any change to a reminder or its history needs
-- `reminders` (deleting one too: there's no separate switch for it).
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

create trigger a_ai_permission before insert or update or delete on public.reminders
  for each row execute function public._check_ai_permission();
create trigger a_ai_permission before insert or update or delete on public.reminder_occurrences
  for each row execute function public._check_ai_permission();

-- --- The reminder tools (FR-001) ------------------------------------------------------------------

-- Add, change, tick off (reminder_apply), snooze, and delete by setting deleted_at (Recently
-- deleted). No DELETE. `select` covers what the tools read back.
grant select,
  insert (family_id, title, notes, assignee_id, due_at, has_time, repeat_rule, repeat_from, next_due_at, rollover, snoozed_until),
  update (title, notes, assignee_id, due_at, has_time, repeat_rule, repeat_from, next_due_at, rollover, snoozed_until, completed_at, deleted_at)
  on public.reminders to cocon_assistant;
-- The occurrences a tick closes.
grant select, insert on public.reminder_occurrences to cocon_assistant;

alter policy "members read their family's rows" on public.reminders to authenticated, cocon_assistant;
alter policy "members add to their family" on public.reminders to authenticated, cocon_assistant;
alter policy "members change their family's rows" on public.reminders to authenticated, cocon_assistant;
alter policy "members read their family's rows" on public.reminder_occurrences to authenticated, cocon_assistant;
alter policy "members add to their family" on public.reminder_occurrences to authenticated, cocon_assistant;

-- As spec 058 left it, plus whose reminders: `p_assignee` 'everyone' (Everyone's only) or a member's
-- id (theirs only); null keeps everyone's. "Mine" asks `_my_member_id`: assistants can't use the
-- `auth` schema. The arguments change, so it's made again.
drop function public.reminders_section(text, boolean, integer, timestamptz, uuid, text);
create function public.reminders_section(
  p_section text, p_mine boolean, p_limit integer, p_after_sort timestamptz default null, p_after_id uuid default null, p_tz text default null,
  p_assignee text default null
) returns setof jsonb
language plpgsql stable set search_path = '' as $$
begin
  if p_section is null or p_section not in ('overdue', 'today', 'tomorrow', 'later', 'snoozed') then
    raise exception 'unknown_section' using errcode = '22023';
  end if;
  if (p_after_sort is null) <> (p_after_id is null) then
    raise exception 'bad_cursor' using errcode = '22023';
  end if;
  if p_assignee is not null and p_assignee <> 'everyone' and p_assignee !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'bad_assignee' using errcode = '22023';
  end if;
  return query
    select to_jsonb(s) from public._reminder_state(public.my_family_id(), p_tz, now()) s
    where (case when p_section = 'snoozed' then s.snoozed else s.section = p_section end)
      and (not coalesce(p_mine, false) or s.assignee_id is null or s.assignee_id = public._my_member_id())
      and (p_assignee is null or (p_assignee = 'everyone' and s.assignee_id is null) or s.assignee_id::text = p_assignee)
      and (p_after_sort is null or (s.sort_at, s.id) > (p_after_sort, p_after_id))
    order by s.sort_at, s.id
    limit least(greatest(coalesce(p_limit, 20), 1), 51);
end;
$$;
grant execute on function public.reminders_section(text, boolean, integer, timestamptz, uuid, text, text) to authenticated, service_role, cocon_assistant;
grant execute on function public._my_member_id() to authenticated, service_role;
grant execute on function public._reminder_time_zone(uuid, text), public._reminder_state(uuid, text, timestamptz),
  public.reminder_apply(uuid, timestamptz, jsonb, timestamptz, boolean, timestamptz, timestamptz)
  to cocon_assistant;

-- As in spec 056, telling the log what moved the reminder (`cocon.reminder_move`): a tick (it closes
-- a done occurrence, or completes a one-off), or catching up on what was missed. Anyone can call it
-- with any arguments, so a catch-up is only what `catchUp` sends: past dates closed as missed or
-- skipped from the open one on, moving forward, the snooze kept or cleared. Anything else is logged
-- as the change it makes. Off again after.
create or replace function public.reminder_apply(
  p_id uuid, p_from_due_at timestamptz, p_closed jsonb, p_due_at timestamptz, p_complete boolean,
  p_next_due_at timestamptz default null, p_snoozed_until timestamptz default null
) returns boolean
language plpgsql set search_path = '' as $$
declare
  fam uuid;
  closed jsonb := coalesce(p_closed, '[]'::jsonb);
  snoozed timestamptz;
  move text := '';
begin
  if jsonb_typeof(closed) <> 'array' or jsonb_array_length(closed) > 2000 then
    raise exception 'bad_closed' using errcode = '22023';
  end if;
  select r.snoozed_until into snoozed from public.reminders r where r.id = p_id;
  if exists (select 1 from jsonb_array_elements(closed) c where c ->> 'status' = 'done') or (p_complete and jsonb_array_length(closed) = 0) then
    move := 'tick';
  elsif jsonb_array_length(closed) > 0 and not coalesce(p_complete, false) and p_due_at > p_from_due_at and p_due_at <= now()
    and (p_snoozed_until is null or p_snoozed_until = snoozed)
    and (select min((c ->> 'due_at')::timestamptz) from jsonb_array_elements(closed) c) = p_from_due_at
    and not exists (select 1 from jsonb_array_elements(closed) c
      where c ->> 'status' not in ('missed', 'skipped') or (c ->> 'due_at')::timestamptz >= p_due_at) then
    move := 'catch_up';
  end if;
  perform set_config('cocon.reminder_move', move, true);
  update public.reminders r set due_at = p_due_at, next_due_at = p_next_due_at, snoozed_until = p_snoozed_until,
      completed_at = case when p_complete then now() end
    where r.id = p_id and r.due_at = p_from_due_at and r.deleted_at is null and r.completed_at is null
    returning r.family_id into fam;
  if fam is null then
    perform set_config('cocon.reminder_move', '', true);
    return false;
  end if;
  insert into public.reminder_occurrences (family_id, reminder_id, due_at, status)
    select fam, p_id, (c ->> 'due_at')::timestamptz, c ->> 'status'
    from jsonb_array_elements(closed) c
    on conflict (reminder_id, due_at) do nothing;
  perform set_config('cocon.reminder_move', '', true);
  return true;
end;
$$;

-- As in spec 056: the Undo of a tick, told to the log as a reopen when it is one (it reopens done
-- dates of this reminder, or a completed one-off). Anything else is logged as the change it makes.
create or replace function public.reminder_revert(
  p_id uuid, p_from_due_at timestamptz, p_reopen timestamptz[], p_due_at timestamptz,
  p_next_due_at timestamptz default null, p_snoozed_until timestamptz default null
) returns boolean
language plpgsql set search_path = '' as $$
declare
  reopen timestamptz[] := coalesce(p_reopen, '{}');
  reopens boolean;
begin
  reopens := case
    when cardinality(reopen) = 0 then exists (select 1 from public.reminders r where r.id = p_id and r.completed_at is not null and r.repeat_rule is null)
    else (select count(*) from public.reminder_occurrences o where o.reminder_id = p_id and o.status = 'done' and o.due_at = any (reopen))
      = (select count(distinct x) from unnest(reopen) x)
  end;
  perform set_config('cocon.reminder_move', case when reopens then 'revert' else '' end, true);
  update public.reminders r set due_at = p_due_at, next_due_at = p_next_due_at, snoozed_until = p_snoozed_until, completed_at = null
    where r.id = p_id and r.due_at = p_from_due_at and r.deleted_at is null;
  if not found then
    perform set_config('cocon.reminder_move', '', true);
    return false;
  end if;
  delete from public.reminder_occurrences o where o.reminder_id = p_id and o.due_at = any (reopen);
  perform set_config('cocon.reminder_move', '', true);
  return true;
end;
$$;

-- --- The activity log (FR-003, L144) --------------------------------------------------------------

-- As in spec 053, plus reminders: added, edited (within 10 minutes, like an event), ticked off,
-- reopened, snoozed, deleted and restored. A reminder has no secrets, so its row keeps its title
-- (`name`), read when the reminder is gone for good.
create or replace function public._log_app_write(op text, tbl text, r jsonb, was jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  fam uuid := (r ->> 'family_id')::uuid;
  kind text;
  subject text;
  joins text[] := '{}';
  span interval;
  key uuid;
  recipe uuid;
  eid uuid;
  rid uuid;
  vis text;
  move text;
  payload jsonb;
  stamps constant text[] := array['updated_at', 'updated_by', 'created_by', 'checked_by', 'deleted_by'];
begin
  -- Only a member's own changes to their family: not the cascade of an account or family being
  -- deleted, nor who-stamps a departure clears, nor what Undo puts back (its own entry says so).
  if fam is distinct from public.my_family_id() or op = 'UPDATE' and (r - stamps) = (was - stamps)
    or current_setting('cocon.undoing', true) = 'on' then
    return;
  end if;
  case
    when tbl = 'recipes' then
      recipe := (r ->> 'id')::uuid;
      subject := 'recipe:' || recipe;
      if op = 'INSERT' then
        kind := 'recipe_created';
      elsif op = 'UPDATE' and was ->> 'deleted_at' is null and r ->> 'deleted_at' is not null then
        kind := 'recipe_deleted';
      elsif op = 'UPDATE' and was ->> 'deleted_at' is not null and r ->> 'deleted_at' is null then
        kind := 'recipe_restored';
      elsif op = 'UPDATE' and r ->> 'deleted_at' is null then
        kind := 'recipe_edited';
      end if;
    when tbl in ('recipe_ingredients', 'recipe_steps', 'recipe_variants') then
      recipe := (r ->> 'recipe_id')::uuid;
      subject := 'recipe:' || recipe;
      -- Not for a recipe that's gone or in Recently deleted (its rows going with it).
      if exists (select 1 from public.recipes x where x.id = recipe and x.deleted_at is null) then
        kind := 'recipe_edited';
      end if;
    when tbl = 'grocery_items' then
      recipe := (r ->> 'recipe_id')::uuid;
      if op = 'INSERT' then
        kind := 'groceries_added';
      elsif op = 'UPDATE' and r ->> 'deleted_at' is null
        and not coalesce((was ->> 'checked')::boolean, false) and coalesce((r ->> 'checked')::boolean, false) then
        kind := 'groceries_ticked';
      elsif op = 'UPDATE' and was ->> 'deleted_at' is null and r ->> 'deleted_at' is not null and coalesce((was ->> 'checked')::boolean, false) then
        kind := 'groceries_cleared';
      end if;
      subject := 'groceries:' || kind;
    when tbl = 'events' then
      eid := (r ->> 'id')::uuid;
      if op = 'INSERT' then
        kind := 'event_created';
      elsif op = 'UPDATE' and was ->> 'deleted_at' is null and r ->> 'deleted_at' is not null then
        kind := 'event_deleted';
      elsif op = 'UPDATE' and r ->> 'deleted_at' is null and was ->> 'deleted_at' is null then
        kind := 'event_edited';
      end if;
    when tbl in ('event_members', 'event_exceptions', 'event_surprise') then
      eid := (r ->> 'event_id')::uuid;
      -- Not for an event that's gone or in Recently deleted (its rows going with it).
      if exists (select 1 from public.events e where e.id = eid and e.deleted_at is null) then
        kind := 'event_edited';
      end if;
    when tbl = 'reminders' then
      rid := (r ->> 'id')::uuid;
      subject := 'reminder:' || rid;
      move := current_setting('cocon.reminder_move', true);
      if op = 'INSERT' then
        kind := 'reminder_created';
      elsif op = 'UPDATE' and was ->> 'deleted_at' is null and r ->> 'deleted_at' is not null then
        kind := 'reminder_deleted';
      elsif op = 'UPDATE' and was ->> 'deleted_at' is not null and r ->> 'deleted_at' is null then
        kind := 'reminder_restored';
      elsif op = 'UPDATE' and r ->> 'deleted_at' is null then
        kind := case
          when move = 'tick' then 'reminder_completed'
          when move = 'revert' then 'reminder_reopened'
          -- Catching up on what was missed: nobody's action.
          when move = 'catch_up' then null
          when r ->> 'snoozed_until' is not null and (r - stamps - 'snoozed_until') = (was - stamps - 'snoozed_until') then 'reminder_snoozed'
          else 'reminder_edited'
        end;
      end if;
    else
      null;
  end case;
  if kind is null then
    return;
  end if;
  if eid is not null then
    subject := 'event:' || eid;
    select e.visibility into vis from public.events e where e.id = eid;
  end if;

  joins := case kind
    when 'recipe_edited' then array['recipe_created', 'recipe_edited']
    when 'event_edited' then array['event_created', 'event_edited']
    when 'reminder_edited' then array['reminder_created', 'reminder_edited']
    when 'groceries_added' then array['groceries_added']
    when 'groceries_ticked' then array['groceries_ticked']
    when 'groceries_cleared' then array['groceries_cleared']
    else '{}'
  end;
  span := case when kind in ('groceries_added', 'groceries_cleared') then interval '30 seconds' else interval '10 minutes' end;
  -- Requests of one action can run at once: one at a time per person and subject, so they find
  -- each other's entry (each statement reads what committed before it).
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || subject, 0));
  if cardinality(joins) > 0 then
    select public._activity_key(a.payload, a.id) into key
    from public.activity a
    where a.family_id = fam and a.actor_id = auth.uid() and a.source = 'app'
      and a.payload ->> 'subject' = subject and a.payload ->> 'kind' = any (joins)
      and a.created_at > now() - span
    group by 1
    having min(a.created_at) > now() - span
    order by max(a.seq) desc
    limit 1;
  end if;

  select coalesce(jsonb_object_agg(k, v), '{}') into payload
  from jsonb_each(jsonb_build_object(
    'call_id', coalesce(key, gen_random_uuid()),
    'kind', kind,
    'subject', subject,
    'recipe_id', recipe,
    'event_id', eid,
    'reminder_id', rid,
    'secret', case when vis <> 'family' then true end,
    'surprise', case when vis = 'surprise' then true end,
    'name', case when tbl in ('recipes', 'grocery_items') then r ->> 'name' when tbl = 'reminders' then r ->> 'title' end)) as e (k, v)
  where v <> 'null'::jsonb;
  insert into public.activity (family_id, actor_id, action, target_kind, target_id, payload)
  values (fam, auth.uid(), lower(op), tbl, (r ->> 'id')::uuid, payload);
end;
$$;
revoke all on function public._log_app_write(text, text, jsonb, jsonb) from public, anon, authenticated;

-- As in spec 053, plus the reminders' rows: the reminder they belong to (`reminder_id`), its title
-- (`name`), `deleted` when one goes to Recently deleted (Restore), and `completed` when one is done.
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

create trigger reminders_log_assistant after insert or update or delete on public.reminders
  for each row execute function public._log_assistant_write();
create trigger reminder_occurrences_log_assistant after insert or update or delete on public.reminder_occurrences
  for each row execute function public._log_assistant_write();

-- As in spec 053, plus the reminder tools.
create or replace function public._activity_kind(p_key uuid) returns text
language sql stable security invoker set search_path = '' as $$
  with logged as (
    select * from public.activity a
    where public._activity_key(a.payload, a.id) = p_key and a.action in ('insert', 'update', 'delete')
  )
  select coalesce((select payload ->> 'kind' from logged where source = 'app' order by seq limit 1), case (select payload ->> 'tool' from logged order by seq limit 1)
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
    -- The label comes from whoever holds the token: each reminder kind is checked against the rows.
    when 'create_reminder' then
      case when exists (select 1 from logged where coalesce((payload ->> 'deleted')::boolean, false)) then 'other'
        when exists (select 1 from logged where target_kind = 'reminders' and action = 'insert') then 'reminder_created' else 'other' end
    when 'update_reminder' then
      case when exists (select 1 from logged where coalesce((payload ->> 'deleted')::boolean, false)) then 'other' else 'reminder_edited' end
    when 'complete_reminder' then
      case when exists (select 1 from logged where coalesce((payload ->> 'deleted')::boolean, false)) then 'other'
        when exists (select 1 from logged where target_kind = 'reminder_occurrences' and action = 'insert' or coalesce((payload ->> 'completed')::boolean, false))
          then 'reminder_completed' else 'other' end
    when 'snooze_reminder' then
      case when (select bool_and(target_kind = 'reminders' and action = 'update' and not coalesce((payload ->> 'deleted')::boolean, false)) from logged)
        then 'reminder_snoozed' else 'other' end
    when 'delete_reminder' then
      case when (select bool_and(target_kind = 'reminders' and action = 'update' and coalesce((payload ->> 'deleted')::boolean, false)) from logged)
        then 'reminder_deleted' else 'other' end
    else 'other'
  end);
$$;

-- As in spec 053 (paging), plus the reminder an entry changed and its title (as it is now, else as
-- logged), and Restore for a reminder an assistant sent to Recently deleted, while it's there (30
-- days). The return type changes, so it's made again.
drop function public.activity_entries(int, timestamptz, uuid, text, uuid);
create function public.activity_entries(
  p_limit int default 20,
  p_before timestamptz default null,
  p_actor uuid default null,
  p_source text default null,
  p_before_key uuid default null
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
  from_recipe_name text,
  event_id uuid,
  event_name text,
  event_when jsonb,
  event_secret boolean,
  reminder_id uuid,
  reminder_name text,
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
    where a.action in ('insert', 'update', 'delete')
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
      (array_agg((r.payload ->> 'recipe_id')::uuid order by r.seq)
        filter (where r.target_kind in ('recipes', 'recipe_ingredients', 'recipe_steps', 'recipe_variants')))[1] as recipe_id,
      (array_agg(r.payload ->> 'name' order by r.seq desc) filter (where r.target_kind = 'recipes'))[1] as logged_name,
      (array_agg((r.payload ->> 'recipe_id')::uuid order by r.seq) filter (where r.target_kind = 'grocery_items' and r.payload ? 'recipe_id'))[1] as from_recipe,
      (array_agg((r.payload ->> 'event_id')::uuid order by r.seq) filter (where r.payload ? 'event_id'))[1] as event_id,
      (array_agg(r.payload ->> 'name' order by r.seq) filter (where r.target_kind = 'events'))[1] as logged_event_name,
      coalesce(bool_or((r.payload ->> 'secret')::boolean), false) as event_secret,
      (array_agg(r.target_id order by r.seq) filter (where r.target_kind = 'events' and coalesce((r.payload ->> 'deleted')::boolean, false)))[1] as deleted_event,
      (array_agg((r.payload ->> 'reminder_id')::uuid order by r.seq) filter (where r.target_kind in ('reminders', 'reminder_occurrences')))[1] as reminder_id,
      (array_agg(r.payload ->> 'name' order by r.seq desc) filter (where r.target_kind = 'reminders'))[1] as logged_reminder_name,
      (array_agg(r.target_id order by r.seq) filter (where r.target_kind = 'reminders' and coalesce((r.payload ->> 'deleted')::boolean, false)))[1] as deleted_reminder
    from logged r
    group by k
    having (p_actor is null or (array_agg(r.actor_id order by r.seq))[1] = p_actor)
      and (p_source is null
        or (p_source = 'ai' and (array_agg(r.source::text order by r.seq))[1] <> 'app')
        -- 'other': any assistant the app can't name (OC-Activity's "Other" pill).
        or (p_source = 'other' and (array_agg(r.source::text order by r.seq))[1] not in ('app', 'claude', 'chatgpt', 'gemini'))
        or (array_agg(r.source::text order by r.seq))[1] = p_source)
  ),
  page as (
    select * from entries e
    where p_before is null
      or e.created_at < p_before
      or (e.created_at = p_before and p_before_key is not null and e.k < p_before_key)
    order by e.created_at desc, e.k desc
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
    fr.name,
    p.event_id,
    coalesce(ev.title, p.logged_event_name),
    case when ev.id is not null then jsonb_build_object('starts_on', ev.starts_on, 'time_type', ev.time_type, 'slots', ev.slots,
      'start_time', ev.start_time, 'end_time', ev.end_time) end,
    p.event_secret,
    p.reminder_id,
    coalesce(rem.title, p.logged_reminder_name),
    u.actor_id,
    u.created_at,
    u.action,
    p.source <> 'app' and u.id is null and kind.v not in ('recipe_deleted', 'event_deleted', 'reminder_deleted') and p.created_at > now() - interval '7 days',
    p.source <> 'app' and u.id is null and (kind.v = 'recipe_deleted' and rec.deleted_at is not null and rec.deleted_at > now() - interval '30 days'
      or kind.v = 'event_deleted' and dev.deleted_at is not null and dev.deleted_at > now() - interval '30 days'
      or kind.v = 'reminder_deleted' and drem.deleted_at is not null and drem.deleted_at > now() - interval '30 days')
  from page p
  cross join lateral (select public._activity_kind(p.k) as v) kind
  left join public.recipes rec on rec.id = p.recipe_id
  left join public.recipes fr on fr.id = p.from_recipe
  left join public.events ev on ev.id = p.event_id
  left join public.events dev on dev.id = p.deleted_event
  left join public.reminders rem on rem.id = p.reminder_id
  left join public.reminders drem on drem.id = p.deleted_reminder
  left join lateral (
    select a.id, a.actor_id, a.created_at, a.action from public.activity a
    where a.target_id = p.k and a.action in ('undo', 'restore')
    order by a.seq limit 1
  ) u on true
  order by p.created_at desc, p.k desc;
$$;
grant execute on function public.activity_entries(int, timestamptz, uuid, text, uuid) to authenticated;

-- --- Undo -----------------------------------------------------------------------------------------------

-- As in spec 044 (renamed by 053, which wraps it), plus the reminders' tables. A reminder the call
-- added goes for good, like an event, with its history. A tick's occurrences go and the reminder
-- comes back as it was; a reminder sent to Recently deleted is restored for 30 days.
create or replace function public._undo_ai_change(p_key uuid, p_skip_changed boolean default false) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  stamps constant text[] := array['id', 'family_id', 'created_by', 'created_at', 'source', 'updated_at', 'updated_by'];
  tables constant text[] := array['recipes', 'recipe_ingredients', 'recipe_steps', 'recipe_variants', 'grocery_items', 'grocery_recipes',
    'events', 'event_members', 'event_exceptions', 'event_checklist_items', 'event_surprise', 'reminders', 'reminder_occurrences'];
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
