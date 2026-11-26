-- Spec 071: travelling to another time zone. The family's time zone (`home_time_zone`) is whatever
-- zone the family last moved to; a member may keep their own times on another zone while the family
-- stays where it is (`member_calendar_settings.away_time_zone`, "my time zone").
-- Events are clock times (spec 034 FR-008), so they need no change: the app and the notifier read
-- them in the zone that applies. Reminders are moments (spec 056), so those with a time move to keep
-- their clock time. `asked_time_zone` is the last zone the app asked a member about, so "Stay on the
-- family's time" isn't asked again until the phone moves somewhere else.
alter table public.member_calendar_settings
  add column away_time_zone text,
  add column asked_time_zone text;

-- Only `set_away_time_zone` changes them (`cocon.travel`), so a member's reminders always move with
-- their zone; a plain write of the settings row leaves them as they are.
create function public._check_member_time_zones() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('cocon.travel', true), '') <> 'on' then
    if tg_op = 'INSERT' then
      new.away_time_zone := null;
      new.asked_time_zone := null;
    else
      new.away_time_zone := old.away_time_zone;
      new.asked_time_zone := old.asked_time_zone;
    end if;
    return new;
  end if;
  if (new.away_time_zone is not null and not exists (select 1 from pg_catalog.pg_timezone_names where name = new.away_time_zone))
    or (new.asked_time_zone is not null and not exists (select 1 from pg_catalog.pg_timezone_names where name = new.asked_time_zone)) then
    raise exception 'unknown_time_zone' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger member_calendar_settings_time_zones before insert or update on public.member_calendar_settings
  for each row execute function public._check_member_time_zones();

-- The family's time zone moves only through `set_away_time_zone` (its reminders with it) or, the
-- first time, the owner's `set_home_time_zone` (security definer): no direct write any more.
revoke update (home_time_zone) on public.family_calendar_settings from authenticated;

-- Whether two zones show the same time now (Paris and Berlin count as one).
create function public._same_clock(a text, b text) returns boolean
language sql stable set search_path = '' as $$
  select a = b or (now() at time zone a) = (now() at time zone b)
$$;

-- FR-003, FR-005, FR-007: the caller's choice. `p_away` is the zone to keep times on (null: the
-- family's again), `p_asked` the zone the app asked about, `p_scope` 'me' (only the caller: their
-- own time zone) or 'family' (everyone: the family's time zone moves there, and the caller's own is
-- cleared). When every member with the app keeps their own times on the same clock, that's the
-- family moving (FR-009): the family's time zone moves there and their own are cleared.
-- Every open reminder with a time whose zone changes keeps its clock time (16:00 Paris becomes 16:00
-- New York): its assignee's own zone, else the family's. Reminders without a time (a day) stay.
-- Returns how many moved. Security definer: other members' zones and the family's settings are
-- beyond the caller's RLS; the family and member come from the session, never from the arguments.
create function public.set_away_time_zone(p_away text, p_asked text, p_scope text default 'me') returns integer
language plpgsql security definer set search_path = '' as $$
declare
  me_user uuid := public._require_user();
  fam uuid := public.my_family_id();
  me uuid := public._my_member_id();
  old_family text;
  new_family text;
  -- Each member's zone before (member id → zone).
  before jsonb;
  moved integer := 0;
begin
  if fam is null or me is null then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  if p_scope is null or p_scope not in ('me', 'family') then
    raise exception 'bad_scope' using errcode = '22023';
  end if;
  if (p_away is not null and not exists (select 1 from pg_catalog.pg_timezone_names where name = p_away))
    or (p_asked is not null and not exists (select 1 from pg_catalog.pg_timezone_names where name = p_asked)) then
    raise exception 'unknown_time_zone' using errcode = '22023';
  end if;
  if p_scope = 'family' and p_away is null then
    raise exception 'no_time_zone' using errcode = '22023';
  end if;
  -- Locked, so two members moving at once don't both move the reminders from the same zone.
  select s.home_time_zone into old_family from public.family_calendar_settings s where s.family_id = fam for update;
  if old_family is null then
    raise exception 'no_family_time_zone' using errcode = '22023';
  end if;
  insert into public.member_calendar_settings (family_id, user_id) values (fam, me_user) on conflict (family_id, user_id) do nothing;
  perform 1 from public.member_calendar_settings s where s.family_id = fam for update;
  perform set_config('cocon.travel', 'on', true);

  select coalesce(jsonb_object_agg(m.id, coalesce(s.away_time_zone, old_family)), '{}'::jsonb) into before
    from public.members m left join public.member_calendar_settings s on s.family_id = fam and s.user_id = m.user_id
    where m.family_id = fam;

  -- The choice.
  if p_scope = 'family' then
    new_family := p_away;
    update public.member_calendar_settings set away_time_zone = null, asked_time_zone = p_asked where family_id = fam and user_id = me_user;
  else
    new_family := old_family;
    update public.member_calendar_settings
      set away_time_zone = case when p_away is null or public._same_clock(p_away, old_family) then null else p_away end, asked_time_zone = p_asked
      where family_id = fam and user_id = me_user;
    -- FR-009: everyone with the app on the same other clock: the family moved.
    if p_away is not null and not public._same_clock(p_away, old_family) and not exists (
      select 1 from public.members m left join public.member_calendar_settings s on s.family_id = fam and s.user_id = m.user_id
      where m.family_id = fam and m.user_id is not null and (s.away_time_zone is null or not public._same_clock(s.away_time_zone, p_away))
    ) then
      new_family := p_away;
    end if;
  end if;
  if new_family <> old_family then
    update public.family_calendar_settings set home_time_zone = new_family where family_id = fam;
    -- Those on the family's new clock no longer need their own.
    update public.member_calendar_settings set away_time_zone = null
      where family_id = fam and away_time_zone is not null and public._same_clock(away_time_zone, new_family);
  end if;

  -- A move keeps each reminder's clock time: nobody edited it, so nothing in Activity to undo (spec 026).
  perform set_config('cocon.reminder_move', 'catch_up', true);
  with zones as (
    select r.id, b.zone_before, coalesce(s.away_time_zone, new_family) as zone_after
    from public.reminders r
    left join public.members m on m.id = r.assignee_id
    left join public.member_calendar_settings s on s.family_id = fam and s.user_id = m.user_id
    cross join lateral (select coalesce(before ->> r.assignee_id::text, old_family) as zone_before) b
    where r.family_id = fam and r.has_time and r.completed_at is null and r.deleted_at is null
  )
  update public.reminders r
    set due_at = (r.due_at at time zone z.zone_before) at time zone z.zone_after,
        next_due_at = (r.next_due_at at time zone z.zone_before) at time zone z.zone_after
    from zones z
    where r.id = z.id and z.zone_before <> z.zone_after;
  get diagnostics moved = row_count;
  perform set_config('cocon.reminder_move', '', true);
  perform set_config('cocon.travel', '', true);
  return moved;
end;
$$;
grant execute on function public.set_away_time_zone(text, text, text) to authenticated;

-- The caller's own time zone in a family (null for the notifier, which has no user). Security
-- definer: assistants can't use the `auth` schema (spec 023); it only ever reads the caller's row.
create function public._my_away_time_zone(p_family uuid) returns text
language sql stable security definer set search_path = '' as $$
  select s.away_time_zone from public.member_calendar_settings s where s.family_id = p_family and s.user_id = auth.uid()
$$;
grant execute on function public._my_away_time_zone(uuid) to authenticated, cocon_assistant, service_role;

-- FR-004: reminders read in the zone the caller's times follow: their own, else the family's, else
-- the caller's device's (`p_tz`), else UTC. The notifier (no user) gets the family's.
create or replace function public._reminder_time_zone(p_family uuid, p_tz text) returns text
language plpgsql stable set search_path = '' as $$
declare
  tz text := coalesce(
    public._my_away_time_zone(p_family),
    (select s.home_time_zone from public.family_calendar_settings s where s.family_id = p_family)
  );
begin
  tz := coalesce(tz, p_tz, 'UTC');
  perform now() at time zone tz;
  return tz;
exception when others then
  return 'UTC';
end;
$$;
