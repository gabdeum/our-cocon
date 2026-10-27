-- Spec 035: the calendar's tables. Events with who they're for, "this event only" changes, a
-- checklist and a surprise cover; the family's slot times and home time zone. Privacy is enforced
-- here (constitution VI): a private event is "Busy" to everyone but its creator, and the people a
-- surprise is hidden from get only its cover. Both read events through `events_visible`, which
-- hands `@cocon/calendar`'s `viewFor` the creator's member id, the members and the cover
-- (032-later L80). Limits match packages/schemas/calendar.ts.

-- Member references stay inside the family, like a child row's reference to its parent.
alter table public.members add constraint members_id_family_key unique (id, family_id);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60 and title = btrim(title)),
  category text check (category in ('sport', 'school', 'work', 'health', 'social', 'travel', 'home', 'birthday', 'other')),
  location text check (char_length(location) between 1 and 200),
  notes text check (char_length(notes) between 1 and 2000),
  -- Wall-clock dates and times in the family's home time zone (spec 034 FR-008).
  starts_on date not null,
  ends_on date not null,
  time_type text not null check (time_type in ('slot', 'all_day', 'custom')),
  slots text[] not null default '{}' check (slots <@ array['early_morning', 'morning', 'lunch', 'afternoon', 'evening'] and cardinality(slots) <= 5),
  start_time text check (start_time ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  end_time text check (end_time ~ '^(([01]\d|2[0-3]):[0-5]\d|24:00)$'),
  -- Shaped by Recurrence in packages/schemas/calendar.ts.
  recurrence jsonb check (recurrence is null or (jsonb_typeof(recurrence) = 'object' and pg_column_size(recurrence) <= 2048)),
  reminder text not null default 'none' check (reminder in ('none', 'morning_of', 'hour_before', 'day_before')),
  -- "Who takes James?" (spec 041): someone with the app.
  responsible_member_id uuid,
  visibility text not null default 'family' check (visibility in ('family', 'private', 'surprise')),
  -- Soft delete (spec 018): in Recently deleted for 30 days.
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  source public.write_source not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, family_id),
  check (ends_on >= starts_on and ends_on - starts_on <= 366),
  check (case time_type
    when 'slot' then cardinality(slots) > 0 and start_time is null and end_time is null
    when 'custom' then cardinality(slots) = 0 and start_time is not null and end_time is not null
    else cardinality(slots) = 0 and start_time is null and end_time is null
  end),
  foreign key (responsible_member_id, family_id) references public.members (id, family_id) on delete set null (responsible_member_id)
);
create index events_family_starts on public.events (family_id, starts_on);
create index events_family_deleted on public.events (family_id, deleted_at desc) where deleted_at is not null;

-- Who an event is for: members, Everyone, Others (spec 033 FR-005), and members who were removed
-- since (past events keep them, shown grey with their name: 032-later L78).
create table public.event_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  event_id uuid not null,
  who text not null check (who in ('member', 'everyone', 'others', 'removed')),
  member_id uuid,
  removed_name text check (char_length(removed_name) between 1 and 40),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  source public.write_source not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((who = 'member') = (member_id is not null)),
  check ((who = 'removed') = (removed_name is not null)),
  foreign key (event_id, family_id) references public.events (id, family_id) on delete cascade,
  -- A member's rows turn into `removed` before the member goes (trigger below).
  foreign key (member_id, family_id) references public.members (id, family_id) on delete set null (member_id)
);
create unique index event_members_once on public.event_members (event_id, who, coalesce(member_id, '00000000-0000-0000-0000-000000000000')) where who <> 'removed';
create index event_members_event on public.event_members (event_id);
create index event_members_member on public.event_members (member_id);

-- The fields a "this event only" change may replace (EventOverride, packages/schemas/calendar.ts):
-- never the visibility, the creator or the surprise, so an override can't unlock hidden details.
create function public._override_keys_ok(o jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select o is null or (jsonb_typeof(o) = 'object' and array(select jsonb_object_keys(o)) <@ array[
    'title', 'category', 'location', 'notes', 'starts_on', 'ends_on', 'time_type', 'slots', 'start_time', 'end_time', 'members', 'responsible_member_id'
  ]);
$$;

create table public.event_exceptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  event_id uuid not null,
  -- The series date it changes (the occurrence's key, spec 034).
  occurrence_date date not null,
  cancelled boolean not null default false,
  override jsonb check (public._override_keys_ok(override) and pg_column_size(override) <= 8192),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  source public.write_source not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cancelled or override is not null),
  unique (event_id, occurrence_date),
  foreign key (event_id, family_id) references public.events (id, family_id) on delete cascade
);

create table public.event_checklist_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  event_id uuid not null,
  position integer not null check (position between 0 and 49),
  label text not null check (char_length(label) between 1 and 80 and label = btrim(label)),
  done boolean not null default false,
  -- The member who ticked it, set by the database.
  done_by uuid,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  source public.write_source not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (event_id, family_id) references public.events (id, family_id) on delete cascade,
  foreign key (done_by, family_id) references public.members (id, family_id) on delete set null (done_by),
  unique (event_id, position) deferrable initially deferred
);

-- A surprise (spec 043): who it's hidden from, and what they see instead.
create table public.event_surprise (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  event_id uuid not null unique,
  hidden_from uuid[] not null check (cardinality(hidden_from) between 1 and 20),
  cover_title text not null check (char_length(cover_title) between 1 and 60 and cover_title = btrim(cover_title)),
  cover_note text check (char_length(cover_note) between 1 and 200),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  source public.write_source not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (event_id, family_id) references public.events (id, family_id) on delete cascade
);

-- The family's slot times and home time zone (spec 029 edits them). No row, or null, means the
-- engine's default slots (spec 034 FR-002); the time zone is set by the first device that opens
-- the app (claim_home_time_zone).
create table public.family_calendar_settings (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null unique references public.families (id) on delete cascade,
  slot_times jsonb check (slot_times is null or (jsonb_typeof(slot_times) = 'object'
    and slot_times ?& array['early_morning', 'morning', 'lunch', 'afternoon', 'evening'] and pg_column_size(slot_times) <= 1024)),
  home_time_zone text check (char_length(home_time_zone) between 1 and 64),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  source public.write_source not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Live (FR-003): events and what the calendar screens show of them. Surprises and settings aren't.
select public._family_table('public.events', live => true);
select public._family_table('public.event_members', live => true);
select public._family_table('public.event_exceptions', live => true);
select public._family_table('public.event_checklist_items', live => true);
select public._family_table('public.event_surprise', live => false);
select public._family_table('public.family_calendar_settings', live => false);

-- Helpers.

-- The caller's member id (null for someone outside a family).
create function public._my_member_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.members where user_id = auth.uid();
$$;

-- Whether the caller may see an event's details (FR-002): a family event, one they created, or a
-- surprise that isn't hidden from them. As `viewFor` decides: a surprise without its cover, or
-- whose creator has left the family, is hidden from everyone but its creator. Policies call it, so
-- members can execute it; it only answers for the caller's own family.
create function public._sees_event(vis text, creator uuid, eid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select vis = 'family' or creator = auth.uid()
    or (vis = 'surprise'
      and exists (select 1 from public.members m where m.user_id = creator and m.family_id = public.my_family_id())
      and exists (
        select 1 from public.event_surprise s where s.event_id = eid and not (coalesce(public._my_member_id() = any (s.hidden_from), false))
      ));
$$;
create function public._sees_event(eid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select public._sees_event(e.visibility, e.created_by, e.id) from public.events e
    where e.id = eid and e.family_id = public.my_family_id()), false);
$$;
-- Whether the caller created the event (only they set up its surprise, 043 FR-005).
create function public._created_event(eid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.events e where e.id = eid and e.family_id = public.my_family_id() and e.created_by = auth.uid());
$$;

-- Policies: the family rule from _family_table, narrowed by what the caller may see.

-- A private event, and a surprise hidden from the caller, can only be read through events_visible;
-- they can't be changed or deleted by those who can't see them either.
drop policy "members read their family's rows" on public.events;
drop policy "members change their family's rows" on public.events;
drop policy "members remove their family's rows" on public.events;
create policy "members read the events they may see" on public.events
  for select to authenticated using (family_id = public.my_family_id() and public._sees_event(visibility, created_by, id));
create policy "members change the events they may see" on public.events
  for update to authenticated using (family_id = public.my_family_id() and public._sees_event(visibility, created_by, id))
  with check (family_id = public.my_family_id());
-- Deletes are soft: removed for good only from Recently deleted.
create policy "members remove deleted events they may see" on public.events
  for delete to authenticated using (family_id = public.my_family_id() and deleted_at is not null and public._sees_event(visibility, created_by, id));

-- Who an event is for is public in the family (a Busy chip has the member's color); changing it
-- needs the details.
drop policy "members add to their family" on public.event_members;
drop policy "members change their family's rows" on public.event_members;
drop policy "members remove their family's rows" on public.event_members;
create policy "members add who the events they may see are for" on public.event_members
  for insert to authenticated with check (family_id = public.my_family_id() and public._sees_event(event_id));
create policy "members change who the events they may see are for" on public.event_members
  for update to authenticated using (family_id = public.my_family_id() and public._sees_event(event_id))
  with check (family_id = public.my_family_id() and public._sees_event(event_id));
create policy "members remove who the events they may see are for" on public.event_members
  for delete to authenticated using (family_id = public.my_family_id() and public._sees_event(event_id));

-- Exceptions and checklists are details: only for those who see the event.
do $$
declare
  t text;
begin
  foreach t in array array['event_exceptions', 'event_checklist_items'] loop
    execute format('drop policy "members read their family''s rows" on public.%I', t);
    execute format('drop policy "members add to their family" on public.%I', t);
    execute format('drop policy "members change their family''s rows" on public.%I', t);
    execute format('drop policy "members remove their family''s rows" on public.%I', t);
    execute format('create policy "members read details of the events they may see" on public.%I for select to authenticated using (family_id = public.my_family_id() and public._sees_event(event_id))', t);
    execute format('create policy "members add details to the events they may see" on public.%I for insert to authenticated with check (family_id = public.my_family_id() and public._sees_event(event_id))', t);
    execute format('create policy "members change details of the events they may see" on public.%I for update to authenticated using (family_id = public.my_family_id() and public._sees_event(event_id)) with check (family_id = public.my_family_id() and public._sees_event(event_id))', t);
    execute format('create policy "members remove details of the events they may see" on public.%I for delete to authenticated using (family_id = public.my_family_id() and public._sees_event(event_id))', t);
  end loop;
end;
$$;

-- The surprise: read by those it isn't hidden from, set up by the event's creator only.
drop policy "members read their family's rows" on public.event_surprise;
drop policy "members add to their family" on public.event_surprise;
drop policy "members change their family's rows" on public.event_surprise;
drop policy "members remove their family's rows" on public.event_surprise;
create policy "members read the surprises they're in on" on public.event_surprise
  for select to authenticated using (family_id = public.my_family_id() and public._sees_event(event_id));
create policy "creators set up their surprise" on public.event_surprise
  for insert to authenticated with check (family_id = public.my_family_id() and public._created_event(event_id));
create policy "creators change their surprise" on public.event_surprise
  for update to authenticated using (family_id = public.my_family_id() and public._created_event(event_id))
  with check (family_id = public.my_family_id() and public._created_event(event_id));
create policy "creators remove their surprise" on public.event_surprise
  for delete to authenticated using (family_id = public.my_family_id() and public._created_event(event_id));

-- Slot times are family-wide and the owner edits them (C7, spec 029). Deleting the row would put
-- everyone back on the defaults, so nobody does.
revoke delete on public.family_calendar_settings from authenticated;
drop policy "members add to their family" on public.family_calendar_settings;
drop policy "members change their family's rows" on public.family_calendar_settings;
drop policy "members remove their family's rows" on public.family_calendar_settings;
create policy "owners add their family's calendar settings" on public.family_calendar_settings
  for insert to authenticated with check (family_id = public.my_family_id()
    and exists (select 1 from public.families f where f.id = family_id and f.owner_id = auth.uid()));
create policy "owners change their family's calendar settings" on public.family_calendar_settings
  for update to authenticated using (family_id = public.my_family_id()
    and exists (select 1 from public.families f where f.id = family_id and f.owner_id = auth.uid()))
  with check (family_id = public.my_family_id());

-- Triggers (named after `_stamp`, so they run once the family and author are set).

-- Only the creator changes who can see an event (043 FR-005); "who takes them" has the app.
create function public._check_event() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.visibility is distinct from old.visibility and auth.uid() is not null
    and old.created_by is distinct from auth.uid() then
    raise exception 'only_creator_changes_visibility' using errcode = '42501';
  end if;
  if new.responsible_member_id is not null and not exists (
    select 1 from public.members m where m.id = new.responsible_member_id and m.family_id = new.family_id and m.user_id is not null
  ) then
    raise exception 'responsible_needs_app' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger events_validate before insert or update on public.events
  for each row execute function public._check_event();

-- A surprise is kept from people with the app (043 FR-002), never from its own creator.
create function public._check_surprise() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from unnest(new.hidden_from) h where not exists (
    select 1 from public.members m where m.id = h and m.family_id = new.family_id and m.user_id is not null
  )) then
    raise exception 'hidden_from_needs_app' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.events e join public.members m on m.user_id = e.created_by and m.family_id = e.family_id
    where e.id = new.event_id and m.id = any (new.hidden_from)
  ) then
    raise exception 'hidden_from_creator' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger event_surprise_validate before insert or update on public.event_surprise
  for each row execute function public._check_surprise();

-- Who ticked an item, from the token; cleared when it's unticked.
create function public._stamp_checklist_done() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not new.done then
    new.done_by := null;
  elsif tg_op = 'INSERT' or not old.done then
    new.done_by := coalesce(public._my_member_id(), new.done_by);
  else
    new.done_by := old.done_by;
  end if;
  return new;
end;
$$;
create trigger event_checklist_items_validate before insert or update on public.event_checklist_items
  for each row execute function public._stamp_checklist_done();

create function public._check_time_zone() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.home_time_zone is not null and not exists (select 1 from pg_catalog.pg_timezone_names where name = new.home_time_zone) then
    raise exception 'unknown_time_zone' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger family_calendar_settings_validate before insert or update on public.family_calendar_settings
  for each row execute function public._check_time_zone();

-- Soft delete for recipes (spec 018) and events: when and by whom, cleared on restore; the time is
-- the database's, and nothing comes back after its 30 days. Replaces the recipes-only trigger.
-- Security definer, as the one it replaces (spec 023): assistants can't use the `auth` schema.
create function public._stamp_soft_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.deleted_at is null then
    if tg_op = 'UPDATE' and old.deleted_at is not null and auth.uid() is not null
      and old.deleted_at < now() - interval '30 days' then
      raise exception 'This % was deleted more than 30 days ago', rtrim(tg_table_name, 's') using errcode = '22023';
    end if;
    new.deleted_by := null;
  elsif tg_op = 'INSERT' or old.deleted_at is null then
    new.deleted_by := coalesce(auth.uid(), new.deleted_by);
    if auth.uid() is not null then
      new.deleted_at := now();
    end if;
  else
    new.deleted_by := old.deleted_by;
    new.deleted_at := old.deleted_at;
  end if;
  return new;
end;
$$;
drop trigger recipes_deleted on public.recipes;
drop function public._stamp_recipe_deleted();
create trigger recipes_deleted before insert or update on public.recipes
  for each row execute function public._stamp_soft_delete();
create trigger events_deleted before insert or update on public.events
  for each row execute function public._stamp_soft_delete();

-- Live changes stay as in spec 004: which row, never its content. They don't name the event a
-- checklist item or exception belongs to, so a change to a surprise's details doesn't reach the
-- people it's hidden from as a change to "their" event.
create or replace function public._broadcast_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  perform realtime.send(
    jsonb_strip_nulls(jsonb_build_object(
      'table', tg_table_name,
      'op', lower(tg_op),
      'id', r ->> 'id',
      'recipe_id', r ->> 'recipe_id',
      'by', coalesce(auth.uid()::text, r ->> 'updated_by', r ->> 'actor_id'),
      -- How this write came, not how the row was first made.
      'source', case when auth.uid() is null then r ->> 'source' else public._request_source() end
    )),
    'change',
    'family:' || (r ->> 'family_id'),
    true
  );
  return null;
end;
$$;

-- What every member, and every assistant acting for one, reads (FR-002, L80): one row per event
-- with who it's for, its exceptions, checklist and surprise, already masked for the caller.
-- Private, to anyone but its creator: "Busy" with the members, days and times, nothing else.
-- Surprise, to the people it's hidden from: the cover title, the time, the place and the cover
-- note, shaped exactly like a family event (no reminder, an empty checklist) so nothing gives the
-- secret away. A hidden event whose creator has left the family is Busy (as `viewFor` shows it).
-- Hidden views copy only the timing fields of exceptions and repeats (an allowlist), so nothing
-- written into them later can reach people who mustn't see it.
create function public._events_visible() returns table (
  id uuid, family_id uuid, title text, category text, location text, notes text,
  starts_on date, ends_on date, time_type text, slots text[], start_time text, end_time text,
  recurrence jsonb, reminder text, responsible_member_id uuid, visibility text, creator_member_id uuid,
  members jsonb, removed_members jsonb, exceptions jsonb, checklist jsonb, surprise jsonb,
  created_by uuid, updated_by uuid, source text, created_at timestamptz, updated_at timestamptz,
  deleted_at timestamptz, deleted_by uuid
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
    v.created_by, v.updated_by, v.source::text, v.created_at, v.updated_at, v.deleted_at, v.deleted_by
  from seen v;
$$;
create view public.events_visible with (security_invoker = true) as
  select * from public._events_visible();
revoke all on public.events_visible from anon, authenticated;
grant select on public.events_visible to authenticated, cocon_assistant;

-- Saves an event with who it's for, its surprise and its checklist in one go (specs 041, 043).
-- Runs as the caller, so every policy and trigger above applies. `p_event` holds every field (a
-- full replace), `p_id` the event to change (none: a new one); `p_members` is a list of member ids, "everyone" and "others"; a null
-- `p_surprise` or `p_checklist` leaves them as they are. Members who were removed stay on it.
create function public.save_event(p_event jsonb, p_members jsonb, p_id uuid default null, p_surprise jsonb default null, p_checklist jsonb default null)
returns uuid
language plpgsql set search_path = '' as $$
declare
  e public.events := jsonb_populate_record(null::public.events, p_event);
  eid uuid;
  item jsonb;
  n integer := 0;
begin
  if p_id is null then
    insert into public.events (title, category, location, notes, starts_on, ends_on, time_type, slots, start_time, end_time,
      recurrence, reminder, responsible_member_id, visibility)
    values (e.title, e.category, e.location, e.notes, e.starts_on, e.ends_on, e.time_type, coalesce(e.slots, '{}'), e.start_time, e.end_time,
      e.recurrence, coalesce(e.reminder, 'none'), e.responsible_member_id, coalesce(e.visibility, 'family'))
    returning id into eid;
  else
    update public.events set title = e.title, category = e.category, location = e.location, notes = e.notes,
      starts_on = e.starts_on, ends_on = e.ends_on, time_type = e.time_type, slots = coalesce(e.slots, '{}'),
      start_time = e.start_time, end_time = e.end_time, recurrence = e.recurrence, reminder = coalesce(e.reminder, 'none'),
      responsible_member_id = e.responsible_member_id, visibility = coalesce(e.visibility, 'family')
    where id = p_id and deleted_at is null
    returning id into eid;
    if eid is null then
      raise exception 'event_not_found' using errcode = 'P0002';
    end if;
  end if;

  if jsonb_typeof(p_members) <> 'array' or jsonb_array_length(p_members) = 0 then
    raise exception 'members_needed' using errcode = '22023';
  end if;
  delete from public.event_members m where m.event_id = eid and m.who <> 'removed';
  insert into public.event_members (event_id, who, member_id)
    select eid, case when w in ('everyone', 'others') then w else 'member' end, case when w in ('everyone', 'others') then null else w::uuid end
    from (select distinct jsonb_array_elements_text(p_members) as w) x;

  if coalesce(e.visibility, 'family') <> 'surprise' then
    delete from public.event_surprise s where s.event_id = eid;
  elsif p_surprise is not null and not exists (
    select 1 from public.event_surprise s where s.event_id = eid
      and s.hidden_from = array(select jsonb_array_elements_text(p_surprise -> 'hidden_from')::uuid)
      and s.cover_title = p_surprise ->> 'cover_title' and s.cover_note is not distinct from p_surprise ->> 'cover_note'
  ) then
    insert into public.event_surprise (event_id, hidden_from, cover_title, cover_note)
      values (eid, array(select jsonb_array_elements_text(p_surprise -> 'hidden_from')::uuid), p_surprise ->> 'cover_title', p_surprise ->> 'cover_note')
      on conflict (event_id) do update set hidden_from = excluded.hidden_from, cover_title = excluded.cover_title, cover_note = excluded.cover_note;
  end if;

  if p_checklist is not null then
    delete from public.event_checklist_items c where c.event_id = eid
      and c.id not in (select (x ->> 'id')::uuid from jsonb_array_elements(p_checklist) x where x ? 'id');
    for item in select * from jsonb_array_elements(p_checklist) loop
      if item ? 'id' then
        update public.event_checklist_items c set label = item ->> 'label', position = n
          where c.id = (item ->> 'id')::uuid and c.event_id = eid;
      else
        insert into public.event_checklist_items (event_id, position, label, done)
          values (eid, n, item ->> 'label', coalesce((item ->> 'done')::boolean, false));
      end if;
      n := n + 1;
    end loop;
  end if;
  return eid;
end;
$$;

-- Sets the home time zone once, from the first device that opens the app, so the app and
-- assistants agree on "today" from the start. Only the owner changes it afterwards (spec 029).
create function public.claim_home_time_zone(tz text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  fam uuid := public.my_family_id();
begin
  if fam is null then
    raise exception 'not_in_family' using errcode = '42501';
  end if;
  insert into public.family_calendar_settings (family_id, home_time_zone)
    values (fam, tz)
    on conflict (family_id) do update set home_time_zone = excluded.home_time_zone
      where public.family_calendar_settings.home_time_zone is null;
end;
$$;

-- 032-later L78: removing a member without the app keeps their events.

-- "Today" in the family's home time zone.
create function public._family_today(fam uuid) returns date
language sql stable security definer set search_path = '' as $$
  select (now() at time zone coalesce((select s.home_time_zone from public.family_calendar_settings s where s.family_id = fam), 'UTC'))::date;
$$;

-- A member's events that aren't over: ending today or later, or still repeating. A series that
-- ends after a number of times counts as upcoming (working out its last day needs the engine).
create function public._upcoming_events_of(member uuid, fam uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select distinct e.id from public.event_members em join public.events e on e.id = em.event_id
  where em.member_id = member and e.family_id = fam and e.deleted_at is null
    and (e.ends_on >= public._family_today(fam)
      or (e.recurrence is not null and coalesce(e.recurrence #>> '{ends,type}', 'never') <> 'on')
      or (e.recurrence #>> '{ends,type}' = 'on' and (e.recurrence #>> '{ends,date}')::date >= public._family_today(fam)));
$$;

-- For the Remove dialog: "Move James's {n} upcoming events to Everyone?".
create function public.managed_member_upcoming_events(member_id uuid) returns integer
language plpgsql stable security definer set search_path = '' as $$
declare
  fam uuid := public.my_family_id();
begin
  if fam is null then
    raise exception 'not_in_family' using errcode = '42501';
  end if;
  perform public._managed(managed_member_upcoming_events.member_id, fam);
  return (select count(*) from public._upcoming_events_of(managed_member_upcoming_events.member_id, fam));
end;
$$;

-- As in spec 033, and first: James comes off his upcoming events; those that were only his go to
-- Everyone. His past events keep him (the trigger below).
create or replace function public.remove_managed_member(member_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.members := public._me_locked();
  target uuid := remove_managed_member.member_id;
  leaving uuid[];
begin
  perform public._managed(target, me.family_id);
  leaving := array(select public._upcoming_events_of(target, me.family_id));
  insert into public.event_members (event_id, who)
    select l, 'everyone' from unnest(leaving) l
    where not exists (
      select 1 from public.event_members o where o.event_id = l
        and (o.who = 'everyone' or (o.who = 'member' and o.member_id <> target))
    );
  delete from public.event_members em where em.member_id = target and em.event_id = any (leaving);
  delete from public.members m where m.id = target;
end;
$$;

-- Before any member leaves (removed, left, or their account deleted): the events they're still on
-- keep their name, shown grey (`member-removed`). Not when the whole family is being deleted.
create function public._member_leaves_events() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.families f where f.id = old.family_id) then
    update public.event_members em set who = 'removed', member_id = null, removed_name = old.display_name
      where em.member_id = old.id;
  end if;
  return old;
end;
$$;
create trigger members_leave_events before delete on public.members
  for each row execute function public._member_leaves_events();

-- The nightly job (server only, scripts/purge-deleted.ts) removes events deleted over 30 days ago,
-- with their members, exceptions, checklist and surprise.
create function public.purge_deleted_events() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  delete from public.events e where e.deleted_at is not null and e.deleted_at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Grants. Members: the view, saving, the time zone claim and the Remove dialog's count; policies
-- call the visibility helpers. Assistants (spec 023 role): read-only, and only through the view
-- and the settings; they get no event table at all, so they never see an unmasked row. Writes come
-- with spec 044's permission.
grant execute on function public._sees_event(text, uuid, uuid), public._sees_event(uuid), public._created_event(uuid),
  public._override_keys_ok(jsonb) to authenticated;
grant execute on function public._events_visible() to authenticated, cocon_assistant;
grant execute on function public.save_event(jsonb, jsonb, uuid, jsonb, jsonb), public.claim_home_time_zone(text),
  public.managed_member_upcoming_events(uuid) to authenticated;
revoke execute on function public.purge_deleted_events() from public, anon, authenticated;
grant execute on function public.purge_deleted_events() to service_role;
grant select on public.family_calendar_settings to cocon_assistant;
alter policy "members read their family's rows" on public.family_calendar_settings to authenticated, cocon_assistant;
