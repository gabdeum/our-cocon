-- Spec 022 (032-later L39): items added from a recipe remember it, even once the recipe is purged.
begin;
select plan(5);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;
grant execute on function pg_temp.login(uuid) to public;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'gabriel@example.com');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.create_family('The Demanges', 'Gabriel');
insert into public.recipes (id, name, serves) values ('00000000-0000-4000-8000-0000000000e1', 'Leek & bacon quiche', 6);

insert into public.grocery_items (name, recipe_id) values ('Leeks', '00000000-0000-4000-8000-0000000000e1');
insert into public.grocery_items (name, from_recipe) values ('Milk', true);
select is((select from_recipe from public.grocery_items where name = 'Leeks'), true, 'an item with a recipe is from a recipe');
select is((select from_recipe from public.grocery_items where name = 'Milk'), false, 'a writer cannot claim it');

update public.grocery_items set from_recipe = false, name = 'Leek' where name = 'Leeks';
select is((select from_recipe from public.grocery_items where name = 'Leek'), true, 'nor drop it');

-- The purge removes the recipe for good; the foreign key clears recipe_id.
reset role;
delete from public.recipes where id = '00000000-0000-4000-8000-0000000000e1';
select is((select recipe_id from public.grocery_items where name = 'Leek'), null, 'the purge clears the recipe');
select is((select from_recipe from public.grocery_items where name = 'Leek'), true, 'and the item still knows it came from one');

select * from finish();
rollback;
