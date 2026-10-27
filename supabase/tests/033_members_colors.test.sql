-- Spec 033: members without the app, and one color per member.
begin;
select plan(51);

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
grant execute on function pg_temp.login(uuid) to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000033a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000033b', 'eva@example.com'),
  ('00000000-0000-0000-0000-00000000033c', 'james@example.com'),
  ('00000000-0000-0000-0000-00000000033d', 'sam@example.com');

create temp table ids (name text primary key, id uuid);
create temp table tokens (name text primary key, token text);
grant all on ids, tokens to authenticated, anon;

-- US2: a family of three, each with a different color in palette order.
select pg_temp.login('00000000-0000-0000-0000-00000000033a');
select public.create_family('The Demanges', 'Gabriel');
insert into tokens select 'eva', public.create_invite();
select pg_temp.login('00000000-0000-0000-0000-00000000033b');
select public.accept_invite((select token from tokens where name = 'eva'), 'Eva');

-- US1.1: Gabriel adds James, who has no account.
select pg_temp.login('00000000-0000-0000-0000-00000000033a');
insert into ids select 'james', public.add_managed_member('  James ');
select is((select user_id from public.members where id = (select id from ids where name = 'james')), null, 'James has no account');
select is((select display_name from public.members where id = (select id from ids where name = 'james')), 'James', 'his name is trimmed');
select is((select managed_by from public.members where id = (select id from ids where name = 'james')),
  (select id from public.members where user_id = '00000000-0000-0000-0000-00000000033a'), 'managed by Gabriel, who added him');
select is((select array_agg(color::text order by color) from public.members), array['honey', 'rose', 'sky'], 'three members, three colors, in palette order');
select throws_ok($$ select public.add_managed_member('Kid', 'sky') $$, 'color_taken', 'a taken color can''t be picked');
select throws_ok($$ select public.add_managed_member('') $$, '23514', null, 'a name is needed');
select throws_ok($$ insert into public.members (family_id, role, display_name, color) values (public.my_family_id(), 'editor', 'X', 'mint') $$, '42501', null, 'no direct writes');

-- Any member manages members without the app (FR-003).
select pg_temp.login('00000000-0000-0000-0000-00000000033b');
select lives_ok($$ select public.rename_managed_member((select id from ids where name = 'james'), 'Jamie') $$, 'Eva renames him');
select is((select display_name from public.members where id = (select id from ids where name = 'james')), 'Jamie', 'renamed');
select lives_ok($$ select public.rename_managed_member((select id from ids where name = 'james'), 'James') $$, 'and back');
select throws_ok(format($$ select public.rename_managed_member(%L, 'Gab') $$, (select id from public.members where user_id = '00000000-0000-0000-0000-00000000033a')),
  'not_managed', 'account members rename themselves');
select throws_ok(format($$ select public.remove_managed_member(%L) $$, (select id from public.members where user_id = '00000000-0000-0000-0000-00000000033a')),
  'not_managed', 'account members are removed only by the owner');

-- US3: pick my color.
select lives_ok(format($$ select public.set_member_color(%L, 'lilac') $$, (select id from public.members where user_id = auth.uid())), 'Eva picks a free color');
select is((select color::text from public.members where user_id = auth.uid()), 'lilac', 'her color changed for everyone');
select throws_ok(format($$ select public.set_member_color(%L, 'honey') $$, (select id from public.members where user_id = auth.uid())), 'color_taken', 'Gabriel''s color can''t be picked');
select lives_ok(format($$ select public.set_member_color(%L, 'rose') $$, (select id from ids where name = 'james')), 'a managed member''s color can change');
select throws_ok(format($$ select public.set_member_color(%L, 'mint') $$, (select id from public.members where user_id = '00000000-0000-0000-0000-00000000033a')),
  'not_managed', 'not another account member''s color');

-- Another family sees and changes nothing.
select pg_temp.login('00000000-0000-0000-0000-00000000033d');
select public.create_family('Sam''s', 'Sam');
select is((select count(*)::int from public.members), 1, 'Sam sees only his own family');
select throws_ok(format($$ select public.set_member_color(%L, 'sky') $$, (select id from ids where name = 'james')), 'not_a_member', 'nor recolors James');
select throws_ok(format($$ select public.rename_managed_member(%L, 'X') $$, (select id from ids where name = 'james')), 'not_a_member', 'nor renames him');
select throws_ok(format($$ select public.remove_managed_member(%L) $$, (select id from ids where name = 'james')), 'not_a_member', 'nor removes him');
select throws_ok(format($$ select public.create_invite(%L) $$, (select id from ids where name = 'james')), 'not_a_member', 'nor invites as him');
select pg_temp.login(null);
select throws_ok($$ select public.add_managed_member('X') $$, '42501', null, 'signed out can''t add');

-- US1.2: James gets the app through his own invite and keeps his member, name and color.
select pg_temp.login('00000000-0000-0000-0000-00000000033a');
insert into tokens select 'james', public.create_invite((select id from ids where name = 'james'));
select throws_ok(format($$ select public.create_invite(%L) $$, (select id from public.members where user_id = auth.uid())), 'not_managed', 'only members without the app get a member invite');
select pg_temp.login(null);
select is(public.invite_status((select token from tokens where name = 'james')) ->> 'member_name', 'James', 'the link says who it is for');
select pg_temp.login('00000000-0000-0000-0000-00000000033c');
select is(public.accept_invite((select token from tokens where name = 'james'), 'Jim'), '{"days_since_sent": 0, "days_since_added": 0}'::jsonb, 'James joins');
select is((select user_id from public.members where id = (select id from ids where name = 'james')), '00000000-0000-0000-0000-00000000033c'::uuid, 'the same member now has his account');
select is((select display_name || ' ' || color::text from public.members where user_id = auth.uid()), 'James rose', 'his name and color stay');
select is((select managed_by from public.members where user_id = auth.uid()), null, 'and nobody manages him any more');
select is((select count(*)::int from public.members), 3, 'no new member was added');
select pg_temp.login(null);
select is(public.invite_status((select token from tokens where name = 'james')), '{"status": "expired"}'::jsonb, 'his link is used up');

-- A member link can't be taken by someone already in this family, nor by someone whose own
-- family has other members.
select pg_temp.login('00000000-0000-0000-0000-00000000033a');
insert into ids select 'leo', public.add_managed_member('Leo');
insert into tokens select 'leo', public.create_invite((select id from ids where name = 'leo'));
select pg_temp.login('00000000-0000-0000-0000-00000000033b');
select throws_ok($$ select public.accept_invite((select token from tokens where name = 'leo'), 'Eva') $$, 'already_in_this_family', 'Eva can''t become Leo');
select pg_temp.login('00000000-0000-0000-0000-00000000033d');
select public.add_managed_member('Kit');
select throws_ok($$ select public.accept_invite((select token from tokens where name = 'leo'), 'Sam', true) $$, 'own_family_has_members', 'Sam''s family has Kit, so it isn''t replaced');
select pg_temp.login('00000000-0000-0000-0000-00000000033a');
select is((select user_id from public.members where id = (select id from ids where name = 'leo')), null, 'Leo still has no account');
select public.remove_managed_member((select id from ids where name = 'leo'));
select throws_ok($$ select public.set_member_color(null, 'mint') $$, 'not_a_member', 'no member, no color change');

-- Removing a member without the app cancels their links.
select pg_temp.login('00000000-0000-0000-0000-00000000033a');
insert into ids select 'mila', public.add_managed_member('Mila');
insert into tokens select 'mila', public.create_invite((select id from ids where name = 'mila'));
select lives_ok($$ select public.remove_managed_member((select id from ids where name = 'mila')) $$, 'any member removes Mila');
select pg_temp.login(null);
select is(public.invite_status((select token from tokens where name = 'mila')), '{"status": "expired"}'::jsonb, 'her link stops working');

-- More than 8 members: colors repeat from the start of the palette.
select pg_temp.login('00000000-0000-0000-0000-00000000033a');
select public.add_managed_member('Kid ' || n) from generate_series(1, 5) n;
select is((select count(distinct color)::int from public.members where family_id = public.my_family_id()), 8, '8 members, 8 colors');
insert into ids select 'ninth', public.add_managed_member('Ninth');
select is((select color::text from public.members where id = (select id from ids where name = 'ninth')), 'honey', 'the 9th starts the palette again');

-- Grants: only signed-in people call the API; assistants and helpers can't.
reset role;
select ok(not has_function_privilege('anon', f, 'execute'), 'signed out can''t call ' || f) from unnest(array[
  'public.add_managed_member(text, public.member_color)', 'public.rename_managed_member(uuid, text)', 'public.remove_managed_member(uuid)',
  'public.set_member_color(uuid, public.member_color)', 'public.create_invite(uuid)']) f;
select ok(not has_function_privilege('cocon_assistant', f, 'execute'), 'assistants can''t call ' || f) from unnest(array[
  'public.add_managed_member(text, public.member_color)', 'public.rename_managed_member(uuid, text)', 'public.remove_managed_member(uuid)',
  'public.set_member_color(uuid, public.member_color)']) f;
select ok(not has_function_privilege('authenticated', f, 'execute'), 'helpers aren''t callable: ' || f) from unnest(array[
  'public._me_locked()', 'public._managed(uuid, uuid)', 'public._next_color(uuid)']) f;

select * from finish();
rollback;
