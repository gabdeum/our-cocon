-- Spec 025: each member sees only their own connected assistants, named by where they send people
-- back; only assistants record a use; a member who leaves the family loses every connection.
begin;
select plan(22);

-- As `role` with the claims an access token carries (`client` adds an assistant's client_id).
create function pg_temp.login(uid uuid, r text, client text default null) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims',
    jsonb_strip_nulls(jsonb_build_object('sub', uid, 'role', r, 'client_id', client))::text, true);
  execute format('set local role %I', r);
end;
$$;
grant execute on function pg_temp.login(uuid, text, text) to public;
-- pgTAP itself, for the assistant role (this test only: everything rolls back).
grant usage on schema extensions to cocon_assistant;
grant execute on all functions in schema extensions to cocon_assistant;
create temp table tokens (token text);
grant all on tokens to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'alex@example.com');

select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'authenticated');
select public.create_family('The Demanges', 'Gabriel');
insert into tokens select public.create_invite();
select pg_temp.login('00000000-0000-0000-0000-00000000000b', 'authenticated');
select public.accept_invite((select token from tokens), 'Alex');

-- Claude (c1) and ChatGPT (c2) for Gabriel, an unnamed app (c3) for Alex.
reset role;
insert into auth.oauth_clients (id, registration_type, redirect_uris, grant_types, client_name, client_type, token_endpoint_auth_method) values
  ('00000000-0000-0000-0000-0000000000c1', 'dynamic', 'https://claude.ai/api/mcp/auth_callback', 'authorization_code,refresh_token', 'Claude', 'public', 'none'),
  ('00000000-0000-0000-0000-0000000000c2', 'dynamic', 'https://chatgpt.com/connector_platform_oauth_redirect', 'authorization_code,refresh_token', 'Our Cocon', 'public', 'none'),
  ('00000000-0000-0000-0000-0000000000c3', 'dynamic', 'http://localhost:4567/callback', 'authorization_code,refresh_token', 'Claude', 'public', 'none');
insert into auth.oauth_consents (id, user_id, client_id, scopes) values
  (gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'openid'),
  (gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c2', 'openid'),
  (gen_random_uuid(), '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000c3', 'openid');
insert into auth.sessions (id, user_id, oauth_client_id) values
  (gen_random_uuid(), '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000c3'),
  (gen_random_uuid(), '00000000-0000-0000-0000-00000000000b', null);

-- Who can call what.
select ok(has_function_privilege('authenticated', 'public.my_assistants()', 'execute'), 'members list their assistants');
select ok(not has_function_privilege('anon', 'public.my_assistants()', 'execute'), 'signed-out people can''t');
select ok(not has_function_privilege('authenticated', 'public.touch_assistant()', 'execute'), 'members can''t record a use');
select ok(has_function_privilege('cocon_assistant', 'public.touch_assistant()', 'execute'), 'assistants record theirs');
select ok(not has_table_privilege('authenticated', 'public.assistant_use', 'select'), 'nobody reads the table directly');

-- Each member sees only their own, named from the return address, never the name the app chose.
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'authenticated');
select is((select array_agg(assistant order by assistant) from public.my_assistants()), array['chatgpt', 'claude'], 'Gabriel sees Claude and ChatGPT');
select is((select last_used_at from public.my_assistants() where assistant = 'claude'), null, 'not used yet');
select pg_temp.login('00000000-0000-0000-0000-00000000000b', 'authenticated');
select is((select array_agg(coalesce(assistant, 'unnamed:' || client_name)) from public.my_assistants()), array['unnamed:Claude'],
  'Alex sees only his own, unnamed though it calls itself Claude');

-- An assistant records its use, at most once a minute, and can't list the others.
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'cocon_assistant', '00000000-0000-0000-0000-0000000000c1');
select lives_ok($$ select public.touch_assistant() $$, 'Claude records a use');
select throws_ok($$ select * from public.my_assistants() $$, '42501', null, 'an assistant can''t list connections');
reset role;
update public.assistant_use set last_used_at = now() - interval '30 seconds';
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'cocon_assistant', '00000000-0000-0000-0000-0000000000c1');
select public.touch_assistant();
reset role;
select ok((select last_used_at < now() - interval '20 seconds' from public.assistant_use), 'a second call within a minute writes nothing');
update public.assistant_use set last_used_at = now() - interval '2 minutes';
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'cocon_assistant', '00000000-0000-0000-0000-0000000000c1');
select public.touch_assistant();
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'authenticated');
select ok((select last_used_at > now() - interval '5 seconds' from public.my_assistants() where assistant = 'claude'), 'later, it moves');

-- A revoked grant is gone from the list.
reset role;
update auth.oauth_consents set revoked_at = now() where client_id = '00000000-0000-0000-0000-0000000000c2';
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'authenticated');
select is((select array_agg(assistant) from public.my_assistants()), array['claude'], 'a disconnected assistant is gone');

-- Through the API too (PostgREST's db_pre_request): an assistant without a live session is refused.
reset role;
insert into auth.sessions (id, user_id, oauth_client_id) values
  ('00000000-0000-0000-0000-0000000005e1', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1');
create function pg_temp.claims(session text, client text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_strip_nulls(jsonb_build_object(
    'sub', '00000000-0000-0000-0000-00000000000a', 'role', 'cocon_assistant', 'client_id', client, 'session_id', session))::text, true);
$$;
grant execute on function pg_temp.claims(text, text) to public;
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'cocon_assistant', '00000000-0000-0000-0000-0000000000c1');
select pg_temp.claims('00000000-0000-0000-0000-0000000005e1', '00000000-0000-0000-0000-0000000000c1');
select lives_ok($$ select public.check_request() $$, 'a connected assistant gets through');
select pg_temp.claims('00000000-0000-0000-0000-0000000005e2', '00000000-0000-0000-0000-0000000000c1');
select throws_ok($$ select public.check_request() $$, 'PGRST', null, 'one whose session is gone (disconnected) is refused');
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'authenticated');
select lives_ok($$ select public.check_request() $$, 'the app is never checked');

-- Removed from the family: every connection revoked, assistant sessions ended.
select public.remove_member('00000000-0000-0000-0000-00000000000b');
reset role;
select is((select count(*)::int from auth.oauth_consents where user_id = '00000000-0000-0000-0000-00000000000b' and revoked_at is null), 0,
  'a removed member''s grants are revoked');
select is((select count(*)::int from auth.sessions where user_id = '00000000-0000-0000-0000-00000000000b' and oauth_client_id is not null), 0,
  'and their assistants signed out');
select is((select count(*)::int from auth.oauth_consents where user_id = '00000000-0000-0000-0000-00000000000a' and revoked_at is null), 1,
  'the others keep theirs');
select is((select count(*)::int from public.assistant_use where user_id = '00000000-0000-0000-0000-00000000000a'), 1, 'and their last use');

-- The owner deleting the family works the same way. (Deleting an account: 032-later L71.)
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'authenticated');
select lives_ok($$ select public.delete_family() $$, 'Gabriel deletes the family');
reset role;
select is((select count(*)::int from auth.oauth_consents where user_id = '00000000-0000-0000-0000-00000000000a' and revoked_at is null)
  + (select count(*)::int from auth.sessions where user_id = '00000000-0000-0000-0000-00000000000a' and oauth_client_id is not null), 0,
  'and loses his connections too');

select * from finish();
rollback;
