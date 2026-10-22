-- Spec 020: the grocery list. An item written without an aisle gets the family's correction, then
-- the catalog's, then Other (FR-001); cleared items are kept, hidden, for Undo, by members of the
-- family only; the nightly purge removes them a day on. Reading and writing items across families
-- is covered by 004_rls.test.sql.
begin;
select plan(24);

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
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.create_family('The Demanges', 'Gabriel');
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select public.create_family('The Others', 'Sam');

-- FR-001: the aisle when none is given.
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into public.grocery_items (name, catalog_key) values ('Gruyère', 'gruyere');
select is((select aisle::text from public.grocery_items where name = 'Gruyère'), 'dairy_eggs', 'the catalog gives the aisle');
insert into public.grocery_items (name) values ('Za''atar');
select is((select aisle::text from public.grocery_items where name = 'Za''atar'), 'other', 'unknown items go to Other');
insert into public.grocery_items (name, catalog_key, aisle) values ('Lemons', 'lemon', 'drinks');
select is((select aisle::text from public.grocery_items where name = 'Lemons'), 'drinks', 'a given aisle is kept');

insert into public.family_ingredients (catalog_key, aisle) values ('nutmeg', 'produce');
insert into public.grocery_items (name, catalog_key) values ('Nutmeg', 'nutmeg');
select is((select aisle::text from public.grocery_items where name = 'Nutmeg'), 'produce', 'the family''s correction wins over the catalog');
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
insert into public.grocery_items (name, catalog_key) values ('Nutmeg', 'nutmeg');
select is((select aisle::text from public.grocery_items where name = 'Nutmeg'), 'spices_baking', 'but only for that family');

-- Clear done items and Undo.
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
update public.grocery_items set checked = true where name = 'Gruyère';
select is(pg_temp.affected($$ update public.grocery_items set deleted_at = now() where checked $$), 1, 'a member clears ticked items');
select is(pg_temp.affected($$ update public.grocery_items set deleted_at = null where name = 'Gruyère' $$), 1, 'and brings them back');
reset role;
select set_config('request.jwt.claims', '', true);
update public.grocery_items set deleted_at = now() - interval '2 days' where name = 'Lemons';
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select throws_ok($$ update public.grocery_items set deleted_at = null where name = 'Lemons' $$, '22023', null,
  'Undo ends after a day');
select is((select created_by from public.grocery_items where name = 'Gruyère'), '00000000-0000-0000-0000-00000000000a'::uuid,
  'keeping who added them');
-- The database's clock and the person clearing, whatever the device sends.
update public.grocery_items set deleted_at = '2000-01-01' where name = 'Gruyère';
select ok((select deleted_at > now() - interval '1 minute' from public.grocery_items where name = 'Gruyère'),
  'a cleared time is the database''s, not the device''s');
select is((select deleted_by from public.grocery_items where name = 'Gruyère'), '00000000-0000-0000-0000-00000000000a'::uuid,
  'and records who cleared it');
update public.grocery_items set deleted_at = now() + interval '1 year' where name = 'Gruyère';
select ok((select deleted_at < now() + interval '1 minute' from public.grocery_items where name = 'Gruyère'),
  'an item already cleared keeps its time');
update public.grocery_items set deleted_at = null where name = 'Gruyère';
select is((select deleted_by from public.grocery_items where name = 'Gruyère'), null, 'Undo forgets who cleared it');
select throws_ok($$ delete from public.grocery_items where name = 'Gruyère' $$, '42501', null, 'members never delete for good');

update public.grocery_items set deleted_at = now() where name = 'Gruyère';
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select is(pg_temp.affected($$ update public.grocery_items set deleted_at = null where name = 'Gruyère' $$), 0,
  'another family cannot restore them');
select is((select count(*)::int from public.grocery_items where name = 'Gruyère'), 0, 'or see them, cleared or not');
insert into public.family_ingredients (catalog_key, aisle) values ('nutmeg', 'frozen')
  on conflict (family_id, catalog_key) do update set aisle = excluded.aisle;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select is((select aisle::text from public.family_ingredients where catalog_key = 'nutmeg'), 'produce',
  'another family''s Move to… never changes ours');
update public.grocery_items set deleted_at = null where name = 'Gruyère';
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select is(pg_temp.affected($$ update public.grocery_items set deleted_at = now() where name = 'Gruyère' $$), 0,
  'another family cannot clear them');
select pg_temp.login(null);
select throws_ok($$ update public.grocery_items set deleted_at = now() $$, '42501', null, 'signed out cannot clear');

-- The nightly purge.
reset role;
select set_config('request.jwt.claims', '', true);
-- As the nightly job sees them (no one signed in, so the times are kept).
update public.grocery_items set deleted_at = now() - interval '2 days' where name = 'Za''atar';
update public.grocery_items set deleted_at = null where name = 'Lemons';
update public.grocery_items set deleted_at = now() - interval '1 hour' where name = 'Lemons';
set local role service_role;
select is(public.purge_cleared_groceries(), 1, 'the purge removes items cleared over a day ago');
reset role;
select is((select count(*)::int from public.grocery_items where name = 'Lemons'), 1, 'and keeps those cleared since');
select ok(not has_function_privilege('authenticated', 'public.purge_cleared_groceries()', 'execute'), 'members cannot purge');
select ok(not has_function_privilege('anon', 'public.purge_cleared_groceries()', 'execute'), 'signed out cannot purge');
select ok(not has_function_privilege('authenticated', 'public._grocery_item_aisle()', 'execute'), 'the trigger is not callable');

select * from finish();
rollback;
