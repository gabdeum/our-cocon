-- Spec 058 (Gabriel, 2026-11-16): a late "Next week" reminder rests in Snoozed between its
-- weekdays, back on its next weekday (at its time), instead of sitting under Overdue all week and
-- reaching Home only on that day, which looked like a bug. Nothing is written: `snoozed_until` is
-- reported as that return, so the lists say "Back Sun, Nov 22", and on the day it's late again
-- (Overdue, on Home, its badge counted from the due date). A real snooze still wins.
create or replace function public._reminder_state(p_family uuid, p_tz text, p_now timestamptz) returns table (
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
  -- "Next week", late, on another weekday: resting until its next weekday.
  w as (
    select l.*,
      l.late and l.rollover = 'week' and extract(dow from l.today) <> extract(dow from l.late_on) as resting,
      l.today + ((extract(dow from l.late_on)::integer - extract(dow from l.today)::integer + 7) % 7) as back_on
    from l
  ),
  s as (
    select w.*,
      case when w.snoozed or w.resting then 'snoozed' when w.late then 'overdue'
        when w.due_on <= w.today then 'today' when w.due_on = w.today + 1 then 'tomorrow' else 'later' end as section,
      case when w.resting then
        (case when w.has_time then w.back_on + (w.due_at at time zone w.tz)::time else w.back_on::timestamp end) at time zone w.tz
        else w.snoozed_until end as back_at
    from w
  )
  select s.id, s.title, s.notes, s.assignee_id, s.due_at, s.has_time, s.repeat_rule, s.repeat_from, s.next_due_at,
    s.rollover, s.back_at, s.source::text, s.created_by, s.created_at, s.updated_at, s.due_on, s.late_from,
    case when s.late and s.has_time then floor(extract(epoch from p_now - s.late_from) / 3600)::integer else 0 end,
    case when not s.late then 0
      when s.has_time then floor(extract(epoch from p_now - s.late_from) / 86400)::integer
      else s.today - s.late_on end,
    s.section,
    s.section = 'today' or (s.section = 'overdue' and s.rollover in ('hour', 'day', 'week')),
    case s.section
      when 'snoozed' then s.back_at
      when 'overdue' then s.late_from
      else case when s.has_time then s.due_at
        else ((s.late_on + 1)::timestamp at time zone s.tz) - interval '1 microsecond' end
    end
  from s
$$;

-- The calendar also gets reminders resting in Snoozed (it draws them on the day they're back).
create or replace function public.reminders_in_range(p_from date, p_to date, p_tz text default null) returns setof jsonb
language plpgsql stable set search_path = '' as $$
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'bad_range' using errcode = '22023';
  end if;
  return query
    select to_jsonb(s) from public._reminder_state(public.my_family_id(), p_tz, now()) s
    where s.due_on <= p_to
      and (s.due_on >= p_from or s.repeat_rule is not null or s.section = 'snoozed' or (s.section = 'overdue' and s.rollover <> 'none'))
    order by s.due_at, s.id;
end;
$$;
