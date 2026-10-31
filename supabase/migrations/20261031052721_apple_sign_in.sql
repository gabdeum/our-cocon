-- Spec 045 FR-009: deleting an account made with Sign in with Apple revokes it at Apple, as App
-- Store rules ask. Apple's revoke needs the refresh token from a sign-in, which only the server can
-- get (the apple-sign-in Edge Function swaps the app's one-time code for it). Deleting the person,
-- by any path, moves the token to a queue; the delete-account function revokes it at once, and the
-- nightly purge tries again whatever Apple didn't take. Nobody but the service key reaches either:
-- no policies, no grants, only the functions below.

create table public.apple_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);
alter table public.apple_tokens enable row level security;
revoke all on public.apple_tokens from public, anon, authenticated, cocon_assistant, service_role;

-- `user_id` has no foreign key: the person is gone by the time the token is revoked.
create table public.apple_revocations (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  refresh_token text not null,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.apple_revocations enable row level security;
revoke all on public.apple_revocations from public, anon, authenticated, cocon_assistant, service_role;

-- Before the person goes (and their token with them), queue the token for revoking.
create function public._queue_apple_revocation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.apple_revocations (user_id, refresh_token)
  select user_id, refresh_token from public.apple_tokens where user_id = old.id;
  return old;
end;
$$;
revoke all on function public._queue_apple_revocation() from public, anon, authenticated;
create trigger queue_apple_revocation before delete on auth.users
  for each row execute function public._queue_apple_revocation();

-- apple-sign-in: keeps the newest refresh token from the person's Apple sign-in.
create function public.apple_keep_token(p_user uuid, p_token text) returns void
language sql volatile security definer set search_path = '' as $$
  insert into public.apple_tokens (user_id, refresh_token) values (p_user, p_token)
  on conflict (user_id) do update set refresh_token = excluded.refresh_token, updated_at = now();
$$;

-- What to revoke: one deleted person's tokens (delete-account), or the whole queue (the nightly retry).
create function public.apple_tokens_to_revoke(p_user uuid default null)
returns table (id bigint, refresh_token text)
language sql stable security definer set search_path = '' as $$
  select r.id, r.refresh_token from public.apple_revocations r
  where p_user is null or r.user_id = p_user
  order by r.id;
$$;

-- After a try: gone once Apple took it, otherwise kept for the next night.
create function public.apple_revocation_tried(p_id bigint, p_revoked boolean) returns void
language sql volatile security definer set search_path = '' as $$
  delete from public.apple_revocations where id = p_id and p_revoked;
  update public.apple_revocations set attempts = attempts + 1 where id = p_id and not p_revoked;
$$;

revoke all on function public.apple_keep_token(uuid, text), public.apple_tokens_to_revoke(uuid), public.apple_revocation_tried(bigint, boolean)
  from public, anon, authenticated;
grant execute on function public.apple_keep_token(uuid, text), public.apple_tokens_to_revoke(uuid), public.apple_revocation_tried(bigint, boolean)
  to service_role;
