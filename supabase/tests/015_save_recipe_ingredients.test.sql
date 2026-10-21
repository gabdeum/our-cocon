-- Spec 015: save_recipe_ingredients saves a recipe's ingredient list in one go, for the family's
-- members only, and takes removed ingredients out of the recipe's steps.
begin;
select plan(16);

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
select ok(has_function_privilege('authenticated', 'public.save_recipe_ingredients(uuid, jsonb)', 'execute'), 'members can call it');
select ok(not has_function_privilege('anon', 'public.save_recipe_ingredients(uuid, jsonb)', 'execute'), 'signed out, nobody can');

select lives_ok($$ select public.save_recipe_ingredients('00000000-0000-4000-8000-000000000001', '[
  {"id": "00000000-0000-4000-8000-0000000000a1", "name": "Leeks", "quantity": 2, "unit": "piece", "weight_per_piece_g": 150,
   "piece_noun_singular": "leek", "piece_noun_plural": "leeks"},
  {"id": "00000000-0000-4000-8000-0000000000a2", "name": "Lardons", "quantity": 200, "unit": "g"},
  {"id": "00000000-0000-4000-8000-0000000000a3", "name": "Salt and pepper to taste"}
]') $$, 'a member saves three ingredients');
select is((select array_agg(name order by position) from public.recipe_ingredients where recipe_id = '00000000-0000-4000-8000-000000000001'),
  array['Leeks', 'Lardons', 'Salt and pepper to taste'], 'in the order sent');
select is((select weight_per_piece_g from public.recipe_ingredients where id = '00000000-0000-4000-8000-0000000000a1'), 150::numeric, 'with the weight of one piece');

insert into public.recipe_steps (recipe_id, position, body) values
  ('00000000-0000-4000-8000-000000000001', 0, 'Cook {ing:00000000-0000-4000-8000-0000000000a1} and {ing:00000000-0000-4000-8000-0000000000a2} together.'),
  ('00000000-0000-4000-8000-000000000001', 1, '{ing:00000000-0000-4000-8000-0000000000a2}');

select lives_ok($$ select public.save_recipe_ingredients('00000000-0000-4000-8000-000000000001', '[
  {"id": "00000000-0000-4000-8000-0000000000a3", "name": "Salt and pepper to taste"},
  {"id": "00000000-0000-4000-8000-0000000000a1", "name": "Leeks", "quantity": 3, "unit": "piece", "weight_per_piece_g": 150}
]') $$, 'reordering and removing saves in one go');
select is((select array_agg(name order by position) from public.recipe_ingredients where recipe_id = '00000000-0000-4000-8000-000000000001'),
  array['Salt and pepper to taste', 'Leeks'], 'rows swap positions; the one left out is gone');
select is((select quantity from public.recipe_ingredients where id = '00000000-0000-4000-8000-0000000000a1'), 3::numeric, 'a kept row is updated');
select is((select body from public.recipe_steps where position = 0 and recipe_id = '00000000-0000-4000-8000-000000000001'),
  'Cook {ing:00000000-0000-4000-8000-0000000000a1} and together.', 'the removed ingredient is taken out of its step');
select is((select body from public.recipe_steps where position = 1 and recipe_id = '00000000-0000-4000-8000-000000000001'),
  '{ing:00000000-0000-4000-8000-0000000000a2}', 'a step that was only that ingredient keeps its text');

select throws_ok($$ select public.save_recipe_ingredients('00000000-0000-4000-8000-000000000002', '[
  {"id": "00000000-0000-4000-8000-0000000000a1", "name": "Leeks"}]') $$, '22023', null, 'an ingredient cannot move to another recipe');
select throws_ok($$ select public.save_recipe_ingredients('00000000-0000-4000-8000-000000000001', '[
  {"id": "00000000-0000-4000-8000-0000000000a5", "name": "Cream", "unit": "ml"}]') $$, '23514', null, 'the table''s checks still apply (a unit needs an amount)');
select is((select count(*)::int from public.recipe_ingredients where recipe_id = '00000000-0000-4000-8000-000000000001'), 2, 'a refused save changes nothing');

-- Sam (another family) can't save into family A's recipe, nor take its ingredients.
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select throws_ok($$ select public.save_recipe_ingredients('00000000-0000-4000-8000-000000000001', '[]') $$, 'P0002', null, 'other family: the recipe is not found');
insert into public.recipes (id, name) values ('00000000-0000-4000-8000-000000000003', 'Sam''s');
select throws_ok($$ select public.save_recipe_ingredients('00000000-0000-4000-8000-000000000003', '[
  {"id": "00000000-0000-4000-8000-0000000000a1", "name": "Mine now"}]') $$, '22023', null, 'other family: cannot take over another family''s ingredient');
reset role;
select is((select name from public.recipe_ingredients where id = '00000000-0000-4000-8000-0000000000a1'), 'Leeks', 'family A''s ingredient is untouched');

select * from finish();
rollback;
