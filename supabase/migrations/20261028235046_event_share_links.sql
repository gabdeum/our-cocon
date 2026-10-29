-- Spec 042 FR-005: one date of an event shared as a view-only link `/e/<token>`. Like a recipe's
-- link (spec 019): one active link per event date, stopping ends it for good. Unlike it, the link
-- also ends once that date's event is over, and private or surprise events are never shared.

create table public.event_share_links (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  event_id uuid not null,
  -- The series date shared (the occurrence's key, spec 034); a one-off event's own day.
  occurrence_date date not null,
  -- 32 random bytes, base64url (256 bits), as share_links: the sheet shows the same link again.
  token text not null unique check (token ~ '^[A-Za-z0-9_-]{43}$'),
  stopped_at timestamptz,
  stopped_by uuid references auth.users (id) on delete set null,
  stopped_source public.write_source,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  source public.write_source not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (event_id, family_id) references public.events (id, family_id) on delete cascade
);
create unique index event_share_links_one_active on public.event_share_links (event_id, occurrence_date) where stopped_at is null;

select public._family_table('public.event_share_links', live => false);
drop policy "members remove their family's rows" on public.event_share_links;
revoke delete on public.event_share_links from authenticated;

-- The database makes the token, and a link only goes from shared to stopped. Only a family event
-- that isn't deleted can be shared, and only on one of its days: from its first one to its last
-- ("Ends on"), or a one-off event's own day. Which weekdays and how many times are the engine's
-- (@cocon/calendar): the page shows nothing for a date the series doesn't have.
create function public._stamp_event_share_link() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
begin
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
create trigger event_share_links_rules before insert or update on public.event_share_links
  for each row execute function public._stamp_event_share_link();

-- The sheet's link: this event date's active link, or a new one. `created` tells the app to send
-- `event_shared`. Two members opening the sheet at once get the same link.
create function public.share_event(p_event_id uuid, p_date date) returns table (token text, created_at timestamptz, created boolean)
language plpgsql security invoker set search_path = '' as $$
declare
  link public.event_share_links;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  select * into link from public.event_share_links s where s.event_id = p_event_id and s.occurrence_date = p_date and s.stopped_at is null;
  if link.id is not null then
    return query select link.token, link.created_at, false;
    return;
  end if;
  if not exists (select 1 from public.events e where e.id = p_event_id) then
    raise exception 'event_not_found' using errcode = 'P0001';
  end if;
  begin
    insert into public.event_share_links (event_id, occurrence_date, family_id, token)
      values (p_event_id, p_date, public.my_family_id(), repeat('x', 43))
      returning * into link;
  exception when unique_violation then
    select * into link from public.event_share_links s where s.event_id = p_event_id and s.occurrence_date = p_date and s.stopped_at is null;
    return query select link.token, link.created_at, false;
    return;
  end;
  return query select link.token, link.created_at, true;
end;
$$;

-- What a shared event page shows (FR-005), for the share endpoint only (service role): the title,
-- the date and time fields, the place and first names. Never the notes, checklist, reminder, who
-- drives, who added it, or any id. The page works out the day with @cocon/calendar from `event`
-- and that date's `exception` (only its shown fields). Null when the token is unknown or stopped,
-- the event is deleted or no longer a family event, that date is no longer one of its days (the
-- series was split there, or a one-off event moved), that date is cancelled, or it's over.
create function public.shared_event(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  link public.event_share_links;
  e public.events;
  x public.event_exceptions;
  o jsonb;
  starts date;
  ends date;
  tz text;
  slot_times jsonb;
  today date;
  who jsonb;
begin
  select * into link from public.event_share_links s where s.token = p_token and s.stopped_at is null;
  if link.id is null then
    return null;
  end if;
  select * into e from public.events v where v.id = link.event_id and v.deleted_at is null and v.visibility = 'family';
  if e.id is null
    or (e.recurrence is null and link.occurrence_date <> e.starts_on)
    or (e.recurrence #>> '{ends,type}' = 'on' and link.occurrence_date > (e.recurrence #>> '{ends,date}')::date) then
    return null;
  end if;
  select * into x from public.event_exceptions v where v.event_id = e.id and v.occurrence_date = link.occurrence_date;
  if x.cancelled then
    return null;
  end if;
  o := coalesce(x.override, '{}');
  -- Over once its last day is gone in the family's home time zone; without one, a day later, so
  -- no family loses the link early. The day keeps the event's length, as expand() does.
  starts := coalesce((o ->> 'starts_on')::date, link.occurrence_date);
  ends := coalesce((o ->> 'ends_on')::date, starts + (e.ends_on - e.starts_on));
  select s.home_time_zone, s.slot_times into tz, slot_times from public.family_calendar_settings s where s.family_id = e.family_id;
  today := public._family_today(e.family_id) - case when tz is null then 1 else 0 end;
  if ends < today then
    return null;
  end if;
  -- First names only: "everyone" and "others" stay words, a removed person's saved name counts.
  if o ? 'members' then
    select coalesce(jsonb_agg(case when w.value in ('"everyone"', '"others"') then w.value
        else to_jsonb(split_part(m.display_name, ' ', 1)) end order by w.ordinality) filter (where w.value in ('"everyone"', '"others"') or m.id is not null), '[]')
      into who
      from jsonb_array_elements(o -> 'members') with ordinality w
      left join public.members m on jsonb_typeof(w.value) = 'string' and m.id::text = w.value #>> '{}' and m.family_id = e.family_id;
  else
    select coalesce(jsonb_agg(case em.who
        when 'member' then to_jsonb(split_part(m.display_name, ' ', 1))
        when 'removed' then to_jsonb(split_part(em.removed_name, ' ', 1))
        else to_jsonb(em.who) end order by em.created_at, em.id) filter (where em.who <> 'member' or m.id is not null), '[]')
      into who
      from public.event_members em
      left join public.members m on m.id = em.member_id
      where em.event_id = e.id;
  end if;
  return jsonb_build_object(
    'occurrence_date', link.occurrence_date,
    'event', jsonb_strip_nulls(jsonb_build_object(
      'title', e.title, 'location', e.location, 'starts_on', e.starts_on, 'ends_on', e.ends_on,
      'time_type', e.time_type, 'slots', to_jsonb(e.slots), 'start_time', e.start_time, 'end_time', e.end_time,
      'recurrence', e.recurrence)),
    'exception', case when x.id is null then null else jsonb_build_object(
      'occurrence_date', x.occurrence_date,
      'override', (select coalesce(jsonb_object_agg(k.key, k.value), '{}') from jsonb_each(o) k
        where k.key = any (array['title', 'location', 'starts_on', 'ends_on', 'time_type', 'slots', 'start_time', 'end_time']))) end,
    'who', who,
    'slot_times', slot_times
  );
end;
$$;

grant execute on function public.share_event(uuid, date) to authenticated;
revoke execute on function public.shared_event(text) from public, anon, authenticated;
grant execute on function public.shared_event(text) to service_role;
