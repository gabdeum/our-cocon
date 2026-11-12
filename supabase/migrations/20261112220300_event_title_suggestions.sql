-- Spec 053 FR-001 to FR-004: past event titles to suggest while typing a new one. Read through
-- `events_visible`, so only events the caller sees in full count (never someone else's private
-- event), never a surprise (even one they're in on), and never deleted ones. Titles are grouped without case or
-- common accents and by start time (the first slot, the start hour, or all day), so "Swim · Morning"
-- and "Swim · 17:30" are two options but ten mornings at the pool are one. Titles that start with
-- the text come first, then those with a word that does.
-- Each event counts 0.5^(days from today / 90), so options used often and lately win; a repeating
-- event counts once: at its first date before it starts, today while it runs, else its last day. The latest event of each
-- option comes back with its time (the pill's "Morning"), for the app to fill the
-- sheet "like last time". The app only: an assistant
-- (`client_id` in the JWT) gets nothing.
create function public._fold(t text) returns text
language sql immutable set search_path = '' as $$
  select translate(lower(trim(coalesce(t, ''))), 'àáâäãåçèéêëìíîïñòóôöõùúûüýÿœæ', 'aaaaaaceeeeiiiinooooouuuuyyoa');
$$;

create function public.suggest_event_titles(p_query text, p_limit int default 8)
returns table (
  title text, score double precision, last_event_id uuid,
  category text, location text, time_type text, slots text[], start_time text, end_time text
)
language sql stable security invoker set search_path = '' as $$
  -- What's typed is matched as text: `%`, `_` and `\` are escaped for LIKE.
  with q as (select replace(replace(replace(public._fold(left(p_query, 60)), '\', '\\'), '%', '\%'), '_', '\_') as q),
  seen as (
    select e.id, e.title, public._fold(e.title) as folded, e.created_at, e.category, e.location, e.time_type, e.slots, e.start_time, e.end_time,
      case e.time_type when 'all_day' then 'all_day' when 'custom' then e.start_time
        else (select x from unnest(e.slots) x order by array_position(array['early_morning', 'morning', 'lunch', 'afternoon', 'evening'], x) limit 1) end as starts,
      case when e.recurrence is null or e.starts_on > current_date then e.starts_on
        else least(current_date, coalesce((e.recurrence #>> '{ends,date}')::date, current_date)) end as day
    from public.events_visible e
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
grant execute on function public._fold(text) to authenticated;
revoke execute on function public.suggest_event_titles(text, int) from public, anon;
grant execute on function public.suggest_event_titles(text, int) to authenticated;
