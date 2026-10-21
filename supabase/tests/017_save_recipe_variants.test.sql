-- Spec 017: save_recipe_variants saves a recipe's variant list in one go, for the family's members
-- only; a recipe holds at most 20 variants, each at most 50 changes of a known type.
begin;
select plan(23);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  reset role;
  if uid is null then
    perform set_config('request.jwt.claims', '', true);
    set local role anon;
  else
    perform set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'role', 'authenticated')::text, true);
    set local role authenticated;
  end if;
end;
$$;
grant execute on function pg_temp.login(uuid) to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000000f', 'sam@example.com');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.create_family('The Demanges', 'Gabriel');
insert into public.recipes (id, name) values
  ('00000000-0000-4000-8000-000000000001', 'Quiche'),
  ('00000000-0000-4000-8000-000000000002', 'Soup');
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select public.create_family('The Others', 'Sam');

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select ok(has_function_privilege('authenticated', 'public.save_recipe_variants(uuid, jsonb)', 'execute'), 'members can call it');
select ok(not has_function_privilege('anon', 'public.save_recipe_variants(uuid, jsonb)', 'execute'), 'signed out, nobody can');
select ok(not has_function_privilege('anon', 'public._variant_changes_ok(jsonb)', 'execute'), 'signed out, nobody can run the check either');

select lives_ok($$ select public.save_recipe_variants('00000000-0000-4000-8000-000000000001', '[
  {"id": "00000000-0000-4000-8000-0000000000c1", "name": "Vegetarian", "kind": "version",
   "changes": [{"type": "swap_ingredient", "ingredient_id": "00000000-0000-4000-8000-0000000000a1",
     "with": [{"id": "00000000-0000-4000-8000-0000000000a9", "name": "Mushrooms", "quantity": 250, "unit": "g"}]}]},
  {"id": "00000000-0000-4000-8000-0000000000c2", "name": "Make my own dough", "kind": "option",
   "changes": [{"type": "remove_step", "step_id": "00000000-0000-4000-8000-0000000000b1"}]}
]') $$, 'a member saves two variants');
select is((select array_agg(name order by position) from public.recipe_variants where recipe_id = '00000000-0000-4000-8000-000000000001'),
  array['Vegetarian', 'Make my own dough'], 'in the order sent');
select is((select (kind::text, jsonb_array_length(changes)) ::text from public.recipe_variants where id = '00000000-0000-4000-8000-0000000000c1'),
  '(version,1)', 'with its kind and changes');
select is((select (created_by, source::text)::text from public.recipe_variants where id = '00000000-0000-4000-8000-0000000000c1'),
  '(00000000-0000-0000-0000-00000000000a,app)', 'who wrote it, and through what');

select lives_ok($$ select public.save_recipe_variants('00000000-0000-4000-8000-000000000001', '[
  {"id": "00000000-0000-4000-8000-0000000000c3", "name": "Spicy", "kind": "option", "changes": []},
  {"id": "00000000-0000-4000-8000-0000000000c1", "name": "Veggie", "kind": "version", "changes": []}
]') $$, 'reordering, adding and removing saves in one go');
select is((select array_agg(id::text order by position) from public.recipe_variants where recipe_id = '00000000-0000-4000-8000-000000000001'),
  array['00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-0000000000c1'], 'rows swap; the one left out is gone');
select is((select name from public.recipe_variants where id = '00000000-0000-4000-8000-0000000000c1'), 'Veggie', 'an edit is saved');

select throws_ok($$ select public.save_recipe_variants('00000000-0000-4000-8000-000000000002', '[
  {"id": "00000000-0000-4000-8000-0000000000c1", "name": "Mine", "kind": "option", "changes": []}]') $$, '22023', null, 'a variant cannot move to another recipe');
select throws_ok($$ select public.save_recipe_variants('00000000-0000-4000-8000-000000000001', '[
  {"id": "00000000-0000-4000-8000-0000000000c4", "name": "Odd", "kind": "option", "changes": [{"type": "rewrite_everything"}]}]') $$,
  '23514', null, 'a change of an unknown type is refused');
select throws_ok(format($$ select public.save_recipe_variants('00000000-0000-4000-8000-000000000001', %L) $$,
  jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'name', 'Long', 'kind', 'option', 'changes',
    (select jsonb_agg(jsonb_build_object('type', 'remove_step', 'step_id', gen_random_uuid())) from generate_series(1, 51))))),
  '23514', null, '51 changes are refused');
select throws_ok(format($$ select public.save_recipe_variants('00000000-0000-4000-8000-000000000002', %L) $$,
  (select jsonb_agg(jsonb_build_object('id', gen_random_uuid(), 'name', 'V' || n, 'kind', 'option', 'changes', '[]'::jsonb)) from generate_series(1, 21) n)),
  '22023', null, '21 variants are refused');
select throws_ok($$ insert into public.recipe_variants (recipe_id, position, name, kind) values ('00000000-0000-4000-8000-000000000002', 20, 'Too far', 'option') $$,
  '23514', null, 'the table holds at most 20 variants a recipe');
select throws_ok($$ select public.save_recipe_variants('00000000-0000-4000-8000-000000000001', '[
  {"id": "00000000-0000-4000-8000-0000000000c1", "name": "Renamed", "kind": "version", "changes": []},
  {"id": "00000000-0000-4000-8000-0000000000c5", "name": "Odd", "kind": "option", "changes": [{"type": "nope"}]}]') $$,
  '23514', null, 'one bad variant refuses the whole call');
select throws_ok(format($$ update public.recipe_variants set changes = %L where id = '00000000-0000-4000-8000-0000000000c1' $$,
  jsonb_build_array(jsonb_build_object('type', 'remove_step', 'step_id', gen_random_uuid(), 'note', repeat('x', 300000)))),
  '23514', null, 'changes over 256 KB are refused, written directly too');
select throws_ok($$ update public.recipe_variants set changes = '{}' where id = '00000000-0000-4000-8000-0000000000c1' $$,
  '23514', null, 'changes that are not a list are refused');
select is((select count(*)::int from public.recipe_variants where recipe_id = '00000000-0000-4000-8000-000000000001'), 2, 'a refused save changes nothing');
select is((select (name, position)::text from public.recipe_variants where id = '00000000-0000-4000-8000-0000000000c1'), '(Veggie,1)', 'not even the valid part of a refused call');

-- Sam (another family) can't save into family A's recipe, nor take its variants.
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select throws_ok($$ select public.save_recipe_variants('00000000-0000-4000-8000-000000000001', '[]') $$, 'P0002', null, 'other family: the recipe is not found');
insert into public.recipes (id, name) values ('00000000-0000-4000-8000-000000000003', 'Sam''s');
select throws_ok($$ select public.save_recipe_variants('00000000-0000-4000-8000-000000000003', '[
  {"id": "00000000-0000-4000-8000-0000000000c1", "name": "Mine now", "kind": "option", "changes": []}]') $$, '22023', null, 'other family: cannot take over another family''s variant');

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select is((select (recipe_id, name)::text from public.recipe_variants where id = '00000000-0000-4000-8000-0000000000c1'),
  '(00000000-0000-4000-8000-000000000001,Veggie)', 'the family''s variant is untouched');

select * from finish();
rollback;
