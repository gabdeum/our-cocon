-- Spec 029: the Menu's settings pages. Each member's own calendar preferences, the family's times
-- of day and home time zone (owner only), and account deletion for members who joined (L71).

-- FR-007: "For you" calendar settings, one row per member, seen and changed only by them. No row
-- means the defaults. month_hint_seen is OC-CalMonth's "Got it" (032-later L94).
create table public.member_calendar_settings (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  opens_on text not null default 'month' check (opens_on in ('month', 'week', 'day', 'agenda')),
  week_start text not null default 'automatic' check (week_start in ('automatic', 'sunday', 'monday')),
  time_format text not null default 'automatic' check (time_format in ('automatic', '24h', '12h')),
  show_birthdays boolean not null default true,
  fade_past boolean not null default true,
  month_hint_seen boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  source public.write_source not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, user_id)
);
select public._family_table('public.member_calendar_settings', live => false);
-- SC-002: a member's own row only. Nobody deletes it (back to defaults is a change like any other).
revoke delete on public.member_calendar_settings from authenticated;
drop policy "members read their family's rows" on public.member_calendar_settings;
drop policy "members add to their family" on public.member_calendar_settings;
drop policy "members change their family's rows" on public.member_calendar_settings;
drop policy "members remove their family's rows" on public.member_calendar_settings;
create policy "members read their own calendar settings" on public.member_calendar_settings
  for select to authenticated using (family_id = public.my_family_id() and user_id = auth.uid());
create policy "members add their own calendar settings" on public.member_calendar_settings
  for insert to authenticated with check (family_id = public.my_family_id() and user_id = auth.uid());
create policy "members change their own calendar settings" on public.member_calendar_settings
  for update to authenticated using (family_id = public.my_family_id() and user_id = auth.uid())
  with check (family_id = public.my_family_id() and user_id = auth.uid());
create function public._keep_settings_owner() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.user_id := old.user_id;
  return new;
end;
$$;
create trigger member_calendar_settings_keep_owner before update on public.member_calendar_settings
  for each row execute function public._keep_settings_owner();

-- FR-009 (and 032-later L81, beside slotsToRange in @cocon/calendar): five slots in day order, each
-- ending where the next starts. Only Evening may end at midnight (24:00).
create function public._slot_times_ok(t jsonb) returns boolean
language sql immutable set search_path = '' as $$
  with s as (
    select k, i, t -> k as slot, t -> k ->> 'start' as starts, t -> k ->> 'end' as ends
    from unnest(array['early_morning', 'morning', 'lunch', 'afternoon', 'evening']) with ordinality u(k, i)
  )
  select jsonb_typeof(t) = 'object'
    and t ?& array['early_morning', 'morning', 'lunch', 'afternoon', 'evening']
    and (select count(*) from jsonb_object_keys(t)) = 5
    and bool_and(coalesce(
      jsonb_typeof(slot) = 'object' and (select count(*) from jsonb_object_keys(slot)) = 2
      and starts ~ '^([01]\d|2[0-3]):[0-5]\d$'
      and (ends ~ '^([01]\d|2[0-3]):[0-5]\d$' or (k = 'evening' and ends = '24:00'))
      and starts < ends
      and (k = 'evening' or ends = (select n.starts from s n where n.i = s.i + 1)),
    false))
  from s;
$$;
create function public._check_slot_times() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.slot_times is not null and not public._slot_times_ok(new.slot_times) then
    raise exception 'slots_overlap' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger family_calendar_settings_slots before insert or update on public.family_calendar_settings
  for each row execute function public._check_slot_times();

-- The engine's defaults (spec 034 FR-002), for a family that hasn't changed them.
create function public._default_slot_times() returns jsonb
language sql immutable set search_path = '' as $$
  select '{"early_morning": {"start": "06:00", "end": "09:00"}, "morning": {"start": "09:00", "end": "12:00"},
    "lunch": {"start": "12:00", "end": "14:00"}, "afternoon": {"start": "14:00", "end": "18:00"},
    "evening": {"start": "18:00", "end": "22:00"}}'::jsonb;
$$;

-- An event's hours from its slots, under the given slot times: first slot's start, last slot's end.
create function public._slots_range(slots text[], t jsonb, edge text) returns text
language sql immutable set search_path = '' as $$
  select t -> k ->> edge
  from unnest(array['early_morning', 'morning', 'lunch', 'afternoon', 'evening']) with ordinality u(k, i)
  where k = any(slots)
  order by case when edge = 'start' then i else -i end
  limit 1;
$$;

-- US6: the owner changes the family's times of day. Events already on a slot whose hours change
-- keep their hours: they become custom times (Gabriel, 2026-11-02), in the same transaction, so
-- nobody sees them move. Returns how many events and exceptions were pinned.
create function public.set_slot_times(p_times jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  fam uuid := public.my_family_id();
  before jsonb;
  changed text[];
  pinned integer;
  n integer;
begin
  perform public._require_user();
  if not exists (select 1 from public.families f where f.id = fam and f.owner_id = auth.uid()) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if not public._slot_times_ok(p_times) then
    raise exception 'slots_overlap' using errcode = '22023';
  end if;
  select s.slot_times into before from public.family_calendar_settings s where s.family_id = fam;
  before := coalesce(before, public._default_slot_times());
  changed := array(select k from unnest(array['early_morning', 'morning', 'lunch', 'afternoon', 'evening']) k
    where before -> k is distinct from p_times -> k);

  -- "This event only" changes with their own slots, and those of a series being pinned (which would
  -- otherwise mix a custom series with slot hours), first, while the series still reads as slots.
  update public.event_exceptions x
    set override = x.override || jsonb_build_object('time_type', 'custom', 'slots', '[]'::jsonb,
      'start_time', public._slots_range(array(select jsonb_array_elements_text(x.override -> 'slots')), before, 'start'),
      'end_time', public._slots_range(array(select jsonb_array_elements_text(x.override -> 'slots')), before, 'end'))
    from public.events e
    where e.id = x.event_id and x.family_id = fam
      and jsonb_typeof(x.override -> 'slots') = 'array' and jsonb_array_length(x.override -> 'slots') > 0
      and (array(select jsonb_array_elements_text(x.override -> 'slots')) && changed
        or (e.time_type = 'slot' and e.slots && changed));
  get diagnostics pinned = row_count;

  update public.events e
    set time_type = 'custom', slots = '{}',
      start_time = public._slots_range(e.slots, before, 'start'), end_time = public._slots_range(e.slots, before, 'end')
    where e.family_id = fam and e.time_type = 'slot' and e.slots && changed;
  get diagnostics n = row_count;

  insert into public.family_calendar_settings (family_id, slot_times) values (fam, p_times)
    on conflict (family_id) do update set slot_times = excluded.slot_times;
  return pinned + n;
end;
$$;

-- FR-010: the owner sets the home time zone ("Use this phone's time zone"). _check_time_zone
-- refuses unknown names.
create function public.set_home_time_zone(tz text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  fam uuid := public.my_family_id();
begin
  perform public._require_user();
  if not exists (select 1 from public.families f where f.id = fam and f.owner_id = auth.uid()) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  insert into public.family_calendar_settings (family_id, home_time_zone) values (fam, tz)
    on conflict (family_id) do update set home_time_zone = excluded.home_time_zone;
end;
$$;

-- Slot times change only through set_slot_times, so events are pinned first. The owner may still
-- update the home time zone directly (spec 035).
revoke insert, update on public.family_calendar_settings from authenticated;
grant update (home_time_zone) on public.family_calendar_settings to authenticated;

-- 032-later L85: slot times the owner changes show on every device at once.
create trigger family_calendar_settings_broadcast after insert or update or delete on public.family_calendar_settings
  for each row execute function public._broadcast_change();

grant execute on function public.set_slot_times(jsonb), public.set_home_time_zone(text) to authenticated;

-- FR-013 (032-later L71): deleting a member's account nulls their id in every *_by column
-- (on delete set null). Those nulls are UPDATEs, and the stamp triggers below put an author back
-- (the person being deleted, or the old value), so the delete failed on the foreign key. While
-- delete_my_account runs, the triggers let those updates through as they are: only once the
-- person's auth row is already gone, so the setting alone never skips a stamp.
create function public._leaving() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and current_setting('cocon.leaving', true) = auth.uid()::text
    and not exists (select 1 from auth.users u where u.id = auth.uid());
$$;

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public._require_user();
begin
  if exists (select 1 from public.members where user_id = me and role = 'owner') then
    raise exception 'owner_must_delete_family' using errcode = 'P0001';
  end if;
  perform set_config('cocon.leaving', me::text, true);
  delete from auth.users where id = me;
  perform set_config('cocon.leaving', '', true);
end;
$$;

create or replace function public._stamp_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if tg_op = 'UPDATE' and public._leaving() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if me is not null then
      new.family_id := public.my_family_id();
      new.created_by := me;
      new.updated_by := me;
      new.source := public._request_source();
      new.created_at := now();
    end if;
  else
    new.id := old.id;
    new.family_id := old.family_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.source := old.source;
    new.updated_by := coalesce(me, new.updated_by);
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public._touch_updated_by() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and public._leaving() then
    return new;
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by, new.created_by);
  return new;
end;
$$;

create or replace function public._stamp_soft_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and public._leaving() then
    return new;
  end if;
  if new.deleted_at is null then
    if tg_op = 'UPDATE' and old.deleted_at is not null and auth.uid() is not null
      and old.deleted_at < now() - interval '30 days' then
      raise exception 'This % was deleted more than 30 days ago', rtrim(tg_table_name, 's') using errcode = '22023';
    end if;
    new.deleted_by := null;
  elsif tg_op = 'INSERT' or old.deleted_at is null then
    new.deleted_by := coalesce(auth.uid(), new.deleted_by);
    if auth.uid() is not null then
      new.deleted_at := now();
    end if;
  else
    new.deleted_by := old.deleted_by;
    new.deleted_at := old.deleted_at;
  end if;
  return new;
end;
$$;

create or replace function public._stamp_grocery_deleted() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and public._leaving() then
    return new;
  end if;
  if new.deleted_at is null then
    if tg_op = 'UPDATE' and old.deleted_at is not null and auth.uid() is not null
      and old.deleted_at < now() - interval '1 day' then
      raise exception 'This item was cleared more than a day ago' using errcode = '22023';
    end if;
    new.deleted_by := null;
  elsif tg_op = 'INSERT' or old.deleted_at is null then
    new.deleted_by := coalesce(auth.uid(), new.deleted_by);
    if auth.uid() is not null then
      new.deleted_at := now();
    end if;
  else
    new.deleted_by := old.deleted_by;
    new.deleted_at := old.deleted_at;
  end if;
  return new;
end;
$$;

create or replace function public._stamp_grocery_checked() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and public._leaving() then
    return new;
  end if;
  if not new.checked then
    new.checked_by := null;
    new.checked_at := null;
  elsif tg_op = 'INSERT' or not old.checked then
    new.checked_by := coalesce(auth.uid(), new.checked_by);
    new.checked_at := now();
  else
    new.checked_by := old.checked_by;
    new.checked_at := old.checked_at;
  end if;
  return new;
end;
$$;

create or replace function public._stamp_checklist_done() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and public._leaving() then
    return new;
  end if;
  if not new.done then
    new.done_by := null;
  elsif tg_op = 'INSERT' or not old.done then
    new.done_by := coalesce(public._my_member_id(), new.done_by);
  else
    new.done_by := old.done_by;
  end if;
  return new;
end;
$$;

create or replace function public._stamp_share_link() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and public._leaving() then
    return new;
  end if;
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

create or replace function public._stamp_event_share_link() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
begin
  if tg_op = 'UPDATE' and public._leaving() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      select * into e from public.events x where x.id = new.event_id;
      if e.id is null or e.deleted_at is not null then
        raise exception 'event_not_found' using errcode = 'P0001';
      end if;
      if e.visibility <> 'family' then
        raise exception 'event_not_shareable' using errcode = 'P0001';
      end if;
      if new.occurrence_date < e.starts_on or (e.recurrence is null and new.occurrence_date <> e.starts_on)
        or (e.recurrence #>> '{ends,type}' = 'on' and new.occurrence_date > (e.recurrence #>> '{ends,date}')::date) then
        raise exception 'not_an_event_date' using errcode = 'P0001';
      end if;
      new.token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
      new.stopped_at := null;
      new.stopped_by := null;
      new.stopped_source := null;
    end if;
    return new;
  end if;
  new.token := old.token;
  new.event_id := old.event_id;
  new.occurrence_date := old.occurrence_date;
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

