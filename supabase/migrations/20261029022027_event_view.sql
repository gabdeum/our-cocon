-- Spec 043 (032-later L101): `events_visible` also says which view each row is, 'full', 'busy'
-- or 'cover', the value it already worked out. The hidden person's app needs it to show a
-- surprise's cover as OC-CalSurprise (no Edit, Duplicate, Share or Delete, a "Note from" card)
-- instead of as a family event; the cover's fields stay exactly as before. An assistant acting
-- for that person (an MCP token, `client_id` in the JWT) gets 'full': it has no screen to draw, and
-- "cover" could give the secret away (spec 043 FR-003). Same body otherwise, so the function and
-- view are dropped and made again (a view's columns can't change in place).

drop view public.events_visible;
drop function public._events_visible();

-- As spec 035 wrote it, plus `view`.
create function public._events_visible() returns table (
  id uuid, family_id uuid, title text, category text, location text, notes text,
  starts_on date, ends_on date, time_type text, slots text[], start_time text, end_time text,
  recurrence jsonb, reminder text, responsible_member_id uuid, visibility text, creator_member_id uuid,
  members jsonb, removed_members jsonb, exceptions jsonb, checklist jsonb, surprise jsonb,
  created_by uuid, updated_by uuid, source text, created_at timestamptz, updated_at timestamptz,
  deleted_at timestamptz, deleted_by uuid, view text
)
language sql stable security definer set search_path = '' as $$
  with me as (
    select m.id as member_id, m.family_id from public.members m where m.user_id = auth.uid()
  ),
  seen as (
    select e.*, cm.id as creator_member, s.hidden_from, s.cover_title, s.cover_note,
      case
        when e.visibility = 'family' then 'full'
        -- First, so nothing (not even a creator who left) shows the hidden person it's a surprise.
        when e.visibility = 'surprise' and s.id is not null and me.member_id = any (s.hidden_from) then 'cover'
        when cm.id is null then 'busy'
        when cm.id = me.member_id then 'full'
        when e.visibility = 'surprise' and s.id is not null then 'full'
        else 'busy'
      end as view
    from public.events e
    join me on me.family_id = e.family_id
    left join public.members cm on cm.user_id = e.created_by and cm.family_id = e.family_id
    left join public.event_surprise s on s.event_id = e.id
  )
  select v.id, v.family_id,
    case v.view when 'busy' then 'Busy' when 'cover' then v.cover_title else v.title end,
    case when v.view = 'full' then v.category end,
    case when v.view <> 'busy' then v.location end,
    case v.view when 'full' then v.notes when 'cover' then v.cover_note end,
    v.starts_on, v.ends_on, v.time_type, v.slots, v.start_time, v.end_time,
    case when v.view = 'full' or v.recurrence is null then v.recurrence
      else jsonb_strip_nulls(jsonb_build_object('freq', v.recurrence -> 'freq', 'weekdays', v.recurrence -> 'weekdays',
        'ends', jsonb_strip_nulls(jsonb_build_object('type', v.recurrence #> '{ends,type}', 'date', v.recurrence #> '{ends,date}', 'count', v.recurrence #> '{ends,count}')))) end,
    case v.view when 'full' then v.reminder when 'cover' then 'none' end,
    case when v.view = 'full' then v.responsible_member_id end,
    case when v.view = 'cover' then 'family' else v.visibility end,
    v.creator_member,
    coalesce((select jsonb_agg(case em.who when 'member' then to_jsonb(em.member_id) else to_jsonb(em.who) end order by em.created_at, em.id)
      from public.event_members em where em.event_id = v.id and em.who <> 'removed'), '[]'),
    coalesce((select jsonb_agg(em.removed_name order by em.created_at, em.id)
      from public.event_members em where em.event_id = v.id and em.who = 'removed'), '[]'),
    coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'occurrence_date', x.occurrence_date,
        'cancelled', x.cancelled,
        'override', case when v.view = 'full' or x.override is null then x.override else (
          select coalesce(jsonb_object_agg(o.key, o.value), '{}') from jsonb_each(x.override) o
          where o.key = any (array['starts_on', 'ends_on', 'time_type', 'slots', 'start_time', 'end_time', 'members']
            || case when v.view = 'cover' then array['location'] else array[]::text[] end)
        ) end
      )) order by x.occurrence_date)
      from public.event_exceptions x where x.event_id = v.id), '[]'),
    case v.view
      when 'full' then coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'position', c.position, 'label', c.label, 'done', c.done, 'done_by', c.done_by) order by c.position)
        from public.event_checklist_items c where c.event_id = v.id), '[]')
      when 'cover' then '[]'
    end,
    case when v.view = 'full' and v.visibility = 'surprise' and v.cover_title is not null
      then jsonb_strip_nulls(jsonb_build_object('hidden_from', to_jsonb(v.hidden_from), 'cover_title', v.cover_title, 'cover_note', v.cover_note)) end,
    v.created_by, v.updated_by, v.source::text, v.created_at, v.updated_at, v.deleted_at, v.deleted_by,
    case when v.view = 'cover' and auth.jwt() ->> 'client_id' is not null then 'full' else v.view end
  from seen v;
$$;
create view public.events_visible with (security_invoker = true) as
  select * from public._events_visible();

revoke all on public.events_visible from anon, authenticated;
-- Signed-out callers get no rows anyway; they don't get to call it either.
revoke all on function public._events_visible() from public, anon;
grant select on public.events_visible to authenticated, cocon_assistant;
grant execute on function public._events_visible() to authenticated, cocon_assistant;
