-- Spec 053 FR-002 (after Gabriel's test): suggestions are one per title and part of the day, not
-- per exact start time. "Poker" at 12:46 and at 12:57 were two pills; a custom time now counts as
-- the slot it starts in (the family's slot times, or the defaults), the same key as an event in
-- that slot. Each pill still fills from the latest event of its kind and shows that event's time.
create or replace function public.suggest_event_titles(p_query text, p_limit int default 8)
returns table (
  title text, score double precision, last_event_id uuid,
  category text, location text, time_type text, slots text[], start_time text, end_time text
)
language sql stable security invoker set search_path = '' as $$
  -- What's typed is matched as text: `%`, `_` and `\` are escaped for LIKE.
  with q as (select replace(replace(replace(public._fold(left(p_query, 60)), '\', '\\'), '%', '\%'), '_', '\_') as q),
  seen as (
    select e.id, e.title, public._fold(e.title) as folded, e.created_at, e.category, e.location, e.time_type, e.slots, e.start_time, e.end_time,
      case e.time_type when 'all_day' then 'all_day'
        -- A custom time counts as the slot it starts in (the latest slot starting at or before it, else the first).
        when 'custom' then coalesce(
          (select t.k from jsonb_each(coalesce(fs.slot_times, public._default_slot_times())) t(k, v) where t.v ->> 'start' <= e.start_time order by t.v ->> 'start' desc limit 1),
          (select t.k from jsonb_each(coalesce(fs.slot_times, public._default_slot_times())) t(k, v) order by t.v ->> 'start' limit 1))
        else (select x from unnest(e.slots) x order by array_position(array['early_morning', 'morning', 'lunch', 'afternoon', 'evening'], x) limit 1) end as starts,
      case when e.recurrence is null or e.starts_on > current_date then e.starts_on
        else least(current_date, coalesce((e.recurrence #>> '{ends,date}')::date, current_date)) end as day
    from public.events_visible e
    left join public.family_calendar_settings fs on fs.family_id = e.family_id
    -- Never a surprise: picking one would copy its secret into an event the hidden person sees.
    where e.view = 'full' and e.visibility <> 'surprise' and e.deleted_at is null and auth.jwt() ->> 'client_id' is null
  ),
  matched as (
    select s.*, case when s.folded like q.q || '%' then 0 else 1 end as rank
    from seen s, q
    where length(q.q) > 0 and (s.folded like q.q || '%' or s.folded like '% ' || q.q || '%')
  ),
  grouped as (
    select m.folded, m.starts, min(m.rank) as rank,
      sum(power(0.5, abs(m.day - current_date) / 90.0)) as score,
      (array_agg(m.id order by m.day desc, m.created_at desc))[1] as last_event_id,
      (array_agg(m.title order by m.day desc, m.created_at desc))[1] as title,
      max(m.day) as latest
    from matched m
    group by m.folded, m.starts
  )
  select g.title, g.score::double precision, g.last_event_id, l.category, l.location, l.time_type, l.slots, l.start_time, l.end_time
  from grouped g
  join matched l on l.id = g.last_event_id
  order by g.rank, g.score desc, g.latest desc
  limit least(greatest(coalesce(p_limit, 8), 1), 10);
$$;
-- It only returns the default slot times; the function above runs as the caller.
grant execute on function public._default_slot_times() to authenticated;
