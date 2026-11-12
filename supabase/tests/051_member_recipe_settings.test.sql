-- Spec 051 (after review): each member's own units. A member reads and changes only their own
-- row; another member of the family, another family and signed-out people see nothing.
begin;
select plan(9);

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

create function pg_temp.affected(statement text) returns integer language plpgsql as $$
declare
  n integer;
begin
  execute statement;
  get diagnostics n = row_count;
  return n;
end;
$$;
grant execute on function pg_temp.login(uuid), pg_temp.affected(text) to public;
create temp table tokens (name text, token text);
grant all on tokens to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000051a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000051b', 'eva@example.com'),
  ('00000000-0000-0000-0000-00000000051f', 'sam@example.com');
select pg_temp.login('00000000-0000-0000-0000-00000000051a');
select public.create_family('The Demanges', 'Gabriel');
insert into tokens select 'eva', public.create_invite();
select pg_temp.login('00000000-0000-0000-0000-00000000051b');
select public.accept_invite((select token from tokens where name = 'eva'), 'Eva');
select pg_temp.login('00000000-0000-0000-0000-00000000051f');
select public.create_family('Sam''s', 'Sam');

-- Gabriel picks Imperial for himself.
select pg_temp.login('00000000-0000-0000-0000-00000000051a');
select lives_ok($$ insert into public.member_recipe_settings (family_id, units) values (public.my_family_id(), 'imperial') $$, 'Gabriel picks Imperial');
select is((select units::text from public.member_recipe_settings), 'imperial', 'and reads it back');
select is(pg_temp.affected($$ update public.member_recipe_settings set user_id = '00000000-0000-0000-0000-00000000051b' $$), 1, 'an update that tries to hand it over');
select is((select user_id from public.member_recipe_settings), '00000000-0000-0000-0000-00000000051a'::uuid, 'keeps it his');
select throws_ok($$ delete from public.member_recipe_settings $$, '42501', null, 'nobody deletes a row');

-- Eva, in the same family, sees nothing of his and can't write one for him.
select pg_temp.login('00000000-0000-0000-0000-00000000051b');
select is((select count(*)::int from public.member_recipe_settings), 0, 'Eva doesn''t see Gabriel''s units');
select throws_ok($$ insert into public.member_recipe_settings (family_id, user_id, units) values (public.my_family_id(), '00000000-0000-0000-0000-00000000051a', 'metric') $$,
  '42501', null, 'nor writes them for him');

-- Another family and signed-out people see nothing.
select pg_temp.login('00000000-0000-0000-0000-00000000051f');
select is((select count(*)::int from public.member_recipe_settings), 0, 'another family sees none');
select pg_temp.login(null);
select throws_ok($$ select * from public.member_recipe_settings $$, '42501', null, 'signed-out people can''t read them');

select * from finish();
rollback;
