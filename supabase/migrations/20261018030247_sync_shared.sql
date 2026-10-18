-- Spec 004: what every module's tables share. Who wrote a row and through what (FR-003), the
-- activity log (spec 026), and live changes on one private channel per family (FR-002).
-- Module tables (recipes, groceries) follow in their own migrations.

-- 'app', or the assistant's name ('claude', 'chatgpt', 'gemini', any other MCP client).
create domain public.write_source as text check (value ~ '^[a-z0-9-]{1,40}$');

-- What a write came through. Tokens issued by Supabase's OAuth server carry a `client_id` claim
-- (MCP connections, spec 023); the app's own sessions don't, so the app can never pose as an
-- assistant. The MCP server names the assistant; spec 023 maps clients to names.
create function public._request_source(requested text) returns text
language sql stable set search_path = '' as $$
  select case
    when auth.jwt() ->> 'client_id' is null then 'app'
    when requested is null or requested = 'app' or requested !~ '^[a-z0-9-]{1,40}$' then 'mcp'
    else requested
  end;
$$;

-- Before insert or update on a family table. The caller can't choose the family, the author or
-- the timestamps; `source` is the source of the write that created the row. Writes without a
-- signed-in person (seed, service jobs) keep the values they give.
create function public._stamp_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    if me is not null then
      new.family_id := public.my_family_id();
      new.created_by := me;
      new.updated_by := me;
      new.source := public._request_source(new.source);
      new.created_at := now();
    end if;
  else
    new.id := old.id;
    new.family_id := old.family_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.source := old.source;
    new.updated_by := coalesce(me, new.updated_by);
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Live changes (FR-002). After each write, a small message on the family's private channel
-- `family:<id>`: which row changed and who changed it, never its content. Clients refetch the
-- row through RLS. Only members can listen (policy below), and only the database can send.
create function public._broadcast_change() returns trigger
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
      'source', r ->> 'source'
    )),
    'change',
    'family:' || (r ->> 'family_id'),
    true
  );
  return null;
end;
$$;

create policy "members receive their family's changes" on realtime.messages
  for select to authenticated
  using (extension = 'broadcast' and realtime.topic() = 'family:' || public.my_family_id()::text);

-- Spec 003's tables gain updated_by (FR-003: every table). Invites are only ever marked used, and
-- used_by/used_at already record that.
alter table public.families add column updated_by uuid references auth.users (id) on delete set null;
alter table public.members add column updated_by uuid references auth.users (id) on delete set null;
update public.families set updated_by = created_by;
update public.members set updated_by = created_by;

create function public._touch_updated_by() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_by := coalesce(auth.uid(), new.updated_by, new.created_by);
  return new;
end;
$$;
create trigger families_updated_by before insert or update on public.families
  for each row execute function public._touch_updated_by();
create trigger members_updated_by before insert or update on public.members
  for each row execute function public._touch_updated_by();

-- Activity (spec 026): one entry per AI action, with what it takes to undo it. Entries are never
-- changed or removed by people: an undo is a new entry.
create table public.activity (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  source public.write_source not null default 'app',
  action text not null check (action ~ '^[a-z][a-z_]{0,39}$'),
  target_kind text not null check (target_kind ~ '^[a-z][a-z_]{0,39}$'),
  target_id uuid,
  payload jsonb not null default '{}' check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now()
);
create index activity_family_created on public.activity (family_id, created_at desc);

create function public._stamp_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is not null then
    new.family_id := public.my_family_id();
    new.actor_id := me;
    new.source := public._request_source(new.source);
    new.created_at := now();
  end if;
  return new;
end;
$$;
create trigger activity_stamp before insert on public.activity
  for each row execute function public._stamp_activity();
create trigger activity_broadcast after insert on public.activity
  for each row execute function public._broadcast_change();

alter table public.activity enable row level security;
revoke all on public.activity from anon, authenticated;
grant select, insert on public.activity to authenticated;
create policy "members read their family's activity" on public.activity
  for select to authenticated using (family_id = public.my_family_id());
create policy "members add to their family's activity" on public.activity
  for insert to authenticated with check (family_id = public.my_family_id() and actor_id = auth.uid());

-- Makes a module table a family table (constitution VI), from that module's migration:
-- `select public._family_table('public.recipes', live => true)`. The table needs id, family_id,
-- created_by, updated_by, source, created_at and updated_at. Members read and write their own
-- family's rows; nobody else, signed in or not, sees or changes anything. `live` sends its
-- changes on the family's channel (FR-002 lists which tables).
create function public._family_table(t regclass, live boolean) returns void
language plpgsql set search_path = '' as $$
declare
  n text := (select relname from pg_class where oid = t);
begin
  execute format('alter table %s enable row level security', t);
  execute format('revoke all on %s from anon, authenticated', t);
  execute format('grant select, insert, update, delete on %s to authenticated', t);
  execute format('create policy "members read their family''s rows" on %s for select to authenticated using (family_id = public.my_family_id())', t);
  execute format('create policy "members add to their family" on %s for insert to authenticated with check (family_id = public.my_family_id())', t);
  execute format('create policy "members change their family''s rows" on %s for update to authenticated using (family_id = public.my_family_id()) with check (family_id = public.my_family_id())', t);
  execute format('create policy "members remove their family''s rows" on %s for delete to authenticated using (family_id = public.my_family_id())', t);
  execute format('create trigger %I before insert or update on %s for each row execute function public._stamp_row()', n || '_stamp', t);
  if live then
    execute format('create trigger %I after insert or update or delete on %s for each row execute function public._broadcast_change()', n || '_broadcast', t);
  end if;
  execute format('create index %I on %s (family_id)', n || '_family_id', t);
end;
$$;
