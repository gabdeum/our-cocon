-- Spec 003: families, members and invites.
-- Members read their own family's rows. Every write goes through a security definer function
-- below, which checks the caller (auth.uid()) and the rule; no table has a direct write grant.

create type public.member_role as enum ('owner', 'editor');
create type public.avatar_tone as enum ('honey', 'sage', 'peach');

-- Shared by every table with updated_at (spec 004 reuses it).
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60 and name = btrim(name)),
  owner_id uuid not null references auth.users (id) on delete cascade,
  -- Members who ever joined, so avatar tones follow join order (FR-005) even after removals.
  joined_count integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  source text not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.members (
  -- One family per person (FR-003).
  user_id uuid primary key references auth.users (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  role public.member_role not null,
  display_name text not null check (char_length(display_name) between 1 and 40 and display_name = btrim(display_name)),
  avatar_tone public.avatar_tone not null,
  joined_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  source text not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index members_family_id on public.members (family_id);
create unique index members_one_owner on public.members (family_id) where role = 'owner';

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  -- sha256 of the link's token; the token itself is never stored.
  token_hash text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz,
  source text not null default 'app',
  created_at timestamptz not null default now()
);
create index invites_family_id on public.invites (family_id);
create index invites_created_by on public.invites (created_by, created_at);

create trigger families_touch before update on public.families
  for each row execute function public.touch_updated_at();
create trigger members_touch before update on public.members
  for each row execute function public.touch_updated_at();

-- The caller's family. Security definer so policies can use it without recursing into members' RLS.
create function public.my_family_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select family_id from public.members where user_id = auth.uid();
$$;

alter table public.families enable row level security;
alter table public.members enable row level security;
alter table public.invites enable row level security;

revoke all on public.families, public.members, public.invites from anon, authenticated;
grant select on public.families, public.members to authenticated;
-- Members can see their family's invites, but never the token hash.
grant select (id, family_id, created_by, expires_at, used_by, used_at, created_at) on public.invites to authenticated;

create policy "members read their family" on public.families
  for select to authenticated using (id = public.my_family_id());
create policy "members read their family's members" on public.members
  for select to authenticated using (family_id = public.my_family_id());
create policy "members read their family's invites" on public.invites
  for select to authenticated using (family_id = public.my_family_id());

-- Helpers (not callable through the API).

create function public._tone_for(joined integer) returns public.avatar_tone
language sql immutable set search_path = '' as $$
  select (array['honey', 'sage', 'peach']::public.avatar_tone[])[joined % 3 + 1];
$$;

create function public._token_hash(token text) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(token, 'sha256'), 'hex');
$$;

create function public._require_user() returns uuid
language plpgsql stable set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

-- The caller's family, when the caller is its owner.
create function public._require_owner() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  fam uuid;
begin
  select family_id into fam from public.members where user_id = public._require_user() and role = 'owner';
  if fam is null then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  return fam;
end;
$$;

-- The valid invite for a token, or null when unknown, used, expired or its sender left.
-- `lock` holds the row until the transaction ends (accept_invite); the preview reads without it.
create function public._open_invite(token text, lock boolean default false) returns public.invites
language plpgsql volatile security definer set search_path = '' as $$
declare
  inv public.invites;
begin
  if lock then
    select i.* into inv from public.invites i
      join public.members m on m.user_id = i.created_by and m.family_id = i.family_id
      where i.token_hash = public._token_hash(token) and i.used_by is null and i.expires_at > now()
      for update of i;
  else
    select i.* into inv from public.invites i
      join public.members m on m.user_id = i.created_by and m.family_id = i.family_id
      where i.token_hash = public._token_hash(token) and i.used_by is null and i.expires_at > now();
  end if;
  return inv;
end;
$$;

-- API.

create function public.create_family(family_name text, display_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public._require_user();
  fam uuid;
begin
  if exists (select 1 from public.members where user_id = me) then
    raise exception 'already_in_family' using errcode = 'P0001';
  end if;
  insert into public.families (name, owner_id, joined_count, created_by)
    values (btrim(family_name), me, 1, me) returning id into fam;
  insert into public.members (user_id, family_id, role, display_name, avatar_tone, created_by)
    values (me, fam, 'owner', btrim(display_name), public._tone_for(0), me);
  return fam;
end;
$$;

-- A new single-use link token, valid 7 days (FR-004). Any member can invite.
create function public.create_invite() returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public._require_user();
  fam uuid;
  token text;
begin
  select family_id into fam from public.members where user_id = me;
  if fam is null then
    raise exception 'not_in_family' using errcode = '42501';
  end if;
  -- One invite at a time per family, so parallel calls can't pass the limits.
  perform 1 from public.families where id = fam for update;
  -- Rate limits (constitution VI): 10 per person per hour, 20 open per family.
  if (select count(*) from public.invites where created_by = me and created_at > now() - interval '1 hour') >= 10
    or (select count(*) from public.invites where family_id = fam and used_by is null and expires_at > now()) >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  insert into public.invites (family_id, token_hash, created_by) values (fam, public._token_hash(token), me);
  return token;
end;
$$;

-- What the invite page shows, signed in or not. Anything but a valid invite reads "expired",
-- so the answer never tells a guess apart from an old link.
create function public.invite_status(token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  inv public.invites;
begin
  inv := public._open_invite(token);
  if inv.id is null then
    return jsonb_build_object('status', 'expired');
  end if;
  return jsonb_build_object(
    'status', 'valid',
    'family_name', (select name from public.families where id = inv.family_id),
    'inviter_name', (select display_name from public.members where user_id = inv.created_by)
  );
end;
$$;

-- Joins the invite's family as "Can edit". A person alone in their own family can replace it
-- (after the app's confirmation); otherwise being in another family is an error.
create function public.accept_invite(token text, display_name text, replace_own_family boolean default false)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public._require_user();
  inv public.invites;
  mine public.members;
  joined integer;
begin
  inv := public._open_invite(token, true);
  if inv.id is null then
    raise exception 'invite_expired' using errcode = 'P0001';
  end if;
  select * into mine from public.members where user_id = me;
  if mine.user_id is not null then
    if mine.family_id = inv.family_id then
      raise exception 'already_in_this_family' using errcode = 'P0001';
    end if;
    -- Lock the caller's own family so nobody joins it between the count and the delete.
    perform 1 from public.families where id = mine.family_id for update;
    if (select count(*) from public.members where family_id = mine.family_id) > 1 then
      raise exception 'own_family_has_members' using errcode = 'P0001';
    end if;
    if not replace_own_family then
      raise exception 'already_in_family' using errcode = 'P0001';
    end if;
    delete from public.families where id = mine.family_id;
  end if;
  update public.families set joined_count = joined_count + 1 where id = inv.family_id
    returning joined_count - 1 into joined;
  insert into public.members (user_id, family_id, role, display_name, avatar_tone, created_by)
    values (me, inv.family_id, 'editor', btrim(display_name), public._tone_for(joined), me);
  update public.invites set used_by = me, used_at = now() where id = inv.id;
  return floor(extract(epoch from now() - inv.created_at) / 86400)::integer;
end;
$$;

-- Owner only. The person is signed out everywhere and loses access at once.
create function public.remove_member(member_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  fam uuid := public._require_owner();
begin
  if member_id = auth.uid() then
    raise exception 'cannot_remove_self' using errcode = 'P0001';
  end if;
  delete from public.members where user_id = member_id and family_id = fam;
  if not found then
    raise exception 'not_a_member' using errcode = 'P0001';
  end if;
  delete from auth.sessions where user_id = member_id;
end;
$$;

-- Owner only: hands ownership to another member; the old owner becomes "Can edit".
create function public.make_owner(member_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  fam uuid := public._require_owner();
begin
  if not exists (select 1 from public.members where user_id = member_id and family_id = fam and role = 'editor') then
    raise exception 'not_a_member' using errcode = 'P0001';
  end if;
  update public.members set role = 'editor' where user_id = auth.uid();
  update public.members set role = 'owner' where user_id = member_id;
  update public.families set owner_id = member_id where id = fam;
end;
$$;

create function public.set_display_name(display_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.members set display_name = btrim(set_display_name.display_name) where user_id = public._require_user();
  if not found then
    raise exception 'not_in_family' using errcode = '42501';
  end if;
end;
$$;

-- Owner only (FR-006): removes the family and everything in it. Returns how many members it had.
create function public.delete_family() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  fam uuid := public._require_owner();
  n integer;
begin
  select count(*) into n from public.members where family_id = fam;
  delete from auth.sessions where user_id in (select user_id from public.members where family_id = fam and user_id <> auth.uid());
  delete from public.families where id = fam;
  return n;
end;
$$;

-- Members (not the owner) can delete their account; the family keeps its data.
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public._require_user();
begin
  if exists (select 1 from public.members where user_id = me and role = 'owner') then
    raise exception 'owner_must_delete_family' using errcode = 'P0001';
  end if;
  delete from auth.users where id = me;
end;
$$;

-- Only the API functions are callable, by signed-in people; invite_status also while signed out.
-- Functions added by later migrations start uncallable too: each migration grants its own API.
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;
-- Postgres also lets PUBLIC run every new function; that default is not per schema.
alter default privileges for role postgres revoke execute on functions from public;
grant execute on function
  public.my_family_id(), public.create_family(text, text), public.create_invite(),
  public.invite_status(text), public.accept_invite(text, text, boolean), public.remove_member(uuid),
  public.make_owner(uuid), public.set_display_name(text), public.delete_family(), public.delete_my_account()
  to authenticated;
grant execute on function public.invite_status(text) to anon;
