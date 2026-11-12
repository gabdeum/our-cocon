-- Spec 053 FR-019: the activity list pages by (created_at, key), not created_at alone. Entries
-- logged in one transaction share a time, so a strict `created_at < p_before` skipped the ones left
-- past a page's last row. `p_before_key` is that row's key; without it, paging works as before.
-- The arguments change, so the function is made again (body unchanged apart from paging and order).
drop function public.activity_entries(int, timestamptz, uuid, text);
create function public.activity_entries(
  p_limit int default 20,
  p_before timestamptz default null,
  p_actor uuid default null,
  p_source text default null,
  p_before_key uuid default null
) returns table (
  key uuid,
  actor_id uuid,
  source text,
  kind text,
  created_at timestamptz,
  count int,
  names text[],
  recipe_id uuid,
  recipe_name text,
  from_recipe_name text,
  event_id uuid,
  event_name text,
  event_when jsonb,
  event_secret boolean,
  undone_by uuid,
  undone_at timestamptz,
  undo_action text,
  can_undo boolean,
  can_restore boolean
)
language sql stable security invoker set search_path = '' as $$
  with logged as (
    select a.*, public._activity_key(a.payload, a.id) as k
    from public.activity a
    where a.action in ('insert', 'update', 'delete')
  ),
  entries as (
    select
      k,
      (array_agg(r.actor_id order by r.seq))[1] as actor_id,
      (array_agg(r.source::text order by r.seq))[1] as source,
      min(r.created_at) as created_at,
      count(distinct r.target_id) filter (where r.target_kind <> 'grocery_items') as others,
      count(distinct r.payload ->> 'name') filter (where r.target_kind = 'grocery_items') as items,
      (array_agg(distinct r.payload ->> 'name') filter (where r.target_kind = 'grocery_items'))[1:3] as names,
      (array_agg((r.payload ->> 'recipe_id')::uuid order by r.seq)
        filter (where r.target_kind in ('recipes', 'recipe_ingredients', 'recipe_steps', 'recipe_variants')))[1] as recipe_id,
      (array_agg(r.payload ->> 'name' order by r.seq desc) filter (where r.target_kind = 'recipes'))[1] as logged_name,
      (array_agg((r.payload ->> 'recipe_id')::uuid order by r.seq) filter (where r.target_kind = 'grocery_items' and r.payload ? 'recipe_id'))[1] as from_recipe,
      (array_agg((r.payload ->> 'event_id')::uuid order by r.seq) filter (where r.payload ? 'event_id'))[1] as event_id,
      (array_agg(r.payload ->> 'name' order by r.seq) filter (where r.target_kind = 'events'))[1] as logged_event_name,
      coalesce(bool_or((r.payload ->> 'secret')::boolean), false) as event_secret,
      (array_agg(r.target_id order by r.seq) filter (where r.target_kind = 'events' and coalesce((r.payload ->> 'deleted')::boolean, false)))[1] as deleted_event
    from logged r
    group by k
    having (p_actor is null or (array_agg(r.actor_id order by r.seq))[1] = p_actor)
      and (p_source is null
        or (p_source = 'ai' and (array_agg(r.source::text order by r.seq))[1] <> 'app')
        -- 'other': any assistant the app can't name (OC-Activity's "Other" pill).
        or (p_source = 'other' and (array_agg(r.source::text order by r.seq))[1] not in ('app', 'claude', 'chatgpt', 'gemini'))
        or (array_agg(r.source::text order by r.seq))[1] = p_source)
  ),
  page as (
    select * from entries e
    where p_before is null
      or e.created_at < p_before
      or (e.created_at = p_before and p_before_key is not null and e.k < p_before_key)
    order by e.created_at desc, e.k desc
    limit least(greatest(coalesce(p_limit, 20), 1), 100)
  )
  select
    p.k,
    p.actor_id,
    p.source,
    kind.v,
    p.created_at,
    case when p.items > 0 then p.items else p.others end::int,
    coalesce(p.names, '{}'),
    p.recipe_id,
    coalesce(rec.name, p.logged_name),
    fr.name,
    p.event_id,
    coalesce(ev.title, p.logged_event_name),
    case when ev.id is not null then jsonb_build_object('starts_on', ev.starts_on, 'time_type', ev.time_type, 'slots', ev.slots,
      'start_time', ev.start_time, 'end_time', ev.end_time) end,
    p.event_secret,
    u.actor_id,
    u.created_at,
    u.action,
    p.source <> 'app' and u.id is null and kind.v not in ('recipe_deleted', 'event_deleted') and p.created_at > now() - interval '7 days',
    p.source <> 'app' and u.id is null and (kind.v = 'recipe_deleted' and rec.deleted_at is not null and rec.deleted_at > now() - interval '30 days'
      or kind.v = 'event_deleted' and dev.deleted_at is not null and dev.deleted_at > now() - interval '30 days')
  from page p
  cross join lateral (select public._activity_kind(p.k) as v) kind
  left join public.recipes rec on rec.id = p.recipe_id
  left join public.recipes fr on fr.id = p.from_recipe
  left join public.events ev on ev.id = p.event_id
  left join public.events dev on dev.id = p.deleted_event
  left join lateral (
    select a.id, a.actor_id, a.created_at, a.action from public.activity a
    where a.target_id = p.k and a.action in ('undo', 'restore')
    order by a.seq limit 1
  ) u on true
  order by p.created_at desc, p.k desc;
$$;
grant execute on function public.activity_entries(int, timestamptz, uuid, text, uuid) to authenticated;
