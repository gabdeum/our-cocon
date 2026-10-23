-- Spec 023 (L1): an assistant that registered itself is named from its return addresses, and
-- only when every one of them is that assistant's.
begin;
select plan(11);

create function pg_temp.login(uid uuid, client text default null) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims',
    jsonb_strip_nulls(jsonb_build_object('sub', uid, 'role', 'authenticated', 'client_id', client))::text, true);
  set local role authenticated;
end;
$$;
grant execute on function pg_temp.login(uuid, text) to public;

select is(public._assistant_for_redirects('https://claude.ai/api/mcp/auth_callback'), 'claude', 'claude.ai is Claude');
select is(public._assistant_for_redirects('https://chatgpt.com/connector/oauth/abc123'), 'chatgpt', 'chatgpt.com is ChatGPT');
select is(public._assistant_for_redirects('https://vertexaisearch.cloud.google.com/oauth-redirect'), 'gemini', 'Gemini Enterprise is Gemini');
select is(public._assistant_for_redirects('https://claude.ai/a,https://claude.com/b'), 'claude', 'all addresses Claude''s');
select is(public._assistant_for_redirects('https://claude.ai/a,https://evil.example/cb'), null, 'one foreign address and it is no one');
select is(public._assistant_for_redirects('https://claude.ai.evil.example/cb'), null, 'a look-alike host is no one');
select is(public._assistant_for_redirects('http://claude.ai/cb'), null, 'only https counts');
select is(public._assistant_for_redirects('http://localhost:33418/callback'), null, 'a local client is no one');

reset role;
insert into auth.oauth_clients (id, registration_type, redirect_uris, grant_types, client_name, client_type, token_endpoint_auth_method)
values
  ('c0ffee00-0000-4000-8000-0000000000c1', 'dynamic', 'https://claude.ai/api/mcp/auth_callback', 'authorization_code,refresh_token', 'Claude', 'public', 'none'),
  ('c0ffee00-0000-4000-8000-0000000000c2', 'dynamic', 'http://localhost:4000/cb', 'authorization_code', 'Claude', 'public', 'none');

select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'c0ffee00-0000-4000-8000-0000000000c1');
select is(public.request_source(), 'claude', 'a client registered with Claude''s address writes as claude');
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'c0ffee00-0000-4000-8000-0000000000c2');
select is(public.request_source(), 'mcp', 'calling itself Claude is not enough');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select is(public.request_source(), 'app', 'the app is the app');

select * from finish();
rollback;
