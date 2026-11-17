-- Spec 058 (Gabriel, 2026-11-16): a snoozed reminder (snoozed by hand, or a late "Next week" one
-- resting until its weekday) is listed in the section of the day it's back (Today, Tomorrow,
-- Later), sorted by when it's back, with a new `snoozed` flag the app draws as a "Snoozed" pill.
-- There is no Snoozed section any more; `reminders_section('snoozed')` still lists them all (Home's
-- count, older apps). Still never on Home, never late while snoozed. The return type changes, so the
-- function is dropped and created again (the SQL functions that call it look it up by name).
drop function public._reminder_state(uuid, text, timestamptz);

create function public._reminder_state(p_family uuid, p_tz text, p_now timestamptz) returns table (
  id uuid, title text, notes text, assignee_id uuid, due_at timestamptz, has_time boolean,
  repeat_rule jsonb, repeat_from date, next_due_at timestamptz, rollover text, snoozed_until timestamptz,
  source text, created_by uuid, created_at timestamptz, updated_at timestamptz,
  due_on date, late_from timestamptz, late_hours integer, late_days integer, section text, on_home boolean, sort_at timestamptz,
  snoozed boolean
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
      r.snoozed_until is not null and p_now < r.snoozed_until as by_hand
    from public.reminders r cross join z
    where r.family_id = p_family and r.deleted_at is null and r.completed_at is null
  ),
  l as (
    select r.*,
      not r.by_hand and case when r.has_time then p_now > r.late_from else r.today > r.late_on end as late
    from r
  ),
  -- "Next week", late, on another weekday: resting until its next weekday.
  w as (
    select l.*,
      l.late and l.rollover = 'week' and extract(dow from l.today) <> extract(dow from l.late_on) as resting,
      l.today + ((extract(dow from l.late_on)::integer - extract(dow from l.today)::integer + 7) % 7) as rest_on
    from l
  ),
  b as (
    select w.*,
      w.by_hand or w.resting as is_snoozed,
      case when w.resting then
        (case when w.has_time then w.rest_on + (w.due_at at time zone w.tz)::time else w.rest_on::timestamp end) at time zone w.tz
        else w.snoozed_until end as back_at
    from w
  ),
  s as (
    select b.*,
      -- The day it's due, or the day a snoozed one is back.
      case when b.is_snoozed then (b.back_at at time zone b.tz)::date else b.due_on end as on_day,
      b.late and not b.is_snoozed as late_now
    from b
  )
  select s.id, s.title, s.notes, s.assignee_id, s.due_at, s.has_time, s.repeat_rule, s.repeat_from, s.next_due_at,
    s.rollover, s.back_at, s.source::text, s.created_by, s.created_at, s.updated_at, s.due_on, s.late_from,
    case when s.late_now and s.has_time then floor(extract(epoch from p_now - s.late_from) / 3600)::integer else 0 end,
    case when not s.late_now then 0
      when s.has_time then floor(extract(epoch from p_now - s.late_from) / 86400)::integer
      else s.today - s.late_on end,
    case when s.late_now then 'overdue'
      when s.on_day <= s.today then 'today' when s.on_day = s.today + 1 then 'tomorrow' else 'later' end,
    not s.is_snoozed and ((not s.late_now and s.due_on <= s.today) or (s.late_now and s.rollover in ('hour', 'day', 'week'))),
    case when s.is_snoozed then s.back_at
      when s.late_now then s.late_from
      when s.has_time then s.due_at
      else ((s.late_on + 1)::timestamp at time zone s.tz) - interval '1 microsecond' end,
    s.is_snoozed
  from s
$$;

grant execute on function public._reminder_state(uuid, text, timestamptz) to authenticated, service_role;

-- Home's count of snoozed ones, now from the flag.
create or replace function public.reminders_home(p_tz text default null) returns jsonb
language sql stable set search_path = '' as $$
  with s as (select * from public._reminder_state(public.my_family_id(), p_tz, now()))
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.section <> 'overdue', t.sort_at, t.id)
      from (select * from s where s.on_home order by s.section <> 'overdue', s.sort_at, s.id limit 3) t
    ), '[]'::jsonb),
    'more_today', greatest((select count(*) from s where s.on_home) - 3, 0),
    'snoozed', (select count(*) from s where s.snoozed)
  )
$$;

-- A section's page. 'snoozed' lists every snoozed one (by when they're back).
create or replace function public.reminders_section(
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
    where (case when p_section = 'snoozed' then s.snoozed else s.section = p_section end)
      and (not coalesce(p_mine, false) or s.assignee_id is null or s.assignee_id = (select m.id from public.members m where m.user_id = auth.uid()))
      and (p_after_sort is null or (s.sort_at, s.id) > (p_after_sort, p_after_id))
    order by s.sort_at, s.id
    limit least(greatest(coalesce(p_limit, 20), 1), 51);
end;
$$;

create or replace function public.reminders_in_range(p_from date, p_to date, p_tz text default null) returns setof jsonb
language plpgsql stable set search_path = '' as $$
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'bad_range' using errcode = '22023';
  end if;
  return query
    select to_jsonb(s) from public._reminder_state(public.my_family_id(), p_tz, now()) s
    where s.due_on <= p_to
      and (s.due_on >= p_from or s.repeat_rule is not null or s.snoozed or (s.section = 'overdue' and s.rollover <> 'none'))
    order by s.due_at, s.id;
end;
$$;
