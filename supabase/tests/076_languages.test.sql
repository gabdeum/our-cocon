-- Spec 076: each person's language, changed only by them; phones may say theirs.
begin;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000076a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000076b', 'eva@example.com'),
  ('00000000-0000-0000-0000-00000000076c', 'stranger@example.com');
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000076a', 'role', 'authenticated')::text, true);
set local role authenticated;
-- Eva has her own family; Gabriel's change must not reach her row.
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000076b', 'role', 'authenticated')::text, true);
select public.create_family('The Martins', 'Eva');
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000076a', 'role', 'authenticated')::text, true);
select public.create_family('The Demanges', 'Gabriel');

select is((select language from public.members where user_id = auth.uid()), 'automatic', 'a new member follows the device');
select lives_ok($$ select public.set_my_language('fr') $$, 'a member picks French');
select is((select language from public.members where user_id = auth.uid()), 'fr', 'and it is saved');
select throws_ok($$ select public.set_my_language('de') $$, '23514', null, 'a language the app does not speak is refused');

-- Someone without a family can't set one.
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000076c', 'role', 'authenticated')::text, true);
select throws_ok($$ select public.set_my_language('es') $$, '42501', null, 'a person outside any family is refused');

reset role;
select is((select language from public.members where user_id = '00000000-0000-0000-0000-00000000076b'), 'automatic', 'only the caller''s row changed');
select ok(public._push_prefs_ok('{"lang": "es", "todo_on": true}'), 'a phone may say it is in Spanish');
select ok(not public._push_prefs_ok('{"lang": "de"}'), 'but not in a language the app does not speak');

select * from finish();
rollback;
