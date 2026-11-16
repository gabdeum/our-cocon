-- Spec 056: reminders, things to do and tick off (not the event reminders of spec 049). One row per
-- reminder: a repeating one is one row whose `due_at` moves forward, with the occurrences it closed
-- in reminder_occurrences. Repeats are worked out by `@cocon/reminders` on `@cocon/calendar`'s
-- `expand` (there's no repeat engine in SQL): every write stores `next_due_at`, the next scheduled
-- time, so the readers below find the reminders whose next date has come round and close what was
-- missed (FR-005). What depends on the time now (late, sections, Home: FR-006, FR-008, FR-012) is
-- worked out here, once, for the app, the MCP server and the notifier. Limits match
-- packages/schemas/reminders.ts.

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80 and title = btrim(title)),
  -- Plain text, line breaks kept (FR-009).
  notes text check (char_length(notes) between 1 and 1000),
  -- Null: Everyone.
  assignee_id uuid,
  -- The open occurrence (FR-003). Without a time, 00:00 that day in the home time zone.
  due_at timestamptz not null,
  has_time boolean not null,
  -- Shaped by Recurrence in packages/schemas/calendar.ts, counted from `repeat_from`.
  repeat_rule jsonb check (repeat_rule is null or (jsonb_typeof(repeat_rule) = 'object' and pg_column_size(repeat_rule) <= 2048)),
  repeat_from date,
  -- The scheduled time after `due_at`; null when it doesn't repeat or the repeat has ended.
  next_due_at timestamptz,
  rollover text not null check (rollover in ('hour', 'day', 'week', 'none')),
  snoozed_until timestamptz,
  completed_at timestamptz,
  -- Soft delete (FR-013): the whole series, in Recently deleted for 30 days.
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  source public.write_source not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, family_id),
  check (rollover <> 'hour' or has_time),
  check ((repeat_rule is null) = (repeat_from is null)),
  check (next_due_at is null or (repeat_rule is not null and next_due_at > due_at)),
  -- A member who leaves: their reminders become Everyone's.
  foreign key (assignee_id, family_id) references public.members (id, family_id) on delete set null (assignee_id)
);
create index reminders_family_due on public.reminders (family_id, deleted_at, due_at);
create index reminders_family_snoozed on public.reminders (family_id, snoozed_until);
create index reminders_next_due on public.reminders (next_due_at) where next_due_at is not null and deleted_at is null and completed_at is null;

-- FR-002: each occurrence that was closed. Who closed it is set here (null for the notifier).
create table public.reminder_occurrences (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  reminder_id uuid not null,
  due_at timestamptz not null,
  status text not null check (status in ('done', 'missed', 'skipped')),
  closed_at timestamptz not null default now(),
  closed_by uuid,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  source public.write_source not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reminder_id, due_at),
  foreign key (reminder_id, family_id) references public.reminders (id, family_id) on delete cascade,
  foreign key (closed_by, family_id) references public.members (id, family_id) on delete set null (closed_by)
);

-- FR-010 and FR-011: any member does anything, like events; a tick reaches the other phones. The
-- history refetches with its reminder (the app's `['reminders', …]` query keys).
select public._family_table('public.reminders', live => true);
select public._family_table('public.reminder_occurrences', live => false);

create trigger reminders_deleted before insert or update on public.reminders
  for each row execute function public._stamp_soft_delete();
-- Deletes are soft (FR-013): removed for good only from Recently deleted, like events.
drop policy "members remove their family's rows" on public.reminders;
create policy "members remove their family's deleted reminders" on public.reminders
  for delete to authenticated using (family_id = public.my_family_id() and deleted_at is not null);

create function public._stamp_occurrence_closed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.closed_at := now();
    new.closed_by := public._my_member_id();
  else
    new.closed_at := old.closed_at;
    new.closed_by := old.closed_by;
  end if;
  return new;
end;
$$;
create trigger reminder_occurrences_closed before insert or update on public.reminder_occurrences
  for each row execute function public._stamp_occurrence_closed();

-- The time zone a family's reminders are placed in: the home one, else the caller's device's
-- (`p_tz`, as the app does before the first device claims it), else UTC.
create function public._reminder_time_zone(p_family uuid, p_tz text) returns text
language plpgsql stable set search_path = '' as $$
declare
  tz text := (select s.home_time_zone from public.family_calendar_settings s where s.family_id = p_family);
begin
  tz := coalesce(tz, p_tz, 'UTC');
  perform now() at time zone tz;
  return tz;
exception when others then
  return 'UTC';
end;
$$;

-- A family's open reminders as they stand at `p_now` (security invoker: members get only their
-- own family's rows; the notifier, as service role, any family's).
--   FR-006 late: from `late_from` (the snooze's end, else the due time: never before it, so a
--     reminder snoozed before it's due isn't late early); without a time, from the
--     next day. `late_hours` / `late_days` are whole hours and days (the badge: "3h late", "2d late").
--   FR-007: snoozed while `p_now < snoozed_until`: only in the Snoozed section, never on Home.
--   FR-008 on Home: overdue or due today, except "Leave it", and "Next week" only on its weekday.
--   FR-012 sort: overdue oldest first; due by time, "any time" after the timed ones that day (the
--     day it came back from a snooze); snoozed by when they come back.
create function public._reminder_state(p_family uuid, p_tz text, p_now timestamptz) returns table (
  id uuid, title text, notes text, assignee_id uuid, due_at timestamptz, has_time boolean,
  repeat_rule jsonb, repeat_from date, next_due_at timestamptz, rollover text, snoozed_until timestamptz,
  source text, created_by uuid, created_at timestamptz, updated_at timestamptz,
  due_on date, late_from timestamptz, late_hours integer, late_days integer, section text, on_home boolean, sort_at timestamptz
)
language sql stable set search_path = '' as $$
  with z as (
    select tz, (p_now at time zone tz)::date as today from public._reminder_time_zone(p_family, p_tz) tz
  ),
  r as (
    select r.*, z.tz, z.today,
      (r.due_at at time zone z.tz)::date as due_on,
      greatest(r.snoozed_until, r.due_at) as late_from,
      (greatest(r.snoozed_until, r.due_at) at time zone z.tz)::date as late_on,
      r.snoozed_until is not null and p_now < r.snoozed_until as snoozed
    from public.reminders r cross join z
    where r.family_id = p_family and r.deleted_at is null and r.completed_at is null
  ),
  l as (
    select r.*,
      not r.snoozed and case when r.has_time then p_now > r.late_from else r.today > r.late_on end as late
    from r
  ),
  s as (
    select l.*,
      case when l.snoozed then 'snoozed' when l.late then 'overdue'
        when l.due_on <= l.today then 'today' when l.due_on = l.today + 1 then 'tomorrow' else 'later' end as section
    from l
  )
  select s.id, s.title, s.notes, s.assignee_id, s.due_at, s.has_time, s.repeat_rule, s.repeat_from, s.next_due_at,
    s.rollover, s.snoozed_until, s.source::text, s.created_by, s.created_at, s.updated_at, s.due_on, s.late_from,
    case when s.late and s.has_time then floor(extract(epoch from p_now - s.late_from) / 3600)::integer else 0 end,
    case when not s.late then 0
      when s.has_time then floor(extract(epoch from p_now - s.late_from) / 86400)::integer
      else s.today - s.late_on end,
    s.section,
    s.section = 'today' or (s.section = 'overdue' and (s.rollover in ('hour', 'day')
      or (s.rollover = 'week' and extract(dow from s.today) = extract(dow from s.late_on)))),
    case s.section
      when 'snoozed' then s.snoozed_until
      when 'overdue' then s.late_from
      else case when s.has_time then s.due_at
        else ((s.late_on + 1)::timestamp at time zone s.tz) - interval '1 microsecond' end
    end
  from s
$$;

-- FR-012 Home: the first three (overdue oldest first, then today by time), how many more are on
-- Home today, and how many are snoozed.
create function public.reminders_home(p_tz text default null) returns jsonb
language sql stable set search_path = '' as $$
  with s as (select * from public._reminder_state(public.my_family_id(), p_tz, now()))
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.section <> 'overdue', t.sort_at, t.id)
      from (select * from s where s.on_home order by s.section <> 'overdue', s.sort_at, s.id limit 3) t
    ), '[]'::jsonb),
    'more_today', greatest((select count(*) from s where s.on_home) - 3, 0),
    'snoozed', (select count(*) from s where s.section = 'snoozed')
  )
$$;

-- FR-012: one page of a section, after the cursor `(p_after_sort, p_after_id)`. "Mine" is the
-- caller's and Everyone's. `@cocon/data` asks for one row more than it shows to know if there's
-- a next page.
create function public.reminders_section(
  p_section text, p_mine boolean, p_limit integer, p_after_sort timestamptz default null, p_after_id uuid default null, p_tz text default null
) returns setof jsonb
language plpgsql stable set search_path = '' as $$
begin
  if p_section is null or p_section not in ('overdue', 'today', 'tomorrow', 'later', 'snoozed') then
    raise exception 'unknown_section' using errcode = '22023';
  end if;
  if (p_after_sort is null) <> (p_after_id is null) then
    raise exception 'bad_cursor' using errcode = '22023';
  end if;
  return query
    select to_jsonb(s) from public._reminder_state(public.my_family_id(), p_tz, now()) s
    where s.section = p_section
      and (not coalesce(p_mine, false) or s.assignee_id is null or s.assignee_id = (select m.id from public.members m where m.user_id = auth.uid()))
      and (p_after_sort is null or (s.sort_at, s.id) > (p_after_sort, p_after_id))
    order by s.sort_at, s.id
    limit least(greatest(coalesce(p_limit, 20), 1), 51);
end;
$$;

-- FR-012 for the calendar (spec 058): open reminders due in `p_from`–`p_to`, every repeating one
-- that started by then (the app expands its later dates), and late ones that roll over.
create function public.reminders_in_range(p_from date, p_to date, p_tz text default null) returns setof jsonb
language plpgsql stable set search_path = '' as $$
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'bad_range' using errcode = '22023';
  end if;
  return query
    select to_jsonb(s) from public._reminder_state(public.my_family_id(), p_tz, now()) s
    where s.due_on <= p_to
      and (s.due_on >= p_from or s.repeat_rule is not null or (s.section = 'overdue' and s.rollover <> 'none'))
    order by s.due_at, s.id;
end;
$$;

-- FR-004 and FR-005: close occurrences and move the reminder on, if nobody moved it first (another
-- phone's tick, or two catch-ups at once): false then, and nothing changes. `p_closed` is
-- [{due_at, status}], from `@cocon/reminders`. `p_complete` sets `completed_at` (a one-off ticked,
-- or a repeat that has ended).
create function public.reminder_apply(
  p_id uuid, p_from_due_at timestamptz, p_closed jsonb, p_due_at timestamptz, p_complete boolean,
  p_next_due_at timestamptz default null, p_snoozed_until timestamptz default null
) returns boolean
language plpgsql set search_path = '' as $$
declare
  fam uuid;
begin
  if p_closed is not null and (jsonb_typeof(p_closed) <> 'array' or jsonb_array_length(p_closed) > 2000) then
    raise exception 'bad_closed' using errcode = '22023';
  end if;
  update public.reminders r set due_at = p_due_at, next_due_at = p_next_due_at, snoozed_until = p_snoozed_until,
      completed_at = case when p_complete then now() end
    where r.id = p_id and r.due_at = p_from_due_at and r.deleted_at is null and r.completed_at is null
    returning r.family_id into fam;
  if fam is null then
    return false;
  end if;
  insert into public.reminder_occurrences (family_id, reminder_id, due_at, status)
    select fam, p_id, (c ->> 'due_at')::timestamptz, c ->> 'status'
    from jsonb_array_elements(coalesce(p_closed, '[]'::jsonb)) c
    on conflict (reminder_id, due_at) do nothing;
  return true;
end;
$$;

-- Undo of a Done (FR-004): reopens the reminder as it was, if it's still where the Done left it,
-- and removes the occurrences that Done wrote.
create function public.reminder_revert(
  p_id uuid, p_from_due_at timestamptz, p_reopen timestamptz[], p_due_at timestamptz,
  p_next_due_at timestamptz default null, p_snoozed_until timestamptz default null
) returns boolean
language plpgsql set search_path = '' as $$
begin
  update public.reminders r set due_at = p_due_at, next_due_at = p_next_due_at, snoozed_until = p_snoozed_until, completed_at = null
    where r.id = p_id and r.due_at = p_from_due_at and r.deleted_at is null;
  if not found then
    return false;
  end if;
  delete from public.reminder_occurrences o where o.reminder_id = p_id and o.due_at = any (coalesce(p_reopen, '{}'));
  return true;
end;
$$;

-- The nightly job (server only, scripts/purge-deleted.ts) removes reminders deleted over 30 days
-- ago, with their history.
create function public.purge_deleted_reminders() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  delete from public.reminders r where r.deleted_at is not null and r.deleted_at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Grants. Members: the reads and the two writes; the notifier (spec 059) uses the same ones.
-- Assistants get theirs with spec 060's permission.
grant execute on function public._reminder_time_zone(uuid, text), public._reminder_state(uuid, text, timestamptz),
  public.reminders_home(text), public.reminders_section(text, boolean, integer, timestamptz, uuid, text),
  public.reminders_in_range(date, date, text),
  public.reminder_apply(uuid, timestamptz, jsonb, timestamptz, boolean, timestamptz, timestamptz),
  public.reminder_revert(uuid, timestamptz, timestamptz[], timestamptz, timestamptz, timestamptz)
  to authenticated, service_role;
revoke execute on function public.purge_deleted_reminders() from public, anon, authenticated;
grant execute on function public.purge_deleted_reminders() to service_role;
