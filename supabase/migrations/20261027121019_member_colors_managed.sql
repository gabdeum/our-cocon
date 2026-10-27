-- Spec 033: family members without the app (managed members) and one color per member.
-- A member is an account member (user_id set, spec 003) or a managed member (no account,
-- managed_by = the member who added them). Every member has one of the 8 member colors
-- (design/system/tokens.json), which replace spec 003's three avatar tones. As in spec 003,
-- every write goes through a security definer function below.

create type public.member_color as enum ('honey', 'rose', 'sky', 'mint', 'lilac', 'peach', 'pistachio', 'clay');

-- Members get their own id: a managed member has no user, and keeps the same id (and so their
-- events) once they get the app (FR-006).
alter table public.members add column id uuid not null default gen_random_uuid();
alter table public.ai_permissions drop constraint ai_permissions_user_id_fkey;
alter table public.members drop constraint members_pkey;
alter table public.members add primary key (id);
alter table public.members alter column user_id drop not null;
alter table public.members add constraint members_user_id_key unique (user_id);
alter table public.ai_permissions add constraint ai_permissions_user_id_fkey
  foreign key (user_id) references public.members (user_id) on delete cascade;

alter table public.members add column managed_by uuid references public.members (id) on delete set null;
create index members_managed_by on public.members (managed_by);
alter table public.members add constraint members_owner_has_account check (user_id is not null or role = 'editor');
alter table public.members add constraint members_managed_has_no_account check (user_id is null or managed_by is null);

-- Existing members take the palette in join order.
alter table public.members add column color public.member_color;
update public.members m set color = (enum_range(null::public.member_color))[(r.n - 1) % 8 + 1]
  from (select id, row_number() over (partition by family_id order by joined_at, created_at) as n from public.members) r
  where r.id = m.id;
alter table public.members alter column color set not null;

-- An invite for one managed member (FR-006): accepting it links the account to that member.
-- Removing the member cancels their links.
alter table public.invites add column member_id uuid references public.members (id) on delete cascade;
create index invites_member_id on public.invites (member_id);
grant select (member_id) on public.invites to authenticated;

-- Helpers (not callable through the API).

-- The first color nobody in the family has; past 8 members the palette repeats from the start
-- (FR-004). Mirrored by nextMemberColor in @cocon/schemas for the pickers.
create function public._next_color(fam uuid) returns public.member_color
language sql stable set search_path = '' as $$
  select coalesce(
    (select p.c from unnest(enum_range(null::public.member_color)) with ordinality as p (c, i)
      where p.c not in (select m.color from public.members m where m.family_id = fam)
      order by p.i limit 1),
    (enum_range(null::public.member_color))[(select count(*) from public.members m where m.family_id = fam) % 8 + 1]
  );
$$;

-- The caller's member row; locks their family so color picks can't race.
create function public._me_locked() returns public.members
language plpgsql volatile security definer set search_path = '' as $$
declare
  me public.members;
begin
  select * into me from public.members where user_id = public._require_user();
  if me.id is null then
    raise exception 'not_in_family' using errcode = '42501';
  end if;
  perform 1 from public.families where id = me.family_id for update;
  return me;
end;
$$;

-- A managed member of the caller's family.
create function public._managed(member_id uuid, fam uuid) returns public.members
language plpgsql stable security definer set search_path = '' as $$
declare
  m public.members;
begin
  select * into m from public.members where id = member_id and family_id = fam;
  if m.id is null then
    raise exception 'not_a_member' using errcode = 'P0001';
  end if;
  if m.user_id is not null then
    raise exception 'not_managed' using errcode = 'P0001';
  end if;
  return m;
end;
$$;

-- The valid invite for a token (spec 003), now also null when its member already has the app.
create or replace function public._open_invite(token text, lock boolean default false) returns public.invites
language plpgsql volatile security definer set search_path = '' as $$
declare
  inv public.invites;
begin
  if lock then
    select i.* into inv from public.invites i
      join public.members m on m.user_id = i.created_by and m.family_id = i.family_id
      where i.token_hash = public._token_hash(token) and i.used_by is null and i.expires_at > now()
        and (i.member_id is null or exists (select 1 from public.members t where t.id = i.member_id and t.family_id = i.family_id and t.user_id is null))
      for update of i;
  else
    select i.* into inv from public.invites i
      join public.members m on m.user_id = i.created_by and m.family_id = i.family_id
      where i.token_hash = public._token_hash(token) and i.used_by is null and i.expires_at > now()
        and (i.member_id is null or exists (select 1 from public.members t where t.id = i.member_id and t.family_id = i.family_id and t.user_id is null));
  end if;
  return inv;
end;
$$;

-- API, replacing spec 003's tones with colors.

create or replace function public.create_family(family_name text, display_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public._require_user();
  fam uuid;
begin
  if exists (select 1 from public.members where user_id = me) then
    raise exception 'already_in_family' using errcode = 'P0001';
  end if;
  insert into public.families (name, owner_id, created_by)
    values (btrim(family_name), me, me) returning id into fam;
  insert into public.members (user_id, family_id, role, display_name, color, created_by)
    values (me, fam, 'owner', btrim(display_name), public._next_color(fam), me);
  return fam;
end;
$$;

-- A new single-use link token, valid 7 days (spec 003 FR-004). `for_member`: a link for one
-- managed member, so whoever opens it joins as them (FR-006).
drop function public.create_invite();
create function public.create_invite(for_member uuid default null) returns text
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
  if for_member is not null then
    perform public._managed(for_member, fam);
  end if;
  -- Rate limits (constitution VI): 10 per person per hour, 20 open per family.
  if (select count(*) from public.invites where created_by = me and created_at > now() - interval '1 hour') >= 10
    or (select count(*) from public.invites where family_id = fam and used_by is null and expires_at > now()) >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  insert into public.invites (family_id, token_hash, created_by, member_id)
    values (fam, public._token_hash(token), me, for_member);
  return token;
end;
$$;

-- What the invite page shows (spec 003), plus who the link is for when it's a member's.
create or replace function public.invite_status(token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  inv public.invites;
begin
  inv := public._open_invite(token);
  if inv.id is null then
    return jsonb_build_object('status', 'expired');
  end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'status', 'valid',
    'family_name', (select name from public.families where id = inv.family_id),
    'inviter_name', (select display_name from public.members where user_id = inv.created_by),
    'member_name', (select display_name from public.members where id = inv.member_id)
  ));
end;
$$;

-- Joins the invite's family as "Can edit" (spec 003). A member's invite links the account to that
-- member: same id, name and color. Returns days since the invite was sent and, when linked, since
-- the member was added.
drop function public.accept_invite(text, text, boolean);
create function public.accept_invite(token text, display_name text, replace_own_family boolean default false)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public._require_user();
  inv public.invites;
  mine public.members;
  linked public.members;
begin
  inv := public._open_invite(token, true);
  if inv.id is null then
    raise exception 'invite_expired' using errcode = 'P0001';
  end if;
  select * into mine from public.members where user_id = me;
  if mine.id is not null then
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
  perform 1 from public.families where id = inv.family_id for update;
  if inv.member_id is not null then
    update public.members set user_id = me, managed_by = null
      where id = inv.member_id and family_id = inv.family_id and user_id is null
      returning * into linked;
    if linked.id is null then
      raise exception 'invite_expired' using errcode = 'P0001';
    end if;
  else
    insert into public.members (user_id, family_id, role, display_name, color, created_by)
      values (me, inv.family_id, 'editor', btrim(display_name), public._next_color(inv.family_id), me);
  end if;
  update public.invites set used_by = me, used_at = now() where id = inv.id;
  return jsonb_strip_nulls(jsonb_build_object(
    'days_since_sent', floor(extract(epoch from now() - inv.created_at) / 86400)::integer,
    'days_since_added', case when linked.id is null then null else floor(extract(epoch from now() - linked.created_at) / 86400)::integer end
  ));
end;
$$;

-- Any member adds someone without the app (FR-002, FR-003). No color: the first free one.
create function public.add_managed_member(name text, pick public.member_color default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me public.members := public._me_locked();
  new_id uuid;
begin
  if pick is not null and exists (select 1 from public.members where family_id = me.family_id and color = pick) then
    raise exception 'color_taken' using errcode = 'P0001';
  end if;
  insert into public.members (family_id, role, display_name, color, managed_by, created_by)
    values (me.family_id, 'editor', btrim(name), coalesce(pick, public._next_color(me.family_id)), me.id, me.user_id)
    returning id into new_id;
  return new_id;
end;
$$;

create function public.rename_managed_member(member_id uuid, name text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.members := public._me_locked();
begin
  perform public._managed(member_id, me.family_id);
  update public.members set display_name = btrim(name) where id = member_id;
end;
$$;

-- Any member removes someone without the app; account members stay the owner's (remove_member).
create function public.remove_managed_member(member_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.members := public._me_locked();
begin
  perform public._managed(member_id, me.family_id);
  delete from public.members where id = member_id;
end;
$$;

-- My color, or a managed member's (US3). A color someone else has can't be picked.
create function public.set_member_color(member_id uuid, pick public.member_color) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.members := public._me_locked();
begin
  if member_id is null or member_id <> me.id then
    perform public._managed(member_id, me.family_id);
  end if;
  if exists (select 1 from public.members where family_id = me.family_id and id <> member_id and color = pick) then
    raise exception 'color_taken' using errcode = 'P0001';
  end if;
  update public.members set color = pick where id = member_id;
end;
$$;

-- The tones are gone; joined_count only fed them.
alter table public.members drop column avatar_tone;
drop function public._tone_for(integer);
drop type public.avatar_tone;
alter table public.families drop column joined_count;

grant execute on function
  public.create_invite(uuid), public.accept_invite(text, text, boolean), public.add_managed_member(text, public.member_color),
  public.rename_managed_member(uuid, text), public.remove_managed_member(uuid), public.set_member_color(uuid, public.member_color)
  to authenticated;
