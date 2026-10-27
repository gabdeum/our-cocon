-- Spec 025: Settings › AI assistants. Each member sees the assistants they connected (Supabase's
-- OAuth grants), when each was last used, and can disconnect them (the app revokes the grant through
-- Supabase Auth). A member who leaves the family, however they leave, loses every connection.

-- When an assistant last called the MCP server, per member and OAuth client. Only the functions
-- below touch it: no policies, no grants.
create table public.assistant_use (
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references auth.oauth_clients (id) on delete cascade,
  last_used_at timestamptz not null default now(),
  primary key (user_id, client_id)
);
alter table public.assistant_use enable row level security;
revoke all on public.assistant_use from public, anon, authenticated;

-- The MCP server calls this on every request. At most one write a minute per connection.
create function public.touch_assistant() returns void
language sql volatile security definer set search_path = '' as $$
  insert into public.assistant_use as u (user_id, client_id)
  select auth.uid(), (auth.jwt() ->> 'client_id')::uuid
  where auth.uid() is not null and auth.jwt() ->> 'client_id' is not null
  on conflict (user_id, client_id) do update set last_used_at = now()
    where u.last_used_at < now() - interval '1 minute';
$$;
revoke all on function public.touch_assistant() from public, anon, authenticated;
grant execute on function public.touch_assistant() to cocon_assistant;

-- The caller's connected assistants, one row per OAuth client they allowed. `assistant` follows the
-- rule that names their writes (_request_source); null for an app it can't name. Members only: an
-- assistant can't list the others.
create function public.my_assistants()
returns table (client_id uuid, assistant text, client_name text, granted_at timestamptz, last_used_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, coalesce(
      (select s.source from public.oauth_client_sources s where s.client_id = c.id::text),
      public._assistant_for_redirects(c.redirect_uris)),
    c.client_name, g.granted_at, u.last_used_at
  from auth.oauth_consents g
  join auth.oauth_clients c on c.id = g.client_id and c.deleted_at is null
  left join public.assistant_use u on u.user_id = g.user_id and u.client_id = g.client_id
  where g.user_id = auth.uid() and g.revoked_at is null and auth.jwt() ->> 'client_id' is null
  order by g.granted_at;
$$;
revoke all on function public.my_assistants() from public, anon;
grant execute on function public.my_assistants() to authenticated;

-- Removed, left, or the family deleted: the person's assistants lose access at once and stay
-- disconnected (an allowed grant would otherwise let them back in without asking).
create function public._revoke_assistants() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update auth.oauth_consents set revoked_at = now() where user_id = old.user_id and revoked_at is null;
  delete from auth.sessions where user_id = old.user_id and oauth_client_id is not null;
  delete from public.assistant_use where user_id = old.user_id;
  return null;
end;
$$;
revoke all on function public._revoke_assistants() from public, anon, authenticated;
create trigger members_revoke_assistants after delete on public.members
  for each row execute function public._revoke_assistants();

-- Disconnect is immediate everywhere, not only through the MCP server (which asks Supabase Auth on
-- every call). PostgREST trusts a signed token until it expires, so before each API request it runs
-- this (`db_pre_request`): an assistant's token whose session is gone (disconnected, or its member
-- removed) is refused. The app's own sessions are untouched.
create function public.check_request() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.jwt() ->> 'client_id' is not null and not exists (
    select 1 from auth.sessions s
    where s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid and s.user_id = auth.uid()
  ) then
    raise sqlstate 'PGRST' using
      message = json_build_object('code', 'assistant_disconnected', 'message', 'This AI assistant was disconnected. Connect it again from Settings › AI assistants in Our Cocon.')::text,
      detail = json_build_object('status', 401, 'headers', json_build_object())::text;
  end if;
end;
$$;
revoke all on function public.check_request() from public;
grant execute on function public.check_request() to anon, authenticated, cocon_assistant;
alter role authenticator set pgrst.db_pre_request = 'public.check_request';
notify pgrst, 'reload config';
