-- Spec 003: families, invites and members, through the API functions as each person.
begin;
select plan(43);

-- As a signed-in person (or signed out with null), until the next call.
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  reset role;
  if uid is null then
    perform set_config('request.jwt.claims', '', true);
    set local role anon;
  else
    perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
    set local role authenticated;
  end if;
end;
$$;

-- New functions aren't callable by default (accounts_family migration); test helpers are.
grant execute on function pg_temp.login(uuid) to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'alex@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'mia@example.com'),
  ('00000000-0000-0000-0000-00000000000d', 'sam@example.com'),
  ('00000000-0000-0000-0000-00000000000e', 'lou@example.com');
insert into auth.sessions (id, user_id) values
  (gen_random_uuid(), '00000000-0000-0000-0000-00000000000b'),
  (gen_random_uuid(), '00000000-0000-0000-0000-00000000000c');

-- US1: a new account starts a family and is its Owner.
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.create_family('The Demanges', 'Gabriel') $$, 'Gabriel creates a family');
select is((select role::text from public.members), 'owner', 'Gabriel is the Owner');
select is((select avatar_tone::text from public.members), 'honey', 'first member is honey');
select is((select name from public.families), 'The Demanges', 'family is named');
select throws_ok($$ select public.create_family('Second', 'Gabriel') $$, 'already_in_family', 'one family per person');
select throws_ok($$ insert into public.families (name, owner_id) values ('x', auth.uid()) $$, '42501', null, 'no direct writes');
select throws_ok($$ update public.members set role = 'editor' $$, '42501', null, 'no direct updates');

-- US2.1: an invite link lets Alex join as "Can edit".
create temp table tokens (name text primary key, token text);
grant all on tokens to authenticated, anon;
insert into tokens select 'alex', public.create_invite();
select is(char_length((select token from tokens where name = 'alex')), 43, 'token is 32 random bytes, base64url');
reset role;
select is((select count(*)::int from public.invites where token_hash = (select token from tokens where name = 'alex')), 0, 'the token itself is not stored');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select throws_ok($$ select token_hash from public.invites $$, '42501', null, 'members cannot read token hashes');

select pg_temp.login(null);
select is(public.invite_status((select token from tokens where name = 'alex')),
  '{"status": "valid", "family_name": "The Demanges", "inviter_name": "Gabriel"}'::jsonb, 'signed-out preview shows family and inviter');
select is(public.invite_status('not-a-real-token'), '{"status": "expired"}'::jsonb, 'unknown token reads expired');
select throws_ok($$ select public.accept_invite('x', 'Alex') $$, '42501', null, 'signed out cannot accept');

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select is(public.accept_invite((select token from tokens where name = 'alex'), 'Alex'), 0, 'Alex joins (0 days after it was sent)');
select is((select role::text from public.members where display_name = 'Alex'), 'editor', 'Alex can edit');
select is((select avatar_tone::text from public.members where display_name = 'Alex'), 'sage', 'second member is sage');
select is((select count(*)::int from public.members), 2, 'Alex sees both members');
select is((select name from public.families), 'The Demanges', 'Alex sees the family');

-- US2.2: used or expired invites read "expired".
select is(public.invite_status((select token from tokens where name = 'alex')), '{"status": "expired"}'::jsonb, 'used invite reads expired');
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select throws_ok($$ select public.accept_invite((select token from tokens where name = 'alex'), 'Mia') $$, 'invite_expired', 'used invite cannot be reused');

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into tokens select 'old', public.create_invite();
insert into tokens select 'mia', public.create_invite();
reset role;
update public.invites set created_at = now() - interval '8 days', expires_at = now() - interval '1 day'
  where token_hash = public._token_hash((select token from tokens where name = 'old'));
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select is(public.invite_status((select token from tokens where name = 'old')), '{"status": "expired"}'::jsonb, 'invite older than 7 days reads expired');
select throws_ok($$ select public.accept_invite((select token from tokens where name = 'old'), 'Mia') $$, 'invite_expired');
select is(public.accept_invite((select token from tokens where name = 'mia'), 'Mia'), 0, 'Mia joins');
select is((select avatar_tone::text from public.members where display_name = 'Mia'), 'peach', 'third member is peach');

-- Invite clash: Sam has a family of their own.
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select public.create_family('Sam''s', 'Sam');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into tokens select 'sam', public.create_invite();
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select throws_ok($$ select public.accept_invite((select token from tokens where name = 'sam'), 'Sam') $$, 'already_in_family', 'needs confirmation to replace own family');
select lives_ok($$ select public.accept_invite((select token from tokens where name = 'sam'), 'Sam', true) $$, 'alone in own family: replaced');
select is((select name from public.families), 'The Demanges', 'Sam is now in the Demanges');
reset role;
select is((select count(*)::int from public.families where name = 'Sam''s'), 0, 'Sam''s own family is gone');

-- A family with other people blocks the clash.
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.create_family('Lou''s', 'Lou');
insert into tokens select 'lou-friend', public.create_invite();
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into tokens select 'lou', public.create_invite();
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select throws_ok($$ select public.accept_invite((select token from tokens where name = 'lou-friend'), 'Mia', true) $$, 'own_family_has_members', 'cannot leave a family that has others');

-- Rate limit: 10 invites per person per hour (Gabriel has made 4).
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.create_invite() from generate_series(1, 6);
select throws_ok($$ select public.create_invite() $$, 'rate_limited', '11th invite in an hour is refused');

-- US3: the owner manages members; others cannot.
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select throws_ok($$ select public.remove_member('00000000-0000-0000-0000-00000000000c') $$, 'not_owner', 'a member cannot remove anyone');
select throws_ok($$ select public.make_owner('00000000-0000-0000-0000-00000000000b') $$, 'not_owner', 'a member cannot take ownership');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select throws_ok($$ select public.remove_member(auth.uid()) $$, 'cannot_remove_self', 'the owner cannot remove themselves');
select throws_ok($$ select public.remove_member('00000000-0000-0000-0000-00000000000e') $$, 'not_a_member', 'cannot remove someone from another family');
select lives_ok($$ select public.remove_member('00000000-0000-0000-0000-00000000000c') $$, 'the owner removes Mia');
reset role;
select is((select count(*)::int from auth.sessions where user_id = '00000000-0000-0000-0000-00000000000c'), 0, 'Mia is signed out everywhere');
-- Edge: a removed member loses access immediately.
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.families) + (select count(*)::int from public.members where user_id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b')), 0, 'Mia sees nothing');

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.make_owner('00000000-0000-0000-0000-00000000000b');
select is((select string_agg(display_name || ':' || role, ',' order by display_name) from public.members),
  'Alex:owner,Gabriel:editor,Sam:editor', 'ownership handed to Alex');
select throws_ok($$ select public.delete_family() $$, 'not_owner', 'only the owner deletes the family');

-- FR-006: members delete their account; the owner deletes the family.
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select lives_ok($$ select public.delete_my_account() $$, 'Sam deletes their account');
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select throws_ok($$ select public.delete_my_account() $$, 'owner_must_delete_family', 'the owner deletes the family instead');
select is(public.delete_family(), 2, 'Alex deletes the family of 2');
reset role;
select is((select count(*)::int from public.families where owner_id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b')) + (select count(*)::int from public.invites where created_by = '00000000-0000-0000-0000-00000000000a') + (select count(*)::int from public.members where user_id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b')), 0, 'family, members and invites are gone');

select * from finish();
rollback;
