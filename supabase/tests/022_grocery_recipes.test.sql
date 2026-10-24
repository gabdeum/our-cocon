-- Spec 022: the servings a recipe is on the grocery list for (grocery_recipes). Members of the
-- family read and change them; another family and signed-out people see nothing; nobody deletes
-- them; they go with the recipe when it's purged.
begin;
select plan(12);

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

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000000f', 'sam@example.com');
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select public.create_family('The Others', 'Sam');
insert into public.recipes (id, name, serves) values ('00000000-0000-4000-8000-0000000000e2', 'Sam''s soup', 4);
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.create_family('The Demanges', 'Gabriel');
insert into public.recipes (id, name, serves) values ('00000000-0000-4000-8000-0000000000e1', 'Leek & bacon quiche', 6);

-- A member records and changes the servings; the family and author are the database's.
insert into public.grocery_recipes (recipe_id, servings) values ('00000000-0000-4000-8000-0000000000e1', 6);
select is((select created_by from public.grocery_recipes), '00000000-0000-0000-0000-00000000000a'::uuid, 'a member records servings, as themselves');
select is(pg_temp.affected($$ update public.grocery_recipes set servings = 8 $$), 1, 'and changes them');
insert into public.recipes (id, name, serves) values ('00000000-0000-4000-8000-0000000000e3', 'Apple crumble', 4);
update public.grocery_recipes set recipe_id = '00000000-0000-4000-8000-0000000000e3';
select is((select recipe_id from public.grocery_recipes), '00000000-0000-4000-8000-0000000000e1'::uuid, 'a row stays its recipe''s');
select throws_ok($$ insert into public.grocery_recipes (recipe_id, servings) values ('00000000-0000-4000-8000-0000000000e1', 4) $$, '23505', null,
  'one row per recipe');
select throws_ok($$ update public.grocery_recipes set servings = 51 $$, '23514', null, 'servings stay within 1–50');
select throws_ok($$ insert into public.grocery_recipes (recipe_id, servings) values ('00000000-0000-4000-8000-0000000000e2', 4) $$, '23503', null,
  'never for another family''s recipe');
select throws_ok($$ delete from public.grocery_recipes $$, '42501', null, 'members never delete them');

-- Another family and signed-out people see nothing.
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select is((select count(*)::int from public.grocery_recipes), 0, 'another family reads no rows');
select is(pg_temp.affected($$ update public.grocery_recipes set servings = 2 $$), 0, 'nor changes them');
select pg_temp.login(null);
select throws_ok($$ select * from public.grocery_recipes $$, '42501', null, 'signed-out people cannot read them');

-- The purge removes the recipe for good, and its servings go with it.
reset role;
select set_config('request.jwt.claims', '', true);
select is((select servings from public.grocery_recipes where recipe_id = '00000000-0000-4000-8000-0000000000e1'), 8, 'the change was kept');
delete from public.recipes where id = '00000000-0000-4000-8000-0000000000e1';
select is((select count(*)::int from public.grocery_recipes where recipe_id = '00000000-0000-4000-8000-0000000000e1'), 0, 'the purge removes the recipe''s servings');

select * from finish();
rollback;
