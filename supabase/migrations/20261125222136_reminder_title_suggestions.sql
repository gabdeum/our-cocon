-- Past reminder titles while typing a new one (Gabriel, 2026-11-25), as the event sheet has them
-- (spec 053 FR-001, FR-002): starts-with before a word match, then used often and lately (half the
-- weight every 90 days), one row per title whatever its case, with its latest reminder to fill from.
-- Runs as the caller, so the family's own reminders only (RLS); never a deleted one, nor anything for
-- an assistant (they have their own tools).
create function public.suggest_reminder_titles(p_query text, p_limit int default 8)
returns table (title text, score double precision, last_reminder_id uuid, has_time boolean, due_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  -- What's typed is matched as text: `%`, `_` and `\` are escaped for LIKE.
  with q as (select replace(replace(replace(public._fold(left(p_query, 80)), '\', '\\'), '%', '\%'), '_', '\_') as q),
  seen as (
    select r.id, r.title, public._fold(r.title) as folded, r.created_at, r.has_time, r.due_at, r.due_at::date as day
    from public.reminders r
    where r.deleted_at is null and auth.jwt() ->> 'client_id' is null
  ),
  matched as (
    select s.*, case when s.folded like q.q || '%' then 0 else 1 end as rank
    from seen s, q
    where length(q.q) > 0 and (s.folded like q.q || '%' or s.folded like '% ' || q.q || '%')
  ),
  grouped as (
    select m.folded, min(m.rank) as rank,
      sum(power(0.5, abs(m.day - current_date) / 90.0)) as score,
      (array_agg(m.id order by m.day desc, m.created_at desc))[1] as last_reminder_id,
      max(m.day) as latest
    from matched m
    group by m.folded
  )
  select l.title, g.score::double precision, g.last_reminder_id, l.has_time, l.due_at
  from grouped g
  join matched l on l.id = g.last_reminder_id
  order by g.rank, g.score desc, g.latest desc
  limit least(greatest(coalesce(p_limit, 8), 1), 10);
$$;
revoke execute on function public.suggest_reminder_titles(text, int) from public, anon;
grant execute on function public.suggest_reminder_titles(text, int) to authenticated;
