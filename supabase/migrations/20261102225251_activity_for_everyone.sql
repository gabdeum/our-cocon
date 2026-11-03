-- Spec 028 FR-009 (extends spec 026): the activity log holds the family's own changes too, not only
-- their assistants'. Home's "Latest activity" and the activity list show both, with "All · AI only".
--   - App writes are logged by the same triggers, with `source` 'app': recipes added, edited (with
--     their ingredients, steps and variants), deleted and restored; grocery items added, ticked and
--     cleared; events added, changed and deleted. Nothing else people do is logged.
--   - An app row keeps no `before` and no event title: it's never undone (only assistant entries
--     are, as before), and a title is read from the event itself, as the reader may see it.
--   - One app action is often several requests (a recipe save is four), so rows group by what they
--     change, not by call: the same person's rows on the same recipe or event within 10 minutes,
--     their ticks within 10 minutes, their adds or clears within 30 seconds. The database chooses
--     the group (`call_id`); nobody can name it, and an assistant can't join it (spec 026's check
--     refuses a key from another source).
--   - Everyone in the family reads app entries, except an event's: a private event's show as "a
--     private event" (its title stays hidden by the events' own rules), and a surprise's aren't
--     read by the people it's kept from.

-- --- Logging (FR-009) ---------------------------------------------------------------------------------

-- What an app write is, and the entry it joins. Called by _log_assistant_write for a signed-in
-- member's own session; returns without logging anything that isn't listed above.
create function public._log_app_write(op text, tbl text, r jsonb, was jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  fam uuid := (r ->> 'family_id')::uuid;
  kind text;
  subject text;
  joins text[] := '{}';
  span interval;
  key uuid;
  recipe uuid;
  eid uuid;
  vis text;
  payload jsonb;
  stamps constant text[] := array['updated_at', 'updated_by', 'created_by', 'checked_by', 'deleted_by'];
begin
  -- Only a member's own changes to their family: not the cascade of an account or family being
  -- deleted, nor who-stamps a departure clears, nor what Undo puts back (its own entry says so).
  if fam is distinct from public.my_family_id() or op = 'UPDATE' and (r - stamps) = (was - stamps)
    or current_setting('cocon.undoing', true) = 'on' then
    return;
  end if;
  case
    when tbl = 'recipes' then
      recipe := (r ->> 'id')::uuid;
      subject := 'recipe:' || recipe;
      if op = 'INSERT' then
        kind := 'recipe_created';
      elsif op = 'UPDATE' and was ->> 'deleted_at' is null and r ->> 'deleted_at' is not null then
        kind := 'recipe_deleted';
      elsif op = 'UPDATE' and was ->> 'deleted_at' is not null and r ->> 'deleted_at' is null then
        kind := 'recipe_restored';
      elsif op = 'UPDATE' and r ->> 'deleted_at' is null then
        kind := 'recipe_edited';
      end if;
    when tbl in ('recipe_ingredients', 'recipe_steps', 'recipe_variants') then
      recipe := (r ->> 'recipe_id')::uuid;
      subject := 'recipe:' || recipe;
      -- Not for a recipe that's gone or in Recently deleted (its rows going with it).
      if exists (select 1 from public.recipes x where x.id = recipe and x.deleted_at is null) then
        kind := 'recipe_edited';
      end if;
    when tbl = 'grocery_items' then
      recipe := (r ->> 'recipe_id')::uuid;
      if op = 'INSERT' then
        kind := 'groceries_added';
      elsif op = 'UPDATE' and r ->> 'deleted_at' is null
        and not coalesce((was ->> 'checked')::boolean, false) and coalesce((r ->> 'checked')::boolean, false) then
        kind := 'groceries_ticked';
      elsif op = 'UPDATE' and was ->> 'deleted_at' is null and r ->> 'deleted_at' is not null and coalesce((was ->> 'checked')::boolean, false) then
        kind := 'groceries_cleared';
      end if;
      subject := 'groceries:' || kind;
    when tbl = 'events' then
      eid := (r ->> 'id')::uuid;
      if op = 'INSERT' then
        kind := 'event_created';
      elsif op = 'UPDATE' and was ->> 'deleted_at' is null and r ->> 'deleted_at' is not null then
        kind := 'event_deleted';
      elsif op = 'UPDATE' and r ->> 'deleted_at' is null and was ->> 'deleted_at' is null then
        kind := 'event_edited';
      end if;
    when tbl in ('event_members', 'event_exceptions', 'event_surprise') then
      eid := (r ->> 'event_id')::uuid;
      -- Not for an event that's gone or in Recently deleted (its rows going with it).
      if exists (select 1 from public.events e where e.id = eid and e.deleted_at is null) then
        kind := 'event_edited';
      end if;
    else
      null;
  end case;
  if kind is null then
    return;
  end if;
  if eid is not null then
    subject := 'event:' || eid;
    select e.visibility into vis from public.events e where e.id = eid;
  end if;

  joins := case kind
    when 'recipe_edited' then array['recipe_created', 'recipe_edited']
    when 'event_edited' then array['event_created', 'event_edited']
    when 'groceries_added' then array['groceries_added']
    when 'groceries_ticked' then array['groceries_ticked']
    when 'groceries_cleared' then array['groceries_cleared']
    else '{}'
  end;
  span := case when kind in ('groceries_added', 'groceries_cleared') then interval '30 seconds' else interval '10 minutes' end;
  -- Requests of one action can run at once: one at a time per person and subject, so they find
  -- each other's entry (each statement reads what committed before it).
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || subject, 0));
  if cardinality(joins) > 0 then
    select public._activity_key(a.payload, a.id) into key
    from public.activity a
    where a.family_id = fam and a.actor_id = auth.uid() and a.source = 'app'
      and a.payload ->> 'subject' = subject and a.payload ->> 'kind' = any (joins)
      and a.created_at > now() - span
    group by 1
    having min(a.created_at) > now() - span
    order by max(a.seq) desc
    limit 1;
  end if;

  select coalesce(jsonb_object_agg(k, v), '{}') into payload
  from jsonb_each(jsonb_build_object(
    'call_id', coalesce(key, gen_random_uuid()),
    'kind', kind,
    'subject', subject,
    'recipe_id', recipe,
    'event_id', eid,
    'secret', case when vis <> 'family' then true end,
    'surprise', case when vis = 'surprise' then true end,
    'name', case when tbl in ('recipes', 'grocery_items') then r ->> 'name' end)) as e (k, v)
  where v <> 'null'::jsonb;
  insert into public.activity (family_id, actor_id, action, target_kind, target_id, payload)
  values (fam, auth.uid(), lower(op), tbl, (r ->> 'id')::uuid, payload);
end;
$$;
revoke all on function public._log_app_write(text, text, jsonb, jsonb) from public, anon, authenticated;

-- As in spec 044, plus the app's own writes (above) for a signed-in member. Writes with no one
-- signed in (seed, the nightly purges) stay unlogged.
create or replace function public._log_assistant_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  was jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  headers jsonb;
  call_id text;
  tool text;
  payload jsonb;
  event_id uuid;
  secret boolean;
begin
  if tg_op = 'UPDATE' and (r - 'updated_at' - 'updated_by') = (was - 'updated_at' - 'updated_by') then
    return null;
  end if;
  if auth.jwt() ->> 'client_id' is null then
    if auth.uid() is not null then
      perform public._log_app_write(tg_op, tg_table_name, r, was);
    end if;
    return null;
  end if;
  begin
    headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    headers := null;
  end;
  call_id := headers ->> 'x-cocon-call';
  tool := headers ->> 'x-cocon-tool';
  -- The labels come from whoever holds the token, which can call the API directly. A call id only
  -- groups rows of one fresh call by this person and assistant, never undone: otherwise the row is
  -- an entry of its own, so nobody can hide a write in an undone or week-old entry, or another's.
  if call_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and exists (
    select 1 from public.activity a
    where a.family_id = (r ->> 'family_id')::uuid
      and (a.target_id = call_id::uuid and a.action in ('undo', 'restore')
        or public._activity_key(a.payload, a.id) = call_id::uuid
          and (a.actor_id is distinct from auth.uid() or a.source <> public._request_source() or a.created_at < now() - interval '10 minutes'))
  ) then
    call_id := null;
  end if;
  if tg_table_name in ('events', 'event_members', 'event_exceptions', 'event_checklist_items', 'event_surprise') then
    event_id := coalesce(r ->> 'event_id', r ->> 'id')::uuid;
    secret := case when tg_table_name = 'events' then r ->> 'visibility' <> 'family' or was ->> 'visibility' <> 'family'
      else coalesce((select e.visibility <> 'family' from public.events e where e.id = event_id), true) end;
  end if;
  -- One entry never mixes rows people read under different rules (a private event's with a family
  -- event's, or an event's with a recipe's), so nobody undoes a part they can't see.
  if call_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and exists (
    select 1 from public.activity a
    where a.family_id = (r ->> 'family_id')::uuid and public._activity_key(a.payload, a.id) = call_id::uuid
      and ((a.payload ? 'event_id') <> (event_id is not null) or coalesce((a.payload ->> 'secret')::boolean, false) <> coalesce(secret, false))
  ) then
    call_id := null;
  end if;
  -- Empty labels are left out; `before` keeps its empty fields (Undo puts them back too).
  select coalesce(jsonb_object_agg(k, v), '{}') into payload
  from jsonb_each(jsonb_build_object(
    'recipe_id', coalesce(r ->> 'recipe_id', case when tg_table_name = 'recipes' then r ->> 'id' end),
    'event_id', event_id,
    'secret', case when secret then true end,
    'call_id', case when call_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then call_id end,
    'tool', case when tool ~ '^[a-z][a-z_]{0,39}$' then tool end,
    'name', case when tg_table_name in ('recipes', 'grocery_items') then r ->> 'name' when tg_table_name = 'events' then r ->> 'title' end,
    'after_hash', case when tg_op <> 'DELETE' then public._row_fingerprint(r) end,
    -- A recipe or an event going to Recently deleted: what makes an entry a delete (Restore), not its label.
    'deleted', case when tg_table_name in ('recipes', 'events') and tg_op = 'UPDATE' and was ->> 'deleted_at' is null and r ->> 'deleted_at' is not null then true end,
    'before', was)) as e (k, v)
  where v <> 'null'::jsonb;
  -- The log keeps payloads under 64 KB. A change it couldn't undo (a variant's long change list) is
  -- refused rather than made without its `before`; the tool says it couldn't save.
  if octet_length(payload::text) > 60000 then
    raise exception 'too big to log for undo' using errcode = '54000';
  end if;
  insert into public.activity (family_id, actor_id, action, target_kind, target_id, payload)
  values ((r ->> 'family_id')::uuid, auth.uid(), lower(tg_op), tg_table_name, (r ->> 'id')::uuid, payload);
  return null;
end;
$$;

-- Finding a person's open app entry on a subject.
create index activity_app_subject on public.activity (family_id, actor_id, (payload ->> 'subject'), created_at desc) where source = 'app';

-- --- Who reads an app entry -------------------------------------------------------------------------

-- An app row of an event: while the event is there, read by whoever may see it, and a private
-- event's by the whole family (its title stays the events' own business); a surprise's never by
-- the people it's kept from, even once the surprise is made private (a row logged while it was a
-- surprise then stays with its author and the event's creator). Once the event is gone for good, a
-- secret row stays with its author.
create function public._sees_logged_app_event(eid uuid, secret boolean, surprise boolean, actor uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from public.events e where e.id = eid and e.family_id = public.my_family_id())
      then public._sees_event(eid)
        or exists (select 1 from public.events e where e.id = eid and e.visibility = 'private')
          and (not coalesce(surprise, false) or actor = auth.uid() or public._created_event(eid))
    else not coalesce(secret, false) or actor = auth.uid()
  end;
$$;
revoke all on function public._sees_logged_app_event(uuid, boolean, boolean, uuid) from public, anon;
grant execute on function public._sees_logged_app_event(uuid, boolean, boolean, uuid) to authenticated;

alter policy "members read their family's activity" on public.activity
  using (family_id = public.my_family_id() and (action not in ('insert', 'update', 'delete') or payload ->> 'event_id' is null
    or (payload ->> 'event_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and case when source = 'app'
        then public._sees_logged_app_event((payload ->> 'event_id')::uuid, payload -> 'secret' = 'true'::jsonb, payload -> 'surprise' = 'true'::jsonb, actor_id)
        else public._sees_logged_event((payload ->> 'event_id')::uuid, payload -> 'secret' = 'true'::jsonb, actor_id)
      end)));

-- --- Reading the log ----------------------------------------------------------------------------------

-- What an entry did: an app entry says it itself (its first row's `kind`); an assistant's, as in
-- spec 044, from the tool's label checked against the rows.
create or replace function public._activity_kind(p_key uuid) returns text
language sql stable security invoker set search_path = '' as $$
  with logged as (
    select * from public.activity a
    where public._activity_key(a.payload, a.id) = p_key and a.action in ('insert', 'update', 'delete')
  )
  select coalesce((select payload ->> 'kind' from logged where source = 'app' order by seq limit 1), case (select payload ->> 'tool' from logged order by seq limit 1)
    when 'create_recipe' then 'recipe_created'
    when 'update_recipe' then 'recipe_edited'
    when 'delete_recipe' then
      case when (select bool_and(target_kind = 'recipes' and action = 'update' and coalesce((payload ->> 'deleted')::boolean, false)) from logged)
        then 'recipe_deleted' else 'other' end
    when 'add_groceries' then 'groceries_added'
    when 'add_recipe_to_groceries' then 'groceries_added'
    when 'check_grocery' then
      case when (select bool_and((payload -> 'before' ->> 'checked')::boolean) from logged where target_kind = 'grocery_items')
        then 'groceries_unticked' else 'groceries_ticked' end
    when 'remove_grocery' then 'groceries_removed'
    when 'clear_done_groceries' then 'groceries_cleared'
    when 'create_event' then 'event_created'
    when 'update_event' then 'event_edited'
    when 'delete_event' then
      case when exists (select 1 from logged where target_kind = 'events' and coalesce((payload ->> 'deleted')::boolean, false))
        then 'event_deleted' else 'event_date_deleted' end
    else 'other'
  end);
$$;

-- As in spec 044, with app entries (never undone or restored). `p_source` 'ai' keeps assistant
-- entries only ("AI only"); 'other' is an assistant the app can't name. New: the recipe grocery
-- items came from (`from_recipe_name`, "added 6 items from Leek quiche"), and when the entry's event
-- is (`event_when`), both as the caller may see them now, and whether it was private or a surprise
-- when logged (`event_secret`: an untitled one reads "a private event", else "an event"). A recipe entry made only of ingredient,
-- step or variant rows still names its recipe. The return type changes, so it's made again.
drop function public.activity_entries(int, timestamptz, uuid, text);
create function public.activity_entries(
  p_limit int default 20,
  p_before timestamptz default null,
  p_actor uuid default null,
  p_source text default null
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
    where p_before is null or e.created_at < p_before
    order by e.created_at desc
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
  order by p.created_at desc;
$$;
grant execute on function public.activity_entries(int, timestamptz, uuid, text) to authenticated;

-- Who has entries (app and AI), and which assistants, for the list's filters. App rows come back
-- with `source` 'app'; the list leaves them out of the Assistants pills.
create or replace function public.activity_filters() returns table (actor_id uuid, source text)
language sql stable security invoker set search_path = '' as $$
  select distinct a.actor_id, a.source::text from public.activity a
  where a.action in ('insert', 'update', 'delete');
$$;

-- --- Undo -----------------------------------------------------------------------------------------------

-- Undo (spec 026) as before, marked so what it puts back isn't logged again as the member's own
-- change: its undo or restore entry already says who did it. The mark is off again once it's done;
-- calling the inner function directly only adds that app entry.
alter function public.undo_ai_change(uuid, boolean) rename to _undo_ai_change;
create function public.undo_ai_change(p_key uuid, p_skip_changed boolean default false) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  result jsonb;
begin
  perform set_config('cocon.undoing', 'on', true);
  result := public._undo_ai_change(p_key, p_skip_changed);
  perform set_config('cocon.undoing', 'off', true);
  return result;
end;
$$;
revoke all on function public.undo_ai_change(uuid, boolean) from public, anon;
grant execute on function public.undo_ai_change(uuid, boolean) to authenticated;
