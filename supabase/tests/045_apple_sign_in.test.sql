-- Spec 045 FR-009: Apple refresh tokens are out of reach of members and assistants, and deleting a
-- person, by any path, queues their token to be revoked at Apple.
begin;
select plan(17);

create function pg_temp.login(uid uuid, r text) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'role', r)::text, true);
  execute format('set local role %I', r);
end;
$$;
grant execute on function pg_temp.login(uuid, text) to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000e', 'eva@privaterelay.appleid.com'),
  ('00000000-0000-0000-0000-00000000000a', 'alex@example.com');

-- The server keeps Eva's token; a newer sign-in replaces it.
set local role service_role;
select lives_ok($$ select public.apple_keep_token('00000000-0000-0000-0000-00000000000e', 'r-1') $$, 'the server keeps a token');
select public.apple_keep_token('00000000-0000-0000-0000-00000000000e', 'r-2');
reset role;
select is((select refresh_token from public.apple_tokens where user_id = '00000000-0000-0000-0000-00000000000e'), 'r-2', 'a newer sign-in replaces it');

-- Nobody else reaches the tables or the functions.
select pg_temp.login('00000000-0000-0000-0000-00000000000e', 'authenticated');
select throws_ok($$ select * from public.apple_tokens $$, '42501', null, 'a member can''t read even their own token');
select throws_ok($$ select * from public.apple_revocations $$, '42501', null, 'nor the queue');
select throws_ok($$ select public.apple_keep_token('00000000-0000-0000-0000-00000000000e', 'mine') $$, '42501', null, 'nor store a token');
select throws_ok($$ select * from public.apple_tokens_to_revoke() $$, '42501', null, 'nor list the queue');
select throws_ok($$ select public.apple_revocation_tried(1, true) $$, '42501', null, 'nor clear it');
select pg_temp.login('00000000-0000-0000-0000-00000000000e', 'cocon_assistant');
select throws_ok($$ select * from public.apple_tokens $$, '42501', null, 'an assistant can''t read tokens');
select throws_ok($$ select * from public.apple_revocations $$, '42501', null, 'nor the queue');
select throws_ok($$ select public.apple_keep_token('00000000-0000-0000-0000-00000000000e', 'mine') $$, '42501', null, 'nor store a token');
select throws_ok($$ select * from public.apple_tokens_to_revoke() $$, '42501', null, 'nor list the queue');
select throws_ok($$ select public.delete_my_account() $$, '42501', null, 'nor delete the member''s account (the delete-account function relies on it)');
reset role;
set local role anon;
select throws_ok($$ select * from public.apple_tokens_to_revoke() $$, '42501', null, 'nor can anyone signed out');
reset role;

-- Deleting Eva queues her token, which goes with her; Alex had none.
delete from auth.users where id in ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.apple_tokens), 0, 'the token goes with the account');
set local role service_role;
select results_eq(
  $$ select refresh_token from public.apple_tokens_to_revoke('00000000-0000-0000-0000-00000000000e') $$,
  $$ values ('r-2') $$, 'deleting her account queues her token, only hers');

-- A failed try stays for the next night; a revoked token leaves the queue.
select public.apple_revocation_tried((select id from public.apple_tokens_to_revoke()), false);
reset role;
select is((select attempts from public.apple_revocations), 1, 'a failed try is counted and kept');
set local role service_role;
select public.apple_revocation_tried((select id from public.apple_tokens_to_revoke()), true);
select is((select count(*)::int from public.apple_tokens_to_revoke()), 0, 'a revoked token leaves the queue');

select * from finish();
rollback;
