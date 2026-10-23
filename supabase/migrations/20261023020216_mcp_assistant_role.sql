-- Spec 023: the database, not the MCP server, decides what an AI assistant may do. A token
-- Supabase's OAuth server issues to an assistant would otherwise be a full member session: anyone
-- holding it could call the REST, Storage and Auth APIs directly, past the MCP tools. So assistant
-- tokens get their own role, `cocon_assistant`, which can only do what the shipped tools need.
-- Each later tool widens it on purpose (write tools, groceries in 024, calendar…), and spec 024's
-- per-person permissions are checked here too. The app's sessions are untouched.

create role cocon_assistant nologin noinherit;
-- PostgREST switches to the token's role, so it must be allowed to.
grant cocon_assistant to authenticator;
grant usage on schema public to cocon_assistant;

-- Access token hook (Supabase Auth): runs whenever a token is issued or refreshed. A token for an
-- OAuth client (an assistant) carries `client_id`; it gets the assistant role instead of
-- `authenticated`. Configured in supabase/config.toml and infra/supabase/cocon.override.yml.
create function public.access_token_hook(event jsonb) returns jsonb
language sql stable set search_path = '' as $$
  select case
    when event -> 'claims' ? 'client_id' then jsonb_set(event, '{claims,role}', '"cocon_assistant"')
    else event
  end;
$$;
-- Supabase Auth runs hooks as supabase_auth_admin (its hook docs ask for schema usage too).
grant usage on schema public to supabase_auth_admin;
grant execute on function public.access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.access_token_hook(jsonb) from public, anon, authenticated;

-- Password verification hook: nobody signs in with a password (email link and Google only, spec
-- 003). Refusing every password attempt means a password set with a stolen assistant token can
-- never become a session of its own that outlives disconnecting the assistant.
create function public.password_attempt_hook(event jsonb) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('decision', 'reject', 'message', 'Sign in with an email link or Google.', 'should_logout_user', false);
$$;
grant execute on function public.password_attempt_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.password_attempt_hook(jsonb) from public, anon, authenticated;

-- What spec 023's read tools need: the family's recipes and members, the catalog's facts, and who
-- is calling. Nothing else: no writes, no other tables, no Storage, no Realtime.
grant execute on function public.my_family_id() to cocon_assistant;
grant execute on function public.request_source() to cocon_assistant;
grant execute on function public._ingredient_facts(uuid) to cocon_assistant;
grant select on public.recipes, public.recipe_ingredients, public.recipe_steps, public.recipe_variants,
  public.members, public.ingredient_facts, public.catalog_ingredients, public.family_ingredients to cocon_assistant;

-- The same family rule as a member's (spec 004): only their own family's rows.
alter policy "members read their family's rows" on public.recipes to authenticated, cocon_assistant;
alter policy "members read their family's rows" on public.recipe_ingredients to authenticated, cocon_assistant;
alter policy "members read their family's rows" on public.recipe_steps to authenticated, cocon_assistant;
alter policy "members read their family's rows" on public.recipe_variants to authenticated, cocon_assistant;
alter policy "members read their family's rows" on public.family_ingredients to authenticated, cocon_assistant;
alter policy "members read their family's members" on public.members to authenticated, cocon_assistant;
alter policy "signed-in people read the catalog" on public.catalog_ingredients to authenticated, cocon_assistant;

-- Which assistant names an OAuth client's return addresses, for the consent page's title (spec 023):
-- the same rule that stamps `source`, so the page never trusts the name a client gave itself.
create function public.assistant_for_redirect(uri text) returns text
language sql immutable set search_path = '' as $$ select public._assistant_for_redirects(uri); $$;
revoke all on function public.assistant_for_redirect(text) from public, anon;
grant execute on function public.assistant_for_redirect(text) to authenticated;
